// ICC colour-profile helpers: detect/read embedded profiles (PNG, JPEG, WebP, AVIF) and embed one into PNG, JPEG or WebP output.
import { unzlibSync, zlibSync } from 'fflate';

const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const tag = (b, o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const str = s => [...s].map(c => c.charCodeAt(0));
const cat = arrs => { const o = new Uint8Array(arrs.reduce((s, a) => s + a.length, 0)); let p = 0; for (const a of arrs) { o.set(a, p); p += a.length; } return o; };

function info(bytes) {
  let name = '';
  try {
    for (let i = 0, n = u32(bytes, 128); i < n; i++) {
      const o = 132 + i * 12;
      if (tag(bytes, o) !== 'desc') continue;
      const off = u32(bytes, o + 4), type = tag(bytes, off);
      if (type === 'desc') name = new TextDecoder('latin1').decode(bytes.subarray(off + 12, off + 12 + u32(bytes, off + 8))).replace(/\0.*$/s, '');
      else if (type === 'mluc') name = new TextDecoder('utf-16be').decode(bytes.subarray(off + u32(bytes, off + 24), off + u32(bytes, off + 24) + u32(bytes, off + 20)));
      break;
    }
  } catch { /* unreadable description: fall back to a generic name */ }
  name = name.trim() || 'Embedded profile';
  return { bytes, name, space: tag(bytes, 16).trim(), rgb: tag(bytes, 16) === 'RGB ', srgb: /srgb/i.test(name) };
}

function fromJpeg(b) {
  const parts = [];
  for (let i = 2; i + 4 < b.length && b[i] === 0xff;) {
    const m = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (m === 0xda || m === 0xd9) break;
    if (m === 0xe2 && String.fromCharCode(...b.subarray(i + 4, i + 15)) === 'ICC_PROFILE') parts[b[i + 16] - 1] = b.subarray(i + 18, i + 2 + len);
    i += 2 + len;
  }
  return parts.length && parts.every(Boolean) ? cat(parts) : null;
}
function fromPng(b) {
  for (let i = 8; i + 8 <= b.length;) {
    const len = u32(b, i), t = tag(b, i + 4);
    if (t === 'IDAT') return null;
    if (t === 'iCCP') { const d = b.subarray(i + 8, i + 8 + len); return unzlibSync(d.subarray(d.indexOf(0) + 2)); }
    i += 12 + len;
  }
  return null;
}
function fromWebp(b) {
  for (let i = 12; i + 8 <= b.length;) {
    const t = tag(b, i), len = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
    if (t === 'ICCP') return b.slice(i + 8, i + 8 + len);
    i += 8 + len + (len & 1);
  }
  return null;
}
function fromAvif(b) {
  for (let i = 4; i + 12 < b.length; i++)
    if (b[i] === 0x63 && b[i + 1] === 0x6f && b[i + 2] === 0x6c && b[i + 3] === 0x72 && tag(b, i + 4) === 'prof') return b.slice(i + 8, i - 4 + u32(b, i - 4));
  return null;
}

/** Returns { bytes, name, space, rgb, srgb } for an embedded ICC profile, or null. */
export async function readICC(file) {
  try {
    const b = new Uint8Array(await file.slice(0, 1 << 21).arrayBuffer()); // headers live at the start of the file
    const p = b[0] === 0xff && b[1] === 0xd8 ? fromJpeg(b)
      : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? fromPng(b)
      : tag(b, 0) === 'RIFF' && tag(b, 8) === 'WEBP' ? fromWebp(b)
      : tag(b, 4) === 'ftyp' ? fromAvif(b) : null;
    return p && p.length > 132 ? info(p) : null;
  } catch { return null; }
}

// ---- embedding -------------------------------------------------------------
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const be32 = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24];
const le24 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

function pngEmbed(out, icc) {
  const data = cat([new Uint8Array(str('ICC Profile\0\0')), zlibSync(icc)]);   // name, NUL, method 0, zlib data
  const body = cat([new Uint8Array(str('iCCP')), data]);
  const chunk = cat([new Uint8Array(be32(data.length)), body, new Uint8Array(be32(crc32(body)))]);
  const parts = [out.subarray(0, 8)];
  for (let i = 8; i < out.length;) {
    const end = i + 12 + u32(out, i), t = tag(out, i + 4);
    if (!['sRGB', 'gAMA', 'cHRM', 'iCCP'].includes(t)) { parts.push(out.subarray(i, end)); if (t === 'IHDR') parts.push(chunk); }
    i = end;
  }
  return cat(parts);
}
function jpegEmbed(out, icc) {
  const n = Math.ceil(icc.length / 65519), segs = [];
  for (let k = 0; k < n; k++) {
    const d = icc.subarray(k * 65519, (k + 1) * 65519), len = d.length + 16;
    segs.push(new Uint8Array([0xff, 0xe2, len >> 8, len & 255, ...str('ICC_PROFILE\0'), k + 1, n]), d);
  }
  const at = out[2] === 0xff && out[3] === 0xe0 ? 4 + ((out[4] << 8) | out[5]) : 2; // keep JFIF APP0 first
  return cat([out.subarray(0, at), ...segs, out.subarray(at)]);
}
function webpEmbed(out, icc, w, h) {
  const ck = (t, d) => cat([new Uint8Array([...str(t), ...le32(d.length)]), d, new Uint8Array(d.length & 1)]);
  let body = out.subarray(12), vp8x;
  if (tag(body, 0) === 'VP8X') { vp8x = body.slice(0, 18); body = body.subarray(18); vp8x[8] |= 0x20; }
  else {
    const alpha = tag(body, 0) === 'VP8L' && (body[12] & 0x10);
    vp8x = ck('VP8X', new Uint8Array([0x20 | (alpha ? 0x10 : 0), 0, 0, 0, ...le24(w - 1), ...le24(h - 1)]));
  }
  const rest = cat([vp8x, ck('ICCP', icc), body]);
  return cat([new Uint8Array([...str('RIFF'), ...le32(rest.length + 4), ...str('WEBP')]), rest]);
}

export function embedIcc(fmt, out, icc, w, h) {
  if (fmt === 'png' || fmt === 'pngq') return pngEmbed(out, icc);
  if (fmt === 'jpeg') return jpegEmbed(out, icc);
  if (fmt === 'webp') return webpEmbed(out, icc, w, h);
  return out;
}

// shared binary helpers (used by meta.js)
export const util = { u32, tag, str, cat, crc32, be32, le32, le24 };
