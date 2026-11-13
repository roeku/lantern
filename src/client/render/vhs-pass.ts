import * as THREE from 'three';

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/**
 * Full-screen pass. With the lens down it is a plain, clean copy (plus a light vignette).
 * With the lens up it becomes the tape: grain, tracking bands, chroma bleed, scanlines.
 * uNotice makes it tear. uRewind adds scrub bars. uFlash is a white-out.
 */
const FRAGMENT = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uTime;
uniform float uLens;
uniform float uNotice;
uniform float uRewind;
uniform float uFlash;
uniform float uEffects;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 uv = vUv;
  float tear = uLens * (0.25 + uNotice * 2.5) * uEffects;

  // Tracking band that rolls up the picture
  float y0 = fract(uTime * 0.13);
  float band = exp(-pow((uv.y - y0) * 16.0, 2.0));
  uv.x += band * 0.02 * tear;

  // Row jitter, worse as the Thing notices
  float row = floor(uv.y * 240.0);
  uv.x += (hash(vec2(row, floor(uTime * 20.0))) - 0.5) * 0.004 * uLens * (0.2 + uNotice * 3.0) * uEffects;

  // Rewind scrub
  float scrub = step(0.82, hash(vec2(floor(uv.y * 30.0), floor(uTime * 40.0)))) * uRewind * uEffects;
  uv.x += scrub * 0.12;

  float bleed = 0.002 * uLens + 0.006 * uNotice * uLens * uEffects;
  vec3 col = vec3(
    texture2D(tDiffuse, uv + vec2(bleed, 0.0)).r,
    texture2D(tDiffuse, uv).g,
    texture2D(tDiffuse, uv - vec2(bleed, 0.0)).b
  );

  // Tape look: greener, brighter, mostly monochrome
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 tape = mix(vec3(l), col, 0.3) * vec3(0.82, 1.08, 0.94) * 1.7;
  col = mix(col, tape, uLens);

  col *= 1.0 - uLens * 0.1 * sin(uv.y * uRes.y * 3.14159);
  float g = hash(uv * uRes + fract(uTime) * 91.7) - 0.5;
  col += g * (0.012 + uLens * (0.07 + 0.12 * uNotice * uEffects));

  vec2 q = vUv - 0.5;
  float vig = 1.0 - dot(q, q) * (0.7 + uLens * 1.3 + uNotice * 1.4);
  col *= clamp(vig, 0.0, 1.0);

  col = mix(col, vec3(0.85, 1.0, 0.92), scrub * 0.6);
  col += uFlash;

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export class VhsPass {
  readonly material: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(texture: THREE.Texture) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uLens: { value: 0 },
        uNotice: { value: 0 },
        uRewind: { value: 0 },
        uFlash: { value: 0 },
        uEffects: { value: 1 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  setSize(w: number, h: number): void {
    (this.material.uniforms.uRes?.value as THREE.Vector2).set(w, h);
  }

  set(uniforms: { time: number; lens: number; notice: number; rewind: number; flash: number; effects: number }): void {
    const u = this.material.uniforms;
    if (!u.uTime || !u.uLens || !u.uNotice || !u.uRewind || !u.uFlash || !u.uEffects) return;
    u.uTime.value = uniforms.time;
    u.uLens.value = uniforms.lens;
    u.uNotice.value = uniforms.notice;
    u.uRewind.value = uniforms.rewind;
    u.uFlash.value = uniforms.flash;
    u.uEffects.value = uniforms.effects;
  }
}
