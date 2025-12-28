<script lang="ts">
	import type { Show } from '$lib/utils/icalParser';
	import { proxyImageUrl } from '$lib/utils/imageProxy';
	import { isHouseShow, formatHouseShowTeams } from '$lib/utils/houseShowTeams';
	export let nextShow: Show | undefined;
	export let shows: Show[];
	export let nextShowId: string | undefined;
	export let upFirst: boolean = false;
	export let theme: 'blue' | 'orange' = 'blue';
	export let isPastWeek: boolean = false;
	export let visibleShowIds: string[] = []; // IDs of shows currently visible in viewport (for carousel filtering)
	export let monitorMode: boolean = false; // In monitor mode, don't filter carousel
	import ShowCarousel from './ShowCarousel.svelte';

	// Memoize carousel shows to only update when visibleShowIds changes, not when shows array ref changes
	let prevVisibleShowIds: string[] = [];
	let cachedCarouselShows: Show[] = [];

	$: {
		// Only recalculate if monitorMode changed, or visibleShowIds actually changed (not just reference)
		const idsChanged =
			visibleShowIds.length !== prevVisibleShowIds.length ||
			visibleShowIds.some((id, i) => id !== prevVisibleShowIds[i]);

		if (idsChanged) {
			if (monitorMode) {
				cachedCarouselShows = shows;
			} else if (visibleShowIds.length === 0) {
				cachedCarouselShows = shows.filter((show) => new Date(show.start) > new Date());
			} else {
				cachedCarouselShows = shows.filter((show) => visibleShowIds.includes(show.id));
			}
			prevVisibleShowIds = [...visibleShowIds];
		}
	}

	$: carouselShows = cachedCarouselShows;

	// Format show title - add team names for House Show
	function getDisplayTitle(show: Show): string {
		if (isHouseShow(show.title)) {
			const teams = formatHouseShowTeams(show.start);
			if (teams) return `House Show: ${teams}`;
		}
		return show.title;
	}
</script>

<section
	class="reveal-right flex h-full w-full flex-col items-center justify-start gap-3 overflow-hidden delay-200"
>
	{#if isPastWeek}
		<!-- Past week: two carousels, no featured show -->
		<div class="reveal-up min-h-0 w-full flex-1 delay-300">
			<ShowCarousel
				shows={carouselShows.slice(0, Math.ceil(carouselShows.length / 2))}
				nextShowId={undefined}
				{theme}
			/>
		</div>
		<div class="reveal-up min-h-0 w-full flex-1 delay-400">
			<ShowCarousel
				shows={carouselShows.slice(Math.ceil(carouselShows.length / 2))}
				nextShowId={undefined}
				{theme}
			/>
		</div>
	{:else}
		{#if nextShow}
			<a
				href="/shows/{nextShow.id}"
				class={`brutalist-border reveal-up relative block w-full flex-shrink-0 overflow-hidden transition-transform delay-300 hover:scale-[1.02]
                  ${
										theme === 'orange'
											? 'border-[var(--nw-hot-pink)] bg-gradient-to-br from-[var(--nw-deep-purple)] to-black'
											: 'border-[var(--tw-electric-cyan)] bg-gradient-to-br from-[var(--tw-midnight)] to-[var(--tw-deep-purple)]'
									}`}
			>
				<!-- Featured Image -->
				<div class="relative w-full overflow-hidden" style="max-height: 38vh;">
					{#if nextShow.imageUrl}
						<img
							src={proxyImageUrl(nextShow.imageUrl)}
							alt={nextShow.title}
							class="h-full w-full object-cover object-top"
						/>
					{:else}
						<div
							class="flex h-32 items-center justify-center text-xl text-white"
							style="font-family: var(--font-display);"
						>
							No Image
						</div>
					{/if}

					<!-- Label overlay -->
					<div
						class={`absolute top-2 left-2 px-3 py-1 text-xs font-black tracking-[0.3em] uppercase
                      ${
												theme === 'orange'
													? 'bg-[var(--nw-neon-yellow)] text-black'
													: 'bg-[var(--tw-electric-cyan)] text-[var(--tw-midnight)]'
											}`}
						style="font-family: var(--font-mono); clip-path: polygon(0 0, 95% 0, 100% 100%, 5% 100%);"
					>
						{upFirst ? '→ Up First' : '→ Up Next'}
					</div>
				</div>

				<!-- Show details -->
				<div class="relative z-10 p-3">
					<h2
						class="mb-1 text-xl leading-tight font-black tracking-wide text-white uppercase group-hover:text-[var(--tw-electric-cyan)]"
						style="font-family: var(--font-display);"
					>
						{getDisplayTitle(nextShow)}
					</h2>

					<div
						class={`text-sm font-bold tracking-widest uppercase
                      ${theme === 'orange' ? 'text-[var(--nw-neon-yellow)]' : 'text-[var(--tw-electric-cyan)]'}`}
						style="font-family: var(--font-mono);"
					>
						{new Date(nextShow.start)
							.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
							.toUpperCase()}
						<span class="mx-1">•</span>
						{new Date(nextShow.start).toLocaleTimeString([], {
							hour: '2-digit',
							minute: '2-digit'
						})}
					</div>
				</div>
			</a>
		{/if}

		<!-- Carousel -->
		<div class="reveal-up min-h-0 w-full flex-1 delay-400">
			<ShowCarousel shows={carouselShows} {nextShowId} {theme} />
		</div>
	{/if}
</section>
