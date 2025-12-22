<script lang="ts">
	type Item = {
		title?: string;
		name?: string;
		slug?: string;
		count?: number;
		showCount?: number;
		iterations?: number;
		teamCount?: number;
		sharedMembers?: number;
		teams?: string[];
		team1?: { name: string; slug: string };
		team2?: { name: string; slug: string };
		performers?: string[];
	};

	interface Props {
		title: string;
		items: Item[];
		maxValue: number;
		listLimit?: number;
		valueKey?: 'count' | 'showCount' | 'iterations' | 'teamCount' | 'sharedMembers';
		gradient?: string;
		linkPrefix?: string;
		showIndex?: boolean;
		onViewAll?: () => void;
		renderLabel?: (item: Item, index: number) => string;
		renderValue?: (item: Item) => string;
		// For team overlap mode
		isTeamOverlap?: boolean;
	}

	let {
		title,
		items,
		maxValue,
		listLimit = 10,
		valueKey = 'count',
		gradient = 'from-[var(--nw-hot-pink)] to-[var(--nw-burning-orange)]',
		linkPrefix = '/shows/',
		showIndex = true,
		onViewAll,
		renderLabel,
		renderValue,
		isTeamOverlap = false
	}: Props = $props();

	const visibleItems = $derived(items.slice(0, listLimit));

	function getValue(item: Item): number {
		const val = item[valueKey];
		return typeof val === 'number' ? val : 0;
	}

	function getLabel(item: Item, index: number): string {
		if (renderLabel) return renderLabel(item, index);
		const name = item.title || item.name || '';
		return showIndex ? `${index + 1}. ${name}` : name;
	}

	function getValueDisplay(item: Item): string {
		if (renderValue) return renderValue(item);
		return String(getValue(item));
	}

	function getSlug(item: Item): string {
		return item.slug;
	}
</script>

<div class="brutalist-border bg-[var(--tw-deep-purple)] p-4 md:p-5">
	{#if onViewAll}
		<button onclick={onViewAll} class="group mb-4 w-full text-left">
			<h2
				class="flex items-center gap-2 text-xl text-[var(--nw-burning-orange)] transition-colors group-hover:text-[var(--nw-hot-pink)] md:text-2xl"
				style="font-family: var(--font-display);"
			>
				{title}
				<span class="text-sm opacity-50">↗</span>
			</h2>
		</button>
	{:else}
		<h2
			class="mb-4 text-xl text-[var(--nw-burning-orange)] md:text-2xl"
			style="font-family: var(--font-display);"
		>
			{title}
		</h2>
	{/if}

	<div class="space-y-2">
		{#each visibleItems as item, i}
			{@const value = getValue(item)}
			{@const width = (value / maxValue) * 100}
			{#if isTeamOverlap && item.team1 && item.team2}
				<button onclick={onViewAll} class="group block w-full text-left">
					<div class="mb-0.5 flex items-center justify-between">
						<span
							class="truncate pr-2 text-xs transition-colors group-hover:text-[var(--nw-hot-pink)]"
							style="font-family: var(--font-mono);"
						>
							{item.team1.name} ∩ {item.team2.name}
						</span>
						<span
							class="flex-shrink-0 text-sm text-[var(--tw-electric-cyan)]"
							style="font-family: var(--font-display);">{getValueDisplay(item)}</span
						>
					</div>
					<div class="h-1.5 overflow-hidden bg-[var(--tw-concrete)]">
						<div class="h-full bg-gradient-to-r {gradient}" style="width: {width}%"></div>
					</div>
				</button>
			{:else}
				<a href="{linkPrefix}{getSlug(item)}" class="group block">
					<div class="mb-0.5 flex items-center justify-between">
						<span
							class="truncate pr-2 text-xs transition-colors group-hover:text-[var(--nw-hot-pink)]"
							style="font-family: var(--font-mono);"
						>
							{getLabel(item, i)}
						</span>
						<span
							class="flex-shrink-0 text-sm text-[var(--nw-hot-pink)]"
							style="font-family: var(--font-display);">{getValueDisplay(item)}</span
						>
					</div>
					<div class="h-1.5 overflow-hidden bg-[var(--tw-concrete)]">
						<div class="h-full bg-gradient-to-r {gradient}" style="width: {width}%"></div>
					</div>
				</a>
			{/if}
		{/each}
	</div>

	{#if onViewAll && items.length > listLimit}
		<button
			onclick={onViewAll}
			class="mt-3 text-xs tracking-wider text-[var(--nw-burning-orange)] uppercase transition-colors hover:text-[var(--nw-hot-pink)]"
			style="font-family: var(--font-mono);"
		>
			View all {items.length} →
		</button>
	{/if}
</div>
