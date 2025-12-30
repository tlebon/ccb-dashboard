/**
 * Export lineup and team data to JSON files for backup
 * This ensures we don't lose this data if the database is recreated
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

interface ShowAppearance {
	show_id: number;
	show_title: string;
	show_date: string;
	show_url: string | null;
	performer_id: number;
	performer_name: string;
	performer_slug: string;
	role: string;
	team_id: number | null;
	team_name: string | null;
	team_slug: string | null;
}

async function main() {
	console.log('Exporting lineup data...\n');

	// Export all show_appearances with denormalized data
	const appearances = await db.execute(`
		SELECT
			sa.show_id,
			s.title as show_title,
			s.date as show_date,
			s.url as show_url,
			sa.performer_id,
			p.name as performer_name,
			p.slug as performer_slug,
			sa.role,
			sa.team_id,
			t.name as team_name,
			t.slug as team_slug
		FROM show_appearances sa
		JOIN shows s ON sa.show_id = s.id
		JOIN performers p ON sa.performer_id = p.id
		LEFT JOIN teams t ON sa.team_id = t.id
		ORDER BY s.date DESC, s.title, sa.role, p.name
	`);

	const data: ShowAppearance[] = appearances.rows.map((row) => ({
		show_id: row.show_id as number,
		show_title: row.show_title as string,
		show_date: row.show_date as string,
		show_url: row.show_url as string | null,
		performer_id: row.performer_id as number,
		performer_name: row.performer_name as string,
		performer_slug: row.performer_slug as string,
		role: row.role as string,
		team_id: row.team_id as number | null,
		team_name: row.team_name as string | null,
		team_slug: row.team_slug as string | null
	}));

	// Create backups directory if it doesn't exist
	const backupDir = path.join(process.cwd(), 'backups');
	if (!fs.existsSync(backupDir)) {
		fs.mkdirSync(backupDir, { recursive: true });
	}

	// Export to JSON with timestamp
	const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
	const filename = `lineup-data-${timestamp}.json`;
	const filepath = path.join(backupDir, filename);

	fs.writeFileSync(
		filepath,
		JSON.stringify(
			{
				exported_at: new Date().toISOString(),
				total_appearances: data.length,
				data
			},
			null,
			2
		)
	);

	console.log(`✅ Exported ${data.length} appearances to ${filename}`);

	// Also create a "latest" symlink/copy for easy access
	const latestPath = path.join(backupDir, 'lineup-data-latest.json');
	fs.writeFileSync(
		latestPath,
		JSON.stringify(
			{
				exported_at: new Date().toISOString(),
				total_appearances: data.length,
				data
			},
			null,
			2
		)
	);

	console.log(`✅ Updated ${path.basename(latestPath)}`);

	// Print summary stats
	const teamAppearances = data.filter((a) => a.team_id !== null).length;
	const showsWithLineup = new Set(data.map((a) => a.show_id)).size;
	const uniquePerformers = new Set(data.map((a) => a.performer_id)).size;
	const uniqueTeams = new Set(data.filter((a) => a.team_id).map((a) => a.team_id)).size;

	console.log('\n=== Summary ===');
	console.log(`Total appearances: ${data.length}`);
	console.log(`Team-linked appearances: ${teamAppearances}`);
	console.log(`Shows with lineup: ${showsWithLineup}`);
	console.log(`Unique performers: ${uniquePerformers}`);
	console.log(`Teams with shows: ${uniqueTeams}`);
}

main().catch(console.error);
