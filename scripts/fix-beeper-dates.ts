import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN
});

interface ParsedShow {
	title: string;
	date: string; // YYYY-MM-DD
	time: string; // HH:MM
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const MONTH_NAMES: Record<string, number> = {
	january: 0,
	jan: 0,
	february: 1,
	feb: 1,
	march: 2,
	mar: 2,
	april: 3,
	apr: 3,
	may: 4,
	june: 5,
	jun: 5,
	july: 6,
	jul: 6,
	august: 7,
	aug: 7,
	september: 8,
	sep: 8,
	sept: 8,
	october: 9,
	oct: 9,
	november: 10,
	nov: 10,
	december: 11,
	dec: 11
};

function parseMessageDate(header: string): Date | null {
	// ## Aug 19, 2024 or ## Dec 9, 2024
	const match = header.match(/##\s+(\w+)\s+(\d+),?\s+(\d{4})/);
	if (!match) return null;

	const [, monthStr, day, year] = match;
	const month = MONTH_NAMES[monthStr.toLowerCase()];
	if (month === undefined) return null;

	return new Date(parseInt(year), month, parseInt(day));
}

function parseDayHeader(
	line: string
): { dayOfWeek: number; explicitDate?: { month: number; day: number } } | null {
	// Clean up the line
	const cleaned = line.replace(/\*/g, '').replace(/:/g, '').trim().toLowerCase();

	// Try to find day of week
	for (let i = 0; i < DAYS_OF_WEEK.length; i++) {
		if (cleaned.startsWith(DAYS_OF_WEEK[i])) {
			// Check for explicit date like "wednesday, august 21st"
			const dateMatch = cleaned.match(/(\w+)\s+(\d+)/);
			if (dateMatch) {
				const month = MONTH_NAMES[dateMatch[1]];
				if (month !== undefined) {
					const day = parseInt(dateMatch[2]);
					return { dayOfWeek: i, explicitDate: { month, day } };
				}
			}
			return { dayOfWeek: i };
		}
	}
	return null;
}

function getNextDayOfWeek(fromDate: Date, targetDayOfWeek: number): Date {
	const result = new Date(fromDate);
	const currentDay = fromDate.getDay();
	let daysToAdd = targetDayOfWeek - currentDay;

	// If target day is same as or before current day, add a week
	if (daysToAdd <= 0) {
		daysToAdd += 7;
	}

	result.setDate(result.getDate() + daysToAdd);
	return result;
}

function formatDate(date: Date): string {
	return date.toISOString().split('T')[0];
}

function parseShowLine(line: string): { title: string; time: string } | null {
	const cleaned = line.trim();
	if (!cleaned) return null;

	// Various formats:
	// "8:00 PM - Show Title"
	// "8:00pm: Show Title"
	// "8:00pm Show Title"
	// "Show Title - 8:00 PM - 9:00 PM"
	// "Show Title: 8:00 PM"

	// Try to extract time (8:00 PM, 8:00pm, 20:00, etc.)
	const timePatterns = [/(\d{1,2}):(\d{2})\s*(pm|am)?/i];

	let timeMatch = null;
	let time24 = '';

	for (const pattern of timePatterns) {
		timeMatch = cleaned.match(pattern);
		if (timeMatch) break;
	}

	if (!timeMatch) return null;

	let hours = parseInt(timeMatch[1]);
	const minutes = timeMatch[2];
	const ampm = timeMatch[3]?.toLowerCase();

	// Convert to 24-hour format
	if (ampm === 'pm' && hours !== 12) {
		hours += 12;
	} else if (ampm === 'am' && hours === 12) {
		hours = 0;
	}

	time24 = `${hours.toString().padStart(2, '0')}:${minutes}`;

	// Extract title - remove time portion
	let title = cleaned
		.replace(/\d{1,2}:\d{2}\s*(pm|am)?(\s*-\s*\d{1,2}:\d{2}\s*(pm|am)?)?/gi, '')
		.replace(/^\s*[-:]\s*/, '')
		.replace(/\s*[-:]\s*$/, '')
		.replace(/\(\d+€\)/g, '')
		.replace(/\(Free\)/gi, '')
		.trim();

	if (!title) return null;

	return { title, time: time24 };
}

function generateSlug(date: string, title: string): string {
	const titleSlug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
	return `${date}-${titleSlug}`;
}

async function main() {
	const filePath = path.join(__dirname, '../src/data/beeper-export-raw.txt');
	const content = fs.readFileSync(filePath, 'utf-8');
	const lines = content.split('\n');

	const shows: ParsedShow[] = [];
	let currentMessageDate: Date | null = null;
	let currentShowDate: Date | null = null;

	for (const line of lines) {
		// Check for message date header
		if (line.startsWith('##')) {
			currentMessageDate = parseMessageDate(line);
			currentShowDate = null;
			continue;
		}

		// Skip if no message date context
		if (!currentMessageDate) continue;

		// Check for day header
		const dayInfo = parseDayHeader(line);
		if (dayInfo) {
			if (dayInfo.explicitDate) {
				// Use explicit date with year from message
				currentShowDate = new Date(
					currentMessageDate.getFullYear(),
					dayInfo.explicitDate.month,
					dayInfo.explicitDate.day
				);
			} else {
				// Calculate date from day of week
				currentShowDate = getNextDayOfWeek(currentMessageDate, dayInfo.dayOfWeek);
			}
			continue;
		}

		// Skip if no show date context
		if (!currentShowDate) continue;

		// Try to parse as show line
		const show = parseShowLine(line);
		if (show) {
			shows.push({
				title: show.title,
				date: formatDate(currentShowDate),
				time: show.time
			});
		}
	}

	console.log(`Parsed ${shows.length} shows from Beeper export`);

	// Show some examples
	console.log('\nFirst 10 shows:');
	shows.slice(0, 10).forEach((s) => console.log(`  ${s.date} ${s.time} - ${s.title}`));

	console.log('\nLast 10 shows:');
	shows.slice(-10).forEach((s) => console.log(`  ${s.date} ${s.time} - ${s.title}`));

	// Now update the database
	console.log('\n--- Updating database ---');

	// First, delete all beeper shows (we'll re-insert with correct dates)
	const deleteResult = await db.execute("DELETE FROM shows WHERE source = 'beeper'");
	console.log(`Deleted ${deleteResult.rowsAffected} existing beeper shows`);

	// Also delete orphaned show_appearances
	await db.execute(`
		DELETE FROM show_appearances
		WHERE show_id NOT IN (SELECT id FROM shows)
	`);

	// Insert shows with correct dates
	let inserted = 0;
	for (const show of shows) {
		const slug = generateSlug(show.date, show.title);
		await db.execute({
			sql: `INSERT INTO shows (title, date, time, source, slug) VALUES (?, ?, ?, 'beeper', ?)`,
			args: [show.title, show.date, show.time, slug]
		});
		inserted++;
	}

	console.log(`Inserted ${inserted} shows with corrected dates`);

	// Verify
	const verification = await db.execute(`
		SELECT date, COUNT(*) as count
		FROM shows
		WHERE source = 'beeper' AND date >= '2025-12-01'
		GROUP BY date
		ORDER BY date
	`);
	console.log('\nDecember 2025 shows by date:');
	verification.rows.forEach((r) => console.log(`  ${r.date}: ${r.count} shows`));
}

main().catch(console.error);
