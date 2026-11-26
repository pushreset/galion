import * as THREE from 'three';
import { mat, box, cyl, sail, hullMesh, castle, foamRing, width, sheer, buildShip, setGuns } from './ships.js';
import { rock, palm, rng } from './world.js';

// Boss models, candidates under review (bosses.html). No gameplay here.
// Every builder returns a ship-shaped mesh ({ root, body, flag, foam, sails, rigs, guns, spec }, ships.js) so game.js
// syncShip can drive it later, plus anim(t): the boss's own motion at rest (oars, coils, whirlpool).
// `still`: fixed to the seabed, no bob. Bow +x, y = 0 at the waterline, palette.js colours only.

const UP = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const glow = (hex) => mat(hex, { basic: true });
const cloth = (hex) => mat(hex, { side: THREE.DoubleSide, emissive: new THREE.Color(hex).multiplyScalar(0.22) }); // ships.js sails
const lamp = (w, h, d, x, y, z, hex = '#ffd24a') => box(w, h, d, hex, x, y, z, { basic: true });

function blob(r, hex, x, y, z, sx = 1, sy = 1, sz = 1) { // low-poly ellipsoid
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), mat(hex));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}
function cone(r, h, hex, x, y, z, seg = 6) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(hex));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function limb(a, b, ra, rb, hex, seg = 6) { // tapered cylinder from a (radius ra) to b (radius rb)
  const d = b.clone().sub(a), m = cyl(rb, ra, d.length(), hex, seg);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}
function aim(m, dir) { m.quaternion.setFromUnitVectors(UP, dir.normalize()); return m; } // point a cone / cylinder's +y along dir
function ring(r0, r1, seg = 24, hex = '#f4fffb', y = 0.05) { // flat on the water, like the hull foam
  return new THREE.Mesh(new THREE.RingGeometry(r0, r1, seg).rotateX(-Math.PI / 2).translate(0, y, 0), mat(hex, { basic: true, side: THREE.DoubleSide }));
}
function disc(r, hex, y, seg = 24) {
  return new THREE.Mesh(new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2).translate(0, y, 0), glow(hex));
}
function tri(a, b, c, material) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b, c]);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  return m;
}
function pennant(hex) { // ships.js flag: hinged at the pole
  const f = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3, 4, 1).translate(-0.95, 0, 0), mat(hex, { side: THREE.DoubleSide }));
  f.castShadow = true;
  return f;
}
function frame(spec) {
  const root = new THREE.Group(), body = new THREE.Group(), guns = new THREE.Group();
  root.add(body);
  body.add(guns);
  return { root, body, flag: new THREE.Object3D(), foam: new THREE.Object3D(), sails: [], rigs: [], guns, spec };
}
function setFoam(m, foam) {
  if (m.foam.parent) m.foam.parent.remove(m.foam);
  m.foam = foam;
  m.root.add(foam);
}
const cdim = (sp, [u0, u1, h]) => { // where ships.js castle() puts its box
  const um = (u0 + u1) / 2, y = sheer(um, sp.D) - 0.1;
  return { x0: (u0 * sp.L) / 2, x1: (u1 * sp.L) / 2, y, top: y + h, w: width(um, sp.B) * 2 * 0.93 };
};
const masts3 = (k, wf = 1) => [ // the galleon's rig (ships.js SPECS), k times as tall
  { u: 0.4, h: 10.5 * k, sails: [[0.15, 0.47, 1.5 * wf], [0.51, 0.78, 1.2 * wf], [0.82, 0.95, 0.8 * wf]] },
  { u: 0.0, h: 12.5 * k, sails: [[0.15, 0.45, 1.62 * wf], [0.49, 0.77, 1.3 * wf], [0.81, 0.94, 0.86 * wf]] },
  { u: -0.5, h: 8.5 * k, sails: [[0.24, 0.58, 1.1 * wf], [0.63, 0.88, 0.78 * wf]] },
];
function gunRow(body, sp, n, u0, u1, dy) { // a gun deck below the one setGuns draws
  for (const s of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      const u = u0 + ((u1 - u0) * k) / (n - 1), x = (u * sp.L) / 2, z = s * width(u, sp.B) * 0.985, y = sheer(u, sp.D) + dy;
      body.add(box(0.46, 0.36, 0.06, '#121219', x, y, z + s * 0.03));
      const b = cyl(0.09, 0.11, 0.55, '#1c1e22', 5);
      b.rotation.x = Math.PI / 2;
      b.position.set(x, y, z + s * 0.28);
      body.add(b);
    }
  }
}
function sternLamps(body, sp, zs, hex = '#ffd24a') {
  const c = cdim(sp, sp.stern);
  for (const z of zs) body.add(lamp(0.3, 0.42, 0.3, c.x0 - 0.2, c.top + 0.65, z, hex), box(0.08, 0.6, 0.08, '#1c1e22', c.x0 - 0.1, c.top + 0.3, z));
}
function tatter(s, rand, p) { // drop sail triangles, more toward the foot: rags
  const g = s.geometry, idx = g.index.array, pos = g.attributes.position, h = g.parameters.height, keep = [];
  for (let i = 0; i < idx.length; i += 3) {
    const y = (pos.getY(idx[i]) + pos.getY(idx[i + 1]) + pos.getY(idx[i + 2])) / 3;
    if (rand() > p * (0.25 + (0.5 - y / h) * 1.5)) keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  g.setIndex(keep);
}
function oars(m, n, u0, u1, len, y) { // returns the rowing animation
  const { L, B } = m.spec, list = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      const u = u0 + ((u1 - u0) * k) / (n - 1), o = new THREE.Group();
      o.position.set((u * L) / 2, y, s * width(u, B) * 0.95);
      o.add(box(0.09, 0.09, len, '#cc9d63', 0, 0, (s * len) / 2), box(0.3, 0.06, 0.8, '#e3c088', 0, 0, s * (len - 0.4)));
      o.userData.s = s;
      m.body.add(o);
      list.push(o);
    }
  }
  return (t) => {
    for (const o of list) {
      const s = o.userData.s, ph = t * 2.2;
      o.rotation.y = s * Math.sin(ph) * 0.32; // both banks sweep together
      o.rotation.x = s * (0.3 - Math.cos(ph) * 0.1); // blades clear the water on the way forward
    }
  };
}

// --- 1. Santísima Trinidad: four-decker flagship -------------------------------------------
function trinidad() {
  const sp = {
    L: 20, B: 5.6, D: 2.3, ports: 7,
    masts: [
      { u: 0.42, h: 14.5, sails: [[0.13, 0.38, 1.4], [0.41, 0.62, 1.18], [0.65, 0.82, 0.95], [0.85, 0.96, 0.68]] },
      { u: 0.0, h: 17, sails: [[0.13, 0.37, 1.5], [0.4, 0.61, 1.27], [0.64, 0.81, 1.0], [0.84, 0.96, 0.72]] },
      { u: -0.5, h: 12, sails: [[0.2, 0.48, 1.05], [0.52, 0.74, 0.86], [0.78, 0.93, 0.62]] },
    ],
    stern: [-1, -0.55, 2.4], fore: [0.6, 0.88, 1.1],
  };
  const lv = { sail: ['#f5ecd2', '#a52623'], emblem: 'cross', trim: '#a52623', hull: '#c9952a', hullLow: '#a52623', rail: '#3e0d10', flag: '#ffd24a' };
  const m = buildShip(sp, lv);
  gunRow(m.body, sp, 7, -0.5, 0.42, -1.3);
  sternLamps(m.body, sp, [-1.5, 1.5]);
  const c = cdim(sp, sp.stern);
  for (let k = 0; k < 5; k++) m.body.add(lamp(0.12, 0.36, 0.36, c.x0 - 0.03, c.top - 0.45, (k - 2) * 0.8));
  m.body.add(box(0.14, 0.2, c.w + 0.1, '#c9952a', c.x0 - 0.02, c.y + 1.75, 0), box(0.14, 0.2, c.w + 0.1, '#c9952a', c.x0 - 0.02, c.y + 0.75, 0));
  return m;
}

