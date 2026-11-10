import * as THREE from 'three';
import { ISLANDS, BOUNDS, shoreR } from './sim.js';
import { mat } from './ships.js';

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Island = stacked wobbly rings (beach → grass mound or cliff → plateau), one colour per ring band.
function islandMesh(isl, rand, rings) {
  const N = 28, pos = [], col = [];
  const c = new THREE.Color();
  const ringPts = rings.map(([rf, y, jit]) => {
    const pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const r = shoreR(isl, a) * rf * (1 + (rand() - 0.5) * jit);
      pts.push([Math.cos(a) * r, y + (rand() - 0.5) * jit * 2, Math.sin(a) * r]);
    }
    return pts;
  });
  const tri = (a, b, d, hex) => {
    pos.push(...a, ...b, ...d);
    c.set(hex).convertSRGBToLinear();
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  };
  for (let r = 0; r < rings.length - 1; r++) {
    const A = ringPts[r], B = ringPts[r + 1], hex = rings[r][3];
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const h2 = rings[r][4] && (i + r) % 3 === 0 ? rings[r][4] : hex; // speckle a second tone
      tri(A[i], A[j], B[j], h2);
      tri(A[i], B[j], B[i], hex);
    }
  }
  const top = ringPts[ringPts.length - 1];
  const cy = rings[rings.length - 1][1] + 0.15;
  for (let i = 0; i < N; i++) tri(top[i], top[(i + 1) % N], [0, cy, 0], rings[rings.length - 1][3]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function rock(rand, s, hex = '#9695a0') {
  const g = new THREE.IcosahedronGeometry(1, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.8 + rand() * 0.4), p.getY(i) * (0.7 + rand() * 0.5), p.getZ(i) * (0.8 + rand() * 0.4));
  const m = new THREE.Mesh(g, mat(hex));
  m.scale.set(s, s * (0.8 + rand() * 0.6), s);
  m.rotation.y = rand() * 6;
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function palm(rand) {
  const g = new THREE.Group();
  const lean = new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).normalize().multiplyScalar(0.18 + rand() * 0.12);
  let p = new THREE.Vector3(0, 0, 0);
  const segs = 5 + Math.floor(rand() * 2);
  for (let i = 0; i < segs; i++) {
    const dir = new THREE.Vector3(0, 1, 0).addScaledVector(lean, 1 + i * 0.5).normalize();
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.17 - i * 0.012, 0.21 - i * 0.012, 0.75, 5), mat(i % 2 ? '#8d5c35' : '#704629'));
    seg.position.copy(p).addScaledVector(dir, 0.37);
    seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    seg.castShadow = true;
    g.add(seg);
    p.addScaledVector(dir, 0.72);
  }
  const fronds = 7;
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + rand() * 0.4;
    const len = 2.1 + rand() * 0.6;
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      const r = t * len, y = Math.sin(t * Math.PI * 0.75) * 0.7 - t * t * 1.1;
      const w = Math.sin(t * Math.PI) * 0.42;
      const cx = Math.cos(a), cz = Math.sin(a), px = -cz, pz = cx;
      pts.push([cx * r + px * w, y, cz * r + pz * w], [cx * r - px * w, y - 0.05, cz * r - pz * w]);
    }
    const pos = [];
    for (let k = 0; k < 4; k++) {
      const [a0, b0] = [pts[k * 2], pts[k * 2 + 1]], [a1, b1] = [pts[k * 2 + 2], pts[k * 2 + 3]];
      pos.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const f = new THREE.Mesh(fg, mat(i % 2 ? '#3b762c' : '#5f9e38', { side: THREE.DoubleSide }));
    f.position.copy(p);
    f.castShadow = true;
    g.add(f);
  }
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat('#3f2616'));
    nut.position.copy(p).add(new THREE.Vector3(Math.cos(i * 2.1) * 0.2, -0.15, Math.sin(i * 2.1) * 0.2));
    g.add(nut);
  }
  return g;
}

