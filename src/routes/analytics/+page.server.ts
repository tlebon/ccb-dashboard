import type { PageServerLoad } from './$types';

const ANALYTICS_COOKIE_NAME = 'ccb_analytics_access';

export const load: PageServerLoad = async ({ cookies }) => {
	const hasAccess = cookies.get(ANALYTICS_COOKIE_NAME) === '1';

	return {
		hasAccess
	};
};
