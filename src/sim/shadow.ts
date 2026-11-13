import { TUNING } from './tuning';
import type { Vec2 } from './vec2';

/**
 * The unseen follower. In the chambers where nothing hunts you, the Thing still walks your route a few metres behind,
 * never closer than `shadowMinDistM`, never attacking. You only see it if you raise the lens and look back. The end
 * card shows where it was. Pure functions over a trail of the player's positions.
 */

/** Adds the player's position to the trail when they have moved far enough. A jump (a rewind) starts a new trail. */
export function pushTrail(trail: readonly Vec2[], pos: Vec2): Vec2[] {
  const last = trail[trail.length - 1];
  if (!last) return [{ ...pos }];
  const d = Math.hypot(pos.x - last.x, pos.y - last.y);
  if (d > TUNING.trailJumpM) return [{ ...pos }];
  if (d < TUNING.trailSpacingM) return trail as Vec2[];
  const next = [...trail, { ...pos }];
  return next.length > TUNING.trailMaxSamples ? next.slice(next.length - TUNING.trailMaxSamples) : next;
}

/**
 * Where the follower stands: the point on your trail `shadowFollowDistM` of walking behind you, as long as that is at
 * least `shadowMinDistM` away in a straight line. Null while you have not walked far enough for it to be behind you.
 */
export function shadowPos(trail: readonly Vec2[], pos: Vec2): Vec2 | null {
  let arc = 0;
  let from = pos;
  let best: Vec2 | null = null;
  for (let i = trail.length - 1; i >= 0; i--) {
    const p = trail[i];
    if (!p) continue;
    const seg = Math.hypot(from.x - p.x, from.y - p.y);
    if (arc + seg >= TUNING.shadowFollowDistM && seg > 0) {
      const t = (TUNING.shadowFollowDistM - arc) / seg;
      best = { x: from.x + (p.x - from.x) * t, y: from.y + (p.y - from.y) * t };
      break;
    }
    arc += seg;
    from = p;
  }
  // Not enough trail for the full distance: use the oldest point once you have walked at least the minimum
  if (!best && arc >= TUNING.shadowMinTrailM) best = from;
  if (!best) return null;
  return Math.hypot(best.x - pos.x, best.y - pos.y) >= TUNING.shadowMinDistM ? best : null;
}
