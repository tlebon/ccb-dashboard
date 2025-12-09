/**
 * Convert a CCB image URL to use our proxy endpoint for caching
 * This reduces load on CCB's servers and caches images at Vercel's edge
 */
export function proxyImageUrl(url: string | null | undefined): string | null {
	if (!url) return null;

	// Only proxy CCB images
	if (!url.includes('comedycafeberlin.com')) {
		return url;
	}

	return `/api/images?url=${encodeURIComponent(url)}`;
}
