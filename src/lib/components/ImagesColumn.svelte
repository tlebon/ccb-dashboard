<script lang="ts">
  import type { Show } from '$lib/utils/icalParser';
  export let nextShow: Show | undefined;
  export let shows: Show[];
  export let nextShowId: string | undefined;
  export let upFirst: boolean = false;
  export let theme: 'blue' | 'orange' = 'blue';
  import ShowCarousel from './ShowCarousel.svelte';
</script>

<section class="flex flex-col items-center justify-start gap-4 w-full">
  {#if nextShow}
    <div class={`w-full bg-gray-900 rounded-2xl shadow-2xl overflow-hidden mb-4 border-4 ${theme === 'orange' ? 'border-orange-500' : 'border-blue-500'}`}>
      <div class="w-full h-72 bg-gray-900 flex items-center justify-center overflow-hidden">
        {#if nextShow.imageUrl}
          <img src={nextShow.imageUrl} alt={nextShow.title} class="w-full h-full object-cover" />
        {:else}
          <div class="text-white text-xl">No Image</div>
        {/if}
      </div>
      <div class="p-4">
        <div class={`text-lg font-bold uppercase tracking-widest mb-1 ${theme === 'orange' ? 'text-blue-400' : 'text-orange-400'}`}>{upFirst ? 'Up First' : 'Up Next'}</div>
        <h2 class={`text-3xl font-extrabold mb-1 drop-shadow ${theme === 'orange' ? 'text-orange-300' : 'text-blue-300'}`}>{nextShow.title}</h2>
        <div class="text-xl text-white/80">
          {new Date(nextShow.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          {' '}
          <span class="font-bold ${theme === 'orange' ? 'text-orange-400' : 'text-orange-400'}">{new Date(nextShow.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  {/if}
  <ShowCarousel {shows} {nextShowId} />
</section> 