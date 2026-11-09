import * as THREE from 'three';
import { PixelPost } from './post.js';
import { createSea } from './water.js';
import { buildShip, setGuns } from './ships.js';
import { createWorld } from './world.js';
import { createWakes, createFx } from './fx.js';
import { sfx, unlock, toggleMute, setPaused, setCombat } from './sfx.js';
import { hostRoom, joinRoom, MAX_PLAYERS } from './net.js';
// loudness + stereo pan of a world point relative to the local player (screen-right = (dx - dz)/√2)
function ear(x, z) {
  const p = me || { x: 6, z: 6 }, dx = x - p.x, dz = z - p.z;
  return [Math.max(0, 1 - Math.hypot(dx, dz) / 110), (dx - dz) / Math.SQRT2 / 50];
}
import { createRadar } from './radar.js';
import { makeShip, stepShip, fireBroadside, stepBall, collideShips, damage, aiSteer, makeTurret, fireTurret, waveSpec, fortActive, rollUpgrades, applyUpgrade, ISLANDS, ARENA, PLAYER_SHIPS, makePlayer, regenShip, SKILLS, skillCd, useSkill, stepKeg, makeFort, merchantSpec, makeMerchant, merchantSteer, crewMul, canBoard, startBoarding, boardRound, captureReward } from './sim.js';

const VIEW_H = 40; // world units visible vertically
const VIEW_FAR = 215; // overview (C): the whole ±ARENA diamond fits a 16:9 screen
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
const camDir = new THREE.Vector3(Math.cos(CAM_EL) * Math.cos(CAM_AZ), Math.sin(CAM_EL), Math.cos(CAM_EL) * Math.sin(CAM_AZ));
camera.position.copy(camDir).multiplyScalar(200);
camera.lookAt(0, 0, 0);
const camRight = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
const camUp = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
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
const world = createWorld(scene);
const wakes = createWakes(scene);
const fx = createFx(scene, wakes);

// --- multiplayer -------------------------------------------------------------
// net: 'solo' | 'host' (runs the sim, broadcasts snapshots) | 'guest' (sends input, renders snapshots).
// mode: 'coop' (waves) | 'pvp' (arena). The host records one-shot effects (hits, splashes, muzzle
// flashes, popups) as events for guests; everything else guests read from the snapshot itself.
let net = 'solo', mode = 'coop', room = null, myPid = 0;
const events = [];
for (const k of ['hit', 'splash', 'muzzle']) {
  const f = fx[k];
  fx[k] = (...a) => { f(...a); if (net === 'host') events.push([k, ...a]); };
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
const localInput = () => ({ turn: (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0), fireL: held.has('KeyQ'), fireR: held.has('KeyE') });
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

// fort cannons → turrets (positions from the meshes world.js built)
scene.updateMatrixWorld(true);
const turrets = world.forts.flatMap((f) => f.cannons.map((c) => {
  const p = c.getWorldPosition(new THREE.Vector3());
  return Object.assign(makeTurret(p.x, p.y + 0.4, p.z), { mesh: c });
}));
// one destructible fort: walls ±4.2·scale plus towers; razed it stays down for 3 waves
const fortW = world.forts[0];
const fort = fortW && makeFort(fortW.isl.x, fortW.isl.z, (4.2 * fortW.isl.r) / 13 + 1);
const fortFlag = fortW?.group.children.find((o) => o.geometry?.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop === 0.06);
function fortShow(on) {
  for (const t of turrets) t.mesh.visible = on;
  if (fortFlag) fortFlag.visible = on;
}
function fortDown() {
  fort.backAt = state.wave + 3;
  fort.upAt = time + 60; // PvP has no waves: rebuilt after a minute
  const gold = fort.gold * comboKill(fort.x, fort.z);
  state.gold += gold;
  popup(fort.x, fort.z, `+${gold}`);
  fortShow(false);
  for (let i = 0; i < 10; i++) fx.hit(fort.x + (Math.random() - 0.5) * fort.len, 5 + Math.random() * 2, fort.z + (Math.random() - 0.5) * fort.len);
  sfx.sink(...ear(fort.x, fort.z));
  sfx.boom(...ear(fort.x, fort.z));
  shake = Math.max(shake, 0.5);
  banner(`FORT DESTROYED · +${gold} GOLD`, 2.5);
}
function fortUp() {
  Object.assign(fort, { hp: fort.maxHp, alive: true });
  fortShow(true);
}

// game flow: fight → lull → pick (upgrade cards) → between → fight … | dead
const state = { mode: 'select', wave: 0, gold: 0, t: 0, banner: 0, bannerText: '', queue: [], nextAt: 0, merchants: [], left: 0 };

// input: physical key codes so AZERTY Z/Q/S/D and QWERTY W/A/S/D both work
const held = new Set();
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'Enter', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Backspace', 'KeyC']);
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') { // typing a room code; Escape hands the keys back to the game
    if (e.code === 'Enter') joinGame();
    if (e.code !== 'Escape') return;
    e.target.blur();
  }
  // Without this, Firefox's find-as-you-type swallows letter keys and opens its search bar.
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') return net === 'solo' && togglePause(); // online: the world never stops
  if (paused) return; // before unlock(): it resumes the audio context
  if (state.entry !== undefined) { // SUNK screen: typing initials, nothing else reacts (no mute, no reload)
    e.preventDefault();
    if (/^[a-z]$/i.test(e.key) && state.entry.length < 3) state.entry += e.key.toUpperCase(); // e.key: AZERTY-proof
    else if (e.code === 'Backspace') state.entry = state.entry.slice(0, -1);
    else if (e.code === 'Enter' && state.entry) return submitEntry();
    return showEntry();
  }
  unlock();
  if (state.boarding) { if (e.code === 'Space') boardPress(); return; } // paused: Space is the only input
  if (e.code === 'KeyC') overview = !overview; // same physical key on AZERTY
  if (e.key === 'm' || e.key === 'M') toggleMute(); // e.key: M sits on a different physical key in AZERTY
  held.add(e.code);
  // physical digit codes: AZERTY users don't need Shift
  const pick = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
  if (net === 'guest' ? guestShip === null : state.mode === 'select') {
    if (pick < 3 && (net !== 'guest' || myPid)) choosePlayer(pick); // guest: only once the host said hi
    return;
  }
  if ((state.mode === 'dead' && state.t > 3) && (e.code === 'Space' || e.code === 'Enter')) return location.reload();
  if (e.code === 'Enter' && net === 'host') return hostStart();
  const msg = e.code === 'Space' && state.mode !== 'pick' ? { t: 'board' }
    : e.code === 'KeyW' ? { t: 'sail', d: 1 } : e.code === 'KeyS' ? { t: 'sail', d: -1 }
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
  else if (m.t === 'board' && p.alive && state.mode !== 'select') tryBoard(p);
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
let paused = false;
function togglePause() {
  paused = !paused;
  held.clear(); // a key released while paused never sends keyup to the game
  $('pause').hidden = !paused;
  setPaused(paused);
}
addEventListener('blur', () => { // alt-tab: pause solo, release the keys online (their keyup goes to the other window)
  if (net === 'solo') return !paused && togglePause();
  held.clear();
  if (net === 'guest' && guestShip !== null) sendInput(); // now: a hidden tab runs no frames
});

