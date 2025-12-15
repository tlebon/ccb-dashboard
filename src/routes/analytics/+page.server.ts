import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { ANALYTICS_COOKIE_NAME, ANALYTICS_COOKIE_VALUE } from '$lib/server/analytics-constants';

export const load: PageServerLoad = async ({ cookies }) => {
	const hasAccess = cookies.get(ANALYTICS_COOKIE_NAME) === ANALYTICS_COOKIE_VALUE;

	// Redirect unauthorized users to homepage to hide the page's existence
	if (!hasAccess) {
		throw redirect(302, '/');
	}

	return {};
};
