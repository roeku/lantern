import * as THREE from 'three';
import { LEVEL, LEVEL_GRID, TUNING } from '../../sim';
import { FEEL } from '../feel';
import { makeCeilingTexture, makeFloorTexture, makeShelfTexture, makeWallTexture } from './textures';
import { EchoProps } from './echo-props';
import { LENS_ONLY_LAYER, ShopProps } from './shop-props';
import { createThingMesh, THING_LAYER } from './thing-mesh';
import { VhsPass } from './vhs-pass';
import type { GhostFrame } from './echo-props';
import type { ThingMode } from '../../sim';

export interface RenderFrame {
  /** Eye position in three.js space (x, up, z). */
  eye: { x: number; y: number; z: number };
  yawRad: number;
  pitchRad: number;
  /** 0 = lens down, 1 = lens up. Drives FOV and the tape look. */
  lensRaise: number;
  thing: { x: number; y: number };
  thingVisible: boolean;
  thingMode: ThingMode;
  notice: number;
  /** 0..1 scrub-bar strength. */
  rewind: number;
  timeSec: number;
  /** The lens is up: lens-only things (tape beacons) show. */
  lensUp: boolean;
  /** 0 = closed, 1 = open, per door. */
  doors: readonly number[];
  tapesTaken: readonly boolean[];
  /** 0 = locked, 1 = open. */
  exit: number;
  vcrProgress: number;
  vcrHeld: boolean;
  /** 0 = lights on, 1 = lights out. */
  blackout: number;
  /** 0..1, the house lights coming up at the end. */
  houseLights: number;
  /** 1 = full effects, less for reduced effects. */
  effects: number;
  /** The chamber you are in. Only it and the next one are lit. */
  chamber: number;
  /** Something that hunts is within 5 m. The warning that needs neither the lens nor sound: the nearest tube stutters. */
  thingNear: boolean;
  /** The clip's route on the floor: being recorded, or being replayed by the tape-self. */
  footprints: readonly { x: number; y: number }[];
  /** How many of them the tape-self has already walked (or all of them while recording). */
  footprintsDone: number;
  recording: boolean;
  /** 0 = up, 1 = pressed, per plate. */
  plates: readonly number[];
  /** 0 = closed, 1 = open, per gate. */
  gates: readonly number[];
  ghost: GhostFrame | null;
}

const EMERGENCY = new THREE.Color(0xe8202a);
const SHELF_H = 2.0;
const WALL_H = 3.0;

interface TubeLight {
  light: THREE.PointLight;
  /** The fixture itself, with its own material so one tube can stutter alone. */
  mat: THREE.MeshBasicMaterial;
  pos: THREE.Vector3;
  base: number;
  broken: boolean;
  chamber: number;
}

