/**
 * Show grouping utilities for organizing shows by week and day
 */

import type { Show } from '$lib/utils/icalParser';
import { getWeekStart, getWeekLabel } from './weekCalculations';

/**
 * Week grouping structure for show display
 */
export interface WeekGroup {
	weekLabel: string;
	startDate: Date;
	days: Record<string, Show[]>;
}

/**
 * Group shows by week, then by day within each week
 * @param shows - Array of shows to group
 * @returns Array of week groups sorted by start date
 */
export function groupShowsByWeek(shows: Show[]): WeekGroup[] {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// Group shows by week
	const showsByWeek = new Map<string, Show[]>();

	for (const show of shows) {
		const showDate = new Date(show.start);
		const weekStart = getWeekStart(showDate);
		const weekKey = weekStart.toISOString();

		if (!showsByWeek.has(weekKey)) {
			showsByWeek.set(weekKey, []);
		}
		showsByWeek.get(weekKey)!.push(show);
	}

	// Convert to WeekGroup format
	const weeks: WeekGroup[] = [];
	for (const [weekKey, weekShows] of showsByWeek) {
		const weekStart = new Date(weekKey);
		const weekLabel = getWeekLabel(weekStart, today);
		const days = groupShowsByDay(weekShows, false); // Don't filter by current week here

		weeks.push({ weekLabel, startDate: weekStart, days });
	}

	// Sort by week start date
	return weeks.sort((a, b) => +a.startDate - +b.startDate);
}

/**
 * Group shows by day within a week
 * @param shows - Array of shows to group
 * @param isCurrentWeek - If true, only include shows from Monday through today + 4 days
 * @returns Object mapping day labels to arrays of shows
 */
export function groupShowsByDay(
	shows: Show[],
	isCurrentWeek: boolean = false
): Record<string, Show[]> {
	const groups: Record<string, Show[]> = {};
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// For current week, calculate Monday of this week
	const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
	const daysSinceMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
	const weekStart = new Date(today);
	weekStart.setDate(today.getDate() - daysSinceMonday);
	weekStart.setHours(0, 0, 0, 0);

	for (const show of shows) {
		const date = new Date(show.start);
		date.setHours(0, 0, 0, 0);

		if (isCurrentWeek) {
			// Include shows from Monday of current week through today + 4 days
			const endDate = new Date(today);
			endDate.setDate(today.getDate() + 4);
			endDate.setHours(23, 59, 59, 999);

			if (date < weekStart || date > endDate) continue;
		}

		const dayKey = date.toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});
		if (!groups[dayKey]) groups[dayKey] = [];
		groups[dayKey].push(show);
	}
	return groups;
}
