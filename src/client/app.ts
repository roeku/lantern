/**
 * Client screen state machine: start -> playing -> ended (and error).
 * Wires the session, the Three.js scene, input mapping, HUD and end screen together.
 *
 * Seam for the net client: `createSession` turns a SessionTarget into a GameSession.
 * The default factory only knows solo play; task 9.2 swaps in one that also builds NetSession.
 * A factory that returns null makes the app show the "server unreachable" screen.
 */
import { ROOM_CODE_PATTERN } from '../net/protocol';
import { MAX_CATCH_UP_TICKS, createFixedStepClock, type FixedStepClock } from '../net/fixed-step';
import { TUNING, viewFor, type Outcome, type Recap, type ReplayFrame, type State, type View } from '../sim';
import { emptyControls } from './input/controls';
import { KeyboardMouse } from './input/keyboard-mouse';
import { mapInputs } from './input/input-mapper';
import { LanternScene } from './render/scene';
import { NetSession, fetchNewRoomCode } from './session/net-session';
import { SoloSession } from './session/solo-session';
import type { GameSession, Phase, Role, Roster, SessionEvent } from './session/session';
import { createEndScreen, type EndScreen } from './ui/end-screen';
import { createErrorScreen, type ErrorScreen, type ScreenError } from './ui/error-screens';
import { createHud, type Hud } from './ui/hud';
import { createLobby, createReconnectBanner, type Lobby, type ReconnectBanner } from './ui/lobby';
import { createStartScreen, type StartScreen } from './ui/start-screen';

export type SessionTarget = { kind: 'solo' } | { kind: 'create' } | { kind: 'join'; code: string };
export type SessionFactory = (target: SessionTarget) => GameSession | null;

/**
 * Solo -> SoloSession, join -> NetSession. 'create' is resolved by the app first
 * (fetch a code, navigate to /r/<code>, then join), so the factory never sees it.
 */
export const defaultSessionFactory: SessionFactory = (target) => {
  if (target.kind === 'solo') return new SoloSession();
  if (target.kind === 'join') return new NetSession(target.code);
  return null;
};

export interface AppOptions {
  createSession?: SessionFactory;
  /** Ask the server for a fresh Room_Code. Defaults to GET /new. */
  fetchNewRoomCode?: () => Promise<string>;
  /** Change the page path without reloading. Defaults to history.pushState. */
  navigate?: (path: string) => void;
}

type Screen = 'start' | 'lobby' | 'playing' | 'ended' | 'error';

const ROOM_PATH = /^\/r\//;

export class App {
  private readonly createSession: SessionFactory;
  private readonly fetchCode: () => Promise<string>;
  private readonly navigate: (path: string) => void;
  private lobby: Lobby | null = null;
  private banner: ReconnectBanner | null = null;
  private reconnectLeft: number | null = null;
  private roster: Roster | null = null;
  private beginToken = 0;
  private readonly canvas: HTMLCanvasElement;
  private scene: LanternScene | null = null;
  private screen: Screen = 'start';
  private startScreen: StartScreen | null = null;
  private errorScreen: ErrorScreen | null = null;
  private endScreen: EndScreen | null = null;
  private hud: Hud | null = null;
  private keyboard: KeyboardMouse | null = null;
  private session: GameSession | null = null;
  private unsubscribe: (() => void) | null = null;

  private player = 0;
  private role: Role = 'showman';
  private code = '';
  private phase: Phase = 'lobby';
  private state: State | null = null;
  private view: View | null = null;
  private log: { frames: ReplayFrame[]; recap: Recap } | null = null;

  private rafHandle: number | null = null;
  private inputClock: FixedStepClock | null = null;
  private readonly onResize = (): void => this.resize();

  constructor(
    private readonly root: HTMLElement,
    opts: AppOptions = {},
  ) {
    this.createSession = opts.createSession ?? defaultSessionFactory;
    this.fetchCode = opts.fetchNewRoomCode ?? (() => fetchNewRoomCode());
    this.navigate =
      opts.navigate ??
      ((path) => {
        if (location.pathname !== path) history.pushState(null, '', path);
      });
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    this.canvas.hidden = true;
    root.appendChild(this.canvas);
    window.addEventListener('resize', this.onResize);
  }

