<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { proxyImageUrl } from '$lib/utils/imageProxy';
	import { isHouseShow, getHouseShowTeams, type HouseTeam } from '$lib/utils/houseShowTeams';

	interface Performer {
		performer_id: number;
		performer_name: string;
		performer_slug: string;
		role: string;
		team_name: string | null;
		team_slug: string | null;
	}

	interface Show {
		id: number;
		title: string;
		slug: string;
		date: string;
		time: string | null;
		description: string | null;
		source: string;
		url: string | null;
		image_url: string | null;
		lineup?: Performer[];
	}

	interface SeriesData {
		title: string;
		slug: string;
		shows: Show[];
		count: number;
	}

	interface SeriesInfo {
		slug: string;
		count: number;
	}

	let viewType: 'show' | 'series' | null = null;
	let show: Show | null = null;
	let series: SeriesData | null = null;
	let seriesInfo: SeriesInfo | null = null;
	let loading = true;
	let error: string | null = null;

	$: slug = $page.params.slug;

	// Reload data when slug changes (reactive)
	$: if (slug) {
		loadData();
	}

	async function loadData() {
		loading = true;
		error = null;

		try {
			const res = await fetch(`/api/shows/${slug}`);
			if (!res.ok) {
				error = res.status === 404 ? 'Show not found' : 'Failed to load show';
				return;
			}
			const data = await res.json();

			viewType = data.type;
			if (data.type === 'show') {
				show = data.data;
				seriesInfo = data.series || null;
			} else {
				series = data.data;
				seriesInfo = null;
			}
		} catch (e) {
			error = 'Failed to load show';
		} finally {
			loading = false;
		}
	}

	function formatDate(dateStr: string) {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
	}

	function formatShortDate(dateStr: string) {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
	}

	function formatTime(timeStr: string | null) {
		if (!timeStr) return null;
		const [hours, minutes] = timeStr.split(':');
		return `${hours}:${minutes}`;
	}

	function groupByRole(lineup: Performer[]) {
		const groups: Record<string, Performer[]> = {};
		for (const p of lineup) {
			const role = p.role || 'performer';
			if (!groups[role]) groups[role] = [];
			groups[role].push(p);
		}
		return groups;
	}

	const roleOrder = ['host', 'performer', 'guest', 'coach'];
	const roleLabels: Record<string, string> = {
		host: 'Hosted by',
		performer: 'Performers',
		guest: 'Special Guests',
		coach: 'Coached by'
	};

	$: grouped = show?.lineup ? groupByRole(show.lineup) : {};
	$: houseTeams = show && isHouseShow(show.title) ? getHouseShowTeams(show.date) : [];
</script>

<svelte:head>
	<title>{show?.title || series?.title || 'Show'} | CCB Dashboard</title>
</svelte:head>

