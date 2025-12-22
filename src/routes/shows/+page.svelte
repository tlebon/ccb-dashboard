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
		return date.toLocaleDateString('en-GB', {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function formatTime(timeStr: string | null) {
		if (!timeStr) return '';
		return timeStr.slice(0, 5);
	}
</script>

<svelte:head>
	<title>Shows | CCB Dashboard</title>
</svelte:head>

<div
	class="min-h-screen bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black text-white"
>
	<div class="grain-overlay"></div>

	<div class="relative z-10 mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-8">
		<QuickNav />

		<!-- Header -->
		<header class="mb-6 md:mb-10">
			<h1
				class="inline-block bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--nw-burning-orange)] px-3 py-1.5 text-4xl tracking-wider text-white uppercase
			           md:px-4 md:py-2 md:text-6xl"
				style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);"
			>
				Shows
			</h1>
			{#if !loading}
				<p class="mt-4 font-mono text-white/60">
					{counts.upcoming} upcoming · {counts.past} past
				</p>
			{/if}
		</header>

		{#if loading}
			<div
				class="py-12 text-center text-[var(--tw-electric-cyan)]"
				style="font-family: var(--font-display);"
			>
				Loading...
			</div>
		{:else}
			<!-- Upcoming Shows -->
			{#if upcomingShows.length > 0}
				<section class="mb-12">
					<div class="relative mb-6">
						<h2
							class="text-2xl tracking-wider text-[var(--nw-neon-yellow)] uppercase"
							style="font-family: var(--font-display);"
						>
							Upcoming Shows
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-16 bg-gradient-to-r from-[var(--nw-neon-yellow)] to-transparent"
						></div>
					</div>

					<div class="space-y-2">
						{#each upcomingShows as show (show.id)}
							<a
								href="/shows/{show.slug}"
								class="group flex flex-col gap-1 border-l-4 border-[var(--nw-neon-yellow)]/40 px-4 py-3 transition-all hover:border-[var(--nw-neon-yellow)] hover:bg-white/5 sm:flex-row sm:items-center sm:gap-4"
							>
								<div
									class="font-mono text-xs text-[var(--nw-neon-yellow)] sm:min-w-[140px] sm:text-sm"
								>
									{formatDate(show.date)}
									{#if show.time}
										<span class="ml-2 text-white/40">{formatTime(show.time)}</span>
									{/if}
								</div>
								<div class="flex-1">
									<span
										class="text-base text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)] sm:text-lg"
										style="font-family: var(--font-display);"
									>
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
					<h2
						class="text-2xl tracking-wider text-[var(--tw-neon-pink)] uppercase"
						style="font-family: var(--font-display);"
					>
						Past Shows
					</h2>
					<div
						class="absolute -bottom-2 left-0 h-1 w-16 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"
					></div>
				</div>

				{#if pastShows.length > 0}
					<div class="space-y-1">
						{#each pastShows as show (show.id)}
							<a
								href="/shows/{show.slug}"
								class="group flex flex-col gap-0.5 border-l-4 border-[var(--tw-neon-pink)]/20 px-4 py-2 transition-all hover:border-[var(--tw-neon-pink)] hover:bg-white/5 sm:flex-row sm:items-center sm:gap-4"
							>
								<div class="font-mono text-xs text-white/50 sm:min-w-[140px] sm:text-sm">
									{formatDate(show.date)}
								</div>
								<div class="flex-1">
									<span
										class="text-sm text-white/70 uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)] sm:text-base"
										style="font-family: var(--font-display);"
									>
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
							class="mt-6 bg-[var(--tw-deep-purple)] px-6 py-3 font-mono tracking-wider text-[var(--tw-electric-cyan)] uppercase transition-colors hover:bg-[var(--tw-neon-pink)] hover:text-white disabled:opacity-50"
						>
							{loadingMore ? 'Loading...' : 'Load More'}
						</button>
					{/if}
				{:else}
					<p class="py-8 font-mono text-white/40">No past shows found</p>
				{/if}
			</section>
		{/if}
	</div>
</div>
