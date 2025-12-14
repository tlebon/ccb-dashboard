import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import {
	ANALYTICS_COOKIE_NAME,
	ANALYTICS_COOKIE_VALUE,
	ANALYTICS_UNLOCK_PARAM,
	ANALYTICS_UNLOCK_VALUE,
	COOKIE_MAX_AGE
} from '$lib/server/analytics-constants';

export const handle: Handle = async ({ event, resolve }) => {
	const unlockParam = event.url.searchParams.get(ANALYTICS_UNLOCK_PARAM);

	// If the unlock parameter is present with correct value, set the cookie
	if (unlockParam === ANALYTICS_UNLOCK_VALUE) {
		event.cookies.set(ANALYTICS_COOKIE_NAME, ANALYTICS_COOKIE_VALUE, {
			path: '/',
			httpOnly: true,
			secure: !dev, // Only use Secure flag in production (HTTPS)
			sameSite: 'lax',
			maxAge: COOKIE_MAX_AGE
		});
	}

	return resolve(event);
};
