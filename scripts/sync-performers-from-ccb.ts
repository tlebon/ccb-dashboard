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
const PERFORMERS_BASE_URL = 'https://www.comedycafeberlin.com/performers';

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

interface PerformerInfo {
	name: string;
	slug: string;
	imageUrl: string | null;
}

// Normalize name for comparison
function normalizeName(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

// Generate slug from name
function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();
}

async function scrapePerformersDirectory(): Promise<PerformerInfo[]> {
	const performers: PerformerInfo[] = [];
	const seenSlugs = new Set<string>();

	// Fetch all pages of performers directory
	for (let page = 1; page <= 15; page++) {
		const url = page === 1 ? `${PERFORMERS_BASE_URL}/` : `${PERFORMERS_BASE_URL}/page/${page}/`;
		console.log(`Fetching performers directory page ${page}...`);

		const response = await fetchWithProxy(url);
		if (!response?.ok) {
			console.log(`  Page ${page} not found or failed, stopping.`);
			break;
		}

		const html = await response.text();
		const root = parse(html);

		// Look for performer cards
		const cards = root.querySelectorAll('.ccb-performers-card');
		if (cards.length === 0) {
			// Try alternative selectors
			const links = root.querySelectorAll('a[href*="/performer/"]');
			if (links.length === 0) {
				console.log(`  No performers found on page ${page}, stopping.`);
				break;
			}

			// Extract from links
			for (const link of links) {
				const href = link.getAttribute('href') || '';
				const match = href.match(/\/performer\/([^\/]+)\/?$/);
				if (match) {
					const slug = match[1];
					if (!seenSlugs.has(slug)) {
						seenSlugs.add(slug);
						const name = link.textContent?.trim() || slug;
						performers.push({ name, slug, imageUrl: null });
					}
				}
			}
		} else {
			for (const card of cards) {
				const nameEl = card.querySelector('.ccb-performers-card-title a');
				const imgEl = card.querySelector('.ccb-performers-card-image img');
				const linkEl = card.querySelector('a[href*="/performer/"]');

				if (nameEl || linkEl) {
					const href = (linkEl || nameEl)?.getAttribute('href') || '';
					const match = href.match(/\/performer\/([^\/]+)\/?$/);
					if (match) {
						const slug = match[1];
						if (!seenSlugs.has(slug)) {
							seenSlugs.add(slug);
							const name = nameEl?.textContent?.trim() || slug;
							let imageUrl = imgEl?.getAttribute('src') || null;

							// Skip placeholder images
							if (imageUrl?.includes('CCB-Logos') || imageUrl?.includes('placeholder')) {
								imageUrl = null;
							} else if (imageUrl) {
								// Get higher resolution
								imageUrl = imageUrl.replace(/-\d+x\d+\./, '.');
							}

							performers.push({ name, slug, imageUrl });
						}
					}
				}
			}
		}

		console.log(`  Found ${cards.length || 'some'} performers on page ${page}`);

		// Check if there's a next page
		const nextPage = root.querySelector('.next.page-numbers');
		if (!nextPage) {
			console.log(`  No more pages.`);
			break;
		}

		await new Promise(r => setTimeout(r, 300));
	}

	return performers;
}

