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

// For backwards compatibility - lazy initialization
export const db = new Proxy({} as Client, {
	get(_, prop) {
		return (getDb() as any)[prop];
	}
});
