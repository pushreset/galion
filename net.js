// P2P transport over PeerJS (global `Peer`, loaded from the CDN in index.html).
// The host's peer id is the room: guests connect with the 4-letter code. Messages are JSON
// strings with numbers rounded to 0.01 (snapshots stay small).
// Signalling: PeerJS's public server. NAT traversal: our own coturn relay (Coolify, coturn-compose.txt). Its
// service hands out 1-hour credentials to the game's origin only; PeerJS's own TURN relays are gone (no DNS).
const PREFIX = 'broadside-';
// ?ice=http://127.0.0.1:3000/ points at a local copy of the service (its origin check only lets the game's own origin in); node (check.mjs) has no location
// loopback only: a link must not pick a player's TURN and matchmaking server
const ice = new URLSearchParams(globalThis.location?.search).get('ice');
const ICE_URL = /^http:\/\/(127\.0\.0\.1|localhost):\d+\/$/.test(ice) ? ice : 'https://ice-cedthaqnw77lgzrdexjkvcwt.46.62.255.60.sslip.io/';
// unreachable → PeerJS's defaults (Google STUN): direct links still work, strict NATs don't
const peerOpts = () => fetch(ICE_URL, { signal: AbortSignal.timeout(4000) }).then((r) => r.json())
  .then(({ iceServers }) => ({ config: { iceServers } })).catch(() => ({}));
const enc = (m) => JSON.stringify(m, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v));
const dec = (d) => { try { return JSON.parse(d); } catch { return null; } };
export const MAX_PLAYERS = 4;
// WebRTC can take ages to notice a closed tab: guests ping every second, and either side
// drops the link after TIMEOUT ms of silence. The host pings too: its snapshots stop when its tab is
// hidden (no frames), and a stalled game beats kicking everyone.
const TIMEOUT = 8000;
const PING = '{"t":"ping"}';
const BACKLOG = 65536; // bytes queued on a guest's channel (a dozen snapshots or more) before the host skips some
const newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');

// Quick match (same service, /match): q = 'pvp' | 'coop-waves' | 'coop-convoy'. Resolves { host: code } | { join: code } |
// { retry } for a lookup, null for a host heartbeat (extra = '&code=ABCD&free=2'); a guest that could not get in passes '&skip=ABCD'.
export const match = (q, extra = '') => fetch(`${ICE_URL}match?q=${q}${extra}`, { signal: AbortSignal.timeout(4000) })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.status === 204 ? null : r.json(); });

// World leaderboard (same service, /scores): b = 'waves' | 'convoy'. No run → the board, a run { ini, wave, gold, combo, ship } → signs it.
// Resolves { top, rank } (rank: the run's row, -1 off the board). A string body is a simple CORS request: no preflight.
export const worldScores = (b, run) => fetch(`${ICE_URL}scores?b=${b}`, { method: run ? 'POST' : 'GET', body: run ? JSON.stringify(run) : undefined, signal: AbortSignal.timeout(4000) })
  .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });

// h: { open(code), join(id), msg(id, m), leave(id), error(e) }
// code: a quick-match room's code, handed out by the server
export function hostRoom(h, code = newCode()) {
  const conns = new Map(), seen = new Map();
  const drop = (id) => { const c = conns.get(id); if (conns.delete(id)) { c.close(); h.leave(id); } };
  let dead = false, peer = null;
  const beat = setInterval(() => {
    for (const [id, c] of conns) {
      if (performance.now() - seen.get(id) > TIMEOUT) drop(id);
      else if (c.open) c.send(PING);
    }
  }, 1000);
  peerOpts().then((opts) => {
    if (dead) return;
    peer = new Peer(PREFIX + code, opts);
    peer.on('open', () => h.open(code));
    peer.on('error', (e) => { if (!dead) h.error(e); });
    // signalling socket lost (Wi-Fi blip, sleep): the game goes on over the data channels, but the code
    // would stop working for late joiners. reconnect() re-registers the same id; retried every 3 s.
    peer.on('disconnected', () => setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 3000));
    peer.on('connection', (c) => {
      if (conns.size >= MAX_PLAYERS - 1) { c.on('open', () => setTimeout(() => c.close(), 500)); return; }
      let id = 1; while (conns.has(id)) id++; // lowest free seat: a rejoin in a 4-player room is not P5
      conns.set(id, c); seen.set(id, performance.now()); // seat taken now, not at open: overlapping joins can't pass the cap (never opens: TIMEOUT frees it)
      c.on('open', () => { if (conns.get(id) !== c) return; seen.set(id, performance.now()); h.join(id); });
      c.on('data', (d) => { if (conns.get(id) !== c) return; seen.set(id, performance.now()); const m = dec(d); if (m && m.t !== 'ping') h.msg(id, m); });
      c.on('close', () => { if (conns.get(id) === c) drop(id); }); // a late close from the seat's previous holder must not kick the new one
    });
  });
  return {
    code: () => code,
    guests: () => conns.size,
    close() { dead = true; clearInterval(beat); peer?.destroy(); },
    send(id, m) { const c = conns.get(id); if (c?.open) c.send(enc(m)); },
    // snapshots only: a guest whose link can't keep up skips frames instead of queueing them and drifting
    // into the past (the channel is reliable + ordered; state is absolute, so the next one corrects it)
    broadcast(m) { const s = enc(m); for (const c of conns.values()) if (c.open && !(c.dataChannel?.bufferedAmount > BACKLOG)) c.send(s); },
  };
}

// h: { open(), msg(m), close(), error(e) }
export function joinRoom(code, h) {
  let peer = null, conn = null, seen = 0, closed = false, beat;
  const stop = () => { closed = true; clearInterval(beat); peer?.destroy(); };
  const close = () => { if (!closed) { stop(); h.close(); } };
  peerOpts().then((opts) => {
    if (closed) return;
    peer = new Peer(opts);
    peer.on('open', () => {
      conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
      // the watchdog runs from the attempt, not from 'open': a channel that never opens (strict NAT, relay
      // down) fires neither 'open' nor 'close', and the lobby would sit on CONNECTING… forever
      seen = performance.now();
      beat = setInterval(() => {
        if (conn.open) conn.send(PING);
        if (performance.now() - seen > TIMEOUT) close();
      }, 1000);
      conn.on('open', () => { seen = performance.now(); h.open(); });
      conn.on('data', (d) => { if (closed) return; seen = performance.now(); const m = dec(d); if (m && m.t !== 'ping') h.msg(m); });
      conn.on('close', close);
      conn.on('error', close);
    });
    peer.on('error', (e) => { if (!closed) h.error(e); });
  });
  // close(): abandon the attempt silently (no h.close), so a stale Peer can't talk to a later one's lobby
  return { send(m) { if (conn?.open) conn.send(enc(m)); }, close: stop };
}
