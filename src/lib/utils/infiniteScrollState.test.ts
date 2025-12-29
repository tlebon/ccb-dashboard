import { describe, it, expect } from 'vitest';
import {
	CHUNK_SIZE_DAYS,
	MAX_LOAD_DAYS,
	MAX_EMPTY_CHUNKS,
	MAX_PAST_DAYS,
	shouldLoadMore,
	shouldLoadPast,
	shouldStopLoading,
	calculatePastDaysToLoad
} from './infiniteScrollState';

describe('infiniteScrollState utilities', () => {
	describe('constants', () => {
		it('should export CHUNK_SIZE_DAYS', () => {
			expect(CHUNK_SIZE_DAYS).toBe(14);
		});

		it('should export MAX_LOAD_DAYS', () => {
			expect(MAX_LOAD_DAYS).toBe(90);
		});

		it('should export MAX_EMPTY_CHUNKS', () => {
			expect(MAX_EMPTY_CHUNKS).toBe(3);
		});

		it('should export MAX_PAST_DAYS', () => {
			expect(MAX_PAST_DAYS).toBe(28);
		});
	});

	describe('shouldLoadMore', () => {
		it('should return true when all conditions are met', () => {
			const result = shouldLoadMore(true, false, false);
			expect(result).toBe(true);
		});

		it('should return false if no more shows to load', () => {
			const result = shouldLoadMore(false, false, false);
			expect(result).toBe(false);
		});

		it('should return false if already loading', () => {
			const result = shouldLoadMore(true, true, false);
			expect(result).toBe(false);
		});

		it('should return false if in monitor mode', () => {
			const result = shouldLoadMore(true, false, true);
			expect(result).toBe(false);
		});

		it('should return false if multiple conditions fail', () => {
			const result = shouldLoadMore(false, true, true);
			expect(result).toBe(false);
		});
	});

	describe('shouldLoadPast', () => {
		it('should return true when all conditions are met', () => {
			const result = shouldLoadPast(true, false, false, true);
			expect(result).toBe(true);
		});

		it('should return false if no past shows to load', () => {
			const result = shouldLoadPast(false, false, false, true);
			expect(result).toBe(false);
		});

		it('should return false if already loading', () => {
			const result = shouldLoadPast(true, true, false, true);
			expect(result).toBe(false);
		});

		it('should return false if in monitor mode', () => {
			const result = shouldLoadPast(true, false, true, true);
			expect(result).toBe(false);
		});

		it('should return false if not scrolling up', () => {
			const result = shouldLoadPast(true, false, false, false);
			expect(result).toBe(false);
		});

		it('should return false if multiple conditions fail', () => {
			const result = shouldLoadPast(false, true, true, false);
			expect(result).toBe(false);
		});
	});

	describe('shouldStopLoading', () => {
		it('should return false when neither condition is met', () => {
			const result = shouldStopLoading(0, 0);
			expect(result).toBe(false);
		});

		it('should return true if max empty chunks reached', () => {
			const result = shouldStopLoading(MAX_EMPTY_CHUNKS, 0);
			expect(result).toBe(true);
		});

		it('should return true if max load days reached', () => {
			const result = shouldStopLoading(0, MAX_LOAD_DAYS);
			expect(result).toBe(true);
		});

		it('should return true if both conditions are met', () => {
			const result = shouldStopLoading(MAX_EMPTY_CHUNKS, MAX_LOAD_DAYS);
			expect(result).toBe(true);
		});

		it('should return true if max empty chunks exceeded', () => {
			const result = shouldStopLoading(MAX_EMPTY_CHUNKS + 1, 0);
			expect(result).toBe(true);
		});

		it('should return true if max load days exceeded', () => {
			const result = shouldStopLoading(0, MAX_LOAD_DAYS + 1);
			expect(result).toBe(true);
		});

		it('should return false just below thresholds', () => {
			const result = shouldStopLoading(MAX_EMPTY_CHUNKS - 1, MAX_LOAD_DAYS - 1);
			expect(result).toBe(false);
		});
	});

	describe('calculatePastDaysToLoad', () => {
		it('should return CHUNK_SIZE_DAYS when no days loaded', () => {
			const result = calculatePastDaysToLoad(0);
			expect(result).toBe(CHUNK_SIZE_DAYS);
		});

		it('should return remaining days when close to max', () => {
			const pastDaysLoaded = MAX_PAST_DAYS - 7;
			const result = calculatePastDaysToLoad(pastDaysLoaded);
			expect(result).toBe(7);
		});

		it('should return 0 when max past days reached', () => {
			const result = calculatePastDaysToLoad(MAX_PAST_DAYS);
			expect(result).toBe(0);
		});

		it('should return 0 when max past days exceeded', () => {
			const result = calculatePastDaysToLoad(MAX_PAST_DAYS + 10);
			expect(result).toBe(0);
		});

		it('should cap at CHUNK_SIZE_DAYS even with room for more', () => {
			const result = calculatePastDaysToLoad(0);
			expect(result).toBe(CHUNK_SIZE_DAYS);
			expect(result).toBeLessThanOrEqual(CHUNK_SIZE_DAYS);
		});

		it('should handle partial chunk at limit', () => {
			// If 21 days loaded, can load 7 more (28 - 21 = 7)
			const result = calculatePastDaysToLoad(21);
			expect(result).toBe(7);
		});
	});

	// Integration tests
	describe('integration scenarios', () => {
		it('should handle initial load state', () => {
			// Initial state: no shows loaded, not loading, not in monitor mode
			expect(shouldLoadMore(true, false, false)).toBe(true);
			expect(shouldLoadPast(true, false, false, true)).toBe(true);
			expect(shouldStopLoading(0, 0)).toBe(false);
			expect(calculatePastDaysToLoad(0)).toBe(CHUNK_SIZE_DAYS);
		});

		it('should handle loading in progress', () => {
			// While loading, nothing else should trigger
			expect(shouldLoadMore(true, true, false)).toBe(false);
			expect(shouldLoadPast(true, true, false, true)).toBe(false);
		});

		it('should handle monitor mode', () => {
			// In monitor mode, no infinite scroll
			expect(shouldLoadMore(true, false, true)).toBe(false);
			expect(shouldLoadPast(true, false, true, true)).toBe(false);
		});

		it('should handle reaching limits', () => {
			// After reaching max, should stop
			expect(shouldLoadMore(false, false, false)).toBe(false);
			expect(shouldStopLoading(MAX_EMPTY_CHUNKS, MAX_LOAD_DAYS)).toBe(true);
			expect(calculatePastDaysToLoad(MAX_PAST_DAYS)).toBe(0);
		});

		it('should handle gradual past loading', () => {
			// Load past in chunks until max
			let pastDaysLoaded = 0;

			// First chunk: 14 days
			let toLoad = calculatePastDaysToLoad(pastDaysLoaded);
			expect(toLoad).toBe(14);
			pastDaysLoaded += toLoad;

			// Second chunk: 14 days (total 28)
			toLoad = calculatePastDaysToLoad(pastDaysLoaded);
			expect(toLoad).toBe(14);
			pastDaysLoaded += toLoad;

			// Third chunk: 0 days (at max)
			toLoad = calculatePastDaysToLoad(pastDaysLoaded);
			expect(toLoad).toBe(0);
			expect(pastDaysLoaded).toBe(MAX_PAST_DAYS);
		});
	});
});
