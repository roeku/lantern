import { BufferGeometry, Float32BufferAttribute, Points, PointsMaterial } from 'three';
import { TUNING, type Tuning } from '../../sim';
import { PALETTE } from './palette';

const PARTICLE_COUNT = 160;
const DRIFT_MPS = 0.15;
const CEILING_M = 3;

/**
 * Decorative smoke motes. Driven by Math.random in the client only.
 * Nothing here is ever read back into State or input.
 */
export class SmokeParticles {
  readonly points: Points;
  private readonly pos: Float32Array;
  private readonly vel: Float32Array;
  private readonly w: number;
  private readonly d: number;

  constructor(tuning: Tuning = TUNING) {
    this.w = tuning.roomWidthM;
    this.d = tuning.roomDepthM;
    this.pos = new Float32Array(PARTICLE_COUNT * 3);
    this.vel = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.pos[i * 3] = Math.random() * this.w;
      this.pos[i * 3 + 1] = Math.random() * CEILING_M;
      this.pos[i * 3 + 2] = -Math.random() * this.d;
      this.vel[i * 3] = (Math.random() - 0.5) * DRIFT_MPS;
      this.vel[i * 3 + 1] = Math.random() * DRIFT_MPS * 0.5;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * DRIFT_MPS;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    this.points = new Points(
      g,
      new PointsMaterial({
        color: PALETTE.smoke,
        size: 0.12,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
  }

  update(dtS: number): void {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const o = i * 3;
      this.pos[o] = wrap((this.pos[o] ?? 0) + (this.vel[o] ?? 0) * dtS, 0, this.w);
      this.pos[o + 1] = wrap((this.pos[o + 1] ?? 0) + (this.vel[o + 1] ?? 0) * dtS, 0, CEILING_M);
      this.pos[o + 2] = wrap((this.pos[o + 2] ?? 0) + (this.vel[o + 2] ?? 0) * dtS, -this.d, 0);
    }
    const attr = this.points.geometry.getAttribute('position');
    attr.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as PointsMaterial).dispose();
  }
}

function wrap(v: number, lo: number, hi: number): number {
  if (v < lo) return hi;
  if (v > hi) return lo;
  return v;
}
