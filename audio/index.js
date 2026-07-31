'use strict';

/*
 * ZomVox audio: public API dispatcher
 *
 * Maps ZomVox cue names to synthesis recipes and publishes window.ZomVoxSound for the main game loop.
 * Loaded by ../sound.js before script.js; keep this as a classic script
 * so the static GitHub Pages build does not need bundling or modules.
 */

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
        voice = weaponShot(ctx, bank, local, WEAPON_PROFILES.rifle, {
          distance: 0, firstPerson: true, echoBoost: 1.05
        });
        routeOptions.routeGain = level * 1.35;
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
        return routeVoice(surfaceImpact(ctx, bank, local, { surface: 'flesh', energy: level * 1.25 }), 'sfx', routeOptions);
      }
      case 'head': {
        return routeVoice(surfaceImpact(ctx, bank, local, { surface: 'flesh', energy: level * 1.65 }), 'sfx', routeOptions);
      }
      case 'kill':
        voice = surfaceImpact(ctx, bank, local, { surface: 'flesh', energy: level * 1.1 });
        bus = 'sfx';
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
