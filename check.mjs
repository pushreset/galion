// node check.mjs — asserts on the pure sim, and on what the menus store.
import assert from 'node:assert/strict';
import { styleOf } from './store.js';
import { BOSS, SCALE, PULL, BREACH, BITE, TRIDENT, bossOrder, makeBoss, bossStep } from './bossfight.js';
import { setMap, MAPS, BOUNDS, convoySpec, guardSteer, makeShip, stepShip, fireBroadside, stepBall, collideShips, damage, ISLANDS, shoreR, aiSteer, makeTurret, fireTurret, fireMortar, MORTAR, waveSpec, UPGRADES, SKILLS, applyUpgrade, makePlayer, regenShip, REGEN_DELAY, useSkill, stepKeg, rollUpgrades, PLAYER_SHIPS, makeFort, merchantSpec, makeMerchant, merchantSteer, crewMul, canBoard, startBoarding, boardRound, captureReward, krakenSteer, stepSlam, krakenDue, WIND, windMul, SHELL } from './sim.js';

WIND.k = 0; // the checks below are written for still air; the wind block turns it back on

const r0 = () => 0.5; // deterministic: no spread

// broadside leaves perpendicular to heading, on the requested side
for (const h of [0, 1, -2.3]) {
  const s = makeShip('galleon', 0, 0, 0, h);
  for (const side of [-1, 1]) {
    const [b] = fireBroadside(s, side, r0);
    const dot = b.vx * Math.cos(h) + b.vz * Math.sin(h);
    assert.ok(Math.abs(dot) < 1e-9, 'ball not perpendicular');
    const starDot = b.vx * -Math.sin(h) + b.vz * Math.cos(h);
    assert.equal(Math.sign(starDot), side, 'wrong side');
  }
  assert.equal(fireBroadside(s, 1).length, 0, 'reload not enforced');
}

// a stationary target abeam at mid range gets hit; a ball lands near nominal range
{
  const s = makeShip('galleon', 0, 0, 0, 0);
  const tgt = makeShip('galleon', 1, 0, 26, 0); // starboard of h=0 is +z
  const balls = fireBroadside(s, 1, r0);
  let hits = 0;
  for (const b of balls) for (let i = 0; i < 400; i++) { const ev = stepBall(b, 1 / 60, [s, tgt]); if (ev) { hits += ev.hit ? 1 : 0; break; } }
  assert.equal(hits, s.cannons, 'volley should hit a broadside target at mid range');
  assert.ok(tgt.hp < tgt.maxHp);
  const [b] = fireBroadside(makeShip('galleon', 0, 0, 0, 0), -1, r0);
  while (!stepBall(b, 1 / 120, [])) {}
  assert.ok(Math.abs(Math.hypot(b.x, b.z) - 34) < 4, 'range off: ' + Math.hypot(b.x, b.z));
}

// point-blank: the same broadside hits 1.5× harder alongside than at mid range; a fort's ball never does
{
  const volley = (d) => {
    const s = makeShip('galleon', 0, 0, 0, 0), tgt = makeShip('galleon', 1, 0, d, 0);
    const pbs = fireBroadside(s, 1, r0).map((b) => { for (let i = 0; i < 400; i++) { const ev = stepBall(b, 1 / 60, [s, tgt]); if (ev) return ev.pb; } });
    return { lost: tgt.maxHp - tgt.hp, pbs };
  };
  const near = volley(8), far = volley(26);
  assert.ok(near.pbs.every((p) => p === true) && far.pbs.every((p) => p === false), 'point-blank flag');
  assert.ok(Math.abs(near.lost - 1.5 * far.lost) < 1e-9, `point-blank damage: ${near.lost} vs ${far.lost}`);
  const tgt = makeShip('galleon', 0, 3, 0, 0), t = makeTurret(0, 1, 0);
  t.reload = 0;
  const b = fireTurret(t, tgt, 0, r0);
  let ev; while (!(ev = stepBall(b, 1 / 120, [tgt]))) {}
  assert.equal(ev.pb, false, 'fort ball point-blank');
}

// own team is never hit
{
  const s = makeShip('galleon', 0, 0, 0, 0), friend = makeShip('sloop', 0, 0, 20, 0);
  for (const b of fireBroadside(s, 1, r0)) for (let i = 0; i < 400; i++) if (stepBall(b, 1 / 60, [s, friend])) break;
  assert.equal(friend.hp, friend.maxHp);
}

// speed obeys sail level, ships can't enter islands, sinking stops control
{
  const s = makeShip('sloop', 0, 0, 0, 0);
  s.sail = 3;
  for (let i = 0; i < 600; i++) stepShip(s, 1 / 60);
  assert.ok(Math.abs(s.speed - s.maxSpeed) < 0.5 || s.speed < s.maxSpeed);
  const I = ISLANDS[0];
  const t = makeShip('galleon', 0, I.x - 30, I.z, 0);
  t.sail = 3;
  for (let i = 0; i < 900; i++) stepShip(t, 1 / 60);
  assert.ok(Math.hypot(t.x - I.x, t.z - I.z) > I.r * 0.8, 'sailed into island');
  damage(t, 1e9);
  assert.equal(t.alive, false);
  assert.equal(fireBroadside(t, 1).length, 0);
}

// ships don't overlap after collision
{
  const a = makeShip('galleon', 0, 0, 0, 0), b = makeShip('galleon', 1, 2, 0, Math.PI);
  a.speed = b.speed = 8;
  collideShips([a, b]);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= (a.len + b.len) * 0.32 - 1e-9);
  assert.ok(a.hp < a.maxHp, 'ram should damage');
}
// a ram hurts by size: a galleon running down a sloop takes little and deals a lot
{
  const g = makeShip('galleon', 0, 0, 0, 0), s = makeShip('sloop', 1, 2, 0, Math.PI);
  g.speed = s.speed = 8;
  collideShips([g, s]);
  assert.ok(s.maxHp - s.hp > 2.5 * (g.maxHp - g.hp), 'the sloop should take far more than the galleon');
}
// heavy guns: a full Leviathan broadside sinks a navy sloop, a Wasp's does not
{
  const dmg = (i) => fireBroadside(makePlayer(i), 1, r0).reduce((a, b) => a + b.dmg, 0);
  assert.ok(dmg(2) >= makeShip('sloop', 1).hp * 2 && dmg(0) < makeShip('sloop', 1).hp, 'Leviathan one-shots a sloop, the Wasp does not');
}
// play style: a pirate's damage is counted by source (the navy's is not), styleOf names the run
{
  const p = makePlayer(0, 0, 0, 0), far = makeShip('galleon', 1, 0, 20, 0), near = makeShip('galleon', 1, 0, 5, 0);
  const shoot = (tgt, s = p) => { s.reload.star = 0; for (const b of fireBroadside(s, 1, r0)) for (let i = 0; i < 600; i++) if (stepBall(b, 1 / 120, [tgt])) break; };
  shoot(far);
  assert.deepEqual(p.dealt, { gun: far.maxHp - far.hp });
  shoot(near);
  assert.equal(p.dealt.pb, near.maxHp - near.hp, 'a point-blank hit counts apart');
  const foe = makeShip('sloop', 1, 100, 100), { keg } = useSkill(p, 1);
  Object.assign(foe, { x: keg.x, z: keg.z });
  stepKeg(keg, 0.1, [foe]);
  assert.equal(p.dealt.keg, foe.maxHp - foe.hp);
  const navy = makeShip('brig', 1, 2, 0, Math.PI);
  p.speed = navy.speed = 8;
  collideShips([p, navy]);
  assert.ok(Math.abs(p.dealt.ram - (navy.maxHp - navy.hp)) < 1e-9);
  assert.equal(navy.dealt, undefined, 'the navy keeps no count');
  const still = makePlayer(0, 0, 0, 0), charger = makeShip('brig', 1, 2, 0, Math.PI);
  charger.speed = 10;
  collideShips([still, charger]);
  assert.ok(charger.hp < charger.maxHp && still.dealt.ram === undefined, 'a pirate rammed at anchor did not ram');
  const kr = makeShip('kraken', 3, 0, 0, 0), lev = makePlayer(2, 2, 0, Math.PI);
  lev.speed = 8;
  collideShips([kr, lev]);
  assert.ok(lev.maxHp - lev.hp > kr.maxHp - kr.hp, 'the kraken outweighs a galleon');
  const c = makePlayer(1), lit = makeShip('galleon', 1, 0, 20, 0);
  useSkill(c, 1); shoot(lit, c);
  const impact = c.dealt.gun;
  for (let i = 0; i < 60; i++) stepShip(lit, 1 / 60);
  assert.ok(c.dealt.gun > impact + 2, 'the burn of a fire shot counts for the ship that lit it');
  const last = makeShip('sloop', 1);
  last.hp = 5; damage(last, 1e9, p, 'board');
  assert.equal(p.dealt.board, 5, 'only the hull that was left counts');
  assert.equal(styleOf({}), null);
  assert.equal(styleOf({ gun: 100, keg: 60 }).id, 'keg', 'kegs weigh more than guns');
  assert.equal(styleOf({ gun: 100, keg: 40 }).id, 'gun');
  assert.equal(styleOf({ gun: 75, pb: 25, junk: 'x' }).share.pb, 0.25);
}
// AI ends up abeam of a stationary target and fires
{
  const tgt = makeShip('galleon', 0, 0, 0, 0);
  for (const type of ['sloop', 'brig', 'galleon']) {
    const s = makeShip(type, 1, 0, -70, 0);
    let fired = 0;
    for (let i = 0; i < 60 * 40; i++) {
      const side = aiSteer(s, tgt);
      if (side && fireBroadside(s, side).length) fired++;
      stepShip(s, 1 / 60);
    }
    assert.ok(fired >= 2, `${type} AI never fired`);
  }
}

