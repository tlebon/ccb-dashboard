import type { PageServerLoad } from './$types';
import { ANALYTICS_COOKIE_NAME, ANALYTICS_COOKIE_VALUE } from '$lib/server/analytics-constants';

export const load: PageServerLoad = async ({ cookies }) => {
	const hasAccess = cookies.get(ANALYTICS_COOKIE_NAME) === ANALYTICS_COOKIE_VALUE;

	return {
		hasAccess
	};
};