function stoneBox(w, h, d, x, y, z, hex = '#9695a0') {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Fort: square curtain wall with crenellations, corner towers, a keep and cannons.
// Returns the cannon muzzles (world positions) so game.js can make them shoot.
function fort(group, y0, s) {
  const half = 4.2 * s, wallH = 2.2, th = 0.7;
  const cannons = [];
  for (const [ax, az, len, rot] of [[0, -half, half * 2, 0], [0, half, half * 2, 0], [-half, 0, half * 2, 1], [half, 0, half * 2, 1]]) {
    const w = rot ? th : len, d = rot ? len : th;
    group.add(stoneBox(w, wallH, d, ax, y0 + wallH / 2, az));
    // merlons
    const n = Math.floor(len / 0.9);
    for (let k = 0; k < n; k++) {
      const t = -len / 2 + (k + 0.5) * (len / n);
      if (k % 2) continue;
      group.add(stoneBox(rot ? th : 0.5, 0.45, rot ? 0.5 : th, ax + (rot ? 0 : t), y0 + wallH + 0.22, az + (rot ? t : 0), '#bdbab8'));
    }
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, wallH + 1.4, 8), mat('#6f6f7c'));
    t.position.set(sx * half, y0 + (wallH + 1.4) / 2, sz * half);
    t.castShadow = t.receiveShadow = true;
    group.add(t);
    for (let k = 0; k < 8; k += 2) {
      const a = (k / 8) * Math.PI * 2;
      group.add(stoneBox(0.42, 0.4, 0.42, sx * half + Math.cos(a) * 1.05, y0 + wallH + 1.6, sz * half + Math.sin(a) * 1.05, '#9695a0'));
    }
  }
  // keep with a door and a flag
  group.add(stoneBox(3.2, 3.6, 3.0, -0.6, y0 + 1.8, -0.5, '#6f6f7c'));
  group.add(stoneBox(3.4, 0.3, 3.2, -0.6, y0 + 3.7, -0.5, '#4e4e5a'));
  group.add(stoneBox(0.8, 1.2, 0.1, -0.6, y0 + 0.6, 1.02, '#2b1a10'));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 4), mat('#1c1e22'));
  pole.position.set(-0.6, y0 + 5, -0.5);
  group.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), mat('#a52623', { side: THREE.DoubleSide }));
  flag.position.set(0.1, y0 + 5.7, -0.5);
  group.add(flag);
  // cannons on the two seaward walls + barrels/crates in the yard
  for (const [x, z, a] of [[half + 0.1, -1.4, 0], [half + 0.1, 1.4, 0], [1.4, half + 0.1, Math.PI / 2], [-2, half + 0.1, Math.PI / 2], [-half - 0.1, 1, Math.PI], [1.2, -half - 0.1, -Math.PI / 2]]) {
    const c = new THREE.Group();
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.4, 6), mat('#3a3d44'));
    barrel.rotation.z = -Math.PI / 2 + 0.12;
    barrel.position.set(0.5, 0.35, 0);
    const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.6), mat('#56351f'));
    carriage.position.y = 0.1;
    c.add(barrel, carriage);
    c.position.set(x, y0 + wallH + 0.15, z);
    c.rotation.y = -a;
    c.traverse((o) => (o.castShadow = true));
    group.add(c);
    cannons.push(c);
  }
  for (const [x, z] of [[2.2, -2], [2.6, -1.4], [1.8, 2.4]]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.6, 6), mat('#8d5c35'));
    b.position.set(x, y0 + 0.3, z);
    b.castShadow = true;
    group.add(b);
  }
  return cannons;
}

// Port town: whitewashed houses with tiled roofs and a jetty reaching toward the middle of the map.
function port(group, isl, rand) {
  const dir = isl.x < 0 ? 1 : -1, y0 = 0.9;
  const jetty = stoneBox(11, 0.25, 2.2, dir * (isl.r + 2.5), 0.75, 0, '#8d5c35');
  group.add(jetty);
  for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) group.add(stoneBox(0.35, 1.6, 0.35, dir * (isl.r - 1.5 + i * 3), 0.2, sz * 1.1, '#56351f'));
  for (const [fx, fz, w, h] of [[0.3, -0.42, 3.2, 2.2], [0.1, 0.4, 2.8, 1.9], [-0.25, -0.1, 3.6, 2.6], [0.45, 0.2, 2.4, 1.8]]) {
    const x = dir * fx * isl.r, z = fz * isl.r;
    group.add(stoneBox(w, h, w * 0.8, x, y0 + h / 2, z, '#f5ecd2'));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, 1.3, 4), mat('#a52623'));
    roof.position.set(x, y0 + h + 0.65, z);
    roof.rotation.y = Math.PI / 4;
    roof.scale.z = 0.8;
    roof.castShadow = true;
    group.add(roof);
  }
  for (let i = 0; i < 4; i++) {
    const p = palm(rand), a = Math.PI / 2 + (rand() - 0.5) + (i % 2) * Math.PI, rr = isl.r * (0.5 + rand() * 0.2);
    p.position.set(Math.cos(a) * rr, y0, Math.sin(a) * rr);
    group.add(p);
  }
}

