import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
	cleanup();
});

// Mock environment variables for tests
process.env.TURSO_DATABASE_URL = 'file::memory:?cache=shared';
process.env.TURSO_AUTH_TOKEN = 'test-token';
process.env.VITE_PROXY_ICAL_URL = 'http://localhost:3000/proxy/ical';
process.env.VITE_PROXY_EVENT_URL = 'http://localhost:3000/proxy/event';
process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';
