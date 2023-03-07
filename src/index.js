import Plugin from '@swup/plugin';
import { fetch, getCurrentUrl, Location, queryAll } from 'swup';

export default class PreloadPlugin extends Plugin {
	name = 'PreloadPlugin';

	requires = { swup: '>=3.0.0' };

	preloadPromises = new Map();

	defaults = {
		throttle: 5
	};

	constructor(options = {}) {
		super();
		this.options = { ...this.defaults, ...options };
	}

	mount() {
		const swup = this.swup;

		if (!swup.options.cache) {
			console.warn('PreloadPlugin: swup cache needs to be enabled for preloading');
			return;
		}

		swup._handlers.pagePreloaded = [];
		swup._handlers.hoverLink = [];

		swup.preloadPage = this.preloadPage;
		swup.preloadPages = this.preloadPages;

		// replace page-fetch promise handler with custom method
		this.originalSwupFetchPage = swup.fetchPage.bind(swup);
		swup.fetchPage = this.fetchPreloadedPage.bind(this);

		// register mouseenter handler
		swup.delegatedListeners.mouseenter = swup.delegateEvent(
			swup.options.linkSelector,
			'mouseenter',
			this.onMouseEnter.bind(this),
			{ capture: true }
		);

		// register touchstart handler
		swup.delegatedListeners.touchstart = swup.delegateEvent(
			swup.options.linkSelector,
			'touchstart',
			this.onTouchStart.bind(this),
			{ capture: true }
		);

		// initial preload of links with [data-swup-preload] attr
		swup.preloadPages();

		// do the same on every content replace
		swup.on('contentReplaced', this.onContentReplaced);

		// cache unmodified dom of initial/current page
		swup.preloadPage(getCurrentUrl());
	}

	unmount() {
		const swup = this.swup;

		if (!swup.options.cache) {
			return;
		}

		this.preloadPromises = null;

		swup._handlers.pagePreloaded = null;
		swup._handlers.hoverLink = null;

		swup.preloadPage = null;
		swup.preloadPages = null;

		if (this.originalSwupFetchPage) {
			swup.fetchPage = this.originalSwupFetchPage;
			this.originalSwupFetchPage = null;
		}

		swup.delegatedListeners.mouseenter.destroy();
		swup.delegatedListeners.touchstart.destroy();

		swup.off('contentReplaced', this.onContentReplaced);
	}

	onContentReplaced = () => {
		this.swup.preloadPages();
	};

	/**
	 * Apply swup.ignoreLink (will become available in swup@3)
	 */
	shouldIgnoreVisit(href, { el } = {}) {
		return this.swup.shouldIgnoreVisit(href, { el });
	}

	deviceSupportsHover() {
		return window.matchMedia('(hover: hover)').matches;
	}

	onMouseEnter = (event) => {
		// Make sure mouseenter is only fired once even on links with nested html
		if (event.target !== event.delegateTarget) return;
		// Return early on devices that don't support hover
		if (!this.deviceSupportsHover()) return;
		this.swup.triggerEvent('hoverLink', event);
		this.preloadLink(event.delegateTarget);
	};

	onTouchStart = (event) => {
		// Return early on devices that support hover
		if (this.deviceSupportsHover()) return;
		this.preloadLink(event.delegateTarget);
	};

	preloadLink(linkEl) {
		const swup = this.swup;
		const { url } = Location.fromElement(linkEl);

		// Bail early if the visit should be ignored by swup
		if (this.shouldIgnoreVisit(linkEl.href, { el: linkEl })) return;

		// Bail early if the link points to the current page
		if (url === getCurrentUrl()) return;

		// Bail early if the page is already in the cache
		if (swup.cache.exists(url)) return;

		// Bail early if there is already a preload running
		if (this.preloadPromises.has(url)) return;

		// Bail early if there are more then the maximum concurrent preloads running
		if (this.preloadPromises.size >= this.options.throttle) return;

		const preloadPromise = this.preloadPage(url);
		preloadPromise.url = url;
		preloadPromise
			.catch(() => {})
			.finally(() => {
				this.preloadPromises.delete(url);
			});
		this.preloadPromises.set(url, preloadPromise);
	}

	preloadPage = (pageUrl) => {
		const swup = this.swup;
		const { url } = Location.fromUrl(pageUrl);

		return new Promise((resolve, reject) => {
			// Resolve and return early if the page is already in the cache
			if (swup.cache.exists(url)) {
				resolve(swup.cache.getPage(url));
				return;
			}

			const headers = swup.options.requestHeaders;

			fetch({ url, headers }, (response) => {
				// Reject and bail early if the server responded with an error
				if (response.status === 500) {
					swup.triggerEvent('serverError');
					reject(url);
					return;
				}

				// Parse the JSON data from the response
				const page = swup.getPageData(response);

				// Reject and return early if something went wrong in `getPageData`
				if (!page || !page.blocks.length) {
					reject(url);
					return;
				}

				// Finally, prepare the page, store it in the cache, trigger an event and resolve
				const cacheablePageData = { ...page, url };
				swup.cache.cacheUrl(cacheablePageData);
				swup.triggerEvent('pagePreloaded');
				resolve(cacheablePageData);
			});
		});
	};

	preloadPages = () => {
		queryAll('[data-swup-preload]').forEach((el) => {
			if (this.shouldIgnoreVisit(el.href, { el })) return;
			this.swup.preloadPage(el.href);
		});
	};

	fetchPreloadedPage(data) {
		const { url } = data;

		const preloadPromise = this.preloadPromises.get(url);

		if (preloadPromise != null) return preloadPromise;

		return this.originalSwupFetchPage(data);
	}
}
