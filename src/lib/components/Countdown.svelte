<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	interface Show {
		id: string;
		title: string;
		date: Date;
		time: string;
	}

	export let nextShow: Show | null = null;

	let timeLeft = {
		hours: 0,
		minutes: 0,
		seconds: 0
	};

	let interval: ReturnType<typeof setInterval>;

	function calculateTimeLeft() {
		if (!nextShow) return;

		const now = new Date();
		const showTime = new Date(nextShow.date);
		showTime.setHours(
			parseInt(nextShow.time.split(':')[0]),
			parseInt(nextShow.time.split(':')[1]),
			0
		);

		const difference = showTime.getTime() - now.getTime();

		if (difference > 0) {
			timeLeft = {
				hours: Math.floor(difference / (1000 * 60 * 60)),
				minutes: Math.floor((difference / 1000 / 60) % 60),
				seconds: Math.floor((difference / 1000) % 60)
			};
		} else {
			timeLeft = { hours: 0, minutes: 0, seconds: 0 };
		}
	}

	onMount(() => {
		calculateTimeLeft();
		interval = setInterval(calculateTimeLeft, 1000);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});
</script>

<div class="countdown-container rounded-lg bg-gray-800 p-6 text-white shadow-lg">
	{#if nextShow}
		<div class="text-center">
			<h3 class="mb-2 text-xl font-semibold">Next Show: {nextShow.title}</h3>
			<div class="countdown-timer flex justify-center space-x-4">
				<div class="time-block">
					<span class="text-4xl font-bold">{timeLeft.hours.toString().padStart(2, '0')}</span>
					<span class="text-sm">Hours</span>
				</div>
				<div class="time-block">
					<span class="text-4xl font-bold">{timeLeft.minutes.toString().padStart(2, '0')}</span>
					<span class="text-sm">Minutes</span>
				</div>
				<div class="time-block">
					<span class="text-4xl font-bold">{timeLeft.seconds.toString().padStart(2, '0')}</span>
					<span class="text-sm">Seconds</span>
				</div>
			</div>
		</div>
	{:else}
		<div class="text-center">
			<h3 class="text-xl font-semibold">No upcoming shows scheduled</h3>
		</div>
	{/if}
</div>

<style>
	.countdown-container {
		max-width: 600px;
		margin: 0 auto;
	}

	.time-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		background: rgba(255, 255, 255, 0.1);
		padding: 1rem;
		border-radius: 0.5rem;
		min-width: 100px;
	}

	.time-block span:first-child {
		color: #60a5fa;
	}
</style>
