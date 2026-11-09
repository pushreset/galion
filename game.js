import * as THREE from 'three';
import { PixelPost } from './post.js';
import { createSea } from './water.js';
import { buildShip, setGuns } from './ships.js';
import { createWorld } from './world.js';
import { createWakes, createFx } from './fx.js';
import { sfx, unlock, toggleMute, setPaused, setCombat } from './sfx.js';
// loudness + stereo pan of a world point relative to the player (screen-right = (dx - dz)/√2)
function ear(x, z) {
  const p = player || { x: 6, z: 6 }, dx = x - p.x, dz = z - p.z;
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

// ships: sim state + mesh
const ships = [];
function addShip(type, livery, team, x, z, h, sail = 0, s = makeShip(type, team, x, z, h)) {
  s.sail = sail;
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
let player = null;

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
function fortDown() {
  fort.backAt = state.wave + 3;
  const gold = fort.gold * comboKill(fort.x, fort.z);
  state.gold += gold;
  popup(fort.x, fort.z, `+${gold}`);
  for (const t of turrets) t.mesh.visible = false;
  if (fortFlag) fortFlag.visible = false;
  for (let i = 0; i < 10; i++) fx.hit(fort.x + (Math.random() - 0.5) * fort.len, 5 + Math.random() * 2, fort.z + (Math.random() - 0.5) * fort.len);
  sfx.sink(...ear(fort.x, fort.z));
  sfx.boom(...ear(fort.x, fort.z));
  shake = Math.max(shake, 0.5);
  banner(`FORT DESTROYED · +${gold} GOLD`, 2.5);
}
function fortUp() {
  Object.assign(fort, { hp: fort.maxHp, alive: true });
  for (const t of turrets) t.mesh.visible = true;
  if (fortFlag) fortFlag.visible = true;
}

// game flow: fight → lull → pick (upgrade cards) → between → fight … | dead
const state = { mode: 'select', wave: 0, gold: 0, t: 0, cards: [], banner: 0, repair: 0, queue: [], nextAt: 0, merchants: [] };

// input: physical key codes so AZERTY Z/Q/S/D and QWERTY W/A/S/D both work
const held = new Set();
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'Enter', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Backspace', 'KeyC']);
addEventListener('keydown', (e) => {
  // Without this, Firefox's find-as-you-type swallows letter keys and opens its search bar.
  if (GAME_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape') return togglePause();
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
  if (e.code === 'Space' && player?.alive && state.mode !== 'select' && state.mode !== 'pick') tryBoard();
  if (e.code === 'KeyC') overview = !overview; // same physical key on AZERTY
  if (e.key === 'm' || e.key === 'M') toggleMute(); // e.key: M sits on a different physical key in AZERTY
  held.add(e.code);
  if (player && e.code === 'KeyW') player.sail = Math.min(3, player.sail + 1);
  if (player && e.code === 'KeyS') player.sail = Math.max(0, player.sail - 1);
  // physical digit codes: AZERTY users don't need Shift
  const pick = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
  if (state.mode === 'select' && pick < 3) choosePlayer(pick);
  else if (state.mode === 'pick' && pick !== undefined) choose(pick);
  else if (pick !== undefined && player) castSkill(pick); // fight / between waves: skills
  if (state.mode === 'dead' && state.t > 3 && (e.code === 'Space' || e.code === 'Enter')) location.reload();
});
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
  if (balls.length && s === player) shake = Math.max(shake, 0.18);
}
// skills (sim.js useSkill): spawn what they return, plus sound/FX
function castSkill(slot) {
  const r = player.alive && useSkill(player, slot);
  if (!r) return;
  if (r.balls) { pending.push(...r.balls); shake = Math.max(shake, 0.35); }
  if (r.keg) dropKeg(r.keg);
  if (r.id === 'boost') sfx.splash(1, 0);
  if (r.id === 'chain' || r.id === 'fire' || r.id === 'brace' || r.id === 'repair') sfx.hit(0.5, 0);
  if (r.id === 'smoke') for (let i = 0; i < 25; i++) fx.cloud(player.x, player.z);
}
let paused = false;
function togglePause() {
  paused = !paused;
  held.clear(); // a key released while paused never sends keyup to the game
  $('pause').hidden = !paused;
  setPaused(paused);
}
addEventListener('blur', () => paused || togglePause()); // alt-tab mid-fight

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
  const p = player || { x: 6, z: 6, h: 0, speed: 0 }; // select screen: aim below the row so ships sit above the cards
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
    root.getObjectByName('foam').visible = false;
    if (Math.random() < 0.5) fx.bubble(s.x, s.z);
  }
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
  else if (!paused) step(dt); // still render: the frozen scene stays under the overlay
  post.render(scene, camera);
  if (++frames === 2) window.__ready = true;
  requestAnimationFrame(frame);
}
// --- waves -------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
function banner(text, dur = 2.5) {
  $('banner').textContent = text;
  state.banner = dur;
}
function spawnPoint() {
  for (let i = 0; i < 80; i++) {
    const a = Math.random() * Math.PI * 2, r = 55 + Math.random() * 20, lim = ARENA - 12;
    const x = Math.max(-lim, Math.min(lim, player.x + Math.cos(a) * r));
    const z = Math.max(-lim, Math.min(lim, player.z + Math.sin(a) * r));
    if (Math.hypot(x - player.x, z - player.z) < 45) continue;
    if (ISLANDS.some((I) => Math.hypot(x - I.x, z - I.z) < I.r + 10)) continue;
    if (ships.some((o) => Math.hypot(x - o.x, z - o.z) < 16)) continue;
    return [x, z];
  }
  return [player.x > 0 ? -ARENA + 15 : ARENA - 15, 0];
}
// Merchant route: from a spawn point, past the player (±0.4 rad) to the far side of the arena.
function spawnMerchant(m) {
  const [x, z] = spawnPoint(), lim = ARENA - 12;
  const a = Math.atan2(player.z - z, player.x - x) + (Math.random() < 0.5 ? -0.4 : 0.4);
  const r = Math.hypot(player.x - x, player.z - z) * 1.4 + 20;
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
  state.queue = waveSpec(k); // ships join one at a time (flow), never the whole wave at once
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
function choosePlayer(i) {
  player = PREVIEW[i];
  for (const s of PREVIEW) {
    if (s === player) continue;
    scene.remove(s.mesh.root);
    ships.splice(ships.indexOf(s), 1);
  }
  $('select').hidden = true;
  document.body.classList.remove('selecting');
  state.mode = 'between';
  state.t = 0;
  banner(player.name.toUpperCase() + ' SETS SAIL', 2);
}
function choose(i) {
  const c = state.cards[i];
  if (!c) return;
  applyUpgrade(player, c.id);
  if (c.id === 'cannons') setGuns(player.mesh, player.cannons);
  $('cards').hidden = true;
  state.mode = 'between';
  state.t = 0;
  banner(c.label.toUpperCase(), 1.6);
  sfx.coin();
}
function flow(dt) {
  state.t += dt;
  setCombat(state.mode === 'fight');
  if (state.banner > 0) state.banner -= dt;
  if (state.mode === 'select') return;
  if (!player.alive && state.mode !== 'dead') {
    state.mode = 'dead';
    state.t = 0;
    $('cards').hidden = true;
  }
  if (state.mode === 'dead') {
    if (state.t > 3 && $('over').hidden) { $('over').hidden = false; endRun(); }
    return;
  }
  if (state.mode === 'fight' && state.queue.length && state.t >= state.nextAt) {
    const [x, z] = spawnPoint();
    addShip(state.queue.shift(), 'navy', 1, x, z, Math.atan2(player.z - z, player.x - x), 3);
    state.nextAt += 7;
  }
  while (state.mode === 'fight' && state.merchants[0]?.at <= state.t) spawnMerchant(state.merchants.shift());
  if (state.mode === 'fight' && !state.queue.length && !ships.some((o) => o.team === 1 && o.alive)) {
    state.mode = 'lull';
    state.merchants = [];
    state.t = 0;
    state.repair = player.maxHp * 0.6; // patch up to 60% of the hull per break, a bit each frame
    player.crew = Math.min(player.maxCrew, player.crew + player.maxCrew * 0.3); // recruits between waves
    banner('WAVE CLEARED · REPAIRS', 2);
    sfx.fanfare();
  }
  const d = state.mode === 'fight' ? 0 : Math.min(state.repair, player.maxHp * 0.15 * dt, player.maxHp - player.hp);
  player.hp += d;
  state.repair -= d;
  const healed = regenShip(player, dt);
  $('hp').classList.toggle('fix', d + healed > 0);
  if (state.mode === 'lull' && state.t > 2.2) {
    state.mode = 'pick';
    state.cards = rollUpgrades(player);
    $('cards-list').innerHTML = state.cards.map((c, i) => `<div class="card"><kbd>${i + 1}</kbd>${c.id.includes(':') ? `<img class="icon" src="${ICON[c.id.split(':')[1]]}">` : ''}<span>${c.label}</span></div>`).join('');
    $('cards').hidden = false;
  }
  if (state.mode === 'between' && state.t > 2.5) startWave(state.wave + 1);
}

// --- enemies + fort ---------------------------------------------------------
function updateEnemies(dt) {
  for (const s of ships) {
    if (s.team !== 1 || !s.alive) continue;
    const side = aiSteer(s, player);
    if (side && !(player.smokeT > 0)) fire(s, side); // smoke screen: they can't see you
  }
  for (const s of ships) {
    if (s.team !== 2 || !s.alive || s.escaped) continue;
    const r = merchantSteer(s, player, dt);
    if (r === 'escaped') { s.escaped = true; popup(s.x, s.z, 'ESCAPED'); }
    else if (r) fire(s, r);
  }
  if (!fortActive(state.wave) || state.mode === 'dead' || !fort.alive) return;
  for (const t of turrets) {
    const b = fireTurret(t, player, dt);
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
function dropKeg(k) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(barrelGeo, bandMat));
  for (const y of [-0.3, 0.3]) { const b = new THREE.Mesh(bandGeo, kegBandMat); b.position.y = y; g.add(b); }
  g.traverse((o) => (o.castShadow = true));
  k.mesh = g;
  scene.add(g);
  kegs.push(k);
  sfx.splash(0.6, 0);
}
function updateKegs(dt) {
  for (let i = kegs.length - 1; i >= 0; i--) {
    const k = kegs[i], ev = stepKeg(k, dt, ships);
    k.mesh.position.set(k.x, 0.2 + Math.sin(time * 2 + i) * 0.1, k.z);
    if (!ev) continue;
    if (ev === 'boom') {
      for (let j = 0; j < 3; j++) fx.hit(k.x + Math.random() * 2 - 1, 1, k.z + Math.random() * 2 - 1);
      fx.splash(k.x, k.z);
      sfx.boom(...ear(k.x, k.z));
      shake = Math.max(shake, 0.4);
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
    const g = new THREE.Group();
    g.add(new THREE.Mesh(barrelGeo, barrelMat));
    for (const y of [-0.3, 0.3]) { const b = new THREE.Mesh(bandGeo, goldMat); b.position.y = y; g.add(b); }
    g.rotation.z = Math.PI / 2;
    g.traverse((o) => (o.castShadow = true));
    const a = Math.random() * 6.28;
    const o = { x: s.x + Math.cos(a) * 2, z: s.z + Math.sin(a) * 2, vx: Math.cos(a) * 2, vz: Math.sin(a) * 2, life: 40, value: Math.ceil((s.gold * mult) / n), mesh: g, seed: Math.random() * 6 };
    scene.add(g);
    loot.push(o);
  }
}
// floating "+N" text at a world point (gold pickups)
function popup(x, z, text, cls) {
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
    hitstop = 0.05 + 0.02 * mult;
  }
  return mult;
}
// leaderboard: top 10 in this browser, ranked by wave then gold
const LB_KEY = 'broadside.scores';
const better = (a, b) => b.wave - a.wave || b.gold - a.gold;
function loadScores() { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch { return []; } }
function saveScores(list) { try { localStorage.setItem(LB_KEY, JSON.stringify(list)); } catch {} } // private window: the run just isn't kept
let run = null;
function endRun() {
  run = { ini: '', wave: state.wave, gold: state.gold, ship: player.name, combo: combo.best, date: Date.now() };
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
    const dx = player.x - o.x, dz = player.z - o.z, d = Math.hypot(dx, dz);
    if (player.alive && d < 16) { o.x += (dx / d) * 12 * dt; o.z += (dz / d) * 12 * dt; }
    const got = player.alive && d < player.len * 0.45 + 2;
    if (got || o.life <= 0) {
      if (got) { state.gold += o.value; fx.splash(o.x, o.z); sfx.coin(); popup(o.x, o.z, `+${o.value}`); }
      scene.remove(o.mesh);
      loot.splice(i, 1);
      continue;
    }
    o.mesh.position.set(o.x, Math.sin(time * 2.2 + o.seed) * 0.12 + 0.05 - Math.max(0, 2 - o.life) * 0.5, o.z);
    o.mesh.rotation.y = o.seed + time * 0.3;
  }
}

