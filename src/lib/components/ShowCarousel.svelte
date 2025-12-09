<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Show } from '$lib/utils/icalParser';
  import { proxyImageUrl } from '$lib/utils/imageProxy';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export let shows: Show[] = [];
  export let nextShowId: string | undefined;
  export let theme: 'blue' | 'orange' = 'blue';

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
  <div class={`opacity-60 text-sm text-center ${theme === 'orange' ? 'text-[var(--nw-cream)]' : 'text-white'}`}
       style="font-family: var(--font-mono);">
    No more show images
  </div>
{:else}
  <a href="/shows/{carouselShows[current].id}" class="block w-full h-full flex flex-col items-center group">
    <!-- Carousel Image -->
    <div class={`w-full flex-1 min-h-0 flex items-center justify-center overflow-hidden brutalist-border relative group-hover:scale-[1.02] transition-transform origin-top
                ${theme === 'orange'
                  ? 'bg-[var(--nw-deep-purple)] border-[var(--nw-hot-pink)]'
                  : 'bg-[var(--tw-midnight)] border-[var(--tw-electric-cyan)]'}`}>
      {#key current}
        <div
          in:fly={{ x: 100, duration: 600, easing: cubicOut }}
          out:fly={{ x: -100, duration: 600, easing: cubicOut }}
          class="w-full h-full absolute inset-0">
          {#if carouselShows[current].imageUrl}
            <img
              src={proxyImageUrl(carouselShows[current].imageUrl)}
              alt={carouselShows[current].title}
              class="w-full h-full object-cover"
            />
          {:else}
            <div class="text-white text-lg flex items-center justify-center h-full" style="font-family: var(--font-display);">
              No Image
            </div>
          {/if}
        </div>
      {/key}

      <!-- Carousel indicators -->
      <div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
        {#each carouselShows as _, i}
          <div class={`w-1.5 h-1.5 transition-all ${i === current ? 'w-6' : 'w-1.5'}
                      ${theme === 'orange' ? 'bg-[var(--nw-neon-yellow)]' : 'bg-[var(--tw-electric-cyan)]'}`}></div>
        {/each}
      </div>
    </div>

    <!-- Show info -->
    <div class="mt-3 w-full px-3 relative overflow-hidden">
      {#key current}
        <div
          in:fly={{ x: 100, duration: 600, easing: cubicOut }}
          out:fly={{ x: -100, duration: 600, easing: cubicOut }}
          class="absolute inset-0 w-full">
          <div class="text-xl font-black uppercase tracking-wide mb-1.5 leading-tight text-white group-hover:text-[var(--tw-electric-cyan)]"
               style="font-family: var(--font-display);">
            {carouselShows[current].title}
          </div>
          <div class={`text-sm font-bold uppercase tracking-widest
                      ${theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}`}
               style="font-family: var(--font-mono);">
            {new Date(carouselShows[current].start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
            <span class="mx-1.5">•</span>
            {new Date(carouselShows[current].start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      {/key}
      <!-- Spacer to maintain height -->
      <div class="invisible">
        <div class="text-xl font-black uppercase tracking-wide mb-1.5 leading-tight">Spacer</div>
        <div class="text-sm font-bold uppercase tracking-widest">Spacer text</div>
      </div>
    </div>
  </a>
{/if} 