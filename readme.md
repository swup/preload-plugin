# Swup Preload plugin

Adds preloading support to [swup](https://github.com/swup/swup):

- Any link element found in the DOM that matches `[data-swup-preload]` will automatically be preloaded.
- On desktop, if moving the mouse over a link, the page the link points towards will immediately requested, speeding up perceived performance.
- On mobile, the preload will start on `touchstart`, starting the preload ~80ms earlier than on `click`
- If hovering/touching a link, any previous preload request will automatically be aborted before starting the new request. This saves resources on the server and makes sure the actual page that the user wants to visit will be preloaded.

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

You can listen to those events like this:

```js
swup.on('pagePreloaded', (page) => console.log('preloaded:' page));
```

- `hoverLink`: fires every time a link is being hovered:

```js
swup.on('hoverLink', (event) => console.log('link hovered:', event));
```
