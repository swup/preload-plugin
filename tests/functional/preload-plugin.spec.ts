import { test, expect } from '@playwright/test';

import {
	sleep,
	clickOnLink,
	waitForSwup,
	navigateWithSwup,
	expectSwupToHaveCacheEntry,
	expectSwupNotToHaveCacheEntry
} from './inc/commands.js';

test.describe('instance methods', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/page-1.html');
		await waitForSwup(page);
	});
	test('adds preload methods on swup instance', async ({ page }) => {
		expect(await page.evaluate(() => typeof window._swup.preload)).toBe('function');
		expect(await page.evaluate(() => typeof window._swup.preloadLinks)).toBe('function');
	});
	test('allows preloading individual page', async ({ page }) => {
		await page.evaluate(() => window._swup.preload('/page-2.html'));
		await expectSwupToHaveCacheEntry(page, '/page-2.html');
		await expectSwupNotToHaveCacheEntry(page, '/page-3.html');
	});
	test('allows preloading multiple pages', async ({ page }) => {
		await page.evaluate(() => window._swup.preload(['/page-2.html', '/page-3.html']));
		await expectSwupToHaveCacheEntry(page, '/page-2.html');
		await expectSwupToHaveCacheEntry(page, '/page-3.html');
	});
});

test.describe('preload attributes', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/preload-attributes.html');
		await waitForSwup(page);
	});
	test('preloads links with data-swup-preload attributes', async ({ page }) => {
		await expectSwupToHaveCacheEntry(page, '/page-1.html');
		await expectSwupToHaveCacheEntry(page, '/page-3.html');
		await expectSwupNotToHaveCacheEntry(page, '/page-2.html');
	});
});

test.describe('preload initial page', () => {
	test('preloads initial page', async ({ page }) => {
		await page.goto('/page-1.html');
		await waitForSwup(page);
		await expectSwupToHaveCacheEntry(page, '/page-1.html');
	});

	test('allows disabling initial page preload', async ({ page }) => {
		await page.goto('/preload-initial-disabled.html');
		await waitForSwup(page);
		await sleep(500);
		await expectSwupNotToHaveCacheEntry(page, '/preload-initial-disabled.html');
	});
});
