import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShowWithLineupBySlug, getShowsByTitleSlug } from '$lib/db';

// Pattern to detect date-prefixed slugs (YYYY-MM-DD-...)
const DATE_SLUG_PATTERN = /^\d{4}-\d{2}-\d{2}-.+$/;

export const GET: RequestHandler = async ({ params }) => {
	const { slug } = params;

	try {
		// Check if this is a specific show (date-prefixed) or a series
		if (DATE_SLUG_PATTERN.test(slug)) {
			// Specific show - get with lineup
			const show = await getShowWithLineupBySlug(slug);
			if (!show) {
				throw error(404, 'Show not found');
			}

			// Extract series slug (remove date prefix) and get series count
			const seriesSlug = slug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
			const seriesShows = await getShowsByTitleSlug(seriesSlug);
			const seriesCount = seriesShows.length;

			return json({
				type: 'show',
				data: show,
				series: seriesCount > 1 ? { slug: seriesSlug, count: seriesCount } : null
			});
		} else {
			// Series view - get all shows with this title
			const shows = await getShowsByTitleSlug(slug);
			if (shows.length === 0) {
				throw error(404, 'No shows found for this series');
			}

			// Get the title from the first show (they should all have the same title)
			const title = shows[0].title;

			return json({
				type: 'series',
				data: {
					title,
					slug,
					shows,
					count: shows.length
				}
			});
		}
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}
		console.error('Error fetching show:', e);
		return json({ error: 'Failed to fetch show' }, { status: 500 });
	}
};
