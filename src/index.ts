import Plugin from '@swup/plugin';
import { getCurrentUrl, Handler, Location } from 'swup';
import type { DelegateEvent, DelegateEventHandler, DelegateEventUnsubscribe, PageData } from 'swup';
import createQueue, { Queue } from './queue.js';

declare module 'swup' {
	export interface Swup {
		/**
		 * Preload links by passing in either:
		 * - a URL or an array of URLs
		 * - a link element or an array of link elements
		 */
		preload?: (input: string | string[] | HTMLAnchorElement | HTMLAnchorElement[]) => Promise<PageData | (PageData | void)[] | void>;
		/**
		 * Preload any links on the current page manually marked for preloading.
		 */
		preloadLinks?: () => void;
	}
	export interface HookDefinitions {
		'link:hover': { el: HTMLAnchorElement; event: DelegateEvent };
		'page:preload': { page: PageData };
	}
}

type VisibleLinkPreloadOptions = {
	/** Enable preloading of links entering the viewport */
	enabled: boolean;
	/** How much area of a link must be visible to preload it: 0 to 1.0 */
	threshold: number;
	/** How long a link must be visible to preload it, in milliseconds */
	delay: number;
	/** Containers to look for links in */
	containers: string[];
};

export type PluginOptions = {
	/** The *concurrency limit* for simultaneous requests when preloading. */
	throttle: number;
	/** Preload the initial page to allow instant back-button navigation. */
	preloadInitialPage: boolean;
	/** Preload links when they are hovered, touched or focused. */
	preloadHoveredLinks: boolean;
	/** Preload links when they enter the viewport. */
	preloadVisibleLinks: VisibleLinkPreloadOptions;
};

export type PluginInitOptions = Omit<PluginOptions, 'preloadVisibleLinks'> & {
	/** Preload links when they enter the viewport. */
	preloadVisibleLinks: boolean | Partial<VisibleLinkPreloadOptions>;
};

