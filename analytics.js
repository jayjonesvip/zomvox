(() => {
  'use strict';

  /*
    ZomVox analytics bridge.

    The game is a single-page WebGL app, so ordinary page views do not say
    much about whether somebody actually played. This wrapper sends small,
    gameplay-focused GA4 events when gtag is present and quietly no-ops when
    analytics is blocked, missing, or running from a local file.
  */

  const config = window.ZOMVOX_CONFIG || {};
  const buildVersion = String(config.buildVersion || 'dev');

  function isStandaloneApp() {
    return window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      navigator.standalone === true;
  }

  function inputType() {
    return window.matchMedia?.('(pointer: coarse)').matches ? 'mobile' : 'desktop';
  }

  function cleanValue(value) {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (typeof value === 'boolean') return value;
    return String(value).slice(0, 100);
  }

  function cleanParams(params = {}) {
    const base = {
      build_version: buildVersion,
      input_type: inputType(),
      installed_pwa: isStandaloneApp()
    };
    const out = {};
    for (const [key, value] of Object.entries({ ...base, ...params })) {
      const cleaned = cleanValue(value);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }

  function track(eventName, params = {}) {
    if (!eventName || typeof window.gtag !== 'function') return false;
    try {
      window.gtag('event', eventName, cleanParams(params));
      return true;
    } catch (_) {
      return false;
    }
  }

  window.ZomVoxAnalytics = {
    track,

    levelStart(levelName, params = {}) {
      return track('level_start', { level_name: levelName, ...params });
    },

    levelEnd(levelName, success, params = {}) {
      return track('level_end', { level_name: levelName, success: !!success, ...params });
    }
  };
})();
