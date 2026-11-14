// The menus, one browser, no network: node qa/menus.mjs
// Needs `python3 -m http.server 8765` in this repo and playwright-core (PLAYWRIGHT=path/to/playwright-core, CHROME_PATH=browser binary).
// SHOTS=dir also saves a picture of every screen at 960×540, 1440×900 and 1920×1080.
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || '../../ttrpg-online-platform/node_modules/playwright-core');
const URL = (process.env.URL || 'http://127.0.0.1:8765/') + '?ice=http://127.0.0.1:9/'; // a score service nobody answers on: nothing is posted to the live board
const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ['--ignore-gpu-blocklist', '--use-angle=metal'] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ready = (page) => page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
// store: localStorage `broadside.*` values set before the page runs (first load only); boot: where it lands
async function open(name, { w = 960, h = 540, dpr = 1, store = {}, boot } = {}) {
  const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr })).newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/WebSocket|ERR_|CORS|Failed to load resource/.test(m.text()) && errors.push(`${name}: ${m.text()}`));
  await page.addInitScript(([store, boot]) => {
    if (sessionStorage.getItem('qa')) return; // a reload keeps what the game stored
    sessionStorage.setItem('qa', 1);
    localStorage.setItem('broadside.lang', '"en"'); // the assertions below read English
    for (const k in store) localStorage.setItem('broadside.' + k, JSON.stringify(store[k]));
    if (boot) sessionStorage.setItem('broadside.boot', boot);
  }, [store, boot]);
  await page.goto(URL, { waitUntil: 'load' });
  await ready(page);
  return page;
}
const top = (p) => p.evaluate(() => __game.ui.top());
const focus = (p) => p.evaluate(() => document.activeElement?.dataset.f);
const text = (p, sel = '#ui-screen') => p.evaluate((s) => document.querySelector(s).textContent.replace(/\s+/g, ' '), sel);
const ls = (p, k) => p.evaluate((k) => JSON.parse(localStorage.getItem('broadside.' + k)), k);
const sink = (p) => p.evaluate(() => { __game.player.hp = 0; __game.player.alive = false; __game.advance(4); });
const NAMED = { name: 'BLACKBEARD' };

