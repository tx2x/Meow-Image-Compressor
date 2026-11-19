<p align="center"><img src="public/icon.svg" alt="Meow Image Compressor logo" width="128"></p>

<h1 align="center">Meow Image Compressor</h1>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/runs-100%25%20offline-3ddc97" alt="Runs offline">
  <img src="https://img.shields.io/badge/uploads-none-7c9cff" alt="No uploads">
</p>

**Private, offline and unlimited image compression that runs entirely in your browser.**
A free, open-source alternative to online compressors: no uploads, no accounts, no file-count or file-size limits.

![Meow Image Compressor screenshot](docs/screenshot.png)

## Features

- 🔒 **100% local**: files never leave your device. Works with no internet after the first load.
- ♾️ **No limits**: any number of files, any size (bounded only by your device's memory).
- 🧠 **Modern codecs, compiled to WebAssembly**

  | Format | Engine | Notes |
  | --- | --- | --- |
  | PNG (libimagequant) | libimagequant + OxiPNG | Perceptual palette with dithering, usually the best lossy PNG |
  | PNG (UPNG) | UPNG + OxiPNG | Faster quantiser; quality 100 = fully lossless |
  | JPEG | MozJPEG | Transparency is flattened onto white |
  | WebP | libwebp | Slowest / best method |
  | AVIF | libavif (AOM) | Best size-to-quality ratio, slowest to encode |
  | JPEG XL | libjxl | Lossy, or lossless at quality 100 |
  | SVG | SVGO | Multipass optimisation, vectors stay vectors |

- ▶️ **Manual control**: add files first, then press **Process all** or **Process** on a single file.
- 🔍 **Before/after slider** with wheel zoom, pan and a pixel-level 1:1 view.
- ⚡ **Parallel**: a Web Worker pool uses your CPU cores without freezing the UI.
- 📐 Optional resize (max side) and automatic metadata stripping (EXIF/ICC are dropped by re-encoding).
- 🛡️ Never makes a file bigger: if the result is larger than a same-format original, the original is kept.
- 📋 Drag & drop, file picker, clipboard paste, per-file remove (✕), batch **ZIP** download.
- 🌗 Dark and light themes with a one-click switch (Auto / Light / Dark; Auto follows your system).
- 📲 **Optional offline mode (PWA)**: opt in with one click in the footer to cache the app in your browser so it opens without a server or internet. Off by default, removable at any time.

## Quick start

Requires [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone https://github.com/tx2x/Meow-Image-Compressor.git
cd Meow-Image-Compressor
npm install
npm run dev        # development server
npm run build      # production build in ./dist
npm run preview    # serve the production build (stop with Ctrl+C)
npm run preview:lan  # same, but reachable from other devices on your network
```

### Using it fully offline

`npm run build` outputs a static site in `dist/` with every WASM codec bundled and **zero external requests**.
Serve it with any static server (WASM and module workers do not work from `file://`):

```bash
npx serve dist        # or: python -m http.server -d dist
```

You can also host it on GitHub Pages, a NAS or an intranet.

### Offline mode and installing as an app (optional)

Offline mode is **off by default**: nothing is cached and no background worker is registered until you ask for it.
Open the served site and click **Enable offline mode** in the footer. About 10 MB (including every codec) is cached in your browser, and the app then opens
without a server or internet. You can also **Install** it from the browser menu (Chrome, Edge) or **Add to Home Screen** (Safari).
Click **Disable and clear cache** at any time to turn it off again.
Browsers only offer this on `https://` or `http://localhost`; a plain `http://<LAN-IP>` works as a normal website without offline mode.

## Stopping the server

`npm run dev` and `npm run preview` are ordinary foreground processes. They are never installed as a service, never start with your system, and stop when you:

- press **Ctrl+C** in the terminal where they run, or
- close that terminal window.

If a port is still busy (dev uses 5173, preview uses 4173):

```bash
# macOS / Linux
lsof -i :4173          # note the PID
kill <PID>

# Windows (PowerShell)
netstat -ano | findstr :4173
taskkill /PID <PID> /F
```

### The page still opens after the server is stopped or the PC is restarted?

That is the browser's offline cache (Offline mode / an installed app), not a running server. To turn it off:

1. Click **Disable and clear cache** in the footer of the app, **or**
2. Chrome / Edge: press F12 → **Application** → **Service workers** → *Unregister*, then **Storage** → *Clear site data*. Firefox: DevTools → **Storage**, or clear site data for `localhost` in the browser settings.
3. If you installed it as an app, uninstall it (`chrome://apps` → right-click → *Remove*), and check that it is not set to start when you sign in.

If you ran an earlier test build that cached the app automatically, just open the app once while the server is running: it removes the old cache by itself.

## Usage

1. Pick an output format (**Select format...**) and adjust quality (and optionally the max side).
2. Drop, paste or browse for images.
3. Press **Process all**, or **Process** on individual files.
4. Use **Compare** to inspect the result, then **Download** or **Download all (ZIP)**.

Changing settings after processing keeps the existing results but marks them as outdated; use **Redo** or **Process all** to apply the new settings.

## How it works

1. The browser decodes the image (`createImageBitmap`) and optionally resizes it on a canvas.
2. Raw RGBA pixels are sent to a worker that encodes them with the selected WASM codec.
3. The result is shown with the savings and can be downloaded individually or as a ZIP.

## Project structure

```
index.html            App shell
src/main.js           UI, queue and worker pool
src/worker.js         Codecs (run off the main thread)
src/compare.js        Before/after slider
src/theme.js          Auto / light / dark theme
src/style.css         Styles
public/               PWA manifest and icons (icon.svg is the logo)
vite.config.js        Build config + offline service worker generator
docs/                 Screenshot
```

## Browser support and limitations

- Recent Chromium, Firefox and Safari. Input formats are whatever your browser can decode (PNG, JPEG, WebP, GIF, BMP, SVG, usually AVIF).
- Animated GIFs are flattened to the first frame. SVG files can also be rasterised to any bitmap format.
- Very large images are limited by browser memory; AVIF and JPEG XL are CPU-intensive.
- Some browsers cannot display `.jxl` files; the in-app preview decodes them for you.

## Roadmap

- Per-file settings and presets
- SVG → raster size control
- Resizing by percentage and format-specific advanced options

## Contributing

Issues and pull requests are welcome. Please keep the project dependency-light and fully offline-capable.

## Credits

[jSquash](https://github.com/jamsinclair/jSquash) (Squoosh codecs), [libimagequant-wasm](https://www.npmjs.com/package/libimagequant-wasm),
[UPNG.js](https://github.com/photopea/UPNG.js), [SVGO](https://github.com/svg/svgo), [fflate](https://github.com/101arrowz/fflate), [Vite](https://vitejs.dev).

The code was written using web version of Claude Sonnet 5.5 😁.

## License

[MIT](LICENSE)
