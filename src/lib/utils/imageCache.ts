import { put } from '@vercel/blob';

const getEventProxyUrl = () => import.meta.env.VITE_PROXY_EVENT_URL;

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
 * Simple hash function for URL to filename conversion
 */
function hashString(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
	return Math.abs(hash).toString(36);
}

/**
 * Fetch an image via proxy and upload to Vercel Blob
 * Returns the blob URL or null if caching fails
 */
export async function cacheImageToBlob(imageUrl: string): Promise<string | null> {
	const proxyBase = getEventProxyUrl();

	// If no proxy configured or no blob token, skip caching
	if (!proxyBase || !process.env.BLOB_READ_WRITE_TOKEN) {
		console.log('[ImageCache] Missing proxy or blob token, skipping cache');
		return null;
	}

	try {
		// Fetch image via proxy to bypass Cloudflare
		const proxyUrl = `${proxyBase}?url=${encodeURIComponent(imageUrl)}`;
		const response = await fetch(proxyUrl, {
			signal: AbortSignal.timeout(10000)
		});

		if (!response.ok) {
			console.log(`[ImageCache] Failed to fetch image: ${response.status}`);
			return null;
		}

		// Get the image data
		const imageBuffer = await response.arrayBuffer();
		const contentType = response.headers.get('content-type') || 'image/jpeg';

		// Generate blob path
		const blobPath = getBlobPath(imageUrl);

		// Upload to Vercel Blob
		const blob = await put(blobPath, imageBuffer, {
			access: 'public',
			contentType,
			addRandomSuffix: false // Use consistent paths for deduplication
		});

		console.log(`[ImageCache] Cached image: ${imageUrl} -> ${blob.url}`);
		return blob.url;
	} catch (error) {
		console.error(`[ImageCache] Error caching image: ${error}`);
		return null;
	}
}

/**
 * Batch cache multiple images
 * Returns a map of original URL -> blob URL
 */
export async function cacheImagesToBlob(
	imageUrls: Map<string, string>,
	concurrency = 4
): Promise<Map<string, string>> {
	const results = new Map<string, string>();
	const entries = Array.from(imageUrls.entries());

	let idx = 0;

	async function processNext(): Promise<void> {
		if (idx >= entries.length) return;

		const [eventUrl, originalImageUrl] = entries[idx++];

		const blobUrl = await cacheImageToBlob(originalImageUrl);
		if (blobUrl) {
			results.set(eventUrl, blobUrl);
		} else {
			// Fall back to original URL if caching fails
			results.set(eventUrl, originalImageUrl);
		}

		await processNext();
	}

	await Promise.all(Array.from({ length: concurrency }, processNext));

	console.log(`[ImageCache] Cached ${results.size} images (${entries.length - results.size} failures)`);
	return results;
}
