// ─── Anagrams ───────────────────────────────────────────────────────────
// Same 7 letters, 90 seconds, most points wins. Your words stay hidden until
// the timer runs out — the other player only sees how many you've found.

import { el, styleOnce, sfx, seatColor, toast, confetti } from '../kit.js';
import { SEEDS, isWord } from './words.js';

const SECONDS = 90;
const POINTS = { 3: 100, 4: 400, 5: 800, 6: 1400, 7: 2000 };
const scoreOf = w => POINTS[w.length] || 2000 + (w.length - 7) * 600;

const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export function makeTray() {
  const seed = SEEDS[Math.floor(Math.random() * SEEDS.length)];
  const letters = shuffle(seed.toUpperCase().split(''));
  while (letters.length < 7) letters.push('AEIORSTLN'[Math.floor(Math.random() * 9)]);
  return letters.slice(0, 7);
}

/** Can `word` be spelled from `tray` (respecting duplicate letters)? */
export function fitsTray(word, tray) {
  const pool = [...tray];
  for (const ch of word.toUpperCase()) {
    const at = pool.indexOf(ch);
    if (at === -1) return false;
    pool.splice(at, 1);
  }
  return true;
}

export default {
  id: 'anagrams',

  mount(ctx) {
    styleOnce('css-anagrams', CSS);

    let tray = null, endsAt = 0, ticker = null, over = false;
    let found = [], myScore = 0;
    let theirCount = 0, theirScore = 0;
    const finals = new Map();       // player id -> {words, score}

    const oppName = () => ctx.players.find(p => p.id !== ctx.me.id)?.name || 'them';

    /* ── layout ────────────────────────────────────────────────────────── */
    const timerBar = el('div.ag-timer', {}, el('i'));
    const trayEl   = el('div.ag-tray');
    const form     = el('form.ag-form');
    const input    = el('input', { maxlength: 9, placeholder: 'type a word…',
                                   autocomplete: 'off', autocapitalize: 'characters',
                                   spellcheck: false });
    const oppLine  = el('p.tiny');
    const foundEl  = el('div.ag-found');
    const endPanel = el('div.ag-end', { hidden: true });

    form.append(input, el('button.btn.sm', { type: 'submit' }, 'Go'));
    ctx.root.append(timerBar, trayEl, form, oppLine, foundEl, endPanel);

    /* ── setup ─────────────────────────────────────────────────────────── */
    if (ctx.isHost) start(makeTray());
    else ctx.send('sync', {});

    ctx.on('sync', () => { if (ctx.isHost && tray) ctx.send('tray', { tray }); });
    ctx.on('tray', d => { if (!tray) start(d.tray); });

    ctx.on('prog', (d, msg) => {
      if (msg.from === ctx.me.id) return;
      theirCount = d.n; theirScore = d.score;
      renderOpp();
    });

    // Keyed by player id, never by seat: seat numbers are only meaningful
    // inside one game, and a result must stay attached to the person.
    ctx.on('final', (d, msg) => {
      finals.set(msg.from, { words: d.words, score: d.score });
      if (finals.size >= 2) reveal();
    });

    function start(t) {
      tray = t;
      if (ctx.isHost) ctx.send('tray', { tray });   // don't wait to be asked
      endsAt = Date.now() + SECONDS * 1000;
      renderTray(); renderOpp(); tick();
      ticker = setInterval(tick, 100);
      ctx.status('Find words!');
      setTimeout(() => input.focus(), 60);
    }

    ctx.onDestroy(() => clearInterval(ticker));

    function tick() {
      const left = Math.max(0, endsAt - Date.now());
      timerBar.firstChild.style.width = (left / (SECONDS * 1000) * 100) + '%';
      timerBar.classList.toggle('low', left < 15000);
      ctx.status(over ? 'Time!' : `${Math.ceil(left / 1000)}s · ${myScore}`);
      if (left <= 0 && !over) timeUp();
    }

    function timeUp() {
      over = true;
      clearInterval(ticker);
      input.disabled = true;
      form.querySelector('button').disabled = true;
      ctx.send('final', { words: found, score: myScore });
      oppLine.textContent = `Waiting for ${oppName()}…`;
      // If they vanish, show what we have rather than hanging forever.
      setTimeout(() => { if (endPanel.hidden) reveal(); }, 6000);
    }

    /* ── submitting ────────────────────────────────────────────────────── */
    let checking = false;
    form.onsubmit = async e => {
      e.preventDefault();
      const w = input.value.trim().toUpperCase();
      input.value = '';
      if (over || checking || !w) return;

      if (w.length < 3)                 return nope('3 letters minimum');
      if (found.includes(w))            return nope('Already got that one');
      if (!fitsTray(w, tray))           return nope('Not in those letters');

      checking = true;
      const verdict = await isWord(w);
      checking = false;
      if (verdict === false)     return nope('Not a word');
      if (verdict === 'unknown') return nope("Can't check that one offline");

      found.unshift(w);
      myScore += scoreOf(w);
      sfx.good();
      renderFound();
      ctx.send('prog', { n: found.length, score: myScore });
      input.focus();
    };

    function nope(msg) {
      sfx.bad();
      toast(msg);
      form.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' },
                    { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
                   { duration: 220 });
      input.focus();
    }

    /* ── drawing ───────────────────────────────────────────────────────── */
    function renderTray() {
      trayEl.replaceChildren(...tray.map(ch => el('button.ag-tile', {
        type: 'button',
        onclick: () => { if (!over) { input.value += ch; sfx.tap(); input.focus(); } },
      }, ch)),
        el('button.ag-tile.ag-act', { type: 'button', title: 'Backspace',
          onclick: () => { input.value = input.value.slice(0, -1); input.focus(); } }, '⌫'),
        el('button.ag-tile.ag-act', { type: 'button', title: 'Shuffle',
          onclick: () => { tray = shuffle(tray); renderTray(); sfx.tap(); } }, '🔀'));
    }

    function renderFound() {
      foundEl.replaceChildren(...found.map(w =>
        el('span.ag-word', {}, w, el('b', {}, String(scoreOf(w))))));
    }

    function renderOpp() {
      if (over) return;
      oppLine.textContent = theirCount
        ? `${oppName()}: ${theirCount} word${theirCount === 1 ? '' : 's'}`
        : `${oppName()} hasn't found anything yet`;
    }

    /* ── the reveal ────────────────────────────────────────────────────── */
    function reveal() {
      if (!endPanel.hidden) return;
      const opp = ctx.players.find(p => p.id !== ctx.me.id);
      const mySeat = ctx.seat, theirSeat = opp?.seat ?? (1 - mySeat);
      const mine  = finals.get(ctx.me.id) || { words: found, score: myScore };
      const their = finals.get(opp?.id)   || { words: [], score: theirScore };
      const won = mine.score > their.score, tie = mine.score === their.score;

      ctx.status(tie ? 'Tie!' : won ? 'You win!' : 'You lost');
      if (won) { sfx.win(); confetti(); } else if (!tie) sfx.lose();

      const column = (title, data, color, hideNames) => el('div.ag-col', {},
        el('div.ag-col-head', { style: { color } },
          el('span', {}, title), el('b', {}, String(data.score))),
        el('div.ag-list', {}, ...(data.words.length
          ? data.words.map(w => el('span.ag-word' + (hideNames ? '' : ''), {}, w))
          : [el('span.tiny', {}, 'nothing')])));

      endPanel.replaceChildren(
        el('h2.ag-verdict', {}, tie ? "It's a tie" : won ? 'You win!' : `${oppName()} wins`),
        el('div.ag-cols', {},
          column('You', mine, seatColor(mySeat)),
          column(oppName(), their, seatColor(theirSeat))),
        el('div.row', {},
          el('button.btn.sm', { type: 'button',
            onclick: () => ctx.rematch() }, 'Rematch'),
          el('button.btn.ghost.sm', { type: 'button',
            onclick: () => ctx.exit() }, 'Back to room')),
      );
      endPanel.hidden = false;
      oppLine.textContent = '';
      form.hidden = true; trayEl.hidden = true; foundEl.hidden = true;
    }

    renderFound();
  },
};

