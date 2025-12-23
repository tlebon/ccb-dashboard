/**
 * Custom proximity scroll snap utility
 * Provides configurable snap behavior for scrollable containers
 */

export interface ScrollSnapOptions {
	/** Pixels above target to trigger snap (when target is below viewport top) */
	proximityAbove?: number;
	/** Pixels below target to trigger snap (when target is above viewport top) */
	proximityBelow?: number;
	/** Debounce delay in ms before checking snap after scroll ends */
	debounceMs?: number;
}

const DEFAULT_OPTIONS: Required<ScrollSnapOptions> = {
	proximityAbove: 80,
	proximityBelow: 100,
	debounceMs: 150
};

/**
 * Creates scroll snap handlers for a container
 * @param getContainer - Function that returns the scroll container element
 * @param getTargetSelector - Function that returns the target element to snap to
 * @param options - Snap configuration options
 */
export function createScrollSnap(
	getContainer: () => HTMLElement | null,
	getTargetSelector: () => string | null,
	options: ScrollSnapOptions = {}
) {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	let scrollTimeout: ReturnType<typeof setTimeout>;

	function handleScrollEnd() {
		const container = getContainer();
		const selector = getTargetSelector();

		if (!container || !selector) return;

		const targetElement = container.querySelector(selector) as HTMLElement | null;
		if (!targetElement) return;

		const containerRect = container.getBoundingClientRect();
		const elementRect = targetElement.getBoundingClientRect();
		const offset = elementRect.top - containerRect.top;

		// offset > 0 means target is below viewport top (we've scrolled above it)
		// offset < 0 means target is above viewport top (we've scrolled below it)
		const shouldSnap =
			(offset > 0 && offset <= opts.proximityAbove) ||
			(offset < 0 && Math.abs(offset) <= opts.proximityBelow);

		if (shouldSnap && offset !== 0) {
			container.scrollTo({
				top: container.scrollTop + offset,
				behavior: 'smooth'
			});
		}
	}

	function onScroll() {
		clearTimeout(scrollTimeout);
		scrollTimeout = setTimeout(handleScrollEnd, opts.debounceMs);
	}

	function cleanup() {
		clearTimeout(scrollTimeout);
	}

	return {
		onScroll,
		cleanup
	};
}
