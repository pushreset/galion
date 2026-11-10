import * as THREE from 'three';

// Procedural low-poly ships. Bow points +x in local space; game rotates root by -h.
// Everything is flat-shaded Lambert in palette colours; post.js does the pixel look.

const matCache = new Map();
export function mat(hex, extra = {}) {
  const key = hex + JSON.stringify(extra);
  if (!matCache.has(key)) {
    const Ctor = extra.basic ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
    const { basic, ...rest } = extra;
    matCache.set(key, new Ctor({ color: hex, ...(basic ? {} : { flatShading: true }), ...rest })); // Basic has no flatShading: passing it warns
  }
  return matCache.get(key);
}

const SPECS = {
  galleon: {
    L: 14, B: 4.2, D: 1.7, ports: 5,
    masts: [
      { u: 0.4, h: 10.5, sails: [[0.15, 0.47, 1.5], [0.51, 0.78, 1.2], [0.82, 0.95, 0.8]] },
      { u: 0.0, h: 12.5, sails: [[0.15, 0.45, 1.62], [0.49, 0.77, 1.3], [0.81, 0.94, 0.86]] },
      { u: -0.5, h: 8.5, sails: [[0.24, 0.58, 1.1], [0.63, 0.88, 0.78]] },
    ],
    stern: [-1, -0.58, 1.5], fore: [0.6, 0.88, 0.8],
  },
  brig: {
    L: 10.5, B: 3.3, D: 1.4, ports: 3,
    masts: [
      { u: 0.3, h: 9, sails: [[0.17, 0.5, 1.5], [0.55, 0.85, 1.15]] },
      { u: -0.25, h: 10, sails: [[0.17, 0.5, 1.6], [0.55, 0.85, 1.2]] },
    ],
    stern: [-1, -0.62, 1.1], fore: [0.62, 0.88, 0.6],
  },
  sloop: {
    L: 8, B: 2.6, D: 1.15, ports: 2,
    masts: [{ u: 0.12, h: 8, sails: [[0.18, 0.55, 1.7], [0.6, 0.88, 1.25]] }],
    stern: [-1, -0.65, 0.8], fore: null,
  },
};

export const LIVERIES = {
  pirate: { sail: ['#2c2c38', '#2c2c38'], emblem: 'skull', trim: '#ad7a48', hull: '#704629', hullLow: '#3f2616', rail: '#3f2616', flag: 'skull' },
  navy: { sail: ['#f5ecd2', '#a52623'], emblem: 'cross', trim: '#a52623', hull: '#8d5c35', hullLow: '#56351f', rail: '#3e0d10', flag: '#a52623' },
  merchant: { sail: ['#ddcda6', '#ddcda6'], emblem: null, trim: '#cc9d63', hull: '#8d5c35', hullLow: '#56351f', rail: '#56351f', flag: '#f5ecd2' },
};

const width = (u, B) => (u >= 0 ? (B / 2) * Math.pow(Math.max(0, 1 - u * u), 0.55) : (B / 2) * (1 - 0.32 * u ** 4));
const sheer = (u, D) => D + 0.32 * u * u;

