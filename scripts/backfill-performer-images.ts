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
const TEAMS_BASE_URL = 'https://www.comedycafeberlin.com/teams';
const PERFORMERS_BASE_URL = 'https://www.comedycafeberlin.com/performer';

async function fetchWithProxy(url: string, timeout = 10000): Promise<Response | null> {
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

// Normalize name for matching (handles accents, punctuation, case)
function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // Remove accents
		.replace(/[^a-z0-9\s]/g, '') // Remove punctuation
		.replace(/\s+/g, ' ')
		.trim();
}

interface PerformerImage {
	name: string;
	normalizedName: string;
	imageUrl: string;
}

async function scrapeTeamPage(url: string): Promise<PerformerImage[]> {
	const response = await fetchWithProxy(url);
	if (!response?.ok) {
		console.log(`  Failed to fetch: ${url}`);
		return [];
	}

	const html = await response.text();
	const root = parse(html);

	const performers: PerformerImage[] = [];
	const cards = root.querySelectorAll('.ccb-performers-card');

	for (const card of cards) {
		const nameEl = card.querySelector('.ccb-performers-card-title a');
		const imgEl = card.querySelector('.ccb-performers-card-image img');

		if (nameEl && imgEl) {
			const name = nameEl.textContent.trim();
			let imageUrl = imgEl.getAttribute('src') || '';

			// Skip placeholder/logo images
			if (imageUrl.includes('CCB-Logos') || imageUrl.includes('placeholder')) {
				continue;
			}

			// Get higher resolution version (remove -150x150 suffix)
			imageUrl = imageUrl.replace(/-\d+x\d+\./, '.');

			performers.push({
				name,
				normalizedName: normalizeName(name),
				imageUrl
			});
		}
	}

	return performers;
}

async function getAllTeamUrls(): Promise<string[]> {
	const teamUrls: string[] = [];

	// Fetch all pages of teams
	for (let page = 1; page <= 5; page++) {
		const url = page === 1 ? TEAMS_BASE_URL : `${TEAMS_BASE_URL}/page/${page}/`;
		console.log(`Fetching teams list page ${page}...`);

		const response = await fetchWithProxy(url);
		if (!response?.ok) break;

		const html = await response.text();
		const root = parse(html);

		// Find team links
		const links = root.querySelectorAll('a[href*="/team/"]');
		for (const link of links) {
			const href = link.getAttribute('href');
			if (href && href.includes('/team/') && !teamUrls.includes(href)) {
				teamUrls.push(href);
			}
		}

		// Check if there's a next page
		const nextPage = root.querySelector('.next.page-numbers');
		if (!nextPage) break;
	}

	return teamUrls;
}

async function scrapePerformersDirectory(): Promise<PerformerImage[]> {
	const performers: PerformerImage[] = [];
	const seenNames = new Set<string>();

	// Fetch all pages of performers directory
	for (let page = 1; page <= 10; page++) {
		const url = page === 1 ? `${PERFORMERS_BASE_URL}/` : `${PERFORMERS_BASE_URL}/page/${page}/`;
		console.log(`Fetching performers directory page ${page}...`);

		const response = await fetchWithProxy(url);
		if (!response?.ok) break;

		const html = await response.text();
		const root = parse(html);

		const cards = root.querySelectorAll('.ccb-performers-card');
		if (cards.length === 0) break;

		for (const card of cards) {
			const nameEl = card.querySelector('.ccb-performers-card-title a');
			const imgEl = card.querySelector('.ccb-performers-card-image img');

			if (nameEl && imgEl) {
				const name = nameEl.textContent.trim();
				let imageUrl = imgEl.getAttribute('src') || '';

				// Skip placeholder/logo images
				if (imageUrl.includes('CCB-Logos') || imageUrl.includes('placeholder')) {
					continue;
				}

				// Get higher resolution version (remove -150x150 suffix)
				imageUrl = imageUrl.replace(/-\d+x\d+\./, '.');

				const normalizedName = normalizeName(name);
				if (!seenNames.has(normalizedName)) {
					seenNames.add(normalizedName);
					performers.push({
						name,
						normalizedName,
						imageUrl
					});
				}
			}
		}

		// Check if there's a next page
		const nextPage = root.querySelector('.next.page-numbers');
		if (!nextPage) break;

		await new Promise((r) => setTimeout(r, 100));
	}

	return performers;
}

// Try to find a match for a scraped performer in the DB
function findMatch(
	scraped: PerformerImage,
	performerMap: Map<string, { id: number; name: string; slug: string; matched?: boolean }>
): { id: number; name: string; slug: string } | null {
	// Exact match first
	const exact = performerMap.get(scraped.normalizedName);
	if (exact && !exact.matched) return exact;

	// Partial match: first name only (for nicknames like "Pip" -> "Pip Roper")
	const scrapedFirst = scraped.normalizedName.split(' ')[0];
	for (const [normalized, performer] of performerMap) {
		if (performer.matched) continue;
		const dbFirst = normalized.split(' ')[0];

		// First name matches and scraped name is just first name
		if (scrapedFirst === dbFirst && scraped.normalizedName === scrapedFirst) {
			return performer;
		}

		// DB name starts with scraped name (e.g., "deschna" matches "deschna afram")
		if (normalized.startsWith(scraped.normalizedName + ' ')) {
			return performer;
		}

		// Scraped name starts with DB name
		if (scraped.normalizedName.startsWith(normalized + ' ')) {
			return performer;
		}
	}

	return null;
}

async function main() {
	const dryRun = process.argv.includes('--dry-run');
	const skipTeams = process.argv.includes('--skip-teams');

	console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
	console.log(`Proxy: ${PROXY_URL || 'none (direct fetch)'}\n`);

	// First, add image_url column if it doesn't exist
	if (!dryRun) {
		try {
			await db.execute('ALTER TABLE performers ADD COLUMN image_url TEXT');
			console.log('Added image_url column to performers table\n');
		} catch (e: any) {
			if (!e.message?.includes('duplicate column')) {
				throw e;
			}
			console.log('image_url column already exists\n');
		}
	}

	// Get all performers from DB
	const dbPerformers = await db.execute('SELECT id, name, slug FROM performers');
	const performerMap = new Map<
		string,
		{ id: number; name: string; slug: string; matched?: boolean }
	>();

	for (const row of dbPerformers.rows) {
		const normalized = normalizeName(row.name as string);
		performerMap.set(normalized, {
			id: row.id as number,
			name: row.name as string,
			slug: row.slug as string,
			matched: false
		});
	}

	console.log(`Found ${performerMap.size} performers in database\n`);

	// First, scrape performers directory (best source)
	console.log('--- Scraping Performers Directory ---\n');
	const directoryPerformers = await scrapePerformersDirectory();
	console.log(`\nFound ${directoryPerformers.length} performers in directory\n`);

	// Then scrape team pages for additional images
	const allPerformerImages: PerformerImage[] = [...directoryPerformers];
	const seenNames = new Set<string>(directoryPerformers.map((p) => p.normalizedName));

	if (!skipTeams) {
		console.log('--- Scraping Team Pages ---\n');
		const teamUrls = await getAllTeamUrls();
		console.log(`\nFound ${teamUrls.length} team pages to scrape\n`);

		for (const teamUrl of teamUrls) {
			console.log(`Scraping: ${teamUrl}`);
			const performers = await scrapeTeamPage(teamUrl);

			for (const p of performers) {
				if (!seenNames.has(p.normalizedName)) {
					seenNames.add(p.normalizedName);
					allPerformerImages.push(p);
				}
			}

			await new Promise((r) => setTimeout(r, 100));
		}
	}

	console.log(`\nTotal unique performers with images: ${allPerformerImages.length}\n`);

	// Match and update
	let matched = 0;
	let notFound = 0;
	const unmatched: string[] = [];
	const ambiguous: string[] = [];

	for (const scraped of allPerformerImages) {
		const dbPerformer = findMatch(scraped, performerMap);

		if (dbPerformer) {
			// Check for ambiguous matches (e.g., "Harry" could match multiple)
			const scrapedFirst = scraped.normalizedName.split(' ')[0];
			const isPartialMatch =
				scraped.normalizedName === scrapedFirst &&
				normalizeName(dbPerformer.name) !== scraped.normalizedName;

			if (isPartialMatch) {
				// Count how many DB performers have this first name
				let matchCount = 0;
				for (const [norm, p] of performerMap) {
					if (norm.split(' ')[0] === scrapedFirst && !p.matched) matchCount++;
				}
				if (matchCount > 1) {
					ambiguous.push(`${scraped.name} -> ${dbPerformer.name} (${matchCount} possible matches)`);
					notFound++;
					continue;
				}
			}

			console.log(`✓ ${scraped.name} -> ${dbPerformer.name}${isPartialMatch ? ' (partial)' : ''}`);
			dbPerformer.matched = true;
			matched++;

			if (!dryRun) {
				await db.execute({
					sql: 'UPDATE performers SET image_url = ? WHERE id = ?',
					args: [scraped.imageUrl, dbPerformer.id]
				});
			}
		} else {
			unmatched.push(scraped.name);
			notFound++;
		}
	}

	// Check for DB performers without images
	const dbWithoutImages: string[] = [];
	for (const [normalized, performer] of performerMap) {
		if (!performer.matched) {
			dbWithoutImages.push(performer.name);
		}
	}

	console.log(`\n--- Summary ---`);
	console.log(`Matched: ${matched}`);
	console.log(`Scraped but not in DB: ${notFound}`);
	console.log(`DB performers without images: ${dbWithoutImages.length}`);

	if (ambiguous.length > 0) {
		console.log(`\nAmbiguous matches (skipped):`);
		for (const a of ambiguous) {
			console.log(`  ? ${a}`);
		}
	}

	if (unmatched.length > 0 && unmatched.length <= 30) {
		console.log(`\nScraped performers not in DB:`);
		for (const name of unmatched) {
			console.log(`  - ${name}`);
		}
	}

	if (dbWithoutImages.length > 0 && dbWithoutImages.length <= 30) {
		console.log(`\nDB performers without images found:`);
		for (const name of dbWithoutImages) {
			console.log(`  - ${name}`);
		}
	}

	if (dryRun) {
		console.log(`\nThis was a dry run. Run without --dry-run to apply changes.`);
	}
}

main().catch(console.error);
