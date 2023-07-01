# Swup Preload plugin

Adds preloading support to [swup](https://github.com/swup/swup):

- Links with a `[data-swup-preload]` attribute will be preloaded automatically
- Hovering a link on pointer devices will preload that link's URL, speeding up load time by a few 100ms. To save server resources, the number of simultaneous preload requests is limited to 5 by default.
- Touch devices will instead preload links at the start of touch events, giving a ~80ms speed-up
- If there is already a preload running, the plugin won't start another one. This saves resources on the server.

## Installation

Install the plugin from npm and import it into your bundle.

```bash
npm install @swup/preload-plugin
```

```js
import SwupPreloadPlugin from '@swup/preload-plugin';
```

Or include the minified production file from a CDN:

```html
<script src="https://unpkg.com/@swup/preload-plugin@2"></script>
```

## Usage

To run this plugin, include an instance in the swup options.

```javascript
const swup = new Swup({
  plugins: [new SwupPreloadPlugin()]
});
```

Hovering a link will now automatically preload it.

```html
<a href="/about">About</a> <!-- will preload when hovering -->
```

To preload specific links, mark them with the `data-swup-preload` attribute.

```html
<a href="/about" data-swup-preload>About</a>
```

To preload all links in a container, mark the container with `data-swup-preload-all`.

```html
<nav data-swup-preload-all>
  <a href="/about">About</a>
  <a href="/contact">Contact</a>
</nav>
```

## Options

### throttle

Type: `Number`, Default: `5`

The *concurrency limit* for simultaneous requests when hovering links on pointer devices.

### preloadInitialPage

Type: `Boolean`, Default: `True`

The reasoning behind preloading the initial page is to allow instant back-button navigation after you've navigated away from it.
In some instances this can cause issues, so you can disable it by setting this option to `false`.

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
swup.on('pagePreloaded', (page) => console.log('preloaded:', page));
```

- `hoverLink`: fires every time a link is being hovered:

```js
swup.on('hoverLink', (event) => console.log('link hovered:', event));
```
