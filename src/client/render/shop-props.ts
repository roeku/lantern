import * as THREE from 'three';
import { isWallCell, LEVEL } from '../../sim';
import type { Cell } from '../../sim';

/** Camera layer for things that only show through the lens: tape beacons. */
export const LENS_ONLY_LAYER = 2;

export interface PropsFrame {
  timeSec: number;
  /** 0 = closed, 1 = open, per door. */
  doors: readonly number[];
  tapesTaken: readonly boolean[];
  /** 0 = locked, 1 = open. */
  exit: number;
  vcrProgress: number;
  vcrHeld: boolean;
}

interface DoorProp {
  pivot: THREE.Group;
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Everything in the shop that is not terrain: doors, tapes, hiding spots, the counter, the exit. */
export class ShopProps {
  readonly group = new THREE.Group();
  readonly emergencyLights: THREE.PointLight[] = [];
  private readonly doors: DoorProp[] = [];
  private readonly tapes: THREE.Group[] = [];
  private readonly exitPivot = new THREE.Group();
  private readonly exitSign: THREE.Mesh;
  private readonly exitSpill: THREE.PointLight;
  private readonly tvCtx: CanvasRenderingContext2D;
  private readonly tvTex: THREE.CanvasTexture;
  private readonly vcrLed: THREE.Mesh;
  private lastTvDraw = 0;

  constructor() {
    this.buildDoors();
    this.buildTapes();
    this.buildHides();
    const tv = this.buildCounter();
    this.tvCtx = tv.ctx;
    this.tvTex = tv.tex;
    this.vcrLed = tv.led;
    const exit = this.buildExit();
    this.exitSign = exit.sign;
    this.exitSpill = exit.spill;
  }

