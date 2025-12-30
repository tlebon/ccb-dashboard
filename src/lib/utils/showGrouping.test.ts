import { describe, it, expect, beforeEach, vi } from 'vitest';
import { groupShowsByWeek, groupShowsByDay } from './showGrouping';
import type { Show } from '$lib/utils/icalParser';

// Test data helper
function createShow(startDate: string, title: string = 'Test Show'): Show {
	return {
		id: `show-${startDate}`,
		title,
		start: new Date(startDate),
		end: new Date(startDate),
		description: '',
		location: '',
		url: '',
		imageUrl: undefined
	};
}

describe('showGrouping utilities', () => {
	beforeEach(() => {
		// Reset time mocking and fix to Wednesday, Jan 8, 2025
		vi.useRealTimers();
		vi.setSystemTime(new Date('2025-01-08T12:00:00Z'));
	});

	describe('groupShowsByWeek', () => {
		it('should return empty array for empty shows', () => {
			const result = groupShowsByWeek([]);
			expect(result).toEqual([]);
		});

		it('should group single show into one week', () => {
			const shows = [createShow('2025-01-10T19:00:00Z', 'Show A')];

			const result = groupShowsByWeek(shows);

			expect(result).toHaveLength(1);
			expect(result[0].weekLabel).toBe('This Week');
			expect(result[0].startDate.getDay()).toBe(1); // Monday
		});

		it('should group multiple shows in same week', () => {
			const shows = [
				createShow('2025-01-08T19:00:00Z', 'Show A'), // Wednesday
				createShow('2025-01-10T20:00:00Z', 'Show B'), // Friday
				createShow('2025-01-11T21:00:00Z', 'Show C') // Saturday
			];

			const result = groupShowsByWeek(shows);

			expect(result).toHaveLength(1);
			expect(result[0].weekLabel).toBe('This Week');
			// Should have days grouped
			const days = Object.keys(result[0].days);
			expect(days.length).toBeGreaterThan(0);
		});

		it('should group shows across multiple weeks', () => {
			const shows = [
				createShow('2025-01-08T19:00:00Z', 'This Week'),
				createShow('2025-01-15T19:00:00Z', 'Next Week'),
				createShow('2025-01-22T19:00:00Z', 'Week After')
			];

			const result = groupShowsByWeek(shows);

			expect(result).toHaveLength(3);
			expect(result[0].weekLabel).toBe('This Week');
			expect(result[1].weekLabel).toBe('Next Week');
		});

		it('should sort weeks by start date', () => {
			const shows = [
				createShow('2025-01-22T19:00:00Z', 'Week 3'),
				createShow('2025-01-08T19:00:00Z', 'Week 1'),
				createShow('2025-01-15T19:00:00Z', 'Week 2')
			];

			const result = groupShowsByWeek(shows);

			expect(result).toHaveLength(3);
			expect(result[0].weekLabel).toBe('This Week');
			expect(result[1].weekLabel).toBe('Next Week');
			// Third week should have date range
			expect(result[2].weekLabel).toContain('Jan');
		});

		it('should handle shows at week boundaries', () => {
			const shows = [
				createShow('2025-01-06T12:00:00Z', 'Monday'), // First day of week (midday)
				createShow('2025-01-12T12:00:00Z', 'Sunday') // Last day of week (midday)
			];

			const result = groupShowsByWeek(shows);

			expect(result).toHaveLength(1);
			expect(result[0].weekLabel).toBe('This Week');
		});

		it('should handle past weeks', () => {
			const shows = [
				createShow('2025-01-03T19:00:00Z', 'Last Week'), // Jan 3 is Friday last week
				createShow('2024-12-27T19:00:00Z', 'Two Weeks Ago')
			];

			const result = groupShowsByWeek(shows);

			expect(result).toHaveLength(2);
			// Should be sorted oldest first
			expect(result[0].startDate.getDate()).toBe(23); // Dec 23
			expect(result[1].weekLabel).toBe('Last Week');
		});

		it('should include days object with grouped shows', () => {
			const shows = [
				createShow('2025-01-10T19:00:00Z', 'Show A'),
				createShow('2025-01-10T21:00:00Z', 'Show B'), // Same day
				createShow('2025-01-11T19:00:00Z', 'Show C') // Different day
			];

			const result = groupShowsByWeek(shows);

			expect(result).toHaveLength(1);
			const days = result[0].days;
			const dayKeys = Object.keys(days);

			expect(dayKeys).toHaveLength(2); // Friday and Saturday
			// Find the Friday key
			const fridayKey = dayKeys.find((key) => key.includes('Friday'));
			expect(fridayKey).toBeDefined();
			expect(days[fridayKey!]).toHaveLength(2); // Two shows on Friday
		});
	});

	describe('groupShowsByDay', () => {
		it('should return empty object for empty shows', () => {
			const result = groupShowsByDay([]);
			expect(result).toEqual({});
		});

		it('should group single show by day', () => {
			const shows = [createShow('2025-01-10T19:00:00Z', 'Show A')];

			const result = groupShowsByDay(shows);

			const keys = Object.keys(result);
			expect(keys).toHaveLength(1);
			expect(keys[0]).toContain('Friday'); // Jan 10 is Friday
			expect(keys[0]).toContain('10');
			expect(result[keys[0]]).toHaveLength(1);
		});

		it('should group multiple shows on same day', () => {
			const shows = [
				createShow('2025-01-10T10:00:00Z', 'Show A'),
				createShow('2025-01-10T14:00:00Z', 'Show B'),
				createShow('2025-01-10T18:00:00Z', 'Show C')
			];

			const result = groupShowsByDay(shows);

			const keys = Object.keys(result);
			expect(keys.length).toBeGreaterThanOrEqual(1);
			// Find the Friday key (might be named differently in different locales)
			const fridayKey = keys.find((k) => k.includes('10'));
			expect(fridayKey).toBeDefined();
			// All three shows should be on the same day
			const totalShows = Object.values(result).reduce((sum, shows) => sum + shows.length, 0);
			expect(totalShows).toBe(3);
		});

		it('should group shows across multiple days', () => {
			const shows = [
				createShow('2025-01-10T19:00:00Z', 'Friday Show'),
				createShow('2025-01-11T19:00:00Z', 'Saturday Show'),
				createShow('2025-01-12T19:00:00Z', 'Sunday Show')
			];

			const result = groupShowsByDay(shows);

			const keys = Object.keys(result);
			expect(keys).toHaveLength(3);
			expect(keys.some((k) => k.includes('Friday'))).toBe(true);
			expect(keys.some((k) => k.includes('Saturday'))).toBe(true);
			expect(keys.some((k) => k.includes('Sunday'))).toBe(true);
		});

		it('should filter for current week when isCurrentWeek is true', () => {
			// Today is Wednesday Jan 8, 2025
			// Week runs Monday Jan 6 - Today + 4 days (Sunday Jan 12)
			const shows = [
				createShow('2025-01-05T19:00:00Z', 'Before Week'), // Sunday before
				createShow('2025-01-06T19:00:00Z', 'Monday'), // Start of week
				createShow('2025-01-12T19:00:00Z', 'Sunday'), // Today + 4
				createShow('2025-01-13T19:00:00Z', 'After Range') // Beyond today + 4
			];

			const result = groupShowsByDay(shows, true);

			const keys = Object.keys(result);
			expect(keys).toHaveLength(2); // Monday and Sunday only
			expect(keys.some((k) => k.includes('Monday'))).toBe(true);
			expect(keys.some((k) => k.includes('Sunday'))).toBe(true);
		});

		it('should not filter when isCurrentWeek is false', () => {
			const shows = [
				createShow('2025-01-05T19:00:00Z', 'Before Week'),
				createShow('2025-01-13T19:00:00Z', 'After Range')
			];

			const result = groupShowsByDay(shows, false);

			const keys = Object.keys(result);
			expect(keys).toHaveLength(2); // Both shows included
		});

		it('should use localized date format for day keys', () => {
			const shows = [createShow('2025-01-10T19:00:00Z', 'Show A')];

			const result = groupShowsByDay(shows);

			const key = Object.keys(result)[0];
			// Should be in format: "Weekday, Month Day"
			expect(key).toContain('Friday');
			expect(key).toContain('January');
			expect(key).toContain('10');
		});

		it('should preserve show order within same day', () => {
			const shows = [
				createShow('2025-01-10T19:00:00Z', 'Show A'),
				createShow('2025-01-10T21:00:00Z', 'Show B'),
				createShow('2025-01-10T20:00:00Z', 'Show C')
			];

			const result = groupShowsByDay(shows);

			const key = Object.keys(result)[0];
			// Shows should maintain input order (not sorted)
			expect(result[key][0].title).toBe('Show A');
			expect(result[key][1].title).toBe('Show B');
			expect(result[key][2].title).toBe('Show C');
		});

		it('should handle shows at midnight', () => {
			const shows = [createShow('2025-01-10T00:00:00Z', 'Midnight Show')];

			const result = groupShowsByDay(shows);

			const keys = Object.keys(result);
			expect(keys).toHaveLength(1);
			expect(keys[0]).toContain('Friday');
		});
	});

	// Integration test
	describe('integration', () => {
		it('should work together - group by week then by day', () => {
			const shows = [
				createShow('2025-01-10T19:00:00Z', 'This Week A'),
				createShow('2025-01-10T21:00:00Z', 'This Week B'),
				createShow('2025-01-11T19:00:00Z', 'This Week C'),
				createShow('2025-01-17T19:00:00Z', 'Next Week A')
			];

			const weekGroups = groupShowsByWeek(shows);

			expect(weekGroups).toHaveLength(2);

			// This week should have 2 days
			const thisWeekDays = Object.keys(weekGroups[0].days);
			expect(thisWeekDays).toHaveLength(2);

			// Next week should have 1 day
			const nextWeekDays = Object.keys(weekGroups[1].days);
			expect(nextWeekDays).toHaveLength(1);
		});
	});
});
