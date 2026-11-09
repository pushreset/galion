import * as THREE from 'three';
import { PALETTE_RGB } from './palette.js';

// Low-res pass: scene → small RT (with depth) → one fullscreen quad that adds the
// depth outline, ordered dither and palette snap, drawn at the same small size into
// the canvas, which CSS upscales with `image-rendering: pixelated`.
const FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uEdge;
uniform float uDither;
uniform vec3 uPal[PN];

float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float D(vec2 uv) { return texture(tDepth, uv).r; }

void main() {
  vec2 px = 1.0 / uRes;
  vec3 c = texture(tColor, vUv).rgb;
  c = pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));

  // Ortho depth is linear: a neighbour farther by uEdge means this pixel is the
  // silhouette of something nearer, so darken it in its own hue.
  float d = D(vUv);
  float far = max(max(D(vUv + vec2(px.x, 0.0)), D(vUv - vec2(px.x, 0.0))),
                  max(D(vUv + vec2(0.0, px.y)), D(vUv - vec2(0.0, px.y))));
  float edge = step(uEdge, far - d);
  c *= mix(1.0, 0.5, edge);

  c += (bayer4(gl_FragCoord.xy) - 0.5) * uDither;

  vec3 best = uPal[0];
  float bd = 1e9;
  for (int i = 0; i < PN; i++) {
    vec3 q = (c - uPal[i]) * vec3(1.0, 1.25, 0.85);
    float dd = dot(q, q);
    if (dd < bd) { bd = dd; best = uPal[i]; }
  }
  o = vec4(best, 1.0);
}
`;

export class PixelPost {
  constructor(renderer, near, far) {
    this.renderer = renderer;
    this.rt = new THREE.WebGLRenderTarget(2, 2, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      depthTexture: new THREE.DepthTexture(2, 2, THREE.FloatType),
    });
    this.u = {
      tColor: { value: this.rt.texture },
      tDepth: { value: this.rt.depthTexture },
      uRes: { value: new THREE.Vector2(2, 2) },
      uEdge: { value: 0.9 / (far - near) },
      uDither: { value: 0.035 },
      uPal: { value: PALETTE_RGB.map((c) => new THREE.Vector3(...c)) },
    };
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      defines: { PN: PALETTE_RGB.length },
      uniforms: this.u,
      vertexShader: `out vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.scene = new THREE.Scene();
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  setSize(w, h) {
    this.rt.setSize(w, h);
    this.u.uRes.value.set(w, h);
    this.renderer.setSize(w, h, false);
  }

  render(scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }
}
