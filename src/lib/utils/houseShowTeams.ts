/**
 * House Show team rotation logic
 *
 * The House Show features 4 rotating teams on specific Fridays:
 * - Brace! Brace! (2nd & 4th Fridays) - original house team
 * - Handshake (1st & 4th Fridays) - started January 2025
 * - Capiche (2nd & 3rd Fridays) - started August 2025 (replaced Pizza Studio)
 * - Thunderclap! (1st & 3rd Fridays) - original house team
 */

export interface HouseTeam {
	name: string;
	slug: string;
	weeks: number[];
	coach: string;
	members: string[];
	startDate?: string; // YYYY-MM-DD - when team became a house team
}

export const HOUSE_SHOW_TEAMS: HouseTeam[] = [
	{
		name: 'Brace! Brace!',
		slug: 'brace-brace',
		weeks: [2, 4],
		coach: 'Noah Telson',
		members: [
			'Anita Waltho',
			'Georgia Riungu',
			'Jared Lorenzo',
			'Julia Lang',
			'Kathy MacLeod',
			'Keshia Fredua-Mensah',
			'Pip Roper',
			"Simone O'Donovan",
			'Tina Marie Serra',
			'Zoe Langer'
		]
	},
	{
		name: 'Handshake',
		slug: 'handshake',
		weeks: [1, 4],
		coach: 'Josh Telson',
		startDate: '2025-01-01', // Started January 2025
		members: [
			'AdibA',
			'Grant Selland',
			'Harry Haddon',
			'Katie Kerckaert',
			'Laura Kenny',
			'Lucrezia Villani',
			'Poppe',
			'Seema Iyer',
			'Theo Mason Wood'
		]
	},
	{
		name: 'Capiche',
		slug: 'capiche',
		weeks: [2, 3],
		coach: 'Antonia Bär',
		startDate: '2025-08-01', // Started August 2025 (replaced Pizza Studio)
		members: [
			'Adam Ferreira',
			'Evelyn Ferguson',
			'Harry Ritchie',
			'Ilana Ullman',
			'Jason Porter',
			'Marie-Laure Gagné',
			'Sonia Williams',
			'Terezie Fendrychova',
			'Tetiana Mulenko',
			'Vishal Bala'
		]
	},
	{
		name: 'Thunderclap!',
		slug: 'thunderclap',
		weeks: [1, 3],
		coach: 'Caroline Clifford',
		members: [
			'Adrian John Doonan',
			'Georg Kammerer',
			'Julie Millaud',
			'Konrad Duffy',
			'Lisa Gelbhardt',
			'Martina Tranström',
			'Muaaz Saleem',
			'Richie Murphy',
			'Theresa Robinson'
		]
	}
];

/**
 * Get which Friday of the month a date falls on (1-5)
 */
export function getFridayOfMonth(date: Date): number {
	const dayOfMonth = date.getDate();
	return Math.ceil(dayOfMonth / 7);
}

/**
 * Get which teams are performing at House Show for a given date
 * Takes into account when teams started (won't include teams before their start date)
 */
export function getHouseShowTeams(date: Date | string): HouseTeam[] {
	const d = typeof date === 'string' ? new Date(date) : date;
	const dateStr = d.toISOString().split('T')[0];
	const fridayOfMonth = getFridayOfMonth(d);

	return HOUSE_SHOW_TEAMS.filter((team) => {
		// Check if team performs on this Friday of month
		if (!team.weeks.includes(fridayOfMonth)) return false;
		// Check if team had started by this date
		if (team.startDate && dateStr < team.startDate) return false;
		return true;
	});
}

/**
 * Check if a show title is a House Show
 */
export function isHouseShow(title: string): boolean {
	return /^house show$/i.test(title.trim());
}

/**
 * Get team names as a formatted string
 */
export function formatHouseShowTeams(date: Date | string): string {
	const teams = getHouseShowTeams(date);
	if (teams.length === 0) return '';
	if (teams.length === 1) return teams[0].name;
	return teams.map((t) => t.name).join(' & ');
}

/**
 * Get upcoming House Show dates for a specific team
 * @param teamSlug - The slug of the team to find dates for
 * @param count - Number of upcoming dates to return (default: 5)
 * @returns Array of upcoming Friday dates when the team performs
 */
export function getUpcomingHouseShowDates(teamSlug: string, count = 5): Date[] {
	const team = HOUSE_SHOW_TEAMS.find((t) => t.slug === teamSlug);
	if (!team) return [];

	const dates: Date[] = [];
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// Start from the next Friday
	const current = new Date(today);
	const dayOfWeek = current.getDay();
	const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7; // 5 = Friday
	current.setDate(current.getDate() + daysUntilFriday);

	// Search through the next 20 weeks to find enough dates
	for (let i = 0; i < 20 && dates.length < count; i++) {
		const fridayOfMonth = getFridayOfMonth(current);
		if (team.weeks.includes(fridayOfMonth)) {
			dates.push(new Date(current));
		}
		current.setDate(current.getDate() + 7); // Move to next Friday
	}

	return dates;
}

/**
 * Check if a team is a house team
 */
export function isHouseTeam(teamSlug: string): boolean {
	return HOUSE_SHOW_TEAMS.some((t) => t.slug === teamSlug);
}

/**
 * Get house team by slug
 */
export function getHouseTeamBySlug(slug: string): HouseTeam | undefined {
	return HOUSE_SHOW_TEAMS.find((t) => t.slug === slug);
}
