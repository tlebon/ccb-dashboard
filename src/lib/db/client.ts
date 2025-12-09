import { createClient, type Client } from '@libsql/client';
import { env } from '$env/dynamic/private';

let _db: Client | null = null;

export function getDb(): Client {
	if (!_db) {
		if (!env.TURSO_DATABASE_URL) {
			throw new Error('TURSO_DATABASE_URL environment variable is not set');
		}
		_db = createClient({
			url: env.TURSO_DATABASE_URL,
			authToken: env.TURSO_AUTH_TOKEN
		});
	}
	return _db;
}

// Export db as a getter - callers should use getDb() or access db directly
// Note: db is lazily initialized on first access
export const db = {
	get execute() {
		return getDb().execute.bind(getDb());
	},
	get batch() {
		return getDb().batch.bind(getDb());
	},
	get transaction() {
		return getDb().transaction.bind(getDb());
	},
	get close() {
		return getDb().close.bind(getDb());
	}
};