// AI never ends up inside an island while chasing around the map
{
  const tgt = makeShip('galleon', 0, ISLANDS[0].x + 25, ISLANDS[0].z, 0);
  const s = makeShip('brig', 1, ISLANDS[0].x - 40, ISLANDS[0].z, 0);
  for (let i = 0; i < 60 * 60; i++) {
    aiSteer(s, tgt);
    stepShip(s, 1 / 60);
    tgt.h += 0.004; tgt.speed = 4; stepShip(tgt, 1 / 60);
    for (const I of ISLANDS) assert.ok(Math.hypot(s.x - I.x, s.z - I.z) > I.r * 0.85, 'AI inside island');
  }
}

// fort mortar: reloads, has a range, spares the navy, and is dodged by a hard turn but not by holding course
{
  const f = makeFort(0, 0, 5, null), far = makeShip('sloop', 0, MORTAR.range + 5, 0, 0);
  assert.equal(fireMortar(f, far, 10), null, 'no mortar out of range');
  const pir = makeShip('sloop', 0, 30, 0, 0), navy = makeShip('sloop', 1, 30, 1, 0);
  const sl = fireMortar(f, pir, 0);
  assert.ok(sl && sl.x === 30, 'mortar did not fire');
  assert.equal(fireMortar(f, pir, MORTAR.reload - 0.1), null, 'mortar reload not enforced');
  while (!stepSlam(sl, 1 / 60, [pir, navy])) {}
  assert.ok(pir.hp === pir.maxHp - MORTAR.dmg && pir.lastHit === 1 && !pir.slowT, 'mortar should hit the pirate, without slowing her');
  assert.equal(navy.hp, navy.maxHp, 'mortar should spare the navy');
  for (const i of [0, 1, 2]) for (const turn of [0, 1]) {
    const p = makePlayer(i, 30, 0, 0);
    p.sail = 3; p.speed = p.maxSpeed;
    const sh = fireMortar(makeFort(0, 0, 5, null), p, 10);
    while (sh.t > 0) {
      if (sh.t <= MORTAR.t - 0.3) p.turnIn = turn;
      stepShip(p, 1 / 60);
      stepSlam(sh, 1 / 60, [p]);
    }
    assert.equal(p.hp < p.maxHp, !turn, `${PLAYER_SHIPS[i].name} ${turn ? 'turning hard should dodge the mortar' : 'holding course should be hit by the mortar'}`);
  }
}

// fort turret leads a moving ship and hits it
{
  const t = makeTurret(0, 7, 0);
  t.reload = 0;
  const tgt = makeShip('galleon', 0, 30, -10, Math.PI / 2);
  tgt.speed = 6;
  const b = fireTurret(t, tgt, 0, () => 0.5);
  assert.ok(b, 'turret did not fire');
  let ev = null;
  for (let i = 0; i < 600 && !ev; i++) { ev = stepBall(b, 1 / 60, [tgt]); tgt.x += Math.cos(tgt.h) * tgt.speed / 60; tgt.z += Math.sin(tgt.h) * tgt.speed / 60; }
  assert.ok(ev && ev.hit === tgt, 'turret missed a predictable target');
}