  private buildDoors(): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x23282a, roughness: 0.7, metalness: 0.2 });
    const handle = new THREE.MeshStandardMaterial({ color: 0x8a9490, roughness: 0.4, metalness: 0.8 });
    for (const d of LEVEL.doors) {
      // The passage runs along x when both x neighbours are open.
      const alongX = !isWallCell(LEVEL.grid, d.cx - 1, d.cy) && !isWallCell(LEVEL.grid, d.cx + 1, d.cy);
      const pivot = new THREE.Group();
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.2, 0.96), mat);
      panel.position.set(0, 1.1, 0.5);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), handle);
      knob.position.set(0.08, 1.0, 0.85);
      pivot.add(panel, knob);
      if (alongX) pivot.position.set(d.cx + 0.5, 0, d.cy);
      else {
        pivot.position.set(d.cx, 0, d.cy + 0.5);
        pivot.rotation.y = Math.PI / 2;
      }
      pivot.userData.baseRotY = pivot.rotation.y;
      pivot.userData.swing = alongX ? 1 : -1;
      this.group.add(pivot);
      this.doors.push({ pivot });
    }
  }

  private buildTapes(): void {
    const shell = new THREE.MeshStandardMaterial({ color: 0x0b0c0c, roughness: 0.6 });
    const label = new THREE.MeshStandardMaterial({ color: 0x9aa6a0, roughness: 0.8 });
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x6f9fff, transparent: true, opacity: 0.55, fog: false });
    for (const t of LEVEL.tapes) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.11), shell);
      body.position.y = 0.02;
      const lab = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.005, 0.07), label);
      lab.position.y = 0.038;
      g.add(body, lab);
      // The beacon is only on the tape. It is how you find them.
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 8, 1, true), beamMat);
      beam.position.y = 1.6;
      beam.layers.set(LENS_ONLY_LAYER);
      g.add(beam);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 16), beamMat);
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = 0.02;
      glow.layers.set(LENS_ONLY_LAYER);
      g.add(glow);
      g.position.set(t.cx + 0.5, 0, t.cy + 0.5);
      g.rotation.y = 0.6;
      this.group.add(g);
      this.tapes.push(g);
    }
  }

  private buildHides(): void {
    const tex = hideTexture();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.9, depthWrite: false });
    for (const h of LEVEL.hides) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(h.cx + 0.5, 0.012, h.cy + 0.5);
      this.group.add(m);
    }
  }

  private buildCounter(): { ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture; led: THREE.Mesh } {
    const cells: Cell[] = [...LEVEL.counter];
    const minX = Math.min(...cells.map((c) => c.cx));
    const maxX = Math.max(...cells.map((c) => c.cx)) + 1;
    const minY = Math.min(...cells.map((c) => c.cy));
    const maxY = Math.max(...cells.map((c) => c.cy)) + 1;
    const wood = new THREE.MeshStandardMaterial({ color: 0x1c1f20, roughness: 0.8 });
    const top = new THREE.MeshStandardMaterial({ color: 0x59625f, roughness: 0.45 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX, 1.0, maxY - minY), wood);
    body.position.set((minX + maxX) / 2, 0.5, (minY + maxY) / 2);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX + 0.1, 0.06, maxY - minY + 0.1), top);
    slab.position.set((minX + maxX) / 2, 1.03, (minY + maxY) / 2);
    this.group.add(body, slab);

    // VCR
    const v = LEVEL.vcr;
    const vcr = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.12, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x232829, roughness: 0.4, metalness: 0.4 }),
    );
    vcr.position.set(v.cx + 0.5, 1.12, v.cy + 0.5);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.01), new THREE.MeshBasicMaterial({ color: 0x331111 }));
    led.position.set(v.cx + 0.72, 1.12, v.cy + 0.28);
    this.group.add(vcr, led);

    // TV on the counter, a little to the right of the VCR, facing north into the shop
    const tvCanvas = document.createElement('canvas');
    tvCanvas.width = 96;
    tvCanvas.height = 72;
    const ctx = tvCanvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas unavailable');
    const tex = new THREE.CanvasTexture(tvCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const tvBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.7, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x151818, roughness: 0.6 }),
    );
    tvBody.position.set(v.cx + 1.6, 1.4, v.cy + 0.5);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.54), new THREE.MeshBasicMaterial({ map: tex }));
    screen.position.set(v.cx + 1.6, 1.42, v.cy + 0.5 - 0.351);
    screen.rotation.y = Math.PI;
    this.group.add(tvBody, screen);
    const tvLight = new THREE.PointLight(0x9fe8c0, 2.2, 5, 2);
    tvLight.position.set(v.cx + 1.6, 1.4, v.cy - 0.5);
    this.group.add(tvLight);
    return { ctx, tex, led };
  }

  private buildExit(): { sign: THREE.Mesh; spill: THREE.PointLight } {
    const e = LEVEL.exit;
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.96, 2.2, 0.09),
      new THREE.MeshStandardMaterial({ color: 0x1b2022, roughness: 0.5, metalness: 0.3 }),
    );
    door.position.set(0.5, 1.1, 0);
    this.exitPivot.add(door);
    this.exitPivot.position.set(e.cx, 0, e.cy + 0.5);
    this.group.add(this.exitPivot);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.05), new THREE.MeshBasicMaterial({ color: 0xe8202a }));
    sign.position.set(e.cx + 0.5, 2.45, e.cy);
    this.group.add(sign);
    const spill = new THREE.PointLight(0xcfe8ff, 0, 9, 2);
    spill.position.set(e.cx + 0.5, 1.2, e.cy + 1.2);
    this.group.add(spill);
    const red = new THREE.PointLight(0xe8202a, 0, 7, 2);
    red.position.set(e.cx + 0.5, 2.3, e.cy - 0.4);
    this.group.add(red);
    this.emergencyLights.push(red);
    return { sign, spill };
  }

  update(f: PropsFrame): void {
    this.doors.forEach((d, i) => {
      const open = f.doors[i] ?? 0;
      const base = (d.pivot.userData.baseRotY as number) ?? 0;
      const swing = (d.pivot.userData.swing as number) ?? 1;
      d.pivot.rotation.y = base + swing * open * 1.75;
    });
    this.tapes.forEach((t, i) => {
      t.visible = f.tapesTaken[i] !== true;
    });

    this.exitPivot.rotation.y = -f.exit * 1.9;
    const mat = this.exitSign.material as THREE.MeshBasicMaterial;
    mat.color.set(f.exit > 0.5 ? 0xd8fbe6 : 0xe8202a);
    this.exitSpill.intensity = f.exit * 14;

    const ledMat = this.vcrLed.material as THREE.MeshBasicMaterial;
    ledMat.color.set(f.vcrHeld ? 0xe8202a : f.vcrProgress > 0 ? 0x7a1a1a : 0x331111);

    // TV: static, with the tape's progress as a bar
    if (f.timeSec - this.lastTvDraw > 0.07) {
      this.lastTvDraw = f.timeSec;
      this.drawTv(f);
    }
  }

  private drawTv(f: PropsFrame): void {
    const { tvCtx: c } = this;
    const w = 96;
    const h = 72;
    const rnd = lcg(Math.floor(f.timeSec * 30));
    const img = c.createImageData(w, h);
    const base = f.vcrHeld ? 70 : 40;
    for (let i = 0; i < w * h; i++) {
      const v = base + rnd() * 90;
      img.data[i * 4] = v * 0.8;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v * 0.9;
      img.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    if (f.vcrProgress > 0.001) {
      c.fillStyle = 'rgba(2,3,3,0.8)';
      c.fillRect(8, h - 18, w - 16, 10);
      c.fillStyle = f.vcrHeld ? '#d8fbe6' : '#e8202a';
      c.fillRect(10, h - 16, (w - 20) * f.vcrProgress, 6);
    }
    this.tvTex.needsUpdate = true;
  }
}

function hideTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('2d canvas unavailable');
  c.fillStyle = 'rgba(2,3,3,0.75)';
  c.fillRect(0, 0, size, size);
  c.strokeStyle = '#6f9fff';
  c.lineWidth = 6;
  c.setLineDash([18, 12]);
  c.strokeRect(8, 8, size - 16, size - 16);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
