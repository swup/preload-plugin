import { test, expect } from '@playwright/test';

import {
	sleep,
	clickOnLink,
	waitForSwup,
	navigateWithSwup,
	expectSwupToHaveCacheEntry,
	expectSwupNotToHaveCacheEntry
} from './inc/commands.js';

test.describe('preload initial page', () => {
	test('preloads initial page', async ({ page }) => {
		await page.goto('/preload-initial.html');
		await waitForSwup(page);
		await expectSwupToHaveCacheEntry(page, '/preload-initial.html');
	});

	test('allows disabling initial page preload', async ({ page }) => {
		await page.goto('/preload-initial-disabled.html');
		await waitForSwup(page);
		await sleep(500);
		await expectSwupNotToHaveCacheEntry(page, '/preload-initial-disabled.html');
	});
});
