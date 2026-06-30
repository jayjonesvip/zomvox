# ZomVox

**ZomVox: Zombies and Voxels** is a browser-based voxel zombie survival shooter. It drops the player into a fixed-size block world with sand, stone, water, rocks, trees, ammo pickups, roaming voxel zombies, day/night lighting, mobile controls, destructible terrain, and a splash/loading flow built for `zomvox.com`.

## Play

Open `index.html` in a modern browser with WebGL enabled.

Desktop play uses mouse and keyboard. Mobile play is designed for landscape orientation with touch controls.

## Current Features

- WebGL voxel rendering with no build step.
- Split frontend files: `index.html`, `styles.css`, and `script.js`.
- Branded ZomVox splash screen and favicon assets.
- Procedural voxel terrain with grass, dirt, stone, sand, water, wood, leaves, bricks, and glow markers.
- Fixed-size world bounds so the map does not grow forever while the player moves.
- Seed-driven world generation from the settings menu.
- Rebuilding-world status meter when changing seeds or generating a new world.
- Chunk-level mesh rebuilding for block destruction.
- Day/night lighting cycle.
- Six-round blaster magazine with reserve ammo.
- Ammo pickups that add six rounds at a time.
- Zombie spawning, pursuit, attack cooldowns, retreat steps after attacks, deaths, scoring, and pickups.
- Dramatic death overlay with respawn meter.
- Mobile-only landscape gate.
- Mobile touch joystick, jump, shoot, and run controls.
- Settings screen for HUD visibility, audio, controls, fullscreen, and seed changes.
- Damage flash and screen shake when the player is hit.
- Menu-safe gameplay pause so the player does not take damage before pressing Play.

## Desktop Controls

- `WASD` or arrow keys: move
- Mouse: aim
- Left click: shoot
- Right click or `R`: reload
- `Space`: jump
- `Shift`: sprint
- `N`: rebuild with a random seed
- `F`: toggle debug fly mode

## Mobile Controls

Mobile is intended for landscape play.

- Left joystick: move
- Swipe open play area: aim
- Shoot button: fire
- Jump button: jump
- Run button: sprint

## Settings

The pre-game settings panel allows quick tuning before entering the world:

- Status: show or hide the detailed status/debug HUD.
- Health: show or hide the health meter.
- Ammo: show or hide the ammo display.
- Controls: show or hide the mobile controls.
- Sound: turn game sounds on or off.
- Fullscreen: request fullscreen on mobile when play starts.
- Seed: enter a numeric seed from `0` to `999999`.
- Rebuild World: apply the seed, show a rebuilding meter, regenerate the world, and restart the run.

On mobile, Status defaults off and Fullscreen defaults on. On desktop, Status defaults on.

## Repository Layout

```text
.
├── README.md
├── index.html
├── styles.css
├── script.js
└── assets/
    ├── favicon.ico
    ├── favicon.png
    └── zomvox-splash.png
```

## Development

There is no package install step and no compilation step.

Useful areas:

- `index.html`: document structure, HUD, menu, settings, overlays, and controls.
- `styles.css`: visual styling, responsive mobile layout, splash screen, HUD, death overlay, and world rebuild overlay.
- `script.js`: WebGL setup, terrain generation, movement, combat, enemy behavior, seed rebuilding, HUD updates, and game loop.
- `assets/`: splash screen and favicon files.

## Hosting

Any static file host can serve the game. Upload the repository contents and open `index.html`.

For `zomvox.com`, point the domain at the static host or deployment target that serves these files.

## Project Status

ZomVox is in active prototype development. Current work is focused on mobile feel, zombie combat rhythm, readable HUDs, seed-driven worlds, terrain variety, and keeping the browser game smooth on phones.
