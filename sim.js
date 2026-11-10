// Pure game logic, no three.js: runs in node for check.mjs.
// World plane is (x, z), y up. Heading h: forward = (cos h, sin h).
// Increasing h turns toward starboard; starboard = (-sin h, cos h), port = (sin h, -cos h).

export const BOUNDS = { x: 120, z: 120 }; // half-size of the playable rectangle (setMap)

export const TYPES = {
  galleon: { len: 14, beam: 4.2, hp: 120, speed: 8.5, turn: 0.62, cannons: 5, range: 34, reloadTime: 4.8, gold: 35, aimTol: 0.12, crew: 40 },
  brig: { len: 10.5, beam: 3.3, hp: 70, speed: 10, turn: 0.85, cannons: 3, range: 30, reloadTime: 4.2, gold: 20, aimTol: 0.16, crew: 24 },
  sloop: { len: 8, beam: 2.6, hp: 40, speed: 12, turn: 1.15, cannons: 2, range: 26, reloadTime: 3.6, gold: 10, aimTol: 0.2, crew: 14 },
  // team 3, allied to nobody: every ship can shoot it and it slams every ship. No guns (range/reload: its tentacles), no crew, no gold.
  kraken: { len: 10, beam: 8, hp: 400, speed: 3, turn: 0.6, cannons: 0, range: 40, reloadTime: 3, gold: 0, aimTol: 0, crew: 0 },
};

// Island outline: radius wobbles with angle. Shared by mesh (world.js), water shader
// shoreline (water.js) and collision so all three agree.
export function shoreR(isl, a) {
  return isl.r * (1 + 0.12 * Math.sin(3 * a + isl.ph) + 0.07 * Math.sin(5 * a + isl.ph * 1.7));
}

// waves: the open square (waves, PvP). convoy: a long channel between two ports, forts guarding the route.
// view: the overview zoom (game.js, C) that fits the whole map on a 16:9 screen.
// At most 8 islands per map (water.js shader). setMap swaps ISLANDS / BOUNDS in place, so importers stay valid.
export const MAPS = {
  waves: { x: 120, z: 120, view: 215, islands: [
    { x: -38, z: -26, r: 10, ph: 0.4, kind: 'rocky' },
    { x: 46, z: -48, r: 13, ph: 2.1, kind: 'fort' },
    { x: 30, z: 38, r: 7.5, ph: 4.0, kind: 'palm' },
    { x: -58, z: 52, r: 6.5, ph: 1.3, kind: 'palm' },
    { x: -8, z: 86, r: 5, ph: 5.2, kind: 'rocky' },
    { x: 82, z: 30, r: 6, ph: 3.3, kind: 'palm' },
    { x: -86, z: -70, r: 7, ph: 0.9, kind: 'rocky' },
  ] },
  convoy: { x: 200, z: 70, view: 260, islands: [
    { x: -188, z: 0, r: 12, ph: 0.7, kind: 'port', name: 'PORT ROYAL' },
    { x: 188, z: 0, r: 12, ph: 3.9, kind: 'port', name: 'TORTUGA' },
    { x: -125, z: -34, r: 12, ph: 2.1, kind: 'fort' },
    { x: -80, z: 34, r: 8, ph: 1.3, kind: 'palm' },
    { x: -38, z: -38, r: 9, ph: 0.4, kind: 'rocky' },
    { x: 40, z: 40, r: 12, ph: 5.0, kind: 'fort' },
    { x: 85, z: -32, r: 8, ph: 4.0, kind: 'palm' },
    { x: 130, z: 26, r: 9, ph: 0.9, kind: 'rocky' },
  ] },
};
export const ISLANDS = [...MAPS.waves.islands];
export let MAP = MAPS.waves;
export function setMap(name) {
  const m = MAP = MAPS[name];
  ISLANDS.splice(0, Infinity, ...m.islands);
  BOUNDS.x = m.x; BOUNDS.z = m.z;
}
// navy (1) and merchants (2) sail together: no friendly fire, no ram damage between them
const allied = (a, b) => a === b || (a === 1 && b === 2) || (a === 2 && b === 1);

