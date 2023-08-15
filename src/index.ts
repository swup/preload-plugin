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

type VisibleLinkPreloadOptions = {
	enabled: boolean;
	threshold: number;
	delay: number;
	containers: string[];
};

export type PluginOptions = {
	throttle: number;
	preloadInitialPage: boolean;
	preloadHoveredLinks: boolean;
	preloadVisibleLinks: VisibleLinkPreloadOptions;
};

export type PluginInitOptions = Omit<PluginOptions, 'preloadVisibleLinks'> & {
	preloadVisibleLinks: boolean | Partial<VisibleLinkPreloadOptions>;
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
		preloadInitialPage: true,
		preloadHoveredLinks: true,
		preloadVisibleLinks: {
			enabled: false,
			threshold: 0.2,
			delay: 500,
			containers: ['body']
		}
	};

	options: PluginOptions;

	queue: Queue;
	preloadPromises = new Map<string, Promise<unknown>>();
	preloadObserver?: { stop: () => void; update: () => void };

	mouseEnterDelegate?: DelegateEventUnsubscribe;
	touchStartDelegate?: DelegateEventUnsubscribe;
	focusDelegate?: DelegateEventUnsubscribe;

	constructor(options: Partial<PluginInitOptions> = {}) {
		super();

		const { preloadVisibleLinks, ...otherOptions } = options;
		this.options = { ...this.defaults, ...otherOptions };

		// Sanitize preload options
		if (typeof preloadVisibleLinks === 'object') {
			this.options.preloadVisibleLinks = {
				...this.options.preloadVisibleLinks,
				...preloadVisibleLinks
			};
		} else {
			this.options.preloadVisibleLinks.enabled = Boolean(preloadVisibleLinks);
		}

		// Bind public methods
		this.preload = this.preload.bind(this);

		// Create global priority queue
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
			this.onMouseEnter,
			{ passive: true, capture: true }
		);

		// register touchstart handler
		this.touchStartDelegate = swup.delegateEvent(
			swup.options.linkSelector,
			'touchstart',
			this.onTouchStart,
			{ passive: true, capture: true }
		);

		// register focus handler
		this.focusDelegate = swup.delegateEvent(
			swup.options.linkSelector,
			'focus',
			this.onFocus,
			{ passive: true, capture: true }
		);

		// inject custom promise whenever a page is loaded
		this.replace('page:load', this.onPageLoad);

		// preload links with [data-swup-preload] attr
		if (this.options.preloadHoveredLinks) {
			this.preloadLinks();
			this.on('page:view', () => this.preloadLinks());
		}

		// preload visible links in viewport
		if (this.options.preloadVisibleLinks.enabled) {
			this.preloadVisibleLinks();
			this.on('page:view', () => this.preloadVisibleLinks());
		}

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

		this.stopPreloadingVisibleLinks();
	}

	onPageLoad: Handler<'page:load'> = (visit, args, defaultHandler) => {
		const { url } = visit.to;
		if (url && this.preloadPromises.has(url)) {
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

		const preloadPromise = new Promise<PageData | void>((resolve) => {
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


		return preloadPromise;
	}

	preloadLinks() {
		requestIdleCallback(() => {
			const selector = 'a[data-swup-preload], [data-swup-preload-all] a';
			const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
			links.forEach((el) => this.preload(el));
		});
	}

	protected preloadVisibleLinks() {
		if (this.preloadObserver) {
			this.preloadObserver.update();
			return;
		}

		const { threshold, delay, containers } = this.options.preloadVisibleLinks;
		const visibleLinks = new Set<string>();

		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					add(entry.target as HTMLAnchorElement);
				} else {
					remove(entry.target as HTMLAnchorElement);
				}
			});
		}, { threshold });

		const add = (el: HTMLAnchorElement) => {
			visibleLinks.add(el.href);
			setTimeout(() => {
				if (visibleLinks.has(el.href)) {
					this.preload(el.href);
					observer.unobserve(el);
				}
			}, delay);
		};

		const remove = (el: HTMLAnchorElement) => visibleLinks.delete(el.href);

		const clear = () => visibleLinks.clear();

		const observe = () => {
			requestIdleCallback(() => {
				const selector = containers.map((root) => `${root} a[href]`).join(', ');
				const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
				links
					.filter((link) => !this.triggerWillOpenNewWindow(link))
					.forEach((link) => observer.observe(link));
			});
		};

		observe();

		this.preloadObserver = {
			stop: () => observer.disconnect(),
			update: () => (clear(), observe())
		};
	}

	protected stopPreloadingVisibleLinks() {
		if (this.preloadObserver) {
			this.preloadObserver.stop();
		}
	}

	protected shouldPreload(location: string, el?: HTMLAnchorElement): boolean {
		const { url, href } = Location.fromUrl(location);

		// Network too slow?
		if (!this.networkSupportsPreloading()) return false;
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

	protected networkSupportsPreloading(): boolean {
		if (navigator.connection) {
			if (navigator.connection.saveData) {
				return false;
			}
			if (navigator.connection.effectiveType?.endsWith('2g')) {
				return false;
			}
		}
		return true;
	}

	protected triggerWillOpenNewWindow(el: HTMLAnchorElement) {
		return el.matches('[download], [target="_blank"]') || el.origin !== window.location.origin;
	}

	protected async performPreload(url: string): Promise<PageData> {
		const page = await this.swup.fetchPage(url);
		await this.swup.hooks.call('page:preload', { page });
		return page;
	}
}
