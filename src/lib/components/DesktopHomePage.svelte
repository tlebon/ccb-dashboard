<!--
	DesktopHomePage.svelte
	Desktop-specific layout for the home page
	Features: 3-column grid, monitor mode support, dynamic column ordering, infinite scroll
-->
<script lang="ts">
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import type { Show } from '$lib/utils/icalParser';
	import type { WeekGroup } from '$lib/utils/showGrouping';
	import BrandingColumn from '$lib/components/BrandingColumn.svelte';
	import ShowsColumn from '$lib/components/ShowsColumn.svelte';
	import ImagesColumn from '$lib/components/ImagesColumn.svelte';

	// Props - Data & Display State
	let {
		weekOffset = $bindable(0),
		theme = 'blue' as 'blue' | 'orange',
		groupedShows,
		weekShows = [] as Show[],
		loading = false,
		error = null as string | null,

		// Monitor mode
		monitorMode = false,
		isNextWeekStyle = false,
		direction = 1,

		// Week navigation state
		weekRange,
		canGoPrev = false,
		canGoNext = false,
		prevWeekLabel = '',
		nextWeekLabel = '',

		// Show metadata for display
		highlightedShowIds = [] as string[],
		pastShowIds = [] as string[],
		firstUpcomingShowId = null as string | null,
		nextShow = undefined as Show | undefined,
		isPastWeek = false,

		// Responsive sizing
		dayHeadingClass = 'text-2xl',
		timeClass = 'text-xl',
		titleClass = 'text-lg',

		// Infinite scroll state (manual mode only)
		loadingMore = false,
		hasMore = true,
		hasPastShows = true,
		pastDaysLoaded = 0,
		visibleShowIds = $bindable([] as string[]),

		// Infinite scroll refs (exposed to parent for $effect observers)
		desktopLoadTrigger = $bindable(null as HTMLDivElement | null),
		desktopTopLoadTrigger = $bindable(null as HTMLDivElement | null),
		desktopScrollContainer = $bindable(null as HTMLElement | null),

		// Navigation callbacks
		onPrevWeek,
		onNextWeek,
		onToday,
		onToggleMonitor
	}: {
		weekOffset?: number;
		theme?: 'blue' | 'orange';
		groupedShows: WeekGroup[];
		weekShows?: Show[];
		loading?: boolean;
		error?: string | null;
		monitorMode?: boolean;
		isNextWeekStyle?: boolean;
		direction?: number;
		weekRange: { startDate: Date; endDate: Date; label: string };
		canGoPrev?: boolean;
		canGoNext?: boolean;
		prevWeekLabel?: string;
		nextWeekLabel?: string;
		highlightedShowIds?: string[];
		pastShowIds?: string[];
		firstUpcomingShowId?: string | null;
		nextShow?: Show | undefined;
		isPastWeek?: boolean;
		dayHeadingClass?: string;
		timeClass?: string;
		titleClass?: string;
		loadingMore?: boolean;
		hasMore?: boolean;
		hasPastShows?: boolean;
		pastDaysLoaded?: number;
		visibleShowIds?: string[];
		desktopLoadTrigger?: HTMLDivElement | null;
		desktopTopLoadTrigger?: HTMLDivElement | null;
		desktopScrollContainer?: HTMLElement | null;
		onPrevWeek: () => void;
		onNextWeek: () => void;
		onToday: () => void;
		onToggleMonitor: () => void;
	} = $props();
</script>