export function makeShip(type, team, x = 0, z = 0, h = 0) {
  const t = TYPES[type];
  return {
    type, team, x, z, h,
    speed: 0, sail: 0, turnIn: 0, turnRate: 0,
    hp: t.hp, maxHp: t.hp,
    len: t.len, beam: t.beam,
    maxSpeed: t.speed, turn: t.turn, cannons: t.cannons, range: t.range,
    reload: { port: 0, star: 0 }, reloadTime: t.reloadTime, gold: t.gold, aimTol: t.aimTol, dmgMul: 1,
    regen: 0, calm: 0, crew: t.crew, maxCrew: t.crew, boardCd: 0,
    skills: [], learn: [], cd: {}, ammo: null,
    slowT: 0, burnT: 0, armorT: 0, boostT: 0, smokeT: 0, // status timers (s)
    alive: true, sinkT: 0,
  };
}

// Player picks one at start. Pirate refits out-reload every navy crew of the same hull.
export const PLAYER_SHIPS = [
  { type: 'sloop', name: 'Wasp', blurb: 'Fast and nimble, but fragile', skills: ['boost', 'keg'], learn: ['smoke', 'chain'], stats: { maxSpeed: 13.5, turn: 1.35, hp: 70, cannons: 3, range: 28, reloadTime: 2.4, crew: 24 } },
  { type: 'brig', name: 'Corsair', blurb: 'A balanced raider', skills: ['chain', 'fire'], learn: ['boost', 'repair'], stats: { maxSpeed: 11, turn: 0.95, hp: 100, cannons: 4, range: 32, reloadTime: 2.9, crew: 34 } },
  { type: 'galleon', name: 'Leviathan', blurb: 'A slow floating fortress', skills: ['nova', 'brace'], learn: ['fire', 'repair'], stats: { maxSpeed: 8.5, turn: 0.62, hp: 150, cannons: 6, range: 36, reloadTime: 3.6, crew: 50 } },
];
export function makePlayer(i, x = 0, z = 0, h = 0) {
  const { type, name, stats, skills, learn } = PLAYER_SHIPS[i];
  const { hp, crew, ...rest } = stats;
  return Object.assign(makeShip(type, 0, x, z, h), rest, {
    hp, maxHp: hp, crew, maxCrew: crew, name, regen: 0.012, skills: skills.map((id) => ({ id, lvl: 1 })), learn: [...learn],
  });
}

export const SAIL_LEVELS = [0, 0.38, 0.7, 1];

export function stepShip(s, dt) {
  if (!s.alive) {
    s.speed *= Math.max(0, 1 - dt);
    s.sinkT += dt;
    s.x += Math.cos(s.h) * s.speed * dt;
    s.z += Math.sin(s.h) * s.speed * dt;
    return;
  }
  for (const k of ['slowT', 'armorT', 'boostT', 'smokeT']) s[k] = Math.max(0, s[k] - dt);
  for (const id in s.cd) s.cd[id] = Math.max(0, s.cd[id] - dt);
  s.boardCd = Math.max(0, s.boardCd - dt);
  if (s.burnT > 0) { s.burnT = Math.max(0, s.burnT - dt); damage(s, BURN_DPS * dt); }
  const slow = s.slowT > 0, boost = s.boostT > 0;
  const target = SAIL_LEVELS[s.sail] * s.maxSpeed * (slow ? 0.45 : 1) * (boost ? 1.7 : 1);
  const acc = boost ? 5 : target > s.speed ? 1.6 : 2.6; // sails take a while to fill, drag bites faster
  s.speed += Math.sign(target - s.speed) * Math.min(Math.abs(target - s.speed), acc * dt);
  // Rudder needs water flow; keep a small floor so a becalmed ship can still swing.
  const authority = 0.3 + 0.7 * Math.min(1, s.speed / (0.5 * s.maxSpeed));
  const want = s.turnIn * s.turn * authority * (slow ? 0.6 : 1) * (boost ? 1.3 : 1);
  s.turnRate += (want - s.turnRate) * Math.min(1, 4 * dt);
  s.h += s.turnRate * dt;
  s.x += Math.cos(s.h) * s.speed * dt;
  s.z += Math.sin(s.h) * s.speed * dt;
  s.reload.port = Math.max(0, s.reload.port - dt);
  s.reload.star = Math.max(0, s.reload.star - dt);
  collide(s);
  if (!s.alive) s.burnT = 0;
}

