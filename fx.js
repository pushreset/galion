import * as THREE from 'three';
import { WIND } from './sim.js';

// Pooled flat foam blobs on the water. Hexagons read as chunky pixels after the post pass.
export function createWakes(scene, max = 600) {
  const mesh = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 6).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    max
  );
  mesh.frustumCulled = false;
  scene.add(mesh);
  const parts = Array.from({ length: max }, () => ({ life: 0 }));
  let next = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const foam = new THREE.Color('#f4fffb'), pale = new THREE.Color('#97e6d6'), c = new THREE.Color();
  return {
    spawn(x, z, size, vx = 0, vz = 0, life = 2.2) {
      const o = parts[next];
      next = (next + 1) % max;
      Object.assign(o, { x, z, vx, vz, size, life, max: life, rot: Math.random() * 6 });
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        const o = parts[i];
        if (o.life > 0) {
          o.life -= dt;
          o.x += o.vx * dt;
          o.z += o.vz * dt;
          o.vx *= 0.97;
          o.vz *= 0.97;
        }
        const t = o.life > 0 ? 1 - o.life / o.max : 1;
        const k = o.life > 0 ? o.size * (0.5 + t * 0.9) * (1 - t * t) : 0;
        p.set(o.x || 0, 0.04, o.z || 0);
        q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, o.rot || 0);
        s.set(k, 1, k * 0.7);
        mesh.setMatrixAt(i, m.compose(p, q, s));
        mesh.setColorAt(i, c.copy(foam).lerp(pale, t));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    },
  };
}

