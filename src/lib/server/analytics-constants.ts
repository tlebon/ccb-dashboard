import { env } from '$env/dynamic/private';

// Constants for analytics access control
export const ANALYTICS_COOKIE_NAME = 'ccb_analytics_access';
export const ANALYTICS_COOKIE_VALUE = '1';
export const ANALYTICS_UNLOCK_PARAM = 'analytics';
export const ANALYTICS_UNLOCK_VALUE = env.ANALYTICS_UNLOCK_SECRET || 'unlock'; // Default for development
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
