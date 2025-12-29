<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Show } from '$lib/utils/icalParser';
	import { proxyImageUrl } from '$lib/utils/imageProxy';
	import { isHouseShow, formatHouseShowTeams } from '$lib/utils/houseShowTeams';
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	export let shows: Show[] = [];
	export let nextShowId: string | undefined;
	export let theme: 'blue' | 'orange' = 'blue';

	// Filter out the next show
	$: carouselShows = shows.filter((s) => s.id !== nextShowId && s.imageUrl);

	// Format show title - add team names for House Show
	function getDisplayTitle(show: Show): string {
		if (isHouseShow(show.title)) {
			const teams = formatHouseShowTeams(show.start);
			if (teams) return `House Show: ${teams}`;
		}
		return show.title;
	}

	let current = 0;
	let interval: any;

	function startCarousel() {
		stopCarousel();
		interval = setInterval(() => {
			current = (current + 1) % carouselShows.length;
		}, 5000);
	}

	function stopCarousel() {
		if (interval) clearInterval(interval);
	}

	$: if (carouselShows.length > 1) startCarousel();
	onDestroy(stopCarousel);
</script>

{#if carouselShows.length === 0}
	<div
		class={`text-center text-sm opacity-60 ${theme === 'orange' ? 'text-[var(--nw-cream)]' : 'text-white'}`}
		style="font-family: var(--font-mono);"
	>
		No more show images
	</div>
{:else}
	<a
		href="/shows/{carouselShows[current].id}"
		class="group block flex h-full w-full flex-col items-center"
	>
		<!-- Carousel Image -->
		<div
			class={`brutalist-border relative flex min-h-0 w-full flex-1 origin-top items-center justify-center overflow-hidden transition-transform group-hover:scale-[1.02]
                ${
									theme === 'orange'
										? 'border-[var(--nw-hot-pink)] bg-[var(--nw-deep-purple)]'
										: 'border-[var(--tw-electric-cyan)] bg-[var(--tw-midnight)]'
								}`}
		>
			{#key current}
				<div
					in:fly={{ x: 100, duration: 600, easing: cubicOut }}
					out:fly={{ x: -100, duration: 600, easing: cubicOut }}
					class="absolute inset-0 h-full w-full"
				>
					{#if carouselShows[current].imageUrl}
						<img
							src={proxyImageUrl(carouselShows[current].imageUrl)}
							alt={carouselShows[current].title}
							class="h-full w-full object-cover"
						/>
					{:else}
						<div
							class="flex h-full items-center justify-center text-lg text-white"
							style="font-family: var(--font-display);"
						>
							No Image
						</div>
					{/if}
				</div>
			{/key}

			<!-- Carousel indicators -->
			<div class="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
				{#each carouselShows as _, i}
					<div
						class={`h-1.5 w-1.5 transition-all ${i === current ? 'w-6' : 'w-1.5'}
                      ${theme === 'orange' ? 'bg-[var(--nw-neon-yellow)]' : 'bg-[var(--tw-electric-cyan)]'}`}
					></div>
				{/each}
			</div>
		</div>

		<!-- Show info -->
		<div class="relative mt-3 w-full overflow-hidden px-3">
			{#key current}
				<div
					in:fly={{ x: 100, duration: 600, easing: cubicOut }}
					out:fly={{ x: -100, duration: 600, easing: cubicOut }}
					class="absolute inset-0 w-full"
				>
					<div
						class="mb-1.5 text-xl leading-tight font-black tracking-wide text-white uppercase group-hover:text-[var(--tw-electric-cyan)]"
						style="font-family: var(--font-display);"
					>
						{getDisplayTitle(carouselShows[current])}
					</div>
					<div
						class={`text-sm font-bold tracking-widest uppercase
                      ${theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}`}
						style="font-family: var(--font-mono);"
					>
						{new Date(carouselShows[current].start)
							.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
							.toUpperCase()}
						<span class="mx-1.5">•</span>
						{new Date(carouselShows[current].start).toLocaleTimeString([], {
							hour: '2-digit',
							minute: '2-digit'
						})}
					</div>
				</div>
			{/key}
			<!-- Spacer to maintain height -->
			<div class="invisible">
				<div class="mb-1.5 text-xl leading-tight font-black tracking-wide uppercase">Spacer</div>
				<div class="text-sm font-bold tracking-widest uppercase">Spacer text</div>
			</div>
		</div>
	</a>
{/if}
