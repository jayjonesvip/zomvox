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
  buildVersion: '2026.07.05.4',

  /*
    Seed used for deterministic world generation.

    Same seed = same world layout.
    Change this to any whole number to generate a different map.
  */
  initialSeed: 29190007,

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
    chunkSize: 16,

    /*
      How many chunks generate outward from the center.

      Total generated chunks are roughly:
      (chunkRadius * 2 + 1) squared

      Example:
      4 = 9 x 9 chunks
    */
    chunkRadius: 4,

    /*
      Max terrain height.

      Higher values allow taller hills and terrain features.
      Very high values can hurt performance.
    */
    maxY: 50,

    /*
      Water height level.

      Higher value = more flooded/lake areas.
      Lower value = drier world.
    */
    waterLevel: 11
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
      Health after starting or respawning.
    */
    startingHealth: 100,

    /*
      Ammo reserve when starting a new run.

      This does not include the bullets already loaded in the magazine.
    */
    startingReserve: 12,

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
    reloadTime: 1.15,

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
    hordeKillsPerLevel: 5,

    /*
      Extra enemy capacity added each horde level.

      Current cap roughly becomes:
      baseCap + hordeLevel * hordeCapBonus
    */
    hordeCapBonus: 2
  },

  mission: {
    /*
      Five deterministic mission islands.

      Clearing the infected objective redeploys to the next seed.
    */
    islandSeeds: [29190007, 482177, 735331, 918244, 126509],

    /*
      Health drained per second while the contamination machine is active.
    */
    toxinDamagePerSecond: 1.15,

    /*
      Seconds the player must hold action near the source to disable it.
    */
    disableSeconds: 3,

    /*
      Distance from the machine where the action prompt works.
    */
    machineActionRadius: 3.6,

    /*
      Combat objective for each island after the gun unlocks.

      These line up with islandSeeds by position.
    */
    infectedGoals: [25, 50, 100, 250, 500],

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
      Chance that a killed enemy drops health.

      This is checked before regular ammo drops.
    */
    enemyHealthDropChance: 0.12,

    /*
      Overall chance that a killed enemy drops something.

      If the roll is below enemyHealthDropChance, it drops health.
      Otherwise, if the roll is below this value, it drops ammo.
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
    */
    files: {
      shoot: 'shoot.mp3',
      empty: 'empty.mp3',
      reloadStart: 'reload.mp3',
      reloadDone: null,
      block: null,
      hit: 'hit.mp3',
      head: 'hit.mp3',
      kill: 'hit.mp3',
      pickup: 'pickup.mp3',
      pickupAmmo: 'freesound_community-item-equip-6904.mp3',
      pickupHealth: 'pickup.mp3',
      bite: 'freesound_community-zombie-bite-96528.mp3',
      hurt: 'hurt.mp3',
      wave: null,
      heartbeat: null
    }
  }
};
