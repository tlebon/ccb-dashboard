import { db } from './client';
import type { Performer, PerformerWithStats } from './types';

export async function getAllPerformers(): Promise<Performer[]> {
	const result = await db.execute('SELECT * FROM performers ORDER BY name');
	return result.rows as unknown as Performer[];
}

export async function getPerformerBySlug(slug: string): Promise<Performer | null> {
	const result = await db.execute({
		sql: 'SELECT * FROM performers WHERE slug = ?',
		args: [slug]
	});
	return (result.rows[0] as unknown as Performer) || null;
}

export async function getPerformerById(id: number): Promise<Performer | null> {
	const result = await db.execute({
		sql: 'SELECT * FROM performers WHERE id = ?',
		args: [id]
	});
	return (result.rows[0] as unknown as Performer) || null;
}

export async function searchPerformers(query: string): Promise<Performer[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM performers WHERE name LIKE ? ORDER BY name LIMIT 20',
		args: [`%${query}%`]
	});
	return result.rows as unknown as Performer[];
}

export async function getPerformerWithStats(slug: string): Promise<PerformerWithStats | null> {
	const result = await db.execute({
		sql: `
			SELECT
				p.*,
				(SELECT COUNT(DISTINCT team_id) FROM team_members WHERE performer_id = p.id) as team_count,
				(SELECT COUNT(DISTINCT show_id) FROM show_appearances WHERE performer_id = p.id) as show_count
			FROM performers p
			WHERE p.slug = ?
		`,
		args: [slug]
	});
	return (result.rows[0] as unknown as PerformerWithStats) || null;
}

export async function getPerformerTeams(performerId: number) {
	const result = await db.execute({
		sql: `
			SELECT t.*, tm.is_former
			FROM teams t
			JOIN team_members tm ON t.id = tm.team_id
			WHERE tm.performer_id = ?
			ORDER BY tm.is_former, t.name
		`,
		args: [performerId]
	});
	return result.rows;
}

export async function getPerformerShows(performerId: number, limit = 20) {
	const result = await db.execute({
		sql: `
			SELECT s.*, sa.role, t.name as team_name
			FROM shows s
			JOIN show_appearances sa ON s.id = sa.show_id
			LEFT JOIN teams t ON sa.team_id = t.id
			WHERE sa.performer_id = ?
			ORDER BY s.date DESC
			LIMIT ?
		`,
		args: [performerId, limit]
	});
	return result.rows;
}

export async function getTopPerformers(limit = 10) {
	const result = await db.execute({
		sql: `
			SELECT
				p.*,
				COUNT(DISTINCT tm.team_id) as team_count,
				COUNT(DISTINCT sa.show_id) as show_count
			FROM performers p
			LEFT JOIN team_members tm ON p.id = tm.performer_id
			LEFT JOIN show_appearances sa ON p.id = sa.performer_id
			GROUP BY p.id
			ORDER BY team_count DESC, show_count DESC
			LIMIT ?
		`,
		args: [limit]
	});
	return result.rows;
}
