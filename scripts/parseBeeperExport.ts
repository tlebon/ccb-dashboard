/**
 * Parse the Beeper export raw text into structured show data
 */

import { readFileSync, writeFileSync } from 'fs';

interface Show {
  date: string;
  dayOfWeek: string;
  time: string;
  title: string;
  hostedBy?: string;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Format date in local timezone (avoids UTC conversion bug with toISOString)
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTime(timeStr: string): string {
  // Handle formats: "8:00pm", "8:00 PM", "20:00", "8:00 PM - 9:00 PM"
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(pm|am)?/i);
  if (!match) return '';

  let hour = parseInt(match[1]);
  const min = match[2];
  const ampm = match[3]?.toLowerCase();

  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, '0')}:${min}`;
}

function parseBeeperExport(text: string): Show[] {
  const shows: Show[] = [];
  const lines = text.split('\n');

  let currentWeekStart = '';
  let currentYear = 2024;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Week header: "## Aug 19, 2024" or "## Nov 4, 2024"
    const weekMatch = line.match(/^## (\w+) (\d+), (\d{4})/);
    if (weekMatch) {
      currentYear = parseInt(weekMatch[3]);
      continue;
    }

    // Day header patterns in the schedule text
    // "*Wednesday, August 21st*" or "WEDNESDAY - August 6" or "*Wednesday*:" or "Wednesday:"
    const dayPatterns = [
      /\*?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+)\s+(\d+)(?:st|nd|rd|th)?\*?/i,
      /\*?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*[-–]\s*(\w+)\s+(\d+)/i,
      /\*?\*?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d+)(?:st|nd|rd|th)?\s+(\w+)\*?\*?/i,
    ];

    let dayMatch = null;
    for (const pattern of dayPatterns) {
      dayMatch = line.match(pattern);
      if (dayMatch) break;
    }

    if (dayMatch) {
      const dayOfWeek = dayMatch[1];
      const monthOrDay = dayMatch[2];
      const dayOrMonth = dayMatch[3];

      // Figure out which is month and which is day
      const months: Record<string, number> = {
        'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
        'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6, 'aug': 7,
        'sep': 8, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };

      let month: number;
      let day: number;

      if (months[monthOrDay.toLowerCase()] !== undefined) {
        month = months[monthOrDay.toLowerCase()];
        day = parseInt(dayOrMonth);
      } else {
        month = months[dayOrMonth.toLowerCase()];
        day = parseInt(monthOrDay);
      }

      if (month !== undefined && day) {
        const date = new Date(currentYear, month, day);
        currentWeekStart = formatLocalDate(date);
      }
      continue;
    }

    // Show line patterns:
    // "8:00pm - Show Name" or "20:00 - Show Name" or "8:00 PM - 9:00 PM - Show Name"
    // "Show Name: 8:00 PM" or "8:00pm: Show Name"
    const showPatterns = [
      // "8:00pm - Show Name (Hosted by X)"
      /^(\d{1,2}):(\d{2})\s*(pm|am)?\s*[-–:]\s*(?:\d{1,2}:\d{2}\s*(?:pm|am)?\s*[-–:]\s*)?(.+)$/i,
      // "20:00 - Show Name"
      /^(\d{2}):(\d{2})\s*[-–]\s*(.+)$/,
    ];

    for (const pattern of showPatterns) {
      const showMatch = line.match(pattern);
      if (showMatch && currentWeekStart) {
        let time: string;
        let title: string;

        if (showMatch.length === 5) {
          // Pattern with am/pm
          let hour = parseInt(showMatch[1]);
          const min = showMatch[2];
          const ampm = showMatch[3]?.toLowerCase();
          if (ampm === 'pm' && hour < 12) hour += 12;
          if (ampm === 'am' && hour === 12) hour = 0;
          time = `${hour.toString().padStart(2, '0')}:${min}`;
          title = showMatch[4].trim();
        } else {
          // 24h format
          time = `${showMatch[1]}:${showMatch[2]}`;
          title = showMatch[3].trim();
        }

        // Skip yoga, workshops, student shows (unless main jam)
        if (/yoga|workshop|student show/i.test(title) && !/Improv Jam/i.test(title)) {
          continue;
        }

        // Extract hosted by
        let hostedBy: string | undefined;
        const hostedMatch = title.match(/\((?:hosted by|Hosted by)\s+(.+?)\)$/i);
        if (hostedMatch) {
          hostedBy = hostedMatch[1].trim();
          title = title.replace(/\s*\((?:hosted by|Hosted by)\s+.+?\)$/i, '').trim();
        }

        // Clean up title
        title = title.replace(/\s*[-–]\s*\d+€.*$/i, '').trim(); // Remove price
        title = title.replace(/\s*\(Free\)$/i, '').trim();
        title = title.replace(/\s*\(\d+€\)$/i, '').trim();

        // Get day of week from date
        const dateObj = new Date(currentWeekStart);
        const dayOfWeek = DAYS[dateObj.getDay()];

        shows.push({
          date: currentWeekStart,
          dayOfWeek,
          time,
          title,
          ...(hostedBy && { hostedBy })
        });
        break;
      }
    }
  }

  return shows;
}

// Also parse using simpler line-by-line approach
function parseSimple(text: string): Show[] {
  const shows: Show[] = [];
  const blocks = text.split(/^## /m).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.split('\n');
    const headerMatch = lines[0].match(/(\w+)\s+(\d+),\s*(\d{4})/);
    if (!headerMatch) continue;

    const monthNames: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };

    const baseMonth = monthNames[headerMatch[1]];
    const baseDay = parseInt(headerMatch[2]);
    const baseYear = parseInt(headerMatch[3]);

    if (baseMonth === undefined) continue;

    let currentDate = new Date(baseYear, baseMonth, baseDay);
    let currentDayOfWeek = '';

    for (const line of lines.slice(1)) {
      // Check for day header
      const dayMatch = line.match(/\*?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/i);
      if (dayMatch) {
        currentDayOfWeek = dayMatch[1];
        // Try to extract date from same line
        const dateInLine = line.match(/(\w+)\s+(\d+)(?:st|nd|rd|th)?/);
        if (dateInLine) {
          const month = monthNames[dateInLine[1].slice(0,3)];
          const day = parseInt(dateInLine[2]);
          if (month !== undefined && day) {
            currentDate = new Date(baseYear, month, day);
          }
        }
        continue;
      }

      // Check for show line
      const showMatch = line.match(/^[-•]?\s*(\d{1,2}):(\d{2})\s*(pm|am)?\s*[-–:]?\s*(?:\d{1,2}:\d{2}\s*(?:pm|am)?\s*[-–:]?\s*)?(.+)$/i);
      if (showMatch && currentDayOfWeek) {
        let hour = parseInt(showMatch[1]);
        const min = showMatch[2];
        const ampm = showMatch[3]?.toLowerCase();
        let title = showMatch[4].trim();

        if (ampm === 'pm' && hour < 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;
        // Handle 24h format (20:00)
        if (!ampm && hour >= 20 && hour <= 23) {
          // Already correct
        }

        const time = `${hour.toString().padStart(2, '0')}:${min}`;

        // Skip non-shows
        if (/yoga|workshop|klein technique|morning movement/i.test(title) && !/Jam/i.test(title)) {
          continue;
        }

        // Extract hosted by
        let hostedBy: string | undefined;
        const hostedMatch = title.match(/\((?:hosted by|Hosted by)\s+(.+?)\)$/i);
        if (hostedMatch) {
          hostedBy = hostedMatch[1].trim();
          title = title.replace(/\s*\((?:hosted by|Hosted by)\s+.+?\)$/i, '').trim();
        }

        // Clean title
        title = title.replace(/\s*[-–]\s*\d+€.*$/i, '').trim();
        title = title.replace(/\s*\(Free\)$/i, '').trim();
        title = title.replace(/\s*\(\d+€\)$/i, '').trim();
        title = title.replace(/\s*\(at CCB Studios\)$/i, '').trim();

        const dateStr = formatLocalDate(currentDate);

        shows.push({
          date: dateStr,
          dayOfWeek: currentDayOfWeek,
          time,
          title,
          ...(hostedBy && { hostedBy })
        });
      }
    }
  }

  return shows;
}

// Main
const text = readFileSync('/Users/timothylebon/dev/ccb-dashboard/src/data/beeper-export-raw.txt', 'utf-8');
const shows = parseSimple(text);

// Dedupe
const seen = new Set<string>();
const deduped = shows.filter(s => {
  const key = `${s.date}|${s.time}|${s.title}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Sort
deduped.sort((a, b) => {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;
  return a.time.localeCompare(b.time);
});

// Stats
const jams = deduped.filter(s => /Improv Jam/i.test(s.title));
const hostedJams = jams.filter(j => j.hostedBy);

console.log(JSON.stringify(deduped, null, 2));
console.error(`\nParsed ${deduped.length} shows`);
console.error(`Date range: ${deduped[0]?.date} to ${deduped[deduped.length-1]?.date}`);
console.error(`Jams: ${jams.length} total, ${hostedJams.length} with host info`);
console.error('\nJam hosts:');
for (const j of hostedJams) {
  console.error(`  ${j.date}: ${j.hostedBy}`);
}
