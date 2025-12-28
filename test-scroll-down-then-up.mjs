import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
	const page = await context.newPage();

	const logs = [];
	page.on('console', msg => {
		const text = msg.text();
		if (text.includes('[TopObserver') || text.includes('[LoadPast')) {
			console.log(text);
			logs.push(text);
		}
	});

	await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForTimeout(3000);

	console.log('\n=== Step 1: Scroll DOWN to move away from top ===');
	for (let i = 1; i <= 5; i++) {
		await page.evaluate(() => {
			const containers = document.querySelectorAll('section.overflow-y-auto');
			if (containers[1]) { // Middle column on desktop
				containers[1].scrollTop += 500;
			}
		});
		await page.waitForTimeout(300);
	}

	console.log('\n=== Step 2: Scroll UP to trigger top observer ===');
	for (let i = 1; i <= 10; i++) {
		await page.evaluate(() => {
			const containers = document.querySelectorAll('section.overflow-y-auto');
			if (containers[1]) { // Middle column on desktop
				containers[1].scrollTop = Math.max(0, containers[1].scrollTop - 300);
			}
		});
		await page.waitForTimeout(300);
	}

	await page.waitForTimeout(2000);

	console.log('\n=== Summary ===');
	const loadPastCalls = logs.filter(log => log.includes('[LoadPast] Starting')).length;
	console.log(`LoadPast called: ${loadPastCalls} times`);

	await browser.close();
})();
