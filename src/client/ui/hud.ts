import { LEVEL, TUNING } from '../../sim';
import { SENSITIVITY_MAX, SENSITIVITY_MIN } from '../settings';
import { drawRich, drawText, measureText } from './bitmap-font';
import type { Settings } from '../settings';

const FLUORESCENT = '#d8fbe6';
const REC_RED = '#e8202a';
const TAPE_BLUE = '#6f9fff';
const DIM = 'rgba(216,251,230,0.45)';

export interface Banner {
  text: string;
  sub: string;
  /** 0..1 */
  alpha: number;
}

export interface Caption {
  text: string;
  /** 0..1 */
  alpha: number;
}

/** The clip recorder, as the HUD needs it. */
export interface EchoHud {
  mode: 'idle' | 'recording' | 'playing' | 'holding';
  recSec: number;
  maxSec: number;
  /** How far the tape-self is through its clip, and how long the clip is. */
  playSec: number;
  clipSec: number;
}

export interface WinRow {
  name: string;
  clips: number;
  caught: number;
}

/** Routes in sim space (x, y in metres), split into segments wherever someone jumped (a rewind, a respawn). */
export type Route = ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>;

export interface WinCard {
  /** Seconds since the exit was reached. */
  sinceSec: number;
  caught: number;
  clips: number;
  timeSec: number;
  rows: readonly WinRow[];
  you: Route;
  tapeSelves: Route;
  thing: Route;
}

/** When each part of the win card appears, in seconds after the exit. The game ticks a sound on each. */
export const WIN_CARD_SEC = {
  black: 2.5,
  map: 3.2,
  you: 3.4,
  tapeSelves: 4.9,
  thing: 5.9,
  rows: 7.4,
  rowStep: 0.22,
  totals: 8.8,
  prompt: 9.4,
} as const;

export interface HudFrame {
  /** Pointer is locked and the game is running. */
  playing: boolean;
  /** A night is in progress, so the title reads as a pause. */
  started: boolean;
  lensRaise: number;
  lensLocked: boolean;
  battery: number;
  notice: number;
  tick: number;
  /** 0..1 */
  rewind: number;
  /** The chamber's goal, top left, like a camcorder title. */
  objective: string | null;
  /** The next action, bottom centre. [KEY] words draw as key caps. */
  guide: string | null;
  echo: EchoHud;
  /** The tape's voice. */
  caption: Caption | null;
  timeSec: number;
  /** Show the catch freeze caption. */
  caught: boolean;
  tapes: number;
  vcrProgress: number;
  vcrHeld: boolean;
  prompt: string | null;
  banner: Banner | null;
  fps: number | null;
  settings: Settings;
  win: WinCard | null;
}

/**
 * Diegetic HUD drawn on a 2D canvas above the 3D view. Pixel font is embedded in code.
 * Lens up: the viewfinder. Lens down: a dim battery readout. Not playing: the title scene.
 */
export class Hud {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private shownBattery = 1;
  private objective: string | null = null;
  private objectiveAt = 0;
  private guide: string | null = null;
  private guideAt = 0;
  private dpr = 1;

