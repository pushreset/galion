import * as THREE from 'three';
import { PixelPost } from './post.js';
import { createSea } from './water.js';
import { buildShip, setGuns, buildTentacle } from './ships.js';
import { createWorld } from './world.js';
import { createWakes, createFx } from './fx.js';
import { sfx, unlock, setAudio, setPaused, setCombat } from './sfx.js';
import { hostRoom, joinRoom, match, worldScores, MAX_PLAYERS } from './net.js';
import * as ui from './ui.js';
import { initScreens } from './screens.js';
import { store, SHIPS, DEFAULT_KEYS, cleanName, boardOf, normRow, signLocal, markWorld } from './store.js';
// loudness + stereo pan of a world point relative to the local player (screen-right = (dx - dz)/√2)
function ear(x, z) {
  const p = me || { x: 6, z: 6 }, dx = x - p.x, dz = z - p.z;
  return [Math.max(0, 1 - Math.hypot(dx, dz) / 110), (dx - dz) / Math.SQRT2 / 50];
}
import { createRadar } from './radar.js';
import { makeShip, stepShip, fireBroadside, stepBall, collideShips, damage, aiSteer, makeTurret, fireTurret, waveSpec, fortActive, rollUpgrades, applyUpgrade, ISLANDS, BOUNDS, MAP, setMap, convoySpec, guardSteer, PLAYER_SHIPS, makePlayer, regenShip, SKILLS, skillCd, useSkill, stepKeg, makeFort, merchantSpec, makeMerchant, merchantSteer, crewMul, canBoard, startBoarding, boardRound, captureReward, krakenSteer, stepSlam, krakenDue, SLAM } from './sim.js';

const VIEW_H = 40; // world units visible vertically
const TARGET_PX_H = 300; // internal render height ≈ this; integer upscale to the screen
const WIND = Math.atan2(0.6, 0.8); // matches water.js swell direction
const CAM_AZ = Math.PI / 4, CAM_EL = (38 * Math.PI) / 180;

// 8×8 pixel skill icons (palette colours), rendered once to data URLs for the skill bar / ship cards
const ICON_COL = { k: '#1b110b', w: '#f5ecd2', g: '#a7a3a4', o: '#ff9b26', y: '#ffd24a', r: '#d84a38', b: '#8d5c35', s: '#d6d2cf', c: '#3fb8b2' };
const SKILL_ICONS = {
  chain: ['........', '.kk..kk.', 'kgwk.gwk', 'kggkkggk', 'kggk.ggk', '.kk..kk.', '........', '........'],
  fire: ['...r....', '..ro..r.', '..roo.r.', '.royor..', '.ryyyor.', 'royywyor', '.ryyyyr.', '..rrrr..'],
  nova: ['...y....', '.y.y.y..', '..yoy...', 'yyowoyy.', '..yoy...', '.y.y.y..', '...y....', '........'],
  brace: ['.kkkkkk.', 'kbbwwbbk', 'kbbwwbbk', 'kwwwwwwk', 'kbbwwbbk', '.kbwwbk.', '..kbbk..', '...kk...'],
  boost: ['...k....', '...kw...', '...kww.c', '...kwww.', '..ckwwww', '...k...c', 'kbbbbbbk', '.kbbbbk.'],
  keg: ['......y.', '.....o..', '..kkkk..', '.kbbbbk.', '.krrrrk.', '.kbbbbk.', '.krrrrk.', '..kkkk..'],
  smoke: ['..ss....', '.ssss.s.', 'sswsssss', '.ssssss.', '..sswss.', '.ssssss.', '..ss.s..', '........'],
  repair: ['.kkkk...', 'kggggk..', 'kgwggk..', '.kkbkk..', '...bk...', '...bk...', '...bk...', '...kk...'],
};
const ICON = Object.fromEntries(Object.entries(SKILL_ICONS).map(([id, rows]) => {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ICON_COL[ch]) { g.fillStyle = ICON_COL[ch]; g.fillRect(x, y, 1, 1); } }));
  return [id, c.toDataURL()];
}));

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // hard shadow edges, no blur to dither

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
// the camera looks from azimuth `camAz`: always CAM_AZ in a run, the menus turn it (title: a slow orbit)
const camDir = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
let camAz;
function setAz(a) {
  camAz = a;
  camDir.set(Math.cos(CAM_EL) * Math.cos(a), Math.sin(CAM_EL), Math.cos(CAM_EL) * Math.sin(a));
  camera.position.copy(camDir).multiplyScalar(200);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(); // lookAt alone leaves the matrix, and the two screen axes read from it, stale
  camRight.setFromMatrixColumn(camera.matrixWorld, 0);
  camUp.setFromMatrixColumn(camera.matrixWorld, 1);
}
setAz(CAM_AZ);
const post = new PixelPost(renderer, camera.near, camera.far);

// Sun high on the camera's left: camera-facing sides stay lit, shadows fall right/away.
scene.add(new THREE.HemisphereLight('#fff6ea', '#8fa6b0', 0.6 * Math.PI));
const sun = new THREE.DirectionalLight('#fff1d8', 0.62 * Math.PI);
const SUN_OFF = new THREE.Vector3(-22, 80, 50);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 260 });
sun.shadow.bias = -0.0008;
scene.add(sun, sun.target);

const sea = createSea();
scene.add(sea.mesh);
let world = createWorld(scene);
const wakes = createWakes(scene);
const fx = createFx(scene, wakes);

// --- multiplayer -------------------------------------------------------------
// net: 'solo' | 'host' (runs the sim, broadcasts snapshots) | 'guest' (sends input, renders snapshots).
// mode: 'coop' (waves) | 'pvp' (arena). The host records one-shot effects (hits, splashes, muzzle
// flashes, popups, placed sounds) as events for guests; everything else guests read from the snapshot itself.
// convoy: co-op / solo variant on its own map (sim.js MAPS.convoy): hunt escorted merchants sailing port to port.
let convoy = false;
const modeName = () => (mode === 'pvp' ? 'PVP' : convoy ? 'CONVOY' : 'CO-OP');
let net = 'solo', mode = 'coop', room = null, myPid = 0, roomOpen = false; // roomOpen: the host's room got its code
// quick match: the server queue this room came from ('pvp' | 'coop-waves' | 'coop-convoy'), the host's countdown end, attempts so far
let quick = null, quickAt = null, quickTries = 0, quickBeat = 0;
const events = [];
for (const k of ['hit', 'splash', 'muzzle']) {
  const f = fx[k];
  fx[k] = (...a) => { f(...a); if (net === 'host') events.push([k, ...a]); };
}
// A placed sound. The host records it, so guests hear what the host plays, not a guess from the visual effect.
// shk: screen shake when it goes off close to our own ship.
function sound(name, x, z, gain = 1, shk = 0) {
  const [v, pan] = ear(x, z);
  sfx[name](v * gain, pan);
  if (shk && v > 0.6) shake = Math.max(shake, shk);
  if (net === 'host') events.push(['sfx', name, x, z, gain, shk]);
}
let nextId = 1;

// ships: sim state + mesh
const ships = [];
function addShip(type, livery, team, x, z, h, sail = 0, s = makeShip(type, team, x, z, h)) {
  s.sail = sail;
  s.id ??= nextId++;
  s.livery = livery;
  s.mesh = buildShip(type, livery, s.cannons);
  s.seed = Math.random() * 10;
  s.wakeT = 0;
  scene.add(s.mesh.root);
  ships.push(s);
  return s;
}
// ship select: the three pirate ships float in a row across the screen; the picked one stays
const PREVIEW = PLAYER_SHIPS.map((p, i) => {
  const x = (i - 1) * 16, z = -(i - 1) * 16, h = -Math.PI / 4; // along screen-right, bows to the right
  return addShip(p.type, 'pirate', 0, x, z, h, 0, makePlayer(i, x, z, h));
});
const players = []; // every pirate ship (local + remote); the sim treats them all alike
let me = null; // the ship this browser steers and looks at
const localInput = () => ({ turn: (held.has('turnRight') ? 1 : 0) - (held.has('turnLeft') ? 1 : 0), fireL: held.has('firePort'), fireR: held.has('fireStarboard') });
// enemies chase whichever pirate is closest (a sunk one only if nobody is left afloat)
function nearestPlayer(o) {
  let best = players[0], bd = Infinity;
  for (const p of players) {
    const d = Math.hypot(p.x - o.x, p.z - o.z);
    if (p.alive && d < bd) { bd = d; best = p; }
  }
  return best;
}
const anyAlive = (but) => { const a = players.filter((p) => p.alive && p !== but); return a[Math.floor(Math.random() * a.length)]; };

// destructible forts: walls ±4.2·scale plus towers, cannons → turrets (positions from the meshes world.js built);
// razed, a fort stays down for 3 waves
let forts = [];
function buildForts() {
  for (const f of forts) f.bar?.remove();
  scene.updateMatrixWorld(true);
  forts = world.forts.map((w) => Object.assign(makeFort(w.isl.x, w.isl.z, (4.2 * w.isl.r) / 13 + 1, w.isl), {
    turrets: w.cannons.map((c) => {
      const p = c.getWorldPosition(new THREE.Vector3());
      return Object.assign(makeTurret(p.x, p.y + 0.4, p.z), { mesh: c });
    }),
    flag: w.group.children.find((o) => o.geometry?.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop === 0.06),
  }));
}
buildForts();
// swap the map (sim.js MAPS): islands, shoreline shader, forts
function loadMap(name) {
  setMap(name);
  scene.remove(world.root);
  world.root.traverse((o) => o.geometry?.dispose()); // materials: shared (ships.js mat() cache, world.js islandMat)
  world = createWorld(scene);
  sea.setMap();
  buildForts();
}
const fortsOn = () => (convoy && state.wave > 0) || mode === 'pvp' || fortActive(state.wave); // convoy: not before the first convoy sails
function fortShow(fort, on) {
  for (const t of fort.turrets) t.mesh.visible = on;
  if (fort.flag) fort.flag.visible = on;
}
function fortDown(fort) {
  fort.backAt = state.wave + 3;
  fort.upAt = time + 60; // PvP has no waves: rebuilt after a minute
  const gold = pay(fort.x, fort.z, fort.gold * comboKill(fort.x, fort.z));
  fortShow(fort, false);
  for (let i = 0; i < 10; i++) fx.hit(fort.x + (Math.random() - 0.5) * fort.len, 5 + Math.random() * 2, fort.z + (Math.random() - 0.5) * fort.len);
  sound('sink', fort.x, fort.z);
  sound('boom', fort.x, fort.z);
  shake = Math.max(shake, 0.5);
  banner(gold ? `FORT DESTROYED · +${gold} GOLD` : 'FORT DESTROYED', 2.5);
}
function fortUp(fort) {
  Object.assign(fort, { hp: fort.maxHp, alive: true });
  fortShow(fort, true);
}

// game flow: fight → lull → pick (upgrade cards) → between → fight … | dead
const state = { mode: 'select', wave: 0, gold: 0, t: 0, banner: 0, bannerText: '', queue: [], nextAt: 0, merchants: [], left: 0, delivered: 0, escorts: 0, port: 0, convoyN: 0, krakenAt: Infinity }; // krakenAt: state.t (waves) / time (PvP) the kraken surfaces // delivered: gold merchants got to port (convoy mode), it pays for more escorts

