(() => {
  'use strict';

  /*
   * ZOMVOX AUDIO — single-file procedural sound system
   *
   * Built from the stronger layered synthesis approach used by the attached
   * audio system, while keeping ZomVox's existing window.ZomVoxSound API.
   *
   * Kept: shared noise bank, layered weapon/foley recipes, bus compression,
   * ducking, one generated reverb, audio-rate ambience movement, formant voice.
   * Removed: module imports, 3D emitter pool, raycast occlusion/room probes,
   * five-way convolution blend, offline test harness and engine event wiring.
   */

  const config = window.ZOMVOX_CONFIG || {};
  const enemyConfig = config.enemies || {};
  const audioConfig = config.audio || {};
  const audioFileConfig = audioConfig.files || {};
  const commandVoiceConfig = audioConfig.commandVoice || {};

  const DEFAULT_FILE_CUES = {
    shoot: 'shoot.mp3',
    zombieMoan: 'zombiemoan.wav'
  };
  const FILE_CUE_VOLUME = { shoot: 0.72, zombieMoan: 0.74 };
  const PREFER_FILES = audioConfig.preferFiles === true;
  const FILE_FALLBACK = audioConfig.fileFallback !== false;
  const ZOMBIE_MOAN_MAX_OVERLAP = Math.max(
    1,
    Math.floor(Number(enemyConfig.zombieMoanMaxVoices) || 3)
  );

  class Rng {
    constructor(seed = 0x5a17c9e3) {
      this.state = (Number(seed) >>> 0) || 0x5a17c9e3;
    }
    u32() {
      let x = this.state;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      this.state = x >>> 0;
      return this.state;
    }
    float() { return this.u32() / 4294967296; }
    signed() { return this.float() * 2 - 1; }
    range(min, max) { return min + (max - min) * this.float(); }
    fork() { return new Rng(this.u32() ^ 0x9e3779b9); }
  }

/**
 * AUDIO / DSP TOOLKIT
 *
 * Low-level Web Audio helpers shared by every synthesis voice in this
 * directory. Everything here is written against `BaseAudioContext` so the exact
 * same code path renders in an `OfflineAudioContext` (see selftest.js) as in
 * the live `AudioContext` — that is how this subsystem is verified without a
 * user gesture or a speaker.
 *
 * Rules honoured here:
 *  - no randomness except through an injected `Rng` (ctx.rng.fork())
 *  - buffers and curve tables are built once and shared
 *  - every node a voice creates hangs off a single top gain so the caller can
 *    disconnect the whole voice in one call when its tail has decayed
 */

const SPEED_OF_SOUND = 343; // m/s, 20 C dry air

/* ------------------------------------------------------------------ */
/* Noise                                                              */
/* ------------------------------------------------------------------ */

/**
 * Fill a Float32Array with one of the classic noise colours.
 *  white  — flat spectrum, the raw material of cracks and hiss
 *  pink   — -3 dB/oct (Paul Kellet's economy filter), city beds, tails
 *  brown  — -6 dB/oct leaky integrator, wind and rumble
 *  crackle— sparse impulsive grains, debris and foliage
 */
function fillNoise(out, kind, rng) {
  const n = out.length;
  switch (kind) {
    case 'pink': {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) {
        const w = rng.signed();
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
      break;
    }
    case 'brown': {
      let last = 0;
      for (let i = 0; i < n; i++) {
        const w = rng.signed();
        last = (last + 0.019 * w) * 0.9985;
        out[i] = last * 5.2;
      }
      break;
    }
    case 'crackle': {
      out.fill(0);
      // Poisson-ish grain train; each grain is a decaying two-pole ping so the
      // buffer already has material character rather than pure clicks.
      let i = 0;
      while (i < n) {
        i += 12 + ((rng.u32() % 260) | 0);
        if (i >= n) break;
        const amp = rng.range(0.25, 1) * (rng.float() < 0.12 ? 1.8 : 0.7);
        const w = rng.range(0.05, 0.45); // radians/sample
        const dec = Math.exp(-rng.range(0.004, 0.05));
        let a = amp;
        for (let k = 0; k < 220 && i + k < n; k++) {
          out[i + k] += Math.sin(w * k) * a;
          a *= dec;
          if (a < 1e-4) break;
        }
      }
      // Keep the peak sane; grains overlap.
      let peak = 1e-6;
      for (let k = 0; k < n; k++) peak = Math.max(peak, Math.abs(out[k]));
      const g = 0.9 / peak;
      for (let k = 0; k < n; k++) out[k] *= g;
      break;
    }
    default:
      for (let i = 0; i < n; i++) out[i] = rng.signed();
  }
  return out;
}

/**
 * A small library of long noise buffers. Voices take a random slice at a random
 * playback rate, which is what keeps automatic fire from sounding like a loop
 * while costing nothing at runtime.
 */
class NoiseBank {
  constructor(actx, rng, seconds = 2.2) {
    this.actx = actx;
    this.buffers = {};
    for (const kind of ['white', 'pink', 'brown', 'crackle']) {
      const len = Math.max(1, Math.floor(actx.sampleRate * seconds));
      const buf = actx.createBuffer(2, len, actx.sampleRate);
      // Two decorrelated channels so wide beds get real stereo width.
      fillNoise(buf.getChannelData(0), kind, rng);
      fillNoise(buf.getChannelData(1), kind, rng);
      this.buffers[kind] = buf;
    }
  }

  /** A one-shot source reading from a random offset. Caller starts/stops it. */
  source(kind, rng, rate = 1, loop = false) {
    const src = this.actx.createBufferSource();
    const buf = this.buffers[kind] ?? this.buffers.white;
    src.buffer = buf;
    src.playbackRate.value = rate;
    src.loop = loop;
    if (loop) {
      src.loopStart = 0;
      src.loopEnd = buf.duration;
    }
    src._offset = rng ? rng.range(0, buf.duration * 0.7) : 0;
    return src;
  }

  dispose() {
    this.buffers = {};
  }
}

/* ------------------------------------------------------------------ */
/* Envelopes                                                          */
/* ------------------------------------------------------------------ */

const FLOOR = 1e-4;

/**
 * Guard: eleven subsystems can reach audio, and one NaN position turns into a
 * non-finite schedule time that throws inside Web Audio. Envelopes refuse
 * garbage instead of taking the whole frame down with them.
 */
function ok(t0, peak) {
  return Number.isFinite(t0) && Number.isFinite(peak) && t0 >= 0;
}

/** Instant-attack exponential decay — the workhorse for transients. */
function hit(param, t0, peak, decay) {
  if (!ok(t0, peak)) return t0;
  const p = Math.max(peak, FLOOR * 4);
  param.setValueAtTime(p, t0);
  param.exponentialRampToValueAtTime(FLOOR, t0 + decay);
  param.setValueAtTime(0, t0 + decay + 0.002);
  return t0 + decay + 0.002;
}

/** Attack/decay with an exponential contour on both halves. */
function ad(param, t0, peak, attack, decay) {
  if (!ok(t0, peak)) return t0;
  const p = Math.max(peak, FLOOR * 4);
  param.setValueAtTime(FLOOR, t0);
  if (attack > 0.0008) param.exponentialRampToValueAtTime(p, t0 + attack);
  else param.setValueAtTime(p, t0 + 0.0004);
  param.exponentialRampToValueAtTime(FLOOR, t0 + attack + decay);
  param.setValueAtTime(0, t0 + attack + decay + 0.002);
  return t0 + attack + decay + 0.002;
}

/** Full ADSR for sustained material (voices, wind gusts). */
function adsr(param, t0, peak, a, d, s, sustainLevel, r) {
  if (!ok(t0, peak)) return t0;
  const p = Math.max(peak, FLOOR * 4);
  const sl = Math.max(p * sustainLevel, FLOOR * 4);
  param.setValueAtTime(FLOOR, t0);
  param.exponentialRampToValueAtTime(p, t0 + a);
  param.exponentialRampToValueAtTime(sl, t0 + a + d);
  param.setValueAtTime(sl, t0 + a + d + s);
  param.exponentialRampToValueAtTime(FLOOR, t0 + a + d + s + r);
  param.setValueAtTime(0, t0 + a + d + s + r + 0.002);
  return t0 + a + d + s + r + 0.002;
}

/** Exponential parameter sweep, guarded against zero/negative targets. */
function sweep(param, t0, from, to, dur) {
  if (!ok(t0, from) || !Number.isFinite(to) || !Number.isFinite(dur)) return t0;
  param.setValueAtTime(Math.max(from, 1e-3), t0);
  param.exponentialRampToValueAtTime(Math.max(to, 1e-3), t0 + Math.max(dur, 0.001));
  return t0 + dur;
}

/* ------------------------------------------------------------------ */
/* Nodes                                                              */
/* ------------------------------------------------------------------ */

function biquad(actx, type, freq, Q = 0.7071, gainDb = 0) {
  const f = actx.createBiquadFilter();
  f.type = type;
  f.frequency.value = clamp(freq, 10, Math.min(20000, actx.sampleRate * 0.48));
  f.Q.value = Q;
  f.gain.value = gainDb;
  return f;
}

function gain(actx, value = 1) {
  const g = actx.createGain();
  g.gain.value = value;
  return g;
}

function osc(actx, type, freq, detune = 0) {
  const o = actx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  return o;
}

/** Connect a list of nodes head-to-tail; returns the last one. */
function series(...nodes) {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

/* ------------------------------------------------------------------ */
/* Waveshaping                                                        */
/* ------------------------------------------------------------------ */

const CURVE_CACHE = new Map();

/**
 * tanh-style saturation. `drive` 0 is nearly clean, 20 is aggressive.
 * `asym` adds even harmonics — that is what gives a muzzle blast its "chuff"
 * rather than a symmetric fuzz-pedal buzz.
 */
function saturationCurve(drive = 4, asym = 0) {
  const key = `${drive.toFixed(2)}:${asym.toFixed(2)}`;
  let c = CURVE_CACHE.get(key);
  if (c) return c;
  const n = 2048;
  c = new Float32Array(n);
  const k = 1 + drive;
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const xa = x + asym * x * x * (x < 0 ? -1 : 1) * 0.5;
    c[i] = Math.tanh(k * xa) / norm;
  }
  CURVE_CACHE.set(key, c);
  return c;
}

/** Hard-knee-free soft clip for the very last stage of the master bus. */
function limiterCurve() {
  let c = CURVE_CACHE.get('__limit');
  if (c) return c;
  const n = 4096;
  c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    // Cubic soft clip up to 0.66, then tanh — transparent below -6 dBFS.
    const a = Math.abs(x);
    let y;
    if (a < 0.66) y = x;
    else y = Math.sign(x) * (0.66 + (1 - 0.66) * Math.tanh((a - 0.66) / (1 - 0.66)));
    c[i] = y * 0.985;
  }
  CURVE_CACHE.set('__limit', c);
  return c;
}

function shaper(actx, curve, oversample = '2x') {
  const w = actx.createWaveShaper();
  w.curve = curve;
  w.oversample = oversample;
  return w;
}

/* ------------------------------------------------------------------ */
/* Resonators                                                         */
/* ------------------------------------------------------------------ */

/**
 * Excite a bank of high-Q bandpasses with a short noise burst: the cheapest
 * convincing model of a struck metal/glass/wood object. Returns the sum node.
 * `partials` = [{ f, q, g, decay }]
 */
function struckResonator(actx, bank, rng, t0, partials, exciteDur = 0.004, exciteKind = 'white') {
  const out = gain(actx, 1);
  const src = bank.source(exciteKind, rng, rng.range(0.85, 1.2));
  const exc = gain(actx, 0);
  hit(exc.gain, t0, 1, exciteDur);
  src.connect(exc);
  for (const p of partials) {
    const q = p.q ?? 22;
    const bp = biquad(actx, 'bandpass', p.f, q);
    const vg = gain(actx, 0);
    // A bandpass only passes f/Q of the excitation's bandwidth, so a high-Q
    // partial fed a 2 ms noise burst is ~20 dB quieter than a low-Q one. Without
    // this makeup every metallic sound in the game sits inaudibly low in the mix.
    hit(vg.gain, t0, (p.g ?? 0.5) * Math.sqrt(q) * 0.85, p.decay ?? 0.12);
    exc.connect(bp);
    bp.connect(vg);
    vg.connect(out);
  }
  src.start(t0, src._offset, exciteDur + 0.02);
  return out;
}

/* ------------------------------------------------------------------ */
/* Misc                                                               */
/* ------------------------------------------------------------------ */

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

/** Semitone ratio — pitch jitter is expressed musically, not as a raw factor. */
function semis(n) {
  return Math.pow(2, n / 12);
}

/** Air absorption: how much high end survives `dist` metres of atmosphere. */
function airCutoff(dist) {
  // ~ -1.5 dB/100 m at 1 kHz, far more at 8 kHz. Tuned by ear against real
  // long-range gunfire recordings: 50 m still bright, 300 m is all boom.
  return clamp(20500 / (1 + dist * 0.055), 260, 20000);
}

/**
 * AUDIO / WEAPON FIRE
 *
 * A gunshot is not one sound. Every layer below exists in real recordings and
 * removing any one of them is immediately audible:
 *
 *   1. TRANSIENT  sub-millisecond click — the pressure step. Gives the shot its
 *                 "instant" feel; without it the gun sounds like a firework.
 *   2. BODY       a fast downward-swept sine/triangle pair, saturated. This is
 *                 the chest thump, the layer people describe as "punch".
 *   3. CRACK      resonant band-passed noise around 1.5–3.5 kHz driven into
 *                 saturation. Calibre character lives here.
 *   4. MID        a short 500–900 Hz noise body that glues 2 and 3 together.
 *   5. TAIL       a broadband burst under a falling lowpass, fed hard into the
 *                 reverb send — this is what the *room* hears.
 *   6. MECH       the bolt/action: a separate, drier, later metallic layer. It
 *                 is what makes a weapon feel mechanical rather than sampled.
 *   7. BOOM       (distance only) a slow, dark, rolling low-frequency swell
 *                 plus a ground-bounce repeat.
 *
 * Variation: each profile owns a round-robin table of 6 timbre variants, and on
 * top of that every shot gets fresh pitch/level/decay jitter from ctx.rng. Two
 * consecutive rounds are never the same waveform, which is the single biggest
 * difference between "synthesized game audio" and "a looping sample".
 */

/**
 * Per-weapon character. Frequencies in Hz, times in seconds.
 * `level` is a linear trim; the mix expects ~1.0 for a 5.56 rifle.
 */
const WEAPON_PROFILES = {
  rifle: {
    level: 1.0, bodyF: 148, bodyF2: 56, bodyDecay: 0.085, subF: 62, subDecay: 0.12,
    crackF: 2450, crackQ: 0.95, crackDecay: 0.055, drive: 6, asym: 0.35,
    midF: 780, midDecay: 0.05, tailDecay: 0.3, tailF: 5200, tailEndF: 700,
    mechDelay: 0.028, mechLevel: 0.42, mechPartials: [1880, 3260, 5400], send: 0.5,
  },
  ak: {
    level: 1.1, bodyF: 124, bodyF2: 46, bodyDecay: 0.105, subF: 52, subDecay: 0.15,
    crackF: 1780, crackQ: 0.9, crackDecay: 0.07, drive: 7.5, asym: 0.5,
    midF: 640, midDecay: 0.06, tailDecay: 0.42, tailF: 4200, tailEndF: 560,
    mechDelay: 0.034, mechLevel: 0.55, mechPartials: [1420, 2650, 4300], send: 0.55,
  },
  smg: {
    level: 0.84, bodyF: 172, bodyF2: 72, bodyDecay: 0.06, subF: 78, subDecay: 0.08,
    crackF: 3050, crackQ: 1.05, crackDecay: 0.04, drive: 5, asym: 0.3,
    midF: 900, midDecay: 0.035, tailDecay: 0.19, tailF: 6200, tailEndF: 900,
    mechDelay: 0.021, mechLevel: 0.5, mechPartials: [2200, 3900, 6300], send: 0.44,
  },
  pistol: {
    level: 0.74, bodyF: 186, bodyF2: 84, bodyDecay: 0.05, subF: 92, subDecay: 0.07,
    crackF: 2750, crackQ: 1.15, crackDecay: 0.035, drive: 4.5, asym: 0.28,
    midF: 950, midDecay: 0.03, tailDecay: 0.16, tailF: 6800, tailEndF: 1000,
    mechDelay: 0.038, mechLevel: 0.46, mechPartials: [2450, 4200, 6900], send: 0.4,
  },
  shotgun: {
    level: 1.18, bodyF: 108, bodyF2: 40, bodyDecay: 0.13, subF: 44, subDecay: 0.19,
    crackF: 1450, crackQ: 0.7, crackDecay: 0.09, drive: 9, asym: 0.6,
    midF: 520, midDecay: 0.08, tailDecay: 0.5, tailF: 3600, tailEndF: 460,
    mechDelay: 0.16, mechLevel: 0.7, mechPartials: [980, 1760, 3050], send: 0.6,
    pellets: 6,
  },
  sniper: {
    level: 1.3, bodyF: 96, bodyF2: 34, bodyDecay: 0.16, subF: 38, subDecay: 0.24,
    crackF: 1320, crackQ: 0.8, crackDecay: 0.11, drive: 10, asym: 0.55,
    midF: 470, midDecay: 0.1, tailDecay: 0.95, tailF: 3300, tailEndF: 380,
    mechDelay: 0.19, mechLevel: 0.65, mechPartials: [1150, 2050, 3400], send: 0.72,
  },
  lmg: {
    level: 1.14, bodyF: 118, bodyF2: 44, bodyDecay: 0.11, subF: 50, subDecay: 0.16,
    crackF: 1920, crackQ: 0.85, crackDecay: 0.075, drive: 8, asym: 0.45,
    midF: 610, midDecay: 0.065, tailDecay: 0.5, tailF: 4000, tailEndF: 520,
    mechDelay: 0.03, mechLevel: 0.6, mechPartials: [1330, 2480, 4100], send: 0.58,
  },
  suppressed: {
    level: 0.5, bodyF: 132, bodyF2: 64, bodyDecay: 0.055, subF: 70, subDecay: 0.07,
    crackF: 900, crackQ: 0.6, crackDecay: 0.03, drive: 2.5, asym: 0.2,
    midF: 430, midDecay: 0.05, tailDecay: 0.1, tailF: 1800, tailEndF: 400,
    mechDelay: 0.019, mechLevel: 0.85, mechPartials: [2100, 3700, 5900], send: 0.18,
    suppressed: true,
  },
};

/** Map whatever the weapons subsystem calls its guns onto a profile. */
function resolveProfile(name) {
  if (!name) return WEAPON_PROFILES.rifle;
  const k = String(name).toLowerCase();
  if (WEAPON_PROFILES[k]) return WEAPON_PROFILES[k];
  if (/suppress|silenc/.test(k)) return WEAPON_PROFILES.suppressed;
  if (/ak|7\.?62|akm|scar/.test(k)) return WEAPON_PROFILES.ak;
  if (/mp5|mp7|smg|ump|vector|uzi/.test(k)) return WEAPON_PROFILES.smg;
  if (/pistol|glock|m19|deagle|handgun|sidearm/.test(k)) return WEAPON_PROFILES.pistol;
  if (/shot|pump|12g|benelli|spas/.test(k)) return WEAPON_PROFILES.shotgun;
  if (/snip|dmr|awp|barrett|338|intervention|marksman/.test(k)) return WEAPON_PROFILES.sniper;
  if (/lmg|mg4|m249|pkm|saw|minigun/.test(k)) return WEAPON_PROFILES.lmg;
  return WEAPON_PROFILES.rifle;
}

/* ------------------------------------------------------------------ */
/* Round robin                                                        */
/* ------------------------------------------------------------------ */

const RR_SLOTS = 6;

/** Build (once, lazily) the round-robin timbre table for a profile. */
function roundRobin(profile, rng) {
  if (profile._rr) return profile._rr;
  const rr = [];
  for (let i = 0; i < RR_SLOTS; i++) {
    rr.push({
      body: semis(rng.range(-1.1, 1.1)),
      crack: semis(rng.range(-1.7, 1.7)),
      crackQ: rng.range(0.85, 1.2),
      tail: rng.range(0.86, 1.18),
      drive: rng.range(0.85, 1.2),
      mid: semis(rng.range(-2, 2)),
      level: rng.range(0.93, 1.07),
      mech: rng.range(0.8, 1.25),
      // Slight per-slot spectral tilt: microphone/room position variance.
      tilt: rng.range(-2.5, 2.5),
    });
  }
  profile._rr = rr;
  profile._rrIndex = (rng.u32() % RR_SLOTS) | 0;
  return rr;
}

/**
 * Synthesize one shot.
 *
 * @param {BaseAudioContext} actx
 * @param {import('./dsp.js').NoiseBank} bank
 * @param {import('../core/rng.js').Rng} rng
 * @param {object} profile from WEAPON_PROFILES
 * @param {object} o { when, distance, indoor, firstPerson, echo }
 * @returns {{node: GainNode, end: number, send: number}}
 */
function weaponShot(actx, bank, rng, profile, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const dist = Math.max(0, o.distance ?? 0);
  const fp = !!o.firstPerson;

  const rr = roundRobin(profile, rng);
  profile._rrIndex = (profile._rrIndex + 1) % RR_SLOTS;
  const v = rr[profile._rrIndex];

  // Per-shot jitter on top of the round-robin slot — the fine grain.
  const jB = v.body * semis(rng.range(-0.45, 0.45));
  const jC = v.crack * semis(rng.range(-0.8, 0.8));
  const jT = v.tail * rng.range(0.94, 1.07);
  const jL = v.level * rng.range(0.95, 1.05);

  // Distance mixing. Near = all crack and click; far = all boom and tail.
  const near = clamp(1 - dist / 42, 0, 1);
  const nearP = Math.pow(near, 0.7);
  const far = 1 - near;

  // VOICE TRIM — the gunshot is the loudest thing in the game and defines the
  // reference the rest of the mix is staged against.
  const out = gain(actx, 0.46);
  let end = t0 + 0.2;

  /* ---- 1. transient --------------------------------------------- */
  if (nearP > 0.05) {
    const tg = gain(actx, 0);
    const src = bank.source('white', rng, rng.range(0.9, 1.3));
    const hp = biquad(actx, 'highpass', 2600, 0.6);
    const pk = biquad(actx, 'peaking', 6200 * jC, 1.1, 8 + v.tilt);
    series(src, hp, pk, tg).connect(out);
    hit(tg.gain, t0, 0.9 * nearP * jL * (profile.suppressed ? 0.35 : 1), 0.0075);
    src.start(t0, src._offset, 0.05);
    // A single-cycle sine at the top of the click adds the "snap" that pure
    // noise cannot produce.
    const clk = osc(actx, 'triangle', 1750 * jC);
    const cg = gain(actx, 0);
    clk.connect(cg); cg.connect(out);
    hit(cg.gain, t0, 0.35 * nearP * jL, 0.004);
    clk.start(t0); clk.stop(t0 + 0.02);
  }

  /* ---- 2. body + sub -------------------------------------------- */
  {
    const bodyLevel = (0.85 + far * 0.5) * jL * profile.level;
    const b1 = osc(actx, 'sine', profile.bodyF * jB);
    const b2 = osc(actx, 'triangle', profile.bodyF * jB * 0.5);
    const bg = gain(actx, 0);
    const drv = shaper(actx, saturationCurve(profile.drive * v.drive * 0.5, profile.asym), '2x');
    const bodyLP = biquad(actx, 'lowpass', lerp(2200, 700, far), 0.9);
    b1.connect(bg); b2.connect(bg);
    series(bg, drv, bodyLP).connect(out);
    sweep(b1.frequency, t0, profile.bodyF * jB, profile.bodyF2 * jB, profile.bodyDecay * 1.4);
    sweep(b2.frequency, t0, profile.bodyF * jB * 0.5, profile.bodyF2 * jB * 0.55, profile.bodyDecay * 1.6);
    ad(bg.gain, t0, bodyLevel, 0.0012, profile.bodyDecay * rng.range(0.9, 1.15));
    b1.start(t0); b2.start(t0);
    const bEnd = t0 + profile.bodyDecay * 1.8 + 0.02;
    b1.stop(bEnd); b2.stop(bEnd);
    end = Math.max(end, bEnd);

    // Sub thump — this is the one that moves air; keep it out of the reverb.
    const s = osc(actx, 'sine', profile.subF * jB);
    const sg = gain(actx, 0);
    s.connect(sg); sg.connect(out);
    sweep(s.frequency, t0, profile.subF * jB * 1.5, profile.subF * jB * 0.8, profile.subDecay);
    ad(sg.gain, t0, (0.5 + far * 0.55) * profile.level, 0.004, profile.subDecay * 1.3);
    s.start(t0); s.stop(t0 + profile.subDecay * 2 + 0.05);
    end = Math.max(end, t0 + profile.subDecay * 2 + 0.05);
  }

  /* ---- 3. crack -------------------------------------------------- */
  if (nearP > 0.03) {
    const src = bank.source('white', rng, rng.range(0.85, 1.25));
    const bp = biquad(actx, 'bandpass', profile.crackF * jC, profile.crackQ * v.crackQ);
    const res = biquad(actx, 'peaking', profile.crackF * jC * 1.9, 1.6, 6 + v.tilt);
    const drv = shaper(actx, saturationCurve(profile.drive * v.drive, profile.asym * 0.6), '2x');
    const cg = gain(actx, 0);
    series(src, bp, res, drv, cg).connect(out);
    // The crack's own band sweeps down a little: the shock front decays.
    sweep(bp.frequency, t0, profile.crackF * jC * 1.35, profile.crackF * jC * 0.8, profile.crackDecay * 2);
    ad(cg.gain, t0, 1.05 * nearP * jL * profile.level, 0.0015, profile.crackDecay * rng.range(0.85, 1.2));
    src.start(t0, src._offset, profile.crackDecay * 3 + 0.05);
    end = Math.max(end, t0 + profile.crackDecay * 3);
  }

  /* ---- 4. mid body ---------------------------------------------- */
  {
    const src = bank.source('pink', rng, rng.range(0.8, 1.25));
    const bp = biquad(actx, 'bandpass', profile.midF * v.mid, 1.1);
    const mg = gain(actx, 0);
    series(src, bp, mg).connect(out);
    ad(mg.gain, t0, (0.5 + far * 0.35) * jL * profile.level, 0.002, profile.midDecay * 1.4);
    src.start(t0, src._offset, profile.midDecay * 4 + 0.05);
  }

  /* ---- 5. tail --------------------------------------------------- */
  {
    const tailDur = profile.tailDecay * jT * (1 + far * 1.6);
    const src = bank.source('pink', rng, rng.range(0.7, 1.15));
    const lp = biquad(actx, 'lowpass', profile.tailF, 0.6);
    const hp = biquad(actx, 'highpass', lerp(160, 70, far), 0.7);
    const tg = gain(actx, 0);
    series(src, hp, lp, tg).connect(out);
    sweep(lp.frequency, t0, profile.tailF * lerp(1, 0.35, far), profile.tailEndF * lerp(1, 0.6, far), tailDur);
    ad(tg.gain, t0, (0.42 + far * 0.5) * jL * profile.level, 0.006, tailDur);
    src.start(t0, src._offset, tailDur * 1.3 + 0.05);
    end = Math.max(end, t0 + tailDur * 1.3);
  }

  /* ---- 6. mechanical / bolt ------------------------------------- */
  // Only audible close up — a rifle 40 m away has no audible action noise, and
  // spending nodes on it would be waste.
  if (dist < 14 && profile.mechLevel > 0) {
    const md = profile.mechDelay * rng.range(0.85, 1.2);
    const lvl = profile.mechLevel * v.mech * (fp ? 1 : 0.6) * clamp(1 - dist / 14, 0.15, 1);
    const partials = profile.mechPartials;
    const bolt = struckResonator(actx, bank, rng, t0 + md, [
      { f: partials[0] * rng.range(0.96, 1.05), q: 26, g: 0.5 * lvl, decay: 0.055 },
      { f: partials[1] * rng.range(0.96, 1.05), q: 20, g: 0.34 * lvl, decay: 0.035 },
      { f: partials[2] * rng.range(0.96, 1.05), q: 14, g: 0.2 * lvl, decay: 0.02 },
    ], 0.0035);
    bolt.connect(out);
    // Return-to-battery: a second, softer clack a few ms later.
    const back = struckResonator(actx, bank, rng, t0 + md * 2.1, [
      { f: partials[0] * 0.88, q: 18, g: 0.3 * lvl, decay: 0.04 },
      { f: partials[1] * 1.12, q: 12, g: 0.16 * lvl, decay: 0.022 },
    ], 0.003);
    back.connect(out);
    // Spring/gas hiss.
    const hs = bank.source('white', rng, rng.range(1, 1.4));
    const hbp = biquad(actx, 'bandpass', 4200 * rng.range(0.9, 1.1), 1.4);
    const hg = gain(actx, 0);
    series(hs, hbp, hg).connect(out);
    ad(hg.gain, t0 + md * 0.6, 0.12 * lvl, 0.006, 0.05);
    hs.start(t0 + md * 0.6, hs._offset, 0.12);
    end = Math.max(end, t0 + md * 2.1 + 0.1);
  }

  /* ---- 7. distant rolling boom ---------------------------------- */
  if (far > 0.12) {
    const boomDur = 0.28 + dist * 0.0055;
    const src = bank.source('brown', rng, rng.range(0.6, 1.0));
    const lp = biquad(actx, 'lowpass', 420, 0.8);
    const bg = gain(actx, 0);
    series(src, lp, bg).connect(out);
    sweep(lp.frequency, t0, 620, 190, boomDur);
    ad(bg.gain, t0, 0.95 * far * far * profile.level, 0.012 + dist * 0.0004, boomDur);
    src.start(t0, src._offset, boomDur * 1.4 + 0.05);
    end = Math.max(end, t0 + boomDur * 1.4);

    // Ground/terrain bounce: one discrete slap after the direct sound. This is
    // the detail that makes long-range fire read as *outdoors*.
    const bounceT = t0 + clamp(dist * 0.0022, 0.012, 0.12);
    const b2 = bank.source('pink', rng, rng.range(0.6, 0.9));
    const blp = biquad(actx, 'lowpass', 900, 0.7);
    const b2g = gain(actx, 0);
    series(b2, blp, b2g).connect(out);
    ad(b2g.gain, bounceT, 0.3 * far, 0.004, 0.12 + dist * 0.001);
    b2.start(bounceT, b2._offset, 0.4);
  }

  /* ---- shotgun pellet spatter ----------------------------------- */
  if (profile.pellets && nearP > 0.2) {
    for (let i = 0; i < profile.pellets; i++) {
      const pt = t0 + rng.range(0.0004, 0.006);
      const src = bank.source('white', rng, rng.range(0.9, 1.4));
      const bp = biquad(actx, 'bandpass', rng.range(2600, 6200), 1.8);
      const g = gain(actx, 0);
      series(src, bp, g).connect(out);
      hit(g.gain, pt, 0.1 * nearP, rng.range(0.004, 0.014));
      src.start(pt, src._offset, 0.05);
    }
  }

  const send = profile.send * (1 + far * 1.4) * (o.echoBoost ?? 1);
  return { node: out, end: end + 0.05, send };
}

/**
 * Supersonic round passing near the listener. Tiny, cheap, and enormously
 * effective at making incoming fire feel dangerous.
 */
function bulletWhizz(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const miss = clamp(o.miss ?? 1.5, 0.15, 6); // metres from the ear
  const level = clamp(1.1 - miss / 6, 0.1, 1) * (o.gain ?? 1);
  const out = gain(actx, 3.2); // VOICE TRIM
  const src = bank.source('white', rng, rng.range(0.9, 1.2));
  const bp = biquad(actx, 'bandpass', 2400, 3.2);
  const g = gain(actx, 0);
  series(src, bp, g).connect(out);
  // The N-wave's apparent pitch drops sharply as the round passes — Doppler on
  // a Mach 2.5 projectile is violent.
  const dur = 0.055 + miss * 0.012;
  sweep(bp.frequency, t0, rng.range(3600, 5200), rng.range(900, 1500), dur);
  ad(g.gain, t0, 1.5 * level, 0.004, dur);
  src.start(t0, src._offset, dur * 2);
  // Snap of the shock front.
  const s2 = bank.source('white', rng, 1.2);
  const hp = biquad(actx, 'highpass', 4000, 0.7);
  const g2 = gain(actx, 0);
  series(s2, hp, g2).connect(out);
  hit(g2.gain, t0, 0.85 * level, 0.006);
  s2.start(t0, s2._offset, 0.03);
  return { node: out, end: t0 + dur * 2 + 0.05, send: 0.25 };
}

/** Dry-fire click when the magazine is empty. */
function dryFire(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const out = gain(actx, 1);
  const r = struckResonator(actx, bank, rng, t0, [
    { f: 2600 * rng.range(0.95, 1.05), q: 24, g: 1.2, decay: 0.035 },
    { f: 4700, q: 16, g: 0.66, decay: 0.02 },
    { f: 860, q: 10, g: 0.5, decay: 0.05 },
  ], 0.0025);
  r.connect(out);
  return { node: out, end: t0 + 0.14, send: 0.2 };
}

/**
 * AUDIO / FOLEY
 *
 * Impacts, footsteps, shell casings, reload mechanics, explosions, body falls
 * and UI. Everything is keyed off the twelve surface names in ARCHITECTURE.md
 * so physics, FX, decals and audio always agree about what was hit.
 *
 * The recurring recipe for a physical impact is:
 *   transient (contact)  +  body (mass)  +  texture (material)  +  debris
 * Which of those four dominates is what makes concrete sound like concrete and
 * flesh sound like flesh; the envelope shapes matter far more than the exact
 * filter frequencies.
 */

/**
 * Per-surface impact recipe.
 *  bodyF/bodyDecay  the mass thump
 *  ring             high-Q partials (metal, glass, wood) or null
 *  tex              { kind, f, q, decay, level } the material texture burst
 *  grains           number of debris grains
 *  bright           transient level 0..1
 *  wet              reverb send
 */
const IMPACT = {
  concrete: {
    bright: 0.85, bodyF: 180, bodyDecay: 0.05, ring: null,
    tex: { kind: 'white', f: 2600, q: 0.9, decay: 0.075, level: 0.75 },
    dust: { f: 1200, decay: 0.3, level: 0.16 }, grains: 5, wet: 0.4,
  },
  plaster: {
    bright: 0.7, bodyF: 220, bodyDecay: 0.035, ring: null,
    tex: { kind: 'white', f: 1900, q: 0.8, decay: 0.05, level: 0.6 },
    dust: { f: 900, decay: 0.42, level: 0.26 }, grains: 6, wet: 0.42,
  },
  metal: {
    bright: 1.0, bodyF: 150, bodyDecay: 0.035,
    ring: [{ f: 1750, q: 34, g: 0.42, decay: 0.28 }, { f: 3120, q: 26, g: 0.3, decay: 0.17 },
      { f: 5400, q: 18, g: 0.18, decay: 0.09 }, { f: 8100, q: 12, g: 0.09, decay: 0.05 }],
    tex: { kind: 'white', f: 5200, q: 1.2, decay: 0.03, level: 0.5 },
    dust: null, grains: 3, wet: 0.5,
  },
  wood: {
    bright: 0.6, bodyF: 320, bodyDecay: 0.055,
    ring: [{ f: 420, q: 14, g: 0.35, decay: 0.11 }, { f: 780, q: 11, g: 0.2, decay: 0.07 },
      { f: 1520, q: 8, g: 0.1, decay: 0.04 }],
    tex: { kind: 'white', f: 1500, q: 1.0, decay: 0.045, level: 0.45 },
    dust: null, grains: 5, wet: 0.32,
  },
  dirt: {
    bright: 0.25, bodyF: 120, bodyDecay: 0.07, ring: null,
    tex: { kind: 'brown', f: 700, q: 0.7, decay: 0.09, level: 0.7 },
    dust: { f: 600, decay: 0.34, level: 0.2 }, grains: 4, wet: 0.2,
  },
  sand: {
    bright: 0.18, bodyF: 105, bodyDecay: 0.055, ring: null,
    tex: { kind: 'white', f: 1500, q: 0.5, decay: 0.13, level: 0.5 },
    dust: { f: 1000, decay: 0.4, level: 0.24 }, grains: 3, wet: 0.16,
  },
  glass: {
    bright: 1.0, bodyF: 500, bodyDecay: 0.02,
    ring: [{ f: 3400, q: 40, g: 0.34, decay: 0.13 }, { f: 5300, q: 34, g: 0.26, decay: 0.1 },
      { f: 7900, q: 26, g: 0.2, decay: 0.07 }, { f: 11200, q: 18, g: 0.12, decay: 0.05 }],
    tex: { kind: 'crackle', f: 6000, q: 0.9, decay: 0.28, level: 0.6 },
    dust: null, grains: 11, wet: 0.46,
  },
  water: {
    bright: 0.3, bodyF: 260, bodyDecay: 0.03, ring: null,
    tex: { kind: 'white', f: 1800, q: 0.8, decay: 0.14, level: 0.75, rise: true },
    dust: null, grains: 4, wet: 0.3, bubbles: true,
  },
  foliage: {
    bright: 0.25, bodyF: 380, bodyDecay: 0.02, ring: null,
    tex: { kind: 'crackle', f: 2600, q: 0.8, decay: 0.16, level: 0.6 },
    dust: null, grains: 7, wet: 0.22,
  },
  fabric: {
    bright: 0.2, bodyF: 150, bodyDecay: 0.045, ring: null,
    tex: { kind: 'white', f: 900, q: 0.6, decay: 0.06, level: 0.4 },
    dust: { f: 700, decay: 0.2, level: 0.1 }, grains: 2, wet: 0.18,
  },
  flesh: {
    bright: 0.35, bodyF: 128, bodyDecay: 0.06, ring: null,
    tex: { kind: 'white', f: 620, q: 1.4, decay: 0.055, level: 0.62 },
    dust: null, grains: 3, wet: 0.24, wet_squelch: true,
  },
  rubber: {
    bright: 0.3, bodyF: 190, bodyDecay: 0.04,
    ring: [{ f: 260, q: 9, g: 0.2, decay: 0.06 }],
    tex: { kind: 'white', f: 1100, q: 0.9, decay: 0.03, level: 0.3 },
    dust: null, grains: 1, wet: 0.2,
  },
};

/* ------------------------------------------------------------------ */
/* Bullet impacts                                                     */
/* ------------------------------------------------------------------ */

/**
 * @param {object} o { when, surface, energy (0..1.5), distance }
 */
function surfaceImpact(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const s = IMPACT[o.surface] ?? IMPACT.concrete;
  const e = clamp(o.energy ?? 1, 0.15, 1.6);
  const jit = semis(rng.range(-2.5, 2.5));
  const out = gain(actx, 0.22);  // VOICE TRIM
  let end = t0 + 0.2;

  /* transient */
  if (s.bright > 0.05) {
    const src = bank.source('white', rng, rng.range(0.9, 1.35));
    const hp = biquad(actx, 'highpass', 3000 * jit, 0.7);
    const g = gain(actx, 0);
    series(src, hp, g).connect(out);
    hit(g.gain, t0, 0.55 * s.bright * e, rng.range(0.003, 0.008));
    src.start(t0, src._offset, 0.04);
  }

  /* body */
  {
    const b = osc(actx, 'sine', s.bodyF * jit);
    const g = gain(actx, 0);
    const drv = shaper(actx, saturationCurve(2.5, 0.4), '2x');
    b.connect(g); series(g, drv).connect(out);
    sweep(b.frequency, t0, s.bodyF * jit * 1.6, s.bodyF * jit * 0.7, s.bodyDecay * 1.5);
    ad(g.gain, t0, 0.5 * e, 0.0015, s.bodyDecay * rng.range(0.85, 1.2));
    b.start(t0); b.stop(t0 + s.bodyDecay * 2.2 + 0.02);
    end = Math.max(end, t0 + s.bodyDecay * 2.2);
  }

  /* material texture */
  {
    const tx = s.tex;
    const src = bank.source(tx.kind, rng, rng.range(0.8, 1.3));
    const bp = biquad(actx, 'bandpass', tx.f * jit, tx.q);
    const g = gain(actx, 0);
    series(src, bp, g).connect(out);
    if (tx.rise) sweep(bp.frequency, t0, tx.f * 0.4, tx.f * 2.2, tx.decay);
    else sweep(bp.frequency, t0, tx.f * 1.5 * jit, tx.f * 0.6 * jit, tx.decay * 1.6);
    ad(g.gain, t0, tx.level * e, tx.rise ? 0.008 : 0.0015, tx.decay * rng.range(0.85, 1.25));
    src.start(t0, src._offset, tx.decay * 3 + 0.05);
    end = Math.max(end, t0 + tx.decay * 3);
  }

  /* resonant ring (metal / glass / wood) */
  if (s.ring) {
    const parts = [];
    for (const p of s.ring) {
      parts.push({
        f: p.f * semis(rng.range(-3, 3)),
        q: p.q * rng.range(0.8, 1.25),
        g: p.g * e,
        decay: p.decay * rng.range(0.75, 1.3),
      });
    }
    const r = struckResonator(actx, bank, rng, t0, parts, 0.0035);
    r.connect(out);
    end = Math.max(end, t0 + 0.4);
  }

  /* dust / powder cloud */
  if (s.dust) {
    const src = bank.source('white', rng, rng.range(0.7, 1.1));
    const lp = biquad(actx, 'lowpass', s.dust.f, 0.8);
    const g = gain(actx, 0);
    series(src, lp, g).connect(out);
    sweep(lp.frequency, t0, s.dust.f * 1.4, s.dust.f * 0.5, s.dust.decay);
    ad(g.gain, t0, s.dust.level * e, 0.02, s.dust.decay * rng.range(0.8, 1.3));
    src.start(t0, src._offset, s.dust.decay * 2 + 0.05);
    end = Math.max(end, t0 + s.dust.decay * 2);
  }

  /* debris grains — chips, splinters, glass shards landing */
  const grains = Math.round(s.grains * clamp(e, 0.3, 1.4));
  for (let i = 0; i < grains; i++) {
    const gt = t0 + rng.range(0.015, 0.06) + i * rng.range(0.01, 0.055);
    const r = struckResonator(actx, bank, rng, gt, [
      { f: rng.range(1800, 9000), q: rng.range(12, 30), g: rng.range(0.02, 0.05) * e, decay: rng.range(0.01, 0.05) },
    ], 0.0018);
    r.connect(out);
    end = Math.max(end, gt + 0.08);
  }

  /* water bubbles */
  if (s.bubbles) {
    for (let i = 0; i < 4; i++) {
      const bt = t0 + rng.range(0.02, 0.18);
      const b = osc(actx, 'sine', rng.range(400, 1400));
      const g = gain(actx, 0);
      b.connect(g); g.connect(out);
      sweep(b.frequency, bt, rng.range(350, 700), rng.range(900, 2200), 0.05);
      hit(g.gain, bt, rng.range(0.04, 0.1) * e, 0.05);
      b.start(bt); b.stop(bt + 0.12);
      end = Math.max(end, bt + 0.14);
    }
  }

  /* flesh squelch */
  if (s.wet_squelch) {
    const src = bank.source('pink', rng, rng.range(0.7, 1.1));
    const bp = biquad(actx, 'bandpass', 380, 2.2);
    const g = gain(actx, 0);
    series(src, bp, g).connect(out);
    sweep(bp.frequency, t0, 260, 900, 0.09);
    ad(g.gain, t0 + 0.004, 0.4 * e, 0.006, 0.1);
    src.start(t0, src._offset, 0.25);
  }

  return { node: out, end: end + 0.05, send: s.wet };
}

/* ------------------------------------------------------------------ */
/* Footsteps                                                          */
/* ------------------------------------------------------------------ */

/** Per-surface footstep character. */
const STEP = {
  concrete: { bodyF: 92, bodyDecay: 0.055, texKind: 'white', texF: 2100, texQ: 0.7, texDecay: 0.045, texLevel: 0.5, scuff: 0.35, grit: 4 },
  plaster:  { bodyF: 100, bodyDecay: 0.05, texKind: 'white', texF: 1800, texQ: 0.7, texDecay: 0.05, texLevel: 0.45, scuff: 0.3, grit: 4 },
  metal:    { bodyF: 120, bodyDecay: 0.05, texKind: 'white', texF: 3200, texQ: 1.0, texDecay: 0.04, texLevel: 0.5, scuff: 0.3, grit: 2,
    ring: [{ f: 620, q: 16, g: 0.24, decay: 0.16 }, { f: 1480, q: 20, g: 0.16, decay: 0.11 }, { f: 2900, q: 14, g: 0.08, decay: 0.06 }] },
  wood:     { bodyF: 110, bodyDecay: 0.06, texKind: 'white', texF: 1300, texQ: 0.8, texDecay: 0.04, texLevel: 0.4, scuff: 0.28, grit: 2,
    ring: [{ f: 260, q: 12, g: 0.26, decay: 0.09 }, { f: 540, q: 9, g: 0.14, decay: 0.05 }] },
  dirt:     { bodyF: 78, bodyDecay: 0.07, texKind: 'brown', texF: 620, texQ: 0.6, texDecay: 0.075, texLevel: 0.62, scuff: 0.45, grit: 6 },
  sand:     { bodyF: 70, bodyDecay: 0.06, texKind: 'white', texF: 1500, texQ: 0.45, texDecay: 0.14, texLevel: 0.6, scuff: 0.7, grit: 3 },
  glass:    { bodyF: 96, bodyDecay: 0.04, texKind: 'crackle', texF: 5200, texQ: 0.8, texDecay: 0.2, texLevel: 0.6, scuff: 0.3, grit: 9 },
  water:    { bodyF: 88, bodyDecay: 0.045, texKind: 'white', texF: 1600, texQ: 0.7, texDecay: 0.17, texLevel: 0.8, scuff: 0.5, grit: 3, splash: true },
  foliage:  { bodyF: 84, bodyDecay: 0.05, texKind: 'crackle', texF: 2400, texQ: 0.7, texDecay: 0.18, texLevel: 0.7, scuff: 0.5, grit: 6 },
  fabric:   { bodyF: 82, bodyDecay: 0.05, texKind: 'white', texF: 800, texQ: 0.6, texDecay: 0.05, texLevel: 0.3, scuff: 0.35, grit: 0 },
  flesh:    { bodyF: 86, bodyDecay: 0.055, texKind: 'white', texF: 520, texQ: 1.2, texDecay: 0.05, texLevel: 0.35, scuff: 0.2, grit: 0 },
  rubber:   { bodyF: 96, bodyDecay: 0.04, texKind: 'white', texF: 1000, texQ: 0.8, texDecay: 0.03, texLevel: 0.28, scuff: 0.2, grit: 0 },
};

/**
 * @param {object} o { when, surface, gait: 'walk'|'run'|'sprint'|'crouch'|'land',
 *                     level, gear (0..1), distance }
 */
function footstep(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const s = STEP[o.surface] ?? STEP.concrete;
  const gait = o.gait ?? 'walk';
  const weight = gait === 'sprint' ? 1.25 : gait === 'run' ? 1.0 : gait === 'land' ? 1.7 : gait === 'crouch' ? 0.42 : 0.62;
  const lvl = (o.level ?? 1) * weight;
  const jit = semis(rng.range(-3, 3));
  const out = gain(actx, 0.32);  // VOICE TRIM
  let end = t0 + 0.3;

  /* heel/toe transient — two contacts, milliseconds apart, is what reads as a
     foot rather than a hammer. */
  const contacts = gait === 'land' ? 1 : 2;
  for (let c = 0; c < contacts; c++) {
    const ct = t0 + (c === 0 ? 0 : rng.range(0.012, 0.032));
    const cl = c === 0 ? 1 : rng.range(0.35, 0.6);

    const b = osc(actx, 'sine', s.bodyF * jit);
    const bg = gain(actx, 0);
    const drv = shaper(actx, saturationCurve(1.8, 0.5), '2x');
    b.connect(bg); series(bg, drv).connect(out);
    sweep(b.frequency, ct, s.bodyF * jit * 1.7, s.bodyF * jit * 0.75, s.bodyDecay * 1.4);
    ad(bg.gain, ct, 0.42 * lvl * cl, 0.0025, s.bodyDecay * rng.range(0.85, 1.2));
    b.start(ct); b.stop(ct + s.bodyDecay * 2.4 + 0.02);

    const src = bank.source(s.texKind, rng, rng.range(0.8, 1.25));
    const bp = biquad(actx, 'bandpass', s.texF * jit, s.texQ);
    const tg = gain(actx, 0);
    series(src, bp, tg).connect(out);
    sweep(bp.frequency, ct, s.texF * 1.4 * jit, s.texF * 0.55 * jit, s.texDecay * 2);
    ad(tg.gain, ct, s.texLevel * lvl * cl, 0.002, s.texDecay * rng.range(0.8, 1.3));
    src.start(ct, src._offset, s.texDecay * 3 + 0.05);
    end = Math.max(end, ct + s.texDecay * 3);

    if (s.ring && c === 0) {
      const parts = s.ring.map((p) => ({
        f: p.f * semis(rng.range(-2, 2)), q: p.q * rng.range(0.85, 1.2),
        g: p.g * lvl, decay: p.decay * rng.range(0.8, 1.25),
      }));
      struckResonator(actx, bank, rng, ct, parts, 0.003).connect(out);
      end = Math.max(end, ct + 0.3);
    }
  }

  /* scuff — the slide of the sole, longer when running */
  if (s.scuff > 0.05) {
    const st = t0 + rng.range(0.01, 0.04);
    const dur = (gait === 'sprint' ? 0.13 : gait === 'run' ? 0.1 : 0.07) * rng.range(0.8, 1.3);
    const src = bank.source('white', rng, rng.range(0.85, 1.2));
    const bp = biquad(actx, 'bandpass', rng.range(2200, 4200), 0.8);
    const g = gain(actx, 0);
    series(src, bp, g).connect(out);
    sweep(bp.frequency, st, rng.range(2800, 4600), rng.range(1200, 2000), dur);
    ad(g.gain, st, s.scuff * lvl * 0.5, 0.012, dur);
    src.start(st, src._offset, dur * 2);
    end = Math.max(end, st + dur * 2);
  }

  /* grit grains */
  for (let i = 0; i < s.grit; i++) {
    if (rng.float() > 0.55) continue;
    const gt = t0 + rng.range(0.004, 0.09);
    struckResonator(actx, bank, rng, gt, [
      { f: rng.range(2400, 9000), q: rng.range(10, 26), g: rng.range(0.015, 0.05) * lvl, decay: rng.range(0.008, 0.03) },
    ], 0.0015).connect(out);
  }

  /* water splash */
  if (s.splash) {
    const src = bank.source('white', rng, rng.range(0.9, 1.2));
    const bp = biquad(actx, 'bandpass', 900, 0.7);
    const g = gain(actx, 0);
    series(src, bp, g).connect(out);
    sweep(bp.frequency, t0, 700, 3400, 0.16);
    ad(g.gain, t0 + 0.006, 0.45 * lvl, 0.01, 0.2);
    src.start(t0, src._offset, 0.4);
    end = Math.max(end, t0 + 0.42);
  }

  /* gear: sling swivels, mag pouches, buckles — only when moving fast */
  const gear = (o.gear ?? (gait === 'sprint' ? 1 : gait === 'run' ? 0.7 : gait === 'land' ? 0.9 : 0.25));
  if (gear > 0.05) {
    const n = 1 + ((rng.u32() % 3) | 0);
    for (let i = 0; i < n; i++) {
      const gt = t0 + rng.range(0.005, 0.11);
      struckResonator(actx, bank, rng, gt, [
        { f: rng.range(1600, 4200), q: rng.range(18, 40), g: rng.range(0.03, 0.1) * gear * lvl, decay: rng.range(0.03, 0.12) },
        { f: rng.range(4200, 8000), q: rng.range(12, 26), g: rng.range(0.01, 0.04) * gear * lvl, decay: rng.range(0.01, 0.05) },
      ], 0.002).connect(out);
      end = Math.max(end, gt + 0.18);
    }
    // Cloth/webbing rustle.
    const src = bank.source('white', rng, rng.range(0.7, 1.1));
    const bp = biquad(actx, 'bandpass', rng.range(1400, 2600), 0.6);
    const g = gain(actx, 0);
    series(src, bp, g).connect(out);
    ad(g.gain, t0, 0.09 * gear * lvl, 0.02, 0.13);
    src.start(t0, src._offset, 0.3);
  }

  return { node: out, end: end + 0.05, send: 0.3 };
}

/** Cloth movement, used for stance changes and ADS. */
/**
 * Reload mechanics, one call per `weapon:reload` phase. Keeping the phases as
 * separate one-shots (instead of one long sound) is what lets the audio stay
 * locked to the animation whatever its length.
 */
/** The four phases are wildly different in energy; level them per phase. */
const RELOAD_TRIM = { start: 3.2, magout: 3.0, magin: 1.0, end: 1.5 };

function reloadPhase(actx, bank, rng, phase, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const heavy = o.heavy ?? 1; // LMG/shotgun = heavier hardware
  const out = gain(actx, 0.42 * (RELOAD_TRIM[phase] ?? 1.5)); // VOICE TRIM
  let end = t0 + 0.3;
  const metal = (t, parts, exc = 0.0025) => {
    struckResonator(actx, bank, rng, t, parts, exc).connect(out);
    end = Math.max(end, t + 0.35);
  };
  const rustle = (t, dur, level, f) => {
    const src = bank.source('white', rng, rng.range(0.8, 1.2));
    const bp = biquad(actx, 'bandpass', f, 0.6);
    const g = gain(actx, 0);
    series(src, bp, g).connect(out);
    ad(g.gain, t, level, 0.02, dur);
    src.start(t, src._offset, dur * 2 + 0.05);
    end = Math.max(end, t + dur * 2);
  };

  switch (phase) {
    case 'start':
      // Hand leaves the grip, palm slaps the magwell, mag catch is pressed.
      rustle(t0, 0.18, 0.2, rng.range(1400, 2200));
      metal(t0 + rng.range(0.04, 0.08), [
        { f: 2450 * semis(rng.range(-2, 2)), q: 30, g: 0.55 * heavy, decay: 0.03 },
        { f: 5100, q: 18, g: 0.25, decay: 0.016 },
        { f: 780, q: 10, g: 0.3 * heavy, decay: 0.045 },
      ]);
      break;

    case 'magout': {
      // Spring release, mag scrapes out of the well, then plastic hits the deck.
      metal(t0, [
        { f: 1650 * semis(rng.range(-2, 2)), q: 24, g: 0.65 * heavy, decay: 0.05 },
        { f: 3400, q: 16, g: 0.35, decay: 0.025 },
      ]);
      const st = t0 + 0.03;
      const src = bank.source('white', rng, rng.range(0.9, 1.3));
      const bp = biquad(actx, 'bandpass', 3200, 1.1);
      const g = gain(actx, 0);
      series(src, bp, g).connect(out);
      sweep(bp.frequency, st, 4200, 1600, 0.12);
      ad(g.gain, st, 0.2, 0.01, 0.12);
      src.start(st, src._offset, 0.3);
      // Empty magazine hitting the ground — polymer, not metal.
      const dt = t0 + rng.range(0.16, 0.3);
      metal(dt, [
        { f: 480 * semis(rng.range(-3, 3)), q: 9, g: 0.2, decay: 0.05 },
        { f: 1180, q: 7, g: 0.11, decay: 0.03 },
        { f: 2600, q: 5, g: 0.05, decay: 0.015 },
      ], 0.004);
      end = Math.max(end, dt + 0.3);
      break;
    }

    case 'magin': {
      // Fresh mag guided in, seated with a palm strike: a low thunk plus a sharp
      // latch click. The thunk needs real low end or it feels weightless.
      rustle(t0, 0.12, 0.16, rng.range(1200, 2000));
      const it = t0 + rng.range(0.05, 0.1);
      const b = osc(actx, 'sine', 190 * heavy);
      const bg = gain(actx, 0);
      const drv = shaper(actx, saturationCurve(3, 0.5), '2x');
      b.connect(bg); series(bg, drv).connect(out);
      sweep(b.frequency, it, 230 * heavy, 110 * heavy, 0.06);
      ad(bg.gain, it, 0.4 * heavy, 0.002, 0.055);
      b.start(it); b.stop(it + 0.16);
      metal(it, [
        { f: 1250 * semis(rng.range(-2, 2)), q: 20, g: 0.3 * heavy, decay: 0.06 },
        { f: 2800, q: 26, g: 0.18, decay: 0.03 },
        { f: 6200, q: 14, g: 0.07, decay: 0.012 },
      ], 0.003);
      metal(it + rng.range(0.02, 0.05), [
        { f: 3600, q: 34, g: 0.16, decay: 0.02 },
        { f: 7400, q: 20, g: 0.07, decay: 0.01 },
      ], 0.0015);
      break;
    }

    case 'end':
    default: {
      // Charging handle: scrape, hard rearward stop, spring-driven return, and
      // the bolt slamming into battery.
      const st = t0;
      const src = bank.source('white', rng, rng.range(0.9, 1.25));
      const bp = biquad(actx, 'bandpass', 2600, 1.6);
      const g = gain(actx, 0);
      series(src, bp, g).connect(out);
      sweep(bp.frequency, st, 1800, 4200, 0.07);
      ad(g.gain, st, 0.24, 0.008, 0.07);
      src.start(st, src._offset, 0.2);
      metal(st + 0.06, [
        { f: 1450 * semis(rng.range(-2, 2)), q: 22, g: 0.3 * heavy, decay: 0.05 },
        { f: 3100, q: 18, g: 0.16, decay: 0.022 },
      ]);
      // Spring ring — the metallic "zing" behind the clack.
      metal(st + 0.065, [
        { f: 4900 * semis(rng.range(-3, 3)), q: 46, g: 0.09, decay: 0.16 },
        { f: 7200, q: 38, g: 0.05, decay: 0.1 },
      ], 0.002);
      const bt = st + rng.range(0.1, 0.15);
      const b = osc(actx, 'sine', 150 * heavy);
      const bg = gain(actx, 0);
      b.connect(bg); bg.connect(out);
      sweep(b.frequency, bt, 200 * heavy, 90 * heavy, 0.05);
      ad(bg.gain, bt, 0.38 * heavy, 0.0015, 0.05);
      b.start(bt); b.stop(bt + 0.14);
      metal(bt, [
        { f: 1750, q: 20, g: 0.34 * heavy, decay: 0.05 },
        { f: 3900, q: 15, g: 0.15, decay: 0.02 },
        { f: 8200, q: 10, g: 0.05, decay: 0.008 },
      ], 0.0035);
      break;
    }
  }
  return { node: out, end: end + 0.05, send: 0.3 };
}

/* ------------------------------------------------------------------ */
/* Explosions                                                         */
/* ------------------------------------------------------------------ */

/**
 * @param {object} o { when, distance, radius, level }
 * Near: a violent transient, a huge sub sweep and a bright shrapnel spatter.
 * Far: almost no transient, a long rolling low rumble, and a big wet tail.
 */
function explosion(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const dist = Math.max(0, o.distance ?? 0);
  const size = clamp((o.radius ?? 6) / 6, 0.5, 2.4);
  const near = clamp(1 - dist / 70, 0, 1);
  const far = 1 - near;
  const lvl = (o.level ?? 1) * size;
  const out = gain(actx, 0.42); // VOICE TRIM
  let end = t0 + 1;

  /* detonation transient */
  if (near > 0.05) {
    const src = bank.source('white', rng, rng.range(0.9, 1.2));
    const hp = biquad(actx, 'highpass', 1800, 0.6);
    const drv = shaper(actx, saturationCurve(14, 0.7), '4x');
    const g = gain(actx, 0);
    series(src, hp, drv, g).connect(out);
    hit(g.gain, t0, 0.85 * near * lvl, 0.02);
    src.start(t0, src._offset, 0.1);
  }

  /* sub-bass impact: the thing you feel in your chest */
  {
    const s = osc(actx, 'sine', 110);
    const s2 = osc(actx, 'triangle', 62);
    const g = gain(actx, 0);
    const drv = shaper(actx, saturationCurve(4, 0.6), '2x');
    const lp = biquad(actx, 'lowpass', 220, 0.9);
    s.connect(g); s2.connect(g);
    series(g, drv, lp).connect(out);
    const subDur = (0.55 + size * 0.35) * rng.range(0.9, 1.15);
    sweep(s.frequency, t0, 130 * size, 26, subDur);
    sweep(s2.frequency, t0, 74 * size, 21, subDur * 1.2);
    ad(g.gain, t0, 1.0 * lvl * (0.55 + near * 0.6), 0.008 + far * 0.05, subDur);
    s.start(t0); s2.start(t0);
    s.stop(t0 + subDur * 1.6); s2.stop(t0 + subDur * 1.6);
    end = Math.max(end, t0 + subDur * 1.6);
  }

  /* blast body: broadband noise under a fast-falling lowpass */
  {
    const dur = (0.45 + size * 0.5) * (1 + far * 1.8);
    const src = bank.source('brown', rng, rng.range(0.6, 1.1));
    const lp = biquad(actx, 'lowpass', 6000, 0.8);
    const drv = shaper(actx, saturationCurve(6, 0.5), '2x');
    const g = gain(actx, 0);
    series(src, lp, drv, g).connect(out);
    sweep(lp.frequency, t0, lerp(7000, 700, far), lerp(260, 130, far), dur);
    ad(g.gain, t0, 0.8 * lvl, 0.01 + far * 0.06, dur);
    src.start(t0, src._offset, dur * 1.4 + 0.1);
    end = Math.max(end, t0 + dur * 1.4);
  }

  /* debris / shrapnel: grains scattered over the following second */
  const grains = Math.round(lerp(26, 4, far) * size);
  for (let i = 0; i < grains; i++) {
    const gt = t0 + rng.range(0.02, 0.9) * rng.range(0.3, 1);
    struckResonator(actx, bank, rng, gt, [
      { f: rng.range(700, 7000), q: rng.range(8, 32), g: rng.range(0.02, 0.09) * near * lvl, decay: rng.range(0.01, 0.09) },
    ], 0.002).connect(out);
    end = Math.max(end, gt + 0.15);
  }

  /* dust and settling */
  {
    const dur = 1.0 + size * 0.8;
    const src = bank.source('pink', rng, rng.range(0.5, 0.9));
    const lp = biquad(actx, 'lowpass', 1400, 0.7);
    const g = gain(actx, 0);
    series(src, lp, g).connect(out);
    sweep(lp.frequency, t0, 1600, 320, dur);
    ad(g.gain, t0 + 0.05, 0.2 * lvl * (0.4 + near * 0.6), 0.12, dur);
    src.start(t0 + 0.05, src._offset, dur * 1.3);
    end = Math.max(end, t0 + dur * 1.3);
  }

  return { node: out, end: end + 0.1, send: 0.85 + far * 0.5 };
}

/** A body hitting the ground: mass, gear, and a wet slap. */
function bodyFall(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const lvl = o.level ?? 1;
  const out = gain(actx, 0.4); // VOICE TRIM
  const b = osc(actx, 'sine', 74);
  const bg = gain(actx, 0);
  const drv = shaper(actx, saturationCurve(2.2, 0.55), '2x');
  b.connect(bg); series(bg, drv).connect(out);
  sweep(b.frequency, t0, 96, 44, 0.12);
  ad(bg.gain, t0, 0.6 * lvl, 0.004, 0.13);
  b.start(t0); b.stop(t0 + 0.35);

  const src = bank.source('white', rng, rng.range(0.7, 1.1));
  const lp = biquad(actx, 'lowpass', 900, 0.8);
  const g = gain(actx, 0);
  series(src, lp, g).connect(out);
  ad(g.gain, t0, 0.35 * lvl, 0.006, 0.16);
  src.start(t0, src._offset, 0.4);

  for (let i = 0; i < 5; i++) {
    const gt = t0 + rng.range(0.005, 0.26);
    struckResonator(actx, bank, rng, gt, [
      { f: rng.range(1500, 5200), q: rng.range(16, 40), g: rng.range(0.03, 0.09) * lvl, decay: rng.range(0.02, 0.1) },
    ], 0.002).connect(out);
  }
  return { node: out, end: t0 + 0.6, send: 0.4 };
}

/* ------------------------------------------------------------------ */
/* UI                                                                 */
/* ------------------------------------------------------------------ */

/** Non-diegetic feedback. Short, dry, and deliberately synthetic. */
function uiSound(actx, bank, rng, kind, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const out = gain(actx, 1);
  const lvl = o.level ?? 1;
  switch (kind) {
    case 'hitmarker': {
      const o1 = osc(actx, 'square', 2400);
      const g = gain(actx, 0);
      const lp = biquad(actx, 'lowpass', 5200, 0.7);
      o1.connect(g); series(g, lp).connect(out);
      hit(g.gain, t0, 0.55 * lvl, 0.022);
      o1.start(t0); o1.stop(t0 + 0.06);
      break;
    }
    case 'headshot': {
      const o1 = osc(actx, 'square', 3200);
      const o2 = osc(actx, 'square', 4800);
      const g = gain(actx, 0);
      o1.connect(g); o2.connect(g); g.connect(out);
      hit(g.gain, t0, 0.34 * lvl, 0.05);
      o1.start(t0); o2.start(t0 + 0.03);
      o1.stop(t0 + 0.12); o2.stop(t0 + 0.14);
      break;
    }
    case 'kill': {
      for (let i = 0; i < 3; i++) {
        const o1 = osc(actx, 'triangle', 900 * Math.pow(1.5, i));
        const g = gain(actx, 0);
        o1.connect(g); g.connect(out);
        ad(g.gain, t0 + i * 0.055, 0.3 * lvl, 0.004, 0.09);
        o1.start(t0 + i * 0.055); o1.stop(t0 + i * 0.055 + 0.2);
      }
      break;
    }
    case 'damage': {
      // Directional pain sting: a dissonant low pair, no melody.
      const o1 = osc(actx, 'sawtooth', 180);
      const o2 = osc(actx, 'sawtooth', 191);
      const g = gain(actx, 0);
      const lp = biquad(actx, 'lowpass', 1400, 1.4);
      o1.connect(g); o2.connect(g); series(g, lp).connect(out);
      ad(g.gain, t0, 0.42 * lvl, 0.004, 0.22);
      o1.start(t0); o2.start(t0);
      o1.stop(t0 + 0.4); o2.stop(t0 + 0.4);
      break;
    }
    case 'armour': {
      // Ceramic plate strike: brighter and harder than a flesh hitmarker.
      const r = struckResonator(actx, bank, rng, t0, [
        { f: 3900, q: 30, g: 0.09 * lvl, decay: 0.045 },
        { f: 6400, q: 22, g: 0.05 * lvl, decay: 0.025 },
      ], 0.0015);
      r.connect(out);
      break;
    }
    case 'grenade_warn': {
      // Three rising beeps — reads as "danger", not as a notification.
      for (let i = 0; i < 3; i++) {
        const bt = t0 + i * 0.14;
        const o1 = osc(actx, 'square', 1150 * Math.pow(1.19, i));
        const lp = biquad(actx, 'lowpass', 4200, 0.8);
        const g = gain(actx, 0);
        o1.connect(g); series(g, lp).connect(out);
        ad(g.gain, bt, 0.3 * lvl, 0.004, 0.07);
        o1.start(bt); o1.stop(bt + 0.16);
      }
      break;
    }
    case 'regen': {
      // Soft filtered swell: the "you are OK now" cue. Deliberately unpitched.
      const src = bank.source('pink', rng, 0.9);
      const bp = biquad(actx, 'bandpass', 700, 1.1);
      const g = gain(actx, 0);
      series(src, bp, g).connect(out);
      sweep(bp.frequency, t0, 500, 1900, 0.5);
      ad(g.gain, t0, 0.3 * lvl, 0.15, 0.45);
      src.start(t0, src._offset, 0.9);
      const o1 = osc(actx, 'sine', 420);
      const og = gain(actx, 0);
      o1.connect(og); og.connect(out);
      sweep(o1.frequency, t0, 380, 640, 0.45);
      ad(og.gain, t0, 0.12 * lvl, 0.14, 0.4);
      o1.start(t0); o1.stop(t0 + 0.8);
      break;
    }
    case 'lowhealth': {
      const o1 = osc(actx, 'sine', 92);
      const g = gain(actx, 0);
      o1.connect(g); g.connect(out);
      ad(g.gain, t0, 0.45 * lvl, 0.05, 0.55);
      o1.start(t0); o1.stop(t0 + 0.9);
      break;
    }
    default: {
      const o1 = osc(actx, 'sine', 1200);
      const g = gain(actx, 0);
      o1.connect(g); g.connect(out);
      hit(g.gain, t0, 0.26 * lvl, 0.03);
      o1.start(t0); o1.stop(t0 + 0.08);
    }
  }
  return { node: out, end: t0 + 0.9, send: 0 };
}

/**
 * Heartbeat + laboured breathing for low health. Returned so the caller can
 * schedule it repeatedly rather than looping a node.
 */
function heartbeat(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const lvl = o.level ?? 1;
  const out = gain(actx, 0.5); // VOICE TRIM
  for (let i = 0; i < 2; i++) {
    const bt = t0 + i * 0.19;
    const b = osc(actx, 'sine', 58);
    const g = gain(actx, 0);
    b.connect(g); g.connect(out);
    sweep(b.frequency, bt, 72, 42, 0.1);
    ad(g.gain, bt, (i === 0 ? 0.5 : 0.33) * lvl, 0.008, 0.11);
    b.start(bt); b.stop(bt + 0.3);
  }
  return { node: out, end: t0 + 0.6, send: 0.1 };
}

/**
 * AUDIO / VOICE — formant synthesis for enemy barks
 *
 * No speech samples, so barks are built the way a vocal tract works:
 *
 *   glottal pulse train (PeriodicWave, 1/n^1.15 harmonics)
 *     + aspiration noise
 *     ─► three parallel band-passes at the formant frequencies F1..F3
 *     ─► chest/throat shaping, presence peak, mild saturation (shouting)
 *     + separately mixed consonant bursts (plosives and fricatives)
 *
 * The formant centres are ramped between vowels, the f0 follows a per-syllable
 * pitch contour, and both are jittered every ~25 ms. That jitter is the single
 * most important ingredient: without it the result is a Speak&Spell, with it a
 * player reads it as a human shouting a word they cannot quite make out — which
 * is exactly the goal for enemy chatter at 30 m.
 */

/** F1, F2, F3 (Hz) and their bandwidths, adult male, shouted register. */
const VOWELS = {
  a: [730, 1090, 2440, 110, 130, 180],  // "father"
  e: [530, 1840, 2480, 90, 120, 170],   // "bed"
  i: [300, 2290, 3010, 70, 130, 190],   // "see"
  o: [570, 840, 2410, 90, 110, 170],    // "law"
  u: [325, 700, 2530, 70, 100, 170],    // "boot"
  ah: [640, 1200, 2500, 110, 140, 190],
  ehr: [490, 1350, 1690, 100, 130, 180], // "her"
  ohh: [450, 900, 2300, 95, 115, 175],
};

/**
 * Bark scripts. Each syllable: v vowel, d duration, a amplitude, p pitch
 * multiplier, on onset consonant ('p' plosive, 'f' fricative, 'n' nasal),
 * g gap after the syllable.
 */
const BARKS = {
  /* "CONTACT!" */
  contact: {
    f0: 1.18, drive: 1.25, syl: [
      { v: 'o', d: 0.13, a: 1.0, p: 1.06, on: 'p', g: 0.012 },
      { v: 'a', d: 0.19, a: 1.0, p: 1.16, on: 'p', g: 0 },
    ],
  },
  /* "ENEMY SPOTTED" */
  spotted: {
    f0: 1.1, drive: 1.1, syl: [
      { v: 'e', d: 0.1, a: 0.9, p: 1.05, g: 0.01 },
      { v: 'a', d: 0.08, a: 0.7, p: 1.0, on: 'n', g: 0.01 },
      { v: 'i', d: 0.1, a: 0.8, p: 0.95, g: 0.06 },
      { v: 'a', d: 0.12, a: 1.0, p: 1.1, on: 'f', g: 0.02 },
      { v: 'e', d: 0.13, a: 0.75, p: 0.9, on: 'p', g: 0 },
    ],
  },
  /* "RELOADING!" */
  reloading: {
    f0: 1.05, drive: 1.0, syl: [
      { v: 'i', d: 0.09, a: 0.8, p: 1.0, g: 0.01 },
      { v: 'ohh', d: 0.16, a: 1.0, p: 1.12, g: 0.015 },
      { v: 'i', d: 0.13, a: 0.7, p: 0.9, on: 'p', g: 0 },
    ],
  },
  /* "GRENADE!" — panicked, pitch climbs hard */
  grenade: {
    f0: 1.3, drive: 1.5, syl: [
      { v: 'e', d: 0.1, a: 0.9, p: 1.0, on: 'p', g: 0.012 },
      { v: 'a', d: 0.26, a: 1.15, p: 1.35, on: 'n', g: 0 },
    ],
  },
  /* "FLANKING!" */
  flanking: {
    f0: 1.12, drive: 1.2, syl: [
      { v: 'a', d: 0.16, a: 1.0, p: 1.1, on: 'f', g: 0.015 },
      { v: 'i', d: 0.13, a: 0.8, p: 0.95, on: 'n', g: 0 },
    ],
  },
  /* "SUPPRESSING FIRE!" */
  suppressing: {
    f0: 1.08, drive: 1.15, syl: [
      { v: 'u', d: 0.09, a: 0.75, p: 0.98, on: 'f', g: 0.01 },
      { v: 'e', d: 0.14, a: 1.0, p: 1.12, on: 'p', g: 0.02 },
      { v: 'i', d: 0.1, a: 0.7, p: 0.9, g: 0.05 },
      { v: 'a', d: 0.18, a: 0.95, p: 1.05, on: 'f', g: 0 },
    ],
  },
  /* "MOVE UP!" */
  moveup: {
    f0: 1.1, drive: 1.2, syl: [
      { v: 'u', d: 0.16, a: 1.0, p: 1.08, on: 'n', g: 0.03 },
      { v: 'a', d: 0.14, a: 0.9, p: 1.0, g: 0 },
    ],
  },
  /* wordless taking-fire grunt */
  hit: {
    f0: 1.25, drive: 1.6, breath: 0.5, syl: [
      { v: 'ah', d: 0.16, a: 1.1, p: 1.2, on: 'p', g: 0 },
    ],
  },
  /* pain, longer, wavering */
  pain: {
    f0: 1.15, drive: 1.3, breath: 0.65, tremolo: 14, syl: [
      { v: 'ah', d: 0.34, a: 0.95, p: 1.0, g: 0 },
    ],
  },
  /* death: pitch collapses, breath takes over, ends in an exhale */
  death: {
    f0: 1.05, drive: 1.4, breath: 1.0, tremolo: 22, dying: true, syl: [
      { v: 'ah', d: 0.3, a: 1.0, p: 1.15, g: 0.02 },
      { v: 'ehr', d: 0.42, a: 0.6, p: 0.62, g: 0 },
    ],
  },
  /* infected moans: longer, breathier and deliberately less speech-like */
  zombieMoan: {
    f0: 0.94, drive: 0.82, breath: 1.18, breathFreq: 920, breathQ: 0.48,
    voiced: 0.62, tremolo: 5.2, tremoloDepth: 0.16, wanderCents: 42,
    growl: 0.58, formantJitter: 0.045, presenceDb: 1.5, throatDb: 6,
    lowpass: 3600, release: 0.18, innerRelease: 0.08, loopNoise: true, syl: [
      { v: 'ohh', d: 0.62, a: 1.0, p: 1.03, g: 0.035 },
      { v: 'ehr', d: 0.72, a: 0.72, p: 0.72, g: 0 },
    ],
  },
  zombieWail: {
    f0: 1.04, drive: 0.74, breath: 1.36, breathFreq: 1050, breathQ: 0.44,
    voiced: 0.52, tremolo: 6.4, tremoloDepth: 0.13, wanderCents: 58,
    growl: 0.34, formantJitter: 0.055, presenceDb: 1, throatDb: 5,
    lowpass: 3900, release: 0.24, innerRelease: 0.1, loopNoise: true, dying: true, syl: [
      { v: 'ah', d: 0.55, a: 0.9, p: 1.08, g: 0.04 },
      { v: 'ohh', d: 0.68, a: 0.72, p: 0.66, g: 0 },
    ],
  },
  zombieBrute: {
    f0: 0.82, drive: 0.92, breath: 0.96, breathFreq: 720, breathQ: 0.5,
    voiced: 0.7, tremolo: 4.3, tremoloDepth: 0.15, wanderCents: 30,
    growl: 0.95, formantJitter: 0.04, presenceDb: 0.5, throatDb: 8,
    lowpass: 3100, release: 0.22, innerRelease: 0.1, loopNoise: true, syl: [
      { v: 'u', d: 0.72, a: 1.05, p: 0.98, g: 0.05 },
      { v: 'ehr', d: 0.66, a: 0.8, p: 0.7, g: 0 },
    ],
  },
  zombieRunner: {
    f0: 1.14, drive: 0.76, breath: 1.42, breathFreq: 1180, breathQ: 0.46,
    voiced: 0.48, tremolo: 7.2, tremoloDepth: 0.12, wanderCents: 66,
    growl: 0.28, formantJitter: 0.06, presenceDb: 1.5, throatDb: 4,
    lowpass: 4100, release: 0.14, innerRelease: 0.07, loopNoise: true, syl: [
      { v: 'ah', d: 0.42, a: 0.92, p: 1.12, g: 0.025 },
      { v: 'ehr', d: 0.5, a: 0.66, p: 0.76, g: 0 },
    ],
  },
  /* short affirmative, for squad chatter */
  copy: {
    f0: 1.0, drive: 0.9, syl: [
      { v: 'a', d: 0.1, a: 0.85, p: 1.0, on: 'p', g: 0.02 },
      { v: 'i', d: 0.12, a: 0.7, p: 0.88, on: 'p', g: 0 },
    ],
  },
};

const WAVE_CACHE = new WeakMap();

/** Glottal-ish pulse: strong fundamental, 1/n^1.15 rolloff, alternating phase. */
function glottalWave(actx) {
  let w = WAVE_CACHE.get(actx);
  if (w) return w;
  const N = 40;
  const real = new Float32Array(N);
  const imag = new Float32Array(N);
  for (let n = 1; n < N; n++) {
    imag[n] = (1 / Math.pow(n, 1.15)) * (n % 2 === 0 ? -0.75 : 1);
  }
  w = actx.createPeriodicWave(real, imag, { disableNormalization: false });
  WAVE_CACHE.set(actx, w);
  return w;
}

/**
 * Synthesize a bark.
 *
 * @param {object} o { when, bark, f0 (base Hz), tract (0.9..1.1), level,
 *                     radio (bool), distance }
 */
function bark(actx, bank, rng, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const spec = BARKS[o.bark] ?? BARKS.contact;
  const tract = o.tract ?? rng.range(0.94, 1.07);
  const f0 = (o.f0 ?? rng.range(96, 132)) * spec.f0;
  const level = o.level ?? 1;
  const out = gain(actx, 0.2); // VOICE TRIM

  const total = spec.syl.reduce((s, x) => s + x.d + (x.g ?? 0), 0);

  /* ---- source ---------------------------------------------------- */
  const src = actx.createOscillator();
  src.setPeriodicWave(glottalWave(actx));
  const srcGain = gain(actx, 0);
  src.connect(srcGain);

  // Aspiration: always a little, a lot when hurt or dying.
  const breathLevel = (spec.breath ?? 0.16) * rng.range(0.8, 1.25);
  const voicedLevel = clamp(spec.voiced ?? 1, 0.15, 1.2);
  const noise = bank.source('white', rng, rng.range(0.9, 1.2), spec.loopNoise === true);
  const noiseBP = biquad(actx, 'bandpass', spec.breathFreq ?? 1400, spec.breathQ ?? 0.6);
  const noiseGain = gain(actx, 0);
  series(noise, noiseBP, noiseGain);

  const excite = gain(actx, 1);
  srcGain.connect(excite);
  noiseGain.connect(excite);

  /* ---- formant bank ---------------------------------------------- */
  const first = VOWELS[spec.syl[0].v] ?? VOWELS.a;
  const fs = [];
  for (let i = 0; i < 3; i++) {
    const f = first[i] * tract;
    const bw = first[i + 3];
    const bp = biquad(actx, 'bandpass', f, clamp(f / bw, 1.5, 14));
    const g = gain(actx, [1.0, 0.55, 0.24][i]);
    excite.connect(bp);
    bp.connect(g);
    fs.push({ bp, g });
  }

  /* ---- vocal tract output shaping -------------------------------- */
  const throat = biquad(actx, 'peaking', 480, 1.1, spec.throatDb ?? 4);      // chest resonance
  const presence = biquad(actx, 'peaking', 2600, 1.4, spec.presenceDb ?? 5);   // shout presence
  const hp = biquad(actx, 'highpass', spec.highpass ?? 150, 0.7);
  const lp = biquad(actx, 'lowpass', spec.lowpass ?? 5200, 0.7);
  const drv = shaper(actx, saturationCurve(1.6 * (spec.drive ?? 1), 0.35), '2x');
  const bodyGain = gain(actx, 1.5 * level);
  for (const f of fs) f.g.connect(throat);

  // Low, filtered turbulence gives infected voices chest and throat texture
  // without turning the clean command-radio voices into noise.
  let growl = null;
  if (spec.growl) {
    growl = bank.source('brown', rng, rng.range(0.58, 0.86), true);
    const growlBP = biquad(actx, 'bandpass', rng.range(180, 310) * tract, 0.72);
    const growlLP = biquad(actx, 'lowpass', 900, 0.65);
    const growlGain = gain(actx, 0);
    series(growl, growlBP, growlLP, growlGain).connect(throat);
    ad(growlGain.gain, t0, 0.2 * spec.growl * level, 0.06, total + 0.2);
  }

  series(throat, presence, hp, lp, drv, bodyGain).connect(out);

  /* ---- tremolo (pain / death gargle) ----------------------------- */
  let trem = null;
  if (spec.tremolo) {
    trem = actx.createOscillator();
    trem.type = 'sine';
    trem.frequency.value = spec.tremolo * rng.range(0.85, 1.15);
    const tg = gain(actx, (spec.tremoloDepth ?? 0.35) * level);
    trem.connect(tg);
    tg.connect(bodyGain.gain);
    trem.start(t0);
    trem.stop(t0 + total + 0.4);
  }

  /* ---- per-syllable automation ----------------------------------- */
  let t = t0;
  src.frequency.setValueAtTime(f0 * spec.syl[0].p, t0);

  // Slow, irregular pitch drift removes the fixed oscillator/robot impression.
  if (spec.wanderCents) {
    let wt = t0 + 0.04;
    while (wt < t0 + total) {
      src.detune.setTargetAtTime(
        rng.range(-spec.wanderCents, spec.wanderCents),
        wt,
        rng.range(0.035, 0.085)
      );
      wt += rng.range(0.08, 0.18);
    }
  }
  for (let i = 0; i < spec.syl.length; i++) {
    const s = spec.syl[i];
    const v = VOWELS[s.v] ?? VOWELS.a;
    const amp = s.a * 0.5;

    /* onset consonant, mixed straight to the output */
    if (s.on) {
      // Onsets lead the vowel; never let that run off the start of the timeline.
      const ct = Math.max(t - (s.on === 'f' ? 0.055 : 0.018), 0);
      const cs = bank.source('white', rng, rng.range(0.9, 1.3));
      const cbp = biquad(actx, s.on === 'f' ? 'bandpass' : 'highpass',
        s.on === 'f' ? rng.range(3800, 6500) : rng.range(1400, 2600),
        s.on === 'f' ? 1.1 : 0.7);
      const cg = gain(actx, 0);
      series(cs, cbp, cg).connect(out);
      if (s.on === 'f') {
        ad(cg.gain, ct, 0.1 * level, 0.012, 0.05);
        cs.start(ct, cs._offset, 0.12);
      } else if (s.on === 'n') {
        // Nasal: hum through a low formant instead of a burst.
        ad(cg.gain, ct, 0.02 * level, 0.01, 0.04);
        cs.start(ct, cs._offset, 0.08);
        fs[0].bp.frequency.setValueAtTime(260 * tract, ct);
      } else {
        hit(cg.gain, ct, 0.16 * level, 0.014);
        cs.start(ct, cs._offset, 0.05);
      }
    }

    /* formant glide into this vowel — 35 ms transition reads as articulation */
    for (let k = 0; k < 3; k++) {
      const jitter = spec.formantJitter ?? 0.02;
      const f = v[k] * tract * (1 + rng.range(-jitter, jitter));
      const bw = v[k + 3];
      fs[k].bp.frequency.setTargetAtTime(f, Math.max(t - 0.03, t0), 0.014);
      fs[k].bp.Q.setTargetAtTime(clamp(f / bw, 1.5, 14), Math.max(t - 0.03, t0), 0.02);
    }

    /* pitch contour: rise into the stressed syllable, sag at the end */
    const pTarget = f0 * s.p;
    src.frequency.setTargetAtTime(pTarget, t, 0.03);
    if (spec.dying && i === spec.syl.length - 1) {
      sweep(src.frequency, t + 0.05, pTarget, pTarget * 0.45, s.d);
    } else {
      src.frequency.setTargetAtTime(pTarget * 0.94, t + s.d * 0.6, 0.06);
    }

    /* amplitude: fast onset, held, quick release; last syllable decays longer */
    const last = i === spec.syl.length - 1;
    const rel = last
      ? (spec.dying ? s.d * 0.9 : (spec.release ?? 0.055))
      : (spec.innerRelease ?? 0.028);
    adsr(srcGain.gain, t, amp * level * voicedLevel, 0.014, s.d * 0.22, s.d * 0.5, 0.72, rel);
    ad(noiseGain.gain, t, amp * breathLevel * level, 0.02, s.d + rel);

    t += s.d + (s.g ?? 0);
  }

  /* ---- dying exhale ---------------------------------------------- */
  if (spec.dying) {
    const et = t + 0.05;
    const es = bank.source('white', rng, rng.range(0.6, 0.9));
    const ebp = biquad(actx, 'bandpass', 700, 0.55);
    const eg = gain(actx, 0);
    series(es, ebp, eg).connect(out);
    sweep(ebp.frequency, et, 900, 380, 0.6);
    ad(eg.gain, et, 0.16 * level, 0.08, 0.6);
    es.start(et, es._offset, 0.9);
    t = et + 0.7;
  }

  const end = t + 0.35;
  const srcStart = Math.max(t0 - 0.01, 0);
  src.start(srcStart);
  src.stop(end);
  if (spec.loopNoise) {
    noise.start(srcStart, noise._offset);
    noise.stop(end + 0.05);
  } else {
    noise.start(srcStart, noise._offset, end - srcStart + 0.05);
  }
  if (growl) {
    growl.start(srcStart, growl._offset);
    growl.stop(end + 0.05);
  }

  /* ---- radio treatment (squad comms) ----------------------------- */
  if (o.radio) {
    const rbp1 = biquad(actx, 'highpass', 420, 0.8);
    const rbp2 = biquad(actx, 'lowpass', 3200, 0.9);
    const rdrv = shaper(actx, saturationCurve(7, 0.3), '2x');
    const rg = gain(actx, 1.1);
    const radioOut = gain(actx, 1);
    series(out, rbp1, rbp2, rdrv, rg).connect(radioOut);
    // Squelch click at both ends of the transmission.
    for (const st of [Math.max(t0 - 0.05, 0), end - 0.2]) {
      const cs = bank.source('white', rng, 1.1);
      const cbp = biquad(actx, 'bandpass', 2600, 1.6);
      const cg = gain(actx, 0);
      series(cs, cbp, cg).connect(radioOut);
      hit(cg.gain, st, 0.09, 0.03);
      cs.start(st, cs._offset, 0.06);
    }
    return { node: radioOut, end: end + 0.1, send: 0.05 };
  }

  return { node: out, end: end + 0.1, send: 0.45 };
}

/** Pick a plausible bark for an AI event without the ai agent knowing our list. */
function barkFor(kind, rng) {
  switch (kind) {
    case 'spot': return rng.float() < 0.5 ? 'contact' : 'spotted';
    case 'reload': return 'reloading';
    case 'grenade': return 'grenade';
    case 'flank': return 'flanking';
    case 'suppress': return 'suppressing';
    case 'advance': return 'moveup';
    case 'hurt': return rng.float() < 0.5 ? 'hit' : 'pain';
    case 'death': return 'death';
    case 'copy': return 'copy';
    default: return 'contact';
  }
}

/** Weighted table used by the scheduler. */
const ONE_SHOTS = ['dog', 'siren', 'creak', 'settle', 'birds', 'vehicle', 'heli', 'shout'];

function ambientOneShot(actx, bank, rng, kind, o = {}) {
  const t0 = o.when ?? actx.currentTime;
  const out = gain(actx, 0.55); // VOICE TRIM
  const lvl = o.level ?? 1;
  let end = t0 + 1;

  switch (kind) {
    case 'dog': {
      // Two or three barks, each a short formant-ish yelp.
      const n = 2 + ((rng.u32() % 2) | 0);
      for (let i = 0; i < n; i++) {
        const bt = t0 + i * rng.range(0.24, 0.44);
        const o1 = osc(actx, 'sawtooth', rng.range(220, 340));
        const bp = biquad(actx, 'bandpass', rng.range(700, 1200), 2.2);
        const g = gain(actx, 0);
        series(o1, bp, g).connect(out);
        sweep(o1.frequency, bt, rng.range(300, 420), rng.range(150, 220), 0.11);
        ad(g.gain, bt, 0.5 * lvl, 0.01, 0.1);
        o1.start(bt); o1.stop(bt + 0.3);
        const ns = bank.source('white', rng, 1);
        const nbp = biquad(actx, 'bandpass', 2400, 1.2);
        const ng = gain(actx, 0);
        series(ns, nbp, ng).connect(out);
        ad(ng.gain, bt, 0.12 * lvl, 0.008, 0.08);
        ns.start(bt, ns._offset, 0.2);
        end = bt + 0.4;
      }
      return { node: out, end, send: 0.7 };
    }
    case 'siren': {
      // Distant two-tone, wailing, drifting in and out.
      const dur = rng.range(4, 9);
      const o1 = osc(actx, 'sine', 620);
      const o2 = osc(actx, 'sine', 930);
      const g = gain(actx, 0);
      const lp = biquad(actx, 'lowpass', 1800, 0.8);
      o1.connect(g); o2.connect(g); series(g, lp).connect(out);
      const wob = osc(actx, 'sine', rng.range(0.35, 0.6));
      const wg = gain(actx, 110);
      wob.connect(wg); wg.connect(o1.frequency); wg.connect(o2.frequency);
      wob.start(t0);
      ad(g.gain, t0, 0.022 * lvl, dur * 0.3, dur * 0.7);
      o1.start(t0); o2.start(t0);
      o1.stop(t0 + dur + 0.5); o2.stop(t0 + dur + 0.5); wob.stop(t0 + dur + 0.5);
      return { node: out, end: t0 + dur + 0.6, send: 1.1 };
    }
    case 'creak': {
      // Metal fatigue: a high-Q band swept slowly, plus a final pop.
      const dur = rng.range(0.9, 2.4);
      const src = bank.source('white', rng, rng.range(0.6, 1));
      const bp = biquad(actx, 'bandpass', 900, 22);
      const g = gain(actx, 0);
      series(src, bp, g).connect(out);
      sweep(bp.frequency, t0, rng.range(500, 900), rng.range(1100, 2200), dur);
      ad(g.gain, t0, 0.3 * lvl, dur * 0.3, dur * 0.8);
      src.start(t0, src._offset, dur * 1.5);
      struckResonator(actx, bank, rng, t0 + dur * 0.9, [
        { f: rng.range(400, 1400), q: 20, g: 0.18 * lvl, decay: 0.1 },
      ], 0.003).connect(out);
      return { node: out, end: t0 + dur * 1.6, send: 0.8 };
    }
    case 'settle': {
      // Rubble shifting: a handful of grains and a soft low thump.
      for (let i = 0; i < 7; i++) {
        struckResonator(actx, bank, rng, t0 + rng.range(0, 0.7), [
          { f: rng.range(600, 5000), q: rng.range(8, 26), g: rng.range(0.02, 0.09) * lvl, decay: rng.range(0.01, 0.07) },
        ], 0.002).connect(out);
      }
      const b = osc(actx, 'sine', 90);
      const g = gain(actx, 0);
      b.connect(g); g.connect(out);
      sweep(b.frequency, t0, 110, 55, 0.15);
      ad(g.gain, t0, 0.14 * lvl, 0.01, 0.16);
      b.start(t0); b.stop(t0 + 0.4);
      return { node: out, end: t0 + 1.1, send: 0.6 };
    }
    case 'birds': {
      const n = 3 + ((rng.u32() % 5) | 0);
      for (let i = 0; i < n; i++) {
        const bt = t0 + rng.range(0, 1.4);
        const o1 = osc(actx, 'sine', 3200);
        const g = gain(actx, 0);
        o1.connect(g); g.connect(out);
        const up = rng.float() < 0.5;
        sweep(o1.frequency, bt, up ? 2600 : 4400, up ? 4600 : 2700, 0.06);
        ad(g.gain, bt, 0.05 * lvl, 0.008, 0.06);
        o1.start(bt); o1.stop(bt + 0.2);
      }
      return { node: out, end: t0 + 1.8, send: 0.9 };
    }
    case 'vehicle': {
      // A truck passing somewhere out of sight.
      const dur = rng.range(3.5, 7);
      const src = bank.source('brown', rng, rng.range(0.7, 1));
      const lp = biquad(actx, 'lowpass', 300, 0.9);
      const g = gain(actx, 0);
      series(src, lp, g).connect(out);
      sweep(lp.frequency, t0, 200, 460, dur * 0.5);
      sweep(lp.frequency, t0 + dur * 0.5, 460, 180, dur * 0.5);
      ad(g.gain, t0, 0.16 * lvl, dur * 0.45, dur * 0.55);
      src.start(t0, src._offset, dur * 1.2);
      // Engine order: a low buzz that follows the same envelope.
      const e = osc(actx, 'sawtooth', rng.range(52, 78));
      const eg = gain(actx, 0);
      const elp = biquad(actx, 'lowpass', 240, 1.2);
      e.connect(eg); series(eg, elp).connect(out);
      ad(eg.gain, t0, 0.035 * lvl, dur * 0.45, dur * 0.55);
      e.start(t0); e.stop(t0 + dur * 1.2);
      return { node: out, end: t0 + dur * 1.3, send: 0.7 };
    }
    case 'heli': {
      // Rotor thump: an amplitude-modulated dark noise bed, no sample needed.
      const dur = rng.range(6, 12);
      const src = bank.source('brown', rng, rng.range(0.8, 1.1));
      const lp = biquad(actx, 'lowpass', 420, 0.9);
      const g = gain(actx, 0);
      // Blade-pass modulation: a separate multiplier, because an LFO connected
      // to a gain param sums with the envelope instead of scaling it.
      const am = gain(actx, 0.45);
      series(src, lp, g, am).connect(out);
      ad(g.gain, t0, 2.1 * lvl, dur * 0.4, dur * 0.6);
      src.start(t0, src._offset, dur * 1.2);
      const thump = osc(actx, 'sine', rng.range(4.6, 6.4));
      const tg = gain(actx, 0.5);
      thump.connect(tg); tg.connect(am.gain);
      thump.start(t0); thump.stop(t0 + dur * 1.2);
      // Turbine whine an octave-ish above the blade rate harmonics.
      const w = osc(actx, 'sawtooth', rng.range(280, 420));
      const wbp = biquad(actx, 'bandpass', 1400, 6);
      const wg = gain(actx, 0);
      series(w, wbp, wg).connect(out);
      ad(wg.gain, t0, 0.11 * lvl, dur * 0.4, dur * 0.6);
      w.start(t0); w.stop(t0 + dur * 1.2);
      return { node: out, end: t0 + dur * 1.3, send: 0.9 };
    }
    case 'shout':
    default: {
      // Unintelligible distant shouting — deliberately just contour, no words.
      const dur = rng.range(0.3, 0.7);
      const o1 = osc(actx, 'sawtooth', rng.range(110, 160));
      const bp1 = biquad(actx, 'bandpass', rng.range(600, 900), 4);
      const bp2 = biquad(actx, 'bandpass', rng.range(1300, 2000), 5);
      const g = gain(actx, 0);
      o1.connect(bp1); o1.connect(bp2);
      bp1.connect(g); bp2.connect(g);
      const lp = biquad(actx, 'lowpass', 2600, 0.8);
      series(g, lp).connect(out);
      sweep(o1.frequency, t0, rng.range(130, 170), rng.range(95, 125), dur);
      ad(g.gain, t0, 0.2 * lvl, 0.05, dur);
      o1.start(t0); o1.stop(t0 + dur + 0.2);
      return { node: out, end: t0 + dur + 0.3, send: 1.2 };
    }
  }
}


  /* ------------------------------------------------------------------ */
  /* ZomVox adapter / lightweight mix                                   */
  /* ------------------------------------------------------------------ */

  const BUS_DEFS = {
    weapons:  { trim: 0.95, comp: [-7, 8, 2.6, 0.003, 0.16], world: true },
    foley:    { trim: 0.82, comp: [-14, 10, 2.0, 0.004, 0.20], world: true },
    ambience: { trim: 0.48, comp: [-24, 12, 2.0, 0.05, 0.50], world: true },
    voice:    { trim: 0.92, comp: [-18, 8, 3.0, 0.006, 0.22], world: true },
    enemy:    { trim: 0.88, comp: [-16, 8, 2.5, 0.005, 0.24], world: true },
    sfx:      { trim: 0.82, comp: [-14, 10, 2.2, 0.004, 0.20], world: true },
    ui:       { trim: 1.15, comp: null, world: false }
  };

  function makeImpulse(actx, rng, seconds = 1.55) {
    const len = Math.max(1, Math.floor(actx.sampleRate * seconds));
    const ir = actx.createBuffer(2, len, actx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let low = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len;
        const env = Math.pow(1 - x, 2.7);
        const white = rng.signed();
        low = low * 0.82 + white * 0.18;
        d[i] = (white * 0.72 + low * 0.28) * env * 0.58;
      }
      const taps = [0.011, 0.019, 0.031, 0.047, 0.071, 0.103];
      for (let t = 0; t < taps.length; t++) {
        const p = Math.floor((taps[t] + ch * 0.0017) * actx.sampleRate);
        if (p < len) d[p] += (0.48 / (1 + t * 0.55)) * (ch ? -1 : 1);
      }
    }
    return ir;
  }

  class MixerLite {
    constructor(actx, rng) {
      this.actx = actx;
      this.buses = {};
      this.masterVolume = clamp(Number(audioConfig.masterVolume) || 0.95, 0, 1.5);

      this.masterSum = gain(actx, 1);
      this.preGain = gain(actx, 0.22);
      this.masterComp = actx.createDynamicsCompressor();
      this.masterComp.threshold.value = -2;
      this.masterComp.knee.value = 3;
      this.masterComp.ratio.value = 4;
      this.masterComp.attack.value = 0.0035;
      this.masterComp.release.value = 0.14;
      this.softClip = shaper(actx, limiterCurve(), '4x');
      this.masterGain = gain(actx, this.masterVolume);
      series(this.masterSum, this.preGain, this.masterComp, this.softClip, this.masterGain)
        .connect(actx.destination);

      this.worldSum = gain(actx, 1);
      this.worldLP = biquad(actx, 'lowpass', 20000, 0.5);
      this.worldSum.connect(this.worldLP);
      this.worldLP.connect(this.masterSum);

      for (const [name, def] of Object.entries(BUS_DEFS)) {
        const input = gain(actx, 1);
        const trim = gain(actx, def.trim);
        const duck = gain(actx, 1);
        let tail = input;
        if (def.comp) {
          const c = actx.createDynamicsCompressor();
          [c.threshold.value, c.knee.value, c.ratio.value, c.attack.value, c.release.value] = def.comp;
          input.connect(c);
          c.connect(trim);
          tail = trim;
        } else {
          input.connect(trim);
          tail = trim;
        }
        tail.connect(duck);
        duck.connect(def.world ? this.worldSum : this.masterSum);
        this.buses[name] = { input, trim, duck, base: def.trim, duckAmount: 0 };
      }

      this.reverbSend = gain(actx, 1);
      this.reverbLP = biquad(actx, 'lowpass', 6200, 0.6);
      this.reverb = actx.createConvolver();
      this.reverb.buffer = makeImpulse(actx, rng.fork());
      this.reverbReturn = gain(actx, 0.34);
      series(this.reverbSend, this.reverbLP, this.reverb, this.reverbReturn)
        .connect(this.worldSum);
    }

    bus(name) { return (this.buses[name] || this.buses.sfx).input; }

    duck(amount = 0.5, hold = 0.12) {
      const t = this.actx.currentTime;
      const apply = (name, scale) => {
        const b = this.buses[name];
        if (!b) return;
        const reduction = clamp(amount * scale, 0, 0.9);
        b.duck.gain.cancelScheduledValues(t);
        b.duck.gain.setTargetAtTime(1 - reduction, t, 0.012);
        b.duck.gain.setTargetAtTime(1, t + hold, 0.38);
      };
      apply('ambience', 1);
      apply('foley', 0.55);
      apply('voice', 0.32);
      apply('enemy', 0.24);
    }

    setMasterVolume(v) {
      this.masterVolume = clamp(Number(v) || 0, 0, 1.5);
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.actx.currentTime, 0.03);
    }

    setBusVolume(name, v) {
      const b = this.buses[name];
      if (!b) return false;
      b.trim.gain.setTargetAtTime(clamp(Number(v) || 0, 0, 2), this.actx.currentTime, 0.03);
      return true;
    }
  }

  let sfxEnabled = true;
  let ambientEnabled = true;
  let audioCtx = null;
  let rng = null;
  let bank = null;
  let mixer = null;
  let ambience = null;
  let audioBuffers = new Map();
  let audioLoadPromises = new Map();
  let lastLandAt = -Infinity;
  let zombieMoanHandles = [];

  function getAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) {
      try {
        audioCtx = new AC({ latencyHint: 'interactive' });
        rng = new Rng((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
        bank = new NoiseBank(audioCtx, rng.fork(), 2.4);
        mixer = new MixerLite(audioCtx, rng.fork());
        ambience = new BiomeAmbience(audioCtx, bank, mixer, rng.fork());
      } catch (err) {
        console.warn('ZomVox audio disabled:', err);
        audioCtx = null;
        return null;
      }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function optionVolumeScale(options = {}) {
    const explicit = Number(options.volumeScale);
    let scale = Number.isFinite(explicit) ? explicit : 1;
    const distance = Number(options.distance);
    if (Number.isFinite(distance)) scale *= clamp(1 - distance / 22, 0.2, 1);
    return clamp(scale, 0.05, 1.35);
  }

  function busForCue(name) {
    if (['shoot', 'empty', 'reloadStart', 'reloadStep', 'reloadDone', 'explosion'].includes(name)) return 'weapons';
    if (['footstep', 'land', 'block'].includes(name)) return 'foley';
    if (name === 'zombieMoan') return 'enemy';
    if (name.startsWith('voice')) return 'voice';
    if (['confirm', 'briefing', 'objectiveClear', 'wave', 'perkEquip', 'heartbeat'].includes(name)) return 'ui';
    return 'sfx';
  }

  function routeVoice(voice, busName = 'sfx', options = {}) {
    if (!voice || !voice.node || !mixer || !audioCtx) return null;
    const now = audioCtx.currentTime;
    const distance = Math.max(0, Number(options.distance) || 0);
    const attenuation = distance > 0
      ? clamp(2 / (2 + 0.72 * Math.max(0, distance - 2)), 0.06, 1)
      : 1;
    const air = biquad(audioCtx, 'lowpass', airCutoff(distance), 0.55);
    const level = gain(audioCtx, attenuation * clamp(Number(options.routeGain) || 1, 0, 2));
    const panValue = clamp(Number(options.pan) || 0, -0.85, 0.85);
    const pan = typeof audioCtx.createStereoPanner === 'function' ? audioCtx.createStereoPanner() : null;
    if (pan) pan.pan.value = panValue;

    voice.node.connect(air);
    air.connect(level);
    if (pan) {
      level.connect(pan);
      pan.connect(mixer.bus(busName));
    } else {
      level.connect(mixer.bus(busName));
    }

    let send = null;
    if ((voice.send || 0) > 0) {
      send = gain(audioCtx, clamp(voice.send * (options.sendScale ?? 1), 0, 1.6));
      level.connect(send);
      send.connect(mixer.reverbSend);
    }

    const end = Math.max(now + 0.08, Number(voice.end) || now + 0.5);
    const duration = Math.max(0.08, end - now);
    let cleaned = false;
    let timer = null;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (timer) clearTimeout(timer);
      for (const node of [voice.node, air, level, pan, send]) {
        try { node?.disconnect(); } catch (_) {}
      }
    };
    timer = setTimeout(cleanup, Math.ceil((duration + 0.35) * 1000));
    return { duration, expiresAt: performance.now() + duration * 1000, stop: cleanup };
  }

  function combineHandles(handles) {
    const list = handles.filter(Boolean);
    if (!list.length) return null;
    return {
      duration: Math.max(...list.map(x => x.duration || 0)),
      stop() { for (const h of list) h.stop?.(); }
    };
  }

  function configuredFileName(name) {
    if (Object.prototype.hasOwnProperty.call(audioFileConfig, name)) return audioFileConfig[name] || '';
    return DEFAULT_FILE_CUES[name] || '';
  }

  function fileCueUrl(fileName) {
    if (!fileName || typeof fileName !== 'string') return '';
    if (/^(https?:|data:|blob:)/i.test(fileName)) return fileName;
    return fileName.startsWith('assets/') ? fileName : 'assets/' + fileName;
  }

  function reverseBuffer(ctx, buffer) {
    const reversed = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = reversed.getChannelData(ch);
      for (let i = 0, j = src.length - 1; i < src.length; i++, j--) dst[i] = src[j];
    }
    return reversed;
  }

  async function loadFileCue(name) {
    const ctx = getAudio();
    const fileName = configuredFileName(name);
    if (!ctx || !fileName) return { name, fileName, ok: false };
    if (audioBuffers.has(name)) return { name, fileName, ok: !!audioBuffers.get(name) };
    if (audioLoadPromises.has(name)) return audioLoadPromises.get(name);
    const promise = fetch(fileCueUrl(fileName), { cache: 'force-cache' })
      .then(r => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.arrayBuffer(); })
      .then(data => ctx.decodeAudioData(data))
      .then(buffer => { audioBuffers.set(name, buffer); return { name, fileName, ok: true }; })
      .catch(err => {
        audioBuffers.set(name, null);
        console.warn('Optional ZomVox audio file unavailable:', fileName, err);
        return { name, fileName, ok: false };
      });
    audioLoadPromises.set(name, promise);
    return promise;
  }

  function playFileCue(name, gainValue = 1, playbackRate = 1, options = {}) {
    const ctx = getAudio();
    if (!ctx || !configuredFileName(name)) return null;
    const original = audioBuffers.get(name);
    if (!original) { loadFileCue(name); return null; }
    const reverse = Number(playbackRate) < 0;
    const key = name + ':reverse';
    if (reverse && !audioBuffers.has(key)) audioBuffers.set(key, reverseBuffer(ctx, original));
    const buffer = reverse ? audioBuffers.get(key) : original;
    const source = ctx.createBufferSource();
    const root = gain(ctx, Math.max(0, gainValue * (FILE_CUE_VOLUME[name] || 1)));
    const rate = clamp(Math.abs(Number(playbackRate) || 1), 0.25, 2);
    source.buffer = buffer;
    source.playbackRate.value = rate;
    source.connect(root);
    source.start();
    const routed = routeVoice(
      { node: root, end: ctx.currentTime + buffer.duration / rate, send: name === 'shoot' ? 0.35 : 0.22 },
      busForCue(name),
      options
    );
    const originalStop = routed?.stop;
    if (routed) routed.stop = () => {
      try { source.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
      originalStop?.();
    };
    return routed;
  }

  const SURFACE_MAP = {
    grass: 'foliage', dirt: 'dirt', sand: 'sand', mud: 'dirt', stone: 'concrete',
    rock: 'concrete', ice: 'glass', water: 'water', ash: 'dirt', wood: 'wood',
    snow: 'sand', concrete: 'concrete', metal: 'metal', foliage: 'foliage', flesh: 'flesh'
  };
  function surfaceName(name) { return SURFACE_MAP[String(name || '').toLowerCase()] || 'concrete'; }

  Object.assign(BARKS, {
    // Short command-radio phrases. These intentionally favour cadence and grit
    // over perfect intelligibility, matching the attached voice engine.
    radioDrop: {
      f0: 0.96, drive: 1.15, breath: 0.2, syl: [
        { v: 'u', d: 0.15, a: 1, p: 1.02, on: 'n', g: 0.025 },
        { v: 'a', d: 0.18, a: 0.9, p: 0.86, on: 'p', g: 0 }
      ]
    },
    radioTriple: {
      f0: 1.06, drive: 1.08, syl: [
        { v: 'ah', d: 0.12, a: 0.85, p: 1.04, on: 'f', g: 0.012 },
        { v: 'i', d: 0.11, a: 0.8, p: 1.12, on: 'p', g: 0.016 },
        { v: 'a', d: 0.14, a: 1, p: 1.18, on: 'n', g: 0 }
      ]
    },
    radioFew: {
      f0: 1.0, drive: 1.0, syl: [
        { v: 'u', d: 0.13, a: 0.9, p: 1.04, on: 'f', g: 0.025 },
        { v: 'ohh', d: 0.18, a: 1, p: 0.92, on: 'n', g: 0 }
      ]
    },
    radioLow: {
      f0: 1.15, drive: 1.25, breath: 0.3, syl: [
        { v: 'a', d: 0.15, a: 1, p: 1.12, on: 'f', g: 0.018 },
        { v: 'a', d: 0.18, a: 1.05, p: 0.98, on: 'p', g: 0 }
      ]
    },
    radioLong: {
      f0: 1.03, drive: 0.95, syl: [
        { v: 'i', d: 0.13, a: 0.9, p: 1.08, on: 'n', g: 0.02 },
        { v: 'o', d: 0.16, a: 1, p: 0.93, on: 'f', g: 0 }
      ]
    }
  });

  function radioCommand(key, level = 1) {
    const ctx = getAudio();
    if (!ctx) return null;
    const voice = bark(ctx, bank, rng.fork(), {
      bark: key,
      radio: true,
      f0: rng.range(92, 118),
      tract: rng.range(0.94, 1.04),
      level
    });
    return routeVoice(voice, 'voice', { sendScale: 0.7 });
  }

  function zombieMoanVoice(level = 1, playbackRate = 1, options = {}) {
    const ctx = getAudio();
    if (!ctx) return null;
    zombieMoanHandles = zombieMoanHandles.filter(h => h.expiresAt > performance.now());
    if (zombieMoanHandles.length >= ZOMBIE_MOAN_MAX_OVERLAP) return null;
    const variant = String(options.variant || 'normal').toLowerCase();
    const roll = rng.float();
    let kind = roll < 0.58 ? 'zombieMoan' : 'zombieWail';
    let base = 58;
    let voiceLevel = 0.94;

    if (variant.includes('brute')) {
      kind = roll < 0.76 ? 'zombieBrute' : 'zombieMoan';
      base = 46;
      voiceLevel = 1.18;
    } else if (variant.includes('runner')) {
      kind = roll < 0.7 ? 'zombieRunner' : roll < 0.9 ? 'zombieMoan' : 'zombieWail';
      base = 72;
      voiceLevel = 0.88;
    }

    const voice = bark(ctx, bank, rng.fork(), {
      bark: kind,
      f0: base * clamp(Math.abs(Number(playbackRate) || 1), 0.72, 1.28),
      tract: rng.range(0.88, 1.08),
      level: level * voiceLevel
    });
    const handle = routeVoice(voice, 'enemy', { pan: options.pan, sendScale: 1.15 });
    if (handle) zombieMoanHandles.push(handle);
    return handle;
  }

  function arpVoice(notes, level = 1, options = {}) {
    const ctx = getAudio();
    if (!ctx) return null;
    const root = gain(ctx, 0.72);
    const start = ctx.currentTime;
    let end = start + 0.2;
    notes.forEach((note, i) => {
      const t = start + (options.spacing ?? 0.06) * i;
      const o = osc(ctx, options.type || 'triangle', note);
      const g = gain(ctx, 0);
      const lp = biquad(ctx, 'lowpass', options.cutoff || 5200, 0.7);
      o.connect(g); series(g, lp).connect(root);
      ad(g.gain, t, (options.peak || 0.25) * level, 0.004, options.decay || 0.09);
      if (options.endScale) sweep(o.frequency, t, note, note * options.endScale, options.decay || 0.09);
      o.start(t); o.stop(t + (options.decay || 0.09) + 0.12);
      end = Math.max(end, t + (options.decay || 0.09) + 0.12);
    });
    return { node: root, end, send: options.send || 0 };
  }

  function toxinVoice(level = 1) {
    const ctx = getAudio();
    const root = gain(ctx, 0.5);
    const t = ctx.currentTime;
    const src = bank.source('brown', rng.fork(), 0.82);
    const bp = biquad(ctx, 'bandpass', 420, 0.8);
    const g = gain(ctx, 0);
    series(src, bp, g).connect(root);
    sweep(bp.frequency, t, 680, 180, 0.28);
    ad(g.gain, t, 0.32 * level, 0.03, 0.3);
    src.start(t, src._offset, 0.7);
    const o = osc(ctx, 'sawtooth', 118);
    const og = gain(ctx, 0);
    o.connect(og); og.connect(root);
    sweep(o.frequency, t, 132, 54, 0.24);
    ad(og.gain, t, 0.18 * level, 0.01, 0.28);
    o.start(t); o.stop(t + 0.55);
    return { node: root, end: t + 0.72, send: 0.35 };
  }

  function frogVoice(level = 1) {
    const ctx = getAudio();
    const root = gain(ctx, 0.45);
    const t0 = ctx.currentTime;
    let end = t0 + 0.7;
    for (let i = 0; i < 2 + (rng.u32() % 3); i++) {
      const t = t0 + i * rng.range(0.15, 0.28);
      const o = osc(ctx, 'sine', rng.range(105, 165));
      const g = gain(ctx, 0);
      const bp = biquad(ctx, 'bandpass', rng.range(340, 620), 3.5);
      o.connect(bp); series(bp, g).connect(root);
      sweep(o.frequency, t, rng.range(90, 140), rng.range(150, 220), 0.1);
      ad(g.gain, t, 0.18 * level, 0.012, 0.12);
      o.start(t); o.stop(t + 0.3);
      end = Math.max(end, t + 0.35);
    }
    return { node: root, end, send: 0.8 };
  }

  function insectVoice(level = 1) {
    const ctx = getAudio();
    const root = gain(ctx, 0.38);
    const t0 = ctx.currentTime;
    const src = bank.source('white', rng.fork(), rng.range(0.9, 1.25));
    const bp = biquad(ctx, 'bandpass', rng.range(4200, 7200), 8);
    const g = gain(ctx, 0);
    series(src, bp, g).connect(root);
    ad(g.gain, t0, 0.11 * level, 0.08, 0.7);
    src.start(t0, src._offset, 1.3);
    return { node: root, end: t0 + 1.35, send: 0.55 };
  }

  function windGustVoice(level = 1, icy = false) {
    const ctx = getAudio();
    const root = gain(ctx, 0.34);
    const t0 = ctx.currentTime;
    const src = bank.source(icy ? 'white' : 'brown', rng.fork(), rng.range(0.75, 1.15));
    const bp = biquad(ctx, 'bandpass', icy ? 1600 : 620, icy ? 2.8 : 0.7);
    const g = gain(ctx, 0);
    series(src, bp, g).connect(root);
    sweep(bp.frequency, t0, icy ? 900 : 320, icy ? 3100 : 1200, 1.3);
    ad(g.gain, t0, 0.18 * level, 0.35, 1.25);
    src.start(t0, src._offset, 2.2);
    return { node: root, end: t0 + 2.25, send: 0.6 };
  }

  function rumbleVoice(level = 1) {
    const ctx = getAudio();
    const root = gain(ctx, 0.4);
    const t0 = ctx.currentTime;
    const src = bank.source('brown', rng.fork(), 0.7);
    const lp = biquad(ctx, 'lowpass', 125, 0.9);
    const g = gain(ctx, 0);
    series(src, lp, g).connect(root);
    sweep(lp.frequency, t0, 150, 70, 1.4);
    ad(g.gain, t0, 0.22 * level, 0.15, 1.45);
    src.start(t0, src._offset, 2.2);
    return { node: root, end: t0 + 2.25, send: 0.75 };
  }

  class BiomeAmbience {
    constructor(actx, noiseBank, mix, localRng) {
      this.actx = actx;
      this.bank = noiseBank;
      this.mixer = mix;
      this.rng = localRng;
      this.current = null;
      this.name = '';
      this.timer = null;
    }

    play(name) {
      if (!ambientEnabled || !name) { this.stop(); return; }
      if (this.name === name && this.current) return;
      this.stop(0.45);
      this.name = name;
      this.current = this._build(name);
      this._schedule(true);
    }

    _build(name) {
      const ctx = this.actx;
      const root = gain(ctx, 0.0001);
      root.connect(this.mixer.bus('ambience'));
      const send = gain(ctx, 0.18);
      root.connect(send); send.connect(this.mixer.reverbSend);
      const sources = [];
      const nodes = [root, send];
      const now = ctx.currentTime;
      root.gain.exponentialRampToValueAtTime(1, now + 0.75);

      const addNoise = (kind, filterType, freq, q, level, pan, ampRate, ampDepth, freqRate, freqDepth) => {
        const src = this.bank.source(kind, this.rng, this.rng.range(0.78, 1.18), true);
        const f = biquad(ctx, filterType, freq, q);
        const g = gain(ctx, level);
        const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (p) p.pan.value = pan;
        src.connect(f); f.connect(g);
        if (p) { g.connect(p); p.connect(root); } else g.connect(root);
        src.start(0, src._offset);
        sources.push(src); nodes.push(f, g, p);
        if (ampRate && ampDepth) {
          const l = osc(ctx, 'sine', ampRate);
          const lg = gain(ctx, ampDepth);
          l.connect(lg); lg.connect(g.gain); l.start();
          sources.push(l); nodes.push(lg);
        }
        if (freqRate && freqDepth) {
          const l = osc(ctx, 'sine', freqRate);
          const lg = gain(ctx, freqDepth);
          l.connect(lg); lg.connect(f.frequency); l.start();
          sources.push(l); nodes.push(lg);
        }
      };

      const addTone = (freq, level, pan = 0, rate = 0.03, depth = 0.004) => {
        const o = osc(ctx, 'sine', freq);
        const g = gain(ctx, level);
        const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (p) p.pan.value = pan;
        o.connect(g); if (p) { g.connect(p); p.connect(root); } else g.connect(root);
        const l = osc(ctx, 'sine', rate); const lg = gain(ctx, depth);
        l.connect(lg); lg.connect(g.gain); o.start(); l.start();
        sources.push(o, l); nodes.push(g, p, lg);
      };

      switch (name) {
        case 'ambientForest':
          addNoise('brown', 'lowpass', 720, 0.62, 0.055, -0.42, 0.047, 0.018, 0.031, 220);
          addNoise('crackle', 'bandpass', 2800, 1.1, 0.014, 0.5, 0.091, 0.005, 0.057, 420);
          break;
        case 'ambientSwamp':
          addNoise('brown', 'lowpass', 470, 0.75, 0.065, -0.3, 0.039, 0.018, 0.026, 150);
          addNoise('white', 'bandpass', 3300, 5.2, 0.014, 0.48, 0.13, 0.006, 0.071, 540);
          addTone(54, 0.01, 0, 0.024, 0.005);
          break;
        case 'ambientDunes':
          addNoise('pink', 'bandpass', 980, 1.05, 0.075, -0.25, 0.043, 0.024, 0.033, 520);
          addNoise('white', 'highpass', 3300, 0.8, 0.008, 0.55, 0.087, 0.003, 0.051, 700);
          break;
        case 'ambientRocky':
          addNoise('brown', 'bandpass', 880, 0.9, 0.065, -0.35, 0.041, 0.02, 0.029, 360);
          addTone(46, 0.008, 0.25, 0.021, 0.004);
          break;
        case 'ambientAshlands':
          addNoise('brown', 'lowpass', 560, 0.62, 0.082, -0.4, 0.037, 0.027, 0.025, 210);
          addNoise('crackle', 'bandpass', 1500, 1.7, 0.018, 0.5, 0.079, 0.007, 0.053, 480);
          addTone(50, 0.013, 0.1, 0.018, 0.006);
          break;
        case 'ambientTundra':
          addNoise('white', 'bandpass', 1400, 1.8, 0.068, -0.4, 0.051, 0.022, 0.037, 620);
          addNoise('white', 'highpass', 3800, 1.1, 0.012, 0.55, 0.093, 0.004, 0.061, 800);
          break;
        case 'ambientMenu':
        default:
          addNoise('brown', 'lowpass', 580, 0.55, 0.07, -0.35, 0.033, 0.022, 0.021, 260);
          addNoise('pink', 'bandpass', 1700, 1.2, 0.018, 0.48, 0.061, 0.008, 0.037, 520);
          addTone(42, 0.014, 0, 0.017, 0.006);
          break;
      }
      return { root, sources, nodes };
    }

    _delay(first) {
      if (first) return this.rng.range(0.7, 2.4);
      if (this.name === 'ambientForest') return this.rng.range(2.4, 5.8);
      if (this.name === 'ambientSwamp') return this.rng.range(2.0, 4.8);
      if (this.name === 'ambientDunes' || this.name === 'ambientTundra') return this.rng.range(3.2, 7.2);
      return this.rng.range(3.8, 8.5);
    }

    _schedule(first = false) {
      if (this.timer) clearTimeout(this.timer);
      if (!ambientEnabled || !this.name) return;
      const expected = this.name;
      this.timer = setTimeout(() => {
        this.timer = null;
        if (!ambientEnabled || this.name !== expected) return;
        playAmbientSweetener(expected);
        this._schedule(false);
      }, this._delay(first) * 1000);
    }

    stop(fade = 0.25) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      const bed = this.current;
      this.current = null;
      this.name = '';
      if (!bed) return;
      const now = this.actx.currentTime;
      try {
        bed.root.gain.cancelScheduledValues(now);
        bed.root.gain.setValueAtTime(Math.max(0.0001, bed.root.gain.value), now);
        bed.root.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      } catch (_) {}
      setTimeout(() => {
        for (const s of bed.sources) { try { s.stop?.(); } catch (_) {} }
        for (const n of [...bed.sources, ...bed.nodes]) { try { n?.disconnect(); } catch (_) {} }
      }, Math.ceil((fade + 0.08) * 1000));
    }
  }

  function playAmbientSweetener(name) {
    if (!ambientEnabled || !getAudio()) return;
    const roll = rng.float();
    let voice = null;
    if (name === 'ambientForest') {
      voice = roll < 0.62 ? ambientOneShot(audioCtx, bank, rng.fork(), 'birds', { level: 0.8 })
        : roll < 0.84 ? windGustVoice(0.65) : insectVoice(0.65);
    } else if (name === 'ambientSwamp') {
      voice = roll < 0.46 ? frogVoice(0.9) : roll < 0.82 ? insectVoice(0.9) : zombieAmbientVoice(0.42);
    } else if (name === 'ambientDunes') {
      voice = roll < 0.66 ? windGustVoice(0.9) : roll < 0.84 ? distantGunfireVoice() : distantExplosionVoice();
    } else if (name === 'ambientRocky') {
      voice = roll < 0.42 ? windGustVoice(0.72) : roll < 0.65 ? rumbleVoice(0.62)
        : roll < 0.83 ? distantGunfireVoice() : zombieAmbientVoice(0.45);
    } else if (name === 'ambientAshlands') {
      voice = roll < 0.34 ? rumbleVoice(0.8) : roll < 0.58 ? windGustVoice(0.75)
        : roll < 0.78 ? distantExplosionVoice() : zombieAmbientVoice(0.52);
    } else if (name === 'ambientTundra') {
      voice = roll < 0.68 ? windGustVoice(0.9, true) : roll < 0.82
        ? ambientOneShot(audioCtx, bank, rng.fork(), 'birds', { level: 0.45 }) : rumbleVoice(0.45);
    } else {
      voice = roll < 0.28 ? windGustVoice(0.55) : roll < 0.52 ? distantGunfireVoice()
        : roll < 0.7 ? distantExplosionVoice() : roll < 0.86 ? zombieAmbientVoice(0.42) : rumbleVoice(0.48);
    }
    return routeVoice(voice, 'ambience', { pan: rng.range(-0.78, 0.78), sendScale: 1.2 });
  }

  function distantGunfireVoice() {
    const profile = rng.float() < 0.25 ? WEAPON_PROFILES.ak : WEAPON_PROFILES.rifle;
    return weaponShot(audioCtx, bank, rng.fork(), profile, {
      distance: rng.range(90, 220),
      firstPerson: false,
      echoBoost: 1.4
    });
  }

  function distantExplosionVoice() {
    return explosion(audioCtx, bank, rng.fork(), {
      distance: rng.range(110, 260), radius: rng.range(7, 14), level: 0.55
    });
  }

  function zombieAmbientVoice(level = 0.45) {
    return bark(audioCtx, bank, rng.fork(), {
      bark: rng.float() < 0.65 ? 'pain' : 'death',
      f0: rng.range(48, 68), tract: rng.range(0.9, 1.12), level
    });
  }

  function synthCue(name, gainValue = 1, playbackRate = 1, options = {}) {
    const ctx = getAudio();
    if (!ctx) return null;
    const local = rng.fork();
    const level = clamp((Number(gainValue) || 1) * optionVolumeScale(options), 0.02, 1.65);
    let voice = null;
    let bus = busForCue(name);
    let routeOptions = { pan: options.pan, distance: options.distance };

    switch (name) {
      case 'shoot':
        mixer.duck(0.74, 0.11);
        voice = weaponShot(ctx, bank, local, WEAPON_PROFILES.shotgun, {
          distance: 0, firstPerson: true, echoBoost: 1.05
        });
        routeOptions.routeGain = level;
        break;
      case 'empty':
        voice = dryFire(ctx, bank, local, { level });
        routeOptions.routeGain = level;
        break;
      case 'reloadStart':
        voice = reloadPhase(ctx, bank, local, 'start', { heavy: 1.15, level });
        routeOptions.routeGain = level;
        break;
      case 'reloadStep':
        voice = reloadPhase(ctx, bank, local, 'magin', { heavy: 1.15, level });
        routeOptions.routeGain = level;
        break;
      case 'reloadDone':
        voice = reloadPhase(ctx, bank, local, 'end', { heavy: 1.15, level });
        routeOptions.routeGain = level;
        break;
      case 'explosion':
        mixer.duck(0.92, 0.22);
        voice = explosion(ctx, bank, local, {
          distance: Number(options.distance) || 0,
          radius: Number(options.radius) || 8,
          level
        });
        routeOptions.distance = 0;
        break;
      case 'block':
        voice = surfaceImpact(ctx, bank, local, {
          surface: surfaceName(options.surface), energy: level, distance: options.distance
        });
        break;
      case 'footstep':
      case 'land':
        voice = footstep(ctx, bank, local, {
          surface: surfaceName(options.surface),
          gait: name === 'land' ? 'land' : (options.gait || 'walk'),
          level,
          gear: name === 'land' ? 0.8 : undefined
        });
        break;
      case 'hit': {
        const a = routeVoice(surfaceImpact(ctx, bank, local, { surface: 'flesh', energy: level }), 'sfx', routeOptions);
        const b = routeVoice(uiSound(ctx, bank, local.fork(), 'hitmarker', { level: level * 0.7 }), 'ui', {});
        return combineHandles([a, b]);
      }
      case 'head': {
        const a = routeVoice(surfaceImpact(ctx, bank, local, { surface: 'flesh', energy: level * 1.25 }), 'sfx', routeOptions);
        const b = routeVoice(uiSound(ctx, bank, local.fork(), 'headshot', { level }), 'ui', {});
        return combineHandles([a, b]);
      }
      case 'kill':
        voice = uiSound(ctx, bank, local, 'kill', { level });
        bus = 'ui'; routeOptions = {};
        break;
      case 'hurt': {
        const a = routeVoice(bark(ctx, bank, local, { bark: local.float() < 0.55 ? 'hit' : 'pain', f0: local.range(88, 120), level }), 'voice', {});
        const b = routeVoice(uiSound(ctx, bank, local.fork(), 'damage', { level: level * 0.65 }), 'ui', {});
        return combineHandles([a, b]);
      }
      case 'death': {
        const a = routeVoice(bark(ctx, bank, local, { bark: 'death', f0: local.range(82, 108), level }), 'voice', {});
        const b = routeVoice(bodyFall(ctx, bank, local.fork(), { level }), 'foley', {});
        return combineHandles([a, b]);
      }
      case 'toxin':
        voice = toxinVoice(level);
        break;
      case 'heartbeat':
        voice = heartbeat(ctx, bank, local, { level });
        bus = 'ui'; routeOptions = {};
        break;
      case 'pickup':
      case 'pickupAmmo':
        voice = arpVoice([440, 780], level, { spacing: 0.065, peak: 0.24, decay: 0.08, endScale: 1.18 });
        break;
      case 'pickupHealth':
        voice = arpVoice([620, 930, 1320], level, { spacing: 0.055, peak: 0.22, decay: 0.12, endScale: 1.22, send: 0.08 });
        break;
      case 'pickupC4':
        voice = arpVoice([172, 740, 980], level, { spacing: 0.07, peak: 0.23, decay: 0.09, endScale: 0.82 });
        break;
      case 'perkEquip':
        voice = arpVoice([560, 880, 1320, 1680], level, { spacing: 0.06, peak: 0.21, decay: 0.12, endScale: 1.12, send: 0.06 });
        bus = 'ui'; routeOptions = {};
        break;
      case 'confirm':
        voice = arpVoice([1180, 420], level, { spacing: 0.025, peak: 0.18, decay: 0.035, endScale: 0.65, type: 'square' });
        bus = 'ui'; routeOptions = {};
        break;
      case 'briefing': {
        const a = routeVoice(arpVoice([1160, 330], level, { spacing: 0.12, peak: 0.16, decay: 0.06, type: 'square' }), 'ui', {});
        const b = routeVoice(ambientOneShot(ctx, bank, local, 'shout', { level: 0.16 * level }), 'voice', { sendScale: 0.25 });
        return combineHandles([a, b]);
      }
      case 'objectiveClear':
        voice = arpVoice([220, 440, 720, 960], level, { spacing: 0.08, peak: 0.23, decay: 0.13, endScale: 1.15, send: 0.08 });
        bus = 'ui'; routeOptions = {};
        break;
      case 'wave':
        voice = arpVoice([180, 330, 480], level, { spacing: 0.085, peak: 0.25, decay: 0.11, endScale: 0.88, type: 'sawtooth' });
        bus = 'ui'; routeOptions = {};
        break;
      case 'zombieMoan':
        return zombieMoanVoice(level, playbackRate, options);
      case 'voiceDrop': return radioCommand('radioDrop', level);
      case 'voiceTriple': return radioCommand('radioTriple', level);
      case 'voiceFewMore': return radioCommand('radioFew', level);
      case 'voiceLowHealth': return radioCommand('radioLow', level);
      case 'voiceLongRange': return radioCommand('radioLong', level);
      case 'birds':
        voice = ambientOneShot(ctx, bank, local, 'birds', { level }); bus = 'ambience'; break;
      case 'frogs': voice = frogVoice(level); bus = 'ambience'; break;
      case 'wind': voice = windGustVoice(level, !!options.icy); bus = 'ambience'; break;
      case 'insects': voice = insectVoice(level); bus = 'ambience'; break;
      case 'rumble': voice = rumbleVoice(level); bus = 'ambience'; break;
      case 'distantGunfire': voice = distantGunfireVoice(); bus = 'ambience'; break;
      case 'distantExplosion': voice = distantExplosionVoice(); bus = 'ambience'; break;
      case 'distantZombie': voice = zombieAmbientVoice(level); bus = 'ambience'; break;
      default:
        voice = uiSound(ctx, bank, local, 'default', { level });
        break;
    }
    return routeVoice(voice, bus, routeOptions);
  }

  function resumeAudioFromGesture() {
    const ctx = getAudio();
    if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
    if (ambientEnabled && ambience?.name) ambience.play(ambience.name);
  }

  for (const eventName of ['pointerdown', 'mousedown', 'touchstart', 'keydown']) {
    window.addEventListener(eventName, resumeAudioFromGesture, { passive: true });
  }

  window.ZomVoxSound = {
    get running() { return !!audioCtx && audioCtx.state === 'running'; },

    start() {
      return Promise.resolve(!!getAudio());
    },

    setEnabled(value) { sfxEnabled = !!value; },

    setAmbientEnabled(value) {
      ambientEnabled = !!value;
      if (!ambientEnabled) ambience?.stop();
    },

    setMasterVolume(value) {
      getAudio();
      mixer?.setMasterVolume(value);
    },

    setBusVolume(name, value) {
      getAudio();
      const aliases = { weapon: 'weapons', ambient: 'ambience' };
      return mixer?.setBusVolume(aliases[name] || name, value) || false;
    },

    prime(onProgress) {
      getAudio();
      const fileNames = Object.keys(DEFAULT_FILE_CUES).filter(name => configuredFileName(name));
      const total = fileNames.length + 1;
      let loaded = 0;
      const report = (fileName, ok = true) => {
        loaded++;
        onProgress?.({ loaded, total, fileName, ok, progress: loaded / total });
      };
      report('procedural-audio-core', true);
      const loads = fileNames.map(name => loadFileCue(name).then(result => {
        report(result.fileName || name, result.ok);
        return result;
      }));
      return Promise.all(loads).then(results => [
        'procedural-audio-core',
        ...results.filter(x => x.ok).map(x => x.fileName)
      ]);
    },

    play(name, gainValue = 1, playbackRate = 1, options = {}) {
      if (!sfxEnabled) return null;
      if (name === 'land') {
        const now = performance.now();
        if (now - lastLandAt < 120) return null;
        lastLandAt = now;
      }

      const filesFirst = options.preferFile === true || PREFER_FILES;
      if (filesFirst && (name === 'shoot' || name === 'zombieMoan')) {
        const fileHandle = playFileCue(name, gainValue, playbackRate, options);
        if (fileHandle) return fileHandle;
      }

      const procedural = synthCue(name, gainValue, playbackRate, options);
      if (procedural) return procedural;

      if (FILE_FALLBACK && (name === 'shoot' || name === 'zombieMoan')) {
        return playFileCue(name, gainValue, playbackRate, options);
      }
      return null;
    },

    playAmbient(name) {
      if (!ambientEnabled) return;
      getAudio();
      ambience?.play(name);
    },

    stopAmbient() {
      ambience?.stop();
    },

    report() {
      return {
        running: !!audioCtx && audioCtx.state === 'running',
        contextState: audioCtx?.state || 'none',
        sampleRate: audioCtx?.sampleRate || 0,
        ambience: ambience?.name || '',
        proceduralPreferred: !PREFER_FILES,
        loadedFiles: [...audioBuffers.entries()].filter(([, value]) => !!value).map(([name]) => name),
        zombieVoices: zombieMoanHandles.filter(h => h.expiresAt > performance.now()).length
      };
    }
  };
})();
