// Boss fights (game.js boss mode): pure logic like sim.js, no three.js, runs in node for check.mjs.
// A boss is a ship (makeBoss) with a step function. bossStep steers it and returns what it does this frame as plain
// effects; game.js turns them into balls, marked zones, kegs and ships with the functions it already has.
// The models are in bosses.js, under the same ids.
import { tk } from './i18n.js';
import { makeShip, aiSteer, steerTo, wrap, shuffle, makeBall, ARC_T, useSkill, damage, makeTurret, fireTurret, fireMortar, MORTAR, SLAM, BOUNDS, ISLANDS } from './sim.js';

// How a boss grows with the level it is met at (1 = first fight of a run, 12 = the last). Tune here.
export const SCALE = {
  hp: 0.18, // hull: +18% per level, ×2.8 at level 11
  dmg: 0.07, // every hit it deals: +7% per level
  pace: 0.025, paceMin: 0.7, // its attacks come 2.5% sooner per level, never more than 30% sooner
  adds: 4, // one more ship in each reinforcement every 4 levels
};
export const LAST = 'poseidon';

const dist = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const bearingTo = (a, b) => Math.atan2(b.z - a.z, b.x - a.x);
const lead = (tgt, t) => ({ x: tgt.x + Math.cos(tgt.h) * tgt.speed * t, z: tgt.z + Math.sin(tgt.h) * tgt.speed * t }); // where she will be if she holds her course
// timers: s.tm[key] counts down (bossStep). ready: true once it is out, and winds it again. Last in a condition, so it only winds when the attack goes.
const ready = (s, key, period) => { if (s.tm[key] > 0) return false; s.tm[key] = period * s.pace; return true; };
const below = (s, f) => s.hp < s.maxHp * f && !s.tm['hp' + f] && (s.tm['hp' + f] = Infinity); // true once, the first frame under that share of hull
const head = (s, want) => { s.turnIn = Math.max(-1, Math.min(1, wrap(want - s.h) * 2)); }; // steerTo without its detour round the islands
const open = (x, z, pad) => Math.abs(x) < BOUNDS.x - pad && Math.abs(z) < BOUNDS.z - pad && !ISLANDS.some((I) => Math.hypot(x - I.x, z - I.z) < I.r + pad);

// A marked zone: a circle on the water, then the blow (sim.js stepSlam lands it, like a fort's mortar shell: team 1, so the boss
// and its ships are spared). from: who lobs a shell at it (game.js draws the shell), null for a bite, a breach, a bolt:
// nothing flies in. (A zone with no `from` at all is a fort's mortar shell, sim.js fireMortar.) wave: sim.js stepSlam.
// Default size and delay are the mortar's: a hard turn 0.3 s in clears it in every player ship (check.mjs).
// head: one of the model's heads goes for it (game.js hands the zone to the model, bosses.js).
const zone = (s, x, z, { r = MORTAR.r, dmg = MORTAR.dmg, t = MORTAR.t, from = null, wave, head } = {}) =>
  ({ x, z, t, r, dmg: dmg * s.pow, team: s.team, from, ...(wave && { wave: { r: wave.r, dmg: wave.dmg * s.pow } }), ...(head && { head }) });
const ships = (out, n, type, livery, guard) => { for (let i = 0; i < n; i++) out.spawn.push({ type, livery, guard }); };