// 0. the stage is scaled by a whole number of device pixels
for (const [w, h, dpr, want] of [[960, 540, 1, 1], [1440, 900, 1, 1], [1920, 1080, 1, 2], [1440, 900, 2, 1.5], [800, 450, 2, 0.5]]) {
  const p = await open('scale', { w, h, dpr });
  assert.equal(+(await p.evaluate(() => getComputedStyle(document.getElementById('ui-stage')).transform)).match(/matrix\(([\d.]+)/)[1], want, `${w}×${h} @${dpr}`);
  await p.context().close();
}

// 1. first launch, keyboard only: title → name → menu → solo → a run → pause → the end screen and its ways out
{
  const p = await open('keys');
  assert.equal(await top(p), 'title');
  await p.keyboard.press('Shift'); // a modifier alone is not "any key"
  assert.equal(await top(p), 'title');
  await p.keyboard.press('Enter');
  assert.equal(await top(p), 'name');
  await sleep(100);
  assert.match(await p.inputValue('#name-in'), /^[A-Z]{1,12}$/, 'a rolled name is waiting');
  await p.keyboard.press('Tab'); // another one
  await p.keyboard.type('anne'); // it was selected: typing replaces it
  assert.equal(await p.inputValue('#name-in'), 'ANNE');
  await p.keyboard.press('Digit4');
  assert.deepEqual([await p.inputValue('#name-in'), await p.evaluate(() => document.getElementById('name-in').classList.contains('is-flash'))], ['ANNE', true], 'a refused key flashes the field');
  for (let i = 0; i < 4; i++) await p.keyboard.press('Backspace');
  assert.equal(await p.evaluate(() => document.querySelector('[data-f=ahoy]').disabled), true);
  for (const k of ['Enter', 'Escape']) { await p.keyboard.press(k); assert.equal(await top(p), 'name', 'no way past without a name'); }
  await p.keyboard.type('blackbeardxyz');
  assert.equal(await p.inputValue('#name-in'), 'BLACKBEARDXY', '12 letters at most');
  await p.keyboard.press('Enter');
  assert.equal(await top(p), 'menu');
  assert.deepEqual([await focus(p), await p.evaluate(() => !!document.querySelector('[data-f=sail]'))], ['solo', false], 'no SET SAIL before a first run');
  await p.reload(); await ready(p);
  assert.equal(await top(p), 'title');
  await p.keyboard.press('Space');
  assert.equal(await top(p), 'menu', 'the name is kept: no name screen');
  await sleep(200);
  assert.equal(await top(p), 'menu', 'the key that left the title did nothing else');
  // solo: mode, then ship; neither starts the run
  await p.keyboard.press('Enter');
  assert.deepEqual([await top(p), await focus(p)], ['solo-mode', 'waves']);
  await p.keyboard.press('Digit2'); assert.equal(await focus(p), 'convoy');
  await p.keyboard.press('ArrowLeft'); assert.equal(await focus(p), 'waves');
  await p.keyboard.press('Enter');
  assert.deepEqual([await top(p), await focus(p)], ['ship', 'sail']);
  await p.keyboard.press('Digit3');
  await sleep(600);
  assert.equal(await text(p, '#ship-name'), 'LEVIATHAN');
  assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('.bs-gauge')].map((g) => g.querySelectorAll('.is-on').length)), [6, 4, 10, 10, 7, 10], 'gauges: the real stats, out of 10');
  await p.keyboard.press('ArrowRight'); assert.equal(await text(p, '#ship-name'), 'WASP');
  await p.keyboard.press('ArrowRight'); assert.equal(await text(p, '#ship-name'), 'CORSAIR');
  assert.equal(await p.evaluate(() => __game.state.mode), 'select', 'browsing ships starts nothing');
  await p.keyboard.press('Escape'); assert.equal(await top(p), 'solo-mode');
  await p.keyboard.press('Backspace'); assert.equal(await top(p), 'menu');
  await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); await p.keyboard.press('Enter'); // SOLO, NEXT, SET SAIL
  assert.deepEqual(await p.evaluate(() => [__game.ui.top(), __game.state.mode, __game.player.name, __game.player.tag]), [undefined, 'between', 'Corsair', 'BLACKBEARDXY']);
  // pause: its key and Escape both open and close it; the world stops
  await p.keyboard.press('KeyP'); assert.equal(await top(p), 'pause');
  const t0 = await p.evaluate(() => __game.state.t); await sleep(300);
  assert.equal(await p.evaluate(() => __game.state.t), t0, 'solo: the world is paused');
  await p.keyboard.press('KeyP'); assert.equal(await top(p), undefined);
  await p.keyboard.press('Escape'); assert.deepEqual([await top(p), await focus(p)], ['pause', 'resume']);
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  assert.equal(await focus(p), 'stay', 'QUIT asks first, STAY ABOARD has the focus');
  await p.keyboard.press('Escape'); assert.deepEqual([await top(p), await focus(p)], ['pause', 'quit']);
  await p.keyboard.press('Escape'); assert.equal(await top(p), undefined);
  // sunk: the run is signed with the name, kept on this browser, and the world board is out of reach
  await p.evaluate(() => { __game.startWave(3); __game.state.gold = 840; __game.combo.best = 3; });
  await sink(p);
  assert.equal(await top(p), 'gameover');
  await sleep(500);
  assert.match(await text(p), /SUNK WAVES · SOLO · CORSAIR.*NEW PERSONAL BEST.*SIGNED AS BLACKBEARDXY.*#1 THIS BROWSER/);
  assert.match(await text(p, '.bs-over-row.is-you'), /1 ?BLACKBEARDXY ?3 ?840 ?×3/);
  assert.match(await text(p, '#ui-toasts'), /WORLD BOARD UNREACHABLE · SAVED ON THIS BROWSER/);
  assert.deepEqual((await ls(p, 'best')).waves.map((r) => [r.crew[0].name, r.crew[0].ship, r.wave, r.gold, r.combo]), [['BLACKBEARDXY', 'corsair', 3, 840, 3]]);
  assert.equal(await focus(p), 'again');
  await p.keyboard.press('ArrowRight'); assert.equal(await focus(p), 'ship');
  await p.keyboard.press('ArrowDown'); assert.equal(await focus(p), 'menu');
  await p.keyboard.press('Enter'); await ready(p); // MAIN MENU
  assert.deepEqual([await top(p), await focus(p)], ['menu', 'sail'], 'SET SAIL is there once a run was played');
  assert.match(await text(p), /WAVES · SOLO · CORSAIR \(YOUR LAST VOYAGE\).*YOUR BEST · WAVES WAVE 3 · 840 GOLD/);
  await p.keyboard.press('Enter');
  await sink(p);
  await p.keyboard.press('Space'); await ready(p); // SAIL AGAIN: straight into a run, same mode and ship
  assert.deepEqual(await p.evaluate(() => [__game.ui.top(), __game.state.mode, __game.player.name]), [undefined, 'between', 'Corsair']);
  await sink(p);
  await p.keyboard.press('ArrowRight'); await p.keyboard.press('Enter'); await ready(p); // CHANGE SHIP
  assert.deepEqual([await top(p), await text(p, '#ship-name')], ['ship', 'CORSAIR']);
  await p.keyboard.press('Enter');
  for (const k of ['Escape', 'ArrowDown', 'ArrowDown', 'Enter', 'ArrowLeft', 'Enter']) await p.keyboard.press(k); // pause, QUIT TO MENU, YES, QUIT
  await ready(p);
  assert.equal(await top(p), 'menu', 'QUIT TO MENU');
  // leaderboard: this browser's rows, your own highlighted; the world board says it is out of reach
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  assert.equal(await top(p), 'leaderboard');
  await p.waitForFunction(() => /WORLD BOARD UNREACHABLE/.test(document.getElementById('lb-rows').textContent), null, { timeout: 10000 });
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); await p.keyboard.press('ArrowRight'); // tabs → SOLO / CREW → WORLD / THIS BROWSER
  assert.equal(await focus(p), 'local');
  await p.keyboard.press('Enter');
  assert.equal(await p.evaluate(() => document.querySelectorAll('.bs-lb-item.is-you').length), 1);
  await p.keyboard.press('KeyY'); assert.equal(await focus(p), 'r0', 'Y jumps to your row');
  assert.match(await text(p), /YOUR BEST · SOLO #1 · CREW –/);
  await p.keyboard.press('ArrowRight');
  assert.match(await text(p, '#lb-rows'), /NO SOLO RUN SIGNED YET/, '← → change the mode');
  await p.keyboard.press('Escape'); assert.equal(await top(p), 'menu');
  await p.context().close();
}

