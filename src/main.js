import './style.css';
import { zipSync } from 'fflate';
import { openCompare } from './compare.js';
import { initTheme } from './theme.js';

const $ = s => document.querySelector(s);
const EXT = { png: 'png', pngq: 'png', jpeg: 'jpg', webp: 'webp', avif: 'avif', jxl: 'jxl', svg: 'svg' };
// output formats that count as "same format" as an input type (for the never-bigger fallback)
const SAME = { 'image/png': ['png', 'pngq'], 'image/jpeg': ['jpeg'], 'image/webp': ['webp'], 'image/avif': ['avif'], 'image/jxl': ['jxl'], 'image/svg+xml': ['svg'] };
const LABEL = { 'image/png': 'PNG', 'image/jpeg': 'JPEG', 'image/webp': 'WebP', 'image/avif': 'AVIF', 'image/gif': 'GIF', 'image/bmp': 'BMP', 'image/svg+xml': 'SVG', 'image/jxl': 'JPEG XL', 'image/tiff': 'TIFF', 'image/x-icon': 'ICO', 'image/vnd.microsoft.icon': 'ICO', 'image/heic': 'HEIC', 'image/heif': 'HEIF' };
const kindOf = f => LABEL[f.type] || /\.([a-z0-9]+)$/i.exec(f.name)?.[1].toUpperCase() || 'Image';
const loadImg = url => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Cannot decode SVG')); i.src = url; });
// JXL previews: decode in a throw-away worker (most browsers can't show .jxl)
const preview = async blob => {
  const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }), dec = await blob.arrayBuffer();
  return new Promise((ok, no) => { w.onmessage = e => { w.terminate(); e.data.err ? no(new Error(e.data.err)) : ok(e.data.png); }; w.postMessage({ dec }, [dec]); });
};

const items = [], queue = [], pool = [];
const N = Math.max(1, Math.min((navigator.hardwareConcurrency || 2) - 1, 6));
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB';
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cfg = () => ({ fmt: $('#fmt').value, q: +$('#q').value, max: +$('#max').value || 0 });
const needsWork = it => it.state === 'ready' || it.state === 'error' || (it.state === 'done' && it.stale);

function hint() {
  const { fmt, q } = cfg(); $('#qv').textContent = q;
  const c = Math.min(256, Math.max(16, Math.round(q * 2.56)));
  $('#hint').textContent = {
    '': 'Choose an output format, add images, then press Process.',
    png: q >= 100 ? 'PNG (UPNG): lossless + OxiPNG.' : `PNG (UPNG): fast palette quantisation (~${c} colours) + OxiPNG. 100 = lossless.`,
    pngq: `PNG (libimagequant): perceptual palette (up to ${c} colours) with dithering + OxiPNG. Usually the best lossy PNG.`,
    jpeg: 'JPEG: MozJPEG. Transparency is flattened onto white.',
    webp: 'WebP: libwebp, slowest/best method.',
    avif: 'AVIF: best ratio, slowest to encode.',
    jxl: q >= 100 ? 'JPEG XL: lossless. Few browsers display .jxl, but previews here are decoded for you.' : 'JPEG XL: excellent quality per byte. Few browsers display .jxl files natively.',
    svg: `SVG: SVGO multipass optimisation (precision ${Math.max(1, Math.round(q / 20))}). Vector stays vector; non-SVG files are skipped.`
  }[fmt] || '';
}

function worker() {
  let w = pool.find(w => !w.busy);
  if (!w && pool.length < N) { w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); pool.push(w); }
  return w;
}
const call = (w, msg, tr) => new Promise((ok, no) => {
  w.onmessage = e => e.data.err ? no(Object.assign(new Error(e.data.err), { fatal: true })) : ok(e.data);
  w.onerror = e => no(Object.assign(new Error(e.message || 'Worker crashed'), { fatal: true }));
  w.postMessage(msg, tr);
});

function pump() {
  while (queue.length) {
    const w = worker(); if (!w) return;
    run(w, queue.shift());
  }
}

