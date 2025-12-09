import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPerformerBySlug, getPerformerShows } from '$lib/db';

export const GET: RequestHandler = async ({ params, url }) => {
	const { slug } = params;
	const limit = parseInt(url.searchParams.get('limit') || '20');

	try {
		const performer = await getPerformerBySlug(slug);

		if (!performer) {
			throw error(404, 'Performer not found');
		}

		const [upcomingShows, pastShows] = await Promise.all([
			getPerformerShows(performer.id, limit, true),
			getPerformerShows(performer.id, limit, false)
		]);

		return json({
			performer: { id: performer.id, name: performer.name, slug: performer.slug },
			upcomingShows,
			pastShows
		});
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}
		console.error('Error fetching performer shows:', e);
		return json({ error: 'Failed to fetch performer shows' }, { status: 500 });
	}
};
