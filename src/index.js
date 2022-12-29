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
			this.onMouseOver.bind(this)
		);

		// register touchstart handler
		swup.delegatedListeners.touchstart = delegate(
			document.body,
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

		swup._handlers.pagePreloaded = null;
		swup._handlers.hoverLink = null;

		swup.preloadPage = null;
		swup.preloadPages = null;

		swup.delegatedListeners.mouseover.destroy();
		swup.delegatedListeners.touchstart.destroy();

		swup.off('contentReplaced', this.onContentReplaced);
	}

	onContentReplaced = () => {
		this.swup.preloadPages();
	};

	/**
	 * Apply swup.shouldIgnoreVisit (will become available in swup@3)
	 */
	shouldIgnoreVisit(href, { el } = {}) {
		if (typeof this.swup.shouldIgnoreVisit === 'function') {
			return this.swup.shouldIgnoreVisit(href, { el });
		}
		return false;
	}

	onMouseOver = (event) => {
		this.swup.triggerEvent('hoverLink', event);

		this.preloadLink(event.delegateTarget);
	};

	onTouchStart = (event) => {
		this.preloadLink(event.delegateTarget);
	};

	preloadLink(linkEl) {
		const swup = this.swup;
		const route = new Link(linkEl).getAddress();

		// Bail early if the visit should be ignored by swup
		if (this.shouldIgnoreVisit(linkEl.href, { el: linkEl })) return;

		// Bail early if a preload for the requested route already exists
		if (swup.preloadPromise && swup.preloadPromise.route === route) return;

		swup.preloadPromise = swup.preloadPage(route, {
			abortable: true
		});
		swup.preloadPromise.finally(() => {
			swup.preloadPromise = null;
		});
	}

	/**
	 * Preloads a page. Aborts the previous request if it's abortable
	 *
	 * @param {boolean} abortable
	 */
	preloadPage = (pathname, { abortable = false } = {}) => {
		const swup = this.swup;
		const route = new Link(pathname).getAddress();
		let request = null;

		const promise = new Promise((resolve, reject) => {
			// Resolve and return early if the page is already in the cache
			if (swup.cache.exists(route)) {
				resolve(swup.cache.getPage(route));
				return;
			}

			/**
			 * If there is still another abortable preload running,
			 * abort it to save resources on the server.
			 */
			if (swup.preloadPromise?.abortable) {
				swup.preloadPromise.request.onreadystatechange = null;
				swup.preloadPromise.request.abort();
			}

			request = fetch(
				{
					url: route,
					headers: swup.options.requestHeaders
				},
				(response) => {
					this.preloadRequest = null;

					// Reject and bail early if the server responded with an error
					if (response.status === 500) {
						swup.triggerEvent('serverError');
						reject(route);
						return;
					}

					// Parse the JSON data from the response
					const page = swup.getPageData(response);

					// Reject and return early if something went wrong in `getPageData`
					if (page == null) {
						reject(route);
						return;
					}

					// Finally, prepare the page, store it in the cache, trigger an event and resolve
					page.url = route;
					swup.cache.cacheUrl(page);
					swup.triggerEvent('pagePreloaded', page);
					resolve(page);
				}
			);

		});
		promise.request = request;
		promise.abortable = abortable;
		promise.route = route;
		return promise;
	};

	preloadPages = () => {
		queryAll('[data-swup-preload]').forEach((el) => {
			if (this.shouldIgnoreVisit(el.href, { el })) return;
			this.swup.preloadPage(el.href);
		});
	};
}
