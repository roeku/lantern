/** Client-only presentation numbers. The sim never imports this. Names carry the unit. */
export const FEEL = {
  // Loop
  maxFrameSec: 0.1,
  maxStepsPerFrame: 6,
  /** A one-tick jump bigger than this is a teleport (rewind), so do not interpolate across it. */
  snapDistanceM: 3,

  // Look
  mouseSensitivityRadPerPx: 0.0022,
  /** Lens up slows the mouse so aiming the focus box is precise. */
  lensMouseFactor: 0.7,

  // Camera
  bobAmplitudeM: 0.03,
  bobCyclesPerM: 0.55,
  eyeBlendPerSec: 10,
  shakeTraumaDecayPerSec: 1.2,
  shakeMaxYawRad: 0.05,
  shakeMaxPitchRad: 0.05,
  shakeMaxRollRad: 0.06,
  rushTrauma: 0.7,
  catchTrauma: 0.95,

  // Catch presentation (the freeze frame shows the cause, then the tape scrubs back)
  catchFreezeSec: 0.3,
  catchScrubSec: 0.2,
  /** The short scrub when you stop recording and rewind to the start of the clip. */
  echoScrubSec: 0.6,
  /** Footprints of a clip are dropped this far apart. */
  footprintSpacingM: 0.45,
  /** The night map on the win card samples every this many ticks (4 per second). */
  nightSampleTicks: 15,
  /** The tape-self is invisible closer than this to the camera, and fully shown this much further out. */
  ghostNearFadeStartM: 0.45,
  ghostNearFadeM: 0.6,

  // Screen
  flashDecayPerSec: 5,
  /**
   * The 3D view renders at most at this pixel ratio. A Retina screen at 2x is four times the pixels for a picture the
   * VHS pass grains over anyway. The HUD keeps the full ratio so text stays sharp.
   */
  renderPixelRatioMax: 1,
  msaaSamples: 2,
  /** On the title and pause screens the 3D view behind the overlay redraws only this often. */
  idleRenderIntervalSec: 0.25,

  // Teaching
  hintDelaySec: 1.5,
  hintLensHoldSec: 0.4,

  // Audio
  masterGain: 0.8,
  mainsHz: 61.74, // B1. Everything tonal is a multiple or a simple interval of this.
  pitchVariation: 0.08,
  stepStrideWalkM: 0.85,
  stepStrideSprintM: 1.05,
  stepStrideCrouchM: 0.6,
  hissRangeM: 16,
  thingAudibleRangeM: 22,
  noticeTickSlowSec: 0.7,
  noticeTickFastSec: 0.12,
  duckGain: 0.35,
  duckSec: 1.6,
} as const;
