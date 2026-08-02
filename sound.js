'use strict';

/*
 * Legacy audio entry point.
 *
 * The real audio engine is loaded through explicit classic script tags in
 * index.html. This file intentionally does not inject scripts with
 * document.write(); that was too easy for cached/PWA/browser edge cases to
 * interrupt before the splash screen could advance.
 */
