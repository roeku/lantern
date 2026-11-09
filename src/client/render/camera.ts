import { PerspectiveCamera } from 'three';
import { TUNING, type Tuning } from '../../sim';
import { simToWorld } from './floor-projection';

/** Camera height above the floor (m). */
export const CAMERA_HEIGHT_M = 15;
/** How far the camera sits toward the bottom of the screen from the hall centre (m). */
export const CAMERA_TILT_M = 4;
export const CAMERA_FOV_DEG = 45;

/** Place the camera above the hall centre, tilted back, looking at the centre. */
export function createCamera(aspect: number, tuning: Tuning = TUNING): PerspectiveCamera {
  const camera = new PerspectiveCamera(CAMERA_FOV_DEG, aspect, 0.1, 100);
  const c = simToWorld(tuning.roomWidthM / 2, tuning.roomDepthM / 2);
  camera.position.set(c.x, CAMERA_HEIGHT_M, c.z + CAMERA_TILT_M);
  camera.lookAt(c.x, 0, c.z);
  camera.updateMatrixWorld();
  return camera;
}
