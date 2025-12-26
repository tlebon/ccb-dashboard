<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fetchShowsFromDB, type Show } from '$lib/utils/icalParser';
	import BrandingColumn from '$lib/components/BrandingColumn.svelte';
	import ShowsColumn from '$lib/components/ShowsColumn.svelte';
	import ImagesColumn from '$lib/components/ImagesColumn.svelte';
	import MobileHeader from '$lib/components/MobileHeader.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';

	// Week grouping interface for infinite scroll animation
	interface WeekGroup {
		weekLabel: string;
		startDate: Date;
		days: Record<string, Show[]>;
	}

	let mobileNavOpen = false;

	// Swipe gesture handling for mobile
	let touchStartX = 0;
	let touchStartY = 0;
	const SWIPE_THRESHOLD = 50; // Minimum distance for swipe
	const SWIPE_ANGLE_THRESHOLD = 30; // Max vertical movement to count as horizontal swipe

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function handleTouchEnd(e: TouchEvent) {
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const deltaX = touchEndX - touchStartX;
		const deltaY = Math.abs(touchEndY - touchStartY);

		// Only trigger if horizontal swipe and not too much vertical movement
		if (Math.abs(deltaX) > SWIPE_THRESHOLD && deltaY < SWIPE_ANGLE_THRESHOLD) {
			if (deltaX > 0 && canGoPrev) {
				// Swipe right = previous week
				prevWeek();
			} else if (deltaX < 0 && canGoNext) {
				// Swipe left = next week
				nextWeek();
			}
		}
	}

	// Week offset: 0 = this week, 1 = next week, 2 = week after, etc.
	let weekOffset = $state(0);
	let monitorMode = $state(false);
	let direction = $state(1); // 1 = forward, -1 = backward (for animation)
	let isManualNav = $state(true); // Track if navigation was manual (click) vs auto (monitor mode) - start true so first click is smooth
	let initialTheme: 'blue' | 'orange' = Math.random() < 0.5 ? 'blue' : 'orange'; // Random theme on load
	let monitorThemeOffset = $state(0); // Tracks theme rotation in monitor mode
	let interval: ReturnType<typeof setInterval>;
	let initialized = $state(false);

	// Show data
	let shows = $state<Show[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Infinite scroll state (for manual mode only)
	let displayedDays = $state(21); // Days loaded so far (matches initial load of 21 days)
	let loadingMore = $state(false);
	let hasMore = $state(true);
	let loadTrigger = $state<HTMLDivElement | null>(null); // Element to observe for loading more
	let consecutiveEmptyChunks = $state(0); // Track empty responses to know when to stop

	// Bidirectional scroll state (past shows)
	let pastDaysLoaded = $state(0); // How many days into past we've loaded
	let hasPastShows = $state(true); // Whether more past shows exist
	let topLoadTrigger = $state<HTMLDivElement | null>(null); // Element to observe for loading past shows
	let scrollContainer = $state<HTMLElement | null>(null); // Scroll container ref for position adjustment

	// Viewport tracking for poster sync (manual mode only)
	let visibleShowIds = $state<string[]>([]); // IDs of shows currently visible in viewport (populated by ShowsColumn)

	const ROTATE_MS = 30000; // Auto-rotate interval
	const MAX_WEEKS = 8; // Maximum weeks to show ahead
	const MIN_WEEKS = -4; // Maximum weeks to show behind (negative = past)

	// Sync week from URL (reacts to URL changes including back navigation)
	$effect(() => {
		const urlWeek = $page.url.searchParams.get('week');
		const parsed = urlWeek ? parseInt(urlWeek, 10) : 0;
		if (!isNaN(parsed) && parsed >= MIN_WEEKS && parsed < MAX_WEEKS && parsed !== weekOffset) {
			weekOffset = parsed;
		}
		initialized = true;
	});

	// Update URL when week changes (adds to browser history)
	function updateUrl(week: number) {
		const url = new URL(window.location.href);
		if (week === 0) {
			url.searchParams.delete('week');
		} else {
			url.searchParams.set('week', week.toString());
		}
		goto(url.pathname + url.search, { noScroll: true });
	}

	// Load more shows (for infinite scroll)
	// Single loading lock to prevent concurrent array modifications from both directions
	let loadingPromise: Promise<void> | null = null;

	// Infinite scroll constants
	const CHUNK_SIZE_DAYS = 14; // Load shows in 14-day chunks
	const MAX_LOAD_DAYS = 90; // Maximum days to load (stop after 90 days or 3 empty chunks)
	const MAX_EMPTY_CHUNKS = 3; // Stop after 3 consecutive empty chunks
	const MAX_PAST_DAYS = 28; // Load up to 4 weeks of past shows

	// Initial load constants
	const INITIAL_PAST_DAYS = 3; // Days of past shows to load initially
	const INITIAL_FUTURE_DAYS = 21; // Days of future shows to load initially
	const MONITOR_FUTURE_DAYS = 60; // Days ahead to load in monitor mode
	const MONITOR_PAST_DAYS = 28; // Days back to load in monitor mode

	async function loadMoreShows() {
		if (loadingPromise || !hasMore || monitorMode) {
			return;
		}

		loadingPromise = (async () => {
			try {
				loadingMore = true;

				// Calculate start date for next chunk based on days already loaded
				// Always calculate from today + displayedDays to handle gaps in schedule
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				const nextStartDate = new Date(today);
				nextStartDate.setDate(today.getDate() + displayedDays);

				// Load next chunk
				const newShows = await fetchShowsFromDB(CHUNK_SIZE_DAYS, 0, nextStartDate);

				// Always increment displayedDays, even if chunk is empty (to skip gaps)
				displayedDays += CHUNK_SIZE_DAYS;

				if (newShows.length === 0) {
					consecutiveEmptyChunks += 1;
					// Stop only after multiple consecutive empty chunks OR reaching max days
					if (consecutiveEmptyChunks >= MAX_EMPTY_CHUNKS || displayedDays >= MAX_LOAD_DAYS) {
						hasMore = false;
					}
				} else {
					// Reset empty chunk counter when we find shows
					consecutiveEmptyChunks = 0;
					// Append new shows to existing list
					shows = [...shows, ...newShows];
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

	// Load past shows (for bidirectional scroll)
	async function loadPastShows() {
		if (loadingPromise || !hasPastShows || monitorMode) {
			return;
		}

		loadingPromise = (async () => {
			try {
				loadingMore = true;

				// Calculate how many more days we can load (cap at MAX_PAST_DAYS total)
				const daysToLoad = Math.min(CHUNK_SIZE_DAYS, MAX_PAST_DAYS - pastDaysLoaded);

				if (daysToLoad <= 0) {
					hasPastShows = false;
					return;
				}

				// Load next chunk of past shows
				// pastDays parameter is how far back to START (current + days to load)
				const startOffset = pastDaysLoaded + daysToLoad;
				const pastShows = await fetchShowsFromDB(daysToLoad, startOffset);

				pastDaysLoaded += daysToLoad;

				if (pastShows.length === 0) {
					// No shows found, but still mark as loaded to prevent infinite retries
					if (pastDaysLoaded >= MAX_PAST_DAYS) {
						hasPastShows = false;
					}
				} else {
					// Save current scroll position before prepending
					const oldScrollHeight = scrollContainer?.scrollHeight || 0;
					const oldScrollTop = scrollContainer?.scrollTop || 0;

					// PREPEND past shows to beginning of array
					shows = [...pastShows, ...shows];

					// Wait for DOM to update, then adjust scroll position to maintain visual position
					await tick();
					if (scrollContainer) {
						const newScrollHeight = scrollContainer.scrollHeight;
						const heightDifference = newScrollHeight - oldScrollHeight;
						// Adjust scroll position by the amount of content added
						scrollContainer.scrollTop = oldScrollTop + heightDifference;
						// IntersectionObserver will handle animations as elements scroll into view
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

	onMount(async () => {
		try {
			// In manual mode (infinite scroll): fetch initial batch
			// In monitor mode: fetch enough shows to cover multiple weeks (future and past)
			if (monitorMode) {
				shows = await fetchShowsFromDB(MONITOR_FUTURE_DAYS, MONITOR_PAST_DAYS);
			} else {
				// Load minimal past + enough forward to get past holiday gaps
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

	// Debug state
	let debugInfo = $state({
		observerSetup: false,
		observerFired: 0,
		loadTriggered: 0,
		isIntersecting: false
	});

	// Setup Intersection Observer for infinite scroll when loadTrigger becomes available
	$effect(() => {
		if (!monitorMode && loadTrigger && scrollContainer) {
			debugInfo.observerSetup = true;
			console.log('[InfiniteScroll] Setting up observer for loadTrigger', {
				scrollContainerHeight: scrollContainer.clientHeight,
				scrollContainerScrollHeight: scrollContainer.scrollHeight,
				loadTriggerExists: !!loadTrigger
			});
			const observer = new IntersectionObserver(
				(entries) => {
					debugInfo.observerFired++;
					debugInfo.isIntersecting = entries[0].isIntersecting;
					console.log('[InfiniteScroll] Observer fired:', {
						isIntersecting: entries[0].isIntersecting,
						loadingMore,
						hasMore,
						fireCount: debugInfo.observerFired
					});
					if (entries[0].isIntersecting && !loadingMore && hasMore) {
						debugInfo.loadTriggered++;
						console.log('[InfiniteScroll] Loading more shows...');
						loadMoreShows();
					}
				},
				{
					root: scrollContainer,
					rootMargin: '500px'
				}
			);
			observer.observe(loadTrigger);

			return () => observer.disconnect();
		}
	});

	// Setup Intersection Observer for loading past shows (bidirectional scroll)
	$effect(() => {
		if (!monitorMode && topLoadTrigger && scrollContainer) {
			const observer = new IntersectionObserver(
				(entries) => {
					if (entries[0].isIntersecting && !loadingMore && hasPastShows) {
						loadPastShows();
					}
				},
				{
					root: scrollContainer,
					rootMargin: '500px'
				}
			);
			observer.observe(topLoadTrigger);

			return () => {
				observer.disconnect();
			};
		}
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	// Auto-rotate when in monitor mode (skips empty weeks)
	let prevMonitorModeForRotate = false;
	$effect(() => {
		if (monitorMode !== prevMonitorModeForRotate) {
			prevMonitorModeForRotate = monitorMode;

			// Reload data when switching modes (monitor needs more date range)
			if (monitorMode) {
				// Switch to monitor mode: load 60 future days and 28 past days
				fetchShowsFromDB(60, 28).then((newShows) => {
					shows = newShows;
				});
			} else {
				// Switching back to manual mode: reset infinite scroll state
				displayedDays = 14;
				pastDaysLoaded = 7;
				consecutiveEmptyChunks = 0;
				hasMore = true;
				hasPastShows = true;

				// Reload shows for manual mode (14 forward, 7 back)
				fetchShowsFromDB(14, 7).then((newShows) => {
					shows = newShows;
				});
			}

			if (interval) clearInterval(interval);
			if (monitorMode) {
				interval = setInterval(() => {
					const next = findNextWeekWithShows(weekOffset);
					if (next !== null) {
						direction = 1;
						isManualNav = false; // Auto-rotate uses full page transition
						monitorThemeOffset++; // Alternate theme each rotation
						weekOffset = next;
						updateUrl(weekOffset);
					} else {
						// Wrap around: find first week with shows
						const first = findNextWeekWithShows(-1);
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

	// Check if a week offset has any shows
	function weekHasShows(offset: number): boolean {
		const range = getWeekRange(offset);
		return shows.some((show) => {
			const showDate = new Date(show.start);
			return showDate >= range.startDate && showDate <= range.endDate;
		});
	}

	// Find next week with shows
	function findNextWeekWithShows(from: number): number | null {
		for (let i = from + 1; i < MAX_WEEKS; i++) {
			if (weekHasShows(i)) return i;
		}
		return null;
	}

	// Find previous week with shows
	function findPrevWeekWithShows(from: number): number | null {
		for (let i = from - 1; i >= MIN_WEEKS; i--) {
			if (weekHasShows(i)) return i;
		}
		return null;
	}

	function nextWeek() {
		const next = findNextWeekWithShows(weekOffset);
		if (next !== null) {
			direction = 1;
			isManualNav = true;
			weekOffset = next;
			updateUrl(weekOffset);
		}
	}

	function prevWeek() {
		const prev = findPrevWeekWithShows(weekOffset);
		if (prev !== null) {
			direction = -1;
			isManualNav = true;
			weekOffset = prev;
			updateUrl(weekOffset);
		}
	}

	function toggleMonitorMode() {
		monitorMode = !monitorMode;
	}

	function goToToday() {
		direction = weekOffset > 0 ? -1 : 1;
		isManualNav = true;
		weekOffset = 0;
		updateUrl(0);
	}

	// Calculate date range for current week offset
	function getWeekRange(offset: number) {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		if (offset === 0) {
			// This week: from Monday of current week
			const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
			const daysSinceMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
			const weekStart = new Date(today);
			weekStart.setDate(today.getDate() - daysSinceMonday);
			weekStart.setHours(0, 0, 0, 0);

			// In monitor mode: show full week (Monday-Sunday)
			// In manual mode: show through today + 4 days (for browsing context)
			const endDate = new Date(weekStart);
			if (monitorMode) {
				// Full week: Sunday is 6 days after Monday
				endDate.setDate(weekStart.getDate() + 6);
			} else {
				// Manual mode: show past shows + upcoming few days
				endDate.setTime(today.getTime());
				endDate.setDate(today.getDate() + 4);
			}
			endDate.setHours(23, 59, 59, 999);
			return { startDate: weekStart, endDate, label: 'This Week' };
		} else if (offset > 0) {
			// Future weeks: Calculate the Monday of week N
			const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
			const daysUntilNextMonday = (8 - dayOfWeek) % 7 || 7;
			const weekStart = new Date(today);
			weekStart.setDate(today.getDate() + daysUntilNextMonday + (offset - 1) * 7);
			weekStart.setHours(0, 0, 0, 0);

			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekStart.getDate() + 6);
			weekEnd.setHours(23, 59, 59, 999);

			// Format date range for label
			const startStr = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
			const endStr = weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
			const label = offset === 1 ? 'Next Week' : `${startStr} - ${endStr}`;

			return { startDate: weekStart, endDate: weekEnd, label };
		} else {
			// Past weeks (negative offset): Calculate the Monday of that past week
			const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
			// Days since last Monday (if today is Monday, it's 0)
			const daysSinceMonday = (dayOfWeek + 6) % 7;
			const thisMonday = new Date(today);
			thisMonday.setDate(today.getDate() - daysSinceMonday);

			// Go back N weeks from this Monday
			const weekStart = new Date(thisMonday);
			weekStart.setDate(thisMonday.getDate() + offset * 7);
			weekStart.setHours(0, 0, 0, 0);

			const weekEnd = new Date(weekStart);
			weekEnd.setDate(weekStart.getDate() + 6);
			weekEnd.setHours(23, 59, 59, 999);

			// Format date range for label
			const startStr = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
			const endStr = weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
			const label = offset === -1 ? 'Last Week' : `${startStr} - ${endStr}`;

			return { startDate: weekStart, endDate: weekEnd, label };
		}
	}

	let weekRange = $derived(getWeekRange(weekOffset));

	// Current time for past show detection (reactive)
	let currentTime = $derived(new Date());

	// Filter shows based on mode
	let weekShows = $derived(
		monitorMode
			? // Monitor mode: filter by week range
				shows.filter((show) => {
					const showDate = new Date(show.start);
					return showDate >= weekRange.startDate && showDate <= weekRange.endDate;
				})
			: // Manual mode (infinite scroll): show all loaded shows (past and future)
				shows
	);

	// In monitor mode, filter out shows that have already started
	let displayShows = $derived(
		monitorMode ? weekShows.filter((show) => new Date(show.start) > currentTime) : weekShows
	);

	// Track IDs of shows that have passed their start time (for greying out in manual mode)
	let pastShowIds = $derived(
		weekShows.filter((show) => new Date(show.start) <= currentTime).map((show) => show.id)
	);

	// Find the first upcoming show (for auto-scroll in manual mode)
	let firstUpcomingShow = $derived.by(() => {
		const upcoming = weekShows
			.filter((show) => new Date(show.start) > currentTime)
			.sort((a, b) => +new Date(a.start) - +new Date(b.start));

		return upcoming[0];
	});
	let firstUpcomingShowId = $derived(firstUpcomingShow?.id ?? null);

	// Helper: Get Monday (start of week) for a given date
	function getWeekStart(date: Date): Date {
		const d = new Date(date);
		d.setHours(0, 0, 0, 0);
		const dayOfWeek = d.getDay(); // 0 (Sun) - 6 (Sat)
		const daysSinceMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
		d.setDate(d.getDate() - daysSinceMonday);
		return d;
	}

	// Helper: Generate week label based on distance from today
	function getWeekLabel(weekStart: Date, today: Date): string {
		const todayWeekStart = getWeekStart(today);
		const diffMs = weekStart.getTime() - todayWeekStart.getTime();
		const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

		if (diffWeeks === 0) return 'This Week';
		if (diffWeeks === 1) return 'Next Week';
		if (diffWeeks === -1) return 'Last Week';

		// Format as date range for other weeks
		const weekEnd = new Date(weekStart);
		weekEnd.setDate(weekStart.getDate() + 6);

		const startMonth = weekStart.toLocaleDateString(undefined, { month: 'short' });
		const startDay = weekStart.getDate();
		const endMonth = weekEnd.toLocaleDateString(undefined, { month: 'short' });
		const endDay = weekEnd.getDate();

		if (startMonth === endMonth) {
			return `${startMonth} ${startDay}-${endDay}`;
		} else {
			return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
		}
	}

	// Group shows by week, then by day within each week
	function groupShowsByWeek(shows: Show[]): WeekGroup[] {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// Group shows by week
		const showsByWeek = new Map<string, Show[]>();

		for (const show of shows) {
			const showDate = new Date(show.start);
			const weekStart = getWeekStart(showDate);
			const weekKey = weekStart.toISOString();

			if (!showsByWeek.has(weekKey)) {
				showsByWeek.set(weekKey, []);
			}
			showsByWeek.get(weekKey)!.push(show);
		}

		// Convert to WeekGroup format
		const weeks: WeekGroup[] = [];
		for (const [weekKey, weekShows] of showsByWeek) {
			const weekStart = new Date(weekKey);
			const weekLabel = getWeekLabel(weekStart, today);
			const days = groupShowsByDay(weekShows, false); // Don't filter by current week here

			weeks.push({ weekLabel, startDate: weekStart, days });
		}

		// Sort by week start date
		return weeks.sort((a, b) => +a.startDate - +b.startDate);
	}

	let groupedShows = $derived(groupShowsByWeek(displayShows));

	function groupShowsByDay(shows: Show[], isCurrentWeek = false) {
		const groups: Record<string, Show[]> = {};
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		// For current week, calculate Monday of this week
		const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
		const daysSinceMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
		const weekStart = new Date(today);
		weekStart.setDate(today.getDate() - daysSinceMonday);
		weekStart.setHours(0, 0, 0, 0);

		for (const show of shows) {
			const date = new Date(show.start);
			date.setHours(0, 0, 0, 0);

			if (isCurrentWeek) {
				// Include shows from Monday of current week through today + 4 days
				const endDate = new Date(today);
				endDate.setDate(today.getDate() + 4);
				endDate.setHours(23, 59, 59, 999);

				if (date < weekStart || date > endDate) continue;
			}

			const dayKey = date.toLocaleDateString(undefined, {
				weekday: 'long',
				month: 'long',
				day: 'numeric'
			});
			if (!groups[dayKey]) groups[dayKey] = [];
			groups[dayKey].push(show);
		}
		return groups;
	}

	// Find next show
	let now = $derived(new Date());
	let nextShow = $derived(
		weekShows
			.filter((s) => new Date(s.start) > now)
			.sort((a, b) => +new Date(a.start) - +new Date(b.start))[0]
	);
	let highlightedShowIds = $derived(weekShows.filter((s) => s.imageUrl).map((s) => s.id));

	// Font sizing: Fixed for manual mode (infinite scroll), dynamic for monitor mode
	let dayCount = $derived(groupedShows.length); // Number of weeks
	let totalShows = $derived(weekShows.length);

	// In manual mode (infinite scroll), use fixed consistent sizes
	// In monitor mode, use dynamic sizing based on content
	let dayHeadingClass = $derived(
		monitorMode
			? totalShows > 20
				? 'text-xl'
				: totalShows > 15
					? 'text-2xl'
					: dayCount < 5
						? 'text-3xl'
						: 'text-2xl'
			: 'text-2xl' // Fixed size for infinite scroll
	);
	let timeClass = $derived(
		monitorMode
			? totalShows > 20
				? 'text-lg'
				: totalShows > 15
					? 'text-xl'
					: dayCount < 5
						? 'text-2xl'
						: 'text-xl'
			: 'text-xl' // Fixed size for infinite scroll
	);
	let titleClass = $derived(
		monitorMode
			? totalShows > 20
				? 'text-base'
				: totalShows > 15
					? 'text-lg'
					: dayCount < 5
						? 'text-xl'
						: 'text-lg'
			: 'text-lg' // Fixed size for infinite scroll
	);

	// Theme: random on load for manual nav, alternates in monitor mode
	let theme = $derived(
		isManualNav
			? initialTheme
			: ((monitorThemeOffset % 2 === 0
					? initialTheme
					: initialTheme === 'blue'
						? 'orange'
						: 'blue') as 'blue' | 'orange')
	);

	// Layout style only changes in monitor mode (affects column order)
	let isNextWeekStyle = $derived(!isManualNav && monitorThemeOffset % 2 === 1);

	// Navigation availability (based on whether there are weeks with shows)
	// Note: explicit dependency on `shows` to recompute when data loads
	let prevWeekOffset = $derived(shows.length ? findPrevWeekWithShows(weekOffset) : null);
	let nextWeekOffset = $derived(shows.length ? findNextWeekWithShows(weekOffset) : null);
	let canGoPrev = $derived(!loading && prevWeekOffset !== null);
	let canGoNext = $derived(!loading && nextWeekOffset !== null);
	let prevWeekLabel = $derived(prevWeekOffset !== null ? getWeekRange(prevWeekOffset).label : '');
	let nextWeekLabel = $derived(nextWeekOffset !== null ? getWeekRange(nextWeekOffset).label : '');

	// Past week detection (negative offset means past)
	let isPastWeek = $derived(weekOffset < 0);
</script>

<svelte:head>
	<title>CCB Dashboard</title>
</svelte:head>

<!-- Mobile Navigation Sidebar -->
<MobileNav bind:open={mobileNavOpen} {theme} on:close={() => (mobileNavOpen = false)} />

<div class="relative h-screen w-full overflow-hidden bg-black">
	<!-- Monitor mode: full page transitions -->
	{#if !isManualNav}
		{#key weekOffset}
			<div
				in:fly={{ x: direction > 0 ? 400 : -400, duration: 600, easing: cubicOut, delay: 100 }}
				out:fly={{ x: direction > 0 ? -400 : 400, duration: 500, easing: cubicOut }}
				class="absolute inset-0 box-border flex h-screen max-h-screen flex-col overflow-hidden text-white
               {theme === 'orange'
					? 'bg-gradient-to-br from-[var(--nw-deep-purple)] via-black to-[var(--nw-burning-orange)]'
					: 'bg-gradient-to-br from-[var(--tw-midnight)] via-black to-[var(--tw-deep-purple)]'}"
			>
				<!-- Grain texture overlay -->
				<div class="grain-overlay"></div>

				<!-- Mobile Layout with swipe support (visible on small screens) -->
				<div
					class="flex h-full flex-col md:hidden"
					on:touchstart={handleTouchStart}
					on:touchend={handleTouchEnd}
				>
					<MobileHeader
						{theme}
						weekLabel={weekRange.label}
						{canGoPrev}
						{canGoNext}
						{weekOffset}
						on:openMenu={() => (mobileNavOpen = true)}
						on:prev={prevWeek}
						on:next={nextWeek}
						on:today={goToToday}
					/>
					<main class="relative z-10 flex-1 overflow-hidden px-3 py-3">
						<ShowsColumn
							{groupedShows}
							{loading}
							{error}
							dayHeadingClass="text-xl"
							timeClass="text-base"
							titleClass="text-sm"
							{highlightedShowIds}
							{theme}
							monitorMode={false}
							showInlineImages={true}
							{pastShowIds}
							{firstUpcomingShowId}
							isCurrentWeek={true}
							{loadingMore}
							{hasMore}
							bind:loadTrigger
							{hasPastShows}
							bind:topLoadTrigger
							{pastDaysLoaded}
							bind:visibleShowIds
							bind:scrollContainer
						/>
					</main>
				</div>

				<!-- Desktop Layout (visible on md+ screens) -->
				<main
					class="relative z-10 mx-auto hidden min-h-0 w-full flex-1 grid-cols-1 items-stretch gap-3 px-3 py-4 md:grid"
					style="grid-template-columns: {isNextWeekStyle
						? '3.5fr 3.5fr 2.7fr'
						: '2.7fr 3.5fr 3.5fr'};"
				>
					{#if isNextWeekStyle}
						<!-- Next week style: Images, Shows, Branding -->
						<ImagesColumn
							{nextShow}
							shows={weekShows}
							nextShowId={nextShow?.id}
							upFirst={true}
							{theme}
							{isPastWeek}
							{visibleShowIds}
							{monitorMode}
						/>
						<ShowsColumn
							{groupedShows}
							{loading}
							{error}
							{dayHeadingClass}
							{timeClass}
							{titleClass}
							{highlightedShowIds}
							{theme}
							{monitorMode}
							{pastShowIds}
							{firstUpcomingShowId}
							isCurrentWeek={weekOffset === 0}
						/>
						<BrandingColumn
							{theme}
							{monitorMode}
							weekLabel={weekRange.label}
							{canGoPrev}
							{canGoNext}
							{weekOffset}
							{prevWeekLabel}
							{nextWeekLabel}
							on:prev={prevWeek}
							on:next={nextWeek}
							on:today={goToToday}
							on:toggleMonitor={toggleMonitorMode}
						/>
					{:else}
						<!-- This week style: Branding, Shows, Images -->
						<BrandingColumn
							{theme}
							{monitorMode}
							weekLabel={weekRange.label}
							{canGoPrev}
							{canGoNext}
							{weekOffset}
							{prevWeekLabel}
							{nextWeekLabel}
							on:prev={prevWeek}
							on:next={nextWeek}
							on:today={goToToday}
							on:toggleMonitor={toggleMonitorMode}
						/>
						<ShowsColumn
							{groupedShows}
							{loading}
							{error}
							{dayHeadingClass}
							{timeClass}
							{titleClass}
							{highlightedShowIds}
							{theme}
							{monitorMode}
							{pastShowIds}
							{firstUpcomingShowId}
							isCurrentWeek={weekOffset === 0}
						/>
						<ImagesColumn
							{nextShow}
							shows={weekShows}
							nextShowId={nextShow?.id}
							{theme}
							{isPastWeek}
							{visibleShowIds}
							{monitorMode}
						/>
					{/if}
				</main>
			</div>
		{/key}
	{:else}
		<!-- Manual nav: stable layout with content transitions -->
		<div
			class="absolute inset-0 box-border flex h-screen max-h-screen flex-col overflow-hidden text-white
             {theme === 'orange'
				? 'bg-gradient-to-br from-[var(--nw-deep-purple)] via-black to-[var(--nw-burning-orange)]'
				: 'bg-gradient-to-br from-[var(--tw-midnight)] via-black to-[var(--tw-deep-purple)]'}"
		>
			<!-- Grain texture overlay -->
			<div class="grain-overlay"></div>

			<!-- Mobile Layout with swipe support (visible on small screens) -->
			<div
				class="flex h-full flex-col md:hidden"
				on:touchstart={handleTouchStart}
				on:touchend={handleTouchEnd}
			>
				<MobileHeader
					{theme}
					weekLabel={weekRange.label}
					{canGoPrev}
					{canGoNext}
					{weekOffset}
					on:openMenu={() => (mobileNavOpen = true)}
					on:prev={prevWeek}
					on:next={nextWeek}
					on:today={goToToday}
				/>
				<main class="relative z-10 flex-1 overflow-hidden px-3 py-3">
					{#key weekOffset}
						<div
							in:fly={{ x: direction > 0 ? 100 : -100, duration: 200, easing: cubicOut }}
							out:fade={{ duration: 100 }}
							class="h-full"
						>
							<ShowsColumn
								{groupedShows}
								{loading}
								{error}
								dayHeadingClass="text-xl"
								timeClass="text-base"
								titleClass="text-sm"
								{highlightedShowIds}
								{theme}
								monitorMode={false}
								showInlineImages={true}
								{pastShowIds}
								{firstUpcomingShowId}
								isCurrentWeek={true}
								{loadingMore}
								{hasMore}
								bind:loadTrigger
								{hasPastShows}
								bind:topLoadTrigger
								{pastDaysLoaded}
								bind:visibleShowIds
								bind:scrollContainer
							/>
						</div>
					{/key}
				</main>
			</div>

			<!-- Desktop Layout (visible on md+ screens) -->
			<main
				class="relative z-10 mx-auto hidden min-h-0 w-full flex-1 grid-cols-1 items-stretch gap-3 px-3 py-4 md:grid"
				style="grid-template-columns: 2.7fr 3.5fr 3.5fr;"
			>
				<!-- Branding stays on left, stable -->
				<BrandingColumn
					{theme}
					{monitorMode}
					weekLabel={weekRange.label}
					{canGoPrev}
					{canGoNext}
					{weekOffset}
					{prevWeekLabel}
					{nextWeekLabel}
					on:prev={prevWeek}
					on:next={nextWeek}
					on:today={goToToday}
					on:toggleMonitor={toggleMonitorMode}
				/>
				<!-- Shows column with transition -->
				<div class="relative overflow-hidden">
					{#key weekOffset}
						<div
							in:fly={{ x: direction > 0 ? 100 : -100, duration: 200, easing: cubicOut }}
							out:fade={{ duration: 100 }}
							class="absolute inset-0"
						>
							<ShowsColumn
								{groupedShows}
								{loading}
								{error}
								{dayHeadingClass}
								{timeClass}
								{titleClass}
								{highlightedShowIds}
								{theme}
								{monitorMode}
								{pastShowIds}
								{firstUpcomingShowId}
								isCurrentWeek={true}
								{loadingMore}
								{hasMore}
								bind:loadTrigger
								{hasPastShows}
								bind:topLoadTrigger
								{pastDaysLoaded}
								bind:visibleShowIds
								bind:scrollContainer
							/>
						</div>
					{/key}
				</div>
				<!-- Images column with transition -->
				<div class="relative overflow-hidden">
					{#key weekOffset}
						<div
							in:fly={{ x: direction > 0 ? 100 : -100, duration: 200, easing: cubicOut }}
							out:fade={{ duration: 100 }}
							class="absolute inset-0"
						>
							<ImagesColumn
								{nextShow}
								shows={weekShows}
								nextShowId={nextShow?.id}
								{theme}
								{isPastWeek}
								{visibleShowIds}
								{monitorMode}
							/>
						</div>
					{/key}
				</div>
			</main>
		</div>
	{/if}

<!-- Debug Overlay -->
<div class="fixed bottom-2 left-2 z-50 rounded bg-black/90 p-2 text-xs text-white font-mono">
	<div>Observer Setup: {debugInfo.observerSetup ? '✓' : '✗'}</div>
	<div>Observer Fired: {debugInfo.observerFired}x</div>
	<div>Load Triggered: {debugInfo.loadTriggered}x</div>
	<div>IsIntersecting: {debugInfo.isIntersecting ? 'YES' : 'NO'}</div>
	<div>LoadingMore: {loadingMore ? 'YES' : 'NO'}</div>
	<div>HasMore: {hasMore ? 'YES' : 'NO'}</div>
	<div>DisplayedDays: {displayedDays}</div>
</div>
</div>
