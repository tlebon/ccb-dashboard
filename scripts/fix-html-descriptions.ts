/**
 * Fix HTML-entity encoded descriptions in the database
 * Decodes &lt;p&gt; to <p>, etc., then strips HTML tags
 */

import { createClient } from '@libsql/client';
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

const db = createClient({
	url: process.env.TURSO_DATABASE_URL!,
	authToken: process.env.TURSO_AUTH_TOKEN
});

function decodeHTMLEntities(text: string): string {
	const entities: Record<string, string> = {
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#039;': "'",
		'&apos;': "'",
		'&#8217;': "'",
		'&amp;': '&' // Must be last to avoid double-decoding
	};

	let decoded = text;
	for (const [entity, char] of Object.entries(entities)) {
		decoded = decoded.replace(new RegExp(entity, 'g'), char);
	}

	// Handle numeric entities like &#8217;
	decoded = decoded.replace(/&#(\d+);/g, (_match, code) => {
		return String.fromCharCode(parseInt(code));
	});

	// Also handle escaped quotes
	decoded = decoded.replace(/\\'/g, "'");
	decoded = decoded.replace(/\\"/g, '"');

	return decoded;
}

async function main() {
	console.log('Fixing HTML-encoded descriptions...\n');

	// Get all shows with descriptions containing HTML entities
	const shows = await db.execute({
		sql: `SELECT id, title, description FROM shows WHERE description LIKE '%&lt;%' OR description LIKE '%&gt;%' OR description LIKE '%\\\\%'`
	});

	console.log(`Found ${shows.rows.length} shows with HTML-encoded descriptions`);

	let fixed = 0;

	for (const show of shows.rows) {
		const originalDesc = show.description as string;
		if (!originalDesc) continue;

		// Decode entities, strip HTML tags, and trim
		const decoded = decodeHTMLEntities(originalDesc);
		const cleaned = decoded.replace(/<[^>]*>/g, '').trim();

		if (cleaned !== originalDesc) {
			await db.execute({
				sql: 'UPDATE shows SET description = ? WHERE id = ?',
				args: [cleaned, show.id]
			});
			fixed++;

			if (fixed <= 5) {
				console.log(`\nFixed: ${show.title}`);
				console.log(`  Before: ${originalDesc.substring(0, 100)}...`);
				console.log(`  After:  ${cleaned.substring(0, 100)}...`);
			}
		}
	}

	console.log(`\n✅ Fixed ${fixed} descriptions`);
}

main().catch(console.error);
