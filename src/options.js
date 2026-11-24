// Pure builders that turn the UI settings (quality + advanced options) into encoder options.
export const autoColors = q => Math.min(256, Math.max(16, Math.round(q * 2.56)));
/** UPNG colour count: 0 = lossless */
export const pngColors = (a, q) => a.colors > 0 ? Math.min(256, Math.max(2, a.colors)) : q >= 100 ? 0 : autoColors(q);
export const oxiOpts = a => ({ level: a.oxi ?? 4, interlace: !!a.interlace, optimiseAlpha: a.alpha ?? true });
export const jpegOpts = (a, q) => ({ quality: q, progressive: a.progressive ?? true, auto_subsample: !a.chroma || a.chroma === 'auto', chroma_subsample: a.chroma === '444' ? 1 : 2, quant_table: +(a.quant ?? 3), trellis_multipass: !!a.trellis, trellis_opt_zero: !!a.trellis, trellis_opt_table: !!a.trellis });
export const webpOpts = (a, q) => ({ quality: q, method: a.method ?? 6, lossless: a.lossless ? 1 : 0, near_lossless: a.nearll ?? 100, use_sharp_yuv: a.sharp ? 1 : 0, exact: a.exact ? 1 : 0 });
export const AVIF_SUB = { 444: 3, 422: 2, 420: 1 }; // libavif pixel formats as used by jSquash (0 = monochrome)
export const avifOpts = (a, q) => a.lossless
  ? { quality: 100, speed: a.speed ?? 6, subsample: 3, enableSharpYUV: !!a.sharp, lossless: true }
  : { quality: q, speed: a.speed ?? 6, subsample: AVIF_SUB[a.chroma ?? '420'], enableSharpYUV: !!a.sharp, lossless: false };
export const jxlOpts = (a, q) => { const lossless = !!a.lossless || q >= 100; return { effort: a.effort ?? 7, progressive: !!a.progressive, lossless, quality: lossless ? 100 : q, lossyModular: false, lossyPalette: false }; };
export function svgOpts(a, q, keepMeta) {
  const floatPrecision = a.precision > 0 ? a.precision : Math.max(1, Math.round(q / 20));
  const overrides = keepMeta ? { removeMetadata: false, removeEditorsNSData: false, removeComments: false, removeDesc: false } : {};
  return { multipass: a.multipass ?? true, js2svg: { pretty: !!a.pretty, indent: 2 }, plugins: [{ name: 'preset-default', params: { floatPrecision, overrides } }] };
}
