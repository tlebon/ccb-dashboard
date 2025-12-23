<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let theme: 'blue' | 'orange' = 'blue';
	export let weekLabel: string = 'This Week';
	export let canGoPrev: boolean = false;
	export let canGoNext: boolean = true;
	export let weekOffset: number = 0;

	const dispatch = createEventDispatcher();
</script>

<header
	class="flex items-center justify-between border-b px-3 py-2
              {theme === 'orange'
		? 'border-[var(--nw-hot-pink)]/40 bg-[var(--nw-deep-purple)]'
		: 'border-[var(--tw-electric-cyan)]/40 bg-[var(--tw-midnight)]'}"
>
	<!-- Left: Hamburger + Logo -->
	<div class="flex items-center gap-2">
		<button
			on:click={() => dispatch('openMenu')}
			class="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded transition-colors
             {theme === 'orange'
				? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10'
				: 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
			aria-label="Open menu"
		>
			<span
				class="block h-0.5 w-5 {theme === 'orange'
					? 'bg-[var(--nw-neon-yellow)]'
					: 'bg-[var(--tw-electric-cyan)]'}"
			></span>
			<span
				class="block h-0.5 w-5 {theme === 'orange'
					? 'bg-[var(--nw-neon-yellow)]'
					: 'bg-[var(--tw-electric-cyan)]'}"
			></span>
			<span
				class="block h-0.5 w-5 {theme === 'orange'
					? 'bg-[var(--nw-neon-yellow)]'
					: 'bg-[var(--tw-electric-cyan)]'}"
			></span>
		</button>
		<img src="/cropped-CCB-Logos_white_LG.png" alt="CCB" class="h-8 w-8 object-contain" />
	</div>

	<!-- Center: Week Label + Today button -->
	<div class="flex flex-col items-center">
		<div
			class="text-center text-xs tracking-[0.2em] uppercase
                {theme === 'orange'
				? 'text-[var(--nw-neon-yellow)]'
				: 'text-[var(--tw-electric-cyan)]'}"
			style="font-family: var(--font-mono);"
		>
			{weekLabel}
		</div>
		{#if weekOffset !== 0}
			<button
				on:click={() => dispatch('today')}
				class="text-[9px] tracking-wider uppercase transition-all
               {theme === 'orange'
					? 'text-white/50 hover:text-[var(--nw-neon-yellow)]'
					: 'text-white/50 hover:text-[var(--tw-electric-cyan)]'}"
				style="font-family: var(--font-mono);"
			>
				↩ Today
			</button>
		{/if}
	</div>

	<!-- Right: Navigation Arrows -->
	<div class="flex items-center gap-0">
		<button
			on:click={() => dispatch('prev')}
			disabled={!canGoPrev}
			class="flex h-10 w-10 items-center justify-center text-lg transition-all
             {canGoPrev
				? theme === 'orange'
					? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10'
					: 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'
				: 'cursor-not-allowed text-white/20'}"
			style="font-family: var(--font-mono);"
			aria-label="Previous week"
		>
			←
		</button>
		<button
			on:click={() => dispatch('next')}
			disabled={!canGoNext}
			class="flex h-10 w-10 items-center justify-center text-lg transition-all
             {canGoNext
				? theme === 'orange'
					? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10'
					: 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'
				: 'cursor-not-allowed text-white/20'}"
			style="font-family: var(--font-mono);"
			aria-label="Next week"
		>
			→
		</button>
	</div>
</header>
