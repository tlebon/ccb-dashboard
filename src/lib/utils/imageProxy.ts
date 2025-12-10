/**
 * Process image URLs for display
 * Previously proxied through our API, but Cloudflare blocks Vercel IPs
 * Now returns the original URL directly
 */
export function proxyImageUrl(url: string | null | undefined): string | null {
	if (!url) return null;
	return url;
}
