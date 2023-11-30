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
		await expect(page).toHaveTitle(title);
		await expect(page.locator('h1')).toContainText(title);
	}
}

export async function expectSwupToHaveCacheEntry(page: Page, url: string) {
	const exists = () => page.evaluate((url) => window._swup.cache.has(url), url);
	await expect(async () => expect(await exists()).toBe(true)).toPass();
}

export async function expectSwupNotToHaveCacheEntry(page: Page, url: string) {
	const exists = () => page.evaluate((url) => window._swup.cache.has(url), url);
	expect(await exists()).toBe(false);
}

export async function expectSwupToHaveCacheEntries(page: Page, urls: string[]) {
	for (const url of urls) {
		await expectSwupToHaveCacheEntry(page, url);
	}
}
