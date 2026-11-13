import {
  createState,
  DT_SEC,
  findInteraction,
  isBlackout,
  LEVEL,
  readLens,
  sightGrid,
  step,
  tapesFound,
  TUNING,
  vcrProgress,
} from '../sim';
import { AudioEngine } from './audio/audio-engine';
import { FEEL } from './feel';
import { Input } from './input/input';
import { GameRenderer } from './render/game-renderer';
import { loadSettings, saveSettings, SENSITIVITY_MAX, SENSITIVITY_MIN, SENSITIVITY_STEP } from './settings';
import { Hud } from './ui/hud';
import type { SimState } from '../sim';
import { Guide } from './ui/guide';
import { WIN_CARD_SEC } from './ui/hud';
import type { Banner, Caption, EchoHud, WinRow } from './ui/hud';
import type { GhostFrame } from './render/echo-props';

const BANNER_SEC = 3.5;
const CAPTION_SEC = 4.5;

/** What the chamber banner says on the way in. Placeholder text for the author to rewrite. */
const CHAMBERS: ReadonlyArray<{ title: string; sub: string; voice: string }> = [
  // The first two chambers stay quiet: the guide is teaching there, and one voice at a time is enough
  { title: 'CHAMBER 1', sub: 'THE GATE IS SHUT', voice: '' },
  { title: 'CHAMBER 2', sub: 'TWO PLATES', voice: '' },
  { title: 'CHAMBER 3', sub: 'IT CAN HEAR YOU', voice: 'SOMETHING LIVES HERE. IT CANNOT SEE YOU. IT CAN HEAR YOUR TAPE.' },
  { title: 'CHAMBER 4', sub: 'TWO GATES', voice: 'TWO DOORS. THE FIRST ONE IS NOT YOURS TO OPEN. THE SECOND ONE IS.' },
  { title: 'THE COUNTER', sub: 'PLAY THE TAPES', voice: 'IT HEARS THE TAPE PLAYING. LET SOMEONE ELSE HOLD IT.' },
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function ease(cur: number, target: number, ratePerSec: number, dtSec: number): number {
  return cur + (target - cur) * (1 - Math.exp(-ratePerSec * dtSec));
}

/**
 * Owns the loop. Fixed-step sim, render-rate camera, events turned into sound and shake.
 * Reads sim state, never changes it.
 */
export class Game {
  private readonly renderer: GameRenderer;
  private readonly hud: Hud;
  private readonly input: Input;
  private readonly audio = new AudioEngine();
  private readonly settings = loadSettings();

  private prev: SimState;
  private curr: SimState;
  private accSec = 0;
  private lastMs = 0;
  private timeSec = 0;
  private playSec = 0;
  private lensUsedSec = 0;
  private wasLensHeld = false;
  private frameDts: number[] = [];

  // Presentation state that follows the sim
  private doorAnim: number[];
  private plateAnim: number[];
  private gateAnim: number[];
  private ghostAlpha = 0;
  private ghostCrouch = 0;
  private ghostStepAccM = 0;
  private recordsDone = 0;
  private readonly guide = new Guide();
  /** Where you walked while recording: the tape-self's route, shown on the floor. */
  private footprints: Array<{ x: number; y: number }> = [];
  private recordingPath: Array<{ x: number; y: number }> = [];
  private idleRenderSec = 0;
  // The night, for the map on the win card. Segments break wherever someone jumps.
  private routeYou: Array<Array<{ x: number; y: number }>> = [];
  private routeThing: Array<Array<{ x: number; y: number }>> = [];
  private routeSelves: Array<Array<{ x: number; y: number }>> = [];
  private clipsByChamber: number[] = [];
  private caughtByChamber: number[] = [];
  private winStage = 0;
  /** The browser refused the mouse. Shown on the title so the click does not seem to do nothing. */
  private lockProblem = false;
  private chamberSec = 0;
  private seenChamber = 0;
  private captionLeft = 0;
  private caption = '';
  private exitAnim = 0;
  private blackoutAnim = 0;
  private houseLights = 0;
  private winSec = 0;
  private bannerLeft = 0;
  private banner = { text: '', sub: '' };

  // Catch presentation
  private freezeSec = 0;
  private scrubSec = 0;
  /** The scrub is from a catch, not from rewinding into a tape-self. */
  private scrubFromCatch = false;

  // Camera feel
  private eyeY: number = TUNING.eyeHeightStandM;
  private bobPhase = 0;
  private bobAmp = 0;
  private stepAccM = 0;
  private lastPos: { x: number; y: number };

  constructor(root: HTMLElement) {
    this.renderer = new GameRenderer(root, this.settings.quality);
    this.hud = new Hud(root);
    this.input = new Input(this.renderer.canvas, this.settings);
    this.faceStart();
    this.clipsByChamber = CHAMBERS.map(() => 0);
    this.caughtByChamber = CHAMBERS.map(() => 0);
    this.prev = this.curr = this.newState();
    this.doorAnim = this.curr.doors.map(() => 0);
    this.plateAnim = this.curr.plates.map(() => 0);
    this.gateAnim = this.curr.gates.map(() => 0);
    this.lastPos = { ...this.curr.player.pos };

    this.input.onLockFailed(() => {
      this.lockProblem = true;
    });
    this.input.onLock((locked) => {
      if (locked) this.lockProblem = false;
      // The first lock is the game's own first input: unlock audio here.
      if (locked) this.audio.unlock();
      this.audio.setPaused(!locked);
      this.lastMs = performance.now();
      if (locked && this.curr.tick === 0 && this.bannerLeft === 0) this.enterChamber(0);
    });
    this.input.onKey((code) => this.onKey(code));
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.input.isLocked && this.curr.won && this.winSec > WIN_CARD_SEC.map) this.restart();
    });
    requestAnimationFrame(this.frame);
  }

  private newState(): SimState {
    // Dev builds accept ?seed=N so a run can be repeated. Stripped from production builds.
    const devSeed = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('seed')) : 0;
    const seed = devSeed > 0 ? devSeed : Math.floor(Math.random() * 2 ** 31);
    return createState(seed);
  }

  private restart(): void {
    this.prev = this.curr = this.newState();
    this.accSec = 0;
    this.playSec = 0;
    this.doorAnim = this.curr.doors.map(() => 0);
    this.plateAnim = this.curr.plates.map(() => 0);
    this.gateAnim = this.curr.gates.map(() => 0);
    this.ghostAlpha = 0;
    this.recordsDone = 0;
    this.routeYou = [];
    this.routeThing = [];
    this.routeSelves = [];
    this.clipsByChamber = CHAMBERS.map(() => 0);
    this.caughtByChamber = CHAMBERS.map(() => 0);
    this.winStage = 0;
    this.guide.reset();
    this.footprints = [];
    this.recordingPath = [];
    this.faceStart();
    this.chamberSec = 0;
    this.seenChamber = 0;
    this.captionLeft = 0;
    this.exitAnim = 0;
    this.blackoutAnim = 0;
    this.houseLights = 0;
    this.winSec = 0;
    this.freezeSec = 0;
    this.scrubSec = 0;
    this.lastPos = { ...this.curr.player.pos };
    this.input.clearLens();
    this.audio.reset();
    this.enterChamber(0);
  }

  /** Look down chamber 1 at the plate and the gate. */
  private faceStart(): void {
    this.input.yawRad = LEVEL.startYawRad;
    this.input.pitchRad = 0;
  }

  /** The chamber's name on the banner and the tape's voice underneath. */
  private enterChamber(n: number): void {
    const c = CHAMBERS[n];
    if (!c) return;
    this.showBanner(c.title, c.sub);
    this.say(c.voice);
  }

  private say(text: string): void {
    if (!text) return;
    this.caption = text;
    this.captionLeft = CAPTION_SEC;
  }

  private showBanner(text: string, sub: string): void {
    this.banner = { text, sub };
    this.bannerLeft = BANNER_SEC;
  }

  private onKey(code: string): void {
    const s = this.settings;
    if (code === 'KeyR' && (!this.input.isLocked || this.curr.won)) {
      this.restart();
      return;
    }
    if (this.input.isLocked) return;
    if (code === 'Minus' || code === 'NumpadSubtract') s.sensitivity = Math.max(SENSITIVITY_MIN, s.sensitivity - SENSITIVITY_STEP);
    else if (code === 'Equal' || code === 'NumpadAdd') s.sensitivity = Math.min(SENSITIVITY_MAX, s.sensitivity + SENSITIVITY_STEP);
    else if (code === 'KeyT') s.lensToggle = !s.lensToggle;
    else if (code === 'KeyG') s.reducedEffects = !s.reducedEffects;
    else if (code === 'KeyV') s.showFps = !s.showFps;
    else if (code === 'KeyB') {
      s.quality = s.quality === 'medium' ? 'low' : 'medium';
      this.renderer.setQuality(s.quality);
    } else return;
    saveSettings(s);
  }

  private frame = (nowMs: number): void => {
    requestAnimationFrame(this.frame);
    const rawDt = Math.max(0, (nowMs - this.lastMs) / 1000);
    const dtSec = Math.min(FEEL.maxFrameSec, rawDt);
    this.lastMs = nowMs;
    this.timeSec += dtSec;
    this.frameDts.push(rawDt);
    if (this.frameDts.length > 40) this.frameDts.shift();
    const playing = this.input.isLocked;
    const won = this.curr.won;

    if (playing && !won) {
      this.playSec += dtSec;
      this.stepSim(dtSec);
    }
    if (won) {
      this.winSec += dtSec;
      this.winCardSounds();
    }
    this.bannerLeft = Math.max(0, this.bannerLeft - (playing ? dtSec : 0));
    this.captionLeft = Math.max(0, this.captionLeft - (playing ? dtSec : 0));
    if (this.curr.chamber !== this.seenChamber) {
      this.seenChamber = this.curr.chamber;
      this.chamberSec = 0;
    } else if (playing && !won) this.chamberSec += dtSec;

    const c = this.curr;
    const alpha = this.accSec / DT_SEC;
    const p0 = this.prev.player;
    const p1 = c.player;
    const teleport = Math.hypot(p1.pos.x - p0.pos.x, p1.pos.y - p0.pos.y) > FEEL.snapDistanceM;
    const a = teleport ? 1 : alpha;
    const px = lerp(p0.pos.x, p1.pos.x, a);
    const py = lerp(p0.pos.y, p1.pos.y, a);
    const tt0 = this.prev.thing.pos;
    const tt1 = c.thing.pos;
    const thingTeleport = Math.hypot(tt1.x - tt0.x, tt1.y - tt0.y) > FEEL.snapDistanceM;
    const ta = thingTeleport ? 1 : alpha;
    const tx = lerp(tt0.x, tt1.x, ta);
    const ty = lerp(tt0.y, tt1.y, ta);
    const lensRaise = lerp(p0.lensRaise, p1.lensRaise, a);

    // Lens feedback on the same frame as the press, not on the next sim tick
    const wantsLens = playing && !won && this.input.lensHeld && !p1.lensLocked && p1.battery > 0;
    if (wantsLens !== this.wasLensHeld) {
      this.audio.servo(wantsLens);
      if (wantsLens) this.audio.recBeep();
      this.wasLensHeld = wantsLens;
    }
    if (wantsLens) this.lensUsedSec += dtSec;
    if (p1.lensLocked) this.input.clearLens();

    this.footsteps(playing && !won, px, py, dtSec);

    // Eye height, bob
    const eyeTarget = p1.crouching ? TUNING.eyeHeightCrouchM : TUNING.eyeHeightStandM;
    this.eyeY = ease(this.eyeY, eyeTarget, FEEL.eyeBlendPerSec, dtSec);
    const moved = Math.hypot(px - this.lastPos.x, py - this.lastPos.y);
    const speedMps = dtSec > 0 ? moved / dtSec : 0;
    this.bobAmp = ease(this.bobAmp, Math.min(1.5, speedMps / TUNING.walkSpeedMps), 8, dtSec);
    this.bobPhase += moved * FEEL.bobCyclesPerM;
    this.lastPos = { x: px, y: py };
    const bob = Math.sin(this.bobPhase * Math.PI * 2) * FEEL.bobAmplitudeM * this.bobAmp * (1 - 0.7 * lensRaise);

    // Doors, exit, lights follow the sim
    this.doorAnim = this.doorAnim.map((d, i) => ease(d, c.doors[i] ? 1 : 0, 7, dtSec));
    this.plateAnim = this.plateAnim.map((d, i) => ease(d, c.plates[i] ? 1 : 0, 20, dtSec));
    this.gateAnim = this.gateAnim.map((d, i) => ease(d, c.gates[i] ? 1 : 0, 6, dtSec));
    this.exitAnim = ease(this.exitAnim, c.exitOpen ? 1 : 0, 3, dtSec);
    this.blackoutAnim = ease(this.blackoutAnim, isBlackout(c) ? 1 : 0, 2.5, dtSec);
    this.houseLights = won ? Math.min(1, this.houseLights + dtSec / 2) : 0;

    // Catch freeze: show the cause, the Thing in your face on tape
    const frozen = this.freezeSec > 0;
    const catchInfo = c.lastCatch;
    let eye = { x: px, y: this.eyeY + bob, z: py };
    let yaw = this.input.yawRad;
    let pitch = this.input.pitchRad;
    const grid = sightGrid(LEVEL, c.doors, c.exitOpen);
    let thingVisible = readLens(grid, p1, c.thing.pos).visible;
    if (frozen && catchInfo) {
      eye = { x: catchInfo.playerPos.x, y: TUNING.eyeHeightStandM, z: catchInfo.playerPos.y };
      const dx = catchInfo.thingPos.x - catchInfo.playerPos.x;
      const dz = catchInfo.thingPos.y - catchInfo.playerPos.y;
      yaw = Math.atan2(-dx, -dz);
      pitch = Math.atan2(TUNING.thingCenterHeightM + 0.4 - TUNING.eyeHeightStandM, Math.hypot(dx, dz));
      thingVisible = true;
    }

    // The tape-self, smoothed between ticks. A fresh clip snaps to its start and fades in.
    const g1 = c.ghost;
    const g0 = this.prev.ghost;
    let ghostFrame: GhostFrame | null = null;
    if (g1) {
      const same = g0 !== null && g0.log === g1.log;
      const ga = same ? alpha : 1;
      const from = same && g0 ? g0.player.pos : g1.player.pos;
      this.ghostAlpha = ease(this.ghostAlpha, 1, 7, dtSec);
      this.ghostCrouch = ease(this.ghostCrouch, g1.player.crouching ? 1 : 0, 14, dtSec);
      ghostFrame = {
        x: lerp(from.x, g1.player.pos.x, ga),
        y: lerp(from.y, g1.player.pos.y, ga),
        yawRad: g1.player.yawRad,
        crouch: this.ghostCrouch,
        // It starts where you stand: fade it while the camera is inside it, so the rewind is not a screen of blue
        alpha:
          this.ghostAlpha *
          Math.max(0, Math.min(1, (Math.hypot(lerp(from.x, g1.player.pos.x, ga) - eye.x, lerp(from.y, g1.player.pos.y, ga) - eye.z) - FEEL.ghostNearFadeStartM) / FEEL.ghostNearFadeM)),
        moving: Math.hypot(g1.player.vel.x, g1.player.vel.y) > TUNING.movingSpeedMps,
      };
    } else {
      this.ghostAlpha = 0;
    }

    const rewind = frozen ? 1 : Math.min(1, Math.max(0, this.scrubSec / FEEL.catchScrubSec));
    const showThing = frozen && catchInfo ? catchInfo.thingPos : { x: tx, y: ty };
    const mode = c.thing.mode;
    const interaction = playing && !won ? findInteraction(LEVEL, c.doors, c.tapes, p1) : null;
    // Playing whenever the sim filled it this tick: you holding E, or your tape-self holding it for you
    const vcrHeld = !c.exitOpen && c.vcrHoldTicks > this.prev.vcrHoldTicks;
    const progress = vcrProgress(c);
    const lensUp = frozen || (lensRaise >= TUNING.lensVisibleRaise && p1.battery > 0);
    const effects = this.settings.reducedEffects ? 0.4 : 1;

    // Behind the title and pause overlay the scene barely shows: redraw it rarely and let the GPU rest
    this.idleRenderSec += dtSec;
    const idle = !playing && !won;
    const draw3d = !idle || this.idleRenderSec >= FEEL.idleRenderIntervalSec;
    if (draw3d) this.idleRenderSec = 0;
    const g = c.ghost;
    if (draw3d) this.renderer.render({
      eye,
      yawRad: yaw,
      pitchRad: pitch,
      lensRaise: frozen ? 1 : lensRaise,
      thing: showThing,
      thingVisible,
      thingMode: frozen ? 'rush' : mode === 'search' ? 'stalk' : mode,
      notice: frozen ? 1 : c.notice,
      rewind,
      timeSec: this.timeSec,
      lensUp,
      doors: this.doorAnim,
      tapesTaken: c.tapes,
      exit: this.exitAnim,
      vcrProgress: progress,
      vcrHeld,
      blackout: this.blackoutAnim,
      houseLights: this.houseLights,
      effects,
      plates: this.plateAnim,
      gates: this.gateAnim,
      ghost: ghostFrame,
      chamber: c.chamber,
      thingNear: c.thing.mode !== 'dormant' && c.thing.mode !== 'shadow' && Math.hypot(c.thing.pos.x - p1.pos.x, c.thing.pos.y - p1.pos.y) < FEEL.thingNearWarnM,
      footprints: c.rec.active ? this.recordingPath : g ? this.footprints : [],
      footprintsDone: c.rec.active ? this.recordingPath.length : g ? Math.round((g.index / Math.max(1, g.log.length)) * this.footprints.length) : 0,
      recording: c.rec.active,
    });

    const line = playing && !won ? this.guide.update({ state: c, prev: this.prev, dtSec, lensUsedSec: this.lensUsedSec, lensToggle: this.settings.lensToggle }) : null;
    const clip = (n: number) => n / TUNING.tickHz;
    const echo: EchoHud = c.rec.active
      ? { mode: 'recording', recSec: clip(c.rec.ticks), maxSec: TUNING.recordMaxSec, playSec: 0, clipSec: 0 }
      : g
        ? {
            mode: g.index < g.log.length ? 'playing' : 'holding',
            recSec: 0,
            maxSec: TUNING.recordMaxSec,
            playSec: clip(g.index),
            clipSec: clip(g.log.length),
          }
        : { mode: 'idle', recSec: 0, maxSec: TUNING.recordMaxSec, playSec: 0, clipSec: 0 };
    const caption: Caption | null =
      this.captionLeft > 0
        ? { text: this.caption, alpha: Math.min(1, this.captionLeft / 0.5, (CAPTION_SEC - this.captionLeft) / 0.25) }
        : null;
    let banner: Banner | null = null;
    if (this.bannerLeft > 0) {
      banner = {
        text: this.banner.text,
        sub: this.banner.sub,
        alpha: Math.min(1, this.bannerLeft / 0.6, (BANNER_SEC - this.bannerLeft) / 0.2),
      };
    }
    let prompt: string | null = null;
    if (interaction?.kind === 'door') prompt = c.doors[interaction.index] ? '[E] CLOSE DOOR' : '[E] OPEN DOOR';
    else if (interaction?.kind === 'vcr' && !c.exitOpen) prompt = 'HOLD [E] PLAY THE TAPES';
    const avg = this.frameDts.reduce((s, d) => s + d, 0) / Math.max(1, this.frameDts.length);

    this.hud.draw({
      playing,
      started: c.tick > 0,
      lensRaise: frozen ? 1 : lensRaise,
      lensLocked: p1.lensLocked,
      battery: p1.battery,
      notice: frozen ? 1 : c.notice,
      tick: c.tick,
      rewind,
      lockProblem: this.lockProblem,
      standingBy: !c.rec.active,
      objective: line?.objective ?? null,
      guide: line?.prompt ?? null,
      echo,
      caption,
      timeSec: this.timeSec,
      caught: frozen || (this.scrubSec > 0 && this.scrubFromCatch),
      tapes: tapesFound(c),
      vcrProgress: progress,
      vcrHeld,
      prompt,
      banner,
      fps: this.settings.showFps && avg > 0 ? 1 / avg : null,
      settings: this.settings,
      win: won
        ? {
            sinceSec: this.winSec,
            caught: c.caughtCount,
            clips: this.clipsByChamber.reduce((a, b) => a + b, 0),
            timeSec: c.winTick / TUNING.tickHz,
            rows: CHAMBERS.map((ch, i): WinRow => ({
              name: ch.sub,
              clips: this.clipsByChamber[i] ?? 0,
              caught: this.caughtByChamber[i] ?? 0,
            })),
            you: this.routeYou,
            tapeSelves: this.routeSelves,
            thing: this.routeThing,
          }
        : null,
    });

    this.audio.vcr(vcrHeld, progress);
    this.audio.update(
      {
        listener: { x: eye.x, y: eye.y, z: eye.z },
        yawRad: yaw,
        pitchRad: pitch,
        thing: { x: tx, y: TUNING.thingCenterHeightM, z: ty },
        thingDistM: Math.hypot(tx - px, ty - py),
        thingMode: mode,
        notice: c.notice,
        lensRaise,
      },
      dtSec,
    );
  };

  /** A tick as each part of the win card lands; the Thing's path lands with the tape-stop. */
  private winCardSounds(): void {
    const T = WIN_CARD_SEC;
    const stages = [T.you, T.tapeSelves, T.thing, ...CHAMBERS.map((_, i) => T.rows + i * T.rowStep), T.totals];
    while (this.winStage < stages.length && this.winSec >= (stages[this.winStage] ?? Infinity)) {
      if (stages[this.winStage] === T.thing) this.audio.rewind();
      else if (stages[this.winStage] === T.totals) this.audio.tapePickup(CHAMBERS.length);
      else this.audio.recBeep();
      this.winStage += 1;
    }
  }

  /** Samples the night four times a second for the win card's map. */
  private recordNight(after: SimState): void {
    if (after.tick % FEEL.nightSampleTicks !== 0) return;
    const add = (route: Array<Array<{ x: number; y: number }>>, p: { x: number; y: number }, fresh = false) => {
      const seg = route[route.length - 1];
      const last = seg?.[seg.length - 1];
      if (!seg || !last || fresh || Math.hypot(p.x - last.x, p.y - last.y) > FEEL.snapDistanceM) route.push([{ ...p }]);
      else seg.push({ ...p });
    };
    add(this.routeYou, after.player.pos);
    if (after.thing.mode !== 'dormant') add(this.routeThing, after.thing.pos);
    if (after.ghost) add(this.routeSelves, after.ghost.player.pos, after.ghost.index < FEEL.nightSampleTicks);
  }

  private stepSim(dtSec: number): void {
    if (this.freezeSec > 0) {
      this.freezeSec -= dtSec;
      if (this.freezeSec <= 0) {
        this.scrubSec = FEEL.catchScrubSec;
        this.scrubFromCatch = true;
      }
      return;
    }
    this.scrubSec = Math.max(0, this.scrubSec - dtSec);
    this.accSec += dtSec;
    let n = 0;
    while (this.accSec >= DT_SEC && n < FEEL.maxStepsPerFrame) {
      this.prev = this.curr;
      this.curr = step(this.curr, this.input.sample());
      this.accSec -= DT_SEC;
      n++;
      this.onTick(this.prev, this.curr);
      if (this.freezeSec > 0 || this.curr.won) {
        this.accSec = 0;
        break;
      }
    }
    if (n === FEEL.maxStepsPerFrame) this.accSec = 0;
  }

  private onTick(before: SimState, after: SimState): void {
    if (after.thing.mode === 'rush' && before.thing.mode !== 'rush') {
      this.audio.rushStart();
      this.renderer.addTrauma(FEEL.rushTrauma);
      this.renderer.flash(0.25);
    }
    this.recordNight(after);
    if (after.caughtCount > before.caughtCount) {
      this.caughtByChamber[after.chamber] = (this.caughtByChamber[after.chamber] ?? 0) + 1;
      this.audio.rewind();
      this.renderer.addTrauma(FEEL.catchTrauma);
      this.renderer.flash(0.9);
      this.freezeSec = FEEL.catchFreezeSec;
      this.say(
        after.caughtCount === 1
          ? 'BE KIND. REWIND.'
          : after.caughtCount % 5 === 0
            ? `YOU HAVE REWOUND ${after.caughtCount} TIMES. THE TAPE IS GETTING THIN.`
            : 'BE KIND. REWIND.',
      );
    }
    if (after.chamberRestarts > before.chamberRestarts) {
      // Starting the room over: the same tape-stop and scrub as a rewind, without the caught caption
      this.audio.rewind();
      this.renderer.flash(0.5);
      this.scrubSec = FEEL.echoScrubSec;
      this.scrubFromCatch = false;
      this.footprints = [];
      this.recordingPath = [];
    }
    this.onEchoTick(before, after);
    if (after.player.lensLocked && !before.player.lensLocked) this.audio.lowBattery();

    const found = tapesFound(after);
    if (found > tapesFound(before)) {
      this.audio.tapePickup(after.chamber);
      this.renderer.flash(0.5);
      this.showBanner(`TAPE ${found} OF 3`, found === 3 ? 'BRING THEM TO THE COUNTER' : '');
    }
    if (after.chamber > before.chamber) {
      const n = after.chamber;
      const c = CHAMBERS[n];
      if (c) this.say(c.voice);
      // A tape at the entry gets the tape banner and chime; a chamber without one gets its own name and the same
      // chime, one step higher than the last, so clearing rooms climbs the scale.
      if (found === tapesFound(before)) {
        this.showBanner(c?.title ?? '', c?.sub ?? '');
        this.audio.tapePickup(n);
        this.renderer.flash(0.3);
      }
    }

    // Doors: ours make a creak, its are a bang
    const playerUsed = after.player.interactHeld && !before.player.interactHeld;
    after.doors.forEach((open, i) => {
      if (open === before.doors[i]) return;
      const d = LEVEL.doors[i];
      if (!d) return;
      const at = { x: d.cx + 0.5, y: 1.1, z: d.cy + 0.5 };
      const thingDid = open && Math.hypot(after.thing.pos.x - at.x, after.thing.pos.y - at.z) < 1.8 && !playerUsed;
      if (thingDid) this.audio.doorBang(at);
      this.audio.doorToggle(open, at);
    });
    if (after.thing.doorTicks > 0 && after.thing.doorTicks % 30 === 1) {
      const near = LEVEL.doors.find((d) => Math.hypot(d.cx + 0.5 - after.thing.pos.x, d.cy + 0.5 - after.thing.pos.y) < 1.8);
      if (near) this.audio.doorBang({ x: near.cx + 0.5, y: 1.1, z: near.cy + 0.5 });
    }

    if (isBlackout(after) !== isBlackout(before)) {
      this.audio.blackout(isBlackout(after));
      if (isBlackout(after)) {
        this.renderer.flash(0.4);
        this.renderer.addTrauma(0.3);
      }
    }
    if (after.exitOpen && !before.exitOpen) {
      this.audio.exitOpen();
      this.renderer.flash(0.6);
      this.showBanner('THE DOOR IS OPEN', '');
    }
    if (after.won && !before.won) {
      this.audio.win();
      this.winSec = 0;
      this.bannerLeft = 0;
    }
  }

  /** Everything the tape adds: recording, rewinding, your echo's steps, plates and gates. */
  private onEchoTick(before: SimState, after: SimState): void {
    if (after.rec.active) {
      const p = after.player.pos;
      const last = this.recordingPath[this.recordingPath.length - 1];
      if (!before.rec.active) this.recordingPath = [{ ...p }];
      else if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= FEEL.footprintSpacingM) this.recordingPath.push({ ...p });
    }
    if (!before.rec.active && after.rec.active) {
      this.audio.recBeep();
      this.renderer.flash(0.15);
    }
    if (before.rec.active && !after.rec.active) {
      if (after.ghost && after.ghost !== before.ghost) {
        // Committed: rewind to where the clip began, then the tape-self starts playing
        this.recordsDone += 1;
        this.clipsByChamber[after.chamber] = (this.clipsByChamber[after.chamber] ?? 0) + 1;
        this.footprints = this.recordingPath;
        this.recordingPath = [];
        this.audio.rewind();
        this.audio.recBeep();
        setTimeout(() => this.audio.servo(true), 280);
        this.renderer.flash(0.45);
        this.renderer.addTrauma(0.12);
        this.scrubSec = FEEL.echoScrubSec;
        this.scrubFromCatch = false;
        this.ghostStepAccM = 0;
      } else {
        this.audio.recBeep();
        this.recordingPath = [];
      }
    }

    // It got to your tape-self: the tape is torn
    const eaten = before.ghost !== null && after.ghost === null && after.chamber === before.chamber && after.caughtCount === before.caughtCount;
    if (eaten) {
      this.audio.rewind();
      this.renderer.flash(0.35);
      this.renderer.addTrauma(0.2);
      this.say('IT ATE YOUR TAPE. RECORD ANOTHER.');
    }

    // Your echo's steps: heard where it is, so a sprinting tape can pull the Thing
    const g1 = after.ghost;
    const g0 = before.ghost;
    if (g1 && g0 && g0.log === g1.log && g1.index > 0) {
      const moved = Math.hypot(g1.player.pos.x - g0.player.pos.x, g1.player.pos.y - g0.player.pos.y);
      const kind = g1.player.crouching ? 'crouch' : g1.player.sprinting ? 'sprint' : 'walk';
      const stride =
        kind === 'crouch' ? FEEL.stepStrideCrouchM : kind === 'sprint' ? FEEL.stepStrideSprintM : FEEL.stepStrideWalkM;
      this.ghostStepAccM += moved;
      if (this.ghostStepAccM >= stride) {
        this.ghostStepAccM -= stride;
        this.audio.footstep(kind, { x: g1.player.pos.x, y: 0.1, z: g1.player.pos.y });
      }
    }

    after.plates.forEach((down, i) => {
      if (down === before.plates[i]) return;
      const p = LEVEL.plates[i];
      if (p) this.audio.plate(down, { x: p.cell.cx + 0.5, y: 0.1, z: p.cell.cy + 0.5 });
    });
    after.gates.forEach((open, i) => {
      if (open === before.gates[i]) return;
      const g = LEVEL.gates[i];
      if (!g) return;
      this.audio.gate(open, { x: g.cell.cx + 0.5, y: 1.1, z: g.cell.cy + 0.5 });
      if (open && this.recordsDone === 1 && after.chamber === 0) this.say('SEE? TEAMWORK.');
      if (!open) this.renderer.addTrauma(0.05);
    });
  }

  private footsteps(active: boolean, px: number, py: number, dtSec: number): void {
    const moved = Math.hypot(px - this.lastPos.x, py - this.lastPos.y);
    if (!active || dtSec <= 0 || moved > FEEL.snapDistanceM) {
      this.stepAccM = 0;
      return;
    }
    const p = this.curr.player;
    const kind = p.crouching ? 'crouch' : p.sprinting ? 'sprint' : 'walk';
    const stride =
      kind === 'crouch' ? FEEL.stepStrideCrouchM : kind === 'sprint' ? FEEL.stepStrideSprintM : FEEL.stepStrideWalkM;
    this.stepAccM += moved;
    if (this.stepAccM >= stride) {
      this.stepAccM -= stride;
      this.audio.footstep(kind);
    }
  }
}
