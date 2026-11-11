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
        solo: () => g.oldPanel(),
        online: () => g.oldPanel(),
        board: () => ui.open('leaderboard'),
        settings: () => ui.open('settings'),
        edit: () => screens.settings && ui.open('settings', { tab: 'profile' }),
      } };
    },
  };
}
