// Menu shell: a 960×540 logical stage scaled by a whole number of device pixels, a stack of screens, and one
// focused element at a time (the mouse moves the same focus the arrows do). Screens live in screens.js.
import { store } from './store.js';
import { t as tr, tk } from './i18n.js'; // tr: `t` is the top screen in here

const W = 960, H = 540;
const $ = (id) => document.getElementById(id);
const stage = $('ui-stage'), host = $('ui-screen'), veil = $('ui-veil'), hintsEl = $('ui-hints'), modalEl = $('ui-modal'), toastsEl = $('ui-toasts');
export const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Silkscreen is only sharp on whole device pixels: ×1, ×2… on a plain screen, ×1.5 too on a Retina one
function fit() {
  const d = devicePixelRatio || 1, s = Math.max(1, Math.floor(Math.min(innerWidth / W, innerHeight / H) * d)) / d;
  const snap = (v) => Math.round(v * d) / d;
  stage.style.transform = `translate(${snap((innerWidth - W * s) / 2)}px, ${snap((innerHeight - H * s) / 2)}px) scale(${s})`;
}
addEventListener('resize', fit);
fit();

// screens[id] = { veil: 0..1, hints: [[keys, label]…] | (props) => …, shot: (props) => camera framing for game.js, back: false (no way back),
//   hint keys and labels are English, translated when the bar is drawn (i18n.js).
//   render(el, props) → { acts: { [data-f]: fn(el) }, keys(e) → true when handled, back(), tab(dir), close() } }
export const screens = {};
const stack = []; // { id, props, focus, h }
let onChange = () => {}, onKey = () => {};
export const setOnChange = (f) => (onChange = f); // a screen opened or closed, or the keyboard layout is known
export const setOnKey = (f) => (onKey = f); // a key no screen used, outside a text field (the game's mute key)
export const active = () => stack.length > 0;
export const top = () => stack.at(-1)?.id;
export const shot = () => { const t = stack.at(-1); return (t && screens[t.id].shot?.(t.props)) || null; };

const FOCUS = 'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled), [tabindex="0"]'; // tabindex -1: mouse only (slider steps)
const layer = () => modalEl.firstElementChild || host;
const items = () => [...layer().querySelectorAll(FOCUS)].filter((el) => el.offsetParent !== null);
const focused = () => (layer().contains(document.activeElement) ? document.activeElement : null);
const byKey = (k) => (k ? layer().querySelector(`[data-f="${k}"]`) : null);
export function focus(k) {
  const el = (typeof k === 'string' ? byKey(k) : k) || layer().querySelector('[data-first]') || items()[0];
  if (el && !el.disabled) el.focus({ preventScroll: true }); else document.activeElement?.blur();
}

const keyHtml = (k) => `<span class="bs-key">${esc(k)}</span>`;
function mount(fresh, keep) {
  const t = stack.at(-1);
  host.textContent = '';
  hintsEl.textContent = '';
  veil.style.background = '';
  if (t) {
    const def = screens[t.id], el = document.createElement('div');
    el.className = fresh ? 'bs-screen bs-in' : 'bs-screen';
    el.dataset.screen = t.id;
    host.append(el);
    t.h = def.render(el, t.props) || {};
    if (def.veil) veil.style.background = `rgba(12, 33, 64, ${def.veil})`;
    const hints = typeof def.hints === 'function' ? def.hints(t.props) : def.hints;
    hintsEl.innerHTML = (hints || []).map(([keys, label]) => `<span>${keys.map((k) => keyHtml(tr(k))).join('')} ${esc(tr(label))}</span>`).join('');
    if (!modalEl.firstElementChild) focus(keep ?? t.focus);
  }
  onChange();
}
const leave = () => { const t = stack.at(-1); if (t) { t.focus = focused()?.dataset.f; t.h?.close?.(); } };
export function open(id, props = {}) { leave(); stack.push({ id, props }); mount(true); }
// the same screen again with its state changed: focus stays on the same element
export function refresh() { const t = stack.at(-1); if (!t) return; const k = focused()?.dataset.f; t.h?.close?.(); mount(false, k); }
export function pop() { stack.pop()?.h?.close?.(); mount(true); }
export function back() {
  const t = stack.at(-1);
  if (!t || screens[t.id].back === false) return;
  if (t.h.back) t.h.back(); else pop();
}
// a fresh stack: reset('menu', 'solo-mode') opens solo-mode with the menu under it; reset() closes the menus
export function reset(...ids) { leave(); stack.length = 0; stack.push(...ids.map((id) => ({ id, props: {} }))); mount(true); }

