// Procedural WebAudio sounds: no asset files, everything is shaped noise + oscillators.
// Browsers keep audio locked until a user gesture, so game.js calls unlock() on keydown;
// until then every sound is a silent no-op (also keeps headless QA quiet).
// Three gains: master → destination, with the music and the effects (sea ambience included) each on their own bus under it.
let ac = null, master = null, musicBus = null, fxBus = null, noiseBuf = null;
let vol = { master: 8, music: 6, fx: 9, muted: false }; // notches 0-10 (settings screen); muted keeps them
export function setAudio(a) {
  vol = a;
  if (!ac) return;
  master.gain.value = a.muted ? 0 : a.master / 10;
  musicBus.gain.value = a.music / 10;
  fxBus.gain.value = a.fx / 10;
}

export function unlock() {
  if (ac) return void ac.resume();
  ac = new AudioContext();
  master = ac.createGain(); musicBus = ac.createGain(); fxBus = ac.createGain();
  const comp = ac.createDynamicsCompressor(); // 6-gun volleys stack up; keep them from clipping
  musicBus.connect(master); fxBus.connect(master);
  master.connect(comp).connect(ac.destination);
  setAudio(vol);
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // ambient sea: looping low-passed noise, swelling slowly
  const sea = src(), lp = ac.createBiquadFilter(), g = ac.createGain(), lfo = ac.createOscillator(), depth = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 420;
  g.gain.value = 0.07; depth.gain.value = 0.04; lfo.frequency.value = 0.12;
  lfo.connect(depth).connect(g.gain);
  sea.connect(lp).connect(g).connect(fxBus);
  sea.start(); lfo.start();
  nextT = ac.currentTime + 0.2;
  setInterval(music, 100);
}
// music: original 4-bar loop in D minor, scheduled 0.3 s ahead on the audio clock.
// Pause suspends the AudioContext, so the clock and the loop freeze together.
const mid = (m) => 440 * 2 ** ((m - 69) / 12);
const MELODY = [62, 0, 65, 67, 69, 0, 67, 65, 64, 0, 60, 64, 62, 0, 0, 0, 62, 0, 65, 67, 69, 0, 72, 70, 69, 67, 65, 64, 62, 0, 0, 0];
const ROOTS = [50, 48, 46, 45]; // Dm C Bb A, one per bar
const STEP = 60 / 96 / 2; // eighth notes at 96 bpm
let combat = false, nextT = 0, stepN = 0;
export const setCombat = (on) => (combat = on);
function music() {
  if (nextT < ac.currentTime) nextT = ac.currentTime; // throttled background timer: skip, don't burst
  while (nextT < ac.currentTime + 0.3) {
    const delay = nextT - ac.currentTime, i = stepN % 32;
    if (MELODY[i]) tone(0.05, 0, { wave: 'square', f: mid(MELODY[i]), dur: STEP * 0.9, delay, bus: musicBus });
    if (i % 4 === 0) tone(0.16, 0, { wave: 'triangle', f: mid(ROOTS[i >> 3] + (i % 8 ? 7 : 0)), dur: STEP * 3.5, delay, bus: musicBus }); // root, then fifth
    if (combat && i % 2 === 0) noise(i % 4 ? 0.12 : 0.3, 0, { f: 180, f1: 50, dur: 0.18, delay, bus: musicBus }); // war drum in fights only
    nextT += STEP;
    stepN++;
  }
}
export const setPaused = (p) => ac && (p ? ac.suspend() : ac.resume());

function src() {
  const s = ac.createBufferSource();
  s.buffer = noiseBuf; s.loop = true;
  return s;
}
// chain: source → filter → gain envelope → panner → bus
function voice(node, vol, pan, t, attack, dur, bus) {
  const g = ac.createGain(), p = ac.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(g).connect(p).connect(bus);
}
function noise(vol, pan, { type = 'lowpass', f = 1000, f1 = f, q = 0.7, attack = 0.005, dur = 0.4, delay = 0, bus = fxBus }) {
  const t = ac.currentTime + delay, s = src(), flt = ac.createBiquadFilter();
  flt.type = type; flt.Q.value = q;
  flt.frequency.setValueAtTime(f, t);
  flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
  s.connect(flt);
  voice(flt, vol, pan, t, attack, dur, bus);
  s.start(t, Math.random() * 1.5);
  s.stop(t + dur + 0.05);
}
function tone(vol, pan, { wave = 'sine', f = 440, f1 = f, attack = 0.005, dur = 0.3, delay = 0, bus = fxBus }) {
  const t = ac.currentTime + delay, o = ac.createOscillator();
  o.type = wave;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  voice(o, vol, pan, t, attack, dur, bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

// v = 0..1 loudness (distance falloff), pan = -1 left .. 1 right (screen space)
export const sfx = {
  boom(v, pan = 0) {
    if (!ac || v <= 0) return;
    const r = 0.85 + Math.random() * 0.3;
    tone(0.9 * v, pan, { f: 95 * r, f1: 38, dur: 0.45 });
    noise(0.8 * v, pan, { f: 1800 * r, f1: 140, dur: 0.7 });
    noise(0.25 * v, pan, { type: 'bandpass', f: 600, f1: 200, q: 0.5, attack: 0.03, dur: 1.4 }); // rolling echo
  },
  splash(v, pan = 0) {
    if (!ac || v <= 0) return;
    noise(0.35 * v, pan, { type: 'highpass', f: 900, f1: 2500, attack: 0.02, dur: 0.5 });
    noise(0.3 * v, pan, { f: 500, f1: 150, attack: 0.01, dur: 0.35 });
  },
  hit(v, pan = 0) {
    if (!ac || v <= 0) return;
    noise(0.7 * v, pan, { type: 'bandpass', f: 1400, f1: 500, q: 1.5, dur: 0.18 }); // wood crack
    noise(0.5 * v, pan, { type: 'bandpass', f: 2600, f1: 900, q: 3, dur: 0.12, delay: 0.03 });
    tone(0.6 * v, pan, { wave: 'triangle', f: 120, f1: 55, dur: 0.3 });
  },
  sink(v, pan = 0) {
    if (!ac || v <= 0) return;
    noise(0.6 * v, pan, { f: 900, f1: 80, attack: 0.1, dur: 3 });
    tone(0.25 * v, pan, { wave: 'sawtooth', f: 160, f1: 60, attack: 0.3, dur: 2.2, delay: 0.2 }); // hull groan
    for (let i = 0; i < 6; i++) tone(0.12 * v, pan, { f: 300 + Math.random() * 500, f1: 900, dur: 0.08, delay: 0.6 + i * 0.35 }); // bubbles
  },
  coin() {
    if (!ac) return;
    tone(0.18, 0, { wave: 'square', f: 988, dur: 0.08 });
    tone(0.18, 0, { wave: 'square', f: 1319, dur: 0.25, delay: 0.08 });
  },
  bell() {
    if (!ac) return;
    for (const [f, a] of [[523, 0.35], [1046, 0.15], [1568, 0.08]]) {
      tone(a, 0, { f, dur: 2.2 });
      tone(a, 0, { f, dur: 2.2, delay: 0.45 });
    }
  },
  fanfare() {
    if (!ac) return;
    [523, 659, 784, 1046].forEach((f, i) => tone(0.16, 0, { wave: 'square', f, dur: i === 3 ? 0.6 : 0.14, delay: i * 0.13 }));
  },
};
