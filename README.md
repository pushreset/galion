# Broadside

Pixel-art pirate naval combat in the browser, built with Three.js. Pick a ship, survive waves of navy ships, sink merchants for gold, board crippled enemies and level up your skills.

![Convoy sighted](qa/convoy.png)

## Run

ES modules need an HTTP server (opening `index.html` from disk won't work):

```sh
npx serve .        # or: python3 -m http.server
```

Then open the printed URL. Three.js loads from jsDelivr, so there's no install step.

## Online (2-4 players)

Peer-to-peer, no server to run: on the ship select screen, one player clicks **HOST CO-OP** or **HOST PVP** and shares the 4-letter room code; the others type it and click **JOIN**, then everyone picks a ship. The host presses `Enter` to set sail (co-op) or start the match (PvP).

- **Co-op**: shared gold, bigger waves, each pirate picks their own refit cards; a sunk pirate comes back at the next break, the run ends when the whole crew is sunk.
- **PvP**: first to 10 sinkings (or most after 5 min). Each sinking refits the winner; merchants keep coming as loot (their barrels patch your hull).
- Online there's no pause and no boarding QTE: only ships under 20% hull (striking their colours) can be boarded.
- The host's browser runs the game: keep that tab in front (background tabs get throttled and guests drop after 8 s). Connections use the public PeerJS server and STUN; a few strict NATs may need a TURN server (`iceServers` in `net.js`).

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
| `game.js` | Main loop, input, HUD, game state, online host snapshots / guest rendering |
| `net.js` | P2P transport (PeerJS): rooms, messages, heartbeat |
| `ships.js`, `world.js`, `water.js`, `fx.js` | Three.js scene: ships, islands, sea, effects |
| `post.js`, `palette.js` | Pixel post-processing and palette |
| `radar.js` | Compass / radar |
| `sfx.js` | Sound effects and procedural music |
| `check.mjs` | Assertions on the sim: `node check.mjs` |
| `qa/` | QA screenshots |

Ideas backlog (in French): [`ideas.md`](ideas.md).
