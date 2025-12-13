import type { LayoutServerLoad } from './$types';

const ANALYTICS_COOKIE_NAME = 'ccb_analytics_access';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const hasAnalyticsAccess = cookies.get(ANALYTICS_COOKIE_NAME) === '1';

	return {
		hasAnalyticsAccess
	};
};
