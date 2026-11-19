# Changelog

## 1.1.0

What's changed
- Offline mode is now optional. By default, nothing is cached and the service worker is not registered. There is an **Enable offline mode** button in the page footer (approx. 10 MB of cache). A **Disable and clear cache** button appears next to it to completely turn off the mode and clear the cache.
- Dev server. `npm run dev` no longer leaves an offline copy behind and removes previous registrations and cache for this app on startup. This also protects other projects running on the same port from having their content overridden by cached assets.
- Legacy registration. If you previously ran an earlier version, it will automatically unregister itself the next time you open the app while the server is running. To handle this, `sw.js` now acts as a "self-destructing" worker, while the actual offline worker lives in `offline-sw.js`.
- Network. `npm run preview` is now accessible locally only. The option for other devices on the network has been moved to a separate `npm run preview:lan` command.

## 1.0.0

First public release.

- Offline, unlimited, private compression: PNG (libimagequant / UPNG + OxiPNG), JPEG (MozJPEG), WebP, AVIF, JPEG XL and SVG (SVGO).
- Manual queue: Process all / per-file Process, remove single files, ZIP download.
- Before/after comparison slider with zoom and pan.
- Dark / light / auto theme.
- Optional offline mode (PWA): opt-in, one-click enable and disable, nothing cached by default.