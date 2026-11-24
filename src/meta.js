// EXIF / XMP (and PNG text chunk) preservation: read from the source file, write into PNG, JPEG or WebP output.
import { unzlibSync } from 'fflate';
import { util } from './icc.js';
const { u32, tag, str, cat, crc32, be32, le32, le24 } = util;
const XMP_NS = 'http://ns.adobe.com/xap/1.0/\0';
const u8 = a => new Uint8Array(a);

// The browser already applies EXIF orientation to the pixels, so reset the tag to avoid rotating twice.
function fixOrientation(src) {
  const t = src.slice();
  try {
    const le = t[0] === 0x49, dv = new DataView(t.buffer), ifd = dv.getUint32(4, le), n = dv.getUint16(ifd, le);
    for (let i = 0; i < n; i++) { const o = ifd + 2 + i * 12; if (dv.getUint16(o, le) === 0x0112) { dv.setUint16(o + 8, 1, le); break; } }
  } catch { /* malformed EXIF: keep as is */ }
  return t;
}

function fromJpeg(b) {
  const m = {};
  for (let i = 2; i + 4 < b.length && b[i] === 0xff;) {
    const mk = b[i + 1], len = (b[i + 2] << 8) | b[i + 3];
    if (mk === 0xda || mk === 0xd9) break;
    if (mk === 0xe1) {
      const p = b.subarray(i + 4, i + 2 + len);
      if (tag(p, 0) === 'Exif' && p[4] === 0) m.exif = p.subarray(6);
      else if (String.fromCharCode(...p.subarray(0, 29)) === XMP_NS) m.xmp = p.subarray(29);
    }
    i += 2 + len;
  }
  return m;
}
function fromPng(b) {
  const m = { texts: [] };
  for (let i = 8; i + 12 <= b.length;) {
    const len = u32(b, i), t = tag(b, i + 4), d = b.subarray(i + 8, i + 8 + len);
    if (t === 'eXIf') m.exif = d;
    else if (t === 'tEXt' || t === 'zTXt' || t === 'iTXt') {
      m.texts.push(b.slice(i + 4, i + 8 + len));                       // raw type + data, for PNG -> PNG
      if (t === 'iTXt' && String.fromCharCode(...d.subarray(0, 17)) === 'XML:com.adobe.xmp') { // XMP, for other targets
        let p = 18; const comp = d[p]; p += 2;
        p = d.indexOf(0, p) + 1; p = d.indexOf(0, p) + 1;
        m.xmp = comp ? unzlibSync(d.subarray(p)) : d.slice(p);
      }
    }
    if (t === 'IEND') break;
    i += 12 + len;
  }
  return m;
}
function fromWebp(b) {
  const m = {};
  for (let i = 12; i + 8 <= b.length;) {
    const t = tag(b, i), len = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
    if (t === 'EXIF') m.exif = b.slice(i + 8, i + 8 + len);
    else if (t === 'XMP ') m.xmp = b.slice(i + 8, i + 8 + len);
    i += 8 + len + (len & 1);
  }
  return m;
}

/** Returns { exif, xmp, texts } (any may be missing) or null when the file has no metadata. */
export async function readMeta(file) {
  try {
    const b = u8(await file.arrayBuffer());
    const m = b[0] === 0xff && b[1] === 0xd8 ? fromJpeg(b)
      : b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 ? fromPng(b)
      : tag(b, 0) === 'RIFF' && tag(b, 8) === 'WEBP' ? fromWebp(b) : null;
    if (!m || !(m.exif || m.xmp || m.texts?.length)) return null;
    if (m.exif) m.exif = fixOrientation(tag(m.exif, 0) === 'Exif' ? m.exif.subarray(6) : m.exif);
    return m;
  } catch { return null; }
}

// ---- embedding ----------------------------------------------------------------
const pngChunk = (t, d) => { const body = cat([u8(str(t)), d]); return cat([u8(be32(d.length)), body, u8(be32(crc32(body)))]); };

function pngEmbed(out, m) {
  const add = [];
  if (m.exif) add.push(pngChunk('eXIf', m.exif));
  if (m.texts?.length) for (const t of m.texts) add.push(pngChunk(tag(t, 0), t.subarray(4)));
  else if (m.xmp) add.push(pngChunk('iTXt', cat([u8(str('XML:com.adobe.xmp\0\0\0\0\0')), m.xmp])));
  const parts = [out.subarray(0, 8)]; let done = false;
  for (let i = 8; i < out.length;) {
    const end = i + 12 + u32(out, i);
    if (!done && tag(out, i + 4) === 'IDAT') { parts.push(...add); done = true; }
    parts.push(out.subarray(i, end)); i = end;
  }
  return cat(parts);
}
function jpegEmbed(out, m) {
  const seg = p => (p.length + 2 > 65535 ? null : cat([u8([0xff, 0xe1, (p.length + 2) >> 8, (p.length + 2) & 255]), p])); // >64 KB does not fit one segment
  const segs = [];
  if (m.exif) segs.push(seg(cat([u8(str('Exif\0\0')), m.exif])));
  if (m.xmp) segs.push(seg(cat([u8(str(XMP_NS)), m.xmp])));
  const at = out[2] === 0xff && out[3] === 0xe0 ? 4 + ((out[4] << 8) | out[5]) : 2;
  return cat([out.subarray(0, at), ...segs.filter(Boolean), out.subarray(at)]);
}
function webpEmbed(out, m, w, h) {
  const ck = (t, d) => cat([u8([...str(t), ...le32(d.length)]), d, u8(d.length & 1)]);
  let body = out.subarray(12), vp8x;
  if (tag(body, 0) === 'VP8X') { vp8x = body.slice(0, 18); body = body.subarray(18); }
  else vp8x = ck('VP8X', u8([tag(body, 0) === 'VP8L' && (body[12] & 0x10) ? 0x10 : 0, 0, 0, 0, ...le24(w - 1), ...le24(h - 1)]));
  vp8x[8] |= (m.exif ? 0x08 : 0) | (m.xmp ? 0x04 : 0);
  const rest = cat([vp8x, body, ...(m.exif ? [ck('EXIF', m.exif)] : []), ...(m.xmp ? [ck('XMP ', m.xmp)] : [])]);
  return cat([u8([...str('RIFF'), ...le32(rest.length + 4), ...str('WEBP')]), rest]);
}

export function embedMeta(fmt, out, m, w, h) {
  if (fmt === 'png' || fmt === 'pngq') return pngEmbed(out, m);
  if (fmt === 'jpeg') return jpegEmbed(out, m);
  if (fmt === 'webp') return webpEmbed(out, m, w, h);
  return out;
}
