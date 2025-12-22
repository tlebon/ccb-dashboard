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
		performer_image_url: string | null;
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
		image_url?: string | null;
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
		return date.toLocaleDateString('en-GB', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
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
	$: upcomingSeriesShows = (series?.shows.filter((s) => s.date >= today) || []).sort((a, b) =>
		a.date.localeCompare(b.date)
	);
	// Past: most recent first (descending) - already sorted this way from API
	$: pastSeriesShows = series?.shows.filter((s) => s.date < today) || [];

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

<div
	class="min-h-screen bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black text-white"
>
	<div class="grain-overlay"></div>

	<div class="relative z-10 mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-8">
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
		{:else if viewType === 'show' && show}
			<!-- Single Show View -->
			<div class="mb-6 grid grid-cols-1 gap-4 md:mb-10 md:grid-cols-3 md:gap-8">
				<!-- Show Image -->
				{#if show.image_url}
					<div class="md:col-span-1">
						<img
							src={proxyImageUrl(show.image_url)}
							alt={show.title}
							class="mx-auto w-full max-w-xs rounded-lg border-2 border-[var(--tw-neon-pink)]/30 shadow-2xl md:max-w-none"
						/>
					</div>
				{/if}

				<!-- Show Info -->
				<div class={show.image_url ? 'md:col-span-2' : 'md:col-span-3'}>
					<header>
						<h1
							class="inline-block bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--nw-burning-orange)] px-3 py-1.5 text-2xl tracking-wider break-words text-white uppercase
								   sm:text-3xl md:px-4 md:py-2 md:text-5xl"
							style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);"
						>
							{show.title}
						</h1>
						<div class="mt-6 flex flex-wrap gap-6 font-mono text-lg">
							<span class="text-[var(--nw-neon-yellow)]">
								{formatDate(show.date)}
							</span>
							{#if show.time}
								<span class="text-[var(--tw-electric-cyan)]">
									{formatTime(show.time)}
								</span>
							{/if}
						</div>
						<div class="mt-4 flex flex-wrap gap-4">
							{#if show.url}
								<a
									href={show.url}
									target="_blank"
									rel="noopener noreferrer"
									class="font-mono text-sm text-[var(--tw-electric-cyan)] hover:text-[var(--tw-neon-pink)]"
								>
									View on CCB Website →
								</a>
							{/if}
							{#if seriesInfo}
								<a
									href="/shows/{seriesInfo.slug}"
									class="font-mono text-sm text-[var(--nw-burning-orange)] hover:text-[var(--nw-neon-yellow)]"
								>
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
						<h2
							class="text-2xl tracking-wider text-[var(--tw-electric-cyan)] uppercase"
							style="font-family: var(--font-display);"
						>
							Tonight's Teams
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-16 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"
						></div>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
						{#each houseTeams as team}
							<div class="min-w-0 border-l-4 border-[var(--tw-neon-pink)]/60 bg-white/5 p-3 md:p-4">
								<a
									href="/teams/{team.slug}"
									class="mb-2 block text-xl break-words text-[var(--tw-neon-pink)] transition-colors hover:text-[var(--tw-electric-cyan)] md:text-2xl"
									style="font-family: var(--font-display);"
								>
									{team.name} →
								</a>
								<p class="mb-3 text-sm break-words text-white/80">
									{team.members.join(', ')}
								</p>
								<p
									class="font-mono text-xs tracking-wider break-words text-[var(--tw-electric-cyan)] uppercase"
								>
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
						<h2
							class="text-2xl tracking-wider text-[var(--tw-electric-cyan)] uppercase"
							style="font-family: var(--font-display);"
						>
							About
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-16 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"
						></div>
					</div>
					<div class="max-w-3xl leading-relaxed whitespace-pre-line text-white/80">
						{@html safeLinkifyText(show.description)}
					</div>
				</section>
			{/if}

			<!-- Parsed Performers (from description) -->
			{#if parsedPerformers.length > 0}
				<section class="mb-10">
					<div class="relative mb-6">
						<h2
							class="text-2xl tracking-wider text-[var(--tw-electric-cyan)] uppercase"
							style="font-family: var(--font-display);"
						>
							Cast
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-16 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"
						></div>
					</div>

					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5">
						{#each parsedPerformers as performer}
							<a
								href="/performers/{performer.slug}"
								class="group flex min-w-0 flex-col items-center gap-1 rounded p-2 text-center transition-colors hover:bg-white/5 md:gap-2 md:p-3"
							>
								{#if performer.image_url}
									<img
										src={proxyImageUrl(performer.image_url)}
										alt={performer.name}
										class="h-12 w-12 flex-shrink-0 rounded-full border-2 border-[var(--tw-electric-cyan)]/30 object-cover md:h-16 md:w-16"
									/>
								{:else}
									<div
										class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tw-electric-cyan)]/20 font-mono text-lg text-[var(--tw-electric-cyan)] md:h-16 md:w-16 md:text-xl"
									>
										{performer.name.charAt(0)}
									</div>
								{/if}
								<span
									class="w-full text-xs leading-tight break-words text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)] md:text-sm"
									style="font-family: var(--font-display);"
								>
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
						<h2
							class="text-2xl tracking-wider text-[var(--tw-electric-cyan)] uppercase"
							style="font-family: var(--font-display);"
						>
							Lineup
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-16 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"
						></div>
					</div>

					<div class="space-y-8">
						{#each roleOrder as role}
							{#if grouped[role]?.length}
								<div>
									<h3 class="mb-3 font-mono text-sm tracking-wider text-white/50 uppercase">
										{roleLabels[role] || role}
									</h3>
									{#each groupByTeam(grouped[role]) as teamGroup}
										{#if teamGroup.team_name}
											<!-- Team with members -->
											<div class="mb-4 border-l-4 border-[var(--tw-neon-pink)]/40 bg-white/5 p-4">
												<a
													href="/teams/{teamGroup.team_slug}"
													class="mb-3 block text-lg text-[var(--nw-burning-orange)] uppercase transition-colors hover:text-[var(--nw-neon-yellow)]"
													style="font-family: var(--font-display);"
												>
													{teamGroup.team_name}
												</a>
												<div
													class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5"
												>
													{#each teamGroup.performers as performer}
														<a
															href="/performers/{performer.performer_slug}"
															class="group flex min-w-0 flex-col items-center gap-1 rounded p-2 text-center transition-colors hover:bg-white/5 md:gap-2 md:p-3"
														>
															{#if performer.performer_image_url}
																<img
																	src={proxyImageUrl(performer.performer_image_url)}
																	alt={performer.performer_name}
																	class="h-12 w-12 flex-shrink-0 rounded-full border-2 border-[var(--tw-neon-pink)]/30 object-cover md:h-16 md:w-16"
																/>
															{:else}
																<div
																	class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tw-neon-pink)]/20 font-mono text-lg text-[var(--tw-neon-pink)] md:h-16 md:w-16 md:text-xl"
																>
																	{performer.performer_name.charAt(0)}
																</div>
															{/if}
															<span
																class="w-full text-xs leading-tight break-words text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)] md:text-sm"
																style="font-family: var(--font-display);"
															>
																{performer.performer_name}
															</span>
														</a>
													{/each}
												</div>
											</div>
										{:else}
											<!-- Individual performers without team -->
											<div
												class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5"
											>
												{#each teamGroup.performers as performer}
													<a
														href="/performers/{performer.performer_slug}"
														class="group flex min-w-0 flex-col items-center gap-1 rounded p-2 text-center transition-colors hover:bg-white/5 md:gap-2 md:p-3"
													>
														{#if performer.performer_image_url}
															<img
																src={proxyImageUrl(performer.performer_image_url)}
																alt={performer.performer_name}
																class="h-12 w-12 flex-shrink-0 rounded-full border-2 border-[var(--tw-electric-cyan)]/30 object-cover md:h-16 md:w-16"
															/>
														{:else}
															<div
																class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--tw-electric-cyan)]/20 font-mono text-lg text-[var(--tw-electric-cyan)] md:h-16 md:w-16 md:text-xl"
															>
																{performer.performer_name.charAt(0)}
															</div>
														{/if}
														<span
															class="w-full text-xs leading-tight break-words text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)] md:text-sm"
															style="font-family: var(--font-display);"
														>
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
				<div class="py-8 font-mono text-white/40">
					No additional information available for this show
				</div>
			{/if}
		{:else if viewType === 'series' && series}
			<!-- Series View -->
			<header class="mb-10">
				<h1
					class="inline-block bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--tw-neon-pink)] px-4 py-2 text-5xl
				           tracking-wider text-white uppercase"
					style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);"
				>
					{series.title}
				</h1>
				<div class="mt-6 font-mono text-lg">
					<span
						class="text-3xl text-[var(--tw-neon-pink)]"
						style="font-family: var(--font-display);">{series.count}</span
					>
					<span class="ml-2 text-white/60">shows tracked</span>
					<span class="ml-4 text-white/40"
						>({upcomingSeriesShows.length} upcoming · {pastSeriesShows.length} past)</span
					>
				</div>
			</header>

			<!-- Upcoming Shows -->
			{#if upcomingSeriesShows.length > 0}
				<section class="mb-10">
					<div class="relative mb-6">
						<h2
							class="text-2xl tracking-wider text-[var(--nw-neon-yellow)] uppercase"
							style="font-family: var(--font-display);"
						>
							Upcoming
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-16 bg-gradient-to-r from-[var(--nw-neon-yellow)] to-transparent"
						></div>
					</div>

					<div class="divide-y divide-white/10">
						{#each upcomingSeriesShows as seriesShow}
							<a
								href="/shows/{seriesShow.slug}"
								class="group flex flex-wrap items-center gap-x-4 gap-y-1 border-l-4 border-[var(--nw-neon-yellow)]/40 px-3 py-3 transition-all hover:border-[var(--nw-neon-yellow)] hover:bg-white/5"
							>
								<span class="min-w-[120px] font-mono text-[var(--nw-neon-yellow)]">
									{formatShortDate(seriesShow.date)}
								</span>
								{#if seriesShow.time}
									<span class="font-mono text-[var(--tw-electric-cyan)]">
										{formatTime(seriesShow.time)}
									</span>
								{/if}
								{#if seriesShow.teams && seriesShow.teams.length > 0}
									<span class="font-mono text-sm text-[var(--nw-burning-orange)]">
										{seriesShow.teams.map((t) => t.name).join(' & ')}
									</span>
								{/if}
								<span
									class="ml-auto font-mono text-sm text-white/40 group-hover:text-[var(--tw-electric-cyan)]"
								>
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

				{#if visiblePastShows.length > 0}
					<div class="divide-y divide-white/10">
						{#each visiblePastShows as seriesShow}
							<a
								href="/shows/{seriesShow.slug}"
								class="group flex flex-wrap items-center gap-x-4 gap-y-1 border-l-4 border-[var(--tw-neon-pink)]/20 px-3 py-2 transition-all hover:border-[var(--tw-neon-pink)] hover:bg-white/5"
							>
								<span class="min-w-[120px] font-mono text-white/50">
									{formatShortDate(seriesShow.date)}
								</span>
								{#if seriesShow.time}
									<span class="font-mono text-white/30">
										{formatTime(seriesShow.time)}
									</span>
								{/if}
								{#if seriesShow.teams && seriesShow.teams.length > 0}
									<span class="font-mono text-sm text-white/40">
										{seriesShow.teams.map((t) => t.name).join(' & ')}
									</span>
								{/if}
								<span
									class="ml-auto font-mono text-sm text-white/30 group-hover:text-[var(--tw-electric-cyan)]"
								>
									View →
								</span>
							</a>
						{/each}
					</div>

					{#if hasMorePast}
						<button
							on:click={loadMorePast}
							class="mt-6 bg-[var(--tw-deep-purple)] px-6 py-3 font-mono tracking-wider text-[var(--tw-electric-cyan)] uppercase transition-colors hover:bg-[var(--tw-neon-pink)] hover:text-white"
						>
							Load More ({pastSeriesShows.length - pastShowsVisible} remaining)
						</button>
					{/if}
				{:else}
					<p class="py-4 font-mono text-white/40">No past shows yet</p>
				{/if}
			</section>
		{/if}
	</div>
</div>
