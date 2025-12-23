import { createClient } from '@libsql/client';

const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN
});

async function main() {
	// Check if slug column exists
	const tableInfo = await db.execute('PRAGMA table_info(shows)');
	const hasSlug = tableInfo.rows.some((row) => row.name === 'slug');

	if (!hasSlug) {
		console.log('Adding slug column to shows table...');
		await db.execute('ALTER TABLE shows ADD COLUMN slug TEXT');
		await db.execute('CREATE INDEX IF NOT EXISTS idx_shows_slug ON shows(slug)');
	} else {
		console.log('Slug column already exists');
	}

	// Generate slugs for existing shows without one
	const shows = await db.execute('SELECT id, title, date FROM shows WHERE slug IS NULL');
	console.log('Generating slugs for', shows.rows.length, 'shows');

	for (const show of shows.rows) {
		const titleSlug = String(show.title)
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '');
		const slug = `${show.date}-${titleSlug}`;
		await db.execute({ sql: 'UPDATE shows SET slug = ? WHERE id = ?', args: [slug, show.id] });
	}

	console.log('Done!');

	// Show some examples
	const examples = await db.execute(
		'SELECT slug, title, date FROM shows ORDER BY date DESC LIMIT 5'
	);
	console.log('\nExample slugs:');
	for (const row of examples.rows) {
		console.log(`  ${row.slug}`);
	}
}

main().catch(console.error);
