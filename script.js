(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, powerPreference: 'high-performance' });
  if (!gl) {
    document.body.innerHTML = '<div style="padding:30px;font-family:Orbitron,sans-serif">WebGL is not available in this browser.</div>';
    return;
  }

  const $ = (id) => document.getElementById(id);
  const weaponPanel = $('weaponPanel');
  const bulletRack = $('bulletRack');
  const clipText = $('clipText');
  const reserveText = $('reserveText');
  const c4Hud = $('c4Hud');
  const c4HudCount = $('c4HudCount');
  const menu = $('menu');
  const mainMenuCard = $('mainMenuCard');
  const play = $('play');
  const controlsButton = $('controlsButton');
  const controlsModal = $('controlsModal');
  const controlsClose = $('controlsClose');
  const settingsGear = $('settingsGear');
  const settingsModal = $('settingsModal');
  const settingsClose = $('settingsClose');
  const portraitInstallCallout = $('portraitInstallCallout');
  const toast = $('toast');
  const gunSprite = $('gunSprite');
  const muzzleFx = $('muzzleFx');
  const crosshairFlash = $('crosshairFlash');
  const damageFlash = $('damageFlash');
  const healthStatus = $('healthStatus');
  const healthBigText = $('healthBigText');
  const healthBigFill = $('healthBigFill');
  const fieldSignal = $('fieldSignal');
  const fieldStatusText = $('fieldStatusText');
  const objectiveText = $('objectiveText');
  const objectiveMeta = $('objectiveMeta');
  const killHud = $('killHud');
  const killHudCount = $('killHudCount');
  const commandBanner = $('commandBanner');
  const commandBannerTitle = $('commandBannerTitle');
  const commandBannerBody = $('commandBannerBody');
  const radioComms = $('radioComms');
  const radioCommsText = $('radioCommsText');
  const huntDecisionOverlay = $('huntDecisionOverlay');
  const huntAccept = $('huntAccept');
  const huntDecline = $('huntDecline');
  const disableOverlay = $('disableOverlay');
  const disableTitle = disableOverlay ? disableOverlay.querySelector('.disableTitle') : null;
  const disableFill = $('disableFill');
  const disablePercent = $('disablePercent');
  const objectiveBriefing = $('objectiveBriefing');
  const briefingMeta = $('briefingMeta');
  const briefingObjective = $('briefingObjective');
  const briefingBody = $('briefingBody');
  const briefingShare = $('briefingShare');
  const briefingShareStats = $('briefingShareStats');
  const briefingShareButton = $('briefingShareButton');
  const briefingOk = $('briefingOk');
  const upgradeOverlay = $('upgradeOverlay');
  const upgradeMeta = $('upgradeMeta');
  const upgradeTitle = $('upgradeTitle');
  const upgradeBody = $('upgradeBody');
  const upgradeOptions = $('upgradeOptions');
  const scoreFeed = $('scoreFeed');
  const reticle = $('reticle');
  const reloadOverlay = $('reloadOverlay');
  const reloadOverlayFill = $('reloadOverlayFill');
  const worldOverlay = $('worldOverlay');
  const worldTitle = $('worldTitle');
  const worldText = $('worldText');
  const worldFill = $('worldFill');
  const deathOverlay = $('deathOverlay');
  const deathTitle = $('deathTitle');
  const deathFill = $('deathFill');
  const deathText = $('deathText');
  const deathStats = $('deathStats');
  const deathUnlocks = $('deathUnlocks');
  const deathShare = $('deathShare');
  const deathContinue = $('deathContinue');
  const deathGiveUp = $('deathGiveUp');
  const mobileControls = $('mobileControls');
  const stickBase = $('stickBase');
  const stickKnob = $('stickKnob');
  const touchShoot = $('touchShoot');
  const touchC4 = $('touchC4');
  const splash = $('splash');
  const splashStatus = $('splashStatus');
  const splashFill = $('splashFill');
  const splashVersion = $('splashVersion');
  const settingHealth = $('settingHealth');
  const settingAmmo = $('settingAmmo');
  const settingControls = $('settingControls');
  const settingSound = $('settingSound');
  const settingAmbient = $('settingAmbient');
  const settingFullscreen = $('settingFullscreen');
  const updatePrompt = $('updatePrompt');
  const updateReload = $('updateReload');

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
  const ENV_CONFIG = configSection('environment');
  const WORLD_CONFIG = configSection('world');
  const PLAYER_CONFIG = configSection('player');
  const WEAPON_CONFIG = configSection('weapon');
  const ENEMY_CONFIG = configSection('enemies');
  const MISSION_CONFIG = configSection('mission');
  const PICKUP_CONFIG = configSection('pickups');
  const TIMER_CONFIG = configSection('timers');
  const COMMS_CONFIG = configSection('comms');

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
    RED_LIGHT: 24,
    CACTUS: 25,
    MUD: 26,
    ASH: 27,
    DEAD_WOOD: 28,
    DARK_RED: 29,
    SHUTDOWN_PAD: 30,
    SNOW: 31,
    ICE: 32,
    PINE_LEAF: 33,
    CLOUD: 34,
    SPIRE_METAL: 41
  };

  const CHUNK_SIZE = Math.max(4, Math.floor(configNumber(WORLD_CONFIG, 'chunkSize', 16)));
  const WORLD_CHUNK_RADIUS = Math.max(1, Math.floor(configNumber(WORLD_CONFIG, 'chunkRadius', 3)));
  const WORLD_MIN = -WORLD_CHUNK_RADIUS * CHUNK_SIZE;
  const WORLD_MAX = (WORLD_CHUNK_RADIUS + 1) * CHUNK_SIZE - 1;
  const MAX_Y = Math.max(16, Math.floor(configNumber(WORLD_CONFIG, 'maxY', 46)));
  const WATER_LEVEL = Math.max(1, Math.floor(configNumber(WORLD_CONFIG, 'waterLevel', 8)));
  const OCEAN_ENABLED = configBoolean(WORLD_CONFIG, 'ocean', true);
  const OCEAN_PADDING = Math.max(0, configNumber(WORLD_CONFIG, 'oceanPadding', 96));
  const TERRAIN_BASE_HEIGHT = configNumber(WORLD_CONFIG, 'terrainBaseHeight', 4);
  const TERRAIN_DETAIL_AMOUNT = configNumber(WORLD_CONFIG, 'terrainDetailAmount', 12);
  const TERRAIN_BROAD_AMOUNT = configNumber(WORLD_CONFIG, 'terrainBroadAmount', 10);
  const TERRAIN_RIDGE_AMOUNT = configNumber(WORLD_CONFIG, 'terrainRidgeAmount', 2);
  const TERRAIN_LAKE_A_DEPTH = configNumber(WORLD_CONFIG, 'terrainLakeADepth', 16);
  const TERRAIN_LAKE_B_DEPTH = configNumber(WORLD_CONFIG, 'terrainLakeBDepth', 13);
  const TERRAIN_MARSH_DEPTH = configNumber(WORLD_CONFIG, 'terrainMarshDepth', 16);
  const PLAYER_HEIGHT = configNumber(PLAYER_CONFIG, 'height', 1.76);
  const PLAYER_RADIUS = configNumber(PLAYER_CONFIG, 'radius', 0.31);
  const PLAYER_STEP_HEIGHT = Math.max(0, Math.min(1.25, configNumber(PLAYER_CONFIG, 'stepHeight', 1.05)));
  const PLAYER_STEP_SMOOTH_SECONDS = Math.max(0.02, configNumber(PLAYER_CONFIG, 'stepSmoothMs', 120) / 1000);
  const STARTING_HEALTH = configNumber(PLAYER_CONFIG, 'startingHealth', 100);
  const STARTING_RESERVE = Math.max(0, Math.floor(configNumber(PLAYER_CONFIG, 'startingReserve', 36)));
  const STARTING_C4 = Math.max(0, Math.floor(configNumber(PLAYER_CONFIG, 'startingC4', 1)));
  const RESPAWN_RESERVE_FLOOR = Math.max(0, Math.floor(configNumber(PLAYER_CONFIG, 'respawnReserveFloor', 24)));
  const LOW_HEALTH_THRESHOLD = configNumber(PLAYER_CONFIG, 'lowHealthThreshold', 25);
  const MAG_SIZE = Math.max(1, Math.floor(configNumber(WEAPON_CONFIG, 'magSize', 6)));
  const RELOAD_TIME = Math.max(0.1, configNumber(WEAPON_CONFIG, 'reloadTime', 1.15));
  const QUICK_RELOAD_MULTIPLIER = Math.max(0.1, configNumber(WEAPON_CONFIG, 'quickReloadMultiplier', 0.5));
  const DOUBLE_MAG_MULTIPLIER = Math.max(1, Math.floor(configNumber(WEAPON_CONFIG, 'doubleMagMultiplier', 2)));
  const FIRE_COOLDOWN = Math.max(0.05, configNumber(WEAPON_CONFIG, 'fireCooldown', 0.42));
  const HAIR_TRIGGER_MULTIPLIER = Math.max(0.1, configNumber(WEAPON_CONFIG, 'hairTriggerMultiplier', 0.5));
  const RECOIL_AMOUNT = Math.max(0, configNumber(WEAPON_CONFIG, 'recoilAmount', 0.08));
  const PREMIUM_GRIP_MULTIPLIER = Math.max(0, Math.min(1, configNumber(WEAPON_CONFIG, 'premiumGripMultiplier', 0.38)));
  const ENEMY_CAP = Math.max(1, Math.floor(configNumber(ENEMY_CONFIG, 'baseCap', 18)));
  const HORDE_KILLS_PER_LEVEL = Math.max(1, Math.floor(configNumber(ENEMY_CONFIG, 'hordeKillsPerLevel', 5)));
  const HORDE_CAP_BONUS = Math.max(0, Math.floor(configNumber(ENEMY_CONFIG, 'hordeCapBonus', 2)));
  const ZOMBIE_MOAN_RADIUS = Math.max(1, configNumber(ENEMY_CONFIG, 'zombieMoanRadius', 5));
  const ZOMBIE_MOAN_MAX_VOICES = Math.max(1, Math.floor(configNumber(ENEMY_CONFIG, 'zombieMoanMaxVoices', 3)));
  const ZOMBIE_MOAN_INTERVAL_MIN = Math.max(0.5, configNumber(ENEMY_CONFIG, 'zombieMoanIntervalMin', 4));
  const ZOMBIE_MOAN_INTERVAL_MAX = Math.max(ZOMBIE_MOAN_INTERVAL_MIN, configNumber(ENEMY_CONFIG, 'zombieMoanIntervalMax', 5));
  const INSERTION_DROP_HEIGHT = Math.max(10, configNumber(MISSION_CONFIG, 'insertionDropHeight', 30));
  const INSERTION_FALL_SPEED = Math.max(2, configNumber(MISSION_CONFIG, 'insertionFallSpeed', 5.8));
  const FIRST_WAVE_SIZE = Math.max(0, Math.floor(configNumber(MISSION_CONFIG, 'firstWaveSize', 3)));
  const INITIAL_SEED = Math.floor(configNumber(CONFIG, 'initialSeed', 729641));
  const QUICK_BIOMES = ['forest', 'dunes', 'rocky', 'swamp', 'ashlands', 'tundra'];
  const AMMO_PICKUP_ROUNDS = Math.max(1, Math.floor(configNumber(PICKUP_CONFIG, 'ammoRounds', 6)));
  const MAP_AMMO_PICKUP_CHANCE = Math.max(0, Math.min(1, configNumber(PICKUP_CONFIG, 'mapAmmoChance', 0.28)));
  const ENEMY_C4_DROP_CHANCE = Math.max(0, Math.min(1, configNumber(PICKUP_CONFIG, 'enemyC4DropChance', 0.06)));
  const ENEMY_ANY_DROP_CHANCE = Math.max(ENEMY_C4_DROP_CHANCE, Math.min(1, configNumber(PICKUP_CONFIG, 'enemyAnyDropChance', 0.55)));
  const LONG_RANGE_KILL_DIST = configNumber(WEAPON_CONFIG, 'longRangeKillDistance', 34);
  const DEATH_READY_DELAY = Math.max(0.1, configNumber(TIMER_CONFIG, 'deathReadyDelay', 3));
  const WORLD_REBUILD_DURATION = Math.max(0.25, configNumber(TIMER_CONFIG, 'worldRebuildDuration', 2.35));
  const HEARTBEAT_INTERVAL = Math.max(0.2, configNumber(TIMER_CONFIG, 'heartbeatInterval', 0.95));
  const CYCLE_HALF_DAY_MS = Math.max(1000, configNumber(TIMER_CONFIG, 'cycleHalfDayMs', 360000));
  const PHASE_DROP = 'drop';
  const PHASE_ZOMBIE_THREAT = 'zombieThreat';
  let currentSeed = INITIAL_SEED;
  let world = new Map();
  let edits = new Map();
  let loadedChunks = new Set();
  let currentChunkX = 999999;
  let currentChunkZ = 999999;
  let meshes = { opaque: null, water: null, ocean: null, dynamic: null };
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
    c4: STARTING_C4,
    reloading: false,
    reloadTimer: 0,
    reloadDuration: 0,
    reloadTotal: 0,
    reloadInitialMag: 0,
    shotCooldown: 0,
    invuln: 0,
    kills: 0,
    headshots: 0,
    lifeKills: 0,
    lifeHeadshots: 0,
    lifeLongestShot: 0,
    lifeBestCombo: 0,
    lifeStartedAt: performance.now(),
    score: 0,
    deaths: 0
  };

  let enemies = [];
  let pickups = [];
  let c4Charges = [];
  let particles = [];
  let nextSpawnTimer = 3.5;
  let ammoMercyTimer = 0;
  let locked = false;
  let touchMode = matchMedia('(pointer: coarse)').matches;
  const portraitQuery = matchMedia('(orientation: portrait)');
  let keys = Object.create(null);
  const touchInput = { moveX: 0, moveY: 0, jump: false, lookId: null, lookX: 0, lookY: 0, stickId: null };
  const HELD_GAMEPLAY_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight',
    'Space', 'ShiftLeft', 'ShiftRight'
  ]);
  const BUILD_VERSION = configString(CONFIG, 'buildVersion', '2026.08.01.16');
  const COMMS_DROP_IN = configString(COMMS_CONFIG, 'dropIn', 'You are on {islandName}. The mission is to kill {zombieTotal} infected.');
  const COMMS_HUNT_COMPLETE = configString(COMMS_CONFIG, 'huntComplete', '{islandName} is clear. Good work, but there is more to do. Do you accept?');
  const COMMS_BITTEN = configString(COMMS_CONFIG, 'bitten', 'You are bit. Keep your distance and finish the objective.');
  const COMMS_DEATH = configString(COMMS_CONFIG, 'death', 'Can you hear me? Do you want to keep going?');
  const COMMS_FEW_MORE = configString(COMMS_CONFIG, 'fewMore', 'Just a few more.');
  const COMMS_LOW_HEALTH = configString(COMMS_CONFIG, 'lowHealth', 'Retreat and treat your wounds.');
  const COMMS_LONG_RANGE = configString(COMMS_CONFIG, 'longRange', 'Nice shot.');
  const COMMS_AMMO_CACHE = configString(COMMS_CONFIG, 'ammoCache', 'Ammo cache marked nearby.');
  let lastFrame = performance.now();
  const cycleStartedAt = performance.now();
  let fpsAvg = 60;
  let frameCounter = 0;
  let lastKillTime = -999;
  let killComboCount = 0;
  let zombieMoanTimer = Math.min(2.5, ZOMBIE_MOAN_INTERVAL_MIN);
  let dayAmount = 1;
  let soundEnabled = true;
  let ambientEnabled = true;
  let footstepTimer = 0;
  let activeAmbientCue = '';
  let lastQuickHuntBiome = '';
  let deferredInstallPrompt = null;
  let pwaUpdatePrompted = false;
  const INSTALLED_ONCE_KEY = 'zomvoxInstalledOnce';
  let waterDamageTimer = 0;
  let hordeLevel = 0;
  let heartbeatTimer = 0;
  let woundGaspTimer = 0;
  let cameraStepOffsetY = 0;
  const DEATH_CINEMATIC_DURATION = 2.65;
  const DEATH_FADE_DURATION = 1.05;
  const DEATH_RESPAWN_START = DEATH_CINEMATIC_DURATION + DEATH_FADE_DURATION;
  const DEATH_BLOOD_DURATION = 2.45;
  const deathState = {
    active: false,
    timer: 0,
    duration: DEATH_READY_DELAY,
    ready: false,
    fadeStarted: false,
    overlayShown: false,
    decisionActive: false,
    reviving: false,
    reviveTimer: 0,
    bloodTimer: 0,
    eye: [0, 0, 0],
    yaw: Math.PI,
    pitch: 0
  };
  const worldRebuildState = { active: false, timer: 0, startedAt: 0, duration: WORLD_REBUILD_DURATION, seed: null };
  const extractionState = { active: false, timer: 0, duration: 3, seed: null };
  const mission = {
    quickBiome: 'forest',
    quickGoal: 0,
    phase: PHASE_DROP,
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
    upgradeActive: false,
    upgradeAfterChoice: null,
    completed: false,
    huntDecisionActive: false,
    huntDecisionTimer: 0,
    huntDecisionShown: false,
    commandBannerTimer: 0,
    toastLockTimer: 0,
    fewMoreVoicePlayed: false,
    lowHealthVoicePlayed: false,
    longRangeVoicePlayed: false,
    bittenVoicePlayed: false
  };

  const activePerks = {
    quickReload: false,
    doubleMag: false,
    premiumGrip: false,
    hairTrigger: false,
    fleetFeet: false,
    bodyArmor: false
  };

  const PERK_CHOICES = [
    { id: 'quickReload', name: 'Quick Reload', desc: 'Field-drilled swap. Reload time cut in half.' },
    { id: 'doubleMag', name: 'Double Stack', desc: 'Doubles magazine capacity for longer pushes.' },
    { id: 'premiumGrip', name: 'Premium Grip', desc: 'Stabilized handle. Shot recoil is heavily reduced.' },
    { id: 'hairTrigger', name: 'Hair Trigger', desc: 'Tuned trigger group. Fire cooldown is cut in half.' },
    { id: 'fleetFeet', name: 'Fleet Feet', desc: 'Move 25% faster across hostile terrain.' },
    { id: 'bodyArmor', name: 'Body Armor', desc: 'Zombie damage reduced by 20%.' }
  ];

  function syncBulletRack(size) {
    while (bulletRack.children.length < size) {
      const b = document.createElement('div');
      b.className = 'bullet';
      bulletRack.appendChild(b);
    }
    while (bulletRack.children.length > size) bulletRack.lastChild.remove();
  }

  function effectiveMagSize() {
    return MAG_SIZE * (activePerks.doubleMag ? DOUBLE_MAG_MULTIPLIER : 1);
  }

  function currentReloadTime() {
    return RELOAD_TIME * (activePerks.quickReload ? QUICK_RELOAD_MULTIPLIER : 1);
  }

  function currentFireCooldown() {
    return FIRE_COOLDOWN * (activePerks.hairTrigger ? HAIR_TRIGGER_MULTIPLIER : 1);
  }

  function currentRecoilAmount() {
    // Premium Grip is a recoil reducer. Clamp the multiplier above so config
    // tweaks can never accidentally make the perk kick harder.
    return RECOIL_AMOUNT * (activePerks.premiumGrip ? PREMIUM_GRIP_MULTIPLIER : 1);
  }

  function currentPlayerSpeedMultiplier() {
    return activePerks.fleetFeet ? 1.25 : 1;
  }

  function currentZombieDamage(amount) {
    // Zombie bites are intentionally binary now: first bite wounds, second
    // bite kills. Enemy variants still differ in movement and health, but not
    // bite lethality.
    return STARTING_HEALTH / 2;
  }

  function resetActivePerks() {
    for (const key of Object.keys(activePerks)) activePerks[key] = false;
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

  let toastTimer = null;
  let radioCommsTimer = null;

  function showToast(message, priority = false, tone = '') {
    if (!priority && mission.toastLockTimer > 0) return;
    toast.classList.remove('show', 'toast-ammo', 'toast-health', 'toast-c4', 'toast-perk');
    toast.textContent = message;
    if (tone) toast.classList.add('toast-' + tone);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), priority ? 3600 : 1900);
  }

  function showCommandBanner(title, body, duration = 4.2) {
    if (!commandBanner || !commandBannerTitle || !commandBannerBody) return;
    commandBannerTitle.textContent = title;
    commandBannerBody.textContent = body;
    commandBanner.classList.add('show');
    mission.commandBannerTimer = duration;
  }

  function showRadioComms(message, duration = 3.4) {
    if (!radioComms || !radioCommsText) return;
    if (!message) return;
    radioCommsText.textContent = message;
    radioComms.hidden = false;
    radioComms.classList.add('show');
    clearTimeout(radioCommsTimer);
    radioCommsTimer = setTimeout(() => {
      radioComms.classList.remove('show');
      setTimeout(() => {
        if (!radioComms.classList.contains('show')) radioComms.hidden = true;
      }, 180);
    }, duration * 1000);
  }

  function formatCommsMessage(template) {
    return String(template || '')
      .replace(/\{islandName\}/g, currentBiomeLabel() + ' Island')
      .replace(/\{zombieTotal\}/g, String(currentInfectedGoal()))
      .replace(/\{biome\}/g, currentBiomeLabel());
  }

  function updateCommandBanner(dt) {
    mission.toastLockTimer = Math.max(0, mission.toastLockTimer - dt);
    if (!commandBanner || mission.commandBannerTimer <= 0) return;
    mission.commandBannerTimer = Math.max(0, mission.commandBannerTimer - dt);
    if (mission.commandBannerTimer <= 0) commandBanner.classList.remove('show');
  }

  function showProgressOverlay(title, progress) {
    if (disableTitle) disableTitle.textContent = title;
    disableFill.style.width = (progress * 100).toFixed(1) + '%';
    disablePercent.textContent = Math.floor(progress * 100) + '%';
    disableOverlay.classList.add('show');
  }

  function hideProgressOverlay() {
    disableFill.style.width = '0%';
    disablePercent.textContent = '0%';
    disableOverlay.classList.remove('show');
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
    player.lifeBestCombo = 0;
    player.lifeStartedAt = performance.now();
  }

  function runSeconds() {
    return Math.max(0, Math.floor((performance.now() - player.lifeStartedAt) / 1000));
  }

  function formatRunTime(seconds = runSeconds()) {
    const minutes = Math.floor(seconds / 60);
    const remain = String(seconds % 60).padStart(2, '0');
    return minutes + ':' + remain;
  }

  function activePerkNames() {
    return PERK_CHOICES
      .filter(choice => activePerks[choice.id])
      .map(choice => choice.name);
  }

  function availablePerkChoices() {
    return PERK_CHOICES.filter(choice => !activePerks[choice.id]);
  }

  function nextPerkId(x = 0, z = 0) {
    const available = availablePerkChoices();
    if (!available.length) return null;
    const index = Math.floor(seededHash(x * 7.7 + player.kills, z * 3.9 - player.score) * available.length) % available.length;
    return available[index].id;
  }

  function equipPerk(id) {
    const choice = PERK_CHOICES.find(item => item.id === id);
    if (!choice || activePerks[id]) return false;
    activePerks[id] = true;
    if (id === 'doubleMag') {
      cancelReload();
      setPlayerMagSize(effectiveMagSize(), true);
    }
    scorePop(choice.name.toUpperCase(), 'pickup perk small');
    showToast('Perk equipped: ' + choice.name, false, 'perk');
    sound('perkEquip');
    return true;
  }

  function runShareUrl() {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      return location.origin + location.pathname;
    }
    return 'https://zomvox.com/';
  }

  function buildRunSummary(title) {
    const perks = activePerkNames();
    const perkText = perks.length ? perks.join(' + ') : 'None';
    const seconds = runSeconds();
    const stats = [
      ['Kills', player.lifeKills],
      ['Headshots', player.lifeHeadshots],
      ['Island', currentBiomeLabel()],
      ['Perk used', perks.length > 1 ? perks.length + ' perks' : perkText],
      ['Time survived', formatRunTime(seconds)]
    ];
    const text = [
      'ZomVox: Zombies and Voxels',
      title,
      'Kills: ' + player.lifeKills,
      'Headshots: ' + player.lifeHeadshots,
      'Island: ' + currentBiomeLabel(),
      'Perk used: ' + perkText,
      'Time survived: ' + formatRunTime(seconds),
      'Play: ' + runShareUrl()
    ].join('\n');
    return { stats, text };
  }

  function renderRunStats(target, summary) {
    if (!target || !summary) return;
    target.innerHTML = '';
    for (const [label, value] of summary.stats) {
      const item = document.createElement('span');
      const labelNode = document.createTextNode(label);
      const valueNode = document.createElement('b');
      valueNode.textContent = value;
      item.append(labelNode, document.createElement('br'), valueNode);
      target.appendChild(item);
    }
  }

  function setShareButton(button, summary) {
    if (!button) return;
    if (!summary) {
      button.classList.add('hidden');
      button.dataset.shareText = '';
      return;
    }
    button.dataset.shareText = summary.text;
    button.textContent = 'Share your run';
    button.classList.remove('hidden');
  }

  function renderDeathStats(summary = buildRunSummary('Run ended')) {
    deathStats.classList.remove('simple');
    renderRunStats(deathStats, summary);
    setShareButton(deathShare, summary);
  }

  function renderAutoRespawnStats() {
    deathStats.classList.add('simple');
    renderRunStats(deathStats, {
      stats: [
        ['Infected cleared', player.lifeKills],
        ['Survived', formatRunTime()]
      ],
      text: ''
    });
    hideDeathShare();
  }

  function hideDeathShare() {
    setShareButton(deathShare, null);
  }

  function renderBriefingShare(summary) {
    if (!briefingShare || !briefingShareStats) return;
    if (!summary) {
      briefingShare.classList.add('hidden');
      briefingShareStats.textContent = '';
      setShareButton(briefingShareButton, null);
      return;
    }
    renderRunStats(briefingShareStats, summary);
    setShareButton(briefingShareButton, summary);
    briefingShare.classList.remove('hidden');
  }

  function fallbackCopyText(text) {
    const box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed';
    box.style.left = '-9999px';
    document.body.appendChild(box);
    box.select();
    try { document.execCommand('copy'); }
    finally { box.remove(); }
  }

  async function shareRunFromButton(button) {
    const text = button && button.dataset.shareText;
    if (!text) return;
    sound('confirm');
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else fallbackCopyText(text);
      button.textContent = 'Copied';
      showToast('Run copied to clipboard.');
      setTimeout(() => { button.textContent = 'Share your run'; }, 1200);
    } catch (_) {
      fallbackCopyText(text);
      button.textContent = 'Copied';
      showToast('Run copied to clipboard.');
      setTimeout(() => { button.textContent = 'Share your run'; }, 1200);
    }
  }

  function sound(name, gainValue = 1, playbackRate = 1, options = {}) {
    if (!soundEnabled) return;
    return window.ZomVoxSound?.play(name, gainValue, playbackRate, options);
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
    triggerCrosshairFlash(kind === 'kill' ? 'kill' : 'hit');
  }

  function setReticleOnTarget(value) {
    if (!reticle) return;
    reticle.classList.toggle('on-target', !!value);
  }

  function triggerCrosshairFlash(kind = 'shot') {
    if (!crosshairFlash) return;
    crosshairFlash.classList.remove('show', 'hit', 'kill');
    void crosshairFlash.offsetWidth;
    if (kind === 'hit' || kind === 'kill') crosshairFlash.classList.add(kind);
    crosshairFlash.classList.add('show');
    clearTimeout(triggerCrosshairFlash.timer);
    triggerCrosshairFlash.timer = setTimeout(() => crosshairFlash.classList.remove('show'), kind === 'shot' ? 70 : 120);
  }

  function muzzleParticle(options) {
    if (!muzzleFx) return;
    const particle = document.createElement('i');
    particle.className = 'muzzleParticle' + (options.smoke ? ' smoke' : '');
    particle.style.setProperty('--x', options.x.toFixed(1) + 'px');
    particle.style.setProperty('--y', options.y.toFixed(1) + 'px');
    particle.style.setProperty('--dx', options.dx.toFixed(1) + 'px');
    particle.style.setProperty('--dy', options.dy.toFixed(1) + 'px');
    particle.style.setProperty('--size', options.size.toFixed(1) + 'px');
    particle.style.setProperty('--life', options.life.toFixed(3) + 's');
    particle.style.setProperty('--start', options.start.toFixed(2));
    particle.style.setProperty('--end', options.end.toFixed(2));
    particle.style.setProperty('--spin', (options.spin || 0).toFixed(1) + 'deg');
    particle.style.setProperty('--spinEnd', (options.spinEnd || 0).toFixed(1) + 'deg');
    particle.style.setProperty('--color', options.color);
    if (options.halo) particle.style.setProperty('--halo', options.halo);
    if (options.glow) particle.style.setProperty('--glow', options.glow.toFixed(1) + 'px');
    muzzleFx.appendChild(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
    setTimeout(() => particle.remove(), Math.ceil(options.life * 1200));
  }

  function triggerMuzzleFx() {
    if (!muzzleFx || !gunSprite) return;
    while (muzzleFx.childElementCount > 70) muzzleFx.firstElementChild?.remove();
    const rect = gunSprite.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    // Screen-space voxel particles keep the muzzle flash glued to the weapon
    // sprite while still giving every shot a slightly different burst.
    const rand = (min, max) => min + Math.random() * (max - min);
    const burstType = Math.floor(Math.random() * 4);
    const fanCenter = Math.PI + rand(-.18, .18);
    const fanSpread = [.62, 1.05, 1.35, .78][burstType];
    const rangeBoost = [1.0, 1.34, .82, 1.12][burstType];
    const muzzleX = rect.left + rect.width * rand(.185, .255);
    const muzzleY = rect.top + rect.height * rand(.49, .58);
    const flashColors = ['#fff7b0', '#ffe15a', '#ffb236', '#ff7a21'];
    const flashCount = 10 + Math.floor(Math.random() * 8);
    for (let i = 0; i < flashCount; i++) {
      const isCore = i < 2 && burstType !== 2;
      const angle = fanCenter + rand(-fanSpread, fanSpread) * (isCore ? .28 : 1);
      const distance = (isCore ? rand(8, 28) : rand(20, 72)) * rangeBoost;
      const size = isCore ? rand(13, 22) : rand(4, 14);
      muzzleParticle({
        x: muzzleX - size / 2 + rand(-10, 10),
        y: muzzleY - size / 2 + rand(-12, 12),
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance + rand(-26, 26),
        size,
        life: isCore ? rand(.12, .2) : rand(.11, .24),
        start: isCore ? rand(.9, 1.35) : rand(.55, 1.15),
        end: rand(.18, .58),
        spin: rand(-10, 10),
        spinEnd: rand(-55, 55),
        color: flashColors[Math.floor(Math.random() * flashColors.length)],
        halo: 'rgba(255,188,38,.5)',
        glow: isCore ? rand(18, 34) : rand(8, 24)
      });
    }
    const smokeCount = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < smokeCount; i++) {
      const angle = fanCenter + rand(-.7, .7);
      const distance = rand(20, 58);
      const size = rand(8, 22);
      muzzleParticle({
        smoke: true,
        x: muzzleX - size / 2 + rand(-8, 16),
        y: muzzleY - size / 2 + rand(-8, 12),
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance - rand(12, 34),
        size,
        life: rand(.38, .68),
        start: .55,
        end: rand(1.15, 2.0),
        spin: rand(-8, 8),
        spinEnd: rand(-35, 35),
        color: 'rgba(' + Math.floor(rand(140, 212)) + ',' + Math.floor(rand(148, 216)) + ',' + Math.floor(rand(142, 208)) + ',.48)'
      });
    }
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
    const wounded = player.health > 0 && player.health < STARTING_HEALTH && !deathState.active && !isMenuOpen();
    document.body.classList.toggle('wounded', wounded);
    document.body.classList.toggle('low-health', false);
    if (!wounded) {
      heartbeatTimer = 0;
      woundGaspTimer = 0;
      return;
    }
    woundGaspTimer -= dt;
    if (woundGaspTimer <= 0) {
      sound('toxin', .68);
      woundGaspTimer = 3.4 + Math.random() * 5.6;
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
    return menu.style.display !== 'none' || splash.style.display !== 'none' || isBriefingOpen() || isUpgradeOpen();
  }

  function keyboardControlsActive() {
    return !touchMode &&
      locked &&
      menu.style.display === 'none' &&
      splash.style.display === 'none' &&
      !deathState.active &&
      !worldRebuildState.active &&
      !isBriefingOpen() &&
      !isUpgradeOpen();
  }

  function clearKeyboardState() {
    keys = Object.create(null);
  }

  function clearMovementInput(stopVelocity = true) {
    clearKeyboardState();
    touchInput.moveX = 0;
    touchInput.moveY = 0;
    touchInput.jump = false;
    touchInput.stickId = null;
    if (stickKnob) stickKnob.style.transform = 'translate(0, 0)';
    if (stopVelocity) {
      player.vel[0] = 0;
      player.vel[2] = 0;
    }
    if (gunSprite) gunSprite.classList.remove('moving');
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

  function mixSkyColor(a, b, t) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t
    ];
  }

  function clearSkyGradient(sky) {
    const horizon = [
      clamp01(sky[0] * 1.18 + 0.08),
      clamp01(sky[1] * 1.14 + 0.07),
      clamp01(sky[2] * 1.08 + 0.04)
    ];
    const zenith = [
      clamp01(sky[0] * 0.54),
      clamp01(sky[1] * 0.62),
      clamp01(sky[2] * 0.78)
    ];
    const bands = 12;
    gl.enable(gl.SCISSOR_TEST);
    for (let i = 0; i < bands; i++) {
      const y0 = Math.floor(canvas.height * i / bands);
      const y1 = Math.floor(canvas.height * (i + 1) / bands);
      const t = i / Math.max(1, bands - 1);
      const color = mixSkyColor(horizon, zenith, t);
      gl.scissor(0, y0, canvas.width, Math.max(1, y1 - y0));
      gl.clearColor(color[0], color[1], color[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.disable(gl.SCISSOR_TEST);
    gl.clear(gl.DEPTH_BUFFER_BIT);
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
    let audioProgress = (soundEnabled || ambientEnabled) ? 0 : 1;
    let audioReady = !(soundEnabled || ambientEnabled);
    let splashDone = false;
    let preload = null;
    try {
      preload = (soundEnabled || ambientEnabled) ? window.ZomVoxSound?.prime?.(info => {
        audioProgress = Math.max(audioProgress, info.progress || 0);
      }) : null;
    } catch (err) {
      console.warn('ZomVox audio preload skipped:', err);
      audioProgress = 1;
      audioReady = true;
    }
    if (preload && typeof preload.finally === 'function') {
      preload.finally(() => {
        audioProgress = 1;
        audioReady = true;
      });
    } else {
      audioProgress = 1;
      audioReady = true;
    }
    const messages = [
      'Getting latest version...',
      'Preloading field audio...',
      'Generating world...',
      'Calibrating display...'
    ];
    const duration = 2600;
    const maxDuration = 4400;
    const start = performance.now();
    function finishSplash() {
      if (splashDone) return;
      splashDone = true;
      splashStatus.textContent = 'Ready.';
      splashFill.style.width = '100%';
      setTimeout(() => {
        splash.classList.add('hide');
        setTimeout(() => {
          splash.style.display = 'none';
          updateAmbientSound(true);
        }, 420);
      }, 180);
    }
    const failsafe = setTimeout(finishSplash, 6500);
    function step(now) {
      if (splashDone) return;
      const t = Math.min(1, (now - start) / duration);
      const timeout = (now - start) >= maxDuration;
      const eased = 1 - Math.pow(1 - t, 2.2);
      const idx = Math.min(messages.length - 1, Math.floor(t * messages.length));
      const progress = Math.min(.98, eased * .72 + audioProgress * .28);
      splashStatus.textContent = messages[idx];
      splashFill.style.width = (Math.max(.04, progress) * 100).toFixed(1) + '%';
      if (t < 1 || (!audioReady && !timeout)) {
        requestAnimationFrame(step);
      } else {
        clearTimeout(failsafe);
        finishSplash();
      }
    }
    requestAnimationFrame(step);
  }

  function applySettings() {
    soundEnabled = !!settingSound.checked;
    ambientEnabled = !!settingAmbient.checked;
    window.ZomVoxSound?.setEnabled(soundEnabled);
    window.ZomVoxSound?.setAmbientEnabled(ambientEnabled);
    document.body.classList.toggle('hide-health', !settingHealth.checked);
    document.body.classList.toggle('hide-ammo', !settingAmmo.checked);
    document.body.classList.toggle('hide-controls', !settingControls.checked);
    updateAmbientSound(true);
  }

  function beginWorldRebuild(seed) {
    if (worldRebuildState.active) return;
    const nextSeed = Number.isFinite(seed) ? seed : monthlyRandomSeed();
    clearMovementInput();
    document.body.classList.add('stage-transition');
    worldRebuildState.active = true;
    worldRebuildState.timer = 0;
    worldRebuildState.startedAt = performance.now();
    worldRebuildState.seed = nextSeed;
    if (worldTitle) worldTitle.textContent = 'Rebuilding World';
    worldText.textContent = 'Building frontier...';
    worldFill.style.width = '0%';
    worldOverlay.classList.add('show');
    player.vel = [0, 0, 0];
    cancelReload();
    player.shotCooldown = 0;
  }

  function currentIslandLabel() {
    return 'Frontier Hunt';
  }

  function normalizeBiome(value) {
    const biome = String(value || 'forest').trim().toLowerCase();
    return ['forest', 'dunes', 'rocky', 'swamp', 'ashlands', 'tundra'].includes(biome) ? biome : 'forest';
  }

  function monthlySeedPrefix(date = new Date()) {
    // Runtime month/year prefix keeps Quick Hunt islands fresh each month
    // without requiring a config edit or new deployment.
    return String(date.getMonth() + 1).padStart(2, '0') + String(date.getFullYear());
  }

  function monthlyRandomSeed(prefixBucket = 0) {
    const bucket = Math.max(0, Math.min(8, Math.floor(prefixBucket)));
    const suffixBase = bucket * 10000;
    const suffix = String(suffixBase + Math.floor(Math.random() * 10000)).padStart(5, '0');
    return Number(monthlySeedPrefix() + suffix);
  }

  function quickSeedForBiome(biome) {
    const idx = QUICK_BIOMES.indexOf(normalizeBiome(biome));
    return monthlyRandomSeed(Math.max(0, idx) + 1);
  }

  function pickRandomHunt() {
    const choices = QUICK_BIOMES.filter(biome => biome !== lastQuickHuntBiome);
    const pool = choices.length ? choices : QUICK_BIOMES;
    const biome = pool[Math.floor(Math.random() * pool.length)] || 'forest';
    lastQuickHuntBiome = biome;
    return {
      biome,
      goal: 20 + Math.floor(Math.random() * 21),
      seed: quickSeedForBiome(biome)
    };
  }

  function currentBiome() {
    return normalizeBiome(mission.quickBiome);
  }

  function currentBiomeLabel() {
    const biome = currentBiome();
    return biome.charAt(0).toUpperCase() + biome.slice(1);
  }

  const QUICK_PROGRESS_KEY = 'zomvoxQuickHuntProgress';
  const DEFAULT_QUICK_UNLOCKS = QUICK_BIOMES.slice();
  const QUICK_UNLOCK_RULES = {
    forest: { label: 'Forest', requirement: 'Unlocked' },
    dunes: { label: 'Dunes', requirement: 'Unlocked' },
    rocky: { label: 'Rocky', requirement: 'Survive 5:00', test: progress => progress.stats.bestSurvivalSeconds >= 300 },
    swamp: { label: 'Swamp', requirement: 'Kill 50 in one hunt', test: progress => progress.stats.bestKills >= 50 },
    ashlands: { label: 'Ashlands', requirement: 'Earn a 5-kill streak', test: progress => progress.stats.bestCombo >= 5 },
    tundra: { label: 'Tundra', requirement: '100 total kills', test: progress => progress.stats.totalKills >= 100 }
  };

  function defaultQuickProgress() {
    return {
      unlockedBiomes: DEFAULT_QUICK_UNLOCKS.slice(),
      stats: {
        quickHuntRuns: 0,
        totalKills: 0,
        bestKills: 0,
        bestSurvivalSeconds: 0,
        bestCombo: 0,
        streakPerks: 0
      }
    };
  }

  function sanitizeQuickProgress(value) {
    const base = defaultQuickProgress();
    const input = value && typeof value === 'object' ? value : {};
    const stats = input.stats && typeof input.stats === 'object' ? input.stats : {};
    const unlocked = Array.isArray(input.unlockedBiomes) ? input.unlockedBiomes : [];
    base.unlockedBiomes = Array.from(new Set(DEFAULT_QUICK_UNLOCKS
      .concat(unlocked.map(normalizeBiome))
      .filter(biome => QUICK_BIOMES.includes(biome))));
    base.stats.quickHuntRuns = Math.max(0, Math.floor(Number(stats.quickHuntRuns) || 0));
    base.stats.totalKills = Math.max(0, Math.floor(Number(stats.totalKills) || 0));
    base.stats.bestKills = Math.max(0, Math.floor(Number(stats.bestKills) || 0));
    base.stats.bestSurvivalSeconds = Math.max(0, Math.floor(Number(stats.bestSurvivalSeconds) || 0));
    base.stats.bestCombo = Math.max(0, Math.floor(Number(stats.bestCombo) || 0));
    base.stats.streakPerks = Math.max(0, Math.floor(Number(stats.streakPerks ?? stats.tripleKills) || 0));
    return base;
  }

  function loadQuickProgress() {
    try {
      return sanitizeQuickProgress(JSON.parse(localStorage.getItem(QUICK_PROGRESS_KEY) || 'null'));
    } catch (_) {
      return defaultQuickProgress();
    }
  }

  let quickProgress = loadQuickProgress();

  function saveQuickProgress() {
    try { localStorage.setItem(QUICK_PROGRESS_KEY, JSON.stringify(quickProgress)); }
    catch (_) {}
  }

  function quickBiomeLabel(biome) {
    const label = QUICK_UNLOCK_RULES[normalizeBiome(biome)]?.label || currentBiomeLabel();
    return label + ' Island';
  }

  function isQuickBiomeUnlocked(biome) {
    return quickProgress.unlockedBiomes.includes(normalizeBiome(biome));
  }

  function applyQuickUnlockRules() {
    const newlyUnlocked = [];
    for (const biome of QUICK_BIOMES) {
      if (isQuickBiomeUnlocked(biome)) continue;
      const rule = QUICK_UNLOCK_RULES[biome];
      if (rule && typeof rule.test === 'function' && rule.test(quickProgress)) {
        quickProgress.unlockedBiomes.push(biome);
        newlyUnlocked.push(biome);
      }
    }
    if (newlyUnlocked.length) saveQuickProgress();
    return newlyUnlocked;
  }

  function unlockQuickBiome(biome) {
    const normalized = normalizeBiome(biome);
    if (!QUICK_BIOMES.includes(normalized) || isQuickBiomeUnlocked(normalized)) return [];
    quickProgress.unlockedBiomes.push(normalized);
    saveQuickProgress();
    return [normalized];
  }

  function recordQuickHuntRun(run) {
    quickProgress.stats.quickHuntRuns++;
    quickProgress.stats.totalKills += run.kills;
    quickProgress.stats.bestKills = Math.max(quickProgress.stats.bestKills, run.kills);
    quickProgress.stats.bestSurvivalSeconds = Math.max(quickProgress.stats.bestSurvivalSeconds, run.seconds);
    quickProgress.stats.bestCombo = Math.max(quickProgress.stats.bestCombo, run.bestCombo);
    if (run.bestCombo >= 5) quickProgress.stats.streakPerks++;
    saveQuickProgress();
    const newlyUnlocked = applyQuickUnlockRules();
    return newlyUnlocked;
  }

  function renderDeathUnlocks(unlockedBiomes) {
    if (!deathUnlocks) return;
    if (!unlockedBiomes || !unlockedBiomes.length) {
      deathUnlocks.classList.add('hidden');
      deathUnlocks.textContent = '';
      return;
    }
    deathUnlocks.textContent = 'Island unlocked: ' + unlockedBiomes.map(quickBiomeLabel).join(' + ');
    deathUnlocks.classList.remove('hidden');
  }

  applyQuickUnlockRules();

  // Ambient is a separate looping channel: menu ambience or one loop per biome.
  function ambientCueForBiome(biome = currentBiome()) {
    const normalized = normalizeBiome(biome);
    return 'ambient' + normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  function desiredAmbientCue() {
    if (!ambientEnabled || splash.style.display !== 'none' || worldRebuildState.active) return '';
    if (menu.style.display !== 'none') return 'ambientMenu';
    return ambientCueForBiome();
  }

  function updateAmbientSound(force = false) {
    const cue = desiredAmbientCue();
    if (!force && cue === activeAmbientCue) return;
    activeAmbientCue = cue;
    if (cue) window.ZomVoxSound?.playAmbient(cue);
    else window.ZomVoxSound?.stopAmbient();
  }

  function currentInfectedGoal() {
    return Math.max(1, Math.floor(mission.quickGoal || 30));
  }

  function maybeVoiceFewMore() {
    if (mission.fewMoreVoicePlayed || mission.phase !== PHASE_ZOMBIE_THREAT) return;
    const remaining = currentInfectedGoal() - player.kills;
    if (remaining > 0 && remaining <= 3) {
      mission.fewMoreVoicePlayed = true;
      showRadioComms(COMMS_FEW_MORE);
    }
  }

  function maybeVoiceBitten() {
    if (mission.bittenVoicePlayed || deathState.active || player.health <= 0) return;
    mission.bittenVoicePlayed = true;
    showRadioComms(COMMS_BITTEN, 4.4);
  }

  function maybeVoiceLowHealth() {
    if (mission.lowHealthVoicePlayed || deathState.active || player.health <= 0) return;
    if (player.health <= STARTING_HEALTH * .33) {
      mission.lowHealthVoicePlayed = true;
      showRadioComms(COMMS_LOW_HEALTH, 4.2);
    }
  }

  function maybeVoiceLongRangeKill(dist) {
    if (mission.longRangeVoicePlayed || dist < LONG_RANGE_KILL_DIST) return;
    mission.longRangeVoicePlayed = true;
    showRadioComms(COMMS_LONG_RANGE);
  }

  function isGameLive() {
    return menu.style.display === 'none' && splash.style.display === 'none' &&
      !worldRebuildState.active && !extractionState.active && !mission.huntDecisionActive && !deathState.active;
  }

  function shouldPauseForPortrait() {
    const mobileLike = touchMode || matchMedia('(pointer: coarse)').matches;
    return mobileLike &&
      portraitQuery.matches &&
      menu.style.display === 'none' &&
      splash.style.display === 'none' &&
      !worldRebuildState.active &&
      !extractionState.active &&
      !mission.huntDecisionActive &&
      !deathState.active &&
      !isBriefingOpen() &&
      !isUpgradeOpen();
  }

  function updatePortraitPauseState() {
    const paused = shouldPauseForPortrait();
    document.body.classList.toggle('portrait-paused', paused);
    if (paused) {
      clearMovementInput();
      touchInput.lookId = null;
    }
    return paused;
  }

  function isBriefingOpen() {
    return mission.briefingActive;
  }

  function isUpgradeOpen() {
    return mission.upgradeActive;
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
    clearMovementInput();
    mission.pendingBriefing = null;
    mission.briefingActive = true;
    mission.objectiveAcknowledged = false;
    mission.briefingAfterOk = briefing.afterOk || null;
    mission.nextHudTitle = briefing.hudTitle || briefing.title;
    mission.nextHudMeta = briefing.hudMeta || briefing.meta || '';
    briefingMeta.textContent = briefing.meta || currentIslandLabel();
    briefingObjective.textContent = briefing.title;
    briefingBody.textContent = briefing.body;
    if (briefingOk) briefingOk.textContent = briefing.buttonText || 'OK';
    renderBriefingShare(briefing.shareSummary || null);
    objectiveBriefing.classList.add('show');
    document.body.classList.add('briefing-open');
    player.vel = [0, 0, 0];
    sound('briefing');
    if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
  }

  function acknowledgeObjectiveBriefing() {
    if (!mission.briefingActive) return;
    sound('confirm');
    mission.briefingActive = false;
    objectiveBriefing.classList.remove('show');
    document.body.classList.remove('briefing-open');
    if (briefingOk) briefingOk.textContent = 'OK';
    renderBriefingShare(null);
    setHudObjective(mission.nextHudTitle || '', mission.nextHudMeta || '');
    const afterOk = mission.briefingAfterOk;
    mission.briefingAfterOk = null;
    if (afterOk) afterOk();
    if (!touchMode && menu.style.display === 'none' && !deathState.active && !worldRebuildState.active && !isUpgradeOpen()) requestPointerLockSafe();
  }

  function openPerkChoice(afterChoice, options = {}) {
    const available = availablePerkChoices();
    if (!upgradeOverlay || !upgradeOptions || !available.length) {
      if (afterChoice) afterChoice();
      return;
    }
    clearMovementInput();
    mission.upgradeActive = true;
    mission.upgradeAfterChoice = afterChoice || null;
    if (upgradeMeta) upgradeMeta.textContent = options.meta || (currentIslandLabel() + ' // ' + currentBiomeLabel() + ' // Perk Selection');
    if (upgradeTitle) upgradeTitle.textContent = options.title || 'Choose Perk';
    if (upgradeBody) upgradeBody.textContent = options.body || 'Pick one perk before redeploy.';
    upgradeOptions.innerHTML = '';
    for (const choice of available) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'upgradeOption';
      btn.dataset.upgrade = choice.id;
      btn.innerHTML = '<span class="upgradeName"></span><span class="upgradeDesc"></span>';
      btn.querySelector('.upgradeName').textContent = choice.name;
      btn.querySelector('.upgradeDesc').textContent = choice.desc;
      btn.addEventListener('click', () => choosePerk(choice.id));
      upgradeOptions.appendChild(btn);
    }
    upgradeOverlay.classList.add('show');
    document.body.classList.add('upgrade-open');
    player.vel = [0, 0, 0];
    if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
  }

  function choosePerk(id) {
    if (!equipPerk(id)) return;
    mission.upgradeActive = false;
    upgradeOverlay.classList.remove('show');
    document.body.classList.remove('upgrade-open');
    const afterChoice = mission.upgradeAfterChoice;
    mission.upgradeAfterChoice = null;
    if (afterChoice) afterChoice();
    if (!touchMode && menu.style.display === 'none' && !deathState.active && !worldRebuildState.active && !isBriefingOpen() && !isUpgradeOpen()) requestPointerLockSafe();
  }

  function updateWorldRebuild(dt) {
    worldRebuildState.timer = (performance.now() - worldRebuildState.startedAt) / 1000;
    const progress = Math.min(1, worldRebuildState.timer / worldRebuildState.duration);
    if (worldTitle) worldTitle.textContent = 'Rebuilding World';
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

  function hideHuntDecisionOverlay() {
    if (!huntDecisionOverlay) return;
    huntDecisionOverlay.classList.remove('show');
    huntDecisionOverlay.hidden = true;
  }

  function showHuntDecisionPrompt() {
    if (mission.huntDecisionShown) return;
    mission.huntDecisionShown = true;
    if (huntDecisionOverlay) {
      huntDecisionOverlay.hidden = false;
      void huntDecisionOverlay.offsetWidth;
      huntDecisionOverlay.classList.add('show');
    }
    showRadioComms(formatCommsMessage(COMMS_HUNT_COMPLETE), 6.2);
  }

  function beginHuntCompleteDecision() {
    clearMovementInput();
    mission.huntDecisionActive = true;
    mission.huntDecisionTimer = 0;
    mission.huntDecisionShown = false;
    player.vel = [0, 0, 0];
    document.body.classList.add('hunt-complete-fade');
    if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
  }

  function chooseNextHunt() {
    const next = pickRandomHunt();
    mission.quickBiome = next.biome;
    mission.quickGoal = next.goal;
    return next;
  }

  function beginExtractionRedeploy() {
    const next = chooseNextHunt();
    hideHuntDecisionOverlay();
    mission.huntDecisionActive = false;
    mission.huntDecisionTimer = 0;
    mission.huntDecisionShown = false;
    extractionState.active = true;
    extractionState.timer = 0;
    extractionState.seed = next.seed;
    clearMovementInput();
    player.vel = [0, 0, 0];
    document.body.classList.remove('hunt-complete-fade');
    document.body.classList.add('extraction-fade', 'stage-transition');
    if (worldTitle) worldTitle.textContent = 'Extraction';
    worldText.textContent = 'Contacting command for extraction...';
    worldFill.style.width = '0%';
    worldOverlay.classList.add('show');
  }

  function declineHuntDecision() {
    sound('confirm');
    hideHuntDecisionOverlay();
    mission.huntDecisionActive = false;
    mission.huntDecisionTimer = 0;
    mission.huntDecisionShown = false;
    document.body.classList.remove('hunt-complete-fade');
    returnToMainMenu('Mission declined. Awaiting next hunt.');
  }

  function acceptHuntDecision() {
    sound('confirm');
    beginExtractionRedeploy();
  }

  function updateHuntDecision(dt) {
    mission.huntDecisionTimer += dt;
    updateParticles(dt);
    if (mission.huntDecisionTimer >= .85) showHuntDecisionPrompt();
  }

  function updateExtractionRedeploy(dt) {
    extractionState.timer += dt;
    const progress = Math.min(1, extractionState.timer / extractionState.duration);
    worldFill.style.width = (progress * 100).toFixed(1) + '%';
    if (progress < .38) worldText.textContent = 'Contacting command for extraction...';
    else if (progress < .76) worldText.textContent = 'Extracting from island...';
    else worldText.textContent = 'Preparing next drop...';
    updateParticles(dt);
    if (progress >= 1) {
      const nextSeed = extractionState.seed;
      extractionState.active = false;
      extractionState.seed = null;
      document.body.classList.remove('extraction-fade');
      beginWorldRebuild(nextSeed);
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

  function isStandaloneApp() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      navigator.standalone === true;
  }

  function isMobileLikeDevice() {
    return touchMode || matchMedia('(pointer: coarse)').matches;
  }

  function canOfferInstallChoice() {
    return !isStandaloneApp() && isMobileLikeDevice();
  }

  function markInstalledOnce() {
    try {
      localStorage.setItem(INSTALLED_ONCE_KEY, '1');
    } catch (_) {}
  }

  function updatePortraitInstall() {
    if (!portraitInstallCallout) return;
    portraitInstallCallout.hidden = !canOfferInstallChoice() || !deferredInstallPrompt;
  }

  async function installZomVox() {
    if (!deferredInstallPrompt) {
      showToast('Install from your browser menu when available.');
      return;
    }
    sound('confirm');
    deferredInstallPrompt.prompt();
    let choice = null;
    try {
      choice = await deferredInstallPrompt.userChoice;
    } catch (_) {}
    deferredInstallPrompt = null;
    if (choice && choice.outcome === 'accepted') {
      markInstalledOnce();
      showToast('Installed. Open ZomVox from your home screen for app mode.');
    }
    updatePortraitInstall();
  }

  function showPwaUpdatePrompt() {
    if (!updatePrompt || pwaUpdatePrompted) return;
    pwaUpdatePrompted = true;
    updatePrompt.hidden = false;
  }

  function reloadForPwaUpdate() {
    if (updateReload) updateReload.disabled = true;
    window.location.reload();
  }

  function registerPwaHooks() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        let hadServiceWorkerController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.register('sw.js').then(registration => {
          if (registration.waiting && navigator.serviceWorker.controller) showPwaUpdatePrompt();
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) showPwaUpdatePrompt();
            });
          });
        }).catch(() => {});
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (hadServiceWorkerController && navigator.serviceWorker.controller) showPwaUpdatePrompt();
          hadServiceWorkerController = !!navigator.serviceWorker.controller;
        });
      });
    }
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredInstallPrompt = event;
      updatePortraitInstall();
    });
    window.addEventListener('appinstalled', () => {
      markInstalledOnce();
      deferredInstallPrompt = null;
      updatePortraitInstall();
      showToast('Installed. Open ZomVox from your home screen for app mode.');
    });
    if (isStandaloneApp()) markInstalledOnce();
    updatePortraitInstall();
  }

  function initSettings() {
    settingFullscreen.checked = touchMode;
    [settingHealth, settingAmmo, settingControls, settingSound, settingAmbient].forEach(el => {
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
    uniform float uWaterStyle;
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
      if(t < 7.5){
        if(uWaterStyle > 1.5) return vec3(0.20, 0.29, 0.13); /* swamp water */
        return mix(vec3(0.10, 0.37, 0.70), vec3(0.90, 0.13, 0.04), uWaterStyle);
      }
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
      if(t < 24.5) return vec3(0.90, 0.02, 0.015) * (0.42 + (sin(uTime * 5.8) * 0.5 + 0.5) * 0.78); /* red beacon */
      if(t < 25.5) return vec3(0.15, 0.50, 0.18); /* cactus */
      if(t < 26.5) return vec3(0.22, 0.18, 0.12); /* swamp mud */
      if(t < 27.5) return vec3(0.12, 0.13, 0.13); /* ash */
      if(t < 28.5) return vec3(0.18, 0.13, 0.09); /* dead wood */
      if(t < 29.5) return vec3(0.20, 0.015, 0.012); /* dead beacon */
      if(t < 30.5) return vec3(1.0, 0.86, 0.16) * (0.62 + (sin(uTime * 6.8) * 0.5 + 0.5) * 0.42); /* shutdown pad */
      if(t < 31.5) return vec3(0.86, 0.91, 0.92); /* snow */
      if(t < 32.5) return vec3(0.56, 0.82, 0.96); /* frozen water */
      if(t < 33.5) return vec3(0.06, 0.25, 0.13); /* pine needles */
      if(t < 34.5) return vec3(0.94, 0.97, 0.98); /* voxel cloud */
      if(t < 35.5) return vec3(0.43, 0.47, 0.44); /* grey zombie */
      if(t < 36.5) return vec3(0.25, 0.28, 0.26); /* dark grey zombie */
      if(t < 37.5) return vec3(0.16, 0.31, 0.15); /* ammo camo green */
      if(t < 38.5) return vec3(0.07, 0.16, 0.08); /* ammo camo shadow */
      if(t < 39.5) return vec3(0.015, 0.025, 0.014); /* zombie mouth */
      if(t < 40.5) return vec3(0.82, 0.86, 0.72); /* zombie teeth */
      if(t < 41.5) return vec3(0.68, 0.74, 0.76) * (0.78 + (sin(uTime * 2.4) * 0.5 + 0.5) * 0.20); /* active spire metal */
      if(t < 42.5) return vec3(0.24, 0.62, 1.00); /* perk blue */
      return vec3(1.0, 0.45, 0.18); /* particles */
    }
    void main(){
      vec3 n = normalize(vNormal);
      vec3 color = baseColor(vType, n);
      float grain = hash(floor(vec2(vWorld.x * 6.0 + vWorld.y * 1.7, vWorld.z * 6.0 - vWorld.y * 2.3)));
      color *= 0.88 + grain * 0.18;
      if(vType > 6.5 && vType < 7.5){
        float ripple = sin((vWorld.x * 2.4 + vWorld.z * 2.1 + uTime * 2.6)) * 0.04;
        vec3 waterShade = uWaterStyle > 1.5 ? vec3(0.05, 0.08, 0.01) : mix(vec3(0.03, 0.12, 0.18), vec3(0.22, 0.03, 0.0), uWaterStyle);
        color += waterShade + ripple;
      }
      if(vType < 1.5 && n.y > 0.55){
        float tuft = step(0.60, hash(floor(vWorld.xz * 4.0)));
        float fleck = step(0.74, hash(floor(vWorld.xz * 11.0 + vec2(5.0, 13.0))));
        float blade = step(0.82, hash(floor(vec2(vWorld.x * 18.0, vWorld.z * 7.0))));
        color = mix(color, color * vec3(0.72, 0.92, 0.66), tuft * 0.36);
        color += vec3(0.04, 0.10, 0.015) * fleck;
        color -= vec3(0.025, 0.055, 0.01) * blade;
      }
      if((vType < 1.5 && n.y <= 0.55) || (vType > 1.5 && vType < 2.5)){
        float dirtDark = step(0.68, hash(floor(vWorld.xy * 5.0 + vWorld.zz)));
        float dirtWarm = step(0.76, hash(floor(vec2(vWorld.x * 7.0 - vWorld.y, vWorld.z * 6.0 + 9.0))));
        float dirtStone = step(0.86, hash(floor(vWorld.zy * 8.0 + vec2(11.0, 3.0))));
        color -= vec3(0.08, 0.045, 0.025) * dirtDark;
        color += vec3(0.10, 0.055, 0.020) * dirtWarm;
        color += vec3(0.045, 0.050, 0.055) * dirtStone;
      }
      if(vType < 1.5 && abs(n.y) < 0.25){
        float sidePatch = hash(floor(vec2(vWorld.x * 2.0 + vWorld.z * 2.4, vWorld.y * 3.0)));
        float drip = step(0.74, hash(floor(vec2(vWorld.x * 5.5 - vWorld.z, vWorld.z * 5.5 + 4.0))));
        float grassEdge = 0.66 + sidePatch * 0.10 - drip * 0.17;
        float sideGrass = step(grassEdge, vUv.y);
        vec3 sideGrassColor = vec3(0.15, 0.49, 0.16) * (0.86 + sidePatch * 0.28);
        color = mix(color, sideGrassColor, sideGrass * 0.90);
      }
      if(vType > 8.5 && vType < 9.5) color += vec3(0.55, 0.38, 0.05);
      if(vType > 11.5 && vType < 12.5) color += vec3(0.70, 0.02, 0.0);
      if(vType > 14.5 && vType < 15.5) color += vec3(0.50, 0.15, 0.04);
      if(vType > 16.5 && vType < 17.5) color += vec3(0.35, 0.0, 0.0);
      if(vType > 19.5 && vType < 20.5) color += vec3(0.55, 0.35, 0.0);
      if(vType > 21.5 && vType < 22.5) color *= 0.70 + step(0.58, hash(floor(vWorld.xz * 3.0 + vWorld.yy))) * 0.42;
      if(vType > 23.5 && vType < 24.5) color += vec3(0.70, 0.0, 0.0) * (sin(uTime * 5.8) * 0.5 + 0.5);
      if(vType > 24.5 && vType < 25.5) color += vec3(0.02, 0.08, 0.02);
      if(vType > 26.5 && vType < 27.5) color *= 0.78 + step(0.62, hash(floor(vWorld.xz * 2.6 + vWorld.yy))) * 0.35;
      if(vType > 29.5 && vType < 30.5) color += vec3(0.45, 0.32, 0.02) * (sin(uTime * 6.8) * 0.5 + 0.5);
      if(vType > 40.5 && vType < 41.5) color += vec3(0.07, 0.12, 0.10) * (sin(uTime * 2.4) * 0.5 + 0.5);
      if(vType > 30.5 && vType < 31.5) color += vec3(0.05, 0.06, 0.07) * max(n.y, 0.0);
      if(vType > 31.5 && vType < 32.5) color += vec3(0.08, 0.16, 0.18) * max(n.y, 0.0);
      if(vType > 32.5 && vType < 33.5) color *= 0.82 + step(0.62, hash(floor(vWorld.xz * 3.2 + vWorld.yy))) * 0.25;
      if(vType > 33.5 && vType < 34.5) color *= 0.88 + max(n.y, 0.0) * 0.16;
      if(vType > 34.5 && vType < 35.5) color *= 0.82 + step(0.58, hash(floor(vWorld.xz * 3.0 + vWorld.yy))) * 0.24;
      if(vType > 36.5 && vType < 38.5) color *= 0.82 + step(0.52, hash(floor(vWorld.xz * 7.0 + vWorld.yy))) * 0.30;
      float edge = gridLine(vUv);
      color *= mix(0.58, 1.0, edge);
      float sun = max(dot(n, normalize(uLightDir)), 0.0);
      float skyBounce = max(n.y, 0.0) * mix(0.05, 0.18, uDay);
      float light = mix(0.13, 0.39, uDay) + sun * mix(0.28, 0.70, uDay) + skyBounce;
      if(vType > 8.5 && vType < 9.5) light += 0.65;
      if(vType > 11.5 && vType < 12.5) light += 0.75;
      if(vType > 19.5 && vType < 20.5) light += 0.75;
      if(vType > 23.5 && vType < 24.5) light += 1.05;
      if(vType > 29.5 && vType < 30.5) light += 0.55;
      if(vType > 40.5 && vType < 41.5) light += 0.14 * (sin(uTime * 2.4) * 0.5 + 0.5);
      if(vType > 12.5) light += 0.22;
      color *= light;
      if(uFog > 0.5){
        float dist = length(vWorld - uCam);
        float fog = smoothstep(54.0, 128.0, dist);
        color = mix(color, uSky, fog);
      }
      color += vec3(0.03, 0.05, 0.10) * (1.0 - uDay);
      float alpha = (vType > 29.5 && vType < 30.5) ? 0.62 : ((vType > 6.5 && vType < 7.5) ? (uWaterStyle > 1.5 ? 0.68 : mix(0.63, 0.72, uWaterStyle)) : 1.0);
      gl_FragColor = vec4(color, alpha);
    }
  `;
  const voxelProgram = createProgram(voxelVS, voxelFS);
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
    waterStyle: gl.getUniformLocation(voxelProgram, 'uWaterStyle')
  };
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
  function deathLookDir() {
    const t = Math.min(1, deathState.timer / DEATH_CINEMATIC_DURATION);
    const ease = 1 - Math.pow(1 - t, 3);
    const yaw = deathState.yaw + Math.sin(t * Math.PI) * .12;
    const pitch = deathState.pitch + (1.32 - deathState.pitch) * ease;
    const cp = Math.cos(pitch);
    return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  }
  function eyePos() { return [player.pos[0], player.pos[1] + 1.58, player.pos[2]]; }
  function cameraEyePos() { return [player.pos[0], player.pos[1] + 1.58 + cameraStepOffsetY, player.pos[2]]; }
  function renderEyePos() { return deathState.active ? deathState.eye : cameraEyePos(); }
  function renderLookDir() { return deathState.active ? deathLookDir() : lookDir(); }
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
  function isSolidType(type) { return !!type && type !== BLOCK.WATER && type !== BLOCK.LEAF && type !== BLOCK.PINE_LEAF && type !== BLOCK.CLOUD; }
  function blocksMovement(type) { return !!type && type !== BLOCK.WATER && type !== BLOCK.LEAF && type !== BLOCK.PINE_LEAF && type !== BLOCK.CLOUD; }
  function isAutoStepSurface(type) {
    return type === BLOCK.GRASS || type === BLOCK.DIRT || type === BLOCK.STONE ||
      type === BLOCK.SAND || type === BLOCK.MUD || type === BLOCK.ASH || type === BLOCK.SNOW || type === BLOCK.ICE;
  }

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
    let h = Math.floor(TERRAIN_BASE_HEIGHT + detail * TERRAIN_DETAIL_AMOUNT + broad * TERRAIN_BROAD_AMOUNT);
    const ridge = Math.abs(noise2(x * 0.012 - 300, z * 0.012 + 800) - 0.5) * 2;
    h += Math.floor(ridge * TERRAIN_RIDGE_AMOUNT);
    const lakeA = Math.max(0, 1 - Math.hypot(x + 28, z - 18) / 28);
    const lakeB = Math.max(0, 1 - Math.hypot(x - 34, z + 30) / 24);
    const marsh = Math.max(0, noise2(x * 0.045 - 120, z * 0.045 + 310) - 0.70);
    h -= Math.floor(lakeA * TERRAIN_LAKE_A_DEPTH + lakeB * TERRAIN_LAKE_B_DEPTH + marsh * TERRAIN_MARSH_DEPTH);
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
    if (kind === 'health') return false;
    const px = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Math.floor(x)));
    const pz = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Math.floor(z)));
    const py = pickupAirY(px, pz);
    if (py <= WATER_LEVEL + 1) return false;
    const perkId = kind === 'perk' ? nextPerkId(px, pz) : null;
    if (kind === 'perk' && !perkId) return false;
    pickups.push({
      x: px + .5,
      y: py + .35,
      z: pz + .5,
      kind,
      amount: kind === 'c4' || kind === 'perk' ? 1 : AMMO_PICKUP_ROUNDS,
      perkId,
      bob: seededHash(px * 5.1, pz * 9.3) * 10
    });
    return true;
  }

  function pickupSpotAt(px, pz) {
    px = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Math.floor(px)));
    pz = Math.max(WORLD_MIN, Math.min(WORLD_MAX, Math.floor(pz)));
    if (!inWorldXZ(px, pz)) return null;
    generateChunk(chunkCoord(px), chunkCoord(pz));
    const py = pickupAirY(px, pz);
    if (py <= WATER_LEVEL + 1) return null;
    if (blocksMovement(getBlock(px, py, pz)) || blocksMovement(getBlock(px, py + 1, pz))) return null;
    return { px, py, pz };
  }

  function findPickupSpotNear(x, z, radius = 5) {
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    const center = pickupSpotAt(cx, cz);
    if (center) return center;

    for (let r = 1; r <= radius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const spot = pickupSpotAt(cx + dx, cz + dz);
          if (spot) return spot;
        }
      }
    }
    return null;
  }

  function spawnKillStreakPerk(enemy, streak = 5) {
    const x = enemy ? enemy.x : player.pos[0];
    const z = enemy ? enemy.z : player.pos[2];
    const perkId = nextPerkId(x, z);
    if (!perkId) {
      scorePop('ALL PERKS EQUIPPED', 'pickup perk small');
      showToast('All perks already equipped.', false, 'perk');
      return false;
    }

    // Streak rewards should feel earned at the latest corpse. If that block
    // is water, a steep edge, or otherwise blocked, walk outward around the
    // corpse until a nearby visible ground tile is found.
    const spot = findPickupSpotNear(x, z, 5) || findPickupSpotNear(player.pos[0], player.pos[2], 6);
    if (!spot) return false;

    pickups.push({
      x: spot.px + .5,
      y: spot.py + .35,
      z: spot.pz + .5,
      kind: 'perk',
      amount: 1,
      perkId,
      smokeTimer: 0,
      bob: seededHash(spot.px * 5.1, spot.pz * 9.3) * 10
    });
    spawnParticles(spot.px + .5, spot.py + .7, spot.pz + .5, 18, 42);
    scorePop(streak + ' KILL STREAK', 'pickup perk small');
    showToast('Kill streak perk dropped.', false, 'perk');
    return true;
  }

  function nearbyAmmoPickup(radius = 20) {
    return pickups.some(p => !p.collected && p.kind === 'ammo' && Math.hypot(p.x - player.pos[0], p.z - player.pos[2]) <= radius);
  }

  function findMercyAmmoSpot() {
    for (let i = 0; i < 28; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 6 + Math.random() * 9;
      const x = Math.floor(player.pos[0] + Math.cos(angle) * radius);
      const z = Math.floor(player.pos[2] + Math.sin(angle) * radius);
      if (!inWorldXZ(x, z)) continue;
      generateChunk(chunkCoord(x), chunkCoord(z));
      const y = topSolidY(x, z) + 1;
      const surface = getBlock(x, y - 1, z);
      if (surface === BLOCK.WATER || y <= WATER_LEVEL + 1) continue;
      if (!blocksMovement(getBlock(x, y, z)) && !blocksMovement(getBlock(x, y + 1, z))) return { x, y, z };
    }
    return null;
  }

  function updateAmmoMercyDrops(dt) {
    if (!gunUnlocked() || player.reserve > 0 || nearbyAmmoPickup()) {
      ammoMercyTimer = 0;
      return;
    }
    ammoMercyTimer -= dt;
    if (ammoMercyTimer > 0) return;
    const spot = findMercyAmmoSpot();
    ammoMercyTimer = player.mag <= 0 ? 5.5 : 8.5;
    if (!spot) return;
    spawnPickupAt(spot.x, spot.y, spot.z, 'ammo');
    scorePop('AMMO CACHE', 'pickup small');
    showRadioComms(COMMS_AMMO_CACHE, 3.8);
  }

  function biomeSurfaceTypes(biome, x, z, h, beach, desert, lavaShore) {
    if (lavaShore) return { top: BLOCK.STONE, near: BLOCK.STONE };
    const roll = seededHash(x * 2.71 + 19, z * 3.43 - 11);
    if (biome === 'dunes') return { top: roll < .95 ? BLOCK.SAND : BLOCK.STONE, near: BLOCK.SAND };
    if (biome === 'rocky') return { top: roll < .95 ? BLOCK.STONE : BLOCK.GRASS, near: roll < .95 ? BLOCK.STONE : BLOCK.DIRT };
    if (biome === 'swamp') return { top: roll < .72 || beach ? BLOCK.MUD : BLOCK.GRASS, near: roll < .72 || beach ? BLOCK.MUD : BLOCK.DIRT };
    if (biome === 'ashlands') return { top: roll < .82 ? BLOCK.ASH : BLOCK.STONE, near: roll < .82 ? BLOCK.ASH : BLOCK.STONE };
    if (biome === 'tundra') return { top: roll < .90 ? BLOCK.SNOW : BLOCK.STONE, near: roll < .86 ? BLOCK.SNOW : BLOCK.STONE };
    return { top: beach ? BLOCK.SAND : (roll < .95 ? BLOCK.GRASS : (desert ? BLOCK.SAND : BLOCK.STONE)), near: beach ? BLOCK.SAND : BLOCK.DIRT };
  }

  function growTree(x, h, z, trunkType = BLOCK.WOOD, withLeaves = true, trunkBase = 4, trunkRange = 3) {
    const trunk = trunkBase + Math.floor(seededHash(x + 11.2, z - 4.1) * trunkRange);
    const canopyY = h + Math.max(trunk, 6);
    for (let y = 1; y <= canopyY - h; y++) genSetBlock(x, h + y, z, trunkType);
    if (!withLeaves) {
      const armY = h + Math.max(5, trunk);
      genSetBlock(x + (seededHash(x, z) > .5 ? 1 : -1), armY, z, trunkType);
      genSetBlock(x, armY + 1, z + (seededHash(x + 9, z - 7) > .5 ? 1 : -1), trunkType);
      return;
    }
    const crownY = canopyY;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = -1; dy <= 2; dy++) {
      const dist = Math.abs(dx) + Math.abs(dz) + Math.max(0, dy - 1);
      if (dist <= 4 && seededHash(x + dx * 19 + dy, z + dz * 23) > 0.08) {
        const bx = x + dx, by = crownY + dy, bz = z + dz;
        if (!getBlock(bx, by, bz)) genSetBlock(bx, by, bz, BLOCK.LEAF);
      }
    }
  }

  function growSaguaro(x, h, z) {
    const height = 4 + Math.floor(seededHash(x - 17, z + 21) * 3);
    for (let y = 1; y <= height; y++) genSetBlock(x, h + y, z, BLOCK.CACTUS);
    const armA = seededHash(x + 3, z - 8) > .5 ? 1 : -1;
    const armB = seededHash(x - 13, z + 5) > .5 ? 1 : -1;
    const yA = h + 2 + Math.floor(seededHash(x + 14, z + 14) * Math.max(1, height - 3));
    const yB = h + 2 + Math.floor(seededHash(x - 22, z - 19) * Math.max(1, height - 3));
    genSetBlock(x + armA, yA, z, BLOCK.CACTUS);
    genSetBlock(x + armA, yA + 1, z, BLOCK.CACTUS);
    if (height > 5) {
      genSetBlock(x, yB, z + armB, BLOCK.CACTUS);
      genSetBlock(x, yB + 1, z + armB, BLOCK.CACTUS);
    }
  }

  function growPineTree(x, h, z) {
    const trunk = 4 + Math.floor(seededHash(x + 31, z - 13) * 3);
    for (let y = 1; y <= trunk; y++) genSetBlock(x, h + y, z, BLOCK.WOOD);
    const baseY = h + 5;
    const topY = h + trunk + 2;
    for (let y = baseY; y <= topY; y++) {
      const layer = y - baseY;
      const radius = Math.max(0, 3 - Math.floor(layer * 0.62));
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const edge = Math.abs(dx) + Math.abs(dz);
          if (edge > radius + 1) continue;
          if (dx === 0 && dz === 0 && y <= h + trunk) continue;
          if (seededHash(x + dx * 17 + y, z + dz * 29) > 0.08) genSetBlock(x + dx, y, z + dz, BLOCK.PINE_LEAF);
        }
      }
    }
    genSetBlock(x, topY + 1, z, BLOCK.PINE_LEAF);
  }

  function growVoxelCloud(cx, cz) {
    const anchorX = cx * CHUNK_SIZE + 2 + Math.floor(seededHash(cx * 9.1 + 43, cz * 5.7 - 22) * Math.max(1, CHUNK_SIZE - 6));
    const anchorZ = cz * CHUNK_SIZE + 2 + Math.floor(seededHash(cx * 7.4 - 18, cz * 8.2 + 31) * Math.max(1, CHUNK_SIZE - 6));
    const y = MAX_Y + 13 + Math.floor(seededHash(cx * 3.6 + 7, cz * 4.1 - 9) * 8);
    const lobes = 3 + Math.floor(seededHash(cx * 4.9, cz * 6.2) * 3);
    for (let i = 0; i < lobes; i++) {
      const ox = Math.floor((seededHash(cx * 11.3 + i * 5, cz * 2.9) - .5) * 8);
      const oz = Math.floor((seededHash(cx * 3.3, cz * 12.4 - i * 6) - .5) * 6);
      const rx = 2 + Math.floor(seededHash(cx + i * 13, cz - i * 7) * 3);
      const rz = 1 + Math.floor(seededHash(cx - i * 19, cz + i * 11) * 3);
      for (let dx = -rx; dx <= rx; dx++) {
        for (let dz = -rz; dz <= rz; dz++) {
          if (Math.abs(dx) / Math.max(1, rx) + Math.abs(dz) / Math.max(1, rz) > 1.35) continue;
          const x = anchorX + ox + dx;
          const z = anchorZ + oz + dz;
          if (inWorldXZ(x, z) && seededHash(x * 2.7 + y, z * 3.1 - y) > 0.10) genSetBlock(x, y, z, BLOCK.CLOUD);
        }
      }
    }
  }

  function growRockCluster(x, h, z, chanceRoll) {
    const radius = 1 + Math.floor(seededHash(x - 21, z + 32) * 2.2);
    const height = 1 + Math.floor(seededHash(x + 5, z - 17) * 3.3);
    for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) {
      const falloff = Math.abs(dx) + Math.abs(dz);
      const stack = Math.max(1, height - Math.floor(falloff * .7));
      if (falloff <= radius + 1 && seededHash(x + dx * 9.1 + chanceRoll, z + dz * 7.7) > 0.12) {
        const bx = x + dx, bz = z + dz, by = terrainHeight(bx, bz) + 1;
        for (let y = 0; y < stack; y++) genSetBlock(bx, by + y, bz, BLOCK.STONE);
      }
    }
  }

  function generateChunk(cx, cz) {
    if (!chunkInWorld(cx, cz)) return;
    const ck = chunkKey(cx, cz);
    if (loadedChunks.has(ck)) return;
    loadedChunks.add(ck);
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    const biome = currentBiome();
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = x0 + lx, z = z0 + lz;
        const h = terrainHeight(x, z);
        const beach = h <= WATER_LEVEL + 2;
        const desert = noise2(x * 0.035 + 90, z * 0.035 - 30) > 0.66 && h < WATER_LEVEL + 9;
        const lavaShore = biomeUsesRedWater(biome) && beach;
        const surface = biomeSurfaceTypes(biome, x, z, h, beach, desert, lavaShore);
        for (let y = 0; y <= h; y++) {
          let type = BLOCK.STONE;
          if (y === h) type = surface.top;
          else if (y > h - 4) type = surface.near;
          genSetBlock(x, y, z, type);
        }
        // Dunes keep low basins dry. Tundra freezes low basins into solid ice
        // so players slide over them instead of clipping through water.
        if (biome !== 'dunes' && h < WATER_LEVEL) {
          const fill = biome === 'tundra' ? BLOCK.ICE : BLOCK.WATER;
          for (let y = h + 1; y <= WATER_LEVEL; y++) genSetBlock(x, y, z, fill);
        }
      }
    }
    // Props are limited away from chunk borders so chunks can be generated/unloaded cleanly.
    for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
      for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
        const x = x0 + lx, z = z0 + lz;
        const h = terrainHeight(x, z);
        if (h <= WATER_LEVEL + 1) continue;
        const propRoll = seededHash(x * 8.31, z * 3.77);
        if (biome === 'forest' && propRoll > 0.982) {
          growTree(x, h, z, BLOCK.WOOD, true, 6, 3);
        } else if (biome === 'dunes' && propRoll > 0.972) {
          growSaguaro(x, h, z);
        } else if (biome === 'rocky' && propRoll > 0.992) {
          //growTree(x, h, z, BLOCK.WOOD, true);
          //no trees..
        } else if (biome === 'swamp' && propRoll > 0.976) {
          growTree(x, h, z, BLOCK.DEAD_WOOD, seededHash(x - 4, z + 8) > .35);
        } else if (biome === 'ashlands' && propRoll > 0.982) {
          growTree(x, h, z, BLOCK.DEAD_WOOD, false);
        } else if (biome === 'tundra' && propRoll > 0.984) {
          growPineTree(x, h, z);
        }
      }
    }
    for (let lx = 3; lx < CHUNK_SIZE - 3; lx += 2) {
      for (let lz = 3; lz < CHUNK_SIZE - 3; lz += 2) {
        const x = x0 + lx, z = z0 + lz;
        const h = terrainHeight(x, z);
        const rockyShore = biomeUsesRedWater(biome) && h <= WATER_LEVEL + 3;
        const biomeRocks = (biome === 'rocky' || biome === 'ashlands' || biome === 'tundra') && h > WATER_LEVEL + 1;
        const rockNoise = seededHash(x * 4.13 + 15, z * 6.71 - 8);
        const rockThreshold = biome === 'rocky' ? 0.885 : (biome === 'tundra' ? 0.94 : 0.91);
        if ((rockyShore && h > WATER_LEVEL + 1 && rockNoise > 0.935) || (biomeRocks && rockNoise > rockThreshold)) {
          growRockCluster(x, h, z, rockNoise);
        }
      }
    }
    if (seededHash(cx * 5.7 + 101, cz * 8.4 - 44) > 0.78) growVoxelCloud(cx, cz);
    if (gunUnlocked() && seededHash(cx * 20.2 + 19, cz * 17.7 - 3) > 1 - MAP_AMMO_PICKUP_CHANCE) {
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
      if (t && t !== BLOCK.WATER && t !== BLOCK.LEAF && t !== BLOCK.PINE_LEAF && t !== BLOCK.CLOUD) return y;
    }
    return terrainHeight(x, z);
  }

  function surfaceMoveMultiplier(x, z) {
    const gx = Math.floor(x), gz = Math.floor(z);
    const y = topSolidY(gx, gz);
    const type = getBlock(gx, y, gz);
    return (type === BLOCK.SAND || type === BLOCK.MUD) ? 0.85 : 1;
  }

  function isOnIceSurface() {
    const gx = Math.floor(player.pos[0]), gz = Math.floor(player.pos[2]);
    const y = Math.floor(player.pos[1] - 0.08);
    return getBlock(gx, y, gz) === BLOCK.ICE;
  }

  function audioSurfaceForBlock(type) {
    if (type === BLOCK.SAND) return 'sand';
    if (type === BLOCK.MUD) return 'mud';
    if (type === BLOCK.SNOW) return 'snow';
    if (type === BLOCK.ICE) return 'ice';
    if (type === BLOCK.WATER) return 'water';
    if (type === BLOCK.STONE || type === BLOCK.BRICK || type === BLOCK.METAL || type === BLOCK.SPIRE_METAL) return 'stone';
    if (type === BLOCK.WOOD || type === BLOCK.DEAD_WOOD || type === BLOCK.CACTUS) return 'wood';
    if (type === BLOCK.ASH || currentBiome() === 'ashlands') return 'ash';
    if (type === BLOCK.DIRT) return 'dirt';
    return 'grass';
  }

  function playerAudioSurface() {
    const gx = Math.floor(player.pos[0]), gz = Math.floor(player.pos[2]);
    const y = Math.floor(player.pos[1] - 0.08);
    const footBlock = getBlock(gx, y, gz);
    if (footBlock === BLOCK.WATER || getBlock(gx, y + 1, gz) === BLOCK.WATER) return 'water';
    return audioSurfaceForBlock(footBlock || getBlock(gx, topSolidY(gx, gz), gz));
  }

  function updateFootstepAudio(dt, movingInput, sprint, insertion) {
    if (insertion || !player.grounded || !movingInput || deathState.active || worldRebuildState.active) {
      footstepTimer = Math.min(footstepTimer, 0.08);
      return;
    }
    const horizontalSpeed = Math.hypot(player.vel[0], player.vel[2]);
    if (horizontalSpeed < 0.9) return;

    footstepTimer -= dt;
    if (footstepTimer > 0) return;

    const surface = playerAudioSurface();
    const gait = sprint ? 'run' : 'walk';
    const slowSurface = surface === 'sand' || surface === 'mud' || surface === 'snow';
    const slickSurface = surface === 'water';
    const interval = (sprint ? 0.32 : 0.48) * (slowSurface ? 1.15 : slickSurface ? 1.08 : 1);
    const level = Math.min(1.1, (sprint ? 0.7 : 0.52) + horizontalSpeed * 0.04);
    footstepTimer = interval;
    sound('footstep', level, 1, { surface, gait });
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
  function usesTransparentMesh(type) {
    return type === BLOCK.WATER || type === BLOCK.SHUTDOWN_PAD;
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

  function pushFlatPlane(arr, x0, y, z0, x1, z1, type) {
    // Visual-only ocean: two triangles, no block collision or terrain lookup.
    const verts = [
      [x0, y, z1, 0, 1, 0, 0, 0, type],
      [x1, y, z1, 0, 1, 0, 1, 0, type],
      [x1, y, z0, 0, 1, 0, 1, 1, type],
      [x0, y, z1, 0, 1, 0, 0, 0, type],
      [x1, y, z0, 0, 1, 0, 1, 1, type],
      [x0, y, z0, 0, 1, 0, 0, 1, type]
    ];
    for (const v of verts) arr.push(...v);
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

  function pushBoxJointY(arr, cx, y, cz, x0, y0, z0, w, h, d, pivotY, pivotZ, pitch, yaw, type) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
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
      const pitchNy = f.n[1] * cp - f.n[2] * sp;
      const pitchNz = f.n[1] * sp + f.n[2] * cp;
      const nx = f.n[0] * cy - pitchNz * sy;
      const nz = f.n[0] * sy + pitchNz * cy;
      for (const idx of tri) {
        const p = f.v[idx], uv = uvs[idx];
        const relY = p[1] - pivotY;
        const relZ = p[2] - pivotZ;
        const pitchedY = pivotY + relY * cp - relZ * sp;
        const pitchedZ = pivotZ + relY * sp + relZ * cp;
        const wx = cx + p[0] * cy - pitchedZ * sy;
        const wz = cz + p[0] * sy + pitchedZ * cy;
        arr.push(wx, y + pitchedY, wz, nx, pitchNy, nz, uv[0], uv[1], type);
      }
    }
  }

  function pushZombieArm(arr, x, y, z, centerX, pitch, elbowBend, yaw, scale, type) {
    const thickness = .20 * scale;
    const upperLength = .47 * scale;
    const lowerLength = .43 * scale;
    const shoulderY = 1.18 * scale;
    const shoulderZ = -.02 * scale;
    const x0 = centerX - thickness * .5;
    pushBoxJointY(
      arr, x, y, z,
      x0, shoulderY - upperLength, shoulderZ - thickness * .5,
      thickness, upperLength, thickness,
      shoulderY, shoulderZ,
      pitch, yaw, type
    );

    const elbowY = shoulderY - upperLength * Math.cos(pitch);
    const elbowZ = shoulderZ - upperLength * Math.sin(pitch);
    const forearmPitch = pitch + elbowBend;
    pushBoxJointY(
      arr, x, y, z,
      x0, elbowY - lowerLength, elbowZ - thickness * .5,
      thickness, lowerLength, thickness,
      elbowY, elbowZ,
      forearmPitch, yaw, type
    );
  }

  function makeMesh(data) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return { buffer, count: data.length / 9 };
  }
  function buildOceanMesh() {
    const ocean = [];
    if (OCEAN_ENABLED && OCEAN_PADDING > 0) {
      const min = WORLD_MIN - OCEAN_PADDING;
      const max = WORLD_MAX + 1 + OCEAN_PADDING;
      pushFlatPlane(ocean, min, WATER_LEVEL + 0.96, min, max, max, BLOCK.WATER);
    }
    return makeMesh(ocean);
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
          const arr = usesTransparentMesh(type) ? water : opaque;
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
    disposeMesh(meshes.ocean);
    meshes.opaque = makeMesh(opaque);
    meshes.water = makeMesh(water);
    meshes.ocean = buildOceanMesh();
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

  function tryAutoStep(axis, dir, fromY) {
    if (PLAYER_STEP_HEIGHT <= 0 || !player.grounded || player.vel[1] > 0 || axis === 1) return false;

    const probeX = player.pos[0] + (axis === 0 ? dir * (PLAYER_RADIUS + 0.06) : 0);
    const probeZ = player.pos[2] + (axis === 2 ? dir * (PLAYER_RADIUS + 0.06) : 0);
    const surfaceY = topSolidY(probeX, probeZ);
    const rise = surfaceY + 1.001 - fromY;

    // Auto-step is for regular terrain only. Mission machines, trees, cactus,
    // and other props still behave like deliberate obstacles.
    if (rise <= 0.02 || rise > PLAYER_STEP_HEIGHT) return false;
    if (!isAutoStepSurface(getBlock(Math.floor(probeX), surfaceY, Math.floor(probeZ)))) return false;

    const stepped = player.pos.slice();
    stepped[1] = surfaceY + 1.001;
    if (collidesAt(stepped)) return false;
    player.pos[1] = stepped[1];
    cameraStepOffsetY = Math.max(-PLAYER_STEP_HEIGHT, cameraStepOffsetY - rise);
    player.grounded = true;
    return true;
  }

  function updateCameraStepSmoothing(dt) {
    if (cameraStepOffsetY >= 0) {
      cameraStepOffsetY = 0;
      return;
    }
    const blend = 1 - Math.pow(0.04, dt / PLAYER_STEP_SMOOTH_SECONDS);
    cameraStepOffsetY += (0 - cameraStepOffsetY) * blend;
    if (cameraStepOffsetY > -0.001) cameraStepOffsetY = 0;
  }

  function moveAxis(axis, amount) {
    if (amount === 0) return;
    const fromY = player.pos[1];
    player.pos[axis] += amount;
    if (collidesAt(player.pos)) {
      const dir = Math.sign(amount);
      if (tryAutoStep(axis, dir, fromY)) return;
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
    clearMovementInput();
    document.body.classList.remove('stage-transition');
    const x = Math.floor(player.pos[0]);
    const z = Math.floor(player.pos[2]);
    const groundY = topSolidY(x, z) + 1.001;
    mission.insertionActive = true;
    mission.insertionTargetY = groundY;
    touchInput.moveX = 0;
    touchInput.moveY = 0;
    touchInput.jump = false;
    cameraStepOffsetY = 0;
    player.grounded = false;
    player.vel = [0, -INSERTION_FALL_SPEED * .55, 0];
    player.pos[1] = Math.min(MAX_Y + INSERTION_DROP_HEIGHT, groundY + INSERTION_DROP_HEIGHT);
    scorePop('DROP INBOUND', 'small');
  }

  function finishInsertionDrop() {
    if (!mission.insertionActive) return;
    mission.insertionActive = false;
    cameraStepOffsetY = 0;
    player.pos[1] = Math.max(player.pos[1], mission.insertionTargetY);
    player.vel = [0, 0, 0];
    player.grounded = true;
    sound('land', 1, 1, { surface: playerAudioSurface(), gait: 'land' });
    scorePop('TOUCHDOWN', 'pickup small');
    showRadioComms(formatCommsMessage(COMMS_DROP_IN), 4.8);
  }

  function updateMovement(dt) {
    const forward = [Math.sin(player.yaw), 0, Math.cos(player.yaw)];
    const right = [Math.cos(player.yaw), 0, -Math.sin(player.yaw)];
    let mx = 0, mz = 0;
    const insertion = mission.insertionActive;
    if (!insertion && (keys.KeyW || keys.ArrowUp)) { mx += forward[0]; mz += forward[2]; }
    if (!insertion && (keys.KeyS || keys.ArrowDown)) { mx -= forward[0]; mz -= forward[2]; }
    if (!insertion && (keys.KeyD || keys.ArrowRight)) { mx -= right[0]; mz -= right[2]; }
    if (!insertion && (keys.KeyA || keys.ArrowLeft)) { mx += right[0]; mz += right[2]; }
    if (!insertion && (touchInput.moveY || touchInput.moveX)) {
      mx += forward[0] * touchInput.moveY + right[0] * touchInput.moveX;
      mz += forward[2] * touchInput.moveY + right[2] * touchInput.moveX;
    }
    const movingInput = Math.hypot(mx, mz) > 0.05;
    gunSprite.classList.toggle('moving', movingInput);
    const len = Math.hypot(mx, mz) || 1; mx /= len; mz /= len;
    const sprint = keys.ShiftLeft || keys.ShiftRight;
    const speed = 5.35 * currentPlayerSpeedMultiplier() * (sprint ? 1.55 : 1.0) * surfaceMoveMultiplier(player.pos[0], player.pos[2]);
    if (insertion) {
      player.vel[0] = 0;
      player.vel[2] = 0;
    } else if (isOnIceSurface()) {
      const targetX = mx * speed;
      const targetZ = mz * speed;
      const slideBlend = movingInput ? 0.075 : 0.022;
      player.vel[0] += (targetX - player.vel[0]) * slideBlend;
      player.vel[2] += (targetZ - player.vel[2]) * slideBlend;
    } else {
      player.vel[0] = mx * speed;
      player.vel[2] = mz * speed;
    }
    player.vel[1] -= (insertion ? 9 : 22) * dt;
    const landingSpeed = Math.max(0, -player.vel[1]);
    if (insertion) player.vel[1] = Math.max(player.vel[1], -INSERTION_FALL_SPEED);
    const wasGrounded = player.grounded;
    if (!insertion && (keys.Space || touchInput.jump) && player.grounded) { player.vel[1] = 8.2; player.grounded = false; }
    moveAxis(0, player.vel[0] * dt);
    moveAxis(2, player.vel[2] * dt);
    clampToWorld(player.pos);
    player.grounded = false;
    moveAxis(1, player.vel[1] * dt);
    if (insertion && player.grounded) finishInsertionDrop();
    else if (!wasGrounded && player.grounded && landingSpeed > 3.2) sound('land', Math.min(1.2, landingSpeed / 8), 1, { surface: playerAudioSurface(), gait: 'land' });
    updateFootstepAudio(dt, movingInput, sprint, insertion);
    clampToWorld(player.pos);
    updateCameraStepSmoothing(dt);
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
      const surface = getBlock(x, y - 1, z);
      const propSurface = surface === BLOCK.WOOD || surface === BLOCK.CACTUS || surface === BLOCK.DEAD_WOOD ||
        surface === BLOCK.METAL || surface === BLOCK.SPIRE_METAL || surface === BLOCK.RED_LIGHT || surface === BLOCK.DARK_RED ||
        surface === BLOCK.SHUTDOWN_PAD || surface === BLOCK.BRICK || surface === BLOCK.LAMP;
      if (!propSurface && surface !== BLOCK.WATER && getBlock(x, y, z) !== BLOCK.WATER &&
        !blocksMovement(getBlock(x, y, z)) && !blocksMovement(getBlock(x, y + 1, z))) {
        return { x: x + .5, y, z: z + .5 };
      }
    }
    return null;
  }

  function enemyVariantStats(x, z) {
    const roll = seededHash(x * 12.7 - 4, z * 8.4 + 6);
    if (roll < 0.66) {
      return { kind: 'normal', hp: 48, speed: 2.55, scale: 1, damage: 50, attackCooldown: .9, retreat: .34, bodyType: 10, limbType: 11, eyeType: 12 };
    }
    if (roll < 0.84) {
      return { kind: 'speedy', hp: 28, speed: 3.35, scale: .78, damage: 50, attackCooldown: .68, retreat: .28, bodyType: 18, limbType: 10, eyeType: 12 };
    }
    if (roll < 0.94) {
      return { kind: 'brute', hp: 96, speed: 1.72, scale: 1.24, damage: 100, attackCooldown: 1.25, retreat: .46, bodyType: 19, limbType: 11, eyeType: 20 };
    }
    return { kind: 'grey', hp: 118, speed: 1.18, scale: 1, damage: 100, attackCooldown: 1.15, retreat: .38, bodyType: 35, limbType: 36, eyeType: 12 };
  }

  function spawnEnemy() {
    const p = enemySpawnPoint();
    if (!p) return;
    const variant = enemyVariantStats(p.x, p.z);
    const dx = player.pos[0] - p.x, dz = player.pos[2] - p.z;
    const spawnDepth = 1.95 * variant.scale;
    enemies.push({
      x: p.x,
      y: p.y - spawnDepth,
      z: p.z,
      spawnY: p.y - spawnDepth,
      targetY: p.y,
      emerge: 0,
      hp: variant.hp,
      maxHp: variant.hp,
      speed: variant.speed,
      attack: 0,
      attackPose: 0,
      retreat: 0,
      moveBlend: 0,
      phase: seededHash(p.x, p.z) * 10,
      blinkSeed: seededHash(p.x * 3.7 + 18, p.z * 5.9 - 22),
      mouthOpenTimer: 0,
      big: variant.kind === 'brute',
      variant,
      face: Math.atan2(dx, -dz),
      steerSide: seededHash(p.x * 2.3 + 41, p.z * 4.9 - 12) > .5 ? 1 : -1
    });
  }

  function lerpAngle(a, b, t) {
    let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    return a + d * t;
  }

  function enemyStepTarget(e, nx, nz) {
    const gx = Math.floor(nx), gz = Math.floor(nz);
    if (!inWorldXZ(gx, gz)) return null;
    generateChunk(chunkCoord(gx), chunkCoord(gz));
    const ground = topSolidY(gx, gz);
    const standY = ground + 1;
    if (getBlock(gx, standY, gz) === BLOCK.WATER || getBlock(gx, standY + 1, gz) === BLOCK.WATER) return null;
    if (blocksMovement(getBlock(gx, standY, gz)) || blocksMovement(getBlock(gx, standY + 1, gz))) return null;
    if (standY - e.y > 1.35 || e.y - standY > 3.25) return null;
    return { x: nx, y: standY, z: nz };
  }

  function moveEnemyToward(e, dx, dz, dist, dt, backingOff) {
    const dir = backingOff ? -1 : 1;
    const ux = (dx / dist) * dir;
    const uz = (dz / dist) * dir;
    const side = e.steerSide || 1;
    const baseStep = e.speed * surfaceMoveMultiplier(e.x, e.z) * dt * (backingOff ? 1.45 : 1);
    const diagA = Math.hypot(ux - uz * side, uz + ux * side) || 1;
    const diagB = Math.hypot(ux + uz * side, uz - ux * side) || 1;
    const candidates = [
      [ux, uz, 1.00],
      [-uz * side, ux * side, .86],
      [uz * side, -ux * side, .86],
      [(ux - uz * side) / diagA, (uz + ux * side) / diagA, .92],
      [(ux + uz * side) / diagB, (uz - ux * side) / diagB, .92]
    ];
    let best = null, bestScore = Infinity;
    for (const c of candidates) {
      const target = enemyStepTarget(e, e.x + c[0] * baseStep * c[2], e.z + c[1] * baseStep * c[2]);
      if (!target) continue;
      const score = backingOff
        ? -Math.hypot(player.pos[0] - target.x, player.pos[2] - target.z)
        : Math.hypot(player.pos[0] - target.x, player.pos[2] - target.z);
      if (score < bestScore) { bestScore = score; best = target; }
    }
    if (!best) {
      e.steerSide = -(e.steerSide || 1);
      return false;
    }
    e.x = best.x;
    e.z = best.z;
    e.y += (best.y - e.y) * Math.min(1, dt * 8);
    return true;
  }

  function nextZombieMoanInterval() {
    return ZOMBIE_MOAN_INTERVAL_MIN + Math.random() * (ZOMBIE_MOAN_INTERVAL_MAX - ZOMBIE_MOAN_INTERVAL_MIN);
  }

  function zombieMoanPlaybackRate(enemy) {
    const kind = enemy.variant?.kind || 'normal';
    if (kind === 'speedy') return 1.25;
    if (kind === 'grey') return -0.75;
    if (kind === 'brute') return 0.75;
    return 1;
  }

  function stopSoundHandle(handle) {
    if (handle && typeof handle.stop === 'function') handle.stop();
  }

  function stopEnemySounds(enemy) {
    if (!enemy) return;
    stopSoundHandle(enemy.moanHandle);
    enemy.moanHandle = null;
    enemy.mouthOpenTimer = 0;
  }

  function canPlayZombieMoan() {
    return gunUnlocked() && !mission.completed && !deathState.active && !worldRebuildState.active && !isMenuOpen();
  }

  function updateZombieMoans(dt) {
    if (!canPlayZombieMoan()) {
      zombieMoanTimer = Math.max(1.2, zombieMoanTimer);
      return;
    }
    zombieMoanTimer -= dt;
    if (zombieMoanTimer > 0) return;
    zombieMoanTimer = nextZombieMoanInterval();

    const nearby = [];
    for (const e of enemies) {
      if (e.dead || e.hp <= 0 || (e.emerge || 0) < 1) continue;
      const dist = Math.hypot(e.x - player.pos[0], e.z - player.pos[2]);
      if (dist <= ZOMBIE_MOAN_RADIUS) nearby.push({ enemy: e, dist });
    }
    if (!nearby.length) return;

    nearby.sort((a, b) => a.dist - b.dist);
    nearby.slice(0, ZOMBIE_MOAN_MAX_VOICES).forEach(({ enemy, dist }, index) => {
      const closeness = 1 - dist / ZOMBIE_MOAN_RADIUS;
      const volume = Math.max(0.12, Math.min(0.74, 0.18 + closeness * 0.56));
      const stats = enemy.variant || enemyVariantStats(enemy.x, enemy.z);
      const rate = zombieMoanPlaybackRate(enemy);

      // Stagger nearby voices so a small pack sounds layered instead of clipped.
      setTimeout(() => {
        if (!enemy.dead && enemy.hp > 0 && canPlayZombieMoan()) {
          stopSoundHandle(enemy.moanHandle);
          const handle = sound('zombieMoan', volume, rate, { variant: stats.kind });
          enemy.moanHandle = handle && typeof handle.stop === 'function' ? handle : null;
          if (enemy.moanHandle) {
            // Keep the mouth open for the actual sound handle duration, so
            // longer procedural moans automatically get longer mouth movement.
            enemy.mouthOpenTimer = Math.max(enemy.mouthOpenTimer || 0, enemy.moanHandle.duration || 1.05);
          }
        }
      }, index * 180);
    });
  }

  function updateEnemies(dt) {
    if (!gunUnlocked() || mission.completed) return;
    nextSpawnTimer -= dt;
    const enemyCap = ENEMY_CAP + hordeLevel * HORDE_CAP_BONUS;
    if (nextSpawnTimer <= 0 && enemies.length < enemyCap) {
      spawnEnemy();
      const pressure = Math.min(1.8, hordeLevel * .18);
      nextSpawnTimer = Math.max(.75, 3.0 + Math.random() * 4.2 + Math.min(7, enemies.length * .25) - pressure);
    }
    for (const e of enemies) {
      e.phase += dt;
      e.attackPose = Math.max(0, (e.attackPose || 0) - dt);
      e.mouthOpenTimer = Math.max(0, (e.mouthOpenTimer || 0) - dt);
      if ((e.emerge || 0) < 1) {
        e.emerge = Math.min(1, (e.emerge || 0) + dt * 1.75);
        const eased = 1 - Math.pow(1 - e.emerge, 2);
        e.y = e.spawnY + (e.targetY - e.spawnY) * eased;
        if (frameCounter % 8 === 0) spawnParticles(e.x, e.targetY - .08, e.z, 1, 22);
        continue;
      }
      const dx = player.pos[0] - e.x, dz = player.pos[2] - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      const targetFace = Math.atan2(dx, -dz);
      e.face = lerpAngle(e.face ?? targetFace, targetFace, Math.min(1, dt * 9));
      let moved = false;
      if (dist < 70) {
        const backingOff = e.retreat > 0;
        moved = moveEnemyToward(e, dx, dz, dist, dt, backingOff);
      }
      const moveTarget = moved ? 1 : 0;
      e.moveBlend = (e.moveBlend || 0) + (moveTarget - (e.moveBlend || 0)) * Math.min(1, dt * (moved ? 9 : 5));
      e.retreat = Math.max(0, (e.retreat || 0) - dt);
      e.attack -= dt;
      const stats = e.variant || enemyVariantStats(e.x, e.z);
      const attackRange = e.big ? 1.82 : (stats.kind === 'speedy' ? 1.42 : 1.58);
      const attackDist = Math.hypot(player.pos[0] - e.x, player.pos[2] - e.z) || 1;
      if (attackDist < attackRange && Math.abs(player.pos[1] - e.y) < 2.25 && e.attack <= 0) {
        if (canDamagePlayer()) damagePlayer(currentZombieDamage(stats.damage));
        e.attack = stats.attackCooldown;
        e.attackPose = .34;
        e.retreat = stats.retreat;
      }
    }
    enemies = enemies.filter(e => {
      const keep = !e.dead && e.hp > 0 && Math.hypot(e.x - player.pos[0], e.z - player.pos[2]) < 130;
      if (!keep) stopEnemySounds(e);
      return keep;
    });
  }

  function canDamagePlayer() {
    return !(deathState.active || worldRebuildState.active || extractionState.active || mission.huntDecisionActive || player.invuln > 0 || isMenuOpen());
  }

  function damagePlayer(amount, impactSound = null) {
    if (!canDamagePlayer()) return false;
    player.health -= amount;
    player.invuln = .45;
    pulseDamage();
    shakeScreen();
    if (impactSound) sound(impactSound);
    if (player.health <= 0) beginDeathSequence();
    else {
      woundGaspTimer = Math.min(woundGaspTimer || 999, 1.2 + Math.random() * 1.8);
      maybeVoiceBitten();
      maybeVoiceLowHealth();
      sound('hurt');
    }
    return true;
  }
  function beginDeathSequence() {
    if (deathState.active || worldRebuildState.active) return;
    clearMovementInput();
    deathState.active = true;
    deathState.timer = 0;
    deathState.ready = false;
    deathState.fadeStarted = false;
    deathState.overlayShown = false;
    deathState.decisionActive = false;
    deathState.reviving = false;
    deathState.reviveTimer = 0;
    deathState.bloodTimer = 0;
    deathState.yaw = player.yaw;
    deathState.pitch = .78;
    deathState.eye = [
      player.pos[0],
      topSolidY(Math.floor(player.pos[0]), Math.floor(player.pos[2])) + .96,
      player.pos[2]
    ];
    if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
    document.body.classList.add('dead', 'death-cinematic');
    document.body.classList.remove('low-health', 'wounded', 'death-fading', 'death-card-ready');
    player.health = 0;
    player.vel = [0, 0, 0];
    cancelReload();
    sound('death');
    showRadioComms(COMMS_DEATH, 5.8);
    spawnDeathBlood(player.pos[0], player.pos[1] + .65, player.pos[2], 36);
    deathTitle.textContent = 'DOWNED';
    deathText.textContent = 'Respond to Mission Command';
    deathStats.textContent = '';
    deathStats.classList.remove('simple');
    renderDeathUnlocks(null);
    hideDeathShare();
    if (deathGiveUp) deathGiveUp.textContent = 'Negative';
    if (deathContinue) deathContinue.textContent = 'Copy';
    const run = {
      kills: player.lifeKills,
      seconds: runSeconds(),
      bestCombo: player.lifeBestCombo
    };
    const unlockedBiomes = recordQuickHuntRun(run);
    if (unlockedBiomes.length) {
      sound('objectiveClear');
    }
    deathFill.style.width = '0%';
    deathOverlay.classList.remove('show', 'ready', 'cinematic', 'awaiting-choice', 'reviving');
    void deathOverlay.offsetWidth;
  }
  function updateDeath(dt) {
    deathState.timer += dt;
    if (deathState.timer < DEATH_BLOOD_DURATION) {
      deathState.bloodTimer -= dt;
      if (deathState.bloodTimer <= 0) {
        spawnDeathBlood(player.pos[0], player.pos[1] + .45, player.pos[2], 6);
        deathState.bloodTimer = .16 + Math.random() * .18;
      }
    }
    updateParticles(dt);
    if (!deathState.fadeStarted && deathState.timer >= DEATH_CINEMATIC_DURATION) {
      deathState.fadeStarted = true;
      document.body.classList.add('death-fading');
      deathOverlay.classList.add('show', 'cinematic');
    }
    if (!deathState.overlayShown && deathState.timer >= DEATH_RESPAWN_START) {
      deathState.overlayShown = true;
      deathState.decisionActive = true;
      document.body.classList.remove('death-cinematic');
      document.body.classList.add('death-card-ready');
      deathOverlay.classList.remove('cinematic');
      deathOverlay.classList.add('ready', 'awaiting-choice');
      showRadioComms(COMMS_DEATH, 6.4);
      void deathOverlay.offsetWidth;
    }
    if (!deathState.reviving) return;
    deathState.reviveTimer += dt;
    const progress = Math.min(1, deathState.reviveTimer / deathState.duration);
    deathFill.style.width = (progress * 100).toFixed(1) + '%';
    const remaining = Math.max(0, deathState.duration - deathState.reviveTimer);
    deathText.textContent = 'Reviving in ' + remaining.toFixed(1) + 's';
    if (progress >= 1) {
      respawn();
    }
  }

  function acceptDeathRevive() {
    if (!deathState.active || !deathState.decisionActive || deathState.reviving) return;
    sound('confirm');
    deathState.decisionActive = false;
    deathState.reviving = true;
    deathState.reviveTimer = 0;
    deathTitle.textContent = 'REVIVING...';
    deathText.textContent = 'Reviving in ' + deathState.duration.toFixed(1) + 's';
    deathFill.style.width = '0%';
    deathOverlay.classList.remove('awaiting-choice');
    deathOverlay.classList.add('reviving');
  }
  function respawn() {
    clearMovementInput();
    deathState.active = false;
    deathState.ready = false;
    deathState.timer = 0;
    deathState.fadeStarted = false;
    deathState.overlayShown = false;
    deathState.decisionActive = false;
    deathState.reviving = false;
    deathState.reviveTimer = 0;
    deathState.bloodTimer = 0;
    player.deaths++;
    player.health = STARTING_HEALTH;
    player.mag = player.magSize;
    player.reserve = Math.max(player.reserve, RESPAWN_RESERVE_FLOOR);
    cancelReload();
    player.shotCooldown = 0;
    mission.bittenVoicePlayed = false;
    mission.lowHealthVoicePlayed = false;
    setWeaponUnlocked(gunUnlocked());
    lastKillTime = -999;
    killComboCount = 0;
    resetLifeStats();
    woundGaspTimer = 0;
    document.body.classList.remove('dead', 'low-health', 'wounded', 'death-cinematic', 'death-fading', 'death-card-ready');
    deathOverlay.classList.remove('show', 'cinematic');
    deathOverlay.classList.remove('ready', 'cinematic', 'awaiting-choice', 'reviving');
    deathStats.textContent = '';
    deathStats.classList.remove('simple');
    renderDeathUnlocks(null);
    hideDeathShare();
    deathTitle.textContent = 'DOWNED';
    deathText.textContent = 'Respond to Mission Command';
    deathFill.style.width = '0%';
    const sx = 0, sz = 0;
    cameraStepOffsetY = 0;
    player.pos = [sx + .5, topSolidY(sx, sz) + 2.2, sz + .5];
    player.vel = [0, 0, 0];
    currentChunkX = 999999;
    currentChunkZ = 999999;
    ensureChunks(true);
    enemies = enemies.filter(e => {
      const keep = Math.hypot(e.x - player.pos[0], e.z - player.pos[2]) > 34;
      if (!keep) stopEnemySounds(e);
      return keep;
    });
    showToast('Revived at the old marker. Deaths: ' + player.deaths);
  }

  function returnToMainMenu(message = 'Awaiting orders.') {
    clearMovementInput();
    deathState.active = false;
    deathState.ready = false;
    deathState.timer = 0;
    deathState.fadeStarted = false;
    deathState.overlayShown = false;
    deathState.decisionActive = false;
    deathState.reviving = false;
    deathState.reviveTimer = 0;
    deathState.bloodTimer = 0;
    extractionState.active = false;
    extractionState.timer = 0;
    extractionState.seed = null;
    mission.huntDecisionActive = false;
    mission.huntDecisionTimer = 0;
    mission.huntDecisionShown = false;
    hideHuntDecisionOverlay();
    woundGaspTimer = 0;
    locked = false;
    if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
    document.body.classList.remove('dead', 'low-health', 'wounded', 'death-cinematic', 'death-fading', 'death-card-ready', 'stage-cleared', 'quick-mode', 'hunt-complete-fade', 'extraction-fade');
    deathOverlay.classList.remove('show', 'ready', 'cinematic', 'awaiting-choice', 'reviving');
    objectiveBriefing.classList.remove('show');
    document.body.classList.remove('briefing-open');
    worldOverlay.classList.remove('show');
    deathStats.textContent = '';
    deathStats.classList.remove('simple');
    renderDeathUnlocks(null);
    hideDeathShare();
    deathTitle.textContent = 'DOWNED';
    deathText.textContent = 'Respond to Mission Command';
    deathFill.style.width = '0%';
    menu.style.display = 'flex';
    mission.quickBiome = 'forest';
    mission.quickGoal = 0;
    updateAmbientSound(true);
    showToast(message);
  }

  function returnToMainMenuFromDeath(message, showQuickPicker = false) {
    sound('confirm');
    deathState.active = false;
    deathState.ready = false;
    deathState.timer = 0;
    deathState.fadeStarted = false;
    deathState.overlayShown = false;
    deathState.decisionActive = false;
    deathState.reviving = false;
    deathState.reviveTimer = 0;
    deathState.bloodTimer = 0;
    extractionState.active = false;
    extractionState.timer = 0;
    extractionState.seed = null;
    mission.huntDecisionActive = false;
    mission.huntDecisionTimer = 0;
    mission.huntDecisionShown = false;
    hideHuntDecisionOverlay();
    woundGaspTimer = 0;
    locked = false;
    if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
    document.body.classList.remove('dead', 'low-health', 'wounded', 'death-cinematic', 'death-fading', 'death-card-ready', 'hunt-complete-fade', 'extraction-fade');
    deathOverlay.classList.remove('show', 'ready', 'cinematic', 'awaiting-choice', 'reviving');
    worldOverlay.classList.remove('show');
    deathStats.textContent = '';
    deathStats.classList.remove('simple');
    renderDeathUnlocks(null);
    hideDeathShare();
    deathTitle.textContent = 'DOWNED';
    deathText.textContent = 'Respond to Mission Command';
    deathFill.style.width = '0%';
    menu.style.display = 'flex';
    mission.quickBiome = 'forest';
    mission.quickGoal = 0;
    document.body.classList.remove('quick-mode');
    updateAmbientSound(true);
    showToast(message);
  }

  function giveUpMission() {
    if (!deathState.active) return;
    returnToMainMenuFromDeath('Signal lost. Awaiting next hunt.', false);
  }

  function startReload() {
    if (!gunUnlocked()) return;
    if (deathState.active || worldRebuildState.active || extractionState.active || mission.huntDecisionActive) return;
    if (player.reloading || player.mag >= player.magSize || player.reserve <= 0) return;
    const need = player.magSize - player.mag;
    const total = Math.min(need, player.reserve);
    if (total <= 0) return;
    player.reloading = true;
    player.reloadTimer = 0;
    player.reloadDuration = Math.max(0.08, currentReloadTime());
    player.reloadTotal = total;
    player.reloadInitialMag = player.mag;
    reloadOverlay.classList.add('show');
    reloadOverlayFill.style.width = '0%';
    if (gunSprite) gunSprite.classList.add('reloading');
    sound('reloadStart');
  }

  function finishReload() {
    const add = Math.max(0, Math.min(player.reserve, player.reloadTotal, player.magSize - player.mag));
    if (add > 0) {
      player.mag += add;
      player.reserve -= add;
    }
    player.reloading = false;
    player.reloadTimer = 0;
    player.reloadDuration = 0;
    player.reloadTotal = 0;
    player.reloadInitialMag = player.mag;
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
    if (gunSprite) gunSprite.classList.remove('reloading');
    sound('reloadDone');
    updateAmmoDisplay();
  }

  function cancelReload() {
    player.reloading = false;
    player.reloadTimer = 0;
    player.reloadDuration = 0;
    player.reloadTotal = 0;
    player.reloadInitialMag = player.mag;
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
    if (gunSprite) gunSprite.classList.remove('reloading');
    updateAmmoDisplay();
  }

  function updateWeaponReload(dt) {
    if (!player.reloading) return;
    player.reloadTimer += dt;
    const duration = Math.max(0.01, player.reloadDuration || currentReloadTime());
    const progress = Math.max(0, Math.min(1, player.reloadTimer / duration));
    reloadOverlayFill.style.width = (progress * 100).toFixed(1) + '%';
    if (player.reloadTimer >= duration) finishReload();
  }

  function applyShotRecoil() {
    const amount = currentRecoilAmount();
    if (amount <= 0) return;
    const angle = Math.random() * Math.PI * 2;
    const distance = amount * (0.35 + Math.random() * 0.65);
    player.yaw += Math.cos(angle) * distance;
    player.pitch += Math.sin(angle) * distance * 0.72;
    const cap = Math.PI / 2 - 0.03;
    player.pitch = Math.max(-cap, Math.min(cap, player.pitch));
  }

  function entityHitAt(px, py, pz) {
    for (const e of enemies) {
      if (e.dead || e.hp <= 0) continue;
      const scale = (e.variant && e.variant.scale) || (e.big ? 1.18 : 1);
      const sx = .58 * scale;
      const top = e.y + 2.02 * scale;
      const headLine = e.y + 1.26 * scale;
      if (Math.abs(px - e.x) < sx && Math.abs(pz - e.z) < sx && py >= e.y && py <= top) return { enemy: e, head: py >= headLine };
    }
    return null;
  }
  function raycastProjectile(maxDist) {
    const e = eyePos();
    const d = lookDir();
    for (let t = 0; t <= maxDist; t += 0.065) {
      const px = e[0] + d[0] * t;
      const py = e[1] + d[1] * t;
      const pz = e[2] + d[2] * t;
      const hitEnemy = entityHitAt(px, py, pz);
      if (hitEnemy) return { kind: 'enemy', enemy: hitEnemy.enemy, head: hitEnemy.head, point: [px, py, pz], dist: t };
      const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz);
      const type = getBlock(bx, by, bz);
      if (type && type !== BLOCK.WATER) return { kind: 'surface', type, point: [px, py, pz], dist: t };
    }
    return { kind: 'miss', point: [e[0] + d[0] * maxDist, e[1] + d[1] * maxDist, e[2] + d[2] * maxDist] };
  }

  function enemyAimTarget(maxDist = 58) {
    if (!gunUnlocked() || deathState.active || worldRebuildState.active || mission.insertionActive || isMenuOpen()) return null;
    const eye = eyePos();
    const dir = lookDir();
    let best = null;

    for (const enemy of enemies) {
      if (enemy.dead || enemy.hp <= 0 || (enemy.emerge || 0) < 1) continue;
      const scale = (enemy.variant && enemy.variant.scale) || (enemy.big ? 1.18 : 1);
      const cx = enemy.x;
      const cy = enemy.y + 1.08 * scale;
      const cz = enemy.z;
      const vx = cx - eye[0];
      const vy = cy - eye[1];
      const vz = cz - eye[2];
      const along = vx * dir[0] + vy * dir[1] + vz * dir[2];
      if (along <= 0 || along > maxDist) continue;

      const closestX = eye[0] + dir[0] * along;
      const closestY = eye[1] + dir[1] * along;
      const closestZ = eye[2] + dir[2] * along;
      const miss = Math.hypot(cx - closestX, cy - closestY, cz - closestZ);
      if (miss > 0.64 * scale) continue;
      if (!best || along < best.dist) best = { enemy, dist: along };
    }

    if (!best) return null;
    for (let t = 0; t < best.dist - 0.2; t += 0.28) {
      const bx = Math.floor(eye[0] + dir[0] * t);
      const by = Math.floor(eye[1] + dir[1] * t);
      const bz = Math.floor(eye[2] + dir[2] * t);
      const type = getBlock(bx, by, bz);
      if (type && type !== BLOCK.WATER) return null;
    }
    return best;
  }

  function updateReticleTargeting() {
    setReticleOnTarget(!!enemyAimTarget());
  }

  function spawnEnemyDrop(enemy) {
    const dropRoll = Math.random();
    const x = Math.floor(enemy.x);
    const y = Math.floor(enemy.y);
    const z = Math.floor(enemy.z);
    if (dropRoll < ENEMY_C4_DROP_CHANCE) spawnPickupAt(x, y, z, 'c4');
    else if (dropRoll < ENEMY_ANY_DROP_CHANCE) spawnPickupAt(x, y, z, 'ammo');
  }

  function registerEnemyKill(enemy, options = {}) {
    if (!enemy || enemy.dead) return false;
    enemy.dead = true;
    enemy.hp = 0;
    stopEnemySounds(enemy);
    const dist = options.dist || Math.hypot(enemy.x - player.pos[0], enemy.z - player.pos[2]);
    player.kills++;
    player.lifeKills++;
    player.lifeLongestShot = Math.max(player.lifeLongestShot, dist);
    if (options.headshot) {
      player.headshots++;
      player.lifeHeadshots++;
    }
    pulseHitMarker('kill');
    spawnKillBurst(enemy.x, enemy.y + 1.1, enemy.z, enemy.big);
    if (options.source === 'c4') {
      player.score += 125;
      scorePop('+125 C4 BLAST', 'combo small');
    } else if (options.headshot) {
      player.score += 150;
      scorePop('+150 HEADSHOT KILL', 'head');
    } else {
      player.score += 100;
      scorePop('+100 ENEMY DOWN', 'kill');
    }
    if (dist >= LONG_RANGE_KILL_DIST) {
      player.score += 200;
      scorePop('+200 LONG RANGE', 'range small');
      maybeVoiceLongRangeKill(dist);
    }
    const streak = player.lifeKills;
    player.lifeBestCombo = Math.max(player.lifeBestCombo, streak);
    let perkRewardKill = false;
    if (streak > 0 && streak % 5 === 0) {
      player.score += 250;
      perkRewardKill = spawnKillStreakPerk(enemy, streak);
    }
    lastKillTime = performance.now() / 1000;
    killComboCount = streak;
    sound('kill');
    maybeVoiceFewMore();
    checkHordeLevel();
    if (!perkRewardKill) spawnEnemyDrop(enemy);
    return true;
  }

  function shoot() {
    if (deathState.active || extractionState.active || mission.huntDecisionActive) return;
    if (!gunUnlocked()) {
      showToast('Weapon unavailable.');
      return;
    }
    if (player.reloading) return;
    if (player.shotCooldown > 0) return;
    if (player.mag <= 0) { showToast('Empty. Reload.'); sound('empty'); startReload(); return; }
    player.mag--;
    player.shotCooldown = currentFireCooldown();
    gunSprite.classList.remove('shooting');
    void gunSprite.offsetWidth;
    gunSprite.classList.add('shooting');
    setTimeout(() => gunSprite.classList.remove('shooting'), 120);
    triggerMuzzleFx();
    triggerCrosshairFlash('shot');
    sound('shoot');
    const hit = raycastProjectile(58);
    applyShotRecoil();
    if (hit.kind === 'enemy') {
      const wasHeadshot = hit.head;
      const damage = wasHeadshot ? hit.enemy.hp : 28;
      hit.enemy.hp -= damage;
      spawnParticles(hit.point[0], hit.point[1], hit.point[2], wasHeadshot ? 12 : 8, wasHeadshot ? 12 : 15);
      sound(wasHeadshot ? 'head' : 'hit');
      if (hit.enemy.hp <= 0) {
        registerEnemyKill(hit.enemy, { headshot: wasHeadshot, dist: hit.dist, source: 'shot' });
        showToast('Enemy down. Kills: ' + player.kills);
        checkMissionCompletion();
      } else {
        pulseHitMarker('hit');
      }
    } else if (hit.kind === 'surface') {
      spawnParticles(hit.point[0], hit.point[1], hit.point[2], 5, hit.type);
      sound('block');
    }
    if (player.mag <= 0 && player.reserve > 0) startReload();
  }

  function spawnParticles(x, y, z, count, type) {
    for (let i = 0; i < count; i++) {
      particles.push({ x, y, z, vx: (Math.random() - .5) * 5, vy: Math.random() * 3.8, vz: (Math.random() - .5) * 5, life: .35 + Math.random() * .35, type });
    }
  }

  function spawnDeathBlood(x, y, z, count = 14) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * 3.4;
      particles.push({
        x: x + (Math.random() - .5) * .55,
        y: y + Math.random() * .5,
        z: z + (Math.random() - .5) * .55,
        vx: Math.cos(angle) * speed,
        vy: .6 + Math.random() * 3.1,
        vz: Math.sin(angle) * speed,
        life: .75 + Math.random() * .65,
        type: 12
      });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 7 * dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function landC4Charge(charge) {
    const x = Math.floor(Math.max(WORLD_MIN, Math.min(WORLD_MAX, charge.x)));
    const z = Math.floor(Math.max(WORLD_MIN, Math.min(WORLD_MAX, charge.z)));
    const y = pickupAirY(x, z);
    if (y <= WATER_LEVEL + 1 || blocksMovement(getBlock(x, y, z)) || blocksMovement(getBlock(x, y + 1, z))) {
      charge.triggered = true;
      return false;
    }
    charge.x = x + .5;
    charge.y = y + .04;
    charge.z = z + .5;
    charge.vx = 0;
    charge.vy = 0;
    charge.vz = 0;
    charge.airborne = false;
    charge.armed = .28;
    return true;
  }

  function placeC4() {
    if (deathState.active || worldRebuildState.active || extractionState.active || mission.huntDecisionActive || mission.insertionActive || isBriefingOpen() || isUpgradeOpen()) return;
    if (!gunUnlocked()) {
      showToast('C4 locked until combat starts.');
      sound('empty');
      return;
    }
    if (player.c4 <= 0) {
      showToast('No C4 equipped.');
      sound('empty');
      return;
    }
    const forward = [Math.sin(player.yaw), Math.cos(player.yaw)];
    player.c4--;
    c4Charges.push({
      x: player.pos[0] + forward[0] * .45,
      y: player.pos[1] + 1.25,
      z: player.pos[2] + forward[1] * .45,
      vx: forward[0] * 3.8,
      vy: 3.35,
      vz: forward[1] * 3.8,
      airborne: true,
      armed: 999,
      phase: Math.random() * Math.PI * 2
    });
    showToast('C4 tossed. Lure infected into it.');
    scorePop('C4 TOSSED', 'pickup small');
    sound('pickupAmmo');
  }

  function detonateC4(charge) {
    const radius = 5.4;
    let killed = 0;
    for (let i = 0; i < 34; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.2 + Math.random() * 7.2;
      particles.push({
        x: charge.x,
        y: charge.y + .18,
        z: charge.z,
        vx: Math.cos(angle) * speed,
        vy: 1.4 + Math.random() * 5.2,
        vz: Math.sin(angle) * speed,
        life: .36 + Math.random() * .58,
        type: i % 4 === 0 ? 24 : (i % 3 === 0 ? 14 : 15)
      });
    }
    for (const e of enemies) {
      if (e.dead || e.hp <= 0) continue;
      const dist = Math.hypot(e.x - charge.x, e.z - charge.z);
      if (dist > radius || Math.abs(e.y - charge.y) > 4.2) continue;
      const damage = 220 * (1 - dist / radius) + 70;
      e.hp -= damage;
      spawnParticles(e.x, e.y + 1.0, e.z, 8, 15);
      if (e.hp <= 0 && registerEnemyKill(e, { source: 'c4', dist })) killed++;
    }
    shakeScreen();
    sound('explosion');
    if (killed) {
      showToast('C4 blast cleared ' + killed + ' infected.');
      checkMissionCompletion();
    }
    enemies = enemies.filter(e => {
      const keep = !e.dead && e.hp > 0;
      if (!keep) stopEnemySounds(e);
      return keep;
    });
  }

  function updateC4Charges(dt) {
    if (!c4Charges.length) return;
    for (const charge of c4Charges) {
      if (charge.airborne) {
        charge.x += (charge.vx || 0) * dt;
        charge.y += (charge.vy || 0) * dt;
        charge.z += (charge.vz || 0) * dt;
        charge.vy = (charge.vy || 0) - 10.5 * dt;
        charge.vx = (charge.vx || 0) * Math.max(0, 1 - dt * .45);
        charge.vz = (charge.vz || 0) * Math.max(0, 1 - dt * .45);

        const x = Math.floor(Math.max(WORLD_MIN, Math.min(WORLD_MAX, charge.x)));
        const z = Math.floor(Math.max(WORLD_MIN, Math.min(WORLD_MAX, charge.z)));
        const floorY = pickupAirY(x, z) + .04;
        const blocked = blocksMovement(getBlock(x, Math.floor(charge.y), z));
        if (charge.x <= WORLD_MIN || charge.x >= WORLD_MAX || charge.z <= WORLD_MIN || charge.z >= WORLD_MAX || charge.y <= floorY || blocked) {
          landC4Charge(charge);
        }
        if (charge.airborne) continue;
      }
      charge.armed = Math.max(0, (charge.armed || 0) - dt);
      if (charge.triggered || charge.armed > 0) continue;
      for (const e of enemies) {
        if (e.dead || e.hp <= 0 || (e.emerge || 0) < 1) continue;
        if (Math.hypot(e.x - charge.x, e.z - charge.z) < .92 && Math.abs(e.y - charge.y) < 2.3) {
          charge.triggered = true;
          break;
        }
      }
    }
    const detonating = c4Charges.filter(c => c.triggered);
    c4Charges = c4Charges.filter(c => !c.triggered);
    for (const charge of detonating) detonateC4(charge);
  }

  function updatePickups(dt) {
    for (const p of pickups) {
      if (p.kind === 'perk') emitPerkSmoke(p, dt);
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
          showToast('Health +' + Math.round(healed), false, 'health');
          scorePop('+' + Math.round(healed) + ' HEALTH', 'pickup health');
          sound('pickupHealth');
          spawnParticles(p.x, p.y + .3, p.z, 10, 17);
        } else if (p.kind === 'c4') {
          player.c4 += p.amount;
          p.collected = true;
          showToast('C4 +' + p.amount, false, 'c4');
          scorePop('+' + p.amount + ' C4', 'pickup c4');
          sound('pickupC4');
          spawnParticles(p.x, p.y + .2, p.z, 10, 24);
        } else if (p.kind === 'perk') {
          const perkId = p.perkId && !activePerks[p.perkId] ? p.perkId : nextPerkId(p.x, p.z);
          p.collected = true;
          if (perkId) {
            equipPerk(perkId);
            spawnParticles(p.x, p.y + .28, p.z, 14, 42);
          } else {
            showToast('All perks already equipped.', false, 'perk');
          }
        } else {
          player.reserve += p.amount;
          p.collected = true;
          showToast('Ammo +' + p.amount, false, 'ammo');
          scorePop('+' + p.amount + ' AMMO PICKUP', 'pickup ammo');
          sound('pickupAmmo');
        }
      }
    }
    pickups = pickups.filter(p => !p.collected && Math.hypot(p.x - player.pos[0], p.z - player.pos[2]) < 120);
  }

  function emitPerkSmoke(p, dt) {
    p.smokeTimer = (p.smokeTimer || 0) - dt;
    if (p.smokeTimer > 0) return;
    p.smokeTimer = .10 + Math.random() * .08;
    for (let i = 0; i < 1; i++) {
      particles.push({
        x: p.x + (Math.random() - .5) * .32,
        y: p.y + .12 + Math.random() * .18,
        z: p.z + (Math.random() - .5) * .32,
        vx: (Math.random() - .5) * .32,
        vy: .55 + Math.random() * .65,
        vz: (Math.random() - .5) * .32,
        life: .8 + Math.random() * .45,
        type: 42
      });
    }
  }


  function playerIsTouchingWater() {
  const x = Math.floor(player.pos[0]);
  const z = Math.floor(player.pos[2]);

  // Check feet/legs area. Player position is near the bottom of the player body.
  const footY = Math.floor(player.pos[1] - 0.05);
  const legY = Math.floor(player.pos[1] + 0.45);

  return getBlock(x, footY, z) === BLOCK.WATER ||
         getBlock(x, legY, z) === BLOCK.WATER ||
         playerIsInVisualOcean();
}

  function playerIsInVisualOcean() {
    if (!OCEAN_ENABLED) return false;
    const outsideIsland = player.pos[0] < WORLD_MIN || player.pos[0] > WORLD_MAX + 1 ||
      player.pos[2] < WORLD_MIN || player.pos[2] > WORLD_MAX + 1;
    return outsideIsland && player.pos[1] <= WATER_LEVEL + 1.15;
  }

  function updateWaterHazard(dt) {
    if (
      !currentWaterIsDangerous() ||
      mission.insertionActive ||
      deathState.active ||
      worldRebuildState.active ||
      isMenuOpen()
    ) {
      waterDamageTimer = 0;
      return;
    }
  
    if (!playerIsTouchingWater()) {
      waterDamageTimer = 0;
      return;
    }
  
    waterDamageTimer -= dt;
    if (waterDamageTimer > 0) return;
  
    waterDamageTimer = 0.65;
    damagePlayer(8);
  }
    

  function gunUnlocked() {
    return mission.phase === PHASE_ZOMBIE_THREAT;
  }

  function setWeaponUnlocked(unlocked) {
    document.body.classList.toggle('no-gun', !unlocked);
    document.body.classList.toggle('action-mode', false);
    if (touchShoot) {
      touchShoot.textContent = '';
      touchShoot.setAttribute('aria-label', unlocked ? 'Shoot' : 'Blaster locked');
    }
    if (unlocked) {
      player.mag = player.magSize;
      player.reserve = Math.max(player.reserve, STARTING_RESERVE);
      player.shotCooldown = 0;
      updateAmmoDisplay();
    } else {
      cancelReload();
      player.shotCooldown = 0;
    }
  }

  function updateShootButtonState() {
    if (!touchShoot) return;
    const unlocked = gunUnlocked();
    const ready = !mission.insertionActive && unlocked;
    touchShoot.classList.toggle('unavailable', !ready);
    touchShoot.setAttribute('aria-disabled', ready ? 'false' : 'true');
  }

  function updateC4ButtonState() {
    const ready = gunUnlocked() && !mission.insertionActive && player.c4 > 0;
    if (touchC4) {
      touchC4.dataset.count = String(player.c4);
      touchC4.classList.toggle('unavailable', !ready);
      touchC4.setAttribute('aria-disabled', ready ? 'false' : 'true');
      touchC4.setAttribute('aria-label', ready ? 'Place C4 charge' : 'No C4 available');
    }
    if (c4Hud && c4HudCount) {
      c4Hud.hidden = !gunUnlocked();
      c4Hud.classList.toggle('empty', player.c4 <= 0);
      c4HudCount.textContent = String(player.c4);
    }
  }

  function beginTouchShoot() {
    if (mission.insertionActive) return;
    if (gunUnlocked()) {
      shoot();
      return;
    }
    showToast('Find the translucent yellow shutdown block at the source.');
  }

  function spawnInitialWave() {
    if (mission.firstWaveSpawned) return;
    mission.firstWaveSpawned = true;
    for (let i = 0; i < FIRST_WAVE_SIZE; i++) spawnEnemy();
    nextSpawnTimer = 4.5;
  }

  function clearRemainingMissionEnemies() {
    const survivors = enemies.filter(e => e.hp > 0);
    if (!survivors.length) {
      enemies.forEach(stopEnemySounds);
      enemies = [];
      return;
    }
    for (const e of survivors) {
      stopEnemySounds(e);
      spawnKillBurst(e.x, e.y + 1.1, e.z, e.big);
    }
    enemies = [];
    scorePop('INFECTED PURGED', 'wave small');
  }

  function completeQuickHunt() {
    if (mission.completed) return;
    mission.completed = true;
    nextSpawnTimer = 999;
    clearRemainingMissionEnemies();
    const run = {
      kills: player.lifeKills,
      seconds: runSeconds(),
      bestCombo: player.lifeBestCombo
    };
    recordQuickHuntRun(run);
    sound('objectiveClear');
    scorePop('HUNT COMPLETE', 'wave');
    beginHuntCompleteDecision();
  }

  function checkMissionCompletion() {
    if (mission.phase !== PHASE_ZOMBIE_THREAT) return;
    if (player.kills >= currentInfectedGoal()) completeQuickHunt();
  }

  function spawnThrownPickup(x, y, z, kind, angle, force = 4.2) {
    if (kind === 'health') return false;
    pickups.push({
      x,
      y,
      z,
      vx: Math.cos(angle) * force,
      vy: 4.2 + seededHash(x * 4.2, z * 7.1) * 1.8,
      vz: Math.sin(angle) * force,
      kind,
      amount: AMMO_PICKUP_ROUNDS,
      bob: seededHash(x * 5.1, z * 9.3) * 10
    });
    return true;
  }

  function setKillHud(show, count) {
    if (!killHud || !killHudCount) return;
    killHud.hidden = !show;
    if (show) killHudCount.textContent = String(Math.max(0, Math.floor(count)));
  }

  function updateMissionHud() {
    if (!objectiveText || !objectiveMeta) return;
    document.body.classList.toggle('stage-cleared', mission.completed);
    document.body.classList.add('quick-mode');
    const count = Math.max(0, currentInfectedGoal() - player.kills);
    setKillHud(true, count);
    objectiveText.textContent = '';
    objectiveMeta.textContent = mission.completed ? 'Hunt complete' : 'Remaining';
  }

  function update(dt) {
    updateAmbientSound();
    updateCommandBanner(dt);
    updateReticleTargeting();
    if (updatePortraitPauseState()) {
      updateHud();
      return;
    }
    if (worldRebuildState.active) {
      updateWorldRebuild(dt);
      updateHud();
      return;
    }
    if (extractionState.active) {
      updateExtractionRedeploy(dt);
      updateHud();
      return;
    }
    if (mission.huntDecisionActive) {
      updateHuntDecision(dt);
      updateHud();
      return;
    }
    if (isBriefingOpen()) {
      updateHud();
      updateParticles(dt);
      return;
    }
    if (isUpgradeOpen()) {
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
    if (player.shotCooldown > 0) player.shotCooldown -= dt;
    updateWeaponReload(dt);
    updateMovement(dt);
    updateWaterHazard(dt);
    updateLowHealthFeedback(dt);
    updateEnemies(dt);
    updateZombieMoans(dt);
    updateC4Charges(dt);
    updateAmmoMercyDrops(dt);
    updatePickups(dt);
    updateParticles(dt);
    updateHud();
  }

  function updateAmmoDisplay() {
    const bullets = bulletRack.children;
    for (let i = 0; i < player.magSize; i++) {
      bullets[i].classList.toggle('spent', i >= player.mag);
    }
    if (clipText) clipText.textContent = String(player.mag);
    if (reserveText) reserveText.textContent = String(player.reserve);
    weaponPanel.classList.toggle('reloading', player.reloading);
  }

  function updateHud() {
    const hpNow = Math.max(0, Math.round(player.health));
    healthBigText.textContent = hpNow + '%';
    healthStatus.className = hpNow < 35 ? 'danger' : (hpNow < 65 ? 'warn' : '');
    healthBigFill.style.width = Math.max(0, player.health) + '%';
    updateAmmoDisplay();
    updateMissionHud();
    updateFieldStatus(hpNow);
    updateShootButtonState();
    updateC4ButtonState();
  }

  function updateFieldStatus(hpNow) {
    if (!fieldSignal || !fieldStatusText) return;
    let label = 'STANDBY';
    let tone = '';
    if (deathState.active || hpNow <= 0) {
      label = 'OPERATOR OFFLINE';
      tone = 'danger';
    } else if (hpNow < STARTING_HEALTH) {
      label = 'OPERATOR WOUNDED';
      tone = 'danger';
    } else if (hpNow < LOW_HEALTH_THRESHOLD) {
      label = 'VITALS CRITICAL';
      tone = 'danger';
    } else if (worldRebuildState.active) {
      label = 'WORLD REBUILD';
      tone = 'warn';
    } else if (player.reloading) {
      label = 'RELOADING';
      tone = 'warn';
    } else if (mission.insertionActive) {
      label = 'INSERTION ACTIVE';
      tone = 'warn';
    } else if (mission.completed) {
      label = 'SECTOR SECURED';
    } else if (mission.phase === PHASE_ZOMBIE_THREAT) {
      label = 'INFECTED CONTACT';
      tone = 'danger';
    } else if (mission.objectiveAcknowledged) {
      label = 'TOXIN ALERT';
      tone = 'warn';
    }
    fieldStatusText.textContent = label;
    fieldSignal.className = 'fieldSignal' + (tone ? ' ' + tone : '');
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
    const x = p.x, z = p.z, red = 17;
    pushBox(arr, x - .34, y, z - .34, .68, .38, .68, 37);
    pushBox(arr, x - .30, y + .38, z - .30, .60, .12, .60, 38);
    pushBox(arr, x - .36, y + .16, z - .06, .72, .10, .12, 14);
    pushBox(arr, x - .06, y + .16, z - .36, .12, .10, .72, 14);
    pushBox(arr, x - .26, y + .08, z - .355, .18, .12, .03, red);
    pushBox(arr, x + .08, y + .21, z - .356, .18, .11, .03, red);
    pushBox(arr, x - .355, y + .20, z + .06, .03, .10, .22, red);
    pushBox(arr, x + .325, y + .06, z - .28, .03, .12, .24, red);
    pushBox(arr, x - .18, y + .50, z - .05, .36, .08, .10, red);
    pushBox(arr, x - .05, y + .50, z - .18, .10, .08, .36, red);
  }

  function pushAmmoPickup(arr, p, y) {
    const x = p.x, z = p.z;
    pushBox(arr, x - .34, y, z - .34, .68, .38, .68, 37);
    pushBox(arr, x - .30, y + .38, z - .30, .60, .12, .60, 38);
    pushBox(arr, x - .36, y + .16, z - .06, .72, .10, .12, 14);
    pushBox(arr, x - .06, y + .16, z - .36, .12, .10, .72, 14);
    pushBox(arr, x - .27, y + .08, z - .355, .20, .12, .03, 38);
    pushBox(arr, x + .08, y + .21, z - .356, .18, .11, .03, 6);
    pushBox(arr, x - .355, y + .20, z + .06, .03, .10, .22, 38);
    pushBox(arr, x + .325, y + .06, z - .28, .03, .12, .24, 6);
    pushBox(arr, x - .18, y + .50, z - .04, .36, .08, .08, 14);
  }

  function pushC4Pickup(arr, p, y) {
    const x = p.x, z = p.z;
    pushBox(arr, x - .34, y, z - .34, .68, .38, .68, 37);
    pushBox(arr, x - .30, y + .38, z - .30, .60, .12, .60, 38);
    pushBox(arr, x - .36, y + .16, z - .06, .72, .10, .12, 14);
    pushBox(arr, x - .06, y + .16, z - .36, .12, .10, .72, 14);
    pushBox(arr, x - .27, y + .08, z - .355, .20, .12, .03, 13);
    pushBox(arr, x + .08, y + .21, z - .356, .18, .11, .03, 13);
    pushBox(arr, x - .355, y + .20, z + .06, .03, .10, .22, 13);
    pushBox(arr, x + .325, y + .06, z - .28, .03, .12, .24, 13);
    pushBox(arr, x - .24, y + .50, z - .05, .48, .08, .10, 13);
    pushBox(arr, x - .05, y + .50, z - .24, .10, .08, .48, 13);
  }

  function pushPerkPickup(arr, p, y) {
    const x = p.x, z = p.z;
    pushBox(arr, x - .34, y, z - .34, .68, .38, .68, 37);
    pushBox(arr, x - .30, y + .38, z - .30, .60, .12, .60, 38);
    pushBox(arr, x - .36, y + .16, z - .06, .72, .10, .12, 14);
    pushBox(arr, x - .06, y + .16, z - .36, .12, .10, .72, 14);
    pushBox(arr, x - .27, y + .08, z - .355, .20, .12, .03, 42);
    pushBox(arr, x + .08, y + .21, z - .356, .18, .11, .03, 42);
    pushBox(arr, x - .355, y + .20, z + .06, .03, .10, .22, 42);
    pushBox(arr, x + .325, y + .06, z - .28, .03, .12, .24, 42);
    pushBox(arr, x - .20, y + .50, z - .20, .40, .07, .40, 42);
    pushBox(arr, x - .11, y + .57, z - .11, .22, .06, .22, 14);
  }

  function pushC4Charge(arr, p, y) {
    const x = p.x, z = p.z;
    pushBox(arr, x - .38, y, z - .38, .76, .14, .76, 14);
    pushBox(arr, x - .42, y + .04, z - .42, .84, .06, .08, 36);
    pushBox(arr, x - .42, y + .04, z + .34, .84, .06, .08, 36);
    pushBox(arr, x - .42, y + .04, z - .34, .08, .06, .68, 36);
    pushBox(arr, x + .34, y + .04, z - .34, .08, .06, .68, 36);
    pushBox(arr, x - .29, y + .145, z - .32, .18, .035, .08, 13);
    pushBox(arr, x + .11, y + .145, z - .32, .18, .035, .08, 13);
    pushBox(arr, x - .29, y + .145, z + .24, .18, .035, .08, 13);
    pushBox(arr, x + .11, y + .145, z + .24, .18, .035, .08, 13);
    pushBox(arr, x - .10, y + .14, z - .10, .20, .035, .20, 24);
  }

  function buildDynamicMesh(time) {
    const arr = [];
    for (const e of enemies) {
      const stats = e.variant || enemyVariantStats(e.x, e.z);
      const scale = stats.scale || 1;
      const bob = Math.sin(e.phase * 5) * .05;
      const x = e.x, y = e.y + bob, z = e.z;
      // Rotated block-monster silhouette: it turns as it moves, so the eye face points at you.
      const yaw = e.face ?? Math.atan2(player.pos[0] - e.x, -(player.pos[2] - e.z));
      const bodyType = stats.bodyType || 10;
      const limbType = stats.limbType || 11;
      const blinkCycle = 2.7 + (e.blinkSeed || 0) * 2.2;
      const blinkPhase = (time + (e.blinkSeed || 0) * 9.0) % blinkCycle;
      const doubleBlink = (e.blinkSeed || 0) > .68 && blinkPhase > .20 && blinkPhase < .30;
      const blinking = blinkPhase < .10 || doubleBlink;
      const eyeType = blinking ? 21 : (stats.eyeType || 12);
      const mouthOpen = (e.mouthOpenTimer || 0) > 0;
      const moveBlend = Math.max(0, Math.min(1, e.moveBlend || 0));
      const walkRate = stats.kind === 'speedy' ? 7.4 : (stats.kind === 'brute' ? 4.2 : 5.4);
      const walkSwing = Math.sin(e.phase * walkRate) * .52 * moveBlend;
      const playerDistance = Math.hypot(player.pos[0] - e.x, player.pos[2] - e.z);
      const reach = Math.max(0, Math.min(1, (6 - playerDistance) / 4));
      const attackProgress = 1 - Math.max(0, Math.min(1, (e.attackPose || 0) / .34));
      const attackReach = (e.attackPose || 0) > 0 ? Math.sin(attackProgress * Math.PI) : 0;
      const idleSway = Math.sin(time * 1.7 + (e.blinkSeed || 0) * 8) * .035;
      const armBase = .16 + reach * .84 + idleSway;
      const armSwingScale = 1 - reach * .72;
      const leftArmPitch = armBase + walkSwing * armSwingScale + attackReach * (1.42 - armBase);
      const rightArmPitch = armBase - walkSwing * armSwingScale + attackReach * (1.42 - armBase);
      const elbowBend = .30 * (1 - reach) * (1 - attackReach);
      pushBoxY(arr, x, y, z, -.18*scale, 0, -.18*scale, .22*scale, .45*scale, .22*scale, yaw, limbType);
      pushBoxY(arr, x, y, z,  .02*scale, 0, -.18*scale, .22*scale, .45*scale, .22*scale, yaw, limbType);
      pushBoxY(arr, x, y, z, -.18*scale, 0,  .02*scale, .22*scale, .45*scale, .22*scale, yaw, limbType);
      pushBoxY(arr, x, y, z,  .02*scale, 0,  .02*scale, .22*scale, .45*scale, .22*scale, yaw, limbType);
      pushBoxY(arr, x, y, z, -.34*scale, .36*scale, -.24*scale, .68*scale, .95*scale, .48*scale, yaw, bodyType);
      pushZombieArm(arr, x, y, z, -.45*scale, leftArmPitch, elbowBend, yaw, scale, bodyType);
      pushZombieArm(arr, x, y, z,  .45*scale, rightArmPitch, elbowBend, yaw, scale, bodyType);
      pushBoxY(arr, x, y, z, -.42*scale, 1.22*scale, -.35*scale, .84*scale, .78*scale, .70*scale, yaw, bodyType);
      pushBoxY(arr, x, y, z, -.22*scale, 1.62*scale, -.39*scale, .12*scale, .12*scale, .06*scale, yaw, eyeType);
      pushBoxY(arr, x, y, z,  .10*scale, 1.62*scale, -.39*scale, .12*scale, .12*scale, .06*scale, yaw, eyeType);
      if (mouthOpen) {
        pushBoxY(arr, x, y, z, -.13*scale, 1.33*scale, -.392*scale, .26*scale, .18*scale, .055*scale, yaw, 39);
        pushBoxY(arr, x, y, z, -.12*scale, 1.46*scale, -.405*scale, .07*scale, .06*scale, .04*scale, yaw, 40);
        pushBoxY(arr, x, y, z,  .05*scale, 1.46*scale, -.405*scale, .07*scale, .06*scale, .04*scale, yaw, 40);
      } else {
        pushBoxY(arr, x, y, z, -.13*scale, 1.39*scale, -.392*scale, .26*scale, .045*scale, .055*scale, yaw, 39);
      }
    }
    for (const p of pickups) {
      const y = p.y + Math.sin(p.bob) * .16;
      if (p.kind === 'health') {
        pushHealthPickup(arr, p, y);
      } else if (p.kind === 'c4') {
        pushC4Pickup(arr, p, y);
      } else if (p.kind === 'perk') {
        pushPerkPickup(arr, p, y);
      } else {
        pushAmmoPickup(arr, p, y);
      }
    }
    for (const c of c4Charges) {
      pushC4Charge(arr, c, c.y);
    }
    for (const p of particles) {
      const s = .07 + p.life * .05;
      pushBox(arr, p.x - s/2, p.y - s/2, p.z - s/2, s, s, s, p.type || 15);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, dynamicBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.DYNAMIC_DRAW);
    meshes.dynamic = { buffer: dynamicBuffer, count: arr.length / 9 };
  }

 function biomeUsesRedWater(biome = currentBiome()) {
  return biome === 'rocky' || biome === 'ashlands';
}

function biomeUsesSwampWater(biome = currentBiome()) {
  return biome === 'swamp';
}

function getWaterStyleForBiome(biome = currentBiome()) {
  // 0 = blue water
  // 1 = red lava water
  // 2 = green swamp water

  if (biomeUsesSwampWater(biome)) return 2;
  if (biomeUsesRedWater(biome)) return 1;
  return 0;
}

function currentWaterIsDangerous() {
  return GAME_OPTIONS.dangerousWater && getWaterStyleForBiome() === 1;
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
    clearSkyGradient(sky);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    const aspect = canvas.width / canvas.height;
    const proj = mat4Perspective(Math.PI / 3, aspect, 0.06, 170);
    const e = renderEyePos();
    const d = renderLookDir();
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
    gl.uniform1f(loc.waterStyle, getWaterStyleForBiome());
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    drawWorldMeshes('opaque');

    buildDynamicMesh(time);
    drawMesh(meshes.dynamic);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    drawMesh(meshes.ocean);
    drawWorldMeshes('water');
    gl.depthMask(true);
    gl.disable(gl.BLEND);
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
    clearMovementInput();
    const activeQuickBiome = normalizeBiome(mission.quickBiome);
    const activeQuickGoal = Math.max(0, Math.floor(mission.quickGoal || 0));
    currentSeed = seed;
    mission.islandIndex = 0;
    world = new Map();
    edits = new Map();
    loadedChunks = new Set();
    enemies = [];
    pickups = [];
    c4Charges = [];
    particles = [];
    ammoMercyTimer = 0;
    player.health = STARTING_HEALTH;
    player.reserve = STARTING_RESERVE;
    player.c4 = STARTING_C4;
    setPlayerMagSize(effectiveMagSize(), true);
    player.kills = 0;
    player.headshots = 0;
    player.score = 0;
    player.deaths = 0;
    cancelReload();
    player.shotCooldown = 0;
    mission.quickBiome = activeQuickBiome;
    mission.quickGoal = activeQuickGoal;
    mission.phase = PHASE_DROP;
    mission.firstWaveSpawned = false;
    mission.insertionActive = false;
    mission.insertionTargetY = 0;
    mission.objectiveAcknowledged = false;
    mission.hudTitle = '';
    mission.hudMeta = '';
    mission.nextHudTitle = '';
    mission.nextHudMeta = '';
    mission.briefingActive = false;
    mission.pendingBriefing = null;
    mission.briefingAfterOk = null;
    mission.upgradeActive = false;
    mission.upgradeAfterChoice = null;
    mission.completed = false;
    mission.huntDecisionActive = false;
    mission.huntDecisionTimer = 0;
    mission.huntDecisionShown = false;
    mission.commandBannerTimer = 0;
    mission.toastLockTimer = 0;
    mission.fewMoreVoicePlayed = false;
    mission.lowHealthVoicePlayed = false;
    mission.longRangeVoicePlayed = false;
    mission.bittenVoicePlayed = false;
    resetLifeStats();
    nextSpawnTimer = 3.5;
    hordeLevel = 0;
    heartbeatTimer = 0;
    cameraStepOffsetY = 0;
    lastKillTime = -999;
    killComboCount = 0;
    zombieMoanTimer = Math.min(2.5, ZOMBIE_MOAN_INTERVAL_MIN);
    deathState.active = false;
    deathState.ready = false;
    deathState.timer = 0;
    deathState.fadeStarted = false;
    deathState.overlayShown = false;
    deathState.decisionActive = false;
    deathState.reviving = false;
    deathState.reviveTimer = 0;
    deathState.bloodTimer = 0;
    woundGaspTimer = 0;
    extractionState.active = false;
    extractionState.timer = 0;
    extractionState.seed = null;
    hideHuntDecisionOverlay();
    document.body.classList.remove('dead', 'low-health', 'wounded', 'death-cinematic', 'death-fading', 'death-card-ready', 'stage-cleared', 'hunt-complete-fade', 'extraction-fade');
    document.body.classList.add('quick-mode');
    deathOverlay.classList.remove('show', 'ready', 'cinematic', 'awaiting-choice', 'reviving');
    upgradeOverlay.classList.remove('show');
    document.body.classList.remove('upgrade-open');
    deathStats.textContent = '';
    deathStats.classList.remove('simple');
    renderDeathUnlocks(null);
    setKillHud(false, 0);
    hideDeathShare();
    renderBriefingShare(null);
    deathTitle.textContent = 'DOWNED';
    deathText.textContent = 'Respond to Mission Command';
    deathFill.style.width = '0%';
    disableOverlay.classList.remove('show');
    disableFill.style.width = '0%';
    disablePercent.textContent = '0%';
    if (commandBanner) commandBanner.classList.remove('show');
    setWeaponUnlocked(false);
    currentChunkX = 999999;
    currentChunkZ = 999999;
    // Center landmark and starting chunks.
    player.pos = [0.5, 18, 0.5];
    ensureChunks(true);
    player.pos = [0.5, topSolidY(0, 0) + 2.2, 0.5];
    player.vel = [0, 0, 0];
    ensureChunks(true);
    rebuildMeshes();
    mission.phase = PHASE_ZOMBIE_THREAT;
    mission.objectiveAcknowledged = true;
    mission.hudTitle = 'Frontier Hunt';
    mission.hudMeta = currentBiomeLabel() + ' // Clear ' + currentInfectedGoal();
    setWeaponUnlocked(true);
    nextSpawnTimer = 1.6;
    startInsertionDrop();
    spawnInitialWave();
  }

  function enterGameFromMenu() {
    applySettings();
    if (controlsModal) controlsModal.hidden = true;
    if (settingsModal) settingsModal.hidden = true;
    if (soundEnabled || ambientEnabled) window.ZomVoxSound?.prime();
    clearMovementInput();
    menu.style.display = 'none';
    updateAmbientSound(true);
    if (touchMode) requestMobileFullscreen();
    if (mission.pendingBriefing) {
      locked = touchMode;
      openObjectiveBriefing();
      return;
    }
    if (isUpgradeOpen()) {
      locked = touchMode;
      return;
    }
    locked = true;
    if (touchMode) {
      return;
    }
    requestPointerLockSafe();
  }

  function startRandomQuickHunt() {
    sound('confirm');
    const next = chooseNextHunt();
    document.body.classList.add('quick-mode');
    generateWorld(next.seed);
    enterGameFromMenu();
  }

  function openSettingsModal() {
    sound('confirm');
    if (controlsModal) controlsModal.hidden = true;
    if (settingsModal) settingsModal.hidden = false;
  }

  function closeSettingsModal() {
    sound('confirm');
    if (settingsModal) settingsModal.hidden = true;
    applySettings();
  }

  function openControlsModal() {
    sound('confirm');
    if (settingsModal) settingsModal.hidden = true;
    if (controlsModal) controlsModal.hidden = false;
  }

  function closeControlsModal() {
    sound('confirm');
    if (controlsModal) controlsModal.hidden = true;
  }

  function requestPointerLockSafe() {
    clearKeyboardState();
    if (!canvas.requestPointerLock) return;
    try {
      const result = canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch (_) {}
  }
  play.addEventListener('click', startRandomQuickHunt);
  if (controlsButton) controlsButton.addEventListener('click', openControlsModal);
  if (controlsClose) controlsClose.addEventListener('click', closeControlsModal);
  if (controlsModal) controlsModal.addEventListener('click', event => {
    if (event.target === controlsModal) closeControlsModal();
  });
  if (settingsGear) settingsGear.addEventListener('click', openSettingsModal);
  if (settingsClose) settingsClose.addEventListener('click', closeSettingsModal);
  if (settingsModal) settingsModal.addEventListener('click', event => {
    if (event.target === settingsModal) closeSettingsModal();
  });
  if (portraitInstallCallout) portraitInstallCallout.addEventListener('click', installZomVox);
  if (updateReload) updateReload.addEventListener('click', reloadForPwaUpdate);
  briefingOk.addEventListener('click', acknowledgeObjectiveBriefing);
  if (briefingShareButton) briefingShareButton.addEventListener('click', () => shareRunFromButton(briefingShareButton));
  if (deathShare) deathShare.addEventListener('click', () => shareRunFromButton(deathShare));
  if (deathContinue) deathContinue.addEventListener('click', acceptDeathRevive);
  deathGiveUp.addEventListener('click', giveUpMission);
  if (huntAccept) huntAccept.addEventListener('click', acceptHuntDecision);
  if (huntDecline) huntDecline.addEventListener('click', declineHuntDecision);
  canvas.addEventListener('click', () => {
    if (deathState.active || extractionState.active || mission.huntDecisionActive) {
      return;
    }
    if (!locked && !touchMode) requestPointerLockSafe();
  });
  document.addEventListener('pointerlockchange', () => {
    if (touchMode) return;
    locked = document.pointerLockElement === canvas;
    clearKeyboardState();
    menu.style.display = locked || deathState.active || extractionState.active || mission.huntDecisionActive || isBriefingOpen() || isUpgradeOpen() ? 'none' : 'flex';
    updateAmbientSound(true);
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch -= e.movementY * 0.0022;
    const cap = Math.PI / 2 - 0.02;
    player.pitch = Math.max(-cap, Math.min(cap, player.pitch));
  });
  document.addEventListener('keydown', (e) => {
    if (deathState.active && deathState.decisionActive) {
      if (e.code === 'Enter' || e.code === 'KeyY') {
        e.preventDefault();
        acceptDeathRevive();
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyN') {
        e.preventDefault();
        giveUpMission();
        return;
      }
    }
    if (mission.huntDecisionActive && mission.huntDecisionShown) {
      if (e.code === 'Enter' || e.code === 'KeyY') {
        e.preventDefault();
        acceptHuntDecision();
        return;
      }
      if (e.code === 'Escape' || e.code === 'KeyN') {
        e.preventDefault();
        declineHuntDecision();
        return;
      }
    }
    if (isBriefingOpen() && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      acknowledgeObjectiveBriefing();
      return;
    }
    if (!keyboardControlsActive()) {
      if (HELD_GAMEPLAY_KEYS.has(e.code)) {
        keys[e.code] = false;
        e.preventDefault();
      }
      return;
    }
    if (HELD_GAMEPLAY_KEYS.has(e.code)) {
      keys[e.code] = true;
      e.preventDefault();
    }
    if (e.code === 'KeyR' && !e.repeat) startReload();
    if (e.code === 'KeyC' && !e.repeat) placeC4();
    if (e.code === 'KeyN' && !e.repeat) {
      beginWorldRebuild(quickSeedForBiome(mission.quickBiome));
    }
  });
  document.addEventListener('keyup', (e) => {
    if (HELD_GAMEPLAY_KEYS.has(e.code)) {
      keys[e.code] = false;
      e.preventDefault();
    }
  });
  window.addEventListener('blur', () => clearMovementInput());
  window.addEventListener('pagehide', () => clearMovementInput());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearMovementInput();
  });
  canvas.addEventListener('mousedown', (e) => {
    if (deathState.active || extractionState.active || mission.huntDecisionActive) {
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
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => { touchMode = true; btn.classList.add('active'); down(); btn.setPointerCapture(e.pointerId); e.preventDefault(); });
    const clear = () => { btn.classList.remove('active'); if (up) up(); };
    btn.addEventListener('pointerup', clear);
    btn.addEventListener('pointercancel', clear);
  }
  bindTouchButton(touchShoot, () => {
    beginTouchShoot();
  }, () => {});
  bindTouchButton(touchC4, () => { placeC4(); }, () => {});

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
  registerPwaHooks();
  gl.enable(gl.DEPTH_TEST);
  generateWorld(currentSeed);
  runSplash();
  requestAnimationFrame(loop);
})();
