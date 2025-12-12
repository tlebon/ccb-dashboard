import type { Client } from '@libsql/client';

/**
 * Reset blob image URLs back to their original CCB URLs
 * This allows them to be re-cached with correct content-types
 */
export default async function (db: Client) {
	console.log('Finding shows with blob images that need to be reset...\n');

	// Get all shows with blob storage URLs
	const result = await db.execute({
		sql: `SELECT id, title, date, url, image_url FROM shows
		      WHERE image_url IS NOT NULL
		      AND image_url LIKE '%blob.vercel-storage.com%'
		      ORDER BY date DESC`,
		args: []
	});

	const shows = result.rows as Array<{
		id: number;
		title: string;
		date: string;
		url: string | null;
		image_url: string;
	}>;

	console.log(`Found ${shows.length} shows with blob images`);

	if (shows.length === 0) {
		console.log('No images to reset');
		return;
	}

	// Show sample of what will be reset
	console.log('\nSample of shows that will be reset:');
	for (const show of shows.slice(0, 5)) {
		console.log(`  ${show.date} - ${show.title}`);
		console.log(`    Current: ${show.image_url}`);
		console.log(`    Has URL: ${show.url ? 'Yes' : 'No'}\n`);
	}

	console.log(`\nThis will set image_url to NULL for ${shows.length} shows.`);
	console.log('The images will be re-cached when the iCal sync runs next.\n');

	// Reset all blob images to NULL
	const deleteResult = await db.execute({
		sql: `UPDATE shows
		      SET image_url = NULL
		      WHERE image_url LIKE '%blob.vercel-storage.com%'`,
		args: []
	});

	console.log(`✅ Reset ${shows.length} blob image URLs to NULL`);
	console.log(`\nNext steps:`);
	console.log(`1. Trigger iCal sync to re-cache images with correct content-types:`);
	console.log(`   curl -X GET "https://ccb-dashboard-six.vercel.app/api/sync/ical" \\`);
	console.log(`     -H "Authorization: Bearer \$CRON_SECRET"`);
	console.log(`\n2. Or wait for the automatic cron job to run (daily at 6am UTC)`);
}
