import { describe, it, expect } from 'vitest';
import {
	groupByRole,
	groupByTeam,
	getRoleOrder,
	getRoleLabel,
	type Performer
} from './lineupGrouping';

// Test data helpers
function createPerformer(overrides: Partial<Performer> = {}): Performer {
	return {
		performer_id: 1,
		performer_name: 'John Doe',
		performer_slug: 'john-doe',
		performer_image_url: null,
		role: 'performer',
		team_name: null,
		team_slug: null,
		...overrides
	};
}

describe('lineupGrouping utilities', () => {
	describe('groupByRole', () => {
		it('should return empty object for empty lineup', () => {
			const result = groupByRole([]);
			expect(result).toEqual({});
		});

		it('should group performers by single role', () => {
			const lineup = [
				createPerformer({ performer_id: 1, performer_name: 'Alice', role: 'performer' }),
				createPerformer({ performer_id: 2, performer_name: 'Bob', role: 'performer' })
			];

			const result = groupByRole(lineup);

			expect(result).toHaveProperty('performer');
			expect(result.performer).toHaveLength(2);
			expect(result.performer[0].performer_name).toBe('Alice');
			expect(result.performer[1].performer_name).toBe('Bob');
		});

		it('should group performers by multiple roles', () => {
			const lineup = [
				createPerformer({ performer_id: 1, performer_name: 'Alice', role: 'host' }),
				createPerformer({ performer_id: 2, performer_name: 'Bob', role: 'performer' }),
				createPerformer({ performer_id: 3, performer_name: 'Charlie', role: 'guest' }),
				createPerformer({ performer_id: 4, performer_name: 'Diana', role: 'performer' })
			];

			const result = groupByRole(lineup);

			expect(Object.keys(result)).toHaveLength(3);
			expect(result.host).toHaveLength(1);
			expect(result.performer).toHaveLength(2);
			expect(result.guest).toHaveLength(1);
			expect(result.host[0].performer_name).toBe('Alice');
			expect(result.guest[0].performer_name).toBe('Charlie');
		});

		it('should default null role to performer', () => {
			const lineup = [createPerformer({ performer_id: 1, performer_name: 'Alice', role: '' })];

			const result = groupByRole(lineup);

			expect(result).toHaveProperty('performer');
			expect(result.performer).toHaveLength(1);
		});

		it('should preserve all performer properties', () => {
			const lineup = [
				createPerformer({
					performer_id: 1,
					performer_name: 'Alice',
					performer_slug: 'alice',
					performer_image_url: 'https://example.com/alice.jpg',
					role: 'host',
					team_name: 'Team A',
					team_slug: 'team-a'
				})
			];

			const result = groupByRole(lineup);

			expect(result.host[0]).toEqual(lineup[0]);
		});
	});

	describe('groupByTeam', () => {
		it('should return empty array for empty performers list', () => {
			const result = groupByTeam([]);
			expect(result).toEqual([]);
		});

		it('should group performers by team', () => {
			const performers = [
				createPerformer({
					performer_id: 1,
					performer_name: 'Alice',
					team_name: 'Team A',
					team_slug: 'team-a'
				}),
				createPerformer({
					performer_id: 2,
					performer_name: 'Bob',
					team_name: 'Team A',
					team_slug: 'team-a'
				}),
				createPerformer({
					performer_id: 3,
					performer_name: 'Charlie',
					team_name: 'Team B',
					team_slug: 'team-b'
				})
			];

			const result = groupByTeam(performers);

			expect(result).toHaveLength(2);
			const teamA = result.find((g) => g.team_slug === 'team-a');
			const teamB = result.find((g) => g.team_slug === 'team-b');

			expect(teamA).toBeDefined();
			expect(teamA!.performers).toHaveLength(2);
			expect(teamA!.team_name).toBe('Team A');

			expect(teamB).toBeDefined();
			expect(teamB!.performers).toHaveLength(1);
			expect(teamB!.team_name).toBe('Team B');
		});

		it('should group unaffiliated performers at the end', () => {
			const performers = [
				createPerformer({
					performer_id: 1,
					performer_name: 'Alice',
					team_name: 'Team A',
					team_slug: 'team-a'
				}),
				createPerformer({
					performer_id: 2,
					performer_name: 'Bob',
					team_name: null,
					team_slug: null
				})
			];

			const result = groupByTeam(performers);

			expect(result).toHaveLength(2);
			// Last group should be unaffiliated performers
			const lastGroup = result[result.length - 1];
			expect(lastGroup.team_name).toBeNull();
			expect(lastGroup.team_slug).toBeNull();
			expect(lastGroup.performers).toHaveLength(1);
			expect(lastGroup.performers[0].performer_name).toBe('Bob');
		});

		it('should handle all performers without teams', () => {
			const performers = [
				createPerformer({ performer_id: 1, performer_name: 'Alice' }),
				createPerformer({ performer_id: 2, performer_name: 'Bob' })
			];

			const result = groupByTeam(performers);

			expect(result).toHaveLength(1);
			expect(result[0].team_name).toBeNull();
			expect(result[0].performers).toHaveLength(2);
		});

		it('should handle performers with only team_name (no slug)', () => {
			const performers = [
				createPerformer({
					performer_id: 1,
					performer_name: 'Alice',
					team_name: 'Team A',
					team_slug: null
				}),
				createPerformer({
					performer_id: 2,
					performer_name: 'Bob',
					team_name: 'Team A',
					team_slug: null
				})
			];

			const result = groupByTeam(performers);

			expect(result).toHaveLength(1);
			expect(result[0].team_name).toBe('Team A');
			expect(result[0].team_slug).toBeNull();
			expect(result[0].performers).toHaveLength(2);
		});

		it('should not include unaffiliated group if all have teams', () => {
			const performers = [
				createPerformer({
					performer_id: 1,
					performer_name: 'Alice',
					team_name: 'Team A',
					team_slug: 'team-a'
				})
			];

			const result = groupByTeam(performers);

			expect(result).toHaveLength(1);
			expect(result[0].team_name).toBe('Team A');
		});
	});

	describe('getRoleOrder', () => {
		it('should return role order array', () => {
			const order = getRoleOrder();
			expect(order).toEqual(['host', 'performer', 'guest', 'coach']);
		});

		it('should return readonly array', () => {
			const order = getRoleOrder();
			// TypeScript should prevent mutation, but we can verify it's an array
			expect(Array.isArray(order)).toBe(true);
		});
	});

	describe('getRoleLabel', () => {
		it('should return correct label for host', () => {
			expect(getRoleLabel('host')).toBe('Hosted by');
		});

		it('should return correct label for performer', () => {
			expect(getRoleLabel('performer')).toBe('Performers');
		});

		it('should return correct label for guest', () => {
			expect(getRoleLabel('guest')).toBe('Special Guests');
		});

		it('should return correct label for coach', () => {
			expect(getRoleLabel('coach')).toBe('Coached by');
		});

		it('should return role name for unknown role', () => {
			expect(getRoleLabel('unknown')).toBe('unknown');
			expect(getRoleLabel('musician')).toBe('musician');
		});

		it('should handle empty string', () => {
			expect(getRoleLabel('')).toBe('');
		});
	});

	// Integration tests
	describe('integration', () => {
		it('should group and label performers correctly', () => {
			const lineup = [
				createPerformer({ performer_id: 1, performer_name: 'Alice', role: 'host' }),
				createPerformer({ performer_id: 2, performer_name: 'Bob', role: 'performer' }),
				createPerformer({ performer_id: 3, performer_name: 'Charlie', role: 'performer' })
			];

			const grouped = groupByRole(lineup);
			const roleOrder = getRoleOrder();

			// Verify we can iterate in correct order
			const orderedRoles = roleOrder.filter((role) => grouped[role]);
			expect(orderedRoles).toEqual(['host', 'performer']);

			// Verify labels
			expect(getRoleLabel(orderedRoles[0])).toBe('Hosted by');
			expect(getRoleLabel(orderedRoles[1])).toBe('Performers');
		});

		it('should group by role then team within role', () => {
			const lineup = [
				createPerformer({
					performer_id: 1,
					performer_name: 'Alice',
					role: 'performer',
					team_name: 'Team A',
					team_slug: 'team-a'
				}),
				createPerformer({
					performer_id: 2,
					performer_name: 'Bob',
					role: 'performer',
					team_name: 'Team B',
					team_slug: 'team-b'
				}),
				createPerformer({
					performer_id: 3,
					performer_name: 'Charlie',
					role: 'performer',
					team_name: null,
					team_slug: null
				})
			];

			const byRole = groupByRole(lineup);
			const performers = byRole.performer;
			const byTeam = groupByTeam(performers);

			expect(byTeam).toHaveLength(3); // 2 teams + 1 unaffiliated
			expect(byTeam[byTeam.length - 1].team_name).toBeNull(); // Last is unaffiliated
		});
	});
});
