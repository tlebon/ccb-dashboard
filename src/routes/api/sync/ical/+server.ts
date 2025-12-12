import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { upsertShow } from '$lib/db';
import ICAL from 'ical.js';
import { parse } from 'node-html-parser';
import { cacheImagesToBlob } from '$lib/utils/imageCache';

const getIcalUrl = () => import.meta.env.VITE_PROXY_ICAL_URL || 'https://www.comedycafeberlin.com/?post_type=tribe_events&ical=1&eventDisplay=list';
const getEventProxyUrl = () => import.meta.env.VITE_PROXY_EVENT_URL;

function fetchWithTimeout(resource: string, options: Record<string, unknown> = {}, timeout = 5000) {
	return Promise.race([
		fetch(resource, options),
		new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
	]);
}

async function fetchImageUrls(eventUrls: string[]): Promise<Map<string, string>> {
	const imageUrls = new Map<string, string>();
	const eventProxyBase = getEventProxyUrl();

	if (!eventProxyBase) {
		console.log('[Sync] No event proxy configured, skipping image fetch');
		return imageUrls;
	}

	const CONCURRENCY = 4;
	let idx = 0;

	async function processNext(): Promise<void> {
		if (idx >= eventUrls.length) return;
		const url = eventUrls[idx++];
		try {
			const proxyUrl = `${eventProxyBase}?url=${encodeURIComponent(url)}`;
			const eventResponse = await fetchWithTimeout(proxyUrl, {}, 5000) as Response;

			if (eventResponse.ok) {
				const html = await eventResponse.text();
				const root = parse(html);
				const figure = root.querySelector('figure.wp-block-post-featured-image');
				const img = figure?.querySelector('img');
				const imageUrl = img?.getAttribute('src');
				if (imageUrl) {
					imageUrls.set(url, imageUrl);
				}
			}
		} catch (e) {
			// Silently continue on timeout/error for individual pages
		}
		await processNext();
	}

	await Promise.all(Array.from({ length: CONCURRENCY }, processNext));
	return imageUrls;
}

export const POST: RequestHandler = async ({ request }) => {
	// Optional: Add a secret key check for security
	const authHeader = request.headers.get('authorization');
	const expectedToken = process.env.SYNC_SECRET;

	if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const response = await fetch(getIcalUrl());

		if (!response.ok) {
			throw new Error(`Failed to fetch iCal: ${response.status}`);
		}

		let icalData = await response.text();

		// Unfold lines
		icalData = icalData.replace(/\r?\n[ \t]/g, '');

		const jcalData = ICAL.parse(icalData);
		const comp = new ICAL.Component(jcalData);
		const vevents = comp.getAllSubcomponents('vevent');

		// Extract VEVENT blocks for URL parsing
		const veventBlocks = icalData.split('BEGIN:VEVENT').slice(1).map(block =>
			'BEGIN:VEVENT' + block.split('END:VEVENT')[0]
		);

		// Extract event URLs for image fetching
		const eventUrls: string[] = [];
		for (const block of veventBlocks) {
			const urlMatch = block.match(/URL:(.+)/);
			if (urlMatch) {
				eventUrls.push(urlMatch[1].trim());
			}
		}

		// Fetch images from event pages
		const originalImageUrls = await fetchImageUrls(eventUrls);
		console.log(`Fetched ${originalImageUrls.size} images from ${eventUrls.length} event pages`);

		// Cache images to Vercel Blob
		const imageUrls = await cacheImagesToBlob(originalImageUrls);
		console.log(`Cached ${imageUrls.size} images to Vercel Blob`);

		let synced = 0;
		let errors = 0;

		for (let i = 0; i < vevents.length; i++) {
			try {
				const event = vevents[i];
				const icalEvent = new ICAL.Event(event);
				const start = icalEvent.startDate.toJSDate();
				const veventBlock = veventBlocks[i] || '';

				// Extract URL
				let url: string | undefined;
				const urlMatch = veventBlock.match(/URL:(.+)/);
				if (urlMatch) {
					url = urlMatch[1].trim();
				}

				// Get cached image URL if available (falls back to original if caching failed)
				const image_url = url ? imageUrls.get(url) : undefined;

				// Format date and time
				const date = start.toISOString().split('T')[0];
				const time = start.toLocaleTimeString('en-GB', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false
				});

				await upsertShow({
					title: icalEvent.summary || 'Untitled',
					date,
					time,
					description: icalEvent.description || undefined,
					source: 'ical',
					ical_uid: icalEvent.uid,
					url,
					image_url
				});

				synced++;
			} catch (e) {
				console.error('Error syncing event:', e);
				errors++;
			}
		}

		console.log(`Synced ${synced} shows, ${errors} errors`);

		return json({
			success: true,
			synced,
			errors,
			total: vevents.length,
			images: imageUrls.size
		});
	} catch (error) {
		console.error('Sync error:', error);
		return json({ error: 'Sync failed', details: String(error) }, { status: 500 });
	}
};