// --- emblem textures (canvas pixel art, nearest-filtered) -------------------
const SKULL = [
  '....########....',
  '..############..',
  '.##############.',
  '.##############.',
  '.###...##...###.',
  '.##....##....##.',
  '.##....##....##.',
  '.###..####..###.',
  '..#####..#####..',
  '...####..####...',
  '....########....',
  '....#.#.#.#.#...',
  '....#########...',
];
const texCache = new Map();
function emblemTex(kind, bg) {
  const key = kind + bg;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 32, 32);
  if (kind === 'skull') {
    g.fillStyle = '#ddcda6';
    for (let i = 0; i < 22; i++) {
      // crossbones: two 2px diagonals with knobbed ends
      g.fillRect(5 + i, 15 + Math.round(i * 0.6), 2, 2);
      g.fillRect(26 - i, 15 + Math.round(i * 0.6), 2, 2);
    }
    for (const [x, y] of [[4, 14], [27, 14], [4, 28], [27, 28]]) g.fillRect(x - 1, y, 3, 3);
    SKULL.forEach((row, y) => [...row].forEach((ch, x) => ch === '#' && g.fillRect(8 + x, 3 + y, 1, 1)));
    g.fillStyle = '#f5ecd2';
    g.fillRect(10, 5, 4, 1);
  } else if (kind === 'cross') {
    g.fillStyle = '#f5ecd2';
    g.fillRect(13, 0, 6, 32);
    g.fillRect(0, 13, 32, 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(key, t);
  return t;
}

// --- hull loft -------------------------------------------------------------
function hullMesh(sp, lv) {
  const { L, B, D } = sp;
  // [width factor, y] rows top→keel. y: number = absolute, string 'd+x' = sheer-relative
  const rows = [[0.88, 0.55, 1], [0.95, 0.12, 1], [0.99, -0.14, 1], [1.0, -0.8, 1], [0.92, -0.02, 0], [0.55, -0.85, 0], [0.0, -1.25, 0]];
  const bandCol = [lv.rail, lv.trim, lv.hull, lv.hullLow, lv.hullLow, lv.hullLow];
  const N = 16;
  const pos = [], col = [];
  const P = (i, r, s) => {
    const u = -1 + (2 * i) / N;
    const [fw, y, rel] = rows[r];
    return [(u * L) / 2, rel ? sheer(u, D) + y : y, s * fw * width(u, B)];
  };
  const tmp = new THREE.Color();
  const push = (a, b, c, hex) => {
    pos.push(...a, ...b, ...c);
    tmp.set(hex).convertSRGBToLinear();
    for (let k = 0; k < 3; k++) col.push(tmp.r, tmp.g, tmp.b);
  };
  for (const s of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      for (let r = 0; r < rows.length - 1; r++) {
        const a = P(i, r, s), b = P(i + 1, r, s), c = P(i + 1, r + 1, s), d = P(i, r + 1, s);
        push(a, b, c, bandCol[r]);
        push(a, c, d, bandCol[r]);
      }
    }
  }
  // transom: fan across the flat stern
  const ring = [];
  for (let r = 0; r < rows.length; r++) ring.push(P(0, r, 1));
  for (let r = rows.length - 1; r >= 0; r--) ring.push(P(0, r, -1));
  const ctr = [(-L / 2), sheer(-1, D) - 0.4, 0];
  for (let k = 0; k < ring.length - 1; k++) push(ctr, ring[k], ring[k + 1], lv.hull);
  // deck strip
  for (let i = 0; i < N; i++) {
    const u0 = -1 + (2 * i) / N, u1 = -1 + (2 * (i + 1)) / N;
    const y0 = sheer(u0, D) + 0.02, y1 = sheer(u1, D) + 0.02;
    const w0 = width(u0, B) * 0.9, w1 = width(u1, B) * 0.9;
    const plank = i % 2 ? '#ad7a48' : '#8d5c35';
    push([(u0 * L) / 2, y0, -w0], [(u1 * L) / 2, y1, -w1], [(u1 * L) / 2, y1, w1], plank);
    push([(u0 * L) / 2, y0, -w0], [(u1 * L) / 2, y1, w1], [(u0 * L) / 2, y0, w0], plank);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide }));
  m.castShadow = m.receiveShadow = true;
  return m;
}

function box(w, h, d, hex, x, y, z, extra) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex, extra));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function cyl(r0, r1, h, hex, seg = 6) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat(hex));
  m.castShadow = true;
  return m;
}

// A square sail spanning the beam (local z), billowing forward (+x).
function sail(w, h, billow, material) {
  const g = new THREE.PlaneGeometry(w, h, 6, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (w / 2), v = p.getY(i) / (h / 2);
    p.setZ(i, billow * (1 - u * u) * (1 - 0.35 * (v - 0.3) ** 2));
  }
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.castShadow = true;
  return m;
}

