<script lang="ts">
	import { onMount } from 'svelte';
	import PerformerSearch from '$lib/components/PerformerSearch.svelte';
	import QuickNav from '$lib/components/QuickNav.svelte';

	interface Performer {
		id: number;
		name: string;
		slug: string;
		team_count?: number;
		show_count?: number;
	}

	let performers: Performer[] = [];
	let topPerformers: Performer[] = [];
	let searchQuery = '';
	let loading = true;

	onMount(async () => {
		const res = await fetch('/api/performers?top=30');
		const data = await res.json();
		topPerformers = data.performers;
		loading = false;
	});

	async function handleSearch(e: CustomEvent<string>) {
		searchQuery = e.detail;
		if (searchQuery.length >= 2) {
			const res = await fetch(`/api/performers?q=${encodeURIComponent(searchQuery)}`);
			const data = await res.json();
			performers = data.performers;
		} else {
			performers = [];
		}
	}

	$: displayPerformers = searchQuery.length >= 2 ? performers : topPerformers;
	$: showingSearch = searchQuery.length >= 2;
</script>

<svelte:head>
	<title>Performers | CCB Dashboard</title>
</svelte:head>

<div
	class="min-h-screen bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black text-white"
>
	<div class="grain-overlay"></div>

	<div class="relative z-10 mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-8">
		<!-- Header -->
		<header class="mb-6 md:mb-10">
			<QuickNav />
			<h1
				class="inline-block bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--tw-neon-pink)] px-3 py-1.5 text-4xl tracking-wider text-white uppercase
			           md:px-4 md:py-2 md:text-6xl"
				style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);"
			>
				Performers
			</h1>
		</header>

		<!-- Search -->
		<div class="mb-10 max-w-xl">
			<PerformerSearch on:search={handleSearch} />
		</div>

		{#if loading}
			<div
				class="py-12 text-center text-[var(--tw-electric-cyan)]"
				style="font-family: var(--font-display);"
			>
				Loading...
			</div>
		{:else}
			<!-- Section heading -->
			<div class="relative mb-6">
				<h2
					class="text-xl tracking-wider text-[var(--tw-electric-cyan)] uppercase"
					style="font-family: var(--font-display);"
				>
					{#if showingSearch}
						{performers.length} result{performers.length !== 1 ? 's' : ''} for "{searchQuery}"
					{:else}
						Top Performers
					{/if}
				</h2>
				<div
					class="absolute -bottom-2 left-0 h-1 w-24 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"
				></div>
			</div>

			<!-- Performers list -->
			<div class="grid grid-cols-1 gap-1 md:grid-cols-2 lg:grid-cols-3">
				{#each displayPerformers as performer (performer.id)}
					<a
						href="/performers/{performer.slug}"
						class="group flex flex-col gap-1 border-l-4 border-[var(--tw-electric-cyan)]/40 px-3 py-3
						       transition-all hover:border-[var(--tw-neon-pink)] hover:bg-[var(--tw-deep-purple)]/40"
					>
						<span
							class="text-2xl text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)]"
							style="font-family: var(--font-display);"
						>
							{performer.name}
						</span>
						<span class="flex gap-3 font-mono text-sm">
							{#if performer.team_count}
								<span class="text-[var(--tw-neon-pink)]">{performer.team_count} teams</span>
							{/if}
							{#if performer.show_count}
								<span class="text-[var(--nw-burning-orange)]">{performer.show_count} shows</span>
							{/if}
						</span>
					</a>
				{/each}
			</div>

			{#if displayPerformers.length === 0 && showingSearch}
				<div class="py-12 text-center text-white/60">
					No performers found for "{searchQuery}"
				</div>
			{/if}
		{/if}
	</div>
</div>
