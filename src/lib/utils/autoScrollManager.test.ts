import { describe, it, expect } from 'vitest';
import {
	SCROLL_SPEED,
	PAUSE_DURATION,
	SCROLL_THRESHOLD_SHOW_TODAY,
	isAtBottom,
	isAtTop,
	calculateMaxScroll,
	hasOverflow,
	calculateNextScrollPosition,
	shouldShowTodayButton,
	type ScrollDirection
} from './autoScrollManager';

describe('autoScrollManager utilities', () => {
	describe('constants', () => {
		it('should export SCROLL_SPEED', () => {
			expect(SCROLL_SPEED).toBe(1.5);
		});

		it('should export PAUSE_DURATION', () => {
			expect(PAUSE_DURATION).toBe(2000);
		});

		it('should export SCROLL_THRESHOLD_SHOW_TODAY', () => {
			expect(SCROLL_THRESHOLD_SHOW_TODAY).toBe(0.95);
		});
	});

	describe('isAtBottom', () => {
		it('should return true when exactly at bottom', () => {
			const result = isAtBottom(100, 100);
			expect(result).toBe(true);
		});

		it('should return true when within threshold of bottom', () => {
			const result = isAtBottom(99.5, 100, 1);
			expect(result).toBe(true);
		});

		it('should return false when above threshold', () => {
			const result = isAtBottom(98, 100, 1);
			expect(result).toBe(false);
		});

		it('should use custom threshold', () => {
			const result1 = isAtBottom(95, 100, 5);
			expect(result1).toBe(true);

			const result2 = isAtBottom(94, 100, 5);
			expect(result2).toBe(false);
		});

		it('should handle zero max scroll', () => {
			const result = isAtBottom(0, 0);
			expect(result).toBe(true);
		});
	});

	describe('isAtTop', () => {
		it('should return true when exactly at top', () => {
			const result = isAtTop(0);
			expect(result).toBe(true);
		});

		it('should return true when within threshold of top', () => {
			const result = isAtTop(0.5, 1);
			expect(result).toBe(true);
		});

		it('should return false when below threshold', () => {
			const result = isAtTop(2, 1);
			expect(result).toBe(false);
		});

		it('should use custom threshold', () => {
			const result1 = isAtTop(5, 5);
			expect(result1).toBe(true);

			const result2 = isAtTop(6, 5);
			expect(result2).toBe(false);
		});
	});

	describe('calculateMaxScroll', () => {
		it('should calculate max scroll correctly', () => {
			const result = calculateMaxScroll(1000, 600);
			expect(result).toBe(400);
		});

		it('should return 0 when content fits in viewport', () => {
			const result = calculateMaxScroll(500, 600);
			expect(result).toBe(0);
		});

		it('should return 0 when content exactly fits viewport', () => {
			const result = calculateMaxScroll(600, 600);
			expect(result).toBe(0);
		});

		it('should handle large scroll heights', () => {
			const result = calculateMaxScroll(10000, 800);
			expect(result).toBe(9200);
		});

		it('should handle minimal content', () => {
			const result = calculateMaxScroll(100, 600);
			expect(result).toBe(0);
		});
	});

	describe('hasOverflow', () => {
		it('should return true when content exceeds viewport', () => {
			const result = hasOverflow(1000, 600);
			expect(result).toBe(true);
		});

		it('should return false when content fits in viewport', () => {
			const result = hasOverflow(500, 600);
			expect(result).toBe(false);
		});

		it('should return false when content exactly fits viewport', () => {
			const result = hasOverflow(600, 600);
			expect(result).toBe(false);
		});

		it('should handle edge case with 1px overflow', () => {
			const result = hasOverflow(601, 600);
			expect(result).toBe(true);
		});
	});

	describe('calculateNextScrollPosition', () => {
		it('should increase position when scrolling down', () => {
			const result = calculateNextScrollPosition(100, 'down', SCROLL_SPEED);
			expect(result).toBe(101.5);
		});

		it('should decrease position when scrolling up', () => {
			const result = calculateNextScrollPosition(100, 'up', SCROLL_SPEED);
			expect(result).toBe(98.5);
		});

		it('should use default SCROLL_SPEED if not provided', () => {
			const result = calculateNextScrollPosition(100, 'down');
			expect(result).toBe(101.5);
		});

		it('should handle custom speed', () => {
			const result1 = calculateNextScrollPosition(100, 'down', 5);
			expect(result1).toBe(105);

			const result2 = calculateNextScrollPosition(100, 'up', 5);
			expect(result2).toBe(95);
		});

		it('should allow scrolling to negative positions (component will clamp)', () => {
			const result = calculateNextScrollPosition(1, 'up', 5);
			expect(result).toBe(-4);
		});

		it('should allow scrolling past max (component will clamp)', () => {
			const result = calculateNextScrollPosition(400, 'down', 5);
			expect(result).toBe(405);
		});
	});

	describe('shouldShowTodayButton', () => {
		it('should return false when at top', () => {
			const result = shouldShowTodayButton(0, 1000, 600);
			expect(result).toBe(false);
		});

		it('should return true when past threshold', () => {
			// maxScroll = 1000 - 600 = 400
			// threshold at 95% = 380
			const result = shouldShowTodayButton(381, 1000, 600);
			expect(result).toBe(true);
		});

		it('should return false when below threshold', () => {
			// maxScroll = 1000 - 600 = 400
			// threshold at 95% = 380
			const result = shouldShowTodayButton(379, 1000, 600);
			expect(result).toBe(false);
		});

		it('should return false when content fits in viewport', () => {
			const result = shouldShowTodayButton(0, 600, 600);
			expect(result).toBe(false);
		});

		it('should use custom threshold', () => {
			// maxScroll = 1000 - 600 = 400
			// threshold at 50% = 200
			const result1 = shouldShowTodayButton(201, 1000, 600, 0.5);
			expect(result1).toBe(true);

			const result2 = shouldShowTodayButton(199, 1000, 600, 0.5);
			expect(result2).toBe(false);
		});

		it('should return true when at very bottom', () => {
			const result = shouldShowTodayButton(400, 1000, 600);
			expect(result).toBe(true);
		});

		it('should handle exact threshold boundary', () => {
			// maxScroll = 1000 - 600 = 400
			// threshold at 95% = 380
			const result = shouldShowTodayButton(380, 1000, 600);
			expect(result).toBe(false); // Not > threshold
		});
	});

	// Integration scenarios
	describe('integration scenarios', () => {
		it('should handle typical scroll cycle', () => {
			const scrollHeight = 1000;
			const clientHeight = 600;
			const maxScroll = calculateMaxScroll(scrollHeight, clientHeight);

			expect(maxScroll).toBe(400);
			expect(hasOverflow(scrollHeight, clientHeight)).toBe(true);

			// Start at top
			let position = 0;
			let direction: ScrollDirection = 'down';
			expect(isAtTop(position)).toBe(true);

			// Scroll down partway
			for (let i = 0; i < 100; i++) {
				position = calculateNextScrollPosition(position, direction);
			}
			expect(position).toBeGreaterThan(0);
			expect(position).toBeLessThan(maxScroll);

			// Reach bottom
			while (!isAtBottom(position, maxScroll)) {
				position = calculateNextScrollPosition(position, direction);
			}
			expect(isAtBottom(position, maxScroll)).toBe(true);

			// Switch direction
			direction = 'up';

			// Scroll back to top
			while (!isAtTop(position)) {
				position = calculateNextScrollPosition(position, direction);
			}
			expect(isAtTop(position)).toBe(true);
		});

		it('should show today button only when scrolled far enough', () => {
			const scrollHeight = 2000;
			const clientHeight = 500;

			// At top: no button
			expect(shouldShowTodayButton(0, scrollHeight, clientHeight)).toBe(false);

			// At 50%: no button
			const halfWay = calculateMaxScroll(scrollHeight, clientHeight) / 2;
			expect(shouldShowTodayButton(halfWay, scrollHeight, clientHeight)).toBe(false);

			// At 96%: show button
			const nearBottom = calculateMaxScroll(scrollHeight, clientHeight) * 0.96;
			expect(shouldShowTodayButton(nearBottom, scrollHeight, clientHeight)).toBe(true);
		});

		it('should handle content that fits without scrolling', () => {
			const scrollHeight = 400;
			const clientHeight = 600;

			expect(hasOverflow(scrollHeight, clientHeight)).toBe(false);
			expect(calculateMaxScroll(scrollHeight, clientHeight)).toBe(0);
			expect(isAtBottom(0, 0)).toBe(true);
			expect(isAtTop(0)).toBe(true);
			expect(shouldShowTodayButton(0, scrollHeight, clientHeight)).toBe(false);
		});
	});
});
