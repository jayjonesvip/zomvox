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
  buildVersion: '2026.07.20.11',

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
      taller ledges and mission props.
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
      Health level where low-health warning effects begin.

      Lower = warnings happen later.
      Higher = warnings happen sooner.
    */
    lowHealthThreshold: 25
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
      Five deterministic mission islands.

      Clearing the infected objective redeploys to the next seed.
    */
    islandSeeds: [721456, 482177, 535331, 918244, 126509],

    /*
      Biome for each mission island.

      Options:
      - 'forest' = mostly grass with frequent trees
      - 'dunes' = mostly sand with saguaros and no trees
      - 'rocky' = mostly stone with boulders and rare trees
      - 'swamp' = mud/grass mix with sparse wet trees
      - 'ashlands' = ash/stone with dead trees and boulders
      - 'tundra' = snow, frozen water, pine trees, and sparse rocks

      These line up with islandSeeds by position.
    */
    biomes: ['forest', 'rocky', 'dunes', 'swamp', 'ashlands'],

    /*
      Health drained per second while the contamination machine is active.
    */
    toxinDamagePerSecond: 2.50,

    /*
      Seconds the player must stand on the translucent yellow shutdown block.
    */
    disableSeconds: 3,

    /*
      Cinematic insertion after accepting each island briefing.

      Height is in world blocks. Fall speed is blocks per second.
    */
    insertionDropHeight: 30,
    insertionFallSpeed: 5.8,

    /*
      Combat objective for each island after the gun unlocks.

      These line up with islandSeeds by position.
    */
    infectedGoals: [20, 25, 50, 75, 100],

    /*
      Fallback combat objective if infectedGoals is removed.
    */
    infectedGoal: 50,

    /*
      Zombies spawned immediately after shutdown before normal horde pressure.
    */
    firstWaveSize: 3
  },

  pickups: {
    /*
      Ammo gained from one ammo pickup.
    */
    ammoRounds: 6,

    /*
      Health restored from one health pickup.
    */
    healthAmount: 25,

    /*
      Chance for an ammo pickup to spawn in a generated chunk.

      Range:
      0.00 = never
      1.00 = always
    */
    mapAmmoChance: 0.28,

    /*
      Chance for a health pickup to spawn in a generated chunk.

      Range:
      0.00 = never
      1.00 = always
    */
    mapHealthChance: 0.10,

    /*
      Chance that a killed enemy drops C4.

      C4 is a flat proximity charge that detonates when infected touch it.
    */
    enemyC4DropChance: 0.06,

    /*
      Chance that a killed enemy drops health.
    */
    enemyHealthDropChance: 0.04,

    /*
      Overall chance that a killed enemy drops something.

      C4 and health are checked first. If the roll is still below this value,
      the enemy drops ammo.
    */
    enemyAnyDropChance: 0.55
  },

  timers: {
    /*
      Delay before the player can continue after dying.

      Measured in seconds.
    */
    deathReadyDelay: 1.85,

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

  audio: {
    /*
      Optional sound file overrides.

      Put mp3/wav files in assets/ and set the file name here.
      Use null to keep the built-in synthesized sound.
      Use an empty string '' to disable a specific sound.
    */
    files: {
      shoot: 'shoot.mp3',
      empty: 'empty.mp3',
      reloadStart: 'reloadStart.mp3',
      reloadDone: null,
      block: null,
      hit: 'hit.mp3',
      head: 'head.mp3',
      kill: 'hit.mp3',
      pickup: 'pickup.mp3',
      pickupAmmo: 'pickupAmmo.mp3',
      pickupHealth: 'pickup.mp3',
      bite: 'bite.mp3',
      hurt: 'hurt.mp3',
      toxin: 'toxin.mp3',
      land: 'land.mp3',
      objectiveClear: 'objectiveClear.mp3',
      wave: null,
      heartbeat: null,
      confirm: null,
      briefing: null,
      perkEquip: 'pickupAmmo.mp3',
      explosion: 'explosion.mp3',
      zombieMoan: 'zombiemoan.wav',

      /*
        Ambient loops are file-only. Leave as '' to keep that area silent.
        Drop mp3/wav loops into assets/ and set the matching file name here.
      */
      ambientMenu: 'ambientMenu.mp3',
      ambientForest: 'ambientForest.mp3',
      ambientDunes: 'ambientDunes.mp3',
      ambientRocky: 'ambientRocky.mp3',
      ambientSwamp: 'ambientSwamp.mp3',
      ambientAshlands: 'ambientAshlands.mp3',
      ambientTundra: 'ambientRocky.mp3'
    }
  }
};
 