// Bear down on the target, bow first: the ram is the weapon (sim.js collideShips, by weight). A burst of speed once lined up.
function charge(s, tgt, period) {
  const d = dist(s, tgt), want = bearingTo(s, lead(tgt, d / Math.max(8, s.speed))), off = Math.abs(wrap(want - s.h));
  s.sail = 3;
  steerTo(s, want);
  if (off < 0.25 && d < 45 && ready(s, 'charge', period)) s.boostT = 2.5;
  return { d, off };
}
// Keep the target abeam at about r, circling it.
function circle(s, tgt, r) {
  const ang = bearingTo(s, tgt), d = dist(s, tgt), side = wrap(ang - s.h) >= 0 ? 1 : -1;
  s.sail = 3;
  steerTo(s, ang - (side * Math.PI) / 2 + side * (d > r * 1.15 ? 0.6 : d < r * 0.8 ? -0.5 : 0));
  return d;
}
// Go under (untouchable, unseen) for o.down s and come back up through a marked zone where the target is headed.
// The zone only shows for the last o.warn s (a number, or a function of the target): the shorter, the less time to swerve.
function dive(s, o) {
  s.ghost = s.hidden = true;
  s.under = { ...o, left: o.down };
}
function under(s, dt, tgt, out) { // true while it is down
  const u = s.under;
  if (!u) return false;
  s.sail = 0; s.turnIn = 0; s.speed = 0;
  u.left -= dt;
  if (!u.at && u.left <= (u.warn = typeof u.warn === 'function' ? u.warn(tgt) : u.warn)) {
    const p = lead(tgt, u.left), lx = BOUNDS.x - 12, lz = BOUNDS.z - 12;
    u.at = { x: Math.max(-lx, Math.min(lx, p.x)), z: Math.max(-lz, Math.min(lz, p.z)) };
    for (const I of ISLANDS) { // a prey heading at a shore: the mark is pushed off the island, onto the water it will reach first
      const dx = u.at.x - I.x, dz = u.at.z - I.z, d = Math.hypot(dx, dz) || 1e-3, lim = I.r * 1.2 + u.r + 2;
      if (d < lim) { u.at.x = I.x + (dx / d) * lim; u.at.z = I.z + (dz / d) * lim; }
    }
    out.slams.push(zone(s, u.at.x, u.at.z, { ...u, t: u.left }));
  }
  if (u.left > 0) return true;
  Object.assign(s, { x: u.at.x, z: u.at.z, h: bearingTo(u.at, tgt), ghost: false, hidden: false, under: null });
  return false;
}