// input: every game key is an action looked up by physical key code (store.js DEFAULT_KEYS, changed in the settings screen),
// so fire is A/E on AZERTY and Q/E on QWERTY. `held`: the actions whose key is down.
const held = new Set();
let keys = {}, actionOf = {};
function rekey() {
  keys = store.keys;
  // M sits on another physical key in AZERTY: until the player picks a key, mute is the key that types M when the browser knows it
  // (not when another action already has that key: mute stays where it is)
  const m = ui.codeFor('m');
  if (keys.mute === DEFAULT_KEYS.mute && m && !Object.values(keys).includes(m)) keys.mute = m;
  actionOf = Object.fromEntries(Object.entries(keys).map(([a, c]) => [c, a]));
  const k = (a) => `<kbd>${ui.esc(ui.keyLabel(keys[a]))}</kbd>`;
  $('help').innerHTML = `${k('sailUp')}/${k('sailDown')} sail up/down · ${k('turnLeft')}/${k('turnRight')} turn · ${k('firePort')} fire left · ${k('fireStarboard')} fire right · ${k('skill1')}-${k('skill4')} skills · ${k('board')} board · ${k('mute')} sound · ${k('overview')} zoom · ${k('pause')} pause`;
  $('help').hidden = !store.display.hints;
  $('k-port').textContent = ui.keyLabel(keys.firePort);
  $('k-star').textContent = ui.keyLabel(keys.fireStarboard);
  $('k-board').textContent = ui.keyLabel(keys.board);
  $('cards-h').textContent = `Refit your ship: click or press ${ui.keyLabel(keys.skill1)}, ${ui.keyLabel(keys.skill2)} or ${ui.keyLabel(keys.skill3)}`;
  skillSig = cardSig = ''; // their key labels are redrawn
}
// a numpad digit bound on its own is that action; unbound, it follows the digit row
const actionAt = (code) => actionOf[code] || actionOf[code.replace(/^Numpad(\d)$/, 'Digit$1')];
// Mute: where the browser does not tell the layout (Firefox, Safari), the default is whatever key types M
const actionFor = (e) => actionAt(e.code) || (keys.mute === DEFAULT_KEYS.mute && !ui.hasLayout() && /^m$/i.test(e.key) ? 'mute' : undefined);
function toggleMute() {
  const a = store.audio;
  a.muted = !a.muted;
  store.audio = a;
  setAudio(a);
  if (ui.top() === 'settings') ui.refresh();
}
addEventListener('pointerdown', () => paused || unlock()); // a reload skips the title: the first click or key of the page unlocks the audio
addEventListener('keydown', (e) => {
  if (!paused) unlock(); // paused: the audio clock stays stopped
  if (ui.active()) { // a menu screen is open: every key is its own (a text field keeps its characters)
    if (e.target.tagName !== 'INPUT' && e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
    return ui.key(e);
  }
  // Firefox's find-as-you-type opens its search bar on any typed character: a wrong letter, or M, whose code depends on the layout.
  // So every character is kept from the browser, not only the game's keys. Ctrl / Cmd / Alt shortcuts still pass.
  if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
  const a = actionFor(e);
  if (a || /^(Arrow\w+|Space|Enter|Backspace)$/.test(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (a === 'pause' || e.code === 'Escape') return openPause(); // Escape too, though fullscreen spends it on leaving fullscreen
  if (state.boarding) { if (a === 'board') boardPress(); return; } // the world is stopped: boarding is the only input
  if (a === 'overview') overview = !overview;
  if (a === 'mute') toggleMute();
  if (a) held.add(a);
  const pick = { skill1: 0, skill2: 1, skill3: 2, skill4: 3 }[a];
  if (net === 'guest' ? guestShip === null : state.mode === 'select') return; // no run yet (the menus have the keys then)
  const msg = a === 'board' && state.mode !== 'pick' ? { t: 'board' }
    : a === 'sailUp' ? { t: 'sail', d: 1 } : a === 'sailDown' ? { t: 'sail', d: -1 }
    : pick !== undefined ? (me?.cards?.length ? { t: 'card', i: pick } : { t: 'skill', i: pick }) : null;
  if (!msg) return;
  if (net !== 'guest') { if (me) act(me, msg); return; }
  room.send(msg);
  // a guest hears its own clicks right away, not a round trip later
  if (msg.t === 'card' && me.cards[pick]) { banner(me.cards[pick].label.toUpperCase(), 1.6); sfx.coin(); }
  if (msg.t === 'skill') { const k = me?.alive && me.skills[pick]; if (k && !(me.cd[k.id] > 0)) sfx.hit(0.5, 0); }
});
// One player's action (local keys, or a guest's message on the host). Guest input is untrusted: clamp it.
function act(p, m) {
  if (m.t === 'in') p.input = { turn: Math.max(-1, Math.min(1, +m.turn || 0)), fireL: !!m.fireL, fireR: !!m.fireR };
  else if (m.t === 'sail') p.sail = Math.max(0, Math.min(3, p.sail + Math.sign(+m.d || 0)));
  else if (m.t === 'skill') castSkill(p, m.i | 0);
  else if (m.t === 'board' && p.alive) tryBoard(p); // the host's own Space never gets here during its ship select
  else if (m.t === 'card') choose(p, m.i | 0);
}
// cannonballs: pending (volley ripple delay) → flying
const pending = [], flying = [];
const ballMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshLambertMaterial({ color: '#1c1e22', flatShading: true }), 256);
ballMesh.castShadow = true;
ballMesh.frustumCulled = false;
scene.add(ballMesh);
let shake = 0;
function fire(s, side) {
  const balls = fireBroadside(s, side);
  pending.push(...balls);
  if (balls.length && s === me) shake = Math.max(shake, 0.18);
}
// skills (sim.js useSkill): spawn what they return, plus sound/FX
function castSkill(p, slot) {
  const r = p.alive && useSkill(p, slot);
  if (!r) return;
  if (r.balls) { pending.push(...r.balls); if (p === me) shake = Math.max(shake, 0.35); }
  if (r.keg) dropKeg(r.keg);
  if (r.id === 'smoke') for (let i = 0; i < 25; i++) fx.cloud(p.x, p.z);
  if (p !== me) return;
  if (r.id === 'boost') sfx.splash(1, 0);
  if (r.id === 'chain' || r.id === 'fire' || r.id === 'brace' || r.id === 'repair') sfx.hit(0.5, 0);
}
// Pause overlay (screens.js). Solo: the world and the audio clock stop. Online the sea does not stop: the overlay
// only takes the keys, and the ship drifts.
let paused = false;
function openPause() {
  if (state.mode === 'select' || (net === 'guest' && guestShip === null)) return; // no run yet
  if (state.mode === 'dead') return; // sunk: the end screen is 3 s away, and a paused world would never get there to sign the run
  held.clear(); // a key released under the overlay never sends keyup to the game
  if (net === 'solo') { paused = true; setPaused(true); }
  ui.open('pause', { online: net !== 'solo' });
}
function resume() {
  paused = false;
  setPaused(false);
  ui.reset();
}
// A run starts from a fresh page: the menus ask for a reload and say where to land (read at the bottom of this file).
function reboot(to) {
  try { sessionStorage.setItem('broadside.boot', to); } catch {}
  location.reload();
}
addEventListener('blur', () => { // alt-tab: pause solo, release the keys online (their keyup goes to the other window)
  if (net === 'solo') return void (ui.active() || openPause());
  held.clear();
  if (net === 'guest' && guestShip !== null) sendInput(); // now: a hidden tab runs no frames
});

addEventListener('keyup', (e) => held.delete(actionFor(e)));

let iw = 2, ih = 2, texel = 1;
function resize() {
  const f = Math.max(1, Math.round(innerHeight / TARGET_PX_H));
  iw = Math.ceil(innerWidth / f);
  ih = Math.ceil(innerHeight / f);
  post.setSize(iw, ih);
  canvas.style.width = iw * f + 'px';
  canvas.style.height = ih * f + 'px';
  setProjection();
}
let overview = false, viewH = VIEW_H;
function setProjection() {
  texel = viewH / ih;
  Object.assign(camera, { left: (-iw * texel) / 2, right: (iw * texel) / 2, top: viewH / 2, bottom: -viewH / 2 });
  camera.updateProjectionMatrix();
  const r = Math.max(50, viewH * 0.85); // shadows must cover whatever is on screen
  Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r });
  sun.shadow.camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const camTarget = new THREE.Vector3();
function updateCamera(dt, snapNow) {
  const p = me || { x: 6, z: 6, h: 0, speed: 0 }; // old select panel: aim below the row so ships sit above the cards
  // a menu screen frames the scene behind it: { orbit } the three ships turning, { ship, side } one of them on the left (-1) or right (1), else the open sea
  const sh = state.mode === 'select' ? ui.shot() : null, ship = sh && PREVIEW[sh.ship]; // not under a pause or end screen
  if (sh?.orbit) setAz(camAz + dt * 0.05); else if (camAz !== CAM_AZ) setAz(CAM_AZ);
  for (const s of PREVIEW) s.mesh.root.visible = !ship || s === ship; // one ship framed: her sisters are not peeking from under the panels
  const wantH = sh ? (ship ? 30 : sh.orbit ? 48 : 64) : overview ? MAP.view : VIEW_H;
  const want = ship ? new THREE.Vector3(ship.x, 0, ship.z).addScaledVector(camRight, -sh.side * wantH * (iw / ih) * 0.24)
    : sh || overview ? new THREE.Vector3() : new THREE.Vector3(p.x + Math.cos(p.h) * p.speed * 0.9, 0, p.z + Math.sin(p.h) * p.speed * 0.9);
  if (viewH !== wantH) {
    viewH = snapNow || Math.abs(wantH - viewH) < 0.05 ? wantH : viewH + (wantH - viewH) * (1 - Math.exp(-6 * dt));
    setProjection();
  }
  if (snapNow) camTarget.copy(want);
  else camTarget.lerp(want, 1 - Math.exp(-(sh ? 10 : 3) * dt)); // menus: a 300 ms travelling
  // Snap the camera to whole texels along its screen axes: static world pixels stop crawling.
  const r = camTarget.dot(camRight), u = camTarget.dot(camUp);
  const t = camTarget.clone()
    .addScaledVector(camRight, Math.round(r / texel) * texel - r)
    .addScaledVector(camUp, Math.round(u / texel) * texel - u);
  if (shake > 0) {
    shake = Math.max(0, shake - dt);
    const k = Math.ceil(shake * 12);
    t.addScaledVector(camRight, Math.round((Math.random() - 0.5) * k) * texel).addScaledVector(camUp, Math.round((Math.random() - 0.5) * k) * texel);
  }
  camera.position.copy(t).addScaledVector(camDir, 200);
  sun.target.position.set(Math.round(t.x), 0, Math.round(t.z));
  sun.position.copy(sun.target.position).add(SUN_OFF);
}

const _v = new THREE.Vector3();
function syncShip(s, t, dt) {
  const { root, body, flag } = s.mesh;
  root.position.set(s.x, 0, s.z);
  root.rotation.y = -s.h;
  body.position.y = Math.sin(t * 1.4 + s.seed) * 0.12 - 0.05;
  body.rotation.x = Math.sin(t * 1.1 + s.seed) * 0.035 - s.turnRate * s.speed * 0.02; // roll + heel into turns
  body.rotation.z = Math.sin(t * 0.9 + s.seed * 2) * 0.025;
  if (!s.alive) {
    // list to one side, settle stern-first, then go under
    body.position.y -= s.sinkT * s.sinkT * 0.12;
    body.rotation.x += Math.min(0.5, s.sinkT * 0.12) * (s.seed > 5 ? 1 : -1);
    body.rotation.z -= Math.min(0.35, s.sinkT * 0.06);
    if (Math.random() < 0.5) fx.bubble(s.x, s.z);
  }
  s.mesh.foam.visible = s.alive; // back on when a co-op pirate respawns
  // fire on the deck once below half hull, or while fire shot burns
  if (s.mesh.arms) s.mesh.arms.forEach((a, i) => (a.rotation.z = Math.sin(t * 1.8 + i * 1.3) * 0.3)); // kraken arms writhe
  if ((s.burnT > 0 || (s.hp < s.maxHp * 0.5 && !s.mesh.arms)) && (s.alive || s.sinkT < 3) && Math.random() < (s.burnT > 0 ? 0.8 : 0.35 + 0.4 * (1 - s.hp / s.maxHp))) {
    _v.set((Math.random() - 0.5) * s.len * 0.7, 1.8, (Math.random() - 0.5) * s.beam * 0.6);
    body.localToWorld(_v);
    fx.burn(_v.x, _v.y, _v.z);
  }
  flag.rotation.y = Math.sin(t * 4 + s.seed) * 0.3;
  // Brace the yards toward the wind (same wind as the sea swell): sails swing as the ship turns.
  let rel = WIND - s.h;
  rel = Math.atan2(Math.sin(rel), Math.cos(rel));
  const brace = -Math.max(-0.65, Math.min(0.65, rel * 0.55));
  s.brace = (s.brace ?? brace) + (brace - (s.brace ?? brace)) * Math.min(1, dt * 2);
  for (const r of s.mesh.rigs) r.rotation.y = s.brace;
  s.mesh.foam.scale.set(1 + s.speed * 0.02, 1, 1 + s.speed * 0.04);
  if (s.speed > 0.8) {
    s.wakeT -= dt;
    if (s.wakeT <= 0) {
      s.wakeT = 0.06;
      const c = Math.cos(s.h), sn = Math.sin(s.h);
      const back = -s.len * 0.48;
      for (const side of [-1, 1]) {
        const lx = back, lz = side * s.beam * 0.42;
        const x = s.x + c * lx - sn * lz, z = s.z + sn * lx + c * lz;
        // spread outward from the stern: a V wake
        wakes.spawn(x, z, 0.5 + s.speed * 0.06, -sn * side * 1.2, c * side * 1.2, 2.4);
      }
      wakes.spawn(s.x + c * back, s.z + sn * back, 0.7 + s.speed * 0.05, 0, 0, 1.6);
    }
  }
}

let last = performance.now(), time = 0, frames = 0;
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (hitstop > 0) hitstop -= dt;
  else if (net === 'guest') guestStep(dt);
  else if (!paused) step(dt);
}
function frame(now) {
  tick(now);
  post.render(scene, camera); // paused too: the frozen scene stays under the overlay
  if (++frames === 2) window.__ready = true;
  requestAnimationFrame(frame);
}
// A hidden tab gets no frames and its timers drop to one a second, but the host runs the game for everyone: a worker's
// timer is not slowed down in the background, and steps the sim at 30 Hz while the tab is hidden (nothing is drawn).
// Started by hostGame; checked in Chrome, other browsers may still throttle it (guests then read WAITING FOR THE HOST…).
let ticker = null;
function hostTicker() {
  if (ticker) return;
  ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 33)'])));
  ticker.onmessage = () => { if (document.hidden && net === 'host') tick(performance.now()); };
}
// --- waves -------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
// local: only on this screen (a host's own pick must not ride the snapshot to every guest)
function banner(text, dur = 2.5, local = false) {
  $('banner').textContent = text;
  state.bannerText = local ? '' : text;
  state.banner = dur;
}
// A free spot 55-75 units from a random pirate (`but` excluded: the one respawning), ≥45 from all of them.
function spawnPoint(but) {
  const A = anyAlive(but) || { x: 0, z: 0 }, others = players.filter((p) => p.alive && p !== but);
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 20, lx = BOUNDS.x - 12, lz = BOUNDS.z - 12;
    const x = Math.max(-lx, Math.min(lx, A.x + Math.cos(a) * r));
    const z = Math.max(-lz, Math.min(lz, A.z + Math.sin(a) * r));
    if (others.some((p) => Math.hypot(x - p.x, z - p.z) < 45)) continue;
    if (ISLANDS.some((I) => Math.hypot(x - I.x, z - I.z) < I.r + 10)) continue;
    if (ships.some((o) => o !== but && Math.hypot(x - o.x, z - o.z) < 16)) continue;
    return [x, z];
  }
  return [A.x > 0 ? -BOUNDS.x + 45 : BOUNDS.x - 45, 0]; // clear of the convoy map's port islands (convoyStart slides spawns off a hull here)
}
// Merchant route: from a spawn point, past a pirate (±0.4 rad) to the far side of the arena.
// convoy mode: [from, to] ports of the current convoy (odd convoys sail west → east), and the open water off a port's jetty
const route = () => { const p = ISLANDS.filter((I) => I.kind === 'port'); return state.wave % 2 ? p : p.reverse(); };
const mouth = (port) => { const d = Math.hypot(port.x, port.z) || 1, k = 1 - (port.r + 16) / d; return { x: port.x * k, z: port.z * k }; }; // toward the map centre
// Where the next convoy ship leaves port, bow toward the far port: the mouth, slid along the coast until no hull is within 12
// (the last convoy's ships, a pirate camping the mouth).
function convoyStart() {
  const [from, to] = route(), a = mouth(from), b = mouth(to), h = Math.atan2(b.z - a.z, b.x - a.x);
  const free = (d) => !ships.some((o) => o.alive && Math.hypot(a.x - Math.sin(h) * d - o.x, a.z + Math.cos(h) * d - o.z) < 12);
  const d = [0, 12, -12, 24, -24, 36, -36].find(free) ?? 0; // ponytail: all blocked → the mouth anyway
  return { x: a.x - Math.sin(h) * d, z: a.z + Math.cos(h) * d, h, dest: b };
}
// escorts alternate two profiles: guards hold a station beside a merchant (updateEnemies, sim.js guardSteer), hunters chase the pirates
function spawnEscort(type) {
  const { x, z, h } = convoyStart();
  addShip(type, 'navy', 1, x, z, h, 2).escort = state.escorts++ % 2 ? 'hunter' : 'guard';
}
function spawnMerchant(m) {
  if (convoy) {
    const { x, z, h, dest } = convoyStart();
    addShip(m.type, 'merchant', 2, x, z, h, 2, Object.assign(makeMerchant(m.type, x, z, h, m.armed, dest), { maxAge: 240 })); // a crossing takes ~75 s, more when chased; past 240 s she counts as in port so a stuck merchant can't stall the convoy
    return;
  }
  const [x, z] = spawnPoint(), lx = BOUNDS.x - 12, lz = BOUNDS.z - 12, P = anyAlive() || { x: 0, z: 0 };
  const a = Math.atan2(P.z - z, P.x - x) + (Math.random() < 0.5 ? -0.4 : 0.4);
  const r = Math.hypot(P.x - x, P.z - z) * 1.4 + 20;
  const dest = { x: Math.max(-lx, Math.min(lx, x + Math.cos(a) * r)), z: Math.max(-lz, Math.min(lz, z + Math.sin(a) * r)) };
  const h = Math.atan2(dest.z - z, dest.x - x);
  addShip(m.type, 'merchant', 2, x, z, h, 2, makeMerchant(m.type, x, z, h, m.armed, dest));
  if (m.escort) addShip('brig', 'navy', 1, x - Math.sin(h) * 9, z + Math.cos(h) * 9, h, 2);
  if (mode !== 'pvp' || state.banner <= 0) banner(m.escort ? 'CONVOY SIGHTED' : m.armed ? 'ARMED MERCHANT SIGHTED' : 'MERCHANT SIGHTED', 1.6); // PvP: never over the match result
}
function startWave(k) {
  state.wave = k;
  state.mode = 'fight';
  state.t = 0;
  state.nextAt = convoy ? 2 : 0; // convoy: escorts leave port between two merchants
  state.escorts = state.port = 0;
  sfx.bell();
  state.queue = waveSpec(k, Math.random, 1 + 0.6 * (players.length - 1), convoy ? state.delivered / 60 : 0); // ships join one at a time (flow), never the whole wave at once
  state.merchants = convoy ? convoySpec(k).map((m, i) => ({ ...m, at: i * 4 })) : merchantSpec(k).map((m, i) => ({ ...m, at: 5 + i * 15 }));
  state.convoyN = state.merchants.length;
  state.krakenAt = krakenDue(convoy, k) ? 15 : Infinity;
  let rebuilt = false;
  for (const f of forts) if (!f.alive && k >= f.backAt) { fortUp(f); rebuilt = true; }
  const [from, to] = route();
  banner(convoy ? `CONVOY ${k} · ${from.name} → ${to.name}` : rebuilt ? `WAVE ${k} · THE FORT IS REBUILT` : fortActive(k) && k === 3 ? `WAVE ${k} · THE FORT OPENS FIRE` : `WAVE ${k}`);
}
// a ship's six stats against the best of the three (1 = the top of its gauge)
const shipStats = (s) => [
  ['SPEED', s.maxSpeed / 14], ['HANDLING', s.turn / 1.4], ['HULL', s.maxHp / 150],
  ['GUNS', s.cannons / 6], ['RELOAD', 2.4 / s.reloadTime], ['CREW', s.maxCrew / 50],
];
// mouse: a click on a refit card presses its key
// ponytail: replays the key handler so the pause / guest rules stay in one place
$('cards-list').addEventListener('click', (e) => {
  const c = e.target.closest('.card');
  if (c) dispatchEvent(new KeyboardEvent('keydown', { code: keys['skill' + ([...c.parentNode.children].indexOf(c) + 1)] }));
});
function makePirate(s, pid, pick, name) {
  return Object.assign(s, { isPlayer: true, pid, pick, tag: nick(name) || 'P' + (pid + 1), team: mode === 'pvp' ? 10 + pid : 0, input: { turn: 0, fireL: false, fireR: false }, cards: [], kills: 0 });
}
function hideSelect() {
  for (const s of PREVIEW) {
    if (s === me) continue;
    scene.remove(s.mesh.root);
    if (ships.includes(s)) ships.splice(ships.indexOf(s), 1);
  }
  document.body.classList.remove('selecting');
}
let guestShip = null;
// solo and host: this browser's own ship (a guest's is built by the host and comes back in snapshots)
function choosePlayer(i) {
  if (net === 'solo') store.lastMode = convoy ? 'convoy' : 'waves'; // the menu's SET SAIL
  store.lastShip = SHIPS[i];
  me = makePirate(PREVIEW[i], 0, i, store.name);
  if (!ships.includes(me)) ships.push(me); // a host's previews wait outside the sim (hostGame)
  players.push(me);
  hideSelect();
  state.mode = 'between';
  state.t = state.nextAt = 0; // nextAt: a PvP room already ran its merchant timer in the lobby
  banner(me.name.toUpperCase() + ' SETS SAIL', 2, true);
}
// a guest's ship (at the start, or for one who joins a run under way): co-op drops them beside a crewmate, PvP somewhere safe
function addPlayer(pid, i, name) {
  if (players.some((p) => p.pid === pid) || !PLAYER_SHIPS[i]) return;
  if (state.mode === 'dead') return banner('THIS RUN IS OVER', 3); // no ship: a latecomer must not sign a score for it
  const p = makePirate(makePlayer(i), pid, i, name);
  addShip(p.type, 'pirate', p.team, 0, 0, 0, 0, p);
  players.push(p);
  respawn(p, 1);
  banner(`${p.tag} JOINS · ${p.name.toUpperCase()}`, 2);
}
function respawn(p, hpFrac) {
  const a = mode === 'coop' && anyAlive(p);
  let [x, z] = a ? [a.x, a.z] : spawnPoint(p);
  // co-op: beside a crewmate, on open water: clear of islands, the arena edge and every other hull
  // (a random bearing, widening the ring if the water is crowded; the last try is used if none is free)
  for (let i = 0; a && i < 40; i++) {
    const r = Math.random() * Math.PI * 2, d = 12 + i * 0.5;
    x = a.x + Math.cos(r) * d; z = a.z + Math.sin(r) * d;
    if (Math.abs(x) < BOUNDS.x - 6 && Math.abs(z) < BOUNDS.z - 6 && !ISLANDS.some((I) => Math.hypot(x - I.x, z - I.z) < I.r + 8)
      && !ships.some((o) => o !== p && o.alive && Math.hypot(x - o.x, z - o.z) < 10)) break;
  }
  const h = a ? a.h : Math.atan2(-z, -x);
  Object.assign(p, { x, z, h, alive: true, hp: p.maxHp * hpFrac, sinkT: 0, speed: 0, sail: 0, turnIn: 0, turnRate: 0, burnT: 0, slowT: 0, calm: 0, wrecked: false, respawnAt: undefined });
  if (hpFrac === 1) p.crew = p.maxCrew; // PvP: a fresh ship, not a hull with no gunners
}
function choose(p, i) {
  const c = p.cards[i];
  if (!c) return;
  applyUpgrade(p, c.id);
  if (c.id === 'cannons') setGuns(p.mesh, p.cannons);
  p.cards = [];
  if (p === me) { banner(c.label.toUpperCase(), 1.6, true); sfx.coin(); }
}
const PICK_TIME = 22; // s since the lull began (cards show at 2.2)
// host only, online: sets sail for wave 1 (co-op) or starts / restarts the PvP match
function hostStart() {
  if (mode === 'coop') { if (state.mode === 'between' && state.wave === 0) state.go = true; return; }
  if (state.mode === 'pvp' || !me) return;
  state.mode = 'pvp';
  state.left = 300;
  for (const k of [...kegs, ...slams]) scene.remove(k.mesh); // nothing fired or dropped last match scores in this one
  kegs.length = slams.length = pending.length = flying.length = 0;
  diveKraken();
  state.krakenAt = time + 60;
  for (const p of players) { // every match starts from the stock ship: last match's refits don't carry over
    Object.assign(p, makePlayer(p.pick), { team: p.team, kills: 0 });
    setGuns(p.mesh, p.cannons);
    respawn(p, 1);
  }
  banner('FIRST TO 10 SINKINGS', 2.5);
  sfx.bell();
}
function flow(dt) {
  state.t += dt;
  setCombat(state.mode === 'fight' || state.mode === 'pvp');
  if (state.banner > 0) state.banner -= dt;
  quickFlow();
  if (mode === 'pvp') return pvpFlow(dt); // also while the host is still on ship select: guests are already duelling
  if (state.mode === 'select') return;
  if (!players.some((p) => p.alive) && state.mode !== 'dead') {
    state.mode = 'dead';
    state.t = 0;
    for (const p of players) p.cards = [];
  }
  if (state.mode === 'dead') return gameOver();
  if (state.mode === 'fight' && state.queue.length && state.t >= state.nextAt) {
    if (convoy) spawnEscort(state.queue.shift());
    else {
      const [x, z] = spawnPoint(), P = nearestPlayer({ x, z });
      addShip(state.queue.shift(), 'navy', 1, x, z, Math.atan2(P.z - z, P.x - x), 3);
    }
    state.nextAt += convoy ? 4 : 7;
  }
  while (state.mode === 'fight' && state.merchants[0]?.at <= state.t) spawnMerchant(state.merchants.shift());
  if (state.mode === 'fight' && state.t >= state.krakenAt) { state.krakenAt = Infinity; spawnKraken(); }
  // waves: the navy is sunk. convoy: no merchant left at sea (sunk, captured or in port), whatever is left of the escort
  const cleared = convoy ? !state.merchants.length && !ships.some((o) => o.merchant && o.alive && !o.escaped)
    : !state.queue.length && !ships.some((o) => o.team === 1 && o.alive);
  if (state.mode === 'fight' && cleared) {
    if (convoy) for (const o of ships) if (o.team === 1 && o.alive) o.escaped = true; // the escort's job is over: it sails off (removed like a merchant that got away)
    diveKraken(); // nothing slams the crew during repairs
    state.krakenAt = Infinity;
    state.mode = 'lull';
    state.merchants = [];
    state.queue = [];
    state.t = 0;
    for (const p of players) {
      if (!p.alive) respawn(p, 0.5); // co-op: sunk crewmates are back for the break
      p.repair = p.maxHp * 0.6; // patch up to 60% of the hull per break, a bit each frame
      p.crew = Math.min(p.maxCrew, p.crew + p.maxCrew * 0.3); // recruits between waves
    }
    banner(convoy ? `${state.convoyN - state.port} TAKEN · ${state.port} MADE PORT${state.port ? ' · ESCORT REINFORCED' : ''}` : 'WAVE CLEARED · REPAIRS', convoy ? 3 : 2);
    sfx.fanfare();
  }
  for (const p of players) {
    const d = state.mode === 'fight' || !p.alive ? 0 : Math.min(p.repair || 0, p.maxHp * 0.15 * dt, p.maxHp - p.hp);
    p.hp += d;
    p.repair -= d;
    p.fix = d + regenShip(p, dt) > 0;
  }
  if (state.mode === 'lull' && state.t > 2.2) {
    state.mode = 'pick';
    for (const p of players) p.cards = rollUpgrades(p);
  }
  if (state.mode === 'pick' && net !== 'solo' && state.t > PICK_TIME) for (const p of players) choose(p, Math.floor(Math.random() * p.cards.length)); // online: an idle pirate gets a random card
  if (state.mode === 'pick' && players.every((p) => !p.cards.length)) { state.mode = 'between'; state.t = 0; }
  if (state.mode === 'between' && state.t > 2.5 && (net === 'solo' || state.wave > 0 || state.go)) startWave(state.wave + 1);
}
// quick match, host: a countdown in the lobby once someone joined (cut short when every seat is taken and every pirate is ready), then the start
const started = () => (mode === 'pvp' ? state.mode === 'pvp' || state.mode === 'over' : state.go || state.wave > 0);
const QUICK_WAIT = 15; // s
function quickFlow() {
  if (!quick || net !== 'host' || !roomOpen || !lobby || lobby.started) return;
  if (!room.guests()) { quickAt = null; if (lobby.countdown !== null) { lobby.countdown = null; lobbySync(); } return; } // the last guest left: wait for the next one
  quickAt ??= time + QUICK_WAIT;
  if (lobby.players.length === MAX_PLAYERS && lobby.players.every((p) => p.ready)) quickAt = Math.min(quickAt, time);
  const s = Math.ceil(quickAt - time);
  if (s > 0) { if (s !== lobby.countdown) { lobby.countdown = s; lobbySync(); } return; } // once a second: guests count down too
  lobbyStart();
}
// the lobby's SET SAIL, the quick-match clock, or a PvP rematch: a quick room that just started tells the server now (no more guests), not at the next 10 s beat
function sail() {
  const was = started();
  hostStart();
  if (quick && roomOpen && !was && started()) quickBeatNow();
}
// quick match, host → server: the seats still free. 0 once the game started, or once this tab has been hidden for over a minute (its
// pirate is away, and not every browser keeps a hidden game running: see hostTicker). A shorter absence stays listed: a host who looks
// away while waiting must still get its guest, and the bell in `join` calls it back.
// ponytail: a host away for longer may find the slot taken when it returns, and then two hosts wait side by side; the server could tell the unlisted one to join the other
const AWAY = 60000; // ms
let hiddenAt = 0;
function quickBeatNow() {
  const on = started(), id = quickBeat, away = hiddenAt && Date.now() - hiddenAt > AWAY;
  match(quick, `&code=${room.code()}&free=${on || away ? 0 : MAX_PLAYERS - 1 - room.guests()}`)
    .then(() => { if (on) clearInterval(id); }).catch(() => {}); // started: beats stop once the server got the 0 (a failed one is retried at the next beat)
}
const TITLE = document.title;
document.addEventListener('visibilitychange', () => {
  hiddenAt = document.hidden ? Date.now() : 0;
  if (document.hidden) return;
  document.title = TITLE;
  if (quick && net === 'host' && roomOpen && !started()) quickBeatNow(); // back from a long absence: relist
});
// PvP: 'between' (warm-up until the host presses Enter) → 'pvp' → 'over' (Enter: rematch)
function pvpFlow(dt) {
  for (const p of players) {
    p.fix = regenShip(p, dt) > 0;
    if (p.alive) continue;
    p.respawnAt ??= time + 4;
    if (time >= p.respawnAt) respawn(p, 1);
  }
  if (players.length && state.t >= state.nextAt) { // merchants keep coming: loot to fight over (not before anyone has a ship: nobody steers them)
    state.nextAt = state.t + 25;
    if (ships.filter((o) => o.merchant && o.alive && !o.escaped).length < 2) spawnMerchant(merchantSpec(4)[0]);
  }
  for (const f of forts) if (!f.alive && time >= f.upAt) fortUp(f);
  if (state.mode !== 'pvp') return;
  if (time >= state.krakenAt) { state.krakenAt = Infinity; spawnKraken(); } // a minute into the match, then a minute after each kill
  state.left -= dt;
  const [top, second] = [...players].sort((a, b) => b.kills - a.kills);
  if (!top) return;
  const tie = top.kills === second?.kills;
  if (tie && state.left <= 0 && state.left + dt > 0) banner('SUDDEN DEATH · NEXT SINKING WINS', 3);
  if ((state.left <= 0 || top.kills >= 10) && !tie) {
    state.mode = 'over';
    banner(`${top.tag} WINS · ${top.kills} SINKINGS`, 4);
    sfx.fanfare();
    pvpOver();
  }
}