async function run(w, it) {
  w.busy = true; const g = it.gen; it.state = 'busy'; paint(it);
  try {
    const s = cfg(), fmt = s.fmt, isSvg = it.file.type === 'image/svg+xml' || /\.svg$/i.test(it.file.name);
    if (!fmt) { it.state = 'ready'; return; }
    let r, k = 1;
    if (fmt === 'svg') {
      if (!isSvg) { it.state = 'skipped'; it.msg = 'Not an SVG'; it.blob = null; return; }
      r = await call(w, { fmt, q: s.q, svg: await it.file.text() });
    } else {
      const src = isSvg ? await loadImg(it.url) : await createImageBitmap(it.file);
      const sw = (src.naturalWidth ?? src.width) || 1024, sh = (src.naturalHeight ?? src.height) || 1024;
      k = s.max && Math.max(sw, sh) > s.max ? s.max / Math.max(sw, sh) : 1;
      const W = Math.round(sw * k), H = Math.round(sh * k);
      const ctx = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
      if (fmt === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
      ctx.imageSmoothingQuality = 'high'; ctx.drawImage(src, 0, 0, W, H); src.close?.();
      const img = ctx.getImageData(0, 0, W, H);
      r = await call(w, { img, fmt, q: s.q }, [img.data.buffer]);
    }
    if (g !== it.gen) return;
    let blob = new Blob([r.out], { type: r.mime }), ext = EXT[fmt];
    if (k === 1 && SAME[it.file.type]?.includes(fmt) && blob.size >= it.file.size) { blob = it.file; ext = it.file.name.split('.').pop(); }
    Object.assign(it, { blob, ext, state: 'done', stale: false, msg: '' });
  } catch (e) {
    // a WASM module that aborted is unusable afterwards: drop this worker, a fresh one is spawned on demand
    if (e.fatal) { w.terminate(); const i = pool.indexOf(w); if (i >= 0) pool.splice(i, 1); }
    if (g === it.gen) Object.assign(it, { state: 'error', msg: e.message, blob: null });
  } finally { w.busy = false; paint(it); summary(); pump(); }
}

function paint(it) {
  const li = it.li, done = it.state === 'done';
  const saved = done ? Math.round((1 - it.blob.size / it.file.size) * 100) : 0;
  let right;
  if (done) right = `<span class="badge ${saved > 0 ? 'good' : ''} ${it.stale ? 'stale' : ''}" ${it.stale ? 'title="Settings changed since this was processed"' : ''}>${saved > 0 ? '−' + saved : '+' + -saved}%</span>${it.stale ? '<button class="proc">Redo</button>' : ''}<button class="ghost cmp">Compare</button><button class="dl">Download</button>`;
  else if (it.state === 'busy' || it.state === 'queued') right = `<span class="st">${it.state === 'queued' ? 'Queued…' : 'Compressing…'}</span>`;
  else right = `${it.msg ? `<span class="st" title="${esc(it.msg)}">${esc(it.msg)}</span>` : ''}<button class="proc">Process</button>`;
  li.innerHTML = `<img src="${it.url}" alt=""><div class="meta"><b title="${esc(it.file.name)}">${esc(it.file.name)}</b>
    <small>${fmtSize(it.file.size)}${done ? ` → ${fmtSize(it.blob.size)}` : ''}</small><small class="fmt">${esc(kindOf(it.file))}</small></div>
    ${right}<button class="rm" title="Remove" aria-label="Remove">✕</button>`;
  li.querySelector('.rm').onclick = () => removeItem(it);
  const pb = li.querySelector('.proc');
  if (pb) { pb.onclick = () => enqueue([it]); pb.disabled = !cfg().fmt; pb.title = pb.disabled ? 'Select an output format first' : ''; }
  if (done) {
    li.querySelector('.dl').onclick = () => save(it.blob, outName(it));
    li.querySelector('.cmp').onclick = li.querySelector('img').onclick = () => openCompare(it.file, it.blob, preview);
    li.querySelector('img').style.cursor = 'zoom-in';
  }
}
function removeItem(it) {
  it.gen++; const q = queue.indexOf(it); if (q >= 0) queue.splice(q, 1);
  const i = items.indexOf(it); if (i >= 0) items.splice(i, 1);
  URL.revokeObjectURL(it.url); it.li.remove(); summary();
}
const outName = it => it.file.name.replace(/\.[^.]+$/, '') + '-min.' + it.ext;
function save(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4e3);
}
function summary() {
  const d = items.filter(i => i.state === 'done');
  $('#bar').hidden = !items.length;
  const a = d.reduce((s, i) => s + i.file.size, 0), b = d.reduce((s, i) => s + i.blob.size, 0);
  $('#sum').textContent = `${d.length}/${items.length} done · saved ${fmtSize(Math.max(0, a - b))}${a ? ` (${Math.round((1 - b / a) * 100)}%)` : ''}`;
  const noFmt = !cfg().fmt;
  $('#proc').disabled = noFmt || !items.some(needsWork);
  $('#proc').title = noFmt ? 'Select an output format first' : '';
  $('#zip').disabled = !d.length;
}

function enqueue(list) {
  if (!cfg().fmt) return;
  for (const it of list) {
    if (it.state === 'queued' || it.state === 'busy') continue;
    Object.assign(it, { state: 'queued', msg: '', stale: false }); queue.push(it); paint(it);
  }
  summary(); pump();
}

function add(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const li = document.createElement('li'); $('#list').append(li);
    const it = { file, li, gen: 0, url: URL.createObjectURL(file), state: 'ready', msg: '' };
    items.push(it); paint(it);
  }
  summary();
}

function onSettings() {
  hint();
  for (const it of items) {
    if (it.state === 'done' && !it.stale) { it.stale = true; paint(it); }      // result was made with older settings
    else if (it.state === 'skipped') { it.state = 'ready'; it.msg = ''; paint(it); }
  }
  document.querySelectorAll('.proc').forEach(b => { b.disabled = !cfg().fmt; b.title = b.disabled ? 'Select an output format first' : ''; });
  summary();
}

['fmt', 'q', 'max'].forEach(id => $('#' + id).addEventListener('input', onSettings));
$('#file').onchange = e => { add(e.target.files); e.target.value = ''; };
const drop = $('#drop');
['dragenter', 'dragover'].forEach(n => drop.addEventListener(n, e => { e.preventDefault(); drop.classList.add('on'); }));
['dragleave', 'drop'].forEach(n => drop.addEventListener(n, () => drop.classList.remove('on')));
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', e => { e.preventDefault(); add(e.dataTransfer.files); }); // single drop handler (no double-add)
window.addEventListener('paste', e => add([...e.clipboardData.files]));
$('#proc').onclick = () => enqueue(items.filter(needsWork));
$('#clear').onclick = () => { queue.length = 0; items.forEach(i => { i.gen++; URL.revokeObjectURL(i.url); }); items.length = 0; $('#list').innerHTML = ''; summary(); };
$('#zip').onclick = async () => {
  const files = {}, seen = new Set();
  for (const i of items.filter(i => i.state === 'done')) {
    let name = outName(i); if (seen.has(name)) name = `${seen.size}-${name}`; seen.add(name);
    files[name] = new Uint8Array(await i.blob.arrayBuffer());
  }
  save(new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' }), 'meow-compressed.zip');
};
hint(); summary(); initTheme();
if ('serviceWorker' in navigator && import.meta.env.PROD) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
