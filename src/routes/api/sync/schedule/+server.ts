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
 * Now uses JSON-LD structured data instead of HTML parsing
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

		// Extract JSON-LD structured data from the page
		// Events are in a JSON array embedded in the HTML
		let events: any[] = [];
		const jsonStartIndex = html.indexOf('[{"@context":"http://schema.org"');
		if (jsonStartIndex !== -1) {
			// Find the matching closing bracket by counting depth
			let depth = 0;
			let jsonEndIndex = jsonStartIndex;
			for (let i = jsonStartIndex; i < html.length; i++) {
				if (html[i] === '[' || html[i] === '{') depth++;
				if (html[i] === ']' || html[i] === '}') depth--;
				if (depth === 0) {
					jsonEndIndex = i + 1;
					break;
				}
			}

			try {
				const jsonStr = html.substring(jsonStartIndex, jsonEndIndex);
				const jsonArray = JSON.parse(jsonStr);
				events = jsonArray.filter((item: any) => item['@type'] === 'Event');
			} catch (e) {
				console.error('[Schedule] Error parsing JSON array:', e);
			}
		}

		if (events.length === 0) {
			console.log(`[Schedule] No events found on page ${page}`);
			break;
		}

		console.log(`[Schedule] Found ${events.length} events on page ${page}`);

		for (const event of events) {
			try {

				// Extract data from JSON-LD
				const title = event.name?.replace(/&#\d+;/g, (match: string) => {
					const code = parseInt(match.match(/\d+/)?.[0] || '0');
					return String.fromCharCode(code);
				}).replace(/&quot;/g, '"').replace(/&amp;/g, '&');

				const url = event.url;
				const imageUrl = event.image;
				const description = event.description?.replace(/<[^>]*>/g, '').trim();

				// Parse startDate (e.g., "2026-01-02T20:00:00+01:00")
				// Extract time directly from ISO string to avoid timezone issues
				const startDateStr = event.startDate;
				if (!startDateStr) continue;

				// Extract date and time from ISO format: "2026-01-02T20:00:00+01:00"
				const [datePart, timePart] = startDateStr.split('T');
				const date = datePart; // "2026-01-02"
				const time = timePart.substring(0, 5); // "20:00" (HH:MM)

				if (imageUrl) {
					images.set(url, imageUrl);
				}

				shows.push({
					title,
					date,
					time,
					url,
					description
				});
			} catch (e) {
				console.error('[Schedule] Error parsing JSON-LD event:', e);
			}
		}

		// Check for next page in HTML
		const root = parse(html);
		const nextLink = root.querySelector('a.tribe-events-c-nav__next');
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
