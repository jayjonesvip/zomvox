(() => {
  'use strict';

  const config = window.ZOMVOX_CONFIG || {};
  const enemyConfig = config.enemies || {};
  const audioConfig = config.audio || {};
  const audioFileConfig = audioConfig.files || {};
  const commandVoiceConfig = audioConfig.commandVoice || {};
  const ZOMBIE_MOAN_MAX_OVERLAP = Math.max(1, Math.floor(Number(enemyConfig.zombieMoanMaxVoices) || 3));
  const DEFAULT_FILE_CUES = {
    shoot: 'shoot.mp3',
    zombieMoan: 'zombiemoan.wav'
  };
  const BUS_LEVELS = {
    weapon: 1.08,
    foley: 0.58,
    ambient: 0.31,
    enemy: 0.82,
    ui: 0.86,
    sfx: 0.70
  };

  let sfxEnabled = true;
  let ambientEnabled = true;
  let audioCtx = null;
  let busGains = null;
  let ambientTargetName = '';
  let activeAmbientName = '';
  let proceduralAmbientName = '';
  let proceduralAmbientTimer = null;
  let ambientBed = null;
  let audioBuffers = new Map();
  let audioLoadPromises = new Map();
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

  function softLimitCurve(amount = 1.7) {
    const samples = 1024;
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = i / (samples - 1) * 2 - 1;
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  function buses() {
    const ctx = getAudio();
    if (!ctx) return null;
    if (busGains && busGains.context === ctx) return busGains;

    busGains = { context: ctx };
    const masterInput = ctx.createGain();
    const compressor = ctx.createDynamicsCompressor();
    const softLimiter = ctx.createWaveShaper();
    const master = ctx.createGain();

    masterInput.gain.value = 0.96;
    // Mild glue compression catches stacked mobile peaks without flattening the lo-fi punch.
    compressor.threshold.value = -12;
    compressor.knee.value = 18;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.18;
    softLimiter.curve = softLimitCurve();
    softLimiter.oversample = '2x';
    master.gain.value = 0.92;

    masterInput.connect(compressor);
    compressor.connect(softLimiter);
    softLimiter.connect(master);
    master.connect(ctx.destination);
    busGains.masterInput = masterInput;
    busGains.compressor = compressor;
    busGains.softLimiter = softLimiter;
    busGains.master = master;

    for (const name of Object.keys(BUS_LEVELS)) {
      const gain = ctx.createGain();
      gain.gain.value = BUS_LEVELS[name];
      gain.connect(masterInput);
      busGains[name] = gain;
    }
    return busGains;
  }

  function busForSound(name) {
    if (name === 'shoot' || name === 'empty' || name === 'reloadStart' || name === 'reloadStep' || name === 'reloadDone' || name === 'explosion') return 'weapon';
    if (name === 'land' || name === 'footstep' || name === 'block') return 'foley';
    if (name === 'zombieMoan') return 'enemy';
    if (name && name.startsWith('ambient')) return 'ambient';
    if (name === 'hurt' || name === 'death') return 'sfx';
    if (name === 'confirm' || name === 'briefing' || name === 'perkEquip' || name === 'objectiveClear' || name === 'wave' || name === 'heartbeat' || name === 'voiceDrop' || name === 'voiceTriple' || name === 'voiceFewMore' || name === 'voiceLowHealth' || name === 'voiceLongRange') return 'ui';
    return 'sfx';
  }

  function connectOutput(node, busName = 'sfx', pan = 0) {
    const mix = buses();
    if (!mix || !node) return;
    const out = mix[busName] || mix.sfx;
    const ctx = mix.context;
    const safePan = Math.max(-1, Math.min(1, Number(pan) || 0));
    if (Math.abs(safePan) > 0.001 && ctx && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = safePan;
      node.connect(panner);
      panner.connect(out);
      return panner;
    }
    node.connect(out);
  }

  function configuredFileName(name) {
    if (Object.prototype.hasOwnProperty.call(audioFileConfig, name)) return audioFileConfig[name];
    return DEFAULT_FILE_CUES[name] || '';
  }

  function fileCueUrl(fileName) {
    if (!fileName || typeof fileName !== 'string') return '';
    if (/^(https?:|data:|blob:)/i.test(fileName)) return fileName;
    return fileName.startsWith('assets/') ? fileName : 'assets/' + fileName;
  }

  function reverseBuffer(ctx, buffer) {
    const reversed = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const src = buffer.getChannelData(channel);
      const dst = reversed.getChannelData(channel);
      for (let i = 0, j = src.length - 1; i < src.length; i++, j--) {
        dst[i] = src[j];
      }
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
      .then(response => {
        if (!response.ok) throw new Error(response.status + ' ' + response.statusText);
        return response.arrayBuffer();
      })
      .then(data => ctx.decodeAudioData(data))
      .then(buffer => {
        audioBuffers.set(name, buffer);
        return { name, fileName, ok: true };
      })
      .catch(err => {
        audioBuffers.set(name, null);
        console.warn('ZomVox audio file unavailable, using procedural fallback:', fileName, err);
        return { name, fileName, ok: false };
      });

    audioLoadPromises.set(name, promise);
    return promise;
  }

  function fileBufferForPlayback(ctx, name, playbackRate = 1) {
    const buffer = audioBuffers.get(name);
    if (!buffer) {
      loadFileCue(name);
      return null;
    }

    if (Number(playbackRate) >= 0) return buffer;

    const reversedKey = name + ':reverse';
    if (!audioBuffers.has(reversedKey)) {
      audioBuffers.set(reversedKey, reverseBuffer(ctx, buffer));
    }
    return audioBuffers.get(reversedKey);
  }

  function playFileCue(name, gainValue = 1, playbackRate = 1, options = {}) {
    const ctx = getAudio();
    if (!ctx || !configuredFileName(name)) return null;
    if (name === 'zombieMoan' && zombieMoanSources.length >= ZOMBIE_MOAN_MAX_OVERLAP) return null;

    const buffer = fileBufferForPlayback(ctx, name, playbackRate);
    if (!buffer) return null;

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const rate = Math.max(0.25, Math.min(2, Math.abs(Number(playbackRate) || 1)));
    const pan = clamp(options.pan, -0.65, 0.65, 0);
    const nodes = [gain];
    let cleaned = false;

    source.buffer = buffer;
    source.playbackRate.setValueAtTime(rate, now);
    gain.gain.setValueAtTime(Math.max(0, gainValue), now);

    source.connect(gain);
    const panNode = connectOutput(gain, busForSound(name), pan);
    if (panNode) nodes.push(panNode);

    const handle = {
      duration: buffer.duration / rate,
      stop() {
        if (cleaned) return;
        cleaned = true;
        if (name === 'zombieMoan') zombieMoanSources = zombieMoanSources.filter(item => item !== handle);
        try { source.stop(); } catch (_) {}
        try { source.disconnect(); } catch (_) {}
        for (const node of nodes) {
          try { node.disconnect(); } catch (_) {}
        }
      }
    };

    source.onended = handle.stop;
    if (name === 'zombieMoan') zombieMoanSources.push(handle);
    source.start(now);
    return handle;
  }

  function shapeImpulseGain(param, now, peak, attack, decay) {
    const safePeak = Math.max(0.0001, peak);
    const safeAttack = Math.max(0.001, attack);
    const safeDecay = Math.max(0.006, decay);
    param.cancelScheduledValues(now);
    param.setValueAtTime(0.0001, now);
    param.linearRampToValueAtTime(safePeak, now + safeAttack);
    param.exponentialRampToValueAtTime(0.001, now + safeAttack + safeDecay);
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

    shapeImpulseGain(g.gain, now, gain, Math.min(0.01, Math.max(0.0015, dur * 0.12)), dur);

    osc.connect(g);
    const outputNode = connectOutput(g, busName);
    osc.onended = () => {
      try { osc.disconnect(); } catch (_) {}
      try { g.disconnect(); } catch (_) {}
      if (outputNode) {
        try { outputNode.disconnect(); } catch (_) {}
      }
    };

    osc.start(now);
    osc.stop(now + dur + .02);
  }

  function attackDecayTone(freq, attack = .003, decay = .08, type = 'triangle', peakGain = .05, endFreq = null, busName = 'sfx', delay = 0) {
    tone(freq, attack + decay, type, peakGain, endFreq, busName, delay);
  }

  function chorusTone(freq, dur = .08, type = 'triangle', gain = .05, endFreq = null, busName = 'sfx', delay = 0, detuneHz = 7) {
    tone(freq, dur, type, gain * 0.68, endFreq, busName, delay);
    tone(freq + detuneHz, dur * 1.04, type, gain * 0.46, endFreq ? endFreq + detuneHz : null, busName, delay + 0.002);
  }

  function physicalTone(freq, dur = .08, type = 'triangle', gain = .05, endFreq = null, busName = 'sfx', delay = 0, noiseCutoff = 1200, noiseFilter = 'bandpass', noiseGain = 0.018, q = 1.2) {
    noise(Math.max(0.018, dur * 0.55), noiseGain, noiseCutoff, busName, noiseFilter, delay, q);
    tone(freq, dur, type, gain, endFreq, busName, delay + 0.001);
  }

  function pannedNoise(dur = .05, gain = .08, cutoff = 1200, busName = 'sfx', filterType = 'lowpass', delay = 0, q = 0.7, pan = 0) {
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
    shapeImpulseGain(g.gain, now, gain, Math.min(0.008, Math.max(0.0015, dur * 0.1)), dur);

    src.buffer = buffer;
    src.connect(filt);
    filt.connect(g);
    const outputNode = connectOutput(g, busName, pan);
    src.onended = () => {
      try { src.disconnect(); } catch (_) {}
      try { filt.disconnect(); } catch (_) {}
      try { g.disconnect(); } catch (_) {}
      if (outputNode) {
        try { outputNode.disconnect(); } catch (_) {}
      }
    };

    src.start(now);
    src.stop(now + dur + .02);
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

    shapeImpulseGain(g.gain, now, gain, Math.min(0.008, Math.max(0.0015, dur * 0.1)), dur);

    src.buffer = buffer;
    src.connect(filt);
    filt.connect(g);
    const outputNode = connectOutput(g, busName);
    src.onended = () => {
      try { src.disconnect(); } catch (_) {}
      try { filt.disconnect(); } catch (_) {}
      try { g.disconnect(); } catch (_) {}
      if (outputNode) {
        try { outputNode.disconnect(); } catch (_) {}
      }
    };

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

    shapeImpulseGain(gain.gain, now, gainValue, Math.min(0.008, Math.max(0.0015, dur * 0.08)), dur);

    src.buffer = buffer;
    src.connect(band);
    band.connect(gain);
    const outputNode = connectOutput(gain, busName);
    src.onended = () => {
      try { src.disconnect(); } catch (_) {}
      try { band.disconnect(); } catch (_) {}
      try { gain.disconnect(); } catch (_) {}
      if (outputNode) {
        try { outputNode.disconnect(); } catch (_) {}
      }
    };

    src.start(now);
    src.stop(now + dur + .02);
  }

  function createRadioStaticBed(level = .035, center = 1450) {
    const ctx = getAudio();
    if (!ctx) return null;

    const len = Math.max(1, Math.floor(ctx.sampleRate * 1.8));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const flutter = 0.72 + Math.sin(i * 0.017) * 0.16 + Math.random() * 0.18;
      data[i] = (Math.random() * 2 - 1) * flutter;
    }

    const source = ctx.createBufferSource();
    const band = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const freqLfo = ctx.createOscillator();
    const freqLfoGain = ctx.createGain();
    const now = ctx.currentTime;
    const nodes = [source, band, gain, lfo, lfoGain, freqLfo, freqLfoGain];
    let stopped = false;

    source.buffer = buffer;
    source.loop = true;
    band.type = 'bandpass';
    band.frequency.setValueAtTime(center, now);
    band.Q.setValueAtTime(1.55, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(Math.max(0.0001, level), now + .055);

    // Slow amplitude and filter wobble keep the bed radio-like instead of plain pink noise.
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(rand(8, 13), now);
    lfoGain.gain.setValueAtTime(level * .38, now);
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);

    freqLfo.type = 'sine';
    freqLfo.frequency.setValueAtTime(rand(1.8, 3.4), now);
    freqLfoGain.gain.setValueAtTime(rand(110, 260), now);
    freqLfo.connect(freqLfoGain);
    freqLfoGain.connect(band.frequency);

    source.connect(band);
    band.connect(gain);
    const outputNode = connectOutput(gain, 'ui');
    if (outputNode) nodes.push(outputNode);

    source.start(now);
    lfo.start(now);
    freqLfo.start(now);

    return {
      stop(fade = .09) {
        if (stopped) return;
        stopped = true;
        const stopAt = ctx.currentTime + Math.max(.025, fade);
        try {
          gain.gain.cancelScheduledValues(ctx.currentTime);
          gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, stopAt);
        } catch (_) {}

        setTimeout(() => {
          for (const node of [source, lfo, freqLfo]) {
            try { node.stop(); } catch (_) {}
          }
          for (const node of nodes) {
            try { node.disconnect(); } catch (_) {}
          }
        }, Math.ceil((fade + .04) * 1000));
      }
    };
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  function optionVolumeScale(options = {}) {
    const explicit = Number(options.volumeScale);
    let scale = Number.isFinite(explicit) ? explicit : 1;
    const distance = Number(options.distance);
    if (Number.isFinite(distance)) {
      scale *= clamp(1 - distance / 16, .18, 1, 1);
    }
    return clamp(scale, .05, 1.25, 1);
  }

  function shotgunShot(level = 1) {
    const pitch = rand(.86, 1.02);
    const pan = rand(-0.05, 0.05);
    // Shotgun layers: very short pressure crack, lower body, airy tail, and tiny pellet grit.
    noise(.012, .55 * level, 7200 * pitch, 'weapon', 'highpass', 0, .8);
    noise(.038, .44 * level, 3200 * pitch, 'weapon', 'bandpass', .003, 1.05);
    noise(.16, .24 * level, 1160 * pitch, 'weapon', 'lowpass', .011, .55);
    noise(.52, .105 * level, 470 * pitch, 'weapon', 'lowpass', .035, .42);
    physicalTone(104 * pitch, .12, 'sine', .20 * level, 38 * pitch, 'weapon', 0, 390, 'lowpass', .035 * level, .5);
    physicalTone(48 * pitch, .25, 'triangle', .12 * level, 24 * pitch, 'weapon', .006, 230, 'lowpass', .022 * level, .42);
    physicalTone(920 * pitch, .032, 'square', .034 * level, 430 * pitch, 'weapon', .016, 2500, 'bandpass', .022 * level, 1.9);
    for (let i = 0; i < 7; i++) {
      const delay = .018 + i * rand(.009, .018);
      noise(rand(.012, .024), .036 * level, rand(2100, 5200) * pitch, 'weapon', 'bandpass', delay, rand(1.1, 2.6));
    }
    // A tiny metallic shell/ejector hint keeps the weapon feeling mechanical without a sample.
    pannedNoise(.032, .024 * level, 5600 * pitch, 'weapon', 'highpass', .13, 2.4, pan);
    physicalTone(1860 * pitch, .028, 'triangle', .016 * level, 1220 * pitch, 'weapon', .145, 3600 * pitch, 'bandpass', .008 * level, 2.3);
    pannedNoise(.018, .012 * level, 4200 * pitch, 'weapon', 'bandpass', .165, 2.1, -pan * .8);
  }

  function dryFire(level = 1) {
    const pitch = rand(.94, 1.08);
    noise(.012, .045 * level, 3600 * pitch, 'weapon', 'highpass', 0, 2.4);
    physicalTone(1320 * pitch, .018, 'square', .024 * level, 820 * pitch, 'weapon', 0, 2900 * pitch, 'bandpass', .014 * level, 2.2);
    physicalTone(360 * pitch, .032, 'triangle', .018 * level, 220 * pitch, 'weapon', .018, 1150 * pitch, 'bandpass', .012 * level, 1.5);
    noise(.026, .022 * level, 1500 * pitch, 'weapon', 'bandpass', .018, 1.8);
  }

  function reloadMetalHit(time, level = 1, base = 1600, low = 700, pan = 0) {
    const pitch = rand(.94, 1.08);
    // A struck metal part reads more physical as several tiny partials plus contact noise.
    pannedNoise(.018, .014 * level, base * 2.1 * pitch, 'weapon', 'highpass', time, 2.2, pan);
    physicalTone(base * pitch, .034, 'triangle', .022 * level, base * .72 * pitch, 'weapon', time, base * 1.8 * pitch, 'bandpass', .008 * level, 1.9);
    physicalTone(base * 2.2 * pitch, .02, 'square', .012 * level, base * 1.2 * pitch, 'weapon', time + .004, base * 3.1 * pitch, 'bandpass', .005 * level, 2.5);
    physicalTone(low * pitch, .044, 'triangle', .014 * level, low * .72 * pitch, 'weapon', time + .002, low * 1.3 * pitch, 'bandpass', .006 * level, 1.2);
  }

  function reloadStartSynth(level = 1) {
    const pan = rand(-.12, .12);
    const pitch = rand(.94, 1.06);
    // Mag release and scrape, adapted from the other project's reloadPhase('start'/'magout').
    pannedNoise(.17, .052 * level, 1750 * pitch, 'weapon', 'bandpass', 0, .62, pan);
    reloadMetalHit(.034, 1.2 * level, 1780 * pitch, 820 * pitch, pan);
    pannedNoise(.12, .055 * level, 3200 * pitch, 'weapon', 'bandpass', .074, 1.15, -pan * .8);
    pannedNoise(.09, .035 * level, 1450 * pitch, 'weapon', 'bandpass', .145, .9, pan * .5);
    physicalTone(156 * pitch, .052, 'sine', .026 * level, 92 * pitch, 'weapon', .16, 430 * pitch, 'lowpass', .01 * level, .7);
  }

  function reloadStepSynth(level = 1) {
    const pan = rand(-.09, .09);
    const pitch = rand(.96, 1.08);
    // Per-round insert: low palm thunk plus a bright latch tick so the HUD count feels tactile.
    pannedNoise(.075, .032 * level, 1550 * pitch, 'weapon', 'bandpass', 0, .75, pan);
    physicalTone(205 * pitch, .05, 'sine', .043 * level, 112 * pitch, 'weapon', .018, 420 * pitch, 'lowpass', .014 * level, .65);
    reloadMetalHit(.046, .72 * level, 1320 * pitch, 620 * pitch, -pan);
    pannedNoise(.018, .016 * level, 6100 * pitch, 'weapon', 'highpass', .075, 2.4, pan * .8);
  }

  function reloadDoneSynth(level = 1) {
    const pan = rand(-.14, .14);
    const pitch = rand(.93, 1.05);
    // Charging handle: scrape, spring zing, then bolt into battery.
    pannedNoise(.082, .068 * level, 2800 * pitch, 'weapon', 'bandpass', 0, 1.55, pan);
    physicalTone(1180 * pitch, .035, 'triangle', .024 * level, 840 * pitch, 'weapon', .046, 2400 * pitch, 'bandpass', .012 * level, 1.7);
    physicalTone(4900 * pitch, .145, 'sine', .018 * level, 7200 * pitch, 'weapon', .055, 5200 * pitch, 'bandpass', .006 * level, 3.8);
    pannedNoise(.034, .042 * level, 4200 * pitch, 'weapon', 'highpass', .096, 1.6, -pan);
    physicalTone(150 * pitch, .062, 'sine', .052 * level, 88 * pitch, 'weapon', .108, 360 * pitch, 'lowpass', .017 * level, .62);
    reloadMetalHit(.112, 1.15 * level, 1750 * pitch, 760 * pitch, -pan * .7);
  }

  function explosionSynth(level = 1) {
    noise(.035, .42 * level, 3600, 'weapon', 'highpass', 0, .9);
    noise(.26, .25 * level, 760, 'weapon', 'lowpass', .018, .6);
    noise(.58, .12 * level, 320, 'weapon', 'lowpass', .05, .5);
    physicalTone(72, .26, 'sine', .18 * level, 28, 'weapon', 0, 360, 'lowpass', .04 * level, .48);
    physicalTone(38, .42, 'triangle', .12 * level, 24, 'weapon', .025, 240, 'lowpass', .032 * level, .42);
    for (let i = 0; i < 5; i++) {
      const delay = .05 + i * rand(.022, .055);
      physicalTone(rand(520, 1480), rand(.018, .044), 'square', .018 * level, rand(260, 720), 'weapon', delay, rand(1400, 3600), 'bandpass', .012 * level, 1.6);
      noise(rand(.018, .04), .022 * level, rand(1400, 3600), 'weapon', 'bandpass', delay, 1.6);
    }
  }

  function playerPainSynth(level = 1) {
    noise(.045, .06 * level, 850, 'sfx', 'bandpass', 0, 1.7);
    physicalTone(164, .12, 'sawtooth', .06 * level, 82, 'sfx', .004, 780, 'bandpass', .024 * level, 1.4);
    physicalTone(88, .18, 'triangle', .035 * level, 52, 'sfx', .024, 360, 'lowpass', .018 * level, .7);
    radioStatic(.05, .018 * level, 620, 'sfx');
  }

  function playerDeathSynth(level = 1) {
    noise(.11, .075 * level, 520, 'sfx', 'lowpass', 0, .75);
    physicalTone(122, .28, 'sawtooth', .075 * level, 42, 'sfx', 0, 520, 'lowpass', .025 * level, .7);
    physicalTone(58, .45, 'sine', .055 * level, 24, 'sfx', .045, 260, 'lowpass', .018 * level, .55);
    setTimeout(() => noise(.24, .04 * level, 390, 'sfx', 'lowpass', 0, .7), 125);
  }

  function pickupSparkle(level = 1, base = 520, busName = 'sfx') {
    noise(.025, .012 * level, base * 4, busName, 'bandpass', .018, 2.2);
    chorusTone(base, .052, 'triangle', .034 * level, base * 1.45, busName, 0, rand(5, 10));
    chorusTone(base * 1.9, .055, 'sine', .024 * level, base * 2.25, busName, .055, rand(5, 10));
  }

  function pickupAmmoSynth(level = 1) {
    noise(.026, .026 * level, 1900, 'sfx', 'bandpass', 0, 1.4);
    physicalTone(440, .045, 'triangle', .034 * level, 620, 'sfx', .006, 2200, 'bandpass', .014 * level, 1.4);
    physicalTone(780, .052, 'square', .018 * level, 520, 'sfx', .058, 1600, 'bandpass', .011 * level, 1.5);
  }

  function pickupHealthSynth(level = 1) {
    pickupSparkle(level, 620);
    chorusTone(930, .065, 'sine', .03 * level, 1320, 'sfx', .105, rand(5, 10));
  }

  function pickupC4Synth(level = 1) {
    noise(.032, .026 * level, 900, 'sfx', 'bandpass', 0, 1.2);
    physicalTone(172, .06, 'triangle', .033 * level, 120, 'sfx', .006, 620, 'lowpass', .014 * level, .8);
    physicalTone(740, .03, 'square', .022 * level, 520, 'sfx', .07, 1700, 'bandpass', .011 * level, 1.6);
    physicalTone(980, .025, 'square', .017 * level, 1320, 'sfx', .125, 2100, 'bandpass', .009 * level, 1.8);
  }

  function perkEquipSynth(level = 1) {
    pickupSparkle(level, 560, 'ui');
    chorusTone(880, .07, 'triangle', .035 * level, 1180, 'ui', .082, rand(5, 10));
    chorusTone(1320, .09, 'sine', .026 * level, 1680, 'ui', .158, rand(5, 10));
  }

  function commandVoiceSetting(name, fallback) {
    return Object.prototype.hasOwnProperty.call(commandVoiceConfig, name) ? commandVoiceConfig[name] : fallback;
  }

  function commandRadioClick(level = 1, delay = 0) {
    const pitch = rand(.94, 1.08);
    noise(.012, .04 * level, 3600 * pitch, 'ui', 'highpass', delay, 2.2);
    physicalTone(1120 * pitch, .018, 'square', .028 * level, 650 * pitch, 'ui', delay + .002, 2400 * pitch, 'bandpass', .008 * level, 1.8);
    physicalTone(260 * pitch, .026, 'triangle', .014 * level, 170 * pitch, 'ui', delay + .014, 850 * pitch, 'bandpass', .005 * level, 1.1);
  }

  function selectCommandVoice(voices) {
    const englishVoices = voices.filter(voice => /^en[-_]/i.test(voice.lang || ''));
    const candidates = englishVoices.length ? englishVoices : voices;
    const preferred = String(commandVoiceSetting('preferredVoice', '') || '').trim().toLowerCase();
    if (preferred) {
      const match = candidates.find(voice => String(voice.name || '').toLowerCase().includes(preferred));
      if (match) return match;
    }
    return candidates
      .map(voice => {
        const name = String(voice.name || '').toLowerCase();
        let score = 0;
        if (/male|david|mark|george|daniel|alex|guy|fred|bruce|ralph/.test(name)) score += 8;
        if (/female|zira|susan|samantha|victoria|karen|moira|tessa/.test(name)) score -= 8;
        if (/google|microsoft|enhanced|premium|natural/.test(name)) score += 2;
        return { voice, score };
      })
      .sort((a, b) => b.score - a.score)[0]?.voice || candidates[0];
  }

  function speakCommandLine(text, level = 1, rate = 1, pitch = 1) {
    if (commandVoiceSetting('enabled', true) === false) return false;
    const synth = window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return false;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      let staticBed = null;
      const staticLevel = clamp(commandVoiceSetting('staticLevel', .032), 0, .12, .032) * Math.max(0, Math.min(1, level));
      const staticCenter = clamp(commandVoiceSetting('staticFrequency', 1450), 550, 2600, 1450);
      const stopStatic = () => {
        if (staticBed) {
          staticBed.stop(.1);
          staticBed = null;
        }
      };
      const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
      const preferredVoice = selectCommandVoice(voices);
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.lang = preferredVoice?.lang || 'en-US';
      utterance.rate = clamp(commandVoiceSetting('rate', rate), .5, 1.5, rate);
      utterance.pitch = clamp(commandVoiceSetting('pitch', pitch), 0, 2, pitch);
      utterance.volume = clamp(commandVoiceSetting('volume', .9), 0, 1, .9) * Math.max(0, Math.min(1, level));

      utterance.onstart = () => {
        radioStatic(.08, .11 * level, 960, 'ui', .012);
        staticBed = createRadioStaticBed(staticLevel, staticCenter);
      };
      utterance.onend = () => {
        stopStatic();
        commandRadioClick(level);
        radioStatic(.14, .065 * level, 760, 'ui', .018);
      };
      utterance.onerror = () => {
        stopStatic();
        commandRadioClick(level);
        radioStatic(.11, .06 * level, 680, 'ui', .018);
      };

      // Tiny pre-key click gives immediate feedback even if speech starts a few frames later.
      commandRadioClick(.55 * level);
      synth.speak(utterance);
      return true;
    } catch (_) {
      return false;
    }
  }

  function commandFallback(level = 1, chirps = 2) {
    radioStatic(.06, .055 * level, 1550, 'ui');
    for (let i = 0; i < chirps; i++) {
      physicalTone(720 + i * 220, .045, 'square', .026 * level, 480 + i * 150, 'ui', .08 + i * .085, 2100 + i * 260, 'bandpass', .01 * level, 1.6);
    }
    radioStatic(.08, .032 * level, 2150, 'ui', .18 + chirps * .08);
  }

  function voiceDropSynth(level = 1) {
    if (speakCommandLine('Follow your objective, over.', level, 1, 1)) return;
    commandFallback(level, 2);
  }

  function voiceTripleSynth(level = 1) {
    if (speakCommandLine('Incoming care package.', level, 1, 1)) return;
    commandFallback(level, 3);
  }

  function voiceFewMoreSynth(level = 1) {
    if (speakCommandLine('Just a few more.', level, 1, 1)) return;
    commandFallback(level, 2);
  }

  function voiceLowHealthSynth(level = 1) {
    if (speakCommandLine('Retreat and treat your wounds.', level, 1, 1)) return;
    commandFallback(level, 2);
  }

  function voiceLongRangeSynth(level = 1) {
    if (speakCommandLine('Nice shot.', level, 1, 1)) return;
    commandFallback(level, 2);
  }

  function zombieMoanProfile(variant = 'normal', playbackRate = 1) {
    const rate = Math.max(0.55, Math.min(1.45, Math.abs(Number(playbackRate) || 1)));
    if (variant === 'speedy') {
      return { dur: 1.02 / rate, f0: 138 * rate, f1: 74 * rate, f2: 172 * rate, wave: 'sawtooth', voice: .04, breath: .08, breathFreq: 1280, breathEnd: 860, q: 5.7, delay: .014, wobble: 17.5, wobbleDepth: .015, formantA: 660, formantAEnd: 1240, formantB: 1760, formantBEnd: 1120, formantQ: 4.4, throat: .32 };
    }
    if (variant === 'brute') {
      return { dur: 2.48 / rate, f0: 46 * rate, f1: 22 * rate, f2: 68 * rate, wave: 'sawtooth', voice: .07, breath: .076, breathFreq: 330, breathEnd: 210, q: 2.05, delay: .04, wobble: 5.2, wobbleDepth: .021, hollow: true, formantA: 280, formantAEnd: 480, formantB: 840, formantBEnd: 520, formantQ: 2.6, throat: 1.08 };
    }
    if (variant === 'grey') {
      return { dur: 1.98 / rate, f0: 76 * rate, f1: 28 * rate, f2: 104 * rate, wave: 'triangle', voice: .048, breath: .094, breathFreq: 700, breathEnd: 430, q: 6.3, delay: .028, hollow: true, formantA: 470, formantAEnd: 330, formantB: 1220, formantBEnd: 780, formantQ: 5.2, throat: .68 };
    }
    return { dur: 1.72 / rate, f0: 86 * rate, f1: 38 * rate, f2: 122 * rate, wave: 'sawtooth', voice: .054, breath: .072, breathFreq: 540, breathEnd: 330, q: 3.35, delay: .03, wobble: 7.8, wobbleDepth: .017, formantA: 430, formantAEnd: 760, formantB: 1280, formantBEnd: 840, formantQ: 3.6, throat: .58 };
  }

  function zombieMoanSynth(level = 1, playbackRate = 1, options = {}) {
    const ctx = getAudio();
    if (!ctx || zombieMoanSources.length >= ZOMBIE_MOAN_MAX_OVERLAP) return;
    const variant = String(options.variant || 'normal');
    const profile = zombieMoanProfile(variant, playbackRate);
    const now = ctx.currentTime;
    const distanceScale = optionVolumeScale(options);
    const aggression = clamp(options.aggression, .75, 1.35, distanceScale > .85 ? 1.12 : .92);
    const pan = clamp(options.pan, -.55, .55, rand(-.22, .22));
    const pitchDrift = rand(.94, 1.07);
    const nodes = [];
    const sources = [];
    let cleaned = false;

    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(Math.max(0.0002, level * distanceScale), now + .05);
    out.gain.exponentialRampToValueAtTime(0.001, now + profile.dur);
    const panNode = connectOutput(out, 'enemy', pan);
    nodes.push(out);
    if (panNode) nodes.push(panNode);

    const voiceGain = ctx.createGain();
    const baseVoice = profile.voice * aggression;
    const secondPhraseAt = now + profile.dur * rand(.55, .65);
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.linearRampToValueAtTime(baseVoice, now + .055);
    voiceGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, baseVoice * .46), secondPhraseAt - .07);
    voiceGain.gain.linearRampToValueAtTime(baseVoice * rand(1.18, 1.36), secondPhraseAt + .075);
    voiceGain.gain.exponentialRampToValueAtTime(0.001, now + profile.dur);
    voiceGain.connect(out);
    nodes.push(voiceGain);

    const tremolo = ctx.createOscillator();
    const tremoloGain = ctx.createGain();
    tremolo.type = 'sine';
    tremolo.frequency.setValueAtTime((profile.wobble || 7) * rand(.86, 1.18), now);
    tremoloGain.gain.setValueAtTime(profile.wobbleDepth || .012, now);
    tremolo.connect(tremoloGain);
    tremoloGain.connect(voiceGain.gain);
    tremolo.start(now);
    tremolo.stop(now + profile.dur + .03);
    sources.push(tremolo);
    nodes.push(tremoloGain);

    const primary = ctx.createOscillator();
    primary.type = profile.wave;
    primary.frequency.setValueAtTime(profile.f0 * pitchDrift, now);
    primary.frequency.linearRampToValueAtTime(profile.f2 * rand(.92, 1.14), now + profile.dur * .24);
    primary.frequency.exponentialRampToValueAtTime(Math.max(24, profile.f1 * rand(.88, 1.04)), secondPhraseAt - .035);
    primary.frequency.linearRampToValueAtTime(profile.f2 * rand(.78, 1.24), secondPhraseAt + .06);
    primary.frequency.exponentialRampToValueAtTime(Math.max(22, profile.f1 * rand(.82, 1.02)), now + profile.dur);
    primary.connect(voiceGain);
    primary.start(now);
    primary.stop(now + profile.dur + .03);
    sources.push(primary);

    function addFormant(source, freq, endFreq, gainValue, q = 3.0) {
      const formant = ctx.createBiquadFilter();
      const formantGain = ctx.createGain();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(freq * rand(.84, 1.16), now);
      // Slow formant drift gives a mouth/throat quality without expensive processing.
      formant.frequency.linearRampToValueAtTime(endFreq * rand(.78, 1.24), now + profile.dur * rand(.7, .92));
      formant.Q.setValueAtTime(q * rand(.82, 1.24), now);
      formantGain.gain.setValueAtTime(gainValue, now);
      source.connect(formant);
      formant.connect(formantGain);
      formantGain.connect(out);
      nodes.push(formant, formantGain);
    }

    addFormant(primary, profile.formantA, profile.formantAEnd, profile.voice * .42 * aggression, profile.formantQ);
    addFormant(primary, profile.formantB, profile.formantBEnd, profile.voice * .24 * aggression, (profile.formantQ || 3) + .8);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(profile.f0 * .48 * pitchDrift, now);
    sub.frequency.exponentialRampToValueAtTime(Math.max(20, profile.f1 * .5), now + profile.dur);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(profile.voice * profile.throat * aggression, now);
    sub.connect(subGain);
    subGain.connect(out);
    sub.start(now + profile.delay);
    sub.stop(now + profile.dur + .03);
    sources.push(sub);
    nodes.push(subGain);

    if (profile.hollow) {
      const hollow = ctx.createOscillator();
      hollow.type = 'square';
      hollow.frequency.setValueAtTime(profile.f0 * 1.74 * pitchDrift, now);
      hollow.frequency.exponentialRampToValueAtTime(Math.max(35, profile.f1 * 1.2), now + profile.dur);
      const hollowGain = ctx.createGain();
      hollowGain.gain.setValueAtTime(profile.voice * .14 * aggression, now);
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
    breathFilter.frequency.linearRampToValueAtTime(profile.breathEnd || profile.breathFreq * .68, now + profile.dur * .9);
    breathFilter.Q.setValueAtTime(profile.q, now);
    breathGain.gain.setValueAtTime(profile.breath * aggression, now);
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
    const chirps = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < chirps; i++) {
      const delay = i * rand(.1, .32);
      const base = rand(2800, 4800);
      tone(base, .065, 'sine', .034 * level, base * rand(1.14, 1.48), 'ambient', delay);
      tone(base * rand(.48, .62), .035, 'triangle', .016 * level, base * rand(.7, .9), 'ambient', delay + .035);
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
    noise(rand(.38, .82), (cold ? .018 : .012) * level, cold ? rand(980, 1700) : rand(520, 980), 'ambient', cold ? 'bandpass' : 'lowpass', 0, cold ? 2.0 : .62);
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

  function createNoiseBuffer(ctx, seconds = 2) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = last * .72 + (Math.random() * 2 - 1) * .28;
      data[i] = last;
    }
    return buffer;
  }

  function stopAmbientBed(fadeSeconds = .45) {
    if (!ambientBed) return;
    const bed = ambientBed;
    ambientBed = null;
    const ctx = bed.context || getAudio();
    const now = ctx ? ctx.currentTime : 0;
    const fade = Math.max(.04, fadeSeconds);
    if (ctx && bed.out) {
      bed.out.gain.cancelScheduledValues(now);
      bed.out.gain.setValueAtTime(Math.max(0.0001, bed.out.gain.value || 0.0001), now);
      bed.out.gain.exponentialRampToValueAtTime(0.0001, now + fade);
    }
    setTimeout(() => {
      for (const source of bed.sources) {
        try { source.stop(); } catch (_) {}
        try { source.disconnect(); } catch (_) {}
      }
      for (const node of bed.nodes) {
        try { node.disconnect(); } catch (_) {}
      }
    }, Math.ceil((fade + .05) * 1000));
  }

  function startAmbientBed(name) {
    const ctx = getAudio();
    if (!ctx || !ambientEnabled || !name) return;
    if (ambientBed?.name === name) return;
    stopAmbientBed(.65);

    const now = ctx.currentTime;
    const nodes = [];
    const sources = [];
    const bedOut = ctx.createGain();
    bedOut.gain.setValueAtTime(0.0001, now);
    bedOut.gain.exponentialRampToValueAtTime(1, now + .72);
    connectOutput(bedOut, 'ambient');
    nodes.push(bedOut);

    function addNoiseLayer({ gainValue, filterType = 'lowpass', freq = 700, q = .8, lfoRate = .04, lfoDepth = .018, freqDepth = 0 }) {
      const src = ctx.createBufferSource();
      const filt = ctx.createBiquadFilter();
      const layerGain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const freqLfo = ctx.createOscillator();
      const freqLfoGain = ctx.createGain();

      src.buffer = createNoiseBuffer(ctx, 2.4);
      src.loop = true;
      filt.type = filterType;
      filt.frequency.setValueAtTime(freq, now);
      filt.Q.setValueAtTime(q, now);
      layerGain.gain.setValueAtTime(0.0001, now);
      layerGain.gain.linearRampToValueAtTime(Math.max(0.0001, gainValue), now + 0.12);
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(lfoRate, now);
      lfoGain.gain.setValueAtTime(lfoDepth, now);
      lfo.connect(lfoGain);
      lfoGain.connect(layerGain.gain);
      freqLfo.type = 'sine';
      freqLfo.frequency.setValueAtTime(Math.max(.01, lfoRate * rand(.45, .75)), now);
      freqLfoGain.gain.setValueAtTime(freqDepth, now);
      freqLfo.connect(freqLfoGain);
      freqLfoGain.connect(filt.frequency);
      src.connect(filt);
      filt.connect(layerGain);
      layerGain.connect(bedOut);
      src.start(now);
      lfo.start(now);
      freqLfo.start(now);
      sources.push(src, lfo, freqLfo);
      nodes.push(filt, layerGain, lfoGain, freqLfoGain);
    }

    function addToneLayer({ freq = 54, gainValue = .02, type = 'sine', lfoRate = .035, lfoDepth = .006 }) {
      const osc = ctx.createOscillator();
      const layerGain = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      layerGain.gain.setValueAtTime(0.0001, now);
      layerGain.gain.linearRampToValueAtTime(Math.max(0.0001, gainValue), now + 0.12);
      lfo.frequency.setValueAtTime(lfoRate, now);
      lfoGain.gain.setValueAtTime(lfoDepth, now);
      lfo.connect(lfoGain);
      lfoGain.connect(layerGain.gain);
      osc.connect(layerGain);
      layerGain.connect(bedOut);
      osc.start(now);
      lfo.start(now);
      sources.push(osc, lfo);
      nodes.push(layerGain, lfoGain);
    }

    if (name === 'ambientMenu') {
      addNoiseLayer({ gainValue: .034, filterType: 'lowpass', freq: 620, q: .5, lfoRate: .06, lfoDepth: .016, freqDepth: 320 });
      addNoiseLayer({ gainValue: .01, filterType: 'bandpass', freq: 1850, q: 1.2, lfoRate: .09, lfoDepth: .006, freqDepth: 520 });
      addToneLayer({ freq: 43, gainValue: .01, lfoRate: .026, lfoDepth: .005 });
    } else if (name === 'ambientForest') {
      addNoiseLayer({ gainValue: .019, filterType: 'lowpass', freq: 780, q: .58, lfoRate: .08, lfoDepth: .011, freqDepth: 300 });
      addNoiseLayer({ gainValue: .004, filterType: 'bandpass', freq: 3100, q: 3.5, lfoRate: .13, lfoDepth: .0025, freqDepth: 450 });
    } else if (name === 'ambientSwamp') {
      addNoiseLayer({ gainValue: .021, filterType: 'lowpass', freq: 520, q: .75, lfoRate: .055, lfoDepth: .01, freqDepth: 200 });
      addNoiseLayer({ gainValue: .01, filterType: 'bandpass', freq: 2500, q: 4.5, lfoRate: .13, lfoDepth: .005, freqDepth: 420 });
      addToneLayer({ freq: 58, gainValue: .005, lfoRate: .04, lfoDepth: .003 });
    } else if (name === 'ambientDunes') {
      addNoiseLayer({ gainValue: .026, filterType: 'bandpass', freq: 1040, q: 1.05, lfoRate: .07, lfoDepth: .015, freqDepth: 520 });
    } else if (name === 'ambientRocky') {
      addNoiseLayer({ gainValue: .023, filterType: 'bandpass', freq: 1120, q: .9, lfoRate: .065, lfoDepth: .012, freqDepth: 400 });
      addToneLayer({ freq: 48, gainValue: .0045, lfoRate: .023, lfoDepth: .0025 });
    } else if (name === 'ambientAshlands') {
      addNoiseLayer({ gainValue: .03, filterType: 'lowpass', freq: 600, q: .58, lfoRate: .052, lfoDepth: .016, freqDepth: 240 });
      addNoiseLayer({ gainValue: .007, filterType: 'bandpass', freq: 1480, q: 2.0, lfoRate: .08, lfoDepth: .004, freqDepth: 520 });
      addToneLayer({ freq: 52, gainValue: .009, lfoRate: .021, lfoDepth: .004 });
    } else if (name === 'ambientTundra') {
      addNoiseLayer({ gainValue: .026, filterType: 'bandpass', freq: 1420, q: 1.8, lfoRate: .067, lfoDepth: .014, freqDepth: 580 });
      addNoiseLayer({ gainValue: .005, filterType: 'highpass', freq: 2600, q: 1.0, lfoRate: .11, lfoDepth: .0025, freqDepth: 620 });
    } else {
      addNoiseLayer({ gainValue: .02, filterType: 'lowpass', freq: 760, q: .65, freqDepth: 240 });
    }

    ambientBed = { name, context: ctx, out: bedOut, sources, nodes };
  }

  function synthAmbientSweetener(cue) {
    if (cue === 'ambientForest') {
      if (Math.random() < .86) ambientBirds(1.15);
      else ambientWind(.55);
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
      ambientWind(.5);
      if (roll < .18) ambientDistantExplosion(.72);
      else if (roll < .42) ambientDistantGunfire(.68);
      else if (roll < .66) ambientDistantZombie(.48);
      else ambientRumble(.42);
    }
  }

  function synth(name, gainValue = 1, playbackRate = 1, options = {}) {
    if (name === 'shoot') {
      shotgunShot(gainValue);
    } else if (name === 'empty') {
      dryFire(gainValue);
    } else if (name === 'reloadStart') {
      reloadStartSynth(gainValue);
    } else if (name === 'reloadStep') {
      reloadStepSynth(gainValue);
    } else if (name === 'reloadDone') {
      reloadDoneSynth(gainValue);
    } else if (name === 'block') {
      noise(.055, .075 * gainValue, 520, 'foley');
      physicalTone(165, .045, 'square', .035 * gainValue, 110, 'foley', 0, 680, 'lowpass', .022 * gainValue, .8);
    } else if (name === 'hit') {
      noise(.018, .038 * gainValue, 2200, 'sfx', 'bandpass', 0, 1.2);
      noise(.052, .032 * gainValue, 430, 'sfx', 'lowpass', .003, .55);
      physicalTone(510, .045, 'triangle', .052 * gainValue, 290, 'sfx', 0, 2100, 'bandpass', .018 * gainValue, 1.5);
      physicalTone(920, .028, 'square', .018 * gainValue, 620, 'sfx', .035, 2900, 'bandpass', .01 * gainValue, 1.8);
    } else if (name === 'head') {
      // Headshots should read as a sharper skull crack plus a short wet body, not just a louder hit.
      noise(.014, .082 * gainValue, 5200, 'sfx', 'highpass', 0, 1.1);
      noise(.032, .064 * gainValue, 2400, 'sfx', 'bandpass', .004, 1.8);
      noise(.085, .052 * gainValue, 360, 'sfx', 'lowpass', .012, .5);
      physicalTone(1180, .038, 'square', .066 * gainValue, 1640, 'sfx', 0, 3400, 'bandpass', .018 * gainValue, 2.0);
      setTimeout(() => physicalTone(470, .07, 'triangle', .045 * gainValue, 690, 'sfx', 0, 960, 'bandpass', .014 * gainValue, 1.0), 42);
      setTimeout(() => chorusTone(840, .055, 'sine', .024 * gainValue, 1180, 'sfx', 0, rand(5, 9)), 82);
    } else if (name === 'kill') {
      noise(.07, .05 * gainValue, 680, 'sfx', 'lowpass', 0, .55);
      physicalTone(260, .075, 'square', .055 * gainValue, 390, 'sfx', 0, 920, 'bandpass', .016 * gainValue, 1.1);
      setTimeout(() => {
        physicalTone(520, .08, 'triangle', .05 * gainValue, 780, 'sfx', 0, 1500, 'bandpass', .014 * gainValue, 1.35);
        noise(.05, .02 * gainValue, 1400, 'sfx', 'bandpass', 0, 1.6);
      }, 80);
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
      noise(.08, .045 * gainValue, 360);
      physicalTone(115, .11, 'sawtooth', .045 * gainValue, 62, 'sfx', 0, 520, 'lowpass', .02 * gainValue, .8);
    } else if (name === 'land') {
      synthFootstep({ ...options, gait: 'land' }, gainValue);
    } else if (name === 'footstep') {
      synthFootstep(options, gainValue);
    } else if (name === 'objectiveClear') {
      noise(.05, .02 * gainValue, 3200, 'ui', 'highpass', 0, 1.2);
      chorusTone(220, .08, 'triangle', .05 * gainValue, 330, 'ui', 0, rand(5, 10));
      setTimeout(() => chorusTone(440, .09, 'triangle', .05 * gainValue, 660, 'ui', 0, rand(5, 10)), 85);
      setTimeout(() => {
        chorusTone(720, .11, 'sine', .045 * gainValue, 960, 'ui', 0, rand(5, 10));
        noise(.06, .016 * gainValue, 3600, 'ui', 'bandpass', 0, 2.2);
      }, 175);
    } else if (name === 'wave') {
      noise(.06, .03 * gainValue, 700, 'ui', 'lowpass', 0, .6);
      physicalTone(180, .08, 'sawtooth', .05 * gainValue, 120, 'ui', 0, 680, 'lowpass', .014 * gainValue, .7);
      setTimeout(() => physicalTone(330, .09, 'triangle', .045 * gainValue, 480, 'ui', 0, 1350, 'bandpass', .012 * gainValue, 1.1), 85);
    } else if (name === 'heartbeat') {
      const health = Number(options.health);
      const intensity = clamp(
        options.intensity,
        0,
        1,
        Number.isFinite(health) ? 1 - clamp(health, 0, 100, 100) / 100 : 0
      );
      const pulseLevel = gainValue * (1 + intensity * .35);
      noise(.05, .012 * pulseLevel, 210 + intensity * 80, 'ui', 'lowpass', .02, .6);
      physicalTone(56 + intensity * 8, .12, 'sine', .052 * pulseLevel, 42, 'ui', 0, 180, 'lowpass', .012 * pulseLevel, .5);
      physicalTone(68 + intensity * 10, .095, 'sine', .038 * pulseLevel, 46, 'ui', .18, 190, 'lowpass', .01 * pulseLevel, .5);
    } else if (name === 'confirm') {
      noise(.014, .02 * gainValue, 2800, 'ui', 'highpass', 0, 1.8);
      physicalTone(1150, .018, 'square', .018 * gainValue, 640, 'ui', 0, 2600, 'bandpass', .007 * gainValue, 1.6);
      setTimeout(() => physicalTone(420, .018, 'triangle', .012 * gainValue, 260, 'ui', 0, 1300, 'bandpass', .005 * gainValue, 1.1), 18);
    } else if (name === 'briefing') {
      radioStatic(.045, .07, 1200);
      physicalTone(1180, .025, 'square', .018 * gainValue, 680, 'ui', 0, 2200, 'bandpass', .008 * gainValue, 1.4);
      setTimeout(() => radioStatic(.13, .045, 2100), 34);
      setTimeout(() => physicalTone(330, .035, 'square', .018 * gainValue, 190, 'ui', 0, 1000, 'bandpass', .007 * gainValue, 1.2), 128);
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
    } else if (name === 'voiceFewMore') {
      voiceFewMoreSynth(gainValue);
    } else if (name === 'voiceLowHealth') {
      voiceLowHealthSynth(gainValue);
    } else if (name === 'voiceLongRange') {
      voiceLongRangeSynth(gainValue);
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
    if (name === 'ambientForest') return rand(2.0, 4.2);
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
    stopAmbientBed();
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
    startAmbientBed(name);
    startProceduralAmbience(name);
  }

  function resumeAudioFromGesture() {
    const ctx = getAudio();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (ambientEnabled && ambientTargetName) startAmbientBed(ambientTargetName);
  }

  window.addEventListener('pointerdown', resumeAudioFromGesture, { passive: true });
  window.addEventListener('keydown', resumeAudioFromGesture);

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
      const fileCueNames = Object.keys(DEFAULT_FILE_CUES).filter(name => configuredFileName(name));
      const total = Math.max(1, fileCueNames.length + 1);
      let loaded = 0;

      function report(fileName, ok = true) {
        loaded++;
        if (typeof onProgress === 'function') {
          onProgress({ loaded, total, fileName, ok, progress: loaded / total });
        }
      }

      const loads = fileCueNames.map(name => loadFileCue(name).then(result => {
        report(result.fileName || name, result.ok);
        return result;
      }));

      report('procedural-synth', true);
      return Promise.all(loads).then(results => ['procedural-synth', ...results.filter(item => item.ok).map(item => item.fileName)]);
    },

    play(name, gainValue = 1, playbackRate = 1, options = {}) {
      if (!sfxEnabled) return;

      if (name === 'land' && activeOneShots > 0) return;

      if (name !== 'footstep') trackSynthOneShot(name);
      if (name === 'shoot' || name === 'zombieMoan') {
        const handle = playFileCue(name, gainValue, playbackRate, options);
        if (handle) return handle;
      }
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
