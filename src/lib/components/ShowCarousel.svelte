<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Show } from '$lib/utils/icalParser';

  export let shows: Show[] = [];
  export let nextShowId: string | undefined;

  // Filter out the next show
  $: carouselShows = shows.filter(s => s.id !== nextShowId && s.imageUrl);

  let current = 0;
  let interval: any;

  function startCarousel() {
    stopCarousel();
    interval = setInterval(() => {
      current = (current + 1) % carouselShows.length;
    }, 5000);
  }

  function stopCarousel() {
    if (interval) clearInterval(interval);
  }

  $: if (carouselShows.length > 1) startCarousel();
  onDestroy(stopCarousel);
</script>

{#if carouselShows.length === 0}
  <div class="text-gray-500 opacity-60 text-2xl text-center">No more show images</div>
{:else}
  <div class="w-full flex flex-col items-center">
    <div class="w-full h-64 md:h-80 flex items-center justify-center overflow-hidden rounded-xl bg-gray-800">
      <img
        src={carouselShows[current].imageUrl}
        alt={carouselShows[current].title}
        class="object-cover w-full h-full transition-all duration-700"
        style="max-height: 100%"
      />
    </div>
    <div class="mt-4 text-center">
      <div class="text-2xl font-bold text-blue-300 mb-1">{carouselShows[current].title}</div>
      <div class="text-lg text-white/80">
        {new Date(carouselShows[current].start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        {' '}
        <span class="text-orange-400 font-bold">{new Date(carouselShows[current].start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  </div>
{/if} 