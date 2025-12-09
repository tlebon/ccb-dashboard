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
	hosts?: string[];
	teams?: string[];
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

function normalizeTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

// Alternate names for fuzzy matching
const TITLE_ALIASES: Record<string, string[]> = {
	'indie night': ['indie improv', 'indie improv show'],
	'stand up': ['stand-up', 'standup'],
	'smorgasbord': ['smörgåsbord', 'bit show'],
	'dackel': ['frei erfunden', 'german improv'],
};

async function findShow(date: string, title: string): Promise<{ id: number; date: string; title: string } | null> {
	const normalizedSearch = normalizeTitle(title);

	// Get aliases for this title
	const searchTerms = [title, normalizedSearch];
	const aliases = TITLE_ALIASES[normalizedSearch];
	if (aliases) {
		searchTerms.push(...aliases);
	}

	// First check for exact title match on any date within range
	const d = new Date(date);
	const dates = [];
	for (let i = -7; i <= 14; i++) {
		const nd = new Date(d);
		nd.setDate(nd.getDate() + i);
		dates.push(nd.toISOString().split('T')[0]);
	}

	// Try exact match first on all dates
	for (const tryDate of dates) {
		const result = await db.execute({
			sql: 'SELECT id, date, title FROM shows WHERE date = ? AND title = ?',
			args: [tryDate, title]
		});
		if (result.rows.length > 0) {
			return result.rows[0] as { id: number; date: string; title: string };
		}
	}

	// Try LIKE match with original title and aliases
	for (const tryDate of dates) {
		for (const term of searchTerms) {
			const result = await db.execute({
				sql: 'SELECT id, date, title FROM shows WHERE date = ? AND LOWER(title) LIKE ?',
				args: [tryDate, `%${term.toLowerCase()}%`]
			});
			if (result.rows.length > 0) {
				return result.rows[0] as { id: number; date: string; title: string };
			}
		}
	}

	// Try reverse LIKE (show title contains lineup show name)
	for (const tryDate of dates) {
		const result = await db.execute({
			sql: 'SELECT id, date, title FROM shows WHERE date = ?',
			args: [tryDate]
		});
		for (const row of result.rows) {
			const dbTitle = normalizeTitle(row.title as string);
			for (const term of searchTerms) {
				const normTerm = normalizeTitle(term);
				if (dbTitle.includes(normTerm) || normTerm.includes(dbTitle)) {
					return row as { id: number; date: string; title: string };
				}
			}
		}
	}

	return null;
}

