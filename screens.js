// The menu screens (design/start-screen/broadside-handoff). Positions are in the 960×540 logical stage.
// g: what game.js lends the menus (ships, start a run, sound…); the menus never import the game.
import * as ui from './ui.js';
import { screens, esc, keyLabel } from './ui.js';
import { store, cleanName, rollName, rebind, swapKeys, DEFAULT_KEYS, SHIPS, boardOf } from './store.js';

const mine = (row, name) => row.crew.some((c) => c.name === name);

const SKULL = 'M3 0h6v1h-6z M2 1h8v1h-8z M1 2h10v1h-10z M1 3h1v2h-1z M4 3h4v2h-4z M10 3h1v2h-1z M1 5h10v1h-10z M2 6h3v1h-3z M7 6h3v1h-3z M3 7h6v1h-6z';
const skull = (w, shadow) => `<svg width="${w}" height="${w * 0.75}" viewBox="0 0 12 9" shape-rendering="crispEdges" aria-hidden="true">` +
  `${shadow ? `<path fill="#1b110b" transform="translate(0.5 0.5)" d="${SKULL}"/>` : ''}<path fill="#f5ecd2" d="${SKULL} M3 8h1v1h-1z M5 8h2v1h-2z M8 8h1v1h-1z"/></svg>`;
const logo = (top) => `<div class="bs-abs bs-logo" style="left:0;right:0;top:${top}px;text-align:center;font-size:32px;line-height:32px;letter-spacing:3px;text-shadow:2px 2px 0 var(--bs-trim-hi),4px 4px 0 var(--bs-wood-edge)">BROADSIDE</div>`;
const num = (n) => (+n).toLocaleString('en-US');

// A name field (name screen, settings): A to Z, 12 at most. A refused key flashes it red.
function nameKey(e, input) {
  if (e.target !== input || e.key.length !== 1 || e.ctrlKey || e.metaKey) return false;
  if (/^[a-z]$/i.test(e.key) && (input.value.length < 12 || input.selectionStart !== input.selectionEnd)) return false; // the field types it
  input.classList.remove('is-flash');
  void input.offsetWidth; // restart the animation
  input.classList.add('is-flash');
  return true;
}

