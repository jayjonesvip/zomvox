(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) {
    document.body.innerHTML = '<div style="padding:30px;font-family:sans-serif">WebGL is not available in this browser.</div>';
    return;
  }

  const $ = (id) => document.getElementById(id);
  const reloadText = $('reloadText');
  const weaponPanel = $('weaponPanel');
  const bulletRack = $('bulletRack');
  const reserveText = $('reserveText');
  const menu = $('menu');
  const play = $('play');
  const toast = $('toast');
  const damageFlash = $('damageFlash');
  const healthStatus = $('healthStatus');
  const healthBigText = $('healthBigText');
  const healthBigFill = $('healthBigFill');
  const scoreFeed = $('scoreFeed');
  const reloadOverlay = $('reloadOverlay');
  const reloadOverlayFill = $('reloadOverlayFill');
  const worldOverlay = $('worldOverlay');
  const worldText = $('worldText');
  const worldFill = $('worldFill');
  const deathOverlay = $('deathOverlay');
  const deathFill = $('deathFill');
  const mobileControls = $('mobileControls');
  const stickBase = $('stickBase');
  const stickKnob = $('stickKnob');
  const touchShoot = $('touchShoot');
  const touchJump = $('touchJump');
  const touchSprint = $('touchSprint');
  const splash = $('splash');
  const splashStatus = $('splashStatus');
  const splashFill = $('splashFill');
  const splashVersion = $('splashVersion');
  const settingHealth = $('settingHealth');
  const settingAmmo = $('settingAmmo');
  const settingControls = $('settingControls');
  const settingSound = $('settingSound');
  const settingFullscreen = $('settingFullscreen');

  const GAME_OPTIONS = {
    timeMode: 'cycle', // 'cycle', 'day', or 'night'
    skyColor: null,   // null for dynamic sky, or '#102030', or [0.06, 0.13, 0.20]
    dangerousWater: true,
    fog: true
  };

  const BLOCK = {
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAF: 5,
    SAND: 6,
    WATER: 7,
    BRICK: 8,
    LAMP: 9
  };

  const CHUNK_SIZE = 16;
  const WORLD_CHUNK_RADIUS = 3;
  const WORLD_MIN = -WORLD_CHUNK_RADIUS * CHUNK_SIZE;
  const WORLD_MAX = (WORLD_CHUNK_RADIUS + 1) * CHUNK_SIZE - 1;
  const MAX_Y = 46;
  const WATER_LEVEL = 8;
  const PLAYER_HEIGHT = 1.76;
  const PLAYER_RADIUS = 0.31;
  const MAG_SIZE = 6;
  const RELOAD_TIME = 1.15;
  const ENEMY_CAP = 18;
  const LONG_RANGE_KILL_DIST = 34;

  for (let i = 0; i < MAG_SIZE; i++) {
    const b = document.createElement('div');
    b.className = 'bullet';
    bulletRack.appendChild(b);
  }

  let currentSeed = 729641;
  let world = new Map();
  let edits = new Map();
  let loadedChunks = new Set();
  let currentChunkX = 999999;
  let currentChunkZ = 999999;
  let meshes = { opaque: null, water: null, dynamic: null };
  let chunkMeshes = new Map();
  let dirtyChunks = new Set();
  let rebuildQueued = false;
  let fullRebuildQueued = false;
  let worldBlockCount = 0;

  const player = {
    pos: [0, 16, 0],
    vel: [0, 0, 0],
    yaw: Math.PI,
    pitch: 0,
    grounded: false,
    health: 100,
    mag: MAG_SIZE,
    reserve: 36,
    reloading: false,
    reloadTimer: 0,
    invuln: 0,
    kills: 0,
    score: 0,
    deaths: 0
  };

  let enemies = [];
  let pickups = [];
  let particles = [];
  let nextSpawnTimer = 3.5;
  let locked = false;
  let touchMode = matchMedia('(pointer: coarse)').matches;
  let keys = Object.create(null);
  const touchInput = { moveX: 0, moveY: 0, jump: false, sprint: false, lookId: null, lookX: 0, lookY: 0, stickId: null };
  const BUILD_VERSION = '2026.07.01.1';
  let lastTarget = null;
  let lastFrame = performance.now();
  let fpsAvg = 60;
  let frameCounter = 0;
  let lastKillTime = -999;
  let dayAmount = 1;
  let soundEnabled = true;
  let waterDamageTimer = 0;
  const deathState = { active: false, timer: 0, duration: 2.65 };
  const worldRebuildState = { active: false, timer: 0, startedAt: 0, duration: 2.35, seed: null };

  function showToast(message) {
    toast.textContent = message;
  }

  function scorePop(message, cls = '') {
    const el = document.createElement('div');
    el.className = 'scorePop ' + cls;
    el.textContent = message;
    scoreFeed.appendChild(el);
    setTimeout(() => el.remove(), 1150);
  }

  let audioCtx = null;
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
    osc.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + dur + .02);
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
    filt.type = 'lowpass'; filt.frequency.setValueAtTime(cutoff, now);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.buffer = buffer;
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(now); src.stop(now + dur + .02);
  }
  function sound(name) {
    if (!soundEnabled) return;
    if (name === 'shoot') { noise(.045, .12, 950); tone(105, .05, 'sawtooth', .045, 55); }
    else if (name === 'empty') { tone(120, .07, 'square', .04, 85); }
    else if (name === 'reloadStart') { tone(180, .05, 'square', .04, 105); setTimeout(() => tone(260, .04, 'square', .035, 180), 110); }
    else if (name === 'reloadDone') { tone(360, .06, 'triangle', .045, 520); }
    else if (name === 'block') { noise(.055, .075, 520); tone(165, .045, 'square', .035, 110); }
    else if (name === 'hit') { tone(470, .055, 'triangle', .055, 260); }
    else if (name === 'head') { tone(780, .07, 'square', .052, 1180); }
    else if (name === 'kill') { tone(260, .075, 'square', .055, 390); setTimeout(() => tone(520, .08, 'triangle', .05, 780), 80); }
    else if (name === 'pickup') { tone(520, .06, 'triangle', .045, 780); }
    else if (name === 'hurt') { tone(85, .12, 'sawtooth', .07, 45); }
  }


  function pulseDamage() {
    damageFlash.classList.remove('hit');
    void damageFlash.offsetWidth;
    damageFlash.classList.add('hit');
    setTimeout(() => damageFlash.classList.remove('hit'), 90);
  }
  function shakeScreen() {
    document.body.classList.remove('shaking');
    void document.body.offsetWidth;
    document.body.classList.add('shaking');
    clearTimeout(shakeScreen.timer);
    shakeScreen.timer = setTimeout(() => document.body.classList.remove('shaking'), 260);
  }

  function isMenuOpen() {
    return menu.style.display !== 'none' || splash.style.display !== 'none';
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function skyOptionColor(fallback) {
    const value = GAME_OPTIONS.skyColor;
    if (Array.isArray(value) && value.length >= 3) {
      return [clamp01(value[0]), clamp01(value[1]), clamp01(value[2])];
    }
    if (typeof value === 'string') {
      const match = value.trim().match(/^#?([0-9a-f]{6})$/i);
      if (match) {
        const n = parseInt(match[1], 16);
        return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      }
    }
    return fallback;
  }

  function buildVersionText() {
    const modified = new Date(document.lastModified);
    if (Number.isNaN(modified.getTime())) return 'Build ' + BUILD_VERSION;
    const stamp = [
      modified.getFullYear(),
      String(modified.getMonth() + 1).padStart(2, '0'),
      String(modified.getDate()).padStart(2, '0'),
      String(modified.getHours()).padStart(2, '0'),
      String(modified.getMinutes()).padStart(2, '0')
    ].join('');
    return 'Build ' + BUILD_VERSION + '-' + stamp;
  }

  function runSplash() {
    if (splashVersion) splashVersion.textContent = buildVersionText();
    const messages = [
      'Getting latest version...',
      'Generating world...',
      'Calibrating display...'
    ];
    const duration = 2600;
    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2.2);
      const idx = Math.min(messages.length - 1, Math.floor(t * messages.length));
      splashStatus.textContent = messages[idx];
      splashFill.style.width = (Math.max(.04, eased) * 100).toFixed(1) + '%';
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        splashStatus.textContent = 'Ready.';
        splashFill.style.width = '100%';
        setTimeout(() => {
          splash.classList.add('hide');
          setTimeout(() => { splash.style.display = 'none'; }, 420);
        }, 180);
      }
    }
    requestAnimationFrame(step);
  }

  function applySettings() {
    soundEnabled = !!settingSound.checked;
    document.body.classList.toggle('hide-health', !settingHealth.checked);
    document.body.classList.toggle('hide-ammo', !settingAmmo.checked);
    document.body.classList.toggle('hide-controls', !settingControls.checked);
  }

  function beginWorldRebuild(seed) {
    if (worldRebuildState.active) return;
    const nextSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 999999);
    worldRebuildState.active = true;
    worldRebuildState.timer = 0;
    worldRebuildState.startedAt = performance.now();
    worldRebuildState.seed = nextSeed;
    worldText.textContent = 'Building frontier...';
    worldFill.style.width = '0%';
    worldOverlay.classList.add('show');
    player.vel = [0, 0, 0];
    player.reloading = false;
    player.reloadTimer = 0;
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
  }

  function updateWorldRebuild(dt) {
    worldRebuildState.timer = (performance.now() - worldRebuildState.startedAt) / 1000;
    const progress = Math.min(1, worldRebuildState.timer / worldRebuildState.duration);
    worldFill.style.width = (progress * 100).toFixed(1) + '%';
    if (progress < .38) worldText.textContent = 'Building frontier...';
    else if (progress < .76) worldText.textContent = 'Clearing old voxels...';
    else worldText.textContent = 'Generating new zombie frontier...';
    if (progress >= 1) {
      const nextSeed = worldRebuildState.seed;
      worldRebuildState.active = false;
      worldOverlay.classList.remove('show');
      generateWorld(nextSeed);
    }
  }

  async function requestMobileFullscreen() {
    if (!touchMode || !settingFullscreen.checked || document.fullscreenElement) return;
    const target = document.documentElement;
    try {
      if (target.requestFullscreen) await target.requestFullscreen({ navigationUI: 'hide' });
      else if (canvas.webkitRequestFullscreen) canvas.webkitRequestFullscreen();
    } catch (_) {}
  }
  function initSettings() {
    settingFullscreen.checked = touchMode;
    [settingHealth, settingAmmo, settingControls, settingSound].forEach(el => {
      el.addEventListener('change', applySettings);
    });
    applySettings();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(innerWidth * dpr);
    const h = Math.floor(innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  window.addEventListener('resize', resize);
  resize();

  function createShader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function createProgram(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, createShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, createShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  const voxelVS = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv;
    attribute float aType;
    uniform mat4 uMVP;
    varying vec3 vNormal;
    varying vec3 vWorld;
    varying vec2 vUv;
    varying float vType;
    void main(){
      vNormal = aNormal;
      vWorld = aPosition;
      vUv = aUv;
      vType = aType;
      gl_Position = uMVP * vec4(aPosition, 1.0);
    }
  `;
  const voxelFS = `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vWorld;
    varying vec2 vUv;
    varying float vType;
    uniform vec3 uCam;
    uniform float uTime;
    uniform vec3 uLightDir;
    uniform vec3 uSky;
    uniform float uDay;
    uniform float uFog;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float gridLine(vec2 uv){
      float b = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
      return smoothstep(0.0, 0.035, b);
    }
    vec3 baseColor(float t, vec3 n){
      if(t < 1.5){ if(n.y > 0.55) return vec3(0.23, 0.60, 0.24); return vec3(0.40, 0.28, 0.16); }
      if(t < 2.5) return vec3(0.46, 0.29, 0.16);
      if(t < 3.5) return vec3(0.50, 0.53, 0.56);
      if(t < 4.5) return vec3(0.52, 0.30, 0.12);
      if(t < 5.5) return vec3(0.12, 0.46, 0.19);
      if(t < 6.5) return vec3(0.78, 0.67, 0.36);
      if(t < 7.5) return vec3(0.10, 0.37, 0.70);
      if(t < 8.5) return vec3(0.62, 0.20, 0.16);
      if(t < 9.5) return vec3(1.00, 0.74, 0.25);
      if(t < 10.5) return vec3(0.14, 0.65, 0.19); /* enemy green */
      if(t < 11.5) return vec3(0.08, 0.36, 0.11); /* enemy dark */
      if(t < 12.5) return vec3(1.00, 0.10, 0.07); /* eyes */
      if(t < 13.5) return vec3(0.88, 0.70, 0.18); /* ammo */
      if(t < 14.5) return vec3(0.86, 0.88, 0.82); /* metal */
      return vec3(1.0, 0.45, 0.18); /* particles */
    }
    void main(){
      vec3 n = normalize(vNormal);
      vec3 color = baseColor(vType, n);
      float grain = hash(floor(vec2(vWorld.x * 6.0 + vWorld.y * 1.7, vWorld.z * 6.0 - vWorld.y * 2.3)));
      color *= 0.88 + grain * 0.18;
      if(vType > 6.5 && vType < 7.5){
        float ripple = sin((vWorld.x * 2.4 + vWorld.z * 2.1 + uTime * 2.6)) * 0.04;
        color += vec3(0.03, 0.12, 0.18) + ripple;
      }
      if(vType > 8.5 && vType < 9.5) color += vec3(0.55, 0.38, 0.05);
      if(vType > 11.5 && vType < 12.5) color += vec3(0.70, 0.02, 0.0);
      if(vType > 14.5) color += vec3(0.50, 0.15, 0.04);
      float edge = gridLine(vUv);
      color *= mix(0.58, 1.0, edge);
      float sun = max(dot(n, normalize(uLightDir)), 0.0);
      float skyBounce = max(n.y, 0.0) * mix(0.05, 0.18, uDay);
      float light = mix(0.13, 0.39, uDay) + sun * mix(0.28, 0.70, uDay) + skyBounce;
      if(vType > 8.5 && vType < 9.5) light += 0.65;
      if(vType > 11.5 && vType < 12.5) light += 0.75;
      if(vType > 12.5) light += 0.22;
      color *= light;
      if(uFog > 0.5){
        float dist = length(vWorld - uCam);
        float fog = smoothstep(54.0, 128.0, dist);
        color = mix(color, uSky, fog);
      }
      color += vec3(0.03, 0.05, 0.10) * (1.0 - uDay);
      float alpha = (vType > 6.5 && vType < 7.5) ? 0.63 : 1.0;
      gl_FragColor = vec4(color, alpha);
    }
  `;
  const lineVS = `
    attribute vec3 aPosition;
    uniform mat4 uMVP;
    void main(){ gl_Position = uMVP * vec4(aPosition, 1.0); }
  `;
  const lineFS = `
    precision mediump float;
    uniform vec4 uColor;
    void main(){ gl_FragColor = uColor; }
  `;

  const voxelProgram = createProgram(voxelVS, voxelFS);
  const lineProgram = createProgram(lineVS, lineFS);
  const loc = {
    pos: gl.getAttribLocation(voxelProgram, 'aPosition'),
    normal: gl.getAttribLocation(voxelProgram, 'aNormal'),
    uv: gl.getAttribLocation(voxelProgram, 'aUv'),
    type: gl.getAttribLocation(voxelProgram, 'aType'),
    mvp: gl.getUniformLocation(voxelProgram, 'uMVP'),
    cam: gl.getUniformLocation(voxelProgram, 'uCam'),
    time: gl.getUniformLocation(voxelProgram, 'uTime'),
    light: gl.getUniformLocation(voxelProgram, 'uLightDir'),
    sky: gl.getUniformLocation(voxelProgram, 'uSky'),
    day: gl.getUniformLocation(voxelProgram, 'uDay'),
    fog: gl.getUniformLocation(voxelProgram, 'uFog')
  };
  const lineLoc = {
    pos: gl.getAttribLocation(lineProgram, 'aPosition'),
    mvp: gl.getUniformLocation(lineProgram, 'uMVP'),
    color: gl.getUniformLocation(lineProgram, 'uColor')
  };
  const lineBuffer = gl.createBuffer();
  const dynamicBuffer = gl.createBuffer();

  function mat4Perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    const out = new Float32Array(16);
    out[0] = f / aspect; out[5] = f; out[10] = (far + near) * nf; out[11] = -1; out[14] = 2 * far * near * nf;
    return out;
  }
  function mat4LookAt(eye, center, up) {
    let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
    z0 = eye[0] - center[0]; z1 = eye[1] - center[1]; z2 = eye[2] - center[2];
    len = Math.hypot(z0, z1, z2) || 1; z0 /= len; z1 /= len; z2 /= len;
    x0 = up[1] * z2 - up[2] * z1; x1 = up[2] * z0 - up[0] * z2; x2 = up[0] * z1 - up[1] * z0;
    len = Math.hypot(x0, x1, x2) || 1; x0 /= len; x1 /= len; x2 /= len;
    y0 = z1 * x2 - z2 * x1; y1 = z2 * x0 - z0 * x2; y2 = z0 * x1 - z1 * x0;
    const out = new Float32Array(16);
    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2]);
    out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2]);
    out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2]);
    out[15] = 1;
    return out;
  }
  function mat4Mul(a, b) {
    const out = new Float32Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
    out[0] = b0*a00 + b1*a10 + b2*a20 + b3*a30; out[1] = b0*a01 + b1*a11 + b2*a21 + b3*a31; out[2] = b0*a02 + b1*a12 + b2*a22 + b3*a32; out[3] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
    out[4] = b0*a00 + b1*a10 + b2*a20 + b3*a30; out[5] = b0*a01 + b1*a11 + b2*a21 + b3*a31; out[6] = b0*a02 + b1*a12 + b2*a22 + b3*a32; out[7] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
    out[8] = b0*a00 + b1*a10 + b2*a20 + b3*a30; out[9] = b0*a01 + b1*a11 + b2*a21 + b3*a31; out[10] = b0*a02 + b1*a12 + b2*a22 + b3*a32; out[11] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
    out[12] = b0*a00 + b1*a10 + b2*a20 + b3*a30; out[13] = b0*a01 + b1*a11 + b2*a21 + b3*a31; out[14] = b0*a02 + b1*a12 + b2*a22 + b3*a32; out[15] = b0*a03 + b1*a13 + b2*a23 + b3*a33;
    return out;
  }

  function lookDir() {
    const cp = Math.cos(player.pitch);
    return [Math.sin(player.yaw) * cp, Math.sin(player.pitch), Math.cos(player.yaw) * cp];
  }
  function eyePos() { return [player.pos[0], player.pos[1] + 1.58, player.pos[2]]; }
  function keyOf(x, y, z) { return x + ',' + y + ',' + z; }
  function chunkKey(cx, cz) { return cx + ',' + cz; }
  function chunkCoord(v) { return Math.floor(v / CHUNK_SIZE); }
  function chunkInWorld(cx, cz) { return Math.abs(cx) <= WORLD_CHUNK_RADIUS && Math.abs(cz) <= WORLD_CHUNK_RADIUS; }
  function inWorldXZ(x, z) { return x >= WORLD_MIN && x <= WORLD_MAX && z >= WORLD_MIN && z <= WORLD_MAX; }
  function clampToWorld(pos) {
    pos[0] = Math.max(WORLD_MIN + PLAYER_RADIUS + .4, Math.min(WORLD_MAX - PLAYER_RADIUS - .4, pos[0]));
    pos[2] = Math.max(WORLD_MIN + PLAYER_RADIUS + .4, Math.min(WORLD_MAX - PLAYER_RADIUS - .4, pos[2]));
  }
  function getBlock(x, y, z) { return world.get(keyOf(x, y, z)) || 0; }
  function genSetBlock(x, y, z, type) {
    if (!inWorldXZ(x, z)) return;
    const k = keyOf(x, y, z);
    if (edits.has(k)) return;
    if (type) world.set(k, type); else world.delete(k);
  }
  function setBlock(x, y, z, type, persist = true) {
    if (!inWorldXZ(x, z)) return;
    const k = keyOf(x, y, z);
    if (type) world.set(k, type); else world.delete(k);
    if (persist) edits.set(k, type || 0);
  }
  function isSolidType(type) { return !!type && type !== BLOCK.WATER && type !== BLOCK.LEAF; }
  function blocksMovement(type) { return !!type && type !== BLOCK.WATER && type !== BLOCK.LEAF; }

  function seededHash(x, z) {
    const n = Math.sin((x * 127.1 + z * 311.7 + currentSeed * 0.0137)) * 43758.5453123;
    return n - Math.floor(n);
  }
  function smoothstep(t) { return t * t * (3 - 2 * t); }
  function noise2(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const a = seededHash(xi, zi), b = seededHash(xi + 1, zi), c = seededHash(xi, zi + 1), d = seededHash(xi + 1, zi + 1);
    const u = smoothstep(xf), v = smoothstep(zf);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function fbm(x, z) {
    let value = 0, amp = 0.5, freq = 0.032;
    for (let i = 0; i < 5; i++) { value += noise2(x * freq, z * freq) * amp; freq *= 2.02; amp *= 0.52; }
    return value;
  }
  function terrainHeight(x, z) {
    const broad = fbm(x * 0.45 + 500, z * 0.45 - 200);
    const detail = fbm(x, z);
    let h = Math.floor(4 + detail * 18 + broad * 12);
    const ridge = Math.abs(noise2(x * 0.012 - 300, z * 0.012 + 800) - 0.5) * 2;
    h += Math.floor(ridge * 5);
    const lakeA = Math.max(0, 1 - Math.hypot(x + 28, z - 18) / 28);
    const lakeB = Math.max(0, 1 - Math.hypot(x - 34, z + 30) / 24);
    const marsh = Math.max(0, noise2(x * 0.045 - 120, z * 0.045 + 310) - 0.70);
    h -= Math.floor(lakeA * 22 + lakeB * 18 + marsh * 28);
    return Math.max(3, Math.min(MAX_Y - 8, h));
  }

  function applyEditsForChunk(cx, cz) {
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    edits.forEach((type, k) => {
      const p = k.split(',');
      const x = +p[0], y = +p[1], z = +p[2];
      if (x >= x0 && x < x0 + CHUNK_SIZE && z >= z0 && z < z0 + CHUNK_SIZE) {
        if (type) world.set(k, type); else world.delete(k);
      }
    });
  }

  function spawnPickupAt(x, y, z) {
    pickups.push({ x: x + .5, y: y + .35, z: z + .5, amount: 6, bob: seededHash(x * 5.1, z * 9.3) * 10 });
  }

  function generateChunk(cx, cz) {
    if (!chunkInWorld(cx, cz)) return;
    const ck = chunkKey(cx, cz);
    if (loadedChunks.has(ck)) return;
    loadedChunks.add(ck);
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = x0 + lx, z = z0 + lz;
        const h = terrainHeight(x, z);
        const beach = h <= WATER_LEVEL + 2;
        const desert = noise2(x * 0.035 + 90, z * 0.035 - 30) > 0.66 && h < WATER_LEVEL + 9;
        const topType = (beach || desert) ? BLOCK.SAND : BLOCK.GRASS;
        for (let y = 0; y <= h; y++) {
          let type = BLOCK.STONE;
          if (y === h) type = topType;
          else if (y > h - 4) type = (beach || desert) ? BLOCK.SAND : BLOCK.DIRT;
          genSetBlock(x, y, z, type);
        }
        if (h < WATER_LEVEL) {
          for (let y = h + 1; y <= WATER_LEVEL; y++) genSetBlock(x, y, z, BLOCK.WATER);
        }
      }
    }
    // Trees are limited away from chunk borders so chunks can be generated/unloaded cleanly.
    for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
        const x = x0 + lx, z = z0 + lz;
        const h = terrainHeight(x, z);
        if (h > WATER_LEVEL + 1 && seededHash(x * 8.31, z * 3.77) > 0.985) {
          const trunk = 4 + Math.floor(seededHash(x + 11.2, z - 4.1) * 3);
          for (let y = 1; y <= trunk; y++) genSetBlock(x, h + y, z, BLOCK.WOOD);
          const crownY = h + trunk;
          for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 2; dy++) {
            const dist = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - 1);
            if (dist <= 4 && seededHash(x + dx * 19 + dy, z + dz * 23) > 0.08) {
              const bx = x + dx, by = crownY + dy, bz = z + dz;
              if (!getBlock(bx, by, bz)) genSetBlock(bx, by, bz, BLOCK.LEAF);
            }
          }
        }
      }
    }
    for (let lx = 3; lx < CHUNK_SIZE - 3; lx += 2) {
      for (let lz = 3; lz < CHUNK_SIZE - 3; lz += 2) {
        const x = x0 + lx, z = z0 + lz;
        const h = terrainHeight(x, z);
        const rockNoise = seededHash(x * 4.13 + 15, z * 6.71 - 8);
        if (h > WATER_LEVEL + 1 && rockNoise > 0.965) {
          const radius = 1 + Math.floor(seededHash(x - 21, z + 32) * 2.2);
          const height = 1 + Math.floor(seededHash(x + 5, z - 17) * 3.3);
          for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
            const falloff = Math.abs(dx) + Math.abs(dz);
            const stack = Math.max(1, height - Math.floor(falloff * .7));
            if (falloff <= radius + 1 && seededHash(x + dx * 9.1, z + dz * 7.7) > 0.12) {
              const bx = x + dx, bz = z + dz, by = terrainHeight(bx, bz) + 1;
              for (let y = 0; y < stack; y++) genSetBlock(bx, by + y, bz, BLOCK.STONE);
            }
          }
        }
      }
    }
    if (seededHash(cx * 20.2 + 19, cz * 17.7 - 3) > 0.72) {
      const lx = 3 + Math.floor(seededHash(cx + 77, cz - 42) * 10);
      const lz = 3 + Math.floor(seededHash(cx - 14, cz + 91) * 10);
      const x = x0 + lx, z = z0 + lz, y = terrainHeight(x, z) + 1;
      if (y > WATER_LEVEL + 1) spawnPickupAt(x, y, z);
    }
    applyEditsForChunk(cx, cz);
  }

  function ensureChunks(force = false) {
    if (!force && loadedChunks.size >= (WORLD_CHUNK_RADIUS * 2 + 1) ** 2) return;
    currentChunkX = 0;
    currentChunkZ = 0;
    for (let cx = -WORLD_CHUNK_RADIUS; cx <= WORLD_CHUNK_RADIUS; cx++) {
      for (let cz = -WORLD_CHUNK_RADIUS; cz <= WORLD_CHUNK_RADIUS; cz++) {
        generateChunk(cx, cz);
      }
    }
    queueRebuild();
  }

  function topSolidY(x, z) {
    x = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Math.floor(x)));
    z = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Math.floor(z)));
    generateChunk(chunkCoord(x), chunkCoord(z));
    for (let y = MAX_Y + 25; y >= 0; y--) {
      const t = getBlock(x, y, z);
      if (t && t !== BLOCK.WATER && t !== BLOCK.LEAF) return y;
    }
    return terrainHeight(x, z);
  }

  const faces = [
    { n: [ 1, 0, 0], v: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
    { n: [-1, 0, 0], v: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
    { n: [ 0, 1, 0], v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
    { n: [ 0,-1, 0], v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
    { n: [ 0, 0, 1], v: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
    { n: [ 0, 0,-1], v: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] }
  ];
  const tri = [0, 1, 2, 0, 2, 3];
  const uvs = [[0,0], [0,1], [1,1], [1,0]];

  function neighborHidesFace(type, neighborType) {
    if (!neighborType) return false;
    if (type === BLOCK.WATER) return true;
    return neighborType !== BLOCK.WATER;
  }
  function pushFace(arr, x, y, z, face, type) {
    for (const idx of tri) {
      const p = face.v[idx], uv = uvs[idx];
      arr.push(x + p[0], y + p[1], z + p[2], face.n[0], face.n[1], face.n[2], uv[0], uv[1], type);
    }
  }
  function pushBox(arr, x, y, z, w, h, d, type) {
    const boxFaces = [
      { n: [ 1,0,0], v: [[w,0,0],[w,h,0],[w,h,d],[w,0,d]] },
      { n: [-1,0,0], v: [[0,0,d],[0,h,d],[0,h,0],[0,0,0]] },
      { n: [0, 1,0], v: [[0,h,d],[w,h,d],[w,h,0],[0,h,0]] },
      { n: [0,-1,0], v: [[0,0,0],[w,0,0],[w,0,d],[0,0,d]] },
      { n: [0,0, 1], v: [[w,0,d],[w,h,d],[0,h,d],[0,0,d]] },
      { n: [0,0,-1], v: [[0,0,0],[0,h,0],[w,h,0],[w,0,0]] }
    ];
    for (const f of boxFaces) pushFace(arr, x, y, z, f, type);
  }

  function pushBoxY(arr, cx, y, cz, x0, y0, z0, w, h, d, yaw, type) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const x1 = x0 + w, y1 = y0 + h, z1 = z0 + d;
    const boxFaces = [
      { n: [ 1,0,0], v: [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]] },
      { n: [-1,0,0], v: [[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[x0,y0,z0]] },
      { n: [0, 1,0], v: [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]] },
      { n: [0,-1,0], v: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]] },
      { n: [0,0, 1], v: [[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[x0,y0,z1]] },
      { n: [0,0,-1], v: [[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]] }
    ];
    for (const f of boxFaces) {
      const nx = f.n[0] * c - f.n[2] * s;
      const nz = f.n[0] * s + f.n[2] * c;
      for (const idx of tri) {
        const p = f.v[idx], uv = uvs[idx];
        const wx = cx + p[0] * c - p[2] * s;
        const wz = cz + p[0] * s + p[2] * c;
        arr.push(wx, y + p[1], wz, nx, f.n[1], nz, uv[0], uv[1], type);
      }
    }
  }

  function makeMesh(data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, count: data.length / 9 };
  }
  function disposeMesh(mesh) {
    if (mesh && mesh.buffer) gl.deleteBuffer(mesh.buffer);
  }
  function disposeChunkMesh(ck) {
    const old = chunkMeshes.get(ck);
    if (!old) return;
    disposeMesh(old.opaque);
    disposeMesh(old.water);
    chunkMeshes.delete(ck);
  }
  function buildChunkMesh(cx, cz) {
    const opaque = [], water = [];
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    for (let x = x0; x < x0 + CHUNK_SIZE; x++) {
      for (let z = z0; z < z0 + CHUNK_SIZE; z++) {
        for (let y = 0; y <= MAX_Y + 26; y++) {
          const type = getBlock(x, y, z);
          if (!type) continue;
          const arr = type === BLOCK.WATER ? water : opaque;
          for (const f of faces) {
            const nt = getBlock(x + f.n[0], y + f.n[1], z + f.n[2]);
            if (!neighborHidesFace(type, nt)) pushFace(arr, x, y, z, f, type);
          }
        }
      }
    }
    const ck = chunkKey(cx, cz);
    disposeChunkMesh(ck);
    chunkMeshes.set(ck, { opaque: makeMesh(opaque), water: makeMesh(water) });
  }
  function rebuildMeshes() {
    [...chunkMeshes.keys()].forEach(ck => disposeChunkMesh(ck));
    const opaque = [], water = [];
    // Keep empty global meshes for compatibility; terrain is drawn per chunk.
    disposeMesh(meshes.opaque);
    disposeMesh(meshes.water);
    meshes.opaque = makeMesh(opaque);
    meshes.water = makeMesh(water);
    loadedChunks.forEach(k => {
      const parts = k.split(',');
      buildChunkMesh(+parts[0], +parts[1]);
    });
    worldBlockCount = world.size;
    dirtyChunks.clear();
    fullRebuildQueued = false;
    rebuildQueued = false;
  }
  function markDirtyChunk(cx, cz) {
    if (chunkInWorld(cx, cz) && loadedChunks.has(chunkKey(cx, cz))) dirtyChunks.add(chunkKey(cx, cz));
  }
  function rebuildDirtyChunks() {
    dirtyChunks.forEach(k => {
      const parts = k.split(',');
      buildChunkMesh(+parts[0], +parts[1]);
    });
    worldBlockCount = world.size;
    dirtyChunks.clear();
    rebuildQueued = false;
  }
  function performQueuedRebuild() {
    if (fullRebuildQueued) rebuildMeshes();
    else rebuildDirtyChunks();
  }
  function queueRebuild(x = null, z = null) {
    if (x === null || z === null) {
      fullRebuildQueued = true;
    } else if (!fullRebuildQueued) {
      const cx = chunkCoord(x), cz = chunkCoord(z);
      markDirtyChunk(cx, cz);
      markDirtyChunk(cx - 1, cz);
      markDirtyChunk(cx + 1, cz);
      markDirtyChunk(cx, cz - 1);
      markDirtyChunk(cx, cz + 1);
    }
    if (!rebuildQueued) { rebuildQueued = true; requestAnimationFrame(performQueuedRebuild); }
  }

  function collidesAt(pos) {
    const minX = Math.floor(pos[0] - PLAYER_RADIUS), maxX = Math.floor(pos[0] + PLAYER_RADIUS);
    const minY = Math.floor(pos[1]), maxY = Math.floor(pos[1] + PLAYER_HEIGHT);
    const minZ = Math.floor(pos[2] - PLAYER_RADIUS), maxZ = Math.floor(pos[2] + PLAYER_RADIUS);
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      if (blocksMovement(getBlock(x, y, z))) return true;
    }
    return false;
  }
  function moveAxis(axis, amount) {
    if (amount === 0) return;
    player.pos[axis] += amount;
    if (collidesAt(player.pos)) {
      const dir = Math.sign(amount);
      if (axis === 0) player.pos[axis] = dir > 0 ? Math.floor(player.pos[axis] + PLAYER_RADIUS) - PLAYER_RADIUS - 0.001 : Math.floor(player.pos[axis] - PLAYER_RADIUS + 1) + PLAYER_RADIUS + 0.001;
      if (axis === 1) {
        if (dir < 0) { player.pos[axis] = Math.floor(player.pos[axis]) + 1.001; player.grounded = true; }
        else player.pos[axis] = Math.floor(player.pos[axis] + PLAYER_HEIGHT) - PLAYER_HEIGHT - 0.001;
        player.vel[1] = 0;
      }
      if (axis === 2) player.pos[axis] = dir > 0 ? Math.floor(player.pos[axis] + PLAYER_RADIUS) - PLAYER_RADIUS - 0.001 : Math.floor(player.pos[axis] - PLAYER_RADIUS + 1) + PLAYER_RADIUS + 0.001;
    }
  }

  function updateMovement(dt) {
    const forward = [Math.sin(player.yaw), 0, Math.cos(player.yaw)];
    const right = [Math.cos(player.yaw), 0, -Math.sin(player.yaw)];
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) { mx += forward[0]; mz += forward[2]; }
    if (keys.KeyS || keys.ArrowDown) { mx -= forward[0]; mz -= forward[2]; }
    if (keys.KeyD || keys.ArrowRight) { mx += right[0]; mz += right[2]; }
    if (keys.KeyA || keys.ArrowLeft) { mx -= right[0]; mz -= right[2]; }
    if (touchInput.moveY || touchInput.moveX) {
      mx += forward[0] * touchInput.moveY + right[0] * touchInput.moveX;
      mz += forward[2] * touchInput.moveY + right[2] * touchInput.moveX;
    }
    const len = Math.hypot(mx, mz) || 1; mx /= len; mz /= len;
    const sprint = keys.ShiftLeft || keys.ShiftRight || touchInput.sprint;
    const speed = 5.35 * (sprint ? 1.55 : 1.0);
    player.vel[0] = mx * speed; player.vel[2] = mz * speed;
    player.vel[1] -= 22 * dt;
    if ((keys.Space || touchInput.jump) && player.grounded) { player.vel[1] = 8.2; player.grounded = false; }
    moveAxis(0, player.vel[0] * dt);
    moveAxis(2, player.vel[2] * dt);
    clampToWorld(player.pos);
    player.grounded = false;
    moveAxis(1, player.vel[1] * dt);
    clampToWorld(player.pos);
    ensureChunks();
    if (player.pos[1] < -20) damagePlayer(999);
  }

  function enemySpawnPoint() {
    for (let i = 0; i < 28; i++) {
      const a = seededHash(performance.now() * .001 + i, player.pos[0] + i) * Math.PI * 2;
      const r = 24 + seededHash(player.pos[2] - i * 17, performance.now() * .002) * 38;
      const x = Math.floor(player.pos[0] + Math.cos(a) * r);
      const z = Math.floor(player.pos[2] + Math.sin(a) * r);
      if (!inWorldXZ(x, z)) continue;
      generateChunk(chunkCoord(x), chunkCoord(z));
      const y = topSolidY(x, z) + 1;
      if (y > WATER_LEVEL + 1 && !blocksMovement(getBlock(x, y, z))) return { x: x + .5, y, z: z + .5 };
    }
    return null;
  }
  function spawnEnemy() {
    const p = enemySpawnPoint();
    if (!p) return;
    const big = seededHash(p.x * 9.1, p.z * 3.2) > 0.82;
    const dx = player.pos[0] - p.x, dz = player.pos[2] - p.z;
    enemies.push({ x: p.x, y: p.y, z: p.z, hp: big ? 80 : 48, maxHp: big ? 80 : 48, speed: big ? 2.0 : 2.55, attack: 0, retreat: 0, phase: seededHash(p.x, p.z) * 10, big, face: Math.atan2(dx, -dz) });
  }

  function lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }

  function updateEnemies(dt) {
    nextSpawnTimer -= dt;
    if (nextSpawnTimer <= 0 && enemies.length < ENEMY_CAP) {
      spawnEnemy();
      nextSpawnTimer = 3.0 + Math.random() * 4.2 + Math.min(7, enemies.length * .25);
    }
    for (const e of enemies) {
      e.phase += dt;
      const dx = player.pos[0] - e.x, dz = player.pos[2] - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetFace = Math.atan2(dx, -dz);
      e.face = lerpAngle(e.face ?? targetFace, targetFace, Math.min(1, dt * 9));
      if (dist < 70) {
        const backingOff = e.retreat > 0;
        const step = e.speed * dt * (backingOff ? 1.45 : 1);
        const dir = backingOff ? -1 : 1;
        const nx = e.x + (dx / dist) * step * dir;
        const nz = e.z + (dz / dist) * step * dir;
        const gx = Math.floor(nx), gz = Math.floor(nz);
        const ground = topSolidY(gx, gz);
        if (ground > WATER_LEVEL - 1 && ground < e.y + 2.5) {
          e.x = nx; e.z = nz; e.y += ((ground + 1) - e.y) * Math.min(1, dt * 8);
        }
      }
      e.retreat = Math.max(0, (e.retreat || 0) - dt);
      e.attack -= dt;
      if (dist < (e.big ? 1.75 : 1.58) && Math.abs(player.pos[1] - e.y) < 2.25 && e.attack <= 0) {
        damagePlayer(e.big ? 22 : 14);
        e.attack = e.big ? 1.25 : .9;
        e.retreat = e.big ? .42 : .34;
      }
    }
    enemies = enemies.filter(e => e.hp > 0 && Math.hypot(e.x - player.pos[0], e.z - player.pos[2]) < 130);
  }

  function damagePlayer(amount) {
    if (deathState.active || worldRebuildState.active || player.invuln > 0 || isMenuOpen()) return;
    player.health -= amount;
    player.invuln = .45;
    pulseDamage();
    shakeScreen();
    sound('hurt');
    if (player.health <= 0) beginDeathSequence();
  }
  function beginDeathSequence() {
    if (deathState.active || worldRebuildState.active) return;
    deathState.active = true;
    deathState.timer = 0;
    document.body.classList.add('dead');
    player.health = 0;
    player.vel = [0, 0, 0];
    player.reloading = false;
    player.reloadTimer = 0;
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
    deathFill.style.width = '0%';
    deathOverlay.classList.add('show');
  }
  function updateDeath(dt) {
    deathState.timer += dt;
    const progress = Math.min(1, deathState.timer / deathState.duration);
    deathFill.style.width = (progress * 100).toFixed(1) + '%';
    if (progress >= 1) {
      deathState.active = false;
      deathOverlay.classList.remove('show');
      document.body.classList.remove('dead');
      respawn();
    }
  }
  function respawn() {
    player.deaths++;
    player.health = 100;
    player.mag = MAG_SIZE;
    player.reserve = Math.max(player.reserve, 24);
    player.reloading = false;
    player.reloadTimer = 0;
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
    const sx = 0, sz = 0;
    player.pos = [sx + .5, topSolidY(sx, sz) + 2.2, sz + .5];
    player.vel = [0, 0, 0];
    currentChunkX = 999999;
    currentChunkZ = 999999;
    ensureChunks(true);
    enemies = enemies.filter(e => Math.hypot(e.x - player.pos[0], e.z - player.pos[2]) > 34);
    showToast('Respawned at the old marker. Deaths: ' + player.deaths);
  }

  function startReload() {
    if (deathState.active || worldRebuildState.active) return;
    if (player.reloading || player.mag >= MAG_SIZE || player.reserve <= 0) return;
    player.reloading = true;
    player.reloadTimer = RELOAD_TIME;
    reloadText.textContent = 'Reloading...';
    reloadOverlay.classList.add('show');
    reloadOverlayFill.style.width = '0%';
    sound('reloadStart');
  }
  function finishReload() {
    const need = MAG_SIZE - player.mag;
    const take = Math.min(need, player.reserve);
    player.mag += take;
    player.reserve -= take;
    player.reloading = false;
    player.reloadTimer = 0;
    reloadText.textContent = '';
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
    sound('reloadDone');
  }

  function entityHitAt(px, py, pz) {
    for (const e of enemies) {
      const sx = e.big ? .76 : .58;
      const top = e.y + (e.big ? 2.38 : 2.02);
      const headLine = e.y + (e.big ? 1.42 : 1.26);
      if (Math.abs(px - e.x) < sx && Math.abs(pz - e.z) < sx && py >= e.y && py <= top) return { enemy: e, head: py >= headLine };
    }
    return null;
  }
  function raycastProjectile(maxDist) {
    const e = eyePos();
    const d = lookDir();
    let prevBlock = null;
    for (let t = 0; t <= maxDist; t += 0.065) {
      const px = e[0] + d[0] * t;
      const py = e[1] + d[1] * t;
      const pz = e[2] + d[2] * t;
      const hitEnemy = entityHitAt(px, py, pz);
      if (hitEnemy) return { kind: 'enemy', enemy: hitEnemy.enemy, head: hitEnemy.head, point: [px, py, pz], dist: t };
      const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
      const type = getBlock(bx, by, bz);
      if (type && type !== BLOCK.WATER) return { kind: 'block', x: bx, y: by, z: bz, type, point: [px, py, pz], prev: prevBlock, dist: t };
      prevBlock = { x: bx, y: by, z: bz };
    }
    return { kind: 'miss', point: [e[0] + d[0] * maxDist, e[1] + d[1] * maxDist, e[2] + d[2] * maxDist] };
  }
  function shoot() {
    if (deathState.active) return;
    if (player.reloading) return;
    if (player.mag <= 0) { showToast('Empty. Reload.'); sound('empty'); startReload(); return; }
    player.mag--;
    sound('shoot');
    const hit = raycastProjectile(58);
    if (hit.kind === 'enemy') {
      const damage = hit.head ? hit.enemy.hp : 28;
      hit.enemy.hp -= damage;
      spawnParticles(hit.point[0], hit.point[1], hit.point[2], hit.head ? 12 : 8, hit.head ? 12 : 15);
      sound(hit.head ? 'head' : 'hit');
      if (hit.enemy.hp <= 0) {
        player.kills++;
        if (hit.head) {
          player.score += 150;
          scorePop('+150 HEADSHOT KILL', 'head');
        } else {
          player.score += 100;
          scorePop('+100 ENEMY DOWN', 'kill');
        }
        if (hit.dist >= LONG_RANGE_KILL_DIST) {
          player.score += 200;
          scorePop('+200 LONG RANGE', 'range small');
        }
        const now = performance.now() / 1000;
        if (now - lastKillTime < 2.0) { player.score += 150; scorePop('+150 DOUBLE KILL', 'combo small'); }
        lastKillTime = now;
        sound('kill');
        if (Math.random() < .55) spawnPickupAt(Math.floor(hit.enemy.x), Math.floor(hit.enemy.y), Math.floor(hit.enemy.z));
        showToast('Enemy down. Kills: ' + player.kills);
      }
    } else if (hit.kind === 'block') {
      player.score += 25;
      sound('block');
      if (hit.y > 0 && hit.type !== BLOCK.LAMP) {
        setBlock(hit.x, hit.y, hit.z, 0);
        spawnParticles(hit.point[0], hit.point[1], hit.point[2], 6, 15);
        queueRebuild(hit.x, hit.z);
      } else {
        spawnParticles(hit.point[0], hit.point[1], hit.point[2], 3, 15);
      }
    }
    if (player.mag <= 0 && player.reserve > 0) startReload();
  }

  function spawnParticles(x, y, z, count, type) {
    for (let i = 0; i < count; i++) {
      particles.push({ x, y, z, vx: (Math.random() - .5) * 5, vy: Math.random() * 3.8, vz: (Math.random() - .5) * 5, life: .35 + Math.random() * .35, type });
    }
  }
  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 7 * dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function updatePickups(dt) {
    for (const p of pickups) {
      p.bob += dt * 3.2;
      const dist = Math.hypot(p.x - player.pos[0], p.z - player.pos[2]);
      if (dist < 1.45 && Math.abs(p.y - player.pos[1]) < 2.2) {
        player.reserve += p.amount;
        p.collected = true;
        showToast('Ammo +' + p.amount);
        scorePop('+' + p.amount + ' AMMO PICKUP', 'pickup');
        sound('pickup');
      }
    }
    pickups = pickups.filter(p => !p.collected && Math.hypot(p.x - player.pos[0], p.z - player.pos[2]) < 120);
  }

  function playerInWater() {
    const x = Math.floor(player.pos[0]);
    const z = Math.floor(player.pos[2]);
    const feet = Math.floor(player.pos[1] + 0.08);
    const waist = Math.floor(player.pos[1] + 0.82);
    return getBlock(x, feet, z) === BLOCK.WATER || getBlock(x, waist, z) === BLOCK.WATER;
  }

  function updateWaterHazard(dt) {
    if (!GAME_OPTIONS.dangerousWater || deathState.active || worldRebuildState.active || isMenuOpen()) {
      waterDamageTimer = 0;
      return;
    }
    if (!playerInWater()) {
      waterDamageTimer = 0;
      return;
    }
    waterDamageTimer -= dt;
    if (waterDamageTimer <= 0) {
      damagePlayer(6);
      waterDamageTimer = .75;
    }
  }

  function aimTarget(maxDist) {
    const e = eyePos();
    const d = lookDir();
    for (let t = 0; t <= maxDist; t += 0.09) {
      const px = e[0] + d[0] * t, py = e[1] + d[1] * t, pz = e[2] + d[2] * t;
      const enemy = entityHitAt(px, py, pz);
      if (enemy) return { kind: 'enemy', hp: enemy.enemy.hp, maxHp: enemy.enemy.maxHp, head: enemy.head };
      const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
      const type = getBlock(bx, by, bz);
      if (type && type !== BLOCK.WATER) return { kind: 'block', x: bx, y: by, z: bz, type };
    }
    return null;
  }

  function update(dt) {
    if (worldRebuildState.active) {
      updateWorldRebuild(dt);
      updateHud();
      return;
    }
    if (deathState.active) {
      updateDeath(dt);
      updateHud();
      return;
    }
    if (!locked && menu.style.display !== 'none') {
      updateHud();
      return;
    }
    if (player.invuln > 0) player.invuln -= dt;
    if (player.reloading) {
      player.reloadTimer -= dt;
      reloadText.textContent = 'Reloading ' + Math.max(0, player.reloadTimer).toFixed(1) + 's';
      reloadOverlayFill.style.width = Math.max(0, Math.min(100, (1 - player.reloadTimer / RELOAD_TIME) * 100)) + '%';
      if (player.reloadTimer <= 0) finishReload();
    }
    updateMovement(dt);
    updateWaterHazard(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateParticles(dt);
    lastTarget = aimTarget(42);
    updateHud();
  }

  function blockName(type) {
    if (type === BLOCK.WATER) return 'Water';
    if (type === BLOCK.GRASS) return 'Grass';
    if (type === BLOCK.DIRT) return 'Dirt';
    if (type === BLOCK.STONE) return 'Stone';
    if (type === BLOCK.WOOD) return 'Wood';
    if (type === BLOCK.LEAF) return 'Leaves';
    if (type === BLOCK.SAND) return 'Sand';
    if (type === BLOCK.BRICK) return 'Brick';
    if (type === BLOCK.LAMP) return 'Glow marker';
    return 'Block';
  }
  function updateAmmoDisplay() {
    const bullets = bulletRack.children;
    for (let i = 0; i < MAG_SIZE; i++) {
      bullets[i].classList.toggle('spent', i >= player.mag);
    }
    reserveText.textContent = player.mag + '/' + player.reserve;
    weaponPanel.classList.toggle('reloading', player.reloading);
  }

  function updateHud() {
    const hpNow = Math.max(0, Math.round(player.health));
    healthBigText.textContent = hpNow + '%';
    healthStatus.className = hpNow < 35 ? 'danger' : (hpNow < 65 ? 'warn' : '');
    healthBigFill.style.width = Math.max(0, player.health) + '%';
    updateAmmoDisplay();
  }

  function bindVoxelMesh(mesh) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    const stride = 9 * 4;
    gl.enableVertexAttribArray(loc.pos); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(loc.normal); gl.vertexAttribPointer(loc.normal, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(loc.uv); gl.vertexAttribPointer(loc.uv, 2, gl.FLOAT, false, stride, 6 * 4);
    gl.enableVertexAttribArray(loc.type); gl.vertexAttribPointer(loc.type, 1, gl.FLOAT, false, stride, 8 * 4);
  }
  function drawMesh(mesh) { if (!mesh || mesh.count === 0) return; bindVoxelMesh(mesh); gl.drawArrays(gl.TRIANGLES, 0, mesh.count); }
  function drawWorldMeshes(kind) {
    chunkMeshes.forEach(entry => drawMesh(entry[kind]));
  }

  function buildDynamicMesh(time) {
    const arr = [];
    for (const e of enemies) {
      const scale = e.big ? 1.18 : 1;
      const bob = Math.sin(e.phase * 5) * .05;
      const x = e.x, y = e.y + bob, z = e.z;
      // Rotated block-monster silhouette: it turns as it moves, so the eye face points at you.
      const yaw = e.face ?? Math.atan2(player.pos[0] - e.x, -(player.pos[2] - e.z));
      pushBoxY(arr, x, y, z, -.18*scale, 0, -.18*scale, .22*scale, .45*scale, .22*scale, yaw, 11);
      pushBoxY(arr, x, y, z,  .02*scale, 0, -.18*scale, .22*scale, .45*scale, .22*scale, yaw, 11);
      pushBoxY(arr, x, y, z, -.18*scale, 0,  .02*scale, .22*scale, .45*scale, .22*scale, yaw, 11);
      pushBoxY(arr, x, y, z,  .02*scale, 0,  .02*scale, .22*scale, .45*scale, .22*scale, yaw, 11);
      pushBoxY(arr, x, y, z, -.34*scale, .36*scale, -.24*scale, .68*scale, .95*scale, .48*scale, yaw, 10);
      pushBoxY(arr, x, y, z, -.42*scale, 1.22*scale, -.35*scale, .84*scale, .64*scale, .70*scale, yaw, 10);
      pushBoxY(arr, x, y, z, -.22*scale, 1.48*scale, -.39*scale, .12*scale, .12*scale, .06*scale, yaw, 12);
      pushBoxY(arr, x, y, z,  .10*scale, 1.48*scale, -.39*scale, .12*scale, .12*scale, .06*scale, yaw, 12);
    }
    for (const p of pickups) {
      const y = p.y + Math.sin(p.bob) * .16;
      pushBox(arr, p.x - .32, y, p.z - .32, .64, .38, .64, 13);
      pushBox(arr, p.x - .22, y + .38, p.z - .22, .44, .12, .44, 14);
    }
    for (const p of particles) {
      const s = .07 + p.life * .05;
      pushBox(arr, p.x - s/2, p.y - s/2, p.z - s/2, s, s, s, p.type || 15);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.DYNAMIC_DRAW);
    meshes.dynamic = { buffer: dynamicBuffer, count: arr.length / 9 };
  }

  function cubeOutlineVertices(x, y, z) {
    const e = 0.004;
    const x0 = x - e, y0 = y - e, z0 = z - e, x1 = x + 1 + e, y1 = y + 1 + e, z1 = z + 1 + e;
    return new Float32Array([
      x0,y0,z0, x1,y0,z0,  x1,y0,z0, x1,y0,z1,  x1,y0,z1, x0,y0,z1,  x0,y0,z1, x0,y0,z0,
      x0,y1,z0, x1,y1,z0,  x1,y1,z0, x1,y1,z1,  x1,y1,z1, x0,y1,z1,  x0,y1,z1, x0,y1,z0,
      x0,y0,z0, x0,y1,z0,  x1,y0,z0, x1,y1,z0,  x1,y0,z1, x1,y1,z1,  x0,y0,z1, x0,y1,z1
    ]);
  }
  function drawOutline(mvp) {
    if (!lastTarget || lastTarget.kind !== 'block') return;
    gl.useProgram(lineProgram);
    gl.uniformMatrix4fv(lineLoc.mvp, false, mvp);
    gl.uniform4f(lineLoc.color, 1, 1, 1, 0.75);
    const verts = cubeOutlineVertices(lastTarget.x, lastTarget.y, lastTarget.z);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(lineLoc.pos);
    gl.vertexAttribPointer(lineLoc.pos, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.LINES, 0, verts.length / 3);
  }

  function render(time) {
    resize();
    const cycleAngle = time * 0.035 + 1.15;
    let sunAngle = cycleAngle;
    if (GAME_OPTIONS.timeMode === 'day') sunAngle = Math.PI / 2;
    else if (GAME_OPTIONS.timeMode === 'night') sunAngle = -Math.PI / 2;
    const sunY = Math.sin(sunAngle);
    if (GAME_OPTIONS.timeMode === 'day') dayAmount = 1;
    else if (GAME_OPTIONS.timeMode === 'night') dayAmount = 0;
    else dayAmount = Math.max(0, Math.min(1, (sunY + 0.18) / 0.9));
    const dusk = 1 - Math.abs(dayAmount - 0.45) / 0.45;
    let sky = [
      0.05 + dayAmount * 0.47 + Math.max(0, dusk) * 0.12,
      0.08 + dayAmount * 0.62 + Math.max(0, dusk) * 0.08,
      0.16 + dayAmount * 0.72
    ];
    sky = skyOptionColor(sky);
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    const aspect = canvas.width / canvas.height;
    const proj = mat4Perspective(Math.PI / 3, aspect, 0.06, 170);
    const e = eyePos();
    const d = lookDir();
    const view = mat4LookAt(e, [e[0] + d[0], e[1] + d[1], e[2] + d[2]], [0, 1, 0]);
    const mvp = mat4Mul(proj, view);

    gl.useProgram(voxelProgram);
    gl.uniformMatrix4fv(loc.mvp, false, mvp);
    gl.uniform3f(loc.cam, e[0], e[1], e[2]);
    gl.uniform1f(loc.time, time);
    gl.uniform3f(loc.light, Math.cos(sunAngle) * 0.68, Math.max(-0.18, sunY), Math.sin(sunAngle + 0.7) * 0.68);
    gl.uniform3f(loc.sky, sky[0], sky[1], sky[2]);
    gl.uniform1f(loc.day, dayAmount);
    gl.uniform1f(loc.fog, GAME_OPTIONS.fog ? 1 : 0);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    drawWorldMeshes('opaque');

    buildDynamicMesh(time);
    drawMesh(meshes.dynamic);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    drawWorldMeshes('water');
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    drawOutline(mvp);
  }

  function loop(now) {
    const dt = Math.min(0.04, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    fpsAvg = fpsAvg * 0.92 + (1 / dt) * 0.08;
    frameCounter++;
    update(dt);
    render(now / 1000);
    requestAnimationFrame(loop);
  }

  function generateWorld(seed) {
    currentSeed = seed;
    world = new Map();
    edits = new Map();
    loadedChunks = new Set();
    enemies = [];
    pickups = [];
    particles = [];
    player.health = 100;
    player.mag = MAG_SIZE;
    player.reserve = 36;
    player.kills = 0;
    player.score = 0;
    player.deaths = 0;
    player.reloading = false;
    player.reloadTimer = 0;
    nextSpawnTimer = 3.5;
    lastKillTime = -999;
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
    currentChunkX = 999999;
    currentChunkZ = 999999;
    // Center landmark and starting chunks.
    player.pos = [0.5, 18, 0.5];
    ensureChunks(true);
    for (let y = WATER_LEVEL + 1; y <= WATER_LEVEL + 5; y++) setBlock(2, y, 2, BLOCK.BRICK, true);
    setBlock(2, WATER_LEVEL + 6, 2, BLOCK.LAMP, true);
    player.pos = [0.5, topSolidY(0, 0) + 2.2, 0.5];
    player.vel = [0, 0, 0];
    ensureChunks(true);
    rebuildMeshes();
    showToast('New ZomVox world generated');
  }

  function startGame() {
    applySettings();
    if (soundEnabled) getAudio();
    locked = true;
    menu.style.display = 'none';
    if (touchMode) {
      requestMobileFullscreen();
      return;
    }
    requestPointerLockSafe();
  }
  function requestPointerLockSafe() {
    if (!canvas.requestPointerLock) return;
    try {
      const result = canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (_) {}
  }
  play.addEventListener('click', startGame);
  canvas.addEventListener('click', () => { if (!locked && !touchMode) requestPointerLockSafe(); });
  document.addEventListener('pointerlockchange', () => {
    if (touchMode) return;
    locked = document.pointerLockElement === canvas;
    menu.style.display = locked ? 'none' : 'flex';
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch -= e.movementY * 0.0022;
    const cap = Math.PI / 2 - 0.02;
    player.pitch = Math.max(-cap, Math.min(cap, player.pitch));
  });
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyR' && !e.repeat) startReload();
    if (e.code === 'KeyN' && !e.repeat) beginWorldRebuild(Math.floor(Math.random() * 999999));
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (!locked) { requestPointerLockSafe(); return; }
    if (e.button === 0) shoot();
    if (e.button === 2) startReload();
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function updateStick(clientX, clientY) {
    const r = stickBase.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const max = r.width * .36;
    let dx = clientX - cx, dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    touchInput.moveX = -dx / max;
    touchInput.moveY = -dy / max;
    stickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function resetStick() {
    touchInput.moveX = 0;
    touchInput.moveY = 0;
    touchInput.stickId = null;
    stickKnob.style.transform = 'translate(0, 0)';
  }
  stickBase.addEventListener('pointerdown', (e) => {
    touchMode = true;
    touchInput.stickId = e.pointerId;
    stickBase.setPointerCapture(e.pointerId);
    updateStick(e.clientX, e.clientY);
    e.preventDefault();
  });
  stickBase.addEventListener('pointermove', (e) => {
    if (touchInput.stickId === e.pointerId) updateStick(e.clientX, e.clientY);
  });
  stickBase.addEventListener('pointerup', resetStick);
  stickBase.addEventListener('pointercancel', resetStick);

  function bindTouchButton(btn, down, up) {
    btn.addEventListener('pointerdown', (e) => { touchMode = true; btn.classList.add('active'); down(); btn.setPointerCapture(e.pointerId); e.preventDefault(); });
    const clear = () => { btn.classList.remove('active'); if (up) up(); };
    btn.addEventListener('pointerup', clear);
    btn.addEventListener('pointercancel', clear);
  }
  bindTouchButton(touchShoot, () => shoot());
  bindTouchButton(touchJump, () => { touchInput.jump = true; }, () => { touchInput.jump = false; });
  bindTouchButton(touchSprint, () => { touchInput.sprint = true; }, () => { touchInput.sprint = false; });

  canvas.addEventListener('pointerdown', (e) => {
    if (!touchMode || e.pointerType === 'mouse' || e.target !== canvas) return;
    locked = true;
    menu.style.display = 'none';
    touchInput.lookId = e.pointerId;
    touchInput.lookX = e.clientX;
    touchInput.lookY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (touchInput.lookId !== e.pointerId) return;
    const dx = e.clientX - touchInput.lookX, dy = e.clientY - touchInput.lookY;
    player.yaw -= dx * 0.0052;
    player.pitch -= dy * 0.0052;
    const cap = Math.PI / 2 - 0.02;
    player.pitch = Math.max(-cap, Math.min(cap, player.pitch));
    touchInput.lookX = e.clientX;
    touchInput.lookY = e.clientY;
    e.preventDefault();
  });
  function clearLook(e) {
    if (touchInput.lookId === e.pointerId) touchInput.lookId = null;
  }
  canvas.addEventListener('pointerup', clearLook);
  canvas.addEventListener('pointercancel', clearLook);

  initSettings();
  gl.enable(gl.DEPTH_TEST);
  generateWorld(currentSeed);
  runSplash();
  requestAnimationFrame(loop);
})();
