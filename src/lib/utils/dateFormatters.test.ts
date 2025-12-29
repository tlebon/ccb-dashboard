import { describe, it, expect } from 'vitest';
import {
	formatDateLong,
	formatDateShort,
	formatDateMedium,
	formatDateCompact,
	formatTime
} from './dateFormatters';

describe('dateFormatters utilities', () => {
	describe('formatDateLong', () => {
		it('should format date with full weekday and month names', () => {
			const result = formatDateLong('2025-01-01');
			expect(result).toBe('Wednesday, 1 January 2025');
		});

		it('should handle dates at end of year', () => {
			const result = formatDateLong('2025-12-31');
			expect(result).toBe('Wednesday, 31 December 2025');
		});

		it('should handle leap year dates', () => {
			const result = formatDateLong('2024-02-29');
			expect(result).toBe('Thursday, 29 February 2024');
		});
	});

	describe('formatDateShort', () => {
		it('should format date with short weekday and month names', () => {
			const result = formatDateShort('2025-01-01');
			expect(result).toBe('Wed, 1 Jan 2025');
		});

		it('should handle different months', () => {
			const result = formatDateShort('2025-03-15');
			expect(result).toBe('Sat, 15 Mar 2025');
		});

		it('should handle year boundaries', () => {
			const result = formatDateShort('2024-12-31');
			expect(result).toBe('Tue, 31 Dec 2024');
		});
	});

	describe('formatDateMedium', () => {
		it('should format date with no weekday', () => {
			const result = formatDateMedium('2025-01-01');
			expect(result).toBe('1 Jan 2025');
		});

		it('should handle single digit days', () => {
			const result = formatDateMedium('2025-03-05');
			expect(result).toBe('5 Mar 2025');
		});

		it('should handle double digit days', () => {
			const result = formatDateMedium('2025-11-23');
			expect(result).toBe('23 Nov 2025');
		});
	});

	describe('formatDateCompact', () => {
		it('should format date with no year', () => {
			const result = formatDateCompact('2025-01-01');
			expect(result).toBe('Wed 1 Jan');
		});

		it('should handle different weekdays', () => {
			const result = formatDateCompact('2025-01-05');
			expect(result).toBe('Sun 5 Jan');
		});

		it('should handle end of month', () => {
			const result = formatDateCompact('2025-01-31');
			expect(result).toBe('Fri 31 Jan');
		});

		it('should be consistent across years for same date', () => {
			const result2024 = formatDateCompact('2024-06-15');
			const result2025 = formatDateCompact('2025-06-15');
			// Both are "15 Jun" but different weekdays
			expect(result2024).toContain('15 Jun');
			expect(result2025).toContain('15 Jun');
		});
	});

	describe('formatTime', () => {
		it('should extract HH:MM from HH:MM:SS format', () => {
			const result = formatTime('19:30:00');
			expect(result).toBe('19:30');
		});

		it('should handle HH:MM format (already normalized)', () => {
			const result = formatTime('19:30');
			expect(result).toBe('19:30');
		});

		it('should handle midnight', () => {
			const result = formatTime('00:00:00');
			expect(result).toBe('00:00');
		});

		it('should handle noon', () => {
			const result = formatTime('12:00:00');
			expect(result).toBe('12:00');
		});

		it('should handle late night times', () => {
			const result = formatTime('23:59:59');
			expect(result).toBe('23:59');
		});

		it('should return null for null input', () => {
			const result = formatTime(null);
			expect(result).toBeNull();
		});

		it('should return null for empty string', () => {
			const result = formatTime('');
			expect(result).toBeNull();
		});

		it('should handle single-digit hours and minutes', () => {
			const result = formatTime('09:05:00');
			expect(result).toBe('09:05');
		});
	});

	// Cross-format consistency tests
	describe('format consistency', () => {
		const testDate = '2025-03-15';

		it('all formats should handle the same date without errors', () => {
			expect(() => formatDateLong(testDate)).not.toThrow();
			expect(() => formatDateShort(testDate)).not.toThrow();
			expect(() => formatDateMedium(testDate)).not.toThrow();
			expect(() => formatDateCompact(testDate)).not.toThrow();
		});

		it('all formats should use en-GB locale', () => {
			// en-GB uses day-month-year order
			const long = formatDateLong(testDate);
			const short = formatDateShort(testDate);
			const medium = formatDateMedium(testDate);
			const compact = formatDateCompact(testDate);

			// All should have "15 Mar" or "15 March"
			expect(long).toContain('15 March');
			expect(short).toContain('15 Mar');
			expect(medium).toContain('15 Mar');
			expect(compact).toContain('15 Mar');
		});
	});
});
