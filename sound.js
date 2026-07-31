'use strict';

/*
 * ZOMVOX AUDIO ENTRY POINT
 *
 * This file intentionally stays tiny. ZomVox is hosted as plain static files on
 * GitHub Pages, so there is no bundler, transpiler, import map, or module graph.
 *
 * The real procedural audio engine is split into classic scripts under
 * audio/. We load them in a strict order because each layer builds on the one
 * before it:
 *
 *   1. audio-config.js     reads window.ZOMVOX_CONFIG and defines RNG/config
 *   2. dsp.js              shared Web Audio building blocks
 *   3. weapons.js          gunshot and dry-fire recipes
 *   4. foley.js            impacts, footsteps, reloads, explosions, UI pings
 *   5. voice.js            formant fallback voices, zombie throats, one-shots
 *   6. mixer-runtime.js    buses, limiter, file playback, routing helpers
 *   7. ambience.js         looping biome beds and scheduled sweeteners
 *   8. index.js            cue dispatcher and window.ZomVoxSound public API
 *
 * document.write is old-school, but here it is deliberate: while index.html is
 * still parsing, it inserts parser-blocking classic scripts. That preserves the
 * old guarantee that window.ZomVoxSound exists before script.js runs, without a
 * build step or async loading race.
 */

[
  'audio/audio-config.js',
  'audio/dsp.js',
  'audio/weapons.js',
  'audio/foley.js',
  'audio/voice.js',
  'audio/mixer-runtime.js',
  'audio/ambience.js',
  'audio/index.js'
].forEach(src => {
  document.write('<script src="' + src + '"></script>');
});
