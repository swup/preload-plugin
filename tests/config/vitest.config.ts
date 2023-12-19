/**
 * Vitest config file
 * @see https://vitest.dev/config/
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'jsdom',
		include: [
			'tests/unit/**/*.test.ts'
		],
		setupFiles: [
			'tests/config/vitest.setup.ts'
		]
	}
});