// --- 2. Nuestra Señora de Atocha: treasure galleon -----------------------------------------
function atocha() {
  const sp = { L: 17, B: 5.8, D: 2.1, ports: 5, masts: masts3(1.08, 0.88), stern: [-1, -0.5, 2.7], fore: [0.58, 0.88, 1.3] };
  const lv = { sail: ['#f5ecd2', '#ffd24a'], emblem: 'cross', trim: '#ffd24a', hull: '#8d5c35', hullLow: '#56351f', rail: '#c9952a', flag: '#ffd24a' };
  const m = buildShip(sp, lv), b = m.body;
  sternLamps(b, sp, [-1.6, 1.6]);
  for (const key of ['stern', 'fore']) { // gilded bands along both castles
    const c = cdim(sp, sp[key]);
    for (const s of [-1, 1]) b.add(lamp(c.x1 - c.x0, 0.16, 0.06, (c.x0 + c.x1) / 2, c.top - 0.7, s * (c.w / 2 + 0.04)));
  }
  for (const [x, z, r] of [[1.9, 0, 1], [-2.2, 0.5, 0.8], [-1.3, -1, 0.6]]) { // gold heaped on deck
    const y = sheer(x / (sp.L / 2), sp.D);
    b.add(cone(1.15 * r, 0.7 * r, '#c9952a', x, y + 0.35 * r, z, 7));
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.8 * r, 0.75 * r, 6), glow('#ffd24a'));
    top.position.set(x, y + 0.6 * r, z);
    b.add(top);
  }
  for (const [x, z] of [[0.6, 1.5], [0.4, -1.5], [-3.2, -1.2]]) {
    const y = sheer(x / (sp.L / 2), sp.D);
    b.add(box(0.9, 0.55, 0.6, '#56351f', x, y + 0.28, z), lamp(0.92, 0.14, 0.62, x, y + 0.6, z));
  }
  return m;
}

// --- 3. Barbarossa: flagship galley --------------------------------------------------------
function galley() {
  const sp = { L: 19, B: 3.2, D: 0.9 };
  const lv = { hull: '#a52623', hullLow: '#3f2616', trim: '#c9952a', rail: '#6e1619' };
  const m = frame(sp), b = m.body, { L, B, D } = sp;
  b.add(hullMesh(sp, lv));
  const ram = cone(0.42, 3.4, '#c9952a', L / 2 + 1.1, 0.5, 0, 5); // bronze spur at the waterline
  ram.rotation.z = -Math.PI / 2;
  b.add(ram);
  for (const s of [-1, 1]) { // the outrigger the oars pivot on
    b.add(box(L * 0.6, 0.14, 0.14, '#3f2616', -0.4, D + 0.45, s * (B / 2 + 0.5)));
    for (let k = 0; k < 5; k++) b.add(box(0.12, 0.12, 0.6, '#3f2616', -5.2 + k * 2.4, D + 0.4, s * (B / 2 + 0.2)));
  }
  // poop under a striped awning
  const st = [-1, -0.72, 0.7], c = cdim(sp, st);
  castle(sp, lv, st, b);
  const tent = (r, len, hex, x) => {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), mat(hex, { side: THREE.DoubleSide }));
    t.position.set(x, c.top + 0.35, 0);
    t.scale.y = 0.9;
    t.castShadow = true;
    return t;
  };
  const tl = c.x1 - c.x0 - 0.2, tx = (c.x0 + c.x1) / 2;
  b.add(tent(c.w / 2, tl, '#a52623', tx));
  for (let k = 0; k < 3; k++) b.add(tent(c.w / 2 + 0.04, 0.32, '#ffd24a', tx + (k - 1) * tl * 0.36));
  b.add(lamp(0.3, 0.42, 0.3, c.x0 - 0.25, c.top + 1.9, 0), box(0.08, 1.7, 0.08, '#1c1e22', c.x0 - 0.2, c.top + 0.9, 0));
  // fighting platform with the bow chasers
  const fo = [0.6, 0.86, 0.5], f = cdim(sp, fo);
  castle(sp, lv, fo, b);
  for (const z of [-0.45, 0, 0.45]) {
    const g = cyl(0.11, 0.15, 1.3, '#1c1e22', 5);
    g.rotation.z = -Math.PI / 2;
    g.position.set(f.x1 + 0.3, f.top + 0.22, z);
    b.add(g);
  }
  // two lateen sails: a long slanted yard, a triangle of canvas under it
  let top = 0;
  for (const [u, h, len, hex] of [[0.36, 7.5, 9, '#f5ecd2'], [-0.2, 9.2, 11, '#a52623']]) {
    const x = (u * L) / 2, y0 = sheer(u, D), mast = cyl(0.12, 0.2, h, '#3f2616');
    mast.position.set(x, y0 + h / 2, 0);
    b.add(mast);
    const rig = new THREE.Group();
    rig.position.x = x;
    const lo = V(len * 0.44, y0 + h * 0.36, 0.25), hi = V(-len * 0.5, y0 + h + 1.4, 0.25);
    const s = tri(lo, hi, V(-len * 0.4, y0 + 1.5, 0.25), cloth(hex));
    rig.add(limb(lo, hi, 0.09, 0.06, '#2b1a10'), s);
    b.add(rig);
    m.rigs.push(rig);
    m.sails.push(s);
    top = Math.max(top, y0 + h);
    if (top === y0 + h) m.flag.position.set(x, top + 0.3, 0);
  }
  const pos = m.flag.position.clone();
  m.flag = pennant('#3b762c');
  m.flag.position.copy(pos);
  b.add(m.flag);
  setFoam(m, foamRing(sp));
  m.anim = oars(m, 12, -0.6, 0.5, 4.4, D + 0.5);
  return m;
}

