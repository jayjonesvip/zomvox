(() => {
  'use strict';

  const config = window.ZOMVOX_CONFIG || {};
  const enemyConfig = config.enemies || {};
  const ZOMBIE_MOAN_MAX_OVERLAP = Math.max(1, Math.floor(Number(enemyConfig.zombieMoanMaxVoices) || 3));
  const BUS_LEVELS = {
    weapon: 1.05,
    foley: 0.58,
    ambient: 0.74,
    enemy: 0.49,
    ui: 0.86,
    sfx: 0.72
  };

  let sfxEnabled = true;
  let ambientEnabled = true;
  let audioCtx = null;
  let busGains = null;
  let ambientTargetName = '';
  let activeAmbientName = '';
  let proceduralAmbientName = '';
  let proceduralAmbientTimer = null;
  let activeOneShots = 0;
  let zombieMoanSources = [];

  function getAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;

    if (!audioCtx) {
      try {
        audioCtx = new AC();
      } catch (err) {
        console.warn(err);
        return null;
      }
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    return audioCtx;
  }

  function buses() {
    const ctx = getAudio();
    if (!ctx) return null;
    if (busGains && busGains.context === ctx) return busGains;

    busGains = { context: ctx };
    for (const name of Object.keys(BUS_LEVELS)) {
      const gain = ctx.createGain();
      gain.gain.value = BUS_LEVELS[name];
      gain.connect(ctx.destination);
      busGains[name] = gain;
    }
    return busGains;
  }

  function busForSound(name) {
    if (name === 'shoot' || name === 'empty' || name === 'reloadStart' || name === 'reloadDone' || name === 'explosion') return 'weapon';
    if (name === 'land' || name === 'footstep' || name === 'block') return 'foley';
    if (name === 'zombieMoan') return 'enemy';
    if (name && name.startsWith('ambient')) return 'ambient';
    if (name === 'hurt' || name === 'death') return 'sfx';
    if (name === 'confirm' || name === 'briefing' || name === 'perkEquip' || name === 'objectiveClear' || name === 'wave' || name === 'heartbeat' || name === 'voiceDrop' || name === 'voiceTriple') return 'ui';
    return 'sfx';
  }

  function connectOutput(node, busName = 'sfx') {
    const mix = buses();
    if (!mix || !node) return;
    node.connect(mix[busName] || mix.sfx);
  }

  function tone(freq, dur = .08, type = 'square', gain = .05, endFreq = null, busName = 'sfx', delay = 0) {
    const ctx = getAudio();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const now = ctx.currentTime + Math.max(0, delay);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    }

    g.gain.setValueAtTime(Math.max(gain, 0.0001), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(g);
    connectOutput(g, busName);

    osc.start(now);
    osc.stop(now + dur + .02);
  }

  function noise(dur = .05, gain = .08, cutoff = 1200, busName = 'sfx', filterType = 'lowpass', delay = 0, q = 0.7) {
    const ctx = getAudio();
    if (!ctx) return;

    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }

    const src = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const now = ctx.currentTime + Math.max(0, delay);

    filt.type = filterType;
    filt.frequency.setValueAtTime(cutoff, now);
    filt.Q.setValueAtTime(q, now);

    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.buffer = buffer;
    src.connect(filt);
    filt.connect(g);
    connectOutput(g, busName);

    src.start(now);
    src.stop(now + dur + .02);
  }

  function radioStatic(dur = .08, gainValue = .04, center = 1600, busName = 'ui', delay = 0) {
    const ctx = getAudio();
    if (!ctx) return;

    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < len; i++) {
      const envelope = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * (0.35 + Math.random() * 0.65) * envelope;
    }

    const src = ctx.createBufferSource();
    const band = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const now = ctx.currentTime + Math.max(0, delay);

    band.type = 'bandpass';
    band.frequency.setValueAtTime(center, now);
    band.Q.setValueAtTime(1.8, now);

    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.buffer = buffer;
    src.connect(band);
    band.connect(gain);
    connectOutput(gain, busName);

    src.start(now);
    src.stop(now + dur + .02);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function rifleShot(level = 1) {
    const pitch = rand(0.94, 1.08);
    noise(.014, .31 * level, 5400 * pitch, 'weapon', 'highpass', 0, .85);
    noise(.065, .23 * level, 2350 * pitch, 'weapon', 'bandpass', 0, 1.05);
    noise(.24, .092 * level, 1180 * pitch, 'weapon', 'lowpass', .012, .7);
    noise(.36, .058 * level, 650 * pitch, 'weapon', 'lowpass', .055, .65);
    tone(142 * pitch, .105, 'sine', .118 * level, 56 * pitch, 'weapon');
    tone(62 * pitch, .145, 'triangle', .078 * level, 34 * pitch, 'weapon', .006);
    tone(1900 * pitch, .028, 'square', .034 * level, 1320 * pitch, 'weapon', .03);
    tone(3450 * pitch, .02, 'triangle', .016 * level, 2200 * pitch, 'weapon', .075);
  }

  function dryFire(level = 1) {
    const pitch = rand(.94, 1.08);
    noise(.012, .045 * level, 3600 * pitch, 'weapon', 'highpass', 0, 2.4);
    tone(1320 * pitch, .018, 'square', .024 * level, 820 * pitch, 'weapon');
    tone(360 * pitch, .032, 'triangle', .018 * level, 220 * pitch, 'weapon', .018);
    noise(.026, .022 * level, 1500 * pitch, 'weapon', 'bandpass', .018, 1.8);
  }

  function reloadStartSynth(level = 1) {
    noise(.035, .04 * level, 2100, 'weapon', 'bandpass', 0, 1.5);
    tone(240, .045, 'triangle', .033 * level, 148, 'weapon', .006);
    tone(880, .018, 'square', .02 * level, 520, 'weapon', .064);
    noise(.042, .035 * level, 1250, 'weapon', 'bandpass', .072, 1.1);
    tone(168, .052, 'triangle', .024 * level, 118, 'weapon', .118);
  }

  function reloadDoneSynth(level = 1) {
    tone(720, .024, 'square', .024 * level, 470, 'weapon');
    noise(.028, .036 * level, 2600, 'weapon', 'highpass', .012, 1.2);
    tone(360, .045, 'triangle', .034 * level, 610, 'weapon', .056);
    tone(118, .055, 'sine', .024 * level, 82, 'weapon', .074);
  }

  function explosionSynth(level = 1) {
    noise(.035, .42 * level, 3600, 'weapon', 'highpass', 0, .9);
    noise(.26, .25 * level, 760, 'weapon', 'lowpass', .018, .6);
    noise(.58, .12 * level, 320, 'weapon', 'lowpass', .05, .5);
    tone(72, .26, 'sine', .18 * level, 28, 'weapon');
    tone(38, .42, 'triangle', .12 * level, 24, 'weapon', .025);
    for (let i = 0; i < 5; i++) {
      const delay = .05 + i * rand(.022, .055);
      tone(rand(520, 1480), rand(.018, .044), 'square', .018 * level, rand(260, 720), 'weapon', delay);
      noise(rand(.018, .04), .022 * level, rand(1400, 3600), 'weapon', 'bandpass', delay, 1.6);
    }
  }

  function playerPainSynth(level = 1) {
    noise(.045, .06 * level, 850, 'sfx', 'bandpass', 0, 1.7);
    tone(164, .12, 'sawtooth', .06 * level, 82, 'sfx', .004);
    tone(88, .18, 'triangle', .035 * level, 52, 'sfx', .024);
    radioStatic(.05, .018 * level, 620, 'sfx');
  }

  function playerDeathSynth(level = 1) {
    noise(.11, .075 * level, 520, 'sfx', 'lowpass', 0, .75);
    tone(122, .28, 'sawtooth', .075 * level, 42, 'sfx');
    tone(58, .45, 'sine', .055 * level, 24, 'sfx', .045);
    setTimeout(() => noise(.24, .04 * level, 390, 'sfx', 'lowpass', 0, .7), 125);
  }

  function pickupSparkle(level = 1, base = 520, busName = 'sfx') {
    tone(base, .052, 'triangle', .034 * level, base * 1.45, busName);
    tone(base * 1.9, .055, 'sine', .024 * level, base * 2.25, busName, .055);
    noise(.025, .012 * level, base * 4, busName, 'bandpass', .018, 2.2);
  }

  function pickupAmmoSynth(level = 1) {
    noise(.026, .026 * level, 1900, 'sfx', 'bandpass', 0, 1.4);
    tone(440, .045, 'triangle', .034 * level, 620, 'sfx', .006);
    tone(780, .052, 'square', .018 * level, 520, 'sfx', .058);
  }

  function pickupHealthSynth(level = 1) {
    pickupSparkle(level, 620);
    tone(930, .065, 'sine', .03 * level, 1320, 'sfx', .105);
  }

  function pickupC4Synth(level = 1) {
    noise(.032, .026 * level, 900, 'sfx', 'bandpass', 0, 1.2);
    tone(172, .06, 'triangle', .033 * level, 120, 'sfx', .006);
    tone(740, .03, 'square', .022 * level, 520, 'sfx', .07);
    tone(980, .025, 'square', .017 * level, 1320, 'sfx', .125);
  }

  function perkEquipSynth(level = 1) {
    pickupSparkle(level, 560, 'ui');
    tone(880, .07, 'triangle', .035 * level, 1180, 'ui', .082);
    tone(1320, .09, 'sine', .026 * level, 1680, 'ui', .158);
  }

  const VOICE_VOWELS = {
    uh: [420, 980, 2380],
    ah: [720, 1180, 2480],
    eh: [540, 1780, 2520],
    ih: [310, 2180, 2960],
    oh: [500, 850, 2350],
    er: [470, 1340, 1800],
    oo: [330, 720, 2480]
  };

  function voiceSyllable(delay, dur, vowel = 'ah', pitch = 110, level = 1, onset = '') {
    const ctx = getAudio();
    if (!ctx) return 0;
    const now = ctx.currentTime + Math.max(0, delay);
    const end = now + dur;
    const formants = VOICE_VOWELS[vowel] || VOICE_VOWELS.ah;
    const out = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    const lp = ctx.createBiquadFilter();
    const presence = ctx.createBiquadFilter();

    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0002, .16 * level), now + .018);
    out.gain.setTargetAtTime(.09 * level, now + dur * .42, .035);
    out.gain.exponentialRampToValueAtTime(0.001, end + .04);
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(380, now);
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3150, now);
    presence.type = 'peaking';
    presence.frequency.setValueAtTime(1850, now);
    presence.Q.setValueAtTime(1.3, now);
    presence.gain.setValueAtTime(4.5, now);
    out.connect(hp);
    hp.connect(lp);
    lp.connect(presence);
    connectOutput(presence, 'ui');

    const osc = ctx.createOscillator();
    const srcGain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch * rand(.96, 1.04), now);
    osc.frequency.setTargetAtTime(pitch * rand(.82, .94), now + dur * .45, .05);
    srcGain.gain.setValueAtTime(.12 * level, now);
    osc.connect(srcGain);
    for (let i = 0; i < formants.length; i++) {
      const bp = ctx.createBiquadFilter();
      const fg = ctx.createGain();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(formants[i] * rand(.97, 1.03), now);
      bp.Q.setValueAtTime([7.5, 9, 11][i], now);
      fg.gain.setValueAtTime([1.0, .48, .22][i], now);
      srcGain.connect(bp);
      bp.connect(fg);
      fg.connect(out);
    }
    osc.start(now);
    osc.stop(end + .08);

    if (onset) {
      const burstDur = onset === 'f' ? .055 : .028;
      noise(burstDur, (onset === 'f' ? .035 : .05) * level, onset === 'f' ? 3900 : 1800, 'ui', onset === 'f' ? 'bandpass' : 'highpass', Math.max(0, delay - .012), onset === 'f' ? 2.8 : 1.4);
    }
    noise(dur * .72, .018 * level, 1600, 'ui', 'bandpass', delay + .012, 1.8);
    return dur;
  }

  function commandVoice(parts, level = 1) {
    radioStatic(.055, .05 * level, 1500, 'ui');
    let t = .035;
    for (const part of parts) {
      t += voiceSyllable(t, part.d, part.v, part.p, level * (part.a || 1), part.on || '') + (part.g || .025);
    }
    radioStatic(.08, .035 * level, 2100, 'ui', t + .02);
    radioStatic(.07, .026 * level, 900, 'ui', t + .09);
    return t;
  }

  function voiceDropSynth(level = 1) {
    // Radio-flavored command chatter: "good luck, soldier."
    commandVoice([
      { v: 'oo', d: .11, p: 118, on: 'g', g: .02 },
      { v: 'uh', d: .12, p: 104, on: 'p', g: .055 },
      { v: 'oh', d: .15, p: 112, on: 'f', g: .018 },
      { v: 'er', d: .18, p: 92, on: 'p', g: 0 }
    ], level);
  }

  function voiceTripleSynth(level = 1) {
    // Short congratulatory command bark: "impressive!"
    commandVoice([
      { v: 'ih', d: .10, p: 142, on: 'n', g: .012 },
      { v: 'eh', d: .16, p: 154, on: 'p', g: .012 },
      { v: 'ih', d: .13, p: 132, on: 'f', g: 0 }
    ], level);
  }

  function zombieMoanProfile(variant = 'normal', playbackRate = 1) {
    const rate = Math.max(0.55, Math.min(1.45, Math.abs(Number(playbackRate) || 1)));
    if (variant === 'speedy') {
      return { dur: .68 / rate, f0: 158 * rate, f1: 88 * rate, f2: 132 * rate, wave: 'sawtooth', voice: .044, breath: .082, breathFreq: 1180, q: 4.2, delay: .018, wobble: 15, wobbleDepth: .014 };
    }
    if (variant === 'brute') {
      return { dur: 1.48 / rate, f0: 58 * rate, f1: 28 * rate, f2: 50 * rate, wave: 'sawtooth', voice: .072, breath: .07, breathFreq: 360, q: 1.7, delay: .04, wobble: 5.8, wobbleDepth: .018, hollow: true };
    }
    if (variant === 'grey') {
      return { dur: 1.3 / rate, f0: 94 * rate, f1: 34 * rate, f2: 72 * rate, wave: 'triangle', voice: .047, breath: .092, breathFreq: 690, q: 5.4, delay: .028, hollow: true, wobble: 8.5, wobbleDepth: .02 };
    }
    return { dur: 1.08 / rate, f0: 104 * rate, f1: 52 * rate, f2: 86 * rate, wave: 'sawtooth', voice: .052, breath: .068, breathFreq: 560, q: 2.8, delay: .03, wobble: 7.2, wobbleDepth: .015 };
  }

  function zombieMoanSynth(level = 1, playbackRate = 1, options = {}) {
    const ctx = getAudio();
    if (!ctx || zombieMoanSources.length >= ZOMBIE_MOAN_MAX_OVERLAP) return;
    const variant = String(options.variant || 'normal');
    const profile = zombieMoanProfile(variant, playbackRate);
    const now = ctx.currentTime;
    const nodes = [];
    const sources = [];
    let cleaned = false;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), now + .05);
    out.gain.exponentialRampToValueAtTime(0.001, now + profile.dur);
    connectOutput(out, 'enemy');
    nodes.push(out);

    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(profile.voice, now);
    voiceGain.connect(out);
    nodes.push(voiceGain);

    const tremolo = ctx.createOscillator();
    const tremoloGain = ctx.createGain();
    tremolo.type = 'sine';
    tremolo.frequency.setValueAtTime(profile.wobble || 7, now);
    tremoloGain.gain.setValueAtTime(profile.wobbleDepth || .012, now);
    tremolo.connect(tremoloGain);
    tremoloGain.connect(voiceGain.gain);
    tremolo.start(now);
    tremolo.stop(now + profile.dur + .03);
    sources.push(tremolo);
    nodes.push(tremoloGain);

    const primary = ctx.createOscillator();
    primary.type = profile.wave;
    primary.frequency.setValueAtTime(profile.f0, now);
    primary.frequency.linearRampToValueAtTime(profile.f2, now + profile.dur * .24);
    primary.frequency.exponentialRampToValueAtTime(Math.max(24, profile.f1), now + profile.dur);
    primary.connect(voiceGain);
    primary.start(now);
    primary.stop(now + profile.dur + .03);
    sources.push(primary);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(profile.f0 * .48, now);
    sub.frequency.exponentialRampToValueAtTime(Math.max(20, profile.f1 * .5), now + profile.dur);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(profile.voice * (variant === 'brute' ? .95 : .45), now);
    sub.connect(subGain);
    subGain.connect(out);
    sub.start(now + profile.delay);
    sub.stop(now + profile.dur + .03);
    sources.push(sub);
    nodes.push(subGain);

    if (profile.hollow) {
      const hollow = ctx.createOscillator();
      hollow.type = 'square';
      hollow.frequency.setValueAtTime(profile.f0 * 1.74, now);
      hollow.frequency.exponentialRampToValueAtTime(Math.max(35, profile.f1 * 1.2), now + profile.dur);
      const hollowGain = ctx.createGain();
      hollowGain.gain.setValueAtTime(profile.voice * .16, now);
      hollow.connect(hollowGain);
      hollowGain.connect(out);
      hollow.start(now + .09);
      hollow.stop(now + profile.dur * .86);
      sources.push(hollow);
      nodes.push(hollowGain);
    }

    const len = Math.max(1, Math.floor(ctx.sampleRate * profile.dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const envelope = Math.sin(Math.PI * t) * (variant === 'speedy' ? 1 - t * .35 : 1);
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const breath = ctx.createBufferSource();
    const breathFilter = ctx.createBiquadFilter();
    const breathGain = ctx.createGain();
    breath.buffer = buffer;
    breathFilter.type = variant === 'speedy' || variant === 'grey' ? 'bandpass' : 'lowpass';
    breathFilter.frequency.setValueAtTime(profile.breathFreq, now);
    breathFilter.Q.setValueAtTime(profile.q, now);
    breathGain.gain.setValueAtTime(profile.breath, now);
    breath.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(out);
    breath.start(now);
    breath.stop(now + profile.dur + .03);
    sources.push(breath);
    nodes.push(breathFilter, breathGain);

    const handle = {
      duration: profile.dur,
      stop() {
        if (cleaned) return;
        cleaned = true;
        zombieMoanSources = zombieMoanSources.filter(item => item !== handle);
        for (const src of sources) {
          try { src.stop(); } catch (_) {}
          try { src.disconnect(); } catch (_) {}
        }
        for (const node of nodes) {
          try { node.disconnect(); } catch (_) {}
        }
      }
    };

    zombieMoanSources.push(handle);
    setTimeout(() => handle.stop(), Math.ceil((profile.dur + .08) * 1000));
    return handle;
  }

  function surfaceFoleySurface(options = {}) {
    return String(options.surface || 'grass').toLowerCase();
  }

  function synthFootstep(options = {}, level = 1) {
    const surface = surfaceFoleySurface(options);
    const gait = options.gait || 'walk';
    const land = gait === 'land';
    const heavy = land ? 1.55 : gait === 'run' ? 1.08 : 0.72;
    const body = {
      sand: [72, 760, 'bandpass', .6],
      snow: [84, 980, 'bandpass', .55],
      ice: [118, 2400, 'bandpass', 1.4],
      stone: [102, 1850, 'bandpass', .9],
      rock: [102, 1850, 'bandpass', .9],
      mud: [76, 520, 'lowpass', .7],
      water: [88, 1350, 'bandpass', .8],
      ash: [70, 640, 'lowpass', .6],
      wood: [112, 1250, 'bandpass', .9],
      grass: [86, 1120, 'bandpass', .65],
      dirt: [78, 740, 'lowpass', .7]
    }[surface] || [86, 1120, 'bandpass', .65];
    const [thump, textureFreq, filter, q] = body;
    const textureGain = (surface === 'ice' || surface === 'stone' || surface === 'rock') ? .052 : .04;
    tone(thump * rand(.92, 1.08), land ? .07 : .045, 'sine', .035 * heavy * level, thump * .62, 'foley');
    noise(land ? .09 : .055, textureGain * heavy * level, textureFreq * rand(.86, 1.14), 'foley', filter, .004, q);
    if (surface === 'water') noise(.12, .04 * heavy * level, 900, 'foley', 'bandpass', .035, .8);
    if (surface === 'ice') tone(720 * rand(.9, 1.12), .05, 'triangle', .019 * heavy * level, 1180, 'foley', .024);
  }

  function ambientBirds(level = 1) {
    const chirps = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < chirps; i++) {
      const delay = i * rand(.08, .28);
      const base = rand(2600, 4200);
      tone(base, .055, 'sine', .012 * level, base * rand(1.18, 1.55), 'ambient', delay);
    }
  }

  function ambientFrogs(level = 1) {
    const croaks = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < croaks; i++) {
      const delay = i * rand(.18, .42);
      tone(rand(82, 132), .16, 'sawtooth', .018 * level, rand(58, 92), 'ambient', delay);
      noise(.09, .012 * level, 420, 'ambient', 'lowpass', delay + .025, .8);
    }
  }

  function ambientWind(level = 1, cold = false) {
    noise(rand(.35, .75), (cold ? .03 : .022) * level, cold ? rand(900, 1500) : rand(420, 840), 'ambient', cold ? 'bandpass' : 'lowpass', 0, cold ? 2.2 : .7);
  }

  function ambientInsects(level = 1) {
    noise(rand(.16, .34), .011 * level, rand(2600, 4200), 'ambient', 'bandpass', 0, 4.5);
  }

  function ambientRumble(level = 1) {
    tone(rand(42, 68), rand(.45, .9), 'sine', .014 * level, rand(28, 44), 'ambient');
    noise(.5, .01 * level, 260, 'ambient', 'lowpass');
  }

  function ambientDistantGunfire(level = 1) {
    const shots = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < shots; i++) {
      const delay = i * rand(.08, .28);
      noise(.018, .022 * level, rand(1600, 3000), 'ambient', 'bandpass', delay, 1.1);
      tone(rand(90, 140), .075, 'triangle', .014 * level, rand(45, 70), 'ambient', delay + .012);
    }
  }

  function ambientDistantExplosion(level = 1) {
    noise(.28, .042 * level, 360, 'ambient', 'lowpass', 0, .55);
    tone(rand(38, 58), .42, 'sine', .026 * level, rand(24, 34), 'ambient');
  }

  function ambientDistantZombie(level = 1) {
    tone(rand(72, 104), rand(.32, .62), 'sawtooth', .018 * level, rand(42, 66), 'ambient');
    noise(.38, .018 * level, rand(460, 900), 'ambient', 'bandpass', .035, 2.2);
  }

  function synthAmbientSweetener(cue) {
    if (cue === 'ambientForest') {
      if (Math.random() < .7) ambientBirds(.9);
      else ambientWind(.75);
    } else if (cue === 'ambientSwamp') {
      if (Math.random() < .58) ambientFrogs(1);
      else ambientInsects(.9);
    } else if (cue === 'ambientDunes') {
      ambientWind(.95);
      if (Math.random() < .35) noise(.18, .012, 1850, 'ambient', 'bandpass', .08, 2.8);
    } else if (cue === 'ambientRocky') {
      ambientWind(.75);
    } else if (cue === 'ambientAshlands') {
      if (Math.random() < .6) ambientRumble(.9);
      else ambientWind(.8);
    } else if (cue === 'ambientTundra') {
      if (Math.random() < .75) ambientWind(.95, true);
      else ambientBirds(.45);
    } else if (cue === 'ambientMenu') {
      const roll = Math.random();
      ambientWind(.95);
      if (roll < .18) ambientDistantExplosion(.9);
      else if (roll < .42) ambientDistantGunfire(.85);
      else if (roll < .66) ambientDistantZombie(.75);
      else ambientRumble(.65);
    }
  }

  function synth(name, gainValue = 1, playbackRate = 1, options = {}) {
    if (name === 'shoot') {
      rifleShot(gainValue);
    } else if (name === 'empty') {
      dryFire(gainValue);
    } else if (name === 'reloadStart') {
      reloadStartSynth(gainValue);
    } else if (name === 'reloadDone') {
      reloadDoneSynth(gainValue);
    } else if (name === 'block') {
      noise(.055, .075 * gainValue, 520, 'foley');
      tone(165, .045, 'square', .035 * gainValue, 110, 'foley');
    } else if (name === 'hit') {
      noise(.018, .034 * gainValue, 2400, 'sfx', 'bandpass', 0, 1.7);
      tone(510, .045, 'triangle', .052 * gainValue, 290, 'sfx');
      tone(920, .028, 'square', .018 * gainValue, 620, 'sfx', .035);
    } else if (name === 'head') {
      noise(.025, .06 * gainValue, 1900);
      tone(980, .045, 'square', .065 * gainValue, 1450);
      setTimeout(() => tone(520, .055, 'triangle', .045 * gainValue, 780), 45);
    } else if (name === 'kill') {
      tone(260, .075, 'square', .055 * gainValue, 390);
      setTimeout(() => tone(520, .08, 'triangle', .05 * gainValue, 780), 80);
    } else if (name === 'pickup' || name === 'pickupAmmo') {
      pickupAmmoSynth(gainValue);
    } else if (name === 'pickupHealth') {
      pickupHealthSynth(gainValue);
    } else if (name === 'pickupC4') {
      pickupC4Synth(gainValue);
    } else if (name === 'hurt') {
      playerPainSynth(gainValue);
    } else if (name === 'death') {
      playerDeathSynth(gainValue);
    } else if (name === 'toxin') {
      tone(115, .11, 'sawtooth', .045 * gainValue, 62);
      noise(.08, .045 * gainValue, 360);
    } else if (name === 'land') {
      synthFootstep({ ...options, gait: 'land' }, gainValue);
    } else if (name === 'footstep') {
      synthFootstep(options, gainValue);
    } else if (name === 'objectiveClear') {
      tone(220, .08, 'triangle', .05 * gainValue, 330, 'ui');
      setTimeout(() => tone(440, .09, 'triangle', .05 * gainValue, 660, 'ui'), 85);
      setTimeout(() => tone(720, .11, 'sine', .045 * gainValue, 960, 'ui'), 175);
    } else if (name === 'wave') {
      tone(180, .08, 'sawtooth', .05 * gainValue, 120, 'ui');
      setTimeout(() => tone(330, .09, 'triangle', .045 * gainValue, 480, 'ui'), 85);
    } else if (name === 'heartbeat') {
      tone(56, .12, 'sine', .052 * gainValue, 42, 'ui');
      tone(68, .095, 'sine', .038 * gainValue, 46, 'ui', .18);
      noise(.05, .012 * gainValue, 210, 'ui', 'lowpass', .02, .6);
    } else if (name === 'confirm') {
      noise(.012, .018 * gainValue, 2600, 'ui');
      tone(1150, .018, 'square', .018 * gainValue, 640, 'ui');
      setTimeout(() => tone(420, .018, 'triangle', .012 * gainValue, 260, 'ui'), 18);
    } else if (name === 'briefing') {
      radioStatic(.045, .07, 1200);
      tone(1180, .025, 'square', .018 * gainValue, 680, 'ui');
      setTimeout(() => radioStatic(.13, .045, 2100), 34);
      setTimeout(() => tone(330, .035, 'square', .018 * gainValue, 190, 'ui'), 128);
      setTimeout(() => radioStatic(.055, .026, 850), 168);
    } else if (name === 'perkEquip') {
      perkEquipSynth(gainValue);
    } else if (name === 'explosion') {
      explosionSynth(gainValue);
    } else if (name === 'zombieMoan') {
      return zombieMoanSynth(gainValue, playbackRate, options);
    } else if (name === 'voiceDrop') {
      voiceDropSynth(gainValue);
    } else if (name === 'voiceTriple') {
      voiceTripleSynth(gainValue);
    }
  }

  function trackSynthOneShot(name) {
    activeOneShots++;
    setTimeout(() => {
      activeOneShots = Math.max(0, activeOneShots - 1);
    }, name === 'land' ? 120 : name === 'footstep' ? 90 : 260);
  }

  function stopProceduralAmbience() {
    if (proceduralAmbientTimer) clearTimeout(proceduralAmbientTimer);
    proceduralAmbientTimer = null;
    proceduralAmbientName = '';
  }

  function nextAmbientDelay(name) {
    if (name === 'ambientSwamp') return rand(2.8, 6.2);
    if (name === 'ambientForest') return rand(3.6, 8);
    if (name === 'ambientDunes' || name === 'ambientTundra') return rand(3.2, 7);
    if (name === 'ambientAshlands') return rand(4.4, 9);
    if (name === 'ambientMenu') return rand(2.4, 5.6);
    return rand(5, 11);
  }

  function scheduleProceduralAmbience(name, first = false) {
    if (!ambientEnabled || !name) return;
    if (proceduralAmbientTimer) clearTimeout(proceduralAmbientTimer);
    const delay = first ? (name === 'ambientMenu' ? rand(.35, 1.1) : rand(1.2, 3.2)) : nextAmbientDelay(name);
    proceduralAmbientTimer = setTimeout(() => {
      proceduralAmbientTimer = null;
      if (ambientEnabled && proceduralAmbientName === name && ambientTargetName === name) {
        synthAmbientSweetener(name);
        scheduleProceduralAmbience(name);
      }
    }, delay * 1000);
  }

  function startProceduralAmbience(name) {
    if (!ambientEnabled || !name) return;
    if (proceduralAmbientName === name && proceduralAmbientTimer) return;
    proceduralAmbientName = name;
    scheduleProceduralAmbience(name, true);
  }

  function stopAmbient() {
    stopProceduralAmbience();
    activeAmbientName = '';
    ambientTargetName = '';
  }

  function requestAmbient(name) {
    if (!ambientEnabled || !name) {
      stopAmbient();
      return;
    }

    if (activeAmbientName === name && proceduralAmbientName === name) return;

    ambientTargetName = name;
    activeAmbientName = name;
    startProceduralAmbience(name);
  }

  window.ZomVoxSound = {
    setEnabled(value) {
      sfxEnabled = !!value;
    },

    setAmbientEnabled(value) {
      ambientEnabled = !!value;
      if (!ambientEnabled) stopAmbient();
    },

    prime(onProgress) {
      getAudio();
      if (typeof onProgress === 'function') {
        onProgress({ loaded: 1, total: 1, fileName: 'procedural-synth', ok: true, progress: 1 });
      }
      return Promise.resolve(['procedural-synth']);
    },

    play(name, gainValue = 1, playbackRate = 1, options = {}) {
      if (!sfxEnabled) return;

      if (name === 'land' && activeOneShots > 0) return;

      if (name !== 'footstep') trackSynthOneShot(name);
      return synth(name, gainValue, playbackRate, options);
    },

    playAmbient(name) {
      requestAmbient(name);
    },

    stopAmbient() {
      ambientTargetName = '';
      stopAmbient();
    }
  };
})();
