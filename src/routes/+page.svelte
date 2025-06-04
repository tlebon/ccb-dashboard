<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchShowsFromICal, type Show } from '$lib/utils/icalParser';
  import Countdown from '$lib/components/Countdown.svelte';
  import ShowCarousel from '$lib/components/ShowCarousel.svelte';
  import QrCode from 'svelte-qrcode';
  import BrandingColumn from '$lib/components/BrandingColumn.svelte';
  import ShowsColumn from '$lib/components/ShowsColumn.svelte';
  import ImagesColumn from '$lib/components/ImagesColumn.svelte';

  let shows: Show[] = [];
  let loading = true;
  let error: string | null = null;
  let logoError = false;

  onMount(async () => {
    try {
      shows = await fetchShowsFromICal();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load shows';
    } finally {
      loading = false;
    }
  });

  // Group shows by day, but only for today + next 4 days
  function groupShowsByDayLimited(shows: Show[]) {
    const groups: Record<string, Show[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const show of shows) {
      const date = new Date(show.start);
      date.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 5) {
        const dayKey = date.toLocaleDateString(undefined, {
          weekday: 'long', month: 'long', day: 'numeric'
        });
        if (!groups[dayKey]) groups[dayKey] = [];
        groups[dayKey].push(show);
      }
    }
    return groups;
  }

  $: groupedShows = groupShowsByDayLimited(shows);

  // Find the next show
  $: now = new Date();
  $: nextShow = shows.filter(s => new Date(s.start) > now).sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];

  $: dayCount = Object.keys(groupedShows).length;
  $: dayHeadingClass = dayCount < 5 ? 'text-5xl' : 'text-4xl';
  $: timeClass = dayCount < 5 ? 'text-4xl' : 'text-3xl';
  $: titleClass = dayCount < 5 ? 'text-2xl' : 'text-xl';
</script>

<div class="min-h-screen bg-black text-white px-2 py-4 flex flex-col">
  <main class="flex-1 max-w-[1920px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
    <!-- First Column: Info/Branding -->
    <BrandingColumn />
    <!-- Second Column: Upcoming Shows Grouped by Day (limited) -->
    <ShowsColumn {groupedShows} {loading} {error} {dayHeadingClass} {timeClass} {titleClass} />
    <!-- Third Column: Next show and carousel -->
    <ImagesColumn {nextShow} {shows} nextShowId={nextShow?.id} />
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
    background: #000;
  }
</style>
