import { describe, it, expect } from 'vitest';
import {
	calculateMaxValues,
	orderDaysByWeek,
	getModalTitle,
	type AnalyticsData,
	type ModalType
} from './analyticsData';

describe('analyticsData utilities', () => {
	describe('calculateMaxValues', () => {
		it('should return all 1s when data is null', () => {
			const result = calculateMaxValues(null);
			expect(result).toEqual({
				maxShowCount: 1,
				maxPerformerCount: 1,
				maxTeamCount: 1,
				maxDayCount: 1,
				maxMonthCount: 1,
				maxVarietyCount: 1,
				maxIterations: 1,
				maxSharedMembers: 1,
				maxMultiTeamCount: 1
			});
		});

		it('should calculate max values correctly from populated data', () => {
			const data: AnalyticsData = {
				stats: {
					totalShows: 100,
					uniqueShows: 50,
					firstDate: '2024-01-01',
					lastDate: '2024-12-31',
					performerCount: 200,
					teamCount: 20,
					showsWithLineup: 90,
					monthsTracked: 12
				},
				topShows: [
					{ title: 'Show A', slug: 'show-a', count: 25 },
					{ title: 'Show B', slug: 'show-b', count: 20 }
				],
				dayDistribution: [
					{ day: 'Friday', count: 30 },
					{ day: 'Saturday', count: 40 },
					{ day: 'Sunday', count: 10 }
				],
				monthlyActivity: [
					{ month: '2024-01', count: 15 },
					{ month: '2024-02', count: 20 }
				],
				showVarietyPerMonth: [
					{ month: '2024-01', count: 8, shows: [] },
					{ month: '2024-02', count: 12, shows: [] }
				],
				longestRunningShows: [
					{
						title: 'Long Show',
						slug: 'long-show',
						firstDate: '2024-01-01',
						lastDate: '2024-12-31',
						iterations: 50
					}
				],
				multiTeamPerformers: [
					{ id: 1, name: 'John', slug: 'john', teams: ['A', 'B', 'C'], teamCount: 3 }
				],
				teamPairings: [
					{
						team1: { id: 1, name: 'Team A', slug: 'team-a' },
						team2: { id: 2, name: 'Team B', slug: 'team-b' },
						sharedMembers: 5,
						performers: []
					}
				],
				topPerformers: [{ id: 1, name: 'John', slug: 'john', showCount: 35, teams: [] }],
				topTeams: [{ id: 1, name: 'Team A', slug: 'team-a', showCount: 45, memberCount: 10 }],
				rookies: [],
				availableYears: []
			};

			const result = calculateMaxValues(data);

			expect(result).toEqual({
				maxShowCount: 25,
				maxPerformerCount: 35,
				maxTeamCount: 45,
				maxDayCount: 40,
				maxMonthCount: 20,
				maxVarietyCount: 12,
				maxIterations: 50,
				maxSharedMembers: 5,
				maxMultiTeamCount: 3
			});
		});

		it('should return 1 for empty arrays to avoid division by zero', () => {
			const data: AnalyticsData = {
				stats: {
					totalShows: 0,
					uniqueShows: 0,
					firstDate: '',
					lastDate: '',
					performerCount: 0,
					teamCount: 0,
					showsWithLineup: 0,
					monthsTracked: 0
				},
				topShows: [],
				dayDistribution: [],
				monthlyActivity: [],
				showVarietyPerMonth: [],
				longestRunningShows: [],
				multiTeamPerformers: [],
				teamPairings: [],
				topPerformers: [],
				topTeams: [],
				rookies: [],
				availableYears: []
			};

			const result = calculateMaxValues(data);

			expect(result).toEqual({
				maxShowCount: 1,
				maxPerformerCount: 1,
				maxTeamCount: 1,
				maxDayCount: 1,
				maxMonthCount: 1,
				maxVarietyCount: 1,
				maxIterations: 1,
				maxSharedMembers: 1,
				maxMultiTeamCount: 1
			});
		});

		it('should handle partial data with some empty arrays', () => {
			const data: AnalyticsData = {
				stats: {
					totalShows: 10,
					uniqueShows: 5,
					firstDate: '2024-01-01',
					lastDate: '2024-01-31',
					performerCount: 20,
					teamCount: 2,
					showsWithLineup: 10,
					monthsTracked: 1
				},
				topShows: [{ title: 'Show A', slug: 'show-a', count: 5 }],
				dayDistribution: [{ day: 'Friday', count: 10 }],
				monthlyActivity: [],
				showVarietyPerMonth: [],
				longestRunningShows: [],
				multiTeamPerformers: [],
				teamPairings: [],
				topPerformers: [{ id: 1, name: 'John', slug: 'john', showCount: 8, teams: [] }],
				topTeams: [],
				rookies: [],
				availableYears: []
			};

			const result = calculateMaxValues(data);

			expect(result.maxShowCount).toBe(5);
			expect(result.maxPerformerCount).toBe(8);
			expect(result.maxDayCount).toBe(10);
			expect(result.maxMonthCount).toBe(1);
			expect(result.maxTeamCount).toBe(1);
		});
	});

	describe('orderDaysByWeek', () => {
		it('should order days from Sunday to Saturday', () => {
			const days = [
				{ day: 'Friday', count: 30 },
				{ day: 'Monday', count: 5 },
				{ day: 'Sunday', count: 10 },
				{ day: 'Wednesday', count: 15 }
			];

			const result = orderDaysByWeek(days);

			expect(result.map((d) => d.day)).toEqual(['Sunday', 'Monday', 'Wednesday', 'Friday']);
		});

		it('should handle all seven days', () => {
			const days = [
				{ day: 'Saturday', count: 40 },
				{ day: 'Friday', count: 30 },
				{ day: 'Thursday', count: 25 },
				{ day: 'Wednesday', count: 15 },
				{ day: 'Tuesday', count: 8 },
				{ day: 'Monday', count: 5 },
				{ day: 'Sunday', count: 10 }
			];

			const result = orderDaysByWeek(days);

			expect(result.map((d) => d.day)).toEqual([
				'Sunday',
				'Monday',
				'Tuesday',
				'Wednesday',
				'Thursday',
				'Friday',
				'Saturday'
			]);
		});

		it('should handle empty array', () => {
			const result = orderDaysByWeek([]);
			expect(result).toEqual([]);
		});

		it('should handle single day', () => {
			const days = [{ day: 'Friday', count: 30 }];
			const result = orderDaysByWeek(days);
			expect(result).toEqual([{ day: 'Friday', count: 30 }]);
		});

		it('should preserve count values when sorting', () => {
			const days = [
				{ day: 'Friday', count: 100 },
				{ day: 'Monday', count: 50 }
			];

			const result = orderDaysByWeek(days);

			expect(result).toEqual([
				{ day: 'Monday', count: 50 },
				{ day: 'Friday', count: 100 }
			]);
		});

		it('should not mutate original array', () => {
			const days = [
				{ day: 'Friday', count: 30 },
				{ day: 'Monday', count: 5 }
			];
			const original = [...days];

			orderDaysByWeek(days);

			expect(days).toEqual(original);
		});
	});

	describe('getModalTitle', () => {
		it('should return empty string for null type', () => {
			expect(getModalTitle(null)).toBe('');
		});

		it('should return correct title for all modal types', () => {
			const testCases: [ModalType, string][] = [
				['shows', 'TOP SHOWS'],
				['performers', 'TOP PERFORMERS'],
				['teams', 'TOP TEAMS'],
				['longestRunning', 'LONGEST RUNNING'],
				['multiTeam', 'MULTI-TEAM PERFORMERS'],
				['teamOverlap', 'TEAM OVERLAP'],
				['dayDistribution', 'SHOWS BY DAY'],
				['monthlyActivity', 'SHOWS PER MONTH'],
				['showVariety', 'SHOW VARIETY']
			];

			testCases.forEach(([type, expected]) => {
				expect(getModalTitle(type)).toBe(expected);
			});
		});

		it('should return uppercase titles', () => {
			const title = getModalTitle('shows');
			expect(title).toBe(title.toUpperCase());
		});
	});
});
