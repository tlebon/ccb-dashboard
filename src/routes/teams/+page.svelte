<script lang="ts">
	import { onMount } from 'svelte';
	import QuickNav from '$lib/components/QuickNav.svelte';

	interface Team {
		id: number;
		name: string;
		slug: string;
		type: 'house' | 'indie' | 'other';
		is_retired: number;
		member_count: number;
		show_count: number;
		next_show_date: string | null;
		next_show_slug: string | null;
	}

	let teams: Team[] = [];
	let loading = true;

	onMount(async () => {
		const res = await fetch('/api/teams');
		const data = await res.json();
		teams = data.teams;
		loading = false;
	});

	$: houseTeams = teams.filter((t) => t.type === 'house' && !t.is_retired);
	$: retiredHouseTeams = teams.filter((t) => t.type === 'house' && t.is_retired);
	$: indieTeams = teams.filter((t) => t.type === 'indie');
	$: otherTeams = teams.filter((t) => t.type === 'other');

	function formatShortDate(dateStr: string) {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
	}
</script>

<svelte:head>
	<title>Teams | CCB Dashboard</title>
</svelte:head>

<div
	class="min-h-screen bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-black text-white"
>
	<div class="grain-overlay"></div>

	<div class="relative z-10 mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-8">
		<!-- Header -->
		<header class="mb-6 md:mb-10">
			<QuickNav />
			<h1
				class="inline-block bg-gradient-to-r from-[var(--tw-electric-cyan)] to-[var(--tw-neon-pink)] px-3 py-1.5 text-4xl tracking-wider text-white uppercase
			           md:px-4 md:py-2 md:text-6xl"
				style="font-family: var(--font-black); clip-path: polygon(0 0, 98% 0, 100% 100%, 2% 100%);"
			>
				Teams
			</h1>
		</header>

		{#if loading}
			<div
				class="py-12 text-center text-[var(--tw-electric-cyan)]"
				style="font-family: var(--font-display);"
			>
				Loading...
			</div>
		{:else}
			<!-- House Teams Section -->
			{#if houseTeams.length > 0}
				<section class="mb-12">
					<div class="relative mb-6">
						<h2
							class="text-2xl tracking-wider text-[var(--tw-neon-pink)] uppercase"
							style="font-family: var(--font-display);"
						>
							House Teams
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-24 bg-gradient-to-r from-[var(--tw-neon-pink)] to-transparent"
						></div>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						{#each houseTeams as team (team.id)}
							<div class="border-l-4 border-[var(--tw-neon-pink)]/60 bg-white/5 p-5">
								<a href="/teams/{team.slug}" class="group">
									<span
										class="mb-2 block text-2xl text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)]"
										style="font-family: var(--font-display);"
									>
										{team.name}
									</span>
								</a>
								<div class="flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm">
									<span class="text-[var(--tw-electric-cyan)]">{team.member_count} members</span>
									{#if team.next_show_date}
										<a
											href="/shows/{team.next_show_slug}"
											class="text-[var(--nw-neon-yellow)] hover:text-white"
										>
											Next: {formatShortDate(team.next_show_date)} →
										</a>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Former House Teams Section -->
			{#if retiredHouseTeams.length > 0}
				<section class="mb-12">
					<div class="relative mb-6">
						<h2
							class="text-2xl tracking-wider text-[var(--tw-neon-pink)]/70 uppercase"
							style="font-family: var(--font-display);"
						>
							Former House Teams
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-24 bg-gradient-to-r from-[var(--tw-neon-pink)]/50 to-transparent"
						></div>
					</div>

					<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
						{#each retiredHouseTeams as team (team.id)}
							<div
								class="flex flex-col gap-1 border-l-4 border-[var(--tw-neon-pink)]/30 px-4 py-3
							       transition-all hover:border-[var(--tw-neon-pink)] hover:bg-white/5"
							>
								<a href="/teams/{team.slug}" class="group">
									<span
										class="text-xl text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)]"
										style="font-family: var(--font-display);"
									>
										{team.name}
									</span>
								</a>
								<div class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm">
									<span class="text-[var(--tw-electric-cyan)]">{team.member_count} members</span>
									{#if team.next_show_date}
										<a
											href="/shows/{team.next_show_slug}"
											class="text-[var(--nw-neon-yellow)] hover:text-white"
										>
											Next: {formatShortDate(team.next_show_date)} →
										</a>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Indie Teams Section -->
			{#if indieTeams.length > 0}
				<section class="mb-12">
					<div class="relative mb-6">
						<h2
							class="text-2xl tracking-wider text-[var(--tw-electric-cyan)] uppercase"
							style="font-family: var(--font-display);"
						>
							Indie Teams
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-24 bg-gradient-to-r from-[var(--tw-electric-cyan)] to-transparent"
						></div>
					</div>

					<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
						{#each indieTeams as team (team.id)}
							<div
								class="flex flex-col gap-1 border-l-4 border-[var(--tw-electric-cyan)]/40 px-4 py-3
							       transition-all hover:border-[var(--tw-electric-cyan)] hover:bg-white/5"
							>
								<a href="/teams/{team.slug}" class="group">
									<span
										class="text-xl text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)]"
										style="font-family: var(--font-display);"
									>
										{team.name}
									</span>
								</a>
								<div class="flex flex-wrap gap-x-3 gap-y-1 font-mono text-sm">
									<span class="text-[var(--tw-neon-pink)]">{team.member_count} members</span>
									{#if team.next_show_date}
										<a
											href="/shows/{team.next_show_slug}"
											class="text-[var(--nw-neon-yellow)] hover:text-white"
										>
											Next: {formatShortDate(team.next_show_date)} →
										</a>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Other Teams Section -->
			{#if otherTeams.length > 0}
				<section>
					<div class="relative mb-6">
						<h2
							class="text-2xl tracking-wider text-[var(--nw-burning-orange)] uppercase"
							style="font-family: var(--font-display);"
						>
							Other Teams
						</h2>
						<div
							class="absolute -bottom-2 left-0 h-1 w-24 bg-gradient-to-r from-[var(--nw-burning-orange)] to-transparent"
						></div>
					</div>

					<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
						{#each otherTeams as team (team.id)}
							<a
								href="/teams/{team.slug}"
								class="group flex flex-col gap-1 border-l-4 border-[var(--nw-burning-orange)]/40 px-4 py-3
								       transition-all hover:border-[var(--nw-burning-orange)] hover:bg-white/5"
							>
								<span
									class="text-xl text-white uppercase transition-colors group-hover:text-[var(--tw-electric-cyan)]"
									style="font-family: var(--font-display);"
								>
									{team.name}
								</span>
								<div class="flex gap-3 font-mono text-sm">
									<span class="text-[var(--tw-neon-pink)]">{team.member_count} members</span>
								</div>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			{#if teams.length === 0}
				<div class="py-12 text-center text-white/60">No teams found</div>
			{/if}
		{/if}
	</div>
</div>
