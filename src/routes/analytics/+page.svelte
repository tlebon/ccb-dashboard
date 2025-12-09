<script lang="ts">
	import { onMount } from 'svelte';
	import QuickNav from '$lib/components/QuickNav.svelte';

	interface AnalyticsData {
		stats: {
			totalShows: number;
			uniqueShows: number;
			firstDate: string;
			lastDate: string;
			performerCount: number;
			teamCount: number;
			showsWithLineup: number;
			monthsTracked: number;
		};
		topShows: { title: string; slug: string; count: number }[];
		dayDistribution: { day: string; count: number }[];
		monthlyActivity: { month: string; count: number }[];
		topPerformers: { id: number; name: string; slug: string; showCount: number; teams: string[] }[];
		topTeams: { id: number; name: string; slug: string; showCount: number; memberCount: number }[];
		availableYears: string[];
	}

	let data = $state<AnalyticsData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeTab = $state<'shows' | 'performers' | 'timeline'>('shows');
	let selectedYear = $state<string>('all');

	// Pagination for top shows
	const SHOWS_PAGE_SIZE = 15;
	let showsVisible = $state(SHOWS_PAGE_SIZE);

	async function loadData(year: string) {
		loading = true;
		try {
			const url = year === 'all' ? '/api/analytics' : `/api/analytics?year=${year}`;
			const res = await fetch(url);
			if (!res.ok) throw new Error('Failed to load analytics');
			data = await res.json();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load analytics';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		loadData(selectedYear);
	});

	// Reload when year changes
	$effect(() => {
		if (selectedYear) {
			loadData(selectedYear);
		}
	});

	// Computed values
	const maxShowCount = $derived(data?.topShows[0]?.count || 1);
	const maxPerformerCount = $derived(data?.topPerformers[0]?.showCount || 1);
	const maxTeamCount = $derived(data?.topTeams[0]?.showCount || 1);
	const maxDayCount = $derived(Math.max(...(data?.dayDistribution.map(d => d.count) || [1])));
	const maxMonthCount = $derived(Math.max(...(data?.monthlyActivity.map(m => m.count) || [1])));

	// Paginated shows
	const visibleShows = $derived(data?.topShows.slice(0, showsVisible) || []);
	const hasMoreShows = $derived((data?.topShows.length || 0) > showsVisible);

	function loadMoreShows() {
		showsVisible += SHOWS_PAGE_SIZE;
	}

	// Order days correctly
	const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const orderedDays = $derived(data?.dayDistribution.toSorted((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)) || []);
</script>

<svelte:head>
	<title>Analytics | CCB Dashboard</title>
</svelte:head>

