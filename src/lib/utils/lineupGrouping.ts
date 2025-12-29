/**
 * Lineup grouping utilities for show performer organization
 */

// Type definitions
export interface Performer {
	performer_id: number;
	performer_name: string;
	performer_slug: string;
	performer_image_url: string | null;
	role: string;
	team_name: string | null;
	team_slug: string | null;
}

export interface TeamGroup {
	team_name: string | null;
	team_slug: string | null;
	performers: Performer[];
}

/**
 * Role display order (determines order in UI)
 */
const ROLE_ORDER = ['host', 'performer', 'guest', 'coach'] as const;

/**
 * Human-readable role labels
 */
const ROLE_LABELS: Record<string, string> = {
	host: 'Hosted by',
	performer: 'Performers',
	guest: 'Special Guests',
	coach: 'Coached by'
};

/**
 * Group performers by their role
 * @param lineup - Array of performers with roles
 * @returns Object mapping role to array of performers
 */
export function groupByRole(lineup: Performer[]): Record<string, Performer[]> {
	const groups: Record<string, Performer[]> = {};
	for (const p of lineup) {
		const role = p.role || 'performer';
		if (!groups[role]) groups[role] = [];
		groups[role].push(p);
	}
	return groups;
}

/**
 * Group performers by their team
 * Teams are listed first, then individual performers without teams
 * @param performers - Array of performers
 * @returns Array of team groups, with unaffiliated performers at the end
 */
export function groupByTeam(performers: Performer[]): TeamGroup[] {
	const teamMap = new Map<string, TeamGroup>();
	const noTeam: Performer[] = [];

	for (const p of performers) {
		if (p.team_name) {
			const key = p.team_slug || p.team_name;
			if (!teamMap.has(key)) {
				teamMap.set(key, { team_name: p.team_name, team_slug: p.team_slug, performers: [] });
			}
			teamMap.get(key)!.performers.push(p);
		} else {
			noTeam.push(p);
		}
	}

	// Teams first, then individual performers without teams
	const result: TeamGroup[] = [...teamMap.values()];
	if (noTeam.length > 0) {
		result.push({ team_name: null, team_slug: null, performers: noTeam });
	}
	return result;
}

/**
 * Get the display order for roles
 * @returns Array of role names in display order
 */
export function getRoleOrder(): readonly string[] {
	return ROLE_ORDER;
}

/**
 * Get human-readable label for a role
 * @param role - Role name (e.g., 'host', 'performer')
 * @returns Human-readable label (e.g., 'Hosted by', 'Performers')
 */
export function getRoleLabel(role: string): string {
	return ROLE_LABELS[role] || role;
}
