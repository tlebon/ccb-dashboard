/**
 * Unified CCB sync script
 *
 * Usage:
 *   npx tsx scripts/sync-ccb.ts --all              # Sync everything
 *   npx tsx scripts/sync-ccb.ts --performers       # Sync new performers + update data
 *   npx tsx scripts/sync-ccb.ts --shows            # Sync show URLs + images
 *   npx tsx scripts/sync-ccb.ts --lineups          # Sync lineups from show pages
 *   npx tsx scripts/sync-ccb.ts --dry-run          # Preview without making changes
 *   npx tsx scripts/sync-ccb.ts --limit=10         # Process only 10 items
 */

import { createClient } from '@libsql/client';
import { parse } from 'node-html-parser';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
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
const CCB_BASE = 'https://www.comedycafeberlin.com';

// ============ Utilities ============

async function fetchWithProxy(url: string, timeout = 15000): Promise<Response | null> {
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

function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function slugify(title: string): string {
	return title
		.toLowerCase()
		.replace(/['']/g, '')
		.replace(/:/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.replace(/-+/g, '-');
}

// ============ Performer Sync ============

interface PerformerInfo {
	name: string;
	slug: string;
	imageUrl: string | null;
	bio: string | null;
	instagram: string | null;
}

async function scrapePerformersDirectory(): Promise<PerformerInfo[]> {
	const performers: PerformerInfo[] = [];
	const seenSlugs = new Set<string>();

	for (let page = 1; page <= 15; page++) {
		const url = page === 1 ? `${CCB_BASE}/performers/` : `${CCB_BASE}/performers/page/${page}/`;
		console.log(`  Fetching performers page ${page}...`);

		const response = await fetchWithProxy(url);
		if (!response?.ok) break;

		const html = await response.text();
		const root = parse(html);

		const cards = root.querySelectorAll('.ccb-performers-card');
		if (cards.length === 0) {
			const links = root.querySelectorAll('a[href*="/performer/"]');
			if (links.length === 0) break;

			for (const link of links) {
				const href = link.getAttribute('href') || '';
				const match = href.match(/\/performer\/([^\/]+)\/?$/);
				if (match && !seenSlugs.has(match[1])) {
					seenSlugs.add(match[1]);
					performers.push({
						name: link.textContent?.trim() || match[1],
						slug: match[1],
						imageUrl: null,
						bio: null,
						instagram: null
					});
				}
			}
		} else {
			for (const card of cards) {
				const nameEl = card.querySelector('.ccb-performers-card-title a');
				const imgEl = card.querySelector('.ccb-performers-card-image img');
				const linkEl = card.querySelector('a[href*="/performer/"]');

				const href = (linkEl || nameEl)?.getAttribute('href') || '';
				const match = href.match(/\/performer\/([^\/]+)\/?$/);
				if (match && !seenSlugs.has(match[1])) {
					seenSlugs.add(match[1]);
					let imageUrl = imgEl?.getAttribute('src') || null;
					if (imageUrl?.includes('CCB-Logos') || imageUrl?.includes('placeholder')) {
						imageUrl = null;
					} else if (imageUrl) {
						imageUrl = imageUrl.replace(/-\d+x\d+\./, '.');
					}

					performers.push({
						name: nameEl?.textContent?.trim() || match[1],
						slug: match[1],
						imageUrl,
						bio: null,
						instagram: null
					});
				}
			}
		}

		const nextPage = root.querySelector('.next.page-numbers');
		if (!nextPage) break;

		await new Promise((r) => setTimeout(r, 300));
	}

	return performers;
}

async function fetchPerformerDetails(slug: string): Promise<Partial<PerformerInfo> | null> {
	const url = `${CCB_BASE}/performer/${slug}/`;
	const response = await fetchWithProxy(url);

	if (!response?.ok) return null;

	const html = await response.text();
	if (html.includes('Page not found') || html.includes('404')) return null;

	const root = parse(html);

	// Name
	const titleEl = root.querySelector('h1.entry-title, h1.performer-name, .post-title h1, h1');
	let name = titleEl?.textContent?.trim() || null;
	if (name === slug || name?.includes('-')) {
		name = slug
			.split('-')
			.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' ');
	}

	// Image
	let imageUrl: string | null = null;
	const featuredImg = root.querySelector('img.post-top-featured');
	if (featuredImg) {
		imageUrl = featuredImg.getAttribute('src') || null;
		if (imageUrl?.includes('CCB-Logos') || imageUrl?.includes('CCB-facebook')) {
			imageUrl = null;
		}
	}

	// Bio
	let bio: string | null = null;
	const paragraphs = root.querySelectorAll('article p, .entry-content p');
	const bioTexts: string[] = [];
	for (const p of paragraphs) {
		const text = p.textContent.trim();
		if (text.length > 20) bioTexts.push(text);
	}
	if (bioTexts.length > 0) bio = bioTexts.join('\n\n');

	// Instagram
	let instagram: string | null = null;
	const instagramLink = root.querySelector('.wp-social-link-instagram a');
	if (instagramLink) {
		const href = instagramLink.getAttribute('href');
		const match = href?.match(/instagram\.com\/([^\/\?]+)/);
		if (match) instagram = match[1];
	}

	return { name, imageUrl, bio, instagram };
}

async function syncPerformers(dryRun: boolean, limit: number) {
	console.log('\n=== Syncing Performers ===\n');

	// Ensure columns exist
	if (!dryRun) {
		for (const col of ['image_url', 'bio', 'instagram']) {
			try {
				await db.execute(`ALTER TABLE performers ADD COLUMN ${col} TEXT`);
				console.log(`Added ${col} column`);
			} catch (e: any) {
				if (!e.message?.includes('duplicate column')) throw e;
			}
		}
	}

	// Get existing performers
	const dbResult = await db.execute(
		'SELECT id, name, slug, image_url, bio, instagram FROM performers'
	);
	const dbBySlug = new Map<string, any>();
	const dbByNormalized = new Map<string, any>();

	for (const row of dbResult.rows) {
		dbBySlug.set(row.slug as string, row);
		dbByNormalized.set(normalizeName(row.name as string), row);
	}

	console.log(`Found ${dbBySlug.size} performers in database`);

	// Scrape CCB
	console.log('\nScraping CCB website...');
	const ccbPerformers = await scrapePerformersDirectory();
	console.log(`Found ${ccbPerformers.length} performers on CCB\n`);

	let added = 0;
	let updated = 0;
	let processed = 0;

	for (const ccb of ccbPerformers) {
		if (processed >= limit) break;

		// Check if exists
		const normalized = normalizeName(ccb.name);
		const existing = dbBySlug.get(ccb.slug) || dbByNormalized.get(normalized);

		if (existing) {
			// Update if missing data
			const needsImage = !existing.image_url;
			const needsBio = !existing.bio;
			const needsInstagram = !existing.instagram;

			if (needsImage || needsBio || needsInstagram) {
				processed++;
				console.log(`[${processed}] Updating ${existing.name}...`);

				const details = await fetchPerformerDetails(ccb.slug);
				if (details) {
					const updates: string[] = [];
					const args: any[] = [];

					if (needsImage && details.imageUrl) {
						updates.push('image_url = ?');
						args.push(details.imageUrl);
					}
					if (needsBio && details.bio) {
						updates.push('bio = ?');
						args.push(details.bio);
					}
					if (needsInstagram && details.instagram) {
						updates.push('instagram = ?');
						args.push(details.instagram);
					}

					if (updates.length > 0 && !dryRun) {
						args.push(existing.id);
						await db.execute({
							sql: `UPDATE performers SET ${updates.join(', ')} WHERE id = ?`,
							args
						});
					}

					if (updates.length > 0) {
						console.log(`  ✓ Updated: ${updates.map((u) => u.split(' ')[0]).join(', ')}`);
						updated++;
					}
				}

				await new Promise((r) => setTimeout(r, 300));
			}
		} else {
			// New performer
			processed++;
			console.log(`[${processed}] Adding new: ${ccb.name}...`);

			const details = await fetchPerformerDetails(ccb.slug);
			const finalName = details?.name || ccb.name;
			const finalImage = details?.imageUrl || ccb.imageUrl;
			const finalBio = details?.bio;
			const finalInstagram = details?.instagram;

			if (!dryRun) {
				await db.execute({
					sql: 'INSERT INTO performers (name, slug, image_url, bio, instagram) VALUES (?, ?, ?, ?, ?)',
					args: [finalName, ccb.slug, finalImage, finalBio, finalInstagram]
				});
			}

			console.log(`  ✓ Added: ${finalName}`);
			added++;

			await new Promise((r) => setTimeout(r, 300));
		}
	}

	console.log(`\nPerformers: ${added} added, ${updated} updated`);
}

// ============ Show Sync ============

async function fetchShowPage(url: string): Promise<{ valid: boolean; imageUrl: string | null }> {
	const response = await fetchWithProxy(url, 5000);
	if (!response?.ok) return { valid: false, imageUrl: null };

	try {
		const html = await response.text();
		const root = parse(html);
		const figure = root.querySelector('figure.wp-block-post-featured-image');
		const img = figure?.querySelector('img');
		const imageUrl = img?.getAttribute('src') || null;
		return { valid: true, imageUrl };
	} catch {
		return { valid: false, imageUrl: null };
	}
}

async function syncShows(dryRun: boolean, limit: number) {
	console.log('\n=== Syncing Shows ===\n');

	// Get shows without URLs
	const result = await db.execute(`
		SELECT id, title, date, url, image_url
		FROM shows
		WHERE url IS NULL OR url = ''
		ORDER BY date DESC
	`);

	console.log(`Found ${result.rows.length} shows without URLs\n`);

	let updated = 0;
	let processed = 0;

	// Group by normalized title
	const groups = new Map<string, typeof result.rows>();
	for (const row of result.rows) {
		const title = (row.title as string)
			.replace(/\s*\([^)]*\)\s*/g, ' ')
			.replace(/\s*@\s*[^@]+$/i, '')
			.trim();
		if (!groups.has(title)) groups.set(title, []);
		groups.get(title)!.push(row);
	}

	for (const [title, shows] of groups) {
		if (processed >= limit) break;

		const baseSlug = slugify(title);
		console.log(`\n${title} (${shows.length} shows)`);

		for (const show of shows) {
			if (processed >= limit) break;
			processed++;

			// Try different URL patterns
			const urlsToTry = [
				`${CCB_BASE}/event/${baseSlug}/`,
				...Array.from({ length: 100 }, (_, i) => `${CCB_BASE}/event/${baseSlug}-${i + 1}/`)
			];

			let foundUrl: string | null = null;
			let foundImage: string | null = null;

			for (const url of urlsToTry) {
				const { valid, imageUrl } = await fetchShowPage(url);
				if (valid) {
					foundUrl = url;
					foundImage = imageUrl;
					break;
				}
			}

			if (foundUrl) {
				console.log(`  ✓ ${show.date}: ${foundUrl}`);
				if (!dryRun) {
					await db.execute({
						sql: 'UPDATE shows SET url = ?, image_url = COALESCE(?, image_url) WHERE id = ?',
						args: [foundUrl, foundImage, show.id]
					});
				}
				updated++;
			} else {
				console.log(`  ✗ ${show.date}: not found`);
			}

			await new Promise((r) => setTimeout(r, 50));
		}
	}

	console.log(`\nShows: ${updated} updated`);
}

