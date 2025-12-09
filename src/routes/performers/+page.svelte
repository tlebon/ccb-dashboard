<script lang="ts">
	import { onMount } from 'svelte';
	import PerformerSearch from '$lib/components/PerformerSearch.svelte';

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

<div class="min-h-screen text-white bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black">
	<div class="grain-overlay"></div>

	<div class="relative z-10 max-w-5xl mx-auto px-6 py-8">
		<!-- Header -->
		<header class="mb-10">
			<a href="/" class="text-[var(--tw-neon-pink)] hover:text-[var(--tw-electric-cyan)] text-sm mb-4 inline-block font-mono uppercase tracking-wider">
				← Dashboard
			</a>
			<h1 class="text-6xl uppercase tracking-wider text-white inline-block px-4 py-2
			           bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--tw-neon-pink)]"
			    style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);">
				Performers
			</h1>
		</header>

		<!-- Search -->
		<div class="mb-10 max-w-xl">
			<PerformerSearch on:search={handleSearch} />
		</div>

		{#if loading}
			<div class="text-center py-12 text-[var(--tw-electric-cyan)]" style="font-family: var(--font-display);">
				Loading...
			</div>
		{:else}
			<!-- Section heading -->
			<div class="mb-6 relative">
				<h2 class="text-xl uppercase tracking-wider text-[var(--tw-electric-cyan)]"
				    style="font-family: var(--font-display);">
					{#if showingSearch}
						{performers.length} result{performers.length !== 1 ? 's' : ''} for "{searchQuery}"
					{:else}
						Top Performers
					{/if}
				</h2>
				<div class="absolute -bottom-2 left-0 w-24 h-1 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"></div>
			</div>

			<!-- Performers list -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
				{#each displayPerformers as performer, i (performer.id)}
					<a
						href="/performers/{performer.slug}"
						class="group flex flex-col gap-1 py-3 px-3 border-l-4 border-[var(--tw-electric-cyan)]/40
						       hover:border-[var(--tw-neon-pink)] hover:bg-[var(--tw-deep-purple)]/40 transition-all"
					>
						<span class="text-2xl uppercase text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors"
						      style="font-family: var(--font-display);">
							{performer.name}
						</span>
						<span class="flex gap-3 text-sm font-mono">
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
				<div class="text-center py-12 text-white/60">
					No performers found for "{searchQuery}"
				</div>
			{/if}
		{/if}
	</div>
</div>
