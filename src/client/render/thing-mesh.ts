import * as THREE from 'three';

/** Layer the Thing lives on. The camera only draws it while the lens sees it. */
export const THING_LAYER = 1;

/**
 * Placeholder body for Milestone 1: a tall pale figure with long arms and a dark face.
 * Bright and unlit, because on tape it reads as a smear of light.
 */
export function createThingMesh(): THREE.Group {
  const group = new THREE.Group();
  const pale = new THREE.MeshBasicMaterial({ color: 0xe6fff0 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x050606 });

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, 1.5, 10), pale);
  body.position.y = 1.0;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), pale);
  head.scale.set(0.85, 1.3, 0.85);
  head.position.y = 1.95;
  group.add(head);

  for (const x of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), dark);
    eye.position.set(x, 1.98, 0.13);
    group.add(eye);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), dark);
  mouth.scale.set(1, 2.2, 0.6);
  mouth.position.set(0, 1.86, 0.14);
  group.add(mouth);

  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 1.3, 6), pale);
    arm.position.set(side * 0.33, 0.95, 0);
    arm.name = side < 0 ? 'armL' : 'armR';
    group.add(arm);
  }

  group.traverse((o) => o.layers.set(THING_LAYER));
  return group;
}