// ============ Lineup Sync ============

async function scrapeLineupFromPage(url: string): Promise<string[]> {
	const response = await fetchWithProxy(url);
	if (!response?.ok) return [];

	try {
		const html = await response.text();
		const root = parse(html);
		const performerSlugs: string[] = [];

		// Look for performer links in the page
		const performerLinks = root.querySelectorAll('a[href*="/performer/"]');
		for (const link of performerLinks) {
			const href = link.getAttribute('href') || '';
			const match = href.match(/\/performer\/([^\/]+)\/?$/);
			if (match && !performerSlugs.includes(match[1])) {
				performerSlugs.push(match[1]);
			}
		}

		return performerSlugs;
	} catch {
		return [];
	}
}

async function syncLineups(dryRun: boolean, limit: number) {
	console.log('\n=== Syncing Lineups ===\n');

	// Get all performers for matching
	const performersResult = await db.execute('SELECT id, name, slug FROM performers');
	const performerBySlug = new Map<string, { id: number; name: string }>();
	const performerByNormalized = new Map<string, { id: number; name: string }>();

	for (const row of performersResult.rows) {
		performerBySlug.set(row.slug as string, { id: row.id as number, name: row.name as string });
		performerByNormalized.set(normalizeName(row.name as string), {
			id: row.id as number,
			name: row.name as string
		});
	}

	console.log(`Loaded ${performerBySlug.size} performers for matching`);

	// Get shows with URLs but no lineup data
	const showsResult = await db.execute(`
		SELECT s.id, s.title, s.date, s.url
		FROM shows s
		LEFT JOIN show_appearances sa ON s.id = sa.show_id
		WHERE s.url IS NOT NULL AND s.url != ''
		GROUP BY s.id
		HAVING COUNT(sa.id) = 0
		ORDER BY s.date DESC
	`);

	console.log(`Found ${showsResult.rows.length} shows with URLs but no lineup\n`);

	let updated = 0;
	let processed = 0;
	let totalPerformersLinked = 0;

	for (const show of showsResult.rows) {
		if (processed >= limit) break;
		processed++;

		const url = show.url as string;
		console.log(`[${processed}] ${show.title} (${show.date})`);

		const performerSlugs = await scrapeLineupFromPage(url);

		if (performerSlugs.length === 0) {
			console.log(`  ✗ No performers found on page`);
			await new Promise((r) => setTimeout(r, 100));
			continue;
		}

		const matchedPerformers: { id: number; name: string }[] = [];
		const unmatchedSlugs: string[] = [];

		for (const slug of performerSlugs) {
			const performer = performerBySlug.get(slug);
			if (performer) {
				matchedPerformers.push(performer);
			} else {
				unmatchedSlugs.push(slug);
			}
		}

		if (matchedPerformers.length > 0) {
			console.log(
				`  ✓ Found ${matchedPerformers.length} performers: ${matchedPerformers.map((p) => p.name).join(', ')}`
			);

			if (!dryRun) {
				for (const performer of matchedPerformers) {
					await db.execute({
						sql: 'INSERT INTO show_appearances (show_id, performer_id) VALUES (?, ?) ON CONFLICT DO NOTHING',
						args: [show.id, performer.id]
					});
				}
			}

			updated++;
			totalPerformersLinked += matchedPerformers.length;
		}

		if (unmatchedSlugs.length > 0) {
			console.log(`  ? Unmatched slugs: ${unmatchedSlugs.join(', ')}`);
		}

		await new Promise((r) => setTimeout(r, 200));
	}

	console.log(
		`\nLineups: ${updated} shows updated, ${totalPerformersLinked} performer links added`
	);
}

