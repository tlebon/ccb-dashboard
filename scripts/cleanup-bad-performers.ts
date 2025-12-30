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

async function main() {
	// Delete the bad performer "a different improv team every week"
	const result1 = await db.execute({
		sql: 'DELETE FROM show_appearances WHERE performer_id = ?',
		args: [189]
	});
	console.log('Deleted', result1.rowsAffected, 'show_appearances');

	const result2 = await db.execute({
		sql: 'DELETE FROM performers WHERE id = ?',
		args: [189]
	});
	console.log('Deleted performer');

	// Check final count
	const count = await db.execute('SELECT COUNT(*) as count FROM show_appearances');
	console.log('Remaining show_appearances:', count.rows[0].count);
}

main().catch(console.error);
