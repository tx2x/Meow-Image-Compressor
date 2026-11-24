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
import { embedIcc } from './icc.js';
import { embedMeta } from './meta.js';
import { autoColors, pngColors, oxiOpts, jpegOpts, webpOpts, avifOpts, jxlOpts, svgOpts } from './options.js';
import initIq, { ImageQuantizer, encode_palette_to_png } from 'libimagequant-wasm/wasm/libimagequant_wasm.js';
import iqWasm from 'libimagequant-wasm/wasm/libimagequant_wasm_bg.wasm?url';

let iqReady, jxlMod;
const OUT_BITMAP = ['png', 'pngq', 'jpeg', 'webp'];

async function encodeJxl(img, adv, q) {
  const m = await (jxlMod ??= jxlFactory({ noInitialRun: true }));
  const r = m.encode(img.data, img.width, img.height, { ...jxlDefaults, ...jxlOpts(adv, q) });
  if (!r) throw new Error('JPEG XL encoding failed');
  return r.buffer;
}

// libimagequant: perceptual palette + dithering, then OxiPNG
async function quantPng(img, q, adv) {
  await (iqReady ??= initIq({ module_or_path: iqWasm }));
  const iq = new ImageQuantizer();
  try {
    iq.setMaxColors(adv.colors > 0 ? Math.min(256, Math.max(2, adv.colors)) : autoColors(q)); iq.setQuality(0, q); iq.setSpeed(adv.speed ?? 3);
    const res = iq.quantizeImage(img.data, img.width, img.height);
    try {
      res.setDithering((adv.dither ?? 90) / 100);
      const idx = res.getPaletteIndices(img.data, img.width, img.height);
      return await oxipng(encode_palette_to_png(idx, res.getPalette(), img.width, img.height), oxiOpts(adv));
    } finally { res.free(); }
  } finally { iq.free(); }
}

self.onmessage = async ({ data: { img, fmt, q, adv = {}, svg, dec, icc, meta, keepMeta } }) => {
  try {
    // Decode a .jxl to PNG for previews (most browsers can't display JXL)
    if (dec) {
      const im = await jxlDecode(dec), c = new OffscreenCanvas(im.width, im.height);
      c.getContext('2d').putImageData(im, 0, 0);
      return self.postMessage({ png: await c.convertToBlob({ type: 'image/png' }) });
    }
    let out, mime;
    if (fmt === 'svg') {
      out = new TextEncoder().encode(optimize(svg, svgOpts(adv, q, keepMeta)).data); mime = 'image/svg+xml';
    } else if (fmt === 'png') {
      out = await oxipng(UPNG.encode([img.data.buffer], img.width, img.height, pngColors(adv, q)), oxiOpts(adv)); mime = 'image/png';
    } else if (fmt === 'pngq') {
      out = await quantPng(img, q, adv); mime = 'image/png';
    } else if (fmt === 'jpeg') {
      out = await jpeg(img, jpegOpts(adv, q)); mime = 'image/jpeg';
    } else if (fmt === 'webp') {
      out = await webp(img, webpOpts(adv, q)); mime = 'image/webp';
    } else if (fmt === 'jxl') {
      out = new Uint8Array(await encodeJxl(img, adv, q)); mime = 'image/jxl';
    } else {
      out = await avif(img, avifOpts(adv, q)); mime = 'image/avif';
    }
    if (OUT_BITMAP.includes(fmt) && (icc || meta)) {
      out = out instanceof Uint8Array ? out : new Uint8Array(out);
      if (icc) out = embedIcc(fmt, out, icc, img.width, img.height);
      if (meta) out = embedMeta(fmt, out, meta, img.width, img.height);   // after ICC: a WebP gets its VP8X/ICCP first
    }
    const buf = out.buffer ?? out;
    self.postMessage({ out: new Uint8Array(buf), mime }, [buf]);
  } catch (e) { self.postMessage({ err: String(e?.message || e) }); }
};
