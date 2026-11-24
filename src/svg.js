// SVG helpers: natural size detection and re-sizing so vectors are rasterised crisply at any target size.
const UNITS = { in: 96, cm: 96 / 2.54, mm: 96 / 25.4, pt: 96 / 72, pc: 16, q: 96 / 101.6, em: 16, rem: 16, ex: 8 };
const rootTag = t => /<svg\b[^>]*>/i.exec(t)?.[0] || '';
const attr = (tag, n) => new RegExp(`\\s${n}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag)?.[1];
const len = v => {
  if (!v || v.includes('%')) return 0;
  const x = parseFloat(v); if (!(x > 0)) return 0;
  return x * (UNITS[/[a-z]+$/i.exec(v)?.[0]?.toLowerCase()] || 1);
};

export function svgSize(txt) {
  const tag = rootTag(txt);
  let w = len(attr(tag, 'width')), h = len(attr(tag, 'height'));
  const vb = attr(tag, 'viewBox')?.trim().split(/[\s,]+/).map(Number);
  const ok = vb?.length === 4 && vb[2] > 0 && vb[3] > 0;
  if (ok) { if (!w && !h) { w = vb[2]; h = vb[3]; } else if (!w) w = h * vb[2] / vb[3]; else if (!h) h = w * vb[3] / vb[2]; }
  return { w: Math.round(w) || 1024, h: Math.round(h) || 1024, hasViewBox: !!ok };
}

/** Same SVG with width/height forced to W x H (and a viewBox added if missing) so it scales as a vector. */
export function svgAtSize(txt, W, H) {
  const { w, h, hasViewBox } = svgSize(txt);
  return txt.replace(/<svg\b[^>]*>/i, tag => tag
    .replace(/\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
    .replace(/<svg\b/i, `<svg width="${W}" height="${H}"${hasViewBox ? '' : ` viewBox="0 0 ${w} ${h}"`}`));
}
