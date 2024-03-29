import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://localhost:8274';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
	/* Run this file before starting the tests */
	globalSetup: path.resolve(__dirname, './playwright.setup.ts'),
	/* Run this file after all the tests have finished */
	// globalTeardown: path.resolve(__dirname, './playwright.teardown.ts'),
	/* Directory containing the test files */
	testDir: '../functional',
	/* Folder for test artifacts: screenshots, videos, ... */
	outputDir: '../results',
	/* Timeout individual tests after 5 seconds */
	timeout: 10_000,
	/* Run tests in files in parallel */
	fullyParallel: true,
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	/* Retry on CI only */
	retries: process.env.CI ? 1 : 0,
	/* Limit parallel workers on CI, use default locally. */
	workers: process.env.CI ? 1 : undefined,
	// Limit the number of failures on CI to save resources
	maxFailures: process.env.CI ? 10 : undefined,
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: process.env.CI
		? [['dot'], ['github'], ['json', { outputFile: '../../playwright-results.json' }]]
		: [['list'], ['html', { outputFolder: '../reports/html', open: 'on-failure' }]],

	expect: {
		/* Timeout async expect matchers after 3 seconds */
		timeout: 3_000
	},

	/* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL,
		/* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
		trace: 'on-first-retry',
		/* Capture screenshot after each test failure. */
		screenshot: 'only-on-failure',
		/* Capture video if failed tests. */
		video: 'retain-on-failure'
	},

	/* Configure projects for major browsers */
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		{ name: 'firefox', use: {
				...devices['Desktop Firefox'],
				launchOptions: {
					firefoxUserPrefs: {
						// https://github.com/microsoft/playwright/issues/7769#issuecomment-966098074
						// Set to support fine pointer: 0x02 = FINE_POINTER; 0x04 = HOVER_CAPABLE_POINTER
						'ui.primaryPointerCapabilities': 0x02 | 0x04,
						'ui.allPointerCapabilities': 0x02 | 0x04
					}
				}
			}
		},
		{ name: 'webkit', use: { ...devices['Desktop Safari'] } },
		{ name: 'ios', use: { ...devices['iPhone 13'] } }
	],

	/* Run your local dev server before starting the tests */
	webServer: {
		url: baseURL,
		command: 'npm run test:e2e:serve',
		reuseExistingServer: !process.env.CI
	}
});
