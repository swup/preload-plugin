import { test, expect } from '@playwright/test';

import {
	sleep,
	clickOnLink,
	waitForSwup,
	navigateWithSwup,
	expectSwupToHaveCacheEntry,
	expectSwupNotToHaveCacheEntry,
	expectSwupToHaveCacheEntries,
	expectSwupNotToHaveCacheEntries,
	scroll,
	scrollTo
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
	test('returns the cache entry if already preloaded', async ({ page }) => {
		const result = await page.evaluate(async () => {
			await window._swup.preload!('/page-2.html');
			const second = window._swup.preload!('/page-2.html');
			return second;
		});
		expect(result).toHaveProperty('url');
		expect(result).toHaveProperty('html');
		expect(typeof result.url).toBe('string');
		expect(typeof result.html).toBe('string');
	});
	test('returns the preload promise if currently preloading', async ({ page }) => {
		const result = await page.evaluate(async () => {
			window._swup.preload!('/page-2.html');
			const second = await window._swup.preload!('/page-2.html');
			return second;
		});
		expect(result).toHaveProperty('url');
		expect(result).toHaveProperty('html');
		expect(typeof result.url).toBe('string');
		expect(typeof result.html).toBe('string');
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

	test('respects swup link selector', async ({ page }) => {
		await page.goto('/link-selector-default.html');
		await waitForSwup(page);
		await page.focus('svg a');
		await sleep(200);
		await expectSwupNotToHaveCacheEntry(page, '/page-2.html');
	});

	test('allows modified swup link selector', async ({ page }) => {
		await page.goto('/link-selector-modified.html');
		await waitForSwup(page);
		await page.focus('svg a');
		await expectSwupToHaveCacheEntry(page, '/page-2.html');
	});
});

test.describe('visible links', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/visible-links.html');
	});

	test('does not by default preload links initially in view', async ({ page }) => {
		await page.goto('/page-1.html');
		await sleep(200);
		await expectSwupNotToHaveCacheEntries(page, ['/page-2.html', '/page-3.html']);
	});

	test('preloads links initially in view', async ({ page }) => {
		await expectSwupNotToHaveCacheEntries(page, [
			'/page-1.html',
			'/page-2.html',
			'/page-3.html'
		]);
		// await sleep(500);
		await expectSwupToHaveCacheEntries(page, ['/page-1.html', '/page-2.html']);
		await expectSwupNotToHaveCacheEntries(page, ['/page-3.html', '/page-4.html']);
	});

	test('preloads links after viewport change', async ({ page }) => {
		await expectSwupToHaveCacheEntries(page, ['/page-1.html', '/page-2.html']);
		await expectSwupNotToHaveCacheEntries(page, ['/page-3.html', '/page-4.html']);
		// Scroll page link #3 into view
		await scrollTo(page, 'a[href="/page-3.html"]');
		await expectSwupToHaveCacheEntries(page, ['/page-3.html', '/page-4.html']);
	});

	test('skips links when scrolling by quickly', async ({ page }) => {
		await expectSwupToHaveCacheEntries(page, ['/page-1.html', '/page-2.html']);
		await expectSwupNotToHaveCacheEntries(page, ['/page-3.html', '/page-9.html']);
		// Scroll down quickly, skipping links in the middle
		await scroll(page, { direction: 'down', delay: 10 });
		await expectSwupToHaveCacheEntries(page, ['/page-9.html']);
		await expectSwupNotToHaveCacheEntries(page, ['/page-5.html']);
	});

	test('preloads links when scrolling by slowly', async ({ page }) => {
		await expectSwupToHaveCacheEntries(page, ['/page-1.html', '/page-2.html']);
		await expectSwupNotToHaveCacheEntries(page, ['/page-3.html', '/page-9.html']);
		// Scroll down slowly, preloading links in the middle
		await scroll(page, { direction: 'down', delay: 100 });
		await expectSwupToHaveCacheEntries(page, [
			'/page-3.html',
			'/page-6.html',
			'/page-8.html',
			'/page-9.html'
		]);
	});

	test('allows configuring options', async ({ page }) => {
		await page.goto('/visible-links-options.html');
		await expectSwupToHaveCacheEntries(page, ['/page-1.html']);
		// Scroll down quickly, still preloading in the middle
		await scroll(page, { direction: 'down', delay: 10 });
		await expectSwupToHaveCacheEntries(page, ['/page-3.html', '/page-6.html', '/page-8.html']);
		await expectSwupNotToHaveCacheEntries(page, ['/page-2.html']); // ignored via ignore()
		await expectSwupNotToHaveCacheEntries(page, ['/page-9.html']); // ignored via containers
	});

	test('respects swup link selector', async ({ page }) => {
		await page.goto('/visible-links-selector.html');
		// await scroll(page, { direction: 'down', delay: 10 });
		await sleep(200);
		await expectSwupToHaveCacheEntries(page, ['/page-1.html', '/page-3.html', '/page-5.html']);
		await expectSwupNotToHaveCacheEntries(page, ['/page-2.html', '/page-4.html']); // ignored via linkSelector option
	});
});

test.describe('throttle', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/throttle.html');
		await waitForSwup(page);
	});
	test('limits number of concurrent requests', async ({ page }) => {
		await page.evaluate(() => {
			window.data = {
				count: 0,
				max: 0,
				inc() {
					this.count++;
					this.max = Math.max(this.max, this.count);
				},
				dec() {
					this.count--;
				}
			};
			window._swup.hooks.before('page:preload', () => window.data.inc());
			window._swup.hooks.on('page:preload', () => window.data.dec());
			window._swup.preload!([1, 2, 3, 4, 5, 6, 7, 8].map((n) => `/page-${n}.html`));
		});
		await page.focus('a[href="/page-2.html"]');
		const max = () => page.evaluate(() => window.data.max);
		await expect(async () => expect(await max()).toBe(4)).toPass();
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

test.describe('ignores external origins', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/origins.html');
		await waitForSwup(page);
		await page.evaluate(() => {
			window.data = [];
			window._swup.hooks.before('page:preload', (visit, { url }) => window.data.push(url));
		});
	});
	test('ignores link elements with external origin', async ({ page }) => {
		await page.focus('a[href$="/page-1.html"]');
		await page.focus('a[href$="/page-2.html"]');
		await page.focus('a[href$="/page-3.html"]');
		const urls = await page.evaluate(() => window.data);
		expect(urls).toEqual(['/page-1.html', '/page-2.html']);
	});
	test('ignores preload requests with external origin', async ({ page }) => {
		await page.evaluate(() => {
			window._swup.preload!([
				'https://example.net/page-3.html',
				'/page-1.html',
				'page-2.html'
			]);
		});
		const urls = await page.evaluate(() => window.data);
		expect(urls).toEqual(['/page-1.html', '/page-2.html']);
	});
});
