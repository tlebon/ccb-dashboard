<script lang="ts">
  import { page } from '$app/stores';
  import { createEventDispatcher } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  export let open = false;
  export let theme: 'blue' | 'orange' = 'blue';

  const dispatch = createEventDispatcher();

  $: currentPath = $page.url.pathname;

  function close() {
    dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) close();
  }

  const links = [
    { href: '/', label: 'Dashboard', icon: '◈' },
    { href: '/shows', label: 'Shows', icon: '▸' },
    { href: '/teams', label: 'Teams', icon: '◆' },
    { href: '/performers', label: 'Performers', icon: '●' },
    { href: '/analytics', label: 'Analytics', icon: '◎' },
  ];

  const externalLinks = [
    { href: 'https://www.comedycafeberlin.com', label: 'CCB Website' },
    { href: 'https://training.comedycafeberlin.com', label: 'Classes' },
  ];
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div
    class="fixed inset-0 bg-black/70 z-40 cursor-default"
    transition:fade={{ duration: 200 }}
    on:click={close}
    role="presentation"
  />

  <!-- Sidebar -->
  <nav
    class="fixed top-0 left-0 bottom-0 w-72 z-50 flex flex-col
           {theme === 'orange'
             ? 'bg-gradient-to-b from-[var(--nw-deep-purple)] to-black'
             : 'bg-gradient-to-b from-[var(--tw-midnight)] to-[var(--tw-deep-purple)]'}"
    transition:fly={{ x: -288, duration: 300, easing: cubicOut }}
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b
                {theme === 'orange' ? 'border-[var(--nw-hot-pink)]/30' : 'border-[var(--tw-electric-cyan)]/30'}">
      <div class="flex items-center gap-3">
        <img src="/cropped-CCB-Logos_white_LG.png" alt="CCB" class="w-10 h-10 object-contain" />
        <span class="text-white text-lg uppercase tracking-wider" style="font-family: var(--font-display);">
          Menu
        </span>
      </div>
      <button
        on:click={close}
        class="w-10 h-10 flex items-center justify-center text-2xl transition-colors
               {theme === 'orange' ? 'text-[var(--nw-neon-yellow)] hover:text-white' : 'text-[var(--tw-electric-cyan)] hover:text-white'}"
        aria-label="Close menu"
      >
        ×
      </button>
    </div>

    <!-- Navigation Links -->
    <div class="flex-1 overflow-y-auto py-4">
      <ul class="space-y-1 px-2">
        {#each links as link}
          {@const isActive = link.href === '/' ? currentPath === '/' : currentPath.startsWith(link.href)}
          <li>
            <a
              href={link.href}
              on:click={close}
              class="flex items-center gap-3 px-4 py-3 rounded transition-all
                     {isActive
                       ? (theme === 'orange'
                         ? 'bg-[var(--nw-hot-pink)]/20 text-[var(--nw-neon-yellow)] border-l-4 border-[var(--nw-hot-pink)]'
                         : 'bg-[var(--tw-electric-cyan)]/20 text-[var(--tw-electric-cyan)] border-l-4 border-[var(--tw-electric-cyan)]')
                       : 'text-white/80 hover:bg-white/5 hover:text-white border-l-4 border-transparent'}"
            >
              <span class="text-sm opacity-60">{link.icon}</span>
              <span class="uppercase tracking-wider text-sm" style="font-family: var(--font-display);">
                {link.label}
              </span>
            </a>
          </li>
        {/each}
      </ul>

      <!-- Divider -->
      <div class="my-4 mx-4 border-t {theme === 'orange' ? 'border-[var(--nw-hot-pink)]/20' : 'border-[var(--tw-electric-cyan)]/20'}"></div>

      <!-- External Links -->
      <ul class="space-y-1 px-2">
        {#each externalLinks as link}
          <li>
            <a
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-3 px-4 py-3 rounded transition-all text-white/60 hover:bg-white/5 hover:text-white"
            >
              <span class="text-sm opacity-60">↗</span>
              <span class="uppercase tracking-wider text-xs" style="font-family: var(--font-mono);">
                {link.label}
              </span>
            </a>
          </li>
        {/each}
      </ul>
    </div>

    <!-- Footer -->
    <div class="p-4 border-t {theme === 'orange' ? 'border-[var(--nw-hot-pink)]/30' : 'border-[var(--tw-electric-cyan)]/30'}">
      <div class="text-center">
        <div class="text-xs text-white/40 uppercase tracking-widest mb-1" style="font-family: var(--font-mono);">
          Comedy Cafe Berlin
        </div>
        <div class="text-[10px] text-white/30" style="font-family: var(--font-serif);">
          Improv · Standup · Sketch
        </div>
      </div>
    </div>
  </nav>
{/if}
