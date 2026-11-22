// A whole solo run on a tablet, fingers only (no key is ever pressed): node qa/touch.mjs [screenshot dir]
// Needs `python3 -m http.server 8765` in this repo and playwright-core (see qa/e2e.mjs).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || '../../ttrpg-online-platform/node_modules/playwright-core');
const URL = process.env.URL || 'http://127.0.0.1:8765/', SHOTS = process.argv[2];
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=metal'] });
const errors = [];
async function open(w, h, touch = true) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/WebSocket|ERR_|CORS/.test(m.text()) && errors.push(m.text()));
  await page.addInitScript(() => { localStorage.setItem('broadside.name', '"ANNE"'); localStorage.setItem('broadside.lang', '"en"'); });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  return page;
}
const screen = (p, id) => p.waitForFunction((id) => __game.ui.top() === id, id, { timeout: 10000 });
const tap = (p, f) => p.tap(`#ui [data-f="${f}"]`);
const shot = async (p, name) => { if (SHOTS) { await p.waitForTimeout(500); await p.screenshot({ path: `${SHOTS}/${name}.png` }); } }; // 500 ms: a screen fades in
// a finger down on a button, or lifted from it
const finger = (p, sel, type) => p.dispatchEvent(sel, type, { pointerId: 7, pointerType: 'touch', bubbles: true });
const visible = (p, sel) => p.evaluate((s) => getComputedStyle(document.querySelector(s)).display !== 'none', sel);

// 1. the menus by tap: title → menu → leaderboard and back (the hint bar is the BACK button) → solo → ship → set sail
const p = await open(1180, 820);
await p.tap('#ui');
await screen(p, 'menu');
assert.ok((await p.evaluate(() => document.getElementById('ui-stage').getBoundingClientRect().width)) > 1170, 'the menus fill a touch screen');
for (const [f, id] of [['board', 'leaderboard'], ['online', 'online']]) {
  await tap(p, f);
  await screen(p, id);
  await shot(p, id);
  await p.tap('#ui-hints [data-back]');
  await screen(p, 'menu');
}
await tap(p, 'solo');
await screen(p, 'solo-mode');
await tap(p, 'next');
await screen(p, 'ship');
await shot(p, 'ship');
await tap(p, 'sail');
await p.waitForFunction(() => __game.player && !__game.ui.active(), null, { timeout: 30000 });

// 2. the ship under the fingers
assert.ok(await visible(p, '#touch'), 'touch buttons are shown in a run');
assert.ok(!(await visible(p, '#help')), 'no key help on a touch screen');
await shot(p, 'hud');
const heading = () => p.evaluate(() => { __game.advance(1); return __game.player.h; });
await p.evaluate(() => (__game.player.sail = 2));
const h0 = await heading();
await finger(p, '#t-right', 'pointerdown');
const h1 = await heading();
assert.notEqual(h1, h0, 'holding ▶ turns the ship');
await finger(p, '#t-right', 'pointerup');
await p.evaluate(() => __game.advance(3)); // the helm comes back to centre
assert.ok(Math.abs((await heading()) - (await heading())) < 1e-3, 'lifting the finger stops the turn');
await p.evaluate(() => (__game.player.sail = 1));
await finger(p, '#t-up', 'pointerdown');
await finger(p, '#t-up', 'pointerup');
assert.equal(await p.evaluate(() => __game.player.sail), 2, '▲ sets more sail');
await finger(p, '#t-port', 'pointerdown');
await p.evaluate(() => __game.advance(0.5));
assert.ok(await p.evaluate(() => __game.player.reload.port > 0), 'holding PORT fires the port broadside');
await finger(p, '#t-port', 'pointerup');
const cd = () => p.evaluate(() => { const me = __game.player; return me.cd[me.skills[0].id] || 0; });
assert.equal(await cd(), 0);
await finger(p, '#skills .slot', 'pointerdown');
assert.ok((await cd()) > 0, 'a tap on a skill slot casts it');
await finger(p, '#skills .slot', 'pointerup');

// 3. pause and back, by tap
await p.tap('#t-pause');
await screen(p, 'pause');
assert.ok(!(await visible(p, '#touch')), 'no ship buttons under a menu');
await tap(p, 'resume');
await p.waitForFunction(() => !__game.ui.active());

// 4. refit cards by tap
await p.evaluate(() => { __game.killWave(); for (let i = 0; i < 40 && !__game.player.cards?.length; i++) __game.advance(1); });
assert.ok(await p.evaluate(() => __game.player.cards.length > 0), 'the refit cards came up');
await shot(p, 'cards');
await p.tap('#cards .card');
assert.equal(await p.evaluate(() => __game.player.cards.length), 0, 'a tap picks a card');

// 5. boarding: the BOARD button comes up next to a ship, grapples, then strikes
await p.evaluate(() => {
  for (let i = 0; i < 60 && !__game.ships.some((s) => s.team === 1 && s.alive); i++) __game.advance(1);
  const me = __game.player, e = __game.ships.find((s) => s.team === 1 && s.alive);
  Object.assign(me, { x: e.x + 2, z: e.z, sail: 0, speed: 0, boardCd: 0 });
  __game.advance(1 / 60);
});
assert.ok(await visible(p, '#t-board'), 'BOARD shows next to a ship');
await finger(p, '#t-board', 'pointerdown');
await finger(p, '#t-board', 'pointerup');
assert.ok(await p.evaluate(() => !!__game.state.boarding), 'a tap on BOARD grapples');
await shot(p, 'boarding');
const round = () => p.evaluate(() => { const b = __game.state.boarding.b; return b.you + b.them; });
const r0 = await round();
await finger(p, '#t-board', 'pointerdown');
assert.notEqual(await round(), r0, 'a tap on BOARD strikes');
await finger(p, '#t-board', 'pointerup');

// 6. installable: the manifest and its icons, by relative paths
const cdp = await p.context().newCDPSession(p);
const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
assert.deepEqual(installabilityErrors.filter((e) => e.errorId !== 'no-matching-service-worker' && e.errorId !== 'in-incognito'), [], 'the page can be installed');
const man = await (await p.request.get(URL + 'manifest.webmanifest')).json();
assert.equal(man.start_url, '.');
for (const i of man.icons) assert.equal((await p.request.get(URL + i.src)).status(), 200, i.src);

// 7. portrait: turn the screen; a smaller tablet; a desktop shows no touch button
await p.setViewportSize({ width: 820, height: 1180 });
assert.ok(await visible(p, '#rotate'), 'portrait asks for landscape');
await shot(p, 'portrait');
await p.setViewportSize({ width: 1024, height: 768 });
assert.ok(!(await visible(p, '#rotate')));
await shot(p, 'hud-1024');
const d = await open(1180, 820, false);
await d.click('#ui');
await screen(d, 'menu');
assert.ok(!(await visible(d, '#touch')) && !(await visible(d, '#rotate')), 'nothing changes with a mouse');
assert.equal(await d.evaluate(() => document.getElementById('ui-stage').getBoundingClientRect().width), 960, 'whole-pixel menus with a mouse');

assert.deepEqual(errors, []);
await browser.close();
console.log('touch ok');