addEventListener('keyup', (e) => {
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  held.delete(e.code);
});

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
  const p = me || { x: 6, z: 6, h: 0, speed: 0 }; // select screen: aim below the row so ships sit above the cards
  const want = overview ? new THREE.Vector3() : new THREE.Vector3(p.x + Math.cos(p.h) * p.speed * 0.9, 0, p.z + Math.sin(p.h) * p.speed * 0.9);
  const wantH = overview ? VIEW_FAR : VIEW_H;
  if (viewH !== wantH) {
    viewH = snapNow || Math.abs(wantH - viewH) < 0.05 ? wantH : viewH + (wantH - viewH) * (1 - Math.exp(-6 * dt));
    setProjection();
  }
  if (snapNow) camTarget.copy(want);
  else camTarget.lerp(want, 1 - Math.exp(-3 * dt));
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
  root.getObjectByName('foam').visible = s.alive; // back on when a co-op pirate respawns
  // fire on the deck once below half hull, or while fire shot burns
  if ((s.burnT > 0 || s.hp < s.maxHp * 0.5) && (s.alive || s.sinkT < 3) && Math.random() < (s.burnT > 0 ? 0.8 : 0.35 + 0.4 * (1 - s.hp / s.maxHp))) {
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
  root.getObjectByName('foam').scale.set(1 + s.speed * 0.02, 1, 1 + s.speed * 0.04);
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
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (hitstop > 0) hitstop -= dt;
  else if (net === 'guest') guestStep(dt);
  else if (!paused) step(dt); // still render: the frozen scene stays under the overlay
  post.render(scene, camera);
  if (++frames === 2) window.__ready = true;
  requestAnimationFrame(frame);
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
    const a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 20, lim = ARENA - 12;
    const x = Math.max(-lim, Math.min(lim, A.x + Math.cos(a) * r));
    const z = Math.max(-lim, Math.min(lim, A.z + Math.sin(a) * r));
    if (others.some((p) => Math.hypot(x - p.x, z - p.z) < 45)) continue;
    if (ISLANDS.some((I) => Math.hypot(x - I.x, z - I.z) < I.r + 10)) continue;
    if (ships.some((o) => o !== but && Math.hypot(x - o.x, z - o.z) < 16)) continue;
    return [x, z];
  }
  return [A.x > 0 ? -ARENA + 15 : ARENA - 15, 0];
}
// Merchant route: from a spawn point, past a pirate (±0.4 rad) to the far side of the arena.
function spawnMerchant(m) {
  const [x, z] = spawnPoint(), lim = ARENA - 12, P = anyAlive() || { x: 0, z: 0 };
  const a = Math.atan2(P.z - z, P.x - x) + (Math.random() < 0.5 ? -0.4 : 0.4);
  const r = Math.hypot(P.x - x, P.z - z) * 1.4 + 20;
  const dest = { x: Math.max(-lim, Math.min(lim, x + Math.cos(a) * r)), z: Math.max(-lim, Math.min(lim, z + Math.sin(a) * r)) };
  const h = Math.atan2(dest.z - z, dest.x - x);
  addShip(m.type, 'merchant', 2, x, z, h, 2, makeMerchant(m.type, x, z, h, m.armed, dest));
  if (m.escort) addShip('brig', 'navy', 1, x - Math.sin(h) * 9, z + Math.cos(h) * 9, h, 2);
  banner(m.escort ? 'CONVOY SIGHTED' : m.armed ? 'ARMED MERCHANT SIGHTED' : 'MERCHANT SIGHTED', 1.6);
}
function startWave(k) {
  state.wave = k;
  state.mode = 'fight';
  state.t = state.nextAt = 0;
  sfx.bell();
  state.queue = waveSpec(k, Math.random, 1 + 0.6 * (players.length - 1)); // ships join one at a time (flow), never the whole wave at once
  state.merchants = merchantSpec(k).map((m, i) => ({ ...m, at: 5 + i * 15 }));
  const rebuilt = fort && !fort.alive && k >= fort.backAt;
  if (rebuilt) fortUp();
  banner(rebuilt ? `WAVE ${k} · THE FORT IS REBUILT` : fortActive(k) && k === 3 ? `WAVE ${k} · THE FORT OPENS FIRE` : `WAVE ${k}`);
}
const statBars = (s) => [
  ['SPEED', s.maxSpeed / 14], ['HANDLING', s.turn / 1.4], ['HULL', s.maxHp / 150],
  ['GUNS', s.cannons / 6], ['RELOAD', 2.4 / s.reloadTime], ['CREW', s.maxCrew / 50],
].map(([k, v]) => `<span>${k}</span><div class="bar"><i style="width:${Math.round(v * 100)}%"></i></div>`).join('');
$('select-list').innerHTML = PREVIEW.map((s, i) =>
  `<div class="card"><kbd>${i + 1}</kbd><b>${s.name.toUpperCase()}</b><span class="blurb">${PLAYER_SHIPS[i].blurb}</span><div class="stats">${statBars(s)}</div>` +
  `<div class="kit">${s.skills.map((k) => `<img src="${ICON[k.id]}">${SKILLS[k.id].name}`).join('<br>')}</div></div>`).join('');
