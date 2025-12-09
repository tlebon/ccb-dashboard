import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShowWithLineup } from '$lib/db';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id);

	if (isNaN(id)) {
		throw error(400, 'Invalid show ID');
	}

	try {
		const show = await getShowWithLineup(id);

		if (!show) {
			throw error(404, 'Show not found');
		}

		return json(show);
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}
		console.error('Error fetching show lineup:', e);
		return json({ error: 'Failed to fetch show lineup' }, { status: 500 });
	}
};
