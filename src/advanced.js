// Format-specific advanced options: schema-driven controls (kept per format while the page is open).
const R = (id, label, min, max, def) => ({ id, label, type: 'range', min, max, def });
const N = (id, label, min, max, def) => ({ id, label, type: 'number', min, max, def });
const C = (id, label, def = false) => ({ id, label, type: 'check', def });
const S = (id, label, opts, def) => ({ id, label, type: 'select', opts, def });

const OXI = [R('oxi', 'OxiPNG effort (higher = slower)', 0, 6, 4), C('interlace', 'Interlaced (Adam7)'), C('alpha', 'Optimise transparent pixels', true)];
export const ADV = {
  png: [N('colors', 'Max colours (0 = auto from quality)', 0, 256, 0), ...OXI],
  pngq: [N('colors', 'Max colours (0 = auto from quality)', 0, 256, 0), R('dither', 'Dithering (%)', 0, 100, 90), R('speed', 'Quantiser speed (1 = best, 10 = fastest)', 1, 10, 3), ...OXI],
  jpeg: [C('progressive', 'Progressive', true), S('chroma', 'Chroma subsampling', [['auto', 'Auto'], ['444', '4:4:4 (sharpest colour)'], ['420', '4:2:0 (smallest)']], 'auto'),
    S('quant', 'Quantisation table', [['3', 'MozJPEG default'], ['0', 'Standard JPEG'], ['2', 'MS-SSIM tuned'], ['4', 'PSNR-HVS-M tuned']], '3'), C('trellis', 'Trellis optimisation (slower, smaller)')],
  webp: [C('lossless', 'Lossless (ignores quality)'), R('method', 'Effort (0 = fast, 6 = best)', 0, 6, 6), R('nearll', 'Near-lossless (100 = off, lossless only)', 0, 100, 100), C('sharp', 'Sharp YUV (better colour edges)'), C('exact', 'Keep colour of transparent pixels')],
  avif: [C('lossless', 'Lossless (ignores quality and chroma)'), R('speed', 'Speed (0 = slowest/best, 10 = fastest)', 0, 10, 6), S('chroma', 'Chroma subsampling', [['420', '4:2:0 (smallest)'], ['422', '4:2:2'], ['444', '4:4:4 (sharpest colour)']], '420'), C('sharp', 'Sharp YUV (better colour edges)')],
  jxl: [C('lossless', 'Lossless (ignores quality)'), R('effort', 'Effort (1 = fast, 9 = best)', 1, 9, 7), C('progressive', 'Progressive')],
  svg: [N('precision', 'Number precision, digits (0 = auto from quality)', 0, 8, 0), C('multipass', 'Multipass', true), C('pretty', 'Pretty-print output')]
};

const vals = {};
/** Current advanced values for a format, defaults filled in. */
export const getAdv = fmt => Object.fromEntries((ADV[fmt] || []).map(c => [c.id, vals[fmt]?.[c.id] ?? c.def]));

export function renderAdvanced(fmt, host, onChange) {
  const cur = getAdv(fmt);
  host.innerHTML = (ADV[fmt] || []).map(c => {
    const v = cur[c.id], id = `data-id="${c.id}"`;
    if (c.type === 'check') return `<label class="sw"><input type="checkbox" ${id} ${v ? 'checked' : ''}>${c.label}</label>`;
    if (c.type === 'range') return `<label class="ctl">${c.label} <b>${v}</b><input type="range" ${id} min="${c.min}" max="${c.max}" value="${v}"></label>`;
    if (c.type === 'number') return `<label class="ctl">${c.label}<input type="number" ${id} min="${c.min}" max="${c.max}" value="${v}"></label>`;
    return `<label class="ctl">${c.label}<select ${id}>${c.opts.map(([o, t]) => `<option value="${o}" ${o === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
  }).join('') || '<p class="muted">Select an output format to see its options.</p>';
  host.oninput = e => {
    const el = e.target.closest('[data-id]'); if (!el) return;
    (vals[fmt] ??= {})[el.dataset.id] = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? +el.value || 0 : el.value;
    if (el.type === 'range') el.previousElementSibling.textContent = el.value;
    onChange();
  };
}