// --- enemies + fort ---------------------------------------------------------
function updateEnemies(dt) {
  if (!players.length) return; // ship select: nobody to shoot at yet
  for (const s of ships) {
    if (s.team !== 1 || !s.alive) continue;
    let tgt = nearestPlayer(s);
    if (s.escort === 'guard') {
      // ward: kept until she's gone, then the merchant with the fewest guards (closest on a tie); station: the free side, further out per pair
      if (!(s.ward?.alive && !s.ward.escaped)) {
        const n = (o) => ships.filter((g) => g !== s && g.ward === o && g.alive).length;
        s.ward = ships.filter((o) => o.merchant && o.alive && !o.escaped).sort((a, b) => n(a) - n(b) || Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
        if (s.ward) { const k = n(s.ward); s.station = (k % 2 ? -1 : 1) * (12 + 8 * (k >> 1)); }
      }
      const w = s.ward && nearestPlayer(s.ward); // the pirate attacking the ward, not just the one nearest the guard
      if (w && Math.hypot(w.x - s.ward.x, w.z - s.ward.z) < 45) tgt = w;
    }
    const side = s.escort === 'guard' ? guardSteer(s, s.ward, tgt) : aiSteer(s, tgt);
    if (side && !(tgt.smokeT > 0)) fire(s, side); // smoke screen: they can't see you
  }
  for (const s of ships) {
    if (s.team !== 2 || !s.alive || s.escaped) continue;
    const r = merchantSteer(s, nearestPlayer(s), dt);
    if (r === 'escaped') {
      s.escaped = true;
      if (convoy) { state.delivered += s.gold; state.port++; } // her cargo pays for a bigger escort next time
      popup(s.x, s.z, convoy ? `ESCAPED · +${s.gold} NAVY GOLD` : 'ESCAPED');
    }
    else if (r) fire(s, r);
  }
  for (const s of ships) if (s.type === 'kraken' && !s.escaped) { const sl = krakenSteer(s, ships); if (sl) addSlam(sl); }
  if (!fortsOn() || state.mode === 'dead') return;
  for (const t of forts.flatMap((f) => (f.alive ? f.turrets : []))) {
    const b = fireTurret(t, nearestPlayer(t), dt);
    t.mesh.rotation.y = -t.aim;
    if (b) {
      b.x += b.ox * 1.3;
      b.z += b.oz * 1.3;
      pending.push(b);
    }
  }
}

// --- powder kegs (skill): floating mines -------------------------------------
const kegs = [];
const kegBandMat = new THREE.MeshLambertMaterial({ color: '#a52623', flatShading: true });
function kegMesh() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(barrelGeo, bandMat));
  for (const y of [-0.3, 0.3]) { const b = new THREE.Mesh(bandGeo, kegBandMat); b.position.y = y; g.add(b); }
  g.traverse((o) => (o.castShadow = true));
  scene.add(g);
  return g;
}
function dropKeg(k) {
  k.mesh = kegMesh();
  k.id ??= nextId++;
  kegs.push(k);
  sound('splash', k.x, k.z, 0.6);
}
function updateKegs(dt) {
  for (let i = kegs.length - 1; i >= 0; i--) {
    const k = kegs[i], ev = stepKeg(k, dt, ships);
    k.mesh.position.set(k.x, 0.2 + Math.sin(time * 2 + i) * 0.1, k.z);
    if (!ev) continue;
    if (ev === 'boom') {
      for (let j = 0; j < 3; j++) fx.hit(k.x + Math.random() * 2 - 1, 1, k.z + Math.random() * 2 - 1);
      fx.splash(k.x, k.z);
      sound('boom', k.x, k.z, 1, 0.4); // shakes only near our own ship
    }
    scene.remove(k.mesh);
    kegs.splice(i, 1);
  }
}

