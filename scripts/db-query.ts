#!/usr/bin/env npx tsx
/**
 * Database query wrapper script
 *
 * This script provides a consistent interface for running database queries,
 * which helps with CLI tool approval consistency.
 *
 * Usage:
 *   npx tsx scripts/db-query.ts "SQL query here"
 *   npx tsx scripts/db-query.ts -f query-file.ts
 *
 * Environment variables (loaded from .env automatically):
 *   TURSO_DATABASE_URL
 *   TURSO_AUTH_TOKEN
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env file manually
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
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.log('Usage:');
		console.log('  npx tsx scripts/db-query.ts "SELECT * FROM shows LIMIT 5"');
		console.log('  npx tsx scripts/db-query.ts -f scripts/some-query.ts');
		process.exit(1);
	}

	if (args[0] === '-f' && args[1]) {
		// Run a file
		const filePath = path.resolve(process.cwd(), args[1]);
		if (!fs.existsSync(filePath)) {
			console.error(`File not found: ${filePath}`);
			process.exit(1);
		}

		// Import and run the file (it should export a default async function)
		const module = await import(filePath);
		if (typeof module.default === 'function') {
			await module.default(db);
		} else {
			console.error('File should export a default async function that receives db client');
			process.exit(1);
		}
	} else {
		// Run SQL directly
		const sql = args.join(' ');
		try {
			const result = await db.execute(sql);
			console.log('Rows:', result.rows.length);
			if (result.rows.length > 0) {
				console.table(result.rows);
			}
		} catch (e) {
			console.error('Query error:', e);
			process.exit(1);
		}
	}
}

main().catch(console.error);

// Export db client for use in other scripts
export { db };
