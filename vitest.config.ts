import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { resolve } from 'path';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Environment
		environment: 'happy-dom',

		// Include patterns
		include: ['src/**/*.{test,spec}.{js,ts}'],

		// Setup files
		setupFiles: ['./vitest.setup.ts'],

		// Coverage
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			// Only measure coverage for files that were actually imported in tests
			all: false,
			include: [
				'src/lib/utils/houseShowTeams.ts',
				'src/lib/utils/parsePerformers.ts',
				'src/lib/db/shows.ts'
			],
			exclude: [
				'**/*.test.{js,ts}',
				'**/*.spec.{js,ts}',
				'**/types.ts',
				'**/*.d.ts',
				'**/node_modules/**'
			],
			thresholds: {
				lines: 60,
				functions: 60,
				branches: 40,
				statements: 60
			}
		},

		// Globals for cleaner test syntax
		globals: true,

		// Watch options for development
		watch: false,

		// Timeout
		testTimeout: 10000
	},
	resolve: {
		alias: {
			$lib: resolve('./src/lib')
		}
	}
});
