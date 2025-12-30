/**
 * Backfill lineups for shows that have URLs but no lineup data
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import { fetchLineupFromURL } from '../src/lib/utils/lineupCrawler';

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
	authToken: process.env.TURSO_AUTH_TOKEN
});

const proxyUrl = process.env.VITE_PROXY_EVENT_URL;

async function getOrCreatePerformer(name: string): Promise<number> {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

	// Check if exists
	const existing = await db.execute({
		sql: 'SELECT id FROM performers WHERE slug = ? OR name = ?',
		args: [slug, name]
	});

	if (existing.rows.length > 0) {
		return existing.rows[0].id as number;
	}

	// Create new
	const result = await db.execute({
		sql: 'INSERT INTO performers (name, slug) VALUES (?, ?)',
		args: [name, slug]
	});
	return Number(result.lastInsertRowid);
}

async function main() {
	const args = process.argv.slice(2);
	const limit = args[0] ? parseInt(args[0]) : 50; // Default to 50 shows
	const concurrency = 3; // Fetch 3 pages at a time

	console.log(`Backfilling lineups for up to ${limit} shows...\n`);

	// Get shows that have URLs but no lineup data
	const result = await db.execute(`
    SELECT s.id, s.title, s.date, s.url
    FROM shows s
    LEFT JOIN show_appearances sa ON s.id = sa.show_id
    WHERE s.url IS NOT NULL
      AND sa.id IS NULL
    ORDER BY s.date DESC
    LIMIT ${limit}
  `);

	const shows = result.rows;
	console.log(`Found ${shows.length} shows without lineups\n`);

	if (shows.length === 0) {
		console.log('No shows to process!');
		return;
	}

	let processed = 0;
	let withLineup = 0;
	let totalPerformers = 0;
	let idx = 0;

	async function processNext(): Promise<void> {
		if (idx >= shows.length) return;
		const show = shows[idx++];
		const showId = Number(show.id);
		const showUrl = String(show.url);
		const showTitle = String(show.title);
		const showDate = String(show.date);

		try {
			console.log(`[${processed + 1}/${shows.length}] ${showTitle} (${showDate})`);

			// Fetch lineup from event page (debug first 3 shows)
			const debug = processed < 3;
			const lineup = await fetchLineupFromURL(showUrl, proxyUrl, debug);

			if (!lineup || lineup.performers.length === 0) {
				console.log(`  ❌ No lineup found\n`);
				processed++;
				await processNext();
				return;
			}

			console.log(`  ✅ Found ${lineup.performers.length} performers`);

			// Insert performers and link to show
			let addedCount = 0;
			for (const performerName of lineup.performers) {
				try {
					const performerId = await getOrCreatePerformer(performerName);

					// Determine role (host vs performer)
					const role = lineup.hosts.includes(performerName) ? 'host' : 'performer';

					// Insert show_appearance (skip if already exists)
					await db.execute({
						sql: `INSERT INTO show_appearances (show_id, performer_id, role)
                  VALUES (?, ?, ?)
                  ON CONFLICT DO NOTHING`,
						args: [showId, performerId, role]
					});
					addedCount++;
					totalPerformers++;
				} catch (e) {
					console.warn(`  ⚠️  Error adding performer "${performerName}":`, e);
				}
			}

			console.log(`  ➕ Added ${addedCount} show_appearances`);
			if (lineup.hosts.length > 0) {
				console.log(`  🎤 Hosts: ${lineup.hosts.join(', ')}`);
			}
			console.log();

			withLineup++;
			processed++;
		} catch (e) {
			console.error(`  ❌ Error processing show:`, e);
			processed++;
		}

		await processNext();
	}

	// Process shows with limited concurrency
	await Promise.all(Array.from({ length: concurrency }, processNext));

	console.log('\n=== Summary ===');
	console.log(`Processed: ${processed} shows`);
	console.log(`With lineup: ${withLineup} shows`);
	console.log(`Total performers added: ${totalPerformers}`);

	// Verify
	const totalCount = await db.execute('SELECT COUNT(*) as count FROM show_appearances');
	console.log(`\nTotal show_appearances in database: ${totalCount.rows[0].count}`);
}

main().catch(console.error);
