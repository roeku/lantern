import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial } from 'three';
import { TUNING, type Tuning } from '../../sim';
import { PALETTE } from './palette';
import { simToWorld } from './floor-projection';

const FAN_SEGMENTS = 12;
/** Lifts the beam just above the smoke plane to avoid z-fighting. */
const BEAM_LIFT_M = 0.04;

/** Flat cone footprint along local +x with its apex at the origin. */
function buildConeGeometry(length: number, halfAngle: number): BufferGeometry {
  const pos: number[] = [0, 0, 0];
  for (let i = 0; i <= FAN_SEGMENTS; i++) {
    const a = -halfAngle + (2 * halfAngle * i) / FAN_SEGMENTS;
    // sim (cos a, sin a) -> world (cos a, 0, -sin a)
    pos.push(Math.cos(a) * length, 0, -Math.sin(a) * length);
  }
  const index: number[] = [];
  for (let i = 1; i <= FAN_SEGMENTS; i++) index.push(0, i + 1, i);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  return g;
}

export function createBeam(tuning: Tuning = TUNING): Mesh {
  const mesh = new Mesh(
    buildConeGeometry(tuning.placeholderSlideReachM, tuning.beamHalfAngleRad),
    new MeshBasicMaterial({
      color: PALETTE.beam,
      transparent: true,
      opacity: 0.22,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  mesh.visible = false;
  return mesh;
}

/** Place the beam at the cart and rotate it to `angle`; null hides it (Audience_Side). */
export function updateBeam(
  mesh: Mesh,
  beam: { angle: number } | null,
  cartTravel: number,
  tuning: Tuning = TUNING,
): void {
  if (!beam) {
    mesh.visible = false;
    return;
  }
  const o = simToWorld(tuning.cartOriginXM, tuning.cartTrackStartYM + cartTravel);
  mesh.position.set(o.x, BEAM_LIFT_M, o.z);
  mesh.rotation.y = beam.angle;
  mesh.visible = true;
}
