// Offline mode is opt-in: nothing is cached or registered unless the user clicks the button in the footer.
const $ = s => document.querySelector(s);
const NAME = /^(squeeze|meow-image-compressor)-/;
const scriptOf = r => (r.active || r.waiting || r.installing)?.scriptURL || '';
const regs = async () => (await navigator.serviceWorker.getRegistrations()).filter(r => /\/(offline-)?sw\.js$/.test(scriptOf(r)));
const isOn = async () => (await regs()).some(r => /offline-sw\.js$/.test(scriptOf(r)));
const wipe = async () => {
  await Promise.all((await regs()).map(r => r.unregister()));
  for (const k of await caches.keys()) if (NAME.test(k)) await caches.delete(k);
};
const waitActive = sw => new Promise((ok, no) => {
  if (sw.state === 'activated') return ok();
  sw.addEventListener('statechange', () => sw.state === 'activated' ? ok() : sw.state === 'redundant' && no(new Error('caching failed')));
});

export async function initOffline() {
  if (!('serviceWorker' in navigator)) return;                 // insecure origin (e.g. http://LAN-IP) or unsupported
  if (import.meta.env.DEV) { await wipe(); return; }           // dev server never keeps an offline copy around
  const btn = $('#offline'), note = $('#offline-note'); $('#offline-row').hidden = false;
  const show = on => {
    note.textContent = on ? 'Offline mode is on: the app is cached in this browser and opens without a server or internet.'
                          : 'Offline mode is off. Enable it to open the app without a server or internet (about 10 MB cached).';
    btn.textContent = on ? 'Disable and clear cache' : 'Enable offline mode'; btn.disabled = false;
  };
  show(await isOn());
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      if (await isOn()) { await wipe(); show(false); }
      else {
        note.textContent = 'Caching the app…';
        const reg = await navigator.serviceWorker.register('./offline-sw.js');
        await waitActive(reg.installing || reg.waiting || reg.active); show(true);
      }
    } catch (e) { show(false); note.textContent = 'Offline mode failed: ' + e.message; }
  };
}
