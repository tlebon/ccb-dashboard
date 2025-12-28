import { chromium } from 'playwright';

(async () => {
	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
	const page = await context.newPage();

	const logs = [];
	page.on('console', (msg) => {
		const text = msg.text();
		console.log(text);
		logs.push(text);
	});

	await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 30000 });
	await page.waitForTimeout(3000);

	console.log('\n=== Initial state ===');
	const initialShows = await page.evaluate(() => {
		const dateHeaders = document.querySelectorAll('[data-date]');
		return Array.from(dateHeaders).map((h) => h.getAttribute('data-date'));
	});
	console.log('Dates visible:', initialShows.slice(0, 5).join(', '), '...');
	console.log('Oldest date:', initialShows[0]);

	console.log('\n=== Scrolling UP directly (no down first) ===');
	for (let i = 1; i <= 10; i++) {
		await page.evaluate(() => {
			const containers = document.querySelectorAll('section.overflow-y-auto');
			if (containers[1]) {
				containers[1].scrollTop = Math.max(0, containers[1].scrollTop - 200);
			}
		});
		await page.waitForTimeout(300);
	}

	await page.waitForTimeout(2000);

	console.log('\n=== After scrolling up ===');
	const finalShows = await page.evaluate(() => {
		const dateHeaders = document.querySelectorAll('[data-date]');
		return Array.from(dateHeaders).map((h) => h.getAttribute('data-date'));
	});
	console.log('Dates visible:', finalShows.slice(0, 5).join(', '), '...');
	console.log('Oldest date:', finalShows[0]);

	const loadPastCalls = logs.filter((log) => log.includes('[LoadPast]')).length;
	console.log(`\n=== Result ===`);
	console.log(`LoadPast called: ${loadPastCalls} times`);
	console.log(`Did oldest date change? ${initialShows[0] !== finalShows[0] ? 'YES' : 'NO'}`);

	await browser.close();
})();
