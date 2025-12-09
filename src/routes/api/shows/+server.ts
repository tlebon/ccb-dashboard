import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parse } from 'node-html-parser';
import { upsertShow } from '$lib/db';
import ICAL from 'ical.js';

function fetchWithTimeout(resource: string, options: Record<string, unknown> = {}, timeout = 5000) {
  return Promise.race([
    fetch(resource, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
  ]);
}

// In-memory cache for iCal data
let cachedIcalData: string | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

async function syncToDatabase(icalData: string, imageUrls: Map<string, string>) {
    try {
        // Unfold lines for proper parsing
        const unfoldedData = icalData.replace(/\r?\n[ \t]/g, '');

        const jcalData = ICAL.parse(unfoldedData);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');

        // Extract VEVENT blocks for URL parsing
        const veventBlocks = unfoldedData.split('BEGIN:VEVENT').slice(1).map(block =>
            'BEGIN:VEVENT' + block.split('END:VEVENT')[0]
        );

        let synced = 0;
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

                // Get image URL if we have it
                const imageUrl = url ? imageUrls.get(url) : undefined;

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
                    image_url: imageUrl
                });

                synced++;
            } catch (e) {
                console.error('Error syncing event to DB:', e);
            }
        }

        console.log(`Background sync: saved ${synced} shows to database`);
    } catch (e) {
        console.error('Error in syncToDatabase:', e);
    }
}

export const GET: RequestHandler = async () => {
    try {
        const now = Date.now();
        if (cachedIcalData && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION_MS) {
            console.log('Returning cached iCal data');
            return new Response(cachedIcalData, {
                headers: {
                    'Content-Type': 'text/calendar',
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        }
        // Convert webcal:// to https://
        const icalUrl = import.meta.env.VITE_PROXY_ICAL_URL || 'https://www.comedycafeberlin.com/?post_type=tribe_events&ical=1&eventDisplay=list';
        console.log('Fetching iCal feed:', icalUrl);
        const response = await fetch(icalUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        });
        if (!response.ok) {
            console.error('Failed to fetch iCal feed:', response.status, response.statusText);
            throw error(response.status, 'Failed to fetch iCal feed');
        }
        const icalData = await response.text();
        console.log('Fetched iCal feed, length:', icalData.length);
        // Parse the iCal data to get event URLs
        let eventUrls = icalData.split('\n')
            .filter(line => line.startsWith('URL:'))
            .map(line => line.replace('URL:', '').trim());
        console.log('Found event URLs:', eventUrls.length);
        eventUrls = eventUrls.slice(0, 30);
        console.log('Filtered event URLs for image scraping:', eventUrls.length, eventUrls);
        const CONCURRENCY = 4;
        const imageUrls = new Map<string, string>();
        let idx = 0;
        const eventProxyBase = import.meta.env.VITE_PROXY_EVENT_URL;
        async function processNext() {
            if (idx >= eventUrls.length) return;
            const url = eventUrls[idx++];
            try {
                let eventResponse: Response;
                if (eventProxyBase) {
                    // Use proxy for event page fetches in production
                    const proxyUrl = `${eventProxyBase}?url=${encodeURIComponent(url)}`;
                    console.log('Fetching event page via proxy:', proxyUrl);
                    eventResponse = await fetchWithTimeout(proxyUrl, {}, 5000) as Response;
                } else {
                    // Fetch directly in local dev
                    console.log('Fetching event page directly:', url);
                    eventResponse = await fetchWithTimeout(url, {}, 5000) as Response;
                }
                if (eventResponse.ok) {
                    const html = await eventResponse.text();
                    const root = parse(html);
                    const figure = root.querySelector('figure.wp-block-post-featured-image');
                    const img = figure?.querySelector('img');
                    const imageUrl = img?.getAttribute('src');
                    if (imageUrl) {
                        imageUrls.set(url, imageUrl);
                        console.log('Found image for event:', url, imageUrl);
                    } else {
                        console.log('No image found for event:', url);
                    }
                } else {
                    console.error('Failed to fetch event page:', url, eventResponse.status, eventResponse.statusText);
                }
            } catch (e) {
                console.error('Error processing event page:', url, e);
            }
            await processNext();
        }
        await Promise.all(Array.from({ length: CONCURRENCY }, processNext));
        let modifiedIcalData = icalData;
        for (const [url, imageUrl] of imageUrls) {
            modifiedIcalData = modifiedIcalData.replace(
                `URL:${url}`,
                `URL:${url}\nIMAGE:${imageUrl}`
            );
        }
        cachedIcalData = modifiedIcalData;
        cacheTimestamp = Date.now();
        console.log('Returning new iCal data, length:', modifiedIcalData.length);

        // Save shows to database (non-blocking)
        syncToDatabase(icalData, imageUrls).catch(e => console.error('Background DB sync failed:', e));

        return new Response(modifiedIcalData, {
            headers: {
                'Content-Type': 'text/calendar',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (e) {
        if (e instanceof Error) {
            console.error('Error fetching iCal feed:', e.message, e.stack);
        } else {
            console.error('Error fetching iCal feed:', e);
        }
        throw error(500, 'Failed to fetch iCal feed');
    }
}; 