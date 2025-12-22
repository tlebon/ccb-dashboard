<script lang="ts">
	import type { Show } from '$lib/utils/icalParser';

	export let currentShow: Show | null;
</script>

<div class="overflow-hidden rounded-lg bg-white shadow-lg">
	{#if currentShow}
		<div class="relative">
			{#if currentShow.imageUrl}
				<img src={currentShow.imageUrl} alt={currentShow.title} class="h-64 w-full object-cover" />
			{:else}
				<div class="flex h-64 w-full items-center justify-center bg-gray-200">
					<span class="text-gray-400">No image available</span>
				</div>
			{/if}
			<div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
			<div class="absolute right-0 bottom-0 left-0 p-6 text-white">
				<h2 class="mb-2 text-3xl font-bold">{currentShow.title}</h2>
				<p class="text-lg opacity-90">
					{new Date(currentShow.start).toLocaleTimeString([], {
						hour: '2-digit',
						minute: '2-digit'
					})}
				</p>
			</div>
		</div>
	{:else}
		<div class="p-6 text-center">
			<p class="text-gray-500">No show currently playing</p>
		</div>
	{/if}
</div>
