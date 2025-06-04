<script lang="ts">
  import ShowCalendar from '$lib/components/ShowCalendar.svelte';
  import ShowList from '$lib/components/ShowList.svelte';
  import NowShowing from '$lib/components/NowShowing.svelte';
  import Countdown from '$lib/components/Countdown.svelte';
  import { fetchShowsFromICal, type Show } from '$lib/utils/icalParser';
  import { onMount } from 'svelte';

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

  // Get current show (for demo purposes, you can adjust this logic)
  const currentShow = shows.length > 0 ? shows[0] : null;
  const nextShow = shows.length > 1 ? shows[1] : null;
</script>

<div class="min-h-screen bg-gray-100 p-4 md:p-8">
  <header class="max-w-7xl mx-auto mb-8">
    <h1 class="text-4xl font-bold text-gray-900 text-center">Theater Display</h1>
  </header>

  <main class="max-w-7xl mx-auto space-y-8">
    {#if loading}
      <p class="text-center">Loading shows...</p>
    {:else if error}
      <p class="text-center text-red-500">Error: {error}</p>
    {:else}
      <!-- Current Show Section -->
      <section class="mb-8">
        <NowShowing {currentShow} />
      </section>

      <!-- Countdown Section -->
      <section class="mb-8">
        <Countdown {nextShow} />
      </section>

      <!-- Calendar and Upcoming Shows Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <!-- Calendar Section -->
        <section>
          <ShowCalendar {shows} currentDate={new Date()} />
        </section>

        <!-- Upcoming Shows Section -->
        <section>
          <ShowList {shows} title="Upcoming Shows" />
        </section>
      </div>
    {/if}
  </main>

  <footer class="max-w-7xl mx-auto mt-8 text-center text-gray-600">
    <p>© 2024 Theater Display</p>
  </footer>
</div>

<style>
  /* Add any global styles here */
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }
</style>
