import { createClient } from '@libsql/client';
import { parse } from 'node-html-parser';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file manually
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
	authToken: process.env.TURSO_AUTH_TOKEN!
});

const PROXY_URL = process.env.VITE_PROXY_EVENT_URL;
const BASE_URL = 'https://www.comedycafeberlin.com/event/';

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/['']/g, '')
		.replace(/:/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.replace(/-+/g, '-');
}

// Normalize title for grouping (remove parenthetical hosts, etc.)
function normalizeTitle(title: string): string {
	return title
		.replace(/\s*\([^)]*\)\s*/g, ' ')  // Remove (hosted by X)
		.replace(/\s*@\s*[^@]+$/i, '')      // Remove @ Location
		.replace(/:+\s*$/, '')              // Remove trailing colons
		.replace(/!+/g, '')                 // Remove exclamation marks
		.trim();
}

async function fetchWithProxy(url: string, timeout = 5000): Promise<Response | null> {
	try {
		let fetchUrl = url;
		if (PROXY_URL) {
			fetchUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
		}
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);
		const response = await fetch(fetchUrl, { signal: controller.signal });
		clearTimeout(timeoutId);
		return response;
	} catch {
		return null;
	}
}

async function isValidUrl(url: string): Promise<boolean> {
	const response = await fetchWithProxy(url);
	return response?.ok ?? false;
}

async function fetchImageFromUrl(url: string): Promise<string | null> {
	const response = await fetchWithProxy(url);
	if (!response?.ok) return null;
	try {
		const html = await response.text();
		const root = parse(html);
		const figure = root.querySelector('figure.wp-block-post-featured-image');
		const img = figure?.querySelector('img');
		return img?.getAttribute('src') || null;
	} catch {
		return null;
	}
}

