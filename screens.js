// The menu screens (design/start-screen/broadside-handoff). Positions are in the 960×540 logical stage.
// g: what game.js lends the menus (ships, start a run, sound…); the menus never import the game.
import * as ui from './ui.js';
import { screens, esc, keyLabel } from './ui.js';
import { store, cleanName, rollName, SHIPS } from './store.js';

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
    back: false, shot: () => ({ ship: SHIPS.indexOf(store.lastShip), side: 1 }),
    hints: () => [[['↑', '↓'], 'CHOOSE'], [['ENTER'], 'CONFIRM'], [[g.muteLabel()], 'SOUND']],
    render(el) {
      const mode = store.lastMode, ship = g.ships[SHIPS.indexOf(store.lastShip)], best = store.best[mode][0];
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
        sail: () => g.startSolo(mode, SHIPS.indexOf(store.lastShip)),
        solo: () => ui.open('solo-mode'),
        online: () => g.oldPanel(),
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
}