// --- 4. Yi Sun-sin: turtle ship ------------------------------------------------------------
function turtleShip() {
  const sp = { L: 12, B: 5, D: 1.3 };
  const lv = { hull: '#704629', hullLow: '#3f2616', trim: '#8d5c35', rail: '#3f2616' };
  const m = frame(sp), b = m.body, { L, D } = sp;
  b.add(hullMesh(sp, lv));
  // the shell: a plated half-barrel over the deck, tapering to the bow
  const r = 2.3, base = D + 0.5, sy = 0.78, shellMat = mat('#255022', { side: THREE.DoubleSide });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 7.2, 8, 1, false, 0, Math.PI).rotateZ(Math.PI / 2), shellMat);
  barrel.position.set(-1.6, base, 0);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.8, r, 2.6, 8, 1, false, Math.PI, Math.PI).rotateZ(-Math.PI / 2), shellMat);
  nose.position.set(3.3, base, 0);
  for (const s of [barrel, nose]) { s.scale.y = sy; s.castShadow = s.receiveShadow = true; b.add(s); }
  b.add(box(7.2, 0.16, 0.34, '#173219', -1.6, base + r * sy + 0.03, 0));
  const spikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.11, 0.5, 4), mat('#d6d2cf'), 9 * 5), o = new THREE.Object3D();
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 5; j++) {
      const a = ((j + 1) * Math.PI) / 6 + (i % 2 ? 0.09 : -0.09), n = V(0, Math.sin(a) / sy, Math.cos(a)).normalize();
      o.position.set(-4.9 + i * 0.82, base + r * sy * Math.sin(a), r * Math.cos(a)).addScaledVector(n, 0.2);
      o.quaternion.setFromUnitVectors(UP, n);
      o.updateMatrix();
      spikes.setMatrixAt(i * 5 + j, o.matrix);
    }
  }
  spikes.castShadow = true;
  b.add(spikes);
  // dragon figurehead breathing sulphur smoke
  b.add(limb(V(4.3, D + 0.5, 0), V(6.5, 3.5, 0), 0.5, 0.36, '#3b762c'));
  const head = new THREE.Group();
  head.position.set(6.6, 3.7, 0);
  head.add(box(1.5, 0.75, 0.95, '#5f9e38', 0.45, 0, 0), box(1.2, 0.2, 0.8, '#a52623', 0.5, -0.5, 0), box(1.25, 0.18, 0.85, '#3b762c', 0.5, -0.72, 0));
  for (const s of [-1, 1]) {
    head.add(lamp(0.26, 0.26, 0.1, 0.7, 0.14, s * 0.5));
    const horn = cone(0.13, 0.9, '#e3c088', -0.25, 0.65, s * 0.32, 5);
    horn.rotation.z = 0.7;
    head.add(horn);
  }
  b.add(head);
  const puffs = [0, 1, 2].map(() => { const p = blob(0.34, '#a7a3a4', 0, 0, 0); p.castShadow = false; b.add(p); return p; });
  // stern lights, two stub masts with furled yards, ports all round
  for (const z of [-1, 0, 1]) b.add(lamp(0.12, 0.34, 0.34, -L / 2 - 0.03, D - 0.1, z * 1.2));
  for (const [x, h] of [[1.2, 5.2], [-2.6, 4.6]]) {
    const mast = cyl(0.12, 0.18, h, '#3f2616');
    mast.position.set(x, base + h / 2, 0);
    const yard = cyl(0.2, 0.2, 3.6, '#ddcda6', 5);
    yard.rotation.x = Math.PI / 2;
    yard.position.set(x + 0.15, base + h - 0.7, 0);
    b.add(mast, yard);
    if (!m.flag.parent) { m.flag = pennant('#a52623'); m.flag.position.set(x, base + h + 0.3, 0); b.add(m.flag); }
  }
  setGuns(m, 5);
  setFoam(m, foamRing(sp));
  const row = oars(m, 6, -0.5, 0.3, 3.2, D + 0.15);
  m.anim = (t) => {
    row(t);
    puffs.forEach((p, i) => {
      const f = (t * 0.45 + i / 3) % 1;
      p.position.set(8.3 + f * 2.2, 3.3 + f * 1.6, Math.sin(i * 2.4) * 0.3);
      p.scale.setScalar(0.5 + f * 1.1);
    });
  };
  m.anim(0);
  return m;
}

// --- 5. Blackbeard: Queen Anne's Revenge ---------------------------------------------------
function blackbeard() {
  const sp = { L: 15, B: 4.4, D: 1.8, ports: 6, masts: masts3(1.07), stern: [-1, -0.58, 1.6], fore: [0.6, 0.88, 0.85] };
  const lv = { sail: ['#1e1e28', '#121219'], emblem: 'skull', trim: '#a52623', hull: '#2c2c38', hullLow: '#1e1e28', rail: '#6e1619', flag: 'skull' };
  const m = buildShip(sp, lv), rand = rng(5);
  m.sails.forEach((s) => tatter(s, rand, 0.22));
  for (const s of [-1, 1]) { // slow-match burning along the rails, as in his beard
    for (let k = 0; k < 9; k++) {
      const u = -0.5 + k * 0.125;
      m.body.add(lamp(0.18, 0.18, 0.18, (u * sp.L) / 2, sheer(u, sp.D) + 0.68, s * width(u, sp.B) * 0.9, k % 2 ? '#ff9b26' : '#e8591a'));
    }
  }
  sternLamps(m.body, sp, [-1.2, 1.2], '#e8591a');
  return m;
}

// --- 6. Ching Shih: flagship junk of the Red Flag Fleet ------------------------------------
function junk() {
  const sp = { L: 16, B: 5, D: 1.6 };
  const lv = { hull: '#704629', hullLow: '#3f2616', trim: '#a52623', rail: '#3e0d10' };
  const m = frame(sp), b = m.body, { L, B, D } = sp;
  b.add(hullMesh(sp, lv));
  // towering stern in two tiers, low platform at the bow with the painted eyes
  const st = [-1, -0.45, 2.5], c = cdim(sp, st);
  castle(sp, lv, st, b);
  b.add(box(2.6, 1.1, c.w * 0.86, lv.hull, c.x0 + 1.3, c.top + 0.55, 0), box(2.8, 0.18, c.w * 0.92, lv.trim, c.x0 + 1.3, c.top + 1.15, 0));
  for (let k = -1; k <= 1; k++) b.add(lamp(0.12, 0.42, 0.5, c.x0 - 0.03, c.y + 1.6, k * 1.2), lamp(0.12, 0.3, 0.4, c.x0 - 0.03, c.top + 0.6, k * 0.9));
  for (const s of [-1, 1]) { // banner poles on the poop
    b.add(box(0.08, 3.2, 0.08, '#2b1a10', c.x0 + 0.3, c.top + 2.6, s * 1.5), box(0.06, 2, 0.7, '#d84a38', c.x0 + 0.3, c.top + 3.1, s * 1.5));
  }
  const fo = [0.6, 0.92, 0.9], f = cdim(sp, fo);
  castle(sp, lv, fo, b);
  for (const s of [-1, 1]) {
    b.add(box(0.85, 0.55, 0.06, '#f5ecd2', f.x1 - 1.1, f.y + 0.5, s * (f.w / 2 + 0.04)), box(0.32, 0.32, 0.08, '#121219', f.x1 - 0.95, f.y + 0.5, s * (f.w / 2 + 0.06)));
  }
  // three battened lug sails, red
  for (const [u, h, w, sh, off] of [[0.48, 8.5, 4.4, 5.6, 0.5], [0.02, 13, 6.4, 8.6, 0.8], [-0.46, 8, 3.8, 5, 0.4]]) {
    const x = (u * L) / 2, y0 = sheer(u, D), mast = cyl(0.14, 0.24, h, '#3f2616');
    mast.position.set(x, y0 + h / 2, 0);
    b.add(mast);
    const rig = new THREE.Group();
    rig.position.x = x;
    const s = sail(w, sh, 0.22, cloth('#a52623')), top = y0 + h - 0.5;
    s.position.set(0.25, top - sh / 2, off);
    rig.add(s);
    for (let k = 0; k <= 6; k++) rig.add(box(0.12, 0.12, w + 0.3, '#3e0d10', 0.42, top - (k * sh) / 6, off));
    b.add(rig);
    m.rigs.push(rig);
    m.sails.push(s);
    if (h === 13) { m.flag = pennant('#d84a38'); m.flag.position.set(x, y0 + h + 0.3, 0); b.add(m.flag); }
  }
  b.add(box(0.2, 2.6, 1.6, '#3f2616', -L / 2 - 0.4, 0.1, 0)); // the big hung rudder
  setGuns(m, 4);
  setFoam(m, foamRing(sp));
  return m;
}