function castle(sp, lv, [u0, u1, h], group) {
  const { L, B, D } = sp;
  const x0 = (u0 * L) / 2, x1 = (u1 * L) / 2, um = (u0 + u1) / 2;
  const w = width(um, B) * 2 * 0.93;
  const y = sheer(um, D) - 0.1;
  group.add(box(x1 - x0, h, w, lv.hull, (x0 + x1) / 2, y + h / 2, 0));
  group.add(box(x1 - x0 + 0.1, 0.18, w + 0.1, lv.trim, (x0 + x1) / 2, y + h - 0.25, 0));
  group.add(box(x1 - x0, 0.06, w * 0.92, '#ad7a48', (x0 + x1) / 2, y + h + 0.01, 0)); // castle deck
  // low rail around the castle deck
  group.add(box(x1 - x0, 0.35, 0.12, lv.rail, (x0 + x1) / 2, y + h + 0.15, w / 2 - 0.06));
  group.add(box(x1 - x0, 0.35, 0.12, lv.rail, (x0 + x1) / 2, y + h + 0.15, -w / 2 + 0.06));
  return { x0, x1, y, h, w };
}

export function setGuns(mesh, n) {
  const { guns, spec: { L, B, D } } = mesh;
  guns.clear();
  for (const s of [-1, 1]) {
    for (let k = 0; k < n; k++) {
      const u = n > 1 ? -0.42 + (0.82 * k) / (n - 1) : 0; // same spacing as fireBroadside (sim.js)
      const x = (u * L) / 2, z = s * width(u, B);
      const y = sheer(u, D) - 0.42;
      guns.add(box(0.46, 0.36, 0.06, '#121219', x, y, z + s * 0.03));
      const barrel = cyl(0.09, 0.11, 0.55, '#1c1e22', 5);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(x, y, z + s * 0.28);
      guns.add(barrel);
    }
  }
}
export function buildShip(type, livery, ports = SPECS[type]?.ports) {
  if (type === 'kraken') return buildKraken();
  const sp = SPECS[type], lv = LIVERIES[livery];
  const { L, B, D } = sp;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  body.add(hullMesh(sp, lv));

  // stern castle with lit gallery windows
  const lamp = mat('#ffd24a', { basic: true });
  const sc = castle(sp, lv, sp.stern, body);
  const nWin = type === 'sloop' ? 2 : 3;
  for (let k = 0; k < nWin; k++) {
    const z = (k - (nWin - 1) / 2) * (sc.w / (nWin + 0.5));
    body.add(box(0.12, 0.42, 0.42, '#ffd24a', sc.x0 - 0.03, sc.y + sc.h * 0.55, z, { basic: true }));
    body.add(box(0.12, 0.3, 0.3, '#ffd24a', sc.x0 - 0.03, sc.y + 0.25 + 0.15, z * 0.9, { basic: true }));
  }
  for (const s of [-1, 1]) {
    for (let k = 0; k < 2; k++) body.add(box(0.36, 0.34, 0.08, '#ffd24a', sc.x0 + 0.5 + k * 0.6, sc.y + sc.h * 0.55, s * (sc.w / 2 + 0.03), { basic: true }));
  }
  // stern lanterns
  const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.42, 0.3), lamp);
  lantern.position.set(sc.x0 - 0.2, sc.y + sc.h + 0.9, 0);
  body.add(lantern, box(0.08, 0.8, 0.08, '#1c1e22', sc.x0 - 0.1, sc.y + sc.h + 0.4, 0));
  if (sp.fore) castle(sp, lv, sp.fore, body);

  // gun ports + barrels: one per cannon actually fired, rebuilt by setGuns on upgrades
  const guns = new THREE.Group();
  body.add(guns);

  // bowsprit + jib
  const bsLen = L * 0.3, bsA = 0.32;
  const bs = cyl(0.1, 0.14, bsLen, '#3f2616');
  bs.rotation.z = -Math.PI / 2 + bsA;
  const bsBase = new THREE.Vector3(L / 2 - 0.3, D + 0.45, 0);
  const bsTip = bsBase.clone().add(new THREE.Vector3(Math.cos(bsA), Math.sin(bsA), 0).multiplyScalar(bsLen));
  bs.position.copy(bsBase).lerp(bsTip, 0.5);
  body.add(bs);

  // masts, yards, sails
  const sailMats = lv.sail.map((hex) => mat(hex, { side: THREE.DoubleSide, emissive: new THREE.Color(hex).multiplyScalar(0.22) }));
  const emblemMat = lv.emblem
    ? new THREE.MeshLambertMaterial({ map: emblemTex(lv.emblem, lv.emblem === 'cross' ? lv.sail[1] : lv.sail[0]), side: THREE.DoubleSide, emissive: 0x333333, emissiveMap: emblemTex(lv.emblem, lv.emblem === 'cross' ? lv.sail[1] : lv.sail[0]) })
    : null;
  const tops = [];
  const sails = [];
  const rigs = [];
  sp.masts.forEach((m, mi) => {
    const x = (m.u * L) / 2, y0 = sheer(m.u, D);
    const mast = cyl(0.12, 0.2, m.h, '#3f2616');
    mast.position.set(x, y0 + m.h / 2, 0);
    body.add(mast);
    tops.push(new THREE.Vector3(x, y0 + m.h, 0));
    const rig = new THREE.Group();
    rig.position.x = x;
    body.add(rig);
    rigs.push(rig);
    m.sails.forEach(([f0, f1, wf], si) => {
      const w = B * wf, h = (f1 - f0) * m.h;
      const yc = y0 + ((f0 + f1) / 2) * m.h;
      rig.add(box(0.14, 0.14, w + 0.5, '#2b1a10', 0.12, y0 + f1 * m.h, 0));
      let material = sailMats[si % 2 === 0 ? 0 : 1];
      // emblem on the big lower sails of fore and main
      if (emblemMat && si === 0 && mi < 2 && lv.emblem === 'skull') material = emblemMat;
      if (emblemMat && si === 1 && lv.emblem === 'cross') material = emblemMat;
      const s = sail(w, h, 0.35 + 0.18 * wf, material);
      s.position.set(0.2, yc, 0);
      rig.add(s);
      sails.push(s);
    });
    if (mi === (sp.masts.length > 1 ? 1 : 0)) {
      const nest = cyl(0.45, 0.4, 0.4, '#3f2616', 8);
      nest.position.set(x, y0 + m.h * 0.79, 0);
      body.add(nest);
    }
  });

  // flag on the tallest mast
  const tallest = tops.reduce((a, b) => (b.y > a.y ? b : a));
  const flagMat = lv.flag === 'skull'
    ? new THREE.MeshLambertMaterial({ map: emblemTex('skull', '#121219'), side: THREE.DoubleSide })
    : mat(lv.flag, { side: THREE.DoubleSide });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.3, 4, 1).translate(-0.95, 0, 0), flagMat);
  flag.position.copy(tallest).add(new THREE.Vector3(0, 0.3, 0));
  flag.castShadow = true;
  body.add(flag);

  // jib from bowsprit tip to the foremast
  const fm = tops[0];
  const jibG = new THREE.BufferGeometry().setFromPoints([bsTip, new THREE.Vector3(fm.x, fm.y * 0.62, 0), new THREE.Vector3(fm.x + (bsTip.x - fm.x) * 0.25, D + 1.0, 0)]);
  jibG.computeVertexNormals();
  const jib = new THREE.Mesh(jibG, sailMats[livery === 'navy' ? 0 : 0]);
  jib.castShadow = true;
  body.add(jib);

  // rigging: stays between mast tops and to the bowsprit/stern, shrouds to the rails
  const pts = [];
  pts.push(bsTip, fm);
  for (let i = 0; i < tops.length - 1; i++) pts.push(tops[i], new THREE.Vector3(tops[i + 1].x, tops[i + 1].y * 0.55, 0));
  const last = tops[tops.length - 1];
  pts.push(last, new THREE.Vector3(-L / 2 + 0.2, sc.y + sc.h + 0.3, 0));
  for (const t of tops) {
    for (const s of [-1, 1]) {
      for (let k = -1; k <= 1; k++) {
        const u = (t.x + k * 0.5) / (L / 2);
        pts.push(new THREE.Vector3(t.x, t.y * 0.72, 0), new THREE.Vector3(t.x + k * 0.5, sheer(u, D) + 0.5, s * width(u, B) * 0.9));
      }
    }
  }
  body.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1b110b' })));

  // hull foam: flat band hugging the waterline, lives on root so it doesn't roll
  const foam = foamRing(sp);
  root.add(foam);

  const mesh = { root, body, flag, foam, sails, rigs, guns, spec: sp };
  setGuns(mesh, ports);
  return mesh;
}

