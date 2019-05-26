# Swup Preload plugin
Plugin adds preload functionality. Firstly, any link element found in DOM with the `[data-swup-preload]` attribute is automatically preloaded. 
Swup also tries to speed up the process of loading by starting the preload on hover over the link. 
In case one request is already running for preload from hover, swup won't start another request, to prevent unnecessary overloading of server. 

## Instalation
This plugin can be installed with npm

```bash
npm install @swup/preload-plugin
```

and included with import

```shell
import SwupPreloadPlugin from '@swup/preload-plugin';
```

or included from the dist folder

```html
<script src="./dist/SwupPreloadPlugin.js"></script>
```

## Usage

To run this plugin, include an instance in the swup options.

```javascript
const swup = new Swup({
  plugins: [new SwupPreloadPlugin()]
});
```

## Changes of swup instance
Plugin adds two methods to the swup instance - `preloadPage` and `preloadPages`.
`preloadPage` accepts URL path and returns a promise describing loading of the page. 
`preloadPages` scans DOM for links with `[data-swup-preload]` attribute and calls `preloadPage` for each URL. 

Plugin also adds `pagePreloaded` and `hoverLink` events to swup, that can be listened to with `on` method. 
