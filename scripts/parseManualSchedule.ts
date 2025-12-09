/**
 * Parser for manually copied WhatsApp schedule data
 * Format: Day headers like "WEDNESDAY 24th Sept" followed by show lines "20:00 - Show Name"
 */

import { readFileSync, writeFileSync } from 'fs';

interface Show {
  date: string;
  dayOfWeek: string;
  time: string;
  title: string;
  price?: string;
  hostedBy?: string;
}

const MONTHS: Record<string, number> = {
  'jan': 0, 'january': 0,
  'feb': 1, 'february': 1,
  'mar': 2, 'march': 2,
  'apr': 3, 'april': 3,
  'may': 4,
  'jun': 5, 'june': 5,
  'jul': 6, 'july': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'sept': 8, 'september': 8,
  'oct': 9, 'october': 9,
  'nov': 10, 'november': 10,
  'dec': 11, 'december': 11
};

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseDate(dayOfWeek: string, dayNum: number, month: string, contextYear: number): string {
  const monthNum = MONTHS[month.toLowerCase()];
  if (monthNum === undefined) return '';

  const date = new Date(contextYear, monthNum, dayNum);
  return date.toISOString().split('T')[0];
}

function parseSchedule(text: string): Show[] {
  const shows: Show[] = [];
  const lines = text.split('\n');

  let currentDate = '';
  let currentDayOfWeek = '';
  let contextYear = 2025; // Default year for this data

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip timestamp lines and URLs
    if (/^\[[\d:,\s\/]+\]/.test(trimmed)) continue;
    if (/^https?:/.test(trimmed)) continue;
    if (/^www\./.test(trimmed)) continue;

    // Day header patterns:
    // "WEDNESDAY 24th Sept" or "Wednesday, 5 Nov" or "*THURSDAY 30th Oct*"
    const dayHeaderMatch = trimmed.match(/^\*?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\*?$/i);
    if (dayHeaderMatch) {
      currentDayOfWeek = dayHeaderMatch[1];
      const dayNum = parseInt(dayHeaderMatch[2]);
      const month = dayHeaderMatch[3];
      currentDate = parseDate(currentDayOfWeek, dayNum, month, contextYear);
      continue;
    }

    // Show line: "20:00 - Show Name" or "20:00 - Show Name (Hosted by X)"
    const showMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(.+)$/);
    if (showMatch && currentDate) {
      const hour = showMatch[1].padStart(2, '0');
      const min = showMatch[2];
      let title = showMatch[3].trim();
      let hostedBy: string | undefined;

      // Extract hosted by
      const hostedMatch = title.match(/\((?:hosted by|Hosted by)\s+(.+?)\)$/i);
      if (hostedMatch) {
        hostedBy = hostedMatch[1].trim();
        title = title.replace(/\s*\((?:hosted by|Hosted by)\s+.+?\)$/i, '').trim();
      }

      // Skip non-show entries
      if (/yoga|klein technique|morning movement/i.test(title)) continue;
      if (/student show/i.test(title) && !/Student Show/.test(title)) continue;

      shows.push({
        date: currentDate,
        dayOfWeek: currentDayOfWeek,
        time: `${hour}:${min}`,
        title,
        hostedBy
      });
    }
  }

  return shows;
}

// Load and parse
const text = readFileSync('/Users/timothylebon/dev/ccb-dashboard/src/data/cp-sept-dec-25.md', 'utf-8');
const newShows = parseSchedule(text);

// Load existing shows
const existingShows: Show[] = JSON.parse(
  readFileSync('/Users/timothylebon/dev/ccb-dashboard/src/data/historical-shows.json', 'utf-8')
);

// Merge and dedupe
const allShows = [...existingShows, ...newShows];
const seen = new Set<string>();
const deduped = allShows.filter(s => {
  const key = `${s.date}|${s.time}|${s.title}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

// Sort by date and time
deduped.sort((a, b) => {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) return dateCompare;
  return a.time.localeCompare(b.time);
});

// Output
console.log(JSON.stringify(deduped, null, 2));
console.error(`\nMerged: ${existingShows.length} existing + ${newShows.length} new = ${deduped.length} unique shows`);
