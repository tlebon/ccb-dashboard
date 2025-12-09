import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTeamWithMembers, getTeamShows } from '$lib/db';

export const GET: RequestHandler = async ({ params }) => {
	const { slug } = params;

	try {
		const team = await getTeamWithMembers(slug);

		if (!team) {
			throw error(404, 'Team not found');
		}

		const shows = await getTeamShows(team.id, 50);

		return json({
			team,
			shows
		});
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}
		console.error('Error fetching team:', e);
		return json({ error: 'Failed to fetch team' }, { status: 500 });
	}
};