// --- kraken (sim.js team 3): roams, slams any ship near it, player or not; no loot ----
function spawnKraken() {
  const [x, z] = spawnPoint(), P = nearestPlayer({ x, z }) || { x: 0, z: 0 };
  const k = addShip('kraken', 'kraken', 3, x, z, Math.atan2(P.z - z, P.x - x), 0);
  for (let i = 0; i < 3; i++) fx.splash(k.x + Math.random() * 6 - 3, k.z + Math.random() * 6 - 3);
  sound('splash', k.x, k.z, 1.5);
  if (mode !== 'pvp' || state.banner <= 0) banner('THE KRAKEN RISES', 2.5);
}
function diveKraken() {
  for (const o of ships) if (o.type === 'kraken' && o.alive) { o.escaped = true; fx.splash(o.x, o.z); } // removed like a merchant that got away
  for (const sl of slams) scene.remove(sl.mesh); // and its arms in the air go with it
  slams.length = 0;
}
function krakenSlain(k) {
  for (let i = 0; i < 4; i++) fx.splash(k.x + Math.random() * 8 - 4, k.z + Math.random() * 8 - 4);
  if (mode === 'pvp') state.krakenAt = time + 60;
  if (mode !== 'pvp' || state.banner <= 0) banner('THE KRAKEN IS SLAIN', 2.5);
}
const slams = [];
function slamMesh() { const m = buildTentacle(); m.rotation.y = Math.random() * 6.28; scene.add(m); return m; }
function addSlam(sl) {
  Object.assign(sl, { id: nextId++, mesh: slamMesh() });
  slams.push(sl);
  sound('splash', sl.x, sl.z, 0.6);
}
// telegraph: a ring of bubbles the size of the hit, the arm rises out of it, then whips down over the last quarter
function drawSlam(sl) {
  const k = Math.max(0, sl.t) / SLAM.t; // 1 → 0
  const arm = sl.mesh.userData.arm;
  sl.mesh.position.set(sl.x, -0.3, sl.z);
  arm.scale.y = Math.min(1, (1 - k) * 2.5) + 0.01;
  arm.rotation.z = k > 0.25 ? 0.25 : -1.4 + (k / 0.25) * 1.65;
  if (Math.random() < 0.6) { const a = Math.random() * 6.28; wakes.spawn(sl.x + Math.cos(a) * sl.r, sl.z + Math.sin(a) * sl.r, 0.7, 0, 0, 0.8); }
}
function updateSlams(dt) {
  for (let i = slams.length - 1; i >= 0; i--) {
    const sl = slams[i];
    if (!stepSlam(sl, dt, ships)) { drawSlam(sl); continue; }
    for (let j = 0; j < 3; j++) fx.splash(sl.x + Math.random() * 4 - 2, sl.z + Math.random() * 4 - 2);
    sound('boom', sl.x, sl.z, 0.8, 0.35);
    scene.remove(sl.mesh);
    slams.splice(i, 1);
  }
}

