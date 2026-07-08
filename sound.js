(() => {
  'use strict';

  const config = window.ZOMVOX_CONFIG || {};
  const soundFiles = (config.audio && config.audio.files) || {};
  const SILENCE_TRIM_THRESHOLD = 0.003;
  const SILENCE_TRIM_MAX_SECONDS = 0.65;
  const SILENCE_TRIM_PREROLL_SECONDS = 0.006;

  let sfxEnabled = true;
  let ambientEnabled = true;
  let audioCtx = null;
  let ambientSource = null;
  let ambientGain = null;
  let ambientTargetName = '';
  let activeAmbientName = '';
  let activeOneShots = 0;
  let landSource = null;

  // decoded AudioBuffers, not HTMLAudioElement objects
  const bufferCache = new Map();
  const loadingCache = new Map();
  const leadInCache = new WeakMap();

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

  function tone(freq, dur = .08, type = 'square', gain = .05, endFreq = null) {
    const ctx = getAudio();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    }

    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(g);
    g.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + dur + .02);
  }

  function noise(dur = .05, gain = .08, cutoff = 1200) {
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
    const now = ctx.currentTime;

    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(cutoff, now);

    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.buffer = buffer;
    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);

    src.start(now);
    src.stop(now + dur + .02);
  }

  function radioStatic(dur = .08, gainValue = .04, center = 1600) {
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
    gain.connect(ctx.destination);

    src.start(now);
    src.stop(now + dur + .02);
  }

  function synth(name) {
    if (name === 'shoot') {
      noise(.045, .12, 950);
      tone(105, .05, 'sawtooth', .045, 55);
    } else if (name === 'empty') {
      tone(120, .07, 'square', .04, 85);
    } else if (name === 'reloadStart') {
      tone(180, .05, 'square', .04, 105);
      setTimeout(() => tone(260, .04, 'square', .035, 180), 110);
    } else if (name === 'reloadDone') {
      tone(360, .06, 'triangle', .045, 520);
    } else if (name === 'block') {
      noise(.055, .075, 520);
      tone(165, .045, 'square', .035, 110);
    } else if (name === 'hit') {
      tone(470, .055, 'triangle', .055, 260);
    } else if (name === 'head') {
      noise(.025, .06, 1900);
      tone(980, .045, 'square', .065, 1450);
      setTimeout(() => tone(520, .055, 'triangle', .045, 780), 45);
    } else if (name === 'kill') {
      tone(260, .075, 'square', .055, 390);
      setTimeout(() => tone(520, .08, 'triangle', .05, 780), 80);
    } else if (name === 'pickup' || name === 'pickupAmmo') {
      tone(520, .06, 'triangle', .045, 780);
    } else if (name === 'pickupHealth') {
      tone(660, .07, 'sine', .04, 880);
      setTimeout(() => tone(990, .08, 'triangle', .035, 1320), 70);
    } else if (name === 'bite') {
      noise(.08, .08, 430);
      tone(72, .09, 'sawtooth', .045, 38);
    } else if (name === 'hurt') {
      tone(85, .12, 'sawtooth', .07, 45);
    } else if (name === 'toxin') {
      tone(115, .11, 'sawtooth', .045, 62);
      noise(.08, .045, 360);
    } else if (name === 'land') {
      noise(.055, .025, 260);
      tone(90, .045, 'sine', .018, 55);
    } else if (name === 'objectiveClear') {
      tone(220, .08, 'triangle', .05, 330);
      setTimeout(() => tone(440, .09, 'triangle', .05, 660), 85);
      setTimeout(() => tone(720, .11, 'sine', .045, 960), 175);
    } else if (name === 'wave') {
      tone(180, .08, 'sawtooth', .05, 120);
      setTimeout(() => tone(330, .09, 'triangle', .045, 480), 85);
    } else if (name === 'heartbeat') {
      tone(55, .11, 'sine', .045, 45);
    } else if (name === 'confirm') {
      tone(640, .045, 'triangle', .04, 820);
    } else if (name === 'briefing') {
      radioStatic(.045, .07, 1200);
      tone(1180, .025, 'square', .018, 680);
      setTimeout(() => radioStatic(.13, .045, 2100), 34);
      setTimeout(() => tone(330, .035, 'square', .018, 190), 128);
      setTimeout(() => radioStatic(.055, .026, 850), 168);
    } else if (name === 'perkEquip') {
      tone(480, .055, 'triangle', .045, 720);
      setTimeout(() => tone(960, .08, 'sine', .04, 1280), 65);
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
    }, name === 'land' ? 120 : 260);
  }

  function playBuffer(buffer, gainValue = 1, trimLeadingSilence = true, name = '') {
    const ctx = getAudio();
    if (!ctx || !buffer) return false;

    if (name === 'land' && activeOneShots > 0) return true;
    if (name !== 'land') stopLand();

    const src = ctx.createBufferSource();
    const gain = ctx.createGain();

    src.buffer = buffer;
    gain.gain.value = gainValue;

    src.connect(gain);
    gain.connect(ctx.destination);

    activeOneShots++;
    src.onended = () => {
      activeOneShots = Math.max(0, activeOneShots - 1);
      if (landSource === src) landSource = null;
    };
    if (name === 'land') landSource = src;

    src.start(ctx.currentTime, trimLeadingSilence ? leadInOffset(buffer) : 0);
    return true;
  }

  function playFile(name, fileName) {
    if (fileName === '') return true;
    if (!fileName) return false;

    const key = soundKey(fileName);
    const buffer = bufferCache.get(key);

    if (buffer) {
      playBuffer(buffer, name === 'land' ? .28 : 1, true, name);
      return true;
    }

    // Start loading, but don't block gameplay.
    loadFile(fileName);

    // Until decoded, fall back to synth so button presses still feel responsive.
    return false;
  }

  function stopAmbient() {
    if (ambientSource) {
      try { ambientSource.stop(); } catch (_) {}
      ambientSource.onended = null;
      ambientSource.disconnect();
    }
    if (ambientGain) ambientGain.disconnect();
    ambientSource = null;
    ambientGain = null;
    activeAmbientName = '';
  }

  function startAmbientBuffer(name, buffer) {
    const ctx = getAudio();
    if (!ctx || !buffer || !ambientEnabled || ambientTargetName !== name) return;

    stopAmbient();

    const src = ctx.createBufferSource();
    const gain = ctx.createGain();

    src.buffer = buffer;
    src.loop = true;
    gain.gain.value = .32;

    src.connect(gain);
    gain.connect(ctx.destination);

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
    src.start(ctx.currentTime);
  }

  function requestAmbient(name) {
    if (!ambientEnabled || !name) {
      ambientTargetName = '';
      stopAmbient();
      return;
    }

    if (activeAmbientName === name && ambientSource) return;

    ambientTargetName = name;

    const hasOverride = Object.prototype.hasOwnProperty.call(soundFiles, name);
    const fileName = hasOverride ? soundFiles[name] : '';

    if (!fileName) {
      stopAmbient();
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

    play(name) {
      if (!sfxEnabled) return;

      const hasOverride = Object.prototype.hasOwnProperty.call(soundFiles, name);
      const fileName = hasOverride
        ? soundFiles[name]
        : ((name === 'pickupAmmo' || name === 'pickupHealth') ? soundFiles.pickup : null);

      if (fileName === '') return;

      if (name === 'land' && activeOneShots > 0) return;
      if (name !== 'land') stopLand();

      if (playFile(name, fileName)) return;

      trackSynthOneShot(name);
      synth(name);
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
