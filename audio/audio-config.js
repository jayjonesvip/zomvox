'use strict';

/*
 * ZomVox audio: configuration and RNG
 *
 * Reads window.ZOMVOX_CONFIG, defines file-backed cue policy, and exposes the tiny deterministic RNG shared by every procedural voice.
 * Loaded by ../sound.js before script.js; keep this as a classic script
 * so the static GitHub Pages build does not need bundling or modules.
 */

  const config = window.ZOMVOX_CONFIG || {};
  const enemyConfig = config.enemies || {};
  const audioConfig = config.audio || {};
  const audioFileConfig = audioConfig.files || {};

  const DEFAULT_FILE_CUES = {
    shoot: 'shoot.mp3',
    empty: 'empty.mp3',
    reloadStart: 'reloadStart.mp3',
    reloadDone: 'reloadDone.mp3',
    explosion: 'explosion.mp3',
    block: '',
    hit: 'hit.mp3',
    head: 'head.mp3',
    kill: 'hit.mp3',
    hurt: 'hurt.mp3',
    death: '',
    toxin: 'toxin.mp3',
    land: 'land.mp3',
    footstep: '',
    heartbeat: '',
    pickup: 'pickup.mp3',
    pickupAmmo: 'pickupAmmo.mp3',
    pickupHealth: 'pickupHealth.mp3',
    pickupC4: 'pickupC4.mp3',
    perkEquip: 'perkEquip.mp3',
    objectiveClear: 'objectiveClear.mp3',
    wave: '',
    confirm: '',
    briefing: '',
    zombieMoan: 'zombiemoan.wav',
    ambientMenu: 'ambientMenu.mp3',
    ambientForest: 'ambientForest.mp3',
    ambientDunes: 'ambientDunes.mp3',
    ambientRocky: 'ambientRocky.mp3',
    ambientSwamp: 'ambientSwamp.mp3',
    ambientAshlands: 'ambientAshlands.mp3',
    ambientTundra: ''
  };
  const DEFAULT_FILE_PLAYBACK_RATES = {
    shoot: 1.15
  };
  const FILE_CUE_VOLUME = {
    shoot: 1.18,
    explosion: 1.08,
    hit: 0.92,
    head: 1.04,
    zombieMoan: 0.78,
    ambientMenu: 0.72,
    ambientForest: 0.68,
    ambientDunes: 0.68,
    ambientRocky: 0.68,
    ambientSwamp: 0.68,
    ambientAshlands: 0.68
  };
  const PREFER_FILES = audioConfig.preferFiles !== false;
  const FILE_FALLBACK = audioConfig.fileFallback !== false;
  const ZOMBIE_MOAN_MAX_OVERLAP = Math.max(
    1,
    Math.floor(Number(enemyConfig.zombieMoanMaxVoices) || 3)
  );

  class Rng {
    constructor(seed = 0x5a17c9e3) {
      this.state = (Number(seed) >>> 0) || 0x5a17c9e3;
    }
    u32() {
      let x = this.state;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      this.state = x >>> 0;
      return this.state;
    }
    float() { return this.u32() / 4294967296; }
    signed() { return this.float() * 2 - 1; }
    range(min, max) { return min + (max - min) * this.float(); }
    fork() { return new Rng(this.u32() ^ 0x9e3779b9); }
  }
