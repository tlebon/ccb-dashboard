import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { cacheImageToBlob } from '$lib/utils/imageCache';

/**
 * Migrate existing images to Vercel Blob storage
 * This endpoint fetches all shows with CCB image URLs and caches them
 */
export const POST: RequestHandler = async ({ request }) => {
	// Verify authorization
	const authHeader = request.headers.get('authorization');
	const expectedToken = process.env.SYNC_SECRET;

	if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Check for blob token
	if (!process.env.BLOB_READ_WRITE_TOKEN) {
		return json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 500 });
	}

	try {
		// Get all shows with CCB image URLs (not already cached to blob storage)
		const result = await db.execute({
			sql: `SELECT id, image_url FROM shows
			      WHERE image_url IS NOT NULL
			      AND image_url LIKE '%comedycafeberlin.com%'`,
			args: []
		});

		const shows = result.rows as unknown as { id: number; image_url: string }[];
		console.log(`[ImageMigration] Found ${shows.length} shows with CCB images to migrate`);

		let migrated = 0;
		let failed = 0;
		const errors: string[] = [];

		// Process images with limited concurrency
		const CONCURRENCY = 4;
		let idx = 0;

		async function processNext(): Promise<void> {
			if (idx >= shows.length) return;

			const show = shows[idx++];
			try {
				const blobUrl = await cacheImageToBlob(show.image_url);
				if (blobUrl && blobUrl !== show.image_url) {
					// Update the database with the blob URL
					await db.execute({
						sql: 'UPDATE shows SET image_url = ? WHERE id = ?',
						args: [blobUrl, show.id]
					});
					migrated++;
					console.log(`[ImageMigration] Migrated show ${show.id}: ${blobUrl}`);
				} else {
					failed++;
					errors.push(`Show ${show.id}: Failed to cache`);
				}
			} catch (e) {
				failed++;
				errors.push(`Show ${show.id}: ${e}`);
			}

			await processNext();
		}

		await Promise.all(Array.from({ length: CONCURRENCY }, processNext));

		console.log(`[ImageMigration] Complete: ${migrated} migrated, ${failed} failed`);

		return json({
			success: true,
			total: shows.length,
			migrated,
			failed,
			errors: errors.slice(0, 10) // Return first 10 errors only
		});
	} catch (error) {
		console.error('[ImageMigration] Error:', error);
		return json({ error: 'Migration failed', details: String(error) }, { status: 500 });
	}
};

/**
 * GET endpoint to check migration status
 */
export const GET: RequestHandler = async () => {
	try {
		// Count images by type
		const result = await db.execute({
			sql: `SELECT
				COUNT(*) as total,
				SUM(CASE WHEN image_url LIKE '%blob.vercel-storage.com%' THEN 1 ELSE 0 END) as cached,
				SUM(CASE WHEN image_url LIKE '%comedycafeberlin.com%' THEN 1 ELSE 0 END) as uncached,
				SUM(CASE WHEN image_url IS NULL THEN 1 ELSE 0 END) as no_image
			FROM shows`,
			args: []
		});

		const stats = result.rows[0] as unknown as {
			total: number;
			cached: number;
			uncached: number;
			no_image: number;
		};

		return json({
			total: stats.total,
			cached: stats.cached,
			uncached: stats.uncached,
			no_image: stats.no_image,
			percentage_cached: stats.total > 0 ? Math.round((stats.cached / stats.total) * 100) : 0
		});
	} catch (error) {
		console.error('[ImageMigration] Status error:', error);
		return json({ error: 'Failed to get status', details: String(error) }, { status: 500 });
	}
};
