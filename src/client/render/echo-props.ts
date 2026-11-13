import * as THREE from 'three';
import { cellCenter, findPath, isWallCell, LEVEL } from '../../sim';

const REC_RED = 0xe8202a;
const FLUORESCENT = 0xd8fbe6;
const TAPE_BLUE = 0x6f9fff;
const SLAT_Y = [0.3, 0.85, 1.4, 1.95] as const;
// Reused every frame instead of allocating new colours
const RED = new THREE.Color(REC_RED);
const LIT = new THREE.Color(FLUORESCENT);
const GATE_TOP_M = 2.4;

export interface EchoPropsFrame {
  timeSec: number;
  /** 0 = up, 1 = pressed, per plate. */
  plates: readonly number[];
  /** 0 = closed, 1 = open, per gate. */
  gates: readonly number[];
  ghost: GhostFrame | null;
  footprints: readonly { x: number; y: number }[];
  footprintsDone: number;
  recording: boolean;
}

export interface GhostFrame {
  x: number;
  y: number;
  yawRad: number;
  /** 0 = standing, 1 = crouched. */
  crouch: number;
  /** 0..1 opacity. */
  alpha: number;
  moving: boolean;
}

interface PlateProp {
  pad: THREE.Mesh;
  ring: THREE.Mesh;
}

interface GateProp {
  slats: THREE.Mesh[];
  panel: THREE.Mesh;
  posts: THREE.Mesh[];
  group: THREE.Group;
  /** One lamp per plate that feeds it, in the same order as `plates`. */
  lamps: Array<{ mesh: THREE.Mesh; plate: number }>;
}

/** Most footprints a clip can show. */
const MAX_FOOTPRINTS = 64;

function stripeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 32;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d canvas unavailable');
  for (let y = 0; y < 32; y++) {
    const v = y % 4 < 2 ? 255 : 150;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(0, y, 4, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 4);
  t.magFilter = THREE.NearestFilter;
  return t;
}

/**
 * The things the tape adds to the shop: pressure plates, light-curtain gates, and your tape-self.
 * Reads sim state; never changes it.
 */
export class EchoProps {
  readonly group = new THREE.Group();
  private readonly plates: PlateProp[] = [];
  private readonly gates: GateProp[] = [];
  private readonly ghost = new THREE.Group();
  private readonly ghostBody: THREE.Group = new THREE.Group();
  private readonly ghostMats: THREE.MeshBasicMaterial[] = [];
  private readonly ghostLight = new THREE.PointLight(TAPE_BLUE, 0, 5, 2);
  /** Per plate: the dotted wire on the floor to its gate. */
  private readonly wires: THREE.MeshBasicMaterial[] = [];
  private readonly steps: THREE.InstancedMesh;
  private readonly stepMatrix = new THREE.Matrix4();
  private readonly stepColor = new THREE.Color();

  constructor() {
    this.buildPlates();
    this.buildWires();
    this.buildGates();
    this.buildGhost();
    this.steps = this.buildFootprints();
  }

  /**
   * Portal's dotted line: a row of dots on the floor from each plate to the gate it opens.
   * Red while the plate is up, lit while it is held, so you can read which plate does what from across the room.
   */
  private buildWires(): void {
    const dot = new THREE.PlaneGeometry(0.09, 0.09);
    LEVEL.plates.forEach((p) => {
      const gate = LEVEL.gates.find((g) => g.group === p.group);
      const mat = new THREE.MeshBasicMaterial({ color: REC_RED, fog: false, transparent: true, opacity: 0.85 });
      this.wires.push(mat);
      if (!gate) return;
      const path = findPath(LEVEL.grid, p.cell, gate.cell);
      const points: Array<{ x: number; y: number }> = [];
      for (let i = 0; i + 1 < path.length; i++) {
        const a = path[i];
        const b = path[i + 1];
        if (!a || !b) continue;
        const pa = cellCenter(a);
        const pb = cellCenter(b);
        for (let k = 0; k < 4; k++) points.push({ x: pa.x + ((pb.x - pa.x) * k) / 4, y: pa.y + ((pb.y - pa.y) * k) / 4 });
      }
      // Leave the plate itself clear
      const dots = points.filter((pt) => Math.hypot(pt.x - cellCenter(p.cell).x, pt.y - cellCenter(p.cell).y) > 0.5);
      const mesh = new THREE.InstancedMesh(dot, mat, Math.max(1, dots.length));
      const m = new THREE.Matrix4();
      const r = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
      dots.forEach((pt, i) => {
        m.makeTranslation(pt.x, 0.008, pt.y).multiply(r);
        mesh.setMatrixAt(i, m);
      });
      mesh.count = dots.length;
      mesh.instanceMatrix.needsUpdate = true;
      this.group.add(mesh);
    });
  }

