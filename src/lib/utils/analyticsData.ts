/**
 * Analytics data transformation utilities
 * Extracted from analytics page for reusability and testability
 */

// Type definitions
export interface AnalyticsData {
	stats: {
		totalShows: number;
		uniqueShows: number;
		firstDate: string;
		lastDate: string;
		performerCount: number;
		teamCount: number;
		showsWithLineup: number;
		monthsTracked: number;
	};
	topShows: { title: string; slug: string; count: number }[];
	dayDistribution: { day: string; count: number }[];
	monthlyActivity: { month: string; count: number }[];
	showVarietyPerMonth: { month: string; count: number; shows: string[] }[];
	longestRunningShows: {
		title: string;
		slug: string;
		firstDate: string;
		lastDate: string;
		iterations: number;
	}[];
	multiTeamPerformers: {
		id: number;
		name: string;
		slug: string;
		teams: string[];
		teamCount: number;
	}[];
	teamPairings: {
		team1: { id: number; name: string; slug: string };
		team2: { id: number; name: string; slug: string };
		sharedMembers: number;
		performers: string[];
	}[];
	rookies: { id: number; name: string; slug: string; debutDate: string; showCount: number }[];
	topPerformers: { id: number; name: string; slug: string; showCount: number; teams: string[] }[];
	topTeams: { id: number; name: string; slug: string; showCount: number; memberCount: number }[];
	availableYears: string[];
}

export interface MaxValues {
	maxShowCount: number;
	maxPerformerCount: number;
	maxTeamCount: number;
	maxDayCount: number;
	maxMonthCount: number;
	maxVarietyCount: number;
	maxIterations: number;
	maxSharedMembers: number;
	maxMultiTeamCount: number;
}

export type ModalType =
	| 'shows'
	| 'performers'
	| 'teams'
	| 'dayDistribution'
	| 'monthlyActivity'
	| 'showVariety'
	| 'longestRunning'
	| 'teamOverlap'
	| 'multiTeam'
	| null;

/**
 * Calculate maximum values from analytics data for chart scaling
 * Returns 1 as minimum to avoid division by zero in percentage calculations
 */
export function calculateMaxValues(data: AnalyticsData | null): MaxValues {
	if (!data) {
		return {
			maxShowCount: 1,
			maxPerformerCount: 1,
			maxTeamCount: 1,
			maxDayCount: 1,
			maxMonthCount: 1,
			maxVarietyCount: 1,
			maxIterations: 1,
			maxSharedMembers: 1,
			maxMultiTeamCount: 1
		};
	}

	return {
		maxShowCount: data.topShows[0]?.count || 1,
		maxPerformerCount: data.topPerformers[0]?.showCount || 1,
		maxTeamCount: data.topTeams[0]?.showCount || 1,
		maxDayCount: Math.max(...data.dayDistribution.map((d) => d.count), 1),
		maxMonthCount: Math.max(...data.monthlyActivity.map((m) => m.count), 1),
		maxVarietyCount: Math.max(...data.showVarietyPerMonth.map((m) => m.count), 1),
		maxIterations: data.longestRunningShows[0]?.iterations || 1,
		maxSharedMembers: data.teamPairings[0]?.sharedMembers || 1,
		maxMultiTeamCount: data.multiTeamPerformers[0]?.teamCount || 1
	};
}

/**
 * Order days of week correctly (Sunday to Saturday)
 * Sorts day distribution data to match calendar week order
 */
export function orderDaysByWeek(
	days: { day: string; count: number }[]
): { day: string; count: number }[] {
	const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	return days.toSorted((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));
}

/**
 * Get human-readable title for modal type
 */
export function getModalTitle(type: ModalType): string {
	if (type === null) return '';

	const modalTitles: Record<Exclude<ModalType, null>, string> = {
		shows: 'TOP SHOWS',
		performers: 'TOP PERFORMERS',
		teams: 'TOP TEAMS',
		longestRunning: 'LONGEST RUNNING',
		multiTeam: 'MULTI-TEAM PERFORMERS',
		teamOverlap: 'TEAM OVERLAP',
		dayDistribution: 'SHOWS BY DAY',
		monthlyActivity: 'SHOWS PER MONTH',
		showVariety: 'SHOW VARIETY'
	};

	return modalTitles[type];
}
