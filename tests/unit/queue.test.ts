import { describe, expect, it } from 'vitest';
import createQueue from '../../src/queue.js';
import { createTimer, pad, sleep } from '../support/utils.js';

describe('export', () => {
	it('exports a function', () => {
		expect(createQueue).to.be.a('function');
	});
});

describe('return', () => {
	it('creates a Queue object', () => {
		const queue = createQueue();
		expect(queue).to.be.an('object');
		expect(queue.add).to.be.a('function');
		expect(queue.next).to.be.a('function');
	});
});

describe('usage', () => {
	it('debounces repeated calls', async () => {
		let num = 5;
		let step = 500;
		let last = 0;

		const { add, next } = createQueue();
		const timer = createTimer();
		const test = () => sleep(step).then(() => (last = timer())).then(next);
		for (let i = 0; i < num; i++) {
			add(test);
		}
		await sleep(++num * step);

		const [min, max] = pad(500, 0.02);
		expect(last).to.be.gte(min);
		expect(last).to.be.lte(max);
	});
});