const _m = new THREE.Matrix4();
function updateBalls(dt) {
  for (let i = pending.length - 1; i >= 0; i--) {
    const b = pending[i];
    if ((b.delay -= dt) > 0) continue;
    pending.splice(i, 1);
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
      if (ev.hit === player) shake = Math.max(shake, 0.3);
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
  ballMesh.count = Math.min(256, flying.length);
  for (let i = 0; i < ballMesh.count; i++) ballMesh.setMatrixAt(i, _m.makeTranslation(flying[i].x, flying[i].y, flying[i].z));
  ballMesh.instanceMatrix.needsUpdate = true;
}
function step(dt) {
  if (state.boarding) { updateBoarding(dt); hud(); return; } // boarding melee pauses the world
  time += dt;
  if (combo.t > 0 && (combo.t -= dt) <= 0) combo.n = 0;
  if (player?.alive) {
    player.turnIn = (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0);
    if (held.has('KeyQ')) fire(player, -1); // AZERTY A: port (left)
    if (held.has('KeyE')) fire(player, 1); // starboard (right)
  }
  flow(dt);
  updateEnemies(dt);
  for (const s of ships) {
    stepShip(s, dt);
    syncShip(s, time, dt);
    // flag, not a before/after check: balls, rams and kegs sink ships outside this loop
    if (!s.alive && !s.wrecked) { s.wrecked = true; sfx.sink(...ear(s.x, s.z)); if (s.team !== 0) dropLoot(s, comboKill(s.x, s.z)); }
    // ponytail: every enemy wreck counts as the player's kill (no killer tracking); navy never shoots merchants, so it holds
  }
  for (const r of collideShips(ships)) { fx.hit(r.x, 1.5, r.z); sfx.hit(...ear(r.x, r.z)); shake = Math.max(shake, 0.25); }
  // sunk enemies leave the scene (player's wreck stays under the camera)
  for (let i = ships.length - 1; i >= 0; i--) {
    const s = ships[i];
    if (s === player || !(s.escaped || (!s.alive && s.sinkT >= 7))) continue; // sunk, or merchant got away
    scene.remove(s.mesh.root);
    s.bar?.remove();
    ships.splice(i, 1);
  }
  updateLoot(dt);
  updateKegs(dt);
  if (fort && !fort.alive && Math.random() < 0.4) fx.burn(fort.x + (Math.random() - 0.5) * fort.len, 5.5, fort.z + (Math.random() - 0.5) * fort.len); // ruins smoulder
  if (player?.smokeT > 0 && Math.random() < 0.5) fx.cloud(player.x, player.z);
  updateBalls(dt);
  fx.update(dt);
  sea.uTime.value = time;
  wakes.update(dt);
  updateCamera(dt, false);
  hud();
}
const radar = createRadar($('radar'));
const _p = new THREE.Vector3();
function hud() {
  $('banner').hidden = state.banner <= 0 || !!state.boarding;
  if (!player) return;
  radar(player, ships, loot, fort && { x: fort.x, z: fort.z, active: fortActive(state.wave) && fort.alive });
  $('gold').textContent = state.gold;
  $('wave').textContent = state.wave;
  $('combo').hidden = combo.n < 2;
  $('combo-n').textContent = '×' + Math.min(combo.n, 5);
  $('combo-t').style.width = (combo.t / COMBO_WIN) * 100 + '%';
  $('banner').hidden = state.banner <= 0 || !!state.boarding;
  // enemy hull bars above the mast tops
  camera.updateMatrixWorld();
  const W = canvas.clientWidth, H = canvas.clientHeight;
  for (const s of fort ? [...ships, fort] : ships) {
    if (s.team === 0) continue;
    if (!s.bar) {
      s.bar = document.createElement('div');
      s.bar.className = s.merchant ? 'ebar m' : 'ebar';
      s.bar.innerHTML = '<i></i>';
      $('bars').append(s.bar);
    }
    const show = s.alive && !s.escaped && s.hp < s.maxHp;
    s.bar.hidden = !show;
    if (!show) continue;
    _p.set(s.x, s === fort ? 9 : s.len * 0.95, s.z).project(camera);
    s.bar.style.transform = `translate(${Math.round(((_p.x + 1) / 2) * W) - 24}px, ${Math.round(((1 - _p.y) / 2) * H) - 14}px)`;
    s.bar.firstChild.style.width = (s.hp / s.maxHp) * 100 + '%';
  }
  $('sail').style.width = (player.sail / 3) * 100 + '%';
  $('hp').style.width = (player.hp / player.maxHp) * 100 + '%';
  const rt = player.reloadTime * crewMul(player);
  $('rp').style.width = (1 - player.reload.port / rt) * 100 + '%';
  $('rs').style.width = (1 - player.reload.star / rt) * 100 + '%';
  $('crew').style.width = (player.crew / player.maxCrew) * 100 + '%';
  $('crewn').textContent = `${Math.ceil(player.crew)}/${player.maxCrew}`;
  // "Space: board" tag over the nearest ship close enough to grapple
  const bt = player.alive && !state.boarding && state.mode !== 'pick' ? boardTarget() : null;
  $('board-hint').hidden = !bt;
  if (bt) {
    _p.set(bt.x, bt.len * 0.95, bt.z).project(camera);
    $('board-hint').textContent = bt.hp < 0.2 * bt.maxHp ? 'SPACE · BOARD (AUTO)' : 'SPACE · BOARD';
    $('board-hint').style.transform = `translate(${Math.round(((_p.x + 1) / 2) * W)}px, ${Math.round(((1 - _p.y) / 2) * H) - 46}px) translateX(-50%)`;
  }
  skillHud();
}
// --- boarding (sim.js rules; here the timing-bar QTE, world paused) ---------------
function boardTarget() {
  let best = null, bd = Infinity;
  for (const s of ships) {
    const d = Math.hypot(s.x - player.x, s.z - player.z);
    if (canBoard(player, s) && d < bd) { bd = d; best = s; }
  }
  return best;
}
function tryBoard() {
  const e = boardTarget();
  if (!e) return;
  const b = startBoarding(player, e);
  if (b.auto) return capture(e, null);
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
  player.crew = Math.max(1, b.you);
  if (result === 'won') return capture(e, b);
  e.crew = Math.max(1, b.them);
  player.boardCd = 6;
  const dx = e.x - player.x, dz = e.z - player.z, d = Math.hypot(dx, dz) || 1;
  e.x += (dx / d) * 6; e.z += (dz / d) * 6; // cut loose
  banner('REPELLED', 1.5);
}
function capture(e, b) {
  const r = captureReward(player, e, b);
  const gold = r.gold * comboKill(e.x, e.z);
  state.gold += gold;
  player.crew += r.crew;
  player.hp += r.heal;
  player.boardCd = 2;
  popup(e.x, e.z, `+${gold}`);
  if (r.crew >= 1) popup(player.x, player.z, `+${r.crew} CREW`);
  e.wrecked = true; // plunder paid directly: no barrels on top
  damage(e, 1e9);
  sfx.sink(...ear(e.x, e.z));
  sfx.coin();
  banner(`${e.merchant ? 'MERCHANT' : 'SHIP'} CAPTURED${b ? '' : ' · STRUCK HER COLOURS'}`, 2);
}

// skill bar: rebuilt when skills change (learn / level up), cooldown overlay + armed border every frame
let skillSig = '';
function skillHud() {
  const sig = player.skills.map((k) => k.id + k.lvl).join();
  if (sig !== skillSig) {
    skillSig = sig;
    $('skills').innerHTML = [0, 1, 2, 3].map((i) => {
      const k = player.skills[i];
      return k
        ? `<div class="slot"><img src="${ICON[k.id]}"><i class="cd"></i><kbd>${i + 1}</kbd><em>${'I'.repeat(k.lvl)}</em><span>${SKILLS[k.id].name}</span></div>`
        : `<div class="slot locked"><b>?</b><kbd>${i + 1}</kbd><span>locked</span></div>`;
    }).join('');
  }
  player.skills.forEach((k, i) => {
    const el = $('skills').children[i];
    el.querySelector('.cd').style.height = ((player.cd[k.id] || 0) / skillCd(k.id, k.lvl)) * 100 + '%';
    el.classList.toggle('armed', player.ammo?.id === k.id);
  });
}
updateCamera(0, true);
// headless hooks: advance the sim deterministically without waiting for rAF
window.__game = {
  get player() { return player; }, ships, state, fire: (side) => fire(player, side), choose: choosePlayer, board: () => tryBoard(), press: () => boardPress(), cast: (i) => castSkill(i), kegs, fort, combo, scores: loadScores, zoom: () => (overview = !overview), camera,
  killWave: () => (state.queue = []) && ships.filter((o) => o.team === 1).forEach((o) => damage(o, 1e9)),
  startWave,
  advance(sec) { for (let t = 0; t < sec; t += 1 / 60) step(1 / 60); post.render(scene, camera); },
  info: () => ({ iw, ih, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }),
};
requestAnimationFrame(frame);
