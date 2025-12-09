<script lang="ts">
	import { onMount } from 'svelte';
	import QuickNav from '$lib/components/QuickNav.svelte';

	interface Show {
		id: number;
		title: string;
		slug: string;
		date: string;
		time: string | null;
		description: string | null;
		image_url: string | null;
	}

	let upcomingShows: Show[] = [];
	let pastShows: Show[] = [];
	let loading = true;
	let counts = { upcoming: 0, past: 0 };

	// Pagination for past shows
	const PAGE_SIZE = 20;
	let pastOffset = 0;
	let loadingMore = false;
	let hasMorePast = true;

	onMount(async () => {
		await Promise.all([loadUpcoming(), loadPast()]);
		loading = false;
	});

	async function loadUpcoming() {
		const res = await fetch('/api/shows/list?filter=upcoming&limit=20');
		const data = await res.json();
		upcomingShows = data.shows;
		counts = data.counts;
	}

	async function loadPast() {
		const res = await fetch(`/api/shows/list?filter=past&limit=${PAGE_SIZE}&offset=${pastOffset}`);
		const data = await res.json();
		pastShows = [...pastShows, ...data.shows];
		hasMorePast = data.shows.length === PAGE_SIZE;
	}

	async function loadMorePast() {
		if (loadingMore || !hasMorePast) return;
		loadingMore = true;
		pastOffset += PAGE_SIZE;
		await loadPast();
		loadingMore = false;
	}

	function formatDate(dateStr: string) {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
	}

	function formatTime(timeStr: string | null) {
		if (!timeStr) return '';
		return timeStr.slice(0, 5);
	}
</script>

<svelte:head>
	<title>Shows | CCB Dashboard</title>
</svelte:head>

<div class="min-h-screen text-white bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black">
	<div class="grain-overlay"></div>

	<div class="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-4 md:py-8">
		<QuickNav />

		<!-- Header -->
		<header class="mb-6 md:mb-10">
			<h1 class="text-4xl md:text-6xl uppercase tracking-wider text-white inline-block px-3 md:px-4 py-1.5 md:py-2
			           bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--nw-burning-orange)]"
			    style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);">
				Shows
			</h1>
			{#if !loading}
				<p class="mt-4 text-white/60 font-mono">
					{counts.upcoming} upcoming · {counts.past} past
				</p>
			{/if}
		</header>

		{#if loading}
			<div class="text-center py-12 text-[var(--tw-electric-cyan)]" style="font-family: var(--font-display);">
				Loading...
			</div>
		{:else}
			<!-- Upcoming Shows -->
			{#if upcomingShows.length > 0}
				<section class="mb-12">
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--nw-neon-yellow)]"
						    style="font-family: var(--font-display);">
							Upcoming Shows
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--nw-neon-yellow)] to-transparent"></div>
					</div>

					<div class="space-y-2">
						{#each upcomingShows as show (show.id)}
							<a
								href="/shows/{show.slug}"
								class="group flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 px-4 border-l-4 border-[var(--nw-neon-yellow)]/40 hover:border-[var(--nw-neon-yellow)] hover:bg-white/5 transition-all"
							>
								<div class="sm:min-w-[140px] text-[var(--nw-neon-yellow)] font-mono text-xs sm:text-sm">
									{formatDate(show.date)}
									{#if show.time}
										<span class="text-white/40 ml-2">{formatTime(show.time)}</span>
									{/if}
								</div>
								<div class="flex-1">
									<span class="text-base sm:text-lg uppercase text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors"
									      style="font-family: var(--font-display);">
										{show.title}
									</span>
								</div>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Past Shows -->
			<section>
				<div class="relative mb-6">
					<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-neon-pink)]"
					    style="font-family: var(--font-display);">
						Past Shows
					</h2>
					<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"></div>
				</div>

				{#if pastShows.length > 0}
					<div class="space-y-1">
						{#each pastShows as show (show.id)}
							<a
								href="/shows/{show.slug}"
								class="group flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-4 py-2 px-4 border-l-4 border-[var(--tw-neon-pink)]/20 hover:border-[var(--tw-neon-pink)] hover:bg-white/5 transition-all"
							>
								<div class="sm:min-w-[140px] text-white/50 font-mono text-xs sm:text-sm">
									{formatDate(show.date)}
								</div>
								<div class="flex-1">
									<span class="text-sm sm:text-base uppercase text-white/70 group-hover:text-[var(--tw-electric-cyan)] transition-colors"
									      style="font-family: var(--font-display);">
										{show.title}
									</span>
								</div>
							</a>
						{/each}
					</div>

					{#if hasMorePast}
						<button
							on:click={loadMorePast}
							disabled={loadingMore}
							class="mt-6 px-6 py-3 bg-[var(--tw-deep-purple)] text-[var(--tw-electric-cyan)] uppercase tracking-wider font-mono hover:bg-[var(--tw-neon-pink)] hover:text-white transition-colors disabled:opacity-50"
						>
							{loadingMore ? 'Loading...' : 'Load More'}
						</button>
					{/if}
				{:else}
					<p class="text-white/40 py-8 font-mono">No past shows found</p>
				{/if}
			</section>
		{/if}
	</div>
</div>