function makePirate(s, pid, pick) {
  return Object.assign(s, { isPlayer: true, pid, pick, tag: 'P' + (pid + 1), team: mode === 'pvp' ? 10 + pid : 0, input: { turn: 0, fireL: false, fireR: false }, cards: [], kills: 0 });
}
function hideSelect() {
  for (const s of PREVIEW) {
    if (s === me) continue;
    scene.remove(s.mesh.root);
    if (ships.includes(s)) ships.splice(ships.indexOf(s), 1);
  }
  $('select').hidden = true;
  document.body.classList.remove('selecting');
}
let guestShip = null;
function choosePlayer(i) {
  if (net === 'guest') { // the host builds our ship; snapshots bring it back
    guestShip = i;
    room.send({ t: 'ship', i });
    me = null;
    hideSelect();
    return;
  }
  me = makePirate(PREVIEW[i], 0, i);
  if (!ships.includes(me)) ships.push(me); // a host's previews wait outside the sim (hostGame)
  players.push(me);
  hideSelect();
  state.mode = 'between';
  state.t = state.nextAt = 0; // nextAt: a PvP room already ran its merchant timer during the host's select
  banner(me.name.toUpperCase() + ' SETS SAIL', 2, true);
}
// a guest picked a ship: co-op drops them beside a crewmate, PvP somewhere safe
function addPlayer(pid, i) {
  if (players.some((p) => p.pid === pid) || !PLAYER_SHIPS[i]) return;
  if (state.mode === 'dead') return banner('THIS RUN IS OVER', 3); // no ship: a latecomer must not sign a score for it
  const p = makePirate(makePlayer(i), pid, i);
  addShip(p.type, 'pirate', p.team, 0, 0, 0, 0, p);
  players.push(p);
  respawn(p, 1);
  banner(`${p.tag} JOINS · ${p.name.toUpperCase()}`, 2);
}
function respawn(p, hpFrac) {
  const a = mode === 'coop' && anyAlive(p);
  const r = Math.random() * Math.PI * 2; // random bearing: two respawns beside the same crewmate never share a spot
  const [x, z] = a ? [a.x + Math.cos(r) * 12, a.z + Math.sin(r) * 12] : spawnPoint(p);
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
// host only, online: Enter sets sail for wave 1 (co-op) or starts / restarts the PvP match
function hostStart() {
  if (mode === 'coop') { if (state.mode === 'between' && state.wave === 0) state.go = true; return; }
  if (state.mode === 'pvp' || !me) return;
  state.mode = 'pvp';
  state.left = 300;
  for (const k of kegs) scene.remove(k.mesh); // nothing fired or dropped last match scores in this one
  kegs.length = pending.length = flying.length = 0;
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
  if (mode === 'pvp') return pvpFlow(dt); // also while the host is still on ship select: guests are already duelling
  if (state.mode === 'select') return;
  if (!players.some((p) => p.alive) && state.mode !== 'dead') {
    state.mode = 'dead';
    state.t = 0;
    for (const p of players) p.cards = [];
  }
  if (state.mode === 'dead') return gameOver();
  if (state.mode === 'fight' && state.queue.length && state.t >= state.nextAt) {
    const [x, z] = spawnPoint(), P = nearestPlayer({ x, z });
    addShip(state.queue.shift(), 'navy', 1, x, z, Math.atan2(P.z - z, P.x - x), 3);
    state.nextAt += 7;
  }
  while (state.mode === 'fight' && state.merchants[0]?.at <= state.t) spawnMerchant(state.merchants.shift());
  if (state.mode === 'fight' && !state.queue.length && !ships.some((o) => o.team === 1 && o.alive)) {
    state.mode = 'lull';
    state.merchants = [];
    state.t = 0;
    for (const p of players) {
      if (!p.alive) respawn(p, 0.5); // co-op: sunk crewmates are back for the break
      p.repair = p.maxHp * 0.6; // patch up to 60% of the hull per break, a bit each frame
      p.crew = Math.min(p.maxCrew, p.crew + p.maxCrew * 0.3); // recruits between waves
    }
    banner('WAVE CLEARED · REPAIRS', 2);
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
// PvP: 'between' (warm-up until the host presses Enter) → 'pvp' → 'over' (Enter: rematch)
function pvpFlow(dt) {
  for (const p of players) {
    p.fix = regenShip(p, dt) > 0;
    if (p.alive) continue;
    p.respawnAt ??= time + 4;
    if (time >= p.respawnAt) respawn(p, 1);
  }
  if (state.t >= state.nextAt) { // merchants keep coming: loot to fight over
    state.nextAt = state.t + 25;
    if (ships.filter((o) => o.merchant && o.alive && !o.escaped).length < 2) spawnMerchant(merchantSpec(4)[0]);
  }
  if (fort && !fort.alive && time >= fort.upAt) fortUp();
  if (state.mode !== 'pvp') return;
  state.left -= dt;
  const [top, second] = [...players].sort((a, b) => b.kills - a.kills);
  if (!top) return;
  const tie = top.kills === second?.kills;
  if (tie && state.left <= 0 && state.left + dt > 0) banner('SUDDEN DEATH · NEXT SINKING WINS', 3);
  if ((state.left <= 0 || top.kills >= 10) && !tie) {
    state.mode = 'over';
    banner(`${top.tag} WINS · ${top.kills} SINKINGS`, 4);
    sfx.fanfare();
  }
}

// --- enemies + fort ---------------------------------------------------------
function updateEnemies(dt) {
  if (!players.length) return; // ship select: nobody to shoot at yet
  for (const s of ships) {
    if (s.team !== 1 || !s.alive) continue;
    const tgt = nearestPlayer(s), side = aiSteer(s, tgt);
    if (side && !(tgt.smokeT > 0)) fire(s, side); // smoke screen: they can't see you
  }
  for (const s of ships) {
    if (s.team !== 2 || !s.alive || s.escaped) continue;
    const r = merchantSteer(s, nearestPlayer(s), dt);
    if (r === 'escaped') { s.escaped = true; popup(s.x, s.z, 'ESCAPED'); }
    else if (r) fire(s, r);
  }
  if (!(fortActive(state.wave) || mode === 'pvp') || state.mode === 'dead' || !fort.alive) return;
  for (const t of turrets) {
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
  const [v, pan] = ear(k.x, k.z);
  sfx.splash(v * 0.6, pan);
}
function updateKegs(dt) {
  for (let i = kegs.length - 1; i >= 0; i--) {
    const k = kegs[i], ev = stepKeg(k, dt, ships);
    k.mesh.position.set(k.x, 0.2 + Math.sin(time * 2 + i) * 0.1, k.z);
    if (!ev) continue;
    if (ev === 'boom') {
      for (let j = 0; j < 3; j++) fx.hit(k.x + Math.random() * 2 - 1, 1, k.z + Math.random() * 2 - 1);
      fx.splash(k.x, k.z);
      const [v, pan] = ear(k.x, k.z);
      sfx.boom(v, pan);
      if (v > 0.6) shake = Math.max(shake, 0.4); // only blasts near our own ship
    }
    scene.remove(k.mesh);
    kegs.splice(i, 1);
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
    sfx.coin();
    shake = Math.max(shake, 0.2);
    if (net === 'solo') hitstop = 0.05 + 0.02 * mult; // online the world can't freeze
  }
  return mult;
}
// leaderboard: top 10 in this browser, ranked by wave then gold
const LB_KEY = 'broadside.scores';
const better = (a, b) => b.wave - a.wave || b.gold - a.gold;
function loadScores() { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch { return []; } }
function saveScores(list) { try { localStorage.setItem(LB_KEY, JSON.stringify(list)); } catch {} } // private window: the run just isn't kept
let run = null;
function gameOver() {
  if (state.t > 3 && $('over').hidden) { $('over').hidden = false; endRun(); }
}
function endRun() {
  const ship = players.length > 1 ? players.map((p) => p.name).join('+') : me.name; // online: the whole crew signs
  run = { ini: '', wave: state.wave, gold: state.gold, ship, combo: combo.best, date: Date.now() };
  const list = loadScores();
  if (list.length < 10 || better(run, list[list.length - 1]) < 0) { state.entry = ''; showEntry(); }
  else showBoard(list, -1);
}
function showEntry() {
  const ini = (state.entry + '___').slice(0, 3).split('').join(' ');
  $('over-stats').innerHTML = `Wave ${run.wave} · ${run.gold} gold<br>NEW HIGH SCORE! <b class="ini">${ini}</b><br><kbd>Enter</kbd> to sign`;
  $('over-help').hidden = true;
}
function submitEntry() {
  run.ini = state.entry;
  state.entry = undefined;
  const list = [...loadScores(), run].sort(better).slice(0, 10);
  saveScores(list);
  if (list[0] === run) sfx.fanfare();
  showBoard(list, list.indexOf(run));
}
function showBoard(list, mine) {
  const rows = list.map((s, i) => `<tr${i === mine ? ' class="me"' : ''}><td>${i + 1}</td><td>${s.ini}</td><td>${s.wave}</td><td>${s.gold}</td><td>×${s.combo}</td><td>${s.ship}</td></tr>`).join('');
  $('over-stats').innerHTML = `Wave ${run.wave} · ${run.gold} gold<table id="lb"><tr><th>#</th><th>NAME</th><th>WAVE</th><th>GOLD</th><th>COMBO</th><th>SHIP</th></tr>${rows}</table>`;
  $('over-help').hidden = false;
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
    sfx.boom(...ear(b.x, b.z));
    flying.push(b);
  }
  const targets = fort ? [...ships, fort] : ships;
  for (let i = flying.length - 1; i >= 0; i--) {
    const b = flying[i];
    const ev = stepBall(b, dt, targets);
    if (!ev) continue;
    flying.splice(i, 1);
    if (ev.hit) {
      fx.hit(b.x, ev.hit === fort ? 5.5 : Math.max(1, b.y), b.z);
      if (ev.hit === fort && !fort.alive) fortDown();
      sfx.hit(...ear(b.x, b.z));
      if (ev.hit === me) shake = Math.max(shake, 0.3);
    } else if (ev.land) {
      fx.hit(b.x, 1.5, b.z);
      const [v, pan] = ear(b.x, b.z);
      sfx.hit(v * 0.6, pan);
    } else {
      fx.splash(b.x, b.z);
      const [v, pan] = ear(b.x, b.z);
      sfx.splash(v * 0.7, pan);
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
    if (!s.alive && !s.wrecked) { s.wrecked = true; sfx.sink(...ear(s.x, s.z)); if (s.isPlayer) pirateSunk(s); else dropLoot(s, comboKill(s.x, s.z)); }
    // ponytail: every enemy wreck counts as the crew's kill (no killer tracking); navy never shoots merchants, so it holds
  }
  for (const r of collideShips(ships)) { fx.hit(r.x, 1.5, r.z); sfx.hit(...ear(r.x, r.z)); if (r.a === me || r.b === me) shake = Math.max(shake, 0.25); }
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
  if (fort && !fort.alive && Math.random() < 0.4) fx.burn(fort.x + (Math.random() - 0.5) * fort.len, 5.5, fort.z + (Math.random() - 0.5) * fort.len); // ruins smoulder
  for (const p of players) if (p.smokeT > 0 && Math.random() < 0.5) fx.cloud(p.x, p.z);
  updateBalls(dt);
  fx.update(dt);
  sea.uTime.value = time;
  wakes.update(dt);
  updateCamera(dt, false);
  hud();
  if (net === 'host' && (snapT += dt) >= SNAP_DT) { snapT = 0; if (room.guests()) room.broadcast(snap()); else events.length = 0; } // nobody listening: no snapshot
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
  if (net !== 'solo') {
    const n = players.length, wait = net === 'host' && (mode === 'coop' ? state.mode === 'between' && state.wave === 0 && !state.go : state.mode !== 'pvp');
    setHTML($('room'), (net === 'host' ? `ROOM <b>${room.code()}</b> · ${n}/${MAX_PLAYERS}` : `ONLINE · ${mode === 'pvp' ? 'PVP' : 'CO-OP'} · ${n} PIRATES`) +
      (wait && me ? `<br><kbd>Enter</kbd> ${mode === 'pvp' ? (state.mode === 'over' ? 'rematch' : 'start the match') : 'set sail'}` : ''));
  }
  if (!me) return;
  radar(me, ships, loot, fort && { x: fort.x, z: fort.z, active: (fortActive(state.wave) || mode === 'pvp') && fort.alive });
  $('coop').hidden = mode === 'pvp';
  $('pvp').hidden = mode !== 'pvp';
  if (mode === 'pvp') {
    const t = Math.max(0, Math.ceil(state.left));
    setHTML($('pvp'), [...players].sort((a, b) => b.kills - a.kills).map((p) => `${p === me ? '<b>' : ''}${p.tag} ${p.name.toUpperCase()} ${p.kills}${p === me ? '</b>' : ''}`).join('<br>') +
      (state.mode === 'pvp' ? `<br>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : ''));
  }
  $('gold').textContent = state.gold;
  $('wave').textContent = state.wave;
  $('combo').hidden = combo.n < 2;
  $('combo-n').textContent = '×' + Math.min(combo.n, 5);
  $('combo-t').style.width = (combo.t / COMBO_WIN) * 100 + '%';
  // hull bars above the mast tops: damaged enemies, plus every other pirate (with their tag)
  camera.updateMatrixWorld();
  const W = canvas.clientWidth, H = canvas.clientHeight;
  for (const s of fort ? [...ships, fort] : ships) {
    if (s === me || (s.team === 0 && !s.isPlayer)) { if (s.bar) s.bar.hidden = true; continue; } // a crewmate who left: no frozen bar
    if (!s.bar) {
      s.bar = document.createElement('div');
      s.bar.className = s.isPlayer ? (s.team === me.team ? 'ebar p' : 'ebar e') : s.merchant ? 'ebar m' : 'ebar';
      s.bar.dataset.tag = s.tag || '';
      s.bar.innerHTML = '<i></i>';
      $('bars').append(s.bar);
    }
    const show = s.alive && !s.escaped && (s.hp < s.maxHp || s.isPlayer);
    s.bar.hidden = !show;
    if (!show) continue;
    _p.set(s.x, s === fort ? 9 : s.len * 0.95, s.z).project(camera);
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
    $('board-hint').textContent = bt.hp < 0.2 * bt.maxHp ? 'SPACE · BOARD (AUTO)' : 'SPACE · BOARD';
    $('board-hint').style.transform = `translate(${Math.round(((_p.x + 1) / 2) * W)}px, ${Math.round(((1 - _p.y) / 2) * H) - 46}px) translateX(-50%)`;
  }
  // refit cards: each pirate picks their own
  const cards = me.cards || [], csig = cards.map((c) => c.id).join();
  if (csig !== cardSig) {
    cardSig = csig;
    $('cards-list').innerHTML = cards.map((c, i) => `<div class="card"><kbd>${i + 1}</kbd>${c.id.includes(':') ? `<img class="icon" src="${ICON[c.id.split(':')[1]]}">` : ''}<span>${c.label}</span></div>`).join('');
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
  const gold = r.gold * comboKill(e.x, e.z);
  state.gold += gold;
  p.crew += r.crew;
  p.hp += r.heal;
  p.boardCd = 2;
  popup(e.x, e.z, `+${gold}`);
  if (r.crew >= 1) popup(p.x, p.z, `+${r.crew} CREW`);
  e.wrecked = true; // plunder paid directly: no barrels on top
  damage(e, 1e9);
  sfx.sink(...ear(e.x, e.z));
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
        ? `<div class="slot"><img src="${ICON[k.id]}"><i class="cd"></i><kbd>${i + 1}</kbd><em>${'I'.repeat(k.lvl)}</em><span>${SKILLS[k.id].name}</span></div>`
        : `<div class="slot locked"><b>?</b><kbd>${i + 1}</kbd><span>locked</span></div>`;
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
    f: fort ? [fort.hp, fort.alive, turrets.map((t) => t.aim)] : null,
    g: { mode: state.mode, wave: state.wave, gold: state.gold, t: state.t, left: state.left, banner: state.banner > 0 ? state.bannerText : '', bt: state.banner, combo: [combo.n, combo.t] },
    e: events.splice(0),
  };
}

// Guests draw one snapshot interval behind: each value glides from where it is drawn now (_a) to the latest snapshot (_b).
const SK = ['x', 'z', 'h', 'speed', 'turnRate', 'sinkT'], BK = ['x', 'y', 'z'], LK = ['x', 'z', 'life'], KK = ['x', 'z'];
let snapAt = 0, lastBanner = '', lastIn = '';
const byId = new Map(), ballById = new Map(), lootById = new Map(), kegById = new Map();
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
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
function applySnap(m) {
  snapAt = performance.now();
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
      if (s.alive && !d.alive) sfx.sink(...ear(d.x, d.z));
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
    Object.assign(e, { tag: 'P' + ((e.pid | 0) + 1), name: esc(e.name), kills: +e.kills || 0,
      cards: (e.cards || []).map((c) => ({ id: String(c.id), label: esc(c.label) })),
      skills: (e.skills || []).filter((k) => SKILLS[k.id]).map((k) => ({ ...k, lvl: Math.min(9, k.lvl | 0) })) });
    players.push(Object.assign(s, e));
  }
  me = players.find((p) => p.pid === myPid) || null;
  syncList(flying, ballById, m.b, BK, () => ({}));
  syncList(loot, lootById, m.l, LK, () => ({ mesh: barrelMesh(), seed: Math.random() * 6 }));
  syncList(kegs, kegById, m.k, KK, () => ({ mesh: kegMesh() }));
  if (fort && m.f) {
    const [hp, alive, aims] = m.f;
    if (fort.alive !== alive) {
      fortShow(alive);
      if (!alive) { sfx.sink(...ear(fort.x, fort.z)); sfx.boom(...ear(fort.x, fort.z)); shake = Math.max(shake, 0.5); }
    }
    Object.assign(fort, { hp, alive });
    aims.forEach((a, i) => turrets[i] && (turrets[i].mesh.rotation.y = -a));
  }
  const g = m.g, was = state.mode;
  Object.assign(state, { mode: g.mode, wave: +g.wave || 0, gold: +g.gold || 0, t: g.t, left: g.left });
  [combo.n, combo.t] = g.combo;
  combo.best = Math.max(combo.best, combo.n);
  if (g.banner && g.banner !== lastBanner) banner(g.banner, g.bt);
  lastBanner = g.banner;
  if (was !== state.mode && state.mode === 'fight') sfx.bell();
  if (was !== state.mode && (state.mode === 'lull' || state.mode === 'over')) sfx.fanfare();
  setCombat(state.mode === 'fight' || state.mode === 'pvp');
  // one-shot effects the host recorded; sounds are placed relative to this guest's ship
  for (const [k, ...a] of m.e) {
    if (k === 'pop') { popup(...a); if (String(a[2]).startsWith('+') && nearestPlayer({ x: a[0], z: a[1] }) === me) sfx.coin(); continue; } // our own haul only
    fx[k](...a);
    const [v, pan] = ear(a[0], k === 'splash' ? a[1] : a[2]);
    if (k === 'muzzle') sfx.boom(v, pan); else if (k === 'hit') sfx.hit(v, pan); else sfx.splash(v * 0.7, pan);
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
  const a = Math.min(1, (performance.now() - snapAt) / (SNAP_DT * 1000));
  for (const s of ships) { if (s._b) mix(s, SK, a); syncShip(s, time, dt); }
  for (const b of flying) mix(b, BK, a);
  drawBalls();
  for (const o of loot) { mix(o, LK, a); bobLoot(o); }
  for (const k of kegs) { mix(k, KK, a); k.mesh.position.set(k.x, 0.2 + Math.sin(time * 2 + k.id) * 0.1, k.z); }
  if (fort && !fort.alive && Math.random() < 0.4) fx.burn(fort.x + (Math.random() - 0.5) * fort.len, 5.5, fort.z + (Math.random() - 0.5) * fort.len);
  for (const p of players) if (p.smokeT > 0 && Math.random() < 0.5) fx.cloud(p.x, p.z);
  if (state.mode === 'dead' && me) gameOver();
  fx.update(dt);
  sea.uTime.value = time;
  wakes.update(dt);
  updateCamera(dt, false);
  hud();
}

const lobbyMsg = (t) => ($('lobby-msg').textContent = t);
const lobbyLock = (on) => { for (const el of $('lobby').querySelectorAll('button, input')) el.disabled = on; };
function online() {
  if (net !== 'solo' || state.mode !== 'select') return false;
  if (typeof Peer === 'undefined') { lobbyMsg('ONLINE UNAVAILABLE (PeerJS did not load)'); return false; }
  if (paused) togglePause(); // paused on ship select (alt-tab for the code): online there is no Esc to clear it
  document.activeElement?.blur(); // a focused input, once disabled, keeps eating the keys (Firefox)
  lobbyLock(true);
  return true;
}
function offline(msg) {
  room?.close(); // or the abandoned Peer keeps calling back into the next attempt
  for (const s of PREVIEW) if (!ships.includes(s)) ships.push(s); // hostGame took them out of the sim
  net = 'solo'; mode = 'coop'; room = null; myPid = 0; lobbyLock(false); lobbyMsg(msg);
}
function hostGame(m) {
  if (!online()) return;
  net = 'host';
  mode = m;
  for (const s of PREVIEW) if (ships.includes(s)) ships.splice(ships.indexOf(s), 1); // still on screen, but no target for guests until one is picked
  lobbyMsg('OPENING ROOM…');
  let open = false;
  room = hostRoom({
    open: (code) => { open = true; lobbyMsg(`ROOM ${code} · give friends the code · keep this tab in front`); },
    join: (pid) => room.send(pid, { t: 'hi', pid, mode }),
    msg: (pid, msg) => {
      if (msg.t === 'ship') return addPlayer(pid, msg.i | 0);
      const p = players.find((o) => o.pid === pid);
      if (p) act(p, msg);
    },
    leave: (pid) => {
      const p = players.find((o) => o.pid === pid);
      if (!p) return;
      banner(`${p.tag} LEFT`, 2);
      players.splice(players.indexOf(p), 1);
      Object.assign(p, { wrecked: true, isPlayer: false, pid: null }); // their ship goes down and is cleared like any wreck
      damage(p, 1e9);
    },
    error: (e) => { if (!open) offline(`COULD NOT OPEN A ROOM (${e.type})`); },
  });
}
function joinGame() {
  const code = $('code').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) return lobbyMsg('ENTER THE 4-LETTER ROOM CODE');
  if (!online()) return;
  net = 'guest';
  lobbyMsg('CONNECTING…');
  room = joinRoom(code, {
    open: () => {},
    msg: (m) => {
      if (m.t === 'hi') { myPid = m.pid; mode = m.mode; lobbyMsg(`JOINED ${mode === 'pvp' ? 'PVP' : 'CO-OP'} · pick your ship: 1, 2 or 3`); }
      else if (m.s && guestShip !== null) applySnap(m);
    },
    close: () => {
      if (!myPid) return offline('ROOM FULL, CLOSED OR UNREACHABLE');
      banner('HOST LEFT', 3);
      if (state.mode === 'dead') { state.t = Math.max(state.t, 3.1); return; } // run over: let the guest sign the leaderboard and reload themselves
      setTimeout(() => location.reload(), 3000);
    },
    error: (e) => { if (!myPid) offline(e.type === 'peer-unavailable' ? 'ROOM NOT FOUND' : `CONNECTION FAILED (${e.type})`); },
  });
}
$('host-coop').onclick = (e) => { e.currentTarget.blur(); hostGame('coop'); };
$('host-pvp').onclick = (e) => { e.currentTarget.blur(); hostGame('pvp'); };
$('join').onclick = (e) => { e.currentTarget.blur(); joinGame(); };

updateCamera(0, true);
// headless hooks: advance the sim deterministically without waiting for rAF
window.__game = {
  get player() { return me; }, players, ships, state, fire: (side) => fire(me, side), choose: choosePlayer, board: () => tryBoard(me), press: () => boardPress(), cast: (i) => castSkill(me, i), pick: (i) => choose(me, i), kegs, fort, combo, scores: loadScores, zoom: () => (overview = !overview), camera,
  killWave: () => (state.queue = []) && ships.filter((o) => o.team === 1).forEach((o) => damage(o, 1e9)),
  startWave,
  advance(sec) { for (let t = 0; t < sec; t += 1 / 60) step(1 / 60); post.render(scene, camera); },
  info: () => ({ iw, ih, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
};
requestAnimationFrame(frame);
