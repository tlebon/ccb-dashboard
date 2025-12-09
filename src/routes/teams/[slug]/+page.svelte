<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	interface Performer {
		id: number;
		name: string;
		slug: string;
		is_former: boolean;
	}

	interface Show {
		id: number;
		title: string;
		slug: string;
		date: string;
		time: string | null;
	}

	interface Team {
		id: number;
		name: string;
		slug: string;
		type: 'house' | 'indie' | 'other';
		note: string | null;
		members: Performer[];
		coach: Performer | null;
	}

	let team: Team | null = null;
	let shows: Show[] = [];
	let loading = true;
	let error: string | null = null;

	$: slug = $page.params.slug;

	$: if (slug) {
		loadTeam();
	}

	async function loadTeam() {
		loading = true;
		error = null;

		try {
			const res = await fetch(`/api/teams/${slug}`);
			if (!res.ok) {
				error = res.status === 404 ? 'Team not found' : 'Failed to load team';
				return;
			}
			const data = await res.json();
			team = data.team;
			shows = data.shows;
		} catch (e) {
			error = 'Failed to load team';
		} finally {
			loading = false;
		}
	}

	function formatDate(dateStr: string) {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	$: currentMembers = team?.members.filter(m => !m.is_former) || [];
	$: formerMembers = team?.members.filter(m => m.is_former) || [];

	// Separate upcoming and past shows
	$: today = new Date().toISOString().split('T')[0];
	$: upcomingShows = shows.filter(s => s.date >= today);
	$: pastShows = shows.filter(s => s.date < today);

	const typeLabels: Record<string, string> = {
		house: 'House Team',
		indie: 'Indie Team',
		other: 'Team'
	};
</script>

<svelte:head>
	<title>{team?.name || 'Team'} | CCB Dashboard</title>
</svelte:head>

<div class="min-h-screen text-white bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black">
	<div class="grain-overlay"></div>

	<div class="relative z-10 max-w-5xl mx-auto px-6 py-8">
		<button
			on:click={() => history.back()}
			class="text-[var(--tw-neon-pink)] hover:text-[var(--tw-electric-cyan)] text-sm mb-6 inline-block font-mono uppercase tracking-wider cursor-pointer bg-transparent border-none">
			← Back
		</button>

		{#if loading}
			<div class="text-center py-12 text-[var(--tw-electric-cyan)]" style="font-family: var(--font-display);">
				Loading...
			</div>
		{:else if error}
			<div class="text-center py-12">
				<p class="text-[var(--tw-neon-pink)] text-2xl" style="font-family: var(--font-display);">{error}</p>
			</div>
		{:else if team}
			<!-- Header -->
			<header class="mb-10">
				<h1 class="text-6xl uppercase tracking-wider text-white inline-block px-4 py-2
				           bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--nw-burning-orange)]"
				    style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);">
					{team.name}
				</h1>
				<div class="flex gap-8 mt-6 text-lg font-mono">
					<span class="text-[var(--tw-electric-cyan)] uppercase tracking-wider">
						{typeLabels[team.type]}
					</span>
					{#if team.coach}
						<span>
							<span class="text-white/60">Coached by</span>
							<a href="/performers/{team.coach.slug}" class="text-[var(--nw-neon-yellow)] hover:text-[var(--tw-electric-cyan)]">
								{team.coach.name}
							</a>
						</span>
					{/if}
				</div>
				{#if team.note}
					<p class="mt-4 text-white/70 max-w-2xl">{team.note}</p>
				{/if}
			</header>

			<!-- Two-column layout -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-8">
				<!-- Members Section -->
				<section>
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-electric-cyan)]"
						    style="font-family: var(--font-display);">
							Members
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"></div>
					</div>

					{#if currentMembers.length > 0}
						<div class="divide-y divide-white/10 mb-8">
							{#each currentMembers as member (member.id)}
								<a
									href="/performers/{member.slug}"
									class="group flex items-center gap-3 py-3 px-3 border-l-4 border-[var(--tw-electric-cyan)]/40 hover:border-[var(--tw-electric-cyan)] hover:bg-white/5 transition-all"
								>
									<span class="text-xl uppercase text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors"
									      style="font-family: var(--font-display);">
										{member.name}
									</span>
								</a>
							{/each}
						</div>
					{:else}
						<p class="text-white/40 py-4 font-mono">No current members</p>
					{/if}

					{#if formerMembers.length > 0}
						<div class="relative mb-4">
							<h3 class="text-lg uppercase tracking-wider text-white/50"
							    style="font-family: var(--font-display);">
								Former Members
							</h3>
						</div>
						<div class="divide-y divide-white/10">
							{#each formerMembers as member (member.id)}
								<a
									href="/performers/{member.slug}"
									class="group flex items-center gap-3 py-2 px-3 border-l-4 border-white/20 hover:bg-white/5 transition-all opacity-60"
								>
									<span class="text-lg uppercase text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors"
									      style="font-family: var(--font-display);">
										{member.name}
									</span>
								</a>
							{/each}
						</div>
					{/if}
				</section>

				<!-- Shows Section -->
				<section>
					<!-- Upcoming Shows -->
					{#if upcomingShows.length > 0}
						<div class="relative mb-6">
							<h2 class="text-2xl uppercase tracking-wider text-[var(--nw-neon-yellow)]"
							    style="font-family: var(--font-display);">
								Upcoming Shows
							</h2>
							<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--nw-neon-yellow)] to-transparent"></div>
						</div>

						<div class="divide-y divide-white/10 mb-10">
							{#each upcomingShows as show (show.id)}
								<a
									href="/shows/{show.slug}"
									class="group flex flex-col gap-1 py-3 px-3 border-l-4 border-[var(--nw-neon-yellow)]/40 hover:border-[var(--nw-neon-yellow)] hover:bg-white/5 transition-all"
								>
									<span class="text-[var(--nw-neon-yellow)] font-mono">
										{formatDate(show.date)}
									</span>
									<span class="text-lg uppercase text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors" style="font-family: var(--font-display);">
										{show.title}
									</span>
								</a>
							{/each}
						</div>
					{/if}

					<!-- Past Shows -->
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-neon-pink)]"
						    style="font-family: var(--font-display);">
							Recent Shows
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"></div>
					</div>

					{#if pastShows.length > 0}
						<div class="divide-y divide-white/10">
							{#each pastShows as show (show.id)}
								<a
									href="/shows/{show.slug}"
									class="group flex flex-col gap-1 py-3 px-3 border-l-4 border-[var(--tw-neon-pink)]/30 hover:border-[var(--tw-neon-pink)] hover:bg-white/5 transition-all"
								>
									<span class="text-[var(--nw-neon-yellow)] font-mono">
										{formatDate(show.date)}
									</span>
									<span class="text-lg uppercase text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors" style="font-family: var(--font-display);">
										{show.title}
									</span>
								</a>
							{/each}
						</div>
					{:else if upcomingShows.length === 0}
						<p class="text-white/40 py-8 font-mono">No tracked shows for this team yet</p>
					{:else}
						<p class="text-white/40 py-8 font-mono">No past shows tracked yet</p>
					{/if}
				</section>
			</div>
		{/if}
	</div>
</div>