// 2. mouse only: every menu on the way to a run
{
  const p = await open('mouse', { store: NAMED });
  await p.mouse.click(700, 450); // anywhere on the title
  assert.equal(await top(p), 'menu');
  await p.hover('[data-f=settings]'); assert.equal(await focus(p), 'settings', 'the mouse moves the same focus the arrows do');
  await p.click('[data-f=solo]');
  await p.hover('[data-f=convoy]');
  assert.equal(await p.getAttribute('[data-f=convoy]', 'aria-pressed'), 'true');
  await p.click('[data-f=next]');
  await p.click('[data-f=s0]'); assert.equal(await text(p, '#ship-name'), 'WASP');
  await p.click('[data-f=nxt]'); await p.click('[data-f=nxt]'); assert.equal(await text(p, '#ship-name'), 'LEVIATHAN');
  assert.equal(await p.evaluate(() => __game.state.mode), 'select');
  await p.click('[data-f=sail]');
  assert.deepEqual([...(await p.evaluate(() => [__game.state.mode, __game.player.name])), await ls(p, 'lastMode'), await ls(p, 'lastShip')], ['between', 'Leviathan', 'convoy', 'leviathan']);
  await sink(p);
  await p.click('[data-f=ship]'); await ready(p);
  assert.deepEqual([await top(p), await text(p, '#ship-name')], ['ship', 'LEVIATHAN']);
  await p.click('[data-f=change]'); await p.click('[data-f=back]');
  assert.equal(await top(p), 'menu');
  await p.context().close();
}

