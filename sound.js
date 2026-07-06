(() => {
  'use strict';

  const config = window.ZOMVOX_CONFIG || {};
  const soundFiles = (config.audio && config.audio.files) || {};
  let enabled = true;
  let audioCtx = null;
  const fileCache = new Map();

  function getAudio() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
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
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
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
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
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

  function synth(name) {
    if (name === 'shoot') { noise(.045, .12, 950); tone(105, .05, 'sawtooth', .045, 55); }
    else if (name === 'empty') { tone(120, .07, 'square', .04, 85); }
    else if (name === 'reloadStart') { tone(180, .05, 'square', .04, 105); setTimeout(() => tone(260, .04, 'square', .035, 180), 110); }
    else if (name === 'reloadDone') { tone(360, .06, 'triangle', .045, 520); }
    else if (name === 'block') { noise(.055, .075, 520); tone(165, .045, 'square', .035, 110); }
    else if (name === 'hit') { tone(470, .055, 'triangle', .055, 260); }
    else if (name === 'head') { noise(.025, .06, 1900); tone(980, .045, 'square', .065, 1450); setTimeout(() => tone(520, .055, 'triangle', .045, 780), 45); }
    else if (name === 'kill') { tone(260, .075, 'square', .055, 390); setTimeout(() => tone(520, .08, 'triangle', .05, 780), 80); }
    else if (name === 'pickup') { tone(520, .06, 'triangle', .045, 780); }
    else if (name === 'pickupAmmo') { tone(520, .06, 'triangle', .045, 780); }
    else if (name === 'pickupHealth') { tone(660, .07, 'sine', .04, 880); setTimeout(() => tone(990, .08, 'triangle', .035, 1320), 70); }
    else if (name === 'bite') { noise(.08, .08, 430); tone(72, .09, 'sawtooth', .045, 38); }
    else if (name === 'hurt') { tone(85, .12, 'sawtooth', .07, 45); }
    else if (name === 'toxin') { tone(115, .11, 'sawtooth', .045, 62); noise(.08, .045, 360); }
    else if (name === 'land') { noise(.07, .09, 300); tone(95, .06, 'sine', .045, 55); }
    else if (name === 'objectiveClear') { tone(220, .08, 'triangle', .05, 330); setTimeout(() => tone(440, .09, 'triangle', .05, 660), 85); setTimeout(() => tone(720, .11, 'sine', .045, 960), 175); }
    else if (name === 'wave') { tone(180, .08, 'sawtooth', .05, 120); setTimeout(() => tone(330, .09, 'triangle', .045, 480), 85); }
    else if (name === 'heartbeat') { tone(55, .11, 'sine', .045, 45); }
  }

  function playFile(name, fileName) {
    if (fileName === '') return true;
    if (!fileName) return false;
    const src = 'assets/' + fileName;
    let audio = fileCache.get(name);
    if (!audio || audio.getAttribute('src') !== src) {
      audio = new Audio(src);
      audio.preload = 'auto';
      fileCache.set(name, audio);
    }
    const instance = audio.paused ? audio : audio.cloneNode(true);
    instance.currentTime = 0;
    instance.play().catch(() => {});
    return true;
  }

  window.ZomVoxSound = {
    setEnabled(value) {
      enabled = !!value;
    },
    prime() {
      getAudio();
      Object.entries(soundFiles).forEach(([name, fileName]) => {
        if (!fileName) return;
        const audio = new Audio('assets/' + fileName);
        audio.preload = 'auto';
        fileCache.set(name, audio);
      });
    },
    play(name) {
      if (!enabled) return;
      const hasOverride = Object.prototype.hasOwnProperty.call(soundFiles, name);
      const fileName = hasOverride
        ? soundFiles[name]
        : ((name === 'pickupAmmo' || name === 'pickupHealth') ? soundFiles.pickup : null);
      if (fileName === '') return;
      if (playFile(name, fileName)) return;
      synth(name);
    }
  };
})();
