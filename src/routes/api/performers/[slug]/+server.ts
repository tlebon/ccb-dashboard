import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPerformerWithStats, getPerformerBySlug, getPerformerTeams } from '$lib/db';

export const GET: RequestHandler = async ({ params }) => {
	const { slug } = params;

	try {
		const performer = await getPerformerWithStats(slug);

		if (!performer) {
			throw error(404, 'Performer not found');
		}

		const teams = await getPerformerTeams(performer.id);

		return json({
			performer,
			teams
		});
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}
		console.error('Error fetching performer:', e);
		return json({ error: 'Failed to fetch performer' }, { status: 500 });
	}
};
