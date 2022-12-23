import Plugin from '@swup/plugin';
import delegate from 'delegate-it';
import { queryAll } from 'swup/lib/utils';
import { Link, getCurrentUrl, fetch } from 'swup/lib/helpers';

export default class PreloadPlugin extends Plugin {
	name = 'PreloadPlugin';

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

		// register mouseover handler
		swup.delegatedListeners.mouseover = delegate(
			document.body,
			swup.options.linkSelector,
			'mouseover',
			this.onMouseover.bind(this)
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

		swup._handlers.pagePreloaded = null;
		swup._handlers.hoverLink = null;

		swup.preloadPage = null;
		swup.preloadPages = null;

		swup.delegatedListeners.mouseover.destroy();

		swup.off('contentReplaced', this.onContentReplaced);
	}

	onContentReplaced = () => {
		this.swup.preloadPages();
	};

	/**
	 * Apply swup.ignoreLink (will become available in swup@3)
	 */
	shouldIgnoreVisit(href, { el } = {}) {
		if (typeof this.swup.shouldIgnoreVisit === 'function') {
			return this.swup.shouldIgnoreVisit(href, { el });
		}
		return false;
	}

	onMouseover = (event) => {
		const swup = this.swup;
		const linkEl = event.delegateTarget;
		const link = new Link(linkEl);

		swup.triggerEvent('hoverLink', event);

		// Bail early if the visit should be ignored by swup
		if (this.shouldIgnoreVisit(linkEl.href, { el: linkEl })) return;

		// Bail early if there is already a preload running
		if (swup.preloadPromise != null) return;

		swup.preloadPromise = swup.preloadPage(link.getAddress());
		swup.preloadPromise.route = link.getAddress();
		swup.preloadPromise.finally(() => {
			swup.preloadPromise = null;
		});
	};

	preloadPage = (pathname) => {
		const swup = this.swup;
		let link = new Link(pathname);

		return new Promise((resolve, reject) => {
			// Resolve and return early if the page is already in the cache
			if (swup.cache.exists(link.getAddress())) {
				resolve(swup.cache.getPage(link.getAddress()));
				return;
			}

			fetch(
				{
					url: link.getAddress(),
					headers: swup.options.requestHeaders
				},
				(response) => {
					// Reject and bail early if the server responded with an error
					if (response.status === 500) {
						swup.triggerEvent('serverError');
						reject(link.getAddress());
						return;
					}

					// Parse the JSON data from the response
					const page = swup.getPageData(response);

					// Reject and return early if something went wrong in `getPageData`
					if (page == null) {
						reject(link.getAddress());
						return;
					}

					// Finally, prepare the page, store it in the cache, trigger an event and resolve
					page.url = link.getAddress();
					swup.cache.cacheUrl(page);
					swup.triggerEvent('pagePreloaded');
					resolve(page);
				}
			);
		});
	};

	preloadPages = () => {
		queryAll('[data-swup-preload]').forEach((element) => {
			if (this.ignoreLink(element)) return;
			this.swup.preloadPage(element.href);
		});
	};
}
