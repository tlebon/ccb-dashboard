/**
 * Crawl CCB event pages to extract show lineups
 */

import { parse } from 'node-html-parser';
import { extractNameStrings } from './parsePerformers';

export interface LineupData {
	performers: string[];
	hosts: string[];
	rawContent: string;
	fullDescription?: string; // Full description text from event page
}

/**
 * Parse lineup from event page HTML
 * Looks for performer cards (images with names), then falls back to text parsing
 */
export function parseLineupFromHTML(html: string, debug = false): LineupData {
	const root = parse(html);
	const performers: string[] = [];
	const hosts: string[] = [];
	let rawContent = '';

	// 1. PRIMARY METHOD: Look for .ccb-performers-card divs (most reliable)
	const performerCards = root.querySelectorAll('.ccb-performers-card');
	if (performerCards.length > 0) {
		if (debug) {
			console.log(`  ✨ Found ${performerCards.length} performer cards`);
		}

		for (const card of performerCards) {
			// Each card has a figure and a div sibling with the name
			const nameDiv = card.querySelector('div:not(.ccb-performers-card-image)');
			if (nameDiv) {
				const name = nameDiv.text.trim();
				if (name && name.length > 0 && name.length < 50) {
					performers.push(name);
					if (debug) {
						console.log(`    - ${name}`);
					}
				}
			}
		}

		// Get raw content for host detection and full description
		const contentDiv = root.querySelector('.tribe-events-single-event-description');
		if (contentDiv) {
			rawContent = contentDiv.text;
		}

		// Check if description mentions hosts
		const hostNames = extractNameStrings(rawContent);
		for (const name of hostNames) {
			if (rawContent.toLowerCase().includes('host') && performers.includes(name)) {
				hosts.push(name);
			}
		}

		// Extract full description (cleaned up, trimmed, no extra whitespace)
		const fullDescription = rawContent
			.trim()
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.join('\n');

		// Return early - we found structured data!
		return {
			performers: [...new Set(performers)].filter((n) => n.length > 0),
			hosts: [...new Set(hosts)].filter((n) => n.length > 0),
			rawContent,
			fullDescription: fullDescription.length > 0 ? fullDescription : undefined
		};
	}

	// 2. FALLBACK: Text-based parsing (old method)
	if (debug) {
		console.log('  📝 No performer cards found, falling back to text parsing');
	}

	const contentDiv = root.querySelector('.tribe-events-single-event-description');
	if (debug && !contentDiv) {
		console.log('  🔍 No .tribe-events-single-event-description found');
	}
	if (contentDiv) {
		rawContent = contentDiv.text;
		if (debug) {
			console.log(`  🔍 Raw content (first 300 chars): ${rawContent.substring(0, 300)}`);
		}

		// Extract performers using text parsing
		const extractedNames = extractNameStrings(rawContent);
		performers.push(...extractedNames);

		// Look for structured lists
		const lists = contentDiv.querySelectorAll('ul li, ol li');
		for (const li of lists) {
			const text = li.text.trim();
			if (text.length > 0 && text.length < 50 && !text.includes('http')) {
				if (text.toLowerCase().includes('host')) {
					const names = extractNameStrings(text);
					hosts.push(...names);
				} else {
					const cleaned = text
						.replace(/^[-•*]\s*/, '')
						.replace(/\(.*?\)/g, '')
						.trim();

					if (cleaned.length > 0 && cleaned.length < 50) {
						performers.push(cleaned);
					}
				}
			}
		}
	}

	// Extract full description (cleaned up, trimmed, no extra whitespace)
	const fullDescription = rawContent
		.trim()
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.join('\n');

	// Deduplicate
	return {
		performers: [...new Set(performers)].filter((n) => n.length > 0),
		hosts: [...new Set(hosts)].filter((n) => n.length > 0),
		rawContent,
		fullDescription: fullDescription.length > 0 ? fullDescription : undefined
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
