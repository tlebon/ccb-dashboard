<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import QuickNav from '$lib/components/QuickNav.svelte';

	interface Team {
		id: number;
		name: string;
		slug: string;
		type: string;
		is_former: number;
	}

	interface Show {
		id: number;
		title: string;
		slug: string;
		date: string;
		time: string | null;
		role: string;
		team_name: string | null;
		team_slug: string | null;
	}

	interface Performer {
		id: number;
		name: string;
		slug: string;
		team_count: number;
		show_count: number;
	}

	let performer: Performer | null = null;
	let teams: Team[] = [];
	let upcomingShows: Show[] = [];
	let pastShows: Show[] = [];
	let loading = true;
	let error: string | null = null;

	// Pagination for past shows
	const PAGE_SIZE = 10;
	let showAllPastShows = false;

	$: slug = $page.params.slug;

	$: visiblePastShows = showAllPastShows ? pastShows : pastShows.slice(0, PAGE_SIZE);
	$: hasMorePastShows = pastShows.length > PAGE_SIZE && !showAllPastShows;

	onMount(async () => {
		await loadPerformer();
	});

	async function loadPerformer() {
		loading = true;
		error = null;
		showAllPastShows = false;

		try {
			const res = await fetch(`/api/performers/${slug}`);
			if (!res.ok) {
				error = res.status === 404 ? 'Performer not found' : 'Failed to load performer';
				return;
			}
			const data = await res.json();
			performer = data.performer;
			teams = data.teams;

			const showsRes = await fetch(`/api/performers/${slug}/shows?limit=100`);
			if (showsRes.ok) {
				const showsData = await showsRes.json();
				upcomingShows = showsData.upcomingShows;
				pastShows = showsData.pastShows;
			}
		} catch (e) {
			error = 'Failed to load performer';
		} finally {
			loading = false;
		}
	}

	function formatDate(dateStr: string) {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>{performer?.name || 'Performer'} | CCB Dashboard</title>
</svelte:head>

<div class="min-h-screen text-white bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black">
	<div class="grain-overlay"></div>

	<div class="relative z-10 max-w-5xl mx-auto px-6 py-8">
		<QuickNav />

		{#if loading}
			<div class="text-center py-12 text-[var(--tw-electric-cyan)]" style="font-family: var(--font-display);">
				Loading...
			</div>
		{:else if error}
			<div class="text-center py-12">
				<p class="text-[var(--tw-neon-pink)] text-2xl" style="font-family: var(--font-display);">{error}</p>
			</div>
		{:else if performer}
			<!-- Header -->
			<header class="mb-10">
				<h1 class="text-6xl uppercase tracking-wider text-white inline-block px-4 py-2
				           bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--nw-burning-orange)]"
				    style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);">
					{performer.name}
				</h1>
				<div class="flex gap-8 mt-6 text-lg font-mono">
					<span>
						<span class="text-[var(--tw-electric-cyan)] text-3xl" style="font-family: var(--font-display);">{performer.team_count}</span>
						<span class="text-white/60 ml-2">teams</span>
					</span>
					<span>
						<span class="text-[var(--tw-neon-pink)] text-3xl" style="font-family: var(--font-display);">{performer.show_count}</span>
						<span class="text-white/60 ml-2">tracked shows</span>
					</span>
				</div>
			</header>

			<!-- Upcoming Shows - Full Width, Most Prominent -->
			{#if upcomingShows.length > 0}
				<section class="mb-10">
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--nw-neon-yellow)]"
						    style="font-family: var(--font-display);">
							Upcoming Shows
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--nw-neon-yellow)] to-transparent"></div>
					</div>

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each upcomingShows as show (show.id)}
							<a
								href="/shows/{show.slug}"
								class="group p-4 border-l-4 border-[var(--nw-neon-yellow)]/60 bg-white/5 hover:bg-white/10 transition-all"
							>
								<div class="flex items-center gap-3 mb-2">
									<span class="text-[var(--nw-neon-yellow)] font-mono font-bold">
										{formatDate(show.date)}
									</span>
									{#if show.role !== 'performer'}
										<span class="text-[var(--tw-electric-cyan)] text-sm font-mono uppercase">{show.role}</span>
									{/if}
								</div>
								<span class="text-xl uppercase text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors block" style="font-family: var(--font-display);">
									{show.title}
								</span>
								{#if show.team_name}
									<span class="text-white/50 text-sm font-mono mt-1 block">with {show.team_name}</span>
								{/if}
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Two-column layout for Teams and Past Shows -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
				<!-- Teams Section -->
				{#if teams.length > 0}
					<section>
						<div class="relative mb-6">
							<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-electric-cyan)]"
							    style="font-family: var(--font-display);">
								Teams
							</h2>
							<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"></div>
						</div>

						<div class="divide-y divide-white/10">
							{#each teams as team (team.id)}
								<a
									href="/teams/{team.slug}"
									class="group flex items-center gap-3 py-3 px-3 border-l-4 transition-all hover:bg-white/5 {team.is_former ? 'border-white/20 opacity-50' : 'border-[var(--tw-electric-cyan)]/40'}"
								>
									<span class="text-xl uppercase text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors"
									      style="font-family: var(--font-display);">
										{team.name}
									</span>
									<span class="ml-auto text-sm font-mono uppercase tracking-wider">
										<span class="text-[var(--nw-burning-orange)]">{team.type}</span>
										{#if team.is_former}
											<span class="ml-2 text-[var(--tw-neon-pink)]">former</span>
										{/if}
									</span>
								</a>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Past Shows Section -->
				<section>
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-electric-cyan)]"
						    style="font-family: var(--font-display);">
							Recent Shows
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"></div>
					</div>

					{#if visiblePastShows.length > 0}
						<div class="divide-y divide-white/10">
							{#each visiblePastShows as show (show.id)}
								<a
									href="/shows/{show.slug}"
									class="group flex flex-col gap-1 py-3 px-3 border-l-4 border-[var(--tw-neon-pink)]/30 hover:border-[var(--tw-neon-pink)] hover:bg-white/5 transition-all"
								>
									<div class="flex items-center gap-3">
										<span class="text-[var(--nw-neon-yellow)] font-mono">
											{formatDate(show.date)}
										</span>
										{#if show.role !== 'performer'}
											<span class="text-[var(--tw-electric-cyan)] text-sm font-mono uppercase">{show.role}</span>
										{/if}
									</div>
									<span class="text-lg uppercase text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors" style="font-family: var(--font-display);">
										{show.title}
									</span>
									{#if show.team_name}
										<span class="text-white/40 text-sm font-mono">with {show.team_name}</span>
									{/if}
								</a>
							{/each}
						</div>

						{#if hasMorePastShows}
							<button
								on:click={() => showAllPastShows = true}
								class="mt-4 w-full py-3 px-4 border-2 border-[var(--tw-neon-pink)]/40 text-[var(--tw-neon-pink)] hover:bg-[var(--tw-neon-pink)]/10 hover:border-[var(--tw-neon-pink)] transition-all font-mono uppercase tracking-wider text-sm"
							>
								Show all {pastShows.length} shows
							</button>
						{/if}
					{:else if upcomingShows.length === 0}
						<p class="text-white/40 py-8 font-mono">No tracked shows for this performer yet</p>
					{:else}
						<p class="text-white/40 py-8 font-mono">No past shows tracked yet</p>
					{/if}
				</section>
			</div>
		{/if}
	</div>
</div>
