import Plugin from '@swup/plugin';
import { getCurrentUrl, Handler, Location } from 'swup';
import type { DelegateEvent, DelegateEventHandler, DelegateEventUnsubscribe, PageData } from 'swup';
import { default as throttles } from 'throttles/priority';

declare module 'swup' {
	export interface Swup {
		preload?: (url: string) => Promise<PageData | (PageData | void)[] | void>;
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

type PreloadOptions = {
	priority?: boolean;
};

type Queue = {
	add: (fn: () => void, highPriority?: boolean) => void;
	next: () => void;
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
	queue: Queue;

	mouseEnterDelegate?: DelegateEventUnsubscribe;
	touchStartDelegate?: DelegateEventUnsubscribe;
	focusDelegate?: DelegateEventUnsubscribe;

	constructor(options: Partial<PluginOptions> = {}) {
		super();
		this.options = { ...this.defaults, ...options };
		this.preload = this.preload.bind(this);

		const [add, next] = throttles(this.options.throttle);
		this.queue = { add, next };
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

		// register focus handler
		this.focusDelegate = swup.delegateEvent(
			swup.options.linkSelector,
			'focus',
			this.onFocus.bind(this),
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
		this.focusDelegate?.destroy();
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
		this.preload(el, { priority: true });
	};

	onTouchStart: DelegateEventHandler = (event) => {
		// Return early on devices that support hover
		if (this.deviceSupportsHover()) return;

		const el = event.delegateTarget;
		if (!(el instanceof HTMLAnchorElement)) return;

		this.preload(el, { priority: true });
	};

	onFocus: DelegateEventHandler = (event) => {
		const el = event.delegateTarget;
		if (!(el instanceof HTMLAnchorElement)) return;

		this.preload(el, { priority: true });
	};

	async preload(url: string, options?: PreloadOptions): Promise<PageData | void>;
	async preload(urls: string[], options?: PreloadOptions): Promise<PageData[]>;
	async preload(el: HTMLAnchorElement, options?: PreloadOptions): Promise<PageData | void>;
	async preload(
		input: string | string[] | HTMLAnchorElement,
		options: PreloadOptions = {}
	): Promise<PageData | (PageData | void)[] | void> {
		let url: string;
		let trigger: HTMLAnchorElement | undefined;
		const priority = options.priority ?? false;

		// Allow passing in array of elements or urls
		if (Array.isArray(input)) {
			return Promise.all(input.map((link) => this.preload(link)));
		}
		// Allow passing in an anchor element
		else if (input instanceof HTMLAnchorElement) {
			trigger = input;
			({ url } = Location.fromElement(input));
		}
		// Allow passing in a url
		else {
			url = String(input);
		}

		if (!this.shouldPreload(url, trigger)) {
			return;
		}

		return new Promise<PageData | void>((resolve) => {
			this.queue.add(() => {
				const preloadPromise = this.performPreload(url);
				this.preloadPromises.set(url, preloadPromise);
				preloadPromise
					.catch(() => {})
					.then((page) => resolve(page))
					.finally(() => {
						this.queue.next();
						this.preloadPromises.delete(url);
					});
			}, priority);
		});
	}

	preloadLinks() {
		const selector = 'a[data-swup-preload], [data-swup-preload-all] a';
		const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
		links.forEach((el) => this.preload(el));
	}

	protected shouldPreload(location: string, el?: HTMLAnchorElement): boolean {
		const { url, href } = Location.fromUrl(location);

		// Already in cache?
		if (this.swup.cache.has(url)) return false;
		// Already preloading?
		if (this.preloadPromises.has(url)) return false;
		// Should be ignored anyway?
		if (this.swup.shouldIgnoreVisit(href, { el })) return false;
		// Special condition for links: points to current page?
		if (el && this.swup.resolveUrl(url) === this.swup.resolveUrl(getCurrentUrl())) return false;

		return true;
	}

	protected async performPreload(url: string): Promise<PageData> {
		const page = await this.swup.fetchPage(url);
		await this.swup.hooks.call('page:preload', { page });
		return page;
	}
}
