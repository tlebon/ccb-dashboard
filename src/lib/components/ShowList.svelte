<script lang="ts">
	import type { Show } from '$lib/utils/icalParser';

	export let shows: Show[] = [];
	export let title: string = 'Upcoming Shows';
</script>

<div class="rounded-lg bg-white p-6 shadow-lg">
	<h2 class="mb-4 text-2xl font-bold">{title}</h2>
	<div class="space-y-4">
		{#each shows as show}
			<div class="flex items-center gap-4">
				{#if show.imageUrl}
					<img src={show.imageUrl} alt={show.title} class="h-20 w-20 rounded object-cover" />
				{:else}
					<div class="flex h-20 w-20 items-center justify-center rounded bg-gray-200">
						<span class="text-xs text-gray-400">No image</span>
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
