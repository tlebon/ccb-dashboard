<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchShowsFromDB, type Show } from '$lib/utils/icalParser';
	import BrandingColumn from '$lib/components/BrandingColumn.svelte';
	import ShowsColumn from '$lib/components/ShowsColumn.svelte';
	import ImagesColumn from '$lib/components/ImagesColumn.svelte';

	// Week grouping interface (matches ShowsColumn)
	interface WeekGroup {
		weekLabel: string;
		startDate: Date;
		days: Record<string, Show[]>;
	}

	let shows: Show[] = [];
	let loading = true;
	let error: string | null = null;
	let logoError = false;

	onMount(async () => {
		try {
			// Fetch from database - shows are synced via background job
			shows = await fetchShowsFromDB(7);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load shows';
		} finally {
			loading = false;
		}
	});

	// Helper: Get Monday (start of week) for a given date
	function getWeekStart(date: Date): Date {
		const d = new Date(date);
		d.setHours(0, 0, 0, 0);
		const dayOfWeek = d.getDay(); // 0 (Sun) - 6 (Sat)
		const daysSinceMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
		d.setDate(d.getDate() - daysSinceMonday);
		return d;
	}

	// Group shows by day, but only for today + next 4 days
	function groupShowsByDayLimited(shows: Show[]): Record<string, Show[]> {
		const groups: Record<string, Show[]> = {};
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		for (const show of shows) {
			const date = new Date(show.start);
			date.setHours(0, 0, 0, 0);
			const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
			if (diffDays >= 0 && diffDays < 5) {
				const dayKey = date.toLocaleDateString(undefined, {
					weekday: 'long',
					month: 'long',
					day: 'numeric'
				});
				if (!groups[dayKey]) groups[dayKey] = [];
				groups[dayKey].push(show);
			}
		}
		return groups;
	}

	// Wrap day groups into WeekGroup array (ShowsColumn expects this format)
	function groupShowsAsWeeks(shows: Show[]): WeekGroup[] {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const weekStart = getWeekStart(today);
		const days = groupShowsByDayLimited(shows);

		return [
			{
				weekLabel: 'This Week',
				startDate: weekStart,
				days
			}
		];
	}

	$: groupedShows = groupShowsAsWeeks(shows);

	// Find the next show
	$: now = new Date();
	$: nextShow = shows
		.filter((s) => new Date(s.start) > now)
		.sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];

	// Get all shows with images for highlighting (next show + carousel shows)
	$: highlightedShowIds = shows.filter((s) => s.imageUrl).map((s) => s.id);

	$: dayCount = groupedShows.length > 0 ? Object.keys(groupedShows[0].days).length : 0;
	$: totalShows = shows.filter((s) => {
		const date = new Date(s.start);
		date.setHours(0, 0, 0, 0);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
		return diffDays >= 0 && diffDays < 5;
	}).length;
	$: dayHeadingClass =
		totalShows > 20
			? 'text-xl'
			: totalShows > 15
				? 'text-2xl'
				: dayCount < 5
					? 'text-3xl'
					: 'text-2xl';
	$: timeClass =
		totalShows > 20
			? 'text-lg'
			: totalShows > 15
				? 'text-xl'
				: dayCount < 5
					? 'text-2xl'
					: 'text-xl';
	$: titleClass =
		totalShows > 20
			? 'text-base'
			: totalShows > 15
				? 'text-lg'
				: dayCount < 5
					? 'text-xl'
					: 'text-lg';
</script>

<div
	class="relative box-border flex h-screen max-h-screen flex-col overflow-hidden bg-gradient-to-br
            from-[var(--tw-midnight)] via-black to-[var(--tw-deep-purple)] text-white"
>
	<!-- Grain texture overlay -->
	<div class="grain-overlay"></div>

	<main
		class="relative z-10 mx-auto grid min-h-0 w-full flex-1 grid-cols-1 items-stretch gap-3 px-3 py-4"
		style="grid-template-columns: 2.7fr 3.5fr 3.5fr;"
	>
		<!-- First Column: Info/Branding -->
		<BrandingColumn theme="blue" />
		<!-- Second Column: Upcoming Shows Grouped by Day (limited) -->
		<ShowsColumn
			{groupedShows}
			{loading}
			{error}
			{dayHeadingClass}
			{timeClass}
			{titleClass}
			{highlightedShowIds}
			theme="blue"
		/>
		<!-- Third Column: Next show and carousel -->
		<ImagesColumn {nextShow} {shows} nextShowId={nextShow?.id} theme="blue" />
	</main>
</div>
