/**
 * Sim floor <-> Three.js world mapping. Pure maths, no WebGL.
 * Sim (x, y) metres maps to world (x, 0, -y): screen up is +y in the sim.
 */

import { Matrix4, Vector3, type Camera } from 'three';

export interface FloorPoint {
  x: number;
  y: number;
}

export function simToWorld(x: number, y: number): { x: number; y: number; z: number } {
  return { x, y: 0, z: -y };
}

/**
 * Cast a ray through normalised device coordinates (each in [-1, 1], +y up)
 * against the floor plane (world y = 0). Returns sim coordinates, or null when
 * the ray does not hit the floor in front of the camera.
 */
export function screenToFloor(ndcX: number, ndcY: number, camera: Camera): FloorPoint | null {
  camera.updateMatrixWorld();
  const inverseProjection = new Matrix4().copy((camera as Camera & { projectionMatrixInverse: Matrix4 }).projectionMatrixInverse);
  const origin = new Vector3().setFromMatrixPosition(camera.matrixWorld);
  const target = new Vector3(ndcX, ndcY, 0.5).applyMatrix4(inverseProjection).applyMatrix4(camera.matrixWorld);
  const dir = target.sub(origin);
  if (dir.y >= 0) return null;
  const t = -origin.y / dir.y;
  if (!(t > 0)) return null;
  const wx = origin.x + dir.x * t;
  const wz = origin.z + dir.z * t;
  return { x: wx, y: -wz };
}
