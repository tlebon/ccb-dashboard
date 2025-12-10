<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { proxyImageUrl } from '$lib/utils/imageProxy';
	import { isHouseShow, getHouseShowTeams, type HouseTeam } from '$lib/utils/houseShowTeams';
	import { safeLinkifyText } from '$lib/utils/linkify';
	import { parsePerformersFromDescription } from '$lib/utils/parsePerformers';
	import QuickNav from '$lib/components/QuickNav.svelte';

	interface Performer {
		performer_id: number;
		performer_name: string;
		performer_slug: string;
		role: string;
		team_name: string | null;
		team_slug: string | null;
	}

	interface TeamInfo {
		name: string;
		slug: string;
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
		teams?: TeamInfo[];
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

	interface ParsedPerformer {
		id: number;
		name: string;
		slug: string;
	}

	let viewType: 'show' | 'series' | null = null;
	let show: Show | null = null;
	let series: SeriesData | null = null;
	let seriesInfo: SeriesInfo | null = null;
	let loading = true;
	let error: string | null = null;
	let allPerformers: ParsedPerformer[] = [];
	let parsedPerformers: ParsedPerformer[] = [];

	$: slug = $page.params.slug;

	// Reload data when slug changes (reactive)
	$: if (slug) {
		loadData();
	}

	async function loadData() {
		loading = true;
		error = null;
		parsedPerformers = [];

		try {
			// Fetch show data and all performers in parallel
			const [showRes, performersRes] = await Promise.all([
				fetch(`/api/shows/${slug}`),
				allPerformers.length === 0 ? fetch('/api/performers') : Promise.resolve(null)
			]);

			if (!showRes.ok) {
				error = showRes.status === 404 ? 'Show not found' : 'Failed to load show';
				return;
			}
			const data = await showRes.json();

			// Load performers list if not already loaded
			if (performersRes) {
				const performersData = await performersRes.json();
				allPerformers = performersData.performers || [];
			}

			viewType = data.type;
			if (data.type === 'show') {
				show = data.data;
				seriesInfo = data.series || null;

				// Parse performers from description if no lineup exists
				if (show?.description && (!show.lineup || show.lineup.length === 0)) {
					parsedPerformers = parsePerformersFromDescription(show.description, allPerformers);
				}
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

	interface TeamGroup {
		team_name: string | null;
		team_slug: string | null;
		performers: Performer[];
	}

	function groupByTeam(performers: Performer[]): TeamGroup[] {
		const teamMap = new Map<string, TeamGroup>();
		const noTeam: Performer[] = [];

		for (const p of performers) {
			if (p.team_name) {
				const key = p.team_slug || p.team_name;
				if (!teamMap.has(key)) {
					teamMap.set(key, { team_name: p.team_name, team_slug: p.team_slug, performers: [] });
				}
				teamMap.get(key)!.performers.push(p);
			} else {
				noTeam.push(p);
			}
		}

		// Teams first, then individual performers without teams
		const result: TeamGroup[] = [...teamMap.values()];
		if (noTeam.length > 0) {
			result.push({ team_name: null, team_slug: null, performers: noTeam });
		}
		return result;
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

	// Split series shows into upcoming and past
	$: today = new Date().toISOString().split('T')[0];
	// Upcoming: soonest first (ascending)
	$: upcomingSeriesShows = (series?.shows.filter(s => s.date >= today) || []).sort((a, b) => a.date.localeCompare(b.date));
	// Past: most recent first (descending) - already sorted this way from API
	$: pastSeriesShows = series?.shows.filter(s => s.date < today) || [];

	// Pagination for past series shows
	const PAST_PAGE_SIZE = 20;
	let pastShowsVisible = PAST_PAGE_SIZE;
	$: visiblePastShows = pastSeriesShows.slice(0, pastShowsVisible);
	$: hasMorePast = pastShowsVisible < pastSeriesShows.length;

	function loadMorePast() {
		pastShowsVisible += PAST_PAGE_SIZE;
	}
</script>

<svelte:head>
	<title>{show?.title || series?.title || 'Show'} | CCB Dashboard</title>
</svelte:head>

<div class="min-h-screen text-white bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black">
	<div class="grain-overlay"></div>

	<div class="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-8">
		<QuickNav />

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
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-6 md:mb-10">
				<!-- Show Image -->
				{#if show.image_url}
					<div class="md:col-span-1">
						<img
							src={proxyImageUrl(show.image_url)}
							alt={show.title}
							class="w-full max-w-xs mx-auto md:max-w-none rounded-lg shadow-2xl border-2 border-[var(--tw-neon-pink)]/30"
						/>
					</div>
				{/if}

				<!-- Show Info -->
				<div class={show.image_url ? 'md:col-span-2' : 'md:col-span-3'}>
					<header>
						<h1 class="text-2xl sm:text-3xl md:text-5xl uppercase tracking-wider text-white inline-block px-3 md:px-4 py-1.5 md:py-2
								   bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--nw-burning-orange)] break-words"
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

					<div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
						{#each houseTeams as team}
							<div class="p-3 md:p-4 border-l-4 border-[var(--tw-neon-pink)]/60 bg-white/5 min-w-0">
								<a href="/teams/{team.slug}" class="text-xl md:text-2xl text-[var(--tw-neon-pink)] hover:text-[var(--tw-electric-cyan)] transition-colors mb-2 block break-words" style="font-family: var(--font-display);">
									{team.name} →
								</a>
								<p class="text-white/80 text-sm mb-3 break-words">
									{team.members.join(', ')}
								</p>
								<p class="text-[var(--tw-electric-cyan)] text-xs font-mono uppercase tracking-wider break-words">
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
						{@html safeLinkifyText(show.description)}
					</div>
				</section>
			{/if}

			<!-- Parsed Performers (from description) -->
			{#if parsedPerformers.length > 0}
				<section class="mb-10">
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-electric-cyan)]"
							style="font-family: var(--font-display);">
							Cast
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"></div>
					</div>

					<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
						{#each parsedPerformers as performer}
							<a
								href="/performers/{performer.slug}"
								class="group flex flex-col items-center gap-1 md:gap-2 hover:bg-white/5 p-2 md:p-3 rounded transition-colors text-center min-w-0"
							>
								<div class="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[var(--tw-electric-cyan)]/20 flex items-center justify-center text-lg md:text-xl text-[var(--tw-electric-cyan)] font-mono flex-shrink-0">
									{performer.name.charAt(0)}
								</div>
								<span class="text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors text-xs md:text-sm uppercase leading-tight break-words w-full"
								      style="font-family: var(--font-display);">
									{performer.name}
								</span>
							</a>
						{/each}
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
									{#each groupByTeam(grouped[role]) as teamGroup}
										{#if teamGroup.team_name}
											<!-- Team with members -->
											<div class="mb-4 p-4 border-l-4 border-[var(--tw-neon-pink)]/40 bg-white/5">
												<a href="/teams/{teamGroup.team_slug}"
												   class="text-lg uppercase text-[var(--nw-burning-orange)] hover:text-[var(--nw-neon-yellow)] transition-colors mb-3 block"
												   style="font-family: var(--font-display);">
													{teamGroup.team_name}
												</a>
												<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
													{#each teamGroup.performers as performer}
														<a
															href="/performers/{performer.performer_slug}"
															class="group flex flex-col items-center gap-1 md:gap-2 hover:bg-white/5 p-2 md:p-3 rounded transition-colors text-center min-w-0"
														>
															<!-- Placeholder for future performer image -->
															<div class="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[var(--tw-neon-pink)]/20 flex items-center justify-center text-lg md:text-xl text-[var(--tw-neon-pink)] font-mono flex-shrink-0">
																{performer.performer_name.charAt(0)}
															</div>
															<span class="text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors text-xs md:text-sm uppercase leading-tight break-words w-full"
															      style="font-family: var(--font-display);">
																{performer.performer_name}
															</span>
														</a>
													{/each}
												</div>
											</div>
										{:else}
											<!-- Individual performers without team -->
											<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 md:gap-4">
												{#each teamGroup.performers as performer}
													<a
														href="/performers/{performer.performer_slug}"
														class="group flex flex-col items-center gap-1 md:gap-2 hover:bg-white/5 p-2 md:p-3 rounded transition-colors text-center min-w-0"
													>
														<!-- Placeholder for future performer image -->
														<div class="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[var(--tw-electric-cyan)]/20 flex items-center justify-center text-lg md:text-xl text-[var(--tw-electric-cyan)] font-mono flex-shrink-0">
															{performer.performer_name.charAt(0)}
														</div>
														<span class="text-white group-hover:text-[var(--tw-electric-cyan)] transition-colors text-xs md:text-sm uppercase leading-tight break-words w-full"
														      style="font-family: var(--font-display);">
															{performer.performer_name}
														</span>
													</a>
												{/each}
											</div>
										{/if}
									{/each}
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
					<span class="text-white/40 ml-4">({upcomingSeriesShows.length} upcoming · {pastSeriesShows.length} past)</span>
				</div>
			</header>

			<!-- Upcoming Shows -->
			{#if upcomingSeriesShows.length > 0}
				<section class="mb-10">
					<div class="relative mb-6">
						<h2 class="text-2xl uppercase tracking-wider text-[var(--nw-neon-yellow)]"
						    style="font-family: var(--font-display);">
							Upcoming
						</h2>
						<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--nw-neon-yellow)] to-transparent"></div>
					</div>

					<div class="divide-y divide-white/10">
						{#each upcomingSeriesShows as seriesShow}
							<a
								href="/shows/{seriesShow.slug}"
								class="group flex flex-wrap items-center gap-x-4 gap-y-1 py-3 px-3 border-l-4 border-[var(--nw-neon-yellow)]/40 hover:border-[var(--nw-neon-yellow)] hover:bg-white/5 transition-all"
							>
								<span class="text-[var(--nw-neon-yellow)] font-mono min-w-[120px]">
									{formatShortDate(seriesShow.date)}
								</span>
								{#if seriesShow.time}
									<span class="text-[var(--tw-electric-cyan)] font-mono">
										{formatTime(seriesShow.time)}
									</span>
								{/if}
								{#if seriesShow.teams && seriesShow.teams.length > 0}
									<span class="text-[var(--nw-burning-orange)] font-mono text-sm">
										{seriesShow.teams.map(t => t.name).join(' & ')}
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

			<!-- Past Shows -->
			<section>
				<div class="relative mb-6">
					<h2 class="text-2xl uppercase tracking-wider text-[var(--tw-neon-pink)]"
					    style="font-family: var(--font-display);">
						Past Shows
					</h2>
					<div class="absolute -bottom-2 left-0 w-16 h-1 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"></div>
				</div>

				{#if visiblePastShows.length > 0}
					<div class="divide-y divide-white/10">
						{#each visiblePastShows as seriesShow}
							<a
								href="/shows/{seriesShow.slug}"
								class="group flex flex-wrap items-center gap-x-4 gap-y-1 py-2 px-3 border-l-4 border-[var(--tw-neon-pink)]/20 hover:border-[var(--tw-neon-pink)] hover:bg-white/5 transition-all"
							>
								<span class="text-white/50 font-mono min-w-[120px]">
									{formatShortDate(seriesShow.date)}
								</span>
								{#if seriesShow.time}
									<span class="text-white/30 font-mono">
										{formatTime(seriesShow.time)}
									</span>
								{/if}
								{#if seriesShow.teams && seriesShow.teams.length > 0}
									<span class="text-white/40 font-mono text-sm">
										{seriesShow.teams.map(t => t.name).join(' & ')}
									</span>
								{/if}
								<span class="ml-auto text-white/30 text-sm font-mono group-hover:text-[var(--tw-electric-cyan)]">
									View →
								</span>
							</a>
						{/each}
					</div>

					{#if hasMorePast}
						<button
							on:click={loadMorePast}
							class="mt-6 px-6 py-3 bg-[var(--tw-deep-purple)] text-[var(--tw-electric-cyan)] uppercase tracking-wider font-mono hover:bg-[var(--tw-neon-pink)] hover:text-white transition-colors"
						>
							Load More ({pastSeriesShows.length - pastShowsVisible} remaining)
						</button>
					{/if}
				{:else}
					<p class="text-white/40 py-4 font-mono">No past shows yet</p>
				{/if}
			</section>
		{/if}
	</div>
</div>
