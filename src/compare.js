const kb = n => n > 1048576 ? (n / 1048576).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB';

export function openCompare(file, blob, fallback) {
  const a = URL.createObjectURL(file), b = URL.createObjectURL(blob);
  const pct = Math.round((1 - blob.size / file.size) * 100);
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="cmpbox">
    <div class="stage">
      <div class="layer"><img src="${a}" draggable="false" alt=""></div>
      <div class="layer top"><img src="${b}" draggable="false" alt=""></div>
      <div class="handle"><i>⇄</i></div>
      <span class="tag l">Original · ${kb(file.size)}</span>
      <span class="tag r">Compressed · ${kb(blob.size)} (${pct > 0 ? '−' + pct : '+' + -pct}%)</span>
    </div>
    <div class="tools"><span>Drag the handle · scroll to zoom · drag to pan · double-click to reset · Esc to close</span>
      <span><button class="ghost" data-fit>Fit</button><button class="ghost" data-one>1:1</button><button data-x>Close</button></span></div>
  </div>`;
  document.body.append(m);

  const stage = m.querySelector('.stage'), top = m.querySelector('.top'), handle = m.querySelector('.handle');
  const imgs = [...m.querySelectorAll('img')];
  let extra;
  imgs[1].onerror = async () => { // format the browser can't show (e.g. JXL): decode it ourselves
    if (!fallback || extra) return;
    try { extra = URL.createObjectURL(await fallback(blob)); imgs[1].src = extra; } catch {}
  };
  let pos = 50, s = 1, tx = 0, ty = 0, drag = null;

  const apply = () => {
    top.style.clipPath = `inset(0 0 0 ${pos}%)`; handle.style.left = pos + '%';
    for (const i of imgs) {
      i.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
      i.style.imageRendering = s >= 3 ? 'pixelated' : 'auto';
    }
  };
  const reset = () => { s = 1; tx = ty = 0; apply(); };
  const zoomAt = (s2, cx, cy) => {
    s2 = Math.min(32, Math.max(1, s2));
    tx = cx - (cx - tx) * (s2 / s); ty = cy - (cy - ty) * (s2 / s); s = s2;
    if (s === 1) tx = ty = 0; apply();
  };
  const rel = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2, r]; };

  stage.addEventListener('pointerdown', e => {
    stage.setPointerCapture(e.pointerId);
    drag = handle.contains(e.target) ? 'h' : 'p'; stage._x = e.clientX; stage._y = e.clientY;
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag === 'h') { const r = stage.getBoundingClientRect(); pos = Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100)); }
    else { tx += e.clientX - stage._x; ty += e.clientY - stage._y; stage._x = e.clientX; stage._y = e.clientY; }
    apply();
  });
  stage.addEventListener('pointerup', () => drag = null);
  stage.addEventListener('wheel', e => { e.preventDefault(); const [cx, cy] = rel(e); zoomAt(s * Math.exp(-e.deltaY * 0.0015), cx, cy); }, { passive: false });
  stage.addEventListener('dblclick', reset);
  m.querySelector('[data-fit]').onclick = reset;
  m.querySelector('[data-one]').onclick = () => {
    const r = stage.getBoundingClientRect(), n = imgs[0];
    if (!n.naturalWidth) return;
    const shown = Math.min(r.width, r.height * n.naturalWidth / n.naturalHeight);
    tx = ty = 0; s = Math.max(1, n.naturalWidth / shown); apply();
  };

  const close = () => { URL.revokeObjectURL(a); URL.revokeObjectURL(b); extra && URL.revokeObjectURL(extra); m.remove(); removeEventListener('keydown', key); };
  const key = e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') { pos = Math.max(0, pos - 2); apply(); }
    else if (e.key === 'ArrowRight') { pos = Math.min(100, pos + 2); apply(); }
  };
  addEventListener('keydown', key);
  m.querySelector('[data-x]').onclick = close;
  m.addEventListener('pointerdown', e => { if (e.target === m) close(); });
  apply();
}