// --- 7. The Flying Dutchman ----------------------------------------------------------------
function dutchman() {
  const sp = { L: 15, B: 4.4, D: 1.8, ports: 5, masts: masts3(1.07), stern: [-1, -0.55, 2.1], fore: [0.6, 0.88, 0.85] };
  const lv = { sail: ['#97e6d6', '#62d0c2'], emblem: null, trim: '#3fb8b2', hull: '#255022', hullLow: '#173219', rail: '#173219', flag: '#cdf5ea' }; // weed-grown timbers
  const m = buildShip(sp, lv), rand = rng(9);
  const rags = [mat('#97e6d6', { basic: true, side: THREE.DoubleSide }), mat('#62d0c2', { basic: true, side: THREE.DoubleSide })];
  m.sails.forEach((s, i) => { tatter(s, rand, 0.5); s.material = rags[i % 2]; }); // unlit: they glow
  const yellow = glow('#ffd24a'), pale = glow('#cdf5ea');
  m.body.traverse((o) => { if (o.material === yellow) o.material = pale; }); // corpse-light at the windows
  sternLamps(m.body, sp, [-1.2, 1.2], '#cdf5ea');
  const mist = new THREE.Group(); // no bow wave: she rides above the water on a ring of glowing mist
  const wisps = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2, w = disc(0.7 + rand() * 0.5, i % 2 ? '#3fb8b2' : '#62d0c2', 0.06, 7);
    w.position.set(Math.cos(a) * (sp.L / 2 + 0.5), 0, Math.sin(a) * (sp.B / 2 + 1.6));
    w.rotation.y = -a + Math.PI / 2; // long axis along the hull
    w.userData.k = 1.6 + rand();
    mist.add(w);
    return w;
  });
  setFoam(m, mist);
  // fade(a): the whole ship at opacity a (game.js, when she turns spectral). Her materials are her own copies: the ones from mat()
  // are shared with every other ship. Depth is still written while she is mostly there, so she fades as one body over the sea
  // instead of showing her own insides; below that she stops casting a shadow and loses post.js's depth outline.
  const own = new Map(), casters = [];
  m.root.traverse((o) => {
    if (!o.material) return;
    if (!own.has(o.material)) own.set(o.material, Object.assign(o.material.clone(), { transparent: true })); // from the start: nothing to recompile when the fade begins
    o.material = own.get(o.material);
    if (o.castShadow) casters.push(o);
  });
  m.fade = (a) => {
    for (const c of own.values()) { c.opacity = a; c.depthWrite = a > 0.4; }
    for (const o of casters) o.castShadow = a > 0.5;
  };
  m.anim = (t) => {
    m.body.position.y += 1.5 + Math.sin(t * 0.6) * 0.25;
    wisps.forEach((w, i) => { const k = 0.75 + 0.35 * Math.sin(t * 0.9 + i * 1.9); w.scale.set(k * w.userData.k, 1, k * 0.45); });
  };
  return m;
}

// --- 8. Jörmungandr: sea serpent -----------------------------------------------------------
function serpent() {
  const m = frame({ L: 22, B: 3.5, D: 1 }), b = m.body, G = ['#173219', '#255022', '#3b762c', '#5f9e38', '#94c54c'];
  // the body is a chain of segments riding a travelling wave: the sea plane hides whatever is under y = 0
  const N = 34, segs = [];
  for (let i = 0; i < N; i++) {
    const taper = Math.min(1, (N - i) / 12), r = 0.3 + 0.85 * taper;
    const s = blob(r, i % 4 < 2 ? G[2] : G[1], 6.5 - i * 0.58, 0, 0, 1.25, 1, 1);
    if (i % 2 === 0) s.add(cone(0.14 + 0.2 * taper, 0.3 + 0.9 * taper, G[4], 0, r * 0.95 + 0.2 * taper, 0, 4));
    b.add(s);
    segs.push(s);
  }
  const fluke = cone(0.9, 1.8, G[3], -0.9, 0, 0, 4);
  fluke.rotation.z = Math.PI / 2;
  fluke.scale.z = 0.25;
  segs[N - 1].add(fluke);
  // neck rearing out of the water, head hanging over the prey
  const neck = new THREE.Group();
  neck.position.set(6.8, 0, 0);
  const P = (f) => V(0.6 * f + 2.6 * f * f, -0.6 + 7.4 * (1 - (1 - f) ** 2), 0); // local curve, f 0→1
  for (let k = 0; k < 9; k++) {
    const p = P(k / 9), s = blob(1.15 - k * 0.03, k % 4 < 2 ? G[2] : G[1], p.x, p.y, 0, 1, 1.15, 1);
    if (k > 1) s.add(cone(0.3, 1.1, G[4], -0.9, 0.2, 0, 4)).children[0].rotation.z = 1.1;
    neck.add(s);
  }
  const head = new THREE.Group();
  head.position.copy(P(1)).add(V(0.2, 0, 0));
  head.rotation.z = -0.3;
  head.add(blob(1.05, G[2], 0.4, 0, 0, 1.5, 0.9, 1.05), box(2, 0.55, 1.1, G[3], 2, -0.05, 0), box(2.5, 0.16, 0.9, '#a52623', 1.6, -0.55, 0));
  const jaw = box(2.5, 0.32, 1, G[1], 1.5, -0.95, 0);
  jaw.rotation.z = -0.22;
  head.add(jaw);
  for (const s of [-1, 1]) {
    head.add(lamp(0.42, 0.36, 0.12, 0.9, 0.3, s * 1.05), box(0.14, 0.3, 0.14, '#121219', 0.95, 0.3, s * 1.07));
    const horn = cone(0.2, 1.7, '#e3c088', -0.5, 0.9, s * 0.6, 5);
    horn.rotation.z = 1.0;
    head.add(horn);
    for (let k = 0; k < 3; k++) head.add(cone(0.1, 0.36, '#f5ecd2', 1.6 + k * 0.5, -0.42, s * 0.42, 4).rotateX(Math.PI));
  }
  neck.add(head);
  b.add(neck);
  setFoam(m, ring(1.5, 2.3, 14));
  m.foam.position.x = 7;
  m.anim = (t) => {
    for (const s of segs) {
      const x = s.position.x, env = Math.max(0, Math.min(1, (6.5 - x) / 3));
      s.position.y = -0.25 + env * 2.1 * Math.sin(0.8 * x + t * 1.3);
    }
    neck.rotation.z = Math.sin(t * 0.8) * 0.05;
    head.rotation.y = Math.sin(t * 0.6) * 0.25;
    jaw.rotation.z = -0.22 - Math.max(0, Math.sin(t * 0.9)) * 0.2;
  };
  m.anim(0);
  return m;
}

