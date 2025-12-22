<script lang="ts">
	import { onMount } from 'svelte';
	import QuickNav from '$lib/components/QuickNav.svelte';
	import AnalyticsCard from '$lib/components/analytics/AnalyticsCard.svelte';
	import AnalyticsBarChart from '$lib/components/analytics/AnalyticsBarChart.svelte';
	import AnalyticsModal from '$lib/components/analytics/AnalyticsModal.svelte';

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
		showVarietyPerMonth: { month: string; count: number; shows: string[] }[];
		longestRunningShows: {
			title: string;
			slug: string;
			firstDate: string;
			lastDate: string;
			iterations: number;
		}[];
		multiTeamPerformers: {
			id: number;
			name: string;
			slug: string;
			teams: string[];
			teamCount: number;
		}[];
		teamPairings: {
			team1: { id: number; name: string; slug: string };
			team2: { id: number; name: string; slug: string };
			sharedMembers: number;
			performers: string[];
		}[];
		rookies: { id: number; name: string; slug: string; debutDate: string; showCount: number }[];
		topPerformers: { id: number; name: string; slug: string; showCount: number; teams: string[] }[];
		topTeams: { id: number; name: string; slug: string; showCount: number; memberCount: number }[];
		availableYears: string[];
	}

	let data = $state<AnalyticsData | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedYear = $state<string>('all');

	// Modal state
	type ModalType =
		| 'shows'
		| 'performers'
		| 'teams'
		| 'dayDistribution'
		| 'monthlyActivity'
		| 'showVariety'
		| 'longestRunning'
		| 'teamOverlap'
		| 'multiTeam'
		| null;
	let modalOpen = $state<ModalType>(null);

	const LIST_LIMIT = 10;

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
	const maxDayCount = $derived(Math.max(...(data?.dayDistribution.map((d) => d.count) || [1])));
	const maxMonthCount = $derived(Math.max(...(data?.monthlyActivity.map((m) => m.count) || [1])));
	const maxVarietyCount = $derived(
		Math.max(...(data?.showVarietyPerMonth.map((m) => m.count) || [1]))
	);
	const maxIterations = $derived(data?.longestRunningShows[0]?.iterations || 1);
	const maxSharedMembers = $derived(data?.teamPairings[0]?.sharedMembers || 1);
	const maxMultiTeamCount = $derived(data?.multiTeamPerformers[0]?.teamCount || 1);

	// Order days correctly
	const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const orderedDays = $derived(
		data?.dayDistribution.toSorted((a, b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)) ||
			[]
	);

	// Modal title mapping
	const modalTitles: Record<Exclude<ModalType, null>, string> = {
		shows: 'TOP SHOWS',
		performers: 'TOP PERFORMERS',
		teams: 'TOP TEAMS',
		longestRunning: 'LONGEST RUNNING',
		multiTeam: 'MULTI-TEAM PERFORMERS',
		teamOverlap: 'TEAM OVERLAP',
		dayDistribution: 'SHOWS BY DAY',
		monthlyActivity: 'SHOWS PER MONTH',
		showVariety: 'SHOW VARIETY'
	};
</script>

<svelte:head>
	<title>Analytics | CCB Dashboard</title>
</svelte:head>

<div
	class="min-h-screen bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black text-white"
