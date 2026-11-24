const KEY = 'meow-theme', root = document.documentElement, mq = matchMedia('(prefers-color-scheme: dark)');
const get = () => { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } };

function apply(t) {
  t === 'auto' ? root.removeAttribute('data-theme') : (root.dataset.theme = t);
  const dark = t === 'dark' || (t === 'auto' && mq.matches);
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#181926' : '#eff1f5');
  document.querySelectorAll('.theme button').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === t));
}
export function initTheme() {
  document.querySelectorAll('.theme button').forEach(b => b.onclick = () => {
    try { localStorage.setItem(KEY, b.dataset.t); } catch {}
    apply(b.dataset.t);
  });
  mq.addEventListener('change', () => get() === 'auto' && apply('auto'));
  apply(get());
}
