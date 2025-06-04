<script lang="ts">
  import ThisWeek from '../+page.svelte';
  import NextWeek from '../next-week/+page.svelte';
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';

  let showNextWeek = false;
  let interval: ReturnType<typeof setInterval>;

  // Set your desired rotation time (e.g., 60 seconds)
  const ROTATE_MS = 60000;

  onMount(() => {
    interval = setInterval(() => {
      showNextWeek = !showNextWeek;
    }, ROTATE_MS);
  });

  onDestroy(() => {
    clearInterval(interval);
  });
</script>

{#if showNextWeek}
  <div transition:fade><NextWeek /></div>
{:else}
  <div transition:fade><ThisWeek /></div>
{/if} 