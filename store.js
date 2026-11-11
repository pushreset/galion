// What the browser remembers, under `broadside.`: name, last mode and ship, audio, keys, display, local boards.
// Every read falls back to its default: storage can be missing (private window, node in check.mjs).
const P = 'broadside.';
const raw = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const get = (k) => { try { return JSON.parse(raw(P + k)); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch {} };
const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);

// player name: 1 to 12 letters; also cleans what a guest or host sends
export const cleanName = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 12);
const PRE = ['SALTY', 'BLACK', 'RED', 'MAD', 'IRON', 'GRIM', 'OLD', 'SEA', 'RUM', 'GOLD', 'STORM', 'DREAD', 'SLY', 'WILD', 'ONEEYE', 'PEG'];
const SUF = ['BEARD', 'JACK', 'MORGAN', 'HOOK', 'FLINT', 'BONES', 'KIDD', 'ANNE', 'ROGER', 'FANG', 'KEEL', 'WOLF', 'SHARK', 'BONNY', 'SILVER', 'LEG'];
const pick = (a, rand) => a[Math.floor(rand() * a.length)];
export function rollName(rand = Math.random) {
  for (;;) { const n = pick(PRE, rand) + pick(SUF, rand); if (n.length <= 12) return n; }
}

export const MODES = ['waves', 'convoy'], SHIPS = ['wasp', 'corsair', 'leviathan'];

// keys: KeyboardEvent.code, a physical position (KeyQ is A on AZERTY, Q on QWERTY)
export const DEFAULT_KEYS = {
  sailUp: 'ArrowUp', sailDown: 'ArrowDown', turnLeft: 'ArrowLeft', turnRight: 'ArrowRight', firePort: 'KeyQ', fireStarboard: 'KeyE',
  skill1: 'Digit1', skill2: 'Digit2', skill3: 'Digit3', skill4: 'Digit4', board: 'Space', overview: 'KeyC', mute: 'KeyM', pause: 'KeyP',
};
export const RESERVED = /^(Escape|Backspace|Enter|NumpadEnter|Tab|F\d\d?)$/; // menus and the browser keep these
// → { keys } | { reserved } | { conflict: the action that already has this key }
export function rebind(keys, action, code) {
  if (RESERVED.test(code)) return { reserved: true };
  const other = Object.keys(keys).find((a) => a !== action && keys[a] === code);
  return other ? { conflict: other } : { keys: { ...keys, [action]: code } };
}
// `action` takes `code` from `other`, which gets the key `action` had
export const swapKeys = (keys, action, other) => ({ ...keys, [action]: keys[other], [other]: keys[action] });

// leaderboard: { crew: [{ name, ship }], wave, gold, combo, at }, ranked by wave then gold; solo and crews apart
export const BOARDS = ['waves', 'convoy', 'waves-crew', 'convoy-crew'];
export const boardOf = (mode, crew) => mode + (crew > 1 ? '-crew' : '');
export const better = (a, b) => b.wave - a.wave || b.gold - a.gold;
// A row from before names: { ini: 'AAA' | 'AAA+BBB', ship: 'Wasp' | 'Wasp+Corsair', wave, gold, combo, date }.
// One pirate per ship; initials pair with ships by position, a pirate who never signed is PIRATE.
export function normRow(r) {
  if (Array.isArray(r?.crew)) return r;
  if (typeof r?.ini !== 'string' || typeof r.ship !== 'string') return null;
  const names = r.ini.split('+');
  const crew = r.ship.split('+').slice(0, 4).map((s, i) => ({ name: cleanName(names[i]) || 'PIRATE', ship: s.toLowerCase() }));
  return { crew, wave: +r.wave || 0, gold: +r.gold || 0, combo: +r.combo || 0, at: +r.date || 0 };
}
function loadBest() {
  let b = get('best');
  if (!b) { // first launch of the menus: this browser's old top 10s
    b = {};
    for (const [mode, key] of [['waves', P + 'scores'], ['convoy', P + 'convoy']]) {
      let old = [];
      try { old = JSON.parse(raw(key)) || []; } catch {}
      for (const r of old.map(normRow).filter(Boolean)) (b[boardOf(mode, r.crew.length)] ??= []).push(r);
    }
  }
  return Object.fromEntries(BOARDS.map((k) => [k, Array.isArray(b[k]) ? b[k].map(normRow).filter(Boolean) : []]));
}
// this browser's top 10 of a board, with the run in it → { top, rank } (rank -1: off the board)
export function signLocal(board, entry) {
  const best = loadBest(), top = [...best[board], entry].sort(better).slice(0, 10);
  set('best', { ...best, [board]: top });
  return { top, rank: top.indexOf(entry) };
}

export const store = {
  get name() { return cleanName(get('name') ?? raw('gallion-nick')); }, // '': the name screen. gallion-nick: the old lobby field
  set name(v) { set('name', cleanName(v)); },
  get played() { return MODES.includes(get('lastMode')); },
  get lastMode() { const m = get('lastMode'); return MODES.includes(m) ? m : 'waves'; },
  set lastMode(v) { set('lastMode', v); },
  get lastShip() { const s = get('lastShip'); return SHIPS.includes(s) ? s : 'corsair'; },
  set lastShip(v) { set('lastShip', v); },
  get audio() { const a = get('audio') || {}; return { master: int(a.master, 0, 10, 8), music: int(a.music, 0, 10, 6), fx: int(a.fx, 0, 10, 9), muted: a.muted === true }; },
  set audio(a) { set('audio', a); },
  get keys() { const k = get('keys') || {}; return Object.fromEntries(Object.entries(DEFAULT_KEYS).map(([a, d]) => [a, typeof k[a]?.[0] === 'string' ? k[a][0] : d])); },
  set keys(k) { set('keys', Object.fromEntries(Object.entries(k).map(([a, c]) => [a, [c]]))); },
  // event.key seen when a key was bound: its label where the browser has no layout map (Firefox, Safari)
  get keyNames() { return get('keyNames') || {}; },
  set keyNames(n) { set('keyNames', n); },
  get display() { return { hints: get('display')?.hints !== false }; },
  set display(d) { set('display', d); },
  get best() { return loadBest(); },
};
