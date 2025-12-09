import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getTeamWithMembers, getTeamShows, db } from '$lib/db';
import { isHouseTeam, getHouseTeamBySlug, getFridayOfMonth } from '$lib/utils/houseShowTeams';

export const GET: RequestHandler = async ({ params }) => {
	const { slug } = params;

	try {
		const team = await getTeamWithMembers(slug);

		if (!team) {
			throw error(404, 'Team not found');
		}

		const shows = await getTeamShows(team.id, 50);

		// For house teams, get upcoming House Shows from the database
		// and filter to ones where this team performs
		let upcomingHouseShows: { date: string; title: string }[] = [];

		if (isHouseTeam(slug)) {
			const houseTeam = getHouseTeamBySlug(slug);
			if (houseTeam) {
				const today = new Date().toISOString().split('T')[0];
				const result = await db.execute({
					sql: `SELECT date, title FROM shows
					      WHERE title = 'House Show' AND date >= ?
					      ORDER BY date LIMIT 20`,
					args: [today]
				});

				// Filter to dates where this team performs based on Friday-of-month
				upcomingHouseShows = (result.rows as unknown as { date: string; title: string }[])
					.filter(show => {
						const fridayOfMonth = getFridayOfMonth(new Date(show.date));
						return houseTeam.weeks.includes(fridayOfMonth);
					})
					.slice(0, 5);
			}
		}

		return json({
			team,
			shows,
			upcomingHouseShows
		});
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) {
			throw e;
		}
		console.error('Error fetching team:', e);
		return json({ error: 'Failed to fetch team' }, { status: 500 });
	}
};