// waves grow gently (lone sloop first, no galleon before wave 4); upgrades change stats
{
  const n = (k) => waveSpec(k, () => 0).length;
  assert.ok(n(5) > n(1));
  for (let i = 0; i < 50; i++) {
    assert.deepEqual(waveSpec(1), ['sloop'], 'wave 1 is a lone sloop');
    assert.ok(!waveSpec(3).includes('galleon'), 'no galleon before wave 4');
  }
  for (const u of UPGRADES) {
    const s = makeShip('galleon', 0);
    const before = JSON.stringify(s);
    applyUpgrade(s, u.id);
    assert.notEqual(JSON.stringify(s), before, u.id);
  }
}
// player ships: real trade-offs (fastest has the least hull, toughest the most guns)
{
  const [w, c, l] = [0, 1, 2].map((i) => makePlayer(i));
  assert.ok(w.maxSpeed > c.maxSpeed && c.maxSpeed > l.maxSpeed);
  assert.ok(w.maxHp < c.maxHp && c.maxHp < l.maxHp && l.hp === l.maxHp);
  assert.ok(w.cannons < l.cannons && w.reloadTime < l.reloadTime);
  assert.equal(fireBroadside(l, 1).length, 6);
}
// hull regen: only after REGEN_DELAY s without damage, reset by hits, enemies never regen, upgradeable
{
  const p = makePlayer(1), e = makeShip('brig', 1);
  p.hp = e.hp = 50;
  for (let t = 0; t < REGEN_DELAY - 0.5; t += 0.1) { regenShip(p, 0.1); regenShip(e, 0.1); }
  assert.equal(p.hp, 50, 'regen before delay');
  for (let t = 0; t < 2; t += 0.1) { regenShip(p, 0.1); regenShip(e, 0.1); }
  assert.ok(p.hp > 50, 'no regen after delay');
  assert.equal(e.hp, 50, 'enemy regenerated');
  damage(p, 1);
  const hp = p.hp;
  regenShip(p, 0.1);
  assert.equal(p.hp, hp, 'hit did not reset regen timer');
  const r = p.regen;
  applyUpgrade(p, 'regen');
  assert.ok(p.regen > r);
}
// every gun, even a range-upgraded Leviathan, hits a target abeam at any distance up to its range (no lob over)
for (const range of [26, 36, 36 * 1.15 ** 2]) {
  for (let d = 8; d <= range * 0.9; d += 3) {
    const s = makePlayer(2), tgt = Object.assign(makeShip('brig', 1, 0, d, 0), { hp: 1e9 }); // unsinkable: her heavy guns would sink the brig before the last ball lands
    s.range = range;
    const hits = fireBroadside(s, 1, r0).filter((b) => { for (let i = 0; i < 600; i++) { const ev = stepBall(b, 1 / 120, [tgt]); if (ev) return ev.hit; } }).length;
    assert.equal(hits, s.cannons, `range ${range.toFixed(0)} missed a target at ${d}`);
  }
}
// skills: per-ship kits, cooldowns, ammo, nova ring, brace, keg, learn/level cards
{
  const kits = PLAYER_SHIPS.map((p) => p.skills.join());
  assert.equal(new Set(kits).size, 3, 'ships share a skill kit');
  const shoot = (s, tgt) => { for (const b of fireBroadside(s, 1, r0)) for (let i = 0; i < 600; i++) if (stepBall(b, 1 / 120, [tgt])) break; };
  // chain (Corsair slot 0): armed → next broadside slows; cooldown blocks a recast
  const c = makePlayer(1), t1 = makeShip('brig', 1, 0, 15, 0);
  assert.ok(useSkill(c, 0));
  assert.equal(useSkill(c, 0), null, 'cooldown ignored');
  assert.equal(c.ammo.id, 'chain');
  shoot(c, t1);
  assert.equal(c.ammo, null, 'ammo not consumed');
  assert.ok(t1.slowT > 0);
  t1.sail = 3; t1.speed = 10;
  const t2 = makeShip("brig", 1, 0, 50, 0); t2.sail = 3; t2.speed = 10;
  for (let i = 0; i < 120; i++) { stepShip(t1, 1 / 60); stepShip(t2, 1 / 60); }
  assert.ok(t1.speed < t2.speed * 0.7, 'chain shot did not slow');
  // fire (Corsair slot 1): burns over time, then stops
  const t3 = makeShip('galleon', 1, 0, 15, 0);
  c.reload.star = 0;
  useSkill(c, 1);
  shoot(c, t3);
  const afterHit = t3.hp;
  for (let i = 0; i < 60; i++) stepShip(t3, 1 / 60);
  assert.ok(t3.hp < afterHit - 2, 'fire did not burn');
  for (let i = 0; i < 60 * 10; i++) stepShip(t3, 1 / 60);
  const burnt = t3.hp;
  for (let i = 0; i < 60; i++) stepShip(t3, 1 / 60);
  assert.equal(t3.hp, burnt, 'fire never stops');
  // nova (Leviathan slot 0): ring of balls covering every quadrant; brace (slot 1) cuts damage
  const l = makePlayer(2);
  const { balls } = useSkill(l, 0);
  assert.equal(balls.length, 10);
  assert.equal(new Set(balls.map((b) => `${Math.sign(Math.round(b.ox * 10))},${Math.sign(Math.round(b.oz * 10))}`)).size >= 4, true, 'nova not all around');
  useSkill(l, 1);
  damage(l, 10);
  assert.ok(Math.abs(l.maxHp - l.hp - 4) < 1e-9, 'brace did not cut damage');
  // keg (Wasp slot 1): ignores own team, blows on an enemy, expires
  const w = makePlayer(0, 0, 0, 0);
  const { keg } = useSkill(w, 1);
  const friend = makeShip('sloop', 0, keg.x, keg.z), foe = makeShip('brig', 1, keg.x + 3, keg.z);
  assert.equal(stepKeg({ ...keg }, 0.1, [friend]), null);
  assert.equal(stepKeg(keg, 0.1, [friend, foe]), 'boom');
  assert.ok(foe.hp < foe.maxHp && friend.hp === friend.maxHp);
  assert.equal(stepKeg({ ...keg, life: 0.05 }, 0.1, []), 'gone');
  // cards: first is a skill card; learn adds a slot (max 4), lvl caps at 3
  const p = makePlayer(1);
  for (let i = 0; i < 20; i++) assert.match(rollUpgrades(p)[0].id, /^(learn|lvl):/);
  applyUpgrade(p, 'learn:boost'); applyUpgrade(p, 'learn:repair');
  assert.equal(p.skills.length, 4);
  for (let i = 0; i < 20; i++) assert.ok(!rollUpgrades(p).some((u) => u.id.startsWith('learn:')));
  applyUpgrade(p, 'lvl:fire'); applyUpgrade(p, 'lvl:fire');
  assert.equal(p.skills[1].lvl, 3);
  for (let i = 0; i < 20; i++) assert.ok(!rollUpgrades(p).some((u) => u.id === 'lvl:fire'));
}
// the fort can be shot (balls aimed at its walls hit it)
{
  const f = makeFort(0, 20, 5.2), s = makePlayer(1);
  for (const b of fireBroadside(s, 1, r0)) for (let i = 0; i < 600; i++) if (stepBall(b, 1 / 120, [f])) break;
  assert.ok(f.hp < f.maxHp, 'fort cannot be hit');
}
// a fort on its real island: the island doesn't swallow balls fired at the fort, nor the fort's own shots
{
  const I = ISLANDS.find((i) => i.kind === 'fort'), f = makeFort(I.x, I.z, 5.2, I);
  const s = makePlayer(1);
  Object.assign(s, { x: I.x - 30, z: I.z, h: -Math.PI / 2 }); // fort abeam to starboard
  for (const b of fireBroadside(s, 1, r0)) for (let i = 0; i < 1200; i++) if (stepBall(b, 1 / 120, [f])) break;
  assert.ok(f.hp < f.maxHp, 'fort on its island cannot be hit');
  const t = makeTurret(I.x - 4.3, 7, I.z);
  t.reload = 0;
  const tgt = makeShip('brig', 0, I.x - 35, I.z, 0);
  const b = fireTurret(t, tgt, 0, () => 0.5);
  let ev = null;
  for (let i = 0; i < 600 && !ev; i++) ev = stepBall(b, 1 / 60, [tgt, f]);
  assert.ok(ev && ev.hit === tgt, 'fort shot stopped by its own island');
}
// merchants: progression, flee, escape, only armed ones fight back once hit
{
  assert.equal(merchantSpec(1).length, 0);
  assert.equal(merchantSpec(2).length, 1);
  for (let k = 3; k <= 10; k++) assert.ok(merchantSpec(k, () => 0.5).length >= merchantSpec(k - 1, () => 0.5).length);
  for (let i = 0; i < 50; i++) {
    for (const m of merchantSpec(4)) assert.ok(!m.armed && m.type !== 'galleon');
    for (const m of merchantSpec(7)) assert.ok(m.armed && m.escort === (m.type === 'galleon'));
  }
  // flees a nearby stationary player
  const pl = makeShip('brig', 0, 0, 0, 0);
  const m = makeMerchant('sloop', 20, 0, Math.PI, false, { x: -100, z: 0 });
  for (let i = 0; i < 600; i++) { assert.equal(merchantSteer(m, pl, 1 / 60), 0); stepShip(m, 1 / 60); }
  assert.ok(Math.hypot(m.x, m.z) > 30, 'merchant did not flee');
  // unbothered: reaches its waypoint, never inside an island
  const far = { ...pl, x: 999, z: 999 };
  const r = makeMerchant('brig', ISLANDS[0].x + 40, ISLANDS[0].z, Math.PI, false, { x: ISLANDS[0].x - 40, z: ISLANDS[0].z });
  let ev = 0;
  for (let i = 0; i < 60 * 60 && ev !== 'escaped'; i++) {
    ev = merchantSteer(r, far, 1 / 60);
    stepShip(r, 1 / 60);
    for (const I of ISLANDS) assert.ok(Math.hypot(r.x - I.x, r.z - I.z) > I.r * 0.85, 'merchant inside island');
  }
  assert.equal(ev, 'escaped');
  // unarmed never fires, armed only after being hit
  const tgt = makeShip('brig', 0, 0, 15, 0);
  const u = makeMerchant('brig', 0, 0, 0, false, { x: 100, z: 0 }), a = makeMerchant('brig', 0, 0, 0, true, { x: 100, z: 0 });
  assert.equal(merchantSteer(a, tgt, 0.1), 0);
  damage(u, 1); damage(a, 1);
  assert.equal(merchantSteer(u, tgt, 0.1), 0);
  assert.equal(merchantSteer(a, tgt, 0.1), 1, 'armed merchant does not fight back');
  assert.equal(makeMerchant('sloop', 0, 0, 0, false, {}).gold, 30);
}
// crew: bleeds with hull, slows reload; boarding: auto below 20%, rounds decided by timing precision
{
  const p = makePlayer(1);
  damage(p, 50);
  assert.ok(Math.abs(p.crew - (34 - 0.5 * 34 * 0.6)) < 1e-9, 'crew not lost with hull');
  assert.ok(crewMul(p) > 1);
  fireBroadside(p, 1, r0);
  assert.ok(p.reload.star > p.reloadTime, 'short crew did not slow reload');
  damage(p, 1e9);
  assert.ok(p.crew >= 1);
  const me = makePlayer(1), brig = makeShip('brig', 1, 6, 0, 0);
  assert.ok(canBoard(me, brig));
  assert.ok(!canBoard(me, makeShip('brig', 1, 40, 0, 0)), 'boarded from afar');
  assert.ok(!canBoard(me, makeShip('brig', 0, 6, 0, 0)), 'boarded a friend');
  assert.ok(!canBoard(me, makeFort(6, 0, 5)), 'boarded the fort');
  me.boardCd = 3;
  assert.ok(!canBoard(me, brig), 'cooldown ignored');
  brig.hp = brig.maxHp * 0.15;
  assert.equal(startBoarding(me, brig).auto, true);
  const rounds = (q) => { const b = startBoarding(me, makeShip('brig', 1)); let r; while (!(r = boardRound(b, q)) && b.round < 50); return [r, b.round, b]; };
  const [r1, n1] = rounds(1), [r3, n3] = rounds(0.3), [rMiss, , b0] = rounds(0);
  assert.equal(r1, 'won'); assert.ok(n1 <= 6, 'perfect boarding too long: ' + n1);
  assert.equal(r3, 'won'); assert.ok(n3 > n1, 'precision does not matter');
  assert.equal(rMiss, "lost"); assert.ok(b0.you < me.crew && b0.them > 20);
  const rw = captureReward(makePlayer(1), makeShip('brig', 1), { start: 24 });
  assert.equal(rw.gold, 40);
  const q = makePlayer(0); applyUpgrade(q, 'crew'); assert.equal(q.maxCrew, 32);
}

