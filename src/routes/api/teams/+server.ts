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

		// Get all teams with member counts
		const result = await db.execute(`
			SELECT t.*,
				(SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id AND tm.is_former = 0) as member_count,
				(SELECT COUNT(DISTINCT sa.show_id) FROM show_appearances sa WHERE sa.team_id = t.id) as show_count
			FROM teams t
			ORDER BY t.type, t.name
		`);

		return json({ teams: result.rows });
	} catch (error) {
		console.error('Error fetching teams:', error);
		return json({ error: 'Failed to fetch teams' }, { status: 500 });
	}
};
