import { db } from './client';
import type { Team, Performer } from './types';

export async function getAllTeams(): Promise<Team[]> {
	const result = await db.execute('SELECT * FROM teams ORDER BY name');
	return result.rows as unknown as Team[];
}

export async function getTeamBySlug(slug: string): Promise<Team | null> {
	const result = await db.execute({
		sql: 'SELECT * FROM teams WHERE slug = ?',
		args: [slug]
	});
	return (result.rows[0] as unknown as Team) || null;
}

export async function getTeamById(id: number): Promise<Team | null> {
	const result = await db.execute({
		sql: 'SELECT * FROM teams WHERE id = ?',
		args: [id]
	});
	return (result.rows[0] as unknown as Team) || null;
}

export async function getTeamsByType(type: 'house' | 'indie' | 'other'): Promise<Team[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM teams WHERE type = ? ORDER BY name',
		args: [type]
	});
	return result.rows as unknown as Team[];
}

export async function getTeamMembers(teamId: number): Promise<(Performer & { is_former: boolean })[]> {
	const result = await db.execute({
		sql: `
			SELECT p.*, tm.is_former
			FROM performers p
			JOIN team_members tm ON p.id = tm.performer_id
			WHERE tm.team_id = ?
			ORDER BY tm.is_former, p.name
		`,
		args: [teamId]
	});
	return result.rows as unknown as (Performer & { is_former: boolean })[];
}

export async function getTeamWithMembers(slug: string) {
	const team = await getTeamBySlug(slug);
	if (!team) return null;

	const members = await getTeamMembers(team.id);

	let coach = null;
	if (team.coach_id) {
		const coachResult = await db.execute({
			sql: 'SELECT * FROM performers WHERE id = ?',
			args: [team.coach_id]
		});
		coach = coachResult.rows[0] || null;
	}

	return { ...team, members, coach };
}

export async function getTeamShows(teamId: number, limit = 20) {
	const result = await db.execute({
		sql: `
			SELECT DISTINCT s.id, s.title, s.slug, s.date, s.time
			FROM shows s
			JOIN show_appearances sa ON s.id = sa.show_id
			WHERE sa.team_id = ?
			ORDER BY s.date DESC
			LIMIT ?
		`,
		args: [teamId, limit]
	});
	return result.rows;
}

export async function searchTeams(query: string): Promise<Team[]> {
	const result = await db.execute({
		sql: 'SELECT * FROM teams WHERE name LIKE ? ORDER BY name LIMIT 20',
		args: [`%${query}%`]
	});
	return result.rows as unknown as Team[];
}
