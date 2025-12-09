/**
 * House Show team rotation logic
 *
 * The House Show features 4 rotating teams on specific Fridays:
 * - Brace! Brace! (2nd & 4th Fridays)
 * - Handshake (1st & 4th Fridays)
 * - Capiche (2nd & 3rd Fridays)
 * - Thunderclap! (1st & 3rd Fridays)
 */

export interface HouseTeam {
	name: string;
	slug: string;
	weeks: number[];
	coach: string;
	members: string[];
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
			'Simone O\'Donovan',
			'Tina Marie Serra',
			'Zoe Langer'
		]
	},
	{
		name: 'Handshake',
		slug: 'handshake',
		weeks: [1, 4],
		coach: 'Josh Telson',
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
			'Adrian Doonan',
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
 */
export function getHouseShowTeams(date: Date | string): HouseTeam[] {
	const d = typeof date === 'string' ? new Date(date) : date;
	const fridayOfMonth = getFridayOfMonth(d);

	return HOUSE_SHOW_TEAMS.filter(team => team.weeks.includes(fridayOfMonth));
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
	return teams.map(t => t.name).join(' & ');
}
