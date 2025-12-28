import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
	const page = await context.newPage();

	await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForTimeout(3000);

	console.log('\n=== Initial page load ===');
	const initial = await page.evaluate(() => {
		const container = document.querySelectorAll('section.overflow-y-auto')[1]; // Desktop shows column
		const topTrigger = document.querySelectorAll('[data-load-trigger-top]')[1];
		const topTriggerRect = topTrigger?.getBoundingClientRect();
		const containerRect = container?.getBoundingClientRect();

		return {
			scrollTop: container?.scrollTop,
			scrollHeight: container?.scrollHeight,
			clientHeight: container?.clientHeight,
			topTriggerTop: topTriggerRect?.top,
			containerTop: containerRect?.top,
			topTriggerOffsetFromContainerTop: topTriggerRect
				? topTriggerRect.top - containerRect.top
				: null
		};
	});
	console.log(initial);

	console.log('\n=== After scrolling up 500px ===');
	await page.evaluate(() => {
		const container = document.querySelectorAll('section.overflow-y-auto')[1];
		if (container) {
			container.scrollTop = Math.max(0, container.scrollTop - 500);
		}
	});
	await page.waitForTimeout(500);

	const afterScroll = await page.evaluate(() => {
		const container = document.querySelectorAll('section.overflow-y-auto')[1];
		return {
			scrollTop: container?.scrollTop
		};
	});
	console.log(afterScroll);

	console.log('\n=== Scrolled to absolute top (0) ===');
	await page.evaluate(() => {
		const container = document.querySelectorAll('section.overflow-y-auto')[1];
		if (container) {
			container.scrollTop = 0;
		}
	});
	await page.waitForTimeout(500);

	const atTop = await page.evaluate(() => {
		const container = document.querySelectorAll('section.overflow-y-auto')[1];
		return {
			scrollTop: container?.scrollTop
		};
	});
	console.log(atTop);

	await browser.close();
})();
