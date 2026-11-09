import {
  AmbientLight,
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
  type DataTexture,
} from 'three';
import { TUNING, type Tuning, type View } from '../../sim';
import { Actors } from './actors';
import { createBeam, updateBeam } from './beam';
import { createCamera } from './camera';
import { simToWorld, screenToFloor, type FloorPoint } from './floor-projection';
import { interpAlpha, lerpPositions, type InterpFrame } from './interpolation';
import { PALETTE } from './palette';
import { SmokeParticles } from './particles';
import { createSmokeTexture, updateSmokeTexture } from './smoke-texture';

const WALL_HEIGHT_M = 2.5;
const WALL_THICKNESS_M = 0.3;
const AMBIENT_INTENSITY = 0.35;
const SMOKE_LIFT_M = 0.02;

function toFrame(view: View): InterpFrame {
  return {
    cartTravel: view.cart.travel,
    spectators: view.spectators.map((s) => ({ player: s.player, x: s.x, y: s.y })),
  };
}

/** Three.js grey-box scene. Renders a View; reads nothing else from the simulation. */
export class LanternScene {
  readonly camera: PerspectiveCamera;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly actors: Actors;
  private readonly beam;
  private readonly particles: SmokeParticles;
  private readonly smokeTexture: DataTexture;
  private readonly tuning: Tuning;

  private view: View | null = null;
  private prev: InterpFrame | null = null;
  private next: InterpFrame | null = null;
  private receivedAtMs = 0;
  private localPlayer = -1;
  private lastNowMs: number | null = null;

  constructor(canvas: HTMLCanvasElement, tuning: Tuning = TUNING) {
    this.tuning = tuning;
    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio ?? 1));
    this.scene.background = new Color(PALETTE.base);
    this.camera = createCamera(1, tuning);

    this.scene.add(new AmbientLight(PALETTE.beamDeep, AMBIENT_INTENSITY));
    this.buildHall();

    this.smokeTexture = createSmokeTexture(tuning);
    const smoke = new Mesh(
      new PlaneGeometry(tuning.roomWidthM, tuning.roomDepthM),
      new MeshBasicMaterial({ map: this.smokeTexture, transparent: true, depthWrite: false }),
    );
    smoke.rotation.x = -Math.PI / 2;
    const c = simToWorld(tuning.roomWidthM / 2, tuning.roomDepthM / 2);
    smoke.position.set(c.x, SMOKE_LIFT_M, c.z);
    smoke.renderOrder = 1;
    this.scene.add(smoke);

    this.beam = createBeam(tuning);
    this.beam.renderOrder = 2;
    this.scene.add(this.beam);

    this.actors = new Actors(tuning);
    this.scene.add(this.actors.group);

    this.particles = new SmokeParticles(tuning);
    this.scene.add(this.particles.points);
  }

  private buildHall(): void {
    const { roomWidthM: w, roomDepthM: d } = this.tuning;
    const c = simToWorld(w / 2, d / 2);
    const floor = new Mesh(
      new PlaneGeometry(w, d),
      new MeshStandardMaterial({ color: PALETTE.stone, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(c.x, 0, c.z);
    this.scene.add(floor);

    const wallMat = new MeshStandardMaterial({ color: PALETTE.stoneLight, roughness: 1 });
    const walls: [number, number, number, number][] = [
      // [width, depth, sim x, sim y]
      [w, WALL_THICKNESS_M, w / 2, -WALL_THICKNESS_M / 2],
      [w, WALL_THICKNESS_M, w / 2, d + WALL_THICKNESS_M / 2],
      [WALL_THICKNESS_M, d, -WALL_THICKNESS_M / 2, d / 2],
      [WALL_THICKNESS_M, d, w + WALL_THICKNESS_M / 2, d / 2],
    ];
    for (const [ww, dd, x, y] of walls) {
      const m = new Mesh(new BoxGeometry(ww, WALL_HEIGHT_M, dd), wallMat);
      const p = simToWorld(x, y);
      m.position.set(p.x, WALL_HEIGHT_M / 2, p.z);
      this.scene.add(m);
    }
  }

  /** Feed the newest View (one per Snapshot). `receivedAtMs` is a performance.now()-style time. */
  setView(view: View, receivedAtMs: number, localPlayer: number): void {
    this.prev = this.next ?? toFrame(view);
    this.next = toFrame(view);
    this.view = view;
    this.receivedAtMs = receivedAtMs;
    this.localPlayer = localPlayer;
    updateSmokeTexture(this.smokeTexture, view, this.tuning);
  }

  resize(widthPx: number, heightPx: number): void {
    this.renderer.setSize(widthPx, heightPx, false);
    this.camera.aspect = widthPx / Math.max(1, heightPx);
    this.camera.updateProjectionMatrix();
  }

  /** Mouse position to sim floor coordinates, for Showman aiming. */
  screenToFloor(ndcX: number, ndcY: number): FloorPoint | null {
    return screenToFloor(ndcX, ndcY, this.camera);
  }

  render(nowMs: number): void {
    const dt = this.lastNowMs === null ? 0 : Math.min(0.1, (nowMs - this.lastNowMs) / 1000);
    this.lastNowMs = nowMs;
    this.particles.update(dt);

    if (this.view && this.prev && this.next) {
      const alpha = interpAlpha(nowMs, this.receivedAtMs, this.tuning.tickS * 1000);
      const frame = lerpPositions(this.prev, this.next, alpha);
      updateBeam(this.beam, this.view.beam, frame.cartTravel, this.tuning);
      this.actors.update(this.view, frame, this.localPlayer);
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.actors.dispose();
    this.particles.dispose();
    this.smokeTexture.dispose();
    this.renderer.dispose();
  }
}
