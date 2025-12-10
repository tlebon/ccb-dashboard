<script lang="ts">
  import type { Show } from '$lib/utils/icalParser';

  export let shows: Show[] = [];
  export let title: string = 'Upcoming Shows';
</script>

<div class="bg-white rounded-lg shadow-lg p-6">
  <h2 class="text-2xl font-bold mb-4">{title}</h2>
  <div class="space-y-4">
    {#each shows as show}
      <div class="flex gap-4 items-center">
        {#if show.imageUrl}
          <img
            src={show.imageUrl}
            alt={show.title}
            class="w-20 h-20 object-cover rounded"
          />
        {:else}
          <div class="w-20 h-20 bg-gray-200 rounded flex items-center justify-center">
            <span class="text-gray-400 text-xs">No image</span>
          </div>
        {/if}
        <div class="flex-1">
          <h3 class="font-semibold">{show.title}</h3>
          <p class="text-sm text-gray-600">
            {new Date(show.start).toLocaleDateString([], { 
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>
      </div>
    {/each}
  </div>
</div>

 