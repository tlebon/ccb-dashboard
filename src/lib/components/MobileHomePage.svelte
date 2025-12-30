<!--
	MobileHomePage.svelte
	Mobile-specific layout for the home page
	Features: swipe gestures, single-column layout, touch-optimized navigation
	NO monitor mode support (mobile-only features)
-->
<script lang="ts">
	import type { WeekGroup } from '$lib/utils/showGrouping';
	import MobileHeader from '$lib/components/MobileHeader.svelte';
	import ShowsColumn from '$lib/components/ShowsColumn.svelte';

	// Props - Data & Display State
	let {
		weekOffset = $bindable(0),
		theme = 'blue' as 'blue' | 'orange',
		groupedShows,
		loading = false,
		error = null as string | null,

		// Week navigation state
		weekRange,
		canGoPrev = false,
		canGoNext = false,

		// Show metadata for display
		highlightedShowIds = [] as string[],
		pastShowIds = [] as string[],
		firstUpcomingShowId = null as string | null,

		// Infinite scroll state
		loadingMore = false,
		hasMore = true,
		hasPastShows = true,
		pastDaysLoaded = 0,
		visibleShowIds = $bindable([] as string[]),

		// Infinite scroll refs (exposed to parent for $effect observers)
		mobileLoadTrigger = $bindable(null as HTMLDivElement | null),
		mobileTopLoadTrigger = $bindable(null as HTMLDivElement | null),
		mobileScrollContainer = $bindable(null as HTMLElement | null),

		// Navigation callbacks
		onPrevWeek,
		onNextWeek,
		onToday,
		onOpenMenu
	}: {
		weekOffset?: number;
		theme?: 'blue' | 'orange';
		groupedShows: WeekGroup[];
		loading?: boolean;
		error?: string | null;
		weekRange: { startDate: Date; endDate: Date; label: string };
		canGoPrev?: boolean;
		canGoNext?: boolean;
		highlightedShowIds?: string[];
		pastShowIds?: string[];
		firstUpcomingShowId?: string | null;
		loadingMore?: boolean;
		hasMore?: boolean;
		hasPastShows?: boolean;
		pastDaysLoaded?: number;
		visibleShowIds?: string[];
		mobileLoadTrigger?: HTMLDivElement | null;
		mobileTopLoadTrigger?: HTMLDivElement | null;
		mobileScrollContainer?: HTMLElement | null;
		onPrevWeek: () => void;
		onNextWeek: () => void;
		onToday: () => void;
		onOpenMenu: () => void;
	} = $props();

	// Local state: Touch gesture handling
	let touchStartX = $state(0);
	let touchStartY = $state(0);

	const SWIPE_THRESHOLD = 50; // Minimum distance for swipe (px)
	const SWIPE_ANGLE_THRESHOLD = 30; // Max vertical movement to count as horizontal swipe (px)

	function handleTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function handleTouchEnd(e: TouchEvent) {
		const touchEndX = e.changedTouches[0].clientX;
		const touchEndY = e.changedTouches[0].clientY;
		const deltaX = touchEndX - touchStartX;
		const deltaY = Math.abs(touchEndY - touchStartY);

		// Only trigger if horizontal swipe and not too much vertical movement
		if (Math.abs(deltaX) > SWIPE_THRESHOLD && deltaY < SWIPE_ANGLE_THRESHOLD) {
			if (deltaX > 0 && canGoPrev) {
				// Swipe right = previous week
				onPrevWeek();
			} else if (deltaX < 0 && canGoNext) {
				// Swipe left = next week
				onNextWeek();
			}
		}
	}
</script>

<!-- Mobile Layout (visible only on small screens) -->
<div
	class="flex h-full flex-col md:hidden"
	ontouchstart={handleTouchStart}
	ontouchend={handleTouchEnd}
>
	<MobileHeader
		{theme}
		weekLabel={weekRange.label}
		{canGoPrev}
		{canGoNext}
		{weekOffset}
		monitorMode={false}
		on:openMenu={onOpenMenu}
		on:prev={onPrevWeek}
		on:next={onNextWeek}
		on:today={onToday}
	/>

	<main class="relative z-10 min-h-0 flex-1 px-3 py-3">
		<ShowsColumn
			{groupedShows}
			{loading}
			{error}
			dayHeadingClass="text-2xl"
			timeClass="text-xl"
			titleClass="text-lg"
			{highlightedShowIds}
			{theme}
			monitorMode={false}
			showInlineImages={true}
			{pastShowIds}
			{firstUpcomingShowId}
			isCurrentWeek={weekOffset === 0}
			{loadingMore}
			{hasMore}
			bind:loadTrigger={mobileLoadTrigger}
			{hasPastShows}
			bind:topLoadTrigger={mobileTopLoadTrigger}
			{pastDaysLoaded}
			bind:visibleShowIds
			bind:scrollContainer={mobileScrollContainer}
		/>
	</main>
</div>
