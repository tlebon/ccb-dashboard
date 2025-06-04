<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchShowsFromICal, type Show } from '$lib/utils/icalParser';
  import BrandingColumn from '$lib/components/BrandingColumn.svelte';
  import ShowsColumn from '$lib/components/ShowsColumn.svelte';
  import ImagesColumn from '$lib/components/ImagesColumn.svelte';

  let shows: Show[] = [];
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      shows = await fetchShowsFromICal();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load shows';
    } finally {
      loading = false;
    }
  });

  // Filter shows for next week only (Monday to Sunday after this week)
  function getNextWeekRange() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
    const daysUntilNextMonday = ((8 - dayOfWeek) % 7) || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    nextMonday.setHours(0, 0, 0, 0);
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
  $: groupedShows = groupShowsByDay(nextWeekShows);
  $: nextShow = nextWeekShows.length > 0 ? nextWeekShows[0] : undefined;

  // Group shows by day (no date filtering)
  function groupShowsByDay(shows: Show[]) {
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

  $: dayCount = Object.keys(groupedShows).length;
  $: dayHeadingClass = dayCount < 5 ? 'text-5xl' : 'text-4xl';
  $: timeClass = dayCount < 5 ? 'text-4xl' : 'text-3xl';
  $: titleClass = 'text-3xl';

  $: console.log('nextWeekShows', nextWeekShows);
  $: console.log('groupedShows', groupedShows);
</script>

<div class="min-h-screen bg-black text-white px-2 py-4 flex flex-col">
  <main class="flex-1 max-w-[1920px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
    <!-- Reverse order: ImagesColumn, ShowsColumn, BrandingColumn -->
    <ImagesColumn {nextShow} shows={nextWeekShows} nextShowId={nextShow?.id} upFirst={true} theme="orange" />
    <ShowsColumn {groupedShows} {loading} {error} {dayHeadingClass} {timeClass} {titleClass} theme="orange" />
    <BrandingColumn nextWeek={true} theme="orange" />
  </main>
</div> 