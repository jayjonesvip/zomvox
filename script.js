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
  const quickStart = $('quickStart');
  const quickBiomePanel = $('quickBiomePanel');
  const toast = $('toast');
  const gunSprite = $('gunSprite');
  const damageFlash = $('damageFlash');
  const healthStatus = $('healthStatus');
  const healthBigText = $('healthBigText');
  const healthBigFill = $('healthBigFill');
  const objectiveText = $('objectiveText');
  const objectiveMeta = $('objectiveMeta');
  const commandBanner = $('commandBanner');
  const commandBannerTitle = $('commandBannerTitle');
  const commandBannerBody = $('commandBannerBody');
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
  const worldText = $('worldText');
  const worldFill = $('worldFill');
  const deathOverlay = $('deathOverlay');
  const deathTitle = $('deathTitle');
  const deathFill = $('deathFill');
  const deathText = $('deathText');
  const deathStats = $('deathStats');
  const deathShare = $('deathShare');
  const deathDownload = $('deathDownload');
  const deathContinue = $('deathContinue');
  const deathGiveUp = $('deathGiveUp');
  const mobileControls = $('mobileControls');
  const stickBase = $('stickBase');
  const stickKnob = $('stickKnob');
  const touchShoot = $('touchShoot');
  const touchJump = $('touchJump');
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
  const quickBiomeButtons = quickBiomePanel ? Array.from(quickBiomePanel.querySelectorAll('[data-biome]')) : [];

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
  function configStringArray(section, key, fallback) {
    const value = section[key];
    return (Array.isArray(value) ? value : fallback).filter(v => typeof v === 'string');
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
    RED_LIGHT: 24,
    CACTUS: 25,
    MUD: 26,
    ASH: 27,
    DEAD_WOOD: 28,
    DARK_RED: 29,
    SHUTDOWN_PAD: 30
  };

  const CHUNK_SIZE = Math.max(4, Math.floor(configNumber(WORLD_CONFIG, 'chunkSize', 16)));
  const WORLD_CHUNK_RADIUS = Math.max(1, Math.floor(configNumber(WORLD_CONFIG, 'chunkRadius', 3)));
  const WORLD_MIN = -WORLD_CHUNK_RADIUS * CHUNK_SIZE;
  const WORLD_MAX = (WORLD_CHUNK_RADIUS + 1) * CHUNK_SIZE - 1;
  const MAX_Y = Math.max(16, Math.floor(configNumber(WORLD_CONFIG, 'maxY', 46)));
  const WATER_LEVEL = Math.max(1, Math.floor(configNumber(WORLD_CONFIG, 'waterLevel', 8)));
  const TERRAIN_BASE_HEIGHT = configNumber(WORLD_CONFIG, 'terrainBaseHeight', 4);
  const TERRAIN_DETAIL_AMOUNT = configNumber(WORLD_CONFIG, 'terrainDetailAmount', 12);
  const TERRAIN_BROAD_AMOUNT = configNumber(WORLD_CONFIG, 'terrainBroadAmount', 10);
  const TERRAIN_RIDGE_AMOUNT = configNumber(WORLD_CONFIG, 'terrainRidgeAmount', 2);
  const TERRAIN_LAKE_A_DEPTH = configNumber(WORLD_CONFIG, 'terrainLakeADepth', 16);
  const TERRAIN_LAKE_B_DEPTH = configNumber(WORLD_CONFIG, 'terrainLakeBDepth', 13);
  const TERRAIN_MARSH_DEPTH = configNumber(WORLD_CONFIG, 'terrainMarshDepth', 16);
  const PLAYER_HEIGHT = configNumber(PLAYER_CONFIG, 'height', 1.76);
  const PLAYER_RADIUS = configNumber(PLAYER_CONFIG, 'radius', 0.31);
  const STARTING_HEALTH = configNumber(PLAYER_CONFIG, 'startingHealth', 100);
  const STARTING_RESERVE = Math.max(0, Math.floor(configNumber(PLAYER_CONFIG, 'startingReserve', 36)));
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
  const TOXIN_DAMAGE_PER_SECOND = Math.max(0, configNumber(MISSION_CONFIG, 'toxinDamagePerSecond', 1.15));
  const MACHINE_DISABLE_SECONDS = Math.max(0.5, configNumber(MISSION_CONFIG, 'disableSeconds', 3));
  const INSERTION_DROP_HEIGHT = Math.max(10, configNumber(MISSION_CONFIG, 'insertionDropHeight', 30));
  const INSERTION_FALL_SPEED = Math.max(2, configNumber(MISSION_CONFIG, 'insertionFallSpeed', 5.8));
  const FIRST_WAVE_SIZE = Math.max(0, Math.floor(configNumber(MISSION_CONFIG, 'firstWaveSize', 3)));
  const INITIAL_SEED = Math.floor(configNumber(CONFIG, 'initialSeed', 729641));
  const CONFIGURED_MISSION_SEEDS = configNumberArray(MISSION_CONFIG, 'islandSeeds', [INITIAL_SEED, 482177, 735331, 918244, 126509]).slice(0, 5);
  const MISSION_SEEDS = CONFIGURED_MISSION_SEEDS.length ? CONFIGURED_MISSION_SEEDS : [INITIAL_SEED];
  const DEFAULT_MISSION_BIOMES = ['forest', 'dunes', 'rocky', 'swamp', 'ashlands'];
  const CONFIGURED_MISSION_BIOMES = configStringArray(MISSION_CONFIG, 'biomes', DEFAULT_MISSION_BIOMES).slice(0, MISSION_SEEDS.length);
  const MISSION_BIOMES = MISSION_SEEDS.map((_, i) => normalizeBiome(CONFIGURED_MISSION_BIOMES[i] || DEFAULT_MISSION_BIOMES[i] || 'forest'));
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
  const MODE_STORY = 'story';
  const MODE_QUICK = 'quick';

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
    shotCooldown: 0,
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
  const portraitQuery = matchMedia('(orientation: portrait)');
  let keys = Object.create(null);
  const touchInput = { moveX: 0, moveY: 0, jump: false, lookId: null, lookX: 0, lookY: 0, stickId: null };
  const BUILD_VERSION = configString(CONFIG, 'buildVersion', '2026.07.08.11');
  let lastFrame = performance.now();
  const cycleStartedAt = performance.now();
  let fpsAvg = 60;
  let frameCounter = 0;
  let lastKillTime = -999;
  let killComboCount = 0;
  let dayAmount = 1;
  let soundEnabled = true;
  let ambientEnabled = true;
  let activeAmbientCue = '';
  let waterDamageTimer = 0;
  let hordeLevel = 0;
  let heartbeatTimer = 0;
  const deathState = { active: false, timer: 0, duration: DEATH_READY_DELAY, ready: false };
  const REPLAY_WIDTH = 1080;
  const REPLAY_HEIGHT = 1920;
  const replayGunImage = new Image();
  replayGunImage.src = 'assets/zomvox-gun-spritesheet.png';
  const replayState = {
    recorder: null,
    chunks: [],
    blob: null,
    url: '',
    mimeType: '',
    active: false,
    canvas: null,
    ctx: null,
    videoStream: null
  };
  const worldRebuildState = { active: false, timer: 0, startedAt: 0, duration: WORLD_REBUILD_DURATION, seed: null };
  const mission = {
    mode: MODE_STORY,
    quickBiome: 'forest',
    phase: PHASE_DROP,
    machine: null,
    supplyCrate: null,
    dropBeacon: null,
    disableProgress: 0,
    toxinRemainder: 0,
    toxinSoundTicks: 0,
    smokeTimer: 0,
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
    extractionProgress: 0,
    extractionCalled: false,
    beaconMessageCooldown: 0,
    beaconReminderTimer: 0,
    commandBannerTimer: 0,
    toastLockTimer: 0
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
    { id: 'bodyArmor', name: 'Body Armor', desc: 'Zombie bite damage reduced by 20%.' }
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
    return amount * (activePerks.bodyArmor ? 0.8 : 1);
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

  function showToast(message, priority = false) {
    if (!priority && mission.toastLockTimer > 0) return;
    toast.textContent = message;
  }

  function showCommandBanner(title, body, duration = 4.2) {
    if (!commandBanner || !commandBannerTitle || !commandBannerBody) return;
    commandBannerTitle.textContent = title;
    commandBannerBody.textContent = body;
    commandBanner.classList.add('show');
    mission.commandBannerTimer = duration;
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
      ['Biome', currentBiomeLabel()],
      ['Perk used', perks.length > 1 ? perks.length + ' perks' : perkText],
      ['Time survived', formatRunTime(seconds)]
    ];
    const text = [
      'ZomVox: Zombies and Voxels',
      title,
      'Kills: ' + player.lifeKills,
      'Headshots: ' + player.lifeHeadshots,
      'Biome: ' + currentBiomeLabel(),
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

  function renderDeathStats(summary = buildRunSummary('Quick Hunt run ended')) {
    renderRunStats(deathStats, summary);
    setShareButton(deathShare, summary);
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

  function replaySupported() {
    const testCanvas = document.createElement('canvas');
    return !!(testCanvas.captureStream && window.MediaRecorder);
  }

  function replayMimeType() {
    const types = [
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
      'video/mp4;codecs=avc1.640028,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
  }

  function setReplayDownloadVisible(visible) {
    if (!deathDownload) return;
    deathDownload.classList.toggle('hidden', !visible);
  }

  function clearReplay() {
    if (replayState.url) URL.revokeObjectURL(replayState.url);
    replayState.blob = null;
    replayState.url = '';
    if (!replayState.active) replayState.chunks = [];
    setReplayDownloadVisible(false);
  }

  function ensureReplayCanvas() {
    if (!replayState.canvas) {
      replayState.canvas = document.createElement('canvas');
      replayState.canvas.width = REPLAY_WIDTH;
      replayState.canvas.height = REPLAY_HEIGHT;
      replayState.ctx = replayState.canvas.getContext('2d');
    }
    return replayState.ctx ? replayState.canvas : null;
  }

  function cleanupReplayCapture() {
    if (replayState.videoStream) {
      replayState.videoStream.getVideoTracks().forEach(track => track.stop());
      replayState.videoStream = null;
    }
  }

  function drawReplayGun(ctx, gameX, gameY, gameW, gameH) {
    if (!gunSprite || replayGunImage.complete === false || !replayGunImage.naturalWidth) return;
    if (document.body.classList.contains('no-gun') || document.body.classList.contains('stage-transition')) return;

    const gunStyle = getComputedStyle(gunSprite);
    if (gunStyle.display === 'none' || gunStyle.visibility === 'hidden' || Number(gunStyle.opacity) === 0) return;

    const gunRect = gunSprite.getBoundingClientRect();
    const gameRect = canvas.getBoundingClientRect();
    if (!gunRect.width || !gunRect.height || !gameRect.width || !gameRect.height) return;

    const frame = gunSprite.classList.contains('shooting')
      ? 2
      : (gunSprite.classList.contains('moving') ? 1 : 0);
    const spriteW = replayGunImage.naturalWidth / 3;
    const spriteH = replayGunImage.naturalHeight;
    const scaleX = gameW / gameRect.width;
    const scaleY = gameH / gameRect.height;
    const x = gameX + (gunRect.left - gameRect.left) * scaleX;
    const y = gameY + (gunRect.top - gameRect.top) * scaleY;
    const w = gunRect.width * scaleX;
    const h = gunRect.height * scaleY;

    ctx.drawImage(replayGunImage, spriteW * frame, 0, spriteW, spriteH, x, y, w, h);
  }

  function drawReplayFrame() {
    const replayCanvas = replayState.canvas;
    const ctx = replayState.ctx;
    if (!replayState.active || !replayCanvas || !ctx) return;

    const w = replayCanvas.width;
    const h = replayCanvas.height;
    const sourceW = canvas.width || 1;
    const sourceH = canvas.height || 1;
    const gameAspect = sourceW / Math.max(1, sourceH);
    const targetW = w;
    const targetH = Math.min(Math.round(targetW / gameAspect), Math.round(h * 0.64));
    const x = Math.floor((w - targetW) / 2);
    const y = Math.floor((h - targetH) / 2);

    ctx.fillStyle = '#030607';
    ctx.fillRect(0, 0, w, h);

    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(145, 243, 110, 0.18)');
    gradient.addColorStop(0.42, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(255, 230, 109, 0.12)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 24;
    ctx.drawImage(canvas, x, y, targetW, targetH);
    ctx.restore();
    drawReplayGun(ctx, x, y, targetW, targetH);

    ctx.fillStyle = '#91f36e';
    ctx.font = '900 82px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ZomVox', w / 2, 160);

    ctx.fillStyle = '#f4fff0';
    ctx.font = '800 38px Arial, sans-serif';
    ctx.fillText('Zombies and Voxels', w / 2, 224);

    ctx.fillStyle = '#ffe66d';
    ctx.font = '900 44px Arial, sans-serif';
    ctx.fillText('zomvox.com', w / 2, h - 145);
  }

  function startReplayRecording() {
    if (!replaySupported() || replayState.active || deathState.active) return;
    clearReplay();
    try {
      const replayCanvas = ensureReplayCanvas();
      if (!replayCanvas) return;
      const videoStream = replayCanvas.captureStream(30);
      replayState.videoStream = videoStream;
      const audioStream = window.ZomVoxSound?.recordingStream?.();
      const stream = new MediaStream();
      videoStream.getVideoTracks().forEach(track => stream.addTrack(track));
      if (audioStream) audioStream.getAudioTracks().forEach(track => stream.addTrack(track));
      const mimeType = replayMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);

      replayState.recorder = recorder;
      replayState.mimeType = mimeType || recorder.mimeType || 'video/webm';
      replayState.active = true;
      replayState.chunks = [];
      drawReplayFrame();

      recorder.addEventListener('dataavailable', event => {
        if (event.data && event.data.size > 0) replayState.chunks.push(event.data);
      });
      recorder.addEventListener('stop', () => {
        replayState.active = false;
        replayState.recorder = null;
        cleanupReplayCapture();
        if (!replayState.chunks.length) {
          setReplayDownloadVisible(false);
          return;
        }
        replayState.blob = new Blob(replayState.chunks, { type: replayState.mimeType || 'video/webm' });
        if (replayState.url) URL.revokeObjectURL(replayState.url);
        replayState.url = URL.createObjectURL(replayState.blob);
        setReplayDownloadVisible(deathState.active);
      });
      recorder.start(1000);
    } catch (err) {
      console.warn(err);
      replayState.active = false;
      replayState.recorder = null;
      cleanupReplayCapture();
      setReplayDownloadVisible(false);
    }
  }

  function stopReplayRecording() {
    const recorder = replayState.recorder;
    if (!recorder || recorder.state === 'inactive') return;
    try {
      recorder.requestData();
      recorder.stop();
    } catch (err) {
      console.warn(err);
      replayState.active = false;
      replayState.recorder = null;
      cleanupReplayCapture();
      setReplayDownloadVisible(false);
    }
  }

  function downloadReplay() {
    if (!replayState.blob || !replayState.url) return;
    sound('confirm');
    const ext = replayState.mimeType.includes('mp4') ? 'mp4' : 'webm';
    const name = 'zomvox-' + currentBiome() + '-' + Date.now() + '.' + ext;
    const link = document.createElement('a');
    link.href = replayState.url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
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
    return menu.style.display !== 'none' || splash.style.display !== 'none' || isBriefingOpen() || isUpgradeOpen();
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
    let audioProgress = (soundEnabled || ambientEnabled) ? 0 : 1;
    let audioReady = !(soundEnabled || ambientEnabled);
    const preload = (soundEnabled || ambientEnabled) ? window.ZomVoxSound?.prime?.(info => {
      audioProgress = Math.max(audioProgress, info.progress || 0);
    }) : null;
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
      'Preloading audio...',
      'Generating world...',
      'Calibrating display...'
    ];
    const duration = 2600;
    const maxDuration = 4400;
    const start = performance.now();
    function step(now) {
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
    const nextSeed = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 999999);
    document.body.classList.add('stage-transition');
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
    player.shotCooldown = 0;
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
  }

  function currentIslandLabel() {
    return 'Island ' + (mission.islandIndex + 1) + ' / ' + MISSION_SEEDS.length;
  }

  function normalizeBiome(value) {
    const biome = String(value || 'forest').trim().toLowerCase();
    return ['forest', 'dunes', 'rocky', 'swamp', 'ashlands'].includes(biome) ? biome : 'forest';
  }

  function quickSeedForBiome(biome) {
    const idx = DEFAULT_MISSION_BIOMES.indexOf(normalizeBiome(biome));
    return INITIAL_SEED + 100003 * (idx + 1);
  }

  function currentBiome() {
    if (mission.mode === MODE_QUICK) return normalizeBiome(mission.quickBiome);
    return MISSION_BIOMES[mission.islandIndex] || 'forest';
  }

  function currentBiomeLabel() {
    const biome = currentBiome();
    return biome.charAt(0).toUpperCase() + biome.slice(1);
  }

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

  function shouldPauseForPortrait() {
    const mobileLike = touchMode || matchMedia('(pointer: coarse)').matches;
    return mobileLike &&
      portraitQuery.matches &&
      menu.style.display === 'none' &&
      splash.style.display === 'none' &&
      !worldRebuildState.active &&
      !deathState.active &&
      !isBriefingOpen() &&
      !isUpgradeOpen();
  }

  function updatePortraitPauseState() {
    const paused = shouldPauseForPortrait();
    document.body.classList.toggle('portrait-paused', paused);
    if (paused) {
      touchInput.moveX = 0;
      touchInput.moveY = 0;
      touchInput.jump = false;
      touchInput.lookId = null;
      touchInput.stickId = null;
      if (stickKnob) stickKnob.style.transform = 'translate(0, 0)';
      player.vel[0] = 0;
      player.vel[2] = 0;
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
    mission.pendingBriefing = null;
    mission.briefingActive = true;
    mission.objectiveAcknowledged = false;
    mission.briefingAfterOk = briefing.afterOk || null;
    mission.nextHudTitle = briefing.hudTitle || briefing.title;
    mission.nextHudMeta = briefing.hudMeta || briefing.meta || '';
    briefingMeta.textContent = briefing.meta || currentIslandLabel();
    briefingObjective.textContent = briefing.title;
    briefingBody.textContent = briefing.body;
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
    renderBriefingShare(null);
    setHudObjective(mission.nextHudTitle || '', mission.nextHudMeta || '');
    const afterOk = mission.briefingAfterOk;
    mission.briefingAfterOk = null;
    if (afterOk) afterOk();
    if (!touchMode && menu.style.display === 'none' && !deathState.active && !worldRebuildState.active && !isUpgradeOpen()) requestPointerLockSafe();
  }

  function openPerkChoice(afterChoice, options = {}) {
    const available = PERK_CHOICES.filter(choice => !activePerks[choice.id]);
    if (!upgradeOverlay || !upgradeOptions || !available.length) {
      if (afterChoice) afterChoice();
      return;
    }
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
    const choice = PERK_CHOICES.find(item => item.id === id);
    if (!choice || activePerks[id]) return;
    activePerks[id] = true;
    if (id === 'doubleMag') setPlayerMagSize(effectiveMagSize(), true);
    scorePop(choice.name.toUpperCase(), 'pickup small');
    showToast('Perk installed: ' + choice.name);
    sound('perkEquip');
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
    worldFill.style.width = (progress * 100).toFixed(1) + '%';
    if (progress < .38) worldText.textContent = 'Building frontier...';
    else if (progress < .76) worldText.textContent = 'Clearing old voxels...';
    else worldText.textContent = 'Generating new zombie frontier...';
    if (progress >= 1) {
      const nextSeed = worldRebuildState.seed;
      worldRebuildState.active = false;
      worldOverlay.classList.remove('show');
      generateWorld(nextSeed);
      if (isGameLive() && mission.mode === MODE_STORY) openObjectiveBriefing();
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
      if(t < 24.5) return vec3(0.90, 0.02, 0.015) * (0.35 + step(0.45, sin(uTime * 6.0)) * 0.75); /* red beacon */
      if(t < 25.5) return vec3(0.15, 0.50, 0.18); /* cactus */
      if(t < 26.5) return vec3(0.22, 0.18, 0.12); /* swamp mud */
      if(t < 27.5) return vec3(0.12, 0.13, 0.13); /* ash */
      if(t < 28.5) return vec3(0.18, 0.13, 0.09); /* dead wood */
      if(t < 29.5) return vec3(0.20, 0.015, 0.012); /* dead beacon */
      if(t < 30.5) return vec3(1.0, 0.86, 0.16) * (0.58 + step(0.45, sin(uTime * 7.0)) * 0.38); /* shutdown pad */
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
      if(vType > 8.5 && vType < 9.5) color += vec3(0.55, 0.38, 0.05);
      if(vType > 11.5 && vType < 12.5) color += vec3(0.70, 0.02, 0.0);
      if(vType > 14.5 && vType < 15.5) color += vec3(0.50, 0.15, 0.04);
      if(vType > 16.5 && vType < 17.5) color += vec3(0.35, 0.0, 0.0);
      if(vType > 19.5 && vType < 20.5) color += vec3(0.55, 0.35, 0.0);
      if(vType > 21.5 && vType < 22.5) color *= 0.70 + step(0.58, hash(floor(vWorld.xz * 3.0 + vWorld.yy))) * 0.42;
      if(vType > 23.5 && vType < 24.5) color += vec3(0.70, 0.0, 0.0) * step(0.45, sin(uTime * 6.0));
      if(vType > 24.5 && vType < 25.5) color += vec3(0.02, 0.08, 0.02);
      if(vType > 26.5 && vType < 27.5) color *= 0.78 + step(0.62, hash(floor(vWorld.xz * 2.6 + vWorld.yy))) * 0.35;
      if(vType > 29.5 && vType < 30.5) color += vec3(0.45, 0.32, 0.02) * step(0.45, sin(uTime * 7.0));
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

  function biomeSurfaceTypes(biome, x, z, h, beach, desert, lavaShore) {
    if (lavaShore) return { top: BLOCK.STONE, near: BLOCK.STONE };
    const roll = seededHash(x * 2.71 + 19, z * 3.43 - 11);
    if (biome === 'dunes') return { top: roll < .95 ? BLOCK.SAND : BLOCK.STONE, near: BLOCK.SAND };
    if (biome === 'rocky') return { top: roll < .95 ? BLOCK.STONE : BLOCK.GRASS, near: roll < .95 ? BLOCK.STONE : BLOCK.DIRT };
    if (biome === 'swamp') return { top: roll < .72 || beach ? BLOCK.MUD : BLOCK.GRASS, near: roll < .72 || beach ? BLOCK.MUD : BLOCK.DIRT };
    if (biome === 'ashlands') return { top: roll < .82 ? BLOCK.ASH : BLOCK.STONE, near: roll < .82 ? BLOCK.ASH : BLOCK.STONE };
    return { top: beach ? BLOCK.SAND : (roll < .95 ? BLOCK.GRASS : (desert ? BLOCK.SAND : BLOCK.STONE)), near: beach ? BLOCK.SAND : BLOCK.DIRT };
  }

  function growTree(x, h, z, trunkType = BLOCK.WOOD, withLeaves = true) {
    const trunk = 4 + Math.floor(seededHash(x + 11.2, z - 4.1) * 3);
    for (let y = 1; y <= trunk; y++) genSetBlock(x, h + y, z, trunkType);
    if (!withLeaves) {
      const armY = h + Math.max(2, trunk - 1);
      genSetBlock(x + (seededHash(x, z) > .5 ? 1 : -1), armY, z, trunkType);
      genSetBlock(x, armY + 1, z + (seededHash(x + 9, z - 7) > .5 ? 1 : -1), trunkType);
      return;
    }
    const crownY = h + trunk;
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
        // Dunes keep the low basins dry so desert islands do not generate lakes.
        if (biome !== 'dunes' && h < WATER_LEVEL) {
          for (let y = h + 1; y <= WATER_LEVEL; y++) genSetBlock(x, y, z, BLOCK.WATER);
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
        if (biome === 'forest' && propRoll > 0.965) {
          growTree(x, h, z);
        } else if (biome === 'dunes' && propRoll > 0.972) {
          growSaguaro(x, h, z);
        } else if (biome === 'rocky' && propRoll > 0.992) {
          //growTree(x, h, z, BLOCK.WOOD, true);
          //no trees..
        } else if (biome === 'swamp' && propRoll > 0.976) {
          growTree(x, h, z, BLOCK.DEAD_WOOD, seededHash(x - 4, z + 8) > .35);
        } else if (biome === 'ashlands' && propRoll > 0.982) {
          growTree(x, h, z, BLOCK.DEAD_WOOD, false);
        }
      }
    }
    for (let lx = 3; lx < CHUNK_SIZE - 3; lx += 2) {
      for (let lz = 3; lz < CHUNK_SIZE - 3; lz += 2) {
        const x = x0 + lx, z = z0 + lz;
        const h = terrainHeight(x, z);
        const rockyShore = biomeUsesRedWater(biome) && h <= WATER_LEVEL + 3;
        const biomeRocks = (biome === 'rocky' || biome === 'ashlands') && h > WATER_LEVEL + 1;
        const rockNoise = seededHash(x * 4.13 + 15, z * 6.71 - 8);
        if ((rockyShore && h > WATER_LEVEL + 1 && rockNoise > 0.935) || (biomeRocks && rockNoise > (biome === 'rocky' ? 0.885 : 0.91))) {
          growRockCluster(x, h, z, rockNoise);
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

  function surfaceMoveMultiplier(x, z) {
    const gx = Math.floor(x), gz = Math.floor(z);
    const y = topSolidY(gx, gz);
    const type = getBlock(gx, y, gz);
    return (type === BLOCK.SAND || type === BLOCK.MUD) ? 0.85 : 1;
  }

  function highestMissionPoint() {
    let best = { x: 0, z: 0, h: terrainHeight(0, 0), score: -Infinity };
    for (let x = WORLD_MIN + 7; x <= WORLD_MAX - 7; x++) {
      for (let z = WORLD_MIN + 8; z <= WORLD_MAX - 7; z++) {
        const h = terrainHeight(x, z);
        if (h <= WATER_LEVEL + 3) continue;
        const distanceFromDrop = Math.hypot(x, z);
        if (distanceFromDrop < 15) continue;
        const slope =
          Math.abs(h - terrainHeight(x + 1, z)) +
          Math.abs(h - terrainHeight(x - 1, z)) +
          Math.abs(h - terrainHeight(x, z + 1)) +
          Math.abs(h - terrainHeight(x, z - 1));
        const broadSlope =
          Math.abs(h - terrainHeight(x + 3, z)) +
          Math.abs(h - terrainHeight(x - 3, z)) +
          Math.abs(h - terrainHeight(x, z + 4)) +
          Math.abs(h - terrainHeight(x, z - 4));
        if (slope > 8 || broadSlope > 18) continue;
        const score = h * 10 + distanceFromDrop * .06 - slope * 1.8 - broadSlope * .6 + seededHash(x * 1.7, z * 2.1);
        if (score > best.score) best = { x, z, h, score };
      }
    }
    return best;
  }

  function clearingSurfaceBlock() {
    const biome = currentBiome();
    if (biome === 'dunes') return BLOCK.SAND;
    if (biome === 'swamp') return BLOCK.MUD;
    if (biome === 'ashlands') return BLOCK.ASH;
    if (biome === 'rocky') return BLOCK.STONE;
    return BLOCK.GRASS;
  }

  function prepareMissionClearing(cx, baseY, cz) {
    const floorY = baseY - 1;
    const surfaceType = clearingSurfaceBlock();
    for (let dx = -5; dx <= 5; dx++) {
      for (let dz = -6; dz <= 5; dz++) {
        const x = cx + dx, z = cz + dz;
        for (let y = floorY + 1; y <= floorY + 22; y++) setBlock(x, y, z, 0, true);
        for (let y = Math.max(0, floorY - 2); y < floorY; y++) setBlock(x, y, z, BLOCK.STONE, true);
        setBlock(x, floorY, z, surfaceType, true);
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
    const padX = x, padZ = z - 4, padY = baseY;
    const towerBlocks = [];
    const beaconBlocks = [];
    const padBlocks = [];
    prepareMissionClearing(x, baseY, z);
    // Compact silo/smoke-stack: a 3x3 grey tower with a red beacon cap and
    // a separate translucent yellow shutdown block in front.
    for (let y = 0; y < 15; y++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const blocks = y < 14 ? towerBlocks : beaconBlocks;
          setMachineBlock(x + dx, baseY + y, z + dz, y < 14 ? BLOCK.METAL : BLOCK.RED_LIGHT, blocks);
        }
      }
    }
    // Shutdown is triggered by standing on the translucent yellow pressure block.
    setMachineBlock(padX, padY, padZ, BLOCK.SHUTDOWN_PAD, padBlocks);
    mission.machine = {
      x: x + .5,
      y: baseY,
      z: z + .5,
      smokeY: baseY + 15.8,
      active: true,
      blocks: [...towerBlocks, ...beaconBlocks, ...padBlocks],
      towerBlocks,
      beaconBlocks,
      padBlocks,
      pad: { x: padX, y: padY, z: padZ }
    };
    mission.supplyCrate = null;
    queueRebuild();
  }

function playerOnMachinePad() {
  const pad = mission.machine && mission.machine.pad;
  if (!pad || !mission.machine.active) return false;

  // Player body box
  const pxMin = player.pos[0] - PLAYER_RADIUS;
  const pxMax = player.pos[0] + PLAYER_RADIUS;
  const pyMin = player.pos[1];
  const pyMax = player.pos[1] + PLAYER_HEIGHT;
  const pzMin = player.pos[2] - PLAYER_RADIUS;
  const pzMax = player.pos[2] + PLAYER_RADIUS;

  // Yellow shutdown block box, slightly expanded so "touching" counts
  const touchPad = 0.18;
  const bxMin = pad.x - touchPad;
  const bxMax = pad.x + 1 + touchPad;
  const byMin = pad.y - touchPad;
  const byMax = pad.y + 1 + touchPad;
  const bzMin = pad.z - touchPad;
  const bzMax = pad.z + 1 + touchPad;

  return pxMax >= bxMin &&
         pxMin <= bxMax &&
         pyMax >= byMin &&
         pyMin <= byMax &&
         pzMax >= bzMin &&
         pzMin <= bzMax;
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
    document.body.classList.remove('stage-transition');
    const x = Math.floor(player.pos[0]);
    const z = Math.floor(player.pos[2]);
    const groundY = topSolidY(x, z) + 1.001;
    mission.insertionActive = true;
    mission.insertionTargetY = groundY;
    mission.disableProgress = 0;
    touchInput.moveX = 0;
    touchInput.moveY = 0;
    touchInput.jump = false;
    player.grounded = false;
    player.vel = [0, -INSERTION_FALL_SPEED * .55, 0];
    player.pos[1] = Math.min(MAX_Y + INSERTION_DROP_HEIGHT, groundY + INSERTION_DROP_HEIGHT);
    scorePop('DROP INBOUND', 'small');
    showToast(mission.mode === MODE_QUICK
      ? 'Quick Hunt: drop started. Look around. Movement unlocks on touchdown.'
      : 'Mission Command: insertion started. Look around. Movement unlocks on touchdown.');
  }

  function finishInsertionDrop() {
    if (!mission.insertionActive) return;
    mission.insertionActive = false;
    player.pos[1] = Math.max(player.pos[1], mission.insertionTargetY);
    player.vel = [0, 0, 0];
    player.grounded = true;
    sound('land');
    scorePop('TOUCHDOWN', 'pickup small');
    showToast(mission.mode === MODE_QUICK
      ? 'Boots down. Hunt the infected.'
      : 'Boots down. Locate the contamination source.');
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
    player.vel[0] = insertion ? 0 : mx * speed;
    player.vel[2] = insertion ? 0 : mz * speed;
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
    else if (!wasGrounded && player.grounded && landingSpeed > 3.2) sound('land');
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
      const surface = getBlock(x, y - 1, z);
      const propSurface = surface === BLOCK.WOOD || surface === BLOCK.CACTUS || surface === BLOCK.DEAD_WOOD ||
        surface === BLOCK.METAL || surface === BLOCK.RED_LIGHT || surface === BLOCK.DARK_RED ||
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
    if (roll < 0.70) {
      return { kind: 'normal', hp: 48, speed: 2.55, scale: 1, damage: 14, attackCooldown: .9, retreat: .34, bodyType: 10, limbType: 11, eyeType: 12 };
    }
    if (roll < 0.90) {
      return { kind: 'speedy', hp: 28, speed: 3.35, scale: .78, damage: 8, attackCooldown: .68, retreat: .28, bodyType: 18, limbType: 10, eyeType: 12 };
    }
    return { kind: 'brute', hp: 96, speed: 1.72, scale: 1.24, damage: 24, attackCooldown: 1.25, retreat: .46, bodyType: 19, limbType: 11, eyeType: 20 };
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
      retreat: 0,
      phase: seededHash(p.x, p.z) * 10,
      blinkSeed: seededHash(p.x * 3.7 + 18, p.z * 5.9 - 22),
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
      return;
    }
    e.x = best.x;
    e.z = best.z;
    e.y += (best.y - e.y) * Math.min(1, dt * 8);
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
      if (dist < 70) {
        const backingOff = e.retreat > 0;
        moveEnemyToward(e, dx, dz, dist, dt, backingOff);
      }
      e.retreat = Math.max(0, (e.retreat || 0) - dt);
      e.attack -= dt;
      const stats = e.variant || enemyVariantStats(e.x, e.z);
      const attackRange = e.big ? 1.82 : (stats.kind === 'speedy' ? 1.42 : 1.58);
      const attackDist = Math.hypot(player.pos[0] - e.x, player.pos[2] - e.z) || 1;
      if (attackDist < attackRange && Math.abs(player.pos[1] - e.y) < 2.25 && e.attack <= 0) {
        damagePlayer(currentZombieDamage(stats.damage), 'bite');
        e.attack = stats.attackCooldown;
        e.retreat = stats.retreat;
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
    stopReplayRecording();
    document.body.classList.toggle('story-death', mission.mode === MODE_STORY);
    if (mission.mode === MODE_STORY) {
      deathTitle.textContent = 'MISSION FAILURE';
      deathText.textContent = 'Command uplink searching for revive authorization';
      deathStats.textContent = '';
      hideDeathShare();
      deathContinue.textContent = 'Continue';
      deathGiveUp.textContent = 'Give Up';
    } else {
      deathTitle.textContent = 'YOU DIED!';
      deathText.textContent = 'Final stats';
      renderDeathStats(buildRunSummary('Quick Hunt run ended'));
      deathContinue.textContent = 'Continue Hunt';
      deathGiveUp.textContent = 'Main Menu';
    }
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
      deathText.textContent = mission.mode === MODE_STORY
        ? 'Mission Command can remotely revive you'
        : 'Continue hunt or return to main menu';
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
    player.shotCooldown = 0;
    mission.disableProgress = 0;
    mission.toxinRemainder = 0;
    mission.toxinSoundTicks = 0;
    setWeaponUnlocked(gunUnlocked());
    lastKillTime = -999;
    killComboCount = 0;
    resetLifeStats();
    clearReplay();
    document.body.classList.remove('dead', 'low-health', 'story-death');
    if (mission.mode === MODE_STORY) {
      document.body.classList.add('story-reviving');
    } else {
      deathOverlay.classList.remove('show');
    }
    deathOverlay.classList.remove('ready');
    deathStats.textContent = '';
    hideDeathShare();
    deathTitle.textContent = 'YOU DIED!';
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
    if (mission.mode === MODE_STORY) {
      startReplayRecording();
      showToast('Mission Command: remote revive complete.');
      setTimeout(() => {
        document.body.classList.add('story-revive-fade');
      }, 120);
      setTimeout(() => {
        deathOverlay.classList.remove('show');
        document.body.classList.remove('story-reviving', 'story-revive-fade');
        if (!touchMode && menu.style.display === 'none') requestPointerLockSafe();
      }, 880);
    } else {
      startReplayRecording();
      showToast('Respawned at the old marker. Deaths: ' + player.deaths);
    }
  }

  function returnToMainMenuFromDeath(message, showQuickPicker = false) {
    sound('confirm');
    deathState.active = false;
    deathState.ready = false;
    deathState.timer = 0;
    locked = false;
    if (document.pointerLockElement === canvas && document.exitPointerLock) document.exitPointerLock();
    document.body.classList.remove('dead', 'low-health', 'story-death', 'story-reviving', 'story-revive-fade');
    deathOverlay.classList.remove('show', 'ready');
    deathStats.textContent = '';
    hideDeathShare();
    clearReplay();
    deathTitle.textContent = 'YOU DIED!';
    deathText.textContent = 'Respawning...';
    deathFill.style.width = '0%';
    menu.style.display = 'flex';
    mission.mode = MODE_STORY;
    mission.quickBiome = 'forest';
    if (quickBiomePanel) quickBiomePanel.hidden = !showQuickPicker;
    document.body.classList.remove('quick-mode');
    generateWorld(MISSION_SEEDS[0] || INITIAL_SEED);
    updateAmbientSound(true);
    showToast(message);
  }

  function giveUpMission() {
    if (!deathState.active || !deathState.ready) return;
    if (mission.mode === MODE_STORY) {
      returnToMainMenuFromDeath('Mission abandoned. Awaiting new orders.');
      return;
    }
    returnToMainMenuFromDeath('Quick Hunt ended. Choose another drop zone.', true);
  }

  function startReload() {
    if (!gunUnlocked()) return;
    if (deathState.active || worldRebuildState.active) return;
    if (player.reloading || player.mag >= player.magSize || player.reserve <= 0) return;
    player.reloading = true;
    player.reloadTimer = currentReloadTime();
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
  function shoot() {
    if (deathState.active) return;
    if (!gunUnlocked()) {
      showToast('Disable the contamination source first.');
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
    sound('shoot');
    const hit = raycastProjectile(58);
    applyShotRecoil();
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


  function playerIsTouchingWater() {
  const x = Math.floor(player.pos[0]);
  const z = Math.floor(player.pos[2]);

  // Check feet/legs area. Player position is near the bottom of the player body.
  const footY = Math.floor(player.pos[1] - 0.05);
  const legY = Math.floor(player.pos[1] + 0.45);

  return getBlock(x, footY, z) === BLOCK.WATER ||
         getBlock(x, legY, z) === BLOCK.WATER;
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
      player.reloading = false;
      player.reloadTimer = 0;
      player.shotCooldown = 0;
      reloadOverlay.classList.remove('show');
      reloadOverlayFill.style.width = '0%';
    }
  }

  function updateShootButtonState() {
    if (!touchShoot) return;
    const unlocked = gunUnlocked();
    const ready = !mission.insertionActive && unlocked;
    touchShoot.classList.toggle('unavailable', !ready);
    touchShoot.setAttribute('aria-disabled', ready ? 'false' : 'true');
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
      enemies = [];
      return;
    }
    for (const e of survivors) spawnKillBurst(e.x, e.y + 1.1, e.z, e.big);
    enemies = [];
    scorePop('INFECTED PURGED', 'wave small');
  }

  function completeMissionIsland() {
    if (mission.completed) return;
    mission.completed = true;
    mission.extractionProgress = 0;
    mission.extractionCalled = false;
    nextSpawnTimer = 999;
    clearRemainingMissionEnemies();
    mission.hudMeta = 'Return to drop beacon';
    mission.toastLockTimer = 2.4;
    mission.beaconReminderTimer = 6.5;
    showToast('Mission Command: stage cleared. Return to drop beacon for extraction.', true);
    showCommandBanner('STAGE CLEARED', 'Return to drop beacon for extraction', 4.6);
    scorePop('STAGE CLEARED', 'wave');
    sound('objectiveClear');
  }

  function completeExtraction() {
    if (mission.extractionCalled) return;
    mission.extractionCalled = true;
    mission.extractionProgress = 1;
    mission.commandBannerTimer = 0;
    mission.beaconReminderTimer = 0;
    hideProgressOverlay();
    if (commandBanner) commandBanner.classList.remove('show');
    document.body.classList.remove('stage-cleared');
    document.body.classList.add('stage-transition');
    openObjectiveBriefing({
      title: 'Island contained',
      meta: currentIslandLabel() + ' // ' + currentBiomeLabel() + ' // Mission Complete',
      body: 'Mission Command: extraction confirmed. Confirm redeploy and we will drop you onto the next contaminated island.',
      shareSummary: buildRunSummary('Mission cleared'),
      hudTitle: 'Island breach contained',
      hudMeta: 'Redeploying',
      afterOk: () => openPerkChoice(() => beginWorldRebuild(nextMissionSeed()), {
        meta: currentIslandLabel() + ' // ' + currentBiomeLabel() + ' // Perk Selection',
        title: 'Choose Perk',
        body: 'Pick one perk before redeploy.'
      })
    });
    scorePop('EXTRACTION CONFIRMED', 'wave');
  }

  function checkMissionCompletion() {
    if (mission.mode !== MODE_STORY) return;
    if (mission.phase === PHASE_ZOMBIE_THREAT && player.kills >= currentInfectedGoal()) completeMissionIsland();
  }

  function spawnSupplyCrate() {
    if (!mission.machine) return;
    const pad = mission.machine.pad || { x: Math.floor(mission.machine.x), z: Math.floor(mission.machine.z) };
    const x = pad.x, z = pad.z;
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

  function explodeShutdownPad() {
    if (!mission.machine) return;
    const m = mission.machine;
    const pad = m.pad || { x: Math.floor(m.x), y: Math.floor(m.y), z: Math.floor(m.z) };
    const cx = pad.x + .5, cy = pad.y + .45, cz = pad.z + .5;
    for (let i = 0; i < 34; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 6.6;
      particles.push({
        x: cx,
        y: cy + Math.random() * .55,
        z: cz,
        vx: Math.cos(angle) * speed,
        vy: 1.8 + Math.random() * 5.4,
        vz: Math.sin(angle) * speed,
        life: .45 + Math.random() * .7,
        type: i % 4 === 0 ? 30 : (i % 3 === 0 ? 14 : 15)
      });
    }
    let dx = player.pos[0] - cx;
    let dz = player.pos[2] - cz;
    let dist = Math.hypot(dx, dz);
    if (dist < .12) {
      dx = cx - m.x;
      dz = cz - m.z;
      dist = Math.hypot(dx, dz) || 1;
    }
    const force = Math.max(5.8, 10 - dist * .65);
    player.vel[0] += (dx / dist) * force;
    player.vel[2] += (dz / dist) * force;
    player.vel[1] = Math.max(player.vel[1], 4.8);
    shakeScreen();
    sound('block');
  }

  function disableMachine() {
    if (!mission.machine || !mission.machine.active) return;
    const infectedGoal = currentInfectedGoal();
    mission.machine.active = false;
    mission.disableProgress = 0;
    disableOverlay.classList.remove('show');
    // Gun unlock happens only after shutdown: the pressure pad detonates,
    // reveals a supply crate, the beacon dies down, and zombie spawning begins.
    explodeShutdownPad();
    for (const b of mission.machine.padBlocks || []) setBlock(b[0], b[1], b[2], 0, true);
    for (const b of mission.machine.beaconBlocks || []) setBlock(b[0], b[1], b[2], BLOCK.DARK_RED, true);
    queueRebuild();
    spawnSupplyCrate();
    mission.phase = PHASE_ZOMBIE_THREAT;
    setWeaponUnlocked(true);
    scorePop('CONTAMINATION SOURCE DISABLED', 'wave');
    openObjectiveBriefing({
      title: 'Eliminate infected: 0 / ' + infectedGoal,
      meta: currentIslandLabel() + ' // ' + currentBiomeLabel() + ' // Mission Updated',
      body: 'Mission Command: source disabled. Supply crate revealed at the shutdown block. Open it, arm up, and eliminate ' + infectedGoal + ' infected before redeploy.',
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
      mission.toxinSoundTicks = 0;
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
    mission.toxinSoundTicks += amount;
    if (mission.toxinSoundTicks >= 5) {
      mission.toxinSoundTicks %= 5;
      sound('toxin');
    }
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
      y: mission.machine.smokeY || mission.machine.y + 6.7,
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
    if (mission.mode !== MODE_STORY) {
      mission.disableProgress = 0;
      hideProgressOverlay();
      return;
    }
    if (!mission.machine || !mission.machine.active) {
      disableOverlay.classList.remove('show');
      return;
    }
    const onPad = playerOnMachinePad();
    mission.phase = onPad ? PHASE_DISABLE_MACHINE : PHASE_DROP;
    // Shutdown is pressure-pad based. Step off the translucent yellow block and the
    // meter resets, making the disable moment physical and readable.
    if (onPad) {
      mission.disableProgress = Math.min(1, mission.disableProgress + dt / MACHINE_DISABLE_SECONDS);
      showProgressOverlay('DISABLING SOURCE', mission.disableProgress);
      if (mission.disableProgress >= 1) disableMachine();
      return;
    }
    mission.disableProgress = 0;
    hideProgressOverlay();
  }

  function updateExtractionBeacon(dt) {
    if (mission.mode !== MODE_STORY) return;
    mission.beaconMessageCooldown = Math.max(0, mission.beaconMessageCooldown - dt);
    const nearBeacon = playerNearDropBeacon();
    if (!nearBeacon) {
      mission.extractionProgress = 0;
      if (mission.phase === PHASE_ZOMBIE_THREAT && mission.completed && !mission.extractionCalled) {
        hideProgressOverlay();
        mission.beaconReminderTimer = Math.max(0, mission.beaconReminderTimer - dt);
        if (mission.beaconReminderTimer <= 0) {
          mission.beaconReminderTimer = 7.5;
          showToast('Mission Command: return to drop beacon for extraction.', true);
          scorePop('RETURN TO BEACON', 'pickup small');
        }
      }
      return;
    }
    mission.beaconReminderTimer = 7.5;
    if (mission.phase !== PHASE_ZOMBIE_THREAT || !mission.completed) {
      mission.extractionProgress = 0;
      if (mission.beaconMessageCooldown <= 0 && !mission.insertionActive) {
        mission.beaconMessageCooldown = 2.6;
        showToast('Mission Command: extraction denied. Clear the infected first.');
        scorePop('MISSION NOT COMPLETE', 'small');
      }
      return;
    }
    if (mission.extractionCalled) return;
    mission.extractionProgress = Math.min(1, mission.extractionProgress + dt / 3);
    showProgressOverlay('CONTACTING COMMAND FOR EXTRACTION', mission.extractionProgress);
    if (mission.extractionProgress >= 1) completeExtraction();
  }

  function updateMissionHud() {
    if (!objectiveText || !objectiveMeta) return;
    document.body.classList.toggle('stage-cleared', mission.completed && !mission.extractionCalled);
    document.body.classList.toggle('quick-mode', mission.mode === MODE_QUICK);
    if (mission.mode === MODE_QUICK) {
      objectiveText.textContent = '[ quick hunt ]';
      objectiveMeta.textContent = player.kills + ' cleared';
      return;
    }
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
      if (mission.completed) {
        objectiveText.textContent = playerNearDropBeacon() ? '[ contacting command ]' : '[ return to beacon ]';
        objectiveMeta.textContent = mission.extractionCalled ? 'Extraction confirmed' : 'Stage cleared';
        return;
      }
      objectiveText.textContent = '[ ' + Math.min(player.kills, infectedGoal) + '/' + infectedGoal + ' cleared ]';
      objectiveMeta.textContent = mission.hudMeta || 'Gun online';
      return;
    }
    objectiveText.textContent = playerOnMachinePad() ? '[ shutdown ]' : '[ find yellow block ]';
    objectiveMeta.textContent = playerOnMachinePad()
      ? 'Shutdown meter active'
      : (mission.hudMeta || 'Toxin exposure active');
  }

  function update(dt) {
    updateAmbientSound();
    updateCommandBanner(dt);
    if (updatePortraitPauseState()) {
      updateHud();
      return;
    }
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
    if (player.reloading) {
      player.reloadTimer -= dt;
      reloadText.textContent = 'Reloading ' + Math.max(0, player.reloadTimer).toFixed(1) + 's';
      reloadOverlayFill.style.width = Math.max(0, Math.min(100, (1 - player.reloadTimer / currentReloadTime()) * 100)) + '%';
      if (player.reloadTimer <= 0) finishReload();
    }
    updateMovement(dt);
    updateDisableInteraction(dt);
    updateExtractionBeacon(dt);
    updateToxinDamage(dt);
    updateWaterHazard(dt);
    updateLowHealthFeedback(dt);
    updateEnemies(dt);
    updateSupplyCrate();
    updatePickups(dt);
    updateMachineSmoke(dt);
    updateParticles(dt);
    updateHud();
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
    updateShootButtonState();
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
    gl.uniform1f(loc.waterStyle, getWaterStyleForBiome());
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
  }

  function loop(now) {
    const dt = Math.min(0.04, (now - lastFrame) / 1000 || 0.016);
    lastFrame = now;
    fpsAvg = fpsAvg * 0.92 + (1 / dt) * 0.08;
    frameCounter++;
    update(dt);
    render(now / 1000);
    drawReplayFrame();
    requestAnimationFrame(loop);
  }

  function placeDropBeacon(cx = 2, cz = 2) {
  const baseY = topSolidY(cx, cz) + 1;

  // Clear a little space around the beacon
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let y = baseY; y <= baseY + 7; y++) {
        setBlock(cx + dx, y, cz + dz, 0, true);
      }
    }
  }

  // 3x3 metal landing base
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      setBlock(cx + dx, baseY, cz + dz, BLOCK.METAL, true);
    }
  }

  // Thin beacon pole
  for (let y = baseY + 1; y <= baseY + 4; y++) {
    setBlock(cx, y, cz, BLOCK.METAL, true);
  }

  // Yellow beacon lamp cap
  setBlock(cx, baseY + 5, cz, BLOCK.LAMP, true);

  // Red guide lights around the top
  setBlock(cx + 1, baseY + 4, cz, BLOCK.RED_LIGHT, true);
  setBlock(cx - 1, baseY + 4, cz, BLOCK.RED_LIGHT, true);
  setBlock(cx, baseY + 4, cz + 1, BLOCK.RED_LIGHT, true);
  setBlock(cx, baseY + 4, cz - 1, BLOCK.RED_LIGHT, true);

  // Small support feet / antenna-ish shape
  setBlock(cx + 1, baseY + 1, cz, BLOCK.METAL, true);
  setBlock(cx - 1, baseY + 1, cz, BLOCK.METAL, true);
  setBlock(cx, baseY + 1, cz + 1, BLOCK.METAL, true);
  setBlock(cx, baseY + 1, cz - 1, BLOCK.METAL, true);
  mission.dropBeacon = { x: cx + .5, y: baseY, z: cz + .5, radius: 2.35 };
}

  function playerNearDropBeacon() {
    const b = mission.dropBeacon;
    if (!b || mission.insertionActive || deathState.active || worldRebuildState.active) return false;
    return Math.hypot(player.pos[0] - b.x, player.pos[2] - b.z) <= b.radius &&
      Math.abs(player.pos[1] - (b.y + 1)) < 6.5;
  }

  function generateWorld(seed) {
    const activeMode = mission.mode || MODE_STORY;
    const activeQuickBiome = normalizeBiome(mission.quickBiome);
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
    setPlayerMagSize(effectiveMagSize(), true);
    player.kills = 0;
    player.headshots = 0;
    player.score = 0;
    player.deaths = 0;
    player.reloading = false;
    player.reloadTimer = 0;
    player.shotCooldown = 0;
    mission.mode = activeMode;
    mission.quickBiome = activeQuickBiome;
    mission.phase = PHASE_DROP;
    mission.machine = null;
    mission.supplyCrate = null;
    mission.dropBeacon = null;
    mission.disableProgress = 0;
    mission.toxinRemainder = 0;
    mission.toxinSoundTicks = 0;
    mission.smokeTimer = 0;
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
    mission.extractionProgress = 0;
    mission.extractionCalled = false;
    mission.beaconMessageCooldown = 0;
    mission.beaconReminderTimer = 0;
    mission.commandBannerTimer = 0;
    mission.toastLockTimer = 0;
    resetLifeStats();
    nextSpawnTimer = 3.5;
    hordeLevel = 0;
    heartbeatTimer = 0;
    lastKillTime = -999;
    killComboCount = 0;
    deathState.active = false;
    deathState.ready = false;
    deathState.timer = 0;
    document.body.classList.remove('dead', 'low-health', 'stage-cleared', 'story-death', 'story-reviving', 'story-revive-fade');
    document.body.classList.toggle('quick-mode', mission.mode === MODE_QUICK);
    deathOverlay.classList.remove('show', 'ready');
    upgradeOverlay.classList.remove('show');
    document.body.classList.remove('upgrade-open');
    deathStats.textContent = '';
    hideDeathShare();
    clearReplay();
    renderBriefingShare(null);
    deathTitle.textContent = 'YOU DIED!';
    deathText.textContent = 'Respawning...';
    deathFill.style.width = '0%';
    reloadOverlay.classList.remove('show');
    reloadOverlayFill.style.width = '0%';
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
    if (mission.mode === MODE_STORY) {
      placeDropBeacon(2, 2);
      placeContaminationMachine();
    }
    player.pos = [0.5, topSolidY(0, 0) + 2.2, 0.5];
    player.vel = [0, 0, 0];
    ensureChunks(true);
    rebuildMeshes();
    if (mission.mode === MODE_QUICK) {
      mission.phase = PHASE_ZOMBIE_THREAT;
      mission.objectiveAcknowledged = true;
      mission.hudTitle = 'Quick Hunt';
      mission.hudMeta = currentBiomeLabel();
      setWeaponUnlocked(true);
      nextSpawnTimer = 1.6;
      openPerkChoice(() => {
        startInsertionDrop();
        spawnInitialWave();
        showCommandBanner('QUICK HUNT', currentBiomeLabel() + ' drop zone', 2.8);
        showToast('Quick Hunt: survive the infected.');
      }, {
        meta: 'Quick Hunt // ' + currentBiomeLabel() + ' // Perk Selection',
        title: 'Choose Perk',
        body: 'Pick one perk before the drop.'
      });
      return;
    }
    queueObjectiveBriefing({
      title: 'Locate the contamination source',
      meta: currentIslandLabel() + ' // ' + currentBiomeLabel() + ' // Drop Phase',
      body: 'Mission Command: toxin readings are climbing. You are unarmed until the source is shut down. Find the blinking metal spire on the high ground, then jump onto the translucent yellow block to disable it.',
      hudTitle: 'Locate the contamination source',
      hudMeta: 'Toxin exposure active',
      afterOk: startInsertionDrop
    });
    showToast('Drop beacon online. Locate the contamination source.');
  }

  function enterGameFromMenu() {
    applySettings();
    if (soundEnabled || ambientEnabled) window.ZomVoxSound?.prime();
    menu.style.display = 'none';
    startReplayRecording();
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

  function startStoryGame() {
    sound('confirm');
    if (mission.mode !== MODE_STORY || !mission.pendingBriefing) {
      mission.mode = MODE_STORY;
      mission.quickBiome = 'forest';
      document.body.classList.remove('quick-mode');
      generateWorld(MISSION_SEEDS[0] || INITIAL_SEED);
    }
    enterGameFromMenu();
  }

  function toggleQuickBiomePanel() {
    if (!quickBiomePanel) return;
    sound('confirm');
    quickBiomePanel.hidden = !quickBiomePanel.hidden;
  }

  function startQuickGame(biome) {
    sound('confirm');
    mission.mode = MODE_QUICK;
    mission.quickBiome = normalizeBiome(biome);
    resetActivePerks();
    document.body.classList.add('quick-mode');
    generateWorld(quickSeedForBiome(mission.quickBiome));
    enterGameFromMenu();
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
    sound('confirm');
    respawn();
  }
  play.addEventListener('click', startStoryGame);
  if (quickStart) quickStart.addEventListener('click', toggleQuickBiomePanel);
  for (const btn of quickBiomeButtons) {
    btn.addEventListener('click', () => startQuickGame(btn.dataset.biome));
  }
  briefingOk.addEventListener('click', acknowledgeObjectiveBriefing);
  if (briefingShareButton) briefingShareButton.addEventListener('click', () => shareRunFromButton(briefingShareButton));
  if (deathShare) deathShare.addEventListener('click', () => shareRunFromButton(deathShare));
  if (deathDownload) deathDownload.addEventListener('click', downloadReplay);
  deathContinue.addEventListener('click', continueFromDeath);
  deathGiveUp.addEventListener('click', giveUpMission);
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
    menu.style.display = locked || deathState.active || isBriefingOpen() || isUpgradeOpen() ? 'none' : 'flex';
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
    if (isBriefingOpen() && (e.code === 'Enter' || e.code === 'Space')) {
      e.preventDefault();
      acknowledgeObjectiveBriefing();
      return;
    }
    keys[e.code] = true;
    if (e.code === 'KeyR' && !e.repeat) startReload();
    if (e.code === 'KeyN' && !e.repeat) {
      beginWorldRebuild(mission.mode === MODE_QUICK ? quickSeedForBiome(mission.quickBiome) : nextMissionSeed());
    }
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
    if (!btn) return;
    btn.addEventListener('pointerdown', (e) => { touchMode = true; btn.classList.add('active'); down(); btn.setPointerCapture(e.pointerId); e.preventDefault(); });
    const clear = () => { btn.classList.remove('active'); if (up) up(); };
    btn.addEventListener('pointerup', clear);
    btn.addEventListener('pointercancel', clear);
  }
  bindTouchButton(touchShoot, () => {
    beginTouchShoot();
  }, () => {});
  bindTouchButton(touchJump, () => { touchInput.jump = true; }, () => { touchInput.jump = false; });

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
