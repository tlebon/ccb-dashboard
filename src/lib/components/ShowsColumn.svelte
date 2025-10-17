<script lang="ts">
  import type { Show } from '$lib/utils/icalParser';
  export let groupedShows: Record<string, Show[]>;
  export let loading: boolean;
  export let error: string | null;
  export let dayHeadingClass: string;
  export let timeClass: string;
  export let titleClass: string;
  export let theme: 'blue' | 'orange' = 'blue';
</script>

<section class="space-y-2 h-full overflow-auto pr-2">
  {#if loading}
    <p class="text-center text-2xl font-bold">Loading shows...</p>
  {:else if error}
    <p class="text-center text-red-400 text-2xl font-bold">Error: {error}</p>
  {:else}
    {#each Object.entries(groupedShows) as [day, dayShows], i (day)}
      <div>
        <h2 class={`font-extrabold mb-1 ${theme === 'orange' ? 'text-orange-300' : 'text-blue-300'} drop-shadow ${dayHeadingClass}`} style="letter-spacing:0.05em;">{day}</h2>
        <hr class={`mb-2 border-t-4 ${theme === 'orange' ? 'border-orange-500' : 'border-blue-500'} opacity-80`} />
        <ul>
          {#each dayShows as show, j (show.id)}
            <li>
              <div class="flex items-center gap-4 px-1 py-0.5">
                <div class={`font-mono font-extrabold min-w-[110px] text-right drop-shadow ${timeClass} ${theme === 'orange' ? 'text-blue-400' : 'text-orange-400'}`}> 
                  {new Date(show.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div class="flex-1">
                  <div class={`font-bold mb-0.5 ${titleClass}`}>{show.title}</div>
                </div>
              </div>
              {#if j < dayShows.length - 1}
                <hr class="border-t border-gray-600 opacity-60 mx-1" />
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  {/if}
</section> 