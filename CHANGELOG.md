# Changelog

All notable changes to this project, newest release first. Within a release, entries are listed in the order they were made.

## 1.5.0

1. **Metadata switch**: new *Keep metadata (EXIF, XMP)* toggle. Metadata is copied into PNG, JPEG and WebP results (also across formats), PNG text chunks are kept for PNG to PNG, SVG keeps its metadata, and the EXIF orientation is reset to avoid double rotation.
2. **Resizing**: scale by percentage or by longest side. Precise size control when an SVG is converted to a bitmap (rendered as a vector at the target size).
3. **Advanced options** for every format: OxiPNG effort and interlacing, libimagequant dithering and speed, JPEG progressive / chroma subsampling / quantisation table / trellis, WebP lossless / effort / near-lossless / sharp YUV, AVIF lossless / speed / chroma, JPEG XL lossless / effort / progressive, SVG precision / multipass / pretty-print.
4. **Windows launcher**: `start.bat` runs the server in its own console window, so Ctrl+C closes it at once without the "Terminate batch job (Y/N)?" question. Startup errors keep the window open until Enter is pressed.
5. Version bumped to 1.5.0; README and changelog updated.

## 1.0.0

First public release. Development history, in order:

1. **Offline compressor**: a fully local, unlimited alternative to online image compressors. PNG (UPNG + OxiPNG), JPEG (MozJPEG), WebP and AVIF compiled to WebAssembly, parallel worker pool, quality slider, optional resize, drag and drop / paste, ZIP download, dark UI.
2. **Fixes and comparison**: files dropped on the drop zone were queued twice (fixed); added the before/after comparison slider with zoom, pan and 1:1 view.
3. **More codecs**: PNG via libimagequant, JPEG XL and SVG optimisation (SVGO); fixed the overly wide *Compare* button.
4. **Stability and usability**: fixed JPEG XL aborting by forcing the single-threaded encoder and recycling crashed workers; per-file remove (✕) button; installable PWA with offline support; light theme with an Auto / Light / Dark switch.
5. **Manual workflow**: files are no longer processed automatically; *Process all* and per-file *Process* buttons; wider layout; long file names are truncated; the original format is shown on a third line; the *Keep original* mode was replaced by *Select format...*.
6. **Rename and branding**: the project became *Meow Image Compressor*; README rewritten with a screenshot placeholder; cat-face logo and icons.
7. **Offline mode made opt-in**: nothing is cached by default; enable or disable it with a footer button; README explains how to stop the server and clear the cache.
8. **Theme, profiles, launchers**: Catppuccin Macchiato (dark) and Latte (light); highlighted colour count for PNG; ICC colour profiles (shown per file, convert to sRGB or keep); `start.bat` / `start.sh` launchers that build, serve and open the browser; single-instance guard with a *Cancel / Start another / Open* prompt.
