import type { RequestHandler } from './$types';

// Cache images for 7 days at CDN edge, 1 day in browser
const CACHE_CONTROL = 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400';

export const GET: RequestHandler = async ({ url, fetch }) => {
	const imageUrl = url.searchParams.get('url');

	if (!imageUrl) {
		return new Response('Missing url parameter', { status: 400 });
	}

	// Only allow proxying images from comedycafeberlin.com
	try {
		const parsedUrl = new URL(imageUrl);
		if (!parsedUrl.hostname.includes('comedycafeberlin.com')) {
			return new Response('Only CCB images allowed', { status: 403 });
		}
	} catch {
		return new Response('Invalid URL', { status: 400 });
	}

	try {
		const response = await fetch(imageUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9',
				'Referer': 'https://comedycafeberlin.com/'
			}
		});

		if (!response.ok) {
			return new Response('Failed to fetch image', { status: response.status });
		}

		const contentType = response.headers.get('content-type') || 'image/jpeg';
		const imageData = await response.arrayBuffer();

		return new Response(imageData, {
			headers: {
				'Content-Type': contentType,
				'Cache-Control': CACHE_CONTROL,
				'X-Proxy-From': 'ccb-dashboard'
			}
		});
	} catch (e) {
		console.error('Error proxying image:', e);
		return new Response('Failed to fetch image', { status: 500 });
	}
};
