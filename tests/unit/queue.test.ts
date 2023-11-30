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
	it('runs callbacks sequentially', async () => {
		let num = 5;
		let duration = 100;
		let elapsed = 0;

		const { add, next } = createQueue();
		const timer = createTimer();
		const test = () => sleep(duration).then(() => (elapsed = timer())).then(next);
		for (let i = 0; i < num; i++) {
			add(() => test()); // add different function with each iteration
		}
		await sleep((num + 1) * duration);

		const [min, max] = pad(num * duration);
		expect(elapsed).to.be.gte(min);
		expect(elapsed).to.be.lte(max);
	});

	it('debounces repeated calls', async () => {
		let num = 5;
		let duration = 100;
		let elapsed = 0;

		const { add, next } = createQueue();
		const timer = createTimer();
		const test = () => sleep(duration).then(() => (elapsed = timer())).then(next);
		for (let i = 0; i < num; i++) {
			add(test); // add identical function multiple times
		}
		await sleep((num + 1) * duration);

		const [min, max] = pad(duration);
		expect(elapsed).to.be.gte(min);
		expect(elapsed).to.be.lte(max);
	});
});

