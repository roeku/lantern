import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  RingGeometry,
  SphereGeometry,
  type Object3D,
} from 'three';
import { TUNING, lightRadiusM, type Candle, type Rope, type Tuning, type View } from '../../sim';
import type { InterpFrame } from './interpolation';
import { PALETTE } from './palette';
import { simToWorld } from './floor-projection';

const CART_SIZE = { w: 1.2, h: 0.5, d: 0.9 };
const GHOST_HEIGHT_M = 1.6;
const SPECTATOR_RADIUS_M = 0.28;
const ROPE_BAR_W = 1.2;
const ROPE_BAR_H = 0.14;
const LIGHT_HEIGHT_M = 1.2;
const LIT_INTENSITY = 60;
const SHIELDED_INTENSITY = 12;

interface CandleActor {
  group: Group;
  light: PointLight;
  flame: Mesh;
  /** Draws the Light_Radius on the floor. */
  radiusRing: Mesh;
}

interface RopeActor {
  group: Group;
  post: Mesh;
  barBack: Mesh;
  barFill: Mesh;
}

interface SpectatorActor {
  group: Group;
  marker: Mesh;
  selfRing: Mesh;
}

const mat = {
  cart: new MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.7 }),
  ghostSolid: new MeshStandardMaterial({
    color: PALETTE.beam,
    emissive: PALETTE.beamDeep,
    emissiveIntensity: 0.6,
    roughness: 0.9,
  }),
  ghostFaint: new MeshStandardMaterial({
    color: PALETTE.beam,
    emissive: PALETTE.beamDeep,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  }),
  flameLit: new MeshBasicMaterial({ color: PALETTE.amber }),
  flameShielded: new MeshBasicMaterial({ color: PALETTE.amberDim }),
  flameSnuffed: new MeshBasicMaterial({ color: PALETTE.stoneLight }),
  ringLit: new MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.35 }),
  ringShielded: new MeshBasicMaterial({ color: PALETTE.amberDim, transparent: true, opacity: 0.3 }),
  ropeStanding: new MeshStandardMaterial({ color: PALETTE.oxbloodBright, roughness: 0.8 }),
  ropeCut: new MeshStandardMaterial({ color: PALETTE.stoneLight, roughness: 0.9 }),
  barBack: new MeshBasicMaterial({ color: PALETTE.stone }),
  barFill: new MeshBasicMaterial({ color: PALETTE.amber }),
  spectator: new MeshStandardMaterial({ color: PALETTE.oxblood, roughness: 0.8 }),
  self: new MeshBasicMaterial({ color: PALETTE.amber }),
};

const geo = {
  cart: new BoxGeometry(CART_SIZE.w, CART_SIZE.h, CART_SIZE.d),
  ghost: new BoxGeometry(0.9, GHOST_HEIGHT_M, 0.9),
  flame: new SphereGeometry(0.12, 12, 8),
  post: new CylinderGeometry(0.08, 0.08, 2.2, 8),
  bar: new BoxGeometry(1, 1, 1),
  spectator: new CylinderGeometry(SPECTATOR_RADIUS_M, SPECTATOR_RADIUS_M, 0.9, 12),
  selfRing: new RingGeometry(SPECTATOR_RADIUS_M + 0.12, SPECTATOR_RADIUS_M + 0.2, 24),
  radiusRing: new RingGeometry(0.97, 1, 48),
};

function place(o: Object3D, x: number, y: number, height = 0): void {
  const w = simToWorld(x, y);
  o.position.set(w.x, height, w.z);
}

function flat(m: Mesh): Mesh {
  m.rotation.x = -Math.PI / 2;
  return m;
}

/** Renders View entities. Holds only presentation objects; never mutates State. */
export class Actors {
  readonly group = new Group();
  private readonly tuning: Tuning;
  private readonly cart: Mesh;
  private readonly ghost: Mesh;
  private readonly candles = new Map<number, CandleActor>();
  private readonly ropes = new Map<number, RopeActor>();
  private readonly spectators = new Map<number, SpectatorActor>();

  constructor(tuning: Tuning = TUNING) {
    this.tuning = tuning;
    this.cart = new Mesh(geo.cart, mat.cart);
    this.ghost = new Mesh(geo.ghost, mat.ghostSolid);
    this.ghost.visible = false;
    this.group.add(this.cart, this.ghost);
  }

  update(view: View, interp: InterpFrame, localPlayer: number): void {
    const t = this.tuning;
    place(this.cart, t.cartOriginXM, t.cartTrackStartYM + interp.cartTravel, CART_SIZE.h / 2);

    if (view.ghost) {
      place(this.ghost, view.ghost.col + 0.5, view.ghost.row + 0.5, GHOST_HEIGHT_M / 2);
      this.ghost.material = view.ghost.solid ? mat.ghostSolid : mat.ghostFaint;
      this.ghost.visible = true;
    } else {
      this.ghost.visible = false;
    }

    this.syncSpectators(view, interp, localPlayer);
    this.syncCandles(view, interp);
    this.syncRopes(view);
  }

