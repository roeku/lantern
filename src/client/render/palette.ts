/**
 * The only place in the client that holds colour values.
 * Taken from .kiro/steering/feel.md: near-black base, candle amber,
 * cold blue-white beam, oxblood accent. Everything else is a shade of these.
 */

export const PALETTE = {
  /** Near-black base: background, void and cells the viewer cannot see. */
  black: 0x000000,
  base: 0x0b0a0d,
  stone: 0x17151a,
  stoneLight: 0x24212a,
  /** Candle amber. */
  amber: 0xe8a33d,
  amberDim: 0x7a4f1c,
  /** Cold blue-white beam. */
  beam: 0xbcd4f0,
  beamDeep: 0x6f8fb8,
  /** Oxblood accent. */
  oxblood: 0x5c1018,
  oxbloodBright: 0x8a1c26,
  /** Smoke is the cold tone, dulled. */
  smoke: 0x8a97a8,
  /** Brass for the cart and rope posts. */
  brass: 0x8c6a35,
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Split a 0xRRGGBB value into 0..255 channels. */
export function rgb(hex: number): [number, number, number] {
  return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
}
/** CSS '#rrggbb' string for a palette value (for 2D canvas drawing). */
export function css(hex: number): string {
  return `#${hex.toString(16).padStart(6, '0')}`;
}
