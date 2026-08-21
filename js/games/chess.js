// ─── Chess ──────────────────────────────────────────────────────────────
// Host-authoritative, like Connect 4: you send "I'd like to play e2-e4" and
// the host checks it against the rules and broadcasts the new position. All
// the actual chess lives in chess-engine.js.
//
// Seat 0 plays White, seat 1 plays Black. The board flips for Black.

import { el, fill, styleOnce, sfx, toast } from '../kit.js';
import {
  fromFen, legalMoves, makeMove, findMove, status, posKey, squareName,
  sideOf, START_FEN, W, B,
} from './chess-engine.js';

const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAMES = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };

const RESULT_TEXT = {
  stalemate:  'Stalemate — no legal moves, but no check.',
  fifty:      'Draw — fifty moves with no capture or pawn move.',
  repetition: 'Draw — the same position three times.',
  material:   'Draw — neither side has enough to mate.',
};

/** What each side has captured, worked out from what's missing off the board. */
function captured(board) {
  const have = { w: {}, b: {} };
  for (const p of board) {
    if (!p) continue;
    const s = sideOf(p), k = p.toLowerCase();
    have[s][k] = (have[s][k] || 0) + 1;
  }
  const taken = { w: [], b: [] };   // taken.w = black pieces White has captured
  for (const k of 'qrbnp') {
    for (const s of [W, B]) {
      const gone = START_COUNT[k] - (have[s][k] || 0);
      for (let i = 0; i < gone; i++) taken[s === W ? B : W].push(k);
    }
  }
  const score = s => taken[s].reduce((n, k) => n + VALUE[k], 0);
  return { taken, edge: score(W) - score(B) };
}