// --- focus: arrows go to the nearest element that way, Tab to the next group, the mouse moves the same focus ---
function move(dx, dy) {
  const cur = focused(), list = items();
  if (!cur) return list[0]?.focus();
  const to = byKey(cur.dataset[dx ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up']); // a screen can name a neighbour
  if (to) return focus(to);
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bs = Infinity;
  for (const el of list) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect(), x = b.left + b.width / 2 - ax, y = b.top + b.height / 2 - ay;
    const along = dx ? x * dx : y * dy, across = Math.abs(dx ? y : x);
    if (along < 1 || across > along * 3) continue; // behind, or far more sideways than ahead
    const s = along + across * 2;
    if (s < bs) { bs = s; best = el; }
  }
  best?.focus({ preventScroll: true });
}
function tab(d) {
  const groups = [...layer().querySelectorAll('[data-group]')].filter((g) => g.querySelector(FOCUS));
  if (groups.length < 2) { const l = items(); return l[(l.indexOf(focused()) + d + l.length) % l.length]?.focus(); }
  const g = groups[(groups.findIndex((x) => x.contains(focused())) + d + groups.length) % groups.length];
  focus(g.querySelector('[aria-selected="true"], [aria-pressed="true"], [data-first]') || g.querySelector(FOCUS));
}
// The mouse takes the focus when it moves, not when a screen is redrawn under a pointer at rest (the browser sends a mouseover then too).
let mx = -1, my = -1;
stage.addEventListener('mousemove', (e) => {
  if (e.screenX === mx && e.screenY === my) return;
  mx = e.screenX; my = e.screenY;
  const el = e.target.closest(FOCUS);
  if (el && el !== document.activeElement && layer().contains(el)) el.focus({ preventScroll: true });
});
stage.addEventListener('click', (e) => {
  const el = e.target.closest('[data-f]');
  if (!el || el.disabled || !layer().contains(el)) return;
  (modalEl.firstElementChild ? modalActs : stack.at(-1)?.h.acts)?.[el.dataset.f]?.(el, e);
});
// The one keydown of the menus (game.js routes it here while a screen is open). Returns nothing; handled keys are kept from the browser.
export function key(e) {
  const t = stack.at(-1), a = focused(), typing = a?.tagName === 'INPUT';
  const done = () => e.preventDefault();
  if (!modalEl.firstElementChild && t.h.keys?.(e)) return done();
  if (a?.onkey?.(e)) return done(); // a widget's own keys (slider: ← →)
  const arrow = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.code];
  if (arrow) { if (typing && arrow[0] && !a.dataset.nocaret) return; done(); return move(...arrow); } // in a field ← → move the caret (the room code shows none)
  if (e.code === 'Tab') { done(); return tab(e.shiftKey ? -1 : 1); }
  if (e.code === 'Escape' || (e.code === 'Backspace' && !typing)) { // Backspace: fullscreen takes Escape
    done();
    if (e.repeat) return;
    return modalEl.firstElementChild ? modalActs.cancel?.() : back();
  }
  if (e.code === 'Enter' || e.code === 'NumpadEnter' || (e.code === 'Space' && !typing)) {
    done();
    if (!e.repeat && a && a.tagName !== 'INPUT') a.click();
    return;
  }
  if (!typing && !e.repeat) onKey(e);
}

// --- messages -----------------------------------------------------------------
const ICON = { wait: '◌', ok: '✓', warn: '!', error: '✕' };
// ms 0: stays until the next toast() or clearToasts()
export function toast(kind, text, ms = 3000) {
  clearToasts(true);
  const el = document.createElement('div');
  el.className = `bs-toast bs-toast--${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.innerHTML = `<b>${ICON[kind]}</b> ${esc(text)}`;
  if (!ms) el.dataset.sticky = 1;
  toastsEl.append(el);
  if (ms) setTimeout(() => el.remove(), ms);
}
export function clearToasts(stickyOnly) { for (const el of [...toastsEl.children]) if (!stickyOnly || el.dataset.sticky) el.remove(); }

// buttons: [{ label, run, primary, danger, cancel }]; the first one has the focus, Escape runs the `cancel` one
let modalActs = {};
export function modal({ title, text, note = '', buttons, danger = true }) {
  const keep = focused()?.dataset.f;
  const shut = () => { modalEl.textContent = ''; modalActs = {}; focus(keep); };
  modalActs = Object.fromEntries(buttons.map((b, i) => ['m' + i, () => { shut(); b.run?.(); }]));
  const c = buttons.findIndex((b) => b.cancel);
  if (c >= 0) modalActs.cancel = modalActs['m' + c];
  modalEl.innerHTML = `<div><div class="bs-modal-veil"></div><div class="bs-modal bs-panel${danger ? ' bs-panel--danger' : ''}" role="alertdialog"><h2>${esc(title)}</h2><p>${esc(text)}</p>` +
    `<div>${buttons.map((b, i) => `<button class="bs-btn${b.danger ? ' bs-btn--danger' : ''}" data-f="m${i}">${esc(b.label)}</button>`).join('')}</div>${note && `<p class="bs-dim">${esc(note)}</p>`}</div></div>`;
  focus('m0');
  return shut;
}

// --- key labels: the letter on the player's own keyboard -----------------------------
const NAMES = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: tk('SPACE'), Escape: tk('ESC'), Enter: tk('ENTER'), Tab: tk('TAB'), Backspace: '⌫',
  ShiftLeft: tk('L SHIFT'), ShiftRight: tk('R SHIFT'), ControlLeft: tk('L CTRL'), ControlRight: tk('R CTRL'), AltLeft: tk('L ALT'), AltRight: tk('R ALT') };
let layout = null; // Chromium only; elsewhere: the event.key seen when the key was bound, else its QWERTY name
navigator.keyboard?.getLayoutMap?.().then((m) => { layout = m; onChange(); refresh(); }).catch(() => {});
export function keyLabel(code) {
  if (NAMES[code]) return tr(NAMES[code]);
  if (/^Digit\d$/.test(code)) return code[5]; // the digit printed on the key, not AZERTY's unshifted & é " '
  const l = layout?.get(code) ?? store.keyNames[code];
  return (l && l.trim() ? l : code.replace(/^(Key|Digit)/, '').replace(/^Numpad/, 'NUM ')).toUpperCase();
}
// the code of the key that types `ch` on this keyboard, when the browser tells
export const codeFor = (ch) => { for (const [code, k] of layout || []) if (k === ch) return code; return null; };
export const hasLayout = () => !!layout;
export const layoutName = () => (!layout ? '' : layout.get('KeyQ') === 'a' ? 'AZERTY' : layout.get('KeyY') === 'z' ? 'QWERTZ' : layout.get('KeyQ') === 'q' ? 'QWERTY' : '');
