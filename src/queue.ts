type QueueFunction = {
	(): void | Promise<void>;
};

export default class Queue {
	private limit: number;
	private qlow: Map<string, QueueFunction> = new Map();
	private qhigh: Map<string, QueueFunction> = new Map();
	private running: Set<string> = new Set();

	constructor(limit: number = 1) {
		this.limit = limit;
	}

	get total(): number {
		return this.qlow.size + this.qhigh.size;
	}

	has(key: string): boolean {
		return this.qlow.has(key) || this.qhigh.has(key);
	}

	add(key: string, fn: QueueFunction, highPriority: boolean = false): void {
		if (this.running.has(key)) {
			return;
		}

		if (this.has(key)) {
			if (highPriority) {
				// Promote from low to high-priority queue
				this.qlow.delete(key);
			} else {
				return;
			}
		}

		(highPriority ? this.qhigh : this.qlow).set(key, fn);

		if (!this.running.size) {
			this.run();
		}
	}

	protected async run(): Promise<void> {
		if (!this.total) return;
		if (this.running.size >= this.limit) return;

		const next = this.next();
		if (next) {
			this.running.add(next.key);
			await next.fn();
			this.running.delete(next.key);
			this.run();
		}
	}

	protected next(): { key: string; fn: QueueFunction } | null {
		return [this.qhigh, this.qlow].reduce((acc, queue) => {
			if (!acc) {
				const [key, fn] = queue.entries().next().value || [];
				if (key) {
					queue.delete(key);
					return { key, fn };
				}
			}
			return acc;
		}, null as { key: string; fn: QueueFunction } | null);
	}
}
