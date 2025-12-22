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
			include: ['src/lib/**/*.{js,ts,svelte}', 'src/routes/api/**/*.ts'],
			exclude: [
				'**/*.test.{js,ts}',
				'**/*.spec.{js,ts}',
				'**/types.ts',
				'**/*.d.ts',
				'**/node_modules/**'
			],
			thresholds: {
				lines: 60, // Start modest, increase over time
				functions: 60,
				branches: 50,
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
