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

describe('sequencing', () => {
	it('runs callbacks sequentially', async () => {
		let size = 1;
		let items = 5;
		let duration = 100;
		let elapsed = 0;

		const { add, next } = createQueue(size);
		const timer = createTimer();
		const test = () => sleep(duration).then(() => (elapsed = timer())).then(next);
		for (let i = 0; i < items; i++) {
			add(() => test()); // add different function with each iteration = sequential
		}
		await sleep((items + 1) * duration);

		const [min, max] = pad(items * duration);
		expect(elapsed).to.be.gte(min);
		expect(elapsed).to.be.lte(max);
	});

	it('debounces repeated calls', async () => {
		let size = 1;
		let items = 5;
		let duration = 100;
		let elapsed = 0;

		const { add, next } = createQueue(size);
		const timer = createTimer();
		const test = () => sleep(duration).then(() => (elapsed = timer())).then(next);
		for (let i = 0; i < items; i++) {
			add(test); // add identical function multiple times = ignore/debounce
		}
		await sleep((items + 1) * duration);

		const [min, max] = pad(duration);
		expect(elapsed).to.be.gte(min);
		expect(elapsed).to.be.lte(max);
	});

	it('allows custom queue size', async () => {
		let size = 5;
		let items = 5;
		let duration = 100;
		let elapsed = 0;

		const { add, next } = createQueue(size);
		const timer = createTimer();
		const test = () => sleep(duration).then(() => (elapsed = timer())).then(next);
		for (let i = 0; i < items; i++) {
			add(() => test()); // add different function with each iteration = sequential
		}
		await sleep((items + 1) * duration);

		const [min, max] = pad(items * duration / size);
		expect(elapsed).to.be.gte(min);
		expect(elapsed).to.be.lte(max);
	});
});

describe('priorization', () => {
	it('prioritizes high-priority items', async () => {
		let size = 1;
		let items = 3;
		let duration = 100;
		let elapsed = 0;
		const seen: number[] = [];

		const { add, next } = createQueue(size);
		const timer = createTimer();
		const testLow = () => sleep(duration).then(() => ((seen.push(0), (elapsed = timer())))).then(next);
		const testHigh = () => sleep(duration).then(() => ((seen.push(1), (elapsed = timer())))).then(next);
		for (let i = 0; i < items; i++) {
			add(() => testLow());
		}
		for (let i = 0; i < items; i++) {
			add(() => testHigh(), true);
		}
		await sleep((2 * items + 1) * duration);

		const [min, max] = pad(2 * items * duration);
		expect(elapsed).to.be.gte(min);
		expect(elapsed).to.be.lte(max);
		expect(seen).toEqual([0, 1, 1, 1, 0, 0]);
	});
});
