<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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
  let displayedDays = $state(14); // Days loaded so far
  let loadingMore = $state(false);
  let hasMore = $state(true);
  let loadTrigger = $state<HTMLDivElement | null>(null); // Element to observe for loading more
  let consecutiveEmptyChunks = $state(0); // Track empty responses to know when to stop

  // Viewport tracking for poster sync (manual mode only)
  let visibleShowIds: string[] = []; // IDs of shows currently visible in viewport (populated by ShowsColumn)

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
  let loadingPromise: Promise<void> | null = null;
  const MAX_LOAD_DAYS = 90; // Maximum days to load (stop after 90 days or 3 empty chunks)
  const MAX_EMPTY_CHUNKS = 3; // Stop after 3 consecutive empty chunks

  async function loadMoreShows() {
    if (loadingPromise || !hasMore || monitorMode) {
      console.log('[LoadMore] Skipped - loadingPromise:', !!loadingPromise, 'hasMore:', hasMore, 'monitorMode:', monitorMode);
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

        console.log('[LoadMore] Loading chunk - startDate:', nextStartDate.toISOString().split('T')[0], 'displayedDays:', displayedDays, 'consecutiveEmpty:', consecutiveEmptyChunks);

        // Load next 14-day chunk
        const newShows = await fetchShowsFromDB(14, 0, nextStartDate);

        console.log('[LoadMore] Received', newShows.length, 'shows');

        // Always increment displayedDays, even if chunk is empty (to skip gaps)
        displayedDays += 14;

        if (newShows.length === 0) {
          consecutiveEmptyChunks += 1;
          console.log('[LoadMore] Empty chunk - consecutiveEmpty:', consecutiveEmptyChunks, 'displayedDays:', displayedDays);
          // Stop only after multiple consecutive empty chunks OR reaching max days
          if (consecutiveEmptyChunks >= MAX_EMPTY_CHUNKS || displayedDays >= MAX_LOAD_DAYS) {
            hasMore = false;
            console.log('[LoadMore] Stopping - reached limit');
          }
        } else {
          // Reset empty chunk counter when we find shows
          consecutiveEmptyChunks = 0;
          // Append new shows to existing list
          shows = [...shows, ...newShows];
          console.log('[LoadMore] Added shows - total now:', shows.length);
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

  onMount(async () => {
    try {
      // In manual mode (infinite scroll): fetch initial 14 days
      // In monitor mode: fetch enough shows to cover multiple weeks (future and past)
      // pastDays = 28 covers MIN_WEEKS (-4 weeks back)
      shows = await fetchShowsFromDB(monitorMode ? 60 : 14, monitorMode ? 28 : 0);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load shows';
    } finally {
      loading = false;
    }
  });

  // Setup Intersection Observer for infinite scroll when loadTrigger becomes available
  $effect(() => {
    console.log('[Effect] Running - monitorMode:', monitorMode, 'loadTrigger:', !!loadTrigger);
    if (!monitorMode && loadTrigger) {
      console.log('[IntersectionObserver] Setting up observer for loadTrigger');
      const observer = new IntersectionObserver(
        (entries) => {
          console.log('[IntersectionObserver] Trigger intersecting:', entries[0].isIntersecting, 'loadingMore:', loadingMore, 'hasMore:', hasMore);
          if (entries[0].isIntersecting && !loadingMore && hasMore) {
            loadMoreShows();
          }
        },
        { rootMargin: '500px' }
      );
      observer.observe(loadTrigger);

      return () => {
        console.log('[IntersectionObserver] Cleaning up observer');
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
        fetchShowsFromDB(60, 28).then(newShows => {
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
    return shows.some(show => {
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
      console.log('[WeekRange] This Week - mode:', monitorMode ? 'monitor' : 'manual', 'range:', weekStart.toISOString().split('T')[0], 'to', endDate.toISOString().split('T')[0]);
      return { startDate: weekStart, endDate, label: 'This Week' };
    } else if (offset > 0) {
      // Future weeks: Calculate the Monday of week N
      const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
      const daysUntilNextMonday = ((8 - dayOfWeek) % 7) || 7;
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
        shows.filter(show => {
          const showDate = new Date(show.start);
          return showDate >= weekRange.startDate && showDate <= weekRange.endDate;
        })
      : // Manual mode (infinite scroll): show all loaded shows from today onwards
        shows.filter(show => {
          const showDate = new Date(show.start);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return showDate >= today;
        })
  );

  // In monitor mode, filter out shows that have already started
  let displayShows = $derived(
    monitorMode
      ? weekShows.filter(show => new Date(show.start) > currentTime)
      : weekShows
  );

  // Track IDs of shows that have passed their start time (for greying out in manual mode)
  let pastShowIds = $derived(
    weekShows
      .filter(show => new Date(show.start) <= currentTime)
      .map(show => show.id)
  );

  // Find the first upcoming show (for auto-scroll in manual mode)
  let firstUpcomingShow = $derived(
    weekShows
      .filter(show => new Date(show.start) > currentTime)
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0]
  );
  let firstUpcomingShowId = $derived(firstUpcomingShow?.id ?? null);

  let groupedShows = $derived(groupShowsByDay(displayShows, monitorMode && weekOffset === 0));

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
        weekday: 'long', month: 'long', day: 'numeric'
      });
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(show);
    }
    return groups;
  }

  // Find next show
  let now = $derived(new Date());
  let nextShow = $derived(weekShows.filter(s => new Date(s.start) > now).sort((a, b) => +new Date(a.start) - +new Date(b.start))[0]);
  let highlightedShowIds = $derived(weekShows.filter(s => s.imageUrl).map(s => s.id));

  // Dynamic sizing based on content
  let dayCount = $derived(Object.keys(groupedShows).length);
  let totalShows = $derived(weekShows.length);
  let dayHeadingClass = $derived(totalShows > 20 ? 'text-xl' : totalShows > 15 ? 'text-2xl' : dayCount < 5 ? 'text-3xl' : 'text-2xl');
  let timeClass = $derived(totalShows > 20 ? 'text-lg' : totalShows > 15 ? 'text-xl' : dayCount < 5 ? 'text-2xl' : 'text-xl');
  let titleClass = $derived(totalShows > 20 ? 'text-base' : totalShows > 15 ? 'text-lg' : dayCount < 5 ? 'text-xl' : 'text-lg');

  // Theme: random on load for manual nav, alternates in monitor mode
  let theme = $derived(
    isManualNav
      ? initialTheme
      : (monitorThemeOffset % 2 === 0 ? initialTheme : (initialTheme === 'blue' ? 'orange' : 'blue')) as 'blue' | 'orange'
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
<MobileNav bind:open={mobileNavOpen} {theme} on:close={() => mobileNavOpen = false} />

<div class="relative w-full h-screen overflow-hidden bg-black">
  <!-- Monitor mode: full page transitions -->
  {#if !isManualNav}
    {#key weekOffset}
      <div
        in:fly={{ x: direction > 0 ? 400 : -400, duration: 600, easing: cubicOut, delay: 100 }}
        out:fly={{ x: direction > 0 ? -400 : 400, duration: 500, easing: cubicOut }}
        class="absolute inset-0 h-screen max-h-screen text-white flex flex-col overflow-hidden box-border
               {theme === 'orange'
                 ? 'bg-gradient-to-br from-[var(--nw-deep-purple)] via-black to-[var(--nw-burning-orange)]'
                 : 'bg-gradient-to-br from-[var(--tw-midnight)] via-black to-[var(--tw-deep-purple)]'}">
        <!-- Grain texture overlay -->
        <div class="grain-overlay"></div>

        <!-- Mobile Layout with swipe support (visible on small screens) -->
        <div
          class="flex flex-col h-full md:hidden"
          on:touchstart={handleTouchStart}
          on:touchend={handleTouchEnd}
        >
          <MobileHeader
            {theme}
            weekLabel={weekRange.label}
            {canGoPrev}
            {canGoNext}
            {weekOffset}
            on:openMenu={() => mobileNavOpen = true}
            on:prev={prevWeek}
            on:next={nextWeek}
            on:today={goToToday}
          />
          <main class="flex-1 overflow-hidden px-3 py-3 relative z-10">
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
              bind:visibleShowIds
            />
          </main>
        </div>

        <!-- Desktop Layout (visible on md+ screens) -->
        <main class="hidden md:grid flex-1 w-full mx-auto grid-cols-1 gap-3 items-stretch px-3 py-4 min-h-0 relative z-10"
              style="grid-template-columns: {isNextWeekStyle ? '3.5fr 3.5fr 2.7fr' : '2.7fr 3.5fr 3.5fr'};">
          {#if isNextWeekStyle}
            <!-- Next week style: Images, Shows, Branding -->
            <ImagesColumn {nextShow} shows={weekShows} nextShowId={nextShow?.id} upFirst={true} {theme} {isPastWeek} {visibleShowIds} {monitorMode} />
            <ShowsColumn {groupedShows} {loading} {error} {dayHeadingClass} {timeClass} {titleClass} {highlightedShowIds} {theme} {monitorMode} {pastShowIds} {firstUpcomingShowId} isCurrentWeek={weekOffset === 0} />
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
            <ShowsColumn {groupedShows} {loading} {error} {dayHeadingClass} {timeClass} {titleClass} {highlightedShowIds} {theme} {monitorMode} {pastShowIds} {firstUpcomingShowId} isCurrentWeek={weekOffset === 0} />
            <ImagesColumn {nextShow} shows={weekShows} nextShowId={nextShow?.id} {theme} {isPastWeek} {visibleShowIds} {monitorMode} />
          {/if}
        </main>
      </div>
    {/key}
  {:else}
    <!-- Manual nav: stable layout with content transitions -->
    <div
      class="absolute inset-0 h-screen max-h-screen text-white flex flex-col overflow-hidden box-border
             {theme === 'orange'
               ? 'bg-gradient-to-br from-[var(--nw-deep-purple)] via-black to-[var(--nw-burning-orange)]'
               : 'bg-gradient-to-br from-[var(--tw-midnight)] via-black to-[var(--tw-deep-purple)]'}">
      <!-- Grain texture overlay -->
      <div class="grain-overlay"></div>

      <!-- Mobile Layout with swipe support (visible on small screens) -->
      <div
        class="flex flex-col h-full md:hidden"
        on:touchstart={handleTouchStart}
        on:touchend={handleTouchEnd}
      >
        <MobileHeader
          {theme}
          weekLabel={weekRange.label}
          {canGoPrev}
          {canGoNext}
          {weekOffset}
          on:openMenu={() => mobileNavOpen = true}
          on:prev={prevWeek}
          on:next={nextWeek}
          on:today={goToToday}
        />
        <main class="flex-1 overflow-hidden px-3 py-3 relative z-10">
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
                bind:visibleShowIds
              />
            </div>
          {/key}
        </main>
      </div>

      <!-- Desktop Layout (visible on md+ screens) -->
      <main class="hidden md:grid flex-1 w-full mx-auto grid-cols-1 gap-3 items-stretch px-3 py-4 min-h-0 relative z-10"
            style="grid-template-columns: 2.7fr 3.5fr 3.5fr;">
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
              <ShowsColumn {groupedShows} {loading} {error} {dayHeadingClass} {timeClass} {titleClass} {highlightedShowIds} {theme} {monitorMode} {pastShowIds} {firstUpcomingShowId} isCurrentWeek={true} {loadingMore} {hasMore} bind:loadTrigger bind:visibleShowIds />
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
              <ImagesColumn {nextShow} shows={weekShows} nextShowId={nextShow?.id} {theme} {isPastWeek} {visibleShowIds} {monitorMode} />
            </div>
          {/key}
        </div>
      </main>
    </div>
  {/if}
</div>
