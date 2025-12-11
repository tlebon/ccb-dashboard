<script lang="ts">
	interface DataPoint {
		month?: string;
		day?: string;
		count: number;
	}

	interface Props {
		title: string;
		subtitle?: string;
		data: DataPoint[];
		maxValue: number;
		height?: number;
		gradient?: string;
		onViewAll?: () => void;
		// For monthly data
		isMonthly?: boolean;
		// For day of week data
		isDayOfWeek?: boolean;
	}

	let {
		title,
		subtitle,
		data,
		maxValue,
		height = 140,
		gradient = 'from-[var(--nw-hot-pink)] to-[var(--nw-burning-orange)]',
		onViewAll,
		isMonthly = false,
		isDayOfWeek = false
	}: Props = $props();

	function getMonthLabel(month: string): { short: string; year: string } {
		const [year, m] = month.split('-');
		const monthName = new Date(parseInt(year), parseInt(m) - 1).toLocaleString('en', { month: 'short' });
		return { short: monthName.slice(0, 1), year: year.slice(2) };
	}
</script>

<div class="brutalist-border bg-[var(--tw-deep-purple)] p-4 md:p-5">
	{#if onViewAll}
		<button onclick={onViewAll} class="w-full text-left group mb-4">
			<div class="flex flex-wrap items-baseline justify-between gap-2">
				<h2 class="text-xl md:text-2xl text-[var(--nw-burning-orange)] group-hover:text-[var(--nw-hot-pink)] transition-colors flex items-center gap-2" style="font-family: var(--font-display);">
					{title}
					<span class="text-sm opacity-50">↗</span>
				</h2>
				{#if subtitle}
					<span class="text-xs opacity-50" style="font-family: var(--font-mono);">{subtitle}</span>
				{/if}
			</div>
		</button>
	{:else}
		<div class="flex flex-wrap items-baseline justify-between gap-2 mb-4">
			<h2 class="text-xl md:text-2xl text-[var(--nw-burning-orange)]" style="font-family: var(--font-display);">
				{title}
			</h2>
			{#if subtitle}
				<span class="text-xs opacity-50" style="font-family: var(--font-mono);">{subtitle}</span>
			{/if}
		</div>
	{/if}

	{#if isDayOfWeek}
		<div class="flex items-end justify-between gap-1 md:gap-2" style="height: {height}px;">
			{#each data as { day, count }}
				{@const heightPx = Math.max(16, (count / maxValue) * (height - 40))}
				<div class="flex-1 flex flex-col items-center">
					<div class="text-xs text-[var(--nw-neon-yellow)] mb-1" style="font-family: var(--font-display);">
						{count}
					</div>
					<div class="w-full bg-gradient-to-t {gradient}" style="height: {heightPx}px;"></div>
					<span class="text-[10px] uppercase tracking-wider opacity-70 mt-1" style="font-family: var(--font-mono);">
						{day?.slice(0, 2)}
					</span>
				</div>
			{/each}
		</div>
	{:else if isMonthly}
		<div class="overflow-x-auto">
			<div class="flex items-end gap-1 min-w-max" style="height: {height + 20}px; padding-bottom: 24px;">
				{#each data as { month, count }}
					{@const heightPx = Math.max(12, (count / maxValue) * (height - 20))}
					{@const label = getMonthLabel(month || '')}
					<div class="flex flex-col items-center group">
						<div class="text-[10px] text-[var(--nw-neon-yellow)] mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style="font-family: var(--font-mono);">
							{count}
						</div>
						<div
							class="w-6 md:w-8 bg-gradient-to-t {gradient} hover:opacity-80 cursor-pointer"
							style="height: {heightPx}px;"
							title="{month}: {count}">
						</div>
						<div class="mt-1 text-[9px] opacity-50 whitespace-nowrap" style="font-family: var(--font-mono); transform: rotate(-45deg); transform-origin: top left; width: 30px;">
							{label.short}'{label.year}
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
