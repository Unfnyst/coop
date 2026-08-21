// ─── kit.js ─────────────────────────────────────────────────────────────
// Small helpers every game gets to use. Nothing clever, just less typing.

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** el('div.board', {onclick: fn}, child, 'text') */
export function el(spec, props = {}, ...kids) {
  const [tag, ...classes] = spec.split('.');
  const n = document.createElement(tag || 'div');
  if (classes.length) n.className = classes.join(' ');
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style') Object.assign(n.style, v);
    else if (k in n && k !== 'list') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return n;
}

export const PLAYER_COLORS = ['#ff6b6b', '#4ecdc4'];
export const seatColor = seat => PLAYER_COLORS[seat] || '#9aa0b5';

export function toast(text, ms = 2200) {
  const wrap = $('#toasts');
  const t = el('div.toast', {}, text);
  wrap.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

/* ── sound ────────────────────────────────────────────────────────────── */
// Tiny synth so we don't ship any audio files.
let ac;
const audio = () => (ac ||= new (window.AudioContext || window.webkitAudioContext)());

export function beep(freq = 440, ms = 90, type = 'sine', gain = 0.06) {
  if (localStorage.getItem('coop.muted') === '1') return;
  try {
    const c = audio(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + ms / 1000);
  } catch {}
}
export const sfx = {
  tap:  () => beep(520, 60, 'triangle'),
  drop: () => beep(300, 110, 'sine'),
  good: () => { beep(660, 80, 'triangle'); setTimeout(() => beep(880, 120, 'triangle'), 80); },
  bad:  () => beep(150, 180, 'sawtooth', 0.05),
  win:  () => [0, 120, 240, 400].forEach((d, i) =>
          setTimeout(() => beep([523, 659, 784, 1047][i], 200, 'triangle'), d)),
  lose: () => [0, 150].forEach((d, i) =>
          setTimeout(() => beep([330, 220][i], 260, 'sine'), d)),
};

/* ── misc ─────────────────────────────────────────────────────────────── */
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

/** Deterministic RNG so both players can generate the same thing from a seed. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

export function confetti(host, count = 40) {
  const colors = ['#ffd166', '#ff6b6b', '#4ecdc4', '#6bcb77', '#c084fc'];
  for (let i = 0; i < count; i++) {
    const p = el('div', { style: {
      position: 'fixed', left: 50 + (Math.random() - 0.5) * 60 + '%', top: '40%',
      width: '8px', height: '12px', zIndex: 45, pointerEvents: 'none',
      background: colors[i % colors.length],
      borderRadius: '2px',
      transform: `rotate(${Math.random() * 360}deg)`,
    }});
    (host || document.body).append(p);
    const dx = (Math.random() - 0.5) * 400, dy = 300 + Math.random() * 400;
    p.animate([
      { transform: p.style.transform, opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 1200 + Math.random() * 800, easing: 'cubic-bezier(.2,.6,.4,1)' })
     .onfinish = () => p.remove();
  }
}

/** Inject a game's CSS once, so each game file can stay self-contained. */
export function styleOnce(id, css) {
  if (document.getElementById(id)) return;
  document.head.append(el('style', { id }, css));
}
