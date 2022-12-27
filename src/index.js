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

		// Will hold a reference to the current preload request,
		// So that it can be aborted
		this.preloadRequest = null;

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

		clearTimeout(this.mouseOverTimeout);
		this.mouseOverTimeout = undefined;
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
		const link = new Link(linkEl);

		// Bail early if the visit should be ignored by swup
		if (this.shouldIgnoreVisit(linkEl.href, { el: linkEl })) return;

		swup.preloadPromise = swup.preloadPage(link.getAddress(), {
			abortPreviousRequest: true
		});
		swup.preloadPromise.route = link.getAddress();
		swup.preloadPromise.finally(() => {
			swup.preloadPromise = null;
		});
	}

	preloadPage = (pathname, { abortPreviousRequest = false } = {}) => {
		const swup = this.swup;
		let link = new Link(pathname);

		return new Promise((resolve, reject) => {
			// Resolve and return early if the page is already in the cache
			if (swup.cache.exists(link.getAddress())) {
				resolve(swup.cache.getPage(link.getAddress()));
				return;
			}

			/**
			 * The requested page is not in the cache yet, so we want to
			 * preload it. If `abortPreviousRequest` is set to true, a
			 * possibly running previous preload request will be aborted
			 * before starting the new request. This will save server
			 * resources and make sure that a hovered/touched link's href
			 * will always be preloaded.
			 */
			if (abortPreviousRequest && this.preloadRequest != null) {
				this.preloadRequest.onreadystatechange = null;
				this.preloadRequest.abort();
				this.preloadRequest = null;
			}

			this.preloadRequest = fetch(
				{
					url: link.getAddress(),
					headers: swup.options.requestHeaders
				},
				(response) => {
					this.preloadRequest = null;

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
		queryAll('[data-swup-preload]').forEach((el) => {
			if (this.shouldIgnoreVisit(el.href, { el })) return;
			this.swup.preloadPage(el.href);
		});
	};
}
