import Plugin from '@swup/plugin';
import { getCurrentUrl, Handler, Location } from 'swup';
import type { DelegateEvent, DelegateEventHandler, DelegateEventUnsubscribe, PageData } from 'swup';

declare module 'swup' {
	export interface Swup {
		preload?: (url: string) => Promise<PageData>;
		preloadLinks?: () => void;
	}
	export interface HookDefinitions {
		'link:hover': { el: HTMLAnchorElement; event: DelegateEvent };
		'page:preload': { page: PageData };
	}
}

export type PluginOptions = {
	throttle: number;
	preloadInitialPage: boolean;
};

export default class SwupPreloadPlugin extends Plugin {
	name = 'SwupPreloadPlugin';

	requires = { swup: '>=4' };

	defaults: PluginOptions = {
		throttle: 5,
		preloadInitialPage: true
	};

	options: PluginOptions;

	preloadPromises = new Map();

	mouseEnterDelegate?: DelegateEventUnsubscribe;
	touchStartDelegate?: DelegateEventUnsubscribe;

	constructor(options: Partial<PluginOptions> = {}) {
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
		swup.preloadLinks = this.preloadLinks;

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

		// preload links with [data-swup-preload] attr after page views
		this.on('page:view', this.onPageView);

		// inject custom promise whenever a page is loaded
		this.replace('page:load', this.onPageLoad);

		// initial preload of links with [data-swup-preload] attr
		this.preloadLinks();

		// cache unmodified dom of initial/current page
		if (this.options.preloadInitialPage) {
			this.preload(getCurrentUrl());
		}
	}

	unmount() {
		this.swup.preload = undefined;
		this.swup.preloadLinks = undefined;

		this.preloadPromises.clear();

		this.mouseEnterDelegate?.destroy();
		this.touchStartDelegate?.destroy();
	}

	onPageView() {
		this.preloadLinks();
	}

	onPageLoad: Handler<'page:load'> = (visit, args, defaultHandler) => {
		const { url } = visit.to;
		if (this.preloadPromises.has(url)) {
			return this.preloadPromises.get(url);
		}
		return defaultHandler?.(visit, args);
	};

	deviceSupportsHover() {
		return window.matchMedia('(hover: hover)').matches;
	}

	onMouseEnter: DelegateEventHandler = async (event) => {
		// Make sure mouseenter is only fired once even on links with nested html
		if (event.target !== event.delegateTarget) return;
		// Return early on devices that don't support hover
		if (!this.deviceSupportsHover()) return;

		const el = event.delegateTarget;
		if (!(el instanceof HTMLAnchorElement)) return;

		this.swup.hooks.callSync('link:hover', { el, event });
		this.preloadLink(el);
	};

	onTouchStart: DelegateEventHandler = (event) => {
		// Return early on devices that support hover
		if (this.deviceSupportsHover()) return;

		const el = event.delegateTarget;
		if (!(el instanceof HTMLAnchorElement)) return;

		this.preloadLink(el);
	};

	preloadLink(el: HTMLAnchorElement) {
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

	preload = async (url: string) => {
		const page = await this.swup.fetchPage(url);
		await this.swup.hooks.call('page:preload', { page });
		return page;
	};

	preloadLinks = (): void => {
		document
			.querySelectorAll<HTMLAnchorElement>('a[data-swup-preload], [data-swup-preload-all] a')
			.forEach((el) => {
				if (this.swup.shouldIgnoreVisit(el.href, { el })) return;
				this.swup.preload?.(el.href);
			});
	};
}