// Base stats are level 1. len / beam: the footprint balls and rams use. cannons: per side.
export const BOSS = {
  // Santísima Trinidad: heavy double broadsides, a mortar barrage, sloops to her rescue at two thirds and one third of her hull.
  trinidad: {
    len: 20, beam: 5.6, hp: 520, speed: 7, turn: 0.5, cannons: 7, dmgMul: 1.6, range: 36, reloadTime: 5, aimTol: 0.12, gold: 150,
    init: (s) => { s.tm.barrage = 6; },
    step(s, dt, tgt, out, { rand }) {
      out.fire = aiSteer(s, tgt);
      if (dist(s, tgt) < MORTAR.range && ready(s, 'barrage', 9)) {
        const p = lead(tgt, MORTAR.t);
        for (let i = 0; i < 3; i++) {
          const a = rand() * 6.28, d = i ? 5 + rand() * 4 : 0; // one where she is headed, two around it
          out.slams.push(zone(s, p.x + Math.cos(a) * d, p.z + Math.sin(a) * d, { t: MORTAR.t + i * 0.35, from: s }));
        }
      }
      for (const f of [0.66, 0.33]) if (below(s, f)) { ships(out, 2 + s.adds, 'sloop', 'navy'); out.say = tk('REINFORCEMENTS'); }
    },
  },
  // Nuestra Señora de Atocha: runs from corner to corner of the chart behind her escort, and shoots back when stung.
  // She never leaves it (the run needs her sunk): each corner she reaches, one more brig joins, up to four afloat.
  atocha: {
    len: 17, beam: 5.8, hp: 420, speed: 7, turn: 0.55, cannons: 5, dmgMul: 1, range: 30, reloadTime: 5, aimTol: 0.12, gold: 400,
    init: (s) => { s.calm = 99; }, // not hit yet (sim.js damage zeroes it), like a merchant
    step(s, dt, tgt, out, ctx) {
      s.calm += dt;
      if (!s.dest || dist(s, s.dest) < 14) {
        const afloat = ctx.ships.filter((o) => o.ward === s && o.alive && !o.escaped).length; // game.js makes her the ward of the brigs she calls
        const first = !s.dest, n = first ? 2 + s.adds : (afloat < 4 + s.adds ? 1 : 0);
        const corners = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => ({ x: a * (BOUNDS.x - 28), z: b * (BOUNDS.z - 28) }));
        s.dest = corners.filter((c) => dist(s, c) > 40).sort((a, b) => dist(tgt, b) - dist(tgt, a))[0]; // the one furthest from the pirate
        ships(out, n, 'brig', 'navy', true);
        if (!first && n) out.say = tk('THE ESCORT IS REINFORCED');
      }
      const d = dist(s, tgt);
      let want = bearingTo(s, s.dest);
      if (d < 38) { const away = bearingTo(tgt, s); want = away + wrap(want - away) * 0.3; }
      s.sail = d < 45 ? 3 : 2;
      steerTo(s, want);
      const b = wrap(bearingTo(s, tgt) - s.h); // hit in the last 8 s: she fires whenever the pirate crosses her beam, without turning to fight
      if (s.calm < 8 && d < s.range * 0.95 && Math.abs(Math.abs(b) - Math.PI / 2) < 0.3) out.fire = b >= 0 ? 1 : -1;
    },
  },
  // Barbarossa's galley: oars, so no wind. Charges with the spur, bow chasers firing straight ahead.
  galley: {
    len: 19, beam: 3.2, hp: 380, speed: 10.5, turn: 0.85, cannons: 0, dmgMul: 1.2, range: 30, reloadTime: 4, gold: 150, noWind: true,
    step(s, dt, tgt, out) {
      const { d, off } = charge(s, tgt, 7);
      if (off < 0.2 && d < s.range && ready(s, 'chase', 3.5)) {
        const c = Math.cos(s.h), sn = Math.sin(s.h);
        for (const k of [-1, 0, 1]) out.balls.push(makeBall(s, s.x + c * s.len * 0.45 - sn * k * 0.5, s.z + sn * s.len * 0.45 + c * k * 0.5, Math.cos(s.h + k * 0.05), Math.sin(s.h + k * 0.05), s.range / ARC_T, (k + 1) * 0.1));
      }
    },
  },
  // Yi Sun-sin's turtle ship: an iron shell (sim.js s.shell: only her stern is soft) and guns all round.
  turtle: {
    len: 12, beam: 5, hp: 450, speed: 7.5, turn: 0.75, cannons: 5, dmgMul: 1, range: 28, reloadTime: 4.5, aimTol: 0.14, gold: 150, shell: true,
    init: (s) => { s.skills = [{ id: 'nova', lvl: 2 }]; s.cd.nova = 5; },
    step(s, dt, tgt, out) {
      out.fire = aiSteer(s, tgt);
      if (dist(s, tgt) < s.range && !(s.cd.nova > 0)) { out.balls.push(...useSkill(s, 0).balls); s.cd.nova = 7 * s.pace; } // the player's Full salvo, on her own clock
    },
  },
  // Blackbeard: fights at pistol range, every other broadside sets you ablaze, powder kegs dropped in his wake.
  blackbeard: {
    len: 15, beam: 4.4, hp: 420, speed: 9.5, turn: 0.8, cannons: 6, dmgMul: 1.2, range: 26, reloadTime: 4, aimTol: 0.14, gold: 150,
    init: (s) => { s.skills = [{ id: 'keg', lvl: 1 }]; s.cd.keg = 6; },
    step(s, dt, tgt, out) {
      const side = out.fire = aiSteer(s, tgt);
      if (side && s.reload[side > 0 ? 'star' : 'port'] <= 0 && (s.volleys = (s.volleys || 0) + 1) % 2 === 0) s.ammo = { id: 'fire', p: 1 }; // sim.js fire shot
      if (dist(s, tgt) < 40 && !(s.cd.keg > 0)) { const k = useSkill(s, 0).keg; k.dmg *= s.pow; out.kegs.push(k); s.cd.keg = 8 * s.pace; }
    },
  },
  // Ching Shih: the flagship of a fleet. Junks answer her call at three quarters, half and a quarter of her hull.
  junk: {
    len: 16, beam: 5, hp: 400, speed: 9, turn: 0.75, cannons: 4, dmgMul: 1.1, range: 30, reloadTime: 4.2, aimTol: 0.14, gold: 150,
    step(s, dt, tgt, out) {
      out.fire = aiSteer(s, tgt);
      for (const f of [0.75, 0.5, 0.25]) if (below(s, f)) { ships(out, 2 + s.adds, 'sloop', 'junk'); out.say = tk('THE RED FLAG FLEET ANSWERS'); }
    },
  },
  // The Flying Dutchman: solid she fights like a galleon; spectral nothing touches her, islands and hulls do not stop her,
  // and she comes back solid on the pirate's beam, guns run out.
  dutchman: {
    len: 15, beam: 4.4, hp: 380, speed: 9, turn: 0.75, cannons: 5, dmgMul: 1.3, range: 32, reloadTime: 4.2, aimTol: 0.14, gold: 150,
    init: (s) => { s.tm.phase = 9; },
    step(s, dt, tgt, out) {
      if (!s.ghost) {
        out.fire = aiSteer(s, tgt);
        if (ready(s, 'phase', 5)) { s.ghost = true; out.say = tk('SHE FADES'); }
        return;
      }
      s.sail = 3;
      head(s, bearingTo(s, tgt));
      if (s.tm.phase > 0) return;
      // Back solid 24 off her prey, sailing the same course: abeam if there is open water there (her broadside bears at once),
      // else astern or ahead. No room at all (a pirate wedged between a shore and the chart's edge): she stays spectral and
      // tries again a moment later, rather than turn solid where she is, which may be inside the pirate's hull.
      const at = [Math.PI / 2, -Math.PI / 2, Math.PI, 0].map((a) => ({ x: tgt.x + Math.cos(tgt.h + a) * 24, z: tgt.z + Math.sin(tgt.h + a) * 24 })).find((p) => open(p.x, p.z, 10));
      if (!at) { s.tm.phase = 0.5; return; }
      Object.assign(s, { ...at, h: tgt.h, speed: tgt.speed, ghost: false });
      s.tm.phase = 9 * s.pace;
      s.reload.port = s.reload.star = 0.8;
    },
  },
  // Jörmungandr: circles its prey on the surface, biting; then dives and bursts up under it.
  serpent: {
    len: 20, beam: 3.5, hp: 480, speed: 9, turn: 1, cannons: 0, range: 30, reloadTime: 3, gold: 150, noWind: true,
    init: (s) => { s.tm.dive = 8; s.tm.bite = 2; },
    step(s, dt, tgt, out) {
      if (under(s, dt, tgt, out)) return;
      const d = circle(s, tgt, 18);
      if (d < s.range && ready(s, 'bite', 3)) { const p = lead(tgt, MORTAR.t); out.slams.push(zone(s, p.x, p.z, { dmg: 20 })); }
      if (ready(s, 'dive', 12)) dive(s, { down: 3.4, warn: 3.4, r: 5, dmg: 28 }); // 8 s up, 3.4 s down at level 1, the zone marked all the while
    },
  },
  // Moby Dick: the heaviest hull afloat, and it rams. Now and then it sounds, and breaches under your bow: the mark shows late
  // (BREACH.warn), and the wave it throws up hurts everything around, less the further off (sim.js stepSlam `wave`).
  whale: {
    len: 18, beam: 5, hp: 600, speed: 9.5, turn: 0.6, cannons: 0, range: 0, reloadTime: 3, gold: 150, noWind: true,
    init: (s) => { s.tm.dive = 10; },
    step(s, dt, tgt, out) {
      if (under(s, dt, tgt, out)) return;
      charge(s, tgt, 6);
      if (ready(s, 'dive', 14)) dive(s, BREACH);
    },
  },
  // Charybdis and Scylla. Scylla, the six heads on the rock, is the one to sink. Within BITE.r her heads lunge at you, all six
  // at once; further off, out to her range (longer than any gun's), they spit: nobody shells her from safety. PULL.d behind her
  // (the model's whirlpool, bosses.js) Charybdis drags every hull in and grinds what reaches the middle.
  charybdis: {
    len: 9, beam: 9, hp: 520, speed: 0, turn: 0, cannons: 0, range: 46, reloadTime: 3, gold: 150, noWind: true, fixed: true,
    step(s, dt, tgt, out, ctx) {
      s.sail = 0; s.turnIn = 0;
      const cx = s.x - Math.cos(s.h) * PULL.d, cz = s.z - Math.sin(s.h) * PULL.d;
      for (const o of ctx.ships) {
        const dx = cx - o.x, dz = cz - o.z, d = Math.hypot(dx, dz) || 1e-3;
        if (o === s || !o.alive || o.ghost || d > PULL.r) continue;
        const v = (PULL.min + (PULL.max - PULL.min) * (1 - d / PULL.r)) * dt; // stronger toward the middle, never faster than the slowest ship can sail out
        o.x += (dx / d) * v - (dz / d) * v * 0.5; // dragged in, and round
        o.z += (dz / d) * v + (dx / d) * v * 0.5;
        if (d < PULL.maw) damage(o, PULL.dps * s.pow * dt);
      }
      const d = dist(s, tgt), near = d < BITE.r, k = s.hp < s.maxHp * 0.5 ? 0.72 : 1; // hurt, she strikes more often
      if (near ? ready(s, 'bite', 2.6 * k) : d < s.range && ready(s, 'spit', 3.2 * k)) {
        // six heads, six zones, together: one where you are headed, five thrown round it at random. Small ones: there is water between.
        const p = lead(tgt, MORTAR.t), [lo, hi] = near ? BITE.scatter : BITE.far;
        for (let i = 0; i < BITE.heads; i++) {
          const a = ctx.rand() * 6.28, r = i ? lo + ctx.rand() * (hi - lo) : 0;
          out.slams.push(zone(s, p.x + Math.cos(a) * r, p.z + Math.sin(a) * r, { r: BITE.zone, head: true, ...(near ? { dmg: BITE.dmg } : { dmg: BITE.spit, from: s }) }));
        }
      }
    },
  },
  // Aspidochelone: an island until it is hit or approached. Awake it follows, slowly, with the fort on its back firing.
  island: {
    len: 20, beam: 18, hp: 700, speed: 2.5, turn: 0.25, cannons: 0, range: 46, reloadTime: 4.5, gold: 150, noWind: true,
    init: (s) => { s.asleep = true; s.mortar = 4; s.turrets = TURRETS.map(() => makeTurret(0, 4.6, 0)); },
    step(s, dt, tgt, out, { rand }) {
      const d = dist(s, tgt);
      if (s.asleep) {
        s.sail = 0; s.turnIn = 0;
        if (s.hp >= s.maxHp && d > 28) return;
        s.asleep = false;
        out.say = tk('THE ISLAND WAKES');
      }
      s.sail = d > 22 ? 3 : 0;
      steerTo(s, bearingTo(s, tgt));
      const c = Math.cos(s.h), sn = Math.sin(s.h);
      s.turrets.forEach((t, i) => { // sim.js fort guns, carried on her back
        const [lx, lz] = TURRETS[i];
        t.x = s.x + c * lx - sn * lz; t.z = s.z + sn * lx + c * lz;
        const b = fireTurret(t, tgt, dt, rand);
        if (b) { b.dmg *= s.pow; out.balls.push(b); }
      });
      const m = fireMortar(s, tgt, dt);
      if (m) out.slams.push({ ...m, dmg: m.dmg * s.pow, from: s });
    },
  },
  // Poseidon: the trident throws a fan of bolts (TRIDENT), a tidal blow punishes whoever hugs him, and he rages as he weakens.
  poseidon: {
    len: 8, beam: 11, hp: 900, speed: 1.5, turn: 0.5, cannons: 0, range: 70, reloadTime: 3, gold: 500, noWind: true,
    init: (s) => { s.tm.trident = 4; },
    step(s, dt, tgt, out, { rand }) {
      const d = dist(s, tgt), hurt = s.hp < s.maxHp * 0.5;
      s.sail = d > 26 ? 3 : 0;
      steerTo(s, bearingTo(s, tgt));
      if (d < s.range && ready(s, 'trident', 6)) {
        // Four bolts fanned out from him (five once he is hurt), each a row of zones running outward. One, drawn at random,
        // goes through where you are headed and past you; the others are of uneven lengths, some falling short. The rows are
        // TRIDENT.lane apart at your distance: turning out of yours puts you in the water between two, not on the next one.
        const n = TRIDENT.bolts + (hurt ? 1 : 0), aimed = Math.floor(rand() * n), a0 = bearingTo(s, lead(tgt, 1.2)), fan = Math.max(TRIDENT.fan, TRIDENT.lane / Math.max(d, 12));
        const reach = shuffle([...TRIDENT.reach], rand); // dealt out, not drawn: the others are never all the same length
        for (let k = 0; k < n; k++) {
          const a = a0 + (k - aimed) * fan, len = Math.min(75, k === aimed ? d + 10 : Math.max(16, d * reach[k % reach.length]));
          for (let j = 0, r = 9; r < len; j++, r += TRIDENT.gap) out.slams.push(zone(s, s.x + Math.cos(a) * r, s.z + Math.sin(a) * r, { r: TRIDENT.r, dmg: TRIDENT.dmg, t: TRIDENT.t + j * 0.12 })); // it runs outward
        }
        out.cue = ['trident', TRIDENT.t];
      }
      if (d < TIDE.r && ready(s, 'tide', 6)) { out.slams.push(zone(s, s.x, s.z, TIDE)); out.cue = ['tide', TIDE.t]; }
      if (s.hp < s.maxHp * 0.25 && ready(s, 'storm', 1.5)) { const a = rand() * 6.28, r = rand() * 10; out.slams.push(zone(s, tgt.x + Math.cos(a) * r, tgt.z + Math.sin(a) * r, { r: SLAM.r, dmg: 16 })); }
    },
  },
};
// Scylla: within r her heads lunge and bite (dmg each), beyond it they spit (spit each). zone: each head's mark.
// scatter / far: how far from the aimed one the other five land, biting / spitting
export const BITE = { r: 18, heads: 6, zone: 2.2, dmg: 13, spit: 8, scatter: [6, 13], far: [7, 16] };
// Charybdis: d behind Scylla, r reach, min → max pull (units/s) from the rim to the middle, maw: the grinding middle
export const PULL = { d: 19, r: 45, min: 2, max: 6, maw: 4, dps: 14 };
// Moby Dick's breach. down: s under water, the last `warn` of them with the mark on the water. warn follows the prey's helm,
// so that it takes the same reflexes in every ship: a hard turn begun within a third of a second clears the blow (r), nothing
// later does (check.mjs). wave: nobody near gets off free.
export const BREACH = { down: 3.2, warn: (tgt) => 0.75 + 0.85 / tgt.turn, r: 3.5, dmg: 30, wave: { r: 16, dmg: 18 } };
// Poseidon's trident: bolts in a fan, at least `fan` rad and `lane` units apart where the prey is; each a row of zones every `gap`
// reach: how far the bolts not aimed at the prey run, as a share of its distance
export const TRIDENT = { bolts: 4, fan: 0.34, lane: 15, gap: 6.5, r: 3, dmg: 22, t: 2, reach: [0.5, 0.75, 1, 1.3] };
// Poseidon's tidal blow, centred on him: get clear of r
export const TIDE = { r: 12, dmg: 25, t: 3.6 };
const TURRETS = [[4, 3], [4, -3], [-2, 5.5], [-2, -5.5]]; // Aspidochelone's guns, in her frame (bow +x)

