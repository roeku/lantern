/**
 * Room codes and the pure client-input gate. Imports protocol and sim types only.
 */

import type { Input, PlayerId } from '../sim';
import { parseClientMessage, ROOM_CODE_PATTERN } from './protocol';

/** Input messages accepted per seat per tick; extras are dropped. */
export const MAX_INPUTS_PER_SEAT_PER_TICK = 8;

/** No 0/O or 1/I lookalikes, so codes are easy to read aloud. Every character is in [A-Z0-9]. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;

export { ROOM_CODE_PATTERN };

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

/** Make a room code. `random` returns a number in [0, 1), like Math.random. */
export function generateRoomCode(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.min(CODE_ALPHABET.length - 1, Math.floor(random() * CODE_ALPHABET.length));
    out += CODE_ALPHABET[Math.max(0, idx)];
  }
  return out;
}

/**
 * Turn one raw frame into a sim Input for `player`, or null.
 * Null when the frame is malformed, is not an `in` message, uses a non-whitelisted kind,
 * or `countSoFar` already reached MAX_INPUTS_PER_SEAT_PER_TICK for this seat this tick.
 * The player id is always the seat's, whatever the client sent.
 */
export function acceptClientInput(raw: string, player: PlayerId, countSoFar: number): Input | null {
  if (countSoFar >= MAX_INPUTS_PER_SEAT_PER_TICK) return null;
  const msg = parseClientMessage(raw);
  if (msg === null || msg.t !== 'in') return null;
  return { ...msg.input, player } as Input;
}
