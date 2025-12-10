import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllTeams, getTeamsByType, searchTeams } from '$lib/db';
import { db } from '$lib/db/client';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	const type = url.searchParams.get('type') as 'house' | 'indie' | 'other' | null;

	try {
		if (query) {
			const teams = await searchTeams(query);
			return json({ teams });
		}

		if (type) {
			const teams = await getTeamsByType(type);
			return json({ teams });
		}

		const today = new Date().toISOString().split('T')[0];

		// Get all teams with member counts and next upcoming show
		// Sort by: type, then teams with upcoming shows first (by date), then alphabetically
		const result = await db.execute(`
			SELECT t.*,
				(SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND tm.is_former = 0) as member_count,
				(SELECT COUNT(DISTINCT sa.show_id) FROM show_appearances sa WHERE sa.team_id = t.id) as show_count,
				(SELECT s.date FROM shows s
				 JOIN show_appearances sa ON s.id = sa.show_id
				 WHERE sa.team_id = t.id AND s.date >= '${today}'
				 ORDER BY s.date ASC LIMIT 1) as next_show_date,
				(SELECT s.slug FROM shows s
				 JOIN show_appearances sa ON s.id = sa.show_id
				 WHERE sa.team_id = t.id AND s.date >= '${today}'
				 ORDER BY s.date ASC LIMIT 1) as next_show_slug
			FROM teams t
			ORDER BY t.type,
				CASE WHEN (SELECT s.date FROM shows s JOIN show_appearances sa ON s.id = sa.show_id WHERE sa.team_id = t.id AND s.date >= '${today}' ORDER BY s.date ASC LIMIT 1) IS NOT NULL THEN 0 ELSE 1 END,
				(SELECT s.date FROM shows s JOIN show_appearances sa ON s.id = sa.show_id WHERE sa.team_id = t.id AND s.date >= '${today}' ORDER BY s.date ASC LIMIT 1),
				t.name
		`);

		return json({ teams: result.rows });
	} catch (error) {
		console.error('Error fetching teams:', error);
		return json({ error: 'Failed to fetch teams' }, { status: 500 });
	}
};
