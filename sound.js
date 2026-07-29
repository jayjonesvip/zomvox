(() => {
  'use strict';

  const config = window.ZOMVOX_CONFIG || {};
  const soundFiles = (config.audio && config.audio.files) || {};
  const enemyConfig = config.enemies || {};
  const SILENCE_TRIM_THRESHOLD = 0.003;
  const SILENCE_TRIM_MAX_SECONDS = 0.65;
  const SILENCE_TRIM_PREROLL_SECONDS = 0.006;
  const ZOMBIE_MOAN_MAX_OVERLAP = Math.max(1, Math.floor(Number(enemyConfig.zombieMoanMaxVoices) || 3));
  const BUS_LEVELS = {
    weapon: 1.05,
    foley: 0.58,
    ambient: 0.46,
    enemy: 0.49,
    ui: 0.86,
    sfx: 0.72
  };

  let sfxEnabled = true;
  let ambientEnabled = true;
  let audioCtx = null;
  let busGains = null;
  let ambientSource = null;
  let ambientGain = null;
  let ambientTargetName = '';
  let activeAmbientName = '';
  let proceduralAmbientName = '';
  let proceduralAmbientTimer = null;
  let activeOneShots = 0;
  let landSource = null;
  let zombieMoanSources = [];

  // decoded AudioBuffers, not HTMLAudioElement objects
  const bufferCache = new Map();
  const loadingCache = new Map();
  const leadInCache = new WeakMap();
  const reverseBufferCache = new WeakMap();

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
    if (name === 'confirm' || name === 'briefing' || name === 'perkEquip' || name === 'objectiveClear' || name === 'wave' || name === 'heartbeat') return 'ui';
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

  function radioStatic(dur = .08, gainValue = .04, center = 1600, busName = 'ui') {
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
    const now = ctx.currentTime;

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
      if (Math.random() < .45) ambientRumble(.45);
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
    }
  }

  function soundKey(fileName) {
    return 'assets/' + fileName;
  }

  function loadFile(fileName) {
    const ctx = getAudio();
    if (!ctx || !fileName) return Promise.resolve(null);

    const key = soundKey(fileName);

    if (bufferCache.has(key)) {
      return Promise.resolve(bufferCache.get(key));
    }

    if (loadingCache.has(key)) {
      return loadingCache.get(key);
    }

    const promise = fetch(key)
      .then(res => {
        if (!res.ok) throw new Error('Audio load failed: ' + key);
        return res.arrayBuffer();
      })
      .then(arrayBuffer => ctx.decodeAudioData(arrayBuffer))
      .then(buffer => {
        bufferCache.set(key, buffer);
        loadingCache.delete(key);
        return buffer;
      })
      .catch(err => {
        console.warn(err);
        loadingCache.delete(key);
        return null;
      });

    loadingCache.set(key, promise);
    return promise;
  }

  function configuredFiles() {
    const files = Object.values(soundFiles).filter(fileName => !!fileName);
    return Array.from(new Set(files));
  }

  function leadInOffset(buffer) {
    if (!buffer || buffer.duration < 0.08) return 0;
    if (leadInCache.has(buffer)) return leadInCache.get(buffer);

    const maxSamples = Math.min(buffer.length, Math.floor(buffer.sampleRate * SILENCE_TRIM_MAX_SECONDS));
    let offset = 0;

    // MP3s from public SFX libraries often have padded silence before the hit.
    // Find the first meaningful sample and keep a tiny pre-roll so attacks stay natural.
    scan:
    for (let i = 0; i < maxSamples; i += 32) {
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        if (Math.abs(buffer.getChannelData(channel)[i]) >= SILENCE_TRIM_THRESHOLD) {
          offset = Math.max(0, i / buffer.sampleRate - SILENCE_TRIM_PREROLL_SECONDS);
          break scan;
        }
      }
    }

    leadInCache.set(buffer, offset);
    return offset;
  }

  function reversedBuffer(buffer) {
    const ctx = getAudio();
    if (!ctx || !buffer) return buffer;
    if (reverseBufferCache.has(buffer)) return reverseBufferCache.get(buffer);

    const reversed = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const source = buffer.getChannelData(channel);
      const target = reversed.getChannelData(channel);
      for (let i = 0, j = source.length - 1; i < source.length; i++, j--) {
        target[i] = source[j];
      }
    }

    reverseBufferCache.set(buffer, reversed);
    return reversed;
  }

  function stopLand() {
    if (!landSource) return;
    try { landSource.stop(); } catch (_) {}
    landSource.onended = null;
    landSource.disconnect();
    landSource = null;
    activeOneShots = Math.max(0, activeOneShots - 1);
  }

  function trackSynthOneShot(name) {
    activeOneShots++;
    setTimeout(() => {
      activeOneShots = Math.max(0, activeOneShots - 1);
    }, name === 'land' ? 120 : name === 'footstep' ? 90 : 260);
  }

  function playBuffer(buffer, gainValue = 1, trimLeadingSilence = true, name = '', playbackRate = 1) {
    const ctx = getAudio();
    if (!ctx || !buffer) return false;

    if (name === 'land' && activeOneShots > 0) return true;
    if (name === 'zombieMoan' && zombieMoanSources.length >= ZOMBIE_MOAN_MAX_OVERLAP) return true;
    if (name !== 'land') stopLand();

    const requestedRate = Number(playbackRate) || 1;
    const sourceBuffer = requestedRate < 0 ? reversedBuffer(buffer) : buffer;
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();

    src.buffer = sourceBuffer;
    src.playbackRate.value = Math.max(0.5, Math.min(1.6, Math.abs(requestedRate) || 1));
    gain.gain.value = gainValue;

    src.connect(gain);
    connectOutput(gain, busForSound(name));

    activeOneShots++;
    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      activeOneShots = Math.max(0, activeOneShots - 1);
      if (landSource === src) landSource = null;
      if (name === 'zombieMoan') zombieMoanSources = zombieMoanSources.filter(item => item !== src);
    }
    src.onended = cleanup;
    if (name === 'land') landSource = src;
    if (name === 'zombieMoan') zombieMoanSources.push(src);

    src.start(ctx.currentTime, trimLeadingSilence ? leadInOffset(sourceBuffer) : 0);
    if (name !== 'zombieMoan') return true;

    return {
      stop() {
        cleanup();
        src.onended = null;
        try { src.stop(); } catch (_) {}
        try { src.disconnect(); } catch (_) {}
        try { gain.disconnect(); } catch (_) {}
      }
    };
  }

  function playFile(name, fileName, gainValue = 1, playbackRate = 1) {
    if (fileName === '') return true;
    if (!fileName) return false;

    const key = soundKey(fileName);
    const buffer = bufferCache.get(key);

    if (buffer) {
      const baseGain = name === 'land' ? .28 : 1;
      return playBuffer(buffer, baseGain * gainValue, true, name, playbackRate);
    }

    // Start loading, but don't block gameplay.
    loadFile(fileName);

    // Until decoded, fall back to synth so button presses still feel responsive.
    return false;
  }

  function stopProceduralAmbience() {
    if (proceduralAmbientTimer) clearTimeout(proceduralAmbientTimer);
    proceduralAmbientTimer = null;
    proceduralAmbientName = '';
  }

  function stopAmbientLoop(clearActiveName = true) {
    if (ambientSource) {
      try { ambientSource.stop(); } catch (_) {}
      ambientSource.onended = null;
      ambientSource.disconnect();
    }
    if (ambientGain) ambientGain.disconnect();
    ambientSource = null;
    ambientGain = null;
    if (clearActiveName) activeAmbientName = '';
  }

  function nextAmbientDelay(name) {
    if (name === 'ambientSwamp') return rand(2.8, 6.2);
    if (name === 'ambientForest') return rand(3.6, 8);
    if (name === 'ambientDunes' || name === 'ambientTundra') return rand(3.2, 7);
    if (name === 'ambientAshlands') return rand(4.4, 9);
    if (name === 'ambientMenu') return rand(8, 18);
    return rand(5, 11);
  }

  function scheduleProceduralAmbience(name, first = false) {
    if (!ambientEnabled || !name) return;
    if (proceduralAmbientTimer) clearTimeout(proceduralAmbientTimer);
    const delay = first ? rand(1.2, 3.2) : nextAmbientDelay(name);
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
    stopAmbientLoop();
    stopProceduralAmbience();
  }

  function startAmbientBuffer(name, buffer) {
    const ctx = getAudio();
    if (!ctx || !buffer || !ambientEnabled || ambientTargetName !== name) return;

    stopAmbientLoop(false);

    const src = ctx.createBufferSource();
    const gain = ctx.createGain();

    src.buffer = buffer;
    src.loop = true;
    gain.gain.value = .32;

    src.connect(gain);
    connectOutput(gain, 'ambient');

    src.onended = () => {
      if (ambientSource === src) {
        ambientSource = null;
        ambientGain = null;
        activeAmbientName = '';
      }
    };

    ambientSource = src;
    ambientGain = gain;
    activeAmbientName = name;
    startProceduralAmbience(name);
    src.start(ctx.currentTime);
  }

  function requestAmbient(name) {
    if (!ambientEnabled || !name) {
      ambientTargetName = '';
      stopAmbient();
      return;
    }

    const hasOverride = Object.prototype.hasOwnProperty.call(soundFiles, name);
    const fileName = hasOverride ? soundFiles[name] : '';

    if (fileName === '') {
      stopAmbient();
      return;
    }

    if (activeAmbientName === name && (ambientSource || proceduralAmbientName === name)) return;

    ambientTargetName = name;
    startProceduralAmbience(name);

    if (!fileName) {
      stopAmbientLoop(false);
      activeAmbientName = name;
      return;
    }

    const key = soundKey(fileName);
    const buffer = bufferCache.get(key);

    if (buffer) {
      startAmbientBuffer(name, buffer);
      return;
    }

    loadFile(fileName).then(loadedBuffer => {
      if (ambientTargetName === name) startAmbientBuffer(name, loadedBuffer);
    });
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

      const files = configuredFiles();
      const total = files.length;
      let loaded = 0;

      function report(fileName = '', ok = true) {
        if (typeof onProgress !== 'function') return;
        onProgress({
          loaded,
          total,
          fileName,
          ok,
          progress: total ? loaded / total : 1
        });
      }

      report();
      if (!total) return Promise.resolve([]);

      return Promise.all(files.map(fileName => {
        return loadFile(fileName).then(buffer => {
          loaded++;
          report(fileName, !!buffer);
          return buffer;
        });
      }));
    },

    play(name, gainValue = 1, playbackRate = 1, options = {}) {
      if (!sfxEnabled) return;

      const hasOverride = Object.prototype.hasOwnProperty.call(soundFiles, name);
      const fileName = hasOverride
        ? soundFiles[name]
        : ((name === 'pickupAmmo' || name === 'pickupHealth' || name === 'pickupC4') ? soundFiles.pickup : null);

      if (fileName === '') return;

      if (name === 'land' && activeOneShots > 0) return;
      if (name !== 'land') stopLand();

      const handle = playFile(name, fileName, gainValue, playbackRate);
      if (handle) return handle === true ? undefined : handle;

      if (name !== 'footstep') trackSynthOneShot(name);
      synth(name, gainValue, playbackRate, options);
      return undefined;
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
