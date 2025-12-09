<script lang="ts">
	export let name: string;
	export let slug: string;
	export let teamCount: number = 0;
	export let showCount: number = 0;
	export let compact = false;
</script>

<a
	href="/performers/{slug}"
	class="block p-4 bg-[var(--tw-deep-purple)]/50 border-2 border-[var(--tw-electric-cyan)]/30 rounded-lg
	       hover:border-[var(--tw-neon-pink)] hover:bg-[var(--tw-deep-purple)]/80
	       hover:shadow-[0_0_20px_var(--tw-neon-pink)] transition-all group"
	class:py-2={compact}
	class:px-3={compact}
>
	<h3 class="font-mono text-[var(--tw-electric-cyan)] group-hover:text-[var(--nw-neon-yellow)] transition-colors"
	    class:text-lg={!compact}
	    class:text-sm={compact}>
		{name}
	</h3>
	{#if !compact && (teamCount > 0 || showCount > 0)}
		<div class="mt-2 flex gap-4 text-sm">
			{#if teamCount > 0}
				<span class="text-[var(--tw-neon-pink)]">{teamCount} team{teamCount !== 1 ? 's' : ''}</span>
			{/if}
			{#if showCount > 0}
				<span class="text-[var(--nw-burning-orange)]">{showCount} show{showCount !== 1 ? 's' : ''}</span>
			{/if}
		</div>
	{/if}
</a>
