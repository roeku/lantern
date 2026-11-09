/** Raw control snapshot that the pure mapper reads. */

export type ControlRole = 'showman' | 'spectator';
export type ControlPhase = 'lobby' | 'playing' | 'ended';

export interface ControlState {
  /** Codes held right now: 'KeyW', 'Shift', 'Mouse0', ... */
  held: ReadonlySet<string>;
  /** Codes with an edge press (key or button went down) since the last mapping. */
  pressed: readonly string[];
  /** Mouse position projected onto the floor in sim metres, or null when unknown. */
  mouseFloor: { x: number; y: number } | null;
}

export function emptyControls(): ControlState {
  return { held: new Set<string>(), pressed: [], mouseFloor: null };
}