// ponytail: ship = one circle, fine for ships that are rarely nose-on to a shore.
function collide(s) {
  const rad = s.len * 0.36;
  let hit = 0;
  for (const isl of ISLANDS) {
    const dx = s.x - isl.x, dz = s.z - isl.z;
    const d = Math.hypot(dx, dz);
    const lim = shoreR(isl, Math.atan2(dz, dx)) + rad;
    if (d < lim) {
      s.x = isl.x + (dx / d) * lim;
      s.z = isl.z + (dz / d) * lim;
      hit = Math.max(hit, s.speed);
    }
  }
  const lx = BOUNDS.x - rad, lz = BOUNDS.z - rad;
  if (Math.abs(s.x) > lx || Math.abs(s.z) > lz) {
    s.x = Math.max(-lx, Math.min(lx, s.x));
    s.z = Math.max(-lz, Math.min(lz, s.z));
    hit = Math.max(hit, s.speed);
  }
  if (hit) s.speed *= 0.5;
  return hit;
}

// --- combat ---------------------------------------------------------------
export const BALL = { speed: 26, g: 18, y0: 1.3, apex: 3.6, dmg: 9 };
// Every gun fires the same low arc (looks right, height no longer matters for hits); long guns shoot
// faster instead of lobbing higher. A 36-range lob used to sail over targets between 11 and 23 units.
const ARC_VY = Math.sqrt(2 * BALL.g * (BALL.apex - BALL.y0));
const ARC_T = (ARC_VY + Math.sqrt(ARC_VY ** 2 + 2 * BALL.g * BALL.y0)) / BALL.g;

// Short-handed guns reload slower: half the crew → +40% reload time.
export const crewMul = (s) => (s.maxCrew ? 1 + 0.8 * (1 - s.crew / s.maxCrew) : 1);

export function damage(s, d) {
  if (!s.alive) return;
  if (s.armorT > 0) d *= 0.4; // Brace
  if (s.maxCrew) s.crew = Math.max(1, s.crew - (Math.min(d, s.hp) / s.maxHp) * s.maxCrew * 0.6); // hits kill crew too
  s.hp = Math.max(0, s.hp - d);
  s.calm = 0;
  if (s.hp === 0) { s.alive = false; s.sail = 0; s.turnIn = 0; }
}

// side: +1 starboard, -1 port. Returns balls (empty if that side is reloading).
// Balls carry a small `delay` so a volley ripples bow→stern instead of one bang.
export function fireBroadside(s, side, rand = Math.random) {
  const key = side > 0 ? 'star' : 'port';
  if (!s.alive || s.reload[key] > 0) return [];
  s.reload[key] = s.reloadTime * crewMul(s);
  const c = Math.cos(s.h), sn = Math.sin(s.h);
  const ox = -sn * side, oz = c * side; // outward unit vector
  const speed = s.range / ARC_T;
  const balls = [];
  for (let k = 0; k < s.cannons; k++) {
    const u = s.cannons > 1 ? -0.42 + (0.82 * k) / (s.cannons - 1) : 0;
    const lx = (u * s.len) / 2, lz = (side * s.beam) / 2;
    const a = (rand() - 0.5) * 0.08;
    const dx = ox * Math.cos(a) - oz * Math.sin(a), dz = ox * Math.sin(a) + oz * Math.cos(a);
    balls.push(makeBall(s, s.x + c * lx - sn * lz, s.z + sn * lx + c * lz, dx, dz, speed * (0.94 + rand() * 0.12), (s.cannons - 1 - k) * 0.07 + rand() * 0.04));
  }
  if (s.ammo) { for (const b of balls) b.ammo = s.ammo; s.ammo = null; } // chain / fire shot armed by a skill
  return balls;
}
function makeBall(s, x, z, dx, dz, sp, delay) {
  return {
    x, y: BALL.y0, z, vx: dx * sp + Math.cos(s.h) * s.speed, vy: ARC_VY, vz: dz * sp + Math.sin(s.h) * s.speed,
    team: s.team, dmg: BALL.dmg * s.dmgMul, delay, ox: dx, oz: dz,
  };
}

