/**
 * Migration: Add 'schedule' to allowed show sources
 *
 * This updates the CHECK constraint on shows.source to allow 'schedule' value
 * Run this manually against production database before deploying cron fix
 */
import { createClient } from '@libsql/client';

const db = createClient({
	url: process.env.TURSO_DATABASE_URL || 'libsql://ccb-dashboard-tlebon.aws-eu-west-1.turso.io',
	authToken: process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NjUyMzM5MTUsImlkIjoiOWU3ZjNjYmUtMzQxNi00NTBmLTg1Y2MtMTBkMjQ3ODY3MDFhIiwicmlkIjoiYWM5OWQzYzUtY2MwZi00MzQwLWJmZmMtOTQwM2UxNzIwYzM3In0.-eWYaPVjA_mjUKz51WI8PhLTH7hGhNHq8HqNqGvY9BqKYHDPzOqr-yTYSMn2nr6zy1-i2ZIyH8WtG6sPQfR0CA'
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