function foamRing(sp) {
  const { L, B } = sp;
  const N = 28, pos = [];
  const pt = (i, off) => {
    const t = (i / N) * Math.PI * 2;
    const u = Math.cos(t);
    const z = Math.sign(Math.sin(t)) * width(u, B) * 0.94;
    const bowBoost = Math.max(0, u) ** 3 * 0.9;
    return [(u * L) / 2 + Math.cos(t) * (off + bowBoost), 0.05, z + Math.sin(t) * (off + bowBoost * 0.6)];
  };
  for (let i = 0; i < N; i++) {
    const a = pt(i, 0), b = pt(i + 1, 0), c = pt(i + 1, 0.55), d = pt(i, 0.55);
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const m = new THREE.Mesh(g, mat('#f4fffb', { basic: true, side: THREE.DoubleSide }));
  m.name = 'foam';
  return m;
}

// Kraken (sim.js team 3): a head breaking the surface, eyes forward (+x), arm tips curling out of the water around it.
// Same shape as a ship mesh ({root, body, flag, foam, rigs…}) so game.js syncShip drives it; arms sway there.
export const KRAKEN = ['#4f1f5f', '#7a3486', '#a552ad']; // palette.js
export function buildKraken() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(KRAKEN[1]));
  head.scale.set(1.25, 1.1, 1);
  head.castShadow = true;
  body.add(head);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.6, 7), mat(KRAKEN[2]));
  crown.position.set(-1.6, 3.4, 0);
  crown.rotation.z = 0.7;
  crown.castShadow = true;
  body.add(crown);
  for (const z of [-1.3, 1.3]) {
    body.add(box(0.5, 0.9, 0.9, '#ffd24a', 3.5, 1.4, z, { basic: true }));
    body.add(box(0.2, 0.6, 0.3, '#121219', 3.8, 1.4, z));
  }
  const arms = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5, arm = new THREE.Group();
    arm.position.set(Math.cos(a) * 5, 0, Math.sin(a) * 5);
    arm.rotation.y = -a;
    for (let k = 0; k < 3; k++) { // three tapering segments, each bent a bit more: a curl
      const seg = cyl(0.55 - k * 0.15, 0.7 - k * 0.15, 1.6, KRAKEN[k === 2 ? 2 : 1]);
      seg.position.set(k * 0.5, 0.6 + k * 1.3, 0);
      seg.rotation.z = -0.25 - k * 0.35;
      arm.add(seg);
    }
    body.add(arm);
    arms.push(arm);
  }
  const foam = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.4, 16).rotateX(-Math.PI / 2).translate(0, 0.05, 0), mat('#f4fffb', { basic: true, side: THREE.DoubleSide }));
  root.add(foam);
  return { root, body, flag: new THREE.Object3D(), foam, sails: [], rigs: [], arms, guns: new THREE.Group(), spec: { L: 10, B: 8, D: 1 } };
}
// One tentacle slam (game.js): the group sits on the target spot; the arm (userData.arm) rises 7 units off it
// and pivots at its base (rotation.z < 0) to fall across the spot.
// Geometry shared by every slam (one every 3 s; game.js only scene.remove()s them), like the barrels'.
const tentacleGeo = [0, 1, 2, 3].map((k) => new THREE.CylinderGeometry(0.9 - k * 0.2, 1.15 - k * 0.2, 2.6, 6));
export function buildTentacle() {
  const g = new THREE.Group(), arm = new THREE.Group();
  arm.position.x = -7;
  for (let k = 0; k < 4; k++) {
    const seg = new THREE.Mesh(tentacleGeo[k], mat(KRAKEN[Math.min(2, k)]));
    seg.castShadow = true;
    seg.position.set(k * 0.35, 1.3 + k * 2.4, 0);
    seg.rotation.z = -0.12 * k;
    arm.add(seg);
  }
  g.add(arm);
  g.userData.arm = arm;
  return g;
}
