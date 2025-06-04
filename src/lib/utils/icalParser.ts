import ICAL from 'ical.js';

export interface Show {
  id: string;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  imageUrl?: string;
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
    const veventBlocks = icalData.split('BEGIN:VEVENT').slice(1).map(block => 'BEGIN:VEVENT' + block.split('END:VEVENT')[0]);

    return vevents.map((event, i) => {
      const icalEvent = new ICAL.Event(event);
      const start = icalEvent.startDate.toJSDate();
      const end = icalEvent.endDate.toJSDate();

      // Extract image URL from the unfolded VEVENT block
      let imageUrl: string | undefined;
      const veventBlock = veventBlocks[i] || '';
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
        imageUrl
      };
    });
  } catch (error) {
    console.error('Error fetching shows:', error);
    throw error;
  }
} 