async function main() {
	const dryRun = process.argv.includes('--dry-run');

	console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
	console.log(`Proxy: ${PROXY_URL || 'none (direct fetch)'}\n`);

	// Get all performers from CCB
	console.log('--- Scraping CCB Performers Directory ---\n');
	const ccbPerformers = await scrapePerformersDirectory();
	console.log(`\nFound ${ccbPerformers.length} performers on CCB website\n`);

	// Get existing performers from DB
	const dbResult = await db.execute('SELECT id, name, slug FROM performers');
	const dbPerformers = new Map<string, { id: number; name: string; slug: string }>();
	const dbNormalized = new Map<string, { id: number; name: string; slug: string }>();

	for (const row of dbResult.rows) {
		const performer = {
			id: row.id as number,
			name: row.name as string,
			slug: row.slug as string
		};
		dbPerformers.set(performer.slug, performer);
		dbNormalized.set(normalizeName(performer.name), performer);
	}

	console.log(`Found ${dbPerformers.size} performers in database\n`);

	// Find new performers
	const newPerformers: PerformerInfo[] = [];
	const existingMatches: string[] = [];

	for (const ccb of ccbPerformers) {
		// Check by slug
		if (dbPerformers.has(ccb.slug)) {
			existingMatches.push(`${ccb.name} (slug match)`);
			continue;
		}

		// Check by normalized name
		const normalized = normalizeName(ccb.name);
		if (dbNormalized.has(normalized)) {
			existingMatches.push(`${ccb.name} -> ${dbNormalized.get(normalized)!.name} (name match)`);
			continue;
		}

		// Also normalize the slug as a name (for when name extraction fails)
		const normalizedSlug = ccb.slug.replace(/-/g, ' ').trim();

		// Check partial matches (first name only, or name starts with)
		const firstName = normalized.split(' ')[0];
		const slugFirstName = normalizedSlug.split(' ')[0];
		let foundPartial = false;
		for (const [dbNorm, dbPerf] of dbNormalized) {
			// First name matches
			if (dbNorm.startsWith(firstName + ' ') || dbNorm === firstName) {
				existingMatches.push(`${ccb.name} -> ${dbPerf.name} (partial match)`);
				foundPartial = true;
				break;
			}
			// First name from slug matches (fallback when name wasn't extracted)
			if (slugFirstName.length > 3 && (dbNorm.startsWith(slugFirstName + ' ') || dbNorm === slugFirstName)) {
				existingMatches.push(`${ccb.name} -> ${dbPerf.name} (slug partial match)`);
				foundPartial = true;
				break;
			}
			// DB name starts with CCB name (handles "terezie fendrych" -> "terezie fendrychova")
			if (dbNorm.startsWith(normalized) && normalized.length > 5) {
				existingMatches.push(`${ccb.name} -> ${dbPerf.name} (prefix match)`);
				foundPartial = true;
				break;
			}
			// CCB name starts with DB name
			if (normalized.startsWith(dbNorm + ' ') || (normalized.startsWith(dbNorm) && dbNorm.length > 5)) {
				existingMatches.push(`${ccb.name} -> ${dbPerf.name} (reverse prefix match)`);
				foundPartial = true;
				break;
			}
			// Normalized slug matches DB name
			if (normalizedSlug === dbNorm || dbNorm.startsWith(normalizedSlug + ' ') || normalizedSlug.startsWith(dbNorm + ' ')) {
				existingMatches.push(`${ccb.name} -> ${dbPerf.name} (slug match)`);
				foundPartial = true;
				break;
			}
			// Normalize the DB slug and compare (handles 'marie-laure-gagn' vs 'marie-laure-gagne')
			const dbSlugNormalized = dbPerf.slug.replace(/-/g, ' ').trim();
			if (normalizedSlug === dbSlugNormalized ||
				normalizedSlug.startsWith(dbSlugNormalized) ||
				dbSlugNormalized.startsWith(normalizedSlug)) {
				existingMatches.push(`${ccb.name} -> ${dbPerf.name} (slug prefix match)`);
				foundPartial = true;
				break;
			}
			// Fuzzy match: check if names are very similar (handles typos like "milaud" vs "millaud")
			if (Math.abs(dbNorm.length - normalized.length) <= 2 && normalized.length > 5) {
				let matches = 0;
				const shorter = dbNorm.length < normalized.length ? dbNorm : normalized;
				const longer = dbNorm.length < normalized.length ? normalized : dbNorm;
				for (let i = 0; i < shorter.length; i++) {
					if (shorter[i] === longer[i]) matches++;
				}
				if (matches >= shorter.length - 2 && matches >= shorter.length * 0.8) {
					existingMatches.push(`${ccb.name} -> ${dbPerf.name} (fuzzy match)`);
					foundPartial = true;
					break;
				}
			}
		}
		if (foundPartial) continue;

		newPerformers.push(ccb);
	}

	console.log(`--- Results ---`);
	console.log(`Existing matches: ${existingMatches.length}`);
	console.log(`New performers to add: ${newPerformers.length}\n`);

	if (newPerformers.length > 0) {
		console.log('New performers found - fetching full details...\n');

		// Fetch actual names from performer pages
		const performersToAdd: { name: string; slug: string; imageUrl: string | null; bio: string | null }[] = [];

		for (const p of newPerformers) {
			console.log(`  Fetching ${p.slug}...`);
			const url = `https://www.comedycafeberlin.com/performer/${p.slug}/`;
			const response = await fetchWithProxy(url);

			if (response?.ok) {
				const html = await response.text();
				const root = parse(html);

				// Get name from page title or heading
				const titleEl = root.querySelector('h1.entry-title, h1.performer-name, .post-title h1, h1');
				let name = titleEl?.textContent?.trim() || p.name;

				// Clean up name if it's still a slug
				if (name === p.slug || name.includes('-')) {
					// Convert slug to title case
					name = p.slug
						.split('-')
						.map(word => word.charAt(0).toUpperCase() + word.slice(1))
						.join(' ');
				}

				// Get image
				let imageUrl: string | null = null;
				const featuredImg = root.querySelector('img.post-top-featured');
				if (featuredImg) {
					imageUrl = featuredImg.getAttribute('src') || null;
					if (imageUrl?.includes('CCB-Logos') || imageUrl?.includes('CCB-facebook')) {
						imageUrl = null;
					}
				}

				// Get bio
				let bio: string | null = null;
				const paragraphs = root.querySelectorAll('article p, .entry-content p');
				const bioTexts: string[] = [];
				for (const para of paragraphs) {
					const text = para.textContent.trim();
					if (text.length > 20) {
						bioTexts.push(text);
					}
				}
				if (bioTexts.length > 0) {
					bio = bioTexts.join('\n\n');
				}

				console.log(`    Found: ${name}`);
				performersToAdd.push({ name, slug: p.slug, imageUrl, bio });
			} else {
				// Use title-cased slug as fallback
				const name = p.slug
					.split('-')
					.map(word => word.charAt(0).toUpperCase() + word.slice(1))
					.join(' ');
				console.log(`    Using fallback name: ${name}`);
				performersToAdd.push({ name, slug: p.slug, imageUrl: p.imageUrl, bio: null });
			}

			await new Promise(r => setTimeout(r, 300));
		}

		console.log('\nNew performers to add:');
		for (const p of performersToAdd) {
			console.log(`  + ${p.name} (${p.slug}) - image: ${p.imageUrl ? 'yes' : 'no'}, bio: ${p.bio ? 'yes' : 'no'}`);
		}
		console.log('');

		if (!dryRun) {
			console.log('Adding new performers to database...\n');
			for (const p of performersToAdd) {
				await db.execute({
					sql: 'INSERT INTO performers (name, slug, image_url, bio) VALUES (?, ?, ?, ?)',
					args: [p.name, p.slug, p.imageUrl, p.bio]
				});
				console.log(`  Added: ${p.name}`);
			}
			console.log(`\nAdded ${performersToAdd.length} new performers.`);
		}
	}

	if (dryRun && newPerformers.length > 0) {
		console.log(`\nThis was a dry run. Run without --dry-run to add new performers.`);
	}
}

main().catch(console.error);
