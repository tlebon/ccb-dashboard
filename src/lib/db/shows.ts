import { db } from './client';
import type { Show } from './types';

export async function getShowById(id: number): Promise<Show | null> {
	const result = await db.execute({
		sql: 'SELECT * FROM shows WHERE id = ?',
		args: [id]
	});
	return (result.rows[0] as unknown as Show) || null;
}

export async function getShowsByDate(date: string): Promise<Show[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM shows WHERE date = ? ORDER BY time',
		args: [date]
	});
	return result.rows as unknown as Show[];
}

export async function getShowsInRange(startDate: string, endDate: string): Promise<Show[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM shows WHERE date >= ? AND date <= ? ORDER BY date, time',
		args: [startDate, endDate]
	});
	return result.rows as unknown as Show[];
}

export async function getRecentShows(limit = 20): Promise<Show[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM shows WHERE date <= date("now") ORDER BY date DESC, time DESC LIMIT ?',
		args: [limit]
	});
	return result.rows as unknown as Show[];
}

export async function getUpcomingShows(limit = 20): Promise<Show[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM shows WHERE date >= date("now") ORDER BY date, time LIMIT ?',
		args: [limit]
	});
	return result.rows as unknown as Show[];
}

export async function getShowWithLineup(showId: number) {
	const show = await getShowById(showId);
	if (!show) return null;

	const lineup = await db.execute({
		sql: `
			SELECT sa.*, p.name as performer_name, p.slug as performer_slug, t.name as team_name, t.slug as team_slug
			FROM show_appearances sa
			JOIN performers p ON sa.performer_id = p.id
			LEFT JOIN teams t ON sa.team_id = t.id
			WHERE sa.show_id = ?
			ORDER BY sa.role, p.name
		`,
		args: [showId]
	});

	return { ...show, lineup: lineup.rows };
}

export async function getShowsByPerformer(performerId: number, limit = 50): Promise<Show[]> {
	const result = await db.execute({
		sql: `
			SELECT DISTINCT s.*
			FROM shows s
			JOIN show_appearances sa ON s.id = sa.show_id
			WHERE sa.performer_id = ?
			ORDER BY s.date DESC
			LIMIT ?
		`,
		args: [performerId, limit]
	});
	return result.rows as unknown as Show[];
}

export async function getShowsByTitle(title: string): Promise<Show[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM shows WHERE title LIKE ? ORDER BY date DESC',
		args: [`%${title}%`]
	});
	return result.rows as unknown as Show[];
}

export async function upsertShow(show: {
	title: string;
	date: string;
	time?: string;
	description?: string;
	source: 'ical' | 'beeper' | 'manual';
	ical_uid?: string;
	url?: string;
	image_url?: string;
}): Promise<number> {
	if (show.ical_uid) {
		// Try to update existing by ical_uid
		const existing = await db.execute({
			sql: 'SELECT id FROM shows WHERE ical_uid = ?',
			args: [show.ical_uid]
		});
		if (existing.rows.length > 0) {
			await db.execute({
				sql: 'UPDATE shows SET title = ?, date = ?, time = ?, description = ?, url = ?, image_url = ? WHERE ical_uid = ?',
				args: [show.title, show.date, show.time || null, show.description || null, show.url || null, show.image_url || null, show.ical_uid]
			});
			return existing.rows[0].id as number;
		}
	}

	const result = await db.execute({
		sql: 'INSERT INTO shows (title, date, time, description, source, ical_uid, url, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
		args: [show.title, show.date, show.time || null, show.description || null, show.source, show.ical_uid || null, show.url || null, show.image_url || null]
	});
	return Number(result.lastInsertRowid);
}

export async function addShowAppearance(
	showId: number,
	performerId: number,
	role: 'performer' | 'host' | 'guest' | 'coach' = 'performer',
	teamId?: number
) {
	await db.execute({
		sql: 'INSERT INTO show_appearances (show_id, performer_id, role, team_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
		args: [showId, performerId, role, teamId || null]
	});
}

export async function getShowStats() {
	const result = await db.execute(`
		SELECT
			COUNT(*) as total_shows,
			COUNT(DISTINCT date) as unique_dates,
			MIN(date) as earliest,
			MAX(date) as latest,
			(SELECT COUNT(*) FROM show_appearances) as total_appearances
		FROM shows
	`);
	return result.rows[0];
}
