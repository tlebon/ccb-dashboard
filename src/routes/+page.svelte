<script lang="ts">
	/**
	 * CCB Dashboard - Main Home Page
	 * Refactored to use Desktop/Mobile components with shared state management
	 */
	import { onMount, onDestroy, tick, untrack } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fetchShowsFromDB, type Show } from '$lib/utils/icalParser';
	import {
		createScrollDirectionTracker,
		createScrollObserver,
		INFINITE_SCROLL_PRELOAD_DISTANCE,
		SCROLL_DIRECTION_MARGIN
	} from '$lib/utils/scrollObserver';

	// Phase 1 utilities
	import {
		getWeekRange,
		findNextWeekWithShows,
		findPrevWeekWithShows,
		MAX_WEEKS,
		MIN_WEEKS
	} from '$lib/utils/weekCalculations';
	import { groupShowsByWeek } from '$lib/utils/showGrouping';
	import { getTheme, getResponsiveSizes, getLayoutStyle } from '$lib/utils/themeSizing';
	import {
		shouldLoadMore,
		shouldLoadPast,
		calculatePastDaysToLoad,
		CHUNK_SIZE_DAYS,
		MAX_LOAD_DAYS,
		MAX_PAST_DAYS
	} from '$lib/utils/infiniteScrollState';

	// Components
	import MobileNav from '$lib/components/MobileNav.svelte';
	import MobileHomePage from '$lib/components/MobileHomePage.svelte';
	import DesktopHomePage from '$lib/components/DesktopHomePage.svelte';

	// ============================================================================
	// CONSTANTS
	// ============================================================================
	const ROTATE_MS = 30000; // Auto-rotate interval (30s)
	const MAX_EMPTY_CHUNKS = 3; // Stop loading after 3 consecutive empty responses
	const INITIAL_PAST_DAYS = 3; // Days of past shows to load initially
	const INITIAL_FUTURE_DAYS = 21; // Days of future shows to load initially
	const MONITOR_FUTURE_DAYS = 60; // Days ahead to load in monitor mode
	const MONITOR_PAST_DAYS = 28; // Days back to load in monitor mode

	// ============================================================================
	// UI STATE
	// ============================================================================
	let mobileNavOpen = $state(false);
	let weekOffset = $state(0);
	let monitorMode = $state(false);
	let direction = $state(1); // 1 = forward, -1 = backward (for animation)
	let isManualNav = $state(true); // Track if navigation was manual vs auto
	let initialTheme: 'blue' | 'orange' = Math.random() < 0.5 ? 'blue' : 'orange';
	let monitorThemeOffset = $state(0); // Tracks theme rotation in monitor mode
	let interval: ReturnType<typeof setInterval>;

	// ============================================================================
	// DATA & LOADING STATE
	// ============================================================================
	let shows = $state<Show[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// ============================================================================
	// INFINITE SCROLL STATE (Manual Mode Only)
	// ============================================================================
	let displayedDays = $state(21); // Days loaded so far
	let loadingMore = $state(false);
	let hasMore = $state(true);

	// Infinite scroll triggers - separate for mobile/desktop
	let mobileLoadTrigger = $state<HTMLDivElement | null>(null);
	let desktopLoadTrigger = $state<HTMLDivElement | null>(null);
	let mobileTopLoadTrigger = $state<HTMLDivElement | null>(null);
	let desktopTopLoadTrigger = $state<HTMLDivElement | null>(null);

	// Scroll containers - separate for mobile/desktop
	let mobileScrollContainer = $state<HTMLElement | null>(null);
	let desktopScrollContainer = $state<HTMLElement | null>(null);

	let consecutiveEmptyChunks = $state(0); // Track empty responses to know when to stop
	let lastLoadedDate = $state<string | null>(null); // Prevent duplicate loads

	// Bidirectional scroll state (past shows)
	let pastDaysLoaded = $state(0);
	let hasPastShows = $state(true);

	// Viewport tracking for poster sync
	let visibleShowIds = $state<string[]>([]);

	// ============================================================================
	// URL SYNC
	// ============================================================================
	$effect(() => {
		const urlWeek = $page.url.searchParams.get('week');
		const parsed = urlWeek ? parseInt(urlWeek, 10) : 0;
		if (!isNaN(parsed) && parsed >= MIN_WEEKS && parsed < MAX_WEEKS && parsed !== weekOffset) {
			weekOffset = parsed;
		}
	});

	function updateUrl(week: number) {
		const url = new URL(window.location.href);
		if (week === 0) {
			url.searchParams.delete('week');
		} else {
			url.searchParams.set('week', week.toString());
		}
		goto(url.pathname + url.search, { noScroll: true });
	}

	// ============================================================================
	// DATA LOADING
	// ============================================================================
	let loadingPromise: Promise<void> | null = null;

	async function loadMoreShows() {
		if (!shouldLoadMore(hasMore, loadingMore, monitorMode)) {
			return;
		}

		loadingPromise = (async () => {
			try {
				loadingMore = true;

				// Calculate start date for next chunk
				let nextStartDate: Date;
				if (shows.length > 0) {
					const lastShow = shows[shows.length - 1];
					nextStartDate = new Date(lastShow.start);
					nextStartDate.setUTCHours(0, 0, 0, 0);
					nextStartDate.setUTCDate(nextStartDate.getUTCDate() + 1);
				} else {
					const today = new Date();
					today.setHours(0, 0, 0, 0);
					nextStartDate = new Date(today);
					nextStartDate.setDate(today.getDate() + displayedDays);
				}

				const nextStartDateStr = nextStartDate.toISOString().split('T')[0];
				if (lastLoadedDate === nextStartDateStr) {
					hasMore = false;
					loadingMore = false;
					loadingPromise = null;
					return;
				}
				lastLoadedDate = nextStartDateStr;

				const daysToLoad = CHUNK_SIZE_DAYS;
				const newShows = await fetchShowsFromDB(daysToLoad, 0, nextStartDate);

				displayedDays += daysToLoad;

				if (newShows.length === 0) {
					consecutiveEmptyChunks += 1;
					if (consecutiveEmptyChunks >= MAX_EMPTY_CHUNKS || displayedDays >= MAX_LOAD_DAYS) {
						hasMore = false;
					}
				} else {
					consecutiveEmptyChunks = 0;
					const existingIds = new Set(shows.map((s) => s.id));
					const uniqueNewShows = newShows.filter((show) => !existingIds.has(show.id));
					shows = [...shows, ...uniqueNewShows];
				}
			} catch (e) {
				console.error('[LoadMore] Error:', e);
			} finally {
				loadingMore = false;
				loadingPromise = null;
			}
		})();

		await loadingPromise;
	}

	async function loadPastShows(isScrollingUp: boolean = true) {
		if (!shouldLoadPast(hasPastShows, loadingMore, monitorMode, isScrollingUp)) {
			return;
		}

		loadingPromise = (async () => {
			try {
				loadingMore = true;

				const daysToLoad = calculatePastDaysToLoad(pastDaysLoaded);

				if (daysToLoad <= 0) {
					hasPastShows = false;
					return;
				}

				const startOffset = pastDaysLoaded + daysToLoad;
				const pastShows = await fetchShowsFromDB(daysToLoad, startOffset);

				pastDaysLoaded += daysToLoad;

				if (pastShows.length === 0) {
					if (pastDaysLoaded >= MAX_PAST_DAYS) {
						hasPastShows = false;
					}
				} else {
					// Preserve scroll position when prepending shows
					const activeContainer =
						desktopScrollContainer && desktopScrollContainer.scrollHeight > 0
							? desktopScrollContainer
							: mobileScrollContainer;

					if (!activeContainer || activeContainer.scrollHeight === 0) {
						console.error('[LoadPast] No active container!');
						return;
					}

					const oldScrollHeight = activeContainer.scrollHeight;
					const oldScrollTop = activeContainer.scrollTop;

					shows = [...pastShows, ...shows];

					await tick();

					const newScrollHeight = activeContainer.scrollHeight;
					const heightDifference = newScrollHeight - oldScrollHeight;
					activeContainer.scrollTop = oldScrollTop + heightDifference;

					// Add reveal animation to prepended shows
					const daySections = activeContainer.querySelectorAll('[data-day-shows]');
					const prependedSectionCount = pastShows.length;
					for (let i = 0; i < Math.min(prependedSectionCount, daySections.length); i++) {
						if (!daySections[i].classList.contains('reveal-up')) {
							daySections[i].classList.add('reveal-up');
						}
					}
				}
			} catch (e) {
				console.error('[LoadPast] Error:', e);
			} finally {
				loadingMore = false;
				loadingPromise = null;
			}
		})();

		await loadingPromise;
	}

	// ============================================================================
	// LIFECYCLE: INITIAL LOAD
	// ============================================================================
	onMount(async () => {
		try {
			if (monitorMode) {
				shows = await fetchShowsFromDB(MONITOR_FUTURE_DAYS, MONITOR_PAST_DAYS);
			} else {
				shows = await fetchShowsFromDB(INITIAL_FUTURE_DAYS, INITIAL_PAST_DAYS);
				pastDaysLoaded = INITIAL_PAST_DAYS;
				displayedDays = INITIAL_FUTURE_DAYS;
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load shows';
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	// ============================================================================
	// INFINITE SCROLL OBSERVERS
	// ============================================================================

	// Mobile - future shows
	$effect(() => {
		if (!monitorMode && mobileScrollContainer && mobileLoadTrigger && !loading) {
			const observer = createScrollObserver(
				mobileLoadTrigger,
				mobileScrollContainer,
				() => {
					untrack(() => {
						if (!loadingMore && hasMore) {
							loadMoreShows();
						}
					});
				},
				INFINITE_SCROLL_PRELOAD_DISTANCE
			);

			return () => {
				observer.disconnect();
			};
		}
		return undefined;
	});

	// Desktop - future shows
	$effect(() => {
		if (!monitorMode && desktopScrollContainer && desktopLoadTrigger && !loading) {
			const observer = createScrollObserver(
				desktopLoadTrigger,
				desktopScrollContainer,
				() => {
					untrack(() => {
						if (!loadingMore && hasMore) {
							loadMoreShows();
						}
					});
				},
				INFINITE_SCROLL_PRELOAD_DISTANCE
			);

			return () => {
				observer.disconnect();
			};
		}
		return undefined;
	});

	// Mobile - past shows
	$effect(() => {
		if (!monitorMode && mobileTopLoadTrigger && mobileScrollContainer) {
			const scrollTracker = createScrollDirectionTracker(mobileScrollContainer);
			mobileScrollContainer.addEventListener('scroll', scrollTracker.handleScroll);

			const observer = createScrollObserver(
				mobileTopLoadTrigger,
				mobileScrollContainer,
				() => {
					untrack(() => {
						const isScrollingUp = scrollTracker.getDirection();
						if (isScrollingUp && !loadingMore && hasPastShows) {
							loadPastShows(isScrollingUp);
						}
					});
				},
				SCROLL_DIRECTION_MARGIN
			);

			return () => {
				mobileScrollContainer?.removeEventListener('scroll', scrollTracker.handleScroll);
				observer.disconnect();
			};
		}
		return undefined;
	});

	// Desktop - past shows
	$effect(() => {
		if (!monitorMode && desktopTopLoadTrigger && desktopScrollContainer) {
			const scrollTracker = createScrollDirectionTracker(desktopScrollContainer);
			desktopScrollContainer.addEventListener('scroll', scrollTracker.handleScroll);

			const observer = createScrollObserver(
				desktopTopLoadTrigger,
				desktopScrollContainer,
				() => {
					untrack(() => {
						const isScrollingUp = scrollTracker.getDirection();
						if (isScrollingUp && !loadingMore && hasPastShows) {
							loadPastShows(isScrollingUp);
						}
					});
				},
				SCROLL_DIRECTION_MARGIN
			);

			return () => {
				desktopScrollContainer?.removeEventListener('scroll', scrollTracker.handleScroll);
				observer.disconnect();
			};
		}
		return undefined;
	});

	// ============================================================================
	// MONITOR MODE AUTO-ROTATION
	// ============================================================================
	let prevMonitorModeForRotate = false;
	$effect(() => {
		if (monitorMode !== prevMonitorModeForRotate) {
			prevMonitorModeForRotate = monitorMode;

			if (monitorMode) {
				// Entering monitor mode - load extended range
				fetchShowsFromDB(MONITOR_FUTURE_DAYS, MONITOR_PAST_DAYS).then((newShows) => {
					shows = newShows;
				});
			} else {
				// Exiting monitor mode - reset to manual mode defaults
				displayedDays = INITIAL_FUTURE_DAYS;
				pastDaysLoaded = INITIAL_PAST_DAYS;
				consecutiveEmptyChunks = 0;
				hasMore = true;
				hasPastShows = true;
				lastLoadedDate = null;

				fetchShowsFromDB(INITIAL_FUTURE_DAYS, INITIAL_PAST_DAYS).then((newShows) => {
					shows = newShows;
				});
			}

			// Setup/teardown auto-rotation interval
			if (interval) clearInterval(interval);
			if (monitorMode) {
				interval = setInterval(() => {
					const next = findNextWeekWithShows(weekOffset, shows, MAX_WEEKS, true);
					if (next !== null) {
						direction = 1;
						isManualNav = false;
						monitorThemeOffset++;
						weekOffset = next;
						updateUrl(weekOffset);
					} else {
						// Loop back to first week with shows
						const first = findNextWeekWithShows(-1, shows, MAX_WEEKS, true);
						if (first !== null && first !== weekOffset) {
							direction = 1;
							isManualNav = false;
							monitorThemeOffset++;
							weekOffset = first;
							updateUrl(weekOffset);
						}
					}
				}, ROTATE_MS);
			}
		}
	});

	// ============================================================================
	// NAVIGATION FUNCTIONS
	// ============================================================================
	function nextWeek() {
		const next = findNextWeekWithShows(weekOffset, shows, MAX_WEEKS, monitorMode);
		if (next !== null) {
			direction = 1;
			isManualNav = true;
			weekOffset = next;
			updateUrl(weekOffset);
		}
	}

	function prevWeek() {
		const prev = findPrevWeekWithShows(weekOffset, shows, MIN_WEEKS, monitorMode);
		if (prev !== null) {
			direction = -1;
			isManualNav = true;
			weekOffset = prev;
			updateUrl(weekOffset);
		}
	}

	function goToToday() {
		direction = weekOffset > 0 ? -1 : 1;
		isManualNav = true;
		weekOffset = 0;
		updateUrl(0);
	}

	function toggleMonitorMode() {
		monitorMode = !monitorMode;
	}

	// ============================================================================
	// DERIVED COMPUTATIONS
	// ============================================================================
	let weekRange = $derived(getWeekRange(weekOffset, monitorMode));
	let currentTime = $derived(new Date());

	let weekShows = $derived(
		monitorMode
			? shows.filter((show) => {
					const showDate = new Date(show.start);
					return showDate >= weekRange.startDate && showDate <= weekRange.endDate;
				})
			: shows
	);

	let displayShows = $derived(
		monitorMode ? weekShows.filter((show) => new Date(show.start) > currentTime) : weekShows
	);

	let pastShowIds = $derived(
		weekShows.filter((show) => new Date(show.start) <= currentTime).map((show) => show.id)
	);

	let firstUpcomingShow = $derived.by(() => {
		const upcoming = weekShows
			.filter((show) => new Date(show.start) > currentTime)
			.sort((a, b) => +new Date(a.start) - +new Date(b.start));
		return upcoming[0];
	});

	let firstUpcomingShowId = $derived(firstUpcomingShow?.id ?? null);

	let now = $derived(new Date());
	let nextShow = $derived(
		weekShows
			.filter((s) => new Date(s.start) > now)
			.sort((a, b) => +new Date(a.start) - +new Date(b.start))[0]
	);
	let highlightedShowIds = $derived(weekShows.filter((s) => s.imageUrl).map((s) => s.id));

	let groupedShows = $derived(groupShowsByWeek(displayShows));

	let dayCount = $derived(groupedShows.length);
	let totalShows = $derived(weekShows.length);

	// Responsive sizing (uses Phase 1 utility)
	let responsiveSizes = $derived(getResponsiveSizes(monitorMode, totalShows, dayCount));
	let dayHeadingClass = $derived(responsiveSizes.dayHeadingClass);
	let timeClass = $derived(responsiveSizes.timeClass);
	let titleClass = $derived(responsiveSizes.titleClass);

	// Theme (uses Phase 1 utility)
	let theme = $derived(getTheme(isManualNav, initialTheme, monitorThemeOffset));

	// Layout style (uses Phase 1 utility)
	let isNextWeekStyle = $derived(getLayoutStyle(isManualNav, monitorThemeOffset));

	let prevWeekOffset = $derived(
		shows.length ? findPrevWeekWithShows(weekOffset, shows, MIN_WEEKS, monitorMode) : null
	);
	let nextWeekOffset = $derived(
		shows.length ? findNextWeekWithShows(weekOffset, shows, MAX_WEEKS, monitorMode) : null
	);
	let canGoPrev = $derived(!loading && prevWeekOffset !== null);
	let canGoNext = $derived(!loading && nextWeekOffset !== null);
	let prevWeekLabel = $derived(
		prevWeekOffset !== null ? getWeekRange(prevWeekOffset, monitorMode).label : ''
	);
	let nextWeekLabel = $derived(
		nextWeekOffset !== null ? getWeekRange(nextWeekOffset, monitorMode).label : ''
	);

	let isPastWeek = $derived(weekOffset < 0);
</script>

<svelte:head>
	<title>CCB Dashboard</title>
</svelte:head>

<!-- Mobile Navigation Sidebar -->
<MobileNav bind:open={mobileNavOpen} {theme} on:close={() => (mobileNavOpen = false)} />

<!-- Main container with theme background -->
<div
	class="absolute inset-0 box-border flex h-screen max-h-screen flex-col overflow-hidden text-white {theme ===
	'orange'
		? 'bg-gradient-to-br from-[var(--nw-deep-purple)] via-black to-[var(--nw-burning-orange)]'
		: 'bg-gradient-to-br from-[var(--tw-midnight)] via-black to-[var(--tw-deep-purple)]'}"
>
	<!-- Grain texture overlay -->
	<div class="grain-overlay"></div>

	<!-- Mobile layout (visible only on small screens) -->
	<MobileHomePage
		bind:weekOffset
		{theme}
		{groupedShows}
		{loading}
		{error}
		{weekRange}
		{canGoPrev}
		{canGoNext}
		{highlightedShowIds}
		{pastShowIds}
		{firstUpcomingShowId}
		{loadingMore}
		{hasMore}
		{hasPastShows}
		{pastDaysLoaded}
		bind:visibleShowIds
		bind:mobileLoadTrigger
		bind:mobileTopLoadTrigger
		bind:mobileScrollContainer
		onPrevWeek={prevWeek}
		onNextWeek={nextWeek}
		onToday={goToToday}
		onOpenMenu={() => (mobileNavOpen = true)}
	/>

	<!-- Desktop layout (visible on md+ screens) -->
	<DesktopHomePage
		bind:weekOffset
		{theme}
		{groupedShows}
		{weekShows}
		{loading}
		{error}
		{monitorMode}
		{isNextWeekStyle}
		{direction}
		{weekRange}
		{canGoPrev}
		{canGoNext}
		{prevWeekLabel}
		{nextWeekLabel}
		{highlightedShowIds}
		{pastShowIds}
		{firstUpcomingShowId}
		{nextShow}
		{isPastWeek}
		{dayHeadingClass}
		{timeClass}
		{titleClass}
		{loadingMore}
		{hasMore}
		{hasPastShows}
		{pastDaysLoaded}
		bind:visibleShowIds
		bind:desktopLoadTrigger
		bind:desktopTopLoadTrigger
		bind:desktopScrollContainer
		onPrevWeek={prevWeek}
		onNextWeek={nextWeek}
		onToday={goToToday}
		onToggleMonitor={toggleMonitorMode}
	/>
</div>