// Returns { hit: ship } | { splash: true } | null.
export function stepBall(b, dt, ships) {
  b.vy -= BALL.g * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  // Height is cosmetic: any ball crossing a hull's footprint hits, so nothing ever sails over a ship.
  for (const s of ships) {
    if (!s.alive || allied(s.team, b.team)) continue;
    const dx = b.x - s.x, dz = b.z - s.z, c = Math.cos(s.h), sn = Math.sin(s.h);
    const lx = dx * c + dz * sn, lz = -dx * sn + dz * c;
    if (s.isl ? Math.hypot(dx, dz) < shoreR(s.isl, Math.atan2(dz, dx)) : Math.abs(lx) < s.len / 2 && Math.abs(lz) < s.beam * 0.6) { // a fort: its whole island
      s.lastHit = b.team; // kill credit (PvP)
      damage(s, b.dmg);
      if (b.ammo?.id === 'chain') s.slowT = Math.max(s.slowT, 3 * b.ammo.p);
      if (b.ammo?.id === 'fire') s.burnT = Math.max(s.burnT, 4 * b.ammo.p);
      return { hit: s };
    }
  }
  // islands stop balls (same footprint-only rule; a standing fort is tested above, over its island).
  // The fort's own side (navy) fires from / over the fort island, so it doesn't stop their balls.
  for (const isl of ISLANDS) {
    if (isl.kind === 'fort' && allied(b.team, 1)) continue;
    const dx = b.x - isl.x, dz = b.z - isl.z;
    if (Math.hypot(dx, dz) < shoreR(isl, Math.atan2(dz, dx))) return { land: true };
  }
  return b.y <= 0 ? { splash: true } : null;
}

// Ship-vs-ship: push apart, ram damage from closing speed. Returns rams for FX.
export function collideShips(ships) {
  const rams = [];
  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i], b = ships[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1e-3;
      const lim = (a.len + b.len) * 0.32;
      if (d >= lim) continue;
      const push = (lim - d) / 2, nx = dx / d, nz = dz / d;
      a.x -= nx * push; a.z -= nz * push;
      b.x += nx * push; b.z += nz * push;
      const closing = (Math.cos(a.h) * a.speed - Math.cos(b.h) * b.speed) * nx + (Math.sin(a.h) * a.speed - Math.sin(b.h) * b.speed) * nz;
      if (closing > 3 && !allied(a.team, b.team)) { // allies just bump
        a.lastHit = b.team; b.lastHit = a.team;
        damage(a, closing * 1.2);
        damage(b, closing * 1.2);
        a.speed *= 0.4; b.speed *= 0.4;
        rams.push({ x: a.x + nx * a.len * 0.3, z: a.z + nz * a.len * 0.3, a, b });
      }
    }
  }
  return rams;
}

// --- AI ---------------------------------------------------------------------
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Sets s.sail / s.turnIn. Returns the side to fire (+1 starboard, -1 port) or 0.
export function aiSteer(s, tgt) {
  if (!s.alive) return 0;
  if (!tgt.alive) { s.sail = 1; s.turnIn = 0; return 0; }
  const lead = Math.hypot(tgt.x - s.x, tgt.z - s.z) / BALL.speed;
  const tx = tgt.x + Math.cos(tgt.h) * tgt.speed * lead, tz = tgt.z + Math.sin(tgt.h) * tgt.speed * lead;
  const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
  const ang = Math.atan2(dz, dx);
  const bearing = wrap(ang - s.h);
  const R = s.range * (s.type === 'sloop' ? 0.75 : 0.6);
  let want;
  if (d > 1.4 * R) {
    want = ang;
    s.sail = 3;
  } else {
    // put the target abeam on whichever side it already is
    const side = bearing >= 0 ? 1 : -1;
    want = ang - side * Math.PI / 2;
    if (d < 0.7 * R) want -= side * 0.35;
    else if (d > R) want += side * 0.35;
    s.sail = 2;
  }
  steerTo(s, want);
  const off = Math.abs(Math.abs(bearing) - Math.PI / 2);
  return off < s.aimTol && d < s.range * 0.95 ? (bearing >= 0 ? 1 : -1) : 0;
}

// Turn toward heading `want`; a 14-unit look-ahead for islands and the arena edge overrides it.
function steerTo(s, want) {
  // probe along the wanted course (not the bow), so the detour holds until that course is clear
  const blocked = (isl, d) => {
    const ix = s.x + Math.cos(want) * d - isl.x, iz = s.z + Math.sin(want) * d - isl.z;
    return Math.hypot(ix, iz) < shoreR(isl, Math.atan2(iz, ix)) + 5;
  };
  for (const isl of ISLANDS) {
    if (blocked(isl, 7) || blocked(isl, 14)) {
      // skirt the shore: take the tangent closest to where we want to go, nudged outward
      const out = Math.atan2(s.z - isl.z, s.x - isl.x), dir = wrap(want - out) > 0 ? 1 : -1;
      want = out + dir * (Math.PI / 2 - 0.35);
      break;
    }
  }
  const px = s.x + Math.cos(s.h) * 14, pz = s.z + Math.sin(s.h) * 14;
  if (Math.abs(px) > BOUNDS.x - 8 || Math.abs(pz) > BOUNDS.z - 8) want = Math.atan2(-s.z, -s.x);
  s.turnIn = Math.max(-1, Math.min(1, wrap(want - s.h) * 2));
}