  /** Begin at the start screen, or go straight into a session (e.g. from a /r/CODE link). */
  run(initial: SessionTarget | null = null): void {
    if (initial === null) this.showStart();
    else this.begin(initial);
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.beginToken++;
    this.teardownSession();
    this.clearScreens();
    this.banner?.destroy();
    this.banner = null;
    this.scene?.dispose();
    this.scene = null;
    this.canvas.remove();
  }

  // Screens

  private clearScreens(): void {
    this.startScreen?.destroy();
    this.errorScreen?.destroy();
    this.endScreen?.destroy();
    this.lobby?.destroy();
    this.startScreen = this.errorScreen = this.endScreen = this.lobby = null;
    this.stopPlaying();
  }

  private showStart(): void {
    this.beginToken++;
    this.teardownSession();
    this.clearScreens();
    if (ROOM_PATH.test(location.pathname)) this.navigate('/');
    this.screen = 'start';
    this.startScreen = createStartScreen(this.root, {
      onSolo: () => this.begin({ kind: 'solo' }),
      onCreate: () => this.begin({ kind: 'create' }),
      onJoin: (code) => this.begin({ kind: 'join', code }),
    });
  }

  private showError(error: ScreenError): void {
    this.beginToken++;
    this.teardownSession();
    this.clearScreens();
    this.screen = 'error';
    this.errorScreen = createErrorScreen(this.root, error, {
      onNewRoom: () => this.begin({ kind: 'create' }),
      onBack: () => this.showStart(),
      onSolo: () => this.begin({ kind: 'solo' }),
    });
  }

  private showEnd(outcome: Outcome, frames: ReplayFrame[], recap: Recap): void {
    this.clearScreens();
    this.screen = 'ended';
    this.endScreen = createEndScreen(this.root, {
      outcome,
      frames,
      recap,
      onPlayAgain: () => this.session?.rematch(),
    });
    this.applyRematchState();
  }

  private applyRematchState(): void {
    if (this.endScreen === null) return;
    const pending = this.roster?.rematchPending === true;
    this.endScreen.setPlayAgain(pending ? 'Waiting for the others' : 'Play again', pending);
  }

  private showLobby(): void {
    this.clearScreens();
    this.screen = 'lobby';
    this.log = null;
    this.lobby = createLobby(this.root, {
      onStart: () => this.session?.start(),
      onLeave: () => this.showStart(),
    });
    if (this.phase === 'ended') this.lobby.setNote('The last round has ended. Waiting in the green room.');
    else this.lobby.setNote('Share the link. Empty seats are filled by bots when the show starts.');
    this.refreshLobby();
  }

  private refreshLobby(): void {
    if (this.lobby !== null && this.roster !== null) {
      this.lobby.update(this.roster, { player: this.player, code: this.code });
    }
  }

  /** Move to the screen that matches the Phase. A Round that just ended waits for its log. */
  private applyPhase(): void {
    switch (this.phase) {
      case 'playing':
        if (this.screen !== 'playing') this.enterPlaying();
        break;
      case 'lobby':
        if (this.screen !== 'lobby') this.showLobby();
        else this.refreshLobby();
        break;
      case 'ended':
        if (this.screen === 'ended') this.applyRematchState();
        else if (this.screen !== 'playing' && this.log === null) this.showLobby();
        break;
    }
    this.applyReconnect();
  }

  private applyReconnect(): void {
    if (this.screen === 'playing') {
      this.hud?.setReconnecting(this.reconnectLeft);
      this.banner?.set(null);
    } else if (this.reconnectLeft !== null) {
      this.banner ??= createReconnectBanner(this.root);
      this.banner.set(this.reconnectLeft);
    } else {
      this.banner?.set(null);
    }
  }

  // Session

  private begin(target: SessionTarget): void {
    const token = ++this.beginToken;
    this.teardownSession();
    this.clearScreens();
    this.state = this.view = this.log = this.roster = null;
    this.phase = 'lobby';
    this.reconnectLeft = null;
    this.banner?.set(null);
    if (target.kind === 'create') {
      this.screen = 'start';
      this.fetchCode().then(
        (code) => {
          if (token === this.beginToken) this.begin({ kind: 'join', code });
        },
        () => {
          if (token === this.beginToken) this.showError('unreachable');
        },
      );
      return;
    }
    if (target.kind === 'join' && !ROOM_CODE_PATTERN.test(target.code)) {
      this.showError('bad_code');
      return;
    }
    if (target.kind === 'join') this.navigate(`/r/${target.code}`);
    else if (ROOM_PATH.test(location.pathname)) this.navigate('/');
    const session = this.createSession(target);
    if (session === null) {
      this.showError('unreachable');
      return;
    }
    this.session = session;
    this.unsubscribe = session.subscribe((e) => this.onEvent(e));
  }

