<script lang="ts">
  import ThisWeek from './this-week/+page.svelte';
  import NextWeek from './next-week/+page.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';

  let showNextWeek = false;
  let interval: ReturnType<typeof setInterval>;

  // Set your desired rotation time (e.g., 30 seconds)
  const ROTATE_MS = 30000;

  onMount(() => {
    interval = setInterval(() => {
      showNextWeek = !showNextWeek;
    }, ROTATE_MS);
  });

  onDestroy(() => {
    clearInterval(interval);
  });
</script>

<div class="relative w-full h-screen overflow-hidden">
  {#if showNextWeek}
    <div
      in:fly={{ x: '100%', duration: 800, easing: cubicOut }}
      out:fly={{ x: '-100%', duration: 800, easing: cubicOut }}
      class="absolute inset-0">
      <NextWeek />
    </div>
  {:else}
    <div
      in:fly={{ x: '100%', duration: 800, easing: cubicOut }}
      out:fly={{ x: '-100%', duration: 800, easing: cubicOut }}
      class="absolute inset-0">
      <ThisWeek />
    </div>
  {/if}
</div>