const crumb = (parts, on) => `<div class="bs-crumb">${parts.map((t, i) => (i === on ? `<span class="bs-gold">${t}</span>` : t)).join(' ▸ ')}</div>`;
const head = (x, y, parts, on, title) => `<div class="bs-abs bs-col" style="left:${x}px;top:${y}px;gap:4px">${crumb(parts, on)}<h1 class="bs-h1">${title}</h1></div>`;
const key = (k) => `<span class="bs-key">${esc(k)}</span>`;
const rect = (list, fill) => list.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`).join('');
// mode pictures: 62×25 cells, 5 px each
const art = (label, body) => `<svg width="310" height="125" viewBox="0 0 62 25" shape-rendering="crispEdges" role="img" aria-label="${label}" style="display:block;background:#174478;box-shadow:0 0 0 2px #1b110b">${body}</svg>`;
const MODE = {
  waves: { name: 'WAVES', unit: 'WAVE', text: 'SURVIVE WAVE AFTER WAVE OF THE NAVY. EACH ONE HITS HARDER.', meta: 'ENDS WHEN YOU SINK',
    art: art('Your ship surrounded by rings of enemy ships', rect([[3, 3, 4, 1], [48, 21, 5, 1]], '#2f87bb') + rect([[52, 6, 3, 1], [8, 20, 4, 1]], '#f4fffb') +
      rect([[16, 12, 2, 2], [44, 11, 2, 2], [18, 4, 2, 2], [42, 4, 2, 2], [18, 19, 2, 2], [42, 19, 2, 2]], '#6b2a24') +
      rect([[20, 10, 2, 2], [40, 12, 2, 2], [29, 1, 2, 2], [29, 21, 2, 2], [37, 4, 2, 2], [23, 18, 2, 2], [37, 18, 2, 2], [23, 4, 2, 2]], '#a83a2c') +
      rect([[36, 11, 2, 2], [24, 11, 2, 2], [30, 5, 2, 2], [30, 17, 2, 2], [34, 7, 2, 2], [26, 15, 2, 2]], '#d84a38') + rect([[29, 10, 4, 4]], '#1b110b') + rect([[30, 11, 2, 2]], '#ffd24a')) },
  convoy: { name: 'CONVOY', unit: 'CONVOY', text: 'A LONG CROSSING BETWEEN TWO PORTS. HUNT DOWN ESCORTED MERCHANT CONVOYS.', meta: 'GOLD OVER SURVIVAL',
    art: art('A merchant convoy sailing between two ports', rect([[0, 0, 6, 25], [56, 0, 6, 25]], '#c9a66b') + rect([[0, 0, 3, 25], [59, 0, 3, 25]], '#5f8f3a') + rect([[6, 11, 3, 2], [53, 11, 3, 2]], '#8d5c35') +
      rect([[10, 12, 2, 1], [14, 12, 2, 1], [31, 12, 2, 1], [35, 12, 2, 1], [39, 12, 2, 1], [43, 12, 2, 1], [47, 12, 2, 1]], '#ddcda6') + rect([[19, 11, 2, 2], [23, 11, 2, 2], [27, 11, 2, 2]], '#f5ecd2') +
      rect([[17, 8, 2, 2], [25, 8, 2, 2], [21, 15, 2, 2], [29, 15, 2, 2]], '#d84a38') + rect([[40, 18, 4, 4]], '#1b110b') + rect([[41, 19, 2, 2]], '#ffd24a') +
      rect([[36, 20, 3, 1], [44, 5, 4, 1]], '#f4fffb') + rect([[13, 4, 4, 1]], '#2f87bb')) },
};
const STATS = ['SPEED', 'HANDLING', 'HULL', 'GUNS', 'RELOAD', 'CREW'];
const KEY_ROWS = [[['sailUp'], 'SAIL UP'], [['sailDown'], 'SAIL DOWN'], [['turnLeft'], 'TURN LEFT'], [['turnRight'], 'TURN RIGHT'], [['firePort'], 'FIRE PORT (LEFT)'], [['fireStarboard'], 'FIRE STARBOARD (RIGHT)'],
  [['skill1', 'skill2', 'skill3', 'skill4'], 'SKILLS 1 TO 4'], [['board'], 'BOARD'], [['overview'], 'OVERVIEW (ZOOM)'], [['mute'], 'MUTE'], [['pause'], 'PAUSE']];
const actionLabel = (a) => (a.startsWith('skill') ? 'SKILL ' + a.slice(5) : KEY_ROWS.find(([ids]) => ids[0] === a)[1]);

export function initScreens(g) {
  // 01 · the first key or click unlocks the browser's audio; it must not act on the screen that follows
  screens.title = {
    veil: 0.35, back: false, shot: () => ({ orbit: true }),
    render(el) {
      el.innerHTML = `<div class="bs-title-bar" style="bottom:100%;margin-bottom:-48px"></div><div class="bs-title-bar" style="top:100%;margin-top:-48px"></div>
        <div class="bs-abs bs-col" style="left:0;right:0;top:116px;align-items:center;gap:12px">${skull(80, true)}<h1 class="bs-logo">BROADSIDE</h1>
          <div class="bs-row" style="gap:12px;font-size:16px;line-height:16px;letter-spacing:3px;text-shadow:2px 2px 0 var(--bs-wood-edge)"><i style="width:44px;height:3px;background:var(--bs-trim-hi)"></i>PIRATE BATTLES ON THE HIGH SEAS<i style="width:44px;height:3px;background:var(--bs-trim-hi)"></i></div></div>
        <div class="bs-abs bs-title-blink" style="left:0;right:0;top:424px;text-align:center;font-size:24px;line-height:24px;letter-spacing:3px;text-shadow:3px 3px 0 var(--bs-wood-edge)">PRESS ANY KEY</div>
        <div class="bs-abs bs-dim" style="left:0;right:0;top:464px;text-align:center;letter-spacing:1px;text-shadow:1px 1px 0 var(--bs-wood-edge)">OR CLICK ANYWHERE</div>`;
      const go = () => { g.unlock(); ui.reset(store.name ? 'menu' : 'name'); };
      addEventListener('click', go); // anywhere: the stage does not cover a wide window
      return { close: () => removeEventListener('click', go), keys(e) { if (!e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(Shift|Control|Alt|Meta|CapsLock|F\d+)/.test(e.key)) go(); return true; } };
    },
  };

  // 02 · first launch only: no way past it without a name
  screens.name = {
    veil: 0.55, back: false, shot: () => ({ wide: true }),
    hints: [[['A-Z'], 'TYPE'], [['ENTER'], 'CONFIRM'], [['TAB'], 'ROLL A NAME']],
    render(el) {
      el.innerHTML = `${logo(48)}<div class="bs-abs bs-panel bs-col" style="left:240px;top:132px;width:480px;padding:24px 32px;gap:16px">
        <div class="bs-col" style="gap:4px"><div class="bs-gold" style="letter-spacing:1px">WELCOME ABOARD</div><h1 style="font-size:24px;line-height:28px;font-weight:700">WHAT DO THEY CALL YOU, CAPTAIN?</h1></div>
        <div class="bs-col" style="gap:4px"><label class="bs-dim" for="name-in">CAPTAIN NAME</label>
          <div class="bs-row" style="gap:12px"><input id="name-in" class="bs-field" data-f="name" data-first maxlength="12" autocomplete="off" spellcheck="false" style="height:48px;font-size:24px;letter-spacing:3px;padding:0 12px"><span class="bs-dim" id="name-n" style="width:40px;text-align:right"></span></div>
          <p class="bs-dim">A TO Z ONLY. SHOWN ABOVE YOUR SHIP ONLINE AND ON THE LEADERBOARD. CHANGE IT LATER IN SETTINGS.</p></div>
        <div class="bs-row" style="justify-content:space-between"><button class="bs-btn" data-f="roll">⟳ ROLL A NAME</button><button class="bs-btn bs-btn--primary" data-f="ahoy">▶ AHOY</button></div></div>`;
      const input = el.querySelector('input'), ahoy = el.querySelector('[data-f=ahoy]');
      const show = () => { el.querySelector('#name-n').textContent = `${input.value.length}/12`; ahoy.disabled = !input.value; };
      const roll = () => { input.value = rollName(); show(); input.focus(); input.select(); }; // selected: typing replaces it, Enter keeps it
      const done = () => { if (!input.value) return; store.name = input.value; ui.reset('menu'); };
      input.oninput = () => { const v = cleanName(input.value); if (v !== input.value) input.value = v; show(); };
      input.value = rollName();
      show();
      setTimeout(() => input.select());
      return { acts: { roll, ahoy: done }, keys(e) {
        if (e.code === 'Tab') { roll(); return true; }
        if (e.code === 'Enter' && e.target === input) { if (!e.repeat) done(); return true; }
        return nameKey(e, input);
      } };
    },
  };

  // 03 · the hub
  screens.menu = {
    back: false, shot: (p) => ({ ship: p.ship, side: 1 }), // p.ship: read once in render, the camera asks every frame
    hints: () => [[['↑', '↓'], 'CHOOSE'], [['ENTER'], 'CONFIRM'], [[g.muteLabel()], 'SOUND']],
    render(el, props) {
      props.ship = SHIPS.indexOf(store.lastShip);
      const mode = store.lastMode, ship = g.ships[props.ship], best = store.best[mode][0];
      const item = (f, title, sub, extra = '') => `<button class="bs-btn" data-f="${f}"${extra}><span>${title}</span><span>${sub}</span></button>`;
      el.innerHTML = `<div class="bs-abs bs-logo bs-logo--s" style="left:64px;top:52px">BROADSIDE</div>
        <div class="bs-abs bs-chip" style="right:32px;top:28px">${skull(16)}<span class="bs-dim">CAPTAIN</span><span class="bs-gold" style="font-size:16px;line-height:16px;letter-spacing:1px">${esc(store.name)}</span><button class="bs-btn bs-btn--s" data-f="edit" aria-label="Change name">EDIT</button></div>
        <nav class="bs-abs bs-menu" style="left:64px;top:152px;width:320px">
          ${store.played ? `<button class="bs-btn bs-btn--primary" data-f="sail" data-first style="padding:12px 16px"><span style="font-size:24px;line-height:24px">▶ SET SAIL</span><span>${mode.toUpperCase()} · SOLO · ${ship.name} (YOUR LAST VOYAGE)</span></button>` : ''}
          ${item('solo', 'SOLO', 'PICK A MODE AND A SHIP', store.played ? '' : ' data-first')}
          ${item('online', 'ONLINE', 'CO-OP OR PVP · 2 TO 4 PIRATES')}
          ${item('board', 'LEADERBOARD', 'WAVES · CONVOY · WORLD', screens.leaderboard ? '' : ' disabled')}
          ${item('settings', 'SETTINGS', 'SOUND · CONTROLS · NAME', screens.settings ? '' : ' disabled')}
        </nav>
        ${best ? `<div class="bs-abs bs-chip bs-col" style="right:32px;bottom:44px;align-items:flex-end;gap:4px;padding:8px 12px"><span class="bs-dim" style="letter-spacing:1px">YOUR BEST · ${mode.toUpperCase()}</span>
          <span style="font-size:16px;line-height:16px">${mode === 'convoy' ? 'CONVOY' : 'WAVE'} ${best.wave} · <span class="bs-gold">${num(best.gold)} GOLD</span>${best.world ? ` · #${best.world} WORLD` : ''}</span></div>` : ''}`;
      return { acts: {
        sail: () => g.startSolo(mode, props.ship),
        solo: () => ui.open('solo-mode'),
        online: () => ui.open('online'),
        board: () => ui.open('leaderboard'),
        settings: () => ui.open('settings'),
        edit: () => screens.settings && ui.open('settings', { tab: 'profile' }),
      } };
    },
  };

  // 04 · solo, step 1: a card is chosen by focusing it (arrows, 1 / 2, or the mouse over it)
  screens['solo-mode'] = {
    veil: 0.45, shot: () => ({ wide: true }),
    hints: [[['←', '→', '1', '2'], 'CHOOSE'], [['ENTER'], 'NEXT'], [['ESC'], 'BACK']],
    render(el, props) {
      props.sel ??= store.lastMode;
      const best = store.best;
      const card = (id, i) => {
        const m = MODE[id], top = [...best[id], ...best[id + '-crew']].sort((a, b) => b.wave - a.wave)[0];
        const badge = store.played && store.lastMode === id ? '<span class="bs-badge">LAST PLAYED</span>' : top ? '' : '<span class="bs-badge bs-badge--off">NEW</span>';
        return `<button class="bs-card" data-f="${id}" aria-pressed="${props.sel === id}"${props.sel === id ? ' data-first' : ''}><span class="bs-row" style="justify-content:space-between">${key(i + 1)}${badge}</span>${m.art}
          <span class="bs-card-name">${m.name}</span><span>${m.text}</span>
          <span class="bs-row bs-dim" style="gap:16px"><span>SOLO OR CO-OP</span><span>${m.meta}</span><span>BEST : ${top ? `<span class="bs-gold">${m.unit} ${top.wave}</span>` : 'NOT PLAYED'}</span></span></button>`;
      };
      el.innerHTML = `${head(90, 28, ['SOLO', 'MODE', 'SHIP'], 1, 'CHOOSE YOUR WAR')}
        <div class="bs-abs bs-row bs-dim" style="right:90px;top:60px;gap:6px"><i style="width:28px;height:6px;background:var(--bs-gold)"></i><i style="width:28px;height:6px;background:var(--bs-wood-hi);box-shadow:inset 0 0 0 1px var(--bs-trim)"></i><span style="margin-left:6px">STEP 1 OF 2</span></div>
        <div class="bs-abs" style="left:90px;top:104px;width:780px;display:grid;grid-template-columns:1fr 1fr;gap:32px">${card('waves', 0)}${card('convoy', 1)}</div>
        <div class="bs-abs bs-row" style="left:90px;top:432px;width:780px;justify-content:space-between"><button class="bs-btn" data-f="back">◀ BACK</button><button class="bs-btn bs-btn--primary" data-f="next">NEXT : SHIP ▶</button></div>`;
      const pick = (id) => { props.sel = id; for (const c of el.querySelectorAll('.bs-card')) c.setAttribute('aria-pressed', c.dataset.f === id); };
      for (const c of el.querySelectorAll('.bs-card')) c.onfocus = () => pick(c.dataset.f);
      const next = () => { g.setMode(props.sel); ui.open('ship', { mode: props.sel }); };
      return { acts: { waves: next, convoy: next, next, back: ui.pop }, keys(e) {
        const id = { Digit1: 'waves', Digit2: 'convoy', Numpad1: 'waves', Numpad2: 'convoy' }[e.code];
        if (id) ui.focus(id);
        return !!id;
      } };
    },
  };

  // 05 · solo, step 2: browsing moves the camera; only SET SAIL (or Enter) starts the run
  screens.ship = {
    shot: (props) => ({ ship: props.sel, side: -1 }),
    hints: [[['←', '→', '1', '2', '3'], 'BROWSE'], [['ENTER'], 'SET SAIL'], [['ESC'], 'BACK']],
    render(el, props) {
      props.mode ??= store.lastMode;
      props.sel ??= SHIPS.indexOf(store.lastShip);
      el.innerHTML = `${head(44, 28, ['SOLO', 'MODE', 'SHIP'], 2, 'CHOOSE YOUR SHIP')}
        <div class="bs-abs bs-chip" style="right:44px;top:36px"><span class="bs-dim">MODE</span><span>${MODE[props.mode].name} · SOLO</span><button class="bs-btn bs-btn--s" data-f="change">CHANGE</button></div>
        <div class="bs-abs bs-panel bs-col" style="left:576px;top:92px;width:340px;padding:16px 20px;gap:12px">
          <div class="bs-row" style="gap:12px"><span id="ship-name" class="bs-gold" style="font-size:32px;line-height:32px;font-weight:700"></span><span id="ship-last" class="bs-badge">LAST SAILED</span></div>
          <p id="ship-tag" class="bs-dim"></p>
          <div class="bs-col" style="gap:6px">${STATS.map((l) => `<div class="bs-row"><span style="width:80px">${l}</span><span class="bs-gauge">${'<span></span>'.repeat(10)}</span></div>`).join('')}</div>
          <div class="bs-col" style="gap:8px;border-top:2px solid var(--bs-wood-edge);padding-top:12px"><span class="bs-dim" style="letter-spacing:1px">STARTING SKILLS</span><div id="ship-kit" class="bs-col" style="gap:6px"></div><span class="bs-dim">SLOTS 3 AND 4 UNLOCK AT SEA</span></div></div>
        <div class="bs-abs bs-row" style="left:44px;top:432px;gap:8px"><button class="bs-btn" data-f="prev" aria-label="Previous ship">◀</button>
          ${g.ships.map((s, i) => `<button class="bs-btn bs-row" data-f="s${i}" style="gap:8px">${key(i + 1)}${s.name}</button>`).join('')}<button class="bs-btn" data-f="nxt" aria-label="Next ship">▶</button></div>
        <div class="bs-abs bs-row" style="left:576px;top:432px;width:340px;justify-content:space-between"><button class="bs-btn" data-f="back">◀ BACK</button><button class="bs-btn bs-btn--primary" data-f="sail" data-first>SET SAIL ▶</button></div>`;
      const gauges = [...el.querySelectorAll('.bs-gauge')], shown = STATS.map(() => 0);
      // gauges step to their new value one segment at a time
      const timer = setInterval(() => gauges.forEach((gEl, k) => {
        const want = g.ships[props.sel].gauges[k];
        if (shown[k] === want) return;
        shown[k] += Math.sign(want - shown[k]);
        [...gEl.children].forEach((seg, n) => seg.classList.toggle('is-on', n < shown[k]));
      }), 30);
      const show = (i) => {
        const s = g.ships[props.sel = (i + 3) % 3];
        el.querySelector('#ship-name').textContent = s.name;
        el.querySelector('#ship-tag').textContent = s.blurb;
        el.querySelector('#ship-last').hidden = !(store.played && SHIPS[props.sel] === store.lastShip);
        el.querySelector('#ship-kit').innerHTML = s.skills.map((k, n) => `<div class="bs-row" style="gap:8px;font-size:16px;line-height:16px">${key(n + 1)}<img src="${k.icon}" width="16" height="16" alt="">${k.name}</div>`).join('');
        g.ships.forEach((_, n) => el.querySelector(`[data-f=s${n}]`).setAttribute('aria-pressed', n === props.sel));
      };
      show(props.sel);
      const sail = () => g.startSolo(props.mode, props.sel);
      return { close: () => clearInterval(timer),
        acts: { prev: () => show(props.sel - 1), nxt: () => show(props.sel + 1), s0: () => show(0), s1: () => show(1), s2: () => show(2), sail, back: ui.pop, change: ui.pop },
        keys(e) {
          const d = { ArrowLeft: -1, ArrowRight: 1 }[e.code], n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
          if (d) show(props.sel + d); else if (n !== undefined) show(n);
          else if (e.code === 'Enter' && !/^(back|change)$/.test(document.activeElement?.dataset.f)) { if (!e.repeat) sail(); }
          else return false;
          return true;
        } };
    },
  };

  // 10 · end of a run, over the game. props: endRun's result (game.js); `top` / `rank` become the world's once it answers
  screens.gameover = {
    veil: 0.72,
    hints: (p) => (p.online ? [[['←', '→'], 'CHOOSE'], [['ESC'], 'MAIN MENU']] : [[['SPACE'], 'SAIL AGAIN'], [['←', '→'], 'CHOOSE'], [['ESC'], 'MAIN MENU']]),
    render(el, props) {
      const { entry: e, top, rank, name } = props, m = MODE[e.mode], solo = e.crew.length === 1;
      // an older row of ours further down: how many places this run gained on it
      const old = rank < 0 ? -1 : top.findIndex((r, i) => i > rank && mine(r, name));
      const gain = old - rank - 1;
      const from = Math.max(0, Math.min(rank - 2, top.length - 4));
      const row = (r, i) => `<div class="bs-over-row${i === rank ? ' is-you' : ''}"><span>${i + 1}</span><span>${esc(r.crew[0].name)}${r.crew.length > 1 ? ` +${r.crew.length - 1}` : ''}${i === rank && gain > 0 ? ` <span class="bs-over-up">▲ ${gain}</span>` : ''}</span><span>${+r.wave}</span><span>${num(r.gold)}</span><span>×${+r.combo}</span></div>`;
      const ranks = [props.world === null ? '' : props.world < 0 ? 'OFF THE WORLD TOP 100' : `#${props.world + 1} WORLD`, props.local < 0 ? '' : `#${props.local + 1} THIS BROWSER`].filter(Boolean).join(' · ');
      const btn = (f, label, first) => `<button class="bs-btn" data-f="${f}"${first ? ' data-first' : ''}${f === 'board' && !screens.leaderboard ? ' disabled' : ''}>${label}</button>`;
      el.innerHTML = `<div class="bs-abs bs-panel bs-col" role="dialog" aria-label="Run over" style="left:220px;top:24px;width:520px;padding:16px 28px;gap:12px;align-items:center">
        <div class="bs-col" style="gap:4px;align-items:center"><h1 style="font-size:56px;line-height:56px;font-weight:700;letter-spacing:4px;color:var(--bs-red);text-shadow:3px 3px 0 var(--bs-wood-edge)">SUNK</h1>
          <span class="bs-dim" style="letter-spacing:1px">${m.name} · ${solo ? `SOLO · ${e.crew[0].ship.toUpperCase()}` : `CREW OF ${e.crew.length}`}</span></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;align-self:stretch">${[[m.unit, e.wave, ''], ['GOLD', num(e.gold), 'var(--bs-gold)'], ['BEST COMBO', '×' + e.combo, 'var(--bs-orange)']].map(([l, v, c]) =>
          `<div class="bs-col" style="padding:8px;background:var(--bs-wood-edge);align-items:center;gap:4px"><span class="bs-dim">${l}</span><span style="font-size:24px;line-height:24px;color:${c}">${v}</span></div>`).join('')}</div>
        ${props.best ? '<div class="bs-badge" style="padding:4px 12px;font-size:16px;line-height:16px;letter-spacing:1px">NEW PERSONAL BEST</div>' : ''}
        <div class="bs-col" style="gap:2px;align-self:stretch"><div class="bs-row bs-dim" style="justify-content:space-between;padding:0 8px 4px"><span>SIGNED AS <span class="bs-gold">${esc(name)}</span></span><span>${ranks}</span></div>
          ${top.slice(from, from + 4).map((r, i) => row(r, from + i)).join('')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-self:stretch">${props.online ? btn('crew', '▶ FIND A NEW CREW', 1) : btn('again', '▶ SAIL AGAIN', 1) + btn('ship', 'CHANGE SHIP')}${btn('board', 'LEADERBOARD')}${btn('menu', 'MAIN MENU')}</div></div>`;
      const acts = { again: () => g.reboot('sail'), ship: () => g.reboot('ship'), crew: () => g.reboot('online'), menu: () => g.reboot('menu'),
        board: () => ui.open('leaderboard', { mode: e.mode, crew: !solo, from: 'RUN OVER' }) };
      return { acts, back: acts.menu, keys(ev) { if (ev.code !== 'Space' || props.online) return false; if (!ev.repeat) acts.again(); return true; } };
    },
  };

  // 11 · pause, over the game. Online nothing stops: the banner says so
  screens.pause = {
    veil: 0.55,
    hints: () => [[g.pauseKeys(), 'RESUME'], [['↑', '↓'], 'CHOOSE'], [['ENTER'], 'CONFIRM']],
    render(el, props) {
      g.pauseAudio(true); // back from the settings
      el.innerHTML = `${props.online ? '<div class="bs-abs bs-toast bs-toast--warn" role="status" style="left:260px;top:16px;width:440px;justify-content:center"><b>!</b> ONLINE : THE SEA DOES NOT STOP. YOUR SHIP DRIFTS.</div>' : ''}
        <div class="bs-abs bs-panel bs-menu" role="dialog" aria-label="Paused" style="left:320px;top:${props.confirm ? 96 : 132}px;width:320px;padding:20px">
          <h1 style="margin-bottom:4px;text-align:center;font-size:40px;line-height:40px;font-weight:700;letter-spacing:3px;text-shadow:3px 3px 0 var(--bs-wood-edge)">PAUSED</h1>
          <button class="bs-btn" data-f="resume" data-first>RESUME</button><button class="bs-btn" data-f="settings"${screens.settings ? '' : ' disabled'}>SETTINGS</button><button class="bs-btn" data-f="quit">QUIT TO MENU</button>
          ${props.confirm ? `<div class="bs-col" role="alertdialog" aria-label="Confirm quit" style="gap:8px;padding:12px;background:var(--bs-wood-edge);box-shadow:inset 0 0 0 2px var(--bs-red)">
            <p>ABANDON SHIP ? THIS RUN ENDS AND THE SCORE IS NOT SIGNED.${props.online ? ' YOUR CREW SAILS ON WITHOUT YOU.' : ''}</p>
            <div class="bs-row" style="gap:8px"><button class="bs-btn bs-btn--s bs-btn--danger" data-f="yes" style="padding:6px 10px">YES, QUIT</button><button class="bs-btn bs-btn--s" data-f="stay" style="padding:6px 10px">STAY ABOARD</button></div></div>` : ''}</div>`;
      const ask = (on) => { props.confirm = on; ui.refresh(); ui.focus(on ? 'stay' : 'quit'); };
      const back = () => (props.confirm ? ask(false) : g.resume());
      return { back, acts: { resume: g.resume, settings: () => { g.pauseAudio(false); ui.open('settings', { from: 'pause' }); }, quit: () => ask(true), yes: () => g.reboot('menu'), stay: () => ask(false) },
        keys(e) { if (!g.isPause(e.code)) return false; if (!e.repeat) g.resume(); return true; } };
    },
  };

  // 08 · settings: everything is kept as soon as it changes. props: { tab, from: 'pause' }
  screens.settings = {
    veil: 0.6, shot: () => ({ wide: true }),
    hints: [[['↑', '↓'], 'CHOOSE'], [['←', '→'], 'ADJUST'], [['TAB'], 'NEXT SECTION'], [['ESC'], 'BACK']],
    render(el, props) {
      props.tab ??= 'audio';
      const TABS = [['audio', 'AUDIO'], ['controls', 'CONTROLS'], ['display', 'DISPLAY'], ['profile', 'PROFILE']];
      el.innerHTML = `<div class="bs-abs bs-col" style="left:106px;top:28px;gap:4px"><div class="bs-crumb">${props.from === 'pause' ? 'PAUSE' : 'MENU'} ▸ SETTINGS</div><h1 class="bs-h1">SETTINGS</h1></div>
        <div class="bs-abs bs-panel bs-row" style="left:106px;top:92px;width:748px;height:396px;align-items:stretch">
          <div class="bs-tabs bs-tabs--v" role="tablist" aria-orientation="vertical" data-group style="width:160px;padding:16px 0 16px 16px;border-right:2px solid var(--bs-wood-edge)">
            ${TABS.map(([id, l]) => `<button class="bs-tab" role="tab" data-f="t-${id}" aria-selected="${id === props.tab}"${id === props.tab ? ' data-first' : ''}>${l}</button>`).join('')}</div>
          <div class="bs-col" data-group style="flex:1;min-width:0;padding:20px 24px;gap:12px"><div id="set-body" class="bs-col" style="gap:12px"></div>
            <div class="bs-row" style="margin-top:auto;justify-content:space-between"><button class="bs-btn" data-f="back">◀ BACK</button><span style="color:var(--bs-green)">✓ SAVED AUTOMATICALLY</span></div></div></div>`;
      const body = el.querySelector('#set-body'), acts = { back: ui.pop };
      const switchHtml = (f, on, label, danger) => `<button class="bs-switch${danger ? ' bs-switch--danger' : ''}" role="switch" data-f="${f}" aria-checked="${on}" aria-label="${label}"><span></span></button>`;
      const paint = {
        audio() {
          const a = store.audio;
          const set = (k, v) => { a[k] = Math.max(0, Math.min(10, v)); store.audio = a; g.setAudio(a); draw('v-' + k); };
          body.innerHTML = [['master', 'MASTER'], ['music', 'MUSIC'], ['fx', 'EFFECTS']].map(([k, l]) => `<div class="bs-row" style="gap:12px;font-size:16px;line-height:16px"><span style="width:104px">${l}</span>
            <button class="bs-step" tabindex="-1" data-f="d-${k}" aria-label="${l} down">◀</button><div class="bs-slider${a.muted ? ' is-muted' : ''}" role="slider" tabindex="0" data-f="v-${k}" aria-label="${l}" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${a[k]}">${Array.from({ length: 10 }, (_, i) => `<span${i < a[k] ? ' class="is-on"' : ''}></span>`).join('')}</div>
            <button class="bs-step" tabindex="-1" data-f="u-${k}" aria-label="${l} up">▶</button><span style="width:44px;text-align:right;color:var(--${a.muted ? 'bs-trim' : 'bs-gold'})">${a[k] * 10}%</span>${k === 'fx' ? '<button class="bs-btn bs-btn--s" data-f="test">▶ TEST</button>' : ''}</div>`).join('') +
            `<div class="bs-row" style="gap:12px;padding-top:16px;border-top:2px solid var(--bs-wood-edge)"><span style="width:104px;font-size:16px;line-height:16px">MUTE ALL</span>${switchHtml('mute', a.muted, 'Mute all sound', true)}
              <span class="bs-dim">SOUND IS ${a.muted ? 'OFF' : 'ON'} · ${key(g.muteLabel())} ANYWHERE</span></div>
            <p class="bs-dim">MUSIC GAINS DRUMS IN COMBAT. SEA AMBIENCE FOLLOWS EFFECTS.</p>`;
          for (const k of ['master', 'music', 'fx']) {
            acts['d-' + k] = () => set(k, a[k] - 1);
            acts['u-' + k] = () => set(k, a[k] + 1);
            acts['v-' + k] = (sl, e) => { const i = [...sl.children].indexOf(e.target); if (i >= 0) set(k, i + 1); }; // a click on a notch
            body.querySelector(`[data-f=v-${k}]`).onkey = (e) => { const d = { ArrowLeft: -1, ArrowRight: 1 }[e.code]; if (d) set(k, a[k] + d); return !!d; };
          }
          acts.test = () => g.testFx();
          acts.mute = () => { a.muted = !a.muted; store.audio = a; g.setAudio(a); draw('mute'); };
        },
        controls() {
          const keys = g.keys(), L = props.listen, C = props.conflict, name = ui.layoutName();
          const cap = (a) => `<button class="bs-keycap${a === L ? ' is-listening' : ''}${C && (a === C.action || a === C.other) ? ' is-conflict' : ''}" data-f="k-${a}" aria-label="Change key for ${actionLabel(a)}">${a === L ? 'PRESS A KEY…' : esc(keyLabel(C && a === C.action ? C.code : keys[a]))}</button>`;
          body.innerHTML = `<div class="bs-row" style="justify-content:space-between"><span class="bs-dim">KEYS SHOWN FOR YOUR KEYBOARD${name ? ` : <span class="bs-gold">${name}</span>` : ''}</span><button class="bs-btn bs-btn--s" data-f="k-reset">RESET TO DEFAULTS</button></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px">${KEY_ROWS.map(([ids, l]) => {
              const on = ids.includes(L) || (C && ids.includes(C.action)), bad = C && (ids.includes(C.action) || ids.includes(C.other));
              return `<div class="bs-row bs-keyrow${on ? ' is-on' : ''}${bad ? ' is-bad' : ''}"><span>${l}</span><span class="bs-row" style="gap:4px">${ids.map(cap).join('')}</span></div>`;
            }).join('')}</div>
            ${L ? `<div class="bs-row bs-banner" style="box-shadow:inset 0 0 0 2px var(--bs-${props.note ? 'red' : 'gold'})"><span style="flex:1">${props.note ? `<span style="color:var(--bs-red)">${props.note}.</span> ` : ''}PRESS THE NEW KEY FOR <span class="bs-gold">${actionLabel(L)}</span></span><span class="bs-dim">${key('ESC')} CANCEL</span><button class="bs-btn bs-btn--s" data-f="k-cancel">CANCEL</button></div>` : ''}
            ${C ? `<div class="bs-row bs-banner" role="alert" style="box-shadow:inset 0 0 0 2px var(--bs-red)"><span style="flex:1"><span style="color:var(--bs-red)">${esc(keyLabel(C.code))}</span> ALREADY SETS <span class="bs-gold">${actionLabel(C.other)}</span>. SWAP THEM ?</span><button class="bs-btn bs-btn--s" data-f="k-swap">SWAP KEYS</button><button class="bs-btn bs-btn--s" data-f="k-cancel">CANCEL</button></div>` : ''}`;
          const save = (k) => { store.keys = k; g.rekey(); };
          const state = (listen, conflict, note, focus) => { Object.assign(props, { listen, conflict, note }); draw(focus); };
          for (const a of Object.keys(DEFAULT_KEYS)) acts['k-' + a] = () => state(a, null, '', 'k-' + a);
          acts['k-cancel'] = () => state(null, null, '', 'k-' + (L || C.action));
          acts['k-swap'] = () => { save(swapKeys(keys, C.action, C.other)); state(null, null, '', 'k-' + C.action); };
          acts['k-reset'] = () => ui.modal({ title: 'RESET KEYS ?', text: 'EVERY KEY GOES BACK TO ITS DEFAULT.', buttons: [{ label: 'CANCEL', cancel: true }, { label: 'RESET TO DEFAULTS', danger: true, run: () => { save(DEFAULT_KEYS); state(null, null, '', 'k-reset'); } }] });
          props.grab = !L ? null : (e) => { // the next key down is the new one; Escape gives up
            if (e.repeat) return;
            if (e.code === 'Escape') return acts['k-cancel']();
            const r = rebind(keys, L, e.code);
            if (r.reserved) return state(L, null, 'RESERVED KEY', 'k-' + L);
            if (e.key.length === 1) store.keyNames = { ...store.keyNames, [e.code]: e.key }; // its label, for browsers that do not tell the layout
            if (r.conflict) return state(null, { action: L, other: r.conflict, code: e.code }, '', 'k-swap');
            save(r.keys);
            state(null, null, '', 'k-' + L);
          };
        },
        display() {
          const d = store.display;
          const row = (l, sw, note) => `<div class="bs-row" style="gap:12px"><span style="width:176px;font-size:16px;line-height:16px">${l}</span>${sw}<span class="bs-dim">${note}</span></div>`;
          body.innerHTML = row('FULLSCREEN', switchHtml('full', !!document.fullscreenElement, 'Fullscreen'), `ALSO ${key('F11')}`) + row('KEY HINTS BAR', switchHtml('hints', d.hints, 'Key hints bar'), 'THE STRIP AT THE BOTTOM IN GAME');
          acts.full = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen())?.catch(() => {});
          acts.hints = () => { store.display = { hints: !d.hints }; g.rekey(); draw('hints'); };
        },
        profile() {
          body.innerHTML = `<label class="bs-dim" for="set-name">CAPTAIN NAME</label>
            <div class="bs-row" style="gap:8px"><input id="set-name" class="bs-field" data-f="name" maxlength="12" autocomplete="off" spellcheck="false" style="width:280px;height:40px;font-size:24px;letter-spacing:3px"><button class="bs-btn" data-f="roll">⟳ ROLL</button><button class="bs-btn" data-f="save">SAVE</button></div>
            <p class="bs-dim">A TO Z, 12 LETTERS MAX. SCORES ALREADY ON THE BOARD KEEP THE NAME THEY WERE SIGNED WITH.</p>`;
          const input = body.querySelector('input'), btn = body.querySelector('[data-f=save]');
          const show = () => { btn.disabled = !input.value || input.value === store.name; };
          input.value = store.name;
          input.oninput = () => { const v = cleanName(input.value); if (v !== input.value) input.value = v; show(); };
          show();
          acts.roll = () => { input.value = rollName(); show(); };
          acts.save = () => { if (btn.disabled) return; store.name = input.value; show(); ui.focus('name'); ui.toast('ok', 'NAME SAVED · ' + input.value); };
          props.field = input;
        },
      };
      // one tab's content again, the focus back on `focus`
      function draw(focus) {
        props.grab = props.field = null;
        for (const t of el.querySelectorAll('.bs-tab')) t.setAttribute('aria-selected', t.dataset.f === 't-' + props.tab);
        paint[props.tab]();
        if (focus) ui.focus(focus);
      }
      for (const [id] of TABS) {
        acts['t-' + id] = () => {};
        el.querySelector(`[data-f=t-${id}]`).onfocus = () => { if (props.tab !== id) { Object.assign(props, { tab: id, listen: null, conflict: null, note: '' }); draw(); } }; // a tab is chosen by focusing it
      }
      draw();
      const onFull = () => props.tab === 'display' && draw('full');
      document.addEventListener('fullscreenchange', onFull);
      return { acts, close: () => document.removeEventListener('fullscreenchange', onFull), keys(e) {
        if (props.grab && !e.ctrlKey && !e.metaKey) { props.grab(e); return true; }
        if (props.field && e.target === props.field) { if (e.code === 'Enter') { if (!e.repeat) acts.save(); return true; } return nameKey(e, props.field); }
        return false;
      } };
    },
  };

  // 09 · leaderboard: WAVES / CONVOY, solo runs and crews apart, the world's top 100 or this browser's top 10.
  // props: { mode, crew, local, from }. The focused crew row opens to show its pirates.
  const CHIP = { wasp: 'WSP', corsair: 'COR', leviathan: 'LEV' };
  screens.leaderboard = {
    veil: 0.6, shot: () => ({ wide: true }),
    hints: [[['←', '→'], 'MODE'], [['TAB'], 'FILTERS'], [['↑', '↓'], 'SCROLL · SELECTED ROW SHOWS THE CREW'], [['Y'], 'JUMP TO YOU'], [['ESC'], 'BACK']],
    render(el, props) {
      props.mode ??= store.lastMode;
      props.world ??= {}; // board → rows | 'fail', read once per visit
      const name = store.name, m = MODE[props.mode], board = boardOf(props.mode, props.crew ? 2 : 1);
      const yours = (r) => mine(r, name);
      for (const b of [props.mode, props.mode + '-crew']) if (!props.local && !(b in props.world)) { // both: the footer ranks you on each
        props.world[b] = null;
        g.world(b).then((rows) => rows, () => 'fail').then((rows) => {
          props.world[b] = rows;
          if (ui.top() !== 'leaderboard') return;
          ui.refresh();
          if (!props.touched) ui.focus(); // nothing pressed yet: land on your row, or the first
        });
      }
      const lists = props.local ? store.best : props.world; // board → rows
      const rows = lists[board];
      const you = Array.isArray(rows) ? rows.findIndex(yours) : -1;
      const best = (b) => { const l = lists[b], i = Array.isArray(l) ? l.findIndex(yours) : -1; return i < 0 ? '–' : `<span class="bs-gold">#${i + 1}</span>`; };
      const seg = (f, on, label) => `<button data-f="${f}" aria-pressed="${on}">${label}</button>`;
      const line = (r, i) => `<div class="bs-lb-item${i === you ? ' is-you' : ''}" tabindex="0" data-f="r${i}"${i === Math.max(you, 0) ? ' data-first' : ''}><div class="bs-lb-row"><span>${i + 1}</span>
        <span class="bs-row" style="gap:8px;min-width:0">${esc(r.crew[0].name)}${r.crew.length > 1 ? `<span class="bs-badge bs-badge--off">+${r.crew.length - 1}</span>` : ''}${i === you ? `<span class="bs-badge bs-badge--you">${r.crew.length > 1 ? 'YOUR CREW' : 'YOU'}</span>` : ''}</span>
        <span class="bs-row" style="gap:4px">${r.crew.map((c) => `<span class="bs-ship-chip bs-ship-chip--${CHIP[c.ship] ? c.ship : 'wasp'}">${CHIP[c.ship] || '?'}</span>`).join('')}</span><span>${+r.wave}</span><span>${num(r.gold)}</span><span>×${+r.combo}</span></div>
        ${r.crew.length > 1 ? `<div class="bs-lb-crew">${r.crew.map((c) => `<span class="bs-row"><span${c.name === name ? ' class="bs-gold"' : ''}>${esc(c.name)}</span><span class="bs-dim">${esc(String(c.ship).toUpperCase())}</span></span>`).join('')}</div>` : ''}</div>`;
      el.innerHTML = `${head(90, 20, [props.from || 'MENU', 'LEADERBOARD'], 1, 'HALL OF INFAMY')}
        <div class="bs-abs bs-row" style="left:90px;top:84px;width:780px;justify-content:space-between;align-items:flex-end">
          <div class="bs-tabs" role="tablist" data-group>${['waves', 'convoy'].map((id) => `<button class="bs-tab" role="tab" data-f="t-${id}" aria-selected="${id === props.mode}">${MODE[id].name}</button>`).join('')}</div>
          <div class="bs-row" style="gap:12px;padding-bottom:4px"><div class="bs-seg" data-group aria-label="Crew size">${seg('solo', !props.crew, 'SOLO')}${seg('crew', !!props.crew, 'CREW')}</div>
            <div class="bs-seg" data-group aria-label="Scope">${seg('world', !props.local, 'WORLD')}${seg('local', !!props.local, 'THIS BROWSER')}</div></div></div>
        <div class="bs-abs bs-panel bs-col" style="left:90px;top:119px;width:780px;height:368px;padding:12px 16px;gap:2px">
          <div class="bs-lb-row bs-dim" style="font-size:8px;line-height:12px;border-bottom:2px solid var(--bs-wood-edge)"><span>#</span><span>${props.crew ? 'CREW' : 'CAPTAIN'}</span><span>${props.crew ? 'SHIPS' : 'SHIP'}</span><span>${m.unit}</span><span>GOLD</span><span>COMBO</span></div>
          <div id="lb-rows" class="bs-col" data-group style="flex:1;min-height:0;overflow-y:auto;scrollbar-width:none;gap:2px">${
            rows === 'fail' ? '<p class="bs-alert" role="alert" style="padding:12px 8px"><b>✕</b> WORLD BOARD UNREACHABLE. THIS BROWSER STILL HAS YOUR RUNS.</p>'
            : !rows ? '<p class="bs-dim" style="padding:12px 8px">◌ READING THE WORLD BOARD…</p>'
            : rows.length ? rows.map(line).join('') : `<p class="bs-dim" style="padding:12px 8px">NO ${props.crew ? 'CREW' : 'SOLO'} RUN SIGNED YET.</p>`}</div>
          <div class="bs-row bs-dim" style="justify-content:space-between;padding:6px 8px 0;border-top:2px solid var(--bs-wood-edge)"><span>${props.local ? 'THIS BROWSER · TOP 10' : 'WORLD TOP 100'} · CREW SCORES RANKED APART FROM SOLO</span>
            <span>YOUR BEST · SOLO ${best(props.mode)} · CREW ${best(props.mode + '-crew')}</span></div></div>`;
      const box = el.querySelector('#lb-rows');
      for (const r of box.querySelectorAll('.bs-lb-item')) r.onfocus = () => { // keep the focused row in view (not scrollIntoView: it would scroll the stage too)
        if (r.offsetTop < box.scrollTop) box.scrollTop = r.offsetTop;
        else if (r.offsetTop + r.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = r.offsetTop + r.offsetHeight - box.clientHeight;
      };
      const set = (o, focus) => { Object.assign(props, o, { touched: true }); ui.refresh(); ui.focus(focus); };
      return { acts: { 't-waves': () => set({ mode: 'waves' }, 't-waves'), 't-convoy': () => set({ mode: 'convoy' }, 't-convoy'),
        solo: () => set({ crew: false }, 'solo'), crew: () => set({ crew: true }, 'crew'), world: () => set({ local: false }, 'world'), local: () => set({ local: true }, 'local') },
        keys(e) {
          props.touched = true;
          const side = { ArrowLeft: 'waves', ArrowRight: 'convoy' }[e.code];
          if (side && !document.activeElement?.closest('.bs-seg')) { if (side !== props.mode) set({ mode: side }, document.activeElement?.dataset.f?.startsWith('t-') ? 't-' + side : undefined); return true; }
          if (e.code === 'KeyY' || /^y$/i.test(e.key)) { if (you >= 0) ui.focus('r' + you); return true; }
          return false;
        } };
    },
  };

  // 06 · online hub: quick match, create a room, join one. Network messages are toasts; a bad code is said under the field
  const QUICK = [['coop-waves', 'CO-OP · WAVES', 'HOLD THE LINE TOGETHER'], ['coop-convoy', 'CO-OP · CONVOY', 'RAID THE MERCHANTS'], ['pvp', 'PVP', 'FIRST TO 10 SINKINGS · 5 MIN']];
  screens.online = {
    veil: 0.5, shot: () => ({ wide: true }),
    hints: [[['←', '→'], 'COLUMN'], [['↑', '↓'], 'CHOOSE'], [['ENTER'], 'GO'], [['ESC'], 'BACK']],
    render(el, props) {
      props.code ??= '';
      const { off, busy, err } = g.hub();
      const at = (f) => (busy === f ? ' aria-busy="true"' : off || busy ? ' disabled' : '');
      el.innerHTML = `${head(90, 28, ['MENU', 'ONLINE'], 1, 'GATHER A CREW')}
        <div class="bs-abs bs-chip" style="right:90px;top:48px"><i style="width:6px;height:6px;background:var(--bs-${off ? 'red' : 'green'})"></i>${off ? 'ONLINE UNAVAILABLE · SOLO STILL WORKS' : `<span>CONNECTED AS <span class="bs-gold">${esc(store.name)}</span></span>`}</div>
        <div class="bs-abs" style="left:90px;top:104px;width:780px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch">
          <section class="bs-panel bs-col" data-group style="padding:16px;gap:10px"><h2 class="bs-h2 bs-gold">QUICK MATCH</h2><p class="bs-dim">SAIL WITH STRANGERS. THE SHIP LEAVES 15 S AFTER THE ROOM OPENS, FULL OR NOT.</p>
            <div class="bs-menu">${QUICK.map(([q, l, sub], i) => `<button class="bs-btn" data-f="q-${q}"${i ? '' : ' data-first'}${at('q-' + q)}><span>${l}</span><span>${sub}</span></button>`).join('')}</div></section>
          <section class="bs-panel bs-col" data-group style="padding:16px;gap:10px"><h2 class="bs-h2">CREATE A ROOM</h2><p class="bs-dim">PRIVATE. FRIENDS JOIN WITH A 4-LETTER CODE. YOU PICK THE MODE INSIDE AND SET SAIL WHEN READY.</p>
            <div style="flex:1;display:grid;place-items:center;min-height:56px;background:var(--bs-wood-edge);box-shadow:inset 0 0 0 2px var(--bs-wood-hi);font-size:24px;line-height:24px;letter-spacing:6px;color:var(--bs-wood-hi)">? ? ? ?</div>
            <button class="bs-btn" data-f="create" style="align-self:center"${at('create')}>CREATE ROOM</button></section>
          <section class="bs-panel bs-col" data-group style="padding:16px;gap:10px"><h2 class="bs-h2">JOIN A ROOM</h2><p class="bs-dim">TYPE THE CODE YOUR CAPTAIN GAVE YOU. PASTE WORKS TOO.</p>
            <label class="bs-dim" for="room-code">ROOM CODE</label>
            <div class="bs-codein${err ? ' is-bad' : ''}"><span></span><span></span><span></span><span></span><input id="room-code" data-f="code" data-nocaret maxlength="8" autocomplete="off" spellcheck="false" aria-describedby="code-err"${err ? ' aria-invalid="true"' : ''}${off || busy ? ' disabled' : ''}></div>
            <p id="code-err" class="bs-alert" role="alert" style="min-height:24px">${err ? `<b>✕</b> ${esc(err)}` : ''}</p>
            <button class="bs-btn" data-f="join" style="align-self:center"${at('join')}>JOIN</button></section></div>`;
      const input = el.querySelector('#room-code'), join = el.querySelector('[data-f=join]'), cells = [...el.querySelectorAll('.bs-codein span')];
      const show = () => { cells.forEach((c, i) => (c.textContent = props.code[i] || '')); if (!busy) join.disabled = off || props.code.length < 4; };
      input.value = props.code;
      input.oninput = () => { props.code = input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); show(); }; // a paste is filtered, its first 4 letters kept
      show();
      const acts = { create: g.create, join: () => g.join(props.code) };
      for (const [q] of QUICK) acts['q-' + q] = () => g.quick(q);
      return { acts, back() { if (busy) g.leave(); ui.pop(); }, keys(e) { if (e.code !== 'Enter' || e.target !== input) return false; if (!e.repeat) g.join(props.code); return true; } };
    },
  };

  // 07 · lobby: the room's code or the quick-match clock, the mode, four seats, your ship. The host sets sail; guests say READY
  const LOBBY_MODE = { waves: ['WAVES', 'HOLD THE LINE TOGETHER'], convoy: ['CONVOY', 'RAID THE MERCHANTS'], pvp: ['PVP', 'FIRST TO 10 SINKINGS OR BEST SCORE AFTER 5 MIN'] };
  screens.lobby = {
    veil: 0.5, shot: () => ({ wide: true }),
    hints() { const L = g.lobby(); return [[['1', '2', '3'], 'SHIP'], [['ENTER'], L.host && !L.quick ? 'SET SAIL' : 'READY'], ...(L.quick ? [] : [[['C'], 'COPY CODE']]), [['ESC'], 'LEAVE']]; },
    render(el, props) {
      const L = g.lobby(), n = L.players.length, you = L.players.find((p) => p.pid === L.me), cap = L.players[0]?.name || 'THE CAPTAIN';
      const ready = L.players.filter((p) => p.ready).length, canSail = L.host && !L.quick;
      const seat = (p, i) => {
        if (!p) {
          const [text, hint] = L.quick ? ['SEARCHING…', 'ANYONE CAN STILL JOIN'] : L.host ? ['WAITING FOR A PIRATE…', i === n ? `SHARE THE CODE ${L.code}` : ''] : ['OPEN SEAT', ''];
          return `<div class="bs-slot is-empty"><span>SEAT ${i + 1}</span><span style="font-size:16px;line-height:20px">${text}</span><span style="color:var(--bs-trim)">${hint}</span></div>`;
        }
        const me = p.pid === L.me, captain = p.pid === 0, badge = captain && me ? 'CAPTAIN · YOU' : captain ? 'CAPTAIN' : me ? 'YOU' : '';
        return `<div class="bs-slot${me ? ' is-you' : ''}"><div class="bs-row" style="justify-content:space-between;height:12px"><span class="bs-dim">SEAT ${i + 1}</span>${badge ? `<span class="bs-badge${captain ? '' : ' bs-badge--you'}">${badge}</span>` : ''}</div>
          <div style="height:92px;display:grid;place-items:center;background:var(--bs-sea-1);box-shadow:inset 0 0 0 2px var(--bs-wood-edge);overflow:hidden">${p.ship === null ? '<span style="font-size:32px;line-height:32px;color:var(--bs-wood-hi)">?</span>' : `<img src="${g.thumb(p.ship)}" width="100" height="70" alt="${g.ships[p.ship].name}">`}</div>
          <span${me ? ' class="bs-gold"' : ''} style="font-size:16px;line-height:16px">${esc(p.name)}</span><span class="bs-dim">${p.ship === null ? 'NO SHIP YET' : g.ships[p.ship].name}</span>
          <span class="bs-status bs-status--${p.ready ? 'ready' : 'picking'}">${p.ready ? '✓ READY' : p.ship === null ? 'PICKING A SHIP' : 'NOT READY'}</span></div>`;
      };
      el.innerHTML = `<div class="bs-abs bs-col" style="left:90px;top:20px;gap:4px"><div class="bs-crumb">ONLINE ▸ ${L.quick ? 'QUICK MATCH' : 'PRIVATE ROOM'}</div><h1 class="bs-h1">${L.quick ? 'QUICK MATCH' : `ROOM ${L.code}`}</h1>
          <span class="bs-dim">${L.quick ? `${LOBBY_MODE[L.mode][0]} · ROOM ${L.code} · ${n}/4 PIRATES` : `${n}/4 PIRATES ABOARD`}${L.started ? ' · RUN UNDER WAY' : ''}</span></div>
        ${L.quick ? `<div class="bs-abs bs-panel bs-panel--gold bs-col" style="right:90px;top:16px;width:268px;padding:10px 12px;gap:6px"><div class="bs-row" style="justify-content:space-between;height:40px"><span style="font-size:16px;line-height:16px;letter-spacing:1px">${L.countdown === null ? 'WAITING FOR PIRATES…' : 'SETTING SAIL IN'}</span>
            <span class="bs-gold" style="font-size:40px;line-height:40px;font-weight:700">${L.countdown ?? ''}</span></div><div style="display:grid;grid-template-columns:repeat(15,1fr);gap:2px">${Array.from({ length: 15 }, (_, i) => `<i style="height:8px;background:var(--bs-${i < (L.countdown ?? 0) ? 'gold' : 'wood-edge'})"></i>`).join('')}</div></div>`
        : `<div class="bs-abs bs-panel bs-col" style="right:90px;top:12px;padding:8px 12px;gap:4px;align-items:flex-end"><span class="bs-dim" style="letter-spacing:1px">ROOM CODE</span>
            <div class="bs-row" style="gap:8px"><div class="bs-code">${[...L.code].map((c) => `<span>${c}</span>`).join('')}</div><button class="bs-btn bs-btn--s" data-f="copy" aria-label="Copy room code" style="height:36px;background:var(--bs-wood-hi)">${props.copied ? '✓ COPIED' : 'COPY'}</button></div></div>`}
        <div class="bs-abs bs-row" style="left:90px;top:116px;width:780px;gap:8px"><span class="bs-dim" style="margin-right:4px">MODE</span>
          ${(L.quick ? [L.mode] : ['waves', 'convoy', 'pvp']).map((m) => `<button class="bs-btn bs-btn--s" data-f="m-${m}" aria-pressed="${m === L.mode}"${canSail && !L.started ? '' : ' disabled'} style="padding:6px 12px">${LOBBY_MODE[m][0]}</button>`).join('')}
          <span class="bs-dim" style="margin-left:4px">${L.quick ? LOBBY_MODE[L.mode][1] : L.host ? 'ONLY YOU CAN CHANGE IT' : 'THE CAPTAIN CHOOSES'}</span></div>
        <div class="bs-abs" style="left:90px;top:152px;width:780px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px">${[0, 1, 2, 3].map((i) => seat(L.players[i], i)).join('')}</div>
        <div class="bs-abs bs-row" style="left:90px;top:376px;width:780px;gap:8px"><span class="bs-dim" style="margin-right:4px">YOUR SHIP</span>
          ${g.ships.map((s, i) => `<button class="bs-btn bs-row" data-f="s${i}" aria-pressed="${you?.ship === i}"${i === (you?.ship ?? SHIPS.indexOf(store.lastShip)) && !canSail ? ' data-first' : ''} style="gap:8px;padding:6px 12px">${key(i + 1)}${s.name}</button>`).join('')}
          ${L.host ? '' : `<button class="bs-btn bs-ready" data-f="ready" aria-pressed="${!!you?.ready}" style="margin-left:auto;padding:6px 12px">${you?.ready ? '✓ READY' : L.started ? '▶ JOIN THE RUN' : 'READY'}</button>`}</div>
        <div class="bs-abs bs-row" style="left:90px;top:424px;width:780px;justify-content:space-between"><button class="bs-btn" data-f="leave">◀ LEAVE ROOM</button>
          ${canSail ? `<button class="bs-btn bs-btn--primary" data-f="sail" data-first>${n === 1 ? 'SET SAIL ALONE · 1/4' : ready === n ? 'SET SAIL · ALL READY' : `SET SAIL · ${ready}/${n} READY`} ▶</button>`
          : `<span class="bs-dim" style="padding:8px 12px;font-size:16px;line-height:16px;background:var(--bs-wood-edge);box-shadow:inset 0 0 0 2px var(--bs-wood-hi)">${L.quick ? 'NOT PICKED AT 0 = YOUR LAST SHIP' : L.started ? 'READY PUTS YOUR SHIP TO SEA' : `WAITING FOR ${esc(cap)} TO SET SAIL…`}</span>`}</div>`;
      const copy = () => navigator.clipboard?.writeText(L.code).then(() => { props.copied = true; ui.refresh(); setTimeout(() => { props.copied = false; if (ui.top() === 'lobby') ui.refresh(); }, 2000); }, () => {});
      const acts = { copy, leave: () => g.leave(), ready: g.lobbyReady, sail: g.lobbyStart, s0: () => g.lobbyPick(0), s1: () => g.lobbyPick(1), s2: () => g.lobbyPick(2) };
      for (const m of ['waves', 'convoy', 'pvp']) acts['m-' + m] = () => g.lobbyMode(m);
      return { acts, back: acts.leave, keys(e) {
        const i = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code];
        if (i !== undefined) { g.lobbyPick(i); ui.focus('s' + i); } // the focus follows the pick: Enter is then the main action
        else if (e.code === 'KeyC' && !L.quick) copy();
        else if (e.code === 'Enter') { // the main action, unless the focus is on a button that does something else (a ship not picked yet: Enter picks it)
          const on = document.activeElement?.dataset.f || '';
          if (/^(leave|copy|m-\w+)$/.test(on) || (/^s\d$/.test(on) && +on[1] !== you?.ship)) return false;
          if (!e.repeat) (canSail ? g.lobbyStart : g.lobbyReady)();
        }
        else return false;
        return true;
      } };
    },
  };

  // PvP: the match is over. The captain can start another; the others wait or leave
  screens.pvpover = {
    veil: 0.72,
    hints: [[['←', '→'], 'CHOOSE'], [['ESC'], 'MAIN MENU']],
    render(el, props) {
      el.innerHTML = `<div class="bs-abs bs-panel bs-col" role="dialog" aria-label="Match over" style="left:260px;top:72px;width:440px;padding:20px 28px;gap:12px;align-items:center">
        <div class="bs-col" style="gap:4px;align-items:center"><h1 style="font-size:56px;line-height:56px;font-weight:700;letter-spacing:4px;color:var(--bs-${props.won ? 'gold' : 'red'});text-shadow:3px 3px 0 var(--bs-wood-edge)">${props.won ? 'VICTORY' : 'SUNK'}</h1>
          <span class="bs-dim" style="letter-spacing:1px">PVP · ${esc(props.rows[0].name)} WINS · ${props.rows[0].kills} SINKINGS</span></div>
        <div class="bs-col" style="gap:2px;align-self:stretch">${props.rows.map((r, i) => `<div class="bs-over-row${r.you ? ' is-you' : ''}" style="grid-template-columns:36px minmax(0,1fr) 120px 48px"><span>${i + 1}</span><span>${esc(r.name)}</span><span>${esc(r.ship)}</span><span>${+r.kills}</span></div>`).join('')}</div>
        <div class="bs-row" style="gap:8px;align-self:stretch;justify-content:space-between">${props.host ? '<button class="bs-btn" data-f="again" data-first>▶ REMATCH</button>' : `<span class="bs-dim">WAITING FOR ${esc(props.captain)} TO START A REMATCH…</span>`}<button class="bs-btn" data-f="menu">MAIN MENU</button></div></div>`;
      const acts = { again: g.rematch, menu: () => g.reboot('menu') };
      return { acts, back: acts.menu };
    },
  };
}
