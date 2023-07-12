import Plugin from '@swup/plugin';
import { getCurrentUrl, Location, queryAll } from 'swup';

export default class SwupPreloadPlugin extends Plugin {
	name = 'SwupPreloadPlugin';

	requires = { swup: '>=4' };

	preloadPromises = new Map();

	defaults = {
		throttle: 5,
		preloadInitialPage: true
	};

	constructor(options = {}) {
		super();
		this.options = { ...this.defaults, ...options };
	}

	mount() {
		const swup = this.swup;

		if (!swup.options.cache) {
			console.warn('SwupPreloadPlugin: swup cache needs to be enabled for preloading');
			return;
		}

		swup.hooks.create('page:preload');
		swup.hooks.create('link:hover');

		swup.preload = this.preload;
		swup.preloadAll = this.preloadAll;

		// register mouseenter handler
		this.mouseEnterDelegate = swup.delegateEvent(
			swup.options.linkSelector,
			'mouseenter',
			this.onMouseEnter.bind(this),
			{ capture: true }
		);

		// register touchstart handler
		this.touchStartDelegate = swup.delegateEvent(
			swup.options.linkSelector,
			'touchstart',
			this.onTouchStart.bind(this),
			{ capture: true }
		);

		// initial preload of links with [data-swup-preload] attr
		this.preloadAll();

		// do the same whenever a new page is loaded
		swup.hooks.on('page:view', this.onPageView);

		// inject custom promise whenever a page is requested
		swup.hooks.replace('page:request', this.onPageRequest);

		// cache unmodified dom of initial/current page
		if (this.options.preloadInitialPage) {
			this.preload(getCurrentUrl());
		}
	}

	unmount() {
		const swup = this.swup;

		if (!swup.options.cache) {
			return;
		}

		this.preloadPromises.clear();

		swup.preload = null;
		swup.preloadAll = null;

		this.mouseEnterDelegate.destroy();
		this.touchStartDelegate.destroy();

		swup.hooks.off('page:view', this.onPageView);
		swup.hooks.off('page:request', this.onPageRequest);
	}

	onPageView = () => {
		this.preloadAll();
	};

	onPageRequest = (context, args, defaultHandler) => {
		const { url } = context.to;
		if (this.preloadPromises.has(url)) {
			return this.preloadPromises.get(url);
		} else {
			return defaultHandler(context, args);
		}
	};

	deviceSupportsHover() {
		return window.matchMedia('(hover: hover)').matches;
	}

	onMouseEnter = async (event) => {
		// Make sure mouseenter is only fired once even on links with nested html
		if (event.target !== event.delegateTarget) return;
		// Return early on devices that don't support hover
		if (!this.deviceSupportsHover()) return;

		const el = event.delegateTarget;
		this.swup.hooks.triggerSync('link:hover', { el, event });
		this.preloadLink(el);
	};

	onTouchStart = (event) => {
		// Return early on devices that support hover
		if (this.deviceSupportsHover()) return;

		this.preloadLink(event.delegateTarget);
	};

	preloadLink(el) {
		const { url } = Location.fromElement(el);

		// Bail early if the visit should be ignored by swup
		if (this.swup.shouldIgnoreVisit(el.href, { el })) return;

		// Bail early if the link points to the current page
		if (url === getCurrentUrl()) return;

		// Bail early if the page is already in the cache
		if (this.swup.cache.has(url)) return;

		// Bail early if there is already a preload running
		if (this.preloadPromises.has(url)) return;

		// Bail early if there are more then the maximum concurrent preloads running
		if (this.preloadPromises.size >= this.options.throttle) return;

		const preloadPromise = this.preload(url);
		preloadPromise
			.catch(() => {})
			.finally(() => {
				this.preloadPromises.delete(url);
			});
		this.preloadPromises.set(url, preloadPromise);
	}

	preload = async (url) => {
		const page = await this.swup.fetchPage(url, { triggerHooks: false });
		await this.swup.hooks.trigger('page:preload', { page });
		return page;
	};

	preloadAll = () => {
		queryAll('[data-swup-preload], [data-swup-preload-all] a').forEach((el) => {
			if (this.swup.shouldIgnoreVisit(el.href, { el })) return;
			this.swup.preload(el.href);
		});
	};
}