// --- loot: floating barrels -------------------------------------------------
const loot = [];
const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 1, 7);
const bandGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.12, 7);
const barrelMat = new THREE.MeshLambertMaterial({ color: '#ad7a48', flatShading: true });
const bandMat = new THREE.MeshLambertMaterial({ color: '#2b1a10', flatShading: true });
const goldMat = new THREE.MeshLambertMaterial({ color: '#ffd24a', emissive: '#c9952a', flatShading: true }); // loot reads as gold
function dropLoot(s, mult = 1) {
  const n = (s.merchant ? 4 : 1) + Math.floor(Math.random() * 3); // merchants spill their cargo
  for (let i = 0; i < n; i++) {
    const g = barrelMesh();
    const a = Math.random() * 6.28;
    const o = { id: nextId++, x: s.x + Math.cos(a) * 2, z: s.z + Math.sin(a) * 2, vx: Math.cos(a) * 2, vz: Math.sin(a) * 2, life: 40, value: Math.ceil((s.gold * mult) / n), mesh: g, seed: Math.random() * 6 };
    loot.push(o);
  }
}
function barrelMesh() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(barrelGeo, barrelMat));
  for (const y of [-0.3, 0.3]) { const b = new THREE.Mesh(bandGeo, goldMat); b.position.y = y; g.add(b); }
  g.rotation.z = Math.PI / 2;
  g.traverse((o) => (o.castShadow = true));
  scene.add(g);
  return g;
}
// floating "+N" text at a world point (gold pickups)
function popup(x, z, text, cls) {
  if (net === 'host') events.push(['pop', x, z, text, cls]);
  _p.set(x, 3, z).project(camera);
  const el = document.createElement('div');
  el.className = cls ? 'pop ' + cls : 'pop';
  el.textContent = text;
  el.style.left = Math.round(((_p.x + 1) / 2) * canvas.clientWidth) + 'px';
  el.style.top = Math.round(((1 - _p.y) / 2) * canvas.clientHeight) + 'px';
  $('bars').append(el);
  setTimeout(() => el.remove(), 1200);
}
// combos: each sinking inside COMBO_WIN s of the last one raises the loot multiplier (cap ×5)
const COMBO_WIN = 6;
const combo = { n: 0, t: 0, best: 0 };
let hitstop = 0;
function comboKill(x, z) {
  combo.n = combo.t > 0 ? combo.n + 1 : 1;
  combo.t = COMBO_WIN;
  combo.best = Math.max(combo.best, combo.n);
  const mult = Math.min(combo.n, 5);
  if (mult >= 2) {
    popup(x, z, `×${mult}`, 'combo');
    comboFeel(x, z);
    if (net === 'solo') hitstop = 0.05 + 0.02 * mult; // online the world can't freeze
  }
  return mult;
}
// coin + shake for a combo, online only when it was scored near our own ship (host and guests alike)
function comboFeel(x, z) {
  if (net !== 'solo' && ear(x, z)[0] < 0.5) return;
  sfx.coin();
  shake = Math.max(shake, 0.2);
}
// gold for a capture or the fort. PvP has no gold (counter hidden, nothing to buy): nothing is paid or shown.
function pay(x, z, gold) {
  if (mode === 'pvp') return 0;
  state.gold += gold;
  popup(x, z, `+${gold}`);
  return gold;
}
// End of a run (screens.js `gameover`): signed with the pirates' names, no typing. It goes on this browser's board,
// then on the world's (ice service, net.js); the screen shows the rows around it, on the world board once it answers.
let over = false;
function gameOver() {
  if (state.t > 3 && !over) { over = true; endRun(); }
}
function endRun() {
  const m = convoy ? 'convoy' : 'waves';
  const crew = [...players].sort((a, b) => a.pid - b.pid).map((p) => ({ name: p.tag, ship: String(p.name).toLowerCase() })); // online: the whole crew signs, in seat order
  const board = boardOf(m, crew.length), entry = { mode: m, crew, wave: state.wave, gold: state.gold, combo: combo.best, at: Date.now() };
  const local = signLocal(board, entry);
  const res = { entry, board, name: me?.tag || store.name, online: net !== 'solo', best: local.rank === 0, local: local.rank, world: null, top: local.top, rank: local.rank };
  held.clear();
  ui.open('gameover', res);
  if (local.rank === 0) sfx.fanfare();
  // sunk before wave 1 (a crew ramming each other): the service takes no such run, its board is only read
  worldScores(board, entry.wave > 0 && entry).then((r) => {
    const top = r.top.map(normRow).filter(Boolean); // a service from before names answers its old rows
    if (entry.wave > 0 && r.rank >= 0) { Object.assign(res, { world: r.rank, top, rank: r.rank }); markWorld(board, entry.at, r.rank + 1); }
    else if (entry.wave > 0) res.world = -1; // off the world's top 100: this browser's rows stay (wave 0 was never sent: no world rank)
    if (ui.top() === 'gameover') ui.refresh();
  }).catch(() => ui.toast('warn', 'WORLD BOARD UNREACHABLE · SAVED ON THIS BROWSER', 5000)); // down, or it refused the run (its limit per address, its bounds)
}
function updateLoot(dt) {
  for (let i = loot.length - 1; i >= 0; i--) {
    const o = loot[i];
    o.life -= dt;
    o.vx *= 0.98; o.vz *= 0.98;
    o.x += (o.vx + 0.6) * dt; o.z += (o.vz + 0.45) * dt; // drift downwind
    // crew hauls in anything within 16 units, so sailing near the wreck is enough
    const P = nearestPlayer(o) || { x: 0, z: 0 }, dx = P.x - o.x, dz = P.z - o.z, d = Math.hypot(dx, dz);
    if (P.alive && d < 16) { o.x += (dx / d) * 12 * dt; o.z += (dz / d) * 12 * dt; }
    const got = P.alive && d < P.len * 0.45 + 2;
    if (got || o.life <= 0) {
      if (got && mode === 'pvp') { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.08); popup(o.x, o.z, '+HULL'); } // PvP: cargo patches your hull
      else if (got) { state.gold += o.value; popup(o.x, o.z, `+${o.value}`); }
      if (got) { fx.splash(o.x, o.z); if (P === me) sfx.coin(); }
      scene.remove(o.mesh);
      loot.splice(i, 1);
      continue;
    }
    bobLoot(o);
  }
}
function bobLoot(o) {
  o.mesh.position.set(o.x, Math.sin(time * 2.2 + o.seed) * 0.12 + 0.05 - Math.max(0, 2 - o.life) * 0.5, o.z);
  o.mesh.rotation.y = o.seed + time * 0.3;
}

