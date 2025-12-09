import { createClient } from '@libsql/client';

const db = createClient({
	url: process.env.TURSO_DATABASE_URL || '',
	authToken: process.env.TURSO_AUTH_TOKEN || ''
});

console.log('Testing database connection...\n');

// Test 1: Basic query
const counts = await db.execute(`
	SELECT
		(SELECT COUNT(*) FROM performers) as performers,
		(SELECT COUNT(*) FROM teams) as teams,
		(SELECT COUNT(*) FROM shows) as shows
`);
console.log('Database counts:', counts.rows[0]);

// Test 2: Sample performer
const performer = await db.execute(`
	SELECT p.name, COUNT(tm.team_id) as teams
	FROM performers p
	LEFT JOIN team_members tm ON p.id = tm.performer_id
	GROUP BY p.id
	ORDER BY teams DESC
	LIMIT 5
`);
console.log('\nTop performers by team count:');
performer.rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} (${r.teams} teams)`));

// Test 3: Sample team with members
const team = await db.execute(`
	SELECT t.name as team, p.name as member
	FROM teams t
	JOIN team_members tm ON t.id = tm.team_id
	JOIN performers p ON tm.performer_id = p.id
	WHERE t.name = 'Health Plan'
`);
console.log('\nHealth Plan members:');
team.rows.forEach(r => console.log(`  - ${r.member}`));

// Test 4: Recent shows
const shows = await db.execute(`
	SELECT title, date FROM shows
	ORDER BY date DESC
	LIMIT 5
`);
console.log('\nRecent shows:');
shows.rows.forEach(r => console.log(`  ${r.date}: ${r.title}`));

console.log('\n✓ Connection successful!');
