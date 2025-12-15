import type { LayoutServerLoad } from './$types';
import { ANALYTICS_COOKIE_NAME, ANALYTICS_COOKIE_VALUE } from '$lib/server/analytics-constants';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const hasAnalyticsAccess = cookies.get(ANALYTICS_COOKIE_NAME) === ANALYTICS_COOKIE_VALUE;

	return {
		hasAnalyticsAccess
	};
};
