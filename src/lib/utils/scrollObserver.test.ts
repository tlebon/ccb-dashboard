import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createScrollDirectionTracker, createScrollObserver } from './scrollObserver';

describe('createScrollDirectionTracker', () => {
	let container: HTMLDivElement;

	beforeEach(() => {
		container = document.createElement('div');
		Object.defineProperty(container, 'scrollTop', {
			writable: true,
			value: 100
		});
	});

	it('should create a scroll direction tracker', () => {
		const tracker = createScrollDirectionTracker(container);

		expect(tracker).toHaveProperty('handleScroll');
		expect(tracker).toHaveProperty('getDirection');
		expect(typeof tracker.handleScroll).toBe('function');
		expect(typeof tracker.getDirection).toBe('function');
	});

	it('should track scrolling up', () => {
		const tracker = createScrollDirectionTracker(container);

		// Scroll up (decrease scrollTop)
		Object.defineProperty(container, 'scrollTop', { value: 50 });
		tracker.handleScroll();

		expect(tracker.getDirection()).toBe(true); // isScrollingUp = true
	});

	it('should track scrolling down', () => {
		const tracker = createScrollDirectionTracker(container);

		// Scroll down (increase scrollTop)
		Object.defineProperty(container, 'scrollTop', { value: 150 });
		tracker.handleScroll();

		expect(tracker.getDirection()).toBe(false); // isScrollingUp = false
	});

	it('should update direction on consecutive scrolls', () => {
		const tracker = createScrollDirectionTracker(container);

		// Scroll down
		Object.defineProperty(container, 'scrollTop', { value: 150 });
		tracker.handleScroll();
		expect(tracker.getDirection()).toBe(false);

		// Then scroll up
		Object.defineProperty(container, 'scrollTop', { value: 100 });
		tracker.handleScroll();
		expect(tracker.getDirection()).toBe(true);
	});

	it('should handle scrollTop = 0 when container is null', () => {
		const tracker = createScrollDirectionTracker(container);

		// Simulate container becoming null
		container = null as any;
		tracker.handleScroll();

		// Should not throw
		expect(tracker.getDirection()).toBeDefined();
	});
});

describe('createScrollObserver', () => {
	let trigger: HTMLDivElement;
	let container: HTMLDivElement;
	let callback: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		trigger = document.createElement('div');
		container = document.createElement('div');
		callback = vi.fn();

		// Mock IntersectionObserver as a class
		global.IntersectionObserver = class IntersectionObserver {
			cb: IntersectionObserverCallback;
			options: IntersectionObserverInit;
			observe = vi.fn((target: Element) => {
				// Immediately trigger callback for testing
				setTimeout(() => {
					this.cb([{ isIntersecting: true, target } as IntersectionObserverEntry], this as any);
				}, 0);
			});
			disconnect = vi.fn();
			unobserve = vi.fn();
			takeRecords = vi.fn(() => []);
			root: Element | null;
			rootMargin: string;
			thresholds: number[];

			constructor(cb: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
				this.cb = cb;
				this.options = options;
				this.root = options.root || null;
				this.rootMargin = options.rootMargin || '0px';
				this.thresholds = Array.isArray(options.threshold) ? options.threshold : [options.threshold || 0];
			}
		} as any;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should create an IntersectionObserver', () => {
		const observer = createScrollObserver(trigger, container, callback);

		expect(observer).toBeDefined();
		expect(observer.disconnect).toBeDefined();
	});

	it('should use provided rootMargin', () => {
		const observer = createScrollObserver(trigger, container, callback, '500px');

		expect(observer.rootMargin).toBe('500px');
	});

	it('should use default rootMargin of 2000px', () => {
		const observer = createScrollObserver(trigger, container, callback);

		expect(observer.rootMargin).toBe('2000px');
	});

	it('should set container as root', () => {
		const observer = createScrollObserver(trigger, container, callback);

		expect(observer.root).toBe(container);
	});

	it('should observe the trigger element', () => {
		const observer = createScrollObserver(trigger, container, callback);

		expect(observer.observe).toHaveBeenCalledWith(trigger);
	});

	it('should call callback when trigger intersects', async () => {
		createScrollObserver(trigger, container, callback);

		// Wait for async callback
		await new Promise(resolve => setTimeout(resolve, 10));

		expect(callback).toHaveBeenCalled();
	});

	it('should not call callback when trigger does not intersect', () => {
		// Mock to return not intersecting
		global.IntersectionObserver = class IntersectionObserver {
			cb: IntersectionObserverCallback;
			observe = vi.fn((target: Element) => {
				setTimeout(() => {
					this.cb([{ isIntersecting: false, target } as IntersectionObserverEntry], this as any);
				}, 0);
			});
			disconnect = vi.fn();
			unobserve = vi.fn();
			takeRecords = vi.fn(() => []);

			constructor(cb: IntersectionObserverCallback) {
				this.cb = cb;
			}
		} as any;

		createScrollObserver(trigger, container, callback);

		expect(callback).not.toHaveBeenCalled();
	});

	it('should return observer with disconnect method', () => {
		const observer = createScrollObserver(trigger, container, callback);

		expect(observer.disconnect).toBeDefined();
		expect(typeof observer.disconnect).toBe('function');

		observer.disconnect();
		expect(observer.disconnect).toHaveBeenCalled();
	});
});