// --- 9. Moby Dick: the white whale ---------------------------------------------------------
function whale() {
  const m = frame({ L: 18, B: 5, D: 2 }), W = ['#d6d2cf', '#bdbab8', '#a7a3a4', '#716f74']; // lit by the warm sun these come out white, cream would come out yellow
  const g = new THREE.Group(); // inside body: its own slow heave, head up
  m.body.add(g);
  g.add(blob(2.2, W[0], -0.6, 0, 0, 3.0, 0.95, 1.1)); // back
  g.add(box(5.0, 3.0, 3.5, W[0], 4.9, 0.2, 0), blob(1.75, W[0], 7.3, 0.2, 0, 0.75, 0.86, 1.0)); // the great square head
  g.add(box(4.4, 0.3, 1.0, W[2], 4.9, -1.5, 0)); // narrow lower jaw
  for (let k = 0; k < 6; k++) for (const s of [-1, 1]) g.add(cone(0.1, 0.3, '#f5ecd2', 3.2 + k * 0.65, -1.25, s * 0.4, 4));
  for (let k = 0; k < 4; k++) g.add(cone(0.5 - k * 0.07, 0.7, W[1], -3 - k * 1.1, 1.95 - k * 0.32, 0, 5)); // hump and knuckles
  g.add(limb(V(-6, 0, 0), V(-9.4, 1.9, 0), 1.25, 0.45, W[1]));
  const flukes = new THREE.Group();
  flukes.position.set(-9.5, 2, 0);
  for (const s of [-1, 1]) {
    const f = blob(1, W[0], -0.5, 0, s * 1.4, 1.1, 0.16, 1.6);
    f.rotation.y = s * 0.5;
    flukes.add(f);
  }
  g.add(flukes);
  for (const s of [-1, 1]) g.add(box(0.3, 0.3, 0.08, '#121219', 2.9, -0.5, s * 1.78), box(1.7, 0.12, 0.06, W[3], 5.6, 0.7, s * 1.77).rotateZ(0.5), box(1.2, 0.1, 0.06, W[3], 4.3, 0.2, s * 1.77).rotateZ(-0.3));
  g.add(box(2.4, 0.05, 0.12, W[3], 5.2, 1.72, 0.7).rotateY(0.5), box(1.6, 0.05, 0.12, W[3], 4.2, 1.72, -0.8).rotateY(-0.4)); // old scars
  // harpoons left by the whalers, lines trailing
  const lines = [];
  for (const [x, z, lean] of [[1, 0.9, 0.5], [-1.4, -1, -0.4], [-2.9, 0.5, 0.2], [2.4, -0.6, -0.6]]) {
    const a = V(x, 1.75, z), tip = V(x - 0.9, 4.3, z + lean);
    g.add(limb(a, tip, 0.06, 0.06, '#3a3d44', 4), limb(a.clone().lerp(tip, 0.55), tip, 0.1, 0.1, '#704629', 4));
    lines.push(tip, V(x - 3.5, 1.6, z + lean * 2.5), V(x - 3.5, 1.6, z + lean * 2.5), V(x - 6, -0.4, z + lean * 4));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: '#8a785a' })));
  const spout = new THREE.Group();
  spout.position.set(6.6, 1.7, 0.7);
  for (let k = 0; k < 6; k++) spout.add(lamp(0.3, 0.5, 0.3, 0.25 * k + (k % 2) * 0.2, 0.5 + k * 0.55, (k % 3 - 1) * 0.3, '#f4fffb'));
  g.add(spout);
  const foam = new THREE.Group(), rim = ring(1, 1.1, 28); // the ellipse on a child: game.js scales the foam itself with her speed
  rim.scale.set(8.6, 1, 3.2);
  rim.position.x = -0.4;
  foam.add(rim);
  setFoam(m, foam);
  m.anim = (t) => {
    g.position.y = 0.95 + Math.sin(t * 0.7) * 0.3;
    g.rotation.z = 0.1 + Math.sin(t * 0.7 + 1) * 0.03;
    flukes.rotation.z = Math.sin(t * 1.1) * 0.3;
    spout.scale.setScalar(Math.max(0.001, Math.sin(t * 0.8)) ** 0.5);
  };
  m.anim(0);
  return m;
}

// --- 10. Charybdis and Scylla --------------------------------------------------------------
function spiral(r0, r1, turns, w, n = 30) { // a foam arm winding into the whirlpool
  const pos = [];
  const P = (j, off) => {
    const f = j / n, a = f * turns * Math.PI * 2, r = r0 + (r1 - r0) * f - off * w * (1 - f * 0.6);
    return [Math.cos(a) * r, 0, Math.sin(a) * r];
  };
  for (let j = 0; j < n; j++) pos.push(...P(j, 0), ...P(j + 1, 0), ...P(j + 1, 1), ...P(j, 0), ...P(j + 1, 1), ...P(j, 1));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.Mesh(g, mat('#f4fffb', { basic: true, side: THREE.DoubleSide }));
}
function charybdis() {
  const m = frame({ L: 28, B: 18, D: 1 }), rand = rng(7);
  m.still = true;
  // Charybdis: the sea plane cannot be dug into, so the pit is painted on it, darker toward the maw
  const ch = new THREE.Group();
  ch.position.x = -19; // bossfight.js PULL.d
  ['#1d5891', '#174478', '#12325c', '#0c2140'].forEach((hex, i) => ch.add(disc(9 - i * 1.9, hex, 0.02 + i * 0.01)));
  const arms = [new THREE.Group(), new THREE.Group()];
  for (let k = 0; k < 3; k++) {
    const a = spiral(9.4, 3.2, 0.9, 0.7), c = spiral(6.2, 2.6, 0.7, 0.35);
    a.rotation.y = c.rotation.y = (k * Math.PI * 2) / 3;
    a.position.y = 0.07;
    c.position.y = 0.08;
    arms[0].add(a);
    arms[1].add(c);
  }
  ch.add(...arms, disc(2.5, '#121219', 0.09), disc(1.3, '#6e1619', 0.1));
  const teeth = new THREE.Group();
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2, tooth = cone(0.5, 2.6, k % 2 ? '#f5ecd2' : '#ddcda6', Math.cos(a) * 2.5, 0.8, Math.sin(a) * 2.5, 5);
    teeth.add(aim(tooth, V(-Math.cos(a) * 0.45, 1, -Math.sin(a) * 0.45)));
  }
  ch.add(teeth);
  const wreck = [ // what is left of the last ship, circling down
    [box(2.4, 0.2, 0.5, '#8d5c35', 0, 0.15, 0), 7.4, 0.5],
    [box(1.6, 0.2, 0.4, '#704629', 0, 0.15, 0), 5.6, 0.75],
    [cyl(0.45, 0.45, 0.9, '#704629', 7), 6.6, 0.6],
    [box(4.2, 0.24, 0.24, '#3f2616', 0, 0.3, 0), 8.2, 0.45],
    [box(1.2, 0.9, 0.06, '#ddcda6', 0, 0.6, 0), 4.6, 0.95],
    [box(1.9, 0.2, 0.45, '#ad7a48', 0, 0.15, 0), 3.9, 1.1],
  ].map(([piece, r, speed], i) => {
    const pivot = new THREE.Group();
    piece.position.x = r;
    piece.rotation.set(rand() * 0.5, rand() * 3, rand() * 0.5);
    pivot.add(piece);
    pivot.userData = { speed, a: i * 1.3 };
    ch.add(pivot);
    return pivot;
  });
  // Scylla: six hound-headed necks reaching off her rock
  const sc = new THREE.Group();
  // (the group's origin: where the sim puts her, what balls hit)
  for (const [s, hex, x, y, z] of [[4.2, '#6f6f7c', 0, 1.3, 0], [2.8, '#4e4e5a', -2.6, 0.6, 1.9], [2.3, '#9695a0', 2.2, 0.5, -2.3], [1.7, '#6f6f7c', 1.4, 0.4, 2.8], [1.5, '#4e4e5a', -2.2, 0.4, -2.6]]) {
    const r = rock(rand, s, hex);
    r.position.set(x, y, z);
    sc.add(r);
  }
  const necks = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI + (i - 2.5) * 0.55, h = 4.6 + (i % 3) * 1.5, reach = 2.2 + ((i * 2) % 3) * 0.7, neck = new THREE.Group();
    neck.position.set(Math.cos(a) * 1.8, 2.2, Math.sin(a) * 1.8);
    const P = (f) => V(reach * f * f + 0.5 * Math.sin(f * 3.1), h * f, 0);
    const stem = new THREE.Group(); // apart from the head: a strike stretches it (scale.y), the head rides its tip unstretched
    for (let k = 0; k < 5; k++) stem.add(limb(P(k / 5), P((k + 1) / 5), 0.6 - k * 0.05, 0.55 - k * 0.05, k % 2 ? '#a52623' : '#6e1619'));
    neck.add(stem);
    const head = new THREE.Group();
    head.position.copy(P(1));
    head.rotation.z = -0.55;
    head.add(box(1.5, 0.75, 0.9, '#a52623', 0.5, 0, 0), box(0.8, 0.5, 0.7, '#d84a38', 1.4, -0.08, 0), box(1.5, 0.14, 0.7, '#3e0d10', 0.9, -0.45, 0));
    const jaw = box(1.6, 0.24, 0.75, '#6e1619', 0.8, -0.7, 0);
    jaw.rotation.z = -0.3;
    head.add(jaw);
    for (const s of [-1, 1]) {
      head.add(lamp(0.2, 0.2, 0.1, 0.75, 0.2, s * 0.46), cone(0.18, 0.6, '#d84a38', -0.1, 0.6, s * 0.32, 4));
      for (let k = 0; k < 2; k++) head.add(cone(0.08, 0.3, '#f5ecd2', 1.2 + k * 0.4, -0.3, s * 0.3, 4).rotateX(Math.PI));
    }
    neck.add(head);
    neck.userData = { a, i, h, stem, head, jaw, strike: null };
    sc.add(neck);
    necks.push(neck);
  }
  const surf = ring(4.4, 5.3, 18);
  m.body.add(ch, sc);
  setFoam(m, surf);
  let last = 0;
  m.anim = (t) => {
    arms[0].rotation.y = t * 0.5;
    arms[1].rotation.y = t * 0.9;
    teeth.position.y = Math.sin(t * 1.4) * 0.35;
    for (const p of wreck) p.rotation.y = p.userData.a + t * p.userData.speed;
    const dt = Math.max(0, t - last);
    last = t;
    for (const n of necks) {
      const u = n.userData, st = u.strike;
      let yaw = -u.a + Math.sin(t * 0.7 + u.i) * 0.3, pitch = Math.sin(t * 1.1 + u.i * 1.7) * 0.16, e = 0, gape = Math.max(0, Math.sin(t * 1.3 + u.i * 2.1)) * 0.25;
      if (st) { // k: 0 when the zone is marked → 1 when it lands. The head turns to it and rears, then whips out over the last fifth.
        const k = 1 - Math.max(0, st.sl.t) / (st.sl.t0 || 1), aim = Math.min(1, k / 0.3);
        if (st.sl.t <= 0) st.after += dt;
        if (st.lunge) e = st.after > 0.2 ? Math.max(0, 1 - (st.after - 0.2) / 0.5) : k < 0.8 ? 0 : (k - 0.8) / 0.2; // out, held a moment in the water, drawn back
        yaw += Math.atan2(Math.sin(st.yaw - yaw), Math.cos(st.yaw - yaw)) * Math.max(aim, e);
        pitch = pitch * (1 - aim) + 0.35 * aim * (1 - e) - st.pitch * e;
        gape = 0.5 * (1 - e) + 0.05;
        if (st.after > (st.lunge ? 0.7 : 0.15)) u.strike = null;
      }
      n.rotation.y = yaw;
      n.rotation.z = pitch;
      u.stem.scale.y = 1 + (st ? (st.stretch - 1) * e : 0);
      u.head.position.y = u.h * u.stem.scale.y;
      u.jaw.rotation.z = -0.3 - gape;
    }
  };
  // A head's zone (game.js, from bossfight.js): the free neck facing it goes for it. sl: the zone, in the world (its t runs down
  // to the blow); s: Scylla in the sim. A bite: the neck stretches as far as it takes to put the head on the water there.
  // Spat at (sl.from): the head only turns to it, reared and gaping.
  m.bite = (sl, s) => {
    const dx = sl.x - s.x, dz = sl.z - s.z, c = Math.cos(s.h), sn = Math.sin(s.h), tx = dx * c + dz * sn, tz = -dx * sn + dz * c; // into her frame
    const off = (n) => Math.abs(Math.atan2(Math.sin(Math.atan2(tz, tx) - n.userData.a), Math.cos(Math.atan2(tz, tx) - n.userData.a)));
    const n = necks.filter((o) => !o.userData.strike).sort((a, b) => off(a) - off(b))[0];
    if (!n) return;
    const D = Math.hypot(tx - n.position.x, tz - n.position.z), drop = n.position.y - 0.8;
    n.userData.strike = { sl, after: 0, lunge: !sl.from, yaw: -Math.atan2(tz - n.position.z, tx - n.position.x), pitch: Math.PI / 2 + Math.atan(drop / D), stretch: Math.max(1, Math.hypot(D, drop) / n.userData.h) };
  };
  m.anim(0);
  return m;
}