// multiplayer: bigger co-op waves (still ≤ 8), boarding by team, kill credit
{
  const r = () => 0.5;
  for (const k of [2, 5, 9]) {
    assert.ok(waveSpec(k, r, 2.2).length >= waveSpec(k, r).length, 'co-op wave smaller than solo');
    assert.ok(waveSpec(k, r, 2.2).length <= 8, 'co-op wave over cap');
  }
  const a = Object.assign(makePlayer(0, 0, 0, 0), { team: 10 }), b = Object.assign(makePlayer(1, 5, 0, 0), { team: 11, isPlayer: true });
  assert.ok(!canBoard(a, b), 'boarded another player');
  assert.ok(canBoard(a, makeShip('brig', 0, 5, 0, 0)), 'team 0 ship not boardable by team 10');
  const tgt = makeShip('galleon', 11, 0, 26, 0);
  for (const ball of fireBroadside(a, 1, r)) for (let i = 0; i < 400; i++) if (stepBall(ball, 1 / 60, [a, tgt])) break;
  assert.equal(tgt.lastHit, 10, 'no kill credit');
}
// convoy mode: spec ramp, delivered gold buys escorts, navy + merchants allied, guards hold station, the crossing
{
  assert.equal(convoySpec(1).length, 2);
  for (let k = 2; k <= 30; k++) assert.ok(convoySpec(k).length >= convoySpec(k - 1).length && convoySpec(k).length <= 5);
  for (let i = 0; i < 50; i++) {
    for (const m of convoySpec(2)) assert.ok(m.type === 'sloop' && !m.armed);
    for (const m of convoySpec(4)) assert.ok(m.type !== 'galleon' && m.armed);
  }
  const r = () => 0; // always the cheapest ship: one sloop per budget point
  assert.deepEqual(waveSpec(3, r, 1, 0), waveSpec(3, r));
  assert.equal(waveSpec(3, r, 1, 2).length, waveSpec(3, r).length + 2, 'delivered gold buys no escort');
  assert.equal(waveSpec(3, r, 1, 99).length, 8, 'escort cap');
  // allies: a navy broadside passes through a merchant, and they bump without ram damage
  const navy = makeShip('brig', 1, 0, 0, 0), mer = makeMerchant('brig', 0, 8, 0, false, { x: 100, z: 0 }), pir = makeShip('brig', 0, 0, 16, 0);
  for (const ball of fireBroadside(navy, 1, () => 0.5)) for (let i = 0; i < 400; i++) if (stepBall(ball, 1 / 60, [navy, mer, pir])) break;
  assert.equal(mer.hp, mer.maxHp, 'navy shot its own merchant');
  assert.ok(pir.hp < pir.maxHp, 'the broadside missed the pirate behind');
  const a = makeShip('brig', 1, 0, 0, 0), b = makeMerchant('brig', 5, 0, Math.PI, false, { x: -100, z: 0 });
  a.speed = b.speed = 8;
  assert.equal(collideShips([a, b]).length, 0);
  assert.equal(a.hp + b.hp, a.maxHp + b.maxHp, 'escort rammed its merchant');
  // the convoy map: a merchant crosses port to port clear of every island, its guard stays alongside
  setMap('convoy');
  assert.ok(ISLANDS.length <= 8 && BOUNDS.x === 200 && BOUNDS.z === 70);
  const [from, to] = ISLANDS.filter((I) => I.kind === 'port');
  assert.ok(from.name && to.name && ISLANDS.some((I) => I.kind === 'fort'));
  const far = makeShip('brig', 0, 999, 999, 0);
  const m = Object.assign(makeMerchant('galleon', from.x + 28, 0, 0, false, { x: to.x - 28, z: 0 }), { maxAge: Infinity, sail: 2 });
  const g = Object.assign(makeShip('brig', 1, from.x + 28, 9, 0), { station: 12 });
  let ev = 0, t = 0;
  for (; t < 60 * 400 && ev !== 'escaped'; t++) {
    ev = merchantSteer(m, far, 1 / 60);
    assert.equal(guardSteer(g, m, far), 0, 'guard fired at nobody');
    stepShip(m, 1 / 60); stepShip(g, 1 / 60);
    for (const I of ISLANDS) assert.ok(Math.hypot(m.x - I.x, m.z - I.z) > I.r * 0.85, 'merchant inside island');
    if (t > 600) assert.ok(Math.hypot(g.x - m.x, g.z - m.z) < 22, 'guard lost its ward');
  }
  assert.equal(ev, 'escaped', 'the convoy never made port');
  // the leash: a pirate far from the ward is ignored, one beside it is fought
  const w = makeMerchant('brig', 0, 0, 0, false, { x: 150, z: 0 }), gd = Object.assign(makeShip('brig', 1, 0, 12, 0), { station: 12 });
  const lure = makeShip('brig', 0, 0, 12 + 20, 0), near = makeShip('brig', 0, 0, 12 + 15, 0);
  lure.x = 60; // within the guard's guns' reach of nothing: 60 from the ward
  assert.equal(guardSteer(gd, w, lure), 0, 'guard left its ward for a distant pirate');
  assert.notEqual(guardSteer(gd, w, near), 0, 'guard ignored a pirate beside its ward');
  assert.notEqual(guardSteer(gd, null, near), 0, 'a guard with no ward does not hunt');
  const sniper = makeShip('brig', 0, 0, 47, 0); // 47 from the ward, 27 from a guard off station: in its guns' reach
  gd.z = 20;
  assert.notEqual(guardSteer(gd, w, sniper), 0, 'guard never fires back at a pirate shelling it from outside the leash');
  setMap('waves');
  assert.deepEqual(ISLANDS, MAPS.waves.islands);
  assert.equal(BOUNDS.x, 120);
}
// net.js against a fake Peer: joins that overlap (all offers in before any channel opens) can't pass the cap
{
  const peers = [];
  globalThis.Peer = class { h = {}; constructor() { peers.push(this); } on(e, f) { this.h[e] = f; } };
  const si = globalThis.setInterval;
  globalThis.setInterval = () => 0; // hostRoom's timeout sweep would keep node alive
  const { hostRoom, MAX_PLAYERS } = await import('./net.js');
  const joined = [];
  globalThis.fetch = () => Promise.reject(new Error('offline')); // no relay service: PeerJS defaults
  hostRoom({ open() {}, join: (id) => joined.push(id), msg() {}, leave() {}, error() {} });
  globalThis.setInterval = si;
  await new Promise((r) => setTimeout(r)); // the Peer is made once the ICE fetch settles
  const conns = Array.from({ length: 5 }, () => { const h = {}; return { h, open: true, on: (e, f) => (h[e] = f), close() {} }; });
  for (const c of conns) peers[0].h.connection(c);
  for (const c of conns) c.h.open();
  assert.equal(joined.length, MAX_PLAYERS - 1, 'overlapping joins passed the player cap');
}

