# Swup Preload plugin

Adds preloading support to [swup](https://github.com/swup/swup):

- Links with a `[data-swup-preload]` attribute will be preloaded automatically
- Hovering a link on pointer devices will preload that link's URL, speeding up load time by a few 100ms
- Touch devices will instead preload links at the start of touch events, giving a ~80ms speed-up
- If there is already a preload running, the plugin won't start another one. This saves resources on the server.

## Installation

Install via npm

```bash
npm install @swup/preload-plugin
```

and import like this

```shell
import SwupPreloadPlugin from '@swup/preload-plugin';
```

or included from the dist folder

```html
<script src="./dist/SwupPreloadPlugin.js"></script>
```

## Usage

Add an instance of the plugin to the swup `options.plugins` array.

```javascript
const swup = new Swup({
  plugins: [new SwupPreloadPlugin()]
});
```

## Changes of the swup instance

### Methods

- `preloadPage`: Accepts a URL path and returns a promise describing the loading of the page:

```js
const preloadPromise = swup.preloadPage('/path/to/my/page.html');
```

- `preloadPages`: Scans the DOM for links with the attribute `[data-swup-preload]` and calls `preloadPage` for each URL:

```js
swup.preloadPages();
```

### Events

- `pagePreloaded`: Fires once a page was preloaded:

```js
swup.on('pagePreloaded', (page) => console.log('preloaded:' page));
```

- `hoverLink`: fires every time a link is being hovered:

```js
swup.on('hoverLink', (event) => console.log('link hovered:', event));
```
