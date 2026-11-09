/**
 * Cart movement and image scale. Pure: returns new values, never mutates arguments.
 */

import type { State } from './state';
import type { Tuning } from './tuning';

export type Cart = State['cart'];
export type CartDir = 1 | -1;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * Move the cart for one tick.
 * Rush wins when both rush and roll are present. With neither, travel is
 * unchanged and speed is 0. Travel is clamped to [0, cartTravelMaxM] and the
 * reported speed is abs(travel change) / tickS.
 */
export function moveCart(
  cart: Cart,
  rollDir: CartDir | null,
  rushDir: CartDir | null,
  tuning: Tuning,
): Cart {
  let delta = 0;
  if (rushDir !== null) {
    delta = rushDir * tuning.cartRushSpeedMps * tuning.tickS;
  } else if (rollDir !== null) {
    delta = rollDir * tuning.cartRollSpeedMps * tuning.tickS;
  } else {
    return { travel: cart.travel, speedMps: 0 };
  }

  const travel = clamp(cart.travel + delta, 0, tuning.cartTravelMaxM);
  return { travel, speedMps: Math.abs(travel - cart.travel) / tuning.tickS };
}

/** Image scale, linear from imageScaleMin to imageScaleMax over [0, cartTravelMaxM]. */
export function imageScale(travel: number, tuning: Tuning): number {
  const t = clamp(travel, 0, tuning.cartTravelMaxM) / tuning.cartTravelMaxM;
  return tuning.imageScaleMin + (tuning.imageScaleMax - tuning.imageScaleMin) * t;
}
