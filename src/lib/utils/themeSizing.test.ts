import { describe, it, expect } from 'vitest';
import { getTheme, getResponsiveSizes, getLayoutStyle, type Theme } from './themeSizing';

describe('themeSizing utilities', () => {
	describe('getTheme', () => {
		it('should return initial theme in manual nav mode', () => {
			const result = getTheme(true, 'blue', 0);
			expect(result).toBe('blue');
		});

		it('should return initial theme in manual nav regardless of offset', () => {
			const result1 = getTheme(true, 'orange', 5);
			expect(result1).toBe('orange');

			const result2 = getTheme(true, 'blue', 10);
			expect(result2).toBe('blue');
		});

		it('should return initial theme in monitor mode with even offset', () => {
			const result = getTheme(false, 'blue', 0);
			expect(result).toBe('blue');
		});

		it('should alternate theme in monitor mode with odd offset', () => {
			const result1 = getTheme(false, 'blue', 1);
			expect(result1).toBe('orange');

			const result2 = getTheme(false, 'orange', 1);
			expect(result2).toBe('blue');
		});

		it('should alternate correctly with increasing offsets', () => {
			const initialTheme: Theme = 'blue';

			expect(getTheme(false, initialTheme, 0)).toBe('blue'); // Even
			expect(getTheme(false, initialTheme, 1)).toBe('orange'); // Odd
			expect(getTheme(false, initialTheme, 2)).toBe('blue'); // Even
			expect(getTheme(false, initialTheme, 3)).toBe('orange'); // Odd
			expect(getTheme(false, initialTheme, 4)).toBe('blue'); // Even
		});

		it('should handle orange as initial theme', () => {
			expect(getTheme(false, 'orange', 0)).toBe('orange'); // Even
			expect(getTheme(false, 'orange', 1)).toBe('blue'); // Odd
			expect(getTheme(false, 'orange', 2)).toBe('orange'); // Even
		});
	});

	describe('getResponsiveSizes', () => {
		it('should return fixed sizes in manual mode', () => {
			const result = getResponsiveSizes(false, 100, 10);

			expect(result).toEqual({
				dayHeadingClass: 'text-2xl',
				timeClass: 'text-xl',
				titleClass: 'text-lg'
			});
		});

		it('should return fixed sizes in manual mode regardless of show count', () => {
			const result1 = getResponsiveSizes(false, 5, 2);
			const result2 = getResponsiveSizes(false, 25, 7);

			expect(result1).toEqual(result2);
		});

		it('should return small sizes for high show count (>20) in monitor mode', () => {
			const result = getResponsiveSizes(true, 21, 5);

			expect(result).toEqual({
				dayHeadingClass: 'text-xl',
				timeClass: 'text-lg',
				titleClass: 'text-base'
			});
		});

		it('should return medium sizes for moderate show count (>15) in monitor mode', () => {
			const result = getResponsiveSizes(true, 18, 5);

			expect(result).toEqual({
				dayHeadingClass: 'text-2xl',
				timeClass: 'text-xl',
				titleClass: 'text-lg'
			});
		});

		it('should return large sizes for low day count (<5) in monitor mode', () => {
			const result = getResponsiveSizes(true, 10, 3);

			expect(result).toEqual({
				dayHeadingClass: 'text-3xl',
				timeClass: 'text-2xl',
				titleClass: 'text-xl'
			});
		});

		it('should return default sizes for normal show count in monitor mode', () => {
			const result = getResponsiveSizes(true, 12, 5);

			expect(result).toEqual({
				dayHeadingClass: 'text-2xl',
				timeClass: 'text-xl',
				titleClass: 'text-lg'
			});
		});

		it('should prioritize show count over day count', () => {
			// Even with low day count, high show count takes precedence
			const result = getResponsiveSizes(true, 21, 2);

			expect(result).toEqual({
				dayHeadingClass: 'text-xl',
				timeClass: 'text-lg',
				titleClass: 'text-base'
			});
		});

		it('should handle boundary cases', () => {
			// Exactly 20 shows should not trigger small sizes (>20 condition)
			const result20 = getResponsiveSizes(true, 20, 5);
			expect(result20.dayHeadingClass).not.toBe('text-xl');

			// Exactly 21 shows should trigger small sizes
			const result21 = getResponsiveSizes(true, 21, 5);
			expect(result21.dayHeadingClass).toBe('text-xl');

			// Exactly 15 shows falls through to default (text-2xl)
			const result15 = getResponsiveSizes(true, 15, 5);
			expect(result15.dayHeadingClass).toBe('text-2xl');

			// Exactly 16 shows triggers medium sizes check (>15)
			const result16 = getResponsiveSizes(true, 16, 5);
			expect(result16.dayHeadingClass).toBe('text-2xl');
			expect(result16.titleClass).toBe('text-lg'); // Confirms it's from medium path
		});

		it('should handle day count boundary', () => {
			// Exactly 4 days should trigger large sizes
			const result4 = getResponsiveSizes(true, 10, 4);
			expect(result4.dayHeadingClass).toBe('text-3xl');

			// Exactly 5 days should not trigger large sizes
			const result5 = getResponsiveSizes(true, 10, 5);
			expect(result5.dayHeadingClass).toBe('text-2xl');
		});
	});

	describe('getLayoutStyle', () => {
		it('should return false in manual nav mode', () => {
			const result = getLayoutStyle(true, 0);
			expect(result).toBe(false);
		});

		it('should return false in manual nav regardless of offset', () => {
			expect(getLayoutStyle(true, 1)).toBe(false);
			expect(getLayoutStyle(true, 5)).toBe(false);
			expect(getLayoutStyle(true, 10)).toBe(false);
		});

		it('should return false in monitor mode with even offset', () => {
			const result = getLayoutStyle(false, 0);
			expect(result).toBe(false);
		});

		it('should return true in monitor mode with odd offset', () => {
			const result = getLayoutStyle(false, 1);
			expect(result).toBe(true);
		});

		it('should alternate correctly with increasing offsets', () => {
			expect(getLayoutStyle(false, 0)).toBe(false); // Even
			expect(getLayoutStyle(false, 1)).toBe(true); // Odd
			expect(getLayoutStyle(false, 2)).toBe(false); // Even
			expect(getLayoutStyle(false, 3)).toBe(true); // Odd
			expect(getLayoutStyle(false, 4)).toBe(false); // Even
		});
	});

	// Integration tests
	describe('integration', () => {
		it('should coordinate theme and layout style in monitor mode', () => {
			const initialTheme: Theme = 'blue';

			// Offset 0: blue theme, normal layout
			expect(getTheme(false, initialTheme, 0)).toBe('blue');
			expect(getLayoutStyle(false, 0)).toBe(false);

			// Offset 1: orange theme, next week layout
			expect(getTheme(false, initialTheme, 1)).toBe('orange');
			expect(getLayoutStyle(false, 1)).toBe(true);

			// Offset 2: blue theme, normal layout
			expect(getTheme(false, initialTheme, 2)).toBe('blue');
			expect(getLayoutStyle(false, 2)).toBe(false);
		});

		it('should handle manual nav mode completely differently', () => {
			const initialTheme: Theme = 'orange';

			// In manual nav, theme stays same and layout is always normal
			expect(getTheme(true, initialTheme, 0)).toBe('orange');
			expect(getLayoutStyle(true, 0)).toBe(false);

			expect(getTheme(true, initialTheme, 5)).toBe('orange');
			expect(getLayoutStyle(true, 5)).toBe(false);
		});

		it('should provide consistent sizes across different scenarios', () => {
			// Manual mode always gets same sizes
			const manual1 = getResponsiveSizes(false, 5, 2);
			const manual2 = getResponsiveSizes(false, 30, 7);
			expect(manual1).toEqual(manual2);

			// Monitor mode varies by content
			const monitor1 = getResponsiveSizes(true, 5, 2);
			const monitor2 = getResponsiveSizes(true, 30, 7);
			expect(monitor1).not.toEqual(monitor2);
		});
	});
});
