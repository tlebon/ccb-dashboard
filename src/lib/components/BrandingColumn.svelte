<script lang="ts">
  import QrCode from 'svelte-qrcode';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let logoError = false;
  export let theme: 'blue' | 'orange' = 'blue';
  export let monitorMode: boolean = false;
  export let weekLabel: string = 'This Week';
  export let canGoPrev: boolean = false;
  export let canGoNext: boolean = true;
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
      {#if !monitorMode}
        <button
          on:click={() => dispatch('prev')}
          disabled={!canGoPrev}
          class="w-8 h-8 flex items-center justify-center transition-all
                 {canGoPrev
                   ? (theme === 'orange' ? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/20' : 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/20')
                   : 'text-white/20 cursor-not-allowed'}"
          style="font-family: var(--font-mono);"
        >
          ←
        </button>
      {/if}

      <div class="text-sm tracking-[0.3em] uppercase {theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}"
           style="font-family: var(--font-mono);">
        {weekLabel}
      </div>

      {#if !monitorMode}
        <button
          on:click={() => dispatch('next')}
          disabled={!canGoNext}
          class="w-8 h-8 flex items-center justify-center transition-all
                 {canGoNext
                   ? (theme === 'orange' ? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/20' : 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/20')
                   : 'text-white/20 cursor-not-allowed'}"
          style="font-family: var(--font-mono);"
        >
          →
        </button>
      {/if}
    </div>

    <div class="text-4xl leading-none text-white text-center mt-2 neon-glow reveal-up delay-400
                {theme === 'orange' ? 'text-[var(--nw-hot-pink)]' : 'text-[var(--tw-electric-cyan)]'}"
         style="font-family: var(--font-display);">
      COMEDY<br/>CAFE<br/>BERLIN
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
      <nav class="flex flex-col gap-2 w-full max-w-[200px] reveal-up delay-300">
        <a href="https://www.comedycafeberlin.com" target="_blank" rel="noopener"
           class="flex items-center gap-2 px-3 py-2 border-l-4 transition-all hover:bg-white/5
                  {theme === 'orange' ? 'border-[var(--nw-hot-pink)] text-[var(--nw-neon-yellow)] hover:text-white' : 'border-[var(--tw-electric-cyan)] text-[var(--tw-electric-cyan)] hover:text-white'}"
           style="font-family: var(--font-mono);">
          <span class="text-xs uppercase tracking-wider">→ CCB Website</span>
        </a>

        <a href="https://training.comedycafeberlin.com" target="_blank" rel="noopener"
           class="flex items-center gap-2 px-3 py-2 border-l-4 transition-all hover:bg-white/5
                  {theme === 'orange' ? 'border-[var(--nw-hot-pink)] text-[var(--nw-neon-yellow)] hover:text-white' : 'border-[var(--tw-electric-cyan)] text-[var(--tw-electric-cyan)] hover:text-white'}"
           style="font-family: var(--font-mono);">
          <span class="text-xs uppercase tracking-wider">→ Classes</span>
        </a>

        <a href="/performers"
           class="flex items-center gap-2 px-3 py-2 border-l-4 transition-all hover:bg-white/5
                  {theme === 'orange' ? 'border-[var(--nw-burning-orange)] text-[var(--nw-neon-yellow)] hover:text-white' : 'border-[var(--tw-neon-pink)] text-[var(--tw-neon-pink)] hover:text-white'}"
           style="font-family: var(--font-mono);">
          <span class="text-xs uppercase tracking-wider">→ Performers</span>
        </a>

        <a href="/teams"
           class="flex items-center gap-2 px-3 py-2 border-l-4 transition-all hover:bg-white/5
                  {theme === 'orange' ? 'border-[var(--nw-burning-orange)] text-[var(--nw-neon-yellow)] hover:text-white' : 'border-[var(--tw-neon-pink)] text-[var(--tw-neon-pink)] hover:text-white'}"
           style="font-family: var(--font-mono);">
          <span class="text-xs uppercase tracking-wider">→ Teams</span>
        </a>

        <a href="/analytics"
           class="flex items-center gap-2 px-3 py-2 border-l-4 transition-all hover:bg-white/5
                  {theme === 'orange' ? 'border-[var(--nw-burning-orange)] text-white/60 hover:text-white' : 'border-white/40 text-white/60 hover:text-white'}"
           style="font-family: var(--font-mono);">
          <span class="text-xs uppercase tracking-wider">→ Analytics</span>
        </a>
      </nav>
    {/if}
  </div>

  <!-- Bottom: Tagline + Monitor Mode Toggle -->
  <div class="mb-4 relative z-10 reveal-up delay-500 flex flex-col items-center gap-3">
    <div class="text-lg font-bold text-center leading-tight text-white"
         style="font-family: var(--font-black);">
      IMPROV<br/>STANDUP<br/>SKETCH
    </div>

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

  <slot />
</section> 