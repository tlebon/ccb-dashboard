import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { generateShowSlug, getTitleSlug } from './shows';

describe('shows utility functions', () => {
	describe('generateShowSlug', () => {
		it('should generate slug from date and title', () => {
			const slug = generateShowSlug('2025-01-15', 'House Show');
			expect(slug).toBe('2025-01-15-house-show');
		});

		it('should handle special characters', () => {
			const slug = generateShowSlug('2025-01-15', 'Health Plan: A Deconstruction!');
			expect(slug).toBe('2025-01-15-health-plan-a-deconstruction');
		});

		it('should handle multiple spaces and symbols', () => {
			const slug = generateShowSlug('2025-01-15', 'Show   With    Spaces & Symbols!!');
			expect(slug).toBe('2025-01-15-show-with-spaces-symbols');
		});

		it('should lowercase everything', () => {
			const slug = generateShowSlug('2025-01-15', 'LOUD SHOW NAME');
			expect(slug).toBe('2025-01-15-loud-show-name');
		});

		it('should remove leading/trailing dashes', () => {
			const slug = generateShowSlug('2025-01-15', '!!!Show!!!');
			expect(slug).toBe('2025-01-15-show');
		});

		it('should handle titles with numbers', () => {
			const slug = generateShowSlug('2025-01-15', 'Show 123');
			expect(slug).toBe('2025-01-15-show-123');
		});

		it('should handle titles with apostrophes', () => {
			const slug = generateShowSlug('2025-01-15', "Brace! Brace! (Tim's Team)");
			expect(slug).toBe('2025-01-15-brace-brace-tim-s-team');
		});

		it('should handle empty title', () => {
			const slug = generateShowSlug('2025-01-15', '');
			expect(slug).toBe('2025-01-15-'); // Trailing dash from slug generation
		});

		it('should handle titles with only special characters', () => {
			const slug = generateShowSlug('2025-01-15', '!!!@@@###');
			expect(slug).toBe('2025-01-15-'); // Trailing dash from slug generation
		});

		it('should preserve hyphens between words', () => {
			const slug = generateShowSlug('2025-01-15', 'Multi-Word Title');
			expect(slug).toBe('2025-01-15-multi-word-title');
		});
	});

	describe('getTitleSlug', () => {
		it('should generate title slug without date', () => {
			const slug = getTitleSlug('House Show');
			expect(slug).toBe('house-show');
		});

		it('should match generateShowSlug title portion', () => {
			const title = 'Health Plan: Live';
			const titleSlug = getTitleSlug(title);
			const fullSlug = generateShowSlug('2025-01-15', title);
			expect(fullSlug).toBe(`2025-01-15-${titleSlug}`);
		});

		it('should handle special characters', () => {
			const slug = getTitleSlug('Health Plan: A Deconstruction!');
			expect(slug).toBe('health-plan-a-deconstruction');
		});

		it('should handle empty string', () => {
			const slug = getTitleSlug('');
			expect(slug).toBe('');
		});

		it('should be consistent with generateShowSlug', () => {
			const titles = [
				'House Show',
				'Health Plan: Live',
				'Show With Spaces',
				'LOUD TITLE',
				'Title & Symbols!!'
			];

			titles.forEach((title) => {
				const titleSlug = getTitleSlug(title);
				const fullSlug = generateShowSlug('2025-01-01', title);
				expect(fullSlug).toBe(`2025-01-01-${titleSlug}`);
			});
		});
	});
});

