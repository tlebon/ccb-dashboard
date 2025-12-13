<script lang="ts">
  import { page } from '$app/stores';
  import { getContext } from 'svelte';
  import MobileNav from './MobileNav.svelte';

  // Current path for highlighting active link
  $: currentPath = $page.url.pathname;

  // Check if analytics access is granted
  const hasAnalyticsAccess = getContext<boolean>('analyticsAccess');

  let mobileNavOpen = false;
</script>

<!-- Mobile Nav Sidebar -->
<MobileNav bind:open={mobileNavOpen} theme="blue" {hasAnalyticsAccess} on:close={() => mobileNavOpen = false} />

<!-- Mobile Header -->
<div class="flex md:hidden items-center justify-between mb-4">
  <button
    on:click={() => mobileNavOpen = true}
    class="w-10 h-10 flex flex-col items-center justify-center gap-1 rounded text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10"
    aria-label="Open menu"
  >
    <span class="block w-5 h-0.5 bg-[var(--tw-electric-cyan)]"></span>
    <span class="block w-5 h-0.5 bg-[var(--tw-electric-cyan)]"></span>
    <span class="block w-5 h-0.5 bg-[var(--tw-electric-cyan)]"></span>
  </button>
  <a href="/" class="flex items-center gap-2">
    <img src="/cropped-CCB-Logos_white_LG.png" alt="CCB" class="w-8 h-8 object-contain" />
  </a>
  <div class="w-10"></div> <!-- Spacer for centering -->
</div>

<!-- Desktop Nav -->
<nav class="hidden md:flex items-center gap-4 text-sm font-mono mb-6">
  <a
    href="/"
    class="uppercase tracking-wider transition-colors {currentPath === '/' ? 'text-[var(--tw-neon-pink)]' : 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}">
    Dashboard
  </a>
  <span class="text-white/30">|</span>
  <a
    href="/performers"
    class="uppercase tracking-wider transition-colors {currentPath.startsWith('/performers') ? 'text-[var(--tw-neon-pink)]' : 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}">
    Performers
  </a>
  <span class="text-white/30">|</span>
  <a
    href="/teams"
    class="uppercase tracking-wider transition-colors {currentPath.startsWith('/teams') ? 'text-[var(--tw-neon-pink)]' : 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}">
    Teams
  </a>
  <span class="text-white/30">|</span>
  <a
    href="/shows"
    class="uppercase tracking-wider transition-colors {currentPath.startsWith('/shows') ? 'text-[var(--tw-neon-pink)]' : 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}">
    Shows
  </a>
  {#if hasAnalyticsAccess}
    <span class="text-white/30">|</span>
    <a
      href="/analytics"
      class="uppercase tracking-wider transition-colors {currentPath === '/analytics' ? 'text-[var(--tw-neon-pink)]' : 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}">
      Analytics
    </a>
  {/if}
</nav>
