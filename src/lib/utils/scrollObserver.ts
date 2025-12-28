/**
 * Utilities for setting up scroll observers and tracking scroll direction
 */

/**
 * Creates a scroll direction tracker that monitors whether user is scrolling up or down
 * @param container The scroll container to track
 * @returns Object with handleScroll function and getDirection getter
 */
export function createScrollDirectionTracker(container: HTMLElement) {
	let lastScrollTop = container.scrollTop;
	let isScrollingUp = false;

	const handleScroll = () => {
		const currentScrollTop = container?.scrollTop || 0;
		isScrollingUp = currentScrollTop < lastScrollTop;
		lastScrollTop = currentScrollTop;
	};

	return {
		handleScroll,
		getDirection: () => isScrollingUp
	};
}

/**
 * Creates an IntersectionObserver for infinite scroll triggers
 * @param trigger The element to observe
 * @param container The scroll container (root for IntersectionObserver)
 * @param callback Function to call when trigger enters viewport
 * @param rootMargin Distance before trigger enters viewport to start loading
 * @returns The IntersectionObserver instance
 */
export function createScrollObserver(
	trigger: HTMLElement,
	container: HTMLElement,
	callback: () => void,
	rootMargin: string = '2000px'
) {
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries[0].isIntersecting) {
				callback();
			}
		},
		{
			root: container,
			rootMargin,
			threshold: [0, 0.1, 1.0]
		}
	);

	observer.observe(trigger);
	return observer;
}
