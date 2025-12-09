<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let placeholder = 'Search performers...';
	export let value = '';

	const dispatch = createEventDispatcher<{ search: string }>();

	let timeout: ReturnType<typeof setTimeout>;

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;

		clearTimeout(timeout);
		timeout = setTimeout(() => {
			dispatch('search', value);
		}, 300);
	}

	function handleClear() {
		value = '';
		dispatch('search', '');
	}
</script>

<div class="relative">
	<input
		type="text"
		{placeholder}
		{value}
		on:input={handleInput}
		class="w-full px-4 py-3 bg-[var(--tw-deep-purple)]/60 border-2 border-[var(--tw-electric-cyan)]/50 rounded-lg
		       text-[var(--tw-electric-cyan)] placeholder-[var(--tw-electric-cyan)]/40
		       focus:outline-none focus:border-[var(--tw-neon-pink)] focus:shadow-[0_0_15px_var(--tw-neon-pink)]
		       font-mono transition-all"
	/>
	{#if value}
		<button
			on:click={handleClear}
			class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tw-neon-pink)] hover:text-[var(--nw-neon-yellow)]"
		>
			✕
		</button>
	{/if}
</div>
