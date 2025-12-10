import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { upsertShow } from '$lib/db';
import ICAL from 'ical.js';

const ICAL_URL = process.env.PROXY_ICAL_URL || 'https://www.comedycafeberlin.com/?post_type=tribe_events&ical=1&eventDisplay=list';

export const POST: RequestHandler = async ({ request }) => {
	// Optional: Add a secret key check for security
	const authHeader = request.headers.get('authorization');
	const expectedToken = process.env.SYNC_SECRET;

	if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		console.log('Fetching iCal feed from:', ICAL_URL);
		const response = await fetch(ICAL_URL);

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
					url
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
			total: vevents.length
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
		console.log('[Cron] Starting daily iCal sync from:', ICAL_URL);
		const response = await fetch(ICAL_URL);

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
					url
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
			timestamp: new Date().toISOString()
		});
	} catch (error) {
		console.error('[Cron] Sync error:', error);
		return json({ error: 'Sync failed', details: String(error) }, { status: 500 });
	}
};