{#if monitorMode}
	<!-- Monitor Mode: Full page transitions with dynamic column ordering -->
	{#key weekOffset}
		<div
			in:fly={{ x: direction > 0 ? 300 : -300, duration: 300, easing: cubicOut }}
			out:fade={{ duration: 150 }}
			class="h-full"
		>
			<main
				class="relative z-10 mx-auto hidden min-h-0 w-full flex-1 grid-cols-1 items-stretch gap-3 px-3 py-4 md:grid"
				style="grid-template-columns: {isNextWeekStyle
					? '3.5fr 3.5fr 2.7fr'
					: '2.7fr 3.5fr 3.5fr'};"
			>
				{#if isNextWeekStyle}
					<!-- Next week style: Images, Shows, Branding -->
					<ImagesColumn
						{nextShow}
						shows={weekShows}
						nextShowId={nextShow?.id}
						upFirst={true}
						{theme}
						{isPastWeek}
						{visibleShowIds}
						{monitorMode}
					/>
					<ShowsColumn
						{groupedShows}
						{loading}
						{error}
						{dayHeadingClass}
						{timeClass}
						{titleClass}
						{highlightedShowIds}
						{theme}
						{monitorMode}
						{pastShowIds}
						{firstUpcomingShowId}
						isCurrentWeek={weekOffset === 0}
					/>
					<BrandingColumn
						{theme}
						{monitorMode}
						weekLabel={weekRange.label}
						{canGoPrev}
						{canGoNext}
						{weekOffset}
						{prevWeekLabel}
						{nextWeekLabel}
						on:prev={onPrevWeek}
						on:next={onNextWeek}
						on:today={onToday}
						on:toggleMonitor={onToggleMonitor}
					/>
				{:else}
					<!-- This week style: Branding, Shows, Images -->
					<BrandingColumn
						{theme}
						{monitorMode}
						weekLabel={weekRange.label}
						{canGoPrev}
						{canGoNext}
						{weekOffset}
						{prevWeekLabel}
						{nextWeekLabel}
						on:prev={onPrevWeek}
						on:next={onNextWeek}
						on:today={onToday}
						on:toggleMonitor={onToggleMonitor}
					/>
					<ShowsColumn
						{groupedShows}
						{loading}
						{error}
						{dayHeadingClass}
						{timeClass}
						{titleClass}
						{highlightedShowIds}
						{theme}
						{monitorMode}
						{pastShowIds}
						{firstUpcomingShowId}
						isCurrentWeek={weekOffset === 0}
					/>
					<ImagesColumn
						{nextShow}
						shows={weekShows}
						nextShowId={nextShow?.id}
						{theme}
						{isPastWeek}
						{visibleShowIds}
						{monitorMode}
					/>
				{/if}
			</main>
		</div>
	{/key}
{:else}
	<!-- Manual Mode: Stable layout with infinite scroll support -->
	<main
		class="relative z-10 mx-auto hidden min-h-0 w-full flex-1 grid-cols-1 items-stretch gap-3 px-3 py-4 md:grid"
		style="grid-template-columns: 2.7fr 3.5fr 3.5fr;"
	>
		<!-- Branding stays on left, stable -->
		<BrandingColumn
			{theme}
			{monitorMode}
			weekLabel={weekRange.label}
			{canGoPrev}
			{canGoNext}
			{weekOffset}
			{prevWeekLabel}
			{nextWeekLabel}
			on:prev={onPrevWeek}
			on:next={onNextWeek}
			on:today={onToday}
			on:toggleMonitor={onToggleMonitor}
		/>

		<!-- Shows column (no transition in manual mode - persistent for infinite scroll) -->
		<div class="relative h-full overflow-hidden">
			<ShowsColumn
				{groupedShows}
				{loading}
				{error}
				{dayHeadingClass}
				{timeClass}
				{titleClass}
				{highlightedShowIds}
				{theme}
				{monitorMode}
				{pastShowIds}
				{firstUpcomingShowId}
				isCurrentWeek={true}
				{loadingMore}
				{hasMore}
				bind:loadTrigger={desktopLoadTrigger}
				{hasPastShows}
				bind:topLoadTrigger={desktopTopLoadTrigger}
				{pastDaysLoaded}
				bind:visibleShowIds
				bind:scrollContainer={desktopScrollContainer}
			/>
		</div>

		<!-- Images column (no transition in manual mode - persistent for smooth poster updates) -->
		<div class="relative h-full overflow-hidden">
			<ImagesColumn
				{nextShow}
				shows={weekShows}
				nextShowId={nextShow?.id}
				{theme}
				{isPastWeek}
				{visibleShowIds}
				{monitorMode}
			/>
		</div>
	</main>
{/if}
