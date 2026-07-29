(() => {
  'use strict';

  const config = window.ZOMVOX_CONFIG || {};
  const enemyConfig = config.enemies || {};
  const audioConfig = config.audio || {};
  const commandVoiceConfig = audioConfig.commandVoice || {};
  const ZOMBIE_MOAN_MAX_OVERLAP = Math.max(1, Math.floor(Number(enemyConfig.zombieMoanMaxVoices) || 3));
  const BUS_LEVELS = {
    weapon: 1.05,
    foley: 0.58,
    ambient: 0.36,
    enemy: 0.72,
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
  let ambientBed = null;
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

  function clamp(value, min, max, fallback) {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }

  function shotgunShot(level = 1) {
    const pitch = rand(.86, 1.02);
    noise(.018, .52 * level, 6200 * pitch, 'weapon', 'highpass', 0, .7);
    noise(.045, .42 * level, 3000 * pitch, 'weapon', 'bandpass', .004, .9);
    noise(.18, .22 * level, 1280 * pitch, 'weapon', 'lowpass', .012, .58);
    noise(.44, .12 * level, 520 * pitch, 'weapon', 'lowpass', .04, .46);
    tone(92 * pitch, .15, 'sine', .19 * level, 34 * pitch, 'weapon');
    tone(46 * pitch, .22, 'triangle', .13 * level, 24 * pitch, 'weapon', .008);
    tone(820 * pitch, .035, 'square', .038 * level, 420 * pitch, 'weapon', .018);
    for (let i = 0; i < 5; i++) {
      const delay = .018 + i * rand(.009, .018);
      noise(rand(.012, .024), .036 * level, rand(2100, 5200) * pitch, 'weapon', 'bandpass', delay, rand(1.1, 2.6));
    }
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

  function commandVoiceSetting(name, fallback) {
    return Object.prototype.hasOwnProperty.call(commandVoiceConfig, name) ? commandVoiceConfig[name] : fallback;
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

  function speakCommandLine(text, level = 1, rate = .9, pitch = .72) {
    if (commandVoiceSetting('enabled', true) === false) return false;
    const synth = window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return false;

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
      const preferredVoice = selectCommandVoice(voices);
      if (preferredVoice) utterance.voice = preferredVoice;
      utterance.lang = preferredVoice?.lang || 'en-US';
      utterance.rate = clamp(commandVoiceSetting('rate', rate), .5, 1.5, rate);
      utterance.pitch = clamp(commandVoiceSetting('pitch', pitch), 0, 2, pitch);
      utterance.volume = clamp(commandVoiceSetting('volume', .9), 0, 1, .9) * Math.max(0, Math.min(1, level));

      radioStatic(.06, .065 * level, 1550, 'ui');
      synth.speak(utterance);
      return true;
    } catch (_) {
      return false;
    }
  }

  function commandFallback(level = 1, chirps = 2) {
    radioStatic(.06, .055 * level, 1550, 'ui');
    for (let i = 0; i < chirps; i++) {
      tone(720 + i * 220, .045, 'square', .026 * level, 480 + i * 150, 'ui', .08 + i * .085);
    }
    radioStatic(.08, .032 * level, 2150, 'ui', .18 + chirps * .08);
  }

  function voiceDropSynth(level = 1) {
    if (speakCommandLine('Good luck, soldier.', level, .8, .45)) {
      radioStatic(.08, .035 * level, 2100, 'ui', 1.16);
      return;
    }
    commandFallback(level, 2);
  }

  function voiceTripleSynth(level = 1) {
    if (speakCommandLine('Impressive!', level, .86, .52)) {
      radioStatic(.07, .032 * level, 2200, 'ui', .74);
      return;
    }
    commandFallback(level, 3);
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

  function stopAmbientBed() {
    if (!ambientBed) return;
    for (const source of ambientBed.sources) {
      try { source.stop(); } catch (_) {}
      try { source.disconnect(); } catch (_) {}
    }
    for (const node of ambientBed.nodes) {
      try { node.disconnect(); } catch (_) {}
    }
    ambientBed = null;
  }

  function startAmbientBed(name) {
    const ctx = getAudio();
    if (!ctx || !ambientEnabled || !name) return;
    if (ambientBed?.name === name) return;
    stopAmbientBed();

    const now = ctx.currentTime;
    const nodes = [];
    const sources = [];
    const bedOut = ctx.createGain();
    bedOut.gain.setValueAtTime(1, now);
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
      layerGain.gain.setValueAtTime(gainValue, now);
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
      layerGain.gain.setValueAtTime(gainValue, now);
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
      addNoiseLayer({ gainValue: .042, filterType: 'lowpass', freq: 680, q: .5, lfoRate: .075, lfoDepth: .02, freqDepth: 280 });
      addNoiseLayer({ gainValue: .012, filterType: 'bandpass', freq: 1700, q: 1.2, lfoRate: .11, lfoDepth: .008, freqDepth: 420 });
      addToneLayer({ freq: 43, gainValue: .012, lfoRate: .028, lfoDepth: .006 });
    } else if (name === 'ambientForest') {
      addNoiseLayer({ gainValue: .022, filterType: 'lowpass', freq: 780, q: .58, lfoRate: .08, lfoDepth: .012, freqDepth: 260 });
    } else if (name === 'ambientSwamp') {
      addNoiseLayer({ gainValue: .024, filterType: 'lowpass', freq: 520, q: .75, lfoRate: .06, lfoDepth: .011, freqDepth: 170 });
      addNoiseLayer({ gainValue: .012, filterType: 'bandpass', freq: 2600, q: 4.5, lfoRate: .13, lfoDepth: .006, freqDepth: 380 });
    } else if (name === 'ambientDunes') {
      addNoiseLayer({ gainValue: .03, filterType: 'bandpass', freq: 1040, q: 1.05, lfoRate: .075, lfoDepth: .018, freqDepth: 460 });
    } else if (name === 'ambientRocky') {
      addNoiseLayer({ gainValue: .026, filterType: 'bandpass', freq: 1120, q: .9, lfoRate: .065, lfoDepth: .014, freqDepth: 360 });
    } else if (name === 'ambientAshlands') {
      addNoiseLayer({ gainValue: .034, filterType: 'lowpass', freq: 620, q: .58, lfoRate: .055, lfoDepth: .019, freqDepth: 210 });
      addToneLayer({ freq: 52, gainValue: .01, lfoRate: .021, lfoDepth: .005 });
    } else if (name === 'ambientTundra') {
      addNoiseLayer({ gainValue: .03, filterType: 'bandpass', freq: 1420, q: 1.8, lfoRate: .07, lfoDepth: .017, freqDepth: 520 });
    } else {
      addNoiseLayer({ gainValue: .02, filterType: 'lowpass', freq: 760, q: .65, freqDepth: 240 });
    }

    ambientBed = { name, sources, nodes };
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
