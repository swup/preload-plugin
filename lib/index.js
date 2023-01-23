'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _plugin = require('@swup/plugin');

var _plugin2 = _interopRequireDefault(_plugin);

var _delegateIt = require('delegate-it');

var _delegateIt2 = _interopRequireDefault(_delegateIt);

var _utils = require('swup/lib/utils');

var _helpers = require('swup/lib/helpers');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var PreloadPlugin = function (_Plugin) {
	_inherits(PreloadPlugin, _Plugin);

	function PreloadPlugin() {
		var _ref;

		var _temp, _this, _ret;

		_classCallCheck(this, PreloadPlugin);

		for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			args[_key] = arguments[_key];
		}

		return _ret = (_temp = (_this = _possibleConstructorReturn(this, (_ref = PreloadPlugin.__proto__ || Object.getPrototypeOf(PreloadPlugin)).call.apply(_ref, [this].concat(args))), _this), _this.name = 'PreloadPlugin', _this.onContentReplaced = function () {
			_this.swup.preloadPages();
		}, _this.onMouseover = function (event) {
			var swup = _this.swup;
			var linkEl = event.delegateTarget;
			var link = new _helpers.Link(linkEl);

			swup.triggerEvent('hoverLink', event);

			// Bail early if the visit should be ignored by swup
			if (_this.shouldIgnoreVisit(linkEl.href, { el: linkEl })) return;

			// Bail early if there is already a preload running
			if (swup.preloadPromise != null) return;

			swup.preloadPromise = swup.preloadPage(link.getAddress());
			swup.preloadPromise.route = link.getAddress();
			swup.preloadPromise.finally(function () {
				swup.preloadPromise = null;
			});
		}, _this.preloadPage = function (pathname) {
			var swup = _this.swup;
			var link = new _helpers.Link(pathname);

			return new Promise(function (resolve, reject) {
				// Resolve and return early if the page is already in the cache
				if (swup.cache.exists(link.getAddress())) {
					resolve(swup.cache.getPage(link.getAddress()));
					return;
				}

				(0, _helpers.fetch)({
					url: link.getAddress(),
					headers: swup.options.requestHeaders
				}, function (response) {
					// Reject and bail early if the server responded with an error
					if (response.status === 500) {
						swup.triggerEvent('serverError');
						reject(link.getAddress());
						return;
					}

					// Parse the JSON data from the response
					var page = swup.getPageData(response);

					// Reject and return early if something went wrong in `getPageData`
					if (page == null) {
						reject(link.getAddress());
						return;
					}

					// Finally, prepare the page, store it in the cache, trigger an event and resolve
					page.url = link.getAddress();
					swup.cache.cacheUrl(page);
					swup.triggerEvent('pagePreloaded');
					resolve(page);
				});
			});
		}, _this.preloadPages = function () {
			(0, _utils.queryAll)('[data-swup-preload]').forEach(function (el) {
				if (_this.shouldIgnoreVisit(el.href, { el: el })) return;
				_this.swup.preloadPage(el.href);
			});
		}, _temp), _possibleConstructorReturn(_this, _ret);
	}

	_createClass(PreloadPlugin, [{
		key: 'mount',
		value: function mount() {
			var swup = this.swup;

			if (!swup.options.cache) {
				console.warn('PreloadPlugin: swup cache needs to be enabled for preloading');
				return;
			}

			swup._handlers.pagePreloaded = [];
			swup._handlers.hoverLink = [];

			swup.preloadPage = this.preloadPage;
			swup.preloadPages = this.preloadPages;

			// register mouseover handler
			swup.delegatedListeners.mouseover = (0, _delegateIt2.default)(document.body, swup.options.linkSelector, 'mouseover', this.onMouseover.bind(this));

			// initial preload of links with [data-swup-preload] attr
			swup.preloadPages();

			// do the same on every content replace
			swup.on('contentReplaced', this.onContentReplaced);

			// cache unmodified dom of initial/current page
			swup.preloadPage((0, _helpers.getCurrentUrl)());
		}
	}, {
		key: 'unmount',
		value: function unmount() {
			var swup = this.swup;

			if (!swup.options.cache) {
				return;
			}

			swup._handlers.pagePreloaded = null;
			swup._handlers.hoverLink = null;

			swup.preloadPage = null;
			swup.preloadPages = null;

			swup.delegatedListeners.mouseover.destroy();

			swup.off('contentReplaced', this.onContentReplaced);
		}
	}, {
		key: 'shouldIgnoreVisit',


		/**
   * Apply swup.ignoreLink (will become available in swup@3)
   */
		value: function shouldIgnoreVisit(href) {
			var _ref2 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
			    el = _ref2.el;

			if (typeof this.swup.shouldIgnoreVisit === 'function') {
				return this.swup.shouldIgnoreVisit(href, { el: el });
			}
			return false;
		}
	}]);

	return PreloadPlugin;
}(_plugin2.default);

exports.default = PreloadPlugin;