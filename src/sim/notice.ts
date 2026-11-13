import { DT_SEC, TUNING } from './tuning';
import { clamp } from './vec2';
import type { LensReading } from './lens';

export interface NoticeUpdate {
  notice: number;
  noticeLockTicks: number;
}

/** One tick of the notice meter. Always returns notice in [0, 1]. */
export function stepNotice(notice: number, lockTicks: number, lens: LensReading, fillScale = 1): NoticeUpdate {
  if (lockTicks > 0) {
    return {
      notice: clamp(notice - TUNING.noticeDecayPerSec * DT_SEC, 0, 1),
      noticeLockTicks: lockTicks - 1,
    };
  }
  const coneFill = lens.inFocusBox ? TUNING.noticeFillPerSec : 0;
  const fillPerSec =
    (coneFill * (lens.recSeen ? TUNING.recLightFillMultiplier : 1) + (lens.recSeen ? TUNING.recLightFillPerSec : 0)) *
    fillScale;
  const rate = fillPerSec > 0 ? fillPerSec : -TUNING.noticeDecayPerSec;
  return { notice: clamp(notice + rate * DT_SEC, 0, 1), noticeLockTicks: 0 };
}
