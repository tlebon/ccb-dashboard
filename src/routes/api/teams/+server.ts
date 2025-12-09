import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllTeams, getTeamsByType, searchTeams } from '$lib/db';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	const type = url.searchParams.get('type') as 'house' | 'indie' | 'other' | null;

	try {
		if (query) {
			const teams = await searchTeams(query);
			return json({ teams });
		}

		if (type && ['house', 'indie', 'other'].includes(type)) {
			const teams = await getTeamsByType(type);
			return json({ teams });
		}

		const teams = await getAllTeams();
		return json({ teams });
	} catch (error) {
		console.error('Error fetching teams:', error);
		return json({ error: 'Failed to fetch teams' }, { status: 500 });
	}
};