export class GameRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(TUNING.normalFovDeg, 1, 0.05, 60);
  private readonly target: THREE.WebGLRenderTarget;
  private readonly pass: VhsPass;
  private readonly thing = createThingMesh();
  private readonly tubes: TubeLight[] = [];
  private readonly props = new ShopProps();
  private readonly echoProps = new EchoProps();
  private hemi!: THREE.HemisphereLight;
  private trauma = 0;
  private flashAmount = 0;
  private lastTimeSec = 0;

  private quality: 'low' | 'medium';

  constructor(root: HTMLElement, quality: 'low' | 'medium') {
    this.quality = quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x020303);
    this.canvas = this.renderer.domElement;
    root.appendChild(this.canvas);

    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: FEEL.msaaSamples[quality] });
    this.pass = new VhsPass(this.target.texture);

    this.scene.fog = new THREE.FogExp2(0x020303, 0.06);
    this.scene.add(this.thing);
    this.buildShop();
    this.scene.add(this.props.group);
    this.scene.add(this.echoProps.group);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  flash(amount: number): void {
    this.flashAmount = Math.min(1, this.flashAmount + amount);
  }

  private buildShop(): void {
    const floorTex = makeFloorTexture();
    floorTex.repeat.set(LEVEL_GRID.width / 2, LEVEL_GRID.height / 2);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(LEVEL_GRID.width, LEVEL_GRID.height),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(LEVEL_GRID.width / 2, 0, LEVEL_GRID.height / 2);
    this.scene.add(floor);

    const ceilTex = makeCeilingTexture();
    ceilTex.repeat.set(LEVEL_GRID.width, LEVEL_GRID.height);
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(LEVEL_GRID.width, LEVEL_GRID.height),
      new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(LEVEL_GRID.width / 2, WALL_H, LEVEL_GRID.height / 2);
    this.scene.add(ceiling);

    // Walls on the perimeter, shelves everywhere else. The counter and the exit are props.
    const special = new Set<number>([...LEVEL.counter, LEVEL.exit].map((c) => c.cy * LEVEL_GRID.width + c.cx));
    const shelfCells: Array<[number, number]> = [];
    const wallCells: Array<[number, number]> = [];
    for (let cy = 0; cy < LEVEL_GRID.height; cy++) {
      for (let cx = 0; cx < LEVEL_GRID.width; cx++) {
        if (LEVEL_GRID.walls[cy * LEVEL_GRID.width + cx] !== true) continue;
        if (special.has(cy * LEVEL_GRID.width + cx)) continue;
        const edge =
          cx === 0 ||
          cy === 0 ||
          cx === LEVEL_GRID.width - 1 ||
          cy === LEVEL_GRID.height - 1 ||
          LEVEL.chambers.some((c) => c.xMax === cx);
        (edge ? wallCells : shelfCells).push([cx, cy]);
      }
    }
    this.addInstanced(shelfCells, SHELF_H, new THREE.MeshStandardMaterial({ map: makeShelfTexture(), roughness: 0.85 }));
    this.addInstanced(wallCells, WALL_H, new THREE.MeshStandardMaterial({ map: makeWallTexture(), roughness: 1 }));

    this.hemi = new THREE.HemisphereLight(0x9fb8aa, 0x080a0a, 0.6);
    this.scene.add(this.hemi);

    // Two ceiling tubes per chamber. The last of chamber 3 is dying.
    const spots: Array<[number, number, boolean, number]> = LEVEL.chambers.flatMap((c, i): Array<[number, number, boolean, number]> => {
      const x = c.xMin + 5.5;
      // Chamber 1 is one aisle along the bottom: both its tubes hang over it
      if (i === 0) return [
        [3.5, 9.5, false, i],
        [8.5, 9.5, false, i],
      ];
      return [
        [x, 3.5, false, i],
        [x, 9.5, i === 2, i],
      ];
    });
    for (const [x, z, broken, chamber] of spots) {
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0xd6ffe6 });
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.12), tubeMat);
      tube.position.set(x, WALL_H - 0.04, z);
      this.scene.add(tube);
      const light = new THREE.PointLight(0xd0f5e0, 9, 11, 2);
      light.position.set(x, WALL_H - 0.3, z);
      this.scene.add(light);
      this.tubes.push({ light, mat: tubeMat, pos: new THREE.Vector3(x, WALL_H, z), base: 9, broken, chamber });
    }
  }

  private addInstanced(cells: Array<[number, number]>, height: number, material: THREE.Material): void {
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, height, 1), material, cells.length);
    const m = new THREE.Matrix4();
    cells.forEach(([cx, cy], i) => {
      m.makeTranslation(cx + 0.5, height / 2, cy + 0.5);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.scene.add(mesh);
  }

  /** Switch quality without a reload: a new target if the anti-aliasing changed, then a resize. */
  setQuality(quality: 'low' | 'medium'): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.target.dispose();
    this.target.samples = FEEL.msaaSamples[quality];
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, FEEL.renderPixelRatioMax[this.quality]);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    const pw = Math.floor(w * dpr);
    const ph = Math.floor(h * dpr);
    this.target.setSize(pw, ph);
    this.pass.setSize(pw, ph);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Vertical FOV in degrees for a given lens raise. */
  static fovDeg(lensRaise: number): number {
    const e = lensRaise * lensRaise * (3 - 2 * lensRaise);
    return TUNING.normalFovDeg + (TUNING.lensFovDeg - TUNING.normalFovDeg) * e;
  }

  render(f: RenderFrame): void {
    const dt = Math.max(0, Math.min(0.1, f.timeSec - this.lastTimeSec));
    this.lastTimeSec = f.timeSec;

    // Tube flicker. The broken one stutters hard; the rest breathe. Blackout kills them; house lights bring them back.
    // Blackout is emergency lighting: dim and red, not black, so the lens is a choice and not the only way to see.
    const lit = Math.max(1 - f.blackout * 0.68, f.houseLights);
    // Only the chamber you are in and the one you can see through its gate are lit. Four tubes are always on, so the
    // number of lights, and with it the shader, never changes.
    const litA = Math.min(f.chamber, LEVEL.chambers.length - 2);
    // The warning: when something that hunts is close, the tube nearest you stutters hard. No lens, no sound needed.
    let warnIdx = -1;
    if (f.thingNear) {
      let best = Infinity;
      this.tubes.forEach((t, i) => {
        if (!(t.chamber === litA || t.chamber === litA + 1)) return;
        const d = Math.hypot(t.pos.x - f.eye.x, t.pos.z - f.eye.z);
        if (d < best) {
          best = d;
          warnIdx = i;
        }
      });
    }
    this.tubes.forEach((t, i) => {
      t.light.visible = t.chamber === litA || t.chamber === litA + 1;
      if (!t.light.visible) return;
      const n = Math.sin(f.timeSec * 41 + i * 7) * Math.sin(f.timeSec * 13 + i);
      let stutter = t.broken ? (n > 0.55 ? 0.15 : n > 0.1 ? 1 : 0.65) : 1 + n * 0.02;
      if (i === warnIdx) {
        const w = Math.sin(f.timeSec * 52) * Math.sin(f.timeSec * 17.3 + 1);
        stutter = w > 0.1 ? 1.15 : w > -0.35 ? 0.35 : 0.04;
      }
      t.mat.color.setScalar((0.2 + 0.8 * lit) * Math.min(1, stutter));
      t.light.color.setHex(0xd0f5e0).lerp(EMERGENCY, f.blackout * (1 - f.houseLights));
      t.light.intensity =
        t.base * stutter * lit * (1 + f.houseLights * 0.6) * (f.thingMode === 'rush' ? 0.7 + 0.3 * Math.sin(f.timeSec * 70 + i) : 1);
    });
    this.hemi.intensity = 0.6 * (1 - f.blackout * 0.45) + f.houseLights * 0.9;
    (this.scene.fog as THREE.FogExp2).density = 0.06 + f.blackout * 0.03 - f.houseLights * 0.045;
    for (const l of this.props.emergencyLights) l.intensity = f.blackout * (1 - f.houseLights) * (6 + 3 * Math.sin(f.timeSec * 2.2));
    this.echoProps.update({
      timeSec: f.timeSec,
      plates: f.plates,
      gates: f.gates,
      ghost: f.ghost,
      footprints: f.footprints,
      footprintsDone: f.footprintsDone,
      recording: f.recording,
    });
    this.props.update({
      timeSec: f.timeSec,
      doors: f.doors,
      tapesTaken: f.tapesTaken,
      exit: f.exit,
      vcrProgress: f.vcrProgress,
      vcrHeld: f.vcrHeld,
    });

    // Thing placement and animation
    this.thing.position.set(f.thing.x, 0, f.thing.y);
    const toPlayer = Math.atan2(f.eye.x - f.thing.x, f.eye.z - f.thing.y);
    this.thing.rotation.y = toPlayer;
    const sway = f.thingMode === 'rush' ? 0.18 : 0.04;
    this.thing.rotation.z = Math.sin(f.timeSec * (f.thingMode === 'rush' ? 18 : 2)) * sway;
    this.thing.rotation.x = f.thingMode === 'rush' ? 0.35 : 0;

    // Camera with trauma shake (rotation only, world only)
    this.trauma = Math.max(0, this.trauma - FEEL.shakeTraumaDecayPerSec * dt);
    const s = this.trauma * this.trauma * f.effects;
    const t = f.timeSec;
    const shakeYaw = s * FEEL.shakeMaxYawRad * Math.sin(t * 53.1);
    const shakePitch = s * FEEL.shakeMaxPitchRad * Math.sin(t * 47.7 + 1.3);
    const shakeRoll = s * FEEL.shakeMaxRollRad * Math.sin(t * 61.3 + 2.1);
    this.camera.position.set(f.eye.x, f.eye.y, f.eye.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(f.pitchRad + shakePitch, f.yawRad + shakeYaw, shakeRoll);
    this.camera.fov = GameRenderer.fovDeg(f.lensRaise) * (f.thingMode === 'rush' ? 1 + 0.04 * f.effects : 1);
    this.camera.updateProjectionMatrix();

    // The Thing only exists on tape
    if (f.thingVisible) this.camera.layers.enable(THING_LAYER);
    else this.camera.layers.disable(THING_LAYER);
    if (f.lensUp) this.camera.layers.enable(LENS_ONLY_LAYER);
    else this.camera.layers.disable(LENS_ONLY_LAYER);

    this.flashAmount = Math.max(0, this.flashAmount - FEEL.flashDecayPerSec * dt);

    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.pass.set({
      time: f.timeSec,
      lens: f.lensRaise,
      notice: f.notice,
      rewind: f.rewind,
      flash: this.flashAmount * (0.3 + 0.7 * f.effects),
      effects: f.effects,
    });
    this.renderer.render(this.pass.scene, this.pass.camera);
  }
}
