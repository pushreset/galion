// P2P transport over PeerJS (global `Peer`, loaded from the CDN in index.html).
// The host's peer id is the room: guests connect with the 4-letter code. Messages are JSON
// strings with numbers rounded to 0.01 (snapshots stay small).
// ponytail: PeerJS defaults: public signalling server, Google STUN and free community TURN relays (no SLA);
// pass our own iceServers to new Peer() if the relays ever get unreliable.
const PREFIX = 'broadside-';
const enc = (m) => JSON.stringify(m, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v));
const dec = (d) => { try { return JSON.parse(d); } catch { return null; } };
export const MAX_PLAYERS = 4;
// WebRTC can take ages to notice a closed tab: guests ping every second, and either side
// drops the link after TIMEOUT ms of silence (the host's snapshots are its heartbeat).
const TIMEOUT = 8000;
const BACKLOG = 65536; // bytes queued on a guest's channel (a dozen snapshots or more) before the host skips some

// h: { open(code), join(id), msg(id, m), leave(id), error(e) }
export function hostRoom(h) {
  const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]).join('');
  const peer = new Peer(PREFIX + code);
  const conns = new Map(), seen = new Map();
  let next = 1;
  const drop = (id) => { const c = conns.get(id); if (conns.delete(id)) { c.close(); h.leave(id); } };
  setInterval(() => { for (const id of conns.keys()) if (performance.now() - seen.get(id) > TIMEOUT) drop(id); }, 1000);
  peer.on('open', () => h.open(code));
  peer.on('error', (e) => h.error(e));
  // signalling socket lost (Wi-Fi blip, sleep): the game goes on over the data channels, but the code
  // would stop working for late joiners. reconnect() re-registers the same id; retried every 3 s.
  peer.on('disconnected', () => setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 3000));
  peer.on('connection', (c) => {
    if (conns.size >= MAX_PLAYERS - 1) { c.on('open', () => setTimeout(() => c.close(), 500)); return; }
    const id = next++;
    conns.set(id, c); seen.set(id, performance.now()); // seat taken now, not at open: overlapping joins can't pass the cap (never opens: TIMEOUT frees it)
    c.on('open', () => { if (conns.get(id) !== c) return; seen.set(id, performance.now()); h.join(id); });
    c.on('data', (d) => { seen.set(id, performance.now()); const m = dec(d); if (m && m.t !== 'ping') h.msg(id, m); });
    c.on('close', () => drop(id));
  });
  return {
    code: () => code,
    send(id, m) { const c = conns.get(id); if (c?.open) c.send(enc(m)); },
    // snapshots only: a guest whose link can't keep up skips frames instead of queueing them and drifting
    // into the past (the channel is reliable + ordered; state is absolute, so the next one corrects it)
    broadcast(m) { const s = enc(m); for (const c of conns.values()) if (c.open && !(c.dataChannel?.bufferedAmount > BACKLOG)) c.send(s); },
  };
}

// h: { open(), msg(m), close(), error(e) }
export function joinRoom(code, h) {
  const peer = new Peer();
  let conn = null, seen = 0, closed = false;
  const close = () => { if (!closed) { closed = true; conn?.close(); h.close(); } };
  peer.on('open', () => {
    conn = peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
    conn.on('open', () => {
      seen = performance.now();
      h.open();
      setInterval(() => {
        if (conn.open) conn.send(enc({ t: 'ping' }));
        if (performance.now() - seen > TIMEOUT) close();
      }, 1000);
    });
    conn.on('data', (d) => { seen = performance.now(); const m = dec(d); if (m) h.msg(m); });
    conn.on('close', close);
  });
  peer.on('error', (e) => h.error(e));
  return { send(m) { if (conn?.open) conn.send(enc(m)); } };
}
