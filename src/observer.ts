import { whenIdle } from './util.js';

export type Observer = {
	start: () => void;
	stop: () => void;
	update: () => void;
};

export default function createObserver({
	threshold,
	delay,
	containers,
	callback,
	filter
}: {
	threshold: number;
	delay: number;
	containers: string[];
	callback: (el: HTMLAnchorElement) => void;
	filter: (el: HTMLAnchorElement) => boolean;
}): Observer {
	const visibleLinks = new Map<string, Set<HTMLAnchorElement>>();

	// Create an observer to add/remove links when they enter the viewport
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					add(entry.target as HTMLAnchorElement);
				} else {
					remove(entry.target as HTMLAnchorElement);
				}
			});
		},
		{ threshold }
	);

	// Preload link if it is still visible after a configurable timeout
	const add = (el: HTMLAnchorElement) => {
		visibleLinks.set(el.href, visibleLinks.get(el.href) || new Set());
		visibleLinks.get(el.href)!.add(el);

		setTimeout(() => {
			const set = visibleLinks.get(el.href);
			if (set && set.has(el)) {
				callback(el);
				observer.unobserve(el);
				set.delete(el);
			}
		}, delay);
	};

	// Remove link from list of visible links
	const remove = (el: HTMLAnchorElement) => visibleLinks.get(el.href)?.delete(el);

	// Clear list of visible links
	const clear = () => visibleLinks.clear();

	// Scan DOM for preloadable links and start observing their visibility
	const observe = () => {
		whenIdle(() => {
			const selector = containers.map((root) => `${root} a[href]`).join(', ');
			const links = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
			links.filter((el) => filter(el)).forEach((el) => observer.observe(el));
		});
	};

	return {
		start: () => observe(),
		stop: () => observer.disconnect(),
		update: () => (clear(), observe())
	};
}
