/** Pure interpolation between the two most recent snapshots. No WebGL. */

export interface InterpFrame {
  cartTravel: number;
  spectators: { player: number; x: number; y: number }[];
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v));
}

/** alpha = clamp((now - receivedAt) / tickMs). */
export function interpAlpha(nowMs: number, receivedAtMs: number, tickMs: number): number {
  return clamp01((nowMs - receivedAtMs) / tickMs);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Spectators are matched by player id; one missing in `prev` is taken from `next` as is. */
export function lerpPositions(prev: InterpFrame, next: InterpFrame, alpha: number): InterpFrame {
  const t = clamp01(alpha);
  return {
    cartTravel: lerp(prev.cartTravel, next.cartTravel, t),
    spectators: next.spectators.map((n) => {
      const p = prev.spectators.find((s) => s.player === n.player);
      return p ? { player: n.player, x: lerp(p.x, n.x, t), y: lerp(p.y, n.y, t) } : { ...n };
    }),
  };
}