// Integration tests with in-memory database
describe('shows database operations', () => {
	let db: Client;

	beforeEach(async () => {
		// Create in-memory database
		db = createClient({
			url: 'file::memory:?cache=shared'
		});

		// Drop tables if they exist (in case of shared cache)
		await db.execute('DROP TABLE IF EXISTS show_appearances');
		await db.execute('DROP TABLE IF EXISTS performers');
		await db.execute('DROP TABLE IF EXISTS shows');

		// Create shows table
		await db.execute(`
			CREATE TABLE shows (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				title TEXT NOT NULL,
				slug TEXT UNIQUE NOT NULL,
				date TEXT NOT NULL,
				time TEXT,
				description TEXT,
				source TEXT NOT NULL,
				ical_uid TEXT,
				url TEXT,
				image_url TEXT,
				original_image_url TEXT,
				created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Create performers table
		await db.execute(`
			CREATE TABLE performers (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				slug TEXT UNIQUE NOT NULL,
				image_url TEXT
			)
		`);

		// Create show_appearances table
		await db.execute(`
			CREATE TABLE show_appearances (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				show_id INTEGER NOT NULL,
				performer_id INTEGER NOT NULL,
				role TEXT DEFAULT 'performer',
				team_id INTEGER,
				FOREIGN KEY (show_id) REFERENCES shows(id),
				FOREIGN KEY (performer_id) REFERENCES performers(id),
				UNIQUE(show_id, performer_id, role)
			)
		`);
	});

	afterEach(async () => {
		await db.close();
	});

	it('should insert a show', async () => {
		const result = await db.execute({
			sql: `INSERT INTO shows (title, slug, date, time, source) VALUES (?, ?, ?, ?, ?)`,
			args: ['House Show', '2025-01-15-house-show', '2025-01-15', '20:00', 'ical']
		});

		expect(result.lastInsertRowid).toBeDefined();
		expect(Number(result.lastInsertRowid)).toBeGreaterThan(0);
	});

	it('should enforce unique slugs', async () => {
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
			args: ['Show 1', 'test-slug', '2025-01-15', 'ical']
		});

		// Attempt to insert duplicate slug should fail
		await expect(
			db.execute({
				sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
				args: ['Show 2', 'test-slug', '2025-01-16', 'ical']
			})
		).rejects.toThrow();
	});

	it('should query shows by date', async () => {
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, time, source) VALUES (?, ?, ?, ?, ?)`,
			args: ['Show 1', '2025-01-15-show-1', '2025-01-15', '20:00', 'ical']
		});
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, time, source) VALUES (?, ?, ?, ?, ?)`,
			args: ['Show 2', '2025-01-15-show-2', '2025-01-15', '21:00', 'ical']
		});

		const result = await db.execute({
			sql: `SELECT * FROM shows WHERE date = ? ORDER BY time`,
			args: ['2025-01-15']
		});

		expect(result.rows).toHaveLength(2);
		expect(result.rows[0].time).toBe('20:00');
		expect(result.rows[1].time).toBe('21:00');
	});

	it('should query shows by date range', async () => {
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, time, source) VALUES (?, ?, ?, ?, ?)`,
			args: ['Show 1', '2025-01-10-show-1', '2025-01-10', '20:00', 'ical']
		});
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, time, source) VALUES (?, ?, ?, ?, ?)`,
			args: ['Show 2', '2025-01-15-show-2', '2025-01-15', '20:00', 'ical']
		});
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, time, source) VALUES (?, ?, ?, ?, ?)`,
			args: ['Show 3', '2025-01-20-show-3', '2025-01-20', '20:00', 'ical']
		});

		const result = await db.execute({
			sql: `SELECT * FROM shows WHERE date >= ? AND date <= ? ORDER BY date`,
			args: ['2025-01-12', '2025-01-18']
		});

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].title).toBe('Show 2');
	});

	it('should query shows by slug', async () => {
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
			args: ['Test Show', 'test-slug', '2025-01-15', 'ical']
		});

		const result = await db.execute({
			sql: `SELECT * FROM shows WHERE slug = ?`,
			args: ['test-slug']
		});

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].title).toBe('Test Show');
	});

	it('should query shows by title (LIKE)', async () => {
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
			args: ['Health Plan: Live', '2025-01-15-health-plan-live', '2025-01-15', 'ical']
		});
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
			args: [
				'Health Plan: A Deconstruction',
				'2025-02-15-health-plan-a-deconstruction',
				'2025-02-15',
				'ical'
			]
		});

		const result = await db.execute({
			sql: `SELECT * FROM shows WHERE title LIKE ?`,
			args: ['%Health Plan%']
		});

		expect(result.rows).toHaveLength(2);
	});

	it('should support different sources', async () => {
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
			args: ['Show 1', '2025-01-15-show-1', '2025-01-15', 'ical']
		});
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
			args: ['Show 2', '2025-01-16-show-2', '2025-01-16', 'manual']
		});
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
			args: ['Show 3', '2025-01-17-show-3', '2025-01-17', 'schedule']
		});

		const icalResult = await db.execute({
			sql: `SELECT * FROM shows WHERE source = ?`,
			args: ['ical']
		});
		expect(icalResult.rows).toHaveLength(1);

		const manualResult = await db.execute({
			sql: `SELECT * FROM shows WHERE source = ?`,
			args: ['manual']
		});
		expect(manualResult.rows).toHaveLength(1);

		const scheduleResult = await db.execute({
			sql: `SELECT * FROM shows WHERE source = ?`,
			args: ['schedule']
		});
		expect(scheduleResult.rows).toHaveLength(1);
	});

	it('should handle optional fields (time, description, url, image_url)', async () => {
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
			args: ['Minimal Show', '2025-01-15-minimal-show', '2025-01-15', 'ical']
		});

		const result = await db.execute({
			sql: `SELECT * FROM shows WHERE slug = ?`,
			args: ['2025-01-15-minimal-show']
		});

		expect(result.rows[0].time).toBeNull();
		expect(result.rows[0].description).toBeNull();
		expect(result.rows[0].url).toBeNull();
		expect(result.rows[0].image_url).toBeNull();
	});

	it('should handle ical_uid for upserts', async () => {
		const icalUid = 'test-ical-uid-123';

		// Insert with ical_uid
		await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source, ical_uid) VALUES (?, ?, ?, ?, ?)`,
			args: ['Original Title', '2025-01-15-original-title', '2025-01-15', 'ical', icalUid]
		});

		// Query by ical_uid
		const result = await db.execute({
			sql: `SELECT * FROM shows WHERE ical_uid = ?`,
			args: [icalUid]
		});

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].title).toBe('Original Title');
	});

	it('should insert show_appearances with performer relationship', async () => {
		// Insert a show
		const showResult = await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
			args: ['Test Show', '2025-01-15-test-show', '2025-01-15', 'ical']
		});
		const showId = Number(showResult.lastInsertRowid);

		// Insert a performer
		const performerResult = await db.execute({
			sql: `INSERT INTO performers (name, slug) VALUES (?, ?)`,
			args: ['John Doe', 'john-doe']
		});
		const performerId = Number(performerResult.lastInsertRowid);

		// Insert show_appearance
		await db.execute({
			sql: `INSERT INTO show_appearances (show_id, performer_id, role) VALUES (?, ?, ?)`,
			args: [showId, performerId, 'performer']
		});

		// Query show_appearances
		const result = await db.execute({
			sql: `
				SELECT sa.*, p.name as performer_name
				FROM show_appearances sa
				JOIN performers p ON sa.performer_id = p.id
				WHERE sa.show_id = ?
			`,
			args: [showId]
		});

		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].performer_name).toBe('John Doe');
		expect(result.rows[0].role).toBe('performer');
	});

	it('should enforce unique constraint on show_appearances (show_id, performer_id, role)', async () => {
		const showResult = await db.execute({
			sql: `INSERT INTO shows (title, slug, date, source) VALUES (?, ?, ?, ?)`,
			args: ['Test Show', '2025-01-15-test-show', '2025-01-15', 'ical']
		});
		const showId = Number(showResult.lastInsertRowid);

		const performerResult = await db.execute({
			sql: `INSERT INTO performers (name, slug) VALUES (?, ?)`,
			args: ['John Doe', 'john-doe']
		});
		const performerId = Number(performerResult.lastInsertRowid);

		// Insert first appearance
		await db.execute({
			sql: `INSERT INTO show_appearances (show_id, performer_id, role) VALUES (?, ?, ?)`,
			args: [showId, performerId, 'performer']
		});

		// Attempt to insert duplicate should fail
		await expect(
			db.execute({
				sql: `INSERT INTO show_appearances (show_id, performer_id, role) VALUES (?, ?, ?)`,
				args: [showId, performerId, 'performer']
			})
		).rejects.toThrow();
	});
});
