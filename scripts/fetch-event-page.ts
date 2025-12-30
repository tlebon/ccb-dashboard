import * as fs from 'fs';
import * as path from 'path';

// Load env vars
function loadEnv() {
	const envPath = path.join(process.cwd(), '.env');
	if (fs.existsSync(envPath)) {
		const content = fs.readFileSync(envPath, 'utf-8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (trimmed && !trimmed.startsWith('#')) {
				const [key, ...valueParts] = trimmed.split('=');
				const value = valueParts.join('=').replace(/^["']|["']$/g, '');
				if (key && !process.env[key]) {
					process.env[key] = value;
				}
			}
		}
	}
}

loadEnv();

async function main() {
	const eventUrl = process.argv[2] || 'https://www.comedycafeberlin.com/event/sketch-bomb/';
	const proxyUrl = process.env.VITE_PROXY_EVENT_URL;
	const fetchUrl = `${proxyUrl}?url=${encodeURIComponent(eventUrl)}`;

	console.log('Fetching:', eventUrl);
	const response = await fetch(fetchUrl);
	const html = await response.text();

	const filename = '/tmp/ccb-event.html';
	fs.writeFileSync(filename, html);
	console.log(`Saved ${html.length} bytes to ${filename}`);

	// Also extract just the event description
	const { parse } = await import('node-html-parser');
	const root = parse(html);
	const desc = root.querySelector('.tribe-events-single-event-description');
	if (desc) {
		console.log('\n=== Event Description Text ===');
		console.log(desc.text);
	}
}

main().catch(console.error);
