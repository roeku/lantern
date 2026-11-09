/**
 * 2D top-down replay drawing. Everything is visible regardless of role.
 * Colours come from the shared client palette.
 */
import { PALETTE, css } from '../render/palette';
import { TUNING, type Recap, type ReplayFrame, type Tuning } from '../../sim';

const COLORS = {
  base: css(PALETTE.base),
  stone: css(PALETTE.stone),
  line: css(PALETTE.stoneLight),
  amber: css(PALETTE.amber),
  amberDim: css(PALETTE.amberDim),
  beam: css(PALETTE.beam),
  beamDim: css(PALETTE.beamDeep),
  oxblood: css(PALETTE.oxblood),
  oxbloodBright: css(PALETTE.oxbloodBright),
} as const;

const PAD_PX = 16;
const CANDLE_R_PX = 7;
const SPECTATOR_R_PX = 5;
const ROPE_R_PX = 6;
const CART_HALF_PX = 8;
const GHOST_ALPHA_FAINT = 0.35;
const BEAM_ALPHA = 0.22;
const BEAM_LENGTH_M = 20;
const MARK_PX = 7;
const HALF = 1 / (1 + 1);

export interface ReplayCanvas {
  draw(frame: ReplayFrame, recap: Recap): void;
  destroy(): void;
}

export function createReplayCanvas(parent: HTMLElement, tuning: Tuning = TUNING): ReplayCanvas {
  const canvas = document.createElement('canvas');
  canvas.className = 'replay-canvas';
  canvas.width = 640;
  canvas.height = Math.round((640 * tuning.roomDepthM) / tuning.roomWidthM);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Top-down replay of the round');
  parent.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const scale = Math.min(
    (canvas.width - 2 * PAD_PX) / tuning.roomWidthM,
    (canvas.height - 2 * PAD_PX) / tuning.roomDepthM,
  );
  const px = (x: number): number => PAD_PX + x * scale;
  const py = (y: number): number => PAD_PX + y * scale;

  function cross(x: number, y: number, color: string): void {
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - MARK_PX, y - MARK_PX);
    ctx.lineTo(x + MARK_PX, y + MARK_PX);
    ctx.moveTo(x + MARK_PX, y - MARK_PX);
    ctx.lineTo(x - MARK_PX, y + MARK_PX);
    ctx.stroke();
  }

  function draw(frame: ReplayFrame, recap: Recap): void {
    if (!ctx) return;
    ctx.fillStyle = COLORS.base;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(px(0), py(0), tuning.roomWidthM * scale, tuning.roomDepthM * scale);

    // Cart and beam.
    const cartX = tuning.cartOriginXM;
    const cartY = tuning.cartTrackStartYM + frame.cart.travel;
    ctx.fillStyle = COLORS.beam;
    ctx.globalAlpha = BEAM_ALPHA;
    ctx.beginPath();
    ctx.moveTo(px(cartX), py(cartY));
    for (const sign of [-1, 1]) {
      const a = frame.beam.angle + sign * tuning.beamHalfAngleRad;
      ctx.lineTo(px(cartX + Math.cos(a) * BEAM_LENGTH_M), py(cartY + Math.sin(a) * BEAM_LENGTH_M));
    }
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.amberDim;
    ctx.fillRect(px(cartX) - CART_HALF_PX, py(cartY) - CART_HALF_PX, 2 * CART_HALF_PX, 2 * CART_HALF_PX);
    ctx.strokeStyle = COLORS.beam;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px(cartX), py(cartY));
    ctx.lineTo(px(cartX + Math.cos(frame.beam.angle) * BEAM_LENGTH_M), py(cartY + Math.sin(frame.beam.angle) * BEAM_LENGTH_M));
    ctx.stroke();

    // Ghost: one cell, solid or faint.
    if (frame.ghost) {
      const g = frame.ghost;
      ctx.globalAlpha = g.solid ? 1 : GHOST_ALPHA_FAINT;
      ctx.fillStyle = COLORS.beam;
      ctx.beginPath();
      ctx.arc(px(g.col + HALF), py(g.row + HALF), scale * HALF, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Ropes.
    for (const r of frame.ropes) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = r.status === 'cut' ? COLORS.line : COLORS.oxbloodBright;
      ctx.fillStyle = COLORS.stone;
      ctx.beginPath();
      ctx.arc(px(r.x), py(r.y), ROPE_R_PX, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Candles and spectators.
    for (const c of frame.candles) {
      ctx.strokeStyle = c.status === 'snuffed' ? COLORS.line : COLORS.amber;
      ctx.fillStyle = c.status === 'lit' ? COLORS.amber : COLORS.stone;
      ctx.lineWidth = c.status === 'shielded' ? 3 : 1;
      ctx.beginPath();
      ctx.arc(px(c.x), py(c.y), CANDLE_R_PX, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = COLORS.beamDim;
    for (const s of frame.spectators) {
      ctx.beginPath();
      ctx.arc(px(s.x), py(s.y), SPECTATOR_R_PX, 0, Math.PI * 2);
      ctx.fill();
    }

    // Marks appear once playback reaches the event tick.
    for (const e of recap.snuffs) if (e.tick <= frame.tick) cross(px(e.x), py(e.y), COLORS.oxbloodBright);
    for (const e of recap.ropeCuts) if (e.tick <= frame.tick) cross(px(e.x), py(e.y), COLORS.amber);
  }

  return {
    draw,
    destroy() {
      canvas.remove();
    },
  };
}
