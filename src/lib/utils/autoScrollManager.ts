/**
 * Auto-scroll manager constants and helpers for monitor mode
 * Manages bidirectional auto-scrolling of show lists in monitor display mode
 */

// Auto-scroll configuration constants
export const SCROLL_SPEED = 1.5; // pixels per frame (~90px/sec at 60fps)
export const PAUSE_DURATION = 2000; // pause at top/bottom in milliseconds
export const SCROLL_THRESHOLD_SHOW_TODAY = 0.95; // Show "Back to Today" button when scrolled past this ratio

export type ScrollDirection = 'down' | 'up';

/**
 * Calculate if auto-scroll has reached the bottom boundary
 * @param scrollTop - Current scroll position
 * @param maxScroll - Maximum scrollable distance
 * @param threshold - Threshold distance from bottom (default 1px)
 * @returns True if at or near bottom
 */
export function isAtBottom(scrollTop: number, maxScroll: number, threshold: number = 1): boolean {
	return scrollTop >= maxScroll - threshold;
}

/**
 * Calculate if auto-scroll has reached the top boundary
 * @param scrollTop - Current scroll position
 * @param threshold - Threshold distance from top (default 1px)
 * @returns True if at or near top
 */
export function isAtTop(scrollTop: number, threshold: number = 1): boolean {
	return scrollTop <= threshold;
}

/**
 * Calculate maximum scrollable distance
 * @param scrollHeight - Total height of scrollable content
 * @param clientHeight - Height of visible viewport
 * @returns Maximum scroll position (0 if content fits in viewport)
 */
export function calculateMaxScroll(scrollHeight: number, clientHeight: number): number {
	return Math.max(0, scrollHeight - clientHeight);
}

/**
 * Check if content has overflow (needs scrolling)
 * @param scrollHeight - Total height of scrollable content
 * @param clientHeight - Height of visible viewport
 * @returns True if content is taller than viewport
 */
export function hasOverflow(scrollHeight: number, clientHeight: number): boolean {
	return scrollHeight > clientHeight;
}

/**
 * Calculate next scroll position based on direction and speed
 * @param currentScroll - Current scroll position
 * @param direction - Direction of scroll ('down' or 'up')
 * @param speed - Scroll speed in pixels (default: SCROLL_SPEED)
 * @returns Next scroll position
 */
export function calculateNextScrollPosition(
	currentScroll: number,
	direction: ScrollDirection,
	speed: number = SCROLL_SPEED
): number {
	return direction === 'down' ? currentScroll + speed : currentScroll - speed;
}

/**
 * Determine if scroll position should trigger "Back to Today" button
 * @param scrollTop - Current scroll position
 * @param scrollHeight - Total height of scrollable content
 * @param clientHeight - Height of visible viewport
 * @param threshold - Threshold ratio (default: SCROLL_THRESHOLD_SHOW_TODAY)
 * @returns True if "Back to Today" button should be shown
 */
export function shouldShowTodayButton(
	scrollTop: number,
	scrollHeight: number,
	clientHeight: number,
	threshold: number = SCROLL_THRESHOLD_SHOW_TODAY
): boolean {
	const maxScroll = calculateMaxScroll(scrollHeight, clientHeight);
	if (maxScroll === 0) return false; // No scrolling possible
	return scrollTop / maxScroll > threshold;
}
