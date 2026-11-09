/**
 * Control bindings. The one table that both the input mapper and the HUD read.
 * Codes follow KeyboardEvent.code, plus 'Shift' (either shift key) and 'Mouse0' (left button).
 */

export type BindingRole = 'showman' | 'spectator';

export type BindingAction =
  | 'rollForward'
  | 'rollBack'
  | 'rush'
  | 'vent1'
  | 'vent2'
  | 'vent3'
  | 'aim'
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'shield'
  | 'fan'
  | 'cut';

export interface Binding {
  role: BindingRole;
  action: BindingAction;
  /** Input code that triggers the action. Empty for pointer-position controls. */
  code: string;
  /** Short key name for the HUD. */
  label: string;
  /** What it does, for the HUD. */
  description: string;
}

export const BINDINGS: readonly Binding[] = [
  { role: 'showman', action: 'rollForward', code: 'KeyW', label: 'W', description: 'Roll cart forward' },
  { role: 'showman', action: 'rollBack', code: 'KeyS', label: 'S', description: 'Roll cart back' },
  { role: 'showman', action: 'rush', code: 'Shift', label: 'Shift', description: 'Rush (with W or S)' },
  { role: 'showman', action: 'vent1', code: 'Digit1', label: '1', description: 'Puff Vent 1' },
  { role: 'showman', action: 'vent2', code: 'Digit2', label: '2', description: 'Puff Vent 2' },
  { role: 'showman', action: 'vent3', code: 'Digit3', label: '3', description: 'Puff Vent 3' },
  { role: 'showman', action: 'aim', code: '', label: 'Mouse', description: 'Aim beam' },
  { role: 'spectator', action: 'moveUp', code: 'KeyW', label: 'W', description: 'Move up' },
  { role: 'spectator', action: 'moveLeft', code: 'KeyA', label: 'A', description: 'Move left' },
  { role: 'spectator', action: 'moveDown', code: 'KeyS', label: 'S', description: 'Move down' },
  { role: 'spectator', action: 'moveRight', code: 'KeyD', label: 'D', description: 'Move right' },
  { role: 'spectator', action: 'shield', code: 'Space', label: 'Space', description: 'Shield / unshield candle' },
  { role: 'spectator', action: 'fan', code: 'Mouse0', label: 'Left click', description: 'Fan smoke' },
  { role: 'spectator', action: 'cut', code: 'KeyE', label: 'E (hold)', description: 'Cut rope' },
];

/** Input code bound to an action. Throws if the table has no such action (a programming error). */
export function codeFor(role: BindingRole, action: BindingAction): string {
  const found = BINDINGS.find((b) => b.role === role && b.action === action);
  if (found === undefined) throw new Error(`No binding for ${role}/${action}`);
  return found.code;
}

/** Bindings the HUD shows for a role. */
export function bindingsFor(role: BindingRole): readonly Binding[] {
  return BINDINGS.filter((b) => b.role === role);
}

/** Vent action to the vent index the sim expects (0-based, matching TUNING.ventPositions). */
export const VENT_ACTIONS: readonly BindingAction[] = ['vent1', 'vent2', 'vent3'];
