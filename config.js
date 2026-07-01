window.ZOMVOX_CONFIG = {
  buildVersion: '2026.07.01.1',
  initialSeed: 729641,

  environment: {
    timeMode: 'cycle', // 'cycle', 'day', or 'night'
    skyColor: null,   // null for dynamic sky, '#102030', or [0.06, 0.13, 0.20]
    dangerousWater: true,
    fog: true
  },

  world: {
    chunkSize: 16,
    chunkRadius: 2,
    maxY: 46,
    waterLevel: 8
  },

  player: {
    height: 1.76,
    radius: 0.31,
    startingHealth: 100,
    startingReserve: 36,
    respawnReserveFloor: 24,
    lowHealthThreshold: 25
  },

  weapon: {
    magSize: 6,
    reloadTime: 1.15,
    longRangeKillDistance: 34
  },

  enemies: {
    baseCap: 18,
    hordeKillsPerLevel: 5,
    hordeCapBonus: 2
  },

  pickups: {
    ammoRounds: 6,
    healthAmount: 25,
    mapAmmoChance: 0.28,
    mapHealthChance: 0.10,
    enemyHealthDropChance: 0.12,
    enemyAnyDropChance: 0.55
  },

  timers: {
    deathReadyDelay: 1.85,
    worldRebuildDuration: 2.35,
    heartbeatInterval: 0.95
  }
};
