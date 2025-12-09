import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';

export const GET: RequestHandler = async () => {
	try {
		// Basic stats
		const statsResult = await db.execute(`
			SELECT
				COUNT(*) as total_shows,
				COUNT(DISTINCT title) as unique_shows,
				MIN(date) as first_date,
				MAX(date) as last_date
			FROM shows
		`);
		const stats = statsResult.rows[0];

		// Performer count
		const performerCount = await db.execute('SELECT COUNT(*) as count FROM performers');

		// Team count
		const teamCount = await db.execute('SELECT COUNT(*) as count FROM teams');

		// Top shows by frequency (normalized title)
		const topShowsResult = await db.execute(`
			SELECT
				CASE
					WHEN title LIKE '%:%' THEN SUBSTR(title, 1, INSTR(title, ':') - 1)
					WHEN title LIKE '% - %' THEN SUBSTR(title, 1, INSTR(title, ' - ') - 1)
					ELSE title
				END as normalized_title,
				COUNT(*) as count
			FROM shows
			GROUP BY normalized_title
			ORDER BY count DESC
			LIMIT 20
		`);

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
			GROUP BY day_name
			ORDER BY CAST(strftime('%w', date) AS INTEGER)
		`);

		// Monthly distribution
		const monthlyResult = await db.execute(`
			SELECT
				strftime('%Y-%m', date) as month,
				COUNT(*) as count
			FROM shows
			GROUP BY month
			ORDER BY month
		`);

		// Top performers by show appearances
		const topPerformersResult = await db.execute(`
			SELECT
				p.id,
				p.name,
				p.slug,
				COUNT(DISTINCT sa.show_id) as show_count,
				GROUP_CONCAT(DISTINCT t.name) as teams
			FROM performers p
			JOIN show_appearances sa ON p.id = sa.performer_id
			LEFT JOIN team_members tm ON p.id = tm.performer_id AND tm.is_former = 0
			LEFT JOIN teams t ON tm.team_id = t.id
			GROUP BY p.id
			ORDER BY show_count DESC
			LIMIT 30
		`);

		// Top teams by shows
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
			GROUP BY t.id
			ORDER BY show_count DESC
			LIMIT 20
		`);

		// Jam hosts - extract host name from show title like "Jam (hosted by Team Name)"
		const jamHostsRaw = await db.execute(`
			SELECT
				TRIM(
					SUBSTR(
						title,
						INSTR(LOWER(title), 'hosted by ') + 10,
						CASE
							WHEN INSTR(SUBSTR(title, INSTR(LOWER(title), 'hosted by ') + 10), ')') > 0
							THEN INSTR(SUBSTR(title, INSTR(LOWER(title), 'hosted by ') + 10), ')') - 1
							ELSE LENGTH(title)
						END
					)
				) as host_name,
				COUNT(*) as jam_count
			FROM shows
			WHERE title LIKE '%CCB Improv Jam%' AND LOWER(title) LIKE '%hosted by%'
			GROUP BY host_name
			ORDER BY jam_count DESC
		`);

		// Normalize variant spellings to canonical team names
		const hostAliases: Record<string, string> = {
			'Truthpaste': 'Truth Paste',
			'Pissbaby': 'Piss Baby',
			'Bear Milk': 'Full Fat Bear Milk',
			'All-in Therapy': 'All-In Therapy',
			"Destiny's Stepchild": "Destiny's Step Child",
			"Destiny's Stepchild": "Destiny's Step Child",
			'Dackel, hopefully': 'Dackel'
		};

		const jamHostsMap = new Map<string, number>();
		for (const row of jamHostsRaw.rows) {
			const rawName = String(row.host_name);
			const canonicalName = hostAliases[rawName] || rawName;
			jamHostsMap.set(canonicalName, (jamHostsMap.get(canonicalName) || 0) + Number(row.jam_count));
		}

		const jamHostsResult = Array.from(jamHostsMap.entries())
			.map(([name, count]) => ({ host_name: name, jam_count: count }))
			.sort((a, b) => b.jam_count - a.jam_count);

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
				teams: r.teams ? String(r.teams).split(',') : []
			})),
			topTeams: topTeamsResult.rows.map(r => ({
				id: r.id,
				name: r.name,
				slug: r.slug,
				showCount: r.show_count,
				memberCount: r.member_count
			})),
			jamHosts: jamHostsResult.map(r => ({
				name: r.host_name,
				count: r.jam_count
			}))
		});
	} catch (e) {
		console.error('Error fetching analytics:', e);
		return json({ error: 'Failed to fetch analytics' }, { status: 500 });
	}
};
