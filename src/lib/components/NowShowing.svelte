<script lang="ts">
  import type { Show } from '$lib/utils/icalParser';

  export let currentShow: Show | null;
</script>

<div class="bg-white rounded-lg shadow-lg overflow-hidden">
  {#if currentShow}
    <div class="relative">
      {#if currentShow.imageUrl}
        <img
          src={currentShow.imageUrl}
          alt={currentShow.title}
          class="w-full h-64 object-cover"
        />
      {:else}
        <div class="w-full h-64 bg-gray-200 flex items-center justify-center">
          <span class="text-gray-400">No image available</span>
        </div>
      {/if}
      <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 p-6 text-white">
        <h2 class="text-3xl font-bold mb-2">{currentShow.title}</h2>
        <p class="text-lg opacity-90">
          {new Date(currentShow.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  {:else}
    <div class="p-6 text-center">
      <p class="text-gray-500">No show currently playing</p>
    </div>
  {/if}
</div>

<style>
  .now-showing-container {
    max-width: 1000px;
    margin: 0 auto;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .show-details {
    animation: fadeIn 0.5s ease-in-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style> 