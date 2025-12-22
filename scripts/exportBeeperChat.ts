/**
 * Export WhatsApp messages from Beeper Desktop API
 *
 * Setup:
 * 1. Get your Beeper access token from Beeper Desktop app settings
 *    (or from developers.beeper.com)
 * 2. Run: BEEPER_ACCESS_TOKEN=your_token npx tsx scripts/exportBeeperChat.ts
 *
 * This will:
 * - List your accounts to find the WhatsApp bridge
 * - Search for messages in the CCB Online Community chat
 * - Export them to a JSON file
 */

import BeeperDesktop from '@beeper/desktop-api';
import { writeFileSync } from 'fs';

async function main() {
	const accessToken = process.env.BEEPER_ACCESS_TOKEN;

	if (!accessToken) {
		console.error('Error: BEEPER_ACCESS_TOKEN environment variable required');
		console.error('');
		console.error('To get your token:');
		console.error('1. Open Beeper Desktop');
		console.error('2. Go to Settings > Advanced > Developer');
		console.error('3. Copy your access token');
		console.error('');
		console.error('Then run:');
		console.error('  BEEPER_ACCESS_TOKEN=your_token npx tsx scripts/exportBeeperChat.ts');
		process.exit(1);
	}

	const client = new BeeperDesktop({ accessToken });

	// Step 1: List accounts to find WhatsApp
	console.log('Listing accounts...');
	const accounts = await client.accounts.list();

	console.log('\nYour Beeper accounts:');
	for await (const account of accounts) {
		console.log(`  - ${account.id} (${account.service || 'unknown service'})`);
	}

	// Step 2: Search for CCB messages
	// You may need to adjust the accountIDs and query based on your setup
	const whatsappAccountId = process.env.BEEPER_WHATSAPP_ACCOUNT_ID;

	if (!whatsappAccountId) {
		console.log('\n---');
		console.log(
			'To export CCB chat, set BEEPER_WHATSAPP_ACCOUNT_ID to your WhatsApp account ID from above'
		);
		console.log('Then re-run the script');
		return;
	}

	console.log(`\nSearching for messages in account ${whatsappAccountId}...`);

	// Search for CCB-related messages
	const allMessages: any[] = [];

	try {
		// Try searching for schedule-related content
		for await (const message of client.messages.search({
			accountIDs: [whatsappAccountId],
			query: 'Comedy Café Berlin',
			limit: 100
		})) {
			allMessages.push(message);
			if (allMessages.length % 100 === 0) {
				console.log(`  Fetched ${allMessages.length} messages...`);
			}
		}
	} catch (err) {
		console.error('Error searching messages:', err);
	}

	console.log(`\nFound ${allMessages.length} messages`);

	// Save to file
	const outputPath = '/Users/timothylebon/dev/ccb-dashboard/src/data/beeper-export.json';
	writeFileSync(outputPath, JSON.stringify(allMessages, null, 2));
	console.log(`Saved to ${outputPath}`);
}

main().catch(console.error);
