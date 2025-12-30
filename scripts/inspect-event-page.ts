import { parse } from 'node-html-parser';
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
	const proxyUrl = process.env.VITE_PROXY_EVENT_URL;
	const eventUrl =
		process.argv[2] || 'https://www.comedycafeberlin.com/event/comedy-safari-19-01-2025/';
	const url = `${proxyUrl}?url=${encodeURIComponent(eventUrl)}`;

	console.log(`Fetching: ${eventUrl}\n`);

	const response = await fetch(url);
	const html = await response.text();
	const root = parse(html);

	// Look for content that might contain lineup
	const contentDiv = root.querySelector('.tribe-events-single-event-description');
	if (contentDiv) {
		console.log('=== Event Description ===');
		console.log(contentDiv.text.substring(0, 1000));
		console.log('\n=== HTML Structure ===');
		console.log(contentDiv.outerHTML.substring(0, 1000));
	}

	// Look for lists
	const lists = root.querySelectorAll('ul li, ol li');
	if (lists.length > 0) {
		console.log('\n=== Found List Items ===');
		lists.slice(0, 10).forEach((li, i) => {
			console.log(`${i + 1}. ${li.text.trim()}`);
		});
	}
}

main().catch(console.error);
