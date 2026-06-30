# Ominous Realms

Ominous Realms is a single-file, browser-based voxel survival shooter. It drops the player into a fixed-size block world with sand, stone, water, trees, ammo pickups, roaming voxel enemies, day/night lighting, mobile controls, and destructible terrain.

The entire game currently lives in `index.html`, which makes it easy to host, share, and iterate on without a build pipeline.

## Play

Open `index.html` in a modern browser.

For the best experience, use a browser with WebGL enabled. Desktop play works with mouse and keyboard. Mobile play is designed for landscape orientation and touch controls.

## Current Features

- Single-file HTML game with embedded CSS, JavaScript, and WebGL rendering.
- Procedural voxel terrain built from grass, dirt, stone, sand, water, wood, leaves, bricks, and glow markers.
- Fixed-size world bounds so the map does not grow forever while the player moves.
- Chunk-level mesh rebuilding for block destruction, reducing the hitch that came from rebuilding the whole world after every shot.
- Day/night lighting cycle with changing sky color and directional light.
- Six-round blaster magazine with reserve ammo.
- Ammo pickups that add six rounds at a time.
- Enemy spawning, pursuit, attacks, damage, deaths, scoring, combo popups, and pickups.
- Block destruction by shooting terrain.
- Mobile-only landscape gate.
- Mobile touch joystick, jump, shoot, and run controls.
- Settings screen before play for HUD, audio, controls, and fullscreen preferences.
- Damage flash and screen shake when the player is hit.
- Menu-safe gameplay pause so the player does not take damage while adjusting settings or before pressing Play.

## Desktop Controls

- `WASD` or arrow keys: move
- Mouse: aim
- Left click: shoot
- Right click or `R`: reload
- `Space`: jump
- `Shift`: sprint
- `N`: generate a new world
- `F`: toggle debug fly mode

## Mobile Controls

Mobile is intended for landscape play.

- Left joystick: move
- Swipe on the open play area: aim
- Shoot button: fire
- Jump button: jump
- Run button: sprint

The mobile start screen uses mobile-specific instructions instead of desktop keyboard controls. The detailed status HUD is hidden by default on touch devices to preserve play space, while health, ammo, and controls remain visible unless changed in settings.

## Settings

The pre-game settings panel allows quick tuning before entering the world:

- Status: show or hide the detailed status/debug HUD.
- Health: show or hide the health meter.
- Ammo: show or hide the ammo display.
- Controls: show or hide the mobile controls.
- Sound: turn game sounds on or off.
- Fullscreen: request fullscreen on mobile when play starts.

On mobile, Status defaults off and Fullscreen defaults on. On desktop, Status defaults on.

## Gameplay Notes

Ominous Frontier is currently tuned as an arcade survival prototype. The player explores, shoots enemies, breaks blocks, collects ammo, and survives enemy attacks.

Enemies attack when they get close enough to the player. Their hitboxes and attack ranges are intentionally a little generous so mobile shooting feels less fussy.

Water is generated through terrain depressions and lake basins. Beaches and sand should appear around lower areas, while stone outcrops add landmarks and cover.

## Technical Notes

The game uses WebGL directly rather than a framework. Terrain is represented as block IDs in a map, then converted into visible mesh buffers. Dynamic objects such as enemies, pickups, and particles are built into a separate dynamic mesh each frame.

Terrain rendering is chunked. Full rebuilds are used when creating a world, while block destruction only marks nearby chunks dirty and rebuilds those chunk meshes. This keeps shooting responsive even in the fixed-size world.

There is no package install step and no compilation step.

## Repository Layout

```text
.
├── README.md
└── index.html
```

## Development

Because the project is a single HTML file, most changes can be made directly in `index.html`.

Useful areas to look for:

- CSS HUD and mobile layout: top `<style>` block.
- Block IDs and world constants: JavaScript constants near the start of the script.
- Terrain generation: `terrainHeight()` and `generateChunk()`.
- Mobile controls: `updateStick()`, touch button bindings, and the touch aim handlers.
- Combat: `shoot()`, `raycastProjectile()`, `entityHitAt()`, and `updateEnemies()`.
- HUD updates: `updateHud()` and `updateAmmoDisplay()`.

## Hosting

Any static file host can serve the game. Upload `index.html` and `README.md`, then open `index.html` in the browser.

## Project Status

Ominous Frontier is in active prototype development. Current work is focused on mobile ergonomics, readability of the HUD, enemy feel, terrain variety, and keeping the single-file game smooth on phones.
