/**
 * Populate show_appearances for House Shows based on team rotation
 *
 * This script links house team members to their House Show performances
 * based on the Friday-of-month rotation schedule.
 */

import { createClient } from '@libsql/client';

const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN
});

// House Show rotation - which Friday of month each team performs
const TEAM_ROTATION: Record<string, number[]> = {
	'brace-brace': [2, 4],
	handshake: [1, 4],
	capiche: [2, 3],
	thunderclap: [1, 3]
};

function getFridayOfMonth(date: Date): number {
	const dayOfMonth = date.getDate();
	return Math.ceil(dayOfMonth / 7);
}

async function main() {
	console.log('Populating House Show appearances...\n');

	// Get all House Shows
	const houseShows = await db.execute(`
    SELECT id, date, title FROM shows
    WHERE title = 'House Show'
    ORDER BY date
  `);
	console.log(`Found ${houseShows.rows.length} House Shows\n`);

	// Get house teams from database
	const teams = await db.execute(`
    SELECT id, name, slug FROM teams WHERE type = 'house'
  `);
	console.log('House teams:', teams.rows.map((t) => t.name).join(', '), '\n');

	// Build team ID lookup
	const teamsBySlug: Record<string, { id: number; name: string }> = {};
	for (const team of teams.rows) {
		teamsBySlug[String(team.slug)] = { id: Number(team.id), name: String(team.name) };
	}

	// Get current team members
	const members = await db.execute(`
    SELECT tm.team_id, tm.performer_id, p.name, t.slug as team_slug
    FROM team_members tm
    JOIN performers p ON tm.performer_id = p.id
    JOIN teams t ON tm.team_id = t.id
    WHERE t.type = 'house' AND tm.is_former = 0
  `);
	console.log(`Found ${members.rows.length} current house team members\n`);

	// Group members by team slug
	const membersByTeam: Record<string, { performerId: number; name: string }[]> = {};
	for (const m of members.rows) {
		const slug = String(m.team_slug);
		if (!membersByTeam[slug]) membersByTeam[slug] = [];
		membersByTeam[slug].push({ performerId: Number(m.performer_id), name: String(m.name) });
	}

	let totalAdded = 0;
	let skipped = 0;

	for (const show of houseShows.rows) {
		const showId = Number(show.id);
		const showDate = new Date(String(show.date));
		const fridayOfMonth = getFridayOfMonth(showDate);

		// Find which teams performed this House Show
		for (const [teamSlug, weeks] of Object.entries(TEAM_ROTATION)) {
			if (!weeks.includes(fridayOfMonth)) continue;

			const team = teamsBySlug[teamSlug];
			if (!team) {
				console.log(`Warning: Team ${teamSlug} not found in database`);
				continue;
			}

			const teamMembers = membersByTeam[teamSlug] || [];

			for (const member of teamMembers) {
				// Check if appearance already exists
				const existing = await db.execute({
					sql: `SELECT id FROM show_appearances
                WHERE show_id = ? AND performer_id = ? AND team_id = ?`,
					args: [showId, member.performerId, team.id]
				});

				if (existing.rows.length > 0) {
					skipped++;
					continue;
				}

				// Insert appearance
				await db.execute({
					sql: `INSERT INTO show_appearances (show_id, performer_id, team_id, role)
                VALUES (?, ?, ?, 'performer')`,
					args: [showId, member.performerId, team.id]
				});
				totalAdded++;
			}
		}
	}

	console.log(`\nDone!`);
	console.log(`  Added: ${totalAdded} appearances`);
	console.log(`  Skipped (already exist): ${skipped}`);

	// Verify results
	console.log('\n=== Verification ===');
	const verification = await db.execute(`
    SELECT p.name, t.name as team_name, COUNT(*) as house_show_count
    FROM show_appearances sa
    JOIN performers p ON sa.performer_id = p.id
    JOIN teams t ON sa.team_id = t.id
    JOIN shows s ON sa.show_id = s.id
    WHERE s.title = 'House Show' AND t.type = 'house'
    GROUP BY p.id
    ORDER BY house_show_count DESC
    LIMIT 20
  `);

	console.log('\nTop performers by House Show appearances:');
	verification.rows.forEach((r) => {
		console.log(`  ${r.name} (${r.team_name}): ${r.house_show_count} shows`);
	});
}

main().catch(console.error);
