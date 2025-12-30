/**
 * Backfill full descriptions for shows that have truncated descriptions (ending with ...)
 * This fixes shows where the JSON-LD only had shortened descriptions
 */

import { createClient } from '@libsql/client';
import { fetchLineupFromURL } from '../src/lib/utils/lineupCrawler';
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

async function main() {
	const proxyUrl = process.env.VITE_PROXY_EVENT_URL;
	const limit = process.argv[2] ? parseInt(process.argv[2]) : 50;

	console.log(`Backfilling full descriptions for truncated shows (limit: ${limit})...\n`);

	// Find shows with truncated descriptions (ending with ...)
	const result = await db.execute({
		sql: `
			SELECT id, title, url, description
			FROM shows
			WHERE url IS NOT NULL
			AND (
				description IS NULL
				OR LENGTH(description) < 200
				OR description LIKE '%...'
				OR description LIKE '%...\\n'
			)
			ORDER BY date DESC
			LIMIT ?
		`,
		args: [limit]
	});

	const shows = result.rows.map((row) => ({
		id: Number(row.id),
		title: row.title as string,
		url: row.url as string,
		currentDesc: row.description as string | null
	}));

	console.log(`Found ${shows.length} shows with truncated or missing descriptions\n`);

	if (shows.length === 0) {
		console.log('✅ All descriptions are complete!');
		return;
	}

	let updated = 0;
	let skipped = 0;
	let errors = 0;

	// Process shows sequentially to avoid hammering the server
	for (const show of shows) {
		try {
			console.log(`📄 Fetching: ${show.title} (${show.url})`);

			const lineup = await fetchLineupFromURL(show.url, proxyUrl, false);

			if (!lineup || !lineup.fullDescription) {
				console.log(`  ⏭️  No full description found, skipping`);
				skipped++;
				continue;
			}

			if (lineup.fullDescription.length <= 200) {
				console.log(
					`  ⏭️  Description not significantly longer (${lineup.fullDescription.length} chars), skipping`
				);
				skipped++;
				continue;
			}

			// Update description
			await db.execute({
				sql: 'UPDATE shows SET description = ? WHERE id = ?',
				args: [lineup.fullDescription, show.id]
			});

			const preview =
				lineup.fullDescription.length > 100
					? lineup.fullDescription.substring(0, 100) + '...'
					: lineup.fullDescription;

			console.log(
				`  ✅ Updated (${show.currentDesc?.length || 0} → ${lineup.fullDescription.length} chars)`
			);
			console.log(`     "${preview}"`);

			updated++;

			// Small delay to avoid hammering the server
			await new Promise((resolve) => setTimeout(resolve, 200));
		} catch (e) {
			console.error(`  ❌ Error: ${e}`);
			errors++;
		}
	}

	console.log(`\n=== Summary ===`);
	console.log(`Total shows checked: ${shows.length}`);
	console.log(`✅ Updated: ${updated}`);
	console.log(`⏭️  Skipped: ${skipped}`);
	console.log(`❌ Errors: ${errors}`);
}

main().catch(console.error);
