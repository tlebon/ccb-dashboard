<script lang="ts">
	import QrCode from 'svelte-qrcode';
	import { createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let logoError = false;
	let showCredits = false;
	export let theme: 'blue' | 'orange' = 'blue';
	export let monitorMode: boolean = false;
	export let weekLabel: string = 'This Week';
	export let canGoPrev: boolean = false;
	export let canGoNext: boolean = true;
	export let weekOffset: number = 0;
	export let prevWeekLabel: string = '';
	export let nextWeekLabel: string = '';
</script>

<section
	class="reveal-left relative flex h-full flex-col items-center justify-between overflow-hidden px-4 delay-100
  {theme === 'orange'
		? 'bg-gradient-to-br from-[var(--nw-deep-purple)] via-black to-[var(--nw-burning-orange)]'
		: 'bg-gradient-to-br from-[var(--tw-midnight)] via-[var(--tw-deep-purple)] to-[var(--tw-concrete)]'}
  brutalist-border
  {theme === 'orange' ? 'border-[var(--nw-hot-pink)]' : 'border-[var(--tw-electric-cyan)]'}"
>
	<!-- Grain overlay -->
	<div class="grain-overlay"></div>

	<!-- Top: Logo & Title -->
	<div class="relative z-10 mt-4 flex w-full flex-col items-center">
		{#if !logoError}
			<div
				class="brutalist-border bg-black p-2 {theme === 'orange'
					? 'border-[var(--nw-burning-orange)]'
					: 'border-[var(--tw-electric-cyan)]'} reveal-up delay-200"
			>
				<img
					src="/cropped-CCB-Logos_white_LG.png"
					alt="Comedy Cafe Berlin Logo"
					class="h-20 w-20 object-contain"
					on:error={() => (logoError = true)}
				/>
			</div>
		{/if}

		<!-- Week Navigation -->
		<div class="reveal-up mt-3 flex items-center gap-2 delay-300">
			<button
				on:click={() => dispatch('prev')}
				disabled={!canGoPrev || monitorMode}
				title={canGoPrev && !monitorMode ? `← ${prevWeekLabel}` : ''}
				class="flex h-8 w-8 items-center justify-center rounded transition-all
               {monitorMode ? 'invisible' : ''}
               {canGoPrev
					? theme === 'orange'
						? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/20'
						: 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/20'
					: 'cursor-not-allowed text-white/20'}"
				style="font-family: var(--font-mono);"
			>
				←
			</button>

			<div
				class="text-sm tracking-[0.3em] uppercase {theme === 'orange'
					? 'text-[var(--nw-neon-yellow)]'
					: 'text-[var(--tw-electric-cyan)]'}"
				style="font-family: var(--font-mono);"
			>
				{weekLabel}
			</div>

			<button
				on:click={() => dispatch('next')}
				disabled={!canGoNext || monitorMode}
				title={canGoNext && !monitorMode ? `→ ${nextWeekLabel}` : ''}
				class="flex h-8 w-8 items-center justify-center rounded transition-all
               {monitorMode ? 'invisible' : ''}
               {canGoNext
					? theme === 'orange'
						? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/20'
						: 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/20'
					: 'cursor-not-allowed text-white/20'}"
				style="font-family: var(--font-mono);"
			>
				→
			</button>
		</div>

		<!-- Today button - always rendered to prevent layout shift, invisible when on current week or in monitor mode -->
		<button
			on:click={() => dispatch('today')}
			class="mt-1 rounded px-2 py-0.5 text-[10px] tracking-widest uppercase transition-all
             {weekOffset === 0 || monitorMode ? 'invisible' : ''}
             {theme === 'orange'
				? 'text-white/60 hover:bg-[var(--nw-neon-yellow)]/10 hover:text-[var(--nw-neon-yellow)]'
				: 'text-white/60 hover:bg-[var(--tw-electric-cyan)]/10 hover:text-[var(--tw-electric-cyan)]'}"
			style="font-family: var(--font-mono);"
		>
			↩ Today
		</button>

		<div
			class="neon-glow reveal-up mt-2 text-center text-4xl leading-none text-white delay-400
                {theme === 'orange'
				? 'text-[var(--nw-hot-pink)]'
				: 'text-[var(--tw-electric-cyan)]'}"
			style="font-family: var(--font-display);"
		>
			COMEDY CAFE<br />BERLIN
		</div>

		<div
			class="reveal-up mx-auto mt-3 mb-1 max-w-xs text-center text-xs leading-relaxed text-white delay-500"
			style="font-family: var(--font-serif);"
		>
			Berlin's first international, alternative comedy stage, school and bar.
		</div>

		<div
			class="reveal-up mt-1 mb-2 text-center text-xs tracking-widest text-white/70 uppercase delay-500"
			style="font-family: var(--font-mono);"
		>
			Open Wed—Sun
		</div>
	</div>

	<!-- Middle: QR codes (monitor mode) or Links (normal mode) -->
	<div class="relative z-10 flex w-full flex-1 flex-col items-center justify-center gap-4">
		{#if monitorMode}
			<!-- QR Codes for Monitor Mode -->
			<div class="flex flex-row items-center justify-center gap-4">
				<div class="reveal-up flex flex-col items-center delay-300">
					<div
						class="mb-1.5 text-[10px] tracking-widest text-white uppercase {theme === 'orange'
							? 'text-[var(--nw-neon-yellow)]'
							: 'text-[var(--tw-electric-cyan)]'}"
						style="font-family: var(--font-mono);"
					>
						→ Shows
					</div>
					<div
						class="brutalist-border bg-white p-2 {theme === 'orange'
							? 'border-[var(--nw-hot-pink)]'
							: 'border-[var(--tw-electric-cyan)]'}"
					>
						<QrCode
							value="https://www.comedycafeberlin.com"
							size={100}
							color="#000"
							background="#fff"
							style="width: 100px; height: 100px; display: block;"
						/>
					</div>
				</div>

				<div class="reveal-up flex flex-col items-center delay-400">
					<div
						class="mb-1.5 text-[10px] tracking-widest text-white uppercase {theme === 'orange'
							? 'text-[var(--nw-neon-yellow)]'
							: 'text-[var(--tw-electric-cyan)]'}"
						style="font-family: var(--font-mono);"
					>
						→ Classes
					</div>
					<div
						class="brutalist-border bg-white p-2 {theme === 'orange'
							? 'border-[var(--nw-hot-pink)]'
							: 'border-[var(--tw-electric-cyan)]'}"
					>
						<QrCode
							value="https://training.comedycafeberlin.com"
							size={100}
							color="#000"
							background="#fff"
							style="width: 100px; height: 100px; display: block;"
						/>
					</div>
				</div>
			</div>
		{:else}
			<!-- Navigation Links for Normal Mode -->
			<nav class="reveal-up flex w-full max-w-[200px] flex-col delay-300">
				<!-- Internal Navigation -->
				<div class="flex flex-col gap-1">
					<a
						href="/shows"
						class="flex items-center gap-2 rounded px-3 py-2 transition-all {theme === 'orange'
							? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10'
							: 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
						style="font-family: var(--font-display);"
					>
						<span class="text-sm opacity-70">▸</span>
						<span class="text-sm tracking-wider uppercase">Shows</span>
					</a>

					<a
						href="/teams"
						class="flex items-center gap-2 rounded px-3 py-2 transition-all {theme === 'orange'
							? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10'
							: 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
						style="font-family: var(--font-display);"
					>
						<span class="text-sm opacity-70">◆</span>
						<span class="text-sm tracking-wider uppercase">Teams</span>
					</a>

					<a
						href="/performers"
						class="flex items-center gap-2 rounded px-3 py-2 transition-all {theme === 'orange'
							? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10'
							: 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
						style="font-family: var(--font-display);"
					>
						<span class="text-sm opacity-70">●</span>
						<span class="text-sm tracking-wider uppercase">Performers</span>
					</a>

					<a
						href="/analytics"
						class="flex items-center gap-2 rounded px-3 py-2 transition-all {theme === 'orange'
							? 'text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10'
							: 'text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
						style="font-family: var(--font-display);"
					>
						<span class="text-sm opacity-70">◎</span>
						<span class="text-sm tracking-wider uppercase">Analytics</span>
					</a>
				</div>

				<!-- Divider -->
				<div
					class="my-3 border-t {theme === 'orange'
						? 'border-[var(--nw-hot-pink)]/30'
						: 'border-[var(--tw-electric-cyan)]/30'}"
				></div>

				<!-- External Links -->
				<div class="flex flex-col gap-1">
					<a
						href="https://www.comedycafeberlin.com"
						target="_blank"
						rel="noopener"
						class="flex items-center gap-2 rounded px-3 py-2 transition-all {theme === 'orange'
							? 'text-[var(--nw-hot-pink)]/70 hover:bg-[var(--nw-hot-pink)]/10 hover:text-[var(--nw-hot-pink)]'
							: 'text-[var(--tw-neon-pink)]/70 hover:bg-[var(--tw-neon-pink)]/10 hover:text-[var(--tw-neon-pink)]'}"
						style="font-family: var(--font-mono);"
					>
						<span class="text-xs">↗</span>
						<span class="text-xs tracking-wider uppercase">CCB Website</span>
					</a>

					<a
						href="https://training.comedycafeberlin.com"
						target="_blank"
						rel="noopener"
						class="flex items-center gap-2 rounded px-3 py-2 transition-all {theme === 'orange'
							? 'text-[var(--nw-hot-pink)]/70 hover:bg-[var(--nw-hot-pink)]/10 hover:text-[var(--nw-hot-pink)]'
							: 'text-[var(--tw-neon-pink)]/70 hover:bg-[var(--tw-neon-pink)]/10 hover:text-[var(--tw-neon-pink)]'}"
						style="font-family: var(--font-mono);"
					>
						<span class="text-xs">↗</span>
						<span class="text-xs tracking-wider uppercase">Classes</span>
					</a>
				</div>
			</nav>
		{/if}
	</div>

	<!-- Bottom: Tagline (monitor mode only) + Monitor Mode Toggle -->
	<div class="reveal-up relative z-10 mb-4 flex flex-col items-center gap-3 delay-500">
		{#if monitorMode}
			<div
				class="text-center text-lg leading-tight font-bold text-white"
				style="font-family: var(--font-black);"
			>
				IMPROV<br />STANDUP<br />SKETCH
			</div>
		{/if}

		<!-- Monitor Mode Toggle -->
		<button
			on:click={() => dispatch('toggleMonitor')}
			class="border px-3 py-1.5 text-[10px] tracking-widest uppercase transition-all
             {monitorMode
				? theme === 'orange'
					? 'border-[var(--nw-neon-yellow)] bg-[var(--nw-neon-yellow)] text-black'
					: 'border-[var(--tw-electric-cyan)] bg-[var(--tw-electric-cyan)] text-black'
				: theme === 'orange'
					? 'border-[var(--nw-neon-yellow)]/50 text-[var(--nw-neon-yellow)] hover:bg-[var(--nw-neon-yellow)]/10'
					: 'border-[var(--tw-electric-cyan)]/50 text-[var(--tw-electric-cyan)] hover:bg-[var(--tw-electric-cyan)]/10'}"
			style="font-family: var(--font-mono);"
		>
			{monitorMode ? '● Monitor Mode' : '○ Monitor Mode'}
		</button>
	</div>

	<!-- Credits button (bottom right corner) -->
	<button
		on:click={() => (showCredits = true)}
		class="absolute right-2 bottom-2 z-20 flex h-6 w-6 items-center justify-center text-white/20 transition-colors hover:text-[var(--nw-hot-pink)]"
		title="Credits"
	>
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
			<path
				d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z"
			/>
		</svg>
	</button>

	<slot />
</section>

<!-- Credits Modal -->
{#if showCredits}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
		on:click={() => (showCredits = false)}
		on:keydown={(e) => e.key === 'Escape' && (showCredits = false)}
		role="dialog"
		tabindex="-1"
	>
		<div
			class="brutalist-border w-full max-w-sm border-[var(--tw-electric-cyan)] bg-[var(--tw-deep-purple)] p-6"
			on:click|stopPropagation
		>
			<h2
				class="mb-4 text-xl text-[var(--tw-electric-cyan)]"
				style="font-family: var(--font-display);"
			>
				About This Dashboard
			</h2>

			<div class="space-y-3 text-sm text-white/80" style="font-family: var(--font-mono);">
				<p>
					Built with love for Comedy Cafe Berlin by <a
						href="https://github.com/tlebon"
						target="_blank"
						rel="noopener"
						class="text-[var(--nw-hot-pink)] hover:underline">Timothy LeBon</a
					>.
				</p>

				<p>
					Data synced from the CCB website calendar and Community. Show lineups and performer info
					sourced from public event pages.
				</p>

				<div class="border-t border-white/10 pt-2">
					<a
						href="https://github.com/tlebon/ccb-dashboard"
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-2 text-[var(--tw-electric-cyan)] transition-colors hover:text-[var(--nw-hot-pink)]"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="currentColor"
							class="h-4 w-4"
						>
							<path
								fill-rule="evenodd"
								d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
								clip-rule="evenodd"
							/>
						</svg>
						View on GitHub
					</a>
				</div>

				<p class="pt-2 text-xs text-white/40">
					Have feedback or found a bug? Open an issue on GitHub or reach out directly to <a
						href="mailto:timothy@star-dog.net"
						class="text-[var(--nw-hot-pink)] hover:underline">timothy@star-dog.net</a
					>.
				</p>
			</div>

			<button
				on:click={() => (showCredits = false)}
				class="mt-4 w-full bg-[var(--tw-electric-cyan)] px-4 py-2 text-sm tracking-wider text-black uppercase transition-colors hover:bg-[var(--nw-hot-pink)]"
				style="font-family: var(--font-display);"
			>
				Close
			</button>
		</div>
	</div>
{/if}
