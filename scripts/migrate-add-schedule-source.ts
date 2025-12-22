/**
 * Migration: Add 'schedule' to allowed show sources
 *
 * This updates the CHECK constraint on shows.source to allow 'schedule' value
 * Run this manually against production database before deploying cron fix
 */
import { createClient } from '@libsql/client';

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
	throw new Error('Missing required environment variables: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
}

const db = createClient({
	url: process.env.TURSO_DATABASE_URL,
	authToken: process.env.TURSO_AUTH_TOKEN
});

async function migrate() {
	console.log('🔧 Migrating database schema...');
	console.log('Adding "schedule" to allowed show sources');

	try {
		// Create new table with updated constraint
		await db.execute(`
			CREATE TABLE shows_new (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				title TEXT NOT NULL,
				date TEXT NOT NULL,
				time TEXT,
				source TEXT CHECK(source IN ('ical', 'beeper', 'manual', 'schedule')) DEFAULT 'manual',
				ical_uid TEXT UNIQUE,
				created_at TEXT DEFAULT (datetime('now')),
				url TEXT,
				image_url TEXT,
				description TEXT,
				slug TEXT,
				original_image_url TEXT
			)
		`);
		console.log('✓ Created new table with updated constraint');

		// Copy all data
		await db.execute(`INSERT INTO shows_new SELECT * FROM shows`);
		console.log('✓ Copied all show data');

		// Drop old table
		await db.execute(`DROP TABLE shows`);
		console.log('✓ Dropped old table');

		// Rename new table
		await db.execute(`ALTER TABLE shows_new RENAME TO shows`);
		console.log('✓ Renamed table');

		console.log('✅ Migration complete!');
	} catch (error) {
		console.error('❌ Migration failed:', error);
		throw error;
	}
}

migrate().catch(console.error);
