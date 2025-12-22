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

interface PerformerData {
	imageUrl: string | null;
	bio: string | null;
	instagram: string | null;
	teams: string[];
}

// Generate alternative slug formats to try
function getSlugVariants(name: string, originalSlug: string): string[] {
	const variants = [originalSlug];

	// Generate slug from name directly (handles special chars differently)
	const fromName = name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // Remove accent marks but keep base letter
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-')
		.trim();

	if (fromName && fromName !== originalSlug) {
		variants.push(fromName);
	}

	return variants;
}

async function scrapePerformerPage(slug: string, name: string): Promise<PerformerData | null> {
	const slugVariants = getSlugVariants(name, slug);

	for (const trySlug of slugVariants) {
		const url = `https://www.comedycafeberlin.com/performer/${trySlug}/`;
		const response = await fetchWithProxy(url);

		if (!response?.ok) {
			continue;
		}

		const html = await response.text();
		// Check if we got a valid performer page (not a 404 page)
		if (html.includes('Page not found') || html.includes('404')) {
			continue;
		}

		const root = parse(html);

		// Extract image (look for post-top-featured image)
		let imageUrl: string | null = null;
		const featuredImg = root.querySelector('img.post-top-featured');
		if (featuredImg) {
			imageUrl = featuredImg.getAttribute('src') || null;
			// Skip CCB logos
			if (imageUrl?.includes('CCB-Logos') || imageUrl?.includes('CCB-facebook')) {
				imageUrl = null;
			}
		}

		// Extract bio (paragraphs in content area, before teams section)
		let bio: string | null = null;
		const paragraphs = root.querySelectorAll('article p, .entry-content p');
		const bioTexts: string[] = [];
		for (const p of paragraphs) {
			const text = p.textContent.trim();
			// Skip empty or very short paragraphs
			if (text.length > 20) {
				bioTexts.push(text);
			}
		}
		if (bioTexts.length > 0) {
			bio = bioTexts.join('\n\n');
		}

		// Extract Instagram
		let instagram: string | null = null;
		const instagramLink = root.querySelector('.wp-social-link-instagram a');
		if (instagramLink) {
			const href = instagramLink.getAttribute('href');
			if (href) {
				// Extract handle from URL
				const match = href.match(/instagram\.com\/([^\/\?]+)/);
				if (match) {
					instagram = match[1];
				}
			}
		}

		// Extract teams
		const teams: string[] = [];
		const teamLinks = root.querySelectorAll('.ccb-teams-card-title a');
		for (const link of teamLinks) {
			const teamName = link.textContent.trim();
			if (teamName) {
				teams.push(teamName);
			}
		}

		return { imageUrl, bio, instagram, teams };
	}

	return null;
}

async function main() {
	const dryRun = process.argv.includes('--dry-run');
	const limit =
		parseInt(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || '0') || Infinity;

	console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
	console.log(`Limit: ${limit === Infinity ? 'none' : limit}`);
	console.log(`Proxy: ${PROXY_URL || 'none (direct fetch)'}\n`);

	// Add columns if they don't exist
	if (!dryRun) {
		const columns = [
			{ name: 'image_url', type: 'TEXT' },
			{ name: 'bio', type: 'TEXT' },
			{ name: 'instagram', type: 'TEXT' }
		];

		for (const col of columns) {
			try {
				await db.execute(`ALTER TABLE performers ADD COLUMN ${col.name} ${col.type}`);
				console.log(`Added ${col.name} column to performers table`);
			} catch (e: any) {
				if (!e.message?.includes('duplicate column')) {
					throw e;
				}
			}
		}
		console.log('');
	}

	// Get all performers from DB
	const dbPerformers = await db.execute('SELECT id, name, slug FROM performers ORDER BY name');
	console.log(`Found ${dbPerformers.rows.length} performers in database\n`);

	let processed = 0;
	let updated = 0;
	let failed = 0;
	const noData: string[] = [];

	for (const row of dbPerformers.rows) {
		if (processed >= limit) break;
		processed++;

		const id = row.id as number;
		const name = row.name as string;
		const slug = row.slug as string;

		console.log(`[${processed}/${Math.min(dbPerformers.rows.length, limit)}] ${name} (${slug})`);

		const data = await scrapePerformerPage(slug, name);

		if (!data) {
			console.log(`  ✗ Failed to fetch page`);
			failed++;
			continue;
		}

		const hasImage = !!data.imageUrl;
		const hasBio = !!data.bio;
		const hasInstagram = !!data.instagram;
		const teamCount = data.teams.length;

		if (!hasImage && !hasBio && !hasInstagram) {
			console.log(`  ✗ No data found`);
			noData.push(name);
			continue;
		}

		console.log(
			`  ✓ Image: ${hasImage ? 'yes' : 'no'}, Bio: ${hasBio ? `${data.bio!.length} chars` : 'no'}, Instagram: ${hasInstagram ? `@${data.instagram}` : 'no'}, Teams: ${teamCount}`
		);

		if (!dryRun) {
			await db.execute({
				sql: `UPDATE performers SET
					image_url = COALESCE(?, image_url),
					bio = COALESCE(?, bio),
					instagram = COALESCE(?, instagram)
					WHERE id = ?`,
				args: [data.imageUrl, data.bio, data.instagram, id]
			});
		}

		updated++;

		// Delay between requests to avoid rate limiting
		await new Promise((r) => setTimeout(r, 500));
	}

	console.log(`\n--- Summary ---`);
	console.log(`Processed: ${processed}`);
	console.log(`Updated: ${updated}`);
	console.log(`Failed to fetch: ${failed}`);
	console.log(`No data found: ${noData.length}`);

	if (noData.length > 0 && noData.length <= 30) {
		console.log(`\nPerformers with no data:`);
		for (const name of noData) {
			console.log(`  - ${name}`);
		}
	}

	if (dryRun) {
		console.log(`\nThis was a dry run. Run without --dry-run to apply changes.`);
	}
}

main().catch(console.error);
