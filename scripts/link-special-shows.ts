/**
 * Link shows where team name doesn't appear in the title
 * These require manual mapping based on show knowledge
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars
function loadEnv() {
	const envPath = path.join(process.cwd(), '.env');
	if (fs.existsSync(envPath)) {
		const content = fs.readFileSync(envPath, 'utf-8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) {
				const [key, ...valueParts] = trimmed.split('=');
				const value = valueParts.join('=').replace(/^["']|["']$/g, '');
				if (key && !process.env[key]) {
					process.env[key] = value;
				}
			}
		}
	}
}

loadEnv();

const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN
});

interface ShowTeamMapping {
	titlePattern: string;
	teamSlug: string;
	dateFilter?: {
		after?: string;
		before?: string;
		dayOfWeek?: number; // 0 = Sunday, 4 = Thursday
	};
}

// Special mappings where show title != team name
const SPECIAL_MAPPINGS: ShowTeamMapping[] = [
	// The Salon is performed by Haircut
	{
		titlePattern: '%The Salon%',
		teamSlug: 'haircut'
	},
	// The Hedge is hosted by Cuter Than Hedgehogs (at least Thursdays)
	{
		titlePattern: '%The Hedge%',
		teamSlug: 'cuter-than-hedgehogs',
		dateFilter: { dayOfWeek: 4 } // Thursdays only
	},
	// Improvylicious Jam is always hosted by Destiny's Step Child
	{
		titlePattern: '%Improvylicious%',
		teamSlug: 'destinys-step-child'
	}
	// Truth Night rotates - need to handle separately with dates
];

async function main() {
	let linkedShows = 0;
	let linkedAppearances = 0;

	console.log('Linking special show-team mappings...\n');

	for (const mapping of SPECIAL_MAPPINGS) {
		// Get team
		const teamResult = await db.execute({
			sql: 'SELECT id, name FROM teams WHERE slug = ?',
			args: [mapping.teamSlug]
		});

		if (teamResult.rows.length === 0) {
			console.log(`❌ Team not found: ${mapping.teamSlug}`);
			continue;
		}

		const team = teamResult.rows[0];
		const teamId = team.id as number;
		const teamName = team.name as string;

		// Build query for shows
		let sql = `
			SELECT s.id, s.title, s.date
			FROM shows s
			WHERE s.title LIKE ?
			AND s.id NOT IN (
				SELECT DISTINCT show_id
				FROM show_appearances
				WHERE team_id = ?
			)
		`;
		const args: any[] = [mapping.titlePattern, teamId];

		// Add date filters if specified
		if (mapping.dateFilter) {
			if (mapping.dateFilter.after) {
				sql += ' AND s.date >= ?';
				args.push(mapping.dateFilter.after);
			}
			if (mapping.dateFilter.before) {
				sql += ' AND s.date <= ?';
				args.push(mapping.dateFilter.before);
			}
		}

		sql += ' ORDER BY s.date DESC';

		const showsResult = await db.execute({ sql, args });

		// Filter by day of week if specified
		let shows = showsResult.rows;
		if (mapping.dateFilter?.dayOfWeek !== undefined) {
			shows = shows.filter((show) => {
				const date = new Date(show.date as string);
				return date.getDay() === mapping.dateFilter!.dayOfWeek;
			});
		}

		if (shows.length === 0) {
			console.log(`${teamName} → ${mapping.titlePattern}: No shows to link`);
			continue;
		}

		console.log(`\n${teamName} → ${mapping.titlePattern}: ${shows.length} shows to link`);

		// Get team members
		const membersResult = await db.execute({
			sql: 'SELECT performer_id FROM team_members WHERE team_id = ? AND is_former = 0',
			args: [teamId]
		});

		if (membersResult.rows.length === 0) {
			console.log(`  ⚠️ No current members for ${teamName}`);
			continue;
		}

		// Link each show
		for (const show of shows) {
			console.log(`  Linking: ${show.date} - ${show.title}`);

			for (const member of membersResult.rows) {
				await db.execute({
					sql: 'INSERT INTO show_appearances (show_id, performer_id, role, team_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
					args: [show.id, member.performer_id, 'performer', teamId]
				});
				linkedAppearances++;
			}
			linkedShows++;
		}
	}

	// Handle Truth Night rotation separately
	console.log('\n\n=== Truth Night (Rotating Hosts) ===');
	await linkTruthNight();

	console.log(`\n\n=== Results ===`);
	console.log(`Shows linked: ${linkedShows}`);
	console.log(`Appearances added: ${linkedAppearances}`);

	// Final counts
	const total = await db.execute('SELECT COUNT(*) as count FROM show_appearances');
	console.log(`Total show_appearances: ${total.rows[0].count}`);

	const showsWithLineup = await db.execute(
		'SELECT COUNT(DISTINCT show_id) as count FROM show_appearances'
	);
	console.log(`Shows with lineup: ${showsWithLineup.rows[0].count}`);
}

/**
 * Truth Night rotates between Full Fat Bear Milk and All-In Therapy
 * Pattern: Odd months (Jan, Mar, May, Jul, Sep, Nov) = Bear Milk
 *          Even months (Feb, Apr, Jun, Aug, Oct, Dec) = All-In Therapy
 */
