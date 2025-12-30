import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	getWeekStart,
	getWeekLabel,
	getWeekRange,
	weekHasShows,
	findNextWeekWithShows,
	findPrevWeekWithShows,
	MAX_WEEKS,
	MIN_WEEKS
} from './weekCalculations';
import type { Show } from '$lib/utils/icalParser';

// Test data helper
function createShow(startDate: string): Show {
	return {
		id: `show-${startDate}`,
		title: 'Test Show',
		start: new Date(startDate),
		end: new Date(startDate),
		description: '',
		location: '',
		url: '',
		imageUrl: undefined
	};
}

describe('weekCalculations utilities', () => {
	beforeEach(() => {
		// Reset time mocking before each test
		vi.useRealTimers();
	});

	describe('getWeekStart', () => {
		it('should return Monday for a Monday date', () => {
			// 2025-01-06 is a Monday
			const date = new Date('2025-01-06');
			const result = getWeekStart(date);

			expect(result.getDay()).toBe(1); // Monday
			expect(result.getDate()).toBe(6);
			expect(result.getHours()).toBe(0);
		});

		it('should return Monday for a Sunday date', () => {
			// 2025-01-05 is a Sunday, should return Monday Jan 30 (previous Monday)
			const date = new Date('2025-01-05');
			const result = getWeekStart(date);

			expect(result.getDay()).toBe(1); // Monday
			expect(result.getDate()).toBe(30); // Previous Monday (Dec 30, 2024)
			expect(result.getMonth()).toBe(11); // December (0-indexed)
		});

		it('should return Monday for a Wednesday date', () => {
			// 2025-01-08 is a Wednesday
			const date = new Date('2025-01-08');
			const result = getWeekStart(date);

			expect(result.getDay()).toBe(1); // Monday
			expect(result.getDate()).toBe(6); // Jan 6 is the Monday
		});

		it('should return Monday for a Saturday date', () => {
			// 2025-01-11 is a Saturday
			const date = new Date('2025-01-11');
			const result = getWeekStart(date);

			expect(result.getDay()).toBe(1); // Monday
			expect(result.getDate()).toBe(6); // Jan 6 is the Monday
		});

		it('should handle year boundaries', () => {
			// 2025-01-01 is a Wednesday, week starts on Dec 30, 2024
			const date = new Date('2025-01-01');
			const result = getWeekStart(date);

			expect(result.getDay()).toBe(1); // Monday
			expect(result.getFullYear()).toBe(2024);
			expect(result.getMonth()).toBe(11); // December
			expect(result.getDate()).toBe(30);
		});
	});

	describe('getWeekLabel', () => {
		it('should return "This Week" for same week', () => {
			const today = new Date('2025-01-08'); // Wednesday
			const weekStart = getWeekStart(today); // Monday Jan 6
			const label = getWeekLabel(weekStart, today);

			expect(label).toBe('This Week');
		});

		it('should return "Next Week" for next week', () => {
			const today = new Date('2025-01-08'); // Wednesday
			const nextWeek = new Date('2025-01-13'); // Following Monday
			const label = getWeekLabel(nextWeek, today);

			expect(label).toBe('Next Week');
		});

		it('should return "Last Week" for last week', () => {
			const today = new Date('2025-01-08'); // Wednesday
			const lastWeek = new Date('2024-12-30'); // Previous Monday
			const label = getWeekLabel(lastWeek, today);

			expect(label).toBe('Last Week');
		});

		it('should return date range for weeks further away (same month)', () => {
			const today = new Date('2025-01-08'); // Wednesday
			const futureWeek = new Date('2025-01-20'); // Monday two weeks away
			const label = getWeekLabel(futureWeek, today);

			expect(label).toBe('Jan 20-26');
		});

		it('should return date range spanning months', () => {
			const today = new Date('2025-01-08'); // Wednesday
			const futureWeek = new Date('2025-01-27'); // Monday near end of month
			const label = getWeekLabel(futureWeek, today);

			expect(label).toBe('Jan 27 - Feb 2');
		});

		it('should handle year boundaries in label', () => {
			const today = new Date('2024-12-10'); // Tuesday
			const futureWeek = new Date('2024-12-30'); // Monday (3 weeks away)
			const label = getWeekLabel(futureWeek, today);

			// Dec 30 - Jan 5 (spans 2024-2025)
			expect(label).toBe('Dec 30 - Jan 5');
		});
	});

	describe('getWeekRange', () => {
		beforeEach(() => {
			// Fix time to Wednesday, Jan 8, 2025
			vi.setSystemTime(new Date('2025-01-08T12:00:00Z'));
		});

		it('should return this week range in monitor mode (full week)', () => {
			const range = getWeekRange(0, true);

			expect(range.label).toBe('This Week');
			expect(range.startDate.getDay()).toBe(1); // Monday
			expect(range.startDate.getDate()).toBe(6); // Jan 6
			expect(range.endDate.getDay()).toBe(0); // Sunday
			expect(range.endDate.getDate()).toBe(12); // Jan 12
		});

		it('should return this week range in manual mode (extended)', () => {
			const range = getWeekRange(0, false);

			expect(range.label).toBe('This Week');
			expect(range.startDate.getDay()).toBe(1); // Monday
			expect(range.startDate.getDate()).toBe(6); // Jan 6
			// End date should be today + 4 days
			expect(range.endDate.getDate()).toBe(12); // Jan 8 + 4 = Jan 12
		});

		it('should return next week range (offset 1)', () => {
			const range = getWeekRange(1, true);

			expect(range.label).toBe('Next Week');
			expect(range.startDate.getDay()).toBe(1); // Monday
			expect(range.startDate.getDate()).toBe(13); // Jan 13
			expect(range.endDate.getDate()).toBe(19); // Jan 19
		});

		it('should return future week range (offset 2)', () => {
			const range = getWeekRange(2, true);

			expect(range.startDate.getDay()).toBe(1); // Monday
			expect(range.startDate.getDate()).toBe(20); // Jan 20
			expect(range.endDate.getDate()).toBe(26); // Jan 26
			// Label should be date range
			expect(range.label).toContain('Jan');
			expect(range.label).toContain('20');
		});

		it('should return last week range (offset -1)', () => {
			const range = getWeekRange(-1, true);

			expect(range.label).toBe('Last Week');
			expect(range.startDate.getDay()).toBe(1); // Monday
			expect(range.startDate.getDate()).toBe(30); // Dec 30
			expect(range.startDate.getMonth()).toBe(11); // December
			expect(range.endDate.getDate()).toBe(5); // Jan 5
		});

		it('should return past week range (offset -2)', () => {
			const range = getWeekRange(-2, true);

			expect(range.startDate.getDay()).toBe(1); // Monday
			expect(range.startDate.getDate()).toBe(23); // Dec 23
			expect(range.startDate.getMonth()).toBe(11); // December
		});

		it('should handle year boundaries correctly', () => {
			vi.setSystemTime(new Date('2025-01-01T12:00:00Z')); // Jan 1, 2025 (Wednesday)
			const range = getWeekRange(0, true);

			// Week should start on Monday Dec 30, 2024
			expect(range.startDate.getFullYear()).toBe(2024);
			expect(range.startDate.getMonth()).toBe(11); // December
			expect(range.startDate.getDate()).toBe(30);
		});
	});

	describe('weekHasShows', () => {
		beforeEach(() => {
			vi.setSystemTime(new Date('2025-01-08T12:00:00Z')); // Wednesday
		});

		it('should return true if week has shows', () => {
			const shows = [
				createShow('2025-01-10') // Friday this week
			];

			const result = weekHasShows(0, shows, true);
			expect(result).toBe(true);
		});

		it('should return false if week has no shows', () => {
			const shows = [
				createShow('2025-01-17') // Next week
			];

			const result = weekHasShows(0, shows, true);
			expect(result).toBe(false);
		});

		it('should check correct week for positive offset', () => {
			const shows = [
				createShow('2025-01-17') // Next week Friday
			];

			const result = weekHasShows(1, shows, true);
			expect(result).toBe(true);
		});

		it('should check correct week for negative offset', () => {
			const shows = [
				createShow('2025-01-03') // Last week Friday
			];

			const result = weekHasShows(-1, shows, true);
			expect(result).toBe(true);
		});

		it('should handle empty shows array', () => {
			const result = weekHasShows(0, [], true);
			expect(result).toBe(false);
		});

		it('should handle shows at week boundaries', () => {
			const shows = [
				createShow('2025-01-06'), // Monday (start of week)
				createShow('2025-01-12') // Sunday (end of week)
			];

			const thisWeek = weekHasShows(0, shows, true);
			expect(thisWeek).toBe(true);
		});
	});

	describe('findNextWeekWithShows', () => {
		beforeEach(() => {
			vi.setSystemTime(new Date('2025-01-08T12:00:00Z'));
		});

		it('should find next week with shows', () => {
			const shows = [
				createShow('2025-01-17'), // Next week
				createShow('2025-01-24') // Week after
			];

			const result = findNextWeekWithShows(0, shows, MAX_WEEKS, true);
			expect(result).toBe(1);
		});

		it('should skip empty weeks', () => {
			const shows = [
				createShow('2025-01-24') // Two weeks away
			];

			const result = findNextWeekWithShows(0, shows, MAX_WEEKS, true);
			expect(result).toBe(2);
		});

		it('should return null if no next week found', () => {
			const shows: Show[] = [];

			const result = findNextWeekWithShows(0, shows, MAX_WEEKS, true);
			expect(result).toBeNull();
		});

		it('should respect maxWeeks boundary', () => {
			const shows = [
				createShow('2025-03-15') // Far in future
			];

			const result = findNextWeekWithShows(0, shows, 5, true);
			expect(result).toBeNull();
		});

		it('should find from non-zero offset', () => {
			const shows = [
				createShow('2025-01-24') // Week 2
			];

			const result = findNextWeekWithShows(1, shows, MAX_WEEKS, true);
			expect(result).toBe(2);
		});
	});

	describe('findPrevWeekWithShows', () => {
		beforeEach(() => {
			vi.setSystemTime(new Date('2025-01-08T12:00:00Z'));
		});

		it('should find previous week with shows', () => {
			const shows = [
				createShow('2025-01-03'), // Last week
				createShow('2024-12-27') // Week before
			];

			const result = findPrevWeekWithShows(0, shows, MIN_WEEKS, true);
			expect(result).toBe(-1);
		});

		it('should skip empty weeks', () => {
			const shows = [
				createShow('2024-12-27') // Two weeks ago
			];

			const result = findPrevWeekWithShows(0, shows, MIN_WEEKS, true);
			expect(result).toBe(-2);
		});

		it('should return null if no previous week found', () => {
			const shows: Show[] = [];

			const result = findPrevWeekWithShows(0, shows, MIN_WEEKS, true);
			expect(result).toBeNull();
		});

		it('should respect minWeeks boundary', () => {
			const shows = [
				createShow('2024-11-01') // Far in past
			];

			const result = findPrevWeekWithShows(0, shows, -2, true);
			expect(result).toBeNull();
		});

		it('should find from non-zero offset', () => {
			const shows = [
				createShow('2024-12-27') // Week -2
			];

			const result = findPrevWeekWithShows(-1, shows, MIN_WEEKS, true);
			expect(result).toBe(-2);
		});
	});

	describe('constants', () => {
		it('should export MAX_WEEKS constant', () => {
			expect(MAX_WEEKS).toBe(8);
		});

		it('should export MIN_WEEKS constant', () => {
			expect(MIN_WEEKS).toBe(-4);
		});
	});
});
