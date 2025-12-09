<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

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
		date: string;
		time: string | null;
		role: string;
		team_name: string | null;
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
	let shows: Show[] = [];
	let loading = true;
	let error: string | null = null;

	$: slug = $page.params.slug;

	onMount(async () => {
		await loadPerformer();
	});

	async function loadPerformer() {
		loading = true;
		error = null;

		try {
			const res = await fetch(`/api/performers/${slug}`);
			if (!res.ok) {
				error = res.status === 404 ? 'Performer not found' : 'Failed to load performer';
				return;
			}
			const data = await res.json();
			performer = data.performer;
			teams = data.teams;

			const showsRes = await fetch(`/api/performers/${slug}/shows?limit=50`);
			if (showsRes.ok) {
				const showsData = await showsRes.json();
				shows = showsData.shows;
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
		<a href="/performers" class="text-[var(--tw-neon-pink)] hover:text-[var(--tw-electric-cyan)] text-sm mb-6 inline-block font-mono uppercase tracking-wider">
			← Performers
		</a>

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

			<!-- Two-column layout for Teams and Shows -->
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

				<!-- Shows Section -->
				<section>
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-electric-cyan)]"
						    style="font-family: var(--font-display);">
							Recent Shows
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"></div>
					</div>

					{#if shows.length > 0}
						<div class="divide-y divide-white/10">
							{#each shows as show (show.id)}
								<div class="flex flex-col gap-1 py-3 px-3 border-l-4 border-[var(--tw-neon-pink)]/30 hover:bg-white/5 transition-all">
									<div class="flex items-center gap-3">
										<span class="text-[var(--nw-neon-yellow)] font-mono">
											{formatDate(show.date)}
										</span>
										{#if show.role !== 'performer'}
											<span class="text-[var(--tw-electric-cyan)] text-sm font-mono uppercase">{show.role}</span>
										{/if}
									</div>
									<span class="text-lg uppercase text-white" style="font-family: var(--font-display);">
										{show.title}
									</span>
									{#if show.team_name}
										<span class="text-white/40 text-sm font-mono">with {show.team_name}</span>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-white/40 py-8 font-mono">No tracked shows for this performer yet</p>
					{/if}
				</section>
			</div>
		{/if}
	</div>
</div>
