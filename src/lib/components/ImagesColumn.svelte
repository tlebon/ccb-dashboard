<script lang="ts">
  import type { Show } from '$lib/utils/icalParser';
  import { proxyImageUrl } from '$lib/utils/imageProxy';
  import { isHouseShow, formatHouseShowTeams } from '$lib/utils/houseShowTeams';
  export let nextShow: Show | undefined;
  export let shows: Show[];
  export let nextShowId: string | undefined;
  export let upFirst: boolean = false;
  export let theme: 'blue' | 'orange' = 'blue';
  import ShowCarousel from './ShowCarousel.svelte';

  // Format show title - add team names for House Show
  function getDisplayTitle(show: Show): string {
    if (isHouseShow(show.title)) {
      const teams = formatHouseShowTeams(show.start);
      if (teams) return `House Show: ${teams}`;
    }
    return show.title;
  }
</script>

<section class="flex flex-col items-center justify-start gap-3 w-full h-full overflow-hidden reveal-right delay-200">
  {#if nextShow}
    <a href="/shows/{nextShow.id}"
       class={`block w-full overflow-hidden brutalist-border flex-shrink-0 relative reveal-up delay-300 hover:scale-[1.02] transition-transform
                ${theme === 'orange'
                  ? 'bg-gradient-to-br from-[var(--nw-deep-purple)] to-black border-[var(--nw-hot-pink)]'
                  : 'bg-gradient-to-br from-[var(--tw-midnight)] to-[var(--tw-deep-purple)] border-[var(--tw-electric-cyan)]'}`}>

      <!-- Featured Image -->
      <div class="w-full flex-1 flex items-center justify-center overflow-hidden relative">
        {#if nextShow.imageUrl}
          <img src={proxyImageUrl(nextShow.imageUrl)} alt={nextShow.title} class="w-full h-full object-cover" />
        {:else}
          <div class="text-white text-xl" style="font-family: var(--font-display);">No Image</div>
        {/if}

        <!-- Label overlay -->
        <div class={`absolute top-2 left-2 px-3 py-1 uppercase tracking-[0.3em] text-xs font-black
                    ${theme === 'orange'
                      ? 'bg-[var(--nw-neon-yellow)] text-black'
                      : 'bg-[var(--tw-electric-cyan)] text-[var(--tw-midnight)]'}`}
             style="font-family: var(--font-mono); clip-path: polygon(0 0, 95% 0, 100% 100%, 5% 100%);">
          {upFirst ? '→ Up First' : '→ Up Next'}
        </div>
      </div>

      <!-- Show details -->
      <div class="p-3 relative z-10">
        <h2 class="text-xl font-black mb-1 uppercase tracking-wide leading-tight text-white group-hover:text-[var(--tw-electric-cyan)]"
            style="font-family: var(--font-display);">
          {getDisplayTitle(nextShow)}
        </h2>

        <div class={`text-sm font-bold uppercase tracking-widest
                    ${theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}`}
             style="font-family: var(--font-mono);">
          {new Date(nextShow.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()}
          <span class="mx-1">•</span>
          {new Date(nextShow.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </a>
  {/if}

  <!-- Carousel -->
  <div class="w-full flex-1 min-h-0 reveal-up delay-400">
    <ShowCarousel {shows} {nextShowId} {theme} />
  </div>
</section> 