async function linkTruthNight() {
	// Get all Truth Night shows that don't have team associations yet
	const shows = await db.execute({
		sql: `
			SELECT s.id, s.title, s.date
			FROM shows s
			WHERE s.title LIKE '%Truth Night%'
			AND s.id NOT IN (
				SELECT DISTINCT show_id
				FROM show_appearances
				WHERE team_id IS NOT NULL
			)
			ORDER BY s.date ASC
		`
	});

	console.log(`Found ${shows.rows.length} Truth Night shows to link`);

	// Get team IDs
	const bearMilkResult = await db.execute({
		sql: 'SELECT id FROM teams WHERE slug = ?',
		args: ['full-fat-bear-milk']
	});

	const allInTherapyResult = await db.execute({
		sql: 'SELECT id FROM teams WHERE slug = ?',
		args: ['all-in-therapy']
	});

	if (bearMilkResult.rows.length === 0 || allInTherapyResult.rows.length === 0) {
		console.log('❌ Teams not found for Truth Night');
		return;
	}

	const bearMilkId = bearMilkResult.rows[0].id as number;
	const allInTherapyId = allInTherapyResult.rows[0].id as number;

	let bearMilkCount = 0;
	let allInTherapyCount = 0;

	for (const show of shows.rows) {
		const date = new Date(show.date as string);
		const month = date.getMonth(); // 0 = January, 11 = December

		// Odd months (Jan=0, Mar=2, May=4, Jul=6, Sep=8, Nov=10) = Bear Milk (even indices!)
		// Even months (Feb=1, Apr=3, Jun=5, Aug=7, Oct=9, Dec=11) = All-In Therapy (odd indices!)
		const teamId = month % 2 === 0 ? bearMilkId : allInTherapyId;
		const teamName = month % 2 === 0 ? 'Full Fat Bear Milk' : 'All-In Therapy';

		const members = await db.execute({
			sql: 'SELECT performer_id FROM team_members WHERE team_id = ? AND is_former = 0',
			args: [teamId]
		});

		console.log(`  ${show.date} (${getMonthName(month)}) → ${teamName}`);

		for (const member of members.rows) {
			await db.execute({
				sql: 'INSERT INTO show_appearances (show_id, performer_id, role, team_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING',
				args: [show.id, member.performer_id, 'performer', teamId]
			});
		}

		if (month % 2 === 0) bearMilkCount++;
		else allInTherapyCount++;
	}

	console.log(
		`\n  ✅ Linked ${bearMilkCount} shows to Bear Milk, ${allInTherapyCount} to All-In Therapy`
	);
}

function getMonthName(month: number): string {
	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	return months[month];
}

main().catch(console.error);
