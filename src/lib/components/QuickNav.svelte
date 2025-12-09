<script lang="ts">
  import { page } from '$app/stores';

  // Current path for highlighting active link
  $: currentPath = $page.url.pathname;
</script>

<nav class="flex items-center gap-4 text-sm font-mono mb-6">
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
  <span class="text-white/30">|</span>
  <a
    href="/analytics"
    class="uppercase tracking-wider transition-colors {currentPath === '/analytics' ? 'text-[var(--tw-neon-pink)]' : 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}">
    Analytics
  </a>
</nav>
