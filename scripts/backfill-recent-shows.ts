/**
 * Backfill lineups specifically for July-Dec 2025 shows
 * These shows had HTML-encoded descriptions that are now fixed
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import { fetchLineupFromURL } from '../src/lib/utils/lineupCrawler';

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

async function getOrCreatePerformer(name: string): Promise<number> {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

	const existing = await db.execute({
		sql: 'SELECT id FROM performers WHERE slug = ? OR name = ?',
		args: [slug, name]
	});

	if (existing.rows.length > 0) {
		return existing.rows[0].id as number;
	}

	const result = await db.execute({
		sql: 'INSERT INTO performers (name, slug) VALUES (?, ?)',
		args: [name, slug]
	});
	return Number(result.lastInsertRowid);
}

async function main() {
	const limit = parseInt(process.argv[2]) || 100;
	const concurrency = 3;
	const proxyUrl = process.env.VITE_PROXY_EVENT_URL;
	const debug = false;

	console.log(`Backfilling lineups for July-Dec 2025 shows (up to ${limit})...\\n`);

	// Get shows from July-Dec 2025 without lineups
	const result = await db.execute({
		sql: `
			SELECT s.id, s.title, s.date, s.url
			FROM shows s
			WHERE s.url IS NOT NULL
			AND s.date BETWEEN '2025-07-01' AND '2025-12-30'
			AND s.id NOT IN (SELECT DISTINCT show_id FROM show_appearances)
			ORDER BY s.date DESC
			LIMIT ?
		`,
		args: [limit]
	});

	const shows = result.rows.map((row) => ({
		id: Number(row.id),
		title: row.title as string,
		date: row.date as string,
		url: row.url as string
	}));

	console.log(`Found ${shows.length} shows without lineups\\n`);

	let idx = 0;
	let lineupsAdded = 0;
	let performersAdded = 0;

	async function processNext(): Promise<void> {
		if (idx >= shows.length) return;
		const show = shows[idx++];

		console.log(`[${idx}/${shows.length}] ${show.title} (${show.date})`);

		try {
			const showUrl = show.url;
			const lineup = await fetchLineupFromURL(showUrl, proxyUrl, debug);

			if (!lineup || lineup.performers.length === 0) {
				console.log(`  ❌ No lineup found\\n`);
				await processNext();
				return;
			}

			console.log(`  ✅ Found ${lineup.performers.length} performers`);

			// Add performers
			for (const performerName of lineup.performers) {
				try {
					const performerId = await getOrCreatePerformer(performerName);
					const role = lineup.hosts.includes(performerName) ? 'host' : 'performer';

					await db.execute({
						sql: `INSERT INTO show_appearances (show_id, performer_id, role)
							  VALUES (?, ?, ?)
							  ON CONFLICT DO NOTHING`,
						args: [show.id, performerId, role]
					});
					performersAdded++;
				} catch (e) {
					console.warn(`  ⚠️ Error adding performer "${performerName}":`, e);
				}
			}

			lineupsAdded++;
			console.log();
		} catch (e) {
			console.warn(`  ⚠️ Error processing show:`, e);
			console.log();
		}

		await processNext();
	}

	await Promise.all(Array.from({ length: concurrency }, processNext));

	console.log(`\\n=== Summary ===`);
	console.log(`Processed: ${shows.length} shows`);
	console.log(`With lineup: ${lineupsAdded} shows`);
	console.log(`Total performers added: ${performersAdded}`);

	const total = await db.execute('SELECT COUNT(*) as count FROM show_appearances');
	console.log(`\\nTotal show_appearances in database: ${total.rows[0].count}`);
}

main().catch(console.error);
