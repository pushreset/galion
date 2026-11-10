// node check.mjs — asserts on the pure sim.
import assert from 'node:assert/strict';
import { setMap, MAPS, BOUNDS, convoySpec, guardSteer, makeShip, stepShip, fireBroadside, stepBall, collideShips, damage, ISLANDS, shoreR, aiSteer, makeTurret, fireTurret, waveSpec, UPGRADES, applyUpgrade, makePlayer, regenShip, REGEN_DELAY, useSkill, stepKeg, rollUpgrades, PLAYER_SHIPS, makeFort, merchantSpec, makeMerchant, merchantSteer, crewMul, canBoard, startBoarding, boardRound, captureReward } from './sim.js';

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
  hostRoom({ open() {}, join: (id) => joined.push(id), msg() {}, leave() {}, error() {} });
  globalThis.setInterval = si;
  const conns = Array.from({ length: 5 }, () => { const h = {}; return { h, open: true, on: (e, f) => (h[e] = f), close() {} }; });
  for (const c of conns) peers[0].h.connection(c);
  for (const c of conns) c.h.open();
  assert.equal(joined.length, MAX_PLAYERS - 1, 'overlapping joins passed the player cap');
}
console.log('check ok');
