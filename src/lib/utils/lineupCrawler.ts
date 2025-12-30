/**
 * Crawl CCB event pages to extract show lineups
 */

import { parse } from 'node-html-parser';
import { extractNameStrings } from './parsePerformers';

export interface LineupData {
	performers: string[];
	hosts: string[];
	rawContent: string;
}

/**
 * Parse lineup from event page HTML
 * Looks for lists, sections with "lineup"/"cast" headings, etc.
 */
export function parseLineupFromHTML(html: string, debug = false): LineupData {
	const root = parse(html);
	const performers: string[] = [];
	const hosts: string[] = [];
	let rawContent = '';

	// 1. Look for event description/content section
	const contentDiv = root.querySelector('.tribe-events-single-event-description');
	if (debug && !contentDiv) {
		console.log('  🔍 No .tribe-events-single-event-description found');
	}
	if (contentDiv) {
		rawContent = contentDiv.text;
		if (debug) {
			console.log(`  🔍 Raw content (first 300 chars): ${rawContent.substring(0, 300)}`);
		}

		// Extract performers using existing logic
		const extractedNames = extractNameStrings(rawContent);
		performers.push(...extractedNames);

		// 2. Also look for structured lists
		const lists = contentDiv.querySelectorAll('ul li, ol li');
		for (const li of lists) {
			const text = li.text.trim();
			// Skip if it looks like it's not a name (too long, contains URLs, etc.)
			if (text.length > 0 && text.length < 50 && !text.includes('http')) {
				// Check for role indicators
				if (text.toLowerCase().includes('host')) {
					const names = extractNameStrings(text);
					hosts.push(...names);
				} else {
					// Treat list items as potential performer names
					// Clean up common prefixes/suffixes
					const cleaned = text
						.replace(/^[-•*]\s*/, '') // Remove list markers
						.replace(/\(.*?\)/g, '') // Remove parenthetical notes
						.trim();

					if (cleaned.length > 0 && cleaned.length < 50) {
						performers.push(cleaned);
					}
				}
			}
		}

		// 3. Look for headings that indicate lineup sections
		const allElements = contentDiv.querySelectorAll('*');
		for (let i = 0; i < allElements.length; i++) {
			const el = allElements[i];
			const text = el.text.toLowerCase();

			// Check if this is a "lineup" or "cast" heading
			if (
				(el.tagName === 'H2' ||
					el.tagName === 'H3' ||
					el.tagName === 'H4' ||
					el.tagName === 'STRONG' ||
					el.tagName === 'B') &&
				(text.includes('lineup') || text.includes('cast') || text.includes('performers'))
			) {
				// Get next few sibling elements
				for (let j = i + 1; j < Math.min(i + 10, allElements.length); j++) {
					const next = allElements[j];
					// Stop if we hit another heading
					if (
						next.tagName === 'H2' ||
						next.tagName === 'H3' ||
						next.tagName === 'H4' ||
						next.tagName === 'STRONG'
					) {
						break;
					}

					const nextText = next.text.trim();
					if (nextText.length > 0 && nextText.length < 100) {
						const names = extractNameStrings(nextText);
						performers.push(...names);
					}
				}
				break; // Found lineup section, stop looking
			}
		}
	}

	// Deduplicate
	return {
		performers: [...new Set(performers)].filter((n) => n.length > 0),
		hosts: [...new Set(hosts)].filter((n) => n.length > 0),
		rawContent
	};
}

/**
 * Fetch and parse lineup from a show URL
 */
export async function fetchLineupFromURL(
	url: string,
	proxyBaseUrl?: string,
	debug = false
): Promise<LineupData | null> {
	try {
		const fetchUrl = proxyBaseUrl ? `${proxyBaseUrl}?url=${encodeURIComponent(url)}` : url;

		if (debug) {
			console.log(`  🌐 Fetching: ${fetchUrl}`);
		}

		const response = await fetch(fetchUrl, {
			signal: AbortSignal.timeout(10000) // 10s timeout
		});

		if (!response.ok) {
			console.warn(`Failed to fetch ${url}: ${response.status}`);
			return null;
		}

		const html = await response.text();
		if (debug) {
			console.log(`  📄 Received ${html.length} bytes of HTML`);
		}
		return parseLineupFromHTML(html, debug);
	} catch (error) {
		console.warn(`Error fetching lineup from ${url}:`, error);
		return null;
	}
}
