import { put, head } from '@vercel/blob';
import { createHash } from 'crypto';
import { env } from '$env/dynamic/private';

/**
 * Generate a consistent blob path from an image URL
 * Uses the last part of the URL path as the filename
 */
function getBlobPath(imageUrl: string): string {
	try {
		const url = new URL(imageUrl);
		const pathname = url.pathname;
		// Get filename from path, or use hash of URL
		const filename = pathname.split('/').pop() || hashString(imageUrl);
		// Ensure it has an extension
		const hasExtension = /\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
		return `images/${hasExtension ? filename : `${filename}.jpg`}`;
	} catch {
		return `images/${hashString(imageUrl)}.jpg`;
	}
}

/**
 * SHA256 hash for URL to filename conversion (collision-resistant)
 */
function hashString(str: string): string {
	return createHash('sha256').update(str).digest('hex').substring(0, 16);
}

/**
 * Determine content-type from image URL file extension
 * Don't trust proxy headers as they may return HTML error pages
 */
function getContentTypeFromUrl(imageUrl: string): string {
	const extension = imageUrl.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)(?:\?|$)/)?.[1];

	switch (extension) {
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'png':
			return 'image/png';
		case 'gif':
			return 'image/gif';
		case 'webp':
			return 'image/webp';
		default:
			return 'image/jpeg'; // Safe fallback
	}
}

/**
 * Fetch an image via proxy and upload to Vercel Blob
 * Returns the blob URL or null if caching fails
 * @param imageUrl - The image URL to cache
 * @param force - If true, skip existence check and force re-upload (useful for fixing broken blobs)
 */
export async function cacheImageToBlob(imageUrl: string, force = false): Promise<string | null> {
	const proxyBase = env.VITE_PROXY_EVENT_URL;

	// If no proxy configured or no blob token, skip caching
	if (!proxyBase || !process.env.BLOB_READ_WRITE_TOKEN) {
		console.log('[ImageCache] Missing proxy or blob token, skipping cache');
		return null;
	}

	try {
		// Generate blob path
		const blobPath = getBlobPath(imageUrl);

		// Check if blob already exists (unless force=true)
		if (!force) {
			try {
				const existingBlob = await head(blobPath);
				if (existingBlob) {
					console.log(`[ImageCache] Blob already exists: ${imageUrl} -> ${existingBlob.url}`);
					return existingBlob.url;
				}
			} catch (e) {
				// Blob doesn't exist, proceed with upload
			}
		}

		// Fetch image via proxy to bypass Cloudflare
		const proxyUrl = `${proxyBase}?url=${encodeURIComponent(imageUrl)}`;
		const response = await fetch(proxyUrl, {
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			console.log(`[ImageCache] Failed to fetch image: ${response.status}`);
			return null;
		}

		// Get the image data as bytes (not arrayBuffer to avoid encoding issues)
		const imageBytes = new Uint8Array(await response.arrayBuffer());

		// Determine content-type from original image URL extension (don't trust proxy headers)
		const contentType = getContentTypeFromUrl(imageUrl);

		// Upload to Vercel Blob with timeout
		const uploadOptions: Record<string, unknown> = {
			access: 'public',
			contentType,
			addRandomSuffix: false // Use consistent paths for deduplication
		};

		// When force=true, allow overwriting existing blobs with correct content-type
		if (force) {
			uploadOptions.allowOverwrite = true;
		}

		const uploadPromise = put(blobPath, imageBytes, uploadOptions);

		const blob = await Promise.race([
			uploadPromise,
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error('Blob upload timeout')), 15000)
			)
		]);

		console.log(`[ImageCache] Cached image: ${imageUrl} -> ${blob.url}`);
		return blob.url;
	} catch (error) {
		console.error(`[ImageCache] Error caching image: ${error}`);
		return null;
	}
}

/**
 * Batch cache multiple images
 * Returns a map of original URL -> blob URL (or original URL as fallback)
 */
export async function cacheImagesToBlob(
	imageUrls: Map<string, string>,
	concurrency = 4
): Promise<Map<string, string>> {
	const results = new Map<string, string>();
	const entries = Array.from(imageUrls.entries());

	let idx = 0;
	let cached = 0;
	let fallbacks = 0;

	async function processNext(): Promise<void> {
		if (idx >= entries.length) return;

		// Note: idx++ is safe here due to JavaScript's single-threaded execution
		const [eventUrl, originalImageUrl] = entries[idx++];

		const blobUrl = await cacheImageToBlob(originalImageUrl);
		if (blobUrl) {
			results.set(eventUrl, blobUrl);
			cached++;
		} else {
			// Fall back to original URL if caching fails
			results.set(eventUrl, originalImageUrl);
			fallbacks++;
		}

		await processNext();
	}

	await Promise.all(Array.from({ length: concurrency }, processNext));

	console.log(`[ImageCache] Cached ${cached} images, ${fallbacks} fallbacks to original URLs`);
	return results;
}