// Generic pooled particles: one InstancedMesh, each particle lerps size s0→s1 and colour c0→c1.
export function createParticles(scene, geo, material, max, castShadow = false) {
  const mesh = new THREE.InstancedMesh(geo, material, max);
  mesh.frustumCulled = false;
  mesh.castShadow = castShadow;
  scene.add(mesh);
  const P = Array.from({ length: max }, () => ({ life: 0, max: 1 }));
  let next = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const white = new THREE.Color(1, 1, 1);
  return {
    spawn(o) {
      const k = P[next];
      next = (next + 1) % max;
      Object.assign(k, { vx: 0, vy: 0, vz: 0, g: 0, drag: 0, s0: 1, s1: 0, c0: white, c1: null, spin: 0 }, o);
      k.max = k.life;
      k.rot = Math.random() * 6;
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        const k = P[i];
        let size = 0;
        if (k.life > 0) {
          k.life -= dt;
          k.vy -= k.g * dt;
          const d = Math.max(0, 1 - k.drag * dt);
          k.vx *= d; k.vy *= k.g ? 1 : d; k.vz *= d;
          k.x += k.vx * dt; k.y += k.vy * dt; k.z += k.vz * dt;
          if (k.g && k.y < 0) k.life = 0; // debris/splash drops sink
          k.rot += k.spin * dt;
          const t = 1 - Math.max(0, k.life) / k.max;
          size = k.life > 0 ? k.s0 + (k.s1 - k.s0) * t : 0;
          c.copy(k.c0);
          if (k.c1) c.lerp(k.c1, t);
          mesh.setColorAt(i, c);
        }
        p.set(k.x || 0, k.y || 0, k.z || 0);
        q.setFromEuler(e.set(k.rot, k.rot * 0.7, 0));
        mesh.setMatrixAt(i, m.compose(p, q, s.setScalar(size)));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}

const col = (h) => new THREE.Color(h);
const C = {
  flash0: col('#fff4b0'), flash1: col('#ff9b26'), fire0: col('#ffd24a'), fire1: col('#e8591a'),
  smoke0: col('#d6d2cf'), smoke1: col('#716f74'), dark0: col('#47464c'), dark1: col('#26262b'),
  foam: col('#f4fffb'), pale: col('#97e6d6'), wood0: col('#8d5c35'), wood1: col('#3f2616'),
};
const rnd = (a, b) => a + Math.random() * (b - a);

// High-level effects built from the pools.
export function createFx(scene, wakes) {
  const ico = new THREE.IcosahedronGeometry(1, 0);
  const smoke = createParticles(scene, ico, new THREE.MeshLambertMaterial({ flatShading: true }), 900);
  const fire = createParticles(scene, ico, new THREE.MeshBasicMaterial(), 500);
  const splash = createParticles(scene, ico, new THREE.MeshBasicMaterial(), 400);
  const debris = createParticles(scene, new THREE.BoxGeometry(1, 0.5, 2.2), new THREE.MeshLambertMaterial({ flatShading: true }), 200, true);
  const drift = (k) => 1.5 * (k ? Math.sin(WIND.a) : Math.cos(WIND.a)); // smoke blows downwind
  return {
    muzzle(x, y, z, ox, oz) {
      for (let i = 0; i < 4; i++) fire.spawn({ x, y, z, vx: ox * rnd(5, 11), vy: rnd(0, 1.5), vz: oz * rnd(5, 11), drag: 6, life: rnd(0.1, 0.2), s0: rnd(0.6, 1), s1: 0.15, c0: C.flash0, c1: C.flash1 });
      for (let i = 0; i < 6; i++) smoke.spawn({ x, y, z, vx: ox * rnd(2, 6) + drift(0), vy: rnd(0.4, 1.4), vz: oz * rnd(2, 6) + drift(1), drag: 1.2, life: rnd(1.4, 2.6), s0: rnd(0.4, 0.7), s1: rnd(1.3, 2), c0: C.smoke0, c1: C.smoke1, spin: 1 });
    },
    splash(x, z) {
      for (let i = 0; i < 12; i++) splash.spawn({ x: x + rnd(-0.3, 0.3), y: 0.1, z: z + rnd(-0.3, 0.3), vx: rnd(-1.2, 1.2), vy: rnd(5, 11), vz: rnd(-1.2, 1.2), g: 22, life: 1.2, s0: rnd(0.25, 0.45), s1: 0.1, c0: C.foam, c1: C.pale });
      wakes.spawn(x, z, 1.4, 0, 0, 1.4);
    },
    hit(x, y, z) {
      for (let i = 0; i < 9; i++) debris.spawn({ x, y, z, vx: rnd(-5, 5), vy: rnd(4, 10), vz: rnd(-5, 5), g: 20, life: 2, s0: rnd(0.18, 0.35), s1: rnd(0.18, 0.35), c0: Math.random() > 0.5 ? C.wood0 : C.wood1, spin: rnd(-12, 12) });
      for (let i = 0; i < 7; i++) fire.spawn({ x, y, z, vx: rnd(-3, 3), vy: rnd(1, 4), vz: rnd(-3, 3), drag: 4, life: rnd(0.2, 0.4), s0: rnd(0.7, 1.2), s1: 0.1, c0: C.flash0, c1: C.fire1 });
      for (let i = 0; i < 4; i++) smoke.spawn({ x, y, z, vx: rnd(-1, 1) + drift(0), vy: rnd(1, 2.5), vz: rnd(-1, 1) + drift(1), drag: 0.8, life: rnd(1.5, 2.5), s0: 0.6, s1: 1.8, c0: C.dark0, c1: C.dark1, spin: 1 });
    },
    burn(x, y, z) {
      fire.spawn({ x: x + rnd(-0.3, 0.3), y, z: z + rnd(-0.3, 0.3), vx: rnd(-0.4, 0.4), vy: rnd(1.5, 3), vz: rnd(-0.4, 0.4), life: rnd(0.35, 0.6), s0: rnd(0.4, 0.7), s1: 0.05, c0: C.fire0, c1: C.fire1 });
      if (Math.random() < 0.5) smoke.spawn({ x, y: y + 0.8, z, vx: drift(0), vy: rnd(1.8, 2.8), vz: drift(1), drag: 0.3, life: rnd(2, 3), s0: 0.4, s1: rnd(1.6, 2.4), c0: C.dark0, c1: C.dark1, spin: 1 });
    },
    cloud(x, z) { // smoke screen: big pale puffs hugging the water
      smoke.spawn({ x: x + rnd(-4, 4), y: rnd(0.5, 2), z: z + rnd(-4, 4), vx: rnd(-0.5, 0.5), vy: rnd(0.2, 0.8), vz: rnd(-0.5, 0.5), drag: 0.5, life: rnd(2, 3), s0: rnd(1, 1.6), s1: rnd(2.5, 3.5), c0: C.smoke0, c1: C.smoke1, spin: 1 });
    },
    bubble(x, z) {
      wakes.spawn(x + rnd(-2, 2), z + rnd(-2, 2), rnd(0.5, 1.1), 0, 0, 1.2);
    },
    update(dt) { smoke.update(dt); fire.update(dt); splash.update(dt); debris.update(dt); },
  };
}