// The run: every boss once in a random order, Poseidon last.
export const bossOrder = (rand = Math.random) => [...shuffle(Object.keys(BOSS).filter((id) => id !== LAST), rand), LAST];

// lvl 1..12: the fight's place in the run (SCALE).
export function makeBoss(id, lvl = 1, x = 0, z = 0, h = 0) {
  const { step, init, hp, speed, ...stats } = BOSS[id], k = lvl - 1, pow = 1 + SCALE.dmg * k, pace = Math.max(SCALE.paceMin, 1 - SCALE.pace * k);
  const s = Object.assign(makeShip('galleon', 1, x, z, h), { aimTol: 0, dmgMul: 1 }, stats);
  Object.assign(s, {
    type: id, boss: id, lvl, pow, pace, adds: Math.floor(k / SCALE.adds), tm: {},
    hp: Math.round(hp * (1 + SCALE.hp * k)), maxSpeed: speed, dmgMul: s.dmgMul * pow, reloadTime: s.reloadTime * pace,
    crew: 0, maxCrew: 0, // no gunners to lose: her guns never slow (sim.js crewMul)
  });
  s.maxHp = s.hp;
  init?.(s);
  return s;
}

// One frame of the fight. ctx: { target: the pirate it goes for, ships: every hull afloat, rand }.
// → { fire: side to fire (0: none), balls, slams (marked zones), kegs, spawn: [{ type, livery, guard }], say: a banner key,
//     cue: [gesture, s until the blow] for the model to act out (bosses.js) }
export function bossStep(s, dt, ctx) {
  const out = { fire: 0, balls: [], slams: [], kegs: [], spawn: [], say: null, cue: null };
  if (!s.alive) return out;
  for (const k in s.tm) s.tm[k] -= dt;
  if (!ctx.target?.alive) { s.sail = 0; s.turnIn = 0; return out; } // nobody left to fight
  BOSS[s.boss].step(s, dt, ctx.target, out, { rand: Math.random, ...ctx });
  return out;
}
