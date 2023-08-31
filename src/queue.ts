type QueueFunction = {
	(): void;
	__queued?: boolean;
};

export type Queue = {
	add: (fn: QueueFunction, highPriority?: boolean) => void;
	next: () => void;
};

export default function createQueue(limit: number = 1): Queue {
	const qlow: QueueFunction[] = [];
	const qhigh: QueueFunction[] = [];
	let total = 0;
	let running = 0;

	function add(fn: QueueFunction, highPriority: boolean = false): void {
		// Already added before?
		if (fn.__queued) {
			// Move from low to high-priority queue
			if (highPriority) {
				const idx = qlow.indexOf(fn);
				if (idx >= 0) {
					const removed = qlow.splice(idx, 1);
					total = total - removed.length;
				}
			} else {
				return;
			}
		}

		// Mark as processed
		fn.__queued = true;
		// Push to queue: high or low
		(highPriority ? qhigh : qlow).push(fn);
		// Increment total
		total++;
		// Initialize queue if first item
		if (total <= 1) {
			run();
		}
	}

	function next(): void {
		running--; // make room for next
		run();
	}

	function run(): void {
		if (running < limit && total > 0) {
			const fn = qhigh.shift() || qlow.shift() || (() => {});
			fn();
			total--;
			running++; // is now WIP
		}
	}

	return { add, next };
}
