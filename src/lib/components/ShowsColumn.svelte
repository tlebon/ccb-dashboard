<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import type { Show } from '$lib/utils/icalParser';
	import { isHouseShow, formatHouseShowTeams } from '$lib/utils/houseShowTeams';
	import { proxyImageUrl } from '$lib/utils/imageProxy';
	import { createScrollSnap } from '$lib/utils/scrollSnap';

	// Week grouping interface (matches parent component)
	interface WeekGroup {
		weekLabel: string;
		startDate: Date;
		days: Record<string, Show[]>;
	}

	let {
		groupedShows,
		loading,
		error,
		dayHeadingClass,
		timeClass,
		titleClass,
		theme = 'blue',
		highlightedShowIds = [],
		monitorMode = false,
		showInlineImages = false,
		pastShowIds = [],
		firstUpcomingShowId = null,
		isCurrentWeek = false,
		loadingMore = false,
		hasMore = true,
		loadTrigger = $bindable(null),
		hasPastShows = true,
		topLoadTrigger = $bindable(null),
		pastDaysLoaded = 0,
		visibleShowIds = $bindable([]),
		scrollContainer = $bindable()
	}: {
		groupedShows: WeekGroup[];
		loading: boolean;
		error: string | null;
		dayHeadingClass: string;
		timeClass: string;
		titleClass: string;
		theme?: 'blue' | 'orange';
		highlightedShowIds?: string[];
		monitorMode?: boolean;
		showInlineImages?: boolean;
		pastShowIds?: string[];
		firstUpcomingShowId?: string | null;
		isCurrentWeek?: boolean;
		loadingMore?: boolean;
		hasMore?: boolean;
		loadTrigger?: HTMLDivElement | null;
		hasPastShows?: boolean;
		topLoadTrigger?: HTMLDivElement | null;
		pastDaysLoaded?: number;
		visibleShowIds?: string[];
		scrollContainer?: HTMLElement | null;
	} = $props();
	let scrollDirection: 'down' | 'up' = 'down';
	let animationFrame: number;
	let pauseTimeout: ReturnType<typeof setTimeout>;
	let hasOverflow = false;
	let scrollProgress = 0; // 0 = top, 1 = bottom
	let isScrolling = false; // Guard to prevent re-initialization
	let showTodayButton = $state(false); // Show "Back to Today" button when scrolled above current day

	const SCROLL_SPEED = 1.5; // pixels per frame (~90px/sec at 60fps)
	const PAUSE_DURATION = 2000; // pause at top/bottom in ms
	const SCROLL_THRESHOLD_SHOW_TODAY = 0.95; // Show "Back to Today" when scrolled past 95% of content

	// Fallback timeout constants for mobile timing issues
	const CONTENT_VISIBILITY_FALLBACK_MS = 300; // Show content if scroll positioning doesn't complete
	const ANIMATION_FALLBACK_SHORT_MS = 500; // Ensure animations trigger (effect re-runs)
	const ANIMATION_FALLBACK_LONG_MS = 600; // Ensure animations trigger (initial mount)

	function checkOverflow() {
		if (scrollContainer) {
			hasOverflow = scrollContainer.scrollHeight > scrollContainer.clientHeight;
			updateScrollProgress();
		}
	}

	function updateScrollProgress() {
		if (scrollContainer) {
			const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
			const maxScroll = scrollHeight - clientHeight;
			scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0;
		}
	}

	function handleScroll() {
		updateScrollProgress();

		// Check if we should show "Back to Today" button
		if (!monitorMode && firstUpcomingShowId && scrollContainer) {
			// Find the day section containing the first upcoming show
			const daySections = scrollContainer.querySelectorAll('[data-day-shows]');
			let firstUpcomingDaySection: HTMLElement | null = null;

			for (const section of daySections) {
				const showIds = (section as HTMLElement).getAttribute('data-day-shows')?.split(',') || [];
				if (showIds.includes(firstUpcomingShowId)) {
					firstUpcomingDaySection = section as HTMLElement;
					break;
				}
			}

			if (firstUpcomingDaySection) {
				const rect = firstUpcomingDaySection.getBoundingClientRect();
				const containerRect = scrollContainer.getBoundingClientRect();
				// Show button if the day section is below the viewport (we're scrolled above it)
				showTodayButton = rect.top > containerRect.bottom;
			}
		} else {
			showTodayButton = false;
		}
	}

	/**
	 * Fallback helper: Ensures day sections become visible if IntersectionObserver doesn't fire
	 * Used for mobile timing issues where DOM/effects aren't ready when expected
	 */
	function ensureDaySectionsVisible() {
		if (scrollContainer) {
			const daySections = scrollContainer.querySelectorAll('[data-day-shows]');
			daySections.forEach((section) => {
				if (!section.classList.contains('reveal-up')) {
					section.classList.add('reveal-up');
				}
			});
		}
	}

	function autoScroll() {
		if (!scrollContainer || !monitorMode) return;

		const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
		const maxScroll = scrollHeight - clientHeight;

		// No need to scroll if content fits
		if (maxScroll <= 0) return;

		if (scrollDirection === 'down') {
			if (scrollTop >= maxScroll - 1) {
				// Reached bottom, pause then scroll up
				scrollDirection = 'up';
				pauseTimeout = setTimeout(() => {
					animationFrame = requestAnimationFrame(autoScroll);
				}, PAUSE_DURATION);
				return;
			}
			scrollContainer.scrollTop = scrollTop + SCROLL_SPEED;
		} else {
			if (scrollTop <= 1) {
				// Reached top, pause then scroll down
				scrollDirection = 'down';
				pauseTimeout = setTimeout(() => {
					animationFrame = requestAnimationFrame(autoScroll);
				}, PAUSE_DURATION);
				return;
			}
			scrollContainer.scrollTop = scrollTop - SCROLL_SPEED;
		}

		animationFrame = requestAnimationFrame(autoScroll);
	}

	function startAutoScroll() {
		if (isScrolling) return; // Already scrolling

		if (scrollContainer) {
			const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
			if (maxScroll <= 0) return;

			isScrolling = true;
			scrollContainer.scrollTop = 0;
			scrollDirection = 'down';
			pauseTimeout = setTimeout(() => {
				animationFrame = requestAnimationFrame(autoScroll);
			}, PAUSE_DURATION);
		}
	}

	function stopAutoScroll() {
		isScrolling = false;
		if (animationFrame) cancelAnimationFrame(animationFrame);
		if (pauseTimeout) clearTimeout(pauseTimeout);
	}

	function restartAutoScroll() {
		stopAutoScroll();
		// Wait for DOM to update with new content, then start
		// Use tick() to wait for Svelte to finish rendering
		tick().then(() => {
			setTimeout(() => {
				if (monitorMode && scrollContainer) {
					startAutoScroll();
				}
			}, 500);
		});
	}

	// Track previous monitor mode to detect actual changes
	let prevMonitorMode = false;
	$effect(() => {
		if (monitorMode !== prevMonitorMode) {
			prevMonitorMode = monitorMode;
			if (monitorMode && scrollContainer) {
				startAutoScroll();
			} else {
				stopAutoScroll();
			}
		}
	});

	// Track grouped shows to detect week changes
	let prevGroupedShowsKey = '';
	$effect(() => {
		// Generate key from week labels and day counts
		const newKey = groupedShows
			.map((w) => `${w.weekLabel}:${Object.keys(w.days).length}`)
			.join(',');
		if (scrollContainer) {
			setTimeout(checkOverflow, 100);
			// Restart auto-scroll when content changes while in monitor mode
			if (newKey !== prevGroupedShowsKey && prevGroupedShowsKey !== '' && monitorMode) {
				restartAutoScroll();
			}
			prevGroupedShowsKey = newKey;
		}
	});

	// Auto-scroll to first upcoming show in manual mode (when past shows are greyed out above)
	// Only applies to current week - past weeks show all shows from the top
	let isInitialScroll = true;
	let contentVisible = $state(false); // Hide content until positioned

	async function scrollToFirstUpcoming() {
		if (monitorMode || !firstUpcomingShowId || !scrollContainer || !isCurrentWeek) return;

		// Wait for DOM updates
		await tick();

		// On initial load, wait a bit less for DOM to settle
		if (isInitialScroll) {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}

		// Find the day container that contains the first upcoming show
		const dayContainers = scrollContainer.querySelectorAll('[data-day-shows]');
		let targetElement: HTMLElement | null = null;

		for (const container of dayContainers) {
			const showIds = container.getAttribute('data-day-shows')?.split(',') || [];
			if (showIds.includes(firstUpcomingShowId)) {
				targetElement = container as HTMLElement;
				break;
			}
		}

		if (targetElement && scrollContainer) {
			// Calculate position relative to scroll container
			let offsetTop = 0;
			let element = targetElement as HTMLElement;

			// Walk up the DOM tree until we reach the scroll container
			while (element && element !== scrollContainer) {
				offsetTop += element.offsetTop;
				element = element.offsetParent as HTMLElement;
			}

			// Set scroll position directly
			scrollContainer.scrollTop = offsetTop;
			isInitialScroll = false;

			// Show content after positioning
			contentVisible = true;
		}
	}

	// Make content visible if not in scroll-required mode
	$effect(() => {
		if (loading || monitorMode || !isCurrentWeek || pastShowIds.length === 0) {
			contentVisible = true;
		}
	});

	// Fallback: ensure content becomes visible even if scroll positioning doesn't happen
	// This handles cases where scrollContainer binding isn't ready when effects run (e.g., on mobile)
	$effect(() => {
		if (!contentVisible && !loading) {
			const timeout = setTimeout(() => {
				contentVisible = true;
			}, CONTENT_VISIBILITY_FALLBACK_MS);
			return () => clearTimeout(timeout);
		}
	});

	// Track when we should scroll - once per data load
	let lastScrolledForShowId: string | null = null;

	// Trigger scroll when data arrives and there are past shows to scroll past
	// Only on current week - past weeks show all shows from top
	$effect(() => {
		if (
			firstUpcomingShowId &&
			pastShowIds.length > 0 &&
			!monitorMode &&
			scrollContainer &&
			!loading &&
			isCurrentWeek &&
			firstUpcomingShowId !== lastScrolledForShowId
		) {
			lastScrolledForShowId = firstUpcomingShowId;
			scrollToFirstUpcoming();
		}
	});

	// Custom proximity snap - find the day container with the first upcoming show
	function getSnapTargetSelector(): string | null {
		if (!firstUpcomingShowId || !isCurrentWeek || monitorMode) return null;

		// Find which day container has the first upcoming show
		const dayContainers = scrollContainer?.querySelectorAll('[data-day-shows]');
		if (!dayContainers) return null;

		for (const container of dayContainers) {
			const showIds = container.getAttribute('data-day-shows')?.split(',') || [];
			if (showIds.includes(firstUpcomingShowId)) {
				return `[data-day-shows="${container.getAttribute('data-day-shows')}"]`;
			}
		}
		return null;
	}

	const scrollSnap = createScrollSnap(() => scrollContainer ?? null, getSnapTargetSelector, {
		proximityAbove: 80,
		proximityBelow: 100
	});

	function handleScrollWithSnap() {
		handleScroll();
		scrollSnap.onScroll();
	}

	onMount(() => {
		setTimeout(checkOverflow, 500);
		// If monitor mode is already on when component mounts (e.g., after week transition),
		// start auto-scroll after a delay to let the DOM settle
		if (monitorMode) {
			setTimeout(startAutoScroll, 800);
		}

		// Fallback for initial mount: ensure day sections become visible
		// This catches edge cases where effects don't run in time (e.g., mobile timing issues)
		setTimeout(ensureDaySectionsVisible, ANIMATION_FALLBACK_LONG_MS);
	});

	// Viewport tracking for poster sync (manual mode only)
	let visibleDaySections = new Set<string>(); // Track visible day section keys

	function updateVisibleShows() {
		if (monitorMode) {
			visibleShowIds = []; // Don't track in monitor mode
			return;
		}

		// Extract all show IDs from visible day sections
		const visible: string[] = [];
		visibleDaySections.forEach((dayKey) => {
			// Search through weeks to find matching day
			for (const week of groupedShows) {
				if (week.days[dayKey]) {
					visible.push(...week.days[dayKey].map((s) => s.id));
					break;
				}
			}
		});
		visibleShowIds = visible;
	}

	function setupViewportTracking(): IntersectionObserver | null {
		if (monitorMode || !scrollContainer) return null;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const dayKey = entry.target.getAttribute('data-day-key');
					if (!dayKey) return;

					if (entry.isIntersecting) {
						visibleDaySections.add(dayKey);
					} else {
						visibleDaySections.delete(dayKey);
					}
				});
				updateVisibleShows();
			},
			{
				root: scrollContainer,
				rootMargin: '-10% 0px -10% 0px', // Only consider elements in middle 80% of viewport
				threshold: 0.1
			}
		);

		// Observe all day section elements
		const daySections = scrollContainer.querySelectorAll('[data-day-key]');
		daySections.forEach((section) => observer.observe(section));

		return observer;
	}

	// Setup viewport tracking when content changes
	let viewportObserver: IntersectionObserver | null = null;
	let animationObserver: IntersectionObserver | null = null;
	let prevGroupedShowsKeyForViewport = '';

	// Setup animation observer for reveal-up effect on scroll
	function setupAnimationObserver(): IntersectionObserver | null {
		if (!scrollContainer) return null;

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						// Add reveal-up class when element enters viewport
						// The animation will handle opacity transition from 0 to 1
						entry.target.classList.add('reveal-up');
						// Unobserve after animating (one-time animation)
						observer.unobserve(entry.target);
					}
				});
			},
			{
				root: scrollContainer,
				rootMargin: '50px 0px', // Start animation slightly before entering viewport
				threshold: 0.1
			}
		);

		// Observe all day sections
		const daySections = scrollContainer.querySelectorAll('[data-day-shows]');
		daySections.forEach((section) => {
			// Only observe sections that haven't been animated yet
			if (!section.classList.contains('reveal-up')) {
				observer.observe(section);
			}
		});

		return observer;
	}

	$effect(() => {
		// Generate key from week labels and day counts
		const newKey = groupedShows
			.map((w) => `${w.weekLabel}:${Object.keys(w.days).length}`)
			.join(',');
		if (scrollContainer && newKey !== prevGroupedShowsKeyForViewport) {
			prevGroupedShowsKeyForViewport = newKey;
			// Cleanup old observers
			if (viewportObserver) {
				viewportObserver.disconnect();
			}
			if (animationObserver) {
				animationObserver.disconnect();
			}
			// Clear visible tracking when content changes
			visibleDaySections.clear();
			visibleShowIds = [];

			// Setup new observers after DOM updates
			tick().then(() => {
				viewportObserver = setupViewportTracking();
				animationObserver = setupAnimationObserver();

				// Fallback: ensure day sections become visible even if IntersectionObserver doesn't fire
				// This handles edge cases on mobile where elements might not trigger intersection callbacks
				setTimeout(ensureDaySectionsVisible, ANIMATION_FALLBACK_SHORT_MS);
			});
		}

		// Cleanup function: disconnect observers when effect re-runs or component unmounts
		return () => {
			if (viewportObserver) {
				viewportObserver.disconnect();
			}
			if (animationObserver) {
				animationObserver.disconnect();
			}
		};
	});

	onDestroy(() => {
		stopAutoScroll();
		scrollSnap.cleanup();
		if (viewportObserver) {
			viewportObserver.disconnect();
		}
		if (animationObserver) {
			animationObserver.disconnect();
		}
	});