// --- 11. Aspidochelone: the island turtle --------------------------------------------------
function islandTurtle() {
  const m = frame({ L: 24, B: 18, D: 4 }), b = m.body, rand = rng(11);
  const R = 9, H = 4.2, top = (x, z) => H * Math.sqrt(Math.max(0, 1 - (x * x + z * z) / (R * R)));
  const dome = (k, polar, hex, seg = 12) => { // a cap of the shell: k scales it, polar is how far down it reaches
    const d = new THREE.Mesh(new THREE.SphereGeometry(R * k, seg, 4, 0, Math.PI * 2, 0, polar), mat(hex));
    d.scale.y = H / R;
    d.castShadow = d.receiveShadow = true;
    return d;
  };
  b.add(dome(1, Math.PI / 2, '#56351f'), dome(1.015, Math.PI * 0.32, '#e6cc8e'), dome(1.03, Math.PI * 0.19, '#5f9e38')); // shell, beach, grass
  for (let k = 0; k < 14; k++) { // scutes along the rim
    const a = (k / 14) * Math.PI * 2, s = box(1.3, 0.8, 3.4, k % 2 ? '#704629' : '#3f2616', Math.cos(a) * 8.7, 0.35, Math.sin(a) * 8.7);
    s.rotation.y = -a;
    b.add(s);
  }
  for (const [x, z, k] of [[1.5, 2.2, 1.4], [3.2, -1, 1.2], [-0.4, -3, 1.5], [-3.8, -1.6, 1.2], [0.8, 0.2, 1.6], [4.6, 2.4, 1.1]]) {
    const p = palm(rand);
    p.scale.setScalar(k);
    p.position.set(x, top(x, z) + 0.05, z);
    b.add(p);
  }
  for (const [x, z, s] of [[5.5, -3.2, 1], [-5.2, 3.4, 1.2], [2.5, 5.6, 0.8], [-1, 6.2, 0.6]]) {
    const r = rock(rand, s);
    r.position.set(x, top(x, z) + 0.2, z);
    b.add(r);
  }
  // a fort somebody built on her back, long ago
  const fx = -2.6, fz = 1.6, fy = top(fx, fz) - 0.2;
  const tower = cyl(1.1, 1.3, 2.8, '#9695a0', 8);
  tower.position.set(fx, fy + 1.4, fz);
  tower.receiveShadow = true;
  b.add(tower);
  for (let k = 0; k < 4; k++) b.add(box(0.5, 0.45, 0.5, '#bdbab8', fx + Math.cos(k * 1.57 + 0.4) * 0.85, fy + 3, fz + Math.sin(k * 1.57 + 0.4) * 0.85));
  b.add(box(3.2, 1.3, 0.6, '#6f6f7c', fx + 2.4, fy + 0.5, fz + 0.2), box(1.4, 0.7, 0.6, '#9695a0', fx + 2, fy + 1.4, fz + 0.2), box(0.6, 1.6, 2.2, '#6f6f7c', fx - 0.2, fy + 0.5, fz - 2));
  for (const dz of [-0.3, 0.7]) {
    const gun = cyl(0.14, 0.18, 1.3, '#3a3d44', 6);
    gun.rotation.z = -Math.PI / 2 + 0.15;
    gun.position.set(fx + 3.4, fy + 1.4, fz + dz);
    b.add(gun, box(0.6, 0.3, 0.4, '#56351f', fx + 3.1, fy + 1.15, fz + dz));
  }
  m.flag = pennant('#a52623');
  m.flag.scale.setScalar(0.7);
  m.flag.position.set(fx, fy + 4.6, fz);
  b.add(m.flag, box(0.07, 1.8, 0.07, '#2b1a10', fx, fy + 3.7, fz));
  // head, flippers and tail breaking the surface
  const head = new THREE.Group();
  head.position.set(8.2, 0.2, 0);
  head.add(limb(V(0, 0, 0), V(3, 1.1, 0), 1.6, 1.25, '#5f9e38'), blob(1.6, '#5f9e38', 4.1, 1.4, 0, 1.3, 0.9, 1), box(1.5, 0.5, 1.5, '#3b762c', 5.2, 0.7, 0), cone(0.55, 1.1, '#cc9d63', 6.2, 1.15, 0, 4).rotateZ(-Math.PI / 2 - 0.3));
  for (const s of [-1, 1]) head.add(lamp(0.45, 0.4, 0.12, 4.9, 1.75, s * 1.43), box(0.16, 0.34, 0.14, '#121219', 5, 1.75, s * 1.45), box(0.7, 0.2, 0.2, '#3b762c', 4.9, 2.05, s * 1.42));
  b.add(head);
  const flippers = [[6, 7.4, 0.7], [6, -7.4, -0.7], [-6, 7, 2.3], [-6, -7, -2.3]].map(([x, z, ry], i) => {
    const f = blob(1, '#5f9e38', x, 0.1, z, 3, 0.34, 1.3);
    f.rotation.y = ry;
    f.userData.i = i;
    b.add(f);
    return f;
  });
  b.add(cone(0.9, 2.6, '#3b762c', -9.8, 0.2, 0, 5).rotateZ(Math.PI / 2 - 0.15));
  setFoam(m, ring(9.3, 10.2, 28));
  m.anim = (t) => {
    head.rotation.z = Math.sin(t * 0.5) * 0.06;
    head.rotation.y = Math.sin(t * 0.3) * 0.12;
    for (const f of flippers) f.rotation.z = Math.sin(t * 0.9 + f.userData.i * 1.6) * 0.18;
  };
  return m;
}

