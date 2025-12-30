/**
 * Date and time formatting utilities
 * Provides consistent date formatting across the application
 *
 * IMPORTANT: Date Timezone Handling
 * - All date strings are expected to be in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)
 * - Dates without time (YYYY-MM-DD) are parsed as UTC midnight
 * - Dates with time (ISO 8601 with Z or timezone) preserve the specified timezone
 * - Display formatting uses en-GB locale for consistency across the application
 *
 * This matches the database storage format where dates are stored as UTC.
 */

/**
 * Format date with full weekday and month names
 * @param dateStr - ISO 8601 date string (YYYY-MM-DD or full ISO format)
 * @example formatDateLong("2025-01-01") → "Monday, 1 January 2025"
 */
export function formatDateLong(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-GB', {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

/**
 * Format date with short weekday and month names
 * @example "Mon, 1 Jan 2025"
 */
export function formatDateShort(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

/**
 * Format date with no weekday, short month
 * @example "1 Jan 2025"
 */
export function formatDateMedium(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});
}

/**
 * Format date with short weekday and month, no year
 * Useful for upcoming events within the current period
 * @example "Mon, 1 Jan"
 */
export function formatDateCompact(dateStr: string): string {
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
}

/**
 * Normalize time string to HH:MM format
 * Returns null if no time provided
 * @param timeStr - Time string in format HH:MM:SS or HH:MM
 * @example formatTime("19:30:00") → "19:30"
 * @example formatTime("19:30") → "19:30"
 * @example formatTime(null) → null
 */
export function formatTime(timeStr: string | null): string | null {
	if (!timeStr) return null;
	// Extract HH:MM from HH:MM:SS or HH:MM
	const [hours, minutes] = timeStr.split(':');
	return `${hours}:${minutes}`;
}