</script>

<div class="relative flex h-full flex-col overflow-hidden">
	<!-- Subtle gradient fade when more content below -->
	{#if hasOverflow && !monitorMode && scrollProgress < SCROLL_THRESHOLD_SHOW_TODAY}
		<div
			class="pointer-events-none absolute right-2 bottom-0 left-0 z-10 h-12
             bg-gradient-to-t {theme === 'orange'
				? 'from-black/60'
				: 'from-[var(--tw-deep-purple)]/60'} to-transparent"
		></div>
	{/if}

	<!-- "Back to Today" floating button when scrolled above current day -->
	{#if showTodayButton}
		<button
			onclick={() => {
				if (!scrollContainer || !firstUpcomingShowId) return;

				// Find the day section containing the first upcoming show
				const daySections = scrollContainer.querySelectorAll('[data-day-shows]');
				for (const section of daySections) {
					const showIds = (section as HTMLElement).getAttribute('data-day-shows')?.split(',') || [];
					if (showIds.includes(firstUpcomingShowId)) {
						// Scroll to the top of the day section (the day heading)
						section.scrollIntoView({ behavior: 'smooth', block: 'start' });
						break;
					}
				}
			}}
			class="absolute top-4 right-4 z-20 cursor-pointer bg-gradient-to-r
             from-[var(--tw-electric-cyan)] to-[var(--tw-neon-pink)] px-4
             py-2 text-sm font-bold tracking-wider text-black
             uppercase shadow-[var(--tw-electric-cyan)]/50 shadow-lg
             transition-transform hover:scale-105"
			style="font-family: var(--font-mono); clip-path: polygon(0 0, 95% 0, 100% 100%, 5% 100%);"
		>
			↓ Today
		</button>
	{/if}

	<section
		bind:this={scrollContainer}
		onscroll={handleScrollWithSnap}
		class="reveal-up max-h-full space-y-3 overflow-x-hidden overflow-y-auto pr-2 transition-opacity delay-200 duration-200"
		style="opacity: {contentVisible ? 1 : 0}"
	>
		{#if loading}
			<p class="text-center text-xl font-bold text-white" style="font-family: var(--font-display);">
				Loading shows...
			</p>
		{:else if error}
			<p
				class="text-center text-xl font-bold text-red-400"
				style="font-family: var(--font-display);"
			>
				Error: {error}
			</p>
		{:else}
			<!-- Archive link when past show limit is reached -->
			{#if !monitorMode && !hasPastShows && pastDaysLoaded >= 28}
				<div class="mb-4 border-b border-white/10 py-4 text-center">
					<a
						href="/shows"
						class="inline-flex items-center gap-2 font-mono text-sm tracking-wider text-[var(--tw-electric-cyan)] uppercase transition-colors hover:text-[var(--tw-neon-pink)]"
					>
						<span>View Full Archive</span>
						<span>→</span>
					</a>
					<p class="mt-2 font-mono text-xs text-white/40">Showing last 4 weeks</p>
				</div>
			{/if}

			<!-- Top load trigger for bidirectional scroll (load past shows) -->
			{#if !monitorMode && hasPastShows}
				<div bind:this={topLoadTrigger} class="h-1 opacity-0" data-load-trigger-top="true"></div>
			{/if}

			{#each groupedShows as week, weekIndex (week.weekLabel)}
				{#each Object.entries(week.days) as [day, dayShows], dayIndex (day)}
					{@const dayShowIds = dayShows.map((s) => s.id)}
					<div class="md:opacity-0" data-day-shows={dayShowIds.join(',')} data-day-key={day}>
						<!-- Day heading with brutalist style -->
						<div class="relative mb-2">
							<h2
								class={`font-black tracking-wider text-white uppercase ${dayHeadingClass} relative inline-block px-3 py-1
                      ${
												theme === 'orange'
													? 'bg-gradient-to-r from-[var(--nw-hot-pink)] to-[var(--nw-burning-orange)]'
													: 'bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--tw-neon-pink)]'
											}`}
								style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);"
							>
								{day}
							</h2>
							<div
								class={`absolute right-2 -bottom-1 left-2 h-0.5 opacity-50
                      ${theme === 'orange' ? 'bg-[var(--nw-hot-pink)]' : 'bg-[var(--tw-electric-cyan)]'}`}
							></div>
						</div>

						<!-- Shows list -->
						<ul class="space-y-1.5">
							{#each dayShows as show, j (show.id)}
								{@const isHighlighted = highlightedShowIds.includes(show.id)}
								{@const isPast = pastShowIds.includes(show.id)}
								<li class="group" data-show-id={show.id}>
									<a
										href="/shows/{show.id}"
										class={`flex cursor-pointer items-center gap-3 px-2 py-1.5 transition-all duration-200
                          ${isPast ? 'opacity-40 hover:bg-white/5 hover:opacity-70' : 'hover:bg-white/5'}
                          ${isHighlighted ? 'border-l-8 pl-1' : 'border-l-4'}
                          ${
														theme === 'orange'
															? `border-[var(--nw-hot-pink)] ${isPast ? 'border-opacity-30' : ''} ${isHighlighted ? 'bg-[var(--nw-deep-purple)]/30' : ''}`
															: `border-[var(--tw-electric-cyan)] ${isPast ? 'border-opacity-30' : ''} ${isHighlighted ? 'bg-[var(--tw-deep-purple)]/40' : ''}`
													}`}
									>
										<!-- Time with monospace font -->
										<div
											class={`min-w-[70px] text-right font-bold transition-transform sm:min-w-[100px] ${isPast ? '' : 'group-hover:scale-110'} ${timeClass}
                            ${isPast ? 'text-white/30' : theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}`}
											style="font-family: var(--font-mono); font-weight: 500; letter-spacing: 0.05em;"
										>
											{new Date(show.start).toLocaleTimeString([], {
												hour: '2-digit',
												minute: '2-digit'
											})}
										</div>

										<!-- Show title with display font -->
										<div class="min-w-0 flex-1">
											<div
												class={`font-bold uppercase ${titleClass} leading-snug break-words
                              ${isPast ? 'text-white/40' : 'text-white group-hover:text-[var(--tw-electric-cyan)]'}`}
												style="font-family: var(--font-display); letter-spacing: 0.08em;"
											>
												{show.title}
											</div>
											{#if isHouseShow(show.title)}
												{@const teams = formatHouseShowTeams(show.start)}
												{#if teams}
													<div
														class="mt-0.5 font-mono text-sm tracking-wide break-words {isPast
															? 'text-white/40'
															: theme === 'orange'
																? 'text-[var(--nw-neon-yellow)]'
																: 'text-[var(--tw-neon-pink)]'}"
													>
														{teams}
													</div>
												{/if}
											{/if}
										</div>

										<!-- Inline thumbnail for mobile -->
										{#if showInlineImages && show.imageUrl}
											<div
												class="h-12 w-12 flex-shrink-0 overflow-hidden rounded border-2 {isPast
													? 'opacity-30'
													: ''} {theme === 'orange'
													? 'border-[var(--nw-hot-pink)]/50'
													: 'border-[var(--tw-electric-cyan)]/50'}"
											>
												<img
													src={proxyImageUrl(show.imageUrl)}
													alt=""
													class="h-full w-full object-cover"
												/>
											</div>
										{/if}
									</a>
								</li>
							{/each}
						</ul>
					</div>
				{/each}
			{/each}

			<!-- Infinite scroll: Load trigger element -->
			{#if !monitorMode && hasMore}
				<div bind:this={loadTrigger} class="h-1 opacity-0" data-load-trigger="true"></div>
			{/if}

			<!-- Infinite scroll: Loading indicator -->
			{#if loadingMore}
				<div class="py-3 text-center">
					<div class="inline-flex items-center gap-2 text-white/40">
						<div class="h-2 w-2 animate-pulse rounded-full bg-current"></div>
						<span class="font-mono text-sm tracking-wide uppercase">Loading</span>
					</div>
				</div>
			{/if}
		{/if}
	</section>
</div>
