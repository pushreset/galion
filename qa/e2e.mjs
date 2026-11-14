// Two-browser online run: node qa/e2e.mjs
// Needs `python3 -m http.server 8765` in this repo, network access (PeerJS signalling) and playwright-core
// (PLAYWRIGHT=path/to/playwright-core, CHROME_PATH=browser binary if playwright's own is not installed).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ISLANDS, BOUNDS } from '../sim.js';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || '../../ttrpg-online-platform/node_modules/playwright-core');
const URL = process.env.URL || 'http://127.0.0.1:8765/';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=metal'] });
const errors = [];
// boot: where the page lands (game.js reads sessionStorage broadside.boot); the captain's name is already stored
async function open(name, boot = 'online', captain = 'ANNE') {
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/WebSocket|ERR_|CORS/.test(m.text()) && errors.push(`${name}: ${m.text()}`));
  await page.addInitScript(([boot, captain]) => { localStorage.setItem('broadside.name', JSON.stringify(captain)); localStorage.setItem('broadside.lang', '"en"'); sessionStorage.setItem('broadside.boot', boot); }, [boot, captain]);
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  await page.evaluate(() => { // log every sound this page plays
    window.snd = [];
    for (const k of Object.keys(__game.sfx)) { const f = __game.sfx[k]; __game.sfx[k] = (...a) => { snd.push(k); return f(...a); }; }
  });
  return page;
}
const screen = (page, id) => page.waitForFunction((id) => __game.ui.top() === id, id, { timeout: 30000 });
const says = (page, re) => page.waitForFunction((src) => new RegExp(src).test(document.getElementById('ui').textContent), re.source, { timeout: 30000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (page, k) => page.evaluate((k) => snd.filter((n) => n === k).length, k);

// 0. no typed character reaches the browser (Firefox find-as-you-type), mapped or not; shortcuts do
{
  const p = await open('keys');
  await p.evaluate(() => { window.kd = {}; addEventListener('keydown', (e) => { kd[e.code + (e.ctrlKey ? '+ctrl' : '')] = e.defaultPrevented; }); }); // added after the game's listener: it sees its verdict
  for (const k of ['KeyZ', 'Semicolon', 'Quote', 'Slash', 'KeyQ', 'Control+KeyZ', 'F2']) await p.keyboard.press(k);
  assert.deepEqual(await p.evaluate(() => kd), { KeyZ: true, Semicolon: true, Quote: true, Slash: true, KeyQ: true, 'ControlLeft+ctrl': false, 'KeyZ+ctrl': false, F2: false });
  await p.context().close();
}

// 1. a room that fails to open: a message, back in the hub with nothing started, and no phantom hulls in the solo run that follows
{
  const p = await open('fail');
  await p.evaluate(() => { window.Peer = class { on(e, f) { if (e === 'error') setTimeout(() => f({ type: 'network' }), 500); } destroy() {} }; });
  await p.click('[data-f=create]');
  await says(p, /COULD NOT OPEN A ROOM/);
  assert.deepEqual(await p.evaluate(() => [__game.ui.top(), __game.state.mode, __game.players.length]), ['online', 'select', 0]);
  await p.keyboard.press('Escape');
  for (const f of ['solo', 'next', 'sail']) await p.click(`[data-f=${f}]`);
  await sleep(300);
  assert.deepEqual(await p.evaluate(() => [__game.state.mode, __game.ships.length, __game.ships.filter((s) => !s.mesh.root.parent).length]), ['between', 1, 0], 'solo after a failed room is not clean');
  await p.context().close();
}

// 2. PvP room: the host opens it and picks the mode, a guest joins with the code, both pick a ship, the host sets sail
const H = await open('host'), G = await open('guest', 'online', 'JACK');
await H.click('[data-f=create]');
await screen(H, 'lobby');
const code = await H.evaluate(() => [...document.querySelectorAll('.bs-code span')].map((s) => s.textContent).join(''));
await H.click('[data-f=m-pvp]');
await H.keyboard.press('Digit3');
await G.fill('#room-code', code);
await G.click('[data-f=join]');
await screen(G, 'lobby');
await G.keyboard.press('Digit1');
await G.click('[data-f=ready]');
await says(H, /SET SAIL · ALL READY/);
assert.equal(await H.evaluate(() => __game.players.length), 0, 'a ship exists before the start');
await H.click('[data-f=sail]');
await G.waitForFunction(() => __game.player && !__game.ui.top(), null, { timeout: 20000 });
assert.deepEqual(await H.evaluate(() => [__game.state.mode, ...__game.players.map((p) => p.tag)]), ['pvp', 'ANNE', 'JACK'], 'host did not get the guest name');
await G.waitForFunction(() => document.querySelector('.ebar.self:not([hidden])')?.dataset.tag === 'JACK', null, { timeout: 5000 });

// snapshots: 20 a second (state.t only changes on the guest when one arrives)
const hz = await G.evaluate(() => new Promise((done) => {
  const seen = new Set(), t0 = performance.now();
  (function tick() { seen.add(__game.state.t); performance.now() - t0 < 3000 ? requestAnimationFrame(tick) : done((seen.size - 1) / 3); })();
}));
assert.ok(hz > 19 && hz < 21, `snapshot rate ${hz.toFixed(1)} Hz`);

// the guest fires a broadside: it hears the same placed sounds the host plays
await H.evaluate(() => (snd.length = 0));
await G.evaluate(() => (snd.length = 0));
await G.keyboard.down('KeyE'); await sleep(300); await G.keyboard.up('KeyE');
await sleep(4000);
const heard = async (p) => Object.fromEntries(await Promise.all(['boom', 'hit', 'splash', 'sink'].map(async (k) => [k, await count(p, k)])));
const [hs, gs] = [await heard(H), await heard(G)];
assert.ok(gs.boom >= 1, 'guest heard no broadside');
assert.deepEqual(gs, hs, 'guest and host played different sounds');

// boarding in one corner of the arena, the host's ship (its ear) held in another
const [spot, away] = [[1, 1], [-1, -1], [-1, 1], [1, -1]].map(([a, b]) => [a * (BOUNDS.x - 25), b * (BOUNDS.z - 25)]).filter(([x, z]) => ISLANDS.every((I) => Math.hypot(x - I.x, z - I.z) > I.r + 25));
assert.ok(spot && away, 'no two free corners');
await H.evaluate(([[x, z], [hx, hz]]) => {
  window.pin = setInterval(() => { // keep a struck merchant alongside the guest
    const [h, g] = __game.players, m = __game.ships.find((s) => s.merchant && s.alive && !s.escaped);
    Object.assign(h, { x: hx, z: hz, speed: 0, sail: 0, hp: h.maxHp });
    if (!m) return void (__game.state.nextAt = 0);
    Object.assign(g, { x, z, speed: 0, sail: 0, hp: g.maxHp });
    Object.assign(m, { x: x + 8, z, speed: 0, hp: m.maxHp * 0.1 });
  }, 16);
}, [spot, away]);
const board = async (n) => { // the host's state decides when the merchant is ready (the guest's copy lags a snapshot)
  await H.waitForFunction(() => (window.tgt = __game.ships.find((s) => s.merchant && s.alive && s.hp < 0.2 * s.maxHp)) && !(__game.players[1].boardCd > 0), null, { timeout: 20000 });
  await sleep(150);
  await G.keyboard.press('Space');
  await H.waitForFunction(() => !tgt.alive, null, { timeout: 5000 });
  assert.equal(await H.evaluate(() => __game.combo.n), n, 'combo count');
};
await board(1);
assert.equal(await H.evaluate(() => __game.state.gold), 0, 'PvP capture paid gold');
await H.evaluate(() => (snd.length = 0));
await G.evaluate(() => (snd.length = 0));
await board(2); // second capture inside the combo window: ×2
await sleep(300);
assert.equal(await count(H, 'coin'), 0, 'host heard the coin of a far-away combo');
assert.ok((await count(G, 'coin')) >= 1, 'guest got no coin for its own combo');
assert.ok((await G.evaluate(() => [...document.querySelectorAll('.pop')].map((e) => e.textContent))).every((t) => !/^\+\d+$/.test(t)), 'gold popup in PvP');

// a merchant spawning must not replace a banner that is still up
await H.evaluate(() => {
  clearInterval(pin);
  for (const s of __game.ships) if (s.merchant) s.escaped = true;
  document.getElementById('banner').textContent = __game.state.bannerText = 'P2 WINS · TEST';
  __game.state.banner = 4;
  __game.state.nextAt = 0;
});
await H.waitForFunction(() => __game.ships.some((s) => s.merchant && s.alive && !s.escaped), null, { timeout: 5000 });
assert.equal(await H.evaluate(() => document.getElementById('banner').textContent), 'P2 WINS · TEST', 'merchant banner replaced the result');

assert.deepEqual(errors, [], 'page errors');
await browser.close();
console.log(`e2e ok · room ${code} · ${hz.toFixed(1)} Hz · sounds`, gs);
