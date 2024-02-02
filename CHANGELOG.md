# Changelog

## [3.2.10] - 2024-02-02

- Fix: Make sure preload requests are not being ignored

## [3.2.9] - 2024-01-29

- Respect swup's link selector option
- Support preloading links in SVGs
- Create temporary visits for preload hooks

## [3.2.8] - 2024-01-26

- Ignore external links on hover

## [3.2.7] - 2023-10-20

- Fix `options.preloadHoveredLinks`

## [3.2.6] - 2023-10-13

- Fix `swup.preload` function signature

## [3.2.5] - 2023-09-28

- Use `@swup/cli` for bundling
- New option `preloadVisibleLinks.ignore`
- Fix duplicate links not being preloaded

## [3.2.4] - 2023-08-31

- Inline queue implementation to fix webpack bundling error

## [3.2.3] - 2023-08-24

- Add fallback if `requestIdleCallback` is unavailable

## [3.2.2] - 2023-08-16

- Fix missing dist files

## [3.2.1] - 2023-08-15

- Optimize intersection observer performance
- Fix issue where links might be preloaded multiple times
- Improve plugin options type

## [3.2.0] - 2023-08-13

- Preload links on keyboard focus
- Preload links as they enter the viewport
- Prioritize hovered links for preload

## [3.1.2] - 2023-07-29

- Fix regression: Make sure only local links are being preloaded

## [3.1.1] - 2023-07-28

- Make the type declarations discoverable from package.json

## [3.1.0] - 2023-07-28

- Port to TypeScript
- Augmentation of plugin methods and hooks injected into swup

## [3.0.0] - 2023-07-26

- Renamed preload method: `swup.preload(url)`
- Update for swup 4 compatibility

## [2.3.0] - 2023-06-27

- Allow disabling preload of initial page

## [2.2.0] - 2023-06-09

- Preloading all children of container

## [2.1.0] - 2023-03-07

- Support multiple concurrent preloads when hovering links

## [2.0.1] - 2023-01-29

- Use shared browserslist config

## [2.0.0] - 2023-01-18

- Switch to microbundle
- Export native ESM module

## [1.1.0] - 2023-01-05

- Reject faulty server response
- Preload at the start of touch events on touch devices to speed up loading time

## [1.0.6] - 2022-12-29

- Respect ignored visits

## [1.0.5] - 2022-08-24

- Cache the initial page’s unmodified DOM
- Warn if swup's cache is disabled

## [1.0.4] - 2022-08-02

- Fix error when preloading page that results in a server error

## [1.0.3] - 2019-06-10

- Fix wrong link selector

## [1.0.2] - 2019-05-26

- Update readme

## [1.0.1] - 2019-05-26

- Update readme

## [1.0.0] - 2019-05-26

- Initial release

[3.2.10]: https://github.com/swup/preload-plugin/releases/tag/3.2.10
[3.2.9]: https://github.com/swup/preload-plugin/releases/tag/3.2.9
[3.2.8]: https://github.com/swup/preload-plugin/releases/tag/3.2.8
[3.2.7]: https://github.com/swup/preload-plugin/releases/tag/3.2.7
[3.2.6]: https://github.com/swup/preload-plugin/releases/tag/3.2.6
[3.2.5]: https://github.com/swup/preload-plugin/releases/tag/3.2.5
[3.2.4]: https://github.com/swup/preload-plugin/releases/tag/3.2.4
[3.2.3]: https://github.com/swup/preload-plugin/releases/tag/3.2.3
[3.2.2]: https://github.com/swup/preload-plugin/releases/tag/3.2.2
[3.2.1]: https://github.com/swup/preload-plugin/releases/tag/3.2.1
[3.2.0]: https://github.com/swup/preload-plugin/releases/tag/3.2.0
[3.1.2]: https://github.com/swup/preload-plugin/releases/tag/3.1.2
[3.1.1]: https://github.com/swup/preload-plugin/releases/tag/3.1.1
[3.1.0]: https://github.com/swup/preload-plugin/releases/tag/3.1.0
[3.0.0]: https://github.com/swup/preload-plugin/releases/tag/3.0.0
[2.3.0]: https://github.com/swup/preload-plugin/releases/tag/2.3.0
[2.2.0]: https://github.com/swup/preload-plugin/releases/tag/2.2.0
[2.1.0]: https://github.com/swup/preload-plugin/releases/tag/2.1.0
[2.0.1]: https://github.com/swup/preload-plugin/releases/tag/2.0.1
[2.0.0]: https://github.com/swup/preload-plugin/releases/tag/2.0.0
[1.1.0]: https://github.com/swup/preload-plugin/releases/tag/1.1.0
[1.0.6]: https://github.com/swup/preload-plugin/releases/tag/1.0.6
[1.0.5]: https://github.com/swup/preload-plugin/releases/tag/1.0.5
[1.0.4]: https://github.com/swup/preload-plugin/releases/tag/1.0.4
[1.0.3]: https://github.com/swup/preload-plugin/releases/tag/1.0.3
[1.0.2]: https://github.com/swup/preload-plugin/releases/tag/1.0.2
[1.0.1]: https://github.com/swup/preload-plugin/releases/tag/1.0.1
[1.0.0]: https://github.com/swup/preload-plugin/releases/tag/1.0.0
