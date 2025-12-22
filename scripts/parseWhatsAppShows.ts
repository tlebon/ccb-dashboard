/**
 * Parser for CCB WhatsApp export (_chat.txt format)
 * Format: [MM/DD/YY, HH:MM:SS] Sender: Message
 */

import { readFileSync, writeFileSync } from 'fs';
import { argv } from 'process';

interface Show {
	date: string; // ISO date string (YYYY-MM-DD)
	dayOfWeek: string; // e.g., "Wednesday"
	time: string; // e.g., "20:00"
	title: string; // Show name
	price?: string; // If mentioned
	hostedBy?: string; // For jams - "hosted by X"
}

interface ParsedMessage {
	timestamp: Date;
	sender: string;
	content: string;
}

// Parse WhatsApp timestamp: [8/19/24, 10:56:49]
function parseTimestamp(ts: string): Date | null {
	const match = ts.match(/\[(\d{1,2})\/(\d{1,2})\/(\d{2}),\s*(\d{1,2}):(\d{2}):(\d{2})\]/);
	if (!match) return null;

	const [, month, day, year, hour, min, sec] = match;
	const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);

	return new Date(
		fullYear,
		parseInt(month) - 1,
		parseInt(day),
		parseInt(hour),
		parseInt(min),
		parseInt(sec)
	);
}

// Parse day header: *Wednesday, August 21st* or *Wednesday* or *Friday, November 1*
function parseDayHeader(
	line: string
): { dayOfWeek: string; dayNum?: number; month?: string } | null {
	// Remove asterisks, bullets, and extra whitespace (WhatsApp bold/formatting)
	const clean = line.replace(/\*/g, '').replace(/•/g, '').trim();

	// Full format: "Wednesday, August 21st" or "Wednesday, Oct 16"
	const fullMatch = clean.match(
		/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?$/i
	);
	if (fullMatch) {
		return {
			dayOfWeek: fullMatch[1],
			month: fullMatch[2],
			dayNum: parseInt(fullMatch[3])
		};
	}

	// Reverse format: "SUNDAY 7th Sept" or "SUNDAY 2nd Nov"
	const reverseMatch = clean.match(
		/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)$/i
	);
	if (reverseMatch) {
		return {
			dayOfWeek: reverseMatch[1],
			dayNum: parseInt(reverseMatch[2]),
			month: reverseMatch[3]
		};
	}

	// Short format with date: "Wednesday, 26 Nov"
	const shortMatch = clean.match(
		/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\d{1,2})\s+(\w+)$/i
	);
	if (shortMatch) {
		return {
			dayOfWeek: shortMatch[1],
			dayNum: parseInt(shortMatch[2]),
			month: shortMatch[3]
		};
	}

	// Day only: "Wednesday" or "Wednesday:" or "WEDNESDAY"
	const dayOnly = clean.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):?$/i);
	if (dayOnly) {
		return { dayOfWeek: dayOnly[1] };
	}

	return null;
}

// Month name/abbrev to number
const MONTHS: Record<string, number> = {
	jan: 0,
	january: 0,
	feb: 1,
	february: 1,
	mar: 2,
	march: 2,
	apr: 3,
	april: 3,
	may: 4,
	jun: 5,
	june: 5,
	jul: 6,
	july: 6,
	aug: 7,
	august: 7,
	sep: 8,
	sept: 8,
	september: 8,
	oct: 9,
	october: 9,
	nov: 10,
	november: 10,
	dec: 11,
	december: 11
};

