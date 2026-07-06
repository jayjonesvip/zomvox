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
  const gunSprite = $('gunSprite');
  const damageFlash = $('damageFlash');
  const healthStatus = $('healthStatus');
  const healthBigText = $('healthBigText');
  const healthBigFill = $('healthBigFill');
  const objectiveText = $('objectiveText');
  const objectiveMeta = $('objectiveMeta');
  const disableOverlay = $('disableOverlay');
  const disableFill = $('disableFill');
  const disablePercent = $('disablePercent');
  const objectiveBriefing = $('objectiveBriefing');
  const briefingMeta = $('briefingMeta');
  const briefingObjective = $('briefingObjective');
  const briefingBody = $('briefingBody');
  const briefingOk = $('briefingOk');
  const scoreFeed = $('scoreFeed');
  const reticle = $('reticle');
  const reloadOverlay = $('reloadOverlay');
  const reloadOverlayFill = $('reloadOverlayFill');
  const worldOverlay = $('worldOverlay');
  const worldText = $('worldText');
  const worldFill = $('worldFill');
  const deathOverlay = $('deathOverlay');
  const deathFill = $('deathFill');
  const deathText = $('deathText');
  const deathStats = $('deathStats');
  const deathContinue = $('deathContinue');
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

  const CONFIG = window.ZOMVOX_CONFIG || {};
  function configSection(name) {
    const section = CONFIG[name];
    return section && typeof section === 'object' ? section : {};
  }
  function configNumber(section, key, fallback) {
    const value = section[key];
    return Number.isFinite(value) ? value : fallback;
  }
  function configString(section, key, fallback) {
    const value = section[key];
    return typeof value === 'string' ? value : fallback;
  }
  function configBoolean(section, key, fallback) {
    const value = section[key];
    return typeof value === 'boolean' ? value : fallback;
  }
  function configNumberArray(section, key, fallback) {
    const value = section[key];
    return (Array.isArray(value) ? value : fallback).filter(Number.isFinite).map(v => Math.floor(v));
  }
  const ENV_CONFIG = configSection('environment');
  const WORLD_CONFIG = configSection('world');
  const PLAYER_CONFIG = configSection('player');
  const WEAPON_CONFIG = configSection('weapon');
  const ENEMY_CONFIG = configSection('enemies');
  const MISSION_CONFIG = configSection('mission');
  const PICKUP_CONFIG = configSection('pickups');
  const TIMER_CONFIG = configSection('timers');

  const GAME_OPTIONS = {
    timeMode: configString(ENV_CONFIG, 'timeMode', 'cycle'),
    skyColor: Object.prototype.hasOwnProperty.call(ENV_CONFIG, 'skyColor') ? ENV_CONFIG.skyColor : null,
    dangerousWater: configBoolean(ENV_CONFIG, 'dangerousWater', true),
    fog: configBoolean(ENV_CONFIG, 'fog', true)
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
    LAMP: 9,
    METAL: 14,
    CRACKED_STONE: 22,
    RED_LIGHT: 24
  };

  const CHUNK_SIZE = Math.max(4, Math.floor(configNumber(WORLD_CONFIG, 'chunkSize', 16)));
  const WORLD_CHUNK_RADIUS = Math.max(1, Math.floor(configNumber(WORLD_CONFIG, 'chunkRadius', 3)));
  const WORLD_MIN = -WORLD_CHUNK_RADIUS * CHUNK_SIZE;
  const WORLD_MAX = (WORLD_CHUNK_RADIUS + 1) * CHUNK_SIZE - 1;
  const MAX_Y = Math.max(16, Math.floor(configNumber(WORLD_CONFIG, 'maxY', 46)));
  const WATER_LEVEL = Math.max(1, Math.floor(configNumber(WORLD_CONFIG, 'waterLevel', 8)));
  const PLAYER_HEIGHT = configNumber(PLAYER_CONFIG, 'height', 1.76);
  const PLAYER_RADIUS = configNumber(PLAYER_CONFIG, 'radius', 0.31);
  const STARTING_HEALTH = configNumber(PLAYER_CONFIG, 'startingHealth', 100);
  const STARTING_RESERVE = Math.max(0, Math.floor(configNumber(PLAYER_CONFIG, 'startingReserve', 36)));
  const RESPAWN_RESERVE_FLOOR = Math.max(0, Math.floor(configNumber(PLAYER_CONFIG, 'respawnReserveFloor', 24)));
  const LOW_HEALTH_THRESHOLD = configNumber(PLAYER_CONFIG, 'lowHealthThreshold', 25);
  const MAG_SIZE = Math.max(1, Math.floor(configNumber(WEAPON_CONFIG, 'magSize', 6)));
  const EXTENDED_MAG_SIZE = Math.max(MAG_SIZE, 12);
  const EXTENDED_MAG_KILLS = 25;
  const RELOAD_TIME = Math.max(0.1, configNumber(WEAPON_CONFIG, 'reloadTime', 1.15));
  const ENEMY_CAP = Math.max(1, Math.floor(configNumber(ENEMY_CONFIG, 'baseCap', 18)));
  const HORDE_KILLS_PER_LEVEL = Math.max(1, Math.floor(configNumber(ENEMY_CONFIG, 'hordeKillsPerLevel', 5)));
  const HORDE_CAP_BONUS = Math.max(0, Math.floor(configNumber(ENEMY_CONFIG, 'hordeCapBonus', 2)));
  const TOXIN_DAMAGE_PER_SECOND = Math.max(0, configNumber(MISSION_CONFIG, 'toxinDamagePerSecond', 1.15));
  const MACHINE_DISABLE_SECONDS = Math.max(0.5, configNumber(MISSION_CONFIG, 'disableSeconds', 3));
  const MACHINE_ACTION_RADIUS = Math.max(1.5, configNumber(MISSION_CONFIG, 'machineActionRadius', 3.6));
  const INSERTION_DROP_HEIGHT = Math.max(10, configNumber(MISSION_CONFIG, 'insertionDropHeight', 30));
  const INSERTION_FALL_SPEED = Math.max(2, configNumber(MISSION_CONFIG, 'insertionFallSpeed', 5.8));
  const FIRST_WAVE_SIZE = Math.max(0, Math.floor(configNumber(MISSION_CONFIG, 'firstWaveSize', 3)));
  const INITIAL_SEED = Math.floor(configNumber(CONFIG, 'initialSeed', 729641));
  const CONFIGURED_MISSION_SEEDS = configNumberArray(MISSION_CONFIG, 'islandSeeds', [INITIAL_SEED, 482177, 735331, 918244, 126509]).slice(0, 5);
  const MISSION_SEEDS = CONFIGURED_MISSION_SEEDS.length ? CONFIGURED_MISSION_SEEDS : [INITIAL_SEED];
  const DEFAULT_INFECTED_GOALS = [25, 50, 100, 250, 500];
  const FALLBACK_INFECTED_GOAL = Math.max(1, Math.floor(configNumber(MISSION_CONFIG, 'infectedGoal', 50)));
  const CONFIGURED_INFECTED_GOALS = configNumberArray(MISSION_CONFIG, 'infectedGoals', DEFAULT_INFECTED_GOALS).slice(0, MISSION_SEEDS.length);
  const MISSION_INFECTED_GOALS = MISSION_SEEDS.map((_, i) => Math.max(1, CONFIGURED_INFECTED_GOALS[i] || DEFAULT_INFECTED_GOALS[i] || FALLBACK_INFECTED_GOAL));
  const AMMO_PICKUP_ROUNDS = Math.max(1, Math.floor(configNumber(PICKUP_CONFIG, 'ammoRounds', 6)));
  const HEALTH_PICKUP_AMOUNT = Math.max(1, configNumber(PICKUP_CONFIG, 'healthAmount', 25));
  const MAP_AMMO_PICKUP_CHANCE = Math.max(0, Math.min(1, configNumber(PICKUP_CONFIG, 'mapAmmoChance', 0.28)));
  const MAP_HEALTH_PICKUP_CHANCE = Math.max(0, Math.min(1, configNumber(PICKUP_CONFIG, 'mapHealthChance', 0.10)));
  const ENEMY_HEALTH_DROP_CHANCE = Math.max(0, Math.min(1, configNumber(PICKUP_CONFIG, 'enemyHealthDropChance', 0.12)));
  const ENEMY_ANY_DROP_CHANCE = Math.max(ENEMY_HEALTH_DROP_CHANCE, Math.min(1, configNumber(PICKUP_CONFIG, 'enemyAnyDropChance', 0.55)));
  const LONG_RANGE_KILL_DIST = configNumber(WEAPON_CONFIG, 'longRangeKillDistance', 34);
  const DEATH_READY_DELAY = Math.max(0.1, configNumber(TIMER_CONFIG, 'deathReadyDelay', 1.85));
  const WORLD_REBUILD_DURATION = Math.max(0.25, configNumber(TIMER_CONFIG, 'worldRebuildDuration', 2.35));
  const HEARTBEAT_INTERVAL = Math.max(0.2, configNumber(TIMER_CONFIG, 'heartbeatInterval', 0.95));
  const CYCLE_HALF_DAY_MS = Math.max(1000, configNumber(TIMER_CONFIG, 'cycleHalfDayMs', 360000));
  const PHASE_DROP = 'drop';
  const PHASE_DISABLE_MACHINE = 'disableMachine';
  const PHASE_ZOMBIE_THREAT = 'zombieThreat';

  let currentSeed = MISSION_SEEDS[0] || INITIAL_SEED;
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
    health: STARTING_HEALTH,
    magSize: MAG_SIZE,
    mag: MAG_SIZE,
    reserve: STARTING_RESERVE,
    reloading: false,
    reloadTimer: 0,
    invuln: 0,
    kills: 0,
    headshots: 0,
    lifeKills: 0,
    lifeHeadshots: 0,
    lifeLongestShot: 0,
    lifeStartedAt: performance.now(),
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
  const BUILD_VERSION = configString(CONFIG, 'buildVersion', '2026.07.05.5');
  let lastTarget = null;
  let lastFrame = performance.now();
  const cycleStartedAt = performance.now();
  let fpsAvg = 60;
  let frameCounter = 0;
  let lastKillTime = -999;
  let killComboCount = 0;
  let dayAmount = 1;
  let soundEnabled = true;
  let waterDamageTimer = 0;
  let hordeLevel = 0;
  let heartbeatTimer = 0;
  const deathState = { active: false, timer: 0, duration: DEATH_READY_DELAY, ready: false };
  const worldRebuildState = { active: false, timer: 0, startedAt: 0, duration: WORLD_REBUILD_DURATION, seed: null };
  const mission = {
    phase: PHASE_DROP,
    machine: null,
    supplyCrate: null,
    actionHeld: false,
    disableProgress: 0,
    toxinRemainder: 0,
    smokeTimer: 0,
    commandMessageCooldown: 0,
    firstWaveSpawned: false,
    insertionActive: false,
    insertionTargetY: 0,
    islandIndex: 0,
    objectiveAcknowledged: false,
    hudTitle: '',
    hudMeta: '',
    nextHudTitle: '',
    nextHudMeta: '',
    briefingActive: false,
    pendingBriefing: null,
    briefingAfterOk: null,
    completed: false
  };

  function syncBulletRack(size) {
    while (bulletRack.children.length < size) {
      const b = document.createElement('div');
      b.className = 'bullet';
      bulletRack.appendChild(b);
    }
    while (bulletRack.children.length > size) bulletRack.lastChild.remove();
  }

  function setPlayerMagSize(size, refill = false) {
    player.magSize = Math.max(1, Math.floor(size));
    syncBulletRack(player.magSize);
    if (refill) player.mag = player.magSize;
    else player.mag = Math.min(player.mag, player.magSize);
    const label = weaponPanel.querySelector('.label');
    if (label) label.textContent = 'Block Blaster / ' + player.magSize + '-Round Mag';
    updateAmmoDisplay();
  }

  setPlayerMagSize(MAG_SIZE, true);

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

  function resetLifeStats() {
    player.lifeKills = 0;
    player.lifeHeadshots = 0;
    player.lifeLongestShot = 0;
    player.lifeStartedAt = performance.now();
  }

  function formatLifeStats() {
    const seconds = Math.max(0, Math.floor((performance.now() - player.lifeStartedAt) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remain = String(seconds % 60).padStart(2, '0');
    return [
      ['Kills', player.lifeKills],
      ['Headshots', player.lifeHeadshots],
      ['Longest shot', Math.round(player.lifeLongestShot) + 'm'],
      ['Survived', minutes + ':' + remain]
    ];
  }

  function renderDeathStats() {
    deathStats.innerHTML = formatLifeStats()
      .map(([label, value]) => '<span>' + label + '<br>' + value + '</span>')
      .join('');
  }

  function sound(name) {
    if (!soundEnabled) return;
    window.ZomVoxSound?.play(name);
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
  function pulseHitMarker(kind = 'hit') {
    reticle.classList.remove('hit', 'kill');
    void reticle.offsetWidth;
    reticle.classList.add(kind === 'kill' ? 'kill' : 'hit');
    clearTimeout(pulseHitMarker.timer);
    pulseHitMarker.timer = setTimeout(() => reticle.classList.remove('hit', 'kill'), kind === 'kill' ? 260 : 180);
  }

  function spawnKillBurst(x, y, z, big = false) {
    const count = big ? 28 : 20;
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        z,
        vx: (Math.random() - .5) * 7,
        vy: 1 + Math.random() * 5.4,
        vz: (Math.random() - .5) * 7,
        life: .55 + Math.random() * .45,
        type: i % 3 === 0 ? 12 : 15
      });
    }
  }

  function updateLowHealthFeedback(dt) {
    const low = player.health > 0 && player.health < LOW_HEALTH_THRESHOLD && !deathState.active && !isMenuOpen();
    document.body.classList.toggle('low-health', low);
    if (!low) {
      heartbeatTimer = 0;
      return;
    }
    heartbeatTimer -= dt;
    if (heartbeatTimer <= 0) {
      sound('heartbeat');
      heartbeatTimer = HEARTBEAT_INTERVAL;
    }
  }

  function checkHordeLevel() {
    const next = Math.floor(player.kills / HORDE_KILLS_PER_LEVEL);
    if (next <= hordeLevel) return;
    hordeLevel = next;
    scorePop('HORDE PRESSURE +' + hordeLevel, 'wave');
    sound('wave');
    nextSpawnTimer = Math.min(nextSpawnTimer, .75);
  }

  function isMenuOpen() {
    return menu.style.display !== 'none' || splash.style.display !== 'none' || isBriefingOpen();
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
    window.ZomVoxSound?.setEnabled(soundEnabled);
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

  function currentIslandLabel() {
    return 'Island ' + (mission.islandIndex + 1) + ' / ' + MISSION_SEEDS.length;
  }

  function currentInfectedGoal() {
    return MISSION_INFECTED_GOALS[mission.islandIndex] || MISSION_INFECTED_GOALS[MISSION_INFECTED_GOALS.length - 1] || FALLBACK_INFECTED_GOAL;
  }

  function missionSeedIndex(seed) {
    const idx = MISSION_SEEDS.indexOf(seed);
    return idx >= 0 ? idx : 0;
  }

  function nextMissionSeed() {
    mission.islandIndex = (mission.islandIndex + 1) % MISSION_SEEDS.length;
    return MISSION_SEEDS[mission.islandIndex];
  }

  function isGameLive() {
    return menu.style.display === 'none' && splash.style.display === 'none' && !worldRebuildState.active && !deathState.active;
  }

  function isBriefingOpen() {
    return mission.briefingActive;
  }

  function setHudObjective(title, meta) {
    mission.hudTitle = title;
    mission.hudMeta = meta;
    mission.objectiveAcknowledged = true;
  }

  function queueObjectiveBriefing(briefing) {
    mission.pendingBriefing = briefing;
    mission.objectiveAcknowledged = false;
  }

  function openObjectiveBriefing(briefing = mission.pendingBriefing) {
    if (!briefing || !objectiveBriefing) return;
    mission.pendingBriefing = null;
    mission.briefingActive = true;
    mission.objectiveAcknowledged = false;
    mission.briefingAfterOk = briefing.afterOk || null;
    mission.nextHudTitle = briefing.hudTitle || briefing.title;
    mission.nextHudMeta = briefing.hudMeta || briefing.meta || '';
    briefingMeta.textContent = briefing.meta || currentIslandLabel();
    briefingObjective.textContent = briefing.title;
    briefingBody.textContent = briefing.body;
    objectiveBriefing.classList.add('show');
    document.body.classList.add('briefing-open');
    player.vel = [0, 0, 0];
    mission.actionHeld = false;
    if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
  }

  function acknowledgeObjectiveBriefing() {
    if (!mission.briefingActive) return;
    mission.briefingActive = false;
    objectiveBriefing.classList.remove('show');
    document.body.classList.remove('briefing-open');
    setHudObjective(mission.nextHudTitle || '', mission.nextHudMeta || '');
    const afterOk = mission.briefingAfterOk;
    mission.briefingAfterOk = null;
    if (afterOk) afterOk();
    if (!touchMode && menu.style.display === 'none' && !deathState.active && !worldRebuildState.active) requestPointerLockSafe();
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
      if (isGameLive()) openObjectiveBriefing();
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
    uniform float uLava;
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
      if(t < 7.5) return mix(vec3(0.10, 0.37, 0.70), vec3(0.90, 0.13, 0.04), uLava);
      if(t < 8.5) return vec3(0.62, 0.20, 0.16);
      if(t < 9.5) return vec3(1.00, 0.74, 0.25);
      if(t < 10.5) return vec3(0.14, 0.65, 0.19); /* enemy green */
      if(t < 11.5) return vec3(0.08, 0.36, 0.11); /* enemy dark */
      if(t < 12.5) return vec3(1.00, 0.10, 0.07); /* eyes */
      if(t < 13.5) return vec3(0.88, 0.70, 0.18); /* ammo */
      if(t < 14.5) return vec3(0.86, 0.88, 0.82); /* metal */
      if(t < 15.5) return vec3(1.0, 0.45, 0.18); /* particles */
      if(t < 16.5) return vec3(0.95, 0.96, 0.92); /* health box */
      if(t < 17.5) return vec3(0.92, 0.03, 0.04); /* health cross */
      if(t < 18.5) return vec3(0.21, 0.72, 0.18); /* bright zombie */
      if(t < 19.5) return vec3(0.55, 0.54, 0.10); /* yellow zombie */
      if(t < 20.5) return vec3(1.00, 0.82, 0.10); /* yellow eyes */
      if(t < 21.5) return vec3(0.025, 0.055, 0.025); /* closed eyes */
      if(t < 22.5) return vec3(0.30, 0.32, 0.31); /* cracked stone */
      if(t < 23.5) return vec3(0.38, 0.95, 0.24); /* toxin smoke */
      if(t < 24.5) return vec3(0.90, 0.02, 0.015) * (0.35 + step(0.45, sin(uTime * 6.0)) * 0.75); /* red beacon */
      return vec3(1.0, 0.45, 0.18); /* particles */
    }
    void main(){
      vec3 n = normalize(vNormal);
      vec3 color = baseColor(vType, n);
      float grain = hash(floor(vec2(vWorld.x * 6.0 + vWorld.y * 1.7, vWorld.z * 6.0 - vWorld.y * 2.3)));
      color *= 0.88 + grain * 0.18;
      if(vType > 6.5 && vType < 7.5){
        float ripple = sin((vWorld.x * 2.4 + vWorld.z * 2.1 + uTime * 2.6)) * 0.04;
        color += mix(vec3(0.03, 0.12, 0.18), vec3(0.22, 0.03, 0.0), uLava) + ripple;
      }
      if(vType > 8.5 && vType < 9.5) color += vec3(0.55, 0.38, 0.05);
      if(vType > 11.5 && vType < 12.5) color += vec3(0.70, 0.02, 0.0);
      if(vType > 14.5 && vType < 15.5) color += vec3(0.50, 0.15, 0.04);
      if(vType > 16.5 && vType < 17.5) color += vec3(0.35, 0.0, 0.0);
      if(vType > 19.5 && vType < 20.5) color += vec3(0.55, 0.35, 0.0);
      if(vType > 21.5 && vType < 22.5) color *= 0.70 + step(0.58, hash(floor(vWorld.xz * 3.0 + vWorld.yy))) * 0.42;
      if(vType > 23.5 && vType < 24.5) color += vec3(0.70, 0.0, 0.0) * step(0.45, sin(uTime * 6.0));
      float edge = gridLine(vUv);
      color *= mix(0.58, 1.0, edge);
      float sun = max(dot(n, normalize(uLightDir)), 0.0);
      float skyBounce = max(n.y, 0.0) * mix(0.05, 0.18, uDay);
      float light = mix(0.13, 0.39, uDay) + sun * mix(0.28, 0.70, uDay) + skyBounce;
      if(vType > 8.5 && vType < 9.5) light += 0.65;
      if(vType > 11.5 && vType < 12.5) light += 0.75;
      if(vType > 19.5 && vType < 20.5) light += 0.75;
      if(vType > 23.5 && vType < 24.5) light += 1.05;
      if(vType > 12.5) light += 0.22;
      color *= light;
      if(uFog > 0.5){
        float dist = length(vWorld - uCam);
        float fog = smoothstep(54.0, 128.0, dist);
        color = mix(color, uSky, fog);
      }
      color += vec3(0.03, 0.05, 0.10) * (1.0 - uDay);
      float alpha = (vType > 6.5 && vType < 7.5) ? mix(0.63, 0.72, uLava) : 1.0;
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
    fog: gl.getUniformLocation(voxelProgram, 'uFog'),
    lava: gl.getUniformLocation(voxelProgram, 'uLava')
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

  function pickupAirY(x, z) {
    x = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Math.floor(x)));
    z = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Math.floor(z)));
    let y = topSolidY(x, z) + 1;
    while (y < MAX_Y + 25 && blocksMovement(getBlock(x, y, z))) y++;
    return y;
  }

  function spawnPickupAt(x, _y, z, kind = 'ammo') {
    const px = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Math.floor(x)));
    const pz = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Math.floor(z)));
    const py = pickupAirY(px, pz);
    if (py <= WATER_LEVEL + 1) return;
    pickups.push({
      x: px + .5,
      y: py + .35,
      z: pz + .5,
      kind,
      amount: kind === 'health' ? HEALTH_PICKUP_AMOUNT : AMMO_PICKUP_ROUNDS,
      bob: seededHash(px * 5.1, pz * 9.3) * 10
    });
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
        const lavaShore = GAME_OPTIONS.dangerousWater && beach;
        const topType = lavaShore ? BLOCK.STONE : ((beach || desert) ? BLOCK.SAND : BLOCK.GRASS);
        for (let y = 0; y <= h; y++) {
          let type = BLOCK.STONE;
          if (y === h) type = topType;
          else if (y > h - 4) type = lavaShore ? BLOCK.STONE : ((beach || desert) ? BLOCK.SAND : BLOCK.DIRT);
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
        const rockyShore = GAME_OPTIONS.dangerousWater && h <= WATER_LEVEL + 3;
        const rockNoise = seededHash(x * 4.13 + 15, z * 6.71 - 8);
        if (rockyShore && h > WATER_LEVEL + 1 && rockNoise > 0.935) {
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
    if (gunUnlocked() && seededHash(cx * 20.2 + 19, cz * 17.7 - 3) > 1 - MAP_AMMO_PICKUP_CHANCE) {
      const lx = 3 + Math.floor(seededHash(cx + 77, cz - 42) * 10);
      const lz = 3 + Math.floor(seededHash(cx - 14, cz + 91) * 10);
      const x = x0 + lx, z = z0 + lz, y = terrainHeight(x, z) + 1;
      if (y > WATER_LEVEL + 1) spawnPickupAt(x, y, z);
    }
    if (seededHash(cx * 31.4 - 11, cz * 13.9 + 25) > 1 - MAP_HEALTH_PICKUP_CHANCE) {
      const lx = 3 + Math.floor(seededHash(cx - 121, cz + 38) * 10);
      const lz = 3 + Math.floor(seededHash(cx + 49, cz - 83) * 10);
      const x = x0 + lx, z = z0 + lz, y = terrainHeight(x, z) + 1;
      if (y > WATER_LEVEL + 1) spawnPickupAt(x, y, z, 'health');
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

  function highestMissionPoint() {
    let best = { x: 0, z: 0, h: terrainHeight(0, 0), score: -Infinity };
    for (let x = WORLD_MIN + 4; x <= WORLD_MAX - 4; x++) {
      for (let z = WORLD_MIN + 4; z <= WORLD_MAX - 4; z++) {
        const h = terrainHeight(x, z);
        if (h <= WATER_LEVEL + 3) continue;
        const distanceFromDrop = Math.hypot(x, z);
        if (distanceFromDrop < 15) continue;
        const slope =
          Math.abs(h - terrainHeight(x + 1, z)) +
          Math.abs(h - terrainHeight(x - 1, z)) +
          Math.abs(h - terrainHeight(x, z + 1)) +
          Math.abs(h - terrainHeight(x, z - 1));
        if (slope > 10) continue;
        const score = h * 10 + distanceFromDrop * .06 - slope * 1.4 + seededHash(x * 1.7, z * 2.1);
        if (score > best.score) best = { x, z, h, score };
      }
    }
    return best;
  }

  function clearMissionBuildSpace(cx, baseY, cz) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const x = cx + dx, z = cz + dz;
        for (let y = baseY; y <= baseY + 8; y++) {
          const type = getBlock(x, y, z);
          if (type === BLOCK.WOOD || type === BLOCK.LEAF) setBlock(x, y, z, 0, true);
        }
      }
    }
  }

  function setMachineBlock(x, y, z, type, machineBlocks) {
    setBlock(x, y, z, type, true);
    machineBlocks.push([x, y, z]);
  }

  function placeContaminationMachine() {
    const spot = highestMissionPoint();
    const x = spot.x, z = spot.z, baseY = terrainHeight(x, z) + 1;
    const machineBlocks = [];
    clearMissionBuildSpace(x, baseY, z);
    // Machine placement is intentionally voxel/simple: a low stone footing,
    // stacked metal column, side braces, and one blinking red beacon on top.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        setMachineBlock(x + dx, baseY, z + dz, Math.abs(dx) + Math.abs(dz) > 1 ? BLOCK.STONE : BLOCK.METAL, machineBlocks);
      }
    }
    for (let y = 1; y <= 5; y++) setMachineBlock(x, baseY + y, z, BLOCK.METAL, machineBlocks);
    setMachineBlock(x - 1, baseY + 1, z, BLOCK.METAL, machineBlocks);
    setMachineBlock(x + 1, baseY + 1, z, BLOCK.METAL, machineBlocks);
    setMachineBlock(x, baseY + 1, z - 1, BLOCK.METAL, machineBlocks);
    setMachineBlock(x, baseY + 1, z + 1, BLOCK.METAL, machineBlocks);
    setMachineBlock(x - 1, baseY + 2, z, BLOCK.STONE, machineBlocks);
    setMachineBlock(x + 1, baseY + 2, z, BLOCK.STONE, machineBlocks);
    setMachineBlock(x, baseY + 2, z - 1, BLOCK.STONE, machineBlocks);
    setMachineBlock(x, baseY + 2, z + 1, BLOCK.STONE, machineBlocks);
    setMachineBlock(x, baseY + 6, z, BLOCK.RED_LIGHT, machineBlocks);
    mission.machine = { x: x + .5, y: baseY, z: z + .5, active: true, blocks: machineBlocks };
    mission.supplyCrate = null;
    queueRebuild(x, z);
  }

  function machineDistance() {
    if (!mission.machine) return Infinity;
    const dx = player.pos[0] - mission.machine.x;
    const dz = player.pos[2] - mission.machine.z;
    const dy = Math.abs(player.pos[1] - mission.machine.y);
    return Math.hypot(dx, dz) + Math.max(0, dy - 2) * .35;
  }

  function playerNearMachine() {
    return !!mission.machine && mission.machine.active && machineDistance() <= MACHINE_ACTION_RADIUS;
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

  function startInsertionDrop() {
    const x = Math.floor(player.pos[0]);
    const z = Math.floor(player.pos[2]);
    const groundY = topSolidY(x, z) + 1.001;
    mission.insertionActive = true;
    mission.insertionTargetY = groundY;
    mission.actionHeld = false;
    mission.disableProgress = 0;
    touchInput.moveX = 0;
    touchInput.moveY = 0;
    touchInput.jump = false;
    touchInput.sprint = false;
    player.grounded = false;
    player.vel = [0, -INSERTION_FALL_SPEED * .55, 0];
    player.pos[1] = Math.min(MAX_Y + INSERTION_DROP_HEIGHT, groundY + INSERTION_DROP_HEIGHT);
    scorePop('DROP INBOUND', 'small');
    showToast('Mission Command: insertion started. Look around. Movement unlocks on touchdown.');
  }

  function finishInsertionDrop() {
    if (!mission.insertionActive) return;
    mission.insertionActive = false;
    player.pos[1] = Math.max(player.pos[1], mission.insertionTargetY);
    player.vel = [0, 0, 0];
    player.grounded = true;
    scorePop('TOUCHDOWN', 'pickup small');
    showToast('Boots down. Locate the contamination source.');
  }

  function updateMovement(dt) {
    const forward = [Math.sin(player.yaw), 0, Math.cos(player.yaw)];
    const right = [Math.cos(player.yaw), 0, -Math.sin(player.yaw)];
    let mx = 0, mz = 0;
    const insertion = mission.insertionActive;
    if (!insertion && (keys.KeyW || keys.ArrowUp)) { mx += forward[0]; mz += forward[2]; }
    if (!insertion && (keys.KeyS || keys.ArrowDown)) { mx -= forward[0]; mz -= forward[2]; }
    if (!insertion && (keys.KeyD || keys.ArrowRight)) { mx += right[0]; mz += right[2]; }
    if (!insertion && (keys.KeyA || keys.ArrowLeft)) { mx -= right[0]; mz -= right[2]; }
    if (!insertion && (touchInput.moveY || touchInput.moveX)) {
      mx += forward[0] * touchInput.moveY + right[0] * touchInput.moveX;
      mz += forward[2] * touchInput.moveY + right[2] * touchInput.moveX;
    }
    const movingInput = Math.hypot(mx, mz) > 0.05;
    gunSprite.classList.toggle('moving', movingInput);
    const len = Math.hypot(mx, mz) || 1; mx /= len; mz /= len;
    const sprint = keys.ShiftLeft || keys.ShiftRight || touchInput.sprint;
    const speed = 5.35 * (sprint ? 1.55 : 1.0);
    player.vel[0] = insertion ? 0 : mx * speed;
    player.vel[2] = insertion ? 0 : mz * speed;
    player.vel[1] -= (insertion ? 9 : 22) * dt;
    if (insertion) player.vel[1] = Math.max(player.vel[1], -INSERTION_FALL_SPEED);
    if (!insertion && (keys.Space || touchInput.jump) && player.grounded) { player.vel[1] = 8.2; player.grounded = false; }
    moveAxis(0, player.vel[0] * dt);
    moveAxis(2, player.vel[2] * dt);
    clampToWorld(player.pos);
    player.grounded = false;
    moveAxis(1, player.vel[1] * dt);
    if (insertion && player.grounded) finishInsertionDrop();
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
    const variant = Math.floor(seededHash(p.x * 12.7 - 4, p.z * 8.4 + 6) * 4);
    const dx = player.pos[0] - p.x, dz = player.pos[2] - p.z;
    enemies.push({ x: p.x, y: p.y, z: p.z, hp: big ? 80 : 48, maxHp: big ? 80 : 48, speed: big ? 2.0 : 2.55, attack: 0, retreat: 0, phase: seededHash(p.x, p.z) * 10, blinkSeed: seededHash(p.x * 3.7 + 18, p.z * 5.9 - 22), big, variant, face: Math.atan2(dx, -dz) });
  }

  function lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }

  function updateEnemies(dt) {
    if (!gunUnlocked()) return;
    nextSpawnTimer -= dt;
    const enemyCap = ENEMY_CAP + hordeLevel * HORDE_CAP_BONUS;
    if (nextSpawnTimer <= 0 && enemies.length < enemyCap) {
      spawnEnemy();
      const pressure = Math.min(1.8, hordeLevel * .18);
      nextSpawnTimer = Math.max(.75, 3.0 + Math.random() * 4.2 + Math.min(7, enemies.length * .25) - pressure);
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
        damagePlayer(e.big ? 22 : 14, 'bite');
        e.attack = e.big ? 1.25 : .9;
        e.retreat = e.big ? .42 : .34;
      }
    }
    enemies = enemies.filter(e => e.hp > 0 && Math.hypot(e.x - player.pos[0], e.z - player.pos[2]) < 130);
  }

  function damagePlayer(amount, impactSound = null) {
    if (deathState.active || worldRebuildState.active || player.invuln > 0 || isMenuOpen()) return;
    player.health -= amount;
    player.invuln = .45;
    pulseDamage();
    shakeScreen();
    if (impactSound) sound(impactSound);
    sound('hurt');
    if (player.health <= 0) beginDeathSequence();
  }
  function beginDeathSequence() {
    if (deathState.active || worldRebuildState.active) return;
    deathState.active = true;
    deathState.timer = 0;
    deathState.ready = false;
    if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
    document.body.classList.add('dead');
    document.body.classList.remove('low-health');
    player.health = 0;
    player.vel = [0, 0, 0];
    player.reloading = false;
    player.reloadTimer = 0;
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
    deathText.textContent = 'Final stats';
    renderDeathStats();
    deathFill.style.width = '0%';
    deathOverlay.classList.remove('ready');
    deathOverlay.classList.add('show');
  }
  function updateDeath(dt) {
    deathState.timer += dt;
    const progress = Math.min(1, deathState.timer / deathState.duration);
    deathFill.style.width = (progress * 100).toFixed(1) + '%';
    if (progress >= 1 && !deathState.ready) {
      deathState.ready = true;
      deathText.textContent = 'Click continue to respawn';
      deathOverlay.classList.add('ready');
    }
  }
  function respawn() {
    deathState.active = false;
    deathState.ready = false;
    deathState.timer = 0;
    player.deaths++;
    player.health = STARTING_HEALTH;
    player.mag = player.magSize;
    player.reserve = Math.max(player.reserve, RESPAWN_RESERVE_FLOOR);
    player.reloading = false;
    player.reloadTimer = 0;
    mission.actionHeld = false;
    mission.disableProgress = 0;
    mission.toxinRemainder = 0;
    setWeaponUnlocked(gunUnlocked());
    lastKillTime = -999;
    killComboCount = 0;
    resetLifeStats();
    document.body.classList.remove('dead', 'low-health');
    deathOverlay.classList.remove('show', 'ready');
    deathStats.textContent = '';
    deathText.textContent = 'Respawning...';
    deathFill.style.width = '0%';
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
    if (!gunUnlocked()) return;
    if (deathState.active || worldRebuildState.active) return;
    if (player.reloading || player.mag >= player.magSize || player.reserve <= 0) return;
    player.reloading = true;
    player.reloadTimer = RELOAD_TIME;
    reloadText.textContent = 'Reloading...';
    reloadOverlay.classList.add('show');
    reloadOverlayFill.style.width = '0%';
    sound('reloadStart');
  }
  function finishReload() {
    const need = player.magSize - player.mag;
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
    if (!gunUnlocked()) {
      showToast('Disable the contamination source first.');
      return;
    }
    if (player.reloading) return;
    if (player.mag <= 0) { showToast('Empty. Reload.'); sound('empty'); startReload(); return; }
    player.mag--;
    gunSprite.classList.remove('shooting');
    void gunSprite.offsetWidth;
    gunSprite.classList.add('shooting');
    setTimeout(() => gunSprite.classList.remove('shooting'), 120);
    sound('shoot');
    const hit = raycastProjectile(58);
    if (hit.kind === 'enemy') {
      const wasHeadshot = hit.head;
      const damage = wasHeadshot ? hit.enemy.hp : 28;
      hit.enemy.hp -= damage;
      spawnParticles(hit.point[0], hit.point[1], hit.point[2], wasHeadshot ? 12 : 8, wasHeadshot ? 12 : 15);
      sound(wasHeadshot ? 'head' : 'hit');
      if (wasHeadshot) {
        player.headshots++;
        player.lifeHeadshots++;
      }
      if (hit.enemy.hp <= 0) {
        player.kills++;
        player.lifeKills++;
        player.lifeLongestShot = Math.max(player.lifeLongestShot, hit.dist);
        pulseHitMarker('kill');
        spawnKillBurst(hit.enemy.x, hit.enemy.y + 1.1, hit.enemy.z, hit.enemy.big);
        if (wasHeadshot) {
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
        killComboCount = now - lastKillTime < 2.0 ? killComboCount + 1 : 1;
        if (killComboCount === 2) {
          player.score += 150;
          scorePop('+150 DOUBLE KILL', 'combo small');
        } else if (killComboCount === 3) {
          player.score += 300;
          scorePop('+300 TRIPLE KILL', 'combo');
        }
        lastKillTime = now;
        if (player.kills >= EXTENDED_MAG_KILLS && player.magSize < EXTENDED_MAG_SIZE) {
          setPlayerMagSize(EXTENDED_MAG_SIZE, true);
          scorePop('EXTENDED MAG UNLOCKED', 'wave');
          showToast('Extended mag unlocked: ' + EXTENDED_MAG_SIZE + ' rounds');
        }
        sound('kill');
        checkHordeLevel();
        const dropRoll = Math.random();
        if (dropRoll < ENEMY_HEALTH_DROP_CHANCE) spawnPickupAt(Math.floor(hit.enemy.x), Math.floor(hit.enemy.y), Math.floor(hit.enemy.z), 'health');
        else if (dropRoll < ENEMY_ANY_DROP_CHANCE) spawnPickupAt(Math.floor(hit.enemy.x), Math.floor(hit.enemy.y), Math.floor(hit.enemy.z));
        showToast('Enemy down. Kills: ' + player.kills);
        checkMissionCompletion();
      } else {
        pulseHitMarker('hit');
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
      if (p.vx || p.vy || p.vz) {
        p.x += (p.vx || 0) * dt;
        p.y += (p.vy || 0) * dt;
        p.z += (p.vz || 0) * dt;
        p.vy = (p.vy || 0) - 12 * dt;
        p.vx = (p.vx || 0) * Math.max(0, 1 - dt * 1.9);
        p.vz = (p.vz || 0) * Math.max(0, 1 - dt * 1.9);
        const floor = pickupAirY(p.x, p.z) + .35;
        if (p.y <= floor) {
          p.y = floor;
          p.vx = 0;
          p.vy = 0;
          p.vz = 0;
        }
      }
      p.bob += dt * 3.2;
      const dist = Math.hypot(p.x - player.pos[0], p.z - player.pos[2]);
      if (dist < 1.45 && Math.abs(p.y - player.pos[1]) < 2.2) {
        if (p.kind === 'health') {
          if (player.health >= STARTING_HEALTH) continue;
          const healed = Math.min(p.amount, STARTING_HEALTH - player.health);
          player.health += healed;
          p.collected = true;
          showToast('Health +' + Math.round(healed));
          scorePop('+' + Math.round(healed) + ' HEALTH', 'pickup');
          sound('pickupHealth');
          spawnParticles(p.x, p.y + .3, p.z, 10, 17);
        } else {
          player.reserve += p.amount;
          p.collected = true;
          showToast('Ammo +' + p.amount);
          scorePop('+' + p.amount + ' AMMO PICKUP', 'pickup');
          sound('pickupAmmo');
        }
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

  function gunUnlocked() {
    return mission.phase === PHASE_ZOMBIE_THREAT;
  }

  function setWeaponUnlocked(unlocked) {
    document.body.classList.toggle('no-gun', !unlocked);
    document.body.classList.toggle('action-mode', !unlocked);
    if (touchShoot) {
      touchShoot.textContent = '';
      touchShoot.setAttribute('aria-label', unlocked ? 'Shoot' : 'Action');
    }
    if (unlocked) {
      player.mag = player.magSize;
      player.reserve = Math.max(player.reserve, STARTING_RESERVE);
      updateAmmoDisplay();
    } else {
      player.reloading = false;
      player.reloadTimer = 0;
      reloadOverlay.classList.remove('show');
      reloadOverlayFill.style.width = '0%';
    }
  }

  function updateActionButtonState() {
    if (!touchShoot) return;
    const unlocked = gunUnlocked();
    const ready = !mission.insertionActive && (unlocked || playerNearMachine());
    touchShoot.classList.toggle('unavailable', !ready);
    touchShoot.setAttribute('aria-disabled', ready ? 'false' : 'true');
  }

  function missionCommandNothingHere() {
    if (mission.commandMessageCooldown > 0) return;
    mission.commandMessageCooldown = 2.1;
    scorePop('MISSION COMMAND', 'small');
    showToast('Mission Command: nothing to do here. Find the source of the toxin.');
  }

  function beginMissionAction() {
    if (mission.insertionActive) return;
    if (gunUnlocked()) {
      shoot();
      return;
    }
    if (playerNearMachine()) {
      mission.actionHeld = true;
      return;
    }
    missionCommandNothingHere();
  }

  function spawnInitialWave() {
    if (mission.firstWaveSpawned) return;
    mission.firstWaveSpawned = true;
    for (let i = 0; i < FIRST_WAVE_SIZE; i++) spawnEnemy();
    nextSpawnTimer = 4.5;
  }

  function completeMissionIsland() {
    if (mission.completed) return;
    mission.completed = true;
    mission.actionHeld = false;
    nextSpawnTimer = 999;
    openObjectiveBriefing({
      title: 'Island contained',
      meta: currentIslandLabel() + ' // Mission Complete',
      body: 'Mission Command: infected count cleared. Extraction route is hot. Confirm redeploy and we will drop you onto the next contaminated island.',
      hudTitle: 'Island breach contained',
      hudMeta: 'Redeploying',
      afterOk: () => beginWorldRebuild(nextMissionSeed())
    });
    scorePop('MISSION COMPLETE', 'wave');
    sound('wave');
  }

  function checkMissionCompletion() {
    if (mission.phase === PHASE_ZOMBIE_THREAT && player.kills >= currentInfectedGoal()) completeMissionIsland();
  }

  function spawnSupplyCrate() {
    if (!mission.machine) return;
    const x = Math.floor(mission.machine.x), z = Math.floor(mission.machine.z);
    mission.supplyCrate = { x: x + .5, y: pickupAirY(x, z), z: z + .5, looted: false };
  }

  function burstSupplyCrate() {
    const c = mission.supplyCrate;
    if (!c || c.looted) return;
    c.looted = true;
    mission.supplyCrate = null;
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18;
      particles.push({
        x: c.x,
        y: c.y + .45,
        z: c.z,
        vx: Math.cos(angle) * (1.6 + Math.random() * 2.4),
        vy: 1.6 + Math.random() * 3.2,
        vz: Math.sin(angle) * (1.6 + Math.random() * 2.4),
        life: .42 + Math.random() * .35,
        type: i % 3 === 0 ? 14 : 4
      });
    }
    for (let i = 0; i < 4; i++) {
      const angle = -Math.PI * .75 + i * (Math.PI * .5);
      spawnThrownPickup(c.x, c.y + .75, c.z, i < 2 ? 'health' : 'ammo', angle, 3.7 + i * .35);
    }
    scorePop('SUPPLY CRATE OPENED', 'pickup small');
    showToast('Crate popped: 2 health, 2 ammo.');
    sound('pickup');
  }

  function updateSupplyCrate() {
    const c = mission.supplyCrate;
    if (!c) return;
    if (Math.hypot(c.x - player.pos[0], c.z - player.pos[2]) < 2.05 && Math.abs(c.y - player.pos[1]) < 2.4) burstSupplyCrate();
  }

  function explodeMachine() {
    if (!mission.machine) return;
    const m = mission.machine;
    for (let i = 0; i < 42; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.2 + Math.random() * 7.4;
      particles.push({
        x: m.x,
        y: m.y + 2.4 + Math.random() * 2.4,
        z: m.z,
        vx: Math.cos(angle) * speed,
        vy: 2.2 + Math.random() * 6.8,
        vz: Math.sin(angle) * speed,
        life: .45 + Math.random() * .7,
        type: i % 4 === 0 ? 17 : (i % 3 === 0 ? 14 : 15)
      });
    }
    const dx = player.pos[0] - m.x;
    const dz = player.pos[2] - m.z;
    const dist = Math.max(.001, Math.hypot(dx, dz));
    const force = Math.max(4.2, 11 - dist * .85);
    player.vel[0] += (dx / dist) * force;
    player.vel[2] += (dz / dist) * force;
    player.vel[1] = Math.max(player.vel[1], 5.3);
    shakeScreen();
    sound('block');
  }

  function disableMachine() {
    if (!mission.machine || !mission.machine.active) return;
    const infectedGoal = currentInfectedGoal();
    mission.machine.active = false;
    mission.disableProgress = 0;
    mission.actionHeld = false;
    disableOverlay.classList.remove('show');
    // Gun unlock happens only after shutdown: the spire detonates, its blocks
    // are cleared, a supply crate takes its footprint, and zombie spawning begins.
    explodeMachine();
    for (const b of mission.machine.blocks) setBlock(b[0], b[1], b[2], 0, true);
    queueRebuild(Math.floor(mission.machine.x), Math.floor(mission.machine.z));
    spawnSupplyCrate();
    mission.phase = PHASE_ZOMBIE_THREAT;
    setWeaponUnlocked(true);
    scorePop('CONTAMINATION SOURCE DISABLED', 'wave');
    openObjectiveBriefing({
      title: 'Eliminate infected: 0 / ' + infectedGoal,
      meta: currentIslandLabel() + ' // Mission Updated',
      body: 'Mission Command: source disabled. Supply crate deployed at the spire footprint. Open it, arm up, and eliminate ' + infectedGoal + ' infected before redeploy.',
      hudTitle: 'Eliminate infected',
      hudMeta: 'Gun online',
      afterOk: () => {
        scorePop('MISSION UPDATED: ELIMINATE ' + infectedGoal + ' INFECTED', 'wave small');
        spawnInitialWave();
      }
    });
    showToast('Mission Command: source disabled. New orders incoming.');
    sound('wave');
  }

  function updateToxinDamage(dt) {
    if (!mission.machine || !mission.machine.active || mission.insertionActive || deathState.active || worldRebuildState.active || isMenuOpen()) {
      mission.toxinRemainder = 0;
      return;
    }
    // Toxin damage is a slow environmental drain during the opening drop,
    // separate from bite/lava hits so it does not constantly restart invuln.
    mission.toxinRemainder += TOXIN_DAMAGE_PER_SECOND * dt;
    if (mission.toxinRemainder < 1) return;
    const amount = Math.floor(mission.toxinRemainder);
    mission.toxinRemainder -= amount;
    player.health -= amount;
    if (amount > 0) pulseDamage();
    if (player.health <= 0) beginDeathSequence();
  }

  function updateMachineSmoke(dt) {
    if (!mission.machine || !mission.machine.active || isMenuOpen() || deathState.active) return;
    mission.smokeTimer -= dt;
    if (mission.smokeTimer > 0) return;
    mission.smokeTimer = .12;
    const jitterX = (Math.random() - .5) * .9;
    const jitterZ = (Math.random() - .5) * .9;
    particles.push({
      x: mission.machine.x + jitterX,
      y: mission.machine.y + 6.7,
      z: mission.machine.z + jitterZ,
      vx: (Math.random() - .5) * .7,
      vy: 1.6 + Math.random() * .9,
      vz: (Math.random() - .5) * .7,
      life: .75 + Math.random() * .55,
      type: 23
    });
  }

  function spawnThrownPickup(x, y, z, kind, angle, force = 4.2) {
    pickups.push({
      x,
      y,
      z,
      vx: Math.cos(angle) * force,
      vy: 4.2 + seededHash(x * 4.2, z * 7.1) * 1.8,
      vz: Math.sin(angle) * force,
      kind,
      amount: kind === 'health' ? HEALTH_PICKUP_AMOUNT : AMMO_PICKUP_ROUNDS,
      bob: seededHash(x * 5.1, z * 9.3) * 10
    });
  }

  function updateDisableInteraction(dt) {
    if (!mission.machine || !mission.machine.active) {
      disableOverlay.classList.remove('show');
      return;
    }
    const near = playerNearMachine();
    mission.phase = near ? PHASE_DISABLE_MACHINE : PHASE_DROP;
    // Disable interaction requires a held action. Releasing or stepping away
    // resets the meter so the player has a clear committed shutdown moment.
    if (near && (keys.KeyE || mission.actionHeld)) {
      mission.disableProgress = Math.min(1, mission.disableProgress + dt / MACHINE_DISABLE_SECONDS);
      disableOverlay.classList.add('show');
      disableFill.style.width = (mission.disableProgress * 100).toFixed(1) + '%';
      disablePercent.textContent = Math.floor(mission.disableProgress * 100) + '%';
      if (mission.disableProgress >= 1) disableMachine();
      return;
    }
    mission.disableProgress = 0;
    disableFill.style.width = '0%';
    disablePercent.textContent = '0%';
    disableOverlay.classList.remove('show');
  }

  function updateMissionHud() {
    if (!objectiveText || !objectiveMeta) return;
    if (!mission.objectiveAcknowledged) {
      objectiveText.textContent = '[ orders ]';
      objectiveMeta.textContent = currentIslandLabel();
      return;
    }
    if (mission.insertionActive) {
      objectiveText.textContent = '[ dropping ]';
      objectiveMeta.textContent = 'Insertion active';
      return;
    }
    if (mission.phase === PHASE_ZOMBIE_THREAT) {
      const infectedGoal = currentInfectedGoal();
      objectiveText.textContent = '[ ' + Math.min(player.kills, infectedGoal) + '/' + infectedGoal + ' cleared ]';
      objectiveMeta.textContent = mission.completed ? 'Island breach contained' : (mission.hudMeta || 'Gun online');
      return;
    }
    objectiveText.textContent = playerNearMachine() ? '[ hold action ]' : '[ locate source ]';
    objectiveMeta.textContent = playerNearMachine()
      ? (touchMode ? 'Hold ACTION to disable' : 'Hold E to disable')
      : (mission.hudMeta || 'Toxin exposure active');
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
    if (isBriefingOpen()) {
      updateHud();
      updateParticles(dt);
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
    if (mission.commandMessageCooldown > 0) mission.commandMessageCooldown -= dt;
    if (player.reloading) {
      player.reloadTimer -= dt;
      reloadText.textContent = 'Reloading ' + Math.max(0, player.reloadTimer).toFixed(1) + 's';
      reloadOverlayFill.style.width = Math.max(0, Math.min(100, (1 - player.reloadTimer / RELOAD_TIME) * 100)) + '%';
      if (player.reloadTimer <= 0) finishReload();
    }
    updateMovement(dt);
    updateDisableInteraction(dt);
    updateToxinDamage(dt);
    updateWaterHazard(dt);
    updateLowHealthFeedback(dt);
    updateEnemies(dt);
    updateSupplyCrate();
    updatePickups(dt);
    updateMachineSmoke(dt);
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
    if (type === BLOCK.METAL) return 'Metal';
    if (type === BLOCK.CRACKED_STONE) return 'Cracked stone';
    if (type === BLOCK.RED_LIGHT) return 'Red beacon';
    return 'Block';
  }
  function updateAmmoDisplay() {
    const bullets = bulletRack.children;
    for (let i = 0; i < player.magSize; i++) {
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
    updateMissionHud();
    updateActionButtonState();
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

  function pushHealthPickup(arr, p, y) {
    const cx = p.x, cz = p.z, red = 17, t = .032;
    pushBox(arr, cx - .32, y, cz - .32, .64, .46, .64, 16);
    pushBox(arr, cx - .20, y + .18, cz - .356, .40, .10, t, red);
    pushBox(arr, cx - .05, y + .05, cz - .358, .10, .36, t, red);
    pushBox(arr, cx - .20, y + .18, cz + .324, .40, .10, t, red);
    pushBox(arr, cx - .05, y + .05, cz + .326, .10, .36, t, red);
    pushBox(arr, cx - .356, y + .18, cz - .20, t, .10, .40, red);
    pushBox(arr, cx - .358, y + .05, cz - .05, t, .36, .10, red);
    pushBox(arr, cx + .324, y + .18, cz - .20, t, .10, .40, red);
    pushBox(arr, cx + .326, y + .05, cz - .05, t, .36, .10, red);
    pushBox(arr, cx - .20, y + .462, cz - .05, .40, t, .10, red);
    pushBox(arr, cx - .05, y + .464, cz - .20, .10, t, .40, red);
    pushBox(arr, cx - .20, y - .034, cz - .05, .40, t, .10, red);
    pushBox(arr, cx - .05, y - .036, cz - .20, .10, t, .40, red);
  }

  function buildDynamicMesh(time) {
    const arr = [];
    for (const e of enemies) {
      const scale = e.big ? 1.18 : 1;
      const bob = Math.sin(e.phase * 5) * .05;
      const x = e.x, y = e.y + bob, z = e.z;
      // Rotated block-monster silhouette: it turns as it moves, so the eye face points at you.
      const yaw = e.face ?? Math.atan2(player.pos[0] - e.x, -(player.pos[2] - e.z));
      const variant = e.variant || 0;
      const bodyType = variant === 1 ? 18 : (variant === 2 ? 19 : 10);
      const limbType = variant === 2 ? 19 : (variant === 3 ? 18 : 11);
      const blinkCycle = 2.7 + (e.blinkSeed || 0) * 2.2;
      const blinkPhase = (time + (e.blinkSeed || 0) * 9.0) % blinkCycle;
      const doubleBlink = (e.blinkSeed || 0) > .68 && blinkPhase > .20 && blinkPhase < .30;
      const blinking = blinkPhase < .10 || doubleBlink;
      const eyeType = blinking ? 21 : (variant === 3 ? 20 : 12);
      pushBoxY(arr, x, y, z, -.18*scale, 0, -.18*scale, .22*scale, .45*scale, .22*scale, yaw, limbType);
      pushBoxY(arr, x, y, z,  .02*scale, 0, -.18*scale, .22*scale, .45*scale, .22*scale, yaw, limbType);
      pushBoxY(arr, x, y, z, -.18*scale, 0,  .02*scale, .22*scale, .45*scale, .22*scale, yaw, limbType);
      pushBoxY(arr, x, y, z,  .02*scale, 0,  .02*scale, .22*scale, .45*scale, .22*scale, yaw, limbType);
      pushBoxY(arr, x, y, z, -.34*scale, .36*scale, -.24*scale, .68*scale, .95*scale, .48*scale, yaw, bodyType);
      pushBoxY(arr, x, y, z, -.42*scale, 1.22*scale, -.35*scale, .84*scale, .64*scale, .70*scale, yaw, bodyType);
      pushBoxY(arr, x, y, z, -.22*scale, 1.48*scale, -.39*scale, .12*scale, .12*scale, .06*scale, yaw, eyeType);
      pushBoxY(arr, x, y, z,  .10*scale, 1.48*scale, -.39*scale, .12*scale, .12*scale, .06*scale, yaw, eyeType);
    }
    for (const p of pickups) {
      const y = p.y + Math.sin(p.bob) * .16;
      if (p.kind === 'health') {
        pushHealthPickup(arr, p, y);
      } else {
        pushBox(arr, p.x - .32, y, p.z - .32, .64, .38, .64, 13);
        pushBox(arr, p.x - .22, y + .38, p.z - .22, .44, .12, .44, 14);
      }
    }
    if (mission.supplyCrate) {
      const c = mission.supplyCrate;
      const lidBob = Math.sin(time * 2.5) * .025;
      pushBox(arr, c.x - .52, c.y, c.z - .52, 1.04, .46, 1.04, 4);
      pushBox(arr, c.x - .56, c.y + .13, c.z - .12, 1.12, .12, .24, 14);
      pushBox(arr, c.x - .12, c.y + .13, c.z - .56, .24, .12, 1.12, 14);
      pushBox(arr, c.x - .48, c.y + .46 + lidBob, c.z - .48, .96, .12, .96, 4);
      pushBox(arr, c.x - .50, c.y + .50 + lidBob, c.z - .08, 1.00, .08, .16, 14);
      pushBox(arr, c.x - .08, c.y + .50 + lidBob, c.z - .50, .16, .08, 1.00, 14);
      pushBox(arr, c.x - .12, c.y + .60, c.z - .53, .24, .10, .035, 9);
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
    const cycleLengthMs = CYCLE_HALF_DAY_MS * 2;
    const cyclePhase = ((performance.now() - cycleStartedAt) % cycleLengthMs) / cycleLengthMs;
    const cycleAngle = cyclePhase * Math.PI * 2;
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
    gl.uniform1f(loc.lava, GAME_OPTIONS.dangerousWater ? 1 : 0);
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
    mission.islandIndex = missionSeedIndex(seed);
    world = new Map();
    edits = new Map();
    loadedChunks = new Set();
    enemies = [];
    pickups = [];
    particles = [];
    player.health = STARTING_HEALTH;
    player.reserve = STARTING_RESERVE;
    setPlayerMagSize(MAG_SIZE, true);
    player.kills = 0;
    player.headshots = 0;
    player.score = 0;
    player.deaths = 0;
    player.reloading = false;
    player.reloadTimer = 0;
    mission.phase = PHASE_DROP;
    mission.machine = null;
    mission.supplyCrate = null;
    mission.actionHeld = false;
    mission.disableProgress = 0;
    mission.toxinRemainder = 0;
    mission.smokeTimer = 0;
    mission.commandMessageCooldown = 0;
    mission.firstWaveSpawned = false;
    mission.insertionActive = false;
    mission.insertionTargetY = 0;
    mission.objectiveAcknowledged = false;
    mission.hudTitle = '';
    mission.hudMeta = '';
    mission.nextHudTitle = '';
    mission.nextHudMeta = '';
    mission.briefingActive = false;
    mission.briefingAfterOk = null;
    mission.completed = false;
    resetLifeStats();
    nextSpawnTimer = 3.5;
    hordeLevel = 0;
    heartbeatTimer = 0;
    lastKillTime = -999;
    killComboCount = 0;
    deathState.active = false;
    deathState.ready = false;
    deathState.timer = 0;
    document.body.classList.remove('dead', 'low-health');
    deathOverlay.classList.remove('show', 'ready');
    deathStats.textContent = '';
    deathText.textContent = 'Respawning...';
    deathFill.style.width = '0%';
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
    disableOverlay.classList.remove('show');
    disableFill.style.width = '0%';
    disablePercent.textContent = '0%';
    setWeaponUnlocked(false);
    currentChunkX = 999999;
    currentChunkZ = 999999;
    // Center landmark and starting chunks.
    player.pos = [0.5, 18, 0.5];
    ensureChunks(true);
    for (let y = WATER_LEVEL + 1; y <= WATER_LEVEL + 5; y++) setBlock(2, y, 2, BLOCK.BRICK, true);
    setBlock(2, WATER_LEVEL + 6, 2, BLOCK.LAMP, true);
    placeContaminationMachine();
    player.pos = [0.5, topSolidY(0, 0) + 2.2, 0.5];
    player.vel = [0, 0, 0];
    ensureChunks(true);
    rebuildMeshes();
    queueObjectiveBriefing({
      title: 'Locate the contamination source',
      meta: currentIslandLabel() + ' // Drop Phase',
      body: 'Mission Command: toxin readings are climbing. You are unarmed until the source is shut down. Find the blinking metal spire on the high ground and hold action to disable it.',
      hudTitle: 'Locate the contamination source',
      hudMeta: 'Toxin exposure active',
      afterOk: startInsertionDrop
    });
    showToast('New ZomVox world generated');
  }

  function startGame() {
    applySettings();
    if (soundEnabled) window.ZomVoxSound?.prime();
    menu.style.display = 'none';
    if (touchMode) requestMobileFullscreen();
    if (mission.pendingBriefing) {
      locked = touchMode;
      openObjectiveBriefing();
      return;
    }
    locked = true;
    if (touchMode) {
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
  function continueFromDeath() {
    if (!deathState.active || !deathState.ready) return;
    respawn();
  }
  play.addEventListener('click', startGame);
  briefingOk.addEventListener('click', acknowledgeObjectiveBriefing);
  deathContinue.addEventListener('click', continueFromDeath);
  canvas.addEventListener('click', () => {
    if (deathState.active) {
      continueFromDeath();
      return;
    }
    if (!locked && !touchMode) requestPointerLockSafe();
  });
  document.addEventListener('pointerlockchange', () => {
    if (touchMode) return;
    locked = document.pointerLockElement === canvas;
    menu.style.display = locked || deathState.active || isBriefingOpen() ? 'none' : 'flex';
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch -= e.movementY * 0.0022;
    const cap = Math.PI / 2 - 0.02;
    player.pitch = Math.max(-cap, Math.min(cap, player.pitch));
  });
  document.addEventListener('keydown', (e) => {
    if (isBriefingOpen() && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      acknowledgeObjectiveBriefing();
      return;
    }
    keys[e.code] = true;
    if (e.code === 'KeyE' && !e.repeat && !gunUnlocked() && !playerNearMachine()) missionCommandNothingHere();
    if (e.code === 'KeyR' && !e.repeat) startReload();
    if (e.code === 'KeyN' && !e.repeat) beginWorldRebuild(nextMissionSeed());
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
  canvas.addEventListener('mousedown', (e) => {
    if (deathState.active) {
      continueFromDeath();
      return;
    }
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
  bindTouchButton(touchShoot, () => {
    beginMissionAction();
  }, () => { mission.actionHeld = false; });
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
