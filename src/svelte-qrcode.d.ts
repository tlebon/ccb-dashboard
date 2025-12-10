declare module 'svelte-qrcode' {
	import type { SvelteComponent } from 'svelte';
	export default class QrCode extends SvelteComponent<{
		value: string;
		size?: number;
		color?: string;
		background?: string;
		style?: string;
	}> {}
}