async function main() {
	const dryRun = process.argv.includes('--dry-run');
	const withImages = process.argv.includes('--with-images');
	const limit = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0') || Infinity;

	console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
	console.log(`Fetch images: ${withImages}`);
	console.log(`Limit: ${limit === Infinity ? 'none' : limit}`);
	console.log(`Proxy: ${PROXY_URL || 'none (direct fetch)'}\n`);

	// Get all shows, grouped by normalized title
	const allShows = await db.execute(`
		SELECT id, title, date, url, image_url
		FROM shows
		ORDER BY date DESC
	`);

	// Group shows by normalized title
	const showGroups = new Map<string, Array<{
		id: number;
		title: string;
		date: string;
		url: string | null;
		image_url: string | null;
	}>>();

	for (const row of allShows.rows) {
		const normalizedTitle = normalizeTitle(row.title as string);
		if (!showGroups.has(normalizedTitle)) {
			showGroups.set(normalizedTitle, []);
		}
		showGroups.get(normalizedTitle)!.push({
			id: row.id as number,
			title: row.title as string,
			date: row.date as string,
			url: row.url as string | null,
			image_url: row.image_url as string | null
		});
	}

	console.log(`Found ${showGroups.size} unique show types\n`);

	let updated = 0;
	let failed = 0;
	let skipped = 0;
	let processed = 0;

	for (const [normalizedTitle, shows] of showGroups) {
		if (processed >= limit) break;

		// Sort by date descending (newest first)
		shows.sort((a, b) => b.date.localeCompare(a.date));

		// Find shows with URLs to establish the pattern
		const showsWithUrls = shows.filter(s => s.url);
		const showsWithoutUrls = shows.filter(s => !s.url);

		if (showsWithoutUrls.length === 0) {
			continue; // All shows have URLs
		}

		// Extract base slug and numbers from existing URLs
		let baseSlug: string | null = null;
		const knownNumbers: number[] = [];

		for (const show of showsWithUrls) {
			const match = show.url!.match(/\/event\/(.+?)(?:-(\d+))?\/?$/);
			if (match) {
				const slug = match[1].replace(/-\d+$/, '');
				const num = match[2] ? parseInt(match[2]) : null;

				if (!baseSlug) baseSlug = slug;
				if (num) knownNumbers.push(num);
			}
		}

		// If no existing URLs, generate slug from title
		if (!baseSlug) {
			baseSlug = slugify(normalizedTitle);
		}

		console.log(`\n[${normalizedTitle}] - ${shows.length} total, ${showsWithoutUrls.length} missing URLs`);
		console.log(`  Base slug: ${baseSlug}`);
		if (knownNumbers.length > 0) {
			console.log(`  Known numbers: ${knownNumbers.sort((a,b) => a-b).join(', ')}`);
		}

		// Strategy:
		// 1. If we have known numbers, try incrementing/decrementing from them
		// 2. If no known numbers, try the slug without number, then with numbers 1-50

		// Sort shows without URLs by date descending (newest first)
		// This way we start from known numbers and work backwards
		showsWithoutUrls.sort((a, b) => b.date.localeCompare(a.date));

		for (const show of showsWithoutUrls) {
			if (processed >= limit) break;
			processed++;

			console.log(`  [${processed}] ${show.date}: ${show.title}`);

			const urlsToTry: string[] = [];

			if (knownNumbers.length > 0) {
				// We have known numbers - just try the next one down from minimum
				const minNum = Math.min(...knownNumbers);

				// Try decrementing from min (most likely for older shows)
				for (let i = minNum - 1; i >= 1; i--) {
					urlsToTry.push(`${BASE_URL}${baseSlug}-${i}/`);
				}
				// Also try incrementing from max (for future shows)
				const maxNum = Math.max(...knownNumbers);
				for (let i = maxNum + 1; i <= maxNum + 50; i++) {
					urlsToTry.push(`${BASE_URL}${baseSlug}-${i}/`);
				}
			} else {
				// No known numbers - try simple slug first, then numbered
				urlsToTry.push(`${BASE_URL}${baseSlug}/`);
				for (let i = 1; i <= 100; i++) {
					urlsToTry.push(`${BASE_URL}${baseSlug}-${i}/`);
				}
			}

			// Remove any URLs we already know about
			const existingUrls = new Set(showsWithUrls.map(s => s.url));
			const uniqueUrls = urlsToTry.filter(u => !existingUrls.has(u));

			let foundUrl: string | null = null;
			let foundImage: string | null = null;

			for (const url of uniqueUrls) {
				if (withImages) {
					const image = await fetchImageFromUrl(url);
					if (image) {
						foundUrl = url;
						foundImage = image;
						break;
					}
				} else {
					if (await isValidUrl(url)) {
						foundUrl = url;
						break;
					}
				}
			}

			if (foundUrl) {
				console.log(`    ✓ ${foundUrl}`);
				if (foundImage) {
					console.log(`    ✓ Image found`);
				}

				if (!dryRun) {
					if (withImages && foundImage) {
						await db.execute({
							sql: 'UPDATE shows SET url = ?, image_url = ? WHERE id = ?',
							args: [foundUrl, foundImage, show.id]
						});
					} else {
						await db.execute({
							sql: 'UPDATE shows SET url = ? WHERE id = ?',
							args: [foundUrl, show.id]
						});
					}
				}

				// Update our knowledge for next iterations
				const match = foundUrl.match(/-(\d+)\/?$/);
				if (match) {
					knownNumbers.push(parseInt(match[1]));
				}
				showsWithUrls.push({ ...show, url: foundUrl, image_url: foundImage });

				updated++;
			} else {
				console.log(`    ✗ Not found (tried ${uniqueUrls.length} URLs)`);
				failed++;
			}

			// Small delay
			await new Promise(r => setTimeout(r, 50));
		}
	}

	console.log(`\n--- Summary ---`);
	console.log(`Processed: ${processed}`);
	console.log(`Updated: ${updated}`);
	console.log(`Failed: ${failed}`);

	if (dryRun) {
		console.log(`\nThis was a dry run. Run without --dry-run to apply changes.`);
	}
}

main().catch(console.error);