const CSS = `
.ag-timer{width:100%;max-width:420px;height:8px;border-radius:99px;background:#1b1d27;
  overflow:hidden;border:1px solid #2e3242}
.ag-timer i{display:block;height:100%;width:100%;background:#6bcb77;transition:width .1s linear}
.ag-timer.low i{background:#ff6b6b}
.ag-tray{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;max-width:420px}
.ag-tile{width:46px;height:52px;border-radius:11px;background:linear-gradient(180deg,#2a2e3e,#1e2130);
  border:1.5px solid #3a4055;color:#eef0f7;font-size:21px;font-weight:800;cursor:pointer;
  box-shadow:0 4px 0 #14161f;transition:transform .1s}
.ag-tile:active{transform:translateY(3px);box-shadow:0 1px 0 #14161f}
.ag-tile.ag-act{font-size:16px;background:#171a24}
.ag-form{display:flex;gap:8px;width:100%;max-width:420px}
.ag-form input{text-transform:uppercase;letter-spacing:.12em;font-weight:700;text-align:center}
.ag-found{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:460px}
.ag-word{background:#1b1d27;border:1px solid #2e3242;border-radius:9px;padding:4px 9px;
  font-size:13px;font-weight:700;letter-spacing:.04em;display:inline-flex;gap:6px;align-items:center;
  animation:agpop .2s cubic-bezier(.3,1.6,.5,1)}
.ag-word b{color:#ffd166;font-size:11px}
@keyframes agpop{from{transform:scale(.7);opacity:0}to{transform:scale(1);opacity:1}}
.ag-end{width:100%;max-width:460px;display:flex;flex-direction:column;gap:14px;align-items:center}
.ag-verdict{font-size:26px}
.ag-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
.ag-col{background:#1b1d27;border:1.5px solid #2e3242;border-radius:14px;padding:10px}
.ag-col-head{display:flex;justify-content:space-between;font-size:12px;text-transform:uppercase;
  letter-spacing:.08em;margin-bottom:8px}
.ag-col-head b{font-size:15px;color:#eef0f7}
.ag-list{display:flex;flex-wrap:wrap;gap:5px}
.ag-list .ag-word{font-size:12px;padding:3px 7px}
`;
