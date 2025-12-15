<script lang="ts">
	import '../app.css';
	import { setContext } from 'svelte';

	let { children, data } = $props();

	// Make analytics access available to all components via context
	setContext('analyticsAccess', data.hasAnalyticsAccess);
</script>

{@render children()}
