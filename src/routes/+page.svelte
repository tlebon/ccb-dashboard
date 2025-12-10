<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
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
  let weekOffset = 0;
  let monitorMode = false;
  let direction = 1; // 1 = forward, -1 = backward (for animation)
  let interval: ReturnType<typeof setInterval>;
  let initialized = false;

  // Show data
  let shows: Show[] = [];
  let loading = true;
  let error: string | null = null;

  const ROTATE_MS = 30000; // Auto-rotate interval
  const MAX_WEEKS = 8; // Maximum weeks to show

  // Sync week from URL (reacts to URL changes including back navigation)
  $: urlWeek = $page.url.searchParams.get('week');
  $: {
    const parsed = urlWeek ? parseInt(urlWeek, 10) : 0;
    if (!isNaN(parsed) && parsed >= 0 && parsed < MAX_WEEKS && parsed !== weekOffset) {
      weekOffset = parsed;
    }
    initialized = true;
  }

  // Update URL when week changes (without adding to history)
  function updateUrl(week: number) {
    const url = new URL(window.location.href);
    if (week === 0) {
      url.searchParams.delete('week');
    } else {
      url.searchParams.set('week', week.toString());
    }
    goto(url.pathname + url.search, { replaceState: true, noScroll: true });
  }

  onMount(async () => {
    try {
      // Fetch enough shows to cover multiple weeks
      shows = await fetchShowsFromDB(60);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load shows';
    } finally {
      loading = false;
    }
  });

  onDestroy(() => {
    if (interval) clearInterval(interval);
  });

  // Auto-rotate when in monitor mode (skips empty weeks)
  $: if (monitorMode) {
    interval = setInterval(() => {
      const next = findNextWeekWithShows(weekOffset);
      if (next !== null) {
        direction = 1;
        weekOffset = next;
        updateUrl(weekOffset);
      } else {
        // Wrap around: find first week with shows
        const first = findNextWeekWithShows(-1);
        if (first !== null && first !== weekOffset) {
          direction = 1;
          weekOffset = first;
          updateUrl(weekOffset);
        }
      }
    }, ROTATE_MS);
  } else {
    if (interval) clearInterval(interval);
  }

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
    for (let i = from - 1; i >= 0; i--) {
      if (weekHasShows(i)) return i;
    }
    return null;
  }

  function nextWeek() {
    const next = findNextWeekWithShows(weekOffset);
    if (next !== null) {
      direction = 1;
      weekOffset = next;
      updateUrl(weekOffset);
    }
  }

  function prevWeek() {
    const prev = findPrevWeekWithShows(weekOffset);
    if (prev !== null) {
      direction = -1;
      weekOffset = prev;
      updateUrl(weekOffset);
    }
  }

  function toggleMonitorMode() {
    monitorMode = !monitorMode;
  }

  // Calculate date range for current week offset
  function getWeekRange(offset: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (offset === 0) {
      // This week: today + next 4 days
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 4);
      endDate.setHours(23, 59, 59, 999);
      return { startDate: today, endDate, label: 'This Week' };
    } else {
      // Calculate the Monday of week N
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
    }
  }

  $: weekRange = getWeekRange(weekOffset);

  // Filter and group shows for current week
  $: weekShows = shows.filter(show => {
    const showDate = new Date(show.start);
    return showDate >= weekRange.startDate && showDate <= weekRange.endDate;
  });

  $: groupedShows = groupShowsByDay(weekShows, weekOffset === 0);

  function groupShowsByDay(shows: Show[], limitToFiveDays = false) {
    const groups: Record<string, Show[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const show of shows) {
      const date = new Date(show.start);
      date.setHours(0, 0, 0, 0);

      if (limitToFiveDays) {
        const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0 || diffDays >= 5) continue;
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
  $: now = new Date();
  $: nextShow = weekShows.filter(s => new Date(s.start) > now).sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  $: highlightedShowIds = weekShows.filter(s => s.imageUrl).map(s => s.id);

  // Dynamic sizing based on content
  $: dayCount = Object.keys(groupedShows).length;
  $: totalShows = weekShows.length;
  $: dayHeadingClass = totalShows > 20 ? 'text-xl' : totalShows > 15 ? 'text-2xl' : dayCount < 5 ? 'text-3xl' : 'text-2xl';
  $: timeClass = totalShows > 20 ? 'text-lg' : totalShows > 15 ? 'text-xl' : dayCount < 5 ? 'text-2xl' : 'text-xl';
  $: titleClass = totalShows > 20 ? 'text-base' : totalShows > 15 ? 'text-lg' : dayCount < 5 ? 'text-xl' : 'text-lg';

  // Theme alternates: even weeks = blue, odd weeks = orange
  $: theme = (weekOffset % 2 === 0 ? 'blue' : 'orange') as 'blue' | 'orange';
  $: isNextWeekStyle = weekOffset % 2 === 1;

  // Navigation availability (based on whether there are weeks with shows)
  $: canGoPrev = !loading && findPrevWeekWithShows(weekOffset) !== null;
  $: canGoNext = !loading && findNextWeekWithShows(weekOffset) !== null;
</script>

<!-- Mobile Navigation Sidebar -->
<MobileNav bind:open={mobileNavOpen} {theme} on:close={() => mobileNavOpen = false} />

<div class="relative w-full h-screen overflow-hidden bg-black">
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
          on:openMenu={() => mobileNavOpen = true}
          on:prev={prevWeek}
          on:next={nextWeek}
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
          />
        </main>
      </div>

      <!-- Desktop Layout (visible on md+ screens) -->
      <main class="hidden md:grid flex-1 w-full mx-auto grid-cols-1 gap-3 items-stretch px-3 py-4 min-h-0 relative z-10"
            style="grid-template-columns: {isNextWeekStyle ? '3.5fr 3.5fr 2.7fr' : '2.7fr 3.5fr 3.5fr'};">
        {#if isNextWeekStyle}
          <!-- Next week style: Images, Shows, Branding -->
          <ImagesColumn {nextShow} shows={weekShows} nextShowId={nextShow?.id} upFirst={true} {theme} />
          <ShowsColumn {groupedShows} {loading} {error} {dayHeadingClass} {timeClass} {titleClass} {highlightedShowIds} {theme} {monitorMode} />
          <BrandingColumn
            {theme}
            {monitorMode}
            weekLabel={weekRange.label}
            {canGoPrev}
            {canGoNext}
            on:prev={prevWeek}
            on:next={nextWeek}
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
            on:prev={prevWeek}
            on:next={nextWeek}
            on:toggleMonitor={toggleMonitorMode}
          />
          <ShowsColumn {groupedShows} {loading} {error} {dayHeadingClass} {timeClass} {titleClass} {highlightedShowIds} {theme} {monitorMode} />
          <ImagesColumn {nextShow} shows={weekShows} nextShowId={nextShow?.id} {theme} />
        {/if}
      </main>
    </div>
  {/key}
</div>
