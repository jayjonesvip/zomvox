'use strict';

/*
 * ZomVox audio: formant voices and ambient one-shots
 *
 * Procedural vocal tract barks, radio-like command syllables, zombie vocal material, and reusable distant one-shots such as helicopter.
 * Loaded by ../sound.js before script.js; keep this as a classic script
 * so the static GitHub Pages build does not need bundling or modules.
 */

/**
 * AUDIO / VOICE â€” formant synthesis for enemy barks
 *
 * No speech samples, so barks are built the way a vocal tract works:
 *
 *   glottal pulse train (PeriodicWave, 1/n^1.15 harmonics)
 *     + aspiration noise
 *     â”€â–º three parallel band-passes at the formant frequencies F1..F3
 *     â”€â–º chest/throat shaping, presence peak, mild saturation (shouting)
 *     + separately mixed consonant bursts (plosives and fricatives)
 *
 * The formant centres are ramped between vowels, the f0 follows a per-syllable
 * pitch contour, and both are jittered every ~25 ms. That jitter is the single
 * most important ingredient: without it the result is a Speak&Spell, with it a
 * player reads it as a human shouting a word they cannot quite make out â€” which
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
  /* "GRENADE!" â€” panicked, pitch climbs hard */
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
      { v: 'ohh', d: 1.24, a: 1.0, p: 1.03, g: 0.07 },
      { v: 'ehr', d: 1.44, a: 0.72, p: 0.72, g: 0 },
    ],
  },
  zombieWail: {
    f0: 1.04, drive: 0.74, breath: 1.36, breathFreq: 1050, breathQ: 0.44,
    voiced: 0.52, tremolo: 6.4, tremoloDepth: 0.13, wanderCents: 58,
    growl: 0.34, formantJitter: 0.055, presenceDb: 1, throatDb: 5,
    lowpass: 3900, release: 0.24, innerRelease: 0.1, loopNoise: true, dying: true, syl: [
      { v: 'ah', d: 1.1, a: 0.9, p: 1.08, g: 0.08 },
      { v: 'ohh', d: 1.36, a: 0.72, p: 0.66, g: 0 },
    ],
  },
  zombieBrute: {
    f0: 0.82, drive: 0.92, breath: 0.96, breathFreq: 720, breathQ: 0.5,
    voiced: 0.7, tremolo: 4.3, tremoloDepth: 0.15, wanderCents: 30,
    growl: 0.95, formantJitter: 0.04, presenceDb: 0.5, throatDb: 8,
    lowpass: 3100, release: 0.22, innerRelease: 0.1, loopNoise: true, syl: [
      { v: 'u', d: 1.44, a: 1.05, p: 0.98, g: 0.1 },
      { v: 'ehr', d: 1.32, a: 0.8, p: 0.7, g: 0 },
    ],
  },
  zombieRunner: {
    f0: 1.14, drive: 0.76, breath: 1.42, breathFreq: 1180, breathQ: 0.46,
    voiced: 0.48, tremolo: 7.2, tremoloDepth: 0.12, wanderCents: 66,
    growl: 0.28, formantJitter: 0.06, presenceDb: 1.5, throatDb: 4,
    lowpass: 4100, release: 0.14, innerRelease: 0.07, loopNoise: true, syl: [
      { v: 'ah', d: 0.84, a: 0.92, p: 1.12, g: 0.05 },
      { v: 'ehr', d: 1.0, a: 0.66, p: 0.76, g: 0 },
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

    /* formant glide into this vowel â€” 35 ms transition reads as articulation */
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
      // Ambient helicopter passes fade in slowly; care-package drops need a
      // fast attack so players hear the reward immediately after a kill streak.
      const carePackage = o.carePackage === true;
      const dur = carePackage ? rng.range(2.8, 4.0) : rng.range(6, 12);
      const src = bank.source('brown', rng, rng.range(0.8, 1.1));
      const lp = biquad(actx, 'lowpass', 420, 0.9);
      const g = gain(actx, 0);
      // Blade-pass modulation: a separate multiplier, because an LFO connected
      // to a gain param sums with the envelope instead of scaling it.
      const am = gain(actx, 0.45);
      series(src, lp, g, am).connect(out);
      ad(g.gain, t0, (carePackage ? 1.55 : 2.1) * lvl, carePackage ? 0.045 : dur * 0.4, carePackage ? dur * 0.85 : dur * 0.6);
      src.start(t0, src._offset, dur * 1.2);
      const thump = osc(actx, 'sine', rng.range(4.6, 6.4));
      const tg = gain(actx, carePackage ? 0.72 : 0.5);
      thump.connect(tg); tg.connect(am.gain);
      thump.start(t0); thump.stop(t0 + dur * 1.2);
      // Turbine whine an octave-ish above the blade rate harmonics.
      const w = osc(actx, 'sawtooth', rng.range(280, 420));
      const wbp = biquad(actx, 'bandpass', 1400, 6);
      const wg = gain(actx, 0);
      series(w, wbp, wg).connect(out);
      ad(wg.gain, t0, (carePackage ? 0.16 : 0.11) * lvl, carePackage ? 0.08 : dur * 0.4, carePackage ? dur * 0.72 : dur * 0.6);
      w.start(t0); w.stop(t0 + dur * 1.2);
      return { node: out, end: t0 + dur * 1.3, send: 0.9 };
    }
    case 'shout':
    default: {
      // Unintelligible distant shouting â€” deliberately just contour, no words.
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
