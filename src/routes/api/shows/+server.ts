import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parse } from 'node-html-parser';

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

export const GET: RequestHandler = async () => {
    try {
        // Check cache
        const now = Date.now();
        if (cachedIcalData && cacheTimestamp && now - cacheTimestamp < CACHE_DURATION_MS) {
            return new Response(cachedIcalData, {
                headers: {
                    'Content-Type': 'text/calendar',
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        }
        // Convert webcal:// to https://
        const icalUrl = 'https://www.comedycafeberlin.com/?post_type=tribe_events&ical=1&eventDisplay=list';
        
        const response = await fetch(icalUrl);
        if (!response.ok) {
            throw error(response.status, 'Failed to fetch iCal feed');
        }
        
        const icalData = await response.text();
        
        // Parse the iCal data to get event URLs
        let eventUrls = icalData.split('\n')
            .filter(line => line.startsWith('URL:'))
            .map(line => line.replace('URL:', '').trim());

        // Limit to first 30 events for speed/testing
        eventUrls = eventUrls.slice(0, 30);

        // Concurrency limit
        const CONCURRENCY = 4;
        const imageUrls = new Map<string, string>();
        let idx = 0;
        async function processNext() {
            if (idx >= eventUrls.length) return;
            const url = eventUrls[idx++];
            try {
                const eventResponse = await fetchWithTimeout(url, {}, 5000) as Response;
                if (eventResponse.ok) {
                    const html = await eventResponse.text();
                    const root = parse(html);
                    const figure = root.querySelector('figure.wp-block-post-featured-image');
                    const img = figure?.querySelector('img');
                    const imageUrl = img?.getAttribute('src');
                    // console.log('Event URL:', url);
                    // console.log('Figure found:', !!figure);
                    // console.log('Img found:', !!img);
                    // console.log('Image src:', imageUrl);
                    if (imageUrl) {
                        imageUrls.set(url, imageUrl);
                    }
                }
            } catch (e) {
                console.error('Error processing event page:', url, e);
            }
            await processNext();
        }
        // Start CONCURRENCY number of parallel fetches
        await Promise.all(Array.from({ length: CONCURRENCY }, processNext));

        // Add image URLs to the iCal data
        let modifiedIcalData = icalData;
        for (const [url, imageUrl] of imageUrls) {
            modifiedIcalData = modifiedIcalData.replace(
                `URL:${url}`,
                `URL:${url}\nIMAGE:${imageUrl}`
            );
        }
        // Update cache
        cachedIcalData = modifiedIcalData;
        cacheTimestamp = Date.now();
        return new Response(modifiedIcalData, {
            headers: {
                'Content-Type': 'text/calendar',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (e) {
        console.error('Error fetching iCal feed:', e);
        throw error(500, 'Failed to fetch iCal feed');
    }
}; 