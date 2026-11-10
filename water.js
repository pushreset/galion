import * as THREE from 'three';
import { ISLANDS, BOUNDS } from './sim.js';

// Sea = MeshLambertMaterial whose diffuse colour is replaced by a procedural,
// already-banded sea. Keeping Lambert means sails' shadows land on the water for free.
const PARS = /* glsl */ `
uniform float uTime;
uniform vec4 uIsl[8];
uniform vec2 uArena;
varying vec3 vW;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
float shoreDist(vec2 p) {
  float d = 1e4;
  for (int i = 0; i < 8; i++) {
    vec4 I = uIsl[i];
    vec2 q = p - I.xy;
    float a = atan(q.y, q.x);
    float r = I.z * (1.0 + 0.12 * sin(3.0 * a + I.w) + 0.07 * sin(5.0 * a + I.w * 1.7));
    d = min(d, length(q) - r);
  }
  return d;
}
vec3 srgb(float r, float g, float b) { return pow(vec3(r, g, b) / 255.0, vec3(2.2)); }
vec3 ramp(int k) {
  if (k <= 0) return srgb(12., 33., 64.);
  if (k == 1) return srgb(18., 50., 92.);
  if (k == 2) return srgb(23., 68., 120.);
  if (k == 3) return srgb(29., 88., 145.);
  if (k == 4) return srgb(37., 111., 168.);
  if (k == 5) return srgb(47., 135., 187.);
  if (k == 6) return srgb(43., 158., 163.);
  if (k == 7) return srgb(63., 184., 178.);
  if (k == 8) return srgb(98., 208., 194.);
  if (k == 9) return srgb(151., 230., 214.);
  return srgb(205., 245., 234.);
}
vec3 seaColor(vec2 p, float t) {
  // Big slow tonal patches.
  float n = fbm(p * 0.02 + vec2(t * 0.012, t * 0.007));
  int k = 2 + int(clamp((n - 0.3) * 9.0, 0.0, 3.0));

  // Shallows: step up the ramp toward each shore, edges wobbled by noise.
  float sd = shoreDist(p) + (noise(p * 0.25) - 0.5) * 2.2;
  k += int(sd < 22.0) + int(sd < 13.0) + int(sd < 7.0) + int(sd < 3.2);

  // Swell lines perpendicular to the wind, domain-warped and broken into strokes.
  vec2 wd = vec2(0.8, 0.6);
  float ph = dot(p, wd) * 0.45 + fbm(p * 0.05 + 3.1) * 6.0 - t * 1.15;
  float s = sin(ph);
  float brk = noise(p * vec2(0.22, 0.16) + vec2(-t * 0.06, t * 0.035));
  bool foam = false;
  if (s > 0.975 && brk > 0.56) foam = true;
  else if (s > 0.86 && brk > 0.46) k += 1;
  else if (s < -0.9) k -= 1;

  // Surf: a solid ring hugging the beach plus rings rolling in.
  float roll = fract(t * 0.35);
  if (sd < 0.6 + 0.35 * sin(t * 2.0 + p.x * 0.4)) foam = true;
  if (abs(sd - (1.2 + roll * 3.0)) < 0.22 && noise(p * 0.7) > 0.35 + roll * 0.4) foam = true;

  // Outside the arena: darker water so the edge reads.
  float edge = max(abs(p.x) - uArena.x, abs(p.y) - uArena.y);
  if (edge > 0.0) k -= 1 + int(edge > 10.0);

  return foam ? srgb(244., 255., 251.) : ramp(k);
}
`;

export function createSea() {
  const uTime = { value: 0 };
  const isl = Array.from({ length: 8 }, () => new THREE.Vector4());
  const arena = new THREE.Vector2();
  // (re)read the current map from sim.js: shorelines and the arena edge
  const setMap = () => {
    isl.forEach((v, i) => { const I = ISLANDS[i]; I ? v.set(I.x, I.z, I.r, I.ph) : v.set(1e4, 1e4, 0, 0); });
    arena.set(BOUNDS.x, BOUNDS.z);
  };
  setMap();
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.uniforms.uIsl = { value: isl };
    sh.uniforms.uArena = { value: arena };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + PARS)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( seaColor(vW.xz, uTime), 1.0 );');
  };
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2), mat);
  mesh.receiveShadow = true;
  return { mesh, uTime, setMap };
}