<div class="min-h-screen bg-[var(--tw-midnight)] text-[var(--tw-electric-cyan)] p-8">
	<div class="grain-overlay"></div>

	<div class="relative z-10 max-w-7xl mx-auto">
		<QuickNav />

		<!-- Header -->
		<header class="mb-12">
			<h1 class="text-6xl md:text-8xl tracking-tight text-[var(--tw-neon-pink)] neon-glow mb-4"
			    style="font-family: var(--font-display);">
				CCB ANALYTICS
			</h1>
			{#if data}
				<p class="text-lg text-[var(--tw-electric-cyan)] opacity-80" style="font-family: var(--font-mono);">
					{data.stats.totalShows} shows tracked from {data.stats.firstDate} to {data.stats.lastDate}
				</p>
			{/if}
		</header>

		{#if loading}
			<div class="text-center py-20">
				<p class="text-2xl text-[var(--tw-electric-cyan)]" style="font-family: var(--font-display);">Loading analytics...</p>
			</div>
		{:else if error}
			<div class="text-center py-20">
				<p class="text-2xl text-[var(--tw-neon-pink)]" style="font-family: var(--font-display);">{error}</p>
			</div>
		{:else if data}
			<!-- Stats Grid -->
			<div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
				<div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
					<div class="text-5xl text-[var(--tw-neon-pink)]" style="font-family: var(--font-display);">{data.stats.totalShows}</div>
					<div class="text-sm uppercase tracking-wider opacity-70" style="font-family: var(--font-mono);">Total Shows</div>
				</div>
				<div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
					<div class="text-5xl text-[var(--tw-electric-cyan)]" style="font-family: var(--font-display);">{data.stats.uniqueShows}</div>
					<div class="text-sm uppercase tracking-wider opacity-70" style="font-family: var(--font-mono);">Unique Shows</div>
				</div>
				<div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
					<div class="text-5xl text-[var(--nw-burning-orange)]" style="font-family: var(--font-display);">{data.stats.performerCount}</div>
					<div class="text-sm uppercase tracking-wider opacity-70" style="font-family: var(--font-mono);">Performers</div>
				</div>
				<div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
					<div class="text-5xl text-[var(--nw-hot-pink)]" style="font-family: var(--font-display);">{data.stats.teamCount}</div>
					<div class="text-sm uppercase tracking-wider opacity-70" style="font-family: var(--font-mono);">Teams</div>
				</div>
				<div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
					<div class="text-5xl text-[var(--nw-neon-yellow)]" style="font-family: var(--font-display);">{data.stats.monthsTracked}</div>
					<div class="text-sm uppercase tracking-wider opacity-70" style="font-family: var(--font-mono);">Months Tracked</div>
				</div>
			</div>

			<!-- Year Filter & Tab Navigation -->
			<div class="flex flex-wrap items-center gap-4 mb-8">
				<!-- Year Filter -->
				<div class="flex items-center gap-2">
					<span class="text-sm uppercase tracking-wider opacity-70" style="font-family: var(--font-mono);">Year:</span>
					<select
						bind:value={selectedYear}
						class="px-4 py-3 bg-[var(--tw-concrete)] text-[var(--tw-electric-cyan)] text-lg uppercase tracking-wider border-2 border-[var(--tw-electric-cyan)]/30 focus:border-[var(--tw-neon-pink)] outline-none cursor-pointer"
						style="font-family: var(--font-display);"
					>
						<option value="all">All Time</option>
						{#if data?.availableYears}
							{#each data.availableYears as year}
								<option value={year}>{year}</option>
							{/each}
						{/if}
					</select>
				</div>

				<!-- Tab Navigation -->
				<div class="flex gap-2 flex-wrap">
					<button
						class="px-6 py-3 text-xl uppercase tracking-wider transition-all
						       {activeTab === 'shows' ? 'bg-[var(--tw-neon-pink)] text-[var(--tw-midnight)]' : 'bg-[var(--tw-concrete)] text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-deep-purple)]'}"
						style="font-family: var(--font-display);"
						onclick={() => activeTab = 'shows'}>
						Top Shows
					</button>
					<button
						class="px-6 py-3 text-xl uppercase tracking-wider transition-all
						       {activeTab === 'performers' ? 'bg-[var(--tw-neon-pink)] text-[var(--tw-midnight)]' : 'bg-[var(--tw-concrete)] text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-deep-purple)]'}"
						style="font-family: var(--font-display);"
						onclick={() => activeTab = 'performers'}>
						Performers
					</button>
					<button
						class="px-6 py-3 text-xl uppercase tracking-wider transition-all
						       {activeTab === 'timeline' ? 'bg-[var(--tw-neon-pink)] text-[var(--tw-midnight)]' : 'bg-[var(--tw-concrete)] text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-deep-purple)]'}"
						style="font-family: var(--font-display);"
						onclick={() => activeTab = 'timeline'}>
						Timeline
					</button>
				</div>
			</div>

			<!-- Tab Content -->
			{#if activeTab === 'shows'}
				<div class="grid md:grid-cols-2 gap-8">
					<!-- Top Shows Chart -->
					<div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
						<h2 class="text-3xl text-[var(--tw-electric-cyan)] mb-6" style="font-family: var(--font-display);">MOST FREQUENT SHOWS</h2>
						<div class="space-y-3">
							{#each visibleShows as show, i}
								{@const width = (show.count / maxShowCount) * 100}
								<a href="/shows/{show.slug}" class="block group">
									<div class="flex justify-between items-center mb-1">
										<span class="text-sm truncate pr-4 group-hover:text-[var(--tw-neon-pink)] transition-colors" style="font-family: var(--font-mono);">
											{i + 1}. {show.title}
										</span>
										<span class="text-lg text-[var(--tw-neon-pink)]" style="font-family: var(--font-display);">{show.count}</span>
									</div>
									<div class="h-2 bg-[var(--tw-concrete)] overflow-hidden">
										<div
											class="h-full bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--tw-electric-cyan)] transition-all duration-500"
											style="width: {width}%">
										</div>
									</div>
								</a>
							{/each}
						</div>
						{#if hasMoreShows}
							<button
								onclick={loadMoreShows}
								class="mt-6 w-full py-3 bg-[var(--tw-concrete)] text-[var(--tw-electric-cyan)] uppercase tracking-wider font-mono hover:bg-[var(--tw-neon-pink)] hover:text-[var(--tw-midnight)] transition-colors"
							>
								Load More ({(data?.topShows.length || 0) - showsVisible} remaining)
							</button>
						{/if}
					</div>

					<!-- Day Distribution -->
					<div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
						<h2 class="text-3xl text-[var(--tw-electric-cyan)] mb-6" style="font-family: var(--font-display);">SHOWS BY DAY</h2>
						<div class="flex items-end justify-between gap-4" style="height: 256px;">
							{#each orderedDays as { day, count }}
								{@const heightPx = Math.max(20, (count / maxDayCount) * 200)}
								<div class="flex-1 flex flex-col items-center">
									<div class="text-xl text-[var(--tw-electric-cyan)] mb-2" style="font-family: var(--font-display);">
										{count}
									</div>
									<div class="w-full bg-gradient-to-t from-[var(--nw-burning-orange)] to-[var(--nw-hot-pink)]" style="height: {heightPx}px;"></div>
									<span class="text-xs uppercase tracking-wider opacity-70 mt-2" style="font-family: var(--font-mono);">
										{day.slice(0, 3)}
									</span>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			{#if activeTab === 'performers'}
				<div class="grid md:grid-cols-2 gap-8">
					<!-- Top Performers -->
					<div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
						<h2 class="text-3xl text-[var(--tw-electric-cyan)] mb-6" style="font-family: var(--font-display);">TOP PERFORMERS</h2>
						<p class="text-sm opacity-70 mb-6" style="font-family: var(--font-mono);">
							By tracked show appearances ({data.stats.showsWithLineup} shows with lineup data)
						</p>
						<div class="space-y-3 max-h-[600px] overflow-y-auto">
							{#each data.topPerformers as performer, i}
								{@const width = (performer.showCount / maxPerformerCount) * 100}
								<a href="/performers/{performer.slug}" class="block group">
									<div class="flex justify-between items-center mb-1">
										<span class="text-sm truncate pr-4 group-hover:text-[var(--tw-neon-pink)] transition-colors" style="font-family: var(--font-mono);">
											{i + 1}. {performer.name}
										</span>
										<span class="text-lg text-[var(--tw-neon-pink)]" style="font-family: var(--font-display);">{performer.showCount}</span>
									</div>
									<div class="h-2 bg-[var(--tw-concrete)] overflow-hidden">
										<div
											class="h-full bg-gradient-to-r from-[var(--nw-burning-orange)] to-[var(--nw-neon-yellow)] transition-all duration-500"
											style="width: {width}%">
										</div>
									</div>
									{#if performer.teams.length > 0}
										<div class="text-xs opacity-50 mt-1" style="font-family: var(--font-mono);">
											{performer.teams.slice(0, 3).join(', ')}{performer.teams.length > 3 ? ` +${performer.teams.length - 3} more` : ''}
										</div>
									{/if}
								</a>
							{/each}
						</div>
						{#if data.topPerformers.length === 0}
							<p class="text-center opacity-50 py-8" style="font-family: var(--font-mono);">
								No performer data available yet
							</p>
						{/if}
					</div>

					<!-- Top Teams by Shows -->
					<div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
						<h2 class="text-3xl text-[var(--tw-electric-cyan)] mb-6" style="font-family: var(--font-display);">MOST ACTIVE TEAMS</h2>
						<p class="text-sm opacity-70 mb-6" style="font-family: var(--font-mono);">
							Teams with the most tracked shows
						</p>
						<div class="space-y-3 max-h-[600px] overflow-y-auto">
							{#each data.topTeams as team, i}
								{@const width = (team.showCount / maxTeamCount) * 100}
								<a href="/teams/{team.slug}" class="block group">
									<div class="flex justify-between items-center mb-1">
										<span class="text-sm truncate pr-4 group-hover:text-[var(--tw-neon-pink)] transition-colors" style="font-family: var(--font-mono);">
											{i + 1}. {team.name}
										</span>
										<span class="text-lg text-[var(--tw-electric-cyan)]" style="font-family: var(--font-display);">{team.showCount}</span>
									</div>
									<div class="h-2 bg-[var(--tw-concrete)] overflow-hidden">
										<div
											class="h-full bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--tw-neon-pink)] transition-all duration-500"
											style="width: {width}%">
										</div>
									</div>
									<div class="text-xs opacity-50 mt-1" style="font-family: var(--font-mono);">
										{team.memberCount} members
									</div>
								</a>
							{/each}
						</div>
						{#if data.topTeams.length === 0}
							<p class="text-center opacity-50 py-8" style="font-family: var(--font-mono);">
								No team show data available yet
							</p>
						{/if}
					</div>
				</div>
			{/if}

			{#if activeTab === 'timeline'}
				<div class="brutalist-border bg-[var(--tw-deep-purple)] p-6">
					<h2 class="text-3xl text-[var(--tw-electric-cyan)] mb-6" style="font-family: var(--font-display);">MONTHLY ACTIVITY</h2>
					<div class="overflow-x-auto pb-4">
						<div class="flex items-end gap-2 min-w-max" style="height: 280px; padding-bottom: 40px;">
							{#each data.monthlyActivity as { month, count }}
								{@const heightPx = Math.max(20, (count / maxMonthCount) * 200)}
								{@const [year, m] = month.split('-')}
								{@const monthName = new Date(parseInt(year), parseInt(m) - 1).toLocaleString('en', { month: 'short' })}
								<div class="flex flex-col items-center group">
									<div class="text-xs text-[var(--tw-electric-cyan)] mb-1 opacity-0 group-hover:opacity-100 transition-opacity" style="font-family: var(--font-mono);">
										{count}
									</div>
									<div
										class="w-10 bg-gradient-to-t from-[var(--tw-deep-purple)] via-[var(--tw-neon-pink)] to-[var(--tw-electric-cyan)] transition-all hover:opacity-80 cursor-pointer"
										style="height: {heightPx}px;"
										title="{monthName} {year}: {count} shows">
									</div>
									<div class="mt-2 text-xs opacity-50 whitespace-nowrap" style="font-family: var(--font-mono); transform: rotate(-45deg); transform-origin: top left; width: 50px;">
										{monthName} '{year.slice(2)}
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>
			{/if}

			<!-- Footer / Disclaimer -->
			<footer class="mt-12 text-center space-y-2">
				<p class="text-sm opacity-50" style="font-family: var(--font-mono);">
					Data sourced from CCB Calendar and Community Lineups
				</p>
				<p class="text-xs opacity-40" style="font-family: var(--font-mono);">
					Note: This data may contain inaccuracies. Performer appearances are based on scheduled lineups
					and may not reflect actual performances. If you spot an error, let us know!
				</p>
			</footer>
		{/if}
	</div>
</div>