  /** Blue prints of your clip: drawn as you record, then dimmed one by one as your tape-self walks over them. */
  private buildFootprints(): THREE.InstancedMesh {
    const geo = new THREE.CircleGeometry(0.11, 10);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, fog: false, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geo, mat, MAX_FOOTPRINTS);
    mesh.setColorAt(0, new THREE.Color(TAPE_BLUE));
    mesh.count = 0;
    // Its instances move every frame; bounds computed once at count 0 would cull it forever
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return mesh;
  }

  private buildPlates(): void {
    const base = new THREE.MeshStandardMaterial({ color: 0x15191a, roughness: 0.5, metalness: 0.5 });
    for (const p of LEVEL.plates) {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.07, 24), base);
      pad.position.set(p.cell.cx + 0.5, 0.035, p.cell.cy + 0.5);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.03, 8, 28),
        new THREE.MeshBasicMaterial({ color: REC_RED, fog: false }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(p.cell.cx + 0.5, 0.078, p.cell.cy + 0.5);
      this.group.add(pad, ring);
      this.plates.push({ pad, ring });
    }
  }

  private buildGates(): void {
    const slatMat = new THREE.MeshBasicMaterial({ color: REC_RED, fog: false });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1a1f20, roughness: 0.5, metalness: 0.6 });
    for (const g of LEVEL.gates) {
      const group = new THREE.Group();
      group.position.set(g.cell.cx + 0.5, 0, g.cell.cy + 0.5);
      // Built for a passage along x. A gate in a wall that runs along x (the passage runs along z) turns a quarter.
      const alongX = !isWallCell(LEVEL.grid, g.cell.cx - 1, g.cell.cy) && !isWallCell(LEVEL.grid, g.cell.cx + 1, g.cell.cy);
      if (!alongX) group.rotation.y = Math.PI / 2;
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 2.3, 0.94),
        new THREE.MeshBasicMaterial({ color: REC_RED, transparent: true, opacity: 0.14, depthWrite: false, fog: false }),
      );
      panel.position.y = 1.15;
      const slats: THREE.Mesh[] = [];
      for (const y of SLAT_Y) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.94), slatMat.clone());
        slat.position.y = y;
        slats.push(slat);
        group.add(slat);
      }
      const posts = [-0.49, 0.49].map((z) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.08), postMat);
        post.position.set(0, 1.2, z);
        return post;
      });
      group.add(panel, ...posts);
      // One lamp per plate over the gate: "this needs two", lit as each one is held
      const feeds = LEVEL.plates.map((p, i) => ({ p, i })).filter((x) => x.p.group === g.group);
      const lamps = feeds.map((x, k) => {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.16), new THREE.MeshBasicMaterial({ color: REC_RED, fog: false }));
        lamp.position.set(0, 2.6, (k - (feeds.length - 1) / 2) * 0.3);
        group.add(lamp);
        return { mesh: lamp, plate: x.i };
      });
      this.group.add(group);
      this.gates.push({ slats, panel, posts, group, lamps });
    }
  }

  private buildGhost(): void {
    const stripes = stripeTexture();
    const make = (opacity: number, side: THREE.Side, color: number, blending: THREE.Blending): THREE.MeshBasicMaterial => {
      const m = new THREE.MeshBasicMaterial({
        color,
        map: stripes,
        transparent: true,
        opacity,
        side,
        depthWrite: false,
        fog: false,
        blending,
      });
      this.ghostMats.push(m);
      return m;
    };
    const fill = make(0.5, THREE.FrontSide, TAPE_BLUE, THREE.NormalBlending);
    const glow = make(0.22, THREE.BackSide, FLUORESCENT, THREE.AdditiveBlending);
    const torso = new THREE.CylinderGeometry(0.2, 0.26, 1.15, 12);
    const head = new THREE.SphereGeometry(0.15, 12, 10);
    const visor = new THREE.BoxGeometry(0.2, 0.06, 0.08);
    const parts: ReadonlyArray<readonly [THREE.BufferGeometry, number]> = [
      [torso, 0.62],
      [head, 1.4],
    ];
    for (const [geo, y] of parts) {
      const m = new THREE.Mesh(geo, fill);
      m.position.y = y;
      const o = new THREE.Mesh(geo, glow);
      o.position.y = y;
      o.scale.setScalar(1.12);
      this.ghostBody.add(m, o);
    }
    const lens = new THREE.Mesh(visor, make(0.9, THREE.FrontSide, REC_RED, THREE.NormalBlending));
    lens.position.set(0, 1.42, 0.14);
    this.ghostBody.add(lens);
    this.ghost.add(this.ghostBody);
    this.ghostLight.position.y = 1.1;
    this.ghost.add(this.ghostLight);
    this.ghost.visible = false;
    this.group.add(this.ghost);
  }

  update(f: EchoPropsFrame): void {
    this.plates.forEach((p, i) => {
      const down = f.plates[i] ?? 0;
      p.pad.position.y = 0.035 - 0.03 * down;
      p.ring.position.y = 0.078 - 0.03 * down;
      (p.ring.material as THREE.MeshBasicMaterial).color.copy(RED).lerp(LIT, down);
    });

    this.gates.forEach((g, i) => {
      const open = f.gates[i] ?? 0;
      g.slats.forEach((s, k) => {
        const m = s.material as THREE.MeshBasicMaterial;
        const rest = SLAT_Y[k] ?? 0;
        s.position.y = rest + open * (GATE_TOP_M - rest) * 0.95;
        m.color.copy(RED).lerp(LIT, Math.min(1, open * 1.5));
        // A closed gate hums: the slats flicker, out of phase
        m.opacity = open > 0.95 ? 0 : 0.75 + 0.25 * Math.sin(f.timeSec * 9 + k * 1.7);
        s.visible = open < 0.95;
      });
      const pm = g.panel.material as THREE.MeshBasicMaterial;
      pm.opacity = 0.14 * (1 - open);
      g.panel.visible = open < 0.98;
      for (const l of g.lamps) (l.mesh.material as THREE.MeshBasicMaterial).color.copy(RED).lerp(LIT, f.plates[l.plate] ?? 0);
    });

    this.wires.forEach((m, i) => {
      const down = f.plates[i] ?? 0;
      m.color.copy(RED).lerp(LIT, down);
      // A held wire runs: a slow shimmer along it
      m.opacity = 0.55 + 0.3 * down + (down > 0.5 ? 0.1 * Math.sin(f.timeSec * 8) : 0);
    });

    const n = Math.min(MAX_FOOTPRINTS, f.footprints.length);
    const stride = f.footprints.length > MAX_FOOTPRINTS ? f.footprints.length / MAX_FOOTPRINTS : 1;
    for (let i = 0; i < n; i++) {
      const pt = f.footprints[Math.floor(i * stride)];
      if (!pt) continue;
      this.stepMatrix.makeTranslation(pt.x, 0.01, pt.y);
      this.steps.setMatrixAt(i, this.stepMatrix);
      const walked = !f.recording && i * stride < f.footprintsDone;
      this.stepColor.setHex(f.recording ? REC_RED : TAPE_BLUE).multiplyScalar(walked ? 0.25 : 1);
      this.steps.setColorAt(i, this.stepColor);
    }
    this.steps.count = n;
    this.steps.instanceMatrix.needsUpdate = true;
    if (this.steps.instanceColor) this.steps.instanceColor.needsUpdate = true;

    const gh = f.ghost;
    this.ghost.visible = gh !== null;
    if (gh) {
      this.ghost.position.set(gh.x, 0, gh.y);
      this.ghost.rotation.y = gh.yawRad + Math.PI;
      this.ghostBody.scale.y = 1 - 0.38 * gh.crouch;
      // Tape tracking: a slow shimmer and the odd dropout
      const dropout = Math.sin(f.timeSec * 23) * Math.sin(f.timeSec * 7.3) > 0.82 ? 0.35 : 1;
      this.ghostMats.forEach((m, k) => {
        const base = [0.5, 0.22, 0.9][k] ?? 0.5;
        m.opacity = base * gh.alpha * dropout;
        if (m.map) m.map.offset.y = (f.timeSec * (gh.moving ? 1.6 : 0.5)) % 1;
      });
      this.ghostLight.intensity = 2.6 * gh.alpha;
    }
  }
}