// Parse show line - handles multiple formats
function parseShowLine(
	line: string
): { time: string; title: string; price?: string; hostedBy?: string } | null {
	let time = '';
	let title = '';
	let price: string | undefined;
	let hostedBy: string | undefined;

	// Skip lines that look like timestamps [MM/DD/YY, HH:MM:SS]
	if (/^\[?\d{1,2}\/\d{1,2}\/\d{2}/.test(line) || /^\[\d/.test(line)) {
		return null;
	}

	// Skip lines that are just URLs or system messages
	if (/^https?:|^www\.|^‎|omitted|deleted|edited/i.test(line)) {
		return null;
	}

	// Skip garbage patterns
	if (/^Time:/i.test(line)) return null; // Workshop time info
	if (/^Sat,/i.test(line)) return null; // Workshop date format
	if (/^Sun,/i.test(line)) return null; // Workshop date format

	// Clean leading bullets and dashes
	line = line.replace(/^[•\-–]\s*/, '').trim();

	// Extract price if present
	const priceMatch = line.match(/\((\d+€|Free)\)/i);
	if (priceMatch) {
		price = priceMatch[1];
	}

	// Extract "hosted by" info
	const hostedMatch = line.match(/\((?:hosted by|Hosted by)\s+(.+?)\)/i);
	if (hostedMatch) {
		hostedBy = hostedMatch[1].trim();
	}

	// Clean line
	let clean = line.trim();

	// Format 6: "8:00 PM - 9:00 PM: Show Name" (time range with colon before show)
	// Must come first - it's more specific than Format 1
	let match = clean.match(
		/^(\d{1,2}):(\d{2})\s*(?:pm|am)?\s*[-–]\s*\d{1,2}:\d{2}\s*(?:pm|am)?:\s*(.+)$/i
	);
	if (match) {
		let hour = parseInt(match[1]);
		const min = match[2];
		if (/pm/i.test(clean) && hour < 12) hour += 12;
		time = `${hour.toString().padStart(2, '0')}:${min}`;
		title = match[3];
	}

	// Format 5: "20:00-21:00 - Show Name" (time range with hyphen, then show)
	if (!time) {
		match = clean.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*\d{1,2}:\d{2}\s*[-–]\s*(.+)$/i);
		if (match) {
			time = `${match[1].padStart(2, '0')}:${match[2]}`;
			title = match[3];
		}
	}

	// Format 1: "8:00 PM - Show Name" or "8:00pm - Show Name" or "8:00pm: Show Name"
	if (!time) {
		match = clean.match(/^(\d{1,2}):(\d{2})\s*(?:pm|am)?\s*[-:]\s*(.+)$/i);
		if (match) {
			let hour = parseInt(match[1]);
			const min = match[2];
			// Convert to 24h if PM
			if (/pm/i.test(clean) && hour < 12) hour += 12;
			if (/am/i.test(clean) && hour === 12) hour = 0;
			time = `${hour.toString().padStart(2, '0')}:${min}`;
			title = match[3];
		}
	}

	// Format 2: "8:00pm Show Name" (no separator)
	if (!time) {
		match = clean.match(/^(\d{1,2}):(\d{2})\s*(?:pm|am)?\s+(.+)$/i);
		if (match) {
			let hour = parseInt(match[1]);
			const min = match[2];
			if (/pm/i.test(clean) && hour < 12) hour += 12;
			time = `${hour.toString().padStart(2, '0')}:${min}`;
			title = match[3];
		}
	}

	// Format 3: "Show Name - 8:00 PM - 9:00 PM" or "Show Name: 8:00 PM - 9:00 PM"
	if (!time) {
		match = clean.match(
			/^(.+?)\s*[-:]\s*(\d{1,2}):(\d{2})\s*(?:pm|am)?(?:\s*[-–]\s*\d{1,2}:\d{2}\s*(?:pm|am)?)?/i
		);
		if (match) {
			let hour = parseInt(match[2]);
			const min = match[3];
			if (/pm/i.test(clean) && hour < 12) hour += 12;
			time = `${hour.toString().padStart(2, '0')}:${min}`;
			title = match[1];
		}
	}

	// Format 4: "Show Name 8:00 PM - 9:00 PM" (space before time, no separator)
	if (!time) {
		match = clean.match(/^(.+?)\s+(\d{1,2}):(\d{2})\s*(?:pm|am)?\s*[-–]\s*\d{1,2}:\d{2}/i);
		if (match) {
			let hour = parseInt(match[2]);
			const min = match[3];
			if (/pm/i.test(clean) && hour < 12) hour += 12;
			time = `${hour.toString().padStart(2, '0')}:${min}`;
			title = match[1];
		}
	}

	if (!time || !title) return null;

	// Validate time - must be 00:00 to 23:59
	const [hours, mins] = time.split(':').map(Number);
	if (hours > 23 || mins > 59) return null;

	// Clean title
	title = title
		.replace(/\s*[-–]\s*\d{1,2}:\d{2}.*$/i, '') // Remove end time
		.replace(/\s*\(\d+€\)/g, '') // Remove price
		.replace(/\s*\(Free\)/gi, '') // Remove (Free)
		.replace(/\s*\(hosted by\s+.+?\)/gi, '') // Remove hosted by (we captured it)
		.replace(/\s*\(Hosted by\s+.+?\)/gi, '')
		.trim();

	// Skip if title looks like a timestamp, time, or is garbage
	if (/^\[?\d{1,2}[\/:]/.test(title)) return null;
	if (/^\d{1,2}:\d{2}/.test(title)) return null;
	if (title.length < 3) return null;
	if (/^‎/.test(title)) return null; // WhatsApp special char

	return { time, title, price, hostedBy };
}

// Calculate actual date from message timestamp and day header info
function calculateDate(
	msgDate: Date,
	dayHeader: { dayOfWeek: string; dayNum?: number; month?: string }
): string {
	const dayMap: Record<string, number> = {
		sunday: 0,
		monday: 1,
		tuesday: 2,
		wednesday: 3,
		thursday: 4,
		friday: 5,
		saturday: 6
	};

	// If we have full date info, use it
	if (dayHeader.dayNum && dayHeader.month) {
		const monthNum = MONTHS[dayHeader.month.toLowerCase()];
		if (monthNum !== undefined) {
			// Use year from message timestamp, but adjust if month is in future
			let year = msgDate.getFullYear();
			if (monthNum > msgDate.getMonth() + 2) {
				year -= 1; // Probably referring to previous year
			}
			const date = new Date(year, monthNum, dayHeader.dayNum);
			return date.toISOString().split('T')[0];
		}
	}

	// Otherwise calculate from day of week relative to message date
	const targetDay = dayMap[dayHeader.dayOfWeek.toLowerCase()];
	if (targetDay === undefined) return '';

	// Find the next occurrence of this day of week from message date
	const msgDay = msgDate.getDay();
	let daysToAdd = targetDay - msgDay;
	if (daysToAdd < 0) daysToAdd += 7;

	const targetDate = new Date(msgDate);
	targetDate.setDate(msgDate.getDate() + daysToAdd);

	return targetDate.toISOString().split('T')[0];
}

// Main parser
function parseExport(text: string): Show[] {
	const shows: Show[] = [];
	const lines = text.split('\n');

	let currentMsgDate: Date | null = null;
	let currentDayOfWeek = '';
	let currentDate = '';
	let inScheduleBlock = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		// Check for message header with timestamp
		const tsMatch = line.match(
			/^\[(\d{1,2}\/\d{1,2}\/\d{2},\s*\d{1,2}:\d{2}:\d{2})\]\s*(.+?):\s*(.*)$/
		);
		if (tsMatch) {
			const ts = `[${tsMatch[1]}]`;
			const sender = tsMatch[2];
			const content = tsMatch[3];

			currentMsgDate = parseTimestamp(ts);

			// Check if this is from Comedy Café Berlin (schedule announcements)
			if (sender.includes('Comedy Café Berlin') || sender.includes('Comedy Cafe Berlin')) {
				// Check for schedule announcement indicators
				if (/week|schedule|what's on|shows/i.test(content)) {
					inScheduleBlock = true;
				}
			}
			continue;
		}

		// Skip if not in a potential schedule block
		if (!currentMsgDate) continue;

		const trimmed = line.trim();
		if (!trimmed) continue;

		// Check for day header
		const dayHeader = parseDayHeader(trimmed);
		if (dayHeader) {
			currentDayOfWeek = dayHeader.dayOfWeek;
			currentDate = calculateDate(currentMsgDate, dayHeader);
			inScheduleBlock = true; // Day headers indicate schedule content
			continue;
		}

		// Check for show line (only if we have a current date)
		if (currentDate && /\d{1,2}:\d{2}/.test(trimmed)) {
			const showData = parseShowLine(trimmed);
			if (showData) {
				shows.push({
					date: currentDate,
					dayOfWeek: currentDayOfWeek,
					...showData
				});
			}
		}

		// Reset on website URLs (end of schedule block)
		if (/^www\.|^https?:\/\//i.test(trimmed)) {
			inScheduleBlock = false;
		}
	}

	// Sort by date and time
	return shows.sort((a, b) => {
		const dateCompare = a.date.localeCompare(b.date);
		if (dateCompare !== 0) return dateCompare;
		return a.time.localeCompare(b.time);
	});
}

// Export formats
function toCSV(shows: Show[]): string {
	const header = 'date,day_of_week,time,title,price,hosted_by';
	const rows = shows.map(
		(s) =>
			`${s.date},${s.dayOfWeek},${s.time},"${s.title.replace(/"/g, '""')}",${s.price || ''},${s.hostedBy || ''}`
	);
	return [header, ...rows].join('\n');
}

function toJSON(shows: Show[]): string {
	return JSON.stringify(shows, null, 2);
}

// Deduplicate shows (same date + time + title)
function dedupe(shows: Show[]): Show[] {
	const seen = new Set<string>();
	return shows.filter((s) => {
		const key = `${s.date}|${s.time}|${s.title}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

// Main
const inputFile = argv[2];
if (!inputFile) {
	console.log('Usage: npx tsx scripts/parseWhatsAppShows.ts <_chat.txt> [--csv|--json]');
	console.log('\nParses WhatsApp export format: [MM/DD/YY, HH:MM:SS] Sender: Message');
	process.exit(1);
}

const text = readFileSync(inputFile, 'utf-8');
let shows = parseExport(text);
shows = dedupe(shows);

const format = argv[3] || '--csv';

if (format === '--json') {
	console.log(toJSON(shows));
} else {
	console.log(toCSV(shows));
}

// Stats to stderr
const dates = [...new Set(shows.map((s) => s.date))];
const firstDate = dates[0];
const lastDate = dates[dates.length - 1];
console.error(`\nParsed ${shows.length} unique shows from ${firstDate} to ${lastDate}`);
