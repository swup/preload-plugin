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
		await page.evaluate(() => window._swup.preload!('/page-2.html'));
		await expectSwupToHaveCacheEntry(page, '/page-2.html');
		await expectSwupNotToHaveCacheEntry(page, '/page-3.html');
	});
	test('allows preloading multiple pages', async ({ page }) => {
		await page.evaluate(() => window._swup.preload!(['/page-2.html', '/page-3.html']));
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

test.describe('initial page', () => {
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

test.describe('active links', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/page-1.html');
		await waitForSwup(page);
	});

	test('preloads links on focus', async ({ page }) => {
		await expectSwupNotToHaveCacheEntry(page, '/page-2.html');
		await page.focus('a[href="/page-2.html"]');
		await expectSwupToHaveCacheEntry(page, '/page-2.html');
	});

	test('preloads links on hover', async ({ page, isMobile }) => {
		test.skip(isMobile, 'test hover on desktop only');

		await expectSwupNotToHaveCacheEntry(page, '/page-2.html');
		await page.hover('a[href="/page-2.html"]');
		await expectSwupToHaveCacheEntry(page, '/page-2.html');
	});

	test('preloads links on touchstart', async ({ page, isMobile }) => {
		test.skip(!isMobile, 'test touch on mobile only');

		await page.evaluate(() => {
			// Rewrite url to make sure the cached page is from preloading
			window._swup.hooks.on('visit:start', (visit) => (visit.to.url = '/page-3.html'));
		});
		await expectSwupNotToHaveCacheEntry(page, '/page-2.html');
		await page.tap('a[href="/page-2.html"]');
		await expectSwupToHaveCacheEntry(page, '/page-2.html');
		await expectSwupToHaveCacheEntry(page, '/page-3.html');
	});
});

test.describe('hooks', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/page-1.html');
		await waitForSwup(page);
	});
	test('triggers page:preload hook on focus', async ({ page }) => {
		await page.evaluate(() => {
			window._swup.hooks.on('page:preload', () => (window.data = true));
		});
		await page.focus('a[href="/page-2.html"]');
		const triggered = () => page.evaluate(() => window.data);
		await expect(async () => expect(await triggered()).toBe(true)).toPass();
	});
	test('triggers page:preload hook from API', async ({ page }) => {
		await page.evaluate(() => {
			window._swup.hooks.on('page:preload', () => (window.data = true));
			window._swup.preload!('/page-2.html');
		});
		const triggered = () => page.evaluate(() => window.data);
		await expect(async () => expect(await triggered()).toBe(true)).toPass();
	});
});
