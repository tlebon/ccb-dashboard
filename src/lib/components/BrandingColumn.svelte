<script lang="ts">
  import QrCode from 'svelte-qrcode';
  let logoError = false;
  export let nextWeek: boolean = false;
  export let theme: 'blue' | 'orange' = 'blue';
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

    <div class="mt-3 reveal-up delay-300">
      <div class="text-sm tracking-[0.3em] uppercase {theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}"
           style="font-family: var(--font-mono);">
        {nextWeek ? 'Next Week' : 'This Week'}
      </div>
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

  <!-- Middle: QR codes -->
  <div class="w-full flex flex-row items-center justify-center gap-4 flex-1 relative z-10">
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

  <!-- Bottom: Tagline -->
  <div class="mb-4 text-lg font-bold text-center leading-tight relative z-10 reveal-up delay-500 text-white"
       style="font-family: var(--font-black);">
    IMPROV<br/>STANDUP<br/>SKETCH
  </div>

  <slot />
</section> 