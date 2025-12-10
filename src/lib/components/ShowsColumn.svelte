<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { Show } from '$lib/utils/icalParser';
  import { isHouseShow, formatHouseShowTeams } from '$lib/utils/houseShowTeams';
  import { proxyImageUrl } from '$lib/utils/imageProxy';

  export let groupedShows: Record<string, Show[]>;
  export let loading: boolean;
  export let error: string | null;
  export let dayHeadingClass: string;
  export let timeClass: string;
  export let titleClass: string;
  export let theme: 'blue' | 'orange' = 'blue';
  export let highlightedShowIds: string[] = []; // IDs of shows currently in sidebar
  export let monitorMode: boolean = false;
  export let showInlineImages: boolean = false; // Show small thumbnails inline (for mobile)

  let scrollContainer: HTMLElement;
  let scrollDirection: 'down' | 'up' = 'down';
  let animationFrame: number;
  let pauseTimeout: ReturnType<typeof setTimeout>;
  let hasOverflow = false;
  let scrollProgress = 0; // 0 = top, 1 = bottom
  let isScrolling = false; // Guard to prevent re-initialization

  const SCROLL_SPEED = 1.5; // pixels per frame (~90px/sec at 60fps)
  const PAUSE_DURATION = 2000; // pause at top/bottom in ms

  function checkOverflow() {
    if (scrollContainer) {
      hasOverflow = scrollContainer.scrollHeight > scrollContainer.clientHeight;
      updateScrollProgress();
    }
  }

  function updateScrollProgress() {
    if (scrollContainer) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const maxScroll = scrollHeight - clientHeight;
      scrollProgress = maxScroll > 0 ? scrollTop / maxScroll : 0;
    }
  }

  function handleScroll() {
    updateScrollProgress();
  }

  function autoScroll() {
    if (!scrollContainer || !monitorMode) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const maxScroll = scrollHeight - clientHeight;

    // No need to scroll if content fits
    if (maxScroll <= 0) return;

    if (scrollDirection === 'down') {
      if (scrollTop >= maxScroll - 1) {
        // Reached bottom, pause then scroll up
        scrollDirection = 'up';
        pauseTimeout = setTimeout(() => {
          animationFrame = requestAnimationFrame(autoScroll);
        }, PAUSE_DURATION);
        return;
      }
      scrollContainer.scrollTop = scrollTop + SCROLL_SPEED;
    } else {
      if (scrollTop <= 1) {
        // Reached top, pause then scroll down
        scrollDirection = 'down';
        pauseTimeout = setTimeout(() => {
          animationFrame = requestAnimationFrame(autoScroll);
        }, PAUSE_DURATION);
        return;
      }
      scrollContainer.scrollTop = scrollTop - SCROLL_SPEED;
    }

    animationFrame = requestAnimationFrame(autoScroll);
  }

  function startAutoScroll() {
    if (isScrolling) return; // Already scrolling

    if (scrollContainer) {
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      if (maxScroll <= 0) return;

      isScrolling = true;
      scrollContainer.scrollTop = 0;
      scrollDirection = 'down';
      pauseTimeout = setTimeout(() => {
        animationFrame = requestAnimationFrame(autoScroll);
      }, PAUSE_DURATION);
    }
  }

  function stopAutoScroll() {
    isScrolling = false;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    if (pauseTimeout) clearTimeout(pauseTimeout);
  }

  // Track previous monitor mode to detect actual changes
  let prevMonitorMode = false;
  $: if (monitorMode !== prevMonitorMode) {
    prevMonitorMode = monitorMode;
    if (monitorMode && scrollContainer) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
  }

  // Check overflow when content changes
  $: if (groupedShows && scrollContainer) {
    setTimeout(checkOverflow, 100);
  }

  onMount(() => {
    setTimeout(checkOverflow, 500);
  });

  onDestroy(() => {
    stopAutoScroll();
  });
</script>

<div class="relative h-full overflow-hidden">
  <!-- Subtle gradient fade when more content below -->
  {#if hasOverflow && !monitorMode && scrollProgress < 0.95}
    <div
      class="absolute bottom-0 left-0 right-2 h-12 pointer-events-none z-10
             bg-gradient-to-t {theme === 'orange' ? 'from-black/60' : 'from-[var(--tw-deep-purple)]/60'} to-transparent">
    </div>
  {/if}

  <section bind:this={scrollContainer} on:scroll={handleScroll} class="space-y-3 h-full overflow-auto pr-2 reveal-up delay-200">
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
                <div class={`font-bold min-w-[70px] sm:min-w-[100px] text-right transition-transform group-hover:scale-110 ${timeClass}
                            ${theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}`}
                     style="font-family: var(--font-mono); font-weight: 500; letter-spacing: 0.05em;">
                  {new Date(show.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>

                <!-- Show title with display font -->
                <div class="flex-1 min-w-0">
                  <div class={`font-bold text-white uppercase ${titleClass} leading-snug group-hover:text-[var(--tw-electric-cyan)] break-words`}
                       style="font-family: var(--font-display); letter-spacing: 0.08em;">
                    {show.title}
                  </div>
                  {#if isHouseShow(show.title)}
                    {@const teams = formatHouseShowTeams(show.start)}
                    {#if teams}
                      <div class="text-sm mt-0.5 font-mono tracking-wide break-words {theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-neon-pink)]'}">
                        {teams}
                      </div>
                    {/if}
                  {/if}
                </div>

                <!-- Inline thumbnail for mobile -->
                {#if showInlineImages && show.imageUrl}
                  <div class="w-12 h-12 flex-shrink-0 rounded overflow-hidden border-2 {theme === 'orange' ? 'border-[var(--nw-hot-pink)]/50' : 'border-[var(--tw-electric-cyan)]/50'}">
                    <img src={proxyImageUrl(show.imageUrl)} alt="" class="w-full h-full object-cover" />
                  </div>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  {/if}
  </section>
</div>