// ============ Main ============

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const syncAll = args.includes('--all');
	const syncPerformersFlag = args.includes('--performers');
	const syncShowsFlag = args.includes('--shows');
	const syncLineupsFlag = args.includes('--lineups');
	const limit =
		parseInt(args.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0') || Infinity;

	console.log('CCB Sync');
	console.log('========');
	console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
	console.log(`Limit: ${limit === Infinity ? 'none' : limit}`);

	if (!syncAll && !syncPerformersFlag && !syncShowsFlag && !syncLineupsFlag) {
		console.log('\nUsage:');
		console.log('  npx tsx scripts/sync-ccb.ts --all');
		console.log('  npx tsx scripts/sync-ccb.ts --performers');
		console.log('  npx tsx scripts/sync-ccb.ts --shows');
		console.log('  npx tsx scripts/sync-ccb.ts --lineups');
		console.log('  npx tsx scripts/sync-ccb.ts --dry-run --lineups');
		return;
	}

	if (syncAll || syncPerformersFlag) {
		await syncPerformers(dryRun, limit);
	}

	if (syncAll || syncShowsFlag) {
		await syncShows(dryRun, limit);
	}

	if (syncAll || syncLineupsFlag) {
		await syncLineups(dryRun, limit);
	}

	console.log('\n✓ Done');

	if (dryRun) {
		console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
	}
}

main().catch(console.error);
