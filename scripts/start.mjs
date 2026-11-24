#!/usr/bin/env node
// Meow Image Compressor launcher: builds if needed, starts the server, opens the browser and prevents accidental double starts.
//   node scripts/start.mjs [--dev] [--lan] [--no-open]
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
const flags = new Set(process.argv.slice(2));
const dev = flags.has('--dev'), lan = flags.has('--lan'), open = !flags.has('--no-open'), pause = flags.has('--pause-on-error'); // pause: own console window (start.bat)

const ask = q => new Promise(res => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.once('close', () => res(''));
  rl.question(q, a => { res(a.trim().toLowerCase()); rl.close(); }); // resolve first: close() fires the 'close' handler above
});
// keep the window open on errors when running in its own console window, so the message can be read
const fail = async msg => { console.error(msg); if (pause) await ask('\nPress Enter to close...'); process.exit(1); };

if (Number(process.versions.node.split('.')[0]) < 18) await fail(`Node.js 18 or newer is required (found ${process.version}).`);
const vite = await import('vite').catch(() => null);
if (!vite) await fail('Dependencies are missing. Run "npm install" first (or start the app with start.sh / start.bat).');

// ---- single-instance guard: a small registry of running instances (one file per project folder)
const REG = join(tmpdir(), `meow-image-compressor-${createHash('md5').update(root).digest('hex').slice(0, 8)}.json`);
const readReg = () => { try { return JSON.parse(readFileSync(REG, 'utf8')); } catch { return []; } };
const writeReg = list => { try { writeFileSync(REG, JSON.stringify(list)); } catch { /* ignore */ } };
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const responds = async url => { try { return (await (await fetch(url, { signal: AbortSignal.timeout(1500) })).text()).includes('Meow Image Compressor'); } catch { return false; } };
async function running() {
  const live = [];
  for (const e of readReg()) if (alive(e.pid) && await responds(e.url)) live.push(e);
  writeReg(live); return live;
}
const openUrl = url => {
  const [cmd, ...a] = process.platform === 'win32' ? ['cmd', '/c', 'start', '', url] : process.platform === 'darwin' ? ['open', url] : ['xdg-open', url];
  spawn(cmd, a, { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
};

try {
const found = await running();
if (found.length) {
  console.log(`\nMeow Image Compressor is already running:\n${found.map(e => '  ' + e.url).join('\n')}\n`);
  const a = await ask('  [C] Cancel (default)   [S] Start another instance   [O] Open the running one in the browser: ');
  if (a[0] !== 's') {
    if (a[0] === 'o') openUrl(found[0].url);
    console.log(a[0] === 'o' ? 'Opened the running instance.' : 'Cancelled. Nothing was started.');
    if (pause) await new Promise(r => setTimeout(r, 1500)); // let the message be read before the window closes
    process.exit(0);
  }
}

// ---- build (production mode) when dist/ is missing or older than the sources
const newest = p => { if (!existsSync(p)) return 0; const s = statSync(p); return s.isDirectory() ? Math.max(0, ...readdirSync(p).map(f => newest(join(p, f)))) : s.mtimeMs; };
const needsBuild = () => !existsSync('dist/index.html') || Math.max(...['src', 'public', 'index.html', 'vite.config.js', 'package.json'].map(newest)) > statSync('dist/index.html').mtimeMs;

let server;
if (dev) {
  server = await vite.createServer({ server: { open, host: lan || undefined } });
  await server.listen();
} else {
  if (needsBuild()) { console.log('Building the app (first run or sources changed)...'); await vite.build({ logLevel: 'warn' }); }
  server = await vite.preview({ preview: { open, host: lan || undefined, port: 4173 } });
}
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost';
server.printUrls();

writeReg([...readReg().filter(e => alive(e.pid)), { pid: process.pid, url, mode: dev ? 'dev' : 'preview' }]);
process.on('exit', () => writeReg(readReg().filter(e => e.pid !== process.pid)));
for (const s of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(s, () => process.exit(0));
console.log(`\nMeow Image Compressor is running at ${url}\nPress Ctrl+C (or close this window) to stop.\n`);
} catch (e) { await fail(e?.stack || String(e)); }
