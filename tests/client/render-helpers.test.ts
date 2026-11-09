import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { TUNING, type View } from '../../src/sim';
import { createCamera } from '../../src/client/render/camera';
import { screenToFloor, simToWorld } from '../../src/client/render/floor-projection';
import { lerpPositions, type InterpFrame } from '../../src/client/render/interpolation';
import { buildSmokeTextureData } from '../../src/client/render/smoke-texture';
import { PALETTE, rgb } from '../../src/client/render/palette';

describe('floor projection', () => {
  it('maps sim (x, y) to world (x, 0, -y)', () => {
    expect(simToWorld(3, 5)).toEqual({ x: 3, y: 0, z: -5 });
  });

  it('screenToFloor inverts the camera projection of a sim point', () => {
    const camera = createCamera(16 / 9);
    for (const [x, y] of [[8, 6], [2, 3], [14, 9], [5, 11]] as [number, number][]) {
      const w = simToWorld(x, y);
      const ndc = new Vector3(w.x, w.y, w.z).project(camera);
      const hit = screenToFloor(ndc.x, ndc.y, camera);
      expect(hit).not.toBeNull();
      expect(hit!.x).toBeCloseTo(x, 4);
      expect(hit!.y).toBeCloseTo(y, 4);
    }
  });

  it('returns null when the ray points above the horizon', () => {
    expect(screenToFloor(0, 1, createCamera(1))).not.toBeNull();
    const camera = createCamera(1);
    camera.lookAt(0, 50, -100);
    camera.updateMatrixWorld();
    expect(screenToFloor(0, 0, camera)).toBeNull();
  });
});

describe('lerpPositions', () => {
  const prev: InterpFrame = { cartTravel: 0, spectators: [{ player: 1, x: 0, y: 0 }] };
  const next: InterpFrame = {
    cartTravel: 10,
    spectators: [{ player: 1, x: 4, y: 8 }, { player: 2, x: 3, y: 3 }],
  };

  it('returns prev at alpha 0, midpoint at 0.5 and next at 1', () => {
    expect(lerpPositions(prev, next, 0).cartTravel).toBe(0);
    expect(lerpPositions(prev, next, 0).spectators[0]).toEqual({ player: 1, x: 0, y: 0 });
    expect(lerpPositions(prev, next, 0.5).cartTravel).toBe(5);
    expect(lerpPositions(prev, next, 0.5).spectators[0]).toEqual({ player: 1, x: 2, y: 4 });
    expect(lerpPositions(prev, next, 1)).toEqual(next);
  });

  it('takes a spectator missing from prev as is', () => {
    expect(lerpPositions(prev, next, 0.5).spectators[1]).toEqual({ player: 2, x: 3, y: 3 });
  });
});

describe('buildSmokeTextureData', () => {
  const count = TUNING.roomWidthM * TUNING.roomDepthM;
  const view = { cells: [{ index: 5, density: 1 }, { index: 7, density: 0.5 }, { index: 9, density: 0 }] } as unknown as View;
  const data = buildSmokeTextureData(view);

  it('has one RGBA texel per cell', () => {
    expect(data.length).toBe(count * 4);
  });

  it('paints cells outside the View opaque black', () => {
    const [r, g, b] = rgb(PALETTE.black);
    for (const i of [0, 6, count - 1]) {
      expect([...data.slice(i * 4, i * 4 + 4)]).toEqual([r, g, b, 255]);
    }
  });

  it('maps density to alpha with smoke colour', () => {
    const [r, g, b] = rgb(PALETTE.smoke);
    expect([...data.slice(20, 23)]).toEqual([r, g, b]);
    const full = data[5 * 4 + 3]!;
    const half = data[7 * 4 + 3];
    expect(full).toBeGreaterThan(200);
    expect(half).toBe(Math.round(full / 2));
    expect(data[9 * 4 + 3]).toBe(0);
  });
});

describe('palette is the only colour source in the client', () => {
  const root = join(__dirname, '../../src/client');
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) files.push(p);
    }
  };
  walk(root);

  it('finds client files', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it('has no hex colour literals outside palette.ts', () => {
    const literal = /0x[0-9a-fA-F]{6}\b|['"`]#[0-9a-fA-F]{3,8}['"`]/;
    const offenders = files
      .filter((f) => !f.endsWith('render/palette.ts'))
      .filter((f) => literal.test(readFileSync(f, 'utf8')))
      .map((f) => relative(root, f));
    expect(offenders).toEqual([]);
  });
});
