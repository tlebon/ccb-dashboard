<script lang="ts">
  import type { Show } from '$lib/utils/icalParser';
  export let groupedShows: Record<string, Show[]>;
  export let loading: boolean;
  export let error: string | null;
  export let dayHeadingClass: string;
  export let timeClass: string;
  export let titleClass: string;
  export let theme: 'blue' | 'orange' = 'blue';
  export let highlightedShowIds: string[] = []; // IDs of shows currently in sidebar
</script>

<section class="space-y-3 h-full overflow-auto pr-2 reveal-up delay-200 relative">
  {#if loading}
    <p class="text-center text-xl font-bold text-white" style="font-family: var(--font-display);">Loading shows...</p>
  {:else if error}
    <p class="text-center text-red-400 text-xl font-bold" style="font-family: var(--font-display);">Error: {error}</p>
  {:else}
    {#each Object.entries(groupedShows) as [day, dayShows], i (day)}
      <div class="reveal-up" style="animation-delay: {0.3 + i * 0.1}s; opacity: 0;">
        <!-- Day heading with brutalist style -->
        <div class="mb-2 relative">
          <h2 class={`uppercase tracking-wider font-black text-white ${dayHeadingClass} relative inline-block px-3 py-1
                      ${theme === 'orange'
                        ? 'bg-gradient-to-r from-[var(--nw-hot-pink)] to-[var(--nw-burning-orange)]'
                        : 'bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--tw-neon-pink)]'}`}
              style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);">
            {day}
          </h2>
          <div class={`absolute -bottom-1 left-2 right-2 h-0.5 opacity-50
                      ${theme === 'orange' ? 'bg-[var(--nw-hot-pink)]' : 'bg-[var(--tw-electric-cyan)]'}`}></div>
        </div>

        <!-- Shows list -->
        <ul class="space-y-1.5">
          {#each dayShows as show, j (show.id)}
            {@const isHighlighted = highlightedShowIds.includes(show.id)}
            <li class="group">
              <a href="/shows/{show.id}"
                 class={`flex items-center gap-3 px-2 py-1.5 transition-all duration-200 cursor-pointer hover:bg-white/5
                          ${isHighlighted ? 'border-l-8 pl-1' : 'border-l-4'}
                          ${theme === 'orange'
                            ? `border-[var(--nw-hot-pink)] ${isHighlighted ? 'bg-[var(--nw-deep-purple)]/30' : ''}`
                            : `border-[var(--tw-electric-cyan)] ${isHighlighted ? 'bg-[var(--tw-deep-purple)]/40' : ''}`}`}>

                <!-- Time with monospace font -->
                <div class={`font-bold min-w-[100px] text-right transition-transform group-hover:scale-110 ${timeClass}
                            ${theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}`}
                     style="font-family: var(--font-mono);">
                  {new Date(show.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                <!-- Show title with display font -->
                <div class="flex-1">
                  <div class={`font-bold text-white uppercase tracking-wide ${titleClass} leading-tight group-hover:text-[var(--tw-electric-cyan)]`}
                       style="font-family: var(--font-display);">
                    {show.title}
                  </div>
                </div>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  {/if}
</section> 