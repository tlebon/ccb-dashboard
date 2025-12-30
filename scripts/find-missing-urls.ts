/**
 * Find URLs for shows without URLs by using the iterator pattern
 * from shows with the same title
 *
 * Example: If "House Show" has URL "house-show-189/", try "house-show-188/", etc.
 * for earlier editions without URLs
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars
function loadEnv() {
	const envPath = path.join(process.cwd(), '.env');
	if (fs.existsSync(envPath)) {
		const content = fs.readFileSync(envPath, 'utf-8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) {
				const [key, ...valueParts] = trimmed.split('=');
				const value = valueParts.join('=').replace(/^["']|["']$/g, '');
				if (key && !process.env[key]) {
					process.env[key] = value;
				}
			}
		}
	}
}

loadEnv();

const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN
});

/**
 * Normalize a show title for matching
 */
function normalizeTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^\w\s-]/g, '') // Remove special chars
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Extract slug and number from a CCB event URL
 * Example: "https://www.comedycafeberlin.com/event/house-show-189/" -> { slug: "house-show", num: 189 }
 */
function parseEventUrl(url: string): { slug: string; num: number } | null {
	const match = url.match(/\/event\/(.+)-(\d+)\/?$/);
	if (!match) return null;
	return {
		slug: match[1],
		num: parseInt(match[2])
	};
}

/**
 * Check if a URL exists (returns 200)
 */
async function urlExists(url: string, proxyUrl?: string): Promise<boolean> {
	try {
		const fetchUrl = proxyUrl ? `${proxyUrl}?url=${encodeURIComponent(url)}` : url;
		const response = await fetch(fetchUrl, {
			method: 'HEAD',
			signal: AbortSignal.timeout(5000)
		});
		return response.ok;
	} catch {
		return false;
	}
}

async function main() {
	const proxyUrl = process.env.VITE_PROXY_EVENT_URL;
	const dryRun = process.argv.includes('--dry-run');

	console.log('Finding missing URLs...\n');
	if (dryRun) {
		console.log('🔍 DRY RUN MODE - No database updates will be made\n');
	}

	// Get all shows grouped by normalized title
	const allShows = await db.execute(`
		SELECT id, title, date, url, source
		FROM shows
		ORDER BY title, date DESC
	`);

	// Group by normalized title
	const showsByTitle = new Map<
		string,
		Array<{
			id: number;
			title: string;
			date: string;
			url: string | null;
			source: string;
		}>
	>();

	for (const row of allShows.rows) {
		const normalized = normalizeTitle(row.title as string);
		if (!showsByTitle.has(normalized)) {
			showsByTitle.set(normalized, []);
		}
		showsByTitle.get(normalized)!.push({
			id: Number(row.id),
			title: row.title as string,
			date: row.date as string,
			url: row.url as string | null,
			source: row.source as string
		});
	}

	let foundCount = 0;
	let checkedCount = 0;

	// Process each title group
	for (const [normalizedTitle, shows] of showsByTitle) {
		// Find shows with and without URLs
		const withUrls = shows.filter((s) => s.url);
		const withoutUrls = shows.filter((s) => !s.url);

		if (withUrls.length === 0 || withoutUrls.length === 0) {
			continue; // Skip if no reference URLs or no missing URLs
		}

		// Extract URL patterns from shows with URLs
		const urlPatterns: Array<{ slug: string; num: number; date: string }> = [];
		for (const show of withUrls) {
			const parsed = parseEventUrl(show.url!);
			if (parsed) {
				urlPatterns.push({ ...parsed, date: show.date });
			}
		}

		if (urlPatterns.length === 0) continue;

		// Sort patterns by number descending
		urlPatterns.sort((a, b) => b.num - a.num);
		const highestNum = urlPatterns[0].num;
		const slug = urlPatterns[0].slug;

		console.log(`\n📋 ${shows[0].title}`);
		console.log(`   Found ${withUrls.length} with URLs, ${withoutUrls.length} without URLs`);
		console.log(`   URL pattern: ${slug}-{N} (highest: ${highestNum})`);

		// Build a set of already-used URLs
		const usedUrls = new Set(withUrls.map((s) => s.url));
		const assignedUrls = new Map<number, string>(); // showId -> url for this batch

		// Try to find URLs for shows without URLs, sorted by date
		const sortedMissing = [...withoutUrls].sort((a, b) => a.date.localeCompare(b.date));

		for (const show of sortedMissing) {
			// Estimate the iterator number based on date
			// Find the closest show with a URL before this date
			const earlier = withUrls
				.filter((s) => s.date < show.date)
				.sort((a, b) => b.date.localeCompare(a.date)); // Most recent first

			const later = withUrls
				.filter((s) => s.date > show.date)
				.sort((a, b) => a.date.localeCompare(b.date)); // Earliest first

			let searchRange: number[] = [];

			if (earlier.length > 0 && later.length > 0) {
				// Between two known shows - search in between
				const earlierUrl = parseEventUrl(earlier[0].url!);
				const laterUrl = parseEventUrl(later[0].url!);
				if (earlierUrl && laterUrl) {
					const start = earlierUrl.num + 1;
					const end = laterUrl.num - 1;
					searchRange = Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
				}
			} else if (earlier.length > 0) {
				// After all known shows - try higher numbers
				const earlierUrl = parseEventUrl(earlier[0].url!);
				if (earlierUrl) {
					searchRange = Array.from({ length: 20 }, (_, i) => earlierUrl.num + 1 + i);
				}
			} else if (later.length > 0) {
				// Before all known shows - try lower numbers
				const laterUrl = parseEventUrl(later[0].url!);
				if (laterUrl) {
					searchRange = Array.from(
						{ length: laterUrl.num - 1 },
						(_, i) => laterUrl.num - 1 - i
					).filter((n) => n >= 1);
				}
			}

			let found = false;

			for (const num of searchRange) {
				const testUrl = `https://www.comedycafeberlin.com/event/${slug}-${num}/`;

				// Skip if already used
				if (usedUrls.has(testUrl) || Array.from(assignedUrls.values()).includes(testUrl)) {
					continue;
				}

				checkedCount++;
				const exists = await urlExists(testUrl, proxyUrl);

				if (exists) {
					console.log(`   ✅ Found: ${show.date} -> ${testUrl}`);
					assignedUrls.set(show.id, testUrl);
					usedUrls.add(testUrl);

					if (!dryRun) {
						await db.execute({
							sql: 'UPDATE shows SET url = ? WHERE id = ?',
							args: [testUrl, show.id]
						});
					}

					foundCount++;
					found = true;
					break;
				}

				// Small delay to avoid hammering the server
				await new Promise((resolve) => setTimeout(resolve, 100));
			}

			if (!found && checkedCount % 10 === 0) {
				console.log(`   ⏳ Checked ${checkedCount} URLs so far...`);
			}
		}
	}

	console.log(`\n\n=== Summary ===`);
	console.log(`URLs checked: ${checkedCount}`);
	console.log(`URLs found: ${foundCount}`);
	if (dryRun) {
		console.log(`\nRun without --dry-run to update the database`);
	} else {
		console.log(`\nDatabase updated with ${foundCount} new URLs`);
	}
}

main().catch(console.error);