// GET for Vercel cron jobs
export const GET: RequestHandler = async ({ request }) => {
	// Verify this is a cron request in production
	const authHeader = request.headers.get('authorization');
	const cronSecret = process.env.CRON_SECRET;

	// In production, verify the cron secret
	if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// Reuse POST logic
	try {
		const response = await fetch(getIcalUrl());

		if (!response.ok) {
			throw new Error(`Failed to fetch iCal: ${response.status}`);
		}

		let icalData = await response.text();
		icalData = icalData.replace(/\r?\n[ \t]/g, '');

		const jcalData = ICAL.parse(icalData);
		const comp = new ICAL.Component(jcalData);
		const vevents = comp.getAllSubcomponents('vevent');

		const veventBlocks = icalData
			.split('BEGIN:VEVENT')
			.slice(1)
			.map((block) => 'BEGIN:VEVENT' + block.split('END:VEVENT')[0]);

		// Extract event URLs for image fetching
		const eventUrls: string[] = [];
		for (const block of veventBlocks) {
			const urlMatch = block.match(/URL:(.+)/);
			if (urlMatch) {
				eventUrls.push(urlMatch[1].trim());
			}
		}

		// Fetch images from event pages
		const originalImageUrls = await fetchImageUrls(eventUrls);
		console.log(`[Cron] Fetched ${originalImageUrls.size} images from ${eventUrls.length} event pages`);

		// Cache images to Vercel Blob
		const imageUrls = await cacheImagesToBlob(originalImageUrls);
		console.log(`[Cron] Cached ${imageUrls.size} images to Vercel Blob`);

		let synced = 0;

		for (let i = 0; i < vevents.length; i++) {
			try {
				const event = vevents[i];
				const icalEvent = new ICAL.Event(event);
				const start = icalEvent.startDate.toJSDate();
				const veventBlock = veventBlocks[i] || '';

				let url: string | undefined;
				const urlMatch = veventBlock.match(/URL:(.+)/);
				if (urlMatch) {
					url = urlMatch[1].trim();
				}

				// Get cached image URL if available (falls back to original if caching failed)
				const image_url = url ? imageUrls.get(url) : undefined;

				const date = start.toISOString().split('T')[0];
				const time = start.toLocaleTimeString('en-GB', {
					hour: '2-digit',
					minute: '2-digit',
					hour12: false
				});

				await upsertShow({
					title: icalEvent.summary || 'Untitled',
					date,
					time,
					description: icalEvent.description || undefined,
					source: 'ical',
					ical_uid: icalEvent.uid,
					url,
					image_url
				});

				synced++;
			} catch (e) {
				console.error('[Cron] Error syncing event:', e);
			}
		}

		console.log(`[Cron] Synced ${synced} shows`);

		return json({
			success: true,
			synced,
			total: vevents.length,
			images: imageUrls.size,
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('[Cron] Sync error:', error);
		return json({ error: 'Sync failed', details: String(error) }, { status: 500 });
	}
};
