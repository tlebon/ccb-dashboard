import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { upsertShow } from '$lib/db';
import { parse } from 'node-html-parser';
import { cacheImagesToBlob } from '$lib/utils/imageCache';
import { fetchLineupFromURL } from '$lib/utils/lineupCrawler';
import { createClient } from '@libsql/client';

/**
 * Helper: Get or create a performer by name
 */
async function getOrCreatePerformer(
	db: ReturnType<typeof createClient>,
	name: string
): Promise<number> {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

	const existing = await db.execute({
		sql: 'SELECT id FROM performers WHERE slug = ? OR name = ?',
		args: [slug, name]
	});

	if (existing.rows.length > 0) {
		return existing.rows[0].id as number;
	}

	const result = await db.execute({
		sql: 'INSERT INTO performers (name, slug) VALUES (?, ?)',
		args: [name, slug]
	});
	return Number(result.lastInsertRowid);
}

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

	// Check if we should crawl lineups (default: true)
	const crawlLineups = url.searchParams.get('crawlLineups') !== 'false';

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
		const futureShows = await scrapeSchedulePage('https://www.comedycafeberlin.com/schedule/list/');
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

		// Crawl lineups if enabled
		let lineupsAdded = 0;
		let performersAdded = 0;
		if (crawlLineups) {
			console.log(`[Schedule] Crawling lineups for ${allShows.length} shows...`);
			const db = createClient({
				url: process.env.TURSO_DATABASE_URL!,
				authToken: process.env.TURSO_AUTH_TOKEN
			});
			const proxyUrl = process.env.VITE_PROXY_EVENT_URL;

			// Process shows concurrently (3 at a time)
			const CONCURRENCY = 3;
			let idx = 0;

			async function processNext(): Promise<void> {
				if (idx >= allShows.length) return;
				const show = allShows[idx++];

				try {
					// Check if show already has lineup
					const showRecord = await db.execute({
						sql: 'SELECT id FROM shows WHERE url = ?',
						args: [show.url]
					});

					if (showRecord.rows.length === 0) return;
					const showId = Number(showRecord.rows[0].id);

					const existingLineup = await db.execute({
						sql: 'SELECT COUNT(*) as count FROM show_appearances WHERE show_id = ?',
						args: [showId]
					});

					if (Number(existingLineup.rows[0].count) > 0) {
						// Already has lineup, skip
						await processNext();
						return;
					}

					// Fetch lineup from event page
					const lineup = await fetchLineupFromURL(show.url, proxyUrl, false);
					if (!lineup || lineup.performers.length === 0) {
						await processNext();
						return;
					}

					// Add performers
					for (const performerName of lineup.performers) {
						try {
							const performerId = await getOrCreatePerformer(db, performerName);
							const role = lineup.hosts.includes(performerName) ? 'host' : 'performer';

							await db.execute({
								sql: `INSERT INTO show_appearances (show_id, performer_id, role)
                      VALUES (?, ?, ?)
                      ON CONFLICT DO NOTHING`,
								args: [showId, performerId, role]
							});
							performersAdded++;
						} catch (e) {
							console.warn(`[Schedule] Error adding performer "${performerName}":`, e);
						}
					}

					lineupsAdded++;
				} catch (e) {
					console.warn(`[Schedule] Error processing lineup for "${show.title}":`, e);
				}

				await processNext();
			}

			await Promise.all(Array.from({ length: CONCURRENCY }, processNext));
			console.log(
				`[Schedule] Lineup crawling complete: ${lineupsAdded} lineups, ${performersAdded} performers`
			);
		}

		return json({
			success: true,
			synced,
			errors,
			total: allShows.length,
			images: cachedImages.size,
			lineups: crawlLineups ? lineupsAdded : undefined,
			performers: crawlLineups ? performersAdded : undefined,
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
		const fetchUrl = proxyBase ? `${proxyBase}?url=${encodeURIComponent(currentUrl)}` : currentUrl;

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
				const title = event.name
					?.replace(/&#\d+;/g, (match: string) => {
						const code = parseInt(match.match(/\d+/)?.[0] || '0');
						return String.fromCharCode(code);
					})
					.replace(/&quot;/g, '"')
					.replace(/&amp;/g, '&');

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
