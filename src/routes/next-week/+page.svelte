<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchShowsFromDB, type Show } from '$lib/utils/icalParser';
  import BrandingColumn from '$lib/components/BrandingColumn.svelte';
  import ShowsColumn from '$lib/components/ShowsColumn.svelte';
  import ImagesColumn from '$lib/components/ImagesColumn.svelte';

  // Week grouping interface (matches ShowsColumn)
  interface WeekGroup {
    weekLabel: string;
    startDate: Date;
    days: Record<string, Show[]>;
  }

  let shows: Show[] = [];
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      // Fetch from database with 14 days to cover next week
      shows = await fetchShowsFromDB(14);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load shows';
    } finally {
      loading = false;
    }
  });

  // Helper: Get Monday (start of week) for a given date
  function getWeekStart(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dayOfWeek = d.getDay(); // 0 (Sun) - 6 (Sat)
    const daysSinceMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
    d.setDate(d.getDate() - daysSinceMonday);
    return d;
  }

  // Filter shows for next week only (Monday to Sunday after this week)
  // Week definition: Monday = start, Sunday = end (shows run Wed-Sun)
  function getNextWeekRange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)

    // Calculate days until next Monday (start of next week)
    // Sunday (0) is LAST day of current week, so next Monday is 1 day away
    // Monday (1) is START of current week, so next Monday is 7 days away
    // Tuesday-Saturday: Calculate days remaining in this week + 1
    const daysUntilNextMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);

    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);

    // Next Sunday is 6 days after next Monday (end of next week)
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextMonday.getDate() + 6);
    nextSunday.setHours(23, 59, 59, 999);

    return { nextMonday, nextSunday };
  }

  $: ({ nextMonday, nextSunday } = getNextWeekRange());
  $: nextWeekShows = shows.filter(show => {
    const showDate = new Date(show.start);
    return showDate >= nextMonday && showDate <= nextSunday;
  });
  $: nextShow = nextWeekShows.length > 0 ? nextWeekShows[0] : undefined;

  // Get all shows with images for highlighting (next show + carousel shows)
  $: highlightedShowIds = nextWeekShows.filter(s => s.imageUrl).map(s => s.id);

  // Group shows by day (no date filtering)
  function groupShowsByDay(shows: Show[]): Record<string, Show[]> {
    const groups: Record<string, Show[]> = {};
    for (const show of shows) {
      const date = new Date(show.start);
      date.setHours(0, 0, 0, 0);
      const dayKey = date.toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric'
      });
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(show);
    }
    return groups;
  }

  // Wrap day groups into WeekGroup array (ShowsColumn expects this format)
  function groupShowsAsWeeks(shows: Show[]): WeekGroup[] {
    const days = groupShowsByDay(shows);
    const { nextMonday } = getNextWeekRange();

    return [{
      weekLabel: 'Next Week',
      startDate: nextMonday,
      days
    }];
  }

  $: groupedShows = groupShowsAsWeeks(nextWeekShows);

  $: dayCount = groupedShows.length > 0 ? Object.keys(groupedShows[0].days).length : 0;
  $: totalShows = nextWeekShows.length;
  $: dayHeadingClass = totalShows > 20 ? 'text-xl' : totalShows > 15 ? 'text-2xl' : dayCount < 5 ? 'text-3xl' : 'text-2xl';
  $: timeClass = totalShows > 20 ? 'text-lg' : totalShows > 15 ? 'text-xl' : dayCount < 5 ? 'text-2xl' : 'text-xl';
  $: titleClass = totalShows > 20 ? 'text-base' : totalShows > 15 ? 'text-lg' : dayCount < 5 ? 'text-xl' : 'text-lg';
</script>

<div class="h-screen max-h-screen text-white flex flex-col overflow-hidden box-border relative
            bg-gradient-to-br from-[var(--nw-deep-purple)] via-black to-[var(--nw-burning-orange)]">
  <!-- Grain texture overlay -->
  <div class="grain-overlay"></div>

  <main class="flex-1 w-full mx-auto grid grid-cols-1 gap-3 items-stretch px-3 py-4 min-h-0 relative z-10" style="grid-template-columns: 3.5fr 3.5fr 2.7fr;">
    <!-- Reverse order: ImagesColumn, ShowsColumn, BrandingColumn -->
    <ImagesColumn {nextShow} shows={nextWeekShows} nextShowId={nextShow?.id} upFirst={true} theme="orange" />
    <ShowsColumn {groupedShows} {loading} {error} {dayHeadingClass} {timeClass} {titleClass} {highlightedShowIds} theme="orange" />
    <BrandingColumn theme="orange" weekLabel="Next Week" />
  </main>
</div> 