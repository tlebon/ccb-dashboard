import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN!
});

// Slug generation
function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/['']/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

// Read JSON files
const dataDir = join(import.meta.dirname, '..', 'src', 'data');
const teamsData = JSON.parse(readFileSync(join(dataDir, 'teams.json'), 'utf-8'));
const lineupsData = JSON.parse(readFileSync(join(dataDir, 'show-lineups.json'), 'utf-8'));
const historicalData = JSON.parse(readFileSync(join(dataDir, 'historical-shows.json'), 'utf-8'));

// Maps to track IDs
const performerIds = new Map<string, number>();
const teamIds = new Map<string, number>();

async function insertPerformer(name: string): Promise<number> {
	const normalized = name.trim();
	if (performerIds.has(normalized)) {
		return performerIds.get(normalized)!;
	}

	const slug = slugify(normalized);
	const result = await db.execute({
		sql: 'INSERT INTO performers (name, slug) VALUES (?, ?) ON CONFLICT(slug) DO UPDATE SET name = name RETURNING id',
		args: [normalized, slug]
	});
	const id = Number(result.rows[0].id);
	performerIds.set(normalized, id);
	console.log(`  Performer: ${normalized} (id: ${id})`);
	return id;
}

async function insertTeam(team: any): Promise<number> {
	if (teamIds.has(team.name)) {
		return teamIds.get(team.name)!;
	}

	const slug = slugify(team.name);
	// Map types: duo->indie, musical/unknown->other
	const typeMap: Record<string, string> = { house: 'house', indie: 'indie', duo: 'indie', musical: 'other' };
	const type = typeMap[team.type] || 'other';

	// Insert coach first if exists
	let coachId: number | null = null;
	if (team.coach) {
		coachId = await insertPerformer(team.coach);
	}

	const result = await db.execute({
		sql: 'INSERT INTO teams (name, slug, type, coach_id, note) VALUES (?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET name = name RETURNING id',
		args: [team.name, slug, type, coachId, team.note || null]
	});
	const id = Number(result.rows[0].id);
	teamIds.set(team.name, id);
	console.log(`  Team: ${team.name} (id: ${id})`);

	// Insert team members
	if (team.members && team.members.length > 0) {
		for (const memberName of team.members) {
			const performerId = await insertPerformer(memberName);
			await db.execute({
				sql: 'INSERT INTO team_members (team_id, performer_id, is_former) VALUES (?, ?, 0) ON CONFLICT DO NOTHING',
				args: [id, performerId]
			});
		}
	}

	return id;
}

async function insertShow(title: string, date: string, source: string): Promise<number> {
	const result = await db.execute({
		sql: 'INSERT INTO shows (title, date, source) VALUES (?, ?, ?) RETURNING id',
		args: [title, date, source]
	});
	return Number(result.rows[0].id);
}

async function main() {
	console.log('Starting migration...\n');

	// Step 1: Insert all teams and their members
	console.log('1. Importing teams and performers from teams.json...');
	for (const team of teamsData.teams) {
		await insertTeam(team);
	}
	console.log(`   Done: ${teamIds.size} teams, ${performerIds.size} performers\n`);

	// Step 2: Import shows from show-lineups.json
	console.log('2. Importing shows from show-lineups.json...');
	let showCount = 0;
	for (const lineup of lineupsData.showLineups) {
		const showId = await insertShow(lineup.show, lineup.date, 'beeper');
		showCount++;

		// If it's a team show, add all team members as appearances
		if (lineup.teamName && teamIds.has(lineup.teamName)) {
			const teamId = teamIds.get(lineup.teamName)!;
			const members = await db.execute({
				sql: 'SELECT performer_id FROM team_members WHERE team_id = ?',
				args: [teamId]
			});
			for (const row of members.rows) {
				await db.execute({
					sql: 'INSERT INTO show_appearances (show_id, performer_id, role, team_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
					args: [showId, row.performer_id, 'performer', teamId]
				});
			}
		}

		// Add individual performers
		if (lineup.performers && lineup.performers.length > 0) {
			for (const name of lineup.performers) {
				const performerId = await insertPerformer(name);
				await db.execute({
					sql: 'INSERT INTO show_appearances (show_id, performer_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
					args: [showId, performerId, lineup.teamName ? 'guest' : 'performer']
				});
			}
		}

		// Add hosts
		if (lineup.hosts && lineup.hosts.length > 0) {
			for (const name of lineup.hosts) {
				const performerId = await insertPerformer(name);
				await db.execute({
					sql: 'INSERT INTO show_appearances (show_id, performer_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
					args: [showId, performerId, 'host']
				});
			}
		}
	}
	console.log(`   Done: ${showCount} shows imported\n`);

	// Step 3: Import historical shows
	console.log('3. Importing historical shows...');
	let historicalCount = 0;
	// historicalData is an array, not { shows: [...] }
	const historicalShows = Array.isArray(historicalData) ? historicalData : historicalData.shows || [];
	for (const show of historicalShows) {
		// Historical shows may not have uid, skip conflict check
		await db.execute({
			sql: 'INSERT INTO shows (title, date, time, source) VALUES (?, ?, ?, ?)',
			args: [show.title, show.date, show.time || null, 'ical']
		});
		historicalCount++;
	}
	console.log(`   Done: ${historicalCount} historical shows imported\n`);

	// Summary
	const counts = await db.batch([
		'SELECT COUNT(*) as count FROM performers',
		'SELECT COUNT(*) as count FROM teams',
		'SELECT COUNT(*) as count FROM team_members',
		'SELECT COUNT(*) as count FROM shows',
		'SELECT COUNT(*) as count FROM show_appearances'
	]);

	console.log('Migration complete!');
	console.log('Summary:');
	console.log(`  Performers: ${counts[0].rows[0].count}`);
	console.log(`  Teams: ${counts[1].rows[0].count}`);
	console.log(`  Team memberships: ${counts[2].rows[0].count}`);
	console.log(`  Shows: ${counts[3].rows[0].count}`);
	console.log(`  Show appearances: ${counts[4].rows[0].count}`);
}

main().catch(console.error);