// Convoy escort, guard profile: holds a station abeam of its ward (s.station: + starboard, - port) and
// fights only a pirate within 45 of the ward or in its own gun range, so it never gets lured far. Returns a fire side or 0.
export function guardSteer(s, ward, tgt) {
  if (!s.alive) return 0;
  if (!ward || (tgt.alive && (Math.hypot(tgt.x - ward.x, tgt.z - ward.z) < 45 || Math.hypot(tgt.x - s.x, tgt.z - s.z) < s.range))) return aiSteer(s, tgt);
  const px = ward.x - Math.sin(ward.h) * s.station, pz = ward.z + Math.cos(ward.h) * s.station;
  const dx = px - s.x, dz = pz - s.z, c = Math.cos(ward.h), sn = Math.sin(ward.h);
  if (Math.hypot(dx, dz) > 25) { s.sail = 3; steerTo(s, Math.atan2(dz, dx)); return 0; } // catch up
  // alongside: sail the ward's course, nudged toward the station; trim sail to stay level (an escort is faster than its merchant)
  const along = dx * c + dz * sn, across = -dx * sn + dz * c;
  s.sail = along > 6 ? 3 : along > -2 ? 2 : 1;
  steerTo(s, ward.h + Math.max(-0.7, Math.min(0.7, across * 0.08)));
  return 0;
}

// --- merchants (team 2): flee the player, run for a far waypoint, rich loot -------
// Waves 2-3 one lone sloop, more and bigger later; armed from 5 (fight back once hit), galleon convoys with a navy escort from 6.
export function merchantSpec(k, rand = Math.random) {
  if (k < 2) return [];
  const n = Math.min(3, 1 + Math.floor((k - 2) / 2));
  return Array.from({ length: n }, () => {
    const type = k >= 6 && rand() < 0.4 ? 'galleon' : k >= 4 && rand() < 0.5 ? 'brig' : 'sloop';
    return { type, armed: k >= 5, escort: type === 'galleon' };
  });
}
// Convoy k (convoy mode): 2 merchants, one more every 3 convoys (max 5); brigs from 3, armed from 4, galleons from 5.
export function convoySpec(k, rand = Math.random) {
  return Array.from({ length: Math.min(5, 2 + Math.floor(k / 3)) }, () =>
    ({ type: k >= 5 && rand() < 0.4 ? 'galleon' : k >= 3 && rand() < 0.5 ? 'brig' : 'sloop', armed: k >= 4 }));
}
export function makeMerchant(type, x, z, h, armed, dest) {
  const s = makeShip(type, 2, x, z, h);
  const crew = Math.round(s.crew * 0.6); // sailors, not marines: easy to board
  return Object.assign(s, { merchant: true, armed, dest, age: 0, maxAge: 100, calm: 99, gold: s.gold * 3, maxSpeed: s.maxSpeed * 0.75, crew, maxCrew: crew });
}
// Returns 'escaped', a fire side (armed and hit in the last 6 s: fights like the navy), or 0.
export function merchantSteer(s, player, dt) {
  if (!s.alive) return 0;
  s.age += dt;
  s.calm += dt;
  if (Math.hypot(s.dest.x - s.x, s.dest.z - s.z) < 8 || s.age > s.maxAge) return 'escaped';
  if (s.armed && s.calm < 6 && player.alive) return aiSteer(s, player);
  let want = Math.atan2(s.dest.z - s.z, s.dest.x - s.x);
  s.sail = 2;
  const dx = s.x - player.x, dz = s.z - player.z;
  if (player.alive && Math.hypot(dx, dz) < 38) {
    const away = Math.atan2(dz, dx);
    want = away + wrap(want - away) * 0.3;
    s.sail = 3;
  }
  steerTo(s, want);
  return 0;
}

