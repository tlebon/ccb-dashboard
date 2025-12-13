import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { url: testUrl } = await request.json();

	const results = {
		url: testUrl,
		timestamp: new Date().toISOString(),
		tests: [] as any[]
	};

	// Test 1: Direct fetch
	try {
		const directResponse = await fetch(testUrl, { signal: AbortSignal.timeout(5000) });
		const contentType = directResponse.headers.get('content-type');
		const firstBytes = await directResponse.arrayBuffer();
		const hexStart = Array.from(new Uint8Array(firstBytes.slice(0, 20)))
			.map((b) => b.toString(16).padStart(2, '0'))
			.join(' ');

		results.tests.push({
			method: 'direct',
			status: directResponse.status,
			contentType,
			size: firstBytes.byteLength,
			hexStart,
			headers: Object.fromEntries(directResponse.headers.entries())
		});
	} catch (e) {
		results.tests.push({
			method: 'direct',
			error: String(e)
		});
	}

	// Test 2: Via proxy (if configured)
	const proxyBase = process.env.VITE_PROXY_EVENT_URL;
	if (proxyBase) {
		try {
			const proxyUrl = `${proxyBase}?url=${encodeURIComponent(testUrl)}`;
			const proxyResponse = await fetch(proxyUrl, { signal: AbortSignal.timeout(5000) });
			const contentType = proxyResponse.headers.get('content-type');
			const firstBytes = await proxyResponse.arrayBuffer();
			const hexStart = Array.from(new Uint8Array(firstBytes.slice(0, 20)))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join(' ');

			results.tests.push({
				method: 'proxy',
				status: proxyResponse.status,
				contentType,
				size: firstBytes.byteLength,
				hexStart,
				headers: Object.fromEntries(proxyResponse.headers.entries())
			});
		} catch (e) {
			results.tests.push({
				method: 'proxy',
				error: String(e)
			});
		}
	}

	return json(results);
};
