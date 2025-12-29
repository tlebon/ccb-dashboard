/**
 * Week calculation utilities for show navigation and grouping
 * Handles week boundaries, date ranges, and week-based navigation
 */

import type { Show } from '$lib/utils/icalParser';

// Week navigation boundaries
export const MAX_WEEKS = 8; // Maximum weeks to show ahead
export const MIN_WEEKS = -4; // Maximum weeks to show behind (negative = past)

export interface WeekRange {
	startDate: Date;
	endDate: Date;
	label: string;
}

/**
 * Get Monday (start of week) for a given date
 * @param date - Date to find week start for
 * @returns Date object set to Monday at midnight
 */
export function getWeekStart(date: Date): Date {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	const dayOfWeek = d.getDay(); // 0 (Sun) - 6 (Sat)
	const daysSinceMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
	d.setDate(d.getDate() - daysSinceMonday);
	return d;
}

/**
 * Generate week label based on distance from today
 * @param weekStart - Monday of the week to label
 * @param today - Today's date for comparison
 * @returns Human-readable label like "This Week", "Next Week", or "Jan 1-7"
 */
export function getWeekLabel(weekStart: Date, today: Date): string {
	const todayWeekStart = getWeekStart(today);
	const diffMs = weekStart.getTime() - todayWeekStart.getTime();
	const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

	if (diffWeeks === 0) return 'This Week';
	if (diffWeeks === 1) return 'Next Week';
	if (diffWeeks === -1) return 'Last Week';

	// Format as date range for other weeks
	const weekEnd = new Date(weekStart);
	weekEnd.setDate(weekStart.getDate() + 6);

	const startMonth = weekStart.toLocaleDateString(undefined, { month: 'short' });
	const startDay = weekStart.getDate();
	const endMonth = weekEnd.toLocaleDateString(undefined, { month: 'short' });
	const endDay = weekEnd.getDate();

	if (startMonth === endMonth) {
		return `${startMonth} ${startDay}-${endDay}`;
	} else {
		return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
	}
}

/**
 * Calculate date range for a week offset
 * @param offset - Week offset from current week (0 = this week, 1 = next week, -1 = last week)
 * @param monitorMode - If true, shows full week; if false, shows extended range for manual browsing
 * @returns Week range with start/end dates and label
 */
export function getWeekRange(offset: number, monitorMode: boolean = false): WeekRange {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	if (offset === 0) {
		// This week: from Monday of current week
		const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
		const daysSinceMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
		const weekStart = new Date(today);
		weekStart.setDate(today.getDate() - daysSinceMonday);
		weekStart.setHours(0, 0, 0, 0);

		// In monitor mode: show full week (Monday-Sunday)
		// In manual mode: show through today + 4 days (for browsing context)
		const endDate = new Date(weekStart);
		if (monitorMode) {
			// Full week: Sunday is 6 days after Monday
			endDate.setDate(weekStart.getDate() + 6);
		} else {
			// Manual mode: show past shows + upcoming few days
			endDate.setTime(today.getTime());
			endDate.setDate(today.getDate() + 4);
		}
		endDate.setHours(23, 59, 59, 999);
		return { startDate: weekStart, endDate, label: 'This Week' };
	} else if (offset > 0) {
		// Future weeks: Calculate the Monday of week N
		const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
		const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
		const weekStart = new Date(today);
		weekStart.setDate(today.getDate() + daysUntilNextMonday + (offset - 1) * 7);
		weekStart.setHours(0, 0, 0, 0);

		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 6);
		weekEnd.setHours(23, 59, 59, 999);

		// Format date range for label
		const startStr = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		const endStr = weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		const label = offset === 1 ? 'Next Week' : `${startStr} - ${endStr}`;

		return { startDate: weekStart, endDate: weekEnd, label };
	} else {
		// Past weeks (negative offset): Calculate the Monday of that past week
		const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
		// Days since last Monday (if today is Monday, it's 0)
		const daysSinceMonday = (dayOfWeek + 6) % 7;
		const thisMonday = new Date(today);
		thisMonday.setDate(today.getDate() - daysSinceMonday);

		// Go back N weeks from this Monday
		const weekStart = new Date(thisMonday);
		weekStart.setDate(thisMonday.getDate() + offset * 7);
		weekStart.setHours(0, 0, 0, 0);

		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 6);
		weekEnd.setHours(23, 59, 59, 999);

		// Format date range for label
		const startStr = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		const endStr = weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
		const label = offset === -1 ? 'Last Week' : `${startStr} - ${endStr}`;

		return { startDate: weekStart, endDate: weekEnd, label };
	}
}

/**
 * Check if a week offset has any shows
 * @param offset - Week offset to check
 * @param shows - Array of shows to search
 * @param monitorMode - If true, uses full week range; if false, uses extended range
 * @returns True if the week has at least one show
 */
export function weekHasShows(offset: number, shows: Show[], monitorMode: boolean = false): boolean {
	const range = getWeekRange(offset, monitorMode);
	return shows.some((show) => {
		const showDate = new Date(show.start);
		return showDate >= range.startDate && showDate <= range.endDate;
	});
}

/**
 * Find next week with shows
 * @param from - Current week offset
 * @param shows - Array of shows to search
 * @param maxWeeks - Maximum week offset to search (default: MAX_WEEKS)
 * @param monitorMode - If true, uses full week range; if false, uses extended range
 * @returns Next week offset with shows, or null if none found
 */
export function findNextWeekWithShows(
	from: number,
	shows: Show[],
	maxWeeks: number = MAX_WEEKS,
	monitorMode: boolean = false
): number | null {
	for (let i = from + 1; i < maxWeeks; i++) {
		if (weekHasShows(i, shows, monitorMode)) return i;
	}
	return null;
}

/**
 * Find previous week with shows
 * @param from - Current week offset
 * @param shows - Array of shows to search
 * @param minWeeks - Minimum week offset to search (default: MIN_WEEKS)
 * @param monitorMode - If true, uses full week range; if false, uses extended range
 * @returns Previous week offset with shows, or null if none found
 */
export function findPrevWeekWithShows(
	from: number,
	shows: Show[],
	minWeeks: number = MIN_WEEKS,
	monitorMode: boolean = false
): number | null {
	for (let i = from - 1; i >= minWeeks; i--) {
		if (weekHasShows(i, shows, monitorMode)) return i;
	}
	return null;
}
