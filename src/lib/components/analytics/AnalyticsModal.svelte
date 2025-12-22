<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		open: boolean;
		onClose: () => void;
		children: Snippet;
	}

	let { title, open, onClose, children }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		onclick={onClose}
		onkeydown={handleKeydown}
		role="dialog"
		tabindex="-1"
	>
		<!-- Backdrop -->
		<div class="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>

		<!-- Modal Content -->
		<div
			class="brutalist-border relative max-h-[80vh] w-full max-w-2xl overflow-hidden bg-[var(--tw-deep-purple)]"
			onclick={(e) => e.stopPropagation()}
			role="document"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b-2 border-[var(--nw-burning-orange)]/30 p-4"
			>
				<h2
					class="text-2xl text-[var(--nw-burning-orange)]"
					style="font-family: var(--font-display);"
				>
					{title}
				</h2>
				<button onclick={onClose} class="px-2 text-2xl leading-none text-white/50 hover:text-white">
					×
				</button>
			</div>

			<!-- Scrollable Content -->
			<div class="overflow-y-auto p-4 text-white" style="max-height: calc(80vh - 80px);">
				{@render children()}
			</div>
		</div>
	</div>
{/if}