export default {
  id: 'chess',

  mount(ctx) {
    styleOnce('css-chess', CSS);

    const myColor = ctx.seat === 0 ? W : B;
    const flip = myColor === B;

    let state = null, last = null, reps = 1, ended = false;
    let selected = null, targets = [], pendingPromo = null;
    let prevPieceCount = null;

    // The host is the only one who tracks history, so it can call repetition.
    const seenKeys = new Map();

    const takenTop = el('div.ch-taken');
    const board    = el('div.ch-board');
    const takenBot = el('div.ch-taken');
    const promoBar = el('div.ch-promo', { hidden: true });
    const note     = el('p.tiny');
    ctx.root.append(takenTop, board, takenBot, promoBar, note);

    const seatOf = id => ctx.players.find(p => p.id === id)?.seat ?? -1;
    const colorOfSeat = s => (s === 0 ? W : B);
    const seatOfColor = c => (c === W ? 0 : 1);

    function push() {
      ctx.send('state', { state, last, reps });
    }

    if (ctx.isHost) {
      state = fromFen(START_FEN);
      seenKeys.set(posKey(state), 1);
      reps = 1;
      push();
    } else {
      ctx.send('sync', {});
    }

    ctx.on('sync', () => { if (ctx.isHost && state) push(); });

    ctx.on('move', (d, msg) => {
      if (!ctx.isHost || !state || ended) return;
      if (seatOfColor(state.turn) !== seatOf(msg.from)) return;   // not their turn
      const m = findMove(state, d.from, d.to, d.promo);
      if (!m) return;                                             // illegal — ignore
      state = makeMove(state, m);
      last = { from: m.from, to: m.to };
      const key = posKey(state);
      reps = (seenKeys.get(key) || 0) + 1;
      seenKeys.set(key, reps);
      push();
    });

    ctx.on('state', d => {
      const first = !state;
      state = d.state; last = d.last; reps = d.reps ?? 1;
      selected = null; targets = []; pendingPromo = null; promoBar.hidden = true;

      const count = state.board.filter(Boolean).length;
      if (!first && prevPieceCount !== null) {
        const st = status(state, reps);
        if (st.checked) sfx.check();
        else if (count < prevPieceCount) sfx.take();
        else sfx.move();
      }
      prevPieceCount = count;
      render();
    });

    /* ── interaction ───────────────────────────────────────────────────── */
    function selectableAt(i) {
      const p = state.board[i];
      return p && sideOf(p) === myColor;
    }

    function onSquare(i) {
      if (!state || ended) return;
      const st = status(state, reps);
      const myTurn = state.turn === myColor;
      if (!myTurn) { sfx.bad(); toast('Not your turn'); return; }

      if (pendingPromo) return;                       // waiting on the picker

      if (selected === null) {
        if (!selectableAt(i)) return;
        select(i);
        return;
      }
      if (i === selected) { selected = null; targets = []; render(); return; }

      const hits = targets.filter(m => m.to === i);
      if (!hits.length) {
        if (selectableAt(i)) select(i);
        else { selected = null; targets = []; render(); }
        return;
      }
      if (hits.length > 1 && hits[0].promo) {         // promotion — ask which
        pendingPromo = { from: selected, to: i };
        renderPromo();
        return;
      }
      sfx.tap();
      ctx.send('move', { from: selected, to: i, promo: hits[0].promo });
      selected = null; targets = [];
      render();
    }

    function select(i) {
      selected = i;
      targets = status(state, reps).moves.filter(m => m.from === i);
      sfx.tap();
      render();
    }

    /* ── drawing ───────────────────────────────────────────────────────── */
    function renderPromo() {
      promoBar.hidden = !pendingPromo;
      if (!pendingPromo) return;
      promoBar.replaceChildren(
        el('span.tiny', {}, 'Promote to:'),
        ...['q', 'r', 'b', 'n'].map(k => el('button.ch-promo-btn', {
          type: 'button', title: NAMES[k],
          onclick: () => {
            const { from, to } = pendingPromo;
            pendingPromo = null; promoBar.hidden = true;
            sfx.good();
            ctx.send('move', { from, to, promo: k });
            selected = null; targets = [];
            render();
          },
        }, el('span.pc.w', {}, GLYPH[k]))),
      );
    }

    function renderTaken(el_, list, edge) {
      fill(el_,
        ...list.map(k => el('span.pc.tiny-pc', {}, GLYPH[k])),
        edge ? el('span.ch-edge', {}, (edge > 0 ? '+' : '') + edge) : null,
      );
    }

    function render() {
      if (!state) return;
      const st = status(state, reps);
      const myTurn = state.turn === myColor && !st.over;
      const kingSq = st.checked ? state.board.indexOf(state.turn === W ? 'K' : 'k') : -1;
      const { taken, edge } = captured(state.board);

      const order = flip
        ? Array.from({ length: 64 }, (_, n) => 63 - n)
        : Array.from({ length: 64 }, (_, n) => n);

      board.replaceChildren(...order.map(i => {
        const r = i >> 3, f = i & 7;
        const p = state.board[i];
        const isTarget = targets.some(m => m.to === i);
        const cls = 'sq'
          + ((r + f) % 2 === 0 ? '.light' : '.dark')
          + (i === selected ? '.sel' : '')
          + (last && (i === last.from || i === last.to) ? '.last' : '')
          + (i === kingSq ? '.check' : '');
        return el('div.' + cls, { onclick: () => onSquare(i) },
          p ? el('span.pc.' + (sideOf(p) === W ? 'w' : 'b'), {}, GLYPH[p.toLowerCase()]) : null,
          isTarget ? el(p ? 'span.ring' : 'span.dot2') : null,
        );
      }));

      renderTaken(takenTop, flip ? taken[W] : taken[B], flip ? edge : -edge);
      renderTaken(takenBot, flip ? taken[B] : taken[W], flip ? -edge : edge);

      /* status + ending */
      if (!st.over) {
        const who = ctx.players.find(pl => pl.seat === seatOfColor(state.turn))?.name || '…';
        const label = (myTurn ? 'Your turn' : `${who}'s turn`) + (st.checked ? ' — check!' : '');
        ctx.status(label, seatOfColor(state.turn));
        note.textContent = myTurn
          ? (selected === null ? 'Tap a piece to see where it can go.' : 'Tap a highlighted square.')
          : '';
      } else {
        ctx.status(st.result === 'checkmate'
          ? (st.winner === myColor ? 'Checkmate — you win!' : 'Checkmate')
          : 'Draw', null);
        note.textContent = '';
        if (!ended) {
          ended = true;
          const iWon = st.winner === myColor;
          const loserName = ctx.players.find(pl => pl.seat === seatOfColor(state.turn))?.name || 'They';
          ctx.finish({
            won: st.winner === null ? null : iWon,
            winner: st.winner === null ? null : seatOfColor(st.winner),
            title: st.result === 'checkmate' ? (iWon ? 'Checkmate!' : 'Checkmate') : 'Draw',
            text: st.result === 'checkmate'
              ? (iWon ? `${loserName}'s king has nowhere to go.` : 'Your king has nowhere to go.')
              : RESULT_TEXT[st.result] || 'Drawn.',
            emoji: st.result === 'checkmate' ? (iWon ? '👑' : '💀') : '🤝',
            delay: 2400,       // leave the final position up for a moment
          });
        }
      }
    }

    render();
  },
};

