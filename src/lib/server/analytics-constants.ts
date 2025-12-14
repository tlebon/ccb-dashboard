import { env } from '$env/dynamic/private';

// Constants for analytics access control
// To revoke all existing access, increment ANALYTICS_VERSION (e.g., v1 -> v2)
export const ANALYTICS_VERSION = 'v1';
export const ANALYTICS_COOKIE_NAME = `ccb_analytics_access_${ANALYTICS_VERSION}`;
export const ANALYTICS_COOKIE_VALUE = '1';
export const ANALYTICS_UNLOCK_PARAM = 'analytics';
export const ANALYTICS_UNLOCK_VALUE = env.ANALYTICS_UNLOCK_SECRET || 'unlock'; // Default for development
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
