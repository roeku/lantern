import { TUNING } from '../../sim';
import { FEEL } from '../feel';
import type { SimInput } from '../../sim';
import type { Settings } from '../settings';

/**
 * Pointer lock, keyboard and mouse. Produces SimInput; never touches game state.
 * Look is accumulated at render rate and sampled once per sim tick.
 */
export class Input {
  yawRad = 0;
  pitchRad = 0;
  private keys = new Set<string>();
  private lensDown = false;
  private lensToggled = false;
  /** A record press that no sim tick has seen yet, so a quick tap between ticks is never lost. */
  private recordPending = false;
  private restartPending = false;
  private locked = false;
  private lockCallbacks: Array<(locked: boolean) => void> = [];
  private errorCallbacks: Array<() => void> = [];
  private keyCallbacks: Array<(code: string) => void> = [];

  constructor(
    private readonly target: HTMLElement,
    private readonly settings: Settings,
  ) {
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('pointerlockerror', this.onLockError);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', this.releaseAll);
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /** True while the lens should be up. */
  get lensHeld(): boolean {
    if (!this.locked) return false;
    return this.settings.lensToggle ? this.lensToggled : this.lensDown;
  }

  /** Forget a toggled lens, e.g. when the battery dies. */
  clearLens(): void {
    this.lensToggled = false;
  }

  get interactHeld(): boolean {
    return this.locked && this.keys.has('KeyE');
  }

  onLock(cb: (locked: boolean) => void): void {
    this.lockCallbacks.push(cb);
  }

  /** Fires for every key press (not repeats) while the pointer is NOT locked, for menus. Also fires for restart keys while locked. */
  onKey(cb: (code: string) => void): void {
    this.keyCallbacks.push(cb);
  }

  sample(): SimInput {
    const k = this.keys;
    const moveZ = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const moveX = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    return {
      moveX,
      moveZ,
      yawRad: this.yawRad,
      pitchRad: this.pitchRad,
      lensHeld: this.lensHeld,
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      crouch: k.has('KeyC') || k.has('ControlLeft'),
      interact: this.interactHeld,
      record: this.takeRecord(),
      restart: this.takeRestart(),
    };
  }

  /** True for the tick after a press. A held key does not repeat: the sim reads edges. */
  private takeRecord(): boolean {
    const pressed = this.recordPending || (this.locked && this.keys.has('KeyF'));
    this.recordPending = false;
    return pressed;
  }

  /** R during play starts the chamber over. On the pause screen R restarts the whole night instead (see Game). */
  private takeRestart(): boolean {
    const pressed = this.restartPending || (this.locked && this.keys.has('KeyR'));
    this.restartPending = false;
    return pressed;
  }

  private releaseAll = (): void => {
    this.keys.clear();
    this.lensDown = false;
    this.recordPending = false;
    this.restartPending = false;
  };

  private onLockChange = (): void => {
    const now = document.pointerLockElement === this.target;
    // Entering or leaving the lock clears held buttons, so the click that locked the pointer does nothing else.
    this.releaseAll();
    this.lensToggled = false;
    this.locked = now;
    for (const cb of this.lockCallbacks) cb(now);
  };

  private onLockError = (): void => {
    for (const cb of this.errorCallbacks) cb();
  };

  /** The browser refused to lock the pointer: an iframe without allow="pointer-lock", a blocked permission, or a click too soon after Esc. */
  onLockFailed(cb: () => void): void {
    this.errorCallbacks.push(cb);
  }

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked) return;
    const lensFactor = this.lensHeld ? FEEL.lensMouseFactor : 1;
    const k = FEEL.mouseSensitivityRadPerPx * this.settings.sensitivity * lensFactor;
    this.yawRad -= e.movementX * k;
    this.pitchRad -= e.movementY * k;
    this.pitchRad = Math.max(-TUNING.maxPitchRad, Math.min(TUNING.maxPitchRad, this.pitchRad));
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.locked) {
      if (e.button === 0) void this.requestLock();
      return;
    }
    if (e.button === 2) this.pressLens();
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 2) this.lensDown = false;
  };

  private pressLens(): void {
    this.lensDown = true;
    this.lensToggled = !this.lensToggled;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat) return;
    if (this.locked) e.preventDefault();
    this.keys.add(e.code);
    if (e.code === 'KeyQ' && this.locked) this.pressLens();
    if (e.code === 'KeyF' && this.locked) this.recordPending = true;
    if (e.code === 'KeyR' && this.locked) this.restartPending = true;
    for (const cb of this.keyCallbacks) cb(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    if (e.code === 'KeyQ') this.lensDown = false;
  };

  private async requestLock(): Promise<void> {
    try {
      await this.target.requestPointerLock();
    } catch {
      // The browser refuses a new lock for a moment after Esc. Say so, so the click does not seem to do nothing.
      this.onLockError();
    }
  }
}
