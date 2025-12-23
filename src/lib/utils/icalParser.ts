import ICAL from 'ical.js';

export interface Show {
	id: string;
	title: string;
	start: Date;
	end: Date;
	description?: string;
	location?: string;
	url?: string;
	imageUrl?: string;
	source?: string;
}

// Fetch shows from database (preferred method - no live scraping)
export async function fetchShowsFromDB(days = 14, pastDays = 0, startDate?: Date): Promise<Show[]> {
	try {
		const params = new URLSearchParams({ days: days.toString() });
		if (pastDays > 0) {
			params.set('pastDays', pastDays.toString());
		}
		if (startDate) {
			params.set('startDate', startDate.toISOString().split('T')[0]);
		}
		const response = await fetch(`/api/shows/upcoming?${params}`);
		if (!response.ok) {
			throw new Error('Failed to fetch shows from database');
		}
		const data = await response.json();

		// Convert date strings back to Date objects
		return data.shows.map((show: Show & { start: string; end: string }) => ({
			...show,
			start: new Date(show.start),
			end: new Date(show.end)
		}));
	} catch (error) {
		console.error('Error fetching shows from DB:', error);
		throw error;
	}
}

// Helper to fetch and parse iCal feed
export async function fetchShowsFromICal(): Promise<Show[]> {
	try {
		const response = await fetch('/api/shows');
		if (!response.ok) {
			throw new Error('Failed to fetch shows');
		}
		let icalData = await response.text();

		// Unfold lines: join lines that start with space or tab to the previous line
		icalData = icalData.replace(/\r?\n[ \t]/g, '');

		const jcalData = ICAL.parse(icalData);
		const comp = new ICAL.Component(jcalData);
		const vevents = comp.getAllSubcomponents('vevent');

		// Extract all VEVENT blocks as strings from the unfolded iCal data
		const veventBlocks = icalData
			.split('BEGIN:VEVENT')
			.slice(1)
			.map((block) => 'BEGIN:VEVENT' + block.split('END:VEVENT')[0]);

		return vevents.map((event, i) => {
			const icalEvent = new ICAL.Event(event);
			const start = icalEvent.startDate.toJSDate();
			const end = icalEvent.endDate.toJSDate();

			// Extract URL and image URL from the unfolded VEVENT block
			const veventBlock = veventBlocks[i] || '';

			let url: string | undefined;
			const urlMatch = veventBlock.match(/URL:(.+)/);
			if (urlMatch) {
				url = urlMatch[1].trim();
			}

			let imageUrl: string | undefined;
			const imageMatch = veventBlock.match(/IMAGE:(.+)/);
			if (imageMatch) {
				imageUrl = imageMatch[1].trim();
			}

			return {
				id: icalEvent.uid || start.toString(),
				title: icalEvent.summary || 'Untitled',
				start,
				end,
				description: icalEvent.description || '',
				location: icalEvent.location || '',
				url,
				imageUrl
			};
		});
	} catch (error) {
		console.error('Error fetching shows:', error);
		throw error;
	}
}