  constructor(root: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;cursor:none;';
    root.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d canvas unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * this.dpr);
    this.canvas.height = Math.floor(window.innerHeight * this.dpr);
  }

  draw(f: HudFrame): void {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // The battery bar eases to its real value
    this.shownBattery += (f.battery - this.shownBattery) * 0.2;

    if (f.lensRaise > 0.01) this.drawViewfinder(f, w, h);
    else this.drawIdleBattery(f, h);

    if (f.vcrProgress > 0.001 && f.vcrProgress < 1) this.drawVcr(f, w, h);

    if (f.prompt && f.playing && !f.win) {
      ctx.globalAlpha = 0.95;
      drawRich(ctx, f.prompt, w / 2, h * 0.78, this.px(3), FLUORESCENT, FLUORESCENT, 'center');
      ctx.globalAlpha = 1;
    }
    if (f.playing && !f.win) this.drawGuide(f, w, h);

    if (f.banner && f.playing) {
      ctx.globalAlpha = f.banner.alpha;
      drawText(ctx, f.banner.text, w / 2, h * 0.2, this.px(5), FLUORESCENT, 'center');
      if (f.banner.sub) drawText(ctx, f.banner.sub, w / 2, h * 0.2 + this.px(5) * 10, this.px(2.5), DIM, 'center');
      ctx.globalAlpha = 1;
    }

    if (f.playing && !f.win) this.drawEcho(f, w, h);


    if (f.caption && f.caption.alpha > 0.01 && f.playing && !f.win) this.drawCaption(f.caption, w, h);

    if (f.rewind > 0.01) this.drawRewind(f, w, h);
    if (f.win) this.drawWin(f, f.win, w, h);
    else if (!f.playing) this.drawTitle(f, w, h);

    if (f.fps !== null) {
      ctx.globalAlpha = 0.7;
      drawText(ctx, `${Math.round(f.fps)} FPS`, this.px(10), this.px(10), this.px(2), TAPE_BLUE);
      ctx.globalAlpha = 1;
    }
  }

  private px(k: number): number {
    return Math.max(1, Math.round(this.dpr * k));
  }

  private drawViewfinder(f: HudFrame, w: number, h: number): void {
    const { ctx } = this;
    const a = Math.min(1, f.lensRaise * 1.4);
    ctx.globalAlpha = a;
    const m = Math.round(Math.min(w, h) * 0.06);
    const len = Math.round(Math.min(w, h) * 0.05);
    const t = this.px(1.5);
    ctx.fillStyle = FLUORESCENT;
    for (const [x, y, sx, sy] of [
      [m, m, 1, 1],
      [w - m, m, -1, 1],
      [m, h - m, 1, -1],
      [w - m, h - m, -1, -1],
    ] as const) {
      ctx.fillRect(sx > 0 ? x : x - len, y - (sy < 0 ? t : 0), len, t);
      ctx.fillRect(x - (sx < 0 ? t : 0), sy > 0 ? y : y - len, t, len);
    }

    const s = this.px(2.5);
    const blink = Math.floor(f.timeSec * 1.6) % 2 === 0;
    if (blink) {
      ctx.fillStyle = REC_RED;
      ctx.beginPath();
      ctx.arc(m + len * 0.5 + s * 2, m + len * 0.5 + s * 3.5, s * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    drawText(ctx, 'REC', m + len * 0.5 + s * 6, m + len * 0.5, s, REC_RED);
    drawText(ctx, `TAPE ${f.tapes}/3`, m + len * 0.5 + s * 6, m + len * 0.5 + s * 10, s, f.tapes === 3 ? FLUORESCENT : DIM);
    drawText(ctx, 'PLAY', w / 2, m + len * 0.5, s, FLUORESCENT, 'center');

    const sec = Math.floor(f.tick / TUNING.tickHz);
    const frames = Math.floor(((f.tick % TUNING.tickHz) / TUNING.tickHz) * 30);
    const pad = (n: number) => String(n).padStart(2, '0');
    drawText(ctx, `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}:${pad(frames)}`, w - m - len * 0.5, m + len * 0.5, s, FLUORESCENT, 'right');

    this.drawBattery(f, w - m - len * 0.5, h - m - len * 0.5 - s * 7, s, 'right');

    // Focus box: corners tighten and redden as the Thing notices
    const vfov = (TUNING.lensFovDeg * Math.PI) / 180;
    const half = (Math.tan((TUNING.lensNoticeHalfAngleDeg * Math.PI) / 180) / Math.tan(vfov / 2)) * (h / 2);
    const r = half * (1 - 0.3 * f.notice);
    const jitter = f.notice * this.px(3) * (f.settings.reducedEffects ? 0.3 : 1);
    const cx = w / 2 + Math.sin(f.timeSec * 61) * jitter;
    const cy = h / 2 + Math.cos(f.timeSec * 53) * jitter;
    const arm = r * 0.28;
    const tt = this.px(1.5 + f.notice * 1.5);
    ctx.fillStyle = f.notice > 0.02 ? mix(FLUORESCENT, REC_RED, Math.min(1, f.notice * 1.6)) : FLUORESCENT;
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const x = cx + sx * r;
      const y = cy + sy * r;
      ctx.fillRect(sx < 0 ? x : x - arm, sy < 0 ? y : y - tt, arm, tt);
      ctx.fillRect(sx < 0 ? x : x - tt, sy < 0 ? y : y - arm, tt, arm);
    }
    ctx.fillRect(cx - tt, cy - tt, tt * 2, tt * 2);
    ctx.globalAlpha = 1;
  }

  /**
   * Objective: types itself out top left when it changes, then sits dim. Prompt: rises in at the bottom when it
   * changes, then breathes gently so the eye finds it without it shouting.
   */
  private drawGuide(f: HudFrame, w: number, h: number): void {
    const { ctx } = this;
    if (f.objective !== this.objective) {
      this.objective = f.objective;
      this.objectiveAt = f.timeSec;
    }
    if (f.guide !== this.guide) {
      this.guide = f.guide;
      this.guideAt = f.timeSec;
    }
    if (this.objective) {
      const age = f.timeSec - this.objectiveAt;
      const shown = this.objective.slice(0, Math.floor(age * 40));
      const s = this.px(2.2);
      const y = f.lensRaise > 0.01 ? Math.round(Math.min(w, h) * 0.06) + s * 26 : this.px(24);
      ctx.globalAlpha = age < 1.2 ? 1 : 0.6;
      drawText(ctx, `> ${shown}`, this.px(28), y, s, age < 1.2 ? FLUORESCENT : DIM);
      ctx.globalAlpha = 1;
    }
    if (this.guide) {
      const age = f.timeSec - this.guideAt;
      const rise = Math.max(0, 1 - age / 0.25);
      ctx.globalAlpha = Math.min(1, age / 0.2) * (age < 1 ? 1 : 0.85 + 0.15 * Math.sin(f.timeSec * 3));
      // Low on the screen: the plate you are walking to sits at the bottom centre of the view
      drawRich(ctx, this.guide, w / 2, h * 0.875 + rise * this.px(10), this.px(2.8), FLUORESCENT, TAPE_BLUE, 'center');
      ctx.globalAlpha = 1;
    }
  }

  /** Recording shows even with the lens down: a red frame, a blinking dot and the tape running out. */
  private drawEcho(f: HudFrame, w: number, h: number): void {
    const { ctx } = this;
    const e = f.echo;
    const s = this.px(2.2);
    const x = w - this.px(24);
    const y = h - this.px(40);
    if (e.mode === 'recording') {
      const pulse = 0.55 + 0.25 * Math.sin(f.timeSec * 6);
      ctx.strokeStyle = REC_RED;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = this.px(3);
      ctx.strokeRect(this.px(6), this.px(6), w - this.px(12), h - this.px(12));
      ctx.globalAlpha = 1;
      const label = `CLIP ${e.recSec.toFixed(1)}`;
      if (Math.floor(f.timeSec * 2) % 2 === 0) {
        ctx.fillStyle = REC_RED;
        ctx.beginPath();
        ctx.arc(x - label.length * s * 6 - s * 5, y + s * 3.5, s * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      drawText(ctx, label, x, y, s, REC_RED, 'right');
      const bw = s * 36;
      const bh = s * 2;
      ctx.fillStyle = 'rgba(232,32,42,0.25)';
      ctx.fillRect(x - bw, y + s * 10, bw, bh);
      ctx.fillStyle = REC_RED;
      ctx.fillRect(x - bw, y + s * 10, bw * Math.min(1, e.recSec / e.maxSec), bh);
    } else if (e.mode === 'playing' || e.mode === 'holding') {
      // Where your tape-self is in its clip: a play head on a blue bar, so you can time yourself against it
      const playing = e.mode === 'playing';
      ctx.globalAlpha = playing ? 0.95 : 0.6;
      drawText(ctx, playing ? `TAPE-SELF ${e.playSec.toFixed(1)}/${e.clipSec.toFixed(1)}` : 'TAPE-SELF WAITING', x, y, s, TAPE_BLUE, 'right');
      const bw = s * 36;
      const bh = s * 2;
      ctx.fillStyle = 'rgba(111,159,255,0.25)';
      ctx.fillRect(x - bw, y + s * 10, bw, bh);
      ctx.fillStyle = TAPE_BLUE;
      ctx.fillRect(x - bw, y + s * 10, bw * (e.clipSec > 0 ? Math.min(1, e.playSec / e.clipSec) : 1), bh);
      ctx.globalAlpha = 1;
    }
  }

  private drawCaption(c: Caption, w: number, h: number): void {
    const { ctx } = this;
    const s = this.px(2);
    const y = h * 0.95;
    ctx.globalAlpha = c.alpha * 0.55;
    ctx.fillStyle = '#020303';
    // A band just wide enough for the line, so it never covers the readouts in the corners
    const bw = measureText(c.text, s) + s * 16;
    ctx.fillRect(w / 2 - bw / 2, y - s * 4, bw, s * 15);
    ctx.globalAlpha = c.alpha;
    drawText(ctx, c.text, w / 2, y, s, TAPE_BLUE, 'center');
    ctx.globalAlpha = 1;
  }

  private drawBattery(f: HudFrame, x: number, y: number, s: number, align: 'left' | 'right'): void {
    const { ctx } = this;
    const low = this.shownBattery < 0.2 || f.lensLocked;
    const flashing = low && Math.floor(f.timeSec * 3) % 2 === 0;
    const color = low ? (flashing ? REC_RED : DIM) : FLUORESCENT;
    const label = f.lensLocked ? 'NO BATT' : 'BATT';
    const bars = 5;
    const barW = s * 3;
    const gap = s;
    const total = bars * barW + (bars - 1) * gap;
    const startX = align === 'right' ? x - total : x;
    drawText(ctx, label, align === 'right' ? startX - s * 2 : startX + total + s * 2, y, s, color, align === 'right' ? 'right' : 'left');
    const filled = this.shownBattery * bars;
    const base = ctx.globalAlpha;
    for (let i = 0; i < bars; i++) {
      const fill = Math.max(0, Math.min(1, filled - i));
      ctx.fillStyle = color;
      ctx.globalAlpha = base * 0.3;
      ctx.fillRect(startX + i * (barW + gap), y, barW, s * 7);
      ctx.globalAlpha = base;
      if (fill > 0) ctx.fillRect(startX + i * (barW + gap), y + s * 7 * (1 - fill), barW, s * 7 * fill);
    }
  }

  private drawIdleBattery(f: HudFrame, h: number): void {
    const { ctx } = this;
    ctx.globalAlpha = 0.4;
    this.drawBattery(f, this.px(24), h - this.px(40), this.px(2), 'left');
    ctx.globalAlpha = 1;
  }

  private drawVcr(f: HudFrame, w: number, h: number): void {
    const { ctx } = this;
    const bw = w * 0.3;
    const bh = this.px(8);
    const x = w / 2 - bw / 2;
    const y = h * 0.9;
    ctx.globalAlpha = 0.9;
    drawText(ctx, f.vcrHeld ? 'PLAYING' : 'TAPE STOPPED', w / 2, y - this.px(2.5) * 10, this.px(2.5), f.vcrHeld ? FLUORESCENT : REC_RED, 'center');
    ctx.fillStyle = 'rgba(216,251,230,0.2)';
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = f.vcrHeld ? FLUORESCENT : REC_RED;
    ctx.fillRect(x, y, bw * f.vcrProgress, bh);
    ctx.globalAlpha = 1;
  }

  private drawRewind(f: HudFrame, w: number, h: number): void {
    const { ctx } = this;
    ctx.globalAlpha = Math.min(1, f.rewind * 1.5);
    const s = this.px(6);
    drawText(ctx, 'REWIND', w / 2, h * 0.42, s, FLUORESCENT, 'center');
    ctx.fillStyle = FLUORESCENT;
    const ay = h * 0.42 + s * 10;
    const as = s * 2.5;
    const shift = ((f.timeSec * 6) % 1) * as;
    for (let i = 0; i < 2; i++) {
      const x = w / 2 + (i - 1) * as * 1.4 + shift - as * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, ay);
      ctx.lineTo(x + as, ay - as * 0.7);
      ctx.lineTo(x + as, ay + as * 0.7);
      ctx.fill();
    }
    if (f.caught) drawText(ctx, 'SIGNAL LOST', w / 2, h * 0.58, this.px(3), REC_RED, 'center');
    ctx.globalAlpha = 1;
  }

  /**
   * The aftermath: silence, then a top-down map of the night drawn in stages. Your route, then every tape-self, then
   * the Thing's path in red: where it was while you could not see it. Then one row per chamber, counting up.
   */
  private drawWin(f: HudFrame, win: WinCard, w: number, h: number): void {
    const { ctx } = this;
    const T = WIN_CARD_SEC;
    const t = win.sinceSec;
    const fadeIn = Math.max(0, Math.min(1, (t - T.black) / 0.8));
    if (fadeIn <= 0) return;
    ctx.fillStyle = `rgba(2,3,3,${0.94 * fadeIn})`;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = fadeIn;
    drawText(ctx, 'TAPE ENDED', w / 2, h * 0.07, this.px(6), FLUORESCENT, 'center');

    // The map
    const gw = LEVEL.grid.width;
    const gh = LEVEL.grid.height;
    const cell = Math.floor(Math.min((w * 0.86) / gw, (h * 0.36) / gh));
    const ox = Math.round(w / 2 - (gw * cell) / 2);
    const oy = Math.round(h * 0.2);
    const mapA = Math.max(0, Math.min(1, (t - T.map) / 0.5));
    if (mapA > 0) {
      ctx.globalAlpha = mapA * 0.32;
      ctx.fillStyle = FLUORESCENT;
      for (let cy = 0; cy < gh; cy++) {
        for (let cx = 0; cx < gw; cx++) if (LEVEL.grid.walls[cy * gw + cx]) ctx.fillRect(ox + cx * cell, oy + cy * cell, cell - 1, cell - 1);
      }
      ctx.globalAlpha = mapA * 0.8;
      for (const p of LEVEL.plates) {
        ctx.fillStyle = REC_RED;
        ctx.fillRect(ox + p.cell.cx * cell + cell * 0.25, oy + p.cell.cy * cell + cell * 0.25, cell * 0.5, cell * 0.5);
      }
      for (const g of LEVEL.gates) {
        ctx.fillStyle = TAPE_BLUE;
        ctx.fillRect(ox + g.cell.cx * cell, oy + g.cell.cy * cell, cell - 1, cell - 1);
      }
      ctx.fillStyle = FLUORESCENT;
      ctx.fillRect(ox + LEVEL.exit.cx * cell, oy + LEVEL.exit.cy * cell, cell - 1, cell - 1);
    }
    const toPx = (p: { x: number; y: number }) => [ox + p.x * cell, oy + p.y * cell] as const;
    const route = (r: Route, color: string, startSec: number, drawSec: number, width: number) => {
      const k = Math.max(0, Math.min(1, (t - startSec) / drawSec));
      if (k <= 0) return;
      const total = r.reduce((n, seg) => n + seg.length, 0);
      let budget = Math.floor(total * k);
      ctx.globalAlpha = fadeIn * 0.9;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      for (const seg of r) {
        if (budget <= 0) break;
        ctx.beginPath();
        seg.slice(0, budget).forEach((p, i) => {
          const [x, y] = toPx(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        budget -= seg.length;
      }
    };
    route(win.you, FLUORESCENT, T.you, 1.4, this.px(1.5));
    route(win.tapeSelves, TAPE_BLUE, T.tapeSelves, 0.9, this.px(1.5));
    route(win.thing, REC_RED, T.thing, 1.3, this.px(2));

    // The legend doubles as the reveal line
    const ly = oy + gh * cell + this.px(10);
    const s = this.px(2);
    if (t > T.you) drawText(ctx, 'YOU', ox, ly, s, FLUORESCENT);
    if (t > T.tapeSelves) drawText(ctx, 'YOUR TAPE-SELVES', ox + s * 26, ly, s, TAPE_BLUE);
    if (t > T.thing) {
      ctx.globalAlpha = fadeIn * (t < T.thing + 1.5 ? 0.6 + 0.4 * Math.sin(t * 12) : 1);
      drawText(ctx, win.thing.length > 0 ? 'IT. IT WAS HERE THE WHOLE TIME' : 'IT', ox + s * 128, ly, s, REC_RED);
      ctx.globalAlpha = fadeIn;
    }

    // One row per chamber, counting in
    const rs = this.px(2.4);
    const rowY = (i: number) => ly + this.px(28) + i * rs * 11;
    win.rows.forEach((row, i) => {
      const at = T.rows + i * T.rowStep;
      if (t < at) return;
      ctx.globalAlpha = fadeIn * Math.min(1, (t - at) / 0.15);
      const y = rowY(i);
      const oneTake = row.clips <= 1 && row.caught === 0;
      drawText(ctx, `${i + 1} ${row.name}`, w * 0.3, y, rs, FLUORESCENT);
      drawText(ctx, `${row.clips} ${row.clips === 1 ? 'CLIP' : 'CLIPS'}`, w * 0.6, y, rs, DIM, 'right');
      // One result column: a clean room in tape-blue, a costly one in red
      if (oneTake) drawText(ctx, 'ONE TAKE', w * 0.64, y, rs, TAPE_BLUE);
      else if (row.caught > 0) drawText(ctx, `CAUGHT ${row.caught}`, w * 0.64, y, rs, REC_RED);
    });
    if (t > T.totals) {
      // Numbers count up to their value
      const k = Math.min(1, (t - T.totals) / 0.6);
      const sec = Math.round(win.timeSec * k);
      const pad = (n: number) => String(n).padStart(2, '0');
      ctx.globalAlpha = fadeIn;
      const y = rowY(win.rows.length) + rs * 4;
      drawText(
        ctx,
        `TIME ${pad(Math.floor(sec / 60))}:${pad(sec % 60)}   CLIPS ${Math.round(win.clips * k)}   CAUGHT ${Math.round(win.caught * k)}`,
        w / 2,
        y,
        this.px(2.8),
        win.caught === 0 ? TAPE_BLUE : FLUORESCENT,
        'center',
      );
    }
    if (t > T.prompt) {
      ctx.globalAlpha = fadeIn * (0.5 + 0.5 * Math.sin(f.timeSec * 3));
      drawRich(ctx, '[R] OR CLICK TO ROLL AGAIN', w / 2, h * 0.94, this.px(2.6), FLUORESCENT, FLUORESCENT, 'center');
    }
    ctx.globalAlpha = 1;
  }

  private drawTitle(f: HudFrame, w: number, h: number): void {
    const { ctx } = this;
    const st = f.settings;
    ctx.fillStyle = 'rgba(2,3,3,0.88)';
    ctx.fillRect(0, 0, w, h);
    const flick = f.timeSec % 7 > 6.85 ? 0.3 : 1;
    ctx.globalAlpha = flick;
    drawText(ctx, 'REWIND NIGHT', w / 2, h * 0.3, this.px(9), FLUORESCENT, 'center');
    drawText(ctx, 'WORKING TITLE', w / 2, h * 0.3 + this.px(9) * 9, this.px(2), TAPE_BLUE, 'center');

    // First time: nothing to read. Click and the game teaches itself.
    if (!f.started) {
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(f.timeSec * 3);
      drawText(ctx, 'CLICK TO START', w / 2, h * 0.56, this.px(4), FLUORESCENT, 'center');
      ctx.globalAlpha = 0.6;
      drawText(ctx, 'HEADPHONES ON', w / 2, h * 0.56 + this.px(4) * 14, this.px(2.2), DIM, 'center');
      ctx.globalAlpha = 0.4;
      drawText(ctx, 'ESC PAUSES. SETTINGS ARE THERE', w / 2, h * 0.92, this.px(2), DIM, 'center');
      ctx.globalAlpha = 1;
      return;
    }

    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(f.timeSec * 3);
    drawText(ctx, 'PAUSED  CLICK TO RESUME', w / 2, h * 0.46, this.px(4), FLUORESCENT, 'center');
    ctx.globalAlpha = 0.85;
    const s = this.px(2.2);
    const line = (i: number, text: string, color: string) => drawRich(ctx, text, w / 2, h * 0.56 + i * s * 12, s, color, color, 'center');
    line(0, `[-] [+] SENSITIVITY ${Math.round(st.sensitivity * 100)}%${st.sensitivity <= SENSITIVITY_MIN ? ' MIN' : st.sensitivity >= SENSITIVITY_MAX ? ' MAX' : ''}`, FLUORESCENT);
    line(1, `[T] LENS BUTTON: ${st.lensToggle ? 'TOGGLE' : 'HOLD'}   [G] EFFECTS: ${st.reducedEffects ? 'REDUCED' : 'FULL'}   [V] FPS: ${st.showFps ? 'ON' : 'OFF'}`, FLUORESCENT);
    line(2, `[1] FINALE HOLD${st.finale === 'hold' ? ' <' : ''}   [2] FINALE RUN${st.finale === 'run' ? ' <' : ''}`, DIM);
    line(4, '[W] [A] [S] [D] MOVE  [SHIFT] RUN  [C] CROUCH  [F] RECORD  [E] USE', DIM);
    line(5, '[RIGHT MOUSE] LENS   [R] IN PLAY: START THE ROOM OVER', DIM);
    line(6, '[R] HERE: START THE WHOLE NIGHT OVER', DIM);
    ctx.globalAlpha = 1;
  }
}

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const lerp = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return `rgb(${lerp(16)},${lerp(8)},${lerp(0)})`;
}
