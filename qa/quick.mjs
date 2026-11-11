// Quick match, two browsers against a local copy of the ice service (coturn-compose.txt): node qa/quick.mjs
// Same needs as qa/e2e.mjs: `python3 -m http.server 8765` in this repo, network access (PeerJS signalling), playwright-core.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || '../../ttrpg-online-platform/node_modules/playwright-core');
const URL = process.env.URL || 'http://127.0.0.1:8765/', PORT = 3123;

// the service's script, as Coolify mounts it, on PORT and with the test page's origin
const src = readFileSync(new globalThis.URL('../coturn-compose.txt', import.meta.url), 'utf8')
  .split('content: |\n')[1].replace(/^ {10}/gm, '').replace('listen(3000)', `listen(${PORT})`);
const DATA = mkdtempSync(join(tmpdir(), 'galion-')), SCORES = join(DATA, 'scores.json'); // the leaderboard's file, /data/scores.json in the stack
const ice = spawn(process.execPath, ['--input-type=module', '-'], { env: { ...process.env, ORIGIN: new globalThis.URL(URL).origin, TURN_SECRET: 'x', TURN_HOST: 'x', SCORES }, stdio: ['pipe', 'inherit', 'inherit'] });
ice.stdin.end(src);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(500);

let browser; // launched inside the try: a failed launch must not leave the service on PORT
const errors = [];
async function open(name) {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/WebSocket|ERR_|CORS/.test(m.text()) && errors.push(`${name}: ${m.text()}`));
  await page.goto(`${URL}?ice=http://127.0.0.1:${PORT}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  return page;
}
const lobby = (page, re) => page.waitForFunction((s) => new RegExp(s).test(document.getElementById('lobby-msg').textContent), re.source, { timeout: 30000 });

try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=metal'] });
  // 0. the service alone, on the queue the browsers below don't use
  {
    const get = async (path, ip = '') => { const r = await fetch(`http://127.0.0.1:${PORT}/${path}`, { headers: { Origin: new globalThis.URL(URL).origin, 'X-Forwarded-For': ip } }); return r.status === 200 ? r.json() : r.status; };
    const m = (qs = '', ip) => get(`match?q=coop-waves${qs}`, ip);
    const last = async (n, f) => { let r; while (n--) r = await f(); return r; };
    assert.equal(await last(61, () => get('match?q=x&code=', '10.0.0.1')), 429, 'an empty code is not a heartbeat: it counts against the limit');
    assert.equal(await get('/'), 400, "'//' is refused, not a crash");
    const { host: A } = await m();
    await m(`&code=${A}&free=3`);
    assert.deepEqual([await m(), await m()], [{ join: A }, { join: A }]);
    await m(`&code=${A}&free=3`); // those two are still connecting: the host's count must not hand their seats out again
    assert.deepEqual(await m(), { join: A });
    const { host: B } = await m();
    assert.ok(B && B !== A, 'room full: the next player opens another');
    assert.deepEqual(await last(61, () => m('', '10.0.0.2')), { retry: 1 }, 'polls for an opening room are not rate limited');
    await sleep(10200); // B never opens (its host left): A, still waiting, takes the slot back with its heartbeat
    await m(`&code=${A}&free=3`);
    assert.deepEqual(await m(), { join: A }, 'a waiting host is relisted over a dead room');
    // the world leaderboard: bounds, one row per crew, a top 100, kept on disk
    const post = async (run, ip = '10.1.0.1', b = 'waves', origin = new globalThis.URL(URL).origin) => {
      const r = await fetch(`http://127.0.0.1:${PORT}/scores?b=${b}`, { method: 'POST', body: typeof run === 'string' ? run : JSON.stringify(run), headers: { Origin: origin, 'X-Forwarded-For': ip } });
      return r.status === 200 ? r.json() : r.status;
    };
    const run = { ini: 'AAA', wave: 5, gold: 120, combo: 3, ship: 'Wasp+Corsair' };
    assert.equal(await post(run, undefined, undefined, 'https://evil.example'), 403, 'another origin does not sign');
    assert.equal(await post(run, undefined, 'pvp'), 400, 'no such board');
    for (const bad of [{ ...run, ini: '<b>' }, { ...run, ini: ['AAA'] }, { ...run, wave: 0 }, { ...run, gold: 1.5 }, { ...run, ship: 'Wasp<i>' }, '{', 'null'])
      assert.equal(await post(bad), 400, `refused: ${JSON.stringify(bad)}`);
    assert.deepEqual(await get('scores?b=waves'), { top: [], rank: -1 }, 'bad runs leave the board empty');
    assert.equal((await post(run)).rank, 0);
    await post({ ...run, ini: 'BBB', combo: 4 });
    const crew = await post({ ...run, ini: 'BBB' }); // signing twice adds nothing
    assert.deepEqual([crew.top.length, crew.top[0].ini, crew.top[0].combo, crew.rank], [1, 'AAA+BBB', 4, 0], 'a crew shares one row');
    for (let i = 0; i < 100; i++) await post({ ...run, ini: 'CCC', wave: 6, gold: i }, `10.2.0.${i}`);
    const { top } = await get('scores?b=waves');
    assert.deepEqual([top.length, top[0].gold, top[99].gold, top.some((r) => r.wave === 5)], [100, 99, 0, false], 'a top 100, best first: the weakest run fell off');
    assert.equal((await post({ ...run, wave: 1 }, '10.3.0.1')).rank, -1, 'a run below the hundredth is not listed');
    assert.equal((await get('scores?b=convoy')).top.length, 0, 'one board per game');
    assert.equal(JSON.parse(readFileSync(SCORES, 'utf8')).waves.length, 100, 'the board is on disk');
    assert.equal(await last(13, () => post(run, '10.4.0.1', 'convoy')), 429, 'signing is rate limited per address');
  }
  // 1. PvP: the first player hosts, the second joins the same room, the match starts on its own (the idle host gets a ship)
  {
    const H = await open('pvp host'), G = await open('pvp guest');
    await H.click('#quick-pvp');
    await lobby(H, /QUICK PVP · waiting/);
    // the host looks at another tab while it waits: it stays listed, is called back when the guest arrives, and its game goes on
    // without frames (like a real hidden tab: rAF is held back until the tab is shown again)
    const vis = (hidden) => H.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { get: () => h, configurable: true });
      if (h) { window.__raf = requestAnimationFrame; window.requestAnimationFrame = (f) => { window.__held = f; return 0; }; }
      else { window.requestAnimationFrame = window.__raf; window.__raf(window.__held); }
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);
    await vis(true);
    await G.click('#quick-pvp');
    await lobby(G, /pick your ship/); // not JOINED PVP: the countdown started when G connected, and a guest without a ship reads it there
    assert.equal(await H.title(), 'A PIRATE JOINED · COME BACK');
    await G.evaluate(() => __game.choose(0));
    await G.waitForFunction(() => /SETTING SAIL IN/.test(document.getElementById('banner').textContent), null, { timeout: 10000 }); // the hidden host counts down
    assert.ok(await G.evaluate(async () => { // the guest's countdown must not blink between two seconds
      for (let i = 0; i < 15; i++) { if (document.getElementById('banner').hidden) return false; await new Promise((r) => setTimeout(r, 100)); }
      return true;
    }), 'the countdown stays on screen on the guest');
    await vis(false);
    assert.equal(await H.title(), 'Broadside');
    await H.waitForFunction(() => __game.state.mode === 'pvp', null, { timeout: 25000 });
    assert.equal(await H.evaluate(() => __game.players.length), 2, 'host and guest both sail');
    await Promise.all([H.close(), G.close()]);
  }
  // 2. co-op convoy: its own queue, the host picks a ship, wave 1 sets sail without Enter
  {
    const H = await open('coop host'), G = await open('coop guest');
    for (const p of [H, G]) await p.click('#gm'); // GAME: CONVOY
    await H.click('#quick-coop');
    await lobby(H, /QUICK CONVOY · waiting/);
    await H.evaluate(() => __game.choose(1));
    await G.click('#quick-coop');
    await lobby(G, /pick your ship/);
    await G.evaluate(() => __game.choose(2));
    await H.waitForFunction(() => __game.state.wave === 1, null, { timeout: 30000 });
    assert.equal(await H.evaluate(() => __game.players.length), 2, 'both pirates in the convoy run');
  }
  assert.deepEqual(errors, [], 'page errors');
  console.log('quick match ok');
} finally {
  await browser?.close();
  ice.kill();
  rmSync(DATA, { recursive: true, force: true });
}