async function main() {
	// Check current state
	console.log('=== Current Database State ===');
	const appearances = await db.execute('SELECT COUNT(*) as c FROM show_appearances');
	console.log('Current show_appearances:', appearances.rows[0].c);

	const shows = await db.execute('SELECT COUNT(*) as c FROM shows');
	console.log('Total shows:', shows.rows[0].c);

	const showsWithLineups = await db.execute('SELECT COUNT(DISTINCT show_id) as c FROM show_appearances');
	console.log('Shows with lineup data:', showsWithLineups.rows[0].c);

	// Load lineup data
	const filePath = path.join(__dirname, '../src/data/show-lineups.json');
	const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
	const lineups: ShowLineup[] = data.showLineups;

	console.log(`\n=== Processing ${lineups.length} lineups ===`);

	// Clear existing appearances first (to rebuild clean)
	await db.execute('DELETE FROM show_appearances');
	console.log('Cleared existing show_appearances');

	let linkedShows = 0;
	let linkedPerformers = 0;
	let linkedTeams = 0;
	let notFound = 0;
	const notFoundList: string[] = [];

	for (const lineup of lineups) {
		const showMatch = await findShow(lineup.date, lineup.show);

		if (!showMatch) {
			console.log(`  NOT FOUND: ${lineup.date} - ${lineup.show}`);
			notFoundList.push(`${lineup.date} - ${lineup.show}`);
			notFound++;
			continue;
		}

		if (showMatch.date !== lineup.date) {
			console.log(`  Matched: ${lineup.date} "${lineup.show}" -> ${showMatch.date} "${showMatch.title}"`);
		}

		linkedShows++;

		// Link individual performers
		if (lineup.performers && lineup.performers.length > 0) {
			for (const performerName of lineup.performers) {
				const performerId = await getOrCreatePerformer(performerName);
				await db.execute({
					sql: 'INSERT INTO show_appearances (show_id, performer_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
					args: [showMatch.id, performerId, 'performer']
				});
				linkedPerformers++;
			}
		}

		// Link hosts
		if (lineup.hosts && lineup.hosts.length > 0) {
			for (const hostName of lineup.hosts) {
				const performerId = await getOrCreatePerformer(hostName);
				await db.execute({
					sql: 'INSERT INTO show_appearances (show_id, performer_id, role) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
					args: [showMatch.id, performerId, 'host']
				});
				linkedPerformers++;
			}
		}

		// Link main team
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
						args: [showMatch.id, member.performer_id, 'performer', teamId]
					});
					linkedPerformers++;
				}
				linkedTeams++;
			} else {
				console.log(`    Team not found: ${lineup.teamName}`);
			}
		}

		// Link featured teams
		if (lineup.teams) {
			for (const teamName of lineup.teams) {
				const teamId = await getTeamByName(teamName);
				if (teamId) {
					const members = await db.execute({
						sql: 'SELECT performer_id FROM team_members WHERE team_id = ? AND is_former = 0',
						args: [teamId]
					});
					for (const member of members.rows) {
						await db.execute({
							sql: 'INSERT INTO show_appearances (show_id, performer_id, role, team_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
							args: [showMatch.id, member.performer_id, 'performer', teamId]
						});
						linkedPerformers++;
					}
					linkedTeams++;
				}
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
							args: [showMatch.id, member.performer_id, 'guest', teamId]
						});
						linkedPerformers++;
					}
				}
			}
		}

		// Link host team
		if (lineup.hostTeam) {
			const teamId = await getTeamByName(lineup.hostTeam);
			if (teamId) {
				const members = await db.execute({
					sql: 'SELECT performer_id FROM team_members WHERE team_id = ? AND is_former = 0',
					args: [teamId]
				});
				for (const member of members.rows) {
					await db.execute({
						sql: 'INSERT INTO show_appearances (show_id, performer_id, role, team_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
						args: [showMatch.id, member.performer_id, 'host', teamId]
					});
					linkedPerformers++;
				}
			}
		}
	}

	console.log(`\n=== Results ===`);
	console.log(`  Shows linked: ${linkedShows} / ${lineups.length}`);
	console.log(`  Shows not found: ${notFound}`);
	console.log(`  Performer appearances added: ${linkedPerformers}`);
	console.log(`  Team shows: ${linkedTeams}`);

	if (notFoundList.length > 0) {
		console.log('\n=== Shows Not Found ===');
		notFoundList.forEach(s => console.log(`  ${s}`));
	}

	// Verify final state
	const finalAppearances = await db.execute('SELECT COUNT(*) as count FROM show_appearances');
	console.log(`\nTotal show_appearances now: ${finalAppearances.rows[0].count}`);

	const finalShows = await db.execute('SELECT COUNT(DISTINCT show_id) as count FROM show_appearances');
	console.log(`Shows with lineup data: ${finalShows.rows[0].count}`);

	// Show some samples
	console.log('\n=== Sample Shows With Lineups ===');
	const samples = await db.execute(`
		SELECT s.date, s.title, COUNT(sa.id) as performers
		FROM shows s
		JOIN show_appearances sa ON s.id = sa.show_id
		GROUP BY s.id
		ORDER BY s.date DESC
		LIMIT 10
	`);
	samples.rows.forEach(r => console.log(`  ${r.date} - ${r.title} (${r.performers} performers)`));
}

main().catch(console.error);
