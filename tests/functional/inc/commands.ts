import { expect, Page } from '@playwright/test';
import type Swup from 'swup';

declare global {
	interface Window {
		_swup: Swup;
		data: any;
	}
}

export async function waitForSwup(page: Page) {
	await page.waitForSelector('html.swup-enabled');
}

export function sleep(timeout = 0): Promise<void> {
	return new Promise((resolve) => setTimeout(() => resolve(undefined), timeout));
}

export async function clickOnLink(page: Page, url: string, options?: Parameters<Page['click']>[1]) {
	await page.click(`a[href="${url}"]`, options);
	await expectToBeAt(page, url);
}

export async function scroll(page: Page, { direction = 'down', delay = 10 }: { direction?: 'down' | 'up', delay?: number } = {}) {
	await page.evaluate(async ({ direction, delay }) => {
		const scrollHeight = () => document.body.scrollHeight;
		const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
		const start = direction === 'down' ? 0 : scrollHeight();
		const shouldStop = (position: number) => direction === 'down' ? position > scrollHeight() : position < 0;
		const increment = direction === 'down' ? 100 : -100;
		console.error(start, shouldStop(start), increment);
		for (let i = start; !shouldStop(i); i += increment) {
			window.scrollTo(0, i);
			await sleep(delay);
		}
	}, { direction, delay });
}

export async function scrollTo(page: Page, y: number | string) {
	await page.evaluate(async (y) => {
		if (typeof y === 'string') {
			y = document.querySelector<HTMLElement>(y)?.offsetTop ?? 0
		}
		window.scrollTo(0, y);
	}, y);
}

export async function navigateWithSwup(
	page: Page,
	url: string,
	options?: Parameters<Swup['navigate']>[1]
) {
	await page.evaluate(
		({ url, options }) => window._swup.navigate(url, options),
		{ url, options }
	);
	await expectToBeAt(page, url);
}

export async function expectToBeAt(page: Page, url: string, title?: string) {
	await expect(page).toHaveURL(url);
	if (title) {
		await expect(page, `Expected title: ${title}`).toHaveTitle(title);
		await expect(page.locator('h1'), `Expected h1: ${title}`).toContainText(title);
	}
}

export async function expectSwupToHaveCacheEntry(page: Page, url: string) {
	const exists = () => page.evaluate((url) => window._swup.cache.has(url), url);
	await expect(async () => expect(await exists(), `Expected ${url} to be in cache`).toBe(true)).toPass();
}

export async function expectSwupNotToHaveCacheEntry(page: Page, url: string) {
	const exists = () => page.evaluate((url) => window._swup.cache.has(url), url);
	expect(await exists(), `Expected ${url} not to be in cache`).toBe(false);
}

export async function expectSwupToHaveCacheEntries(page: Page, urls: string[]) {
	for (const url of urls) {
		await expectSwupToHaveCacheEntry(page, url);
	}
}
export async function expectSwupNotToHaveCacheEntries(page: Page, urls: string[]) {
	for (const url of urls) {
		await expectSwupNotToHaveCacheEntry(page, url);
	}
}
