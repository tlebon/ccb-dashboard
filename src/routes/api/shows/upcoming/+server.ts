import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';

interface ShowRow {
	id: number;
	title: string;
	slug: string | null;
	date: string;
	time: string | null;
	description: string | null;
	source: string;
	url: string | null;
	image_url: string | null;
}

// Normalize title for matching (remove special chars, lowercase)
function normalizeTitle(title: string): string {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim()
		.replace(/\s+/g, ' ');
}

// Check if two dates are within N days of each other
function datesWithinDays(date1: string, date2: string, days: number): boolean {
	const d1 = new Date(date1);
	const d2 = new Date(date2);
	const diffMs = Math.abs(d1.getTime() - d2.getTime());
	const diffDays = diffMs / (1000 * 60 * 60 * 24);
	return diffDays <= days;
}

// Check if a date is in Daylight Saving Time (CEST) for Central European Time
// DST runs from last Sunday of March (2:00 AM) to last Sunday of October (3:00 AM)
// monthIndex: 0-11 (January = 0, December = 11) to match JavaScript Date constructor
function isDST(year: number, monthIndex: number, day: number): boolean {
	// Get last Sunday of March
	const marchLastDay = new Date(year, 2, 31); // March is month 2 (0-indexed)
	const marchLastSunday = 31 - ((marchLastDay.getDay()) % 7);

	// Get last Sunday of October
	const octoberLastDay = new Date(year, 9, 31); // October is month 9 (0-indexed)
	const octoberLastSunday = 31 - ((octoberLastDay.getDay()) % 7);

	// DST starts on last Sunday of March and ends on last Sunday of October
	const dstStart = new Date(year, 2, marchLastSunday, 2, 0, 0); // March at 2:00 AM
	const dstEnd = new Date(year, 9, octoberLastSunday, 3, 0, 0); // October at 3:00 AM
	const dateToCheck = new Date(year, monthIndex, day, 12, 0, 0); // Use noon to avoid edge cases

	return dateToCheck >= dstStart && dateToCheck < dstEnd;
}

export const GET: RequestHandler = async ({ url }) => {
	try {
		const daysParam = url.searchParams.get('days');
		const pastDaysParam = url.searchParams.get('pastDays');
		const startDateParam = url.searchParams.get('startDate');
		const days = daysParam ? parseInt(daysParam, 10) : 14;
		const pastDays = pastDaysParam ? parseInt(pastDaysParam, 10) : 0;

		// Get current date in YYYY-MM-DD format
		const today = new Date();
		const todayStr = today.toISOString().split('T')[0];

		// Calculate start date
		let startDate: Date;
		if (startDateParam) {
			// Use provided start date for pagination
			startDate = new Date(startDateParam);
		} else {
			// Use pastDays offset from today (can be in the past)
			startDate = new Date(today);
			startDate.setDate(startDate.getDate() - pastDays);
		}
		const startDateStr = startDate.toISOString().split('T')[0];

		// Calculate end date (N days from start date)
		const endDate = new Date(startDate);
		endDate.setDate(endDate.getDate() + days);
		const endDateStr = endDate.toISOString().split('T')[0];

		// Fetch all shows in range (exclusive end date to return exactly N days)
		const result = await db.execute({
			sql: `
				SELECT id, title, slug, date, time, description, source, url, image_url
				FROM shows
				WHERE date >= ? AND date < ?
				ORDER BY date, time
			`,
			args: [startDateStr, endDateStr]
		});

		const allShows = result.rows as unknown as ShowRow[];

		// De-duplicate: group by similar title + similar time, prefer iCal
		const mergedShows: ShowRow[] = [];
		const usedIds = new Set<number>();

		for (const show of allShows) {
			if (usedIds.has(show.id)) continue;

			const normalizedTitle = normalizeTitle(show.title);

			// Find potential duplicates (same normalized title, within 1 day, same time slot)
			const duplicates = allShows.filter((other) => {
				if (other.id === show.id || usedIds.has(other.id)) return false;

				const otherNormalized = normalizeTitle(other.title);

				// Check if titles match (either contains the other or similar)
				const titlesMatch =
					normalizedTitle.includes(otherNormalized) ||
					otherNormalized.includes(normalizedTitle) ||
					normalizedTitle === otherNormalized;

				// Check if dates are within 1 day
				const datesClose = datesWithinDays(show.date, other.date, 1);

				// Check if times match (or both null)
				const timesMatch = show.time === other.time;

				return titlesMatch && datesClose && timesMatch;
			});

			// Pick the best version (prefer iCal, then manual, then beeper)
			const candidates = [show, ...duplicates];
			candidates.sort((a, b) => {
				const sourceOrder = { ical: 1, manual: 2, beeper: 3 };
				const aOrder = sourceOrder[a.source as keyof typeof sourceOrder] || 4;
				const bOrder = sourceOrder[b.source as keyof typeof sourceOrder] || 4;
				return aOrder - bOrder;
			});

			const best = candidates[0];

			// Mark all as used
			for (const c of candidates) {
				usedIds.add(c.id);
			}

			// Merge: use best show but fill in missing data from others
			const merged = { ...best };
			for (const other of candidates.slice(1)) {
				if (!merged.description && other.description) {
					merged.description = other.description;
				}
				if (!merged.url && other.url) {
					merged.url = other.url;
				}
				if (!merged.image_url && other.image_url) {
					merged.image_url = other.image_url;
				}
			}

			mergedShows.push(merged);
		}

		// Sort by date and time
		mergedShows.sort((a, b) => {
			const dateCompare = a.date.localeCompare(b.date);
			if (dateCompare !== 0) return dateCompare;
			return (a.time || '').localeCompare(b.time || '');
		});

		// Transform to Show format
		const shows = mergedShows.map((row) => {
			const [year, month, day] = row.date.split('-').map(Number);
			const [hours, minutes] = row.time ? row.time.split(':').map(Number) : [0, 0];

			// Database times are Berlin local time (e.g., "20:00" = 8pm Berlin)
			// Berlin uses CET (UTC+1) in winter and CEST (UTC+2) in summer
			// Subtract appropriate offset based on DST status
			const monthIndex = month - 1; // Convert to 0-indexed for Date constructor
			const utcOffset = isDST(year, monthIndex, day) ? 2 : 1; // CEST = UTC+2, CET = UTC+1
			const start = new Date(Date.UTC(year, monthIndex, day, hours - utcOffset, minutes, 0));
			const end = new Date(start.getTime() + 90 * 60 * 1000);

			return {
				id: row.slug || String(row.id),
				title: row.title,
				start,
				end,
				description: row.description || '',
				url: row.url || undefined,
				imageUrl: row.image_url || undefined,
				source: row.source
			};
		});

		return json({ shows });
	} catch (e) {
		console.error('Error fetching upcoming shows:', e);
		return json({ error: 'Failed to fetch shows', shows: [] }, { status: 500 });
	}
};