// --- kraken (team 3) -------------------------------------------------------------
// Drifts toward s.wander; closes in on the nearest ship within 70, player or not. Returns a slam or null.
export const SLAM = { t: 2.2, r: 3, dmg: 18 }; // tuned so a hard turn 0.3 s into the telegraph clears it in every player ship (check.mjs)
export function krakenSteer(s, ships, rand = Math.random) {
  if (!s.alive) return null;
  let tgt = null, bd = 70;
  for (const o of ships) {
    const d = Math.hypot(o.x - s.x, o.z - s.z);
    if (o !== s && o.alive && !o.escaped && o.team !== 3 && d < bd) { bd = d; tgt = o; }
  }
  // a point off every island (a point inside steerTo's shore margin can't be reached: the kraken would circle it forever)
  for (let i = 0; i < 20 && (!s.wander || Math.hypot(s.wander.x - s.x, s.wander.z - s.z) < 10 || ISLANDS.some((I) => Math.hypot(s.wander.x - I.x, s.wander.z - I.z) < I.r + 10)); i++)
    s.wander = { x: (rand() * 2 - 1) * (BOUNDS.x - 30), z: (rand() * 2 - 1) * (BOUNDS.z - 30) };
  const go = tgt && bd > 14 ? tgt : tgt ? null : s.wander; // close enough: hold and slam
  s.sail = go ? 3 : 0;
  if (go) steerTo(s, Math.atan2(go.z - s.z, go.x - s.x));
  else s.turnIn = 0;
  if (!tgt || bd > s.range || s.reload.port > 0) return null;
  s.reload.port = s.reloadTime;
  const lead = SLAM.t; // aim where the ship will be: holding course gets you hit, a hard turn dodges it
  return { x: tgt.x + Math.cos(tgt.h) * tgt.speed * lead, z: tgt.z + Math.sin(tgt.h) * tgt.speed * lead, t: SLAM.t, r: SLAM.r, dmg: SLAM.dmg };
}
// A tentacle rises (telegraph), then comes down: 'slam' once it hits the water, hurting every ship under it.
export function stepSlam(sl, dt, ships) {
  if ((sl.t -= dt) > 0) return null;
  for (const s of ships) {
    if (!s.alive || s.team === 3 || Math.hypot(s.x - sl.x, s.z - sl.z) > sl.r + s.len * 0.2) continue;
    s.lastHit = 3; // nobody's kill (PvP)
    damage(s, sl.dmg);
    s.slowT = Math.max(s.slowT || 0, 1.5);
  }
  return 'slam';
}

// --- boarding ---------------------------------------------------------------------
export const canBoard = (p, e) => p.alive && e.alive && e.team !== p.team && !e.isPlayer && e.type !== 'fort' && e.type !== 'kraken' && p.boardCd <= 0 &&
  Math.hypot(e.x - p.x, e.z - p.z) < (p.len + e.len) * 0.4 + 3;
// Below 20% hull the enemy strikes her colours; otherwise a melee decided round by round (game.js QTE).
export const startBoarding = (p, e) => (e.hp < 0.2 * e.maxHp ? { auto: true } : { you: p.crew, you0: p.crew, them: e.crew, start: e.crew, round: 0 });
// q = timing precision 0..1 (0 = miss). 'won' once the defenders are outnumbered 4:1; 'lost' (fall back) after losing 40% of the party.
export function boardRound(b, q) {
  if (q > 0) { b.them -= (2 + 0.12 * b.you) * (0.5 + q); b.you -= 0.5; }
  else { b.you -= 3 + 0.12 * b.them; b.them -= 0.5; }
  b.round++;
  if (b.them <= Math.max(0, 0.25 * b.you)) return 'won';
  if (b.you <= Math.max(3, 0.6 * b.you0) || b.you <= 0.25 * b.them) return 'lost';
  return null;
}
export function captureReward(p, e, b) {
  return { gold: e.gold * 2, crew: Math.min(p.maxCrew - p.crew, Math.ceil(0.3 * (b?.start ?? e.crew))), heal: Math.min(p.maxHp - p.hp, p.maxHp * 0.15) };
}

// --- fort ---------------------------------------------------------------------
// The fort is a square, ship-shaped target (h 0, footprint len × beam·1.2) so stepBall/damage just work.
// isl (its island): stepBall then hits it anywhere on the island, which would otherwise stop the ball first.
export function makeFort(x, z, half, isl) {
  return { type: 'fort', team: 1, x, z, h: 0, isl, len: half * 2, beam: (half * 2) / 1.2, hp: 300, maxHp: 300, alive: true, gold: 120, calm: 0, armorT: 0, slowT: 0, burnT: 0, backAt: 0 };
}
export function makeTurret(x, y, z) {
  return { x, y, z, reload: 2 + Math.random() * 2, reloadTime: 4.5, range: 46, team: 1, aim: 0 };
}

