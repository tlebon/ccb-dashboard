import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllPerformers, searchPerformers, getTopPerformers } from '$lib/db';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q');
	const top = url.searchParams.get('top');

	try {
		if (query) {
			const performers = await searchPerformers(query);
			return json({ performers });
		}

		if (top) {
			const performers = await getTopPerformers(parseInt(top) || 10);
			return json({ performers });
		}

		const performers = await getAllPerformers();
		return json({ performers });
	} catch (error) {
		console.error('Error fetching performers:', error);
		return json({ error: 'Failed to fetch performers' }, { status: 500 });
	}
};