type PreloadOptions = {
	/** Priority of this preload: `true` for high, `false` for low. */
	priority?: boolean;
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

	protected queue: Queue;
	protected preloadPromises = new Map<string, Promise<PageData | void>>();
	protected preloadObserver?: { stop: () => void; update: () => void };

	protected mouseEnterDelegate?: DelegateEventUnsubscribe;
	protected touchStartDelegate?: DelegateEventUnsubscribe;
	protected focusDelegate?: DelegateEventUnsubscribe;

	constructor(options: Partial<PluginInitOptions> = {}) {
		super();

		// Set all options except `preloadVisibleLinks` which is sanitized below
		const { preloadVisibleLinks, ...otherOptions } = options;
		this.options = { ...this.defaults, ...otherOptions };

		// Sanitize/merge `preloadVisibleLinks`` option
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
		this.queue = createQueue(this.options.throttle);
	}

	mount() {
		const swup = this.swup;

		if (!swup.options.cache) {
			console.warn('SwupPreloadPlugin: swup cache needs to be enabled for preloading');
			return;
		}

		swup.hooks.create('page:preload');
		swup.hooks.create('link:hover');

		// @ts-ignore: non-matching signatures (TODO: fix properly)
		swup.preload = this.preload;
		swup.preloadLinks = this.preloadLinks;

		// Register handlers for preloading on attention: mouseenter, touchstart, focus
		const { linkSelector: selector } = swup.options;
		const opts = { passive: true, capture: true };
		this.mouseEnterDelegate = swup.delegateEvent(selector, 'mouseenter', this.onMouseEnter, opts);
		this.touchStartDelegate = swup.delegateEvent(selector, 'touchstart', this.onTouchStart, opts);
		this.focusDelegate = swup.delegateEvent(selector, 'focus', this.onFocus, opts);

		// Inject custom promise whenever a page is loaded
		this.replace('page:load', this.onPageLoad);

		// Preload links with [data-swup-preload] attr
		if (this.options.preloadHoveredLinks) {
			this.preloadLinks();
			this.on('page:view', () => this.preloadLinks());
		}

		// Preload visible links in viewport
		if (this.options.preloadVisibleLinks.enabled) {
			this.preloadVisibleLinks();
			this.on('page:view', () => this.preloadVisibleLinks());
		}

		// Cache unmodified DOM of initial/current page
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

	/**
	 * Before core page load: return existing preload promise if available.
	 */
	protected onPageLoad: Handler<'page:load'> = (visit, args, defaultHandler) => {
		const { url } = visit.to;
		if (url && this.preloadPromises.has(url)) {
			return this.preloadPromises.get(url);
		}
		return defaultHandler?.(visit, args);
	};

	/**
	 * When hovering over a link: preload the linked page with high priority.
	 */
	protected onMouseEnter: DelegateEventHandler = async (event) => {
		// Make sure mouseenter is only fired once even on links with nested html
		if (event.target !== event.delegateTarget) return;

		// Return early on devices that don't support hover
		if (!this.deviceSupportsHover()) return;

		const el = event.delegateTarget;
		if (!(el instanceof HTMLAnchorElement)) return;

		this.swup.hooks.callSync('link:hover', { el, event });
		this.preload(el, { priority: true });
	};

	/**
	 * When touching a link: preload the linked page with high priority.
	 */
	protected onTouchStart: DelegateEventHandler = (event) => {
		// Return early on devices that support hover
		if (this.deviceSupportsHover()) return;

		const el = event.delegateTarget;
		if (!(el instanceof HTMLAnchorElement)) return;

		this.preload(el, { priority: true });
	};

	/**
	 * When focussing a link: preload the linked page with high priority.
	 */
	protected onFocus: DelegateEventHandler = (event) => {
		const el = event.delegateTarget;
		if (!(el instanceof HTMLAnchorElement)) return;

		this.preload(el, { priority: true });
	};

	/**
	 * Preload links.
	 *
	 * The method accepts either:
	 * - a URL or an array of URLs
	 * - a link element or an array of link elements
	 *
	 * It returns either:
	 * - a Promise resolving to the page data, if requesting a single page
	 * - a Promise resolving to an array of page data, if requesting multiple pages
	 */
	async preload(url: string, options?: PreloadOptions): Promise<PageData | void>;
	async preload(urls: string[], options?: PreloadOptions): Promise<(PageData | void)[]>;
	async preload(el: HTMLAnchorElement, options?: PreloadOptions): Promise<PageData | void>;
	async preload(els: HTMLAnchorElement[], options?: PreloadOptions): Promise<(PageData | void)[]>;
	async preload(input: string | HTMLAnchorElement, options?: PreloadOptions): Promise<PageData | void>;
	async preload(
		input: string | string[] | HTMLAnchorElement | HTMLAnchorElement[],
		options: PreloadOptions = {}
	): Promise<PageData | (PageData | void)[] | void> {
		let url: string;
		let el: HTMLAnchorElement | undefined;
		const priority = options.priority ?? false;

		// Allow passing in array of urls or elements
		if (Array.isArray(input)) {
			return Promise.all(input.map((link) => this.preload(link)));
		}
		// Allow passing in an anchor element
		else if (input instanceof HTMLAnchorElement) {
			el = input;
			({ url } = Location.fromElement(input));
		}
		// Allow passing in a url
		else if (typeof input === 'string') {
			url = input;
		}
		// Disallow other types
		else {
			return;
		}

		// Already preloading? Return existing promise
		if (this.preloadPromises.has(url)) {
			return this.preloadPromises.get(url);
		}

		// Should we preload?
		if (!this.shouldPreload(url, { el })) {
			return;
		}

		// Queue the preload with either low or high priority
		// The actual preload will happen when a spot in the queue is available
		const queuedPromise = new Promise<PageData | void>((resolve) => {
			this.queue.add(() => {
				this.performPreload(url)
					.catch(() => {})
					.then((page) => resolve(page))
					.finally(() => {
						this.queue.next();
						this.preloadPromises.delete(url);
					});
			}, priority);
		});

		this.preloadPromises.set(url, queuedPromise);

		return queuedPromise;
	}

	/**
	 * Preload any links on the current page manually marked for preloading.
	 *
	 * Links are marked for preloading by:
	 * - adding a `data-swup-preload` attribute to the link itself
	 * - adding a `data-swup-preload-all` attribute to a container of multiple links
	 */
	preloadLinks(): void {
		requestIdleCallback(() => {
			const selector = 'a[data-swup-preload], [data-swup-preload-all] a';
			const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
			links.forEach((el) => this.preload(el));
		});
	}

	/**
	 * Start observing links in the viewport for preloading.
	 * Calling this repeatedly re-checks for links after DOM updates.
	 */
	protected preloadVisibleLinks(): void {
		// Scan DOM for new links on repeated calls
		if (this.preloadObserver) {
			this.preloadObserver.update();
			return;
		}

		const { threshold, delay, containers } = this.options.preloadVisibleLinks;
		const visibleLinks = new Set<string>();

		// Create an observer to add/remove links when they enter the viewport
		const observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					add(entry.target as HTMLAnchorElement);
				} else {
					remove(entry.target as HTMLAnchorElement);
				}
			});
		}, { threshold });

		// Preload link if it is still visible after a configurable timeout
		const add = (el: HTMLAnchorElement) => {
			visibleLinks.add(el.href);
			setTimeout(() => {
				if (visibleLinks.has(el.href)) {
					this.preload(el);
					observer.unobserve(el);
				}
			}, delay);
		};

		// Remove link from list of visible links
		const remove = (el: HTMLAnchorElement) => visibleLinks.delete(el.href);

		// Clear list of visible links
		const clear = () => visibleLinks.clear();

		// Scan DOM for preloadable links and start observing their visibility
		const observe = () => {
			requestIdleCallback(() => {
				const selector = containers.map((root) => `${root} a[href]`).join(', ');
				const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
				links
					.filter((el) => this.shouldPreload(el.href, { el }))
					.forEach((el) => observer.observe(el));
			});
		};

		// Begin observing
		observe();

		this.preloadObserver = {
			stop: () => observer.disconnect(),
			update: () => (clear(), observe())
		};
	}

	/**
	 * Stop observing links in the viewport for preloading.
	 */
	protected stopPreloadingVisibleLinks(): void {
		if (this.preloadObserver) {
			this.preloadObserver.stop();
		}
	}

	/**
	 * Check whether a URL and/or element should trigger a preload.
	 */
	protected shouldPreload(location: string, { el }: { el?: HTMLAnchorElement } = {}): boolean {
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

	/**
	 * Perform the actual preload fetch and trigger the preload hook.
	 */
	protected async performPreload(url: string): Promise<PageData> {
		const page = await this.swup.fetchPage(url);
		await this.swup.hooks.call('page:preload', { page });
		return page;
	}

	/**
	 * Check if the user's connection is configured and fast enough
	 * to preload data in the background.
	 */
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

	/**
	 * Does this device support true hover/pointer interactions?
	 */
	protected deviceSupportsHover() {
		return window.matchMedia('(hover: hover)').matches;
	}
}
