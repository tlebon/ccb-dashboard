import { createClient } from '@libsql/client';

const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
	// Get all teams with their members
	const teams = await db.execute(`
		SELECT t.id, t.name, t.slug
		FROM teams t
		ORDER BY LENGTH(t.name) DESC
	`);

	console.log(`Found ${teams.rows.length} teams`);

	let linkedShows = 0;
	let linkedAppearances = 0;

	for (const team of teams.rows) {
		const teamName = team.name as string;
		const teamId = team.id as number;

		// Find shows with this team name in the title
		const shows = await db.execute({
			sql: `SELECT id, title, date FROM shows WHERE LOWER(title) LIKE ? AND id NOT IN (SELECT DISTINCT show_id FROM show_appearances WHERE team_id = ?)`,
			args: [`%${teamName.toLowerCase()}%`, teamId]
		});

		if (shows.rows.length === 0) continue;

		console.log(`\n${teamName}: ${shows.rows.length} shows to link`);

		// Get team members
		const members = await db.execute({
			sql: 'SELECT performer_id FROM team_members WHERE team_id = ? AND is_former = 0',
			args: [teamId]
		});

		if (members.rows.length === 0) {
			console.log(`  No current members for ${teamName}`);
			continue;
		}

		for (const show of shows.rows) {
			console.log(`  Linking: ${show.date} - ${show.title}`);

			for (const member of members.rows) {
				await db.execute({
					sql: 'INSERT INTO show_appearances (show_id, performer_id, role, team_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
					args: [show.id, member.performer_id, 'performer', teamId]
				});
				linkedAppearances++;
			}
			linkedShows++;
		}
	}

	console.log(`\n=== Results ===`);
	console.log(`Shows linked: ${linkedShows}`);
	console.log(`Appearances added: ${linkedAppearances}`);

	// Verify
	const total = await db.execute('SELECT COUNT(*) as count FROM show_appearances');
	console.log(`Total show_appearances: ${total.rows[0].count}`);

	const showsWithLineup = await db.execute(
		'SELECT COUNT(DISTINCT show_id) as count FROM show_appearances'
	);
	console.log(`Shows with lineup: ${showsWithLineup.rows[0].count}`);
}

main().catch(console.error);
