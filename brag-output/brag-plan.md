# Broadside — launch video plan

**What it is:** Broadside is a pixel-art pirate naval combat game that runs in the browser, solo or online with up to 4 friends.
**For:** anyone with a browser and 5 minutes, and anyone with a crew of friends. No install: open the link and press 1, 2 or 3.
**Sets it apart:** a crisp pixel-art 3D sea built with Three.js, real broadsides (A / E fire port / starboard), boarding, convoy raids, and peer-to-peer co-op from a 4-letter room code.
**Most impressive claim:** an entire pirate game in a browser tab, multiplayer included, with no server to run.
**Visual hook:** a galleon unloading its whole broadside into a navy brig at point-blank range.
**Share caption:** see share-copy.txt.

## Angle
"Show, don't pitch": every shot is the real game, driven through its own `window.__game` API, captured frame by frame. The soundtrack is the game's own procedural D-minor loop and its synth SFX (sfx.js), rendered offline, with every boom placed on the frame where it happens.

## Tone and identity
`default`: punchy, playful, clean. Captions use the game's UI language: Silkscreen font, a dark-wood panel (#3f2616, inset #8d5c35, border #1b110b), cream text (#f5ecd2) and gold highlights (#ffd24a). Scenes cut on the music's bar lines (96 bpm, one bar = 2.5 s) with a quick dip through the panel brown.

## Storyboard (landscape 1920×1080, 30 fps, 20 s = 8 bars)
| # | Time | Scene | On screen | Caption |
|---|---|---|---|---|
| 1 | 0.0–2.5 | Hook | Leviathan, HUD off. A navy brig abeam; at 0.3 s the full starboard broadside goes off: muzzle flashes, hits, splinters | "PIRATE BATTLES." / "IN YOUR BROWSER." |
| 2 | 2.5–5.0 | Reveal | The real ship select: three pirate ships float above their cards. Card 3 lights up, then "3" is pressed and the game cuts in: "LEVIATHAN SETS SAIL" | Title: "BROADSIDE" |
| 3 | 5.0–10.0 | Combat | Full HUD. Three crippled navy sloops around; volleys alternate port/starboard, they sink one after another: ×2, ×3 combo popups, gold barrels spill and get pulled in | "SINK THE NAVY." / "GRAB THE GOLD." |
| 4 | 10.0–12.5 | Convoy | Convoy mode off Tortuga: the port town and jetty, merchants and navy escorts sailing out. Real banner "CONVOY 2 · TORTUGA → PORT ROYAL" | "HUNT CONVOYS, PORT TO PORT." |
| 5 | 12.5–15.0 | Boarding | Real boarding QTE panel over a frozen merchant: the cursor sweeps, it's pressed on the gold mark, "PERFECT!", "THEY SURRENDER!" | "BOARD WHAT YOU DON'T SINK." |
| 6 | 15.0–17.5 | Co-op | Four pirate ships sailing in formation, names over three of them (fictional names: ANNE, CALICO, BONNY) | "UP TO 4 PIRATES." / "ONE ROOM CODE." |
| 7 | 17.5–20.0 | Outro | Overview of the map, dimmed; centred title card | "BROADSIDE" · "FREE · IN YOUR BROWSER" · pushreset.github.io/galion |

The melody resolves on D at 18.75 s, under the URL.

## Sound
- Music: sfx.js's own 4-bar D-minor loop (Dm C Bb A, square lead + triangle bass), two full passes. The war drum (`setCombat`) runs from 5 s to 18.75 s.
- SFX: the exact `sfx.*` calls the game makes during capture (boom, hit, splash, sink, fanfare, bell), logged with their frame time and replayed into the same offline WebAudio graph and compressor, scaled to sit under the music. Splashes are ducked further.
- The fanfare (C–E–G–C) lands on the loop's C bar (12.5–15 s), so it stays in key.

## Personal data
None. The pirate names are fictional, and no room code, IP address or account appears.
