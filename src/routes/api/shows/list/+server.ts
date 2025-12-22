import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';

export const GET: RequestHandler = async ({ url }) => {
	const limit = parseInt(url.searchParams.get('limit') || '50');
	const offset = parseInt(url.searchParams.get('offset') || '0');
	const filter = url.searchParams.get('filter') || 'all'; // 'upcoming', 'past', 'all'

	try {
		const today = new Date().toISOString().split('T')[0];

		let whereClause = '';
		if (filter === 'upcoming') {
			whereClause = `WHERE date >= '${today}'`;
		} else if (filter === 'past') {
			whereClause = `WHERE date < '${today}'`;
		}

		const orderBy =
			filter === 'past' ? 'ORDER BY date DESC, time DESC' : 'ORDER BY date ASC, time ASC';

		const shows = await db.execute(`
			SELECT id, title, slug, date, time, description, source, url, image_url
			FROM shows
			${whereClause}
			${orderBy}
			LIMIT ${limit} OFFSET ${offset}
		`);

		// Get counts
		const upcomingCount = await db.execute(`
			SELECT COUNT(*) as count FROM shows WHERE date >= '${today}'
		`);
		const pastCount = await db.execute(`
			SELECT COUNT(*) as count FROM shows WHERE date < '${today}'
		`);

		return json({
			shows: shows.rows,
			counts: {
				upcoming: upcomingCount.rows[0].count,
				past: pastCount.rows[0].count
			}
		});
	} catch (e) {
		console.error('Error fetching shows:', e);
		return json({ error: 'Failed to fetch shows' }, { status: 500 });
	}
};
