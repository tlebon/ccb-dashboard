<script lang="ts">
  import QrCode from 'svelte-qrcode';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let logoError = false;
  let showCredits = false;
  export let theme: 'blue' | 'orange' = 'blue';
  export let monitorMode: boolean = false;
  export let weekLabel: string = 'This Week';
  export let canGoPrev: boolean = false;
  export let canGoNext: boolean = true;
  export let weekOffset: number = 0;
  export let prevWeekLabel: string = '';
  export let nextWeekLabel: string = '';
</script>

<section class="flex flex-col justify-between items-center h-full px-4 overflow-hidden relative reveal-left delay-100
  {theme === 'orange'
    ? 'bg-gradient-to-br from-[var(--nw-deep-purple)] via-black to-[var(--nw-burning-orange)]'
    : 'bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-[var(--tw-concrete)]'}
  brutalist-border
  {theme === 'orange' ? 'border-[var(--nw-hot-pink)]' : 'border-[var(--tw-electric-cyan)]'}">

  <!-- Grain overlay -->
  <div class="grain-overlay"></div>

  <!-- Top: Logo & Title -->
  <div class="w-full flex flex-col items-center mt-4 relative z-10">
    {#if !logoError}
      <div class="bg-black p-2 brutalist-border {theme === 'orange' ? 'border-[var(--nw-burning-orange)]' : 'border-[var(--tw-electric-cyan)]'} reveal-up delay-200">
        <img src="/cropped-CCB-Logos_white_LG.png" alt="Comedy Cafe Berlin Logo" class="w-20 h-20 object-contain" on:error={() => logoError = true} />
      </div>
    {/if}

    <!-- Week Navigation -->
    <div class="mt-3 reveal-up delay-300 flex items-center gap-2">
      <button
        on:click={() => dispatch('prev')}
        disabled={!canGoPrev || monitorMode}
        title={canGoPrev && !monitorMode ? `← ${prevWeekLabel}` : ''}
        class="w-8 h-8 flex items-center justify-center transition-all rounded
               {monitorMode ? 'invisible' : ''}
               {canGoPrev
                 ? (theme === 'orange' ? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/20' : 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/20')
                 : 'text-white/20 cursor-not-allowed'}"
        style="font-family: var(--font-mono);"
      >
        ←
      </button>

      <div class="text-sm tracking-[0.3em] uppercase {theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}"
           style="font-family: var(--font-mono);">
        {weekLabel}
      </div>

      <button
        on:click={() => dispatch('next')}
        disabled={!canGoNext || monitorMode}
        title={canGoNext && !monitorMode ? `→ ${nextWeekLabel}` : ''}
        class="w-8 h-8 flex items-center justify-center transition-all rounded
               {monitorMode ? 'invisible' : ''}
               {canGoNext
                 ? (theme === 'orange' ? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/20' : 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/20')
                 : 'text-white/20 cursor-not-allowed'}"
        style="font-family: var(--font-mono);"
      >
        →
      </button>
    </div>

    <!-- Today button - always rendered to prevent layout shift, invisible when on current week or in monitor mode -->
    <button
      on:click={() => dispatch('today')}
      class="mt-1 px-2 py-0.5 text-[10px] uppercase tracking-widest transition-all rounded
             {weekOffset === 0 || monitorMode ? 'invisible' : ''}
             {theme === 'orange'
               ? 'text-white/60 hover:text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10'
               : 'text-white/60 hover:text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
      style="font-family: var(--font-mono);"
    >
      ↩ Today
    </button>

    <div class="text-4xl leading-none text-white text-center mt-2 neon-glow reveal-up delay-400
                {theme === 'orange' ? 'text-[var(--nw-hot-pink)]' : 'text-[var(--tw-electric-cyan)]'}"
         style="font-family: var(--font-display);">
      COMEDY CAFE<br/>BERLIN
    </div>

    <div class="text-xs leading-relaxed text-center mt-3 mb-1 max-w-xs mx-auto text-white reveal-up delay-500"
         style="font-family: var(--font-serif);">
      Berlin's first international, alternative comedy stage, school and bar.
    </div>

    <div class="text-xs uppercase tracking-widest text-white/70 text-center mt-1 mb-2 reveal-up delay-500"
         style="font-family: var(--font-mono);">
      Open Wed—Sun
    </div>
  </div>

  <!-- Middle: QR codes (monitor mode) or Links (normal mode) -->
  <div class="w-full flex flex-col items-center justify-center gap-4 flex-1 relative z-10">
    {#if monitorMode}
      <!-- QR Codes for Monitor Mode -->
      <div class="flex flex-row items-center justify-center gap-4">
        <div class="flex flex-col items-center reveal-up delay-300">
          <div class="text-white text-[10px] uppercase tracking-widest mb-1.5 {theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}"
               style="font-family: var(--font-mono);">
            → Shows
          </div>
          <div class="p-2 bg-white brutalist-border {theme === 'orange' ? 'border-[var(--nw-hot-pink)]' : 'border-[var(--tw-electric-cyan)]'}">
            <QrCode value="https://www.comedycafeberlin.com" size={100} color="#000" background="#fff" style="width: 100px; height: 100px; display: block;" />
          </div>
        </div>

        <div class="flex flex-col items-center reveal-up delay-400">
          <div class="text-white text-[10px] uppercase tracking-widest mb-1.5 {theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}"
               style="font-family: var(--font-mono);">
            → Classes
          </div>
          <div class="p-2 bg-white brutalist-border {theme === 'orange' ? 'border-[var(--nw-hot-pink)]' : 'border-[var(--tw-electric-cyan)]'}">
            <QrCode value="https://training.comedycafeberlin.com" size={100} color="#000" background="#fff" style="width: 100px; height: 100px; display: block;" />
          </div>
        </div>
      </div>
    {:else}
      <!-- Navigation Links for Normal Mode -->
      <nav class="flex flex-col w-full max-w-[200px] reveal-up delay-300">
        <!-- Internal Navigation -->
        <div class="flex flex-col gap-1">
          <a href="/shows"
             class="flex items-center gap-2 px-3 py-2 rounded transition-all {theme === 'orange' ? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10' : 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
             style="font-family: var(--font-display);">
            <span class="text-sm opacity-70">▸</span>
            <span class="text-sm uppercase tracking-wider">Shows</span>
          </a>

          <a href="/teams"
             class="flex items-center gap-2 px-3 py-2 rounded transition-all {theme === 'orange' ? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10' : 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
             style="font-family: var(--font-display);">
            <span class="text-sm opacity-70">◆</span>
            <span class="text-sm uppercase tracking-wider">Teams</span>
          </a>

          <a href="/performers"
             class="flex items-center gap-2 px-3 py-2 rounded transition-all {theme === 'orange' ? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10' : 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
             style="font-family: var(--font-display);">
            <span class="text-sm opacity-70">●</span>
            <span class="text-sm uppercase tracking-wider">Performers</span>
          </a>

          <a href="/analytics"
             class="flex items-center gap-2 px-3 py-2 rounded transition-all {theme === 'orange' ? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10' : 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
             style="font-family: var(--font-display);">
            <span class="text-sm opacity-70">◎</span>
            <span class="text-sm uppercase tracking-wider">Analytics</span>
          </a>
        </div>

        <!-- Divider -->
        <div class="my-3 border-t {theme === 'orange' ? 'border-[var(--nw-hot-pink)]/30' : 'border-[var(--tw-electric-cyan)]/30'}"></div>

        <!-- External Links -->
        <div class="flex flex-col gap-1">
          <a href="https://www.comedycafeberlin.com" target="_blank" rel="noopener"
             class="flex items-center gap-2 px-3 py-2 rounded transition-all {theme === 'orange' ? 'text-[var(--nw-hot-pink)]/70 hover:text-[var(--nw-hot-pink)] hover:bg-[var(--nw-hot-pink)]/10' : 'text-[var(--tw-neon-pink)]/70 hover:text-[var(--tw-neon-pink)] hover:bg-[var(--tw-neon-pink)]/10'}"
             style="font-family: var(--font-mono);">
            <span class="text-xs">↗</span>
            <span class="text-xs uppercase tracking-wider">CCB Website</span>
          </a>

          <a href="https://training.comedycafeberlin.com" target="_blank" rel="noopener"
             class="flex items-center gap-2 px-3 py-2 rounded transition-all {theme === 'orange' ? 'text-[var(--nw-hot-pink)]/70 hover:text-[var(--nw-hot-pink)] hover:bg-[var(--nw-hot-pink)]/10' : 'text-[var(--tw-neon-pink)]/70 hover:text-[var(--tw-neon-pink)] hover:bg-[var(--tw-neon-pink)]/10'}"
             style="font-family: var(--font-mono);">
            <span class="text-xs">↗</span>
            <span class="text-xs uppercase tracking-wider">Classes</span>
          </a>
        </div>
      </nav>
    {/if}
  </div>

  <!-- Bottom: Tagline (monitor mode only) + Monitor Mode Toggle -->
  <div class="mb-4 relative z-10 reveal-up delay-500 flex flex-col items-center gap-3">
    {#if monitorMode}
      <div class="text-lg font-bold text-center leading-tight text-white"
           style="font-family: var(--font-black);">
        IMPROV<br/>STANDUP<br/>SKETCH
      </div>
    {/if}

    <!-- Monitor Mode Toggle -->
    <button
      on:click={() => dispatch('toggleMonitor')}
      class="px-3 py-1.5 text-[10px] uppercase tracking-widest transition-all border
             {monitorMode
               ? (theme === 'orange' ? 'bg-[var(--nw-neon-yellow)] text-black border-[var(--nw-neon-yellow)]' : 'bg-[var(--tw-electric-cyan)] text-black border-[var(--tw-electric-cyan)]')
               : (theme === 'orange' ? 'border-[var(--nw-neon-yellow)]/50 text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10' : 'border-[var(--tw-electric-cyan)]/50 text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10')}"
      style="font-family: var(--font-mono);">
      {monitorMode ? '● Monitor Mode' : '○ Monitor Mode'}
    </button>
  </div>

  <!-- Credits button (bottom right corner) -->
  <button
    on:click={() => showCredits = true}
    class="absolute bottom-2 right-2 w-6 h-6 flex items-center justify-center text-white/20 hover:text-[var(--nw-hot-pink)] transition-colors z-20"
    title="Credits"
  >
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
      <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
    </svg>
  </button>

  <slot />
</section>

<!-- Credits Modal -->
{#if showCredits}
  <div
    class="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
    on:click={() => showCredits = false}
    on:keydown={(e) => e.key === 'Escape' && (showCredits = false)}
    role="dialog"
    tabindex="-1"
  >
    <div
      class="bg-[var(--tw-deep-purple)] brutalist-border border-[var(--tw-electric-cyan)] p-6 max-w-sm w-full"
      on:click|stopPropagation
    >
      <h2 class="text-xl text-[var(--tw-electric-cyan)] mb-4" style="font-family: var(--font-display);">
        About This Dashboard
      </h2>

      <div class="space-y-3 text-white/80 text-sm" style="font-family: var(--font-mono);">
        <p>
          Built with love for Comedy Cafe Berlin by <a href="https://github.com/tlebon" target="_blank" rel="noopener" class="text-[var(--nw-hot-pink)] hover:underline">Timothy LeBon</a>.
        </p>

        <p>
          Data synced from the CCB website calendar and Community. Show lineups and performer info sourced from public event pages.
        </p>

        <div class="pt-2 border-t border-white/10">
          <a
            href="https://github.com/tlebon/ccb-dashboard"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-2 text-[var(--tw-electric-cyan)] hover:text-[var(--nw-hot-pink)] transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
              <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
            </svg>
            View on GitHub
          </a>
        </div>

        <p class="text-white/40 text-xs pt-2">
          Have feedback or found a bug? Open an issue on GitHub or reach out directly to <a href="mailto:timothy@star-dog.net" class="text-[var(--nw-hot-pink)] hover:underline">timothy@star-dog.net</a>.
        </p>
      </div>

      <button
        on:click={() => showCredits = false}
        class="mt-4 w-full px-4 py-2 bg-[var(--tw-electric-cyan)] text-black text-sm uppercase tracking-wider hover:bg-[var(--nw-hot-pink)] transition-colors"
        style="font-family: var(--font-display);"
      >
        Close
      </button>
    </div>
  </div>
{/if} 