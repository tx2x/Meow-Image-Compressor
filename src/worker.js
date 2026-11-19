import UPNG from 'upng-js';
import oxipng from '@jsquash/oxipng/optimise';
import { encode as jpeg } from '@jsquash/jpeg';
import { encode as webp } from '@jsquash/webp';
import { encode as avif } from '@jsquash/avif';
import { decode as jxlDecode } from '@jsquash/jxl';
// Use the single-threaded JXL encoder directly: the auto-selected multithreaded build aborts when
// SharedArrayBuffer / pthread workers are unavailable (no cross-origin isolation).
import jxlFactory from '@jsquash/jxl/codec/enc/jxl_enc.js';
import { defaultOptions as jxlDefaults } from '@jsquash/jxl/meta.js';
import { optimize } from 'svgo/browser';
import initIq, { ImageQuantizer, encode_palette_to_png } from 'libimagequant-wasm/wasm/libimagequant_wasm.js';
import iqWasm from 'libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm?url';

let iqReady, jxlMod;
async function encodeJxl(img, q) {
  const m = await (jxlMod ??= jxlFactory({ noInitialRun: true }));
  const big = img.width * img.height > 8e6;
  const o = q >= 100 ? { lossless: true, quality: 100, lossyModular: false, lossyPalette: false } : { quality: q };
  const r = m.encode(img.data, img.width, img.height, { ...jxlDefaults, effort: big ? 5 : 7, ...o });
  if (!r) throw new Error('JPEG XL encoding failed');
  return r.buffer;
}
const colorsFor = q => Math.min(256, Math.max(16, Math.round(q * 2.56)));
const opti = png => oxipng(png, { level: 4, interlace: false, optimiseAlpha: true });

// libimagequant: perceptual palette + dithering, then OxiPNG
async function quantPng(img, q) {
  await (iqReady ??= initIq({ module_or_path: iqWasm }));
  const iq = new ImageQuantizer();
  try {
    iq.setMaxColors(colorsFor(q)); iq.setQuality(0, q); iq.setSpeed(3);
    const res = iq.quantizeImage(img.data, img.width, img.height);
    try {
      res.setDithering(0.9);
      const idx = res.getPaletteIndices(img.data, img.width, img.height);
      return await opti(encode_palette_to_png(idx, res.getPalette(), img.width, img.height));
    } finally { res.free(); }
  } finally { iq.free(); }
}

self.onmessage = async ({ data: { img, fmt, q, svg, dec } }) => {
  try {
    // Decode a .jxl to PNG for previews (most browsers can't display JXL)
    if (dec) {
      const im = await jxlDecode(dec), c = new OffscreenCanvas(im.width, im.height);
      c.getContext('2d').putImageData(im, 0, 0);
      return self.postMessage({ png: await c.convertToBlob({ type: 'image/png' }) });
    }
    let out, mime;
    if (fmt === 'svg') {
      const p = Math.max(1, Math.round(q / 20)); // precision 1..5
      const r = optimize(svg, { multipass: true, plugins: [{ name: 'preset-default', params: { floatPrecision: p } }] });
      out = new TextEncoder().encode(r.data); mime = 'image/svg+xml';
    } else if (fmt === 'png') {
      const raw = UPNG.encode([img.data.buffer], img.width, img.height, q >= 100 ? 0 : colorsFor(q));
      out = await opti(raw); mime = 'image/png';
    } else if (fmt === 'pngq') {
      out = await quantPng(img, q); mime = 'image/png';
    } else if (fmt === 'jpeg') {
      out = await jpeg(img, { quality: q }); mime = 'image/jpeg';
    } else if (fmt === 'webp') {
      out = await webp(img, { quality: q, method: 6 }); mime = 'image/webp';
    } else if (fmt === 'jxl') {
      out = new Uint8Array(await encodeJxl(img, q)); mime = 'image/jxl';
    } else {
      out = await avif(img, { quality: q, speed: 6 }); mime = 'image/avif';
    }
    const buf = out.buffer ?? out;
    self.postMessage({ out: new Uint8Array(buf), mime }, [buf]);
  } catch (e) { self.postMessage({ err: String(e?.message || e) }); }
};
