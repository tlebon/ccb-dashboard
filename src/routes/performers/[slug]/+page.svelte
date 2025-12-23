<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { proxyImageUrl } from '$lib/utils/imageProxy';
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
		image_url: string | null;
		bio: string | null;
		instagram: string | null;
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

<div
	class="min-h-screen bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black text-white"
>
	<div class="grain-overlay"></div>

	<div class="relative z-10 mx-auto max-w-5xl px-6 py-8">
		<QuickNav />

		{#if loading}
			<div
				class="py-12 text-center text-[var(--tw-electric-cyan)]"
				style="font-family: var(--font-display);"
			>
				Loading...
			</div>
		{:else if error}
			<div class="py-12 text-center">
				<p class="text-2xl text-[var(--tw-neon-pink)]" style="font-family: var(--font-display);">
					{error}
				</p>
			</div>
		{:else if performer}
			<!-- Header with Image -->
			<header class="mb-10">
				<div class="flex flex-col items-start gap-6 md:flex-row md:gap-8">
					<!-- Performer Image -->
					{#if performer.image_url}
						<div class="flex-shrink-0">
							<img
								src={proxyImageUrl(performer.image_url)}
								alt={performer.name}
								class="h-32 w-32 rounded-lg border-2 border-[var(--tw-neon-pink)]/30 object-cover shadow-2xl md:h-40 md:w-40"
							/>
						</div>
					{/if}

					<div class="flex-1">
						<h1
							class="inline-block bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--nw-burning-orange)] px-4 py-2 text-4xl tracking-wider
						           text-white uppercase md:text-6xl"
							style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);"
						>
							{performer.name}
						</h1>
						{#if performer.instagram}
							<a
								href="https://instagram.com/{performer.instagram}"
								target="_blank"
								rel="noopener noreferrer"
								class="mt-4 block font-mono text-lg text-[var(--nw-neon-yellow)] transition-colors hover:text-white"
							>
								@{performer.instagram}
							</a>
						{/if}
					</div>
				</div>

				<!-- Bio -->
				{#if performer.bio}
					<div class="mt-6 max-w-3xl leading-relaxed whitespace-pre-line text-white/80">
						{performer.bio}
					</div>
				{/if}
			</header>

			<!-- Upcoming Shows - Full Width, Most Prominent -->
			{#if upcomingShows.length > 0}
				<section class="mb-10">
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

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						{#each upcomingShows as show (show.id)}
							<a
								href="/shows/{show.slug}"
								class="group border-l-4 border-[var(--nw-neon-yellow)]/60 bg-white/5 p-4 transition-all hover:bg-white/10"
							>
								<div class="mb-2 flex items-center gap-3">
									<span class="font-mono font-bold text-[var(--nw-neon-yellow)]">
										{formatDate(show.date)}
									</span>
									{#if show.role !== 'performer'}
										<span class="font-mono text-sm text-[var(--tw-electric-cyan)] uppercase"
											>{show.role}</span
										>
									{/if}
								</div>
								<span
									class="block text-xl text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)]"
									style="font-family: var(--font-display);"
								>
									{show.title}
								</span>
								{#if show.team_name}
									<span class="mt-1 block font-mono text-sm text-white/50"
										>with {show.team_name}</span
									>
								{/if}
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Two-column layout for Teams and Past Shows -->
			<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
				<!-- Teams Section -->
				{#if teams.length > 0}
					<section>
						<div class="relative mb-6">
							<h2
								class="text-2xl tracking-wider text-[var(--tw-electric-cyan)] uppercase"
								style="font-family: var(--font-display);"
							>
								Teams
							</h2>
							<div
								class="absolute -bottom-2 left-0 h-1 w-16 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"
							></div>
						</div>

						<div class="divide-y divide-white/10">
							{#each teams as team (team.id)}
								<a
									href="/teams/{team.slug}"
									class="group flex items-center gap-3 border-l-4 px-3 py-3 transition-all hover:bg-white/5 {team.is_former
										? 'border-white/20 opacity-50'
										: 'border-[var(--tw-electric-cyan)]/40'}"
								>
									<span
										class="text-xl text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)]"
										style="font-family: var(--font-display);"
									>
										{team.name}
									</span>
									<span class="ml-auto font-mono text-sm tracking-wider uppercase">
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
						<h2
							class="text-2xl tracking-wider text-[var(--tw-electric-cyan)] uppercase"
							style="font-family: var(--font-display);"
						>
							Recent Shows
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-16 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"
						></div>
					</div>

					{#if visiblePastShows.length > 0}
						<div class="divide-y divide-white/10">
							{#each visiblePastShows as show (show.id)}
								<a
									href="/shows/{show.slug}"
									class="group flex flex-col gap-1 border-l-4 border-[var(--tw-neon-pink)]/30 px-3 py-3 transition-all hover:border-[var(--tw-neon-pink)] hover:bg-white/5"
								>
									<div class="flex items-center gap-3">
										<span class="font-mono text-[var(--nw-neon-yellow)]">
											{formatDate(show.date)}
										</span>
										{#if show.role !== 'performer'}
											<span class="font-mono text-sm text-[var(--tw-electric-cyan)] uppercase"
												>{show.role}</span
											>
										{/if}
									</div>
									<span
										class="text-lg text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)]"
										style="font-family: var(--font-display);"
									>
										{show.title}
									</span>
									{#if show.team_name}
										<span class="font-mono text-sm text-white/40">with {show.team_name}</span>
									{/if}
								</a>
							{/each}
						</div>

						{#if hasMorePastShows}
							<button
								on:click={() => (showAllPastShows = true)}
								class="mt-4 w-full border-2 border-[var(--tw-neon-pink)]/40 px-4 py-3 font-mono text-sm tracking-wider text-[var(--tw-neon-pink)] uppercase transition-all hover:border-[var(--tw-neon-pink)] hover:bg-[var(--tw-neon-pink)]/10"
							>
								Show all {pastShows.length} shows
							</button>
						{/if}
					{:else if upcomingShows.length === 0}
						<p class="py-8 font-mono text-white/40">No tracked shows for this performer yet</p>
					{:else}
						<p class="py-8 font-mono text-white/40">No past shows tracked yet</p>
					{/if}
				</section>
			</div>
		{/if}
	</div>
</div>
