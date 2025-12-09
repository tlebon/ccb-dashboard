import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN
});

interface ShowLineup {
	date: string;
	show: string;
	type: string;
	teamName?: string;
	performers?: string[];
	teamGuests?: string[];
	hostTeam?: string;
}

async function getOrCreatePerformer(name: string): Promise<number> {
	const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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

async function getTeamByName(name: string): Promise<number | null> {
	const result = await db.execute({
		sql: 'SELECT id FROM teams WHERE name LIKE ?',
		args: [`%${name}%`]
	});
	return result.rows.length > 0 ? (result.rows[0].id as number) : null;
}

async function findShow(date: string, title: string): Promise<number | null> {
	// Try exact match first
	let result = await db.execute({
		sql: 'SELECT id FROM shows WHERE date = ? AND title = ?',
		args: [date, title]
	});

	if (result.rows.length > 0) {
		return result.rows[0].id as number;
	}

	// Try fuzzy title match on same date
	result = await db.execute({
		sql: 'SELECT id FROM shows WHERE date = ? AND title LIKE ?',
		args: [date, `%${title}%`]
	});

	if (result.rows.length > 0) {
		return result.rows[0].id as number;
	}

	// Try fuzzy match within -2 to +7 days (lineup posts usually cover the upcoming week)
	const d = new Date(date);
	const dates = [];
	for (let i = -2; i <= 7; i++) {
		const nd = new Date(d);
		nd.setDate(nd.getDate() + i);
		dates.push(nd.toISOString().split('T')[0]);
	}

	for (const tryDate of dates) {
		result = await db.execute({
			sql: 'SELECT id FROM shows WHERE date = ? AND title LIKE ?',
			args: [tryDate, `%${title}%`]
		});

		if (result.rows.length > 0) {
			console.log(`    Fuzzy matched: ${date} "${title}" -> ${tryDate}`);
			return result.rows[0].id as number;
		}
	}

	return null;
}

async function main() {
	const filePath = path.join(__dirname, '../src/data/show-lineups.json');
	const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
	const lineups: ShowLineup[] = data.showLineups;

	console.log(`Processing ${lineups.length} lineups...`);

	let linkedShows = 0;
	let linkedPerformers = 0;
	let linkedTeams = 0;
	let notFound = 0;

	for (const lineup of lineups) {
		const showId = await findShow(lineup.date, lineup.show);

		if (!showId) {
			console.log(`  Show not found: ${lineup.date} - ${lineup.show}`);
			notFound++;
			continue;
		}

		linkedShows++;

		// Link performers
		if (lineup.performers && lineup.performers.length > 0) {
			for (const performerName of lineup.performers) {
				const performerId = await getOrCreatePerformer(performerName);
				await db.execute({
					sql: 'INSERT INTO show_appearances (show_id, performer_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
					args: [showId, performerId, 'performer']
				});
				linkedPerformers++;
			}
		}

		// Link team
		if (lineup.teamName) {
			const teamId = await getTeamByName(lineup.teamName);
			if (teamId) {
				// Get team members and add them
				const members = await db.execute({
					sql: 'SELECT performer_id FROM team_members WHERE team_id = ? AND is_former = 0',
					args: [teamId]
				});
				for (const member of members.rows) {
					await db.execute({
						sql: 'INSERT INTO show_appearances (show_id, performer_id, role, team_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
						args: [showId, member.performer_id, 'performer', teamId]
					});
					linkedPerformers++;
				}
				linkedTeams++;
			}
		}

		// Link team guests
		if (lineup.teamGuests) {
			for (const teamName of lineup.teamGuests) {
				const teamId = await getTeamByName(teamName);
				if (teamId) {
					const members = await db.execute({
						sql: 'SELECT performer_id FROM team_members WHERE team_id = ? AND is_former = 0',
						args: [teamId]
					});
					for (const member of members.rows) {
						await db.execute({
							sql: 'INSERT INTO show_appearances (show_id, performer_id, role, team_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
							args: [showId, member.performer_id, 'guest', teamId]
						});
						linkedPerformers++;
					}
				}
			}
		}
	}

	console.log(`\nResults:`);
	console.log(`  Shows linked: ${linkedShows}`);
	console.log(`  Shows not found: ${notFound}`);
	console.log(`  Performer appearances: ${linkedPerformers}`);
	console.log(`  Team shows: ${linkedTeams}`);

	// Verify
	const total = await db.execute('SELECT COUNT(*) as count FROM show_appearances');
	console.log(`\nTotal show_appearances: ${total.rows[0].count}`);
}

main().catch(console.error);