// --- 12. Poseidon --------------------------------------------------------------------------
function poseidon() {
  const m = frame({ L: 8, B: 11, D: 1 }), up = new THREE.Group(); // all of him: turns and leans as one, hinged at the waterline
  m.body.add(up);
  const SK = ['#a6844e', '#c9a86a', '#e6cc8e'], HAIR = ['#f4fffb', '#d6d2cf', '#bdbab8'], GOLD = '#c9952a';
  const torso = cyl(3.3, 2.3, 6.2, SK[1], 6); // waist in the water, chest wide
  torso.scale.x = 0.62;
  torso.position.y = 2.6;
  up.add(torso);
  for (const s of [-1, 1]) up.add(box(0.5, 1.5, 2.2, SK[2], 1.8, 4.4, s * 1.2), blob(1.45, SK[1], 0, 5.4, s * 3.5), blob(1.5, '#255022', -0.3, 6.1, s * 3.3, 1.1, 0.35, 1.1), box(0.3, 2.2, 0.8, '#3b762c', -1.4, 4.6, s * 3.2));
  const neck = cyl(0.9, 1.1, 1.1, SK[0], 6);
  neck.position.y = 6.2;
  up.add(neck);
  const head = new THREE.Group();
  head.position.y = 7.7;
  head.add(box(2, 2.3, 1.9, SK[1], 0.1, 0, 0), box(0.4, 0.3, 1.95, SK[0], 1.05, 0.5, 0), box(0.5, 0.7, 0.4, SK[2], 1.25, 0, 0));
  for (const s of [-1, 1]) head.add(lamp(0.14, 0.24, 0.4, 1.13, 0.25, s * 0.5, '#cdf5ea'));
  head.add(box(1.6, 3, 2.3, HAIR[1], -0.75, -0.3, 0), box(2.2, 0.5, 2.2, HAIR[0], 0, 1.3, 0)); // hair
  head.add(box(0.3, 0.25, 1.5, HAIR[0], 1.25, -0.4, 0), box(0.8, 1.2, 1.9, HAIR[0], 0.95, -1, 0), box(0.7, 1.4, 1.4, HAIR[1], 1.2, -2, 0), box(0.5, 1.1, 0.8, HAIR[0], 1.35, -2.9, 0)); // beard down the chest
  const crown = cyl(1.25, 1.15, 0.5, GOLD, 8);
  crown.position.y = 1.75;
  head.add(crown);
  for (let k = 0; k < 6; k++) head.add(cone(0.2, 0.9, '#ffd24a', Math.cos(k * 1.047) * 1.1, 2.4, Math.sin(k * 1.047) * 1.1, 4));
  up.add(head);
  // arms hinge at the shoulder (their parts are placed from it). Right: raised, holding the trident. Left: low, hand open over the water.
  const armR = new THREE.Group(), armL = new THREE.Group(), O = V(0, 0, 0);
  armR.position.set(0, 5.4, 3.5);
  armL.position.set(0, 5.4, -3.5);
  const E = V(0.8, 1.8, 2), HAND = V(2, 3.6, 1.5), trident = new THREE.Group();
  trident.position.copy(HAND);
  trident.rotation.z = -0.1;
  trident.add(limb(V(0, -7, 0), V(0, 4.6, 0), 0.26, 0.26, '#ffd24a'), box(0.45, 0.45, 3.4, '#ffd24a', 0, 4.6, 0), cone(0.4, 3, '#ffd24a', 0, 6.2, 0, 4));
  for (const s of [-1, 1]) trident.add(cone(0.36, 2.4, '#ffd24a', 0, 5.9, s * 1.5, 4));
  armR.add(limb(O, E, 1, 0.8, SK[1]), limb(E, HAND, 0.8, 0.65, SK[2]), blob(0.85, SK[1], HAND.x, HAND.y, HAND.z), trident);
  const E2 = V(1.2, -2.7, -1.2), H2 = V(3.6, -3.7, 0);
  armL.add(limb(O, E2, 1, 0.8, SK[1]), limb(E2, H2, 0.8, 0.65, SK[2]), box(1.2, 0.35, 1.2, SK[2], H2.x + 0.5, H2.y, H2.z));
  up.add(armR, armL);
  const foam = new THREE.Group();
  foam.add(ring(2.6, 3.6, 16), ring(4.6, 5, 20));
  setFoam(m, foam);
  // cue(kind, T) (game.js, from bossfight.js): the blow lands T s from now, he acts it out.
  // trident: the arm draws back, then stabs forward as the bolts leave. tide: he rears, both arms high, and brings it all down on the water.
  let cue = null, at = 0, T = 0, now = 0;
  m.cue = (kind, t) => { cue = kind; at = now; T = t; };
  const ramp = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
  m.anim = (t) => {
    now = t;
    const c = t - at, wind = cue ? ramp(c, 0, Math.min(1, T * 0.4)) * (1 - ramp(c, T - 0.3, T - 0.05)) : 0, blow = cue ? ramp(c, T - 0.3, T - 0.05) * (1 - ramp(c, T + 0.3, T + 1.2)) : 0;
    if (cue && c > T + 1.2) cue = null;
    const tide = cue === 'tide' ? 1 : 0, bolt = cue === 'trident' ? 1 : 0, calm = 1 - wind - blow; // calm: how much of his idle sway is left
    up.rotation.y = Math.sin(t * 0.4) * 0.16 * calm;
    up.rotation.z = Math.sin(t * 0.55) * 0.05 + tide * (wind * 0.22 - blow * 0.3) - bolt * blow * 0.12;
    up.position.y = Math.sin(t * 0.9) * 0.2 + tide * (wind * 0.9 - blow * 0.7); // the swell lifts him; he rises before the tide
    head.rotation.y = Math.sin(t * 0.35) * 0.45 * calm;
    head.rotation.z = Math.sin(t * 0.5 + 1) * 0.1 + wind * 0.2 - blow * 0.25;
    armR.rotation.z = Math.sin(t * 0.6) * 0.1 + wind * 0.55 - blow * (bolt * 0.85 + tide * 0.9);
    armR.rotation.x = Math.sin(t * 0.45) * 0.08;
    armL.rotation.x = Math.sin(t * 0.7) * 0.28 * calm;
    armL.rotation.z = Math.sin(t * 0.5) * 0.14 + tide * (wind * 1.7 - blow * 0.4) + bolt * blow * 0.5;
    foam.children[1].scale.setScalar(1 + (t * 0.25 % 1) * 0.5);
  };
  return m;
}

