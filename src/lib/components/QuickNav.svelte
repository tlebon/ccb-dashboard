<script lang="ts">
	import { page } from '$app/stores';
	import { getContext } from 'svelte';
	import MobileNav from './MobileNav.svelte';

	// Current path for highlighting active link
	$: currentPath = $page.url.pathname;

	// Check if analytics access is granted (with fallback if context not set)
	const hasAnalyticsAccess = getContext<boolean>('analyticsAccess') ?? false;

	let mobileNavOpen = false;
</script>

<!-- Mobile Nav Sidebar -->
<MobileNav
	bind:open={mobileNavOpen}
	theme="blue"
	{hasAnalyticsAccess}
	on:close={() => (mobileNavOpen = false)}
/>

<!-- Mobile Header -->
<div class="mb-4 flex items-center justify-between md:hidden">
	<button
		on:click={() => (mobileNavOpen = true)}
		class="flex h-10 w-10 flex-col items-center justify-center gap-1 rounded text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10"
		aria-label="Open menu"
	>
		<span class="block h-0.5 w-5 bg-[var(--tw-electric-cyan)]"></span>
		<span class="block h-0.5 w-5 bg-[var(--tw-electric-cyan)]"></span>
		<span class="block h-0.5 w-5 bg-[var(--tw-electric-cyan)]"></span>
	</button>
	<a href="/" class="flex items-center gap-2">
		<img src="/cropped-CCB-Logos_white_LG.png" alt="CCB" class="h-8 w-8 object-contain" />
	</a>
	<div class="w-10"></div>
	<!-- Spacer for centering -->
</div>

<!-- Desktop Nav -->
<nav class="mb-6 hidden items-center gap-4 font-mono text-sm md:flex">
	<a
		href="/"
		class="tracking-wider uppercase transition-colors {currentPath === '/'
			? 'text-[var(--tw-neon-pink)]'
			: 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}"
	>
		Dashboard
	</a>
	<span class="text-white/30">|</span>
	<a
		href="/performers"
		class="tracking-wider uppercase transition-colors {currentPath.startsWith('/performers')
			? 'text-[var(--tw-neon-pink)]'
			: 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}"
	>
		Performers
	</a>
	<span class="text-white/30">|</span>
	<a
		href="/teams"
		class="tracking-wider uppercase transition-colors {currentPath.startsWith('/teams')
			? 'text-[var(--tw-neon-pink)]'
			: 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}"
	>
		Teams
	</a>
	<span class="text-white/30">|</span>
	<a
		href="/shows"
		class="tracking-wider uppercase transition-colors {currentPath.startsWith('/shows')
			? 'text-[var(--tw-neon-pink)]'
			: 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}"
	>
		Shows
	</a>
	{#if hasAnalyticsAccess}
		<span class="text-white/30">|</span>
		<a
			href="/analytics"
			class="tracking-wider uppercase transition-colors {currentPath === '/analytics'
				? 'text-[var(--tw-neon-pink)]'
				: 'text-white/60 hover:text-[var(--tw-electric-cyan)]'}"
		>
			Analytics
		</a>
	{/if}
</nav>
