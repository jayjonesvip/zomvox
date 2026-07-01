# ZomVox

**ZomVox: Zombies and Voxels** is a browser-based voxel zombie survival shooter built for quick static hosting. The player drops into a large streaming voxel wasteland with sand, water, rocks, trees, ammo crates, block-breaking bullets, mobile controls, screen shake, death and respawn flow, and roaming voxel zombies.

The game runs directly in the browser with WebGL. There is no build step, package install, bundler, backend, or asset pipeline required.

## Play

Open `index.html` in a modern browser with WebGL enabled.

Desktop play uses mouse and keyboard. Mobile play is designed for landscape orientation and uses touch controls. The mobile menu requests fullscreen when the Fullscreen setting is enabled and the player presses Play.

## Current Features

- Static browser game with split frontend files: `index.html`, `styles.css`, and `script.js`.
- Branded ZomVox splash screen using `assets/zomvox-splash.png`.
- Favicon assets for browser tabs and installed shortcuts.
- Procedural voxel terrain with grass, dirt, stone, sand, water, wood, leaves, bricks, glow markers, trees, rocks, and beaches.
- Streaming chunk generation centered around the player so the world keeps generating as the player travels.
- Chunk unloading outside the active play area to keep memory practical while still making the world feel huge.
- Chunk-level mesh rebuilding for destructible blocks.
- Six-round blaster magazine with reserve ammo.
- Ammo pickups that add six rounds at a time.
- Zombie spawning, pursuit, attack cooldowns, retreat steps after attacks, deaths, score popups, and pickup drops.
- Mobile-only landscape gate.
- Mobile joystick movement plus separate jump, shoot, and run controls.
- Main menu settings for health HUD, ammo HUD, controls, sound, and fullscreen.
- Day/night lighting with code-based mode options.
- Optional custom sky color through code.
- Optional fog through code.
- Dangerous water enabled by default through code.
- Damage flash and screen shake when the player is hit.
- Dramatic `YOU DIED!` overlay with respawn meter.
- Menu-safe gameplay pause so the player does not take damage before pressing Play.

## Desktop Controls

- `WASD` or arrow keys: move
- Mouse: aim
- Left click: shoot
- Right click or `R`: reload
- `Space`: jump
- `Shift`: sprint
- `N`: rebuild a new random world

## Mobile Controls

Mobile is intended for landscape play.

- Left joystick: move
- Swipe open play area: aim
- Shoot button: fire
- Jump button: jump
- Run button: sprint

The mobile HUD is intentionally minimal. Health sits at the top left, ammo sits at the top right, and the old debug/status panel is removed so it does not block gameplay buttons.

## Settings Menu

The pre-game settings panel allows quick tuning before entering the world:

- Health: show or hide the health meter.
- Ammo: show or hide the ammo display.
- Controls: show or hide the mobile controls.
- Sound: turn game sounds on or off.
- Fullscreen: request fullscreen on mobile when play starts.

Seed controls were removed from the visible menu. The game still keeps an internal seed so a random rebuild can happen with `N`, but players no longer have to manage seed values from the main screen.

## Code Options

Gameplay environment options live near the top of `script.js` in `GAME_OPTIONS`.

```js
const GAME_OPTIONS = {
  timeMode: 'cycle',
  skyColor: null,
  dangerousWater: true,
  fog: true
};
```

`timeMode` controls the lighting mode:

- `'cycle'`: normal day/night cycle.
- `'day'`: always daytime.
- `'night'`: always nighttime.

`skyColor` controls the sky override:

- `null`: use the dynamic sky color from the active lighting mode.
- `'#102030'`: use a hex color string.
- `[0.06, 0.13, 0.20]`: use normalized RGB values from `0` to `1`.

`dangerousWater` controls water damage:

- `true`: water damages the player over time. This is the default.
- `false`: water is visual only.

`fog` controls distance fog:

- `true`: fog is enabled. This is the default.
- `false`: fog is disabled.

## Repository Layout

```text
.
|-- README.md
|-- index.html
|-- styles.css
|-- script.js
`-- assets/
    |-- favicon.ico
    |-- favicon.png
    `-- zomvox-splash.png
```

## File Responsibilities

- `index.html`: document structure, menu, settings, overlays, HUD containers, mobile controls, and script/style references.
- `styles.css`: visual styling, responsive mobile layout, splash screen, health/ammo HUD, death overlay, world rebuild overlay, and touch controls.
- `script.js`: WebGL setup, procedural terrain, streaming chunks, movement, combat, enemy behavior, pickups, world rebuilding, HUD updates, audio, and game loop.
- `assets/`: splash screen and favicon files.

## Hosting

Any static file host can serve the game. Upload the repository contents and open `index.html`.

For `zomvox.com`, point the domain at the static host or deployment target that serves these files. Because the project has no build step, the deployed files can be the same files in this repository.

## Project Status

ZomVox is in active prototype development. Current work is focused on mobile feel, smoother combat, readable HUD placement, terrain variety, streaming world generation, and keeping the browser game smooth on phones.