// --- boss mode (bossfight.js) ---------------------------------------------------
{
  setMap('waves');
  const ids = Object.keys(BOSS), DT = 1 / 30;
  const seeded = (n) => () => ((n = (n * 1103515245 + 12345) % 2147483648) / 2147483648);
  // the run: all twelve once, Poseidon last, the rest in the order drawn
  const order = bossOrder(seeded(1));
  assert.equal(order.length, 12);
  assert.deepEqual([...order].sort(), [...ids].sort(), 'every boss is met exactly once');
  assert.equal(order[11], 'poseidon', 'Poseidon comes last');
  assert.notDeepEqual(order, bossOrder(seeded(2)), 'another draw, another order');
  // the later a boss is met, the stronger it is
  for (const id of ids) for (let l = 2; l <= 12; l++) {
    const a = makeBoss(id, l - 1), b = makeBoss(id, l);
    assert.ok(b.maxHp > a.maxHp && b.hp === b.maxHp && b.pow > a.pow && b.pace <= a.pace && b.adds >= a.adds && b.dmgMul > a.dmgMul, `${id} should be stronger at level ${l}`);
  }
  assert.equal(makeBoss('whale', 11).maxHp, Math.round(600 * (1 + SCALE.hp * 10)));
  assert.equal(canBoard(Object.assign(makePlayer(0), { x: 1 }), makeBoss('junk')), false, 'a boss is not boarded');

  // a whole fight, the way game.js runs it: the boss's effects become balls, zones, kegs and ships
  function fight(id, lvl, secs, pilot, at = [40, 10, Math.PI]) {
    const rand = seeded(7), p = makePlayer(2), b = makeBoss(id, lvl, ...at), all = [p, b], balls = [], slams = [], kegs = [], seen = { spawn: [], say: [], slams: 0, balls: 0, kegs: 0, ghost: 0 };
    p.sail = 2;
    for (let t = 0; t < secs; t += DT) {
      pilot?.(p, b, t);
      const out = bossStep(b, DT, { target: p, ships: all, rand });
      if (out.fire) balls.push(...fireBroadside(b, out.fire, rand));
      balls.push(...out.balls); slams.push(...out.slams); kegs.push(...out.kegs);
      seen.spawn.push(...out.spawn); seen.slams += out.slams.length; seen.kegs += out.kegs.length; seen.ghost += b.ghost ? DT : 0;
      if (out.say) seen.say.push(out.say);
      for (const s of all) stepShip(s, DT);
      collideShips(all);
      for (let i = balls.length - 1; i >= 0; i--) { const q = balls[i]; if ((q.delay -= DT) > 0) continue; seen.balls++; if (stepBall(q, DT, all)) balls.splice(i, 1); else seen.balls--; }
      for (let i = slams.length - 1; i >= 0; i--) if (stepSlam(slams[i], DT, all)) slams.splice(i, 1);
      for (let i = kegs.length - 1; i >= 0; i--) if (stepKeg(kegs[i], DT, all)) kegs.splice(i, 1);
      for (const s of all) assert.ok([s.x, s.z, s.h, s.hp, s.speed].every(Number.isFinite), `${id}: a number went bad at ${t.toFixed(1)} s`);
      assert.ok(Math.abs(b.x) <= BOUNDS.x && Math.abs(b.z) <= BOUNDS.z, `${id} left the chart`);
    }
    return { p, b, seen };
  }
  // every boss, first and last level: 90 s against a Leviathan sailing a lazy circle. Nothing breaks, and it hurts her.
  // (Atocha runs instead; Aspidochelone has to be woken.)
  for (const id of ids) for (const lvl of [1, 12]) {
    const { p, b, seen } = fight(id, lvl, 90, (p, b, t) => { p.turnIn = 0.3; if (id === 'island' && t === 0) damage(b, 1); });
    if (id === 'atocha') assert.ok(seen.spawn.length >= 2 + b.adds && seen.spawn.every((s) => s.guard && s.type === 'brig') && b.dest, 'Atocha sails with an escort');
    else assert.ok(p.hp < p.maxHp, `${id} level ${lvl} never hurt the pirate`);
  }

  // the serpent's rise, a marked zone bigger than the mortar's: still cleared by a hard turn 0.3 s in, not by holding course
  for (const id of ['serpent']) for (const i of [0, 1, 2]) for (const turn of [0, 1]) {
    const p = makePlayer(i, 30, 0, 0), b = makeBoss(id, 12, 0, 40, 0);
    p.sail = 3; p.speed = p.maxSpeed;
    b.tm.dive = 0; b.tm.bite = b.tm.charge = 99;
    bossStep(b, 0, { target: p, ships: [p, b] }); // it dives; the frame after, the zone is marked
    const [sl] = bossStep(b, 0, { target: p, ships: [p, b] }).slams, t0 = sl.t;
    assert.ok(b.ghost && b.hidden, `${id} should be under water`);
    while (sl.t > 0) {
      if (sl.t <= t0 - 0.3) p.turnIn = turn;
      stepShip(p, 1 / 60);
      bossStep(b, 1 / 60, { target: p, ships: [p, b] });
      stepSlam(sl, 1 / 60, [p, b]);
    }
    assert.equal(p.hp < p.maxHp, !turn, `${PLAYER_SHIPS[i].name} ${turn ? 'turning hard should dodge' : 'holding course should be hit by'} ${id}'s breach`);
    assert.ok(!b.ghost && !b.hidden && Math.hypot(b.x - sl.x, b.z - sl.z) < 1e-6, `${id} should come up where it struck`);
  }

  // Moby Dick's breach: under water first with nothing on the water, then a late mark under the bow. A hard turn within a third of
  // a second clears the blow in every player ship, a slow one does not; the wave still reaches whoever dodged, weaker with distance.
  for (const i of [0, 1, 2]) for (const react of [0.3, 0.5, Infinity]) {
    const p = makePlayer(i, 30, 0, 0), b = makeBoss('whale', 1, 0, 40, 0), ctx = { target: p, ships: [p, b] };
    p.sail = 3; p.speed = p.maxSpeed;
    b.tm.dive = 0; b.tm.charge = 99;
    let sl, quiet = 0, warned = 0;
    for (let t = 0; t < 8; t += 1 / 60) {
      sl ??= bossStep(b, 1 / 60, ctx).slams[0];
      if (!sl) { quiet += 1 / 60; assert.ok(b.ghost && b.hidden, 'the whale should be under water before the mark shows'); stepShip(p, 1 / 60); continue; }
      if ((warned += 1 / 60) >= react) p.turnIn = 1;
      stepShip(p, 1 / 60);
      if (stepSlam(sl, 1 / 60, [p, b])) break;
      bossStep(b, 1 / 60, ctx);
    }
    const name = PLAYER_SHIPS[i].name, lost = p.maxHp - p.hp, d = Math.hypot(p.x - sl.x, p.z - sl.z);
    assert.ok(quiet > 0.8 && Math.abs(warned - BREACH.warn(p)) < 0.05 && Math.abs(quiet + warned - BREACH.down) < 0.05, `${name}: the mark should show late, ${BREACH.warn(p).toFixed(2)} s before the breach`);
    assert.ok(sl.from === null, 'nothing is lobbed at a breach: no shell for game.js to draw');
    if (react === 0.3) assert.ok(lost > 0 && lost < BREACH.wave.dmg && Math.abs(lost - BREACH.wave.dmg * (1 - d / BREACH.wave.r)) < 1e-6, `${name} turning at once should take the wave only, by her distance: ${lost.toFixed(1)}`);
    else assert.ok(lost > BREACH.dmg, `${name} ${react === 0.5 ? 'turning late' : 'holding course'} should take the breach: ${lost.toFixed(1)}`);
  }
  // the wave alone: weaker the further off, nothing past its reach, the whale's own side spared
  {
    const at = (d, team = 0) => { const s = makeShip('brig', team, d, 0, 0); stepSlam({ x: 0, z: 0, t: 0, r: 3, dmg: 30, team: 1, wave: { r: 16, dmg: 18 } }, 0.1, [s]); return s.maxHp - s.hp; };
    assert.ok(at(0) === 48 && Math.abs(at(8) - 9) < 1e-9 && Math.abs(at(12) - 4.5) < 1e-9 && at(16) === 0 && at(20) === 0 && at(8, 1) === 0, 'shock wave falloff');
  }

  // shell (Yi Sun-sin): a ball on her flank is mostly stopped, one in her stern third is not
  {
    const hit = (x) => { const b = makeBoss('turtle'), ball = { x, y: 1, z: 0, vx: 0, vy: 0, vz: 0, team: 0, dmg: 10, x0: 50, z0: 50 }; stepBall(ball, 0.001, [b]); return b.maxHp - b.hp; };
    assert.ok(Math.abs(hit(3) - 10 * SHELL) < 1e-9 && Math.abs(hit(0) - 10 * SHELL) < 1e-9, 'the shell stops a ball forward of the stern');
    assert.ok(Math.abs(hit(-4) - 10) < 1e-9, 'her stern is soft');
  }
  // ghost (the Dutchman spectral, anything under water): balls, zones, kegs and hulls pass through, islands do not stop her
  {
    const g = Object.assign(makeBoss('dutchman', 1, 0, 0, 0), { ghost: true }), p = makePlayer(1, 1, 0, 0);
    assert.equal(stepBall({ x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, team: 0, dmg: 10, x0: 50, z0: 50 }, 0.001, [g]), null, 'a ball passes through a ghost');
    stepSlam({ x: 0, z: 0, t: 0, r: 5, dmg: 10, team: 3 }, 0.1, [g]);
    assert.equal(stepKeg({ x: 0, z: 0, team: 0, r: 6, dmg: 25, life: 5 }, 0.1, [g]), null, 'a keg does not see a ghost');
    assert.equal(collideShips([g, p]).length, 0);
    assert.ok(g.hp === g.maxHp && g.x === 0 && p.x === 1, 'nothing touches a ghost');
    const I = ISLANDS[0];
    Object.assign(g, { x: I.x + 1, z: I.z });
    stepShip(g, 0.01);
    assert.ok(Math.hypot(g.x - I.x, g.z - I.z) < 2, 'a ghost sails through an island');
    g.ghost = false;
    stepShip(g, 0.01);
    assert.ok(Math.hypot(g.x - I.x, g.z - I.z) > I.r * 0.8, 'solid again, the shore pushes her out');
  }
  // the Dutchman: solid, spectral, solid again on the pirate's beam and clear of every island
  {
    const { b, seen } = fight('dutchman', 1, 40, (p) => { p.turnIn = 0.3; p.hp = p.maxHp; }); // kept afloat: a sunk pirate ends the fight
    assert.ok(seen.ghost > 8 && seen.ghost < 20 && seen.say.includes('SHE FADES'), 'she should spend part of the fight spectral: ' + seen.ghost.toFixed(1));
    assert.ok(!ISLANDS.some((I) => Math.hypot(b.x - I.x, b.z - I.z) < I.r), 'she must not end up inside an island');
  }
  // fixed (Scylla's rock): the hull that runs into it takes the whole push
  {
    const s = makeBoss('charybdis', 1, 0, 0, 0), p = makePlayer(0, 4, 0, Math.PI);
    collideShips([s, p]);
    assert.ok(s.x === 0 && s.z === 0 && Math.abs(p.x - (s.len + p.len) * 0.32) < 1e-9, 'the rock does not move, the ship is pushed clear');
  }
  // Charybdis: a ship adrift near the whirlpool is dragged into it; every player ship under full sail gets out from the rim of the maw
  {
    ISLANDS.length = 0; // open water: a ship holding one course must not run aground on the way out
    const s = makeBoss('charybdis', 1, 0, 0, 0), cx = -PULL.d, adrift = makePlayer(0, cx + 25, 0, 0);
    const d0 = Math.abs(adrift.x - cx);
    for (let t = 0; t < 20; t += DT) { bossStep(s, DT, { target: adrift, ships: [s, adrift] }); stepShip(adrift, DT); }
    assert.ok(Math.hypot(adrift.x - cx, adrift.z) < d0 - 10, 'a ship adrift should be pulled in');
    for (const i of [0, 1, 2]) {
      const p = makePlayer(i, cx, -(PULL.maw + 2), -Math.PI / 2); // just outside the maw, bow pointing away from it
      p.sail = 3; p.speed = p.maxSpeed * 0.7; // she came in under sail
      for (let t = 0; t < 30; t += DT) { bossStep(s, DT, { target: p, ships: [s, p] }); stepShip(p, DT); p.hp = p.maxHp; } // the pull alone: Scylla's bites are another matter
      assert.ok(Math.hypot(p.x - cx, p.z) > PULL.r, `${PLAYER_SHIPS[i].name} under full sail should escape the whirlpool`);
    }
    setMap('waves');
  }
  // Scylla: a head lunges at a ship close by; one standing off, even past any gun's range, is spat at (a lobbed shot, from her)
  {
    const first = (d) => { const s = makeBoss('charybdis', 1, 0, 0, 0), p = makePlayer(2, d, 0, Math.PI / 2); return bossStep(s, DT, { target: p, ships: [s, p] }).slams; };
    const bites = first(BITE.r - 4), spits = first(40), reach = Math.max(...PLAYER_SHIPS.map((p) => p.stats.range)), [bite] = bites, [spit] = spits;
    assert.ok(bites.length === BITE.heads && bites.every((z) => z.head && z.from === null && z.dmg === BITE.dmg && z.t === bite.t), 'close by, all six heads bite, together');
    assert.ok(spits.length === BITE.heads && spits.every((z) => z.head && z.from && z.dmg === BITE.spit) && spit.dmg < bite.dmg, 'further off, all six spit');
    assert.ok(Math.hypot(bite.x - (BITE.r - 4), bite.z) < 0.5 && bites.slice(1).every((z) => { const r = Math.hypot(z.x - bite.x, z.z - bite.z); return r >= BITE.scatter[0] && r <= BITE.scatter[1]; }), 'one where she is, five round it');
    assert.ok(makeBoss('charybdis').range > reach + 8 && !first(makeBoss('charybdis').range + 2).length, 'her reach beats every pirate gun, and ends');
  }
  // Poseidon's trident: a fan of bolts of uneven lengths, one of them through where the pirate is headed, the rows a lane apart
  {
    const s = makeBoss('poseidon', 1, 0, 0, 0), p = makePlayer(2, 30, 0, Math.PI / 2), rand = seeded(3);
    s.tm.trident = 0; s.tm.tide = 99;
    const zs = bossStep(s, DT, { target: p, ships: [s, p], rand }).slams, rows = new Map();
    for (const z of zs) { const a = Math.round(Math.atan2(z.z, z.x) * 1e6); rows.set(a, [...(rows.get(a) || []), Math.hypot(z.x, z.z)]); }
    const angles = [...rows.keys()].sort((a, b) => a - b).map((a) => a / 1e6), lens = [...rows.values()].map((r) => Math.max(...r));
    assert.equal(rows.size, TRIDENT.bolts, 'four bolts');
    assert.ok(new Set(lens.map((l) => Math.round(l))).size >= 3, 'of uneven lengths: ' + lens.map((l) => l.toFixed(0)));
    for (let i = 1; i < angles.length; i++) assert.ok((angles[i] - angles[i - 1]) * 30 >= TRIDENT.lane - 1e-6, 'a lane between two bolts where she is');
    const ahead = { x: p.x + Math.cos(p.h) * p.speed * 1.2, z: p.z + Math.sin(p.h) * p.speed * 1.2 };
    assert.ok(zs.some((z) => Math.hypot(z.x - ahead.x, z.z - ahead.z) < TRIDENT.gap / 2 + 0.1) && Math.max(...lens) > 30, 'one bolt runs through where she is headed, and past her');
    s.hp = s.maxHp * 0.4; s.tm.trident = 0;
    assert.equal(new Set(bossStep(s, DT, { target: p, ships: [s, p], rand }).slams.map((z) => Math.round(Math.atan2(z.z, z.x) * 1e6))).size, TRIDENT.bolts + 1, 'hurt, a fifth bolt');
  }
  // reinforcements: once at each threshold, more of them at a higher level
  {
    const call = (id, lvl, fr) => { const b = makeBoss(id, lvl, 40, 0, 0), p = makePlayer(0), n = []; for (const f of fr) { b.hp = b.maxHp * f; n.push(bossStep(b, DT, { target: p, ships: [p, b] }).spawn.length, bossStep(b, DT, { target: p, ships: [p, b] }).spawn.length); } return n; };
    assert.deepEqual(call('trinidad', 1, [0.9, 0.6, 0.3]), [0, 0, 2, 0, 2, 0]);
    assert.deepEqual(call('junk', 1, [0.9, 0.7, 0.4, 0.2]), [0, 0, 2, 0, 2, 0, 2, 0]);
    assert.deepEqual(call('junk', 9, [0.7]), [4, 0], 'two more junks per call at level 9');
  }
  // Aspidochelone sleeps until she is hit or approached
  {
    const b = makeBoss('island', 1, 60, 0, 0), p = makePlayer(0), ctx = { target: p, ships: [p, b] };
    for (let t = 0; t < 10; t += DT) assert.ok(!bossStep(b, DT, ctx).slams.length && !b.sail, 'asleep, she does nothing');
    damage(b, 1);
    assert.equal(bossStep(b, DT, ctx).say, 'THE ISLAND WAKES');
    const near = makeBoss('island', 1, 20, 0, 0);
    assert.equal(bossStep(near, DT, { target: p, ships: [p, near] }).say, 'THE ISLAND WAKES', 'a ship close by wakes her');
  }
}

