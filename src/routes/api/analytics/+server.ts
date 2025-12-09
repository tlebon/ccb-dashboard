import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const yearParam = url.searchParams.get('year');
		const yearFilter = yearParam && yearParam !== 'all' ? yearParam : null;
		const yearCondition = yearFilter ? `strftime('%Y', date) = '${yearFilter}'` : '1=1';
		const yearConditionShows = yearFilter ? `WHERE strftime('%Y', date) = '${yearFilter}'` : '';

		// Get available years for the filter dropdown
		const availableYearsResult = await db.execute(`
			SELECT DISTINCT strftime('%Y', date) as year FROM shows ORDER BY year DESC
		`);
		const availableYears = availableYearsResult.rows.map(r => String(r.year));

		// Basic stats (filtered by year)
		const statsResult = await db.execute(`
			SELECT
				COUNT(*) as total_shows,
				COUNT(DISTINCT title) as unique_shows,
				MIN(date) as first_date,
				MAX(date) as last_date
			FROM shows
			${yearConditionShows}
		`);
		const stats = statsResult.rows[0];

		// Performer count (filtered by year if specified - performers who appeared that year)
		const performerCountQuery = yearFilter
			? `SELECT COUNT(DISTINCT sa.performer_id) as count FROM show_appearances sa JOIN shows s ON sa.show_id = s.id WHERE ${yearCondition}`
			: 'SELECT COUNT(*) as count FROM performers';
		const performerCount = await db.execute(performerCountQuery);

		// Team count
		const teamCount = await db.execute('SELECT COUNT(*) as count FROM teams');

		// Top shows by frequency (normalized title) - get all for pagination
		const topShowsResult = await db.execute(`
			SELECT
				CASE
					WHEN title LIKE '%:%' THEN SUBSTR(title, 1, INSTR(title, ':') - 1)
					WHEN title LIKE '% - %' THEN SUBSTR(title, 1, INSTR(title, ' - ') - 1)
					ELSE title
				END as normalized_title,
				COUNT(*) as count
			FROM shows
			${yearConditionShows}
			GROUP BY normalized_title
			ORDER BY count DESC
			LIMIT 100
		`);

		// Generate slug from title
		function generateSlug(title: string): string {
			return title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');
		}

		// Day of week distribution
		const dayDistResult = await db.execute(`
			SELECT
				CASE CAST(strftime('%w', date) AS INTEGER)
					WHEN 0 THEN 'Sunday'
					WHEN 1 THEN 'Monday'
					WHEN 2 THEN 'Tuesday'
					WHEN 3 THEN 'Wednesday'
					WHEN 4 THEN 'Thursday'
					WHEN 5 THEN 'Friday'
					WHEN 6 THEN 'Saturday'
				END as day_name,
				COUNT(*) as count
			FROM shows
			${yearConditionShows}
			GROUP BY day_name
			ORDER BY CAST(strftime('%w', date) AS INTEGER)
		`);

		// Monthly distribution (filtered to selected year if specified)
		const monthlyResult = await db.execute(`
			SELECT
				strftime('%Y-%m', date) as month,
				COUNT(*) as count
			FROM shows
			${yearConditionShows}
			GROUP BY month
			ORDER BY month
		`);

		// Top performers by show appearances (filtered by year)
		const topPerformersResult = await db.execute(`
			SELECT
				p.id,
				p.name,
				p.slug,
				COUNT(DISTINCT sa.show_id) as show_count,
				(
					SELECT GROUP_CONCAT(team_name, ', ')
					FROM (
						SELECT t2.name as team_name, COUNT(*) as team_shows
						FROM show_appearances sa2
						JOIN shows s2 ON sa2.show_id = s2.id
						JOIN teams t2 ON sa2.team_id = t2.id
						WHERE sa2.performer_id = p.id
						${yearFilter ? `AND strftime('%Y', s2.date) = '${yearFilter}'` : ''}
						GROUP BY t2.id
						ORDER BY team_shows DESC
					)
				) as teams
			FROM performers p
			JOIN show_appearances sa ON p.id = sa.performer_id
			JOIN shows s ON sa.show_id = s.id
			WHERE ${yearCondition}
			GROUP BY p.id
			ORDER BY show_count DESC
			LIMIT 30
		`);

		// Top teams by shows (filtered by year)
		const topTeamsResult = await db.execute(`
			SELECT
				t.id,
				t.name,
				t.slug,
				COUNT(DISTINCT sa.show_id) as show_count,
				(SELECT COUNT(*) FROM team_members WHERE team_id = t.id AND is_former = 0) as member_count
			FROM teams t
			JOIN team_members tm ON t.id = tm.team_id
			JOIN show_appearances sa ON tm.performer_id = sa.performer_id AND sa.team_id = t.id
			JOIN shows s ON sa.show_id = s.id
			WHERE ${yearCondition}
			GROUP BY t.id
			ORDER BY show_count DESC
			LIMIT 20
		`);

		// Shows with lineup data percentage
		const lineupCoverage = await db.execute(`
			SELECT
				(SELECT COUNT(DISTINCT show_id) FROM show_appearances) as shows_with_lineup,
				(SELECT COUNT(*) FROM shows) as total_shows
		`);

		return json({
			stats: {
				totalShows: stats.total_shows,
				uniqueShows: stats.unique_shows,
				firstDate: stats.first_date,
				lastDate: stats.last_date,
				performerCount: performerCount.rows[0].count,
				teamCount: teamCount.rows[0].count,
				showsWithLineup: lineupCoverage.rows[0].shows_with_lineup,
				monthsTracked: monthlyResult.rows.length
			},
			topShows: topShowsResult.rows.map(r => ({
				title: r.normalized_title,
				slug: generateSlug(String(r.normalized_title)),
				count: r.count
			})),
			dayDistribution: dayDistResult.rows.map(r => ({
				day: r.day_name,
				count: r.count
			})),
			monthlyActivity: monthlyResult.rows.map(r => ({
				month: r.month,
				count: r.count
			})),
			topPerformers: topPerformersResult.rows.map(r => ({
				id: r.id,
				name: r.name,
				slug: r.slug,
				showCount: r.show_count,
				teams: r.teams ? String(r.teams).split(', ') : []
			})),
			topTeams: topTeamsResult.rows.map(r => ({
				id: r.id,
				name: r.name,
				slug: r.slug,
				showCount: r.show_count,
				memberCount: r.member_count
			})),
			availableYears
		});
	} catch (e) {
		console.error('Error fetching analytics:', e);
		return json({ error: 'Failed to fetch analytics' }, { status: 500 });
	}
};