  private teardownSession(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.session?.dispose();
    this.session = null;
  }

  private onEvent(e: SessionEvent): void {
    switch (e.kind) {
      case 'hello':
        this.player = e.player;
        this.role = e.role;
        this.code = e.code;
        this.phase = e.phase;
        this.applyPhase();
        break;
      case 'roster':
        this.roster = e.roster;
        this.phase = e.roster.phase;
        this.role = e.roster.showman === this.player ? 'showman' : 'spectator';
        this.applyPhase();
        break;
      case 'state':
        this.state = e.state;
        this.view = viewFor(e.state, this.player);
        if (this.screen === 'playing') {
          this.scene?.setView(this.view, e.receivedAtMs, this.player);
          this.hud?.update(this.view, { role: this.role, roomCode: this.code, playerId: this.player }, e.receivedAtMs);
        }
        break;
      case 'log':
        this.log = { frames: e.frames, recap: e.recap };
        this.leaveRound();
        break;
      case 'connection':
        if (e.status === 'closed') {
          this.showError('unreachable');
          break;
        }
        this.reconnectLeft = e.status === 'reconnecting' ? e.graceSecondsLeft : null;
        this.applyReconnect();
        break;
      case 'error':
        this.showError(e.error);
        break;
    }
  }

  /** The Round is over: show the end screen using the final outcome and the recap. */
  private leaveRound(): void {
    if (this.log === null) return;
    const outcome = this.log.frames[this.log.frames.length - 1]?.outcome ?? this.state?.outcome ?? null;
    if (outcome === null) return;
    this.showEnd(outcome, this.log.frames, this.log.recap);
  }

  // Playing

  private enterPlaying(): void {
    this.clearScreens();
    this.screen = 'playing';
    this.scene ??= new LanternScene(this.canvas, TUNING);
    this.canvas.hidden = false;
    this.resize();
    this.hud = createHud(this.root);
    this.applyReconnect();
    const keyboard = new KeyboardMouse((cx, cy) => this.projectToFloor(cx, cy));
    keyboard.attach(window, this.canvas);
    this.keyboard = keyboard;
    if (this.view !== null) this.scene.setView(this.view, performance.now(), this.player);
    this.inputClock = createFixedStepClock(performance.now(), TUNING.tickS * 1000, MAX_CATCH_UP_TICKS);
    this.loop();
  }

  private stopPlaying(): void {
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.rafHandle = null;
    this.keyboard?.dispose();
    this.keyboard = null;
    this.hud?.destroy();
    this.hud = null;
    this.inputClock = null;
    this.canvas.hidden = true;
  }

  private projectToFloor(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    if (this.scene === null || rect.width === 0 || rect.height === 0) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    return this.scene.screenToFloor(ndcX, ndcY);
  }

  private resize(): void {
    if (this.scene === null) return;
    this.scene.resize(this.canvas.clientWidth || window.innerWidth, this.canvas.clientHeight || window.innerHeight);
    this.keyboard?.refreshFloor();
  }

  private loop(): void {
    this.rafHandle = requestAnimationFrame((nowMs) => {
      this.rafHandle = null;
      if (this.screen !== 'playing') return;
      this.sendInputs(nowMs);
      this.scene?.render(nowMs);
      this.loop();
    });
  }

  /** Map controls to inputs once per due Tick; edge presses count for the first Tick only. */
  private sendInputs(nowMs: number): void {
    const view = this.view;
    if (this.phase !== 'playing') return;
    if (this.inputClock === null || this.keyboard === null || this.session === null || view === null) return;
    const due = this.inputClock.advance(nowMs);
    if (due === 0) return;
    const controls = this.keyboard.snapshot();
    const self = this.role === 'spectator' ? (view.spectators.find((s) => s.player === this.player) ?? null) : null;
    const ctx = {
      role: this.role,
      phase: this.phase,
      view,
      self,
      cartOrigin: { x: TUNING.cartOriginXM, y: TUNING.cartTrackStartYM + view.cart.travel },
    };
    for (let i = 0; i < due; i++) {
      const c = i === 0 ? controls : { ...emptyControls(), held: controls.held, mouseFloor: controls.mouseFloor };
      for (const input of mapInputs(c, ctx, TUNING)) this.session.sendInput(input);
    }
  }
}
