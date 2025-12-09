import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTeamWithMembers, getTeamBySlug, getTeamShows } from '$lib/db';

export const GET: RequestHandler = async ({ params, url }) => {
	const { slug } = params;
	const includeShows = url.searchParams.get('shows') === 'true';

	try {
		const team = await getTeamWithMembers(slug);

		if (!team) {
			throw error(404, 'Team not found');
		}

		let shows = null;
		if (includeShows) {
			shows = await getTeamShows(team.id);
		}

		return json({
			...team,
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
