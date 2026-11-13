import { FEEL } from '../feel';
import type { ThingMode } from '../../sim';

export interface AudioFrame {
  listener: { x: number; y: number; z: number };
  yawRad: number;
  pitchRad: number;
  thing: { x: number; y: number; z: number };
  thingDistM: number;
  thingMode: ThingMode;
  notice: number;
  lensRaise: number;
}

const B5_HZ = FEEL.mainsHz * 16;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function pitchVar(): number {
  return 1 + (Math.random() * 2 - 1) * FEEL.pitchVariation;
}

/**
 * Web Audio synthesis. Everything is built from the mains hum (B1) and its simple intervals.
 * Graph: sources -> buses (ambient, sfx, thing) -> master -> limiter, with one shared reverb send.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private ambientBus!: GainNode;
  private sfxBus!: GainNode;
  private thingBus!: GainNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private hissGain!: GainNode;
  private lensBedGain!: GainNode;
  private buzzGain!: GainNode;
  private thingDistGain!: GainNode;
  private thingNoiseGain!: GainNode;
  private thingPanner!: PannerNode;
  private thingLfo!: OscillatorNode;
  private thingOscs: OscillatorNode[] = [];
  private humGain!: GainNode;
  private rainGain!: GainNode;
  private vcrGain!: GainNode;
  private vcrOsc!: OscillatorNode;
  private tickTimerSec = 0;
  private flickerTimerSec = 0;
  private stepSide = 1;

  /** Call from the first user input. Creates the graph once, then resumes. */
  unlock(): void {
    if (!this.ctx) this.build();
    void this.ctx?.resume();
  }

  setPaused(paused: boolean): void {
    if (!this.ctx) return;
    if (paused) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  private build(): void {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = FEEL.masterGain;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -8;
    limiter.knee.value = 6;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    this.master.connect(limiter).connect(ctx.destination);

    this.ambientBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.thingBus = ctx.createGain();
    this.ambientBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.thingBus.connect(this.master);

    // One shared reverb: decaying stereo noise
    const convolver = ctx.createConvolver();
    const irLen = Math.floor(ctx.sampleRate * 1.8);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < irLen; i++) {
        lp += (Math.random() * 2 - 1 - lp) * 0.35;
        data[i] = lp * Math.pow(1 - i / irLen, 3.5);
      }
    }
    convolver.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    const reverbReturn = ctx.createGain();
    reverbReturn.gain.value = 0.28;
    this.reverbSend.connect(convolver).connect(reverbReturn).connect(this.master);

    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = this.noise.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    this.buildAmbient(ctx);
    this.buildThing(ctx);
  }

  private loopNoise(ctx: AudioContext): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.start(0, Math.random() * 1.5);
    return src;
  }

  private buildAmbient(ctx: AudioContext): void {
    // Mains hum: B1, with its octave and a fifth above, softly
    const hum = ctx.createGain();
    hum.gain.value = 0.1;
    hum.connect(this.ambientBus);
    this.humGain = hum;
    for (const [mult, type, g] of [
      [1, 'sine', 1],
      [2, 'sawtooth', 0.28],
      [3, 'sine', 0.2],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = FEEL.mainsHz * mult;
      const og = ctx.createGain();
      og.gain.value = g;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      o.connect(og).connect(lp).connect(hum);
      o.start();
    }

    // Fluorescent tube buzz
    const buzz = ctx.createOscillator();
    buzz.type = 'square';
    buzz.frequency.value = FEEL.mainsHz * 2;
    const buzzHp = ctx.createBiquadFilter();
    buzzHp.type = 'highpass';
    buzzHp.frequency.value = 1800;
    this.buzzGain = ctx.createGain();
    this.buzzGain.gain.value = 0.006;
    buzz.connect(buzzHp).connect(this.buzzGain).connect(this.ambientBus);
    buzz.start();

    // Rain on glass
    const rain = this.loopNoise(ctx);
    const rainBp = ctx.createBiquadFilter();
    rainBp.type = 'bandpass';
    rainBp.frequency.value = 1500;
    rainBp.Q.value = 0.5;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.05;
    rain.connect(rainBp).connect(rainGain).connect(this.ambientBus);
    this.rainGain = rainGain;

    // VCR motor: a low whirr that climbs as the tape plays. Silent until used.
    this.vcrOsc = ctx.createOscillator();
    this.vcrOsc.type = 'sawtooth';
    this.vcrOsc.frequency.value = FEEL.mainsHz * 1.5;
    const vcrLp = ctx.createBiquadFilter();
    vcrLp.type = 'lowpass';
    vcrLp.frequency.value = 500;
    this.vcrGain = ctx.createGain();
    this.vcrGain.gain.value = 0;
    this.vcrOsc.connect(vcrLp).connect(this.vcrGain).connect(this.sfxBus);
    this.vcrOsc.start();

    // Tape hiss: grows as the Thing gets near
    const hiss = this.loopNoise(ctx);
    const hissHp = ctx.createBiquadFilter();
    hissHp.type = 'highpass';
    hissHp.frequency.value = 4500;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    hiss.connect(hissHp).connect(this.hissGain).connect(this.sfxBus);

    // The lens adds its own bed of hiss
    const bed = this.loopNoise(ctx);
    const bedBp = ctx.createBiquadFilter();
    bedBp.type = 'bandpass';
    bedBp.frequency.value = 3000;
    bedBp.Q.value = 0.7;
    this.lensBedGain = ctx.createGain();
    this.lensBedGain.gain.value = 0;
    bed.connect(bedBp).connect(this.lensBedGain).connect(this.sfxBus);
  }

  private buildThing(ctx: AudioContext): void {
    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    const wobble = ctx.createGain();
    wobble.gain.value = 0.5;
    this.thingLfo = ctx.createOscillator();
    this.thingLfo.frequency.value = 5;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5;
    this.thingLfo.connect(lfoDepth).connect(wobble.gain);
    this.thingLfo.start();

    // Two slightly detuned tones a fifth over the octave, so they beat against each other
    for (const hz of [FEEL.mainsHz * 3, FEEL.mainsHz * 3 * 1.012]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      o.connect(mix);
      o.start();
      this.thingOscs.push(o);
    }
    const grit = this.loopNoise(ctx);
    const gritBp = ctx.createBiquadFilter();
    gritBp.type = 'bandpass';
    gritBp.frequency.value = 900;
    gritBp.Q.value = 4;
    this.thingNoiseGain = ctx.createGain();
    this.thingNoiseGain.gain.value = 0.12;
    grit.connect(gritBp).connect(this.thingNoiseGain).connect(mix);

    this.thingDistGain = ctx.createGain();
    this.thingDistGain.gain.value = 0;
    this.thingPanner = ctx.createPanner();
    this.thingPanner.panningModel = 'HRTF';
    this.thingPanner.distanceModel = 'inverse';
    this.thingPanner.refDistance = 3;
    this.thingPanner.rolloffFactor = 1.2;
    this.thingPanner.maxDistance = 40;
    mix.connect(wobble).connect(this.thingDistGain).connect(this.thingPanner).connect(this.thingBus);
  }

  /** Per-frame. Moves the listener and the Thing, sets proximity-driven levels. */
  update(f: AudioFrame, dtSec: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;

    const l = ctx.listener;
    const cp = Math.cos(f.pitchRad);
    l.positionX.setValueAtTime(f.listener.x, now);
    l.positionY.setValueAtTime(f.listener.y, now);
    l.positionZ.setValueAtTime(f.listener.z, now);
    l.forwardX.setValueAtTime(-Math.sin(f.yawRad) * cp, now);
    l.forwardY.setValueAtTime(Math.sin(f.pitchRad), now);
    l.forwardZ.setValueAtTime(-Math.cos(f.yawRad) * cp, now);
    l.upX.setValueAtTime(0, now);
    l.upY.setValueAtTime(1, now);
    l.upZ.setValueAtTime(0, now);

    this.thingPanner.positionX.setValueAtTime(f.thing.x, now);
    this.thingPanner.positionY.setValueAtTime(f.thing.y, now);
    this.thingPanner.positionZ.setValueAtTime(f.thing.z, now);

    const near = clamp01(1 - f.thingDistM / FEEL.hissRangeM);
    const hiss = 0.008 + 0.2 * near * near + 0.14 * f.notice;
    this.hissGain.gain.setTargetAtTime(hiss * (1 + 0.3 * f.lensRaise), now, 0.05);
    this.lensBedGain.gain.setTargetAtTime(0.03 * f.lensRaise, now, 0.05);

    const audible = clamp01(1 - f.thingDistM / FEEL.thingAudibleRangeM);
    const rushing = f.thingMode === 'rush';
    const voice = (rushing ? 0.5 : 0.22) * audible * audible + (rushing ? 0.1 : 0);
    this.thingDistGain.gain.setTargetAtTime(voice, now, 0.08);
    this.thingLfo.frequency.setTargetAtTime(rushing ? 13 : f.thingMode === 'stalk' ? 7.5 : 5, now, 0.2);
    for (const o of this.thingOscs) o.detune.setTargetAtTime(rushing ? 700 : 0, now, 0.15);
    this.thingNoiseGain.gain.setTargetAtTime(rushing ? 0.5 : 0.12, now, 0.1);

    // Tube flicker
    this.flickerTimerSec -= dtSec;
    if (this.flickerTimerSec <= 0) {
      this.flickerTimerSec = 0.06 + Math.random() * 0.2;
      const spike = Math.random() < 0.12 ? 2.5 + Math.random() * 2 : 1;
      this.buzzGain.gain.setTargetAtTime(0.006 * spike, now, 0.01);
    }

    // The REC beep stutters faster as the Thing notices
    if (f.notice > 0.03) {
      this.tickTimerSec -= dtSec;
      if (this.tickTimerSec <= 0) {
        this.noticeTick(f.notice);
        this.tickTimerSec = FEEL.noticeTickSlowSec + (FEEL.noticeTickFastSec - FEEL.noticeTickSlowSec) * f.notice;
      }
    } else {
      this.tickTimerSec = 0;
    }
  }

  // ---- One-shots -----------------------------------------------------------

  private env(g: GainNode, t0: number, attackSec: number, peak: number, decaySec: number): void {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attackSec);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attackSec + decaySec);
  }

  private noiseBurst(t0: number, filterType: BiquadFilterType, hz: number, q: number, peak: number, decaySec: number, dest: AudioNode): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = hz;
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t0, 0.003, peak, decaySec);
    src.connect(f).connect(g).connect(dest);
    src.start(t0, Math.random() * 1.5, decaySec + 0.05);
  }

  private tone(t0: number, type: OscillatorType, hzA: number, hzB: number, glideSec: number, peak: number, attackSec: number, decaySec: number, dest: AudioNode): OscillatorNode | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hzA, t0);
    if (hzB !== hzA) o.frequency.exponentialRampToValueAtTime(hzB, t0 + glideSec);
    const g = ctx.createGain();
    this.env(g, t0, attackSec, peak, decaySec);
    o.connect(g).connect(dest);
    o.start(t0);
    o.stop(t0 + attackSec + decaySec + 0.05);
    return o;
  }

  private toReverb(src: AudioNode, amount: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const g = ctx.createGain();
    g.gain.value = amount;
    src.connect(g).connect(this.reverbSend);
  }

  /** Lino footstep: thump, scuff, and the odd squeak. Placed in the room at `at` when given (your echo's steps). */
  footstep(kind: 'walk' | 'sprint' | 'crouch', at?: { x: number; y: number; z: number }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const vol = kind === 'sprint' ? 1 : kind === 'walk' ? 0.65 : 0.3;
    const pv = pitchVar();
    let out: AudioNode;
    if (at) {
      out = this.positional(at);
    } else {
      const pan = ctx.createStereoPanner();
      this.stepSide = -this.stepSide;
      pan.pan.value = this.stepSide * 0.15;
      pan.connect(this.sfxBus);
      out = pan;
    }
    this.toReverb(out, at ? 0.2 : 0.12);
    this.tone(t0, 'sine', 95 * pv, 45 * pv, 0.09, 0.22 * vol, 0.004, 0.12, out);
    this.noiseBurst(t0, 'lowpass', 600 * pv + Math.random() * 300, 0.7, 0.16 * vol, 0.07, out);
    if (Math.random() < 0.06 * vol) this.tone(t0 + 0.01, 'sine', 1700 * pv, 2300 * pv, 0.04, 0.02, 0.004, 0.05, out);
  }

  /** Camcorder servo, up or down, with a small clunk at the end. */
  servo(up: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const pv = pitchVar();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1000;
    lp.connect(this.sfxBus);
    this.toReverb(lp, 0.1);
    const a = (up ? 230 : 520) * pv;
    const b = (up ? 520 : 230) * pv;
    this.tone(t0, 'sawtooth', a, b, 0.16, 0.09, 0.01, 0.18, lp);
    this.noiseBurst(t0, 'bandpass', 2500, 3, 0.04, 0.14, this.sfxBus);
    this.tone(t0 + 0.15, 'sine', 140 * pv, 90 * pv, 0.05, 0.06, 0.003, 0.08, this.sfxBus);
  }

  /** REC beep in the key (B5), with a click on the front and a ring on the back. */
  recBeep(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const detune = 1 + (Math.random() * 2 - 1) * 0.008;
    const bus = ctx.createGain();
    bus.connect(this.sfxBus);
    this.toReverb(bus, 0.2);
    this.noiseBurst(t0, 'highpass', 5000, 1, 0.03, 0.01, bus);
    this.tone(t0, 'sine', B5_HZ * detune, B5_HZ * detune, 0, 0.09, 0.003, 0.14, bus);
    this.tone(t0, 'triangle', B5_HZ * 2 * detune, B5_HZ * 2 * detune, 0, 0.025, 0.003, 0.22, bus);
  }

  /** Rising stutter as the Thing notices. Climbs a perfect fifth over the meter. */
  private noticeTick(level: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const hz = B5_HZ * Math.pow(2, (level * 7) / 12);
    this.tone(t0, 'sine', hz, hz, 0, 0.04 + 0.08 * level, 0.002, 0.07, this.sfxBus);
    this.tone(t0, 'square', hz * 0.5, hz * 0.5, 0, 0.01 + 0.02 * level, 0.002, 0.05, this.sfxBus);
  }

  /** Three beeps when the battery dies. */
  lowBattery(): void {
    for (let i = 0; i < 3; i++) setTimeout(() => this.recBeep(), i * 140);
  }

  /** The rush: screech, FM growl, sub boom. Everything else ducks. */
  rushStart(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const now = t0;
    // Duck the room
    this.ambientBus.gain.cancelScheduledValues(now);
    this.ambientBus.gain.setTargetAtTime(FEEL.duckGain, now, 0.03);
    this.ambientBus.gain.setTargetAtTime(1, now + FEEL.duckSec, 0.4);

    const bus = ctx.createGain();
    bus.connect(this.thingBus);
    this.toReverb(bus, 0.5);

    // Screech: swept noise
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(700, t0);
    bp.frequency.exponentialRampToValueAtTime(3600, t0 + 0.9);
    const sg = ctx.createGain();
    this.env(sg, t0, 0.02, 0.35, 1.0);
    src.connect(bp).connect(sg).connect(bus);
    src.start(t0, 0, 1.2);

    // FM growl at B3
    const carrier = ctx.createOscillator();
    carrier.type = 'square';
    carrier.frequency.value = FEEL.mainsHz * 4;
    const mod = ctx.createOscillator();
    mod.frequency.value = FEEL.mainsHz * 1.4;
    const modGain = ctx.createGain();
    modGain.gain.value = 180;
    mod.connect(modGain).connect(carrier.frequency);
    const cg = ctx.createGain();
    this.env(cg, t0, 0.02, 0.12, 1.0);
    carrier.connect(cg).connect(bus);
    carrier.start(t0);
    mod.start(t0);
    carrier.stop(t0 + 1.2);
    mod.stop(t0 + 1.2);

    // Sub boom
    this.tone(t0, 'sine', FEEL.mainsHz, FEEL.mainsHz * 0.65, 1.2, 0.55, 0.01, 1.4, bus);
  }

  /** Tape stop: pitch falls through the floor, a swish, and the scrub chirp. */
  rewind(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200, t0);
    lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.4);
    lp.connect(this.sfxBus);
    this.toReverb(lp, 0.2);
    this.tone(t0, 'sawtooth', B5_HZ / 2, 36, 0.4, 0.26, 0.005, 0.45, lp);
    this.noiseBurst(t0, 'bandpass', 1800, 1.5, 0.2, 0.3, this.sfxBus);
    // Scrub chirp as the tape rewinds
    this.tone(t0 + 0.3, 'square', 700, 2400, 0.18, 0.04, 0.005, 0.2, this.sfxBus);
  }

  // ---- Game events -----------------------------------------------------------

  /**
   * Cassette clack, then a two-note chime climbing a fifth in the key. `rise` lifts it by that many scale steps of the
   * B major pentatonic, so each chamber you clear sounds a little higher than the last.
   */
  tapePickup(rise = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const pv = pitchVar();
    const bus = ctx.createGain();
    bus.connect(this.sfxBus);
    this.toReverb(bus, 0.3);
    this.noiseBurst(t0, 'bandpass', 1400, 2, 0.2, 0.05, bus);
    this.tone(t0, 'square', 220 * pv, 120 * pv, 0.04, 0.05, 0.002, 0.06, bus);
    const steps = [0, 2, 4, 7, 9];
    const semis = (steps[rise % steps.length] ?? 0) + 12 * Math.floor(rise / steps.length);
    const root = (B5_HZ / 2) * Math.pow(2, semis / 12);
    this.tone(t0 + 0.08, 'sine', root, root, 0, 0.12, 0.004, 0.5, bus);
    this.tone(t0 + 0.2, 'sine', root * 1.5, root * 1.5, 0, 0.12, 0.004, 0.9, bus);
    this.tone(t0 + 0.2, 'triangle', root * 3, root * 3, 0, 0.02, 0.004, 0.9, bus);
  }

  /** Creak and latch. Placed in the room at the door when `at` is given. */
  doorToggle(open: boolean, at?: { x: number; y: number; z: number }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const pv = pitchVar();
    const out = this.positional(at);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 6;
    bp.frequency.setValueAtTime(open ? 380 : 620, t0);
    bp.frequency.exponentialRampToValueAtTime(open ? 620 : 300, t0 + 0.42);
    bp.connect(out);
    this.toReverb(out, 0.2);
    this.tone(t0, 'sawtooth', (open ? 150 : 210) * pv, (open ? 210 : 130) * pv, 0.42, 0.1, 0.05, 0.4, bp);
    this.tone(t0 + 0.4, 'sine', 120 * pv, 60 * pv, 0.05, 0.14, 0.003, 0.09, out);
    this.noiseBurst(t0 + 0.4, 'highpass', 3000, 1, 0.05, 0.03, out);
  }

  /** A fist on a door. Positional so you can tell where it is. */
  doorBang(at: { x: number; y: number; z: number }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const pv = pitchVar();
    const out = this.positional(at);
    this.toReverb(out, 0.5);
    this.tone(t0, 'sine', 95 * pv, 38 * pv, 0.12, 0.7, 0.003, 0.28, out);
    this.noiseBurst(t0, 'lowpass', 500, 0.7, 0.5, 0.12, out);
    this.noiseBurst(t0, 'bandpass', 1800, 1.5, 0.12, 0.05, out);
  }

  private positional(at?: { x: number; y: number; z: number }): AudioNode {
    const ctx = this.ctx;
    if (!ctx) throw new Error('audio not started');
    if (!at) return this.sfxBus;
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = 2;
    p.rolloffFactor = 1.1;
    p.positionX.value = at.x;
    p.positionY.value = at.y;
    p.positionZ.value = at.z;
    p.connect(this.sfxBus);
    return p;
  }

  /** Drives the VCR motor each frame. Louder while held; the pitch climbs as the tape plays. */
  vcr(held: boolean, progress: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    this.vcrGain.gain.setTargetAtTime(held ? 0.09 : progress > 0 && progress < 1 ? 0.02 : 0, now, 0.08);
    this.vcrOsc.frequency.setTargetAtTime(FEEL.mainsHz * 1.5 * (1 + progress * 0.5), now, 0.1);
  }

  /** A pressure plate: a hard click going down, a softer one coming up. Placed at the plate. */
  plate(down: boolean, at: { x: number; y: number; z: number }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const pv = pitchVar();
    const out = this.positional(at);
    this.toReverb(out, 0.25);
    const vol = down ? 1 : 0.5;
    this.tone(t0, 'square', (down ? 260 : 190) * pv, (down ? 120 : 90) * pv, 0.05, 0.1 * vol, 0.002, 0.07, out);
    this.noiseBurst(t0, 'bandpass', 2000 * pv, 2.5, 0.1 * vol, 0.04, out);
    this.tone(t0 + 0.02, 'sine', 80 * pv, 50 * pv, 0.08, 0.3 * vol, 0.004, 0.12, out);
  }

  /** A gate: the light curtain whines up or down a fifth in the key, with a bolt at the end. Placed at the gate. */
  gate(open: boolean, at: { x: number; y: number; z: number }): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const pv = pitchVar();
    const out = this.positional(at);
    this.toReverb(out, 0.4);
    const lo = B5_HZ / 2;
    const hi = lo * 1.5;
    this.tone(t0, 'sawtooth', (open ? lo : hi) * pv, (open ? hi : lo) * pv, 0.3, 0.07, 0.02, 0.35, out);
    this.tone(t0, 'sine', (open ? lo : hi) * 2 * pv, (open ? hi : lo) * 2 * pv, 0.3, 0.05, 0.02, 0.35, out);
    this.tone(t0 + 0.3, 'sine', 100 * pv, 42 * pv, 0.1, open ? 0.35 : 0.55, 0.003, 0.25, out);
    this.noiseBurst(t0 + 0.3, 'lowpass', 700, 0.8, open ? 0.15 : 0.3, 0.08, out);
  }

  /** The bolt, then a chime. The way out. */
  exitOpen(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const bus = ctx.createGain();
    bus.connect(this.sfxBus);
    this.toReverb(bus, 0.5);
    this.tone(t0, 'sine', 110, 45, 0.15, 0.6, 0.003, 0.3, bus);
    this.noiseBurst(t0, 'bandpass', 2200, 2, 0.2, 0.06, bus);
    this.noiseBurst(t0 + 0.2, 'highpass', 2500, 0.8, 0.12, 0.7, bus);
    this.tone(t0 + 0.3, 'sine', B5_HZ, B5_HZ, 0, 0.14, 0.004, 1.2, bus);
    this.tone(t0 + 0.3, 'sine', B5_HZ * 1.5, B5_HZ * 1.5, 0, 0.1, 0.004, 1.2, bus);
  }

  /** The lights die: a transformer thunk, sparks, the hum drops, the rain comes up. */
  blackout(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    this.humGain.gain.setTargetAtTime(on ? 0.015 : 0.1, t0, 0.15);
    this.rainGain.gain.setTargetAtTime(on ? 0.1 : 0.05, t0, 0.8);
    if (!on) return;
    const bus = ctx.createGain();
    bus.connect(this.sfxBus);
    this.toReverb(bus, 0.6);
    this.tone(t0, 'sine', FEEL.mainsHz, FEEL.mainsHz * 0.45, 0.5, 0.7, 0.005, 0.7, bus);
    for (let i = 0; i < 5; i++) this.noiseBurst(t0 + 0.05 + i * 0.07 * Math.random() + i * 0.05, 'highpass', 4000, 1, 0.12, 0.03, bus);
  }

  /** The end: everything falls away, rain softens, a slow B1 and F#2 swell like the house lights coming up. */
  win(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    this.ambientBus.gain.cancelScheduledValues(t0);
    this.ambientBus.gain.setTargetAtTime(0.25, t0, 0.8);
    this.rainGain.gain.setTargetAtTime(0.03, t0, 1.5);
    this.humGain.gain.setTargetAtTime(0.1, t0, 1.5);
    const bus = ctx.createGain();
    bus.connect(this.sfxBus);
    this.toReverb(bus, 0.7);
    this.tone(t0 + 0.5, 'sine', FEEL.mainsHz * 2, FEEL.mainsHz * 2, 0, 0.18, 2.2, 4, bus);
    this.tone(t0 + 0.5, 'sine', FEEL.mainsHz * 3, FEEL.mainsHz * 3, 0, 0.12, 2.6, 4, bus);
  }

  /** Back to the start. */
  reset(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime;
    this.ambientBus.gain.cancelScheduledValues(t0);
    this.ambientBus.gain.setTargetAtTime(1, t0, 0.2);
    this.humGain.gain.setTargetAtTime(0.1, t0, 0.2);
    this.rainGain.gain.setTargetAtTime(0.05, t0, 0.5);
  }
}
