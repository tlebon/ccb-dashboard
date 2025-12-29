/**
 * Infinite scroll configuration and state helpers
 * Constants and utilities for managing bidirectional infinite scroll
 */

// Infinite scroll configuration constants
export const CHUNK_SIZE_DAYS = 14; // Load shows in 14-day chunks
export const MAX_LOAD_DAYS = 90; // Maximum days to load into future (stop after 90 days or 3 empty chunks)
export const MAX_EMPTY_CHUNKS = 3; // Stop loading after 3 consecutive empty chunks
export const MAX_PAST_DAYS = 28; // Load up to 4 weeks of past shows

/**
 * Check if more future shows should be loaded
 * @param hasMore - Whether there are potentially more shows to load
 * @param loadingMore - Whether a load operation is currently in progress
 * @param monitorMode - Whether monitor mode is active (disables infinite scroll)
 * @returns True if should trigger load, false otherwise
 */
export function shouldLoadMore(
	hasMore: boolean,
	loadingMore: boolean,
	monitorMode: boolean
): boolean {
	return hasMore && !loadingMore && !monitorMode;
}

/**
 * Check if past shows should be loaded
 * @param hasPastShows - Whether there are potentially past shows to load
 * @param loadingMore - Whether a load operation is currently in progress
 * @param monitorMode - Whether monitor mode is active (disables infinite scroll)
 * @param isScrollingUp - Whether user is scrolling up (toward past)
 * @returns True if should trigger past load, false otherwise
 */
export function shouldLoadPast(
	hasPastShows: boolean,
	loadingMore: boolean,
	monitorMode: boolean,
	isScrollingUp: boolean
): boolean {
	return hasPastShows && !loadingMore && !monitorMode && isScrollingUp;
}

/**
 * Calculate if loading should stop based on empty chunk tracking
 * @param consecutiveEmptyChunks - Number of consecutive chunks that were empty
 * @param displayedDays - Total days loaded so far
 * @returns True if should stop loading, false otherwise
 */
export function shouldStopLoading(consecutiveEmptyChunks: number, displayedDays: number): boolean {
	return consecutiveEmptyChunks >= MAX_EMPTY_CHUNKS || displayedDays >= MAX_LOAD_DAYS;
}

/**
 * Calculate how many more past days can be loaded
 * @param pastDaysLoaded - Number of past days already loaded
 * @returns Number of days that can still be loaded (capped at MAX_PAST_DAYS, minimum 0)
 */
export function calculatePastDaysToLoad(pastDaysLoaded: number): number {
	return Math.max(0, Math.min(CHUNK_SIZE_DAYS, MAX_PAST_DAYS - pastDaysLoaded));
}
