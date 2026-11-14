// node check.mjs — asserts on the pure sim, and on what the menus store.
import assert from 'node:assert/strict';
import { setMap, MAPS, BOUNDS, convoySpec, guardSteer, makeShip, stepShip, fireBroadside, stepBall, collideShips, damage, ISLANDS, shoreR, aiSteer, makeTurret, fireTurret, waveSpec, UPGRADES, SKILLS, applyUpgrade, makePlayer, regenShip, REGEN_DELAY, useSkill, stepKeg, rollUpgrades, PLAYER_SHIPS, makeFort, merchantSpec, makeMerchant, merchantSteer, crewMul, canBoard, startBoarding, boardRound, captureReward, krakenSteer, stepSlam, krakenDue, WIND, windMul } from './sim.js';

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
    const s = makePlayer(2), tgt = makeShip('brig', 1, 0, d, 0);
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
  for (const f of ['game.js', 'screens.js', 'ui.js', 'index.html']) {
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
