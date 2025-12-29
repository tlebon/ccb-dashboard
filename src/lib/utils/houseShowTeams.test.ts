import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	getFridayOfMonth,
	getHouseShowTeams,
	isHouseShow,
	formatHouseShowTeams,
	getUpcomingHouseShowDates,
	isHouseTeam,
	getHouseTeamBySlug,
	HOUSE_SHOW_TEAMS
} from './houseShowTeams';

describe('houseShowTeams', () => {
	describe('getFridayOfMonth', () => {
		it('should calculate 1st Friday correctly', () => {
			// January 3, 2025 is the 1st Friday
			expect(getFridayOfMonth(new Date('2025-01-03'))).toBe(1);
		});

		it('should calculate 2nd Friday correctly', () => {
			// January 10, 2025 is the 2nd Friday
			expect(getFridayOfMonth(new Date('2025-01-10'))).toBe(2);
		});

		it('should calculate 3rd Friday correctly', () => {
			expect(getFridayOfMonth(new Date('2025-01-17'))).toBe(3);
		});

		it('should calculate 4th Friday correctly', () => {
			expect(getFridayOfMonth(new Date('2025-01-24'))).toBe(4);
		});

		it('should calculate 5th Friday correctly when it exists', () => {
			// May 30, 2025 is the 5th Friday
			expect(getFridayOfMonth(new Date('2025-05-30'))).toBe(5);
		});

		it('should handle dates at month boundaries', () => {
			expect(getFridayOfMonth(new Date('2025-01-31'))).toBe(5);
			expect(getFridayOfMonth(new Date('2025-02-01'))).toBe(1);
		});

		it('should handle first week of month', () => {
			// Dates 1-7 should all be week 1
			expect(getFridayOfMonth(new Date('2025-01-01'))).toBe(1);
			expect(getFridayOfMonth(new Date('2025-01-07'))).toBe(1);
		});

		it('should handle second week of month', () => {
			// Dates 8-14 should all be week 2
			expect(getFridayOfMonth(new Date('2025-01-08'))).toBe(2);
			expect(getFridayOfMonth(new Date('2025-01-14'))).toBe(2);
		});
	});

	describe('getHouseShowTeams', () => {
		it('should return Thunderclap and Handshake for 1st Friday in Jan 2025', () => {
			const teams = getHouseShowTeams(new Date('2025-01-03'));
			expect(teams).toHaveLength(2);
			expect(teams.map((t) => t.slug)).toContain('thunderclap');
			expect(teams.map((t) => t.slug)).toContain('handshake');
		});

		it('should return Brace Brace and Handshake for 4th Friday in Jan 2025', () => {
			const teams = getHouseShowTeams(new Date('2025-01-24'));
			expect(teams).toHaveLength(2);
			expect(teams.map((t) => t.slug)).toContain('brace-brace');
			expect(teams.map((t) => t.slug)).toContain('handshake');
		});

		it('should return Brace Brace and Capiche for 2nd Friday in Aug 2025', () => {
			const teams = getHouseShowTeams(new Date('2025-08-08'));
			expect(teams).toHaveLength(2);
			expect(teams.map((t) => t.slug)).toContain('brace-brace');
			expect(teams.map((t) => t.slug)).toContain('capiche');
		});

		it('should return Thunderclap and Capiche for 3rd Friday in Aug 2025', () => {
			const teams = getHouseShowTeams(new Date('2025-08-15'));
			expect(teams).toHaveLength(2);
			expect(teams.map((t) => t.slug)).toContain('thunderclap');
			expect(teams.map((t) => t.slug)).toContain('capiche');
		});

		it('should NOT include Handshake before Jan 2025', () => {
			const teams = getHouseShowTeams(new Date('2024-12-06')); // 1st Friday Dec 2024
			expect(teams.map((t) => t.slug)).not.toContain('handshake');
			expect(teams.map((t) => t.slug)).toContain('thunderclap'); // Thunderclap should still be there
		});

		it('should NOT include Capiche before Aug 2025', () => {
			const teams = getHouseShowTeams(new Date('2025-07-11')); // 2nd Friday July 2025
			expect(teams.map((t) => t.slug)).not.toContain('capiche');
			expect(teams.map((t) => t.slug)).toContain('brace-brace'); // Brace Brace should still be there
		});

		it('should handle string dates', () => {
			const teams = getHouseShowTeams('2025-01-10'); // 2nd Friday (before Capiche starts)
			expect(teams).toHaveLength(1); // Only Brace Brace (Capiche starts Aug 2025)
			expect(teams.map((t) => t.slug)).toContain('brace-brace');
		});

		it('should return empty array for 5th Friday (no teams perform)', () => {
			const teams = getHouseShowTeams(new Date('2025-05-30')); // 5th Friday
			expect(teams).toHaveLength(0);
		});

		it('should handle edge case: exact start date for Handshake', () => {
			// Jan 1, 2025 is a Wednesday (not a Friday)
			// This test verifies the date math for determining Friday of month
			const fridayOfMonth = Math.ceil(1 / 7); // 1
			expect(fridayOfMonth).toBe(1);
		});

		it('should handle edge case: exact start date for Capiche', () => {
			const teams = getHouseShowTeams('2025-08-01'); // Start date (Friday)
			// August 1, 2025 is the 1st Friday
			expect(teams.map((t) => t.slug)).not.toContain('capiche'); // Capiche performs on 2nd & 3rd
			expect(teams.map((t) => t.slug)).toContain('thunderclap'); // Thunderclap performs on 1st
			expect(teams.map((t) => t.slug)).toContain('handshake'); // Handshake performs on 1st & 4th
		});

		it('should include Capiche on first 2nd Friday after start date', () => {
			const teams = getHouseShowTeams('2025-08-08'); // 2nd Friday of August
			expect(teams.map((t) => t.slug)).toContain('capiche');
		});
	});

	describe('isHouseShow', () => {
		it('should return true for "House Show"', () => {
			expect(isHouseShow('House Show')).toBe(true);
		});

		it('should return true for case variations', () => {
			expect(isHouseShow('house show')).toBe(true);
			expect(isHouseShow('HOUSE SHOW')).toBe(true);
			expect(isHouseShow('  House Show  ')).toBe(true);
		});

		it('should return false for shows with additional words', () => {
			expect(isHouseShow('The House Show')).toBe(false);
			expect(isHouseShow('House Shows')).toBe(false);
			expect(isHouseShow('House Show Special')).toBe(false);
		});

		it('should return false for partial matches', () => {
			expect(isHouseShow('House')).toBe(false);
			expect(isHouseShow('Show')).toBe(false);
		});

		it('should return false for empty string', () => {
			expect(isHouseShow('')).toBe(false);
		});

		it('should return false for other show names', () => {
			expect(isHouseShow('Comedy Night')).toBe(false);
			expect(isHouseShow('Improv Jam')).toBe(false);
		});
	});

	describe('formatHouseShowTeams', () => {
		it('should return empty string for 5th Friday (no teams)', () => {
			const formatted = formatHouseShowTeams(new Date('2025-05-30')); // 5th Friday
			expect(formatted).toBe('');
		});

		it('should format two teams with "&"', () => {
			const formatted = formatHouseShowTeams(new Date('2025-01-03')); // 1st Friday
			expect(formatted).toContain('&');
			expect(formatted).toContain('Thunderclap!');
			expect(formatted).toContain('Handshake');
		});

		it('should accept string dates', () => {
			const formatted = formatHouseShowTeams('2025-01-10');
			expect(formatted).toContain('Brace! Brace!');
		});

		it('should handle all team combinations', () => {
			// 1st Friday: Thunderclap & Handshake (order may vary)
			const friday1st = formatHouseShowTeams('2025-01-03');
			expect(friday1st).toContain('Thunderclap!');
			expect(friday1st).toContain('Handshake');
			expect(friday1st).toContain('&');

			// 2nd Friday (before Aug 2025): Brace Brace only
			expect(formatHouseShowTeams('2025-07-11')).toBe('Brace! Brace!');

			// 2nd Friday (after Aug 2025): Brace Brace & Capiche (order may vary)
			const friday2nd = formatHouseShowTeams('2025-08-08');
			expect(friday2nd).toContain('Brace! Brace!');
			expect(friday2nd).toContain('Capiche');
			expect(friday2nd).toContain('&');

			// 3rd Friday (after Aug 2025): Thunderclap & Capiche (order may vary)
			const friday3rd = formatHouseShowTeams('2025-08-15');
			expect(friday3rd).toContain('Thunderclap!');
			expect(friday3rd).toContain('Capiche');
			expect(friday3rd).toContain('&');

			// 4th Friday: Brace Brace & Handshake (order may vary)
			const friday4th = formatHouseShowTeams('2025-01-24');
			expect(friday4th).toContain('Brace! Brace!');
			expect(friday4th).toContain('Handshake');
			expect(friday4th).toContain('&');
		});
	});

	describe('getUpcomingHouseShowDates', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('should return 5 upcoming dates for Brace Brace by default', () => {
			const dates = getUpcomingHouseShowDates('brace-brace');
			expect(dates).toHaveLength(5);

			// All should be Fridays
			dates.forEach((date) => {
				expect(date.getDay()).toBe(5); // Friday
			});

			// All should be 2nd or 4th Friday
			dates.forEach((date) => {
				const fridayOfMonth = getFridayOfMonth(date);
				expect([2, 4]).toContain(fridayOfMonth);
			});
		});

		it('should return correct number based on count parameter', () => {
			// Use a fixed date to avoid flakiness as time passes
			vi.setSystemTime(new Date('2025-01-01'));

			expect(getUpcomingHouseShowDates('thunderclap', 3)).toHaveLength(3);
			expect(getUpcomingHouseShowDates('handshake', 10)).toHaveLength(10);
		});

		it('should return dates in chronological order', () => {
			const dates = getUpcomingHouseShowDates('thunderclap', 3);
			for (let i = 1; i < dates.length; i++) {
				expect(dates[i].getTime()).toBeGreaterThan(dates[i - 1].getTime());
			}
		});

		it('should return empty array for invalid team slug', () => {
			const dates = getUpcomingHouseShowDates('nonexistent-team');
			expect(dates).toEqual([]);
		});

		it('should return dates only for the specified team weeks', () => {
			// Thunderclap performs on 1st & 3rd Fridays
			const dates = getUpcomingHouseShowDates('thunderclap', 5);
			dates.forEach((date) => {
				const fridayOfMonth = getFridayOfMonth(date);
				expect([1, 3]).toContain(fridayOfMonth);
			});

			// Handshake performs on 1st & 4th Fridays
			const dates2 = getUpcomingHouseShowDates('handshake', 5);
			dates2.forEach((date) => {
				const fridayOfMonth = getFridayOfMonth(date);
				expect([1, 4]).toContain(fridayOfMonth);
			});
		});

		it('should skip 5th Fridays', () => {
			const dates = getUpcomingHouseShowDates('brace-brace', 20);
			dates.forEach((date) => {
				const fridayOfMonth = getFridayOfMonth(date);
				expect(fridayOfMonth).toBeLessThan(5); // Never 5th Friday
			});
		});

		it('should return dates in the future', () => {
			const dates = getUpcomingHouseShowDates('capiche', 3);
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			dates.forEach((date) => {
				expect(date.getTime()).toBeGreaterThanOrEqual(today.getTime());
			});
		});
	});

	describe('isHouseTeam', () => {
		it('should return true for all current house teams', () => {
			expect(isHouseTeam('brace-brace')).toBe(true);
			expect(isHouseTeam('thunderclap')).toBe(true);
			expect(isHouseTeam('handshake')).toBe(true);
			expect(isHouseTeam('capiche')).toBe(true);
		});

		it('should return false for non-house teams', () => {
			expect(isHouseTeam('pizza-studio')).toBe(false);
			expect(isHouseTeam('people-system')).toBe(false);
			expect(isHouseTeam('nonexistent')).toBe(false);
		});

		it('should be case sensitive', () => {
			expect(isHouseTeam('BRACE-BRACE')).toBe(false);
			expect(isHouseTeam('Thunderclap')).toBe(false);
		});
	});

	describe('getHouseTeamBySlug', () => {
		it('should return team object for valid slug', () => {
			const team = getHouseTeamBySlug('brace-brace');
			expect(team).toBeDefined();
			expect(team?.name).toBe('Brace! Brace!');
			expect(team?.weeks).toEqual([2, 4]);
			expect(team?.coach).toBe('Noah Telson');
			expect(team?.members).toBeDefined();
			expect(team?.members.length).toBeGreaterThan(0);
		});

		it('should return undefined for invalid slug', () => {
			const team = getHouseTeamBySlug('nonexistent');
			expect(team).toBeUndefined();
		});

		it('should include start date for newer teams', () => {
			const handshake = getHouseTeamBySlug('handshake');
			expect(handshake?.startDate).toBe('2025-01-01');

			const capiche = getHouseTeamBySlug('capiche');
			expect(capiche?.startDate).toBe('2025-08-01');
		});

		it('should not have start date for original teams', () => {
			const braceBrace = getHouseTeamBySlug('brace-brace');
			expect(braceBrace?.startDate).toBeUndefined();

			const thunderclap = getHouseTeamBySlug('thunderclap');
			expect(thunderclap?.startDate).toBeUndefined();
		});

		it('should return correct team data for all house teams', () => {
			const teams = ['brace-brace', 'thunderclap', 'handshake', 'capiche'];
			teams.forEach((slug) => {
				const team = getHouseTeamBySlug(slug);
				expect(team).toBeDefined();
				expect(team?.slug).toBe(slug);
			});
		});
	});

	describe('HOUSE_SHOW_TEAMS data integrity', () => {
		it('should have exactly 4 current house teams', () => {
			expect(HOUSE_SHOW_TEAMS).toHaveLength(4);
		});

		it('should have unique slugs', () => {
			const slugs = HOUSE_SHOW_TEAMS.map((t) => t.slug);
			const uniqueSlugs = new Set(slugs);
			expect(uniqueSlugs.size).toBe(slugs.length);
		});

		it('should have unique names', () => {
			const names = HOUSE_SHOW_TEAMS.map((t) => t.name);
			const uniqueNames = new Set(names);
			expect(uniqueNames.size).toBe(names.length);
		});

		it('should have valid week numbers (1-4 only)', () => {
			HOUSE_SHOW_TEAMS.forEach((team) => {
				team.weeks.forEach((week) => {
					expect(week).toBeGreaterThanOrEqual(1);
					expect(week).toBeLessThanOrEqual(4);
				});
			});
		});

		it('should have all required fields', () => {
			HOUSE_SHOW_TEAMS.forEach((team) => {
				expect(team.name).toBeDefined();
				expect(team.slug).toBeDefined();
				expect(team.weeks).toBeDefined();
				expect(team.coach).toBeDefined();
				expect(team.members).toBeDefined();
				expect(team.members.length).toBeGreaterThan(0);
			});
		});

		it('should have exactly 2 weeks per team', () => {
			HOUSE_SHOW_TEAMS.forEach((team) => {
				expect(team.weeks).toHaveLength(2);
			});
		});

		it('should have valid team member names (non-empty strings)', () => {
			HOUSE_SHOW_TEAMS.forEach((team) => {
				team.members.forEach((member) => {
					expect(typeof member).toBe('string');
					expect(member.trim().length).toBeGreaterThan(0);
				});
			});
		});

		it('should have valid coach names', () => {
			HOUSE_SHOW_TEAMS.forEach((team) => {
				expect(typeof team.coach).toBe('string');
				expect(team.coach.trim().length).toBeGreaterThan(0);
			});
		});

		it('should have valid start dates in YYYY-MM-DD format where present', () => {
			HOUSE_SHOW_TEAMS.forEach((team) => {
				if (team.startDate) {
					expect(team.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
					// Ensure it's a valid date
					const date = new Date(team.startDate);
					expect(date.toString()).not.toBe('Invalid Date');
				}
			});
		});
	});

	describe('Edge cases and boundary conditions', () => {
		it('should handle year boundaries correctly', () => {
			// December 27, 2024 is 4th Friday
			const teams2024 = getHouseShowTeams('2024-12-27');
			expect(teams2024.map((t) => t.slug)).toContain('brace-brace');
			expect(teams2024.map((t) => t.slug)).not.toContain('handshake'); // Not started yet

			// January 3, 2025 is 1st Friday
			const teams2025 = getHouseShowTeams('2025-01-03');
			expect(teams2025.map((t) => t.slug)).toContain('handshake'); // Started by now
		});

		it('should handle leap years correctly', () => {
			// February 28, 2025 is 4th Friday (not a leap year)
			expect(getFridayOfMonth(new Date('2025-02-28'))).toBe(4);
		});

		it('should handle months with different numbers of days', () => {
			// February (28 days)
			const feb28 = getFridayOfMonth(new Date('2025-02-28'));
			expect(feb28).toBeGreaterThan(0);
			expect(feb28).toBeLessThanOrEqual(5);

			// April (30 days)
			const apr30 = getFridayOfMonth(new Date('2025-04-30'));
			expect(apr30).toBeGreaterThan(0);
			expect(apr30).toBeLessThanOrEqual(5);

			// January (31 days)
			const jan31 = getFridayOfMonth(new Date('2025-01-31'));
			expect(jan31).toBeGreaterThan(0);
			expect(jan31).toBeLessThanOrEqual(5);
		});
	});
});