const _m = new THREE.Matrix4();
function updateBalls(dt) {
  for (let i = pending.length - 1; i >= 0; i--) {
    const b = pending[i];
    if ((b.delay -= dt) > 0) continue;
    pending.splice(i, 1);
    b.id = nextId++;
    fx.muzzle(b.x + b.ox * 0.6, b.y, b.z + b.oz * 0.6, b.ox, b.oz);
    sound('boom', b.x, b.z);
    flying.push(b);
  }
  const targets = [...ships, ...forts];
  for (let i = flying.length - 1; i >= 0; i--) {
    const b = flying[i];
    const ev = stepBall(b, dt, targets);
    if (!ev) continue;
    flying.splice(i, 1);
    if (ev.hit) {
      const isFort = ev.hit.type === 'fort';
      fx.hit(b.x, isFort ? 5.5 : Math.max(1, b.y), b.z);
      if (isFort && !ev.hit.alive) fortDown(ev.hit);
      sound('hit', b.x, b.z);
      if (ev.hit === me) shake = Math.max(shake, 0.3);
    } else if (ev.land) {
      fx.hit(b.x, 1.5, b.z);
      sound('hit', b.x, b.z, 0.6);
    } else {
      fx.splash(b.x, b.z);
      sound('splash', b.x, b.z, 0.7);
    }
  }
  drawBalls();
}
function drawBalls() {
  ballMesh.count = Math.min(256, flying.length);
  for (let i = 0; i < ballMesh.count; i++) ballMesh.setMatrixAt(i, _m.makeTranslation(flying[i].x, flying[i].y, flying[i].z));
  ballMesh.instanceMatrix.needsUpdate = true;
}
function step(dt) {
  if (state.boarding) { updateBoarding(dt); hud(); return; } // boarding melee pauses the world
  time += dt;
  if (combo.t > 0 && (combo.t -= dt) <= 0) combo.n = 0;
  if (me) me.input = localInput();
  for (const p of players) {
    if (!p.alive) continue;
    p.turnIn = p.input.turn;
    if (p.input.fireL) fire(p, -1); // AZERTY A: port (left)
    if (p.input.fireR) fire(p, 1); // starboard (right)
  }
  flow(dt);
  updateEnemies(dt);
  for (const s of ships) {
    stepShip(s, dt);
    syncShip(s, time, dt);
    // flag, not a before/after check: balls, rams and kegs sink ships outside this loop
    if (!s.alive && !s.wrecked) { s.wrecked = true; sound('sink', s.x, s.z); if (s.isPlayer) pirateSunk(s); else if (s.type === 'kraken') krakenSlain(s); else if (s.lastHit !== 3) dropLoot(s, comboKill(s.x, s.z)); }
    // ponytail: every enemy wreck counts as the crew's kill (no killer tracking), except one the kraken finished (lastHit 3, stepSlam / collideShips): navy and merchants are allied (sim.js), so it holds
  }
  for (const r of collideShips(ships)) { fx.hit(r.x, 1.5, r.z); sound('hit', r.x, r.z); if (r.a === me || r.b === me) shake = Math.max(shake, 0.25); }
  // sunk enemies leave the scene (pirate wrecks stay: they respawn)
  for (let i = ships.length - 1; i >= 0; i--) {
    const s = ships[i];
    if (s.isPlayer || !(s.escaped || (!s.alive && s.sinkT >= 7))) continue; // sunk, or merchant got away
    scene.remove(s.mesh.root);
    s.bar?.remove();
    ships.splice(i, 1);
  }
  updateLoot(dt);
  updateKegs(dt);
  updateSlams(dt);
  for (const fort of forts) if (!fort.alive && Math.random() < 0.4) fx.burn(fort.x + (Math.random() - 0.5) * fort.len, 5.5, fort.z + (Math.random() - 0.5) * fort.len); // ruins smoulder
  for (const p of players) if (p.smokeT > 0 && Math.random() < 0.5) fx.cloud(p.x, p.z);
  updateBalls(dt);
  fx.update(dt);
  sea.uTime.value = time;
  wakes.update(dt);
  updateCamera(dt, false);
  hud();
  if (net === 'host' && (snapT += dt) >= SNAP_DT - 1e-6) { snapT = (snapT - SNAP_DT) % SNAP_DT; if (room.guests() && lobby?.started) room.broadcast(snap()); else events.length = 0; } // the remainder is kept: 20 Hz on average at any frame rate. Nobody listening, or still in the lobby: no snapshot
}
function pirateSunk(s) {
  s.cards = [];
  if (mode !== 'pvp') { if (net !== 'solo') banner(`${s.tag} IS SUNK`, 2); return; }
  const k = players.find((p) => p !== s && p.team === s.lastHit);
  if (!k) return banner(`${s.tag} SANK`, 2);
  if (state.mode === 'pvp') k.kills++; // warm-up and post-match sinkings don't score
  const r = state.mode === 'pvp' ? rollUpgrades(k) : [], c = r[Math.floor(Math.random() * r.length)]; // each sinking refits the winner (random: slot 0 is always a skill card)
  if (c) { applyUpgrade(k, c.id); if (c.id === 'cannons') setGuns(k.mesh, k.cannons); popup(k.x, k.z, c.label.split(':')[0].toUpperCase()); }
  banner(`${k.tag} SANK ${s.tag}`, 2);
}
const radar = createRadar($('radar'));
const _p = new THREE.Vector3();
const setHTML = (el, h) => { if (el._h !== h) el.innerHTML = el._h = h; }; // per-frame text: touch the DOM only on change
function hud() {
  $('banner').hidden = state.banner <= 0 || !!state.boarding;
  $('room').hidden = net === 'solo';
  if (net !== 'solo') setHTML($('room'), net === 'host' ? `${quick ? 'QUICK · ' : ''}ROOM <b>${ui.esc(room.code())}</b> · ${players.length}/${MAX_PLAYERS}` : `ONLINE · ${modeName()} · ${players.length} PIRATES`);
  if (!me) return;
  const on = fortsOn(), goal = convoy && state.mode === 'fight' && route()[1];
  radar(me, ships, loot, forts.map((f) => ({ x: f.x, z: f.z, active: on && f.alive })), ISLANDS.filter((I) => I.kind === 'port').map((I) => ({ x: I.x, z: I.z, goal: I === goal })));
  $('coop').hidden = mode === 'pvp';
  $('pvp').hidden = mode !== 'pvp';
  if (mode === 'pvp') {
    const t = Math.max(0, Math.ceil(state.left));
    setHTML($('pvp'), [...players].sort((a, b) => b.kills - a.kills).map((p) => `${p === me ? '<b>' : ''}${p.tag} ${p.name.toUpperCase()} ${p.kills}${p === me ? '</b>' : ''}`).join('<br>') +
      (state.mode === 'pvp' ? `<br>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : ''));
  }
  $('gold').textContent = state.gold;
  $('wave').textContent = state.wave;
  $('wave-l').textContent = convoy ? 'CONVOY' : 'WAVE';
  $('navy').hidden = !convoy;
  $('delivered').textContent = state.delivered;
  $('combo').hidden = combo.n < 2;
  $('combo-n').textContent = '×' + Math.min(combo.n, 5);
  $('combo-t').style.width = (combo.t / COMBO_WIN) * 100 + '%';
  // hull bars above the mast tops: damaged enemies, plus every other pirate (with their tag)
  camera.updateMatrixWorld();
  const W = canvas.clientWidth, H = canvas.clientHeight;
  for (const s of [...ships, ...forts]) {
    if ((s === me && net === 'solo') || (s !== me && s.team === 0 && !s.isPlayer)) { if (s.bar) s.bar.hidden = true; continue; } // a crewmate who left: no frozen bar
    if (!s.bar) {
      s.bar = document.createElement('div');
      s.bar.className = s === me ? 'ebar self' : s.isPlayer ? (s.team === me.team ? 'ebar p' : 'ebar e') : s.merchant ? 'ebar m' : s.type === 'kraken' ? 'ebar k' : 'ebar';
      s.bar.innerHTML = '<i></i>';
      $('bars').append(s.bar);
    }
    if (s.bar.dataset.tag !== (s.tag || '')) s.bar.dataset.tag = s.tag || ''; // online: own ship gets a name-only label (.self)
    const show = s.alive && !s.escaped && (s.hp < s.maxHp || s.isPlayer);
    s.bar.hidden = !show;
    if (!show) continue;
    _p.set(s.x, s.type === 'fort' ? 9 : s.len * 0.95, s.z).project(camera);
    s.bar.style.transform = `translate(${Math.round(((_p.x + 1) / 2) * W) - 24}px, ${Math.round(((1 - _p.y) / 2) * H) - 14}px)`;
    s.bar.firstChild.style.width = (s.hp / s.maxHp) * 100 + '%';
  }
  $('sail').style.width = (me.sail / 3) * 100 + '%';
  $('hp').style.width = (me.hp / me.maxHp) * 100 + '%';
  $('hp').classList.toggle('fix', !!me.fix);
  const rt = me.reloadTime * crewMul(me);
  $('rp').style.width = (1 - me.reload.port / rt) * 100 + '%';
  $('rs').style.width = (1 - me.reload.star / rt) * 100 + '%';
  $('crew').style.width = (me.crew / me.maxCrew) * 100 + '%';
  $('crewn').textContent = `${Math.ceil(me.crew)}/${me.maxCrew}`;
  // "Space: board" tag over the nearest ship close enough to grapple
  const bt = me.alive && !state.boarding && state.mode !== 'pick' ? boardTarget(me) : null;
  $('board-hint').hidden = !bt;
  if (bt) {
    _p.set(bt.x, bt.len * 0.95, bt.z).project(camera);
    $('board-hint').textContent = `${ui.keyLabel(keys.board)} · BOARD${bt.hp < 0.2 * bt.maxHp ? ' (AUTO)' : ''}`;
    $('board-hint').style.transform = `translate(${Math.round(((_p.x + 1) / 2) * W)}px, ${Math.round(((1 - _p.y) / 2) * H) - 46}px) translateX(-50%)`;
  }
  // refit cards: each pirate picks their own
  const cards = me.cards || [], csig = cards.map((c) => c.id).join();
  if (csig !== cardSig) {
    cardSig = csig;
    $('cards-list').innerHTML = cards.map((c, i) => `<div class="card"><kbd>${ui.esc(ui.keyLabel(keys['skill' + (i + 1)]))}</kbd>${c.id.includes(':') ? `<img class="icon" src="${ICON[c.id.split(':')[1]]}">` : ''}<span>${c.label}</span></div>`).join('');
  }
  $('cards').hidden = !cards.length || state.mode === 'dead';
  skillHud();
}
let cardSig = '';
// --- boarding (sim.js rules; here the timing-bar QTE, world paused) ---------------
// Online there is no QTE (it pauses the world): only ships that strike their colours (< 20% hull) can be boarded.
function boardTarget(p) {
  let best = null, bd = Infinity;
  for (const s of ships) {
    const d = Math.hypot(s.x - p.x, s.z - p.z);
    if (canBoard(p, s) && (net === 'solo' || s.hp < 0.2 * s.maxHp) && d < bd) { bd = d; best = s; }
  }
  return best;
}
function tryBoard(p) {
  const e = boardTarget(p);
  if (!e) return;
  const b = startBoarding(p, e);
  if (b.auto) return capture(p, e, null);
  if (net !== 'solo') return;
  state.boarding = { e, b, scale: Math.max(b.you, b.them), msg: 'GRAPPLES OUT!', result: null, endT: 0 };
  newRound();
  $('boarding').hidden = false;
  sfx.hit(0.8, 0);
}
function newRound() {
  const B = state.boarding;
  Object.assign(B, { x: 1, dir: -1, target: 0.12 + Math.random() * 0.55, timer: 2.5 }); // cursor enters from the right
}
function boardPress() {
  const B = state.boarding;
  if (B.result) return;
  resolveRound(Math.max(0, Math.min(1, 1 - Math.abs(B.x - B.target) / 0.25)));
}
function resolveRound(q) {
  const B = state.boarding, you0 = B.b.you, them0 = B.b.them;
  const r = boardRound(B.b, q);
  B.msg = q > 0 ? `${q > 0.8 ? 'PERFECT' : 'HIT'}! -${Math.round(them0 - B.b.them)} DEFENDERS` : `MISSED! -${Math.round(you0 - B.b.you)} CREW`;
  sfx.hit(q > 0 ? 0.4 + q * 0.6 : 0.5, 0);
  if (!r) return newRound();
  B.result = r;
  B.endT = 1.3;
  if (r === 'won') sfx.fanfare(); else sfx.splash(1, 0);
}
function updateBoarding(dt) {
  const B = state.boarding;
  if (B.result) {
    if ((B.endT -= dt) <= 0) return endBoarding();
  } else {
    B.x += B.dir * Math.min(1.6, 0.9 + 0.1 * B.b.round) * dt;
    if (B.x < 0) { B.x = -B.x; B.dir = 1; }
    if (B.x > 1) { B.x = 2 - B.x; B.dir = -1; }
    if ((B.timer -= dt) <= 0) resolveRound(0);
  }
  const b = B.b;
  $('b-title').textContent = B.result === 'won' ? 'THEY SURRENDER!' : B.result === 'lost' ? 'REPELLED!' : 'BOARDING!';
  $('b-you').style.width = Math.max(0, b.you / B.scale) * 100 + '%';
  $('b-them').style.width = Math.max(0, b.them / B.scale) * 100 + '%';
  $('b-youn').textContent = Math.max(0, Math.ceil(b.you));
  $('b-themn').textContent = Math.max(0, Math.ceil(b.them));
  $('b-zone').style.left = (B.target - 0.25) * 100 + '%';
  $('b-target').style.left = (B.target - 0.04) * 100 + '%';
  $('b-cursor').style.left = B.x * 100 + '%';
  $('b-time').style.width = Math.max(0, B.timer / 2.5) * 100 + '%';
  $('b-msg').textContent = B.msg;
}
function endBoarding() {
  const { e, b, result } = state.boarding;
  state.boarding = null;
  $('boarding').hidden = true;
  me.crew = Math.max(1, b.you);
  if (result === 'won') return capture(me, e, b);
  e.crew = Math.max(1, b.them);
  me.boardCd = 6;
  const dx = e.x - me.x, dz = e.z - me.z, d = Math.hypot(dx, dz) || 1;
  e.x += (dx / d) * 6; e.z += (dz / d) * 6; // cut loose
  banner('REPELLED', 1.5);
}
function capture(p, e, b) {
  const r = captureReward(p, e, b);
  pay(e.x, e.z, r.gold * comboKill(e.x, e.z));
  p.crew += r.crew;
  p.hp += r.heal;
  p.boardCd = 2;
  if (r.crew >= 1) popup(p.x, p.z, `+${r.crew} CREW`);
  e.wrecked = true; // plunder paid directly: no barrels on top
  damage(e, 1e9);
  sound('sink', e.x, e.z);
  if (p === me) sfx.coin();
  banner(`${e.merchant ? 'MERCHANT' : 'SHIP'} CAPTURED${b ? '' : ' · STRUCK HER COLOURS'}`, 2);
}

// skill bar: rebuilt when skills change (learn / level up), cooldown overlay + armed border every frame
let skillSig = '';
function skillHud() {
  const sig = me.skills.map((k) => k.id + k.lvl).join();
  if (sig !== skillSig) {
    skillSig = sig;
    $('skills').innerHTML = [0, 1, 2, 3].map((i) => {
      const k = me.skills[i];
      return k
        ? `<div class="slot"><img src="${ICON[k.id]}"><i class="cd"></i><kbd>${ui.esc(ui.keyLabel(keys['skill' + (i + 1)]))}</kbd><em>${'I'.repeat(k.lvl)}</em><span>${SKILLS[k.id].name}</span></div>`
        : `<div class="slot locked"><b>?</b><kbd>${ui.esc(ui.keyLabel(keys['skill' + (i + 1)]))}</kbd><span>locked</span></div>`;
    }).join('');
  }
  me.skills.forEach((k, i) => {
    const el = $('skills').children[i];
    el.querySelector('.cd').style.height = ((me.cd[k.id] || 0) / skillCd(k.id, k.lvl)) * 100 + '%';
    el.classList.toggle('armed', me.ammo?.id === k.id);
  });
}
// --- online: host snapshots, guest rendering, lobby -----------------------------
// Ships go as arrays in SF order (compact); pirates add a PF object with what the HUD needs.
const SF = ['id', 'type', 'livery', 'team', 'x', 'z', 'h', 'speed', 'turnRate', 'sail', 'hp', 'maxHp', 'alive', 'sinkT', 'burnT', 'smokeT', 'cannons', 'escaped', 'pid', 'merchant'];
const PF = ['pid', 'tag', 'name', 'reload', 'reloadTime', 'crew', 'maxCrew', 'skills', 'cd', 'ammo', 'boardCd', 'cards', 'kills', 'fix'];
const SNAP_DT = 0.05; // 20 Hz
let snapT = 0;
function snap() {
  return {
    s: ships.map((o) => SF.map((k) => o[k] ?? null)),
    p: players.map((o) => Object.fromEntries(PF.map((k) => [k, o[k]]))),
    b: flying.map((b) => [b.id, b.x, b.y, b.z]),
    l: loot.map((o) => [o.id, o.x, o.z, o.life]),
    k: kegs.map((k) => [k.id, k.x, k.z]),
    j: slams.map((o) => [o.id, o.x, o.z, o.t]),
    f: forts.map((f) => [f.hp, f.alive, f.turrets.map((t) => t.aim)]),
    g: { mode: state.mode, wave: state.wave, gold: state.gold, delivered: state.delivered, t: state.t, left: state.left, banner: state.banner > 0 ? state.bannerText : '', bt: state.banner, combo: [combo.n, combo.t] },
    e: events.splice(0),
  };
}

// Guests draw one snapshot interval behind: each value glides from where it is drawn now (_a) to the latest snapshot (_b).
const SK = ['x', 'z', 'h', 'speed', 'turnRate', 'sinkT'], BK = ['x', 'y', 'z'], LK = ['x', 'z', 'life'], KK = ['x', 'z'], JK = ['x', 'z', 't'];
let snapAt = 0, snapGap = SNAP_DT * 1000, lastBanner = '', lastIn = '';
const byId = new Map(), ballById = new Map(), lootById = new Map(), kegById = new Map(), slamById = new Map();
function track(o, keys, v, fresh) { o._a = fresh ? v : keys.map((k) => o[k]); o._b = v; }
function mix(o, keys, a) {
  keys.forEach((k, i) => {
    const d = o._b[i] - o._a[i];
    o[k] = o._a[i] + (k === 'h' ? Math.atan2(Math.sin(d), Math.cos(d)) : d) * a;
  });
}
function syncList(list, map, rows, keys, make) {
  const seen = new Set();
  for (const [id, ...v] of rows) {
    let o = map.get(id);
    const fresh = !o;
    if (fresh) { o = Object.assign(make(), { id }); map.set(id, o); list.push(o); }
    track(o, keys, v.slice(0, keys.length), fresh);
    if (fresh) mix(o, keys, 1);
    seen.add(o);
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    if (seen.has(o)) continue;
    if (o.mesh) scene.remove(o.mesh);
    map.delete(o.id);
    list.splice(i, 1);
  }
}
const nick = cleanName; // also cleans what a guest or host sends
function applySnap(m) {
  // glide over the gap the snapshots really arrive at (3 or 4 host frames, more on a slow link), not a fixed 50 ms
  const now = performance.now();
  snapGap = Math.max(SNAP_DT * 1000, Math.min(200, now - snapAt));
  snapAt = now;
  const seen = new Set();
  for (const row of m.s) {
    const d = {};
    SF.forEach((k, i) => (d[k] = row[i]));
    let s = byId.get(d.id);
    const fresh = !s;
    if (fresh) {
      s = addShip(d.type, d.livery, d.team, d.x, d.z, d.h, d.sail, Object.assign(makeShip(d.type, d.team, d.x, d.z, d.h), { id: d.id, cannons: d.cannons }));
      byId.set(d.id, s);
    } else {
      if (s.cannons !== d.cannons) setGuns(s.mesh, d.cannons);
      if (s === me && d.hp < s.hp - 1) shake = Math.max(shake, 0.3);
    }
    track(s, SK, SK.map((k) => d[k]), fresh);
    for (const k of SF) if (!SK.includes(k)) s[k] = d[k];
    if (fresh) mix(s, SK, 1);
    s.isPlayer = d.pid !== null;
    seen.add(s);
  }
  for (let i = ships.length - 1; i >= 0; i--) {
    const s = ships[i];
    if (seen.has(s)) continue;
    scene.remove(s.mesh.root);
    s.bar?.remove();
    byId.delete(s.id);
    ships.splice(i, 1);
  }
  players.length = 0;
  for (const e of m.p) {
    const s = ships.find((o) => o.pid === e.pid);
    if (!s) continue;
    // host strings end up in innerHTML (scoreboard, cards, leaderboard): a guest never trusts them
    Object.assign(e, { tag: nick(e.tag) || 'P' + ((e.pid | 0) + 1), name: ui.esc(e.name), kills: +e.kills || 0,
      cards: (e.cards || []).map((c) => ({ id: String(c.id), label: ui.esc(c.label) })),
      skills: (e.skills || []).filter((k) => Object.hasOwn(SKILLS, k.id)).slice(0, 4).map((k) => ({ id: k.id, lvl: Math.max(1, Math.min(3, k.lvl | 0)) })),
      cd: e.cd || {}, reload: e.reload || { port: 0, star: 0 } }); // a bad value here would throw in hud() and stop the frame loop
    players.push(Object.assign(s, e));
  }
  me = players.find((p) => p.pid === myPid) || null;
  syncList(flying, ballById, m.b, BK, () => ({}));
  syncList(loot, lootById, m.l, LK, () => ({ mesh: barrelMesh(), seed: Math.random() * 6 }));
  syncList(kegs, kegById, m.k, KK, () => ({ mesh: kegMesh() }));
  syncList(slams, slamById, m.j || [], JK, () => ({ mesh: slamMesh(), r: SLAM.r }));
  (m.f || []).forEach(([hp, alive, aims], i) => {
    const fort = forts[i];
    if (!fort) return;
    if (fort.alive !== alive) {
      fortShow(fort, alive);
      if (!alive) shake = Math.max(shake, 0.5);
    }
    Object.assign(fort, { hp, alive });
    aims.forEach((a, j) => fort.turrets[j] && (fort.turrets[j].mesh.rotation.y = -a));
  });
  const g = m.g, was = state.mode;
  Object.assign(state, { mode: g.mode, wave: +g.wave || 0, gold: +g.gold || 0, delivered: +g.delivered || 0, t: g.t, left: g.left });
  [combo.n, combo.t] = g.combo;
  combo.best = Math.max(combo.best, combo.n);
  if (g.banner && g.banner !== lastBanner) banner(g.banner, g.bt);
  lastBanner = g.banner;
  if (was !== state.mode && state.mode === 'fight') sfx.bell();
  if (was !== state.mode && (state.mode === 'lull' || state.mode === 'over')) sfx.fanfare();
  if (was !== state.mode && state.mode === 'over') pvpOver();
  if (was === 'over' && state.mode === 'pvp' && ui.top() === 'pvpover') ui.reset(); // the host started a rematch
  setCombat(state.mode === 'fight' || state.mode === 'pvp');
  // one-shot effects the host recorded; sounds are placed relative to this guest's ship
  for (const [k, ...a] of m.e) {
    if (k === 'sfx') sound(...a);
    else if (k !== 'pop') fx[k](...a);
    else {
      popup(...a);
      if (a[3] === 'combo') comboFeel(a[0], a[1]);
      else if (String(a[2]).startsWith('+') && nearestPlayer({ x: a[0], z: a[1] }) === me) sfx.coin(); // our own haul only
    }
  }
}
function sendInput() {
  const inp = localInput(), sig = JSON.stringify(inp);
  if (sig !== lastIn) { lastIn = sig; room.send({ t: 'in', ...inp }); }
}
function guestStep(dt) {
  time += dt;
  if (state.banner > 0) state.banner -= dt;
  if (guestShip !== null) sendInput();
  // the host pings even with its tab hidden, so the link stays up while the game stalls: say so
  if (guestShip !== null && !hostGone && performance.now() - snapAt > 1500) banner('WAITING FOR THE HOST…', 0.5);
  const a = Math.min(1, (performance.now() - snapAt) / snapGap);
  for (const s of ships) { if (s._b) mix(s, SK, a); syncShip(s, time, dt); }
  for (const b of flying) mix(b, BK, a);
  drawBalls();
  for (const o of loot) { mix(o, LK, a); bobLoot(o); }
  for (const k of kegs) { mix(k, KK, a); k.mesh.position.set(k.x, 0.2 + Math.sin(time * 2 + k.id) * 0.1, k.z); }
  for (const sl of slams) { mix(sl, JK, a); drawSlam(sl); }
  for (const fort of forts) if (!fort.alive && Math.random() < 0.4) fx.burn(fort.x + (Math.random() - 0.5) * fort.len, 5.5, fort.z + (Math.random() - 0.5) * fort.len);
  for (const p of players) if (p.smokeT > 0 && Math.random() < 0.5) fx.cloud(p.x, p.z);
  if (state.mode === 'dead' && me) gameOver();
  fx.update(dt);
  sea.uTime.value = time;
  wakes.update(dt);
  updateCamera(dt, false);
  hud();
}

// --- online: the hub and the lobby (screens.js `online`, `lobby`), then the run ---------------------------------
// lobby: { code, quick, mode: 'waves' | 'convoy' | 'pvp', countdown, started, players: [{ pid, name, ship, ready, last }] }.
// The host owns it and sends it whole ({ t: 'lobby' }) on every change; a guest sends its own line ({ t: 'me', nick, ship, ready, last }).
// No ship exists before the start: on SET SAIL (or the quick-match clock) the host builds them all, and the run goes on as before.
// A pirate who joins a private room after the start still gets the lobby: READY drops their ship in.
let lobby = null, hostGone = false;
let busy = '', codeErr = ''; // the hub: the button that is waiting on the network, the message under the room code
const LOBBY_MODES = ['waves', 'convoy', 'pvp'];
const shipIdx = (v) => ([0, 1, 2].includes(v) ? v : null);
const lastIdx = () => SHIPS.indexOf(store.lastShip);
const hub = () => { if (ui.top() === 'online') ui.refresh(); };
const noPeer = () => typeof Peer === 'undefined' && (ui.toast('error', 'ONLINE UNAVAILABLE · SOLO STILL WORKS'), hub(), true);
function online(what) {
  if (net !== 'solo' || state.mode !== 'select' || noPeer()) return false;
  busy = what;
  codeErr = '';
  hub();
  return true;
}
// back to solo, in the hub. msg: why, as a message
function offline(msg, kind = 'error') {
  room?.close(); // or the abandoned Peer keeps calling back into the next attempt
  for (const s of PREVIEW) if (!ships.includes(s)) ships.push(s); // hostGame took them out of the sim
  clearInterval(quickBeat);
  net = 'solo'; mode = 'coop'; room = null; myPid = 0; roomOpen = false; quick = quickAt = null; quickTries = 0; lobby = null; busy = '';
  ui.clearToasts();
  if (ui.top() === 'lobby') ui.reset('menu', 'online'); else hub();
  if (msg) ui.toast(kind, msg, 5000);
}
// quick match: the server hands out a room code to host or to join. q: its queue, 'coop-waves' | 'coop-convoy' | 'pvp'
function quickGame(q, skip = '', tries = 0) {
  if (net !== 'solo' || state.mode !== 'select' || noPeer()) return;
  quick = q; // offline() clears it: an answer that comes back after the player gave up is dropped
  busy = 'q-' + q;
  ui.toast('wait', 'SEARCHING…', 0);
  hub();
  match(q, skip && `&skip=${skip}`).catch(() => null).then((r) => { // only the lookup is caught: a bug in hostGame / joinGame must reach the console
    if (quick !== q || net !== 'solo') return;
    if (r?.retry) return setTimeout(() => quick === q && net === 'solo' && quickGame(q, '', tries), 1000); // a room is opening: join it once its host is reachable
    const code = r?.host || r?.join;
    if (!/^[A-Z]{4}$/.test(code)) return offline('MATCHMAKING UNREACHABLE'); // no answer, an old service build, or not our service: the code reaches innerHTML
    quickTries = tries;
    if (r.host) hostGame(q === 'pvp' ? 'pvp' : q.slice(5), code); else joinGame(code);
  });
}
// a quick room that could not be hosted or joined: ask again, telling the server to drop that one
function retryQuick(skip) {
  const q = quick, n = quickTries + 1;
  offline(n < 3 ? '' : 'NO MATCH FOUND · TRY AGAIN', 'warn');
  if (n < 3) quickGame(q, skip, n);
}
// waves or convoy: each has its map
function setConvoy(on) {
  if (convoy !== on) loadMap(on ? 'convoy' : 'waves');
  convoy = on;
}
// the lobby's mode (the host's choice; a guest applies the host's)
function setLobbyMode(m) {
  mode = m === 'pvp' ? 'pvp' : 'coop';
  setConvoy(m === 'convoy');
  if (!lobby || lobby.mode === m) return;
  lobby.mode = m;
  lobbySync();
}
function lobbySync() {
  if (net === 'host') room.broadcast({ t: 'lobby', ...lobby });
  if (ui.top() === 'lobby') ui.refresh();
}
const myLine = () => lobby?.players.find((p) => p.pid === myPid);
const sendMe = () => { const p = myLine(); room.send({ t: 'me', nick: store.name, ship: p?.ship ?? null, ready: !!p?.ready, last: lastIdx() }); };
// this browser's ship in the lobby. The host has no READY button: a ship picked is a ship ready
function lobbyPick(i) {
  const p = myLine();
  if (!p || (lobby.started && p.ready)) return;
  p.ship = i;
  if (net === 'host') { p.ready = true; lobbySync(); } else { sendMe(); ui.refresh(); }
}
function lobbyReady() {
  const p = myLine();
  if (!p || net !== 'guest' || (lobby.started && p.ready)) return;
  p.ready = !p.ready;
  p.ship ??= lastIdx(); // READY with no ship picked: the last one sailed
  sendMe();
  ui.refresh();
}
// host: every pirate gets a ship (the last one they sailed if they picked none), then the run starts
function lobbyStart() {
  if (net !== 'host' || !roomOpen || !lobby || lobby.started) return;
  lobby.started = true;
  lobby.countdown = null;
  for (const p of lobby.players) {
    p.ship ??= p.last;
    p.ready = true;
    if (p.pid === 0) choosePlayer(p.ship); else addPlayer(p.pid, p.ship, p.name);
  }
  ui.reset();
  lobbySync();
  sail();
}
// host: a guest's line. Guest input is untrusted: clamp it
function lobbyMe(pid, m) {
  let p = lobby.players.find((o) => o.pid === pid);
  if (p && lobby.started && p.ready) return; // at sea: a ship is not changed
  if (!p) { lobby.players.push(p = { pid }); lobby.players.sort((a, b) => a.pid - b.pid); }
  const ship = shipIdx(m.ship);
  Object.assign(p, { name: nick(m.nick) || 'P' + (pid + 1), ship, ready: !!m.ready && ship !== null, last: shipIdx(m.last) ?? 1 });
  if (lobby.started && p.ready) { addPlayer(pid, ship, p.name); p.ready = players.some((o) => o.pid === pid); } // a run under way: the ship drops in (not into a run that is over)
  lobbySync();
}
// guest: the host's lobby. Host strings end up in innerHTML: a guest never trusts them
function onLobby(m) {
  const was = lobby;
  const list = (Array.isArray(m.players) ? m.players : []).slice(0, MAX_PLAYERS).map((p) => ({ pid: p?.pid | 0, name: nick(p?.name) || 'P' + ((p?.pid | 0) + 1), ship: shipIdx(p?.ship), ready: !!p?.ready }));
  lobby = { code: /^[A-Z]{4}$/.test(m.code) ? m.code : '', quick: !!m.quick, mode: LOBBY_MODES.includes(m.mode) ? m.mode : 'waves', countdown: Number.isFinite(m.countdown) ? m.countdown | 0 : null, started: !!m.started, players: list };
  for (const p of was?.players || []) if (!list.some((o) => o.pid === p.pid)) ui.toast('warn', `${p.name} LEFT`);
  if (guestShip !== null) return; // at sea already
  setLobbyMode(lobby.mode);
  const p = myLine();
  if (lobby.started && p?.ready && p.ship !== null) { // the host built our ship: snapshots bring it
    guestShip = p.ship;
    store.lastShip = SHIPS[p.ship];
    me = null;
    hideSelect();
    return ui.reset();
  }
  if (was) return void (ui.top() === 'lobby' && ui.refresh());
  busy = '';
  ui.clearToasts();
  ui.reset('menu', 'online', 'lobby');
  ui.toast('ok', `JOINED ${lobby.mode === 'pvp' ? 'PVP' : 'CO-OP'} · PICK YOUR SHIP`);
}
// m: the lobby's mode at first (the host changes it inside a private room). code: a quick-match room's, handed out by the server
function hostGame(m, code) {
  if (!online(quick ? 'q-' + quick : 'create')) return;
  net = 'host';
  hostTicker();
  setLobbyMode(m);
  for (const s of PREVIEW) if (ships.includes(s)) ships.splice(ships.indexOf(s), 1); // still on screen, but out of the sim until the start
  ui.toast('wait', 'OPENING ROOM…', 0);
  room = hostRoom({
    open: (code) => {
      roomOpen = true;
      if (!lobby) { // 'open' fires again after a signalling reconnect
        lobby = { code, quick: !!quick, mode: m, countdown: null, started: false, players: [{ pid: 0, name: store.name, ship: null, ready: false, last: lastIdx() }] };
        busy = '';
        ui.clearToasts();
        ui.reset('menu', 'online', 'lobby');
      }
      if (!quick) return;
      clearInterval(quickBeat);
      quickBeat = setInterval(quickBeatNow, 10000);
      quickBeatNow();
    },
    join: (pid) => {
      room.send(pid, { t: 'hi', pid });
      if (document.hidden) { document.title = 'A PIRATE JOINED · COME BACK'; sfx.bell(); } // the game goes on without its host's eyes (hostTicker), but not without its ship
    },
    msg: (pid, msg) => {
      if (msg.t === 'me') return lobbyMe(pid, msg);
      const p = players.find((o) => o.pid === pid);
      if (p) act(p, msg);
    },
    leave: (pid) => {
      const l = lobby.players.find((o) => o.pid === pid);
      if (l) { lobby.players.splice(lobby.players.indexOf(l), 1); ui.toast('warn', `${l.name} LEFT`); lobbySync(); } // guests read it off the lobby
      const p = players.find((o) => o.pid === pid);
      if (!p) return;
      players.splice(players.indexOf(p), 1);
      Object.assign(p, { wrecked: true, isPlayer: false, pid: null }); // their ship goes down and is cleared like any wreck
      damage(p, 1e9);
    },
    error: (e) => {
      if (roomOpen) return;
      if (quick && e.type === 'unavailable-id') return retryQuick(code); // the code is someone's private room
      offline('COULD NOT OPEN A ROOM');
    },
  }, code);
}
function joinGame(code) {
  if (!/^[A-Z]{4}$/.test(code)) { codeErr = 'ENTER THE 4-LETTER ROOM CODE.'; return hub(); }
  if (!online(quick ? 'q-' + quick : 'join')) return;
  net = 'guest';
  hostGone = false;
  ui.toast('wait', 'CONNECTING…', 0);
  room = joinRoom(code, {
    open: () => {},
    msg: (m) => {
      if (m.t === 'hi') { myPid = m.pid | 0; room.send({ t: 'me', nick: store.name, ship: null, ready: false, last: lastIdx() }); }
      else if (m.t === 'lobby') { if (myPid) onLobby(m); }
      else if (m.s && guestShip !== null) applySnap(m);
    },
    close: () => {
      if (!myPid) return quick ? retryQuick(code) : offline('ROOM FULL, CLOSED OR UNREACHABLE');
      hostGone = true;
      if (guestShip === null) { // in the lobby
        const cap = lobby?.players[0]?.name || 'THE CAPTAIN';
        offline();
        ui.modal({ title: 'HOST LEFT', text: `${cap} LEFT THE ROOM. THE CREW IS DISBANDED.`, buttons: [{ label: 'FIND A NEW CREW', cancel: true }, { label: 'MAIN MENU', run: () => ui.reset('menu') }] });
        return;
      }
      if (state.mode === 'dead') { state.t = Math.max(state.t, 3.1); return; } // run over: the end screen stays, the run is signed
      ui.toast('error', 'HOST LEFT', 3000);
      setTimeout(() => reboot('online'), 3000);
    },
    error: (e) => {
      if (myPid) return;
      if (quick) return retryQuick(code);
      offline();
      if (e.type === 'peer-unavailable') { codeErr = 'ROOM NOT FOUND. CHECK THE CODE WITH YOUR CAPTAIN.'; return hub(); }
      ui.modal({ title: 'CONNECTION FAILED', text: 'THE ROOM CAN NOT BE REACHED.', buttons: [{ label: 'RETRY', run: () => joinGame(code) }, { label: 'MAIN MENU', cancel: true, run: () => ui.reset('menu') }] });
    },
  });
}
// PvP: the match is over (host: decided here; guest: read off a snapshot). The host can start another
function pvpOver() {
  if (!me) return;
  held.clear();
  const rows = [...players].sort((a, b) => b.kills - a.kills).map((p) => ({ name: p.tag, ship: String(p.name).toUpperCase(), kills: p.kills, you: p === me }));
  ui.open('pvpover', { rows, won: rows[0].you, host: net === 'host', captain: lobby?.players[0]?.name || 'THE CAPTAIN' });
}
// a ship's picture for the lobby's seats: the scene drawn small with her alone, once
const thumbs = [];
function thumb(i) {
  const s = PREVIEW[i];
  if (thumbs[i] || !s.mesh.root.parent) return thumbs[i] || '';
  const keep = [viewH, ...PREVIEW.map((p) => p.mesh.root.visible)];
  PREVIEW.forEach((p) => (p.mesh.root.visible = p === s));
  [iw, ih, viewH] = [100, 70, 16];
  post.setSize(iw, ih);
  setProjection();
  camera.position.set(s.x, 3, s.z).addScaledVector(camDir, 200);
  post.render(scene, camera);
  thumbs[i] = canvas.toDataURL();
  PREVIEW.forEach((p, k) => (p.mesh.root.visible = keep[k + 1]));
  viewH = keep[0];
  resize(); // the real size again; the next frame redraws it
  return thumbs[i];
}

// --- menus (ui.js, screens.js): what the game lends them -----------------------------
initScreens({
  ships: PREVIEW.map((s, i) => ({ name: s.name.toUpperCase(), blurb: PLAYER_SHIPS[i].blurb.toUpperCase(),
    gauges: shipStats(s).map(([, v]) => Math.round(v * 10)), skills: s.skills.map((k) => ({ name: SKILLS[k.id].name.toUpperCase(), icon: ICON[k.id] })) })),
  unlock, setAudio, rekey,
  keys: () => keys,
  muteLabel: () => ui.keyLabel(keys.mute),
  testFx: () => sfx.boom(1, 0),
  pauseAudio: (on) => paused && setPaused(on), // settings opened from the pause: sound is back while it is open
  setMode: (m) => setConvoy(m === 'convoy'), // its map shows behind the ship screen
  // online: the hub's state, its three ways in, and the lobby
  hub: () => ({ off: typeof Peer === 'undefined', busy, err: codeErr }),
  quick: quickGame, create: () => hostGame(store.lastMode), join: joinGame, leave: () => offline(),
  lobby: () => lobby && { ...lobby, me: myPid, host: net === 'host' },
  lobbyMode: (m) => net === 'host' && !lobby.quick && !lobby.started && setLobbyMode(m),
  lobbyPick, lobbyReady, lobbyStart, thumb,
  rematch() { ui.reset(); sail(); },
  startSolo,
  resume, reboot,
  // a world board's rows. A service from before names has one board per game, crews and solo runs mixed, in the old shape
  world: (b) => worldScores(b).catch((e) => (b.endsWith('-crew') ? worldScores(b.replace('-crew', '')) : Promise.reject(e)))
    .then((r) => r.top.map(normRow).filter((row) => row && (row.crew.length > 1) === b.endsWith('-crew'))),
  pauseKeys: () => [ui.keyLabel(keys.pause), 'ESC'],
  isPause: (code) => actionAt(code) === 'pause',
});
function startSolo(m, i) { setConvoy(m === 'convoy'); ui.reset(); choosePlayer(i); }
ui.setOnChange(() => { document.body.classList.toggle('menus', ui.active()); rekey(); }); // rekey: labels follow the keyboard layout once the browser tells it
ui.setOnKey((e) => { if (actionFor(e) === 'mute') toggleMute(); }); // the mute key works on every screen
setAudio(store.audio);
rekey();
// broadside.boot: a reload asked for by the menus (a run starts from a fresh page) says where to land
let boot = null;
try { boot = sessionStorage.getItem('broadside.boot'); sessionStorage.removeItem('broadside.boot'); } catch {}
if (!store.name || !boot) ui.open('title');
else if (boot === 'sail') startSolo(store.lastMode, SHIPS.indexOf(store.lastShip)); // SAIL AGAIN: same mode, same ship
else if (boot === 'ship') ui.reset('menu', 'solo-mode', 'ship');
else if (boot === 'online') ui.reset('menu', 'online');
else ui.reset('menu');
updateCamera(0, true);
// headless hooks: advance the sim deterministically without waiting for rAF
window.__game = {
  ui, get player() { return me; }, players, ships, state, sfx, fire: (side) => fire(me, side), choose: choosePlayer, board: () => tryBoard(me), press: () => boardPress(), cast: (i) => castSkill(me, i), pick: (i) => choose(me, i), kegs, slams, spawnKraken, get forts() { return forts; }, setConvoy, combo, scores: () => store.best, zoom: () => (overview = !overview), camera,
  killWave: () => (state.queue = []) && ships.filter((o) => o.team === 1).forEach((o) => damage(o, 1e9)),
  startWave,
  advance(sec) { for (let t = 0; t < sec; t += 1 / 60) step(1 / 60); post.render(scene, camera); },
  info: () => ({ iw, ih, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
};
requestAnimationFrame(frame);
