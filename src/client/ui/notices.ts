/**
 * Notices for snuffs and rope cuts. Pure: diffEvents compares two snapshots of the same
 * round (State or View) and the notice list is pruned by a caller-supplied clock value.
 */
import type { CandleStatus, RopeStatus } from '../../sim';

export const NOTICE_MS = 3000;

/** The part of State or View that notices need. */
export interface EventSource {
  ropes: readonly { id: number; status: RopeStatus }[];
  candles: readonly { id: number; status: CandleStatus }[];
}

export type NoticeEvent =
  | { kind: 'snuff'; id: number; text: string }
  | { kind: 'cut'; id: number; text: string };

export interface Notice {
  key: string;
  text: string;
  /** Clock value at which the notice stops showing. */
  expiresAtMs: number;
}

/** Snuff and cut events that happened between prev and next. Items missing from either side are skipped. */
export function diffEvents(prev: EventSource, next: EventSource): NoticeEvent[] {
  const out: NoticeEvent[] = [];
  const offset = 1;
  for (const c of next.candles) {
    const before = prev.candles.find((p) => p.id === c.id);
    if (before !== undefined && before.status !== 'snuffed' && c.status === 'snuffed') {
      out.push({ kind: 'snuff', id: c.id, text: `Candle ${c.id + offset} snuffed` });
    }
  }
  for (const r of next.ropes) {
    const before = prev.ropes.find((p) => p.id === r.id);
    if (before !== undefined && before.status !== 'cut' && r.status === 'cut') {
      out.push({ kind: 'cut', id: r.id, text: `Rope ${r.id + offset} cut` });
    }
  }
  return out;
}

/** Add events to the list with an expiry of NOTICE_MS after nowMs. Does not mutate the input. */
export function addNotices(list: readonly Notice[], events: readonly NoticeEvent[], nowMs: number): Notice[] {
  const added = events.map((e) => ({
    key: `${e.kind}:${e.id}`,
    text: e.text,
    expiresAtMs: nowMs + NOTICE_MS,
  }));
  return [...list, ...added];
}

/** Drop notices that have expired at nowMs. */
export function activeNotices(list: readonly Notice[], nowMs: number): Notice[] {
  return list.filter((n) => n.expiresAtMs > nowMs);
}
