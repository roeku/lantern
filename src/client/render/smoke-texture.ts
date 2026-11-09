import { DataTexture, NearestFilter, RGBAFormat, UnsignedByteType } from 'three';
import { TUNING, type Tuning, type View } from '../../sim';
import { PALETTE, rgb } from './palette';

/** Maximum alpha of a fully dense cell, 0..255. */
const MAX_SMOKE_ALPHA = 235;

/**
 * Pure builder: RGBA bytes, one texel per cell, row-major (index = row * W + col).
 * Cells absent from the View are opaque black. Visible cells are smoke-coloured
 * with alpha proportional to density. Density is read only from the View.
 */
export function buildSmokeTextureData(view: View, tuning: Tuning = TUNING, out?: Uint8Array): Uint8Array {
  const count = tuning.roomWidthM * tuning.roomDepthM;
  const data = out && out.length === count * 4 ? out : new Uint8Array(count * 4);
  const [br, bg, bb] = rgb(PALETTE.black);
  const [sr, sg, sb] = rgb(PALETTE.smoke);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    data[o] = br;
    data[o + 1] = bg;
    data[o + 2] = bb;
    data[o + 3] = 255;
  }
  for (const c of view.cells) {
    if (!Number.isInteger(c.index) || c.index < 0 || c.index >= count) continue;
    const d = Math.min(1, Math.max(0, c.density));
    const o = c.index * 4;
    data[o] = sr;
    data[o + 1] = sg;
    data[o + 2] = sb;
    data[o + 3] = Math.round(d * MAX_SMOKE_ALPHA);
  }
  return data;
}

/** W x H nearest-filtered texture; call `updateSmokeTexture` each snapshot. */
export function createSmokeTexture(tuning: Tuning = TUNING): DataTexture {
  const w = tuning.roomWidthM;
  const h = tuning.roomDepthM;
  const tex = new DataTexture(new Uint8Array(w * h * 4), w, h, RGBAFormat, UnsignedByteType);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function updateSmokeTexture(tex: DataTexture, view: View, tuning: Tuning = TUNING): void {
  buildSmokeTextureData(view, tuning, tex.image.data as Uint8Array);
  tex.needsUpdate = true;
}