>
	<div class="grain-overlay"></div>

	<!-- Header section -->
	<div class="relative z-10 mx-auto max-w-5xl px-4 pt-4 md:px-6 md:pt-8">
		<QuickNav />

		<header class="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
			<div>
				<h1
					class="inline-block bg-gradient-to-r from-[var(--tw-neon-pink)] to-[var(--nw-burning-orange)] px-3 py-1.5 text-4xl tracking-wider text-white uppercase
				           md:px-4 md:py-2 md:text-5xl"
					style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);"
				>
					Analytics
				</h1>
				{#if data}
					<p class="mt-2 font-mono text-sm text-white/60">
						{data.stats.firstDate} — {data.stats.lastDate}
					</p>
				{/if}
			</div>

			{#if data}
				<select
					bind:value={selectedYear}
					class="cursor-pointer border-2 border-[var(--nw-burning-orange)]/30 bg-[var(--tw-concrete)] px-4 py-2 text-lg tracking-wider text-[var(--nw-burning-orange)] uppercase outline-none focus:border-[var(--nw-hot-pink)]"
					style="font-family: var(--font-display);"
				>
					<option value="all">All Time</option>
					{#each data.availableYears as year}
						<option value={year}>{year}</option>
					{/each}
				</select>
			{/if}
		</header>
	</div>

	<!-- Dashboard content -->
	<div class="relative z-10 mx-auto max-w-7xl px-4 pb-4 md:px-6 md:pb-8">
		{#if loading}
			<div class="py-20 text-center">
				<p
					class="text-2xl text-[var(--nw-burning-orange)]"
					style="font-family: var(--font-display);"
				>
					Loading analytics...
				</p>
			</div>
		{:else if error}
			<div class="py-20 text-center">
				<p class="text-2xl text-[var(--tw-neon-pink)]" style="font-family: var(--font-display);">
					{error}
				</p>
			</div>
		{:else if data}
			<!-- Stats Row -->
			<div class="mb-6 grid grid-cols-3 gap-2 md:grid-cols-5 md:gap-4">
				<div class="brutalist-border bg-[var(--tw-deep-purple)] p-3 md:p-4">
					<div
						class="text-2xl text-[var(--nw-hot-pink)] md:text-4xl"
						style="font-family: var(--font-display);"
					>
						{data.stats.totalShows}
					</div>
					<div
						class="text-xs tracking-wider uppercase opacity-70"
						style="font-family: var(--font-mono);"
					>
						Shows
					</div>
				</div>
				<div class="brutalist-border bg-[var(--tw-deep-purple)] p-3 md:p-4">
					<div
						class="text-2xl text-[var(--nw-burning-orange)] md:text-4xl"
						style="font-family: var(--font-display);"
					>
						{data.stats.uniqueShows}
					</div>
					<div
						class="text-xs tracking-wider uppercase opacity-70"
						style="font-family: var(--font-mono);"
					>
						Unique
					</div>
				</div>
				<div class="brutalist-border bg-[var(--tw-deep-purple)] p-3 md:p-4">
					<div
						class="text-2xl text-[var(--nw-neon-yellow)] md:text-4xl"
						style="font-family: var(--font-display);"
					>
						{data.stats.performerCount}
					</div>
					<div
						class="text-xs tracking-wider uppercase opacity-70"
						style="font-family: var(--font-mono);"
					>
						Performers
					</div>
				</div>
				<div class="brutalist-border hidden bg-[var(--tw-deep-purple)] p-3 md:block md:p-4">
					<div
						class="text-2xl text-[var(--nw-hot-pink)] md:text-4xl"
						style="font-family: var(--font-display);"
					>
						{data.stats.teamCount}
					</div>
					<div
						class="text-xs tracking-wider uppercase opacity-70"
						style="font-family: var(--font-mono);"
					>
						Teams
					</div>
				</div>
				<div class="brutalist-border hidden bg-[var(--tw-deep-purple)] p-3 md:block md:p-4">
					<div
						class="text-2xl text-[var(--nw-burning-orange)] md:text-4xl"
						style="font-family: var(--font-display);"
					>
						{data.stats.showsWithLineup}
					</div>
					<div
						class="text-xs tracking-wider uppercase opacity-70"
						style="font-family: var(--font-mono);"
					>
						With Lineup
					</div>
				</div>
			</div>

			<!-- Main Dashboard Grid -->
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
				<!-- Top Shows -->
				<AnalyticsCard
					title="TOP SHOWS"
					items={data.topShows}
					maxValue={maxShowCount}
					listLimit={LIST_LIMIT}
					valueKey="count"
					linkPrefix="/shows/"
					onViewAll={() => (modalOpen = 'shows')}
				/>

				<!-- Top Performers -->
				<AnalyticsCard
					title="TOP PERFORMERS"
					items={data.topPerformers}
					maxValue={maxPerformerCount}
					listLimit={LIST_LIMIT}
					valueKey="showCount"
					gradient="from-[var(--nw-burning-orange)] to-[var(--nw-neon-yellow)]"
					linkPrefix="/performers/"
					onViewAll={() => (modalOpen = 'performers')}
				/>

				<!-- Top Teams -->
				<AnalyticsCard
					title="TOP TEAMS"
					items={data.topTeams}
					maxValue={maxTeamCount}
					listLimit={LIST_LIMIT}
					valueKey="showCount"
					linkPrefix="/teams/"
					onViewAll={() => (modalOpen = 'teams')}
					renderValue={(item) => String(item.showCount)}
				/>

				<!-- Longest Running Shows -->
				<AnalyticsCard
					title="LONGEST RUNNING"
					items={data.longestRunningShows}
					maxValue={maxIterations}
					listLimit={LIST_LIMIT}
					valueKey="iterations"
					gradient="from-[var(--tw-electric-cyan)] to-[var(--nw-neon-yellow)]"
					linkPrefix="/shows/"
					onViewAll={() => (modalOpen = 'longestRunning')}
					renderValue={(item) => `#${item.iterations}`}
				/>

				<!-- Multi-Team Performers -->
				<AnalyticsCard
					title="MULTI-TEAM"
					items={data.multiTeamPerformers}
					maxValue={maxMultiTeamCount}
					listLimit={LIST_LIMIT}
					valueKey="teamCount"
					gradient="from-[var(--nw-neon-yellow)] to-[var(--nw-burning-orange)]"
					linkPrefix="/performers/"
					onViewAll={() => (modalOpen = 'multiTeam')}
				/>

				<!-- Team Overlap -->
				<AnalyticsCard
					title="TEAM OVERLAP"
					items={data.teamPairings}
					maxValue={maxSharedMembers}
					listLimit={LIST_LIMIT}
					valueKey="sharedMembers"
					gradient="from-[var(--tw-electric-cyan)] to-[var(--nw-hot-pink)]"
					isTeamOverlap={true}
					onViewAll={() => (modalOpen = 'teamOverlap')}
				/>

				<!-- Monthly Activity -->
				<div class="lg:col-span-2">
					<AnalyticsBarChart
						title="SHOWS PER MONTH"
						data={data.monthlyActivity}
						maxValue={maxMonthCount}
						height={160}
						gradient="from-[var(--tw-deep-purple)] via-[var(--nw-hot-pink)] to-[var(--nw-burning-orange)]"
						isMonthly={true}
						onViewAll={() => (modalOpen = 'monthlyActivity')}
					/>
				</div>

				<!-- Rookies -->
				<div class="brutalist-border bg-[var(--tw-deep-purple)] p-4 md:p-5">
					<h2
						class="mb-4 text-xl text-[var(--nw-burning-orange)] md:text-2xl"
						style="font-family: var(--font-display);"
					>
						ROOKIES
					</h2>
					<div class="space-y-2">
						{#each data.rookies.slice(0, 5) as rookie}
							<a href="/performers/{rookie.slug}" class="group flex items-center justify-between">
								<span
									class="truncate pr-2 text-xs transition-colors group-hover:text-[var(--nw-hot-pink)]"
									style="font-family: var(--font-mono);"
								>
									{rookie.name}
								</span>
								<span
									class="flex-shrink-0 text-xs text-white/50"
									style="font-family: var(--font-mono);"
								>
									{new Date(rookie.debutDate).toLocaleDateString('en', {
										month: 'short',
										day: 'numeric'
									})}
								</span>
							</a>
						{/each}
					</div>
					{#if data.rookies.length === 0}
						<p class="text-xs text-white/50" style="font-family: var(--font-mono);">
							No new performers in last 3 months
						</p>
					{/if}
				</div>

				<!-- Shows by Day -->
				<AnalyticsBarChart
					title="BY DAY"
					data={orderedDays}
					maxValue={maxDayCount}
					height={140}
					gradient="from-[var(--nw-burning-orange)] to-[var(--nw-hot-pink)]"
					isDayOfWeek={true}
					onViewAll={() => (modalOpen = 'dayDistribution')}
				/>

				<!-- Show Variety Per Month -->
				<div class="lg:col-span-2">
					<AnalyticsBarChart
						title="SHOW VARIETY"
						subtitle="Unique shows per month"
						data={data.showVarietyPerMonth}
						maxValue={maxVarietyCount}
						height={140}
						gradient="from-[var(--nw-hot-pink)] via-[var(--nw-burning-orange)] to-[var(--nw-neon-yellow)]"
						isMonthly={true}
						onViewAll={() => (modalOpen = 'showVariety')}
					/>
				</div>
			</div>

			<!-- Footer -->
			<footer class="mt-8 space-y-1 text-center">
				<p class="text-xs opacity-40" style="font-family: var(--font-mono);">
					Data sourced from CCB Calendar · Performer data from {data.stats.showsWithLineup} shows with
					lineup info
				</p>
			</footer>
		{/if}
	</div>
</div>

<!-- Modals -->
{#if modalOpen && data}
	<AnalyticsModal title={modalTitles[modalOpen]} open={true} onClose={() => (modalOpen = null)}>
		{#if modalOpen === 'shows'}
			<div class="space-y-2">
				{#each data.topShows as show, i}
					{@const width = (show.count / maxShowCount) * 100}
					<a href="/shows/{show.slug}" class="group block">
						<div class="mb-0.5 flex items-center justify-between">
							<span
								class="truncate pr-2 text-sm text-white transition-colors group-hover:text-[var(--nw-hot-pink)]"
								style="font-family: var(--font-mono);"
							>
								{i + 1}. {show.title}
							</span>
							<span
								class="flex-shrink-0 text-sm text-[var(--nw-hot-pink)]"
								style="font-family: var(--font-display);">{show.count}</span
							>
						</div>
						<div class="h-1.5 overflow-hidden bg-[var(--tw-concrete)]">
							<div
								class="h-full bg-gradient-to-r from-[var(--nw-hot-pink)] to-[var(--nw-burning-orange)]"
								style="width: {width}%"
							></div>
						</div>
					</a>
				{/each}
			</div>
		{:else if modalOpen === 'performers'}
			<div class="space-y-2">
				{#each data.topPerformers as performer, i}
					{@const width = (performer.showCount / maxPerformerCount) * 100}
					<a href="/performers/{performer.slug}" class="group block">
						<div class="mb-0.5 flex items-center justify-between">
							<span
								class="truncate pr-2 text-sm text-white transition-colors group-hover:text-[var(--nw-hot-pink)]"
								style="font-family: var(--font-mono);"
							>
								{i + 1}. {performer.name}
							</span>
							<span
								class="flex-shrink-0 text-sm text-[var(--nw-hot-pink)]"
								style="font-family: var(--font-display);">{performer.showCount}</span
							>
						</div>
						<div class="h-1.5 overflow-hidden bg-[var(--tw-concrete)]">
							<div
								class="h-full bg-gradient-to-r from-[var(--nw-burning-orange)] to-[var(--nw-neon-yellow)]"
								style="width: {width}%"
							></div>
						</div>
					</a>
				{/each}
			</div>
		{:else if modalOpen === 'teams'}
			<div class="space-y-2">
				{#each data.topTeams as team, i}
					{@const width = (team.showCount / maxTeamCount) * 100}
					<a href="/teams/{team.slug}" class="group block">
						<div class="mb-0.5 flex items-center justify-between">
							<span
								class="truncate pr-2 text-sm text-white transition-colors group-hover:text-[var(--nw-hot-pink)]"
								style="font-family: var(--font-mono);"
							>
								{i + 1}. {team.name}
							</span>
							<span
								class="flex-shrink-0 text-sm text-[var(--nw-neon-yellow)]"
								style="font-family: var(--font-display);">{team.showCount}</span
							>
						</div>
						<div class="h-1.5 overflow-hidden bg-[var(--tw-concrete)]">
							<div
								class="h-full bg-gradient-to-r from-[var(--nw-hot-pink)] to-[var(--nw-burning-orange)]"
								style="width: {width}%"
							></div>
						</div>
					</a>
				{/each}
			</div>
		{:else if modalOpen === 'longestRunning'}
			<div class="space-y-3">
				{#each data.longestRunningShows as show, i}
					{@const width = (show.iterations / maxIterations) * 100}
					<a href="/shows/{show.slug}" class="group block">
						<div class="mb-0.5 flex items-center justify-between">
							<span
								class="truncate pr-2 text-sm text-white transition-colors group-hover:text-[var(--nw-hot-pink)]"
								style="font-family: var(--font-mono);"
							>
								{i + 1}. {show.title}
							</span>
							<span
								class="flex-shrink-0 text-sm text-[var(--tw-electric-cyan)]"
								style="font-family: var(--font-display);">#{show.iterations}</span
							>
						</div>
						<div class="h-1.5 overflow-hidden bg-[var(--tw-concrete)]">
							<div
								class="h-full bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--nw-neon-yellow)]"
								style="width: {width}%"
							></div>
						</div>
					</a>
				{/each}
			</div>
		{:else if modalOpen === 'multiTeam'}
			<div class="space-y-3">
				{#each data.multiTeamPerformers as performer, i}
					{@const width = (performer.teamCount / maxMultiTeamCount) * 100}
					<a href="/performers/{performer.slug}" class="group block">
						<div class="mb-1 flex items-center justify-between">
							<span
								class="truncate pr-2 text-sm text-white transition-colors group-hover:text-[var(--nw-hot-pink)]"
								style="font-family: var(--font-mono);"
							>
								{i + 1}. {performer.name}
							</span>
							<span
								class="flex-shrink-0 text-sm text-[var(--nw-neon-yellow)]"
								style="font-family: var(--font-display);">{performer.teamCount} teams</span
							>
						</div>
						<div class="mb-1 text-xs text-white/60" style="font-family: var(--font-mono);">
							{performer.teams.join(', ')}
						</div>
						<div class="h-1.5 overflow-hidden bg-[var(--tw-concrete)]">
							<div
								class="h-full bg-gradient-to-r from-[var(--nw-neon-yellow)] to-[var(--nw-burning-orange)]"
								style="width: {width}%"
							></div>
						</div>
					</a>
				{/each}
			</div>
		{:else if modalOpen === 'teamOverlap'}
			<div class="space-y-4">
				{#each data.teamPairings as pairing, i}
					{@const width = (pairing.sharedMembers / maxSharedMembers) * 100}
					<div class="group">
						<div class="mb-1 flex items-center justify-between">
							<div class="flex items-center gap-2 truncate pr-2 text-sm">
								<a
									href="/teams/{pairing.team1.slug}"
									class="text-[var(--tw-electric-cyan)] transition-colors hover:text-[var(--nw-hot-pink)]"
									style="font-family: var(--font-mono);"
								>
									{pairing.team1.name}
								</a>
								<span class="text-white/40">∩</span>
								<a
									href="/teams/{pairing.team2.slug}"
									class="text-[var(--tw-electric-cyan)] transition-colors hover:text-[var(--nw-hot-pink)]"
									style="font-family: var(--font-mono);"
								>
									{pairing.team2.name}
								</a>
							</div>
							<span
								class="flex-shrink-0 text-sm text-[var(--tw-electric-cyan)]"
								style="font-family: var(--font-display);">{pairing.sharedMembers} shared</span
							>
						</div>
						<div class="mb-1 text-xs text-white/60" style="font-family: var(--font-mono);">
							{pairing.performers.join(', ')}
						</div>
						<div class="h-1.5 overflow-hidden bg-[var(--tw-concrete)]">
							<div
								class="h-full bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--nw-hot-pink)]"
								style="width: {width}%"
							></div>
						</div>
					</div>
				{/each}
			</div>
		{:else if modalOpen === 'dayDistribution'}
			<div class="space-y-3">
				{#each orderedDays as { day, count }}
					{@const width = (count / maxDayCount) * 100}
					<div>
						<div class="mb-1 flex items-center justify-between">
							<span class="text-sm text-white" style="font-family: var(--font-mono);">{day}</span>
							<span
								class="text-sm text-[var(--nw-neon-yellow)]"
								style="font-family: var(--font-display);">{count} shows</span
							>
						</div>
						<div class="h-2 overflow-hidden bg-[var(--tw-concrete)]">
							<div
								class="h-full bg-gradient-to-r from-[var(--nw-burning-orange)] to-[var(--nw-hot-pink)]"
								style="width: {width}%"
							></div>
						</div>
					</div>
				{/each}
			</div>
		{:else if modalOpen === 'monthlyActivity'}
			<div class="space-y-2">
				{#each data.monthlyActivity as { month, count }}
					{@const width = (count / maxMonthCount) * 100}
					{@const [year, m] = month.split('-')}
					{@const monthName = new Date(parseInt(year), parseInt(m) - 1).toLocaleString('en', {
						month: 'long'
					})}
					<div>
						<div class="mb-0.5 flex items-center justify-between">
							<span class="text-sm text-white" style="font-family: var(--font-mono);"
								>{monthName} {year}</span
							>
							<span
								class="text-sm text-[var(--nw-hot-pink)]"
								style="font-family: var(--font-display);">{count}</span
							>
						</div>
						<div class="h-1.5 overflow-hidden bg-[var(--tw-concrete)]">
							<div
								class="h-full bg-gradient-to-r from-[var(--tw-deep-purple)] via-[var(--nw-hot-pink)] to-[var(--nw-burning-orange)]"
								style="width: {width}%"
							></div>
						</div>
					</div>
				{/each}
			</div>
		{:else if modalOpen === 'showVariety'}
			<div class="space-y-4">
				{#each data.showVarietyPerMonth as { month, count, shows }}
					{@const [year, m] = month.split('-')}
					{@const monthName = new Date(parseInt(year), parseInt(m) - 1).toLocaleString('en', {
						month: 'long'
					})}
					<div class="border-l-2 border-[var(--nw-burning-orange)] pl-3">
						<div class="mb-1 flex items-center justify-between">
							<span
								class="text-sm text-[var(--nw-neon-yellow)]"
								style="font-family: var(--font-display);">{monthName} {year}</span
							>
							<span class="text-xs text-white/50" style="font-family: var(--font-mono);"
								>{count} unique shows</span
							>
						</div>
						<div class="space-y-0.5 text-xs text-white/80" style="font-family: var(--font-mono);">
							{#each shows as show}
								<div>• {show}</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</AnalyticsModal>
{/if}