// Leads the target and solves vy so the ball comes down at hull height.
export function fireTurret(t, tgt, dt, rand = Math.random) {
  t.reload = Math.max(0, t.reload - dt);
  const d0 = Math.hypot(tgt.x - t.x, tgt.z - t.z);
  if (!tgt.alive || d0 > t.range) return null;
  const sp = 24;
  const T0 = d0 / sp;
  const tx = tgt.x + Math.cos(tgt.h) * tgt.speed * T0, tz = tgt.z + Math.sin(tgt.h) * tgt.speed * T0;
  const dx = tx - t.x, dz = tz - t.z, d = Math.hypot(dx, dz);
  t.aim = Math.atan2(dz, dx);
  if (t.reload > 0) return null;
  t.reload = t.reloadTime * (0.8 + rand() * 0.4);
  const T = d / sp;
  const a = t.aim + (rand() - 0.5) * 0.05;
  return {
    x: t.x, y: t.y, z: t.z,
    vx: Math.cos(a) * sp, vy: (1 - t.y + (BALL.g * T * T) / 2) / T, vz: Math.sin(a) * sp,
    team: t.team, dmg: 7, delay: 0, ox: Math.cos(a), oz: Math.sin(a),
  };
}

// --- waves & upgrades ---------------------------------------------------------
// Gentle ramp: wave 1 is a lone sloop, brigs from 2, galleons from 4. game.js spawns them one by one.
// mult scales the budget for co-op crews, extra adds to it (convoy mode: gold the merchants delivered); capped at 8 ships either way.
export function waveSpec(k, rand = Math.random, mult = 1, extra = 0) {
  let budget = (0.5 + k) * mult + extra;
  const opts = [['sloop', 1]];
  if (k >= 2) opts.push(['brig', 2]);
  if (k >= 4) opts.push(['galleon', 3]);
  const out = [];
  while (budget >= 1 && out.length < 8) {
    const avail = opts.filter(([, c]) => c <= budget);
    const [t, c] = avail[Math.floor(rand() * avail.length)];
    out.push(t);
    budget -= c;
  }
  return out;
}
export const fortActive = (k) => k >= 3;
// Kraken rounds: waves 4, 7, 10…, convoys 3, 6, 9… (PvP: on a timer, game.js).
export const krakenDue = (convoy, k) => (convoy ? k >= 3 && k % 3 === 0 : k >= 4 && k % 3 === 1);

// Hull patches itself once nobody has hit the ship for REGEN_DELAY s. regen = fraction of maxHp per second.
export const REGEN_DELAY = 5;
export function regenShip(s, dt) {
  s.calm += dt;
  if (!s.alive || s.calm < REGEN_DELAY || s.hp >= s.maxHp) return 0;
  const d = Math.min(s.regen * s.maxHp * dt, s.maxHp - s.hp);
  s.hp += d;
  return d;
}

export const UPGRADES = [
  { id: 'cannons', label: '+1 cannon per side', ok: (s) => s.cannons < 8, apply: (s) => (s.cannons += 1) },
  { id: 'reload', label: 'Reload 15% faster', ok: (s) => s.reloadTime > 1.2, apply: (s) => (s.reloadTime *= 0.85) },
  { id: 'hull', label: '+25 hull, patched', ok: () => true, apply: (s) => { s.maxHp += 25; s.hp += 25; } },
  { id: 'speed', label: '+10% speed', ok: () => true, apply: (s) => (s.maxSpeed *= 1.1) },
  { id: 'range', label: '+15% range', ok: (s) => s.range < 60, apply: (s) => (s.range *= 1.15) },
  { id: 'damage', label: '+25% shot damage', ok: () => true, apply: (s) => (s.dmgMul *= 1.25) },
  { id: 'crew', label: 'Recruit: +8 crew', ok: () => true, apply: (s) => { s.maxCrew += 8; s.crew += 8; } },
  { id: 'regen', label: 'Carpenters: faster repair out of combat', ok: (s) => s.regen < 0.05, apply: (s) => (s.regen += 0.012) },
];
const shuffle = (a, rand) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
function skillCards(s) {
  const cards = [];
  if (s.skills.length < 4) for (const id of s.learn) cards.push({ id: 'learn:' + id, label: `Learn ${SKILLS[id].name}: ${SKILLS[id].desc}` });
  for (const k of s.skills) if (k.lvl < 3) cards.push({ id: 'lvl:' + k.id, label: `${SKILLS[k.id].name} ${'I'.repeat(k.lvl + 1)}: stronger, faster cooldown` });
  return cards;
}
// Card 1 is always a skill card (learn or level up) while any is left; the rest mixes stats and skills.
export function rollUpgrades(s, rand = Math.random) {
  const sk = shuffle(skillCards(s), rand);
  return [...sk.slice(0, 1), ...shuffle([...sk.slice(1), ...UPGRADES.filter((u) => u.ok(s))], rand)].slice(0, 3);
}
export function applyUpgrade(s, id) {
  const [kind, sid] = id.split(':');
  if (kind === 'learn') { s.skills.push({ id: sid, lvl: 1 }); s.learn = s.learn.filter((x) => x !== sid); }
  else if (kind === 'lvl') s.skills.find((k) => k.id === sid).lvl++;
  else UPGRADES.find((u) => u.id === id).apply(s);
}

