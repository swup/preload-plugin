import { cpSync, rmSync } from 'node:fs';

export default () => {
	rmSync('./tests/fixtures/dist/', { recursive: true, force: true });
	cpSync('./dist/', `./tests/fixtures/dist/`, { recursive: true });
	cpSync('./node_modules/swup/dist/Swup.umd.js', `./tests/fixtures/dist/swup.umd.js`);
};
