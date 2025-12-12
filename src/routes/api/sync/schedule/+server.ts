import { json } from '@sveltejs/kit';
import type { RequestHandler} from './$types';
import { upsertShow } from '$lib/db';
import { parse } from 'node-html-parser';
import { cacheImagesToBlob } from '$lib/utils/imageCache';

/**
 * Sync shows by scraping CCB's schedule list page
 * Replaces the iCal sync which is now blocked by Cloudflare
 */
export const GET: RequestHandler = async ({ request, url }) => {
	// Auth check
	const authHeader = request.headers.get('authorization');
	const cronSecret = process.env.CRON_SECRET;
	if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Check if we should also sync past events
	const includePast = url.searchParams.get('includePast') === 'true';

	try {
		let synced = 0;
		let errors = 0;
		const allShows: Array<{
			title: string;
			date: string;
			time: string;
			url: string;
			description?: string;
		}> = [];
		const imageUrls = new Map<string, string>();

		// Fetch future events
		console.log('[Schedule] Fetching future events...');
		const futureShows = await scrapeSchedulePage(
			'https://www.comedycafeberlin.com/schedule/list/'
		);
		allShows.push(...futureShows.shows);
		for (const [url, imgUrl] of futureShows.images) {
			imageUrls.set(url, imgUrl);
		}
		console.log(`[Schedule] Found ${futureShows.shows.length} future events`);

		// Optionally fetch past events
		if (includePast) {
			console.log('[Schedule] Fetching past events...');
			const pastShows = await scrapeSchedulePage(
				'https://www.comedycafeberlin.com/schedule/list/?eventDisplay=past'
			);
			allShows.push(...pastShows.shows);
			for (const [url, imgUrl] of pastShows.images) {
				imageUrls.set(url, imgUrl);
			}
			console.log(`[Schedule] Found ${pastShows.shows.length} past events`);
		}

		console.log(`[Schedule] Total shows to process: ${allShows.length}`);
		console.log(`[Schedule] Caching ${imageUrls.size} images to Vercel Blob...`);

		// Cache images to Vercel Blob
		const cachedImages = await cacheImagesToBlob(imageUrls);
		console.log(`[Schedule] Cached ${cachedImages.size} images`);

		// Upsert shows to database
		for (const show of allShows) {
			try {
				await upsertShow({
					title: show.title,
					date: show.date,
					time: show.time,
					description: show.description,
					source: 'schedule',
					url: show.url,
					image_url: cachedImages.get(show.url),
					original_image_url: imageUrls.get(show.url)
				});
				synced++;
			} catch (e) {
				console.error(`[Schedule] Error upserting show "${show.title}":`, e);
				errors++;
			}
		}

		console.log(`[Schedule] Sync complete: ${synced} synced, ${errors} errors`);

		return json({
			success: true,
			synced,
			errors,
			total: allShows.length,
			images: cachedImages.size,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('[Schedule] Sync error:', error);
		return json({ error: 'Sync failed', details: String(error) }, { status: 500 });
	}
};

/**
 * Scrape a single schedule page (handles pagination automatically)
 */
async function scrapeSchedulePage(baseUrl: string): Promise<{
	shows: Array<{
		title: string;
		date: string;
		time: string;
		url: string;
		description?: string;
	}>;
	images: Map<string, string>;
}> {
	const shows: Array<{
		title: string;
		date: string;
		time: string;
		url: string;
		description?: string;
	}> = [];
	const images = new Map<string, string>();

	let currentUrl = baseUrl;
	let page = 1;
	const MAX_PAGES = 10; // Safety limit

	while (currentUrl && page <= MAX_PAGES) {
		console.log(`[Schedule] Fetching page ${page}: ${currentUrl}`);

		// Use proxy to bypass Cloudflare's cloud IP blocking
		const proxyBase = process.env.VITE_PROXY_EVENT_URL;
		const fetchUrl = proxyBase
			? `${proxyBase}?url=${encodeURIComponent(currentUrl)}`
			: currentUrl;

		const response = await fetch(fetchUrl, {
			signal: AbortSignal.timeout(15000)
		});

		if (!response.ok) {
			console.error(`[Schedule] Failed to fetch ${currentUrl}: ${response.status}`);
			break;
		}

		const html = await response.text();
		const root = parse(html);

		// Find all event rows
		const eventRows = root.querySelectorAll('.tribe-events-calendar-list__event-row');
		console.log(`[Schedule] Found ${eventRows.length} events on page ${page}`);

		for (const row of eventRows) {
			try {
				// Extract title and URL
				const titleLink = row.querySelector('h3 a');
				if (!titleLink) continue;

				const title = titleLink.text.trim();
				const url = titleLink.getAttribute('href');
				if (!url) continue;

				// Extract date/time
				const timeElement = row.querySelector('time');
				if (!timeElement) continue;

				const dateTimeText = timeElement.text.trim();
				// Format: "Friday, December 12 | 9:30pm - 10:30pm"
				const [datePart, timePart] = dateTimeText.split('|').map((s) => s.trim());

				if (!datePart || !timePart) continue;

				// Parse date (e.g., "Friday, December 12")
				const date = parseDateString(datePart);
				if (!date) continue;

				// Extract start time (e.g., "9:30pm" from "9:30pm - 10:30pm")
				const time = timePart.split('-')[0].trim();

				// Extract image
				const img = row.querySelector('img');
				const imageUrl = img?.getAttribute('src');
				if (imageUrl) {
					images.set(url, imageUrl);
				}

				// Extract description (optional)
				const descElement = row.querySelector('p');
				const description = descElement?.text.trim();

				shows.push({
					title,
					date,
					time: convertTo24Hour(time),
					url,
					description
				});
			} catch (e) {
				console.error('[Schedule] Error parsing event row:', e);
			}
		}

		// Check for next page
		const nextLink = root.querySelector('.tribe-events-c-nav__next a');
		const nextUrl = nextLink?.getAttribute('href');

		if (nextUrl && nextUrl !== currentUrl) {
			currentUrl = nextUrl;
			page++;
		} else {
			break;
		}
	}

	return { shows, images };
}

/**
 * Parse date string like "Friday, December 12" to YYYY-MM-DD format
 */
function parseDateString(dateStr: string): string | null {
	try {
		// Remove day of week (e.g., "Friday, ")
		const withoutDay = dateStr.replace(/^[A-Za-z]+,\s*/, '');

		// Parse "December 12" or "December 12, 2025"
		const parts = withoutDay.split(/[\s,]+/).filter(Boolean);
		if (parts.length < 2) return null;

		const monthStr = parts[0];
		const day = parseInt(parts[1]);
		const year = parts[2] ? parseInt(parts[2]) : new Date().getFullYear();

		const months: Record<string, number> = {
			January: 0,
			February: 1,
			March: 2,
			April: 3,
			May: 4,
			June: 5,
			July: 6,
			August: 7,
			September: 8,
			October: 9,
			November: 10,
			December: 11
		};

		const month = months[monthStr];
		if (month === undefined) return null;

		const date = new Date(year, month, day);
		return date.toISOString().split('T')[0];
	} catch {
		return null;
	}
}

/**
 * Convert 12-hour time to 24-hour format (e.g., "9:30pm" -> "21:30")
 */
function convertTo24Hour(time12h: string): string {
	try {
		const match = time12h.match(/(\d+):(\d+)\s*(am|pm)/i);
		if (!match) return time12h;

		let [, hourStr, minute, period] = match;
		let hour = parseInt(hourStr);

		if (period.toLowerCase() === 'pm' && hour !== 12) {
			hour += 12;
		} else if (period.toLowerCase() === 'am' && hour === 12) {
			hour = 0;
		}

		return `${hour.toString().padStart(2, '0')}:${minute}`;
	} catch {
		return time12h;
	}
}
