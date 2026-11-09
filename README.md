# Broadside

Pixel-art pirate naval combat in the browser, built with Three.js. Pick a ship, survive waves of navy ships, sink merchants for gold, board crippled enemies and level up your skills.

![Convoy sighted](qa/convoy.png)

## Run

ES modules need an HTTP server (opening `index.html` from disk won't work):

```sh
npx serve .        # or: python3 -m http.server
```

Then open the printed URL. Three.js loads from jsDelivr, so there's no install step.

## Controls

Keys are physical positions, so AZERTY (ZQSD) and QWERTY (WASD) both work. AZERTY labels shown:

| Key | Action |
|---|---|
| `Z` / `S` | Sail up / down |
| `Q` / `D` | Turn |
| `A` / `E` | Fire port (left) / starboard (right) broadside |
| `1`–`4` | Skills |
| `Space` | Board nearby ship |
| `C` | Toggle overview zoom |
| `M` | Mute |
| `Esc` | Pause |

## Features

- Three player ships, progressive waves, destructible fort, islands that block cannonballs
- Skill bar (4 slots, learn and level up between waves)
- Merchant convoys, gold pickup with magnet, combo multiplier (×2 to ×5)
- Boarding: automatic under 20% hull, otherwise a timing QTE; crew losses and recruits
- Procedural music and SFX, local top-10 leaderboard

## Code

| File | Role |
|---|---|
| `sim.js` | Pure game simulation (no rendering) |
| `game.js` | Main loop, input, HUD, game state |
| `ships.js`, `world.js`, `water.js`, `fx.js` | Three.js scene: ships, islands, sea, effects |
| `post.js`, `palette.js` | Pixel post-processing and palette |
| `radar.js` | Compass / radar |
| `sfx.js` | Sound effects and procedural music |
| `check.mjs` | Assertions on the sim: `node check.mjs` |
| `qa/` | QA screenshots |

Ideas backlog (in French): [`ideas.md`](ideas.md).
