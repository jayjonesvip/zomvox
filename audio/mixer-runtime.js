'use strict';

/*
 * ZomVox audio: mixer and runtime bridge
 *
 * Master limiter, bus compressor/ducking, file-cue fallback, routing, radio command wrappers, and lightweight procedural ambience helpers.
 * Loaded by ../sound.js before script.js; keep this as a classic script
 * so the static GitHub Pages build does not need bundling or modules.
 */

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

  const RADIO_COMMAND_TEXT = {
    radioDrop: 'Follow your objective. Over.',
    radioTriple: 'Impressive.',
    radioFew: 'Just a few more.',
    radioLow: 'Retreat and treat your wounds.',
    radioLong: 'Nice shot.'
  };

  function commandVoiceSetting(name, fallback) {
    return Object.prototype.hasOwnProperty.call(commandVoiceConfig, name) ? commandVoiceConfig[name] : fallback;
  }

  function commandVoiceNumber(name, fallback) {
    const value = Number(commandVoiceSetting(name, fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  function selectCommandVoice(voices) {
    const english = voices.filter(voice => /^en[-_]/i.test(voice.lang || ''));
    const candidates = english.length ? english : voices;
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

  function radioClick(level = 1, delay = 0) {
    const ctx = getAudio();
    if (!ctx) return null;
    const t0 = ctx.currentTime + Math.max(0, delay);
    const src = bank.source('white', rng.fork(), 1.08);
    const bp = biquad(ctx, 'bandpass', Number(commandVoiceSetting('staticFrequency', 1450)) || 1450, 1.75);
    const g = gain(ctx, 0);
    series(src, bp, g);
    ad(g.gain, t0, 0.18 * level, 0.004, 0.07);
    src.start(t0, src._offset, 0.18);
    return routeVoice({ node: g, end: t0 + 0.2, send: 0.04 }, 'voice', { sendScale: 0.35 });
  }

  function radioCommand(key, level = 1) {
    const ctx = getAudio();
    if (!ctx || commandVoiceSetting('enabled', true) === false) return null;
    const text = RADIO_COMMAND_TEXT[key] || 'Command received.';
    const handles = [radioClick(level, 0)];
    const synth = window.speechSynthesis;
    const canSpeak = !!(synth && typeof window.SpeechSynthesisUtterance === 'function');
    const estimated = Math.max(0.75, text.length * 0.052);

    if (canSpeak) {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
        const preferred = selectCommandVoice(voices);
        if (preferred) utterance.voice = preferred;
        utterance.lang = preferred?.lang || 'en-US';
        utterance.rate = clamp(commandVoiceNumber('rate', 1), 0.65, 1.35);
        utterance.pitch = clamp(commandVoiceNumber('pitch', 1), 0.6, 1.4);
        utterance.volume = clamp(commandVoiceNumber('volume', 0.9), 0, 1) * clamp(level, 0, 1.2);
        setTimeout(() => {
          try {
            synth.cancel();
            synth.speak(utterance);
          } catch (_) {}
        }, 85);
        setTimeout(() => radioClick(level * 0.72, 0), (estimated + 0.18) * 1000);
        return {
          duration: estimated + 0.32,
          stop() {
            try { synth.cancel(); } catch (_) {}
            for (const handle of handles) handle?.stop?.();
          }
        };
      } catch (_) {}
    }

    handles.push(radioClick(level * 0.72, 0.22));
    return combineHandles(handles);
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
    const handle = routeVoice(voice, 'enemy', { pan: options.pan, routeGain: 1.18, sendScale: 1.15 });
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

