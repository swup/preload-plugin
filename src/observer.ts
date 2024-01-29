import { Location } from 'swup';

import { AnchorElement } from './index.js';
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
	callback: (el: AnchorElement) => void;
	filter: (el: AnchorElement) => boolean;
}): Observer {
	const visibleLinks = new Map<string, Set<AnchorElement>>();

	// Create an observer to add/remove links when they enter the viewport
	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					add(entry.target as AnchorElement);
				} else {
					remove(entry.target as AnchorElement);
				}
			});
		},
		{ threshold }
	);

	// Preload link if it is still visible after a configurable timeout
	const add = (el: AnchorElement) => {
		const { href } = Location.fromElement(el);
		const elements = visibleLinks.get(href) ?? new Set();
		visibleLinks.set(href, elements);
		elements.add(el);

		setTimeout(() => {
			const elements = visibleLinks.get(href);
			if (elements?.size) {
				callback(el);
				observer.unobserve(el);
				elements.delete(el);
			}
		}, delay);
	};

	// Remove link from list of visible links
	const remove = (el: AnchorElement) => {
		const { href } = Location.fromElement(el);
		visibleLinks.get(href)?.delete(el);
	};

	// Clear list of visible links
	const clear = () => visibleLinks.clear();

	// Scan DOM for preloadable links and start observing their visibility
	const observe = () => {
		whenIdle(() => {
			const selector = containers.map((root) => `${root} a[*|href]`).join(', ');
			const links = Array.from(document.querySelectorAll<AnchorElement>(selector));
			links.filter((el) => filter(el)).forEach((el) => observer.observe(el));
		});
	};

	return {
		start: () => observe(),
		stop: () => observer.disconnect(),
		update: () => (clear(), observe())
	};
}
