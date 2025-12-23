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
		const availableYears = availableYearsResult.rows.map((r) => String(r.year));

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

		// Normalize show title for grouping similar shows
		function normalizeTitle(title: string): string {
			let normalized = title;

			// Strip content after colon (e.g., "Health Plan: A Deconstruction" -> "Health Plan")
			if (normalized.includes(':')) {
				normalized = normalized.split(':')[0].trim();
			}

			// Strip parenthetical content (e.g., "Kringel (Improv Comedy auf Deutsch)" -> "Kringel")
			normalized = normalized.replace(/\s*\([^)]*\)\s*$/, '').trim();

			// Normalize different dash types to regular dash, then strip suffix after dash
			normalized = normalized.replace(/[–—]/g, '-');
			if (normalized.includes(' - ')) {
				normalized = normalized.split(' - ')[0].trim();
			}

			// Strip "presented by X" suffix
			normalized = normalized.replace(/\s+presented by\s+.*$/i, '').trim();

			// Strip "Hosted by X" suffix
			normalized = normalized.replace(/\s+\(Hosted by\s+[^)]*\)$/i, '').trim();

			// Normalize to lowercase for case-insensitive matching
			normalized = normalized.toLowerCase();

			return normalized;
		}

		// Get display title (preserves original casing from first occurrence)
		function getDisplayTitle(normalizedKey: string, titleMap: Map<string, string>): string {
			return titleMap.get(normalizedKey) || normalizedKey;
		}

		// Generate slug from title
		function generateSlug(title: string): string {
			return title
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-|-$/g, '');
		}

		// Top shows by frequency (normalized title) - get all for pagination
		// Excludes Student Shows as they're not regular programming
		const rawShowsResult = await db.execute(`
			SELECT title, COUNT(*) as count
			FROM shows
			${yearConditionShows ? yearConditionShows + ' AND' : 'WHERE'}
				title NOT LIKE 'Student Show%' AND title NOT LIKE 'Student Shows%'
			GROUP BY title
			ORDER BY count DESC
		`);

		// Aggregate by normalized title, tracking display title from highest-count variant
		const showCounts = new Map<string, number>();
		const displayTitles = new Map<string, { title: string; count: number }>();
		for (const row of rawShowsResult.rows) {
			const normalized = normalizeTitle(row.title as string);
			const count = row.count as number;
			showCounts.set(normalized, (showCounts.get(normalized) || 0) + count);

			// Track the variant with highest count for display
			const current = displayTitles.get(normalized);
			if (!current || count > current.count) {
				// Use original title but apply basic cleanup (strip suffixes) for display
				let displayTitle = row.title as string;
				if (displayTitle.includes(':')) displayTitle = displayTitle.split(':')[0].trim();
				displayTitle = displayTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
				displayTitle = displayTitle.replace(/[–—]/g, '-');
				if (displayTitle.includes(' - ')) displayTitle = displayTitle.split(' - ')[0].trim();
				displayTitle = displayTitle.replace(/\s+presented by\s+.*$/i, '').trim();
				displayTitles.set(normalized, { title: displayTitle, count });
			}
		}

		// Convert to sorted array
		const topShowsResult = Array.from(showCounts.entries())
			.map(([normalized, count]) => ({
				normalized_title: displayTitles.get(normalized)?.title || normalized,
				count
			}))
			.sort((a, b) => b.count - a.count)
			.slice(0, 100);

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
			LIMIT 100
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
			LIMIT 50
		`);

		// Shows with lineup data percentage
		const lineupCoverage = await db.execute(`
			SELECT
				(SELECT COUNT(DISTINCT show_id) FROM show_appearances) as shows_with_lineup,
				(SELECT COUNT(*) FROM shows) as total_shows
		`);

		// Show variety per month - how many different shows ran each month
		// This measures programming diversity
		const rawVarietyResult = await db.execute(`
			SELECT strftime('%Y-%m', date) as month, title
			FROM shows
			WHERE title NOT LIKE 'Student Show%' AND title NOT LIKE 'Student Shows%'
			${yearFilter ? `AND strftime('%Y', date) = '${yearFilter}'` : ''}
		`);

		// Count unique normalized titles per month, tracking show names
		const varietyByMonth = new Map<string, Set<string>>();
		const varietyShowNames = new Map<string, Set<string>>();
		for (const row of rawVarietyResult.rows) {
			const month = row.month as string;
			const normalized = normalizeTitle(row.title as string);
			// Get display title
			let displayTitle = row.title as string;
			if (displayTitle.includes(':')) displayTitle = displayTitle.split(':')[0].trim();
			displayTitle = displayTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
			displayTitle = displayTitle.replace(/[–—]/g, '-');
			if (displayTitle.includes(' - ')) displayTitle = displayTitle.split(' - ')[0].trim();
			displayTitle = displayTitle.replace(/\s+presented by\s+.*$/i, '').trim();

			if (!varietyByMonth.has(month)) {
				varietyByMonth.set(month, new Set());
				varietyShowNames.set(month, new Set());
			}
			varietyByMonth.get(month)!.add(normalized);
			varietyShowNames.get(month)!.add(displayTitle);
		}

		// Convert to sorted array
		const showVarietyPerMonth = Array.from(varietyByMonth.entries())
			.map(([month, shows]) => ({
				month,
				count: shows.size,
				shows: Array.from(varietyShowNames.get(month)!).sort()
			}))
			.sort((a, b) => a.month.localeCompare(b.month));

		// Longest running shows - based on iteration number in URL
		// The CCB website uses URLs like /event/house-show-135/ where 135 is the iteration
		// This is the most accurate count of how many times a show has actually run
		// Get all shows with URLs to find max iteration per normalized title
		const rawLongevityResult = await db.execute(`
			SELECT title, url, date
			FROM shows
			WHERE url IS NOT NULL
				AND url LIKE '%comedycafeberlin.com/event/%'
				AND title NOT LIKE 'Student Show%'
				AND title NOT LIKE 'Student Shows%'
		`);

		// Extract iteration number from URL: /event/show-name-123/ -> 123
		// Cap at 500 to filter out years embedded in show names (like "Class of 1985")
		function extractIteration(url: string): number | null {
			const match = url.match(/\/event\/[^\/]+-(\d+)\/?$/);
			if (!match) return null;
			const num = parseInt(match[1], 10);
			// Filter out numbers that are likely years (1900-2099) or unreasonably high
			if (num >= 1900 && num <= 2099) return null;
			if (num > 500) return null;
			return num;
		}

		// Aggregate by normalized title, tracking highest iteration and date range
		const showLongevity = new Map<
			string,
			{
				maxIteration: number;
				displayTitle: string;
				firstDate: string;
				lastDate: string;
			}
		>();

		for (const row of rawLongevityResult.rows) {
			const normalized = normalizeTitle(row.title as string);
			const url = row.url as string;
			const date = row.date as string;
			const iteration = extractIteration(url);
			if (!iteration || iteration < 2) continue; // Skip shows without valid iteration or just 1 occurrence

			// Get display title
			let displayTitle = row.title as string;
			if (displayTitle.includes(':')) displayTitle = displayTitle.split(':')[0].trim();
			displayTitle = displayTitle.replace(/\s*\([^)]*\)\s*$/, '').trim();
			displayTitle = displayTitle.replace(/[–—]/g, '-');
			if (displayTitle.includes(' - ')) displayTitle = displayTitle.split(' - ')[0].trim();
			displayTitle = displayTitle.replace(/\s+presented by\s+.*$/i, '').trim();

			const existing = showLongevity.get(normalized);
			if (!existing) {
				showLongevity.set(normalized, {
					maxIteration: iteration,
					displayTitle,
					firstDate: date,
					lastDate: date
				});
			} else {
				// Update max iteration if higher
				if (iteration > existing.maxIteration) {
					existing.maxIteration = iteration;
					existing.displayTitle = displayTitle; // Use display title from highest iteration
				}
				// Track date range
				if (date < existing.firstDate) existing.firstDate = date;
				if (date > existing.lastDate) existing.lastDate = date;
			}
		}

		// Sort by iteration count (highest first)
		const longestRunningShows = Array.from(showLongevity.entries())
			.map(([, data]) => ({
				title: data.displayTitle,
				slug: generateSlug(data.displayTitle),
				iterations: data.maxIteration,
				firstDate: data.firstDate,
				lastDate: data.lastDate
			}))
			.sort((a, b) => b.iterations - a.iterations)
			.slice(0, 30);

		// Team member overlap - performers who are on multiple teams
		const multiTeamPerformersResult = await db.execute(`
			SELECT
				p.id,
				p.name,
				p.slug,
				GROUP_CONCAT(t.name, ', ') as teams,
				COUNT(DISTINCT tm.team_id) as team_count
			FROM performers p
			JOIN team_members tm ON p.id = tm.performer_id
			JOIN teams t ON tm.team_id = t.id
			WHERE tm.is_former = 0
			GROUP BY p.id
			HAVING COUNT(DISTINCT tm.team_id) >= 2
			ORDER BY team_count DESC, p.name
		`);

		const multiTeamPerformers = multiTeamPerformersResult.rows.map((r) => ({
			id: r.id as number,
			name: r.name as string,
			slug: r.slug as string,
			teams: (r.teams as string).split(', '),
			teamCount: r.team_count as number
		}));

		// Team pairing overlap - which teams share the most members
		// This query finds pairs of teams and counts shared performers
		const teamPairingsResult = await db.execute(`
			SELECT
				t1.id as team1_id,
				t1.name as team1_name,
				t1.slug as team1_slug,
				t2.id as team2_id,
				t2.name as team2_name,
				t2.slug as team2_slug,
				COUNT(DISTINCT tm1.performer_id) as shared_members,
				GROUP_CONCAT(p.name, ', ') as performer_names
			FROM team_members tm1
			JOIN team_members tm2 ON tm1.performer_id = tm2.performer_id
			JOIN teams t1 ON tm1.team_id = t1.id
			JOIN teams t2 ON tm2.team_id = t2.id
			JOIN performers p ON tm1.performer_id = p.id
			WHERE tm1.team_id < tm2.team_id
				AND tm1.is_former = 0
				AND tm2.is_former = 0
			GROUP BY t1.id, t2.id
			HAVING COUNT(DISTINCT tm1.performer_id) >= 1
			ORDER BY shared_members DESC, t1.name, t2.name
		`);

		const teamPairings = teamPairingsResult.rows.map((r) => ({
			team1: {
				id: r.team1_id as number,
				name: r.team1_name as string,
				slug: r.team1_slug as string
			},
			team2: {
				id: r.team2_id as number,
				name: r.team2_name as string,
				slug: r.team2_slug as string
			},
			sharedMembers: r.shared_members as number,
			performers: (r.performer_names as string).split(', ')
		}));

		// Rookie performers - performers who made their CCB debut in the last 3 months
		// (Using 3 months since older lineup data is incomplete)
		const rookieCutoffDate = new Date();
		rookieCutoffDate.setMonth(rookieCutoffDate.getMonth() - 3);
		const rookieCutoff = rookieCutoffDate.toISOString().split('T')[0];

		const rookiesResult = await db.execute(
			`
			SELECT
				p.id,
				p.name,
				p.slug,
				MIN(s.date) as debut_date,
				COUNT(DISTINCT sa.show_id) as show_count
			FROM performers p
			JOIN show_appearances sa ON p.id = sa.performer_id
			JOIN shows s ON sa.show_id = s.id
			WHERE p.name != 'Tobias Wermuth'
			GROUP BY p.id
			HAVING MIN(s.date) >= ?
			ORDER BY MIN(s.date) DESC
			LIMIT 10
		`,
			[rookieCutoff]
		);

		const rookies = rookiesResult.rows.map((r) => ({
			id: r.id as number,
			name: r.name as string,
			slug: r.slug as string,
			debutDate: r.debut_date as string,
			showCount: r.show_count as number
		}));

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
			topShows: topShowsResult.map((r) => ({
				title: r.normalized_title,
				slug: generateSlug(String(r.normalized_title)),
				count: r.count
			})),
			dayDistribution: dayDistResult.rows.map((r) => ({
				day: r.day_name,
				count: r.count
			})),
			monthlyActivity: monthlyResult.rows.map((r) => ({
				month: r.month,
				count: r.count
			})),
			topPerformers: topPerformersResult.rows.map((r) => ({
				id: r.id,
				name: r.name,
				slug: r.slug,
				showCount: r.show_count,
				teams: r.teams ? String(r.teams).split(', ') : []
			})),
			topTeams: topTeamsResult.rows.map((r) => ({
				id: r.id,
				name: r.name,
				slug: r.slug,
				showCount: r.show_count,
				memberCount: r.member_count
			})),
			showVarietyPerMonth,
			longestRunningShows,
			multiTeamPerformers,
			teamPairings,
			rookies,
			availableYears
		});
	} catch (e) {
		console.error('Error fetching analytics:', e);
		return json({ error: 'Failed to fetch analytics' }, { status: 500 });
	}
};