  private syncSpectators(view: View, interp: InterpFrame, localPlayer: number): void {
    const seen = new Set<number>();
    for (const s of interp.spectators) {
      seen.add(s.player);
      let a = this.spectators.get(s.player);
      if (!a) {
        const marker = new Mesh(geo.spectator, mat.spectator);
        marker.position.y = 0.45;
        const selfRing = flat(new Mesh(geo.selfRing, mat.self));
        selfRing.position.y = 0.03;
        const group = new Group();
        group.add(marker, selfRing);
        this.group.add(group);
        a = { group, marker, selfRing };
        this.spectators.set(s.player, a);
      }
      a.selfRing.visible = s.player === localPlayer;
      place(a.group, s.x, s.y);
    }
    prune(this.spectators, seen, this.group);
    void view;
  }

  private syncCandles(view: View, interp: InterpFrame): void {
    const seen = new Set<number>();
    for (const c of view.candles) {
      seen.add(c.id);
      let a = this.candles.get(c.id);
      if (!a) {
        a = this.createCandle();
        this.candles.set(c.id, a);
        this.group.add(a.group);
      }
      this.applyCandle(a, c, view, interp);
    }
    prune(this.candles, seen, this.group);
  }

  private createCandle(): CandleActor {
    const group = new Group();
    const light = new PointLight(PALETTE.amber, LIT_INTENSITY, 0, 2);
    light.position.y = LIGHT_HEIGHT_M;
    const flame = new Mesh(geo.flame, mat.flameLit);
    flame.position.y = LIGHT_HEIGHT_M;
    const radiusRing = flat(new Mesh(geo.radiusRing, mat.ringLit));
    radiusRing.position.y = 0.02;
    group.add(light, flame, radiusRing);
    return { group, light, flame, radiusRing };
  }

  private applyCandle(a: CandleActor, c: Candle, view: View, interp: InterpFrame): void {
    // A candle follows its owner's interpolated position.
    const owner = view.spectators.find((s) => s.candleId === c.id);
    const p = owner ? interp.spectators.find((s) => s.player === owner.player) : undefined;
    place(a.group, p?.x ?? c.x, p?.y ?? c.y);

    const radius = lightRadiusM(c.status, this.tuning);
    a.light.distance = radius;
    a.radiusRing.visible = radius > 0;
    a.radiusRing.scale.setScalar(Math.max(radius, 0.001));
    if (c.status === 'lit') {
      a.light.intensity = LIT_INTENSITY;
      a.light.color.setHex(PALETTE.amber);
      a.flame.material = mat.flameLit;
      a.radiusRing.material = mat.ringLit;
    } else if (c.status === 'shielded') {
      a.light.intensity = SHIELDED_INTENSITY;
      a.light.color.setHex(PALETTE.amberDim);
      a.flame.material = mat.flameShielded;
      a.radiusRing.material = mat.ringShielded;
    } else {
      a.light.intensity = 0;
      a.flame.material = mat.flameSnuffed;
      a.flame.scale.setScalar(0.6);
      return;
    }
    a.flame.scale.setScalar(c.status === 'lit' ? 1 : 0.75);
  }

  private syncRopes(view: View): void {
    const hold = Math.max(1, Math.round(this.tuning.ropeCutHoldS / this.tuning.tickS));
    const seen = new Set<number>();
    for (const r of view.ropes) {
      seen.add(r.id);
      let a = this.ropes.get(r.id);
      if (!a) {
        a = this.createRope();
        this.ropes.set(r.id, a);
        this.group.add(a.group);
      }
      this.applyRope(a, r, hold);
    }
    prune(this.ropes, seen, this.group);
  }

  private createRope(): RopeActor {
    const group = new Group();
    const post = new Mesh(geo.post, mat.ropeStanding);
    post.position.y = 1.1;
    const barBack = new Mesh(geo.bar, mat.barBack);
    barBack.scale.set(ROPE_BAR_W, ROPE_BAR_H, ROPE_BAR_H);
    barBack.position.y = 2.5;
    const barFill = new Mesh(geo.bar, mat.barFill);
    barFill.position.y = 2.5;
    group.add(post, barBack, barFill);
    return { group, post, barBack, barFill };
  }

  private applyRope(a: RopeActor, r: Rope, holdTicks: number): void {
    place(a.group, r.x, r.y);
    const cut = r.status === 'cut';
    a.post.material = cut ? mat.ropeCut : mat.ropeStanding;
    // A cut rope hangs slack: shorter and tilted.
    a.post.scale.y = cut ? 0.4 : 1;
    a.post.position.y = cut ? 0.45 : 1.1;
    a.post.rotation.z = cut ? 0.9 : 0;

    const showBar = !cut && r.cutProgressTicks > 0;
    a.barBack.visible = showBar;
    a.barFill.visible = showBar;
    if (showBar) {
      const f = Math.min(1, Math.max(0, r.cutProgressTicks / holdTicks));
      const w = Math.max(0.001, ROPE_BAR_W * f);
      a.barFill.scale.set(w, ROPE_BAR_H * 1.2, ROPE_BAR_H * 1.2);
      a.barFill.position.x = -ROPE_BAR_W / 2 + w / 2;
    }
  }

  dispose(): void {
    this.group.clear();
  }
}

function prune<T extends { group: Group }>(map: Map<number, T>, seen: Set<number>, parent: Group): void {
  for (const [id, a] of map) {
    if (!seen.has(id)) {
      parent.remove(a.group);
      map.delete(id);
    }
  }
}
