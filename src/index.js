import Plugin from '@swup/plugin';
import delegate from 'delegate';
import { queryAll } from 'swup/lib/utils';
import { Link, getCurrentUrl, fetch } from 'swup/lib/helpers';

import 'requestidlecallback';

export default class PreloadPlugin extends Plugin {
	name = 'PreloadPlugin';

	constructor(options = {}) {
		super();

		const defaultOptions = {
			useRequestIdleCallback: true,
			useOnMouseOverPreload: true
		};

		this.options = {
			...defaultOptions,
			...options
		};
	}

	mount() {
		const swup = this.swup;

		swup._handlers.pagePreloaded = [];
		swup._handlers.hoverLink = [];

		swup.preloadPage = this.preloadPage;
		swup.preloadPages = this.preloadPages;

		// register mouseover handler
		if (this.options.useOnMouseOverPreload) {
			swup.delegatedListeners.mouseover = delegate(
				document.body,
				swup.options.linkSelector,
				'mouseover',
				this.onMouseover.bind(this)
			);
		}

		// initial preload of page form links with [data-swup-preload]
		swup.preloadPages();

		// do the same on every content replace
		swup.on('contentReplaced', this.onContentReplaced);
	}

	unmount() {
		const swup = this.swup;

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

	onMouseover = (event) => {
		const swup = this.swup;

		swup.triggerEvent('hoverLink', event);

		const link = new Link(event.delegateTarget);
		if (
			link.getAddress() !== getCurrentUrl() &&
			!swup.cache.exists(link.getAddress()) &&
			swup.preloadPromise == null
		) {
			swup.preloadPromise = swup.preloadPage(link.getAddress());
			swup.preloadPromise.route = link.getAddress();
			swup.preloadPromise.finally(() => {
				swup.preloadPromise = null;
			});
		}
	};

	preloadPage = (pathname) => {
		const swup = this.swup;

		let link = new Link(pathname);

		if (link.getAddress() === getCurrentUrl() || swup.cache.exists(link.getAddress())) {
			return Promise.resolve(swup.cache.getPage(link.getAddress()));
		}

		if (this.options.useRequestIdleCallback) {
			return new Promise((resolve, reject) => {
				requestIdleCallback(() => {
					this.fetchPage(link)
						.then(resolve)
						.catch(reject);
				});
			});
		} else {
			return this.fetchPage(link);
		}
	};

	fetchPage = (link) => {
		const swup = this.swup;

		return new Promise((resolve, reject) => {
			fetch(
				{
					url: link.getAddress(),
					headers: swup.options.requestHeaders
				},
				(response) => {
					if (response.status === 500) {
						swup.triggerEvent('serverError');
						reject();
					} else {
						// get json data
						let page = swup.getPageData(response);
						if (page != null) {
							page.url = link.getAddress();
							swup.cache.cacheUrl(page, swup.options.debugMode);
							swup.triggerEvent('pagePreloaded');
						} else {
							reject(link.getAddress());
							return;
						}
						resolve(swup.cache.getPage(link.getAddress()));
					}
				}
			);
		});
	};

	preloadPages = () => {
		queryAll('[data-swup-preload]').forEach((element) => {
			if (this.options.useRequestIdleCallback) {
				requestIdleCallback(() => {
					this.swup.preloadPage(element.href);
				});
			} else {
				this.swup.preloadPage(element.href);
			}
		});
	};
}