// --- skills (keys 1-4) -----------------------------------------------------------
// ammo skills arm the next broadside; the others act at once. Levels 1-3: shorter cooldown, more power.
export const SKILLS = {
  chain: { name: 'Chain shot', kind: 'ammo', cd: 12, desc: 'next broadside slows what it hits' },
  fire: { name: 'Fire shot', kind: 'ammo', cd: 14, desc: 'next broadside sets ships ablaze' },
  nova: { name: 'Full salvo', cd: 18, desc: 'every gun fires all around' },
  brace: { name: 'Brace', cd: 20, desc: 'take 60% less damage for a while' },
  boost: { name: 'Full sail', cd: 14, desc: 'burst of speed and handling' },
  keg: { name: 'Powder keg', cd: 10, desc: 'drop a floating mine behind you' },
  smoke: { name: 'Smoke screen', cd: 22, desc: 'enemies lose sight of you' },
  repair: { name: 'Patch hull', cd: 25, desc: 'instant hull repair' },
};
export const BURN_DPS = 3;
const power = (lvl) => 1 + 0.5 * (lvl - 1);
export const skillCd = (id, lvl) => SKILLS[id].cd * (1 - 0.15 * (lvl - 1));

// Returns null (empty slot / cooling down / sunk) or { id, balls?, keg? } for game.js to spawn.
export function useSkill(s, slot) {
  const sk = s.skills[slot];
  if (!sk || !s.alive || s.cd[sk.id] > 0) return null;
  const { id, lvl } = sk, p = power(lvl), out = { id };
  s.cd[id] = skillCd(id, lvl);
  if (SKILLS[id].kind === 'ammo') s.ammo = { id, p };
  else if (id === 'nova') {
    const n = 10 + 4 * (lvl - 1);
    out.balls = [];
    for (let k = 0; k < n; k++) {
      const a = s.h + (k / n) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      out.balls.push(makeBall(s, s.x + dx * s.beam * 0.6, s.z + dz * s.beam * 0.6, dx, dz, s.range / ARC_T, k * 0.02));
    }
  } else if (id === 'brace') s.armorT = 4 * p;
  else if (id === 'boost') { s.boostT = 3 * p; s.sail = 3; }
  else if (id === 'smoke') s.smokeT = 4 * p;
  else if (id === 'repair') s.hp = Math.min(s.maxHp, s.hp + s.maxHp * (0.2 + 0.1 * (lvl - 1)));
  else if (id === 'keg') out.keg = { x: s.x - Math.cos(s.h) * s.len * 0.65, z: s.z - Math.sin(s.h) * s.len * 0.65, team: s.team, r: 6, dmg: 25 * p, life: 30 };
  return out;
}
// Floating mine: 'boom' (damages every enemy in range) when one comes close, 'gone' when it expires.
export function stepKeg(k, dt, ships) {
  if ((k.life -= dt) <= 0) return 'gone';
  const near = (s) => s.alive && s.team !== k.team && Math.hypot(s.x - k.x, s.z - k.z) < k.r + s.len * 0.3;
  if (!ships.some(near)) return null;
  for (const s of ships.filter(near)) { s.lastHit = k.team; damage(s, k.dmg); }
  return 'boom';
}
