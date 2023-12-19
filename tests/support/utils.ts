export function sleep(ms: number): Promise<void> {
	return new Promise(r => setTimeout(r, ms));
}

export function createTimer(): () => number {
	const start = process.hrtime();
	return () => realtimeToMs(process.hrtime(start));
}

export function realtimeToMs([seconds, milliseconds]: [number, number]): number {
	return Math.round(seconds * 1000 + milliseconds / 1000000);
}

export function pad(num: number, padding: number = 0.02): [number, number] {
	return [num * (1 - padding), num * (1 + padding)];
}
