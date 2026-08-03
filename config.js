/*
  ZOMVOX CONFIG

  This file is for gameplay tuning only.
  It should be loaded before script.js so the game can read window.ZOMVOX_CONFIG.

  Notes:
  - Keep property names the same unless script.js is updated too.
  - Most number values are clamped inside script.js, but stay within sane ranges.
  - Refresh the browser after editing this file.
*/

window.ZOMVOX_CONFIG = {
  /*
    Build label shown on the loading/splash screen.

    Bump this when you make visible changes so you can tell the browser
    loaded the newest version.
  */
  buildVersion: '2026.08.01.30',

  /*
    Seed used for deterministic world generation.

    Same seed = same world layout.
    Change this to any whole number to generate a different map.
  */
  initialSeed: 721456,

  environment: {
    /*
      Lighting mode.

      Options:
      - 'cycle' = day/night cycle
      - 'day'   = always daytime
      - 'night' = always nighttime
    */
    timeMode: 'cycle',

    /*
      Sky color override.

      Use null for the normal dynamic sky.
      You can also use:
      - Hex string: '#102030'
      - RGB array using 0-1 values: [0.06, 0.13, 0.20]
    */
    skyColor: null,

    /*
      When true, water acts like a hazard and damages the player over time.

      This also makes shoreline terrain feel more dangerous visually.
      Set false if you want water to be safe.
    */
    dangerousWater: true,

    /*
      Enables distance fog.
      Turning this off may make the world look clearer, but less atmospheric.
    */
    fog: true
  },

  world: {
    /*
      Size of each generated terrain chunk.

      Higher values create larger chunks.
      Lower values can make chunk rebuilds lighter.
    */
    chunkSize: 14,

    /*
      How many chunks generate outward from the center.

      Total generated chunks are roughly:
      (chunkRadius * 2 + 1) squared

      Example:
      4 = 9 x 9 chunks
    */
    chunkRadius: 5,

    /*
      Max terrain height.

      Higher values allow taller hills and terrain features.
      Very high values can hurt performance.
    */
    maxY: 32,

    /*
      Water height level.

      Higher value = more flooded/lake areas.
      Lower value = drier world.
    */
    waterLevel: 5,

    /*
      Draws one visual-only ocean plane around the island.

      This is not generated as blocks, so it should be much cheaper than
      filling the outer edge with water cubes.
    */
    ocean: true,
    oceanPadding: 96,

    /*
      Terrain height tuning.

      Lower detail/ridge/depth values create flatter, more playable islands.
      Higher values create rougher, more dramatic terrain.
    */
    terrainBaseHeight: 4,
    terrainDetailAmount: 12,
    terrainBroadAmount: 10,
    terrainRidgeAmount: 2,
    terrainLakeADepth: 16,
    terrainLakeBDepth: 13,
    terrainMarshDepth: 16
  },

  player: {
    /*
      Player collision height.

      This affects how tall the player is for movement/collisions.
    */
    height: 1.76,

    /*
      Player collision radius.

      Smaller = can squeeze through tighter gaps.
      Larger = easier to collide with walls/blocks.
    */
    radius: 0.31,

    /*
      Auto-step height for walking up normal terrain without jumping.

      1.05 lets players climb one-block hills while still stopping at
      taller ledges and temporary world props.
    */
    stepHeight: 1.05,

    /*
      Camera smoothing after an auto-step.

      Physics still moves instantly for reliable collision, but the camera
      eases upward over this many milliseconds so one-block climbs feel
      more natural.
    */
    stepSmoothMs: 120,

    /*
      Health after starting or respawning.
    */
    startingHealth: 100,

    /*
      Ammo reserve when starting a new run.

      This does not include the bullets already loaded in the magazine.
    */
    startingReserve: 12,

    /*
      C4 charges available when combat begins.

      C4 is placed from the mobile C4 button or desktop C key.
    */
    startingC4: 1,

    /*
      Minimum reserve ammo after respawn.

      If the player dies with less than this, reserve ammo is raised
      back up to this value.
    */
    respawnReserveFloor: 24,

    /*
      Low-health threshold used by status warnings and heartbeat feedback.

      Main combat now uses a two-bite wounded/dead loop instead of a visible
      health meter.
    */
    lowHealthThreshold: 25,

    /*
      Seconds needed to recover after the first zombie bite.

      A second bite during this recovery window downs the player.
    */
    biteRecoverySeconds: 60,

    /*
      Recovery seconds after the Rapid Recovery perk is equipped.
    */
    rapidRecoverySeconds: 30
  },

  weapon: {
    /*
      Magazine size.

      This also controls how many bullet icons show in the HUD.
    */
    magSize: 6,
    /*
      Reload duration in seconds.

      Lower = faster reload.
      Higher = slower reload.
    */
    reloadTime: 1.50,

    /*
      Fire cooldown in seconds between shots.
    */
    fireCooldown: 0.42,

    /*
      Random aim kick applied after every shot.

      Premium Grip reduces this by premiumGripMultiplier.
      Values above 1 are clamped so the upgrade cannot add recoil.
    */
    recoilAmount: 0.33,

    /*
      Upgrade tuning.
    */
    quickReloadMultiplier: 0.5,
    doubleMagMultiplier: 2,
    premiumGripMultiplier: 0.38,
    hairTriggerMultiplier: 0.5,
    ammoBeltMultiplier: 1.5,
    blastPackRadiusMultiplier: 1.25,

    /*
      Distance needed for the long-range kill bonus.

      Measured in game/world units.
    */
    longRangeKillDistance: 34
  },

  enemies: {
    /*
      Starting max number of enemies allowed alive at once.
    */
    baseCap: 18,

    /*
      Kills needed before horde pressure increases.

      Example:
      5 means the horde level increases every 5 kills.
    */
    hordeKillsPerLevel: 4,

    /*
      Extra enemy capacity added each horde level.

      Current cap roughly becomes:
      baseCap + hordeLevel * hordeCapBonus
    */
    hordeCapBonus: 2,

    /*
      Zombie moans only play when zombies are close enough to feel threatening.

      Max voices lets a small pack sound layered without turning into noise.
      Interval values are seconds between moan checks.
    */
    zombieMoanRadius: 10,
    zombieMoanMaxVoices: 3,
    zombieMoanIntervalMin: 2.0,
    zombieMoanIntervalMax: 3.0
  },

  mission: {
    /*
      Cinematic insertion at the start of each Frontier Hunt.

      Height is in world blocks. Fall speed is blocks per second.
    */
    insertionDropHeight: 30,
    insertionFallSpeed: 5.8,

    /*
      Zombies spawned immediately after touchdown before normal horde pressure.
    */
    firstWaveSize: 3
  },

  pickups: {
    /*
      Ammo gained from one ammo pickup.
    */
    ammoRounds: 6,

    /*
      Chance for an ammo pickup to spawn in a generated chunk.

      Range:
      0.00 = never
      1.00 = always
    */
    mapAmmoChance: 0.28,

    /*
      Chance that a killed enemy drops C4.

      C4 is a flat proximity charge that detonates when infected touch it.
    */
    enemyC4DropChance: 0.06,

    /*
      Overall chance that a killed enemy drops something.

      C4 is checked first. If the roll is still below this value, the enemy
      drops ammo. Health pickups are intentionally disabled.
    */
    enemyAnyDropChance: 0.25
  },

  timers: {
    /*
      Revive meter duration after accepting Mission Command's death prompt.

      Measured in seconds.
    */
    deathReadyDelay: 3,

    /*
      Duration of the world rebuild/loading overlay.

      Measured in seconds.
    */
    worldRebuildDuration: 2.35,

    /*
      Time between heartbeat sounds when health is low.

      Lower = faster heartbeat.
      Higher = slower heartbeat.
    */
    heartbeatInterval: 0.95,

    /*
      Day/night cycle half length in milliseconds.

      This only applies when environment.timeMode is 'cycle'.
      The cycle starts at dawn, reaches dusk after this duration,
      then returns to dawn after this duration again.

      360000 = 6 minutes from dawn to dusk.
    */
    cycleHalfDayMs: 360000
  },

  comms: {
    /*
      Mission Command radio text.

      Keep these short so the hologram-style transmission fits on mobile.
      dropIn supports {islandName}, {biome}, and {zombieTotal}.
      huntComplete supports {islandName} and {biome}.
      Use an empty string '' to disable a specific transmission.
    */
    dropIn: 'You are on {islandName}. The mission is to kill {zombieTotal} infected.',
    huntComplete: '{islandName} is clear. Ready for the next mission?',
    bitten: 'You are bit. Keep distance and survive one minute to recover.',
    recovered: 'You are at full strength. Complete your objective.',
    death: 'Can you hear me? Do you want to keep going?',
    postRevival: 'Glad you are back. Focus on the objective.',
    fewMore: 'Just a few more.',
    lowHealth: 'Retreat and treat your wounds.',
    longRange: 'Nice shot.',
    ammoCache: 'Ammo cache marked nearby.'
  },

  audio: {
    /*
      Optional file-backed sounds.

      Put mp3/wav files in assets/ and set the file name here.
      File-backed audio is tried first. The procedural synth stays available
      as a fallback when a cue is blank, missing, or unavailable.

      Use:
      - 'sound-name.mp3' to use an asset file
      - null to use the built-in procedural fallback
      - '' to intentionally leave a slot silent/fallback-only
    */
    preferFiles: true,
    fileFallback: true,
    playbackRates: {
      shoot: 1.15
    },
    files: {
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
      footstep: null,
      heartbeat: '',
      pickup: 'pickup.mp3',
      pickupAmmo: 'pickupAmmo.mp3',
      pickupC4: 'pickupC4.mp3',
      perkEquip: 'perkEquip.mp3',
      objectiveClear: 'objectiveClear.mp3',
      wave: 'wave.mp3',
      confirm: '',
      briefing: 'briefing.mp3',
      zombieMoan: 'zombieMoan.mp3',
      ambientMenu: 'ambientMenu.mp3',
      ambientForest: 'ambientForest.mp3',
      ambientDunes: 'ambientDunes.mp3',
      ambientRocky: 'ambientRocky.mp3',
      ambientSwamp: 'ambientSwamp.mp3',
      ambientAshlands: 'ambientAshlands.mp3',
      ambientTundra: ''
    }
  }
};
