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

- **Quick match**: **QUICK CO-OP** (waves or convoy, following the **GAME** button) or **QUICK PVP** drops you into a room with strangers, no code to share. The first player in a queue hosts; as soon as someone joins, a 15 s countdown starts (cut short when all 4 pirates have a ship), then the game sets sail on its own; a host who hasn't picked a ship by then gets a random one. Friends can still join a quick room with its code.

- **Convoy** (solo or co-op: set the **GAME** button to CONVOY before picking a ship or hosting): its own long map between two ports, forts on the way. Each round a merchant convoy sails port to port with its escort: guards that stay beside the merchants, hunters that come for you. The round ends when every merchant is sunk, captured or in port. Gold that reaches port buys a bigger escort for the next convoys.
- **Co-op**: shared gold, bigger waves, each pirate picks their own refit cards; a sunk pirate comes back at the next break, the run ends when the whole crew is sunk.
- **PvP**: first to 10 sinkings (or most after 5 min). Each sinking refits the winner; merchants keep coming as loot (their barrels patch your hull).
- Online there's no pause and no boarding QTE: only ships under 20% hull (striking their colours) can be boarded.
- The host's browser runs the game. It keeps running when that tab is hidden (a worker's timer steps it at 30 Hz, since a hidden tab gets no frames; checked in Chrome), but not if the tab is closed or the browser suspends it.

### How two distant PCs connect

Home PCs sit behind a router (NAT) that drops unsolicited incoming connections, so neither browser can simply "call" the other. WebRTC, built into every browser, gets around it in three steps. [PeerJS](https://peerjs.com) wraps them in a few calls:

```
        1. signalling (public PeerJS server)
     ┌──────────► 0.peerjs.com ◄──────────┐
     │     "I am broadside-DVZL"          │
  Host                                  Guest
     ◄═════════ 3. direct link ═════════►
     │                                    │
     └──► 2. STUN (Google) ◄──────────────┘
          "what's my public address?"
```

1. **Signalling: finding each other.** The host registers on the free PeerJS server under `broadside-` + the room code. The guest asks the same server to connect it to that id. The server only relays a few setup messages; no game traffic goes through it.
2. **STUN: learning your public address.** Each browser asks a STUN server (`stun.l.google.com`), which answers with the address it sees from outside. Both sides swap these candidate addresses through the signalling server.
3. **Hole punching.** Both browsers send packets to each other's public address at the same time. Each router sees an outgoing packet first, so it lets the other side's packets in as "replies". The result is a direct, encrypted (DTLS) data channel between the two PCs. Direct also means each player sees the others' public IP address, so share a room code only with people you would give that to.

When hole punching fails (strict or symmetric NATs, some corporate or mobile networks), traffic goes through a **TURN relay** instead. PeerJS ships with free community TURN servers (`eu-0` / `us-0.turn.peerjs.com`) in its default config, so this works out of the box, though with no guarantee. For something more reliable, pass your own `iceServers` to `new Peer(...)` in `net.js` (Cloudflare Calls, Metered, or a self-hosted coturn).

**Quick match** adds one step before signalling: the same Coolify service that hands out TURN credentials keeps one open room per queue (`pvp`, `coop-waves`, `coop-convoy`). `GET /match?q=pvp` answers `{host: code}` (no open room: you open it, under that code), `{join: code}`, or `{retry}` while the room's host is still registering on PeerJS. The host reports its free seats every 10 s (`&code=…&free=n`; 0 as soon as the game starts, and once its tab has been hidden for over a minute, its pirate being away; before that a guest can still join, and a bell and the tab's title call the host back); a room silent for 25 s is dropped, and a guest who can't get in asks again with `&skip=code`. A host whose room was dropped while it still has free seats relists it with its next heartbeat (when the queue has no open room). The queues live in memory: a restart empties them, games already running don't notice and waiting hosts relist. To test locally, `qa/quick.mjs` runs a copy of the service and points the game at it with `?ice=http://127.0.0.1:3123/`.

All of it is free: STUN answers once per connection (a few bytes), and signalling is a handful of messages. Only TURN carries real traffic, and only when the direct link fails.

### What goes over the wire

The host runs the whole simulation; guests are thin clients:

- **Guest → host**: input (`{t: 'in', turn, fireL, fireR}` when it changes) and actions (`sail`, `skill`, `board`, `card`, `ship`), plus a ping every second. The host clamps everything it receives.
- **Host → guests, 20×/s**: a snapshot with ships (compact arrays), cannonballs, loot, kegs, the fort, game state and HUD data for each pirate. It also carries the one-shot effects of the last 50 ms (hits, splashes, muzzle flashes, popups, sounds). JSON with numbers rounded to 0.01, a few KB per snapshot.
- Guests draw one snapshot behind and glide each value between the last two, so movement stays smooth at 60 fps. Sounds are replayed relative to the guest's own ship.
- If either side hears nothing for 8 s, the link is dropped: a guest who leaves sinks, and guests go back to the lobby if the host leaves.

## Controls

Arrows steer. The letter keys are physical positions, so the broadsides are `A` / `E` on AZERTY and `Q` / `E` on QWERTY. AZERTY labels shown:

| Key | Action |
|---|---|
| `↑` / `↓` | Sail up / down |
| `←` / `→` | Turn |
| `A` / `E` | Fire port (left) / starboard (right) broadside |
| `1`–`4` | Skills |
| `Space` | Board nearby ship |
| `C` | Toggle overview zoom |
| `M` | Mute |
| `P` | Pause |

## Features

- Three player ships, progressive waves, destructible fort, islands that block cannonballs
- The kraken: a slow sea monster that roams the map in every mode (waves 4, 7, 10…, convoys 3, 6, 9…, PvP a minute in and a minute after each kill). It slams any ship that comes near, pirate, navy or merchant alike: a tentacle rises, then falls where you were heading 2.2 s later, so turn hard. It can be killed, but drops no loot, and neither do the ships it sinks; in PvP its sinkings score for nobody
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
| `coturn-compose.txt` | Coolify stack: coturn relay + `ice` service (TURN credentials, quick-match queues) |
| `qa/` | QA screenshots, two-browser runs (`qa/e2e.mjs`, `qa/quick.mjs`) |

Ideas backlog (in French): [`ideas.md`](ideas.md).
