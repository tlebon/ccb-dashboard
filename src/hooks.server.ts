import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { dev } from '$app/environment';
import {
	ANALYTICS_COOKIE_NAME,
	ANALYTICS_COOKIE_VALUE,
	ANALYTICS_UNLOCK_PARAM,
	COOKIE_MAX_AGE,
	isValidUnlockSecret
} from '$lib/server/analytics-constants';

export const handle: Handle = async ({ event, resolve }) => {
	const unlockParam = event.url.searchParams.get(ANALYTICS_UNLOCK_PARAM);

	// If the unlock parameter is present with correct value, set the cookie and redirect
	// Uses constant-time comparison to prevent timing attacks
	if (isValidUnlockSecret(unlockParam)) {
		event.cookies.set(ANALYTICS_COOKIE_NAME, ANALYTICS_COOKIE_VALUE, {
			path: '/',
			httpOnly: true,
			secure: !dev, // Only use Secure flag in production (HTTPS)
			sameSite: 'lax',
			maxAge: COOKIE_MAX_AGE
		});

		// Redirect to remove secret from URL bar and browser history
		const url = new URL(event.url);
		url.searchParams.delete(ANALYTICS_UNLOCK_PARAM);
		throw redirect(302, url.pathname + url.search);
	}

	return resolve(event);
};
