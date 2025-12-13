import type { Handle } from '@sveltejs/kit';

const ANALYTICS_COOKIE_NAME = 'ccb_analytics_access';
const ANALYTICS_UNLOCK_PARAM = 'analytics';
const ANALYTICS_UNLOCK_VALUE = 'unlock';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const handle: Handle = async ({ event, resolve }) => {
	const url = event.url;
	const unlockParam = url.searchParams.get(ANALYTICS_UNLOCK_PARAM);

	// If the unlock parameter is present with correct value, set the cookie
	if (unlockParam === ANALYTICS_UNLOCK_VALUE) {
		const response = await resolve(event);

		// Clone the response to add the cookie header
		const newResponse = new Response(response.body, response);
		newResponse.headers.append(
			'Set-Cookie',
			`${ANALYTICS_COOKIE_NAME}=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`
		);

		return newResponse;
	}

	return resolve(event);
};
