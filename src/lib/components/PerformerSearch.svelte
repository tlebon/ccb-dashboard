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
		class="w-full rounded-lg border-2 border-[var(--tw-electric-cyan)]/50 bg-[var(--tw-deep-purple)]/60 px-4 py-3
		       font-mono text-[var(--tw-electric-cyan)]
		       placeholder-[var(--tw-electric-cyan)]/40 transition-all focus:border-[var(--tw-neon-pink)]
		       focus:shadow-[0_0_15px_var(--tw-neon-pink)] focus:outline-none"
	/>
	{#if value}
		<button
			on:click={handleClear}
			class="absolute top-1/2 right-3 -translate-y-1/2 text-[var(--tw-neon-pink)] hover:text-[var(--nw-neon-yellow)]"
		>
			✕
		</button>
	{/if}
</div>
