# CHAOS ISLAND

A 3D dark-fantasy open-world survival prototype. **A game by AKANAZA Studio.**
Plain ES modules + Three.js (r160). No build step is needed to play. Capacitor-ready for Android.

## Run the game

You need Node.js 18+ (any modern version) and a browser with WebGL (Chrome, Edge, Firefox, Safari).

```bash
cd chaos-island
npm run setup     # installs Three.js and copies it to js/vendor/ (works offline afterwards)
npm start         # serves http://localhost:8080
```

Open <http://localhost:8080>. Add `?debug` to the URL for an FPS / draw-call / render-scale counter.

* The game **must be served over HTTP**. Opening `index.html` directly (`file://`) will not work because browsers block ES modules there.
* No Node? Any static server works, e.g. `python3 -m http.server 8080`.
* Skipping `npm run setup` still works if the device is online: `index.html` falls back to the jsDelivr CDN for Three.js.

### Controls

| Action | Touch | Keyboard / mouse |
|---|---|---|
| Move | Arrow buttons or virtual joystick | WASD / arrow keys |
| Run | Run button | Shift |
| Jump | Jump button | Space |
| Attack / gather | Sword button (hold to repeat) | J |
| Interact (gather, else eat) | E button | E or F |
| Look | Drag anywhere on the empty screen | Drag with mouse, wheel to zoom |
| Bag / Craft / Pause | HUD buttons | I / C / Esc |

Settings → Controls lets you choose arrows or joystick, set the control size, and open the **layout editor**
(drag a control to move it, drag its orange corner to resize). Changes save instantly.

## Export / download the project

* The whole project is this folder. Zip it (leave out `node_modules/`, `www/`, `android/`, `tests/shots/`):
  `zip -r chaos-island.zip chaos-island -x "*/node_modules/*" "*/www/*" "*/android/*" "*/tests/shots/*"`
* To move it to another machine: copy the zip, unzip, then run the two commands above.

## Build an Android APK (Capacitor)

```bash
npm run setup                  # vendor Three.js locally (required: the APK must work offline)
npm run build                  # assembles ./www
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npx cap sync android
npx cap open android           # build / run the APK from Android Studio
```

`capacitor.config.json` is already set up (`com.akanaza.chaosisland`, web dir `www`). Requires Android System WebView 89+
(import maps). Optional: lock the activity to landscape in `AndroidManifest.xml`. All saves use `localStorage`, which persists
inside the Capacitor WebView; `js/core/storage.js` is the one place to swap in native storage later.

## Graphics quality

Settings → Graphics quality: **Low / Medium / High** (saved locally). The first launch picks a default from the device
(phones and low-core CPUs start on Low). The game also lowers its render resolution automatically if the frame rate stays low.

| | Low | Medium | High |
|---|---|---|---|
| Shadows | off | 1024 map | 2048 soft |
| View distance | 120 | 180 | 250 |
| Scenery density | 30% | 65% | 100% |
| Grass | off | 50% | 100% |
| Ambient particles | 60 | 150 | 300 |
| Heat point lights | 0 | 1 | 3 |
| Wind sway, water layers | off | on | on |
| Max pixel ratio | 1 | 1.5 | 2 |

Rendering approach: one merged-geometry mesh per prop type, drawn with `InstancedMesh` in 48-unit chunks that are
frustum-culled and hidden beyond the fog distance; textures are generated procedurally at startup (no image files).

## Project layout

```
index.html            screens + Three.js loader (local copy first, CDN fallback)
css/main.css          dark-fantasy UI, RTL support
js/main.js            entry: splash, menu wiring, lazy game start
js/core/              i18n (EN/AR), storage, screens, profile, quality presets, seeded random
js/data/              items, recipes, skins, enemy stats (pure data)
js/world/             worldgen (islands, decor, spawn), colliders, worldStore (saves)
js/game/              game loop, player, character, enemies, gather, inventory, HUD,
                      world-render (terrain/sky/water/lava/props), props (geometry kit), textures
js/ui/                menu, profile/skin screen, controls + layout editor
js/net/lan.js         LAN discovery PROTOTYPE seam (no networking yet)
scripts/              serve / vendor-three / build-www
tests/                see below
```

## Tests

```bash
npm test          # import graph, world generation, reachability, starter resources, progression
npm run test:e2e  # needs Python + Playwright; drives menus and a full play session in headless Chromium
```

**Important:** the end-to-end test runs the real game code against a *stand-in* for Three.js (`tests/three-stub.js`),
because the real library could not be downloaded in the environment where this was developed. It verifies logic,
navigation, saving, crafting, combat and error-free operation on every island and quality level, but it **cannot verify
how the game looks or performs on a GPU**. See "Known issues".

## Status

### Implemented
* Studio logo splash; main menu with player name, skin icon and "A game by AKANAZA Studio"
* English / Arabic with full RTL layout
* Play, Multiplayer (LAN **prototype**), Other Worlds (saved worlds), Settings, World Creation (name, multiplayer flag, difficulty, three island types, large green Play button)
* Procedural islands (new random seed per world): irregular coastlines, volcanoes + lava, dunes + ruins + caves, forests + rivers + hidden glades
* Thumbnails and minimap rendered from the same generator data as the 3D world
* Third-person movement, run, jump, wading through shallows, collision with trees and rocks
* Empty start: no items, no weapon, no armor; resource gathering; 24-slot bag; equipment slots; 10 recipes; armor unlocks cosmetic skins
* Health (regenerates), stamina, fall and lava damage, death and respawn
* One enemy type per island with chase / lunge AI, loot drops, difficulty scaling
* Local saving (autosave + on exit): position, vitals, inventory, equipment, harvested resources, defeated enemies
* Humanoid character with face, hair, tattered base clothing, held tools, and walk / run / jump / land / attack / hurt / death animation
* Controls: arrows or joystick, size, drag-to-reposition and resize editor, saved layout
* Low / Medium / High graphics quality

### Not implemented yet
* Online multiplayer and real LAN discovery (the screen only lists this device's worlds, clearly labeled prototype)
* Sound and music; day / night cycle; weather
* Building / placing objects; farming; hunger and thirst
* Cave interiors (caves are marked entrances only); swimming in deep water
* Ranged combat; boss enemies; quests

### Known issues
* **The 3D visuals have not been seen on a real GPU.** Terrain, sky, water, lava, props, character and the wind-sway shader were written carefully
  against the Three.js r160 API but could only be run against a stand-in. Expect to tune colors, fog, scale and lighting once you see it.
  If anything misrenders, add `?debug` and check the browser console; runtime errors also appear in a red box on screen.
* Performance targets (low-end phones) are by design, not measured. Use `?debug` to see FPS and draw calls, and the Low preset.
* Some recipes need materials that only exist on another island (e.g. Obsidian Blade needs obsidian from the Volcanic Island);
  every island can craft an axe, torch, a weapon and at least one armor piece.
* Player-made worlds are limited by browser storage (about 5 MB total); each save is small because terrain is regenerated from its seed.
* On very old WebViews (below Chromium 89) import maps are unsupported; bundling with Vite would remove that requirement.