// Builds the current map (sim.js ISLANDS) under one root group, so game.js can swap maps.
export function createWorld(parent) {
  const forts = [], scene = new THREE.Group();
  parent.add(scene);
  ISLANDS.forEach((isl, idx) => {
    const rand = rng(1000 + idx * 77);
    const g = new THREE.Group();
    g.position.set(isl.x, 0, isl.z);
    if (isl.kind === 'fort') {
      g.add(islandMesh(isl, rand, [
        [1.0, 0.1, 0.04, '#e6cc8e', '#c9a86a'],
        [0.9, 0.5, 0.05, '#c9a86a'],
        [0.86, 1.0, 0.06, '#9695a0', '#6f6f7c'],
        [0.8, 3.6, 0.08, '#6f6f7c', '#9695a0'],
        [0.74, 4.5, 0.02, '#3b762c', '#5f9e38'],
        [0.4, 4.7, 0.02, '#5f9e38'],
      ]));
      const cannons = fort(g, 4.6, isl.r / 13);
      forts.push({ isl, cannons, group: g });
      for (let i = 0; i < 6; i++) {
        const a = rand() * 6.28;
        const r = rock(rand, 0.9 + rand() * 1.3);
        const rr = shoreR(isl, a) * (0.9 + rand() * 0.15);
        r.position.set(Math.cos(a) * rr, 0.6, Math.sin(a) * rr);
        g.add(r);
      }
      for (let i = 0; i < 2; i++) {
        const p = palm(rand);
        const a = 2.2 + i * 0.6;
        p.position.set(Math.cos(a) * isl.r * 0.62, 4.5, Math.sin(a) * isl.r * 0.62);
        g.add(p);
      }
    } else if (isl.kind === 'port') {
      g.add(islandMesh(isl, rand, [
        [1.0, 0.1, 0.05, '#e6cc8e', '#f6e6b4'],
        [0.84, 0.55, 0.05, '#c9a86a', '#e6cc8e'],
        [0.72, 0.9, 0.04, '#c9a86a'],
        [0.3, 0.95, 0.02, '#e6cc8e'],
      ]));
      port(g, isl, rand);
    } else {
      const rocky = isl.kind === 'rocky';
      g.add(islandMesh(isl, rand, [
        [1.0, 0.1, 0.05, '#e6cc8e', '#f6e6b4'],
        [0.82, 0.55, 0.06, '#c9a86a', '#e6cc8e'],
        [0.66, 0.8, 0.07, '#5f9e38', '#3b762c'],
        [0.38, 1.5, 0.1, '#94c54c', '#5f9e38'],
      ]));
      if (rocky) {
        // big rock outcrop cluster on one side, like the ref's left island
        const a0 = rand() * 6.28;
        for (let i = 0; i < 5; i++) {
          const a = a0 + (rand() - 0.5) * 1.4;
          const r = rock(rand, 1.3 + rand() * 1.4, i % 2 ? '#9695a0' : '#bdbab8');
          const rr = isl.r * (0.15 + rand() * 0.45);
          r.position.set(Math.cos(a) * rr, 1.2 + rand() * 0.6, Math.sin(a) * rr);
          g.add(r);
        }
      }
      const nPalms = rocky ? 3 : 5;
      for (let i = 0; i < nPalms; i++) {
        const p = palm(rand);
        const a = rand() * 6.28, rr = isl.r * (0.2 + rand() * 0.5);
        p.position.set(Math.cos(a) * rr, 0.9, Math.sin(a) * rr);
        p.scale.setScalar(0.9 + rand() * 0.5);
        g.add(p);
      }
    }
    scene.add(g);
  });
  // scattered sea rocks
  const rand = rng(42);
  for (let i = 0; i < 22; i++) {
    const x = (rand() - 0.5) * (BOUNDS.x * 2 - 10), z = (rand() - 0.5) * (BOUNDS.z * 2 - 10);
    if (Math.hypot(x, z) < 20) continue;
    if (ISLANDS.some((I) => Math.hypot(x - I.x, z - I.z) < I.r + 8)) continue;
    const r = rock(rand, 0.5 + rand() * 0.9, rand() > 0.5 ? '#8d5c35' : '#9695a0');
    r.position.set(x, 0.1, z);
    scene.add(r);
  }
  return { forts, root: scene };
}
