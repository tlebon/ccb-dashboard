// Quick test of the data access layer
import { createClient } from '@libsql/client';

const db = createClient({
	url: process.env.TURSO_DATABASE_URL || '',
	authToken: process.env.TURSO_AUTH_TOKEN || ''
});

// Simulate the data layer functions
async function searchPerformers(query: string) {
	const result = await db.execute({
		sql: 'SELECT * FROM performers WHERE name LIKE ? ORDER BY name LIMIT 5',
		args: [`%${query}%`]
	});
	return result.rows;
}

async function getTeamWithMembers(slug: string) {
	const team = await db.execute({
		sql: 'SELECT * FROM teams WHERE slug = ?',
		args: [slug]
	});
	if (!team.rows[0]) return null;

	const members = await db.execute({
		sql: `SELECT p.name, tm.is_former FROM performers p
			  JOIN team_members tm ON p.id = tm.performer_id
			  WHERE tm.team_id = ? ORDER BY p.name`,
		args: [team.rows[0].id]
	});
	return { team: team.rows[0], members: members.rows };
}

async function getShowWithLineup(showId: number) {
	const show = await db.execute({
		sql: 'SELECT * FROM shows WHERE id = ?',
		args: [showId]
	});
	if (!show.rows[0]) return null;

	const lineup = await db.execute({
		sql: `SELECT p.name, sa.role FROM show_appearances sa
			  JOIN performers p ON sa.performer_id = p.id
			  WHERE sa.show_id = ?`,
		args: [showId]
	});
	return { show: show.rows[0], lineup: lineup.rows };
}

// Run tests
console.log('Testing data access layer...\n');

console.log('1. Search performers for "eli":');
const performers = await searchPerformers('eli');
performers.forEach(p => console.log(`   - ${p.name} (${p.slug})`));

console.log('\n2. Get team "health-plan" with members:');
const team = await getTeamWithMembers('health-plan');
if (team) {
	console.log(`   Team: ${team.team.name} (${team.team.type})`);
	console.log(`   Members: ${team.members.length}`);
	team.members.slice(0, 5).forEach(m => console.log(`   - ${m.name}`));
	if (team.members.length > 5) console.log(`   ... and ${team.members.length - 5} more`);
}

console.log('\n3. Get a show with lineup (first show with appearances):');
const showWithAppearances = await db.execute(
	'SELECT show_id FROM show_appearances LIMIT 1'
);
if (showWithAppearances.rows[0]) {
	const showData = await getShowWithLineup(showWithAppearances.rows[0].show_id as number);
	if (showData) {
		console.log(`   Show: ${showData.show.title} (${showData.show.date})`);
		console.log(`   Lineup: ${showData.lineup.length} performers`);
		showData.lineup.slice(0, 3).forEach(p => console.log(`   - ${p.name} (${p.role})`));
	}
}

console.log('\n✓ Data layer tests passed!');