// name: proper names stay as they are. lore / look / play: the review card (French only, it is a dev page).
export const BOSSES = [
  { id: 'trinidad', build: trinidad, name: 'SANTÍSIMA TRINIDAD', title: 'Le vaisseau amiral', origin: 'Histoire · Espagne, 1769',
    lore: 'Le plus grand navire de guerre de son siècle : quatre ponts, 140 canons. Pris et coulé après Trafalgar.',
    look: 'Coque de 20, trois mâts à quatre voiles, deux rangées de sabords, trois lanternes de poupe.',
    play: 'Trois phases : bordées doubles, barrage de mortier marqué sur l\'eau, renforts.' },
  { id: 'atocha', build: atocha, name: 'NUESTRA SEÑORA DE ATOCHA', title: 'Le galion du trésor', origin: 'Histoire · Flotte des Indes, 1622',
    lore: 'Chargé de quarante tonnes d\'or et d\'argent, sombré dans un ouragan au large de la Floride.',
    look: 'Galion ventru et haut, dorures qui brillent, or en tas sur le pont, voiles crème et or.',
    play: 'Ne se bat pas : fuit vers le bord de la carte avec son escorte. Butin énorme s\'il est pris avant.' },
  { id: 'galley', build: galley, name: 'BARBEROUSSE', title: 'La galère amirale', origin: 'Capitaine · Méditerranée, XVIe siècle',
    lore: 'Khayr ad-Din, corsaire d\'Alger devenu grand amiral ottoman. Sa galère ne dépend d\'aucun vent.',
    look: 'Longue et basse, éperon de bronze, deux voiles latines, douze rames par bord qui rament.',
    play: 'Ignore le vent. Charge à l\'éperon, canons de chasse droit devant.' },
  { id: 'turtle', build: turtleShip, name: 'YI SUN-SIN', title: 'Le bateau-tortue', origin: 'Capitaine · Corée, 1592',
    lore: 'L\'amiral invaincu et son geobukseon : un toit de pointes de fer, une tête de dragon qui crache la fumée.',
    look: 'Carapace verte hérissée de pointes, tête de dragon, sabords tout autour, rames, mâts courts.',
    play: 'Carapace : dégâts réduits sauf par l\'arrière. Tire dans toutes les directions.' },
  { id: 'blackbeard', build: blackbeard, name: 'BARBE-NOIRE', title: 'Queen Anne\'s Revenge', origin: 'Capitaine · Caraïbes, 1718',
    lore: 'Edward Teach allait au combat des mèches allumées dans la barbe, pour avoir l\'air du diable.',
    look: 'Coque et voiles noires en lambeaux, liseré rouge sang, mèches qui brûlent le long du bastingage.',
    play: 'Cherche le bout portant. Une bordée sur deux enflamme, barils de poudre dans son sillage.' },
  { id: 'junk', build: junk, name: 'CHING SHIH', title: 'La jonque de la Bannière rouge', origin: 'Capitaine · Mer de Chine, 1807',
    lore: 'La reine des pirates commandait des centaines de jonques. Jamais vaincue, elle a pris sa retraite riche.',
    look: 'Grande jonque à poupe haute, trois voiles rouges à lattes, yeux peints à la proue.',
    play: 'Reine d\'une flotte : appelle des jonques en renfort à mesure qu\'elle perd de la coque.' },
  { id: 'dutchman', build: dutchman, name: 'LE HOLLANDAIS VOLANT', title: 'Le vaisseau fantôme', origin: 'Légende · Cap de Bonne-Espérance',
    lore: 'Le capitaine Van der Decken a juré de doubler le cap, dût-il naviguer jusqu\'au Jugement dernier.',
    look: 'Coque couverte d\'algues, voiles en lambeaux qui luisent, flotte au-dessus de l\'eau sur un anneau de brume.',
    play: 'Traverse les îles, disparaît, ressort ailleurs. Ne se touche qu\'en forme solide.' },
  { id: 'serpent', build: serpent, name: 'JÖRMUNGANDR', title: 'Le serpent de mer', origin: 'Mythologie nordique',
    lore: 'Le serpent de Midgard entoure le monde et se mord la queue. Quand il la lâche, c\'est le Ragnarök.',
    look: 'Corps en arches qui ondulent, cou dressé, tête à cornes, crête dorsale.',
    play: 'Plonge, une ombre court sur l\'eau, ressort sous le navire.' },
  { id: 'whale', build: whale, name: 'MOBY DICK', title: 'Le cachalot blanc', origin: 'Roman · Melville, 1851',
    lore: 'La baleine blanche qui a pris la jambe du capitaine Achab, et qui coule ceux qui la chassent.',
    look: 'Tête carrée énorme, cicatrices, harpons plantés dans le dos avec leurs lignes, queue levée, souffle.',
    play: 'Charge en ligne droite (bélier très lourd), saute et retombe sur une zone marquée, plonge.' },
  { id: 'charybdis', build: charybdis, name: 'CHARYBDE ET SCYLLA', title: 'Le détroit', origin: 'Mythologie grecque · Odyssée',
    lore: 'D\'un côté le gouffre qui avale la mer, de l\'autre le monstre à six têtes. Ulysse a choisi Scylla.',
    look: 'Deux modèles : un maelström à gueule dentée où tournent des épaves, un rocher à six cous.',
    play: 'Fixes. Charybde attire les navires vers son centre, Scylla mord sur des zones marquées. Il faut passer entre.' },
  { id: 'island', build: islandTurtle, name: 'ASPIDOCHÉLONE', title: 'L\'île-tortue', origin: 'Bestiaires médiévaux',
    lore: 'Les marins accostent, allument un feu sur la plage, et l\'île plonge.',
    look: 'Carapace couverte de sable, palmiers, fort en ruine. Tête et nageoires à fleur d\'eau.',
    play: 'Passe pour une île jusqu\'à son réveil. Porte les canons et le mortier du fort, et se déplace.' },
  { id: 'poseidon', build: poseidon, name: 'POSÉIDON', title: 'Le dieu des mers', origin: 'Mythologie grecque',
    lore: 'Maître des mers et des séismes. On ne navigue qu\'avec sa permission.',
    look: 'Torse géant sorti de l\'eau, barbe blanche, couronne et trident d\'or.',
    play: 'Boss final. Le trident frappe en ligne marquée sur l\'eau, ses vagues poussent les navires.' },
];
export const buildBoss = (id) => BOSSES.find((b) => b.id === id).build();
