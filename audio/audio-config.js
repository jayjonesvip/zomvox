'use strict';

/*
 * ZomVox audio: configuration and RNG
 *
 * Reads window.ZOMVOX_CONFIG, defines file-backed cue policy, and exposes the tiny deterministic RNG shared by every procedural voice.
 * Loaded by ../sound.js before script.js; keep this as a classic script
 * so the static GitHub Pages build does not need bundling or modules.
 */

  /*
   * ZOMVOX AUDIO â€” single-file procedural sound system
   *
   * Built from the stronger layered synthesis approach used by the attached
   * audio system, while keeping ZomVox's existing window.ZomVoxSound API.
   *
   * Kept: shared noise bank, layered weapon/foley recipes, bus compression,
   * ducking, one generated reverb, audio-rate ambience movement, formant voice.
   * Removed: module imports, 3D emitter pool, raycast occlusion/room probes,
   * five-way convolution blend, offline test harness and engine event wiring.
   */

  const config = window.ZOMVOX_CONFIG || {};
  const enemyConfig = config.enemies || {};
  const audioConfig = config.audio || {};
  const audioFileConfig = audioConfig.files || {};
  const commandVoiceConfig = audioConfig.commandVoice || {};

  const DEFAULT_FILE_CUES = {
    shoot: null,
    zombieMoan: 'zombiemoan.wav'
  };
  const FILE_CUE_VOLUME = { shoot: 0.72, zombieMoan: 0.74 };
  const PREFER_FILES = audioConfig.preferFiles === true;
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