// 3. settings: kept at once, and after a reload; a rebound key drives the ship
{
  const p = await open('settings', { store: { ...NAMED, lastMode: 'waves' }, boot: 'menu' });
  const mute = await p.evaluate(() => __game.ui.codeFor('m') || 'KeyM'); // the key that types M on this machine's keyboard
  await p.click('[data-f=settings]');
  assert.deepEqual([await top(p), await focus(p)], ['settings', 't-audio']);
  await p.keyboard.press('Tab'); assert.equal(await focus(p), 'v-master');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft');
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowRight');
  assert.deepEqual(await ls(p, 'audio'), { master: 6, music: 7, fx: 9, muted: false });
  await p.keyboard.press(mute);
  assert.deepEqual([(await ls(p, 'audio')).muted, await p.getAttribute('[data-f=mute]', 'aria-checked'), await focus(p)], [true, 'true', 'v-music'], 'the mute key works here too, and is the MUTE ALL switch');
  await p.click('[data-f=mute]'); await p.click('[data-f=u-fx]'); await p.click('[data-f=v-fx] span:nth-child(3)'); await p.click('[data-f=test]');
  assert.deepEqual(await ls(p, 'audio'), { master: 6, music: 7, fx: 3, muted: false });
  // controls: a reserved key is refused, a taken one offers a swap, Escape gives up
  await p.keyboard.press('Tab'); await p.keyboard.press('ArrowDown'); assert.equal(await focus(p), 't-controls');
  await p.click('[data-f=k-fireStarboard]');
  assert.match(await text(p, '#set-body'), /PRESS THE NEW KEY FOR FIRE STARBOARD \(RIGHT\)/);
  for (const k of ['F5', 'Enter', 'Tab', 'Backspace']) { await p.keyboard.press(k); assert.match(await text(p, '#set-body'), /RESERVED KEY/, k); }
  await p.keyboard.press('KeyC');
  assert.match(await text(p, '#set-body'), /C ALREADY SETS OVERVIEW \(ZOOM\)\. SWAP THEM \?/);
  assert.equal(await focus(p), 'k-swap');
  await p.keyboard.press('Enter');
  assert.deepEqual([(await ls(p, 'keys')).fireStarboard, (await ls(p, 'keys')).overview, await focus(p)], [['KeyC'], ['KeyE'], 'k-fireStarboard'], 'stored as physical key codes');
  await p.keyboard.press('Enter'); await p.keyboard.press('Escape');
  assert.deepEqual([await top(p), (await ls(p, 'keys')).fireStarboard[0]], ['settings', 'KeyC'], 'Escape while listening changes nothing and stays on the screen');
  await p.click('[data-f=k-board]'); await p.keyboard.press('KeyX');
  assert.equal((await ls(p, 'keys')).board[0], 'KeyX');
  await p.hover('[data-f=t-display]'); await p.click('[data-f=hints]');
  assert.deepEqual(await ls(p, 'display'), { hints: false });
  await p.hover('[data-f=t-profile]');
  await p.click('#set-name'); await p.keyboard.press('ControlOrMeta+A'); await p.keyboard.type('anne1');
  assert.equal(await p.inputValue('#set-name'), 'ANNE');
  await p.keyboard.press('Enter');
  assert.equal(await ls(p, 'name'), 'ANNE');
  await p.keyboard.press('Escape');
  assert.match(await text(p), /CAPTAIN ?ANNE/);
  await p.click('[data-f=edit]');
  assert.deepEqual([await top(p), await p.inputValue('#set-name')], ['settings', 'ANNE'], 'EDIT opens the profile');
  await p.evaluate(() => sessionStorage.setItem('broadside.boot', 'menu'));
  await p.reload(); await ready(p);
  await p.click('[data-f=solo]'); await p.click('[data-f=next]'); await p.click('[data-f=sail]');
  assert.deepEqual(await p.evaluate(() => [document.getElementById('help').hidden, document.getElementById('k-star').textContent, __game.player.tag]), [true, 'C', 'ANNE'], 'hints strip off, the HUD prints the new key');
  await p.keyboard.down('KeyC'); await p.evaluate(() => __game.advance(0.2)); await p.keyboard.up('KeyC');
  assert.deepEqual(await p.evaluate(() => [__game.player.reload.star > 0, __game.player.reload.port]), [true, 0], 'C fires starboard');
  // from the pause: back goes to the pause; RESET TO DEFAULTS asks first
  await p.keyboard.press('KeyP'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
  assert.match(await text(p), /PAUSE ▸ SETTINGS/);
  await p.keyboard.press('ArrowDown'); await p.click('[data-f=k-reset]');
  assert.equal(await focus(p), 'm0');
  await p.keyboard.press('Escape'); assert.equal((await ls(p, 'keys')).fireStarboard[0], 'KeyC', 'cancelled');
  await p.click('[data-f=k-reset]'); await p.click('[data-f=m1]');
  assert.equal((await ls(p, 'keys')).fireStarboard[0], 'KeyE');
  await p.keyboard.press('Backspace'); assert.equal(await top(p), 'pause');
  await p.keyboard.press('KeyP'); assert.equal(await top(p), undefined);
  await p.context().close();
}

// 4. online hub without the network library: said, and nothing else breaks. A room code keeps 4 letters of whatever is typed or pasted
{
  const p = await open('hub', { store: NAMED, boot: 'online' });
  await p.click('#room-code'); await p.keyboard.type('ja-z9zq!');
  assert.deepEqual([await p.inputValue('#room-code'), await p.evaluate(() => document.querySelector('[data-f=join]').disabled)], ['JAZZ', false]);
  await p.keyboard.press('Backspace');
  assert.equal(await p.evaluate(() => document.querySelector('[data-f=join]').disabled), true, 'JOIN needs 4 letters');
  await p.keyboard.press('Enter');
  assert.match(await text(p, '#code-err'), /ENTER THE 4-LETTER ROOM CODE/);
  await p.evaluate(() => { delete window.Peer; });
  await p.click('[data-f=create]');
  assert.match(await text(p, '#ui'), /ONLINE UNAVAILABLE · SOLO STILL WORKS/);
  assert.equal(await p.evaluate(() => [...document.querySelectorAll('#ui-screen button')].every((b) => b.disabled)), true);
  await p.keyboard.press('Escape'); assert.equal(await top(p), 'menu');
  await p.context().close();
}

// SHOTS: every screen at the three sizes of the handoff
if (SHOTS) for (const [w, h] of [[960, 540], [1440, 900], [1920, 1080]]) {
  const best = { waves: [{ crew: [{ name: 'ZOE', ship: 'wasp' }], wave: 7, gold: 1350, combo: 5, at: 1 }, { crew: [{ name: 'BLACKBEARD', ship: 'corsair' }], wave: 6, gold: 840, combo: 3, at: 2, world: 10 }],
    'waves-crew': [{ crew: [{ name: 'ANNE', ship: 'leviathan' }, { name: 'CALICO', ship: 'wasp' }, { name: 'ROGER', ship: 'corsair' }, { name: 'BLACKBEARD', ship: 'corsair' }], wave: 14, gold: 2980, combo: 4, at: 3 }] };
  const p = await open('shots', { w, h });
  const shot = async (name) => { await sleep(500); await p.screenshot({ path: `${SHOTS}/${name}-${w}.png` }); };
  await shot('01-title');
  await p.keyboard.press('Enter'); await shot('02-name');
  await p.evaluate((best) => { localStorage.setItem('broadside.best', JSON.stringify(best)); localStorage.setItem('broadside.lastMode', '"waves"'); }, best);
  await p.keyboard.type('blackbeard'); await p.keyboard.press('Enter'); await shot('03-menu');
  await p.click('[data-f=solo]'); await shot('04-mode');
  await p.click('[data-f=next]'); await sleep(400); await shot('05-ship');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await p.click('[data-f=online]'); await shot('06-online');
  await p.keyboard.press('Escape');
  await p.click('[data-f=settings]'); await shot('08a-settings-audio');
  await p.hover('[data-f=t-controls]'); await p.click('[data-f=k-fireStarboard]'); await shot('08b-settings-listen');
  await p.keyboard.press('KeyC'); await shot('08c-settings-conflict');
  await p.click('[data-f=k-cancel]'); await p.hover('[data-f=t-display]'); await shot('08d-settings-display');
  await p.hover('[data-f=t-profile]'); await shot('08e-settings-profile');
  await p.keyboard.press('Escape');
  await p.click('[data-f=board]'); await p.click('[data-f=local]'); await p.click('[data-f=crew]'); await p.keyboard.press('KeyY'); await shot('09-leaderboard');
  await p.keyboard.press('Escape');
  await p.click('[data-f=sail]');
  await p.keyboard.press('KeyP'); await p.click('[data-f=quit]'); await shot('11-pause');
  await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
  await p.evaluate(() => { __game.startWave(6); __game.state.gold = 900; __game.combo.best = 3; });
  await sink(p); await shot('10-gameover');
  await p.context().close();
}

// 5. a numpad key bound on its own, the refit heading's keys, no pause between sinking and the end screen
{
  const p = await open('numpad', { store: { ...NAMED, keys: { sailUp: ['Numpad8'], pause: ['Numpad5'], skill1: ['ShiftLeft'] } }, boot: 'sail' }); // ShiftLeft: its label is the same on every layout
  await p.keyboard.press('Numpad8');
  assert.equal(await p.evaluate(() => __game.player.sail), 1, 'Numpad8 is SAIL UP, not the digit row 8');
  await p.keyboard.press('Numpad5'); assert.equal(await top(p), 'pause');
  await p.keyboard.press('Numpad5'); assert.equal(await top(p), undefined, 'the pause screen knows the same key');
  assert.equal(await text(p, '#cards-h'), 'Refit your ship: click or press L SHIFT, 2 or 3');
  await p.evaluate(() => { __game.player.hp = 0; __game.player.alive = false; __game.advance(1); });
  await p.keyboard.press('Escape');
  assert.deepEqual(await p.evaluate(() => [__game.state.mode, __game.ui.top()]), ['dead', undefined], 'sunk: no pause before the end screen');
  await p.evaluate(() => __game.advance(3));
  assert.equal(await top(p), 'gameover', 'the run is signed');
  await p.context().close();
}

assert.deepEqual(errors, [], 'page errors');
await browser.close();
console.log('menus ok');
