export interface Settings {
  /** Mouse and trackpad look speed multiplier. */
  sensitivity: number;
  /** Lens button toggles instead of holds. Easier on a trackpad. */
  lensToggle: boolean;
  /** Less shake, grain, tear and flash. */
  reducedEffects: boolean;
  showFps: boolean;
  /** Medium: pixel ratio up to 1.5 and 2x anti-aliasing. Low: pixel ratio 1, no anti-aliasing. */
  quality: 'low' | 'medium';
}

export const SENSITIVITY_MIN = 0.25;
export const SENSITIVITY_MAX = 3;
export const SENSITIVITY_STEP = 0.25;

const KEY = 'rewind-night-settings';

const DEFAULTS: Settings = {
  sensitivity: 1,
  lensToggle: false,
  reducedEffects: false,
  showFps: false,
  quality: 'medium',
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Settings>;
    return {
      sensitivity: Math.min(SENSITIVITY_MAX, Math.max(SENSITIVITY_MIN, Number(p.sensitivity ?? 1) || 1)),
      lensToggle: p.lensToggle === true,
      reducedEffects: p.reducedEffects === true,
      showFps: p.showFps === true,
      quality: p.quality === 'low' ? 'low' : 'medium',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or storage full: settings last for this session only.
  }
}
