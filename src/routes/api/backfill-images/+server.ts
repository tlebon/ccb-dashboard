import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { parse } from 'node-html-parser';
import { cacheImageToBlob } from '$lib/utils/imageCache';

/**
 * Backfill images for existing shows by scraping their event pages
 * Processes shows in batches of 100 to avoid timeouts
 */
export const POST: RequestHandler = async ({ request }) => {
	// Auth check
	const authHeader = request.headers.get('authorization');
	const syncSecret = process.env.SYNC_SECRET;
	if (syncSecret && authHeader !== `Bearer ${syncSecret}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		// Get all shows with URLs but no images
		const result = await db.execute({
			sql: `SELECT id, url FROM shows
			      WHERE url IS NOT NULL
			      AND (image_url IS NULL OR image_url = '')
			      LIMIT 100`, // Process in batches
			args: []
		});

		const shows = result.rows as Array<{ id: number; url: string }>;
		console.log(`[Backfill] Processing ${shows.length} shows`);

		let updated = 0;
		let failed = 0;

		// Process with concurrency limit and delays to avoid rate limiting
		const CONCURRENCY = 2; // Reduced from 4
		let idx = 0;

		async function processNext(): Promise<void> {
			if (idx >= shows.length) return;
			const show = shows[idx++];

			try {
				// Add delay to avoid Cloudflare rate limiting
				await new Promise((resolve) => setTimeout(resolve, 2000));

				// Use proxy to bypass Cloudflare's cloud IP blocking
				const proxyBase = process.env.VITE_PROXY_EVENT_URL;
				const fetchUrl = proxyBase
					? `${proxyBase}?url=${encodeURIComponent(show.url)}`
					: show.url;

				const response = await fetch(fetchUrl, {
					signal: AbortSignal.timeout(10000)
				});

				if (!response.ok) {
					console.log(`[Backfill] Failed to fetch ${show.url}: ${response.status}`);
					failed++;
					return await processNext();
				}

				const html = await response.text();
				const root = parse(html);

				// Extract image from event page
				const figure = root.querySelector('figure.wp-block-post-featured-image');
				const img = figure?.querySelector('img');
				const originalImageUrl = img?.getAttribute('src');

				if (originalImageUrl) {
					// Cache to Vercel Blob with correct content-type
					const blobUrl = await cacheImageToBlob(originalImageUrl);
					if (blobUrl) {
						// Store both original and blob URLs
						await db.execute({
							sql: 'UPDATE shows SET image_url = ?, original_image_url = ? WHERE id = ?',
							args: [blobUrl, originalImageUrl, show.id]
						});
						updated++;
						console.log(`[Backfill] Updated show ${show.id}: ${blobUrl}`);
					} else {
						console.log(`[Backfill] Failed to cache image for show ${show.id}`);
						failed++;
					}
				} else {
					console.log(`[Backfill] No image found on page for show ${show.id}`);
					failed++;
				}
			} catch (e) {
				console.error(`[Backfill] Error processing show ${show.id}:`, e);
				failed++;
			}

			await processNext();
		}

		await Promise.all(Array.from({ length: CONCURRENCY }, processNext));

		console.log(`[Backfill] Complete: ${updated} updated, ${failed} failed`);

		return json({
			success: true,
			updated,
			failed,
			total: shows.length,
			hasMore: shows.length === 100
		});
	} catch (error) {
		console.error('[Backfill] Error:', error);
		return json({ error: 'Backfill failed', details: String(error) }, { status: 500 });
	}
};

/**
 * GET endpoint to check backfill status
 */
export const GET: RequestHandler = async () => {
	try {
		const result = await db.execute({
			sql: `SELECT
				COUNT(*) as total_with_urls,
				SUM(CASE WHEN image_url IS NOT NULL AND image_url != '' THEN 1 ELSE 0 END) as with_images,
				SUM(CASE WHEN image_url IS NULL OR image_url = '' THEN 1 ELSE 0 END) as without_images
			FROM shows
			WHERE url IS NOT NULL`,
			args: []
		});

		const stats = result.rows[0] as unknown as {
			total_with_urls: number;
			with_images: number;
			without_images: number;
		};

		return json({
			total_with_urls: stats.total_with_urls,
			with_images: stats.with_images,
			without_images: stats.without_images,
			percentage_complete:
				stats.total_with_urls > 0
					? Math.round((stats.with_images / stats.total_with_urls) * 100)
					: 0
		});
	} catch (error) {
		console.error('[Backfill] Status error:', error);
		return json({ error: 'Failed to get status', details: String(error) }, { status: 500 });
	}
};