// kraken (team 3): slams the nearest ship, player or not; every side's shot hurts it; it can't be boarded
{
  setMap('waves');
  for (const team of [0, 1, 2]) {
    const k = makeShip('kraken', 3, 0, 0, 0), tgt = makeShip('brig', team, 30, 0, 0);
    tgt.alive = true;
    const sl = krakenSteer(k, [k, tgt], r0);
    assert.ok(sl && Math.abs(sl.x - 30) < 1e-9, 'kraken should slam team ' + team);
    assert.equal(krakenSteer(k, [k, tgt], r0), null, 'slam reload not enforced');
  }
  const k = makeShip('kraken', 3, 0, 0, 0), far = makeShip('sloop', 0, 60, 0, 0);
  assert.equal(krakenSteer(k, [k, far], r0), null, 'no slam out of range');
  assert.equal(k.sail, 3, 'kraken closes in on a ship within 70');
  // a slam between a pirate and a navy ship hurts both, nobody gets the kill; a ship that sailed off is spared
  const pir = makeShip('sloop', 0, 0, 2, 0), navy = makeShip('sloop', 1, 0, -2, 0), gone = makeShip('sloop', 2, 20, 0, 0);
  const sl = { x: 0, z: 0, t: 0.1, r: 5, dmg: 18 };
  assert.equal(stepSlam(sl, 0.05, [pir, navy, gone]), null);
  assert.equal(stepSlam(sl, 0.1, [pir, navy, gone]), 'slam');
  assert.ok(pir.hp < pir.maxHp && navy.hp < navy.maxHp && pir.lastHit === 3);
  assert.equal(gone.hp, gone.maxHp);
  // a real dodge: abeam at full sail, a hard turn 0.3 s into the telegraph clears the slam in every player ship; holding course doesn't
  for (const i of [0, 1, 2]) for (const turn of [0, 1]) {
    const kr = makeShip('kraken', 3, -40, -100, 0), p = makePlayer(i, -40, -70, 0);
    p.sail = 3; p.speed = p.maxSpeed;
    const sl = krakenSteer(kr, [kr, p], r0);
    for (let t = 0; t < 3 && sl.t > 0; t += 1 / 60) {
      if (t >= 0.3) p.turnIn = turn;
      stepShip(p, 1 / 60);
      stepSlam(sl, 1 / 60, [p]);
    }
    assert.equal(p.hp < p.maxHp, !turn, `${PLAYER_SHIPS[i].name} ${turn ? 'turning hard should dodge' : 'holding course should be hit'}`);
  }
  // left alone, it always picks a wander point it can reach: off every island
  for (const m of ['waves', 'convoy']) {
    setMap(m);
    for (let i = 0; i < 300; i++) {
      const kr = makeShip('kraken', 3, 0, 0, 0);
      krakenSteer(kr, [kr]);
      assert.ok(!ISLANDS.some((I) => Math.hypot(kr.wander.x - I.x, kr.wander.z - I.z) < I.r + 10), 'wander point on an island (' + m + ')');
    }
  }
  setMap('waves');
  // pirate and navy broadsides both hit it
  for (const team of [0, 1]) {
    const s = makeShip('galleon', team, 0, 0, 0), kr = makeShip('kraken', 3, 0, 26, 0);
    for (const b of fireBroadside(s, 1, r0)) for (let i = 0; i < 400; i++) if (stepBall(b, 1 / 60, [s, kr])) break;
    assert.ok(kr.hp < kr.maxHp, 'team ' + team + ' should hit the kraken');
  }
  assert.equal(canBoard(makePlayer(0, 0, 0), makeShip('kraken', 3, 3, 0, 0)), false);
  assert.ok(krakenDue(false, 4) && !krakenDue(false, 5) && krakenDue(true, 3) && !krakenDue(true, 4));
}
// store.js: what the menus remember. A fake localStorage; without one (private window) every read is its default.
{
  const { store, cleanName, rollName, rebind, swapKeys, DEFAULT_KEYS, normRow, signLocal, boardOf } = await import('./store.js');
  Object.defineProperty(globalThis, 'localStorage', { value: undefined, writable: true, configurable: true }); // node's own warns when touched
  assert.equal(store.name, '');
  assert.equal(store.played, false);
  assert.deepEqual([store.lastMode, store.lastShip], ['waves', 'corsair']);
  assert.deepEqual(store.audio, { master: 8, music: 6, fx: 9, muted: false });
  assert.deepEqual(store.keys, DEFAULT_KEYS);
  assert.deepEqual(store.display, { hints: true });
  assert.deepEqual(signLocal('waves', { crew: [{ name: 'ANNE', ship: 'wasp' }], wave: 1, gold: 0, combo: 0, at: 1 }).rank, 0, 'a run is ranked even when it cannot be kept');
  const mem = new Map();
  globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
  mem.set('gallion-nick', 'jack42!'); // the old lobby field
  assert.equal(store.name, 'JACK');
  store.name = 'black beard the terrible';
  assert.equal(store.name, 'BLACKBEARDTH');
  assert.equal(cleanName('<b>x'), 'BX');
  for (let i = 0; i < 200; i++) assert.match(rollName(), /^[A-Z]{1,12}$/);
  mem.set('broadside.audio', '{"master":11,"music":"x","fx":0,"muted":true}'); // a bad value is its default, not a crash
  assert.deepEqual(store.audio, { master: 8, music: 6, fx: 0, muted: true });
  mem.set('broadside.keys', '{broken');
  assert.deepEqual(store.keys, DEFAULT_KEYS);
  // keys: reserved ones are refused, a taken one names its action, a swap trades the two
  assert.deepEqual(rebind(DEFAULT_KEYS, 'board', 'Escape'), { reserved: true });
  assert.deepEqual(rebind(DEFAULT_KEYS, 'board', 'F5'), { reserved: true });
  assert.deepEqual(rebind(DEFAULT_KEYS, 'fireStarboard', 'KeyC'), { conflict: 'overview' });
  assert.equal(rebind(DEFAULT_KEYS, 'fireStarboard', 'KeyE').keys.fireStarboard, 'KeyE', 'its own key is no conflict');
  const sw = swapKeys(DEFAULT_KEYS, 'fireStarboard', 'overview');
  assert.deepEqual([sw.fireStarboard, sw.overview], ['KeyC', 'KeyE']);
  store.keys = sw;
  assert.equal(store.keys.overview, 'KeyE');
  assert.deepEqual(JSON.parse(mem.get('broadside.keys')).overview, ['KeyE'], 'stored as code[]');
  // leaderboard rows from before names; this browser's old top 10s move to the new boards, crews apart
  assert.deepEqual(normRow({ ini: 'BLA', ship: 'Wasp', wave: 6, gold: 840, combo: 3, date: 5 }), { crew: [{ name: 'BLA', ship: 'wasp' }], wave: 6, gold: 840, combo: 3, at: 5 });
  assert.deepEqual(normRow({ ini: 'AAA+BBB', ship: 'Wasp+Corsair+Leviathan', wave: 2, gold: 1, combo: 0, date: 0 }).crew.map((c) => c.name + ':' + c.ship), ['AAA:wasp', 'BBB:corsair', 'PIRATE:leviathan']);
  assert.equal(normRow({ wave: 1 }), null);
  mem.delete('broadside.best');
  mem.set('broadside.scores', JSON.stringify([{ ini: 'AAA', ship: 'Wasp', wave: 5, gold: 10, combo: 1, date: 1 }, { ini: 'AAA', ship: 'Wasp+Corsair', wave: 9, gold: 10, combo: 1, date: 1 }]));
  assert.deepEqual([store.best.waves.length, store.best['waves-crew'].length, store.best.convoy.length], [1, 1, 0]);
  assert.equal(boardOf('convoy', 3), 'convoy-crew');
  // the play style adds up run after run; a count from a host is clamped
  store.style = { gun: 10, ram: 1e300, keg: -5, pb: 'x' };
  store.style = { gun: 5 };
  assert.deepEqual(store.style, { gun: 15, pb: 0, keg: 0, ram: 1e6, board: 0 });
  const run = (wave, gold) => ({ crew: [{ name: 'ANNE', ship: 'wasp' }], wave, gold, combo: 0, at: 0 });
  assert.equal(signLocal('waves', run(5, 20)).rank, 0, 'same wave: gold decides');
  assert.equal(signLocal('waves', run(4, 999)).rank, 2);
  for (let i = 0; i < 9; i++) signLocal('waves', run(7, i));
  assert.equal(signLocal('waves', run(1, 0)).rank, -1, 'off the top 10');
  assert.equal(store.best.waves.length, 10);
}
// wind: beam reach > running > dead upwind, never under 75%; Full sail ignores it; the kraken slam is still dodgeable upwind
{
  WIND.k = 1;
  setMap('waves');
  const top = (rel, boost) => {
    const s = makeShip('brig', 0, -40, -70, WIND.a + rel);
    s.sail = 3;
    for (let i = 0; i < 900; i++) { if (boost) s.boostT = 1; s.x = -40; s.z = -70; stepShip(s, 1 / 60); } // held in open water: only the speed matters
    return s.speed / s.maxSpeed;
  };
  const run = top(0), beam = top(Math.PI / 2), up = top(Math.PI);
  assert.ok(beam > run && run > up, `wind order: ${beam} ${run} ${up}`);
  assert.ok(Math.abs(run - 1) < 1e-9 && Math.abs(beam - 1.15) < 1e-9 && Math.abs(up - 0.75) < 1e-9, `wind factors: ${beam} ${run} ${up}`);
  for (let a = 0; a < 6.3; a += 0.1) assert.ok(windMul(a) >= 0.75 - 1e-9 && windMul(a) <= 1.15 + 1e-9, 'wind factor out of range');
  assert.equal(top(Math.PI, true), top(0, true), 'Full sail ignores the wind');
  const wa = WIND.a;
  WIND.a = Math.PI; // the dodge below sails h = 0: dead upwind
  for (const i of [0, 1, 2]) {
    const kr = makeShip('kraken', 3, -40, -100, 0), p = makePlayer(i, -40, -70, 0);
    p.sail = 3; p.speed = p.maxSpeed * 0.75;
    const sl = krakenSteer(kr, [kr, p], r0);
    for (let t = 0; t < 3 && sl.t > 0; t += 1 / 60) {
      if (t >= 0.3) p.turnIn = 1;
      stepShip(p, 1 / 60);
      stepSlam(sl, 1 / 60, [p]);
    }
    assert.equal(p.hp, p.maxHp, `${PLAYER_SHIPS[i].name} should dodge the slam upwind`);
  }
  WIND.a = wa;
}
// i18n: every key the code shows has a French text with the same {n} holes
{
  const { readFileSync } = await import('node:fs');
  const { FR, t, tn, say, setLang } = await import('./i18n.js');
  const keys = new Set();
  const STR = String.raw`'((?:[^'\\]|\\.)*)'`, un = (k) => k.replace(/\\(.)/g, '$1');
  for (const f of ['game.js', 'screens.js', 'ui.js', 'index.html', 'bossfight.js']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    for (const m of src.matchAll(new RegExp(String.raw`\bt[k]?\(\s*${STR}`, 'g'))) keys.add(un(m[1]));
    for (const m of src.matchAll(new RegExp(String.raw`\btn\([^,]+,\s*${STR},\s*${STR}`, 'g'))) keys.add(un(m[1])).add(un(m[2]));
    for (const m of src.matchAll(new RegExp(String.raw`\], ${STR}\]`, 'g'))) keys.add(un(m[1])); // [[keys], 'LABEL']: hint bars and KEY_ROWS, translated where they are drawn
    for (const m of src.matchAll(/data-t="([^"]+)"/g)) keys.add(m[1]);
  }
  for (const u of UPGRADES) keys.add(u.label);
  for (const k of Object.values(SKILLS)) keys.add(k.name).add(k.desc);
  for (const s of PLAYER_SHIPS) keys.add(s.blurb);
  assert.ok(keys.size > 300, 'the scan found too few keys: ' + keys.size);
  const holes = (x) => (x.match(/\{\d\}/g) || []).sort().join();
  for (const k of keys) {
    assert.ok(Object.hasOwn(FR, k), 'no French text for: ' + k);
    assert.equal(holes(FR[k]), holes(k), 'holes differ in the French text of: ' + k);
  }
  assert.deepEqual(Object.keys(FR).filter((k) => !keys.has(k)), [], 'French texts nothing shows any more');
  setLang('en');
  assert.equal(t('WAVE {0}', 3), 'WAVE 3');
  assert.equal(t('constructor'), 'constructor', 'a key is looked up among own entries only');
  setLang('fr');
  assert.equal(t('WAVE {0}', 3), 'VAGUE 3');
  assert.equal(t('NOT A KEY'), 'NOT A KEY', 'a missing entry falls back to English');
  assert.equal(say(['{0} SANK {1}', 'ANNE', 'KIDD']), 'ANNE A COULÉ KIDD');
  assert.equal(say('P2 WINS'), 'P2 WINS');
  assert.equal(tn(0, '{0} WINS · {1} SINKING', '{0} WINS · {1} SINKINGS', 'ANNE', 0), 'ANNE GAGNE · 0 NAVIRE COULÉ', 'French counts 0 as one');
  setLang('en');
  assert.equal(tn(0, '{0} WINS · {1} SINKING', '{0} WINS · {1} SINKINGS', 'ANNE', 0), 'ANNE WINS · 0 SINKINGS');
}
console.log('check ok');
