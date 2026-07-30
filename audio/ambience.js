'use strict';

/*
 * ZomVox audio: biome ambience
 *
 * Crossfaded looping ambience beds and scheduled biome sweeteners for menu, forest, swamp, dunes, rocky, ashlands, and tundra islands.
 * Loaded by ../sound.js before script.js; keep this as a classic script
 * so the static GitHub Pages build does not need bundling or modules.
 */

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
