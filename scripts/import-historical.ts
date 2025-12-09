import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const db = createClient({
	url: process.env.TURSO_DATABASE_URL || '',
	authToken: process.env.TURSO_AUTH_TOKEN || ''
});

const dataDir = join(import.meta.dirname, '..', 'src', 'data');
const historicalData = JSON.parse(readFileSync(join(dataDir, 'historical-shows.json'), 'utf-8'));

let count = 0;
for (const show of historicalData) {
	await db.execute({
		sql: 'INSERT INTO shows (title, date, time, source) VALUES (?, ?, ?, ?)',
		args: [show.title, show.date, show.time || null, 'ical']
	});
	count++;
}
console.log(`Imported ${count} historical shows`);

const result = await db.execute('SELECT COUNT(*) as count FROM shows');
console.log('Total shows:', result.rows[0].count);