<div class="min-h-screen text-white bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black">
	<div class="grain-overlay"></div>

	<div class="relative z-10 max-w-4xl mx-auto px-6 py-8">
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
		{:else if viewType === 'show' && show}
			<!-- Single Show View -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
				<!-- Show Image -->
				{#if show.image_url}
					<div class="md:col-span-1">
						<img
							src={proxyImageUrl(show.image_url)}
							alt={show.title}
							class="w-full rounded-lg shadow-2xl border-2 border-[var(--tw-neon-pink)]/30"
						/>
					</div>
				{/if}

				<!-- Show Info -->
				<div class={show.image_url ? 'md:col-span-2' : 'md:col-span-3'}>
					<header>
						<h1 class="text-4xl md:text-5xl uppercase tracking-wider text-white inline-block px-4 py-2
								   bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--nw-burning-orange)]"
							style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);">
							{show.title}
						</h1>
						<div class="flex flex-wrap gap-6 mt-6 text-lg font-mono">
							<span class="text-[var(--nw-neon-yellow)]">
								{formatDate(show.date)}
							</span>
							{#if show.time}
								<span class="text-[var(--tw-electric-cyan)]">
									{formatTime(show.time)}
								</span>
							{/if}
						</div>
						<div class="flex flex-wrap gap-4 mt-4">
							{#if show.url}
								<a href={show.url} target="_blank" rel="noopener noreferrer"
								   class="text-[var(--tw-electric-cyan)] hover:text-[var(--tw-neon-pink)] font-mono text-sm">
									View on CCB Website →
								</a>
							{/if}
							{#if seriesInfo}
								<a href="/shows/{seriesInfo.slug}"
								   class="text-[var(--nw-burning-orange)] hover:text-[var(--nw-neon-yellow)] font-mono text-sm">
									View all {seriesInfo.count} shows →
								</a>
							{/if}
						</div>
					</header>
				</div>
			</div>

			<!-- House Show Teams -->
			{#if houseTeams.length > 0}
				<section class="mb-10">
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-electric-cyan)]"
							style="font-family: var(--font-display);">
							Tonight's Teams
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"></div>
					</div>

					<div class="grid md:grid-cols-2 gap-6">
						{#each houseTeams as team}
							<div class="p-4 border-l-4 border-[var(--tw-neon-pink)]/60 bg-white/5">
								<a href="/teams/{team.slug}" class="text-2xl text-[var(--tw-neon-pink)] hover:text-[var(--tw-electric-cyan)] transition-colors mb-2 block" style="font-family: var(--font-display);">
									{team.name} →
								</a>
								<p class="text-white/80 text-sm mb-3">
									{team.members.join(', ')}
								</p>
								<p class="text-[var(--tw-electric-cyan)] text-xs font-mono uppercase tracking-wider">
									Coached by {team.coach}
								</p>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Description -->
			{#if show.description}
				<section class="mb-10">
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-electric-cyan)]"
							style="font-family: var(--font-display);">
							About
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"></div>
					</div>
					<div class="text-white/80 max-w-3xl whitespace-pre-line leading-relaxed">
						{show.description}
					</div>
				</section>
			{/if}

			<!-- Lineup -->
			{#if show.lineup && show.lineup.length > 0}
				<section>
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-electric-cyan)]"
						    style="font-family: var(--font-display);">
							Lineup
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"></div>
					</div>

					<div class="space-y-8">
						{#each roleOrder as role}
							{#if grouped[role]?.length}
								<div>
									<h3 class="text-sm font-mono uppercase tracking-wider text-white/50 mb-3">
										{roleLabels[role] || role}
									</h3>
									<div class="divide-y divide-white/10">
										{#each grouped[role] as performer}
											<div class="flex items-center gap-4 py-3 px-3 border-l-4 border-[var(--tw-neon-pink)]/40 hover:bg-white/5 transition-all">
												<a
													href="/performers/{performer.performer_slug}"
													class="text-xl uppercase text-white hover:text-[var(--tw-electric-cyan)] transition-colors"
													style="font-family: var(--font-display);">
													{performer.performer_name}
												</a>
												{#if performer.team_name}
													<a href="/teams/{performer.team_slug}"
													   class="text-sm font-mono text-[var(--nw-burning-orange)] hover:text-[var(--nw-neon-yellow)]">
														{performer.team_name}
													</a>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{/if}
						{/each}
					</div>
				</section>
			{:else if !show.description}
				<div class="text-white/40 py-8 font-mono">
					No additional information available for this show
				</div>
			{/if}

		{:else if viewType === 'series' && series}
			<!-- Series View -->
			<header class="mb-10">
				<h1 class="text-5xl uppercase tracking-wider text-white inline-block px-4 py-2
				           bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--tw-neon-pink)]"
				    style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);">
					{series.title}
				</h1>
				<div class="mt-6 text-lg font-mono">
					<span class="text-[var(--tw-neon-pink)] text-3xl" style="font-family: var(--font-display);">{series.count}</span>
					<span class="text-white/60 ml-2">shows tracked</span>
				</div>
			</header>

			<!-- Shows List -->
			<section>
				<div class="relative mb-6">
					<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-electric-cyan)]"
					    style="font-family: var(--font-display);">
						All Shows
					</h2>
					<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"></div>
				</div>

				<div class="divide-y divide-white/10">
					{#each series.shows as seriesShow}
						<a
							href="/shows/{seriesShow.slug}"
							class="group flex items-center gap-4 py-3 px-3 border-l-4 border-[var(--tw-neon-pink)]/30 hover:bg-white/5 transition-all"
						>
							<span class="text-[var(--nw-neon-yellow)] font-mono min-w-[120px]">
								{formatShortDate(seriesShow.date)}
							</span>
							{#if seriesShow.time}
								<span class="text-[var(--tw-electric-cyan)] font-mono">
									{formatTime(seriesShow.time)}
								</span>
							{/if}
							<span class="ml-auto text-white/40 text-sm font-mono group-hover:text-[var(--tw-electric-cyan)]">
								View →
							</span>
						</a>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>
