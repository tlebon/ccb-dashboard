import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { timingSafeEqual } from 'crypto';

// Constants for analytics access control
// To revoke all existing access, increment ANALYTICS_VERSION (e.g., v1 -> v2)
export const ANALYTICS_VERSION = 'v1';
export const ANALYTICS_COOKIE_NAME = `ccb_analytics_access_${ANALYTICS_VERSION}`;
export const ANALYTICS_COOKIE_VALUE = '1';
export const ANALYTICS_UNLOCK_PARAM = 'analytics';
export const ANALYTICS_UNLOCK_VALUE = env.ANALYTICS_UNLOCK_SECRET || 'unlock'; // Default for development
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

// Warn if using default unlock secret in production
if (!dev && ANALYTICS_UNLOCK_VALUE === 'unlock') {
	console.warn('⚠️  ANALYTICS_UNLOCK_SECRET not set - using default "unlock" value in production!');
}

/**
 * Constant-time comparison to prevent timing attacks.
 * Compares the input string against the expected unlock secret without leaking
 * information through response time differences.
 */
export function isValidUnlockSecret(input: string | null): boolean {
	if (!input) return false;

	const expected = ANALYTICS_UNLOCK_VALUE;

	// Length check with constant-time dummy comparison to prevent timing leak
	if (input.length !== expected.length) {
		// Perform dummy comparison to maintain constant time
		timingSafeEqual(Buffer.from(expected), Buffer.from(expected));
		return false;
	}

	try {
		return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
	} catch {
		return false;
	}
}
