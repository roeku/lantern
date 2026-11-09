/**
 * Fills ControlState from DOM events and tracks edge presses.
 * Call `snapshot()` once per Tick: it returns the held codes, the edge presses since the
 * previous snapshot, and the floor point under the mouse, then clears the edge list.
 */

import type { ControlState } from './controls';

export type FloorProjector = (clientX: number, clientY: number) => { x: number; y: number } | null;

const SHIFT_CODES: readonly string[] = ['ShiftLeft', 'ShiftRight'];
const MOUSE_PREFIX = 'Mouse';
/** Keys whose browser default (page scroll) would fight the game. */
const PREVENT_DEFAULT_CODES: readonly string[] = ['Space'];

function normaliseKey(code: string): string {
  return SHIFT_CODES.includes(code) ? 'Shift' : code;
}

export class KeyboardMouse {
  private readonly held = new Set<string>();
  private pressed: string[] = [];
  private mouseFloor: { x: number; y: number } | null = null;
  private lastClient: { x: number; y: number } | null = null;
  private detach: (() => void) | null = null;

  constructor(private readonly projectToFloor: FloorProjector) {}

  /** Start listening. `target` receives key events, `surface` receives pointer events. */
  attach(target: Window | HTMLElement, surface: HTMLElement): void {
    this.dispose();

    const press = (code: string): void => {
      if (!this.held.has(code)) this.pressed.push(code);
      this.held.add(code);
    };
    const release = (code: string): void => {
      this.held.delete(code);
    };

    const onKeyDown = (e: Event): void => {
      const ev = e as KeyboardEvent;
      if (PREVENT_DEFAULT_CODES.includes(ev.code)) ev.preventDefault();
      if (ev.repeat) return;
      press(normaliseKey(ev.code));
    };
    const onKeyUp = (e: Event): void => release(normaliseKey((e as KeyboardEvent).code));
    const onMouseDown = (e: Event): void => {
      const ev = e as MouseEvent;
      this.updatePointer(ev.clientX, ev.clientY);
      press(`${MOUSE_PREFIX}${ev.button}`);
    };
    const onMouseUp = (e: Event): void => release(`${MOUSE_PREFIX}${(e as MouseEvent).button}`);
    const onMouseMove = (e: Event): void => {
      const ev = e as MouseEvent;
      this.updatePointer(ev.clientX, ev.clientY);
    };
    const onBlur = (): void => {
      this.held.clear();
    };

    target.addEventListener('keydown', onKeyDown);
    target.addEventListener('keyup', onKeyUp);
    surface.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    surface.addEventListener('mousemove', onMouseMove);
    window.addEventListener('blur', onBlur);

    this.detach = () => {
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      surface.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      surface.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('blur', onBlur);
    };
  }

  /** Re-project the last pointer position, for when the camera moved but the mouse did not. */
  refreshFloor(): void {
    if (this.lastClient !== null) this.updatePointer(this.lastClient.x, this.lastClient.y);
  }

  /** Current controls. Clears the edge presses so each press is reported once. */
  snapshot(): ControlState {
    const state: ControlState = {
      held: new Set(this.held),
      pressed: this.pressed,
      mouseFloor: this.mouseFloor === null ? null : { ...this.mouseFloor },
    };
    this.pressed = [];
    return state;
  }

  dispose(): void {
    this.detach?.();
    this.detach = null;
    this.held.clear();
    this.pressed = [];
  }

  private updatePointer(clientX: number, clientY: number): void {
    this.lastClient = { x: clientX, y: clientY };
    this.mouseFloor = this.projectToFloor(clientX, clientY);
  }
}