const CSS = `
.ch-board{display:grid;grid-template-columns:repeat(8,1fr);width:100%;max-width:400px;
  aspect-ratio:1;border:2px solid #2e3242;border-radius:14px;overflow:hidden;
  box-shadow:0 10px 30px rgba(0,0,0,.45)}
.ch-board .sq{position:relative;display:grid;place-items:center;cursor:pointer;
  transition:background .15s}
.ch-board .light{background:#4b5270}
.ch-board .dark{background:#2b3040}
.ch-board .last{box-shadow:inset 0 0 0 100px rgba(255,209,102,.13)}
.ch-board .sel{box-shadow:inset 0 0 0 3px #ffd166}
.ch-board .check{box-shadow:inset 0 0 0 100px rgba(255,92,92,.34);animation:chCheck 1s ease-in-out infinite}
@keyframes chCheck{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35)}}
.pc{font-size:clamp(22px,7.2vw,34px);line-height:1;user-select:none;pointer-events:none;
  position:relative;z-index:2}
.pc.w{color:#f7f8fc;text-shadow:0 1px 0 #6a7189,0 -1px 0 #6a7189,1px 0 0 #6a7189,-1px 0 0 #6a7189,0 3px 5px rgba(0,0,0,.45)}
.pc.b{color:#171a24;text-shadow:0 1px 0 #767d95,0 -1px 0 #767d95,1px 0 0 #767d95,-1px 0 0 #767d95,0 3px 5px rgba(0,0,0,.4)}
.ch-board .dot2{position:absolute;width:26%;height:26%;border-radius:50%;
  background:rgba(255,209,102,.6);z-index:1;pointer-events:none}
.ch-board .ring{position:absolute;inset:8%;border-radius:50%;
  border:3.5px solid rgba(255,209,102,.75);z-index:1;pointer-events:none}
.ch-taken{display:flex;align-items:center;gap:1px;min-height:22px;width:100%;max-width:400px;
  flex-wrap:wrap}
.ch-taken .tiny-pc{font-size:17px;opacity:.85}
.ch-edge{margin-left:6px;font-size:12px;font-weight:800;color:#ffd166}
.ch-promo{display:flex;align-items:center;gap:8px;background:#1b1d27;border:1.5px solid #2e3242;
  border-radius:14px;padding:8px 12px}
.ch-promo-btn{background:#232634;border:1.5px solid #3a4055;border-radius:10px;
  width:44px;height:44px;display:grid;place-items:center;cursor:pointer;transition:border-color .15s}
.ch-promo-btn:hover{border-color:#ffd166}
.ch-promo-btn .pc{font-size:26px}
`;
