/**
 * Theme and sizing utilities for responsive layout
 * Handles theme selection and dynamic font sizing based on content density
 */

export type Theme = 'blue' | 'orange';

export interface ResponsiveSizes {
	dayHeadingClass: string;
	timeClass: string;
	titleClass: string;
}

/**
 * Get theme based on navigation mode and offset
 * In manual nav, uses initial theme. In monitor mode, alternates with offset.
 * @param isManualNav - Whether navigation is manual (not auto-rotating)
 * @param initialTheme - Theme selected on page load
 * @param monitorThemeOffset - Offset counter for monitor mode rotation
 * @returns Theme color ('blue' or 'orange')
 */
export function getTheme(
	isManualNav: boolean,
	initialTheme: Theme,
	monitorThemeOffset: number
): Theme {
	if (isManualNav) {
		return initialTheme;
	}

	// In monitor mode, alternate theme with each rotation
	return monitorThemeOffset % 2 === 0 ? initialTheme : initialTheme === 'blue' ? 'orange' : 'blue';
}

/**
 * Get responsive font sizes based on content density
 * In manual mode (infinite scroll), uses fixed sizes
 * In monitor mode, dynamically adjusts based on show count and day count
 * @param monitorMode - Whether monitor mode is active
 * @param totalShows - Total number of shows to display
 * @param dayCount - Number of days with shows
 * @returns Object with Tailwind CSS classes for headings, times, and titles
 */
export function getResponsiveSizes(
	monitorMode: boolean,
	totalShows: number,
	dayCount: number
): ResponsiveSizes {
	if (!monitorMode) {
		// Fixed sizes for infinite scroll mode
		return {
			dayHeadingClass: 'text-2xl',
			timeClass: 'text-xl',
			titleClass: 'text-lg'
		};
	}

	// Dynamic sizing for monitor mode based on content density
	if (totalShows > 20) {
		return {
			dayHeadingClass: 'text-xl',
			timeClass: 'text-lg',
			titleClass: 'text-base'
		};
	}

	if (totalShows > 15) {
		return {
			dayHeadingClass: 'text-2xl',
			timeClass: 'text-xl',
			titleClass: 'text-lg'
		};
	}

	if (dayCount < 5) {
		return {
			dayHeadingClass: 'text-3xl',
			timeClass: 'text-2xl',
			titleClass: 'text-xl'
		};
	}

	return {
		dayHeadingClass: 'text-2xl',
		timeClass: 'text-xl',
		titleClass: 'text-lg'
	};
}

/**
 * Determine if "next week" style should be used (affects column order)
 * Only applies in monitor mode (auto-rotation), alternates with theme
 * @param isManualNav - Whether navigation is manual (not auto-rotating)
 * @param monitorThemeOffset - Offset counter for monitor mode rotation
 * @returns True if next week style should be used (odd offset in monitor mode)
 */
export function getLayoutStyle(isManualNav: boolean, monitorThemeOffset: number): boolean {
	return !isManualNav && monitorThemeOffset % 2 === 1;
}
