// ─── Connect 4 ──────────────────────────────────────────────────────────
// Host-authoritative: the host owns the board, everyone else asks to drop a
// disc and the host broadcasts the new board. That means the two screens can
// never disagree about whose turn it is.

import { el, styleOnce, sfx, seatColor } from '../kit.js';

const COLS = 7, ROWS = 6;
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

const idx = (r, c) => r * COLS + c;

export function newState() {
  return { board: Array(COLS * ROWS).fill(-1), turn: 0, winner: null, line: [], last: -1 };
}

/** The winning 4+ cells through `i`, or null. */
export function winLine(b, i) {
  const r0 = Math.floor(i / COLS), c0 = i % COLS, who = b[i];
  for (const [dr, dc] of DIRS) {
    const line = [i];
    for (const sign of [1, -1]) {
      let r = r0 + dr * sign, c = c0 + dc * sign;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && b[idx(r, c)] === who) {
        line.push(idx(r, c)); r += dr * sign; c += dc * sign;
      }
    }
    if (line.length >= 4) return line;
  }
  return null;
}

/** Returns the next state, or null if the move isn't legal. */
export function applyDrop(s, col, seat) {
  if (s.winner !== null || s.turn !== seat) return null;
  for (let r = ROWS - 1; r >= 0; r--) {
    const i = idx(r, col);
    if (s.board[i] !== -1) continue;
    const b = s.board.slice();
    b[i] = seat;
    const line = winLine(b, i);
    const full = b.every(v => v !== -1);
    return {
      board: b, turn: 1 - seat, last: i,
      winner: line ? seat : (full ? 'draw' : null),
      line: line || [],
    };
  }
  return null;   // column is full
}

export default {
  id: 'connect4',

  mount(ctx) {
    styleOnce('css-connect4', CSS);

    let state = null, ended = false;
    const scorebar = el('div.scorebar');
    const board = el('div.c4');
    ctx.root.append(
      scorebar, board,
      el('p.tiny', {}, 'Tap a column to drop a disc. Four in a row — any direction — wins.'),
    );

    const seatOf = id => ctx.players.find(p => p.id === id)?.seat ?? -1;
    const push = () => ctx.send('state', { state });

    if (ctx.isHost) { state = newState(); push(); }
    else ctx.send('sync', {});

    ctx.on('sync', () => { if (ctx.isHost && state) push(); });

    ctx.on('drop', (d, msg) => {
      if (!ctx.isHost) return;
      const next = applyDrop(state, d.col, seatOf(msg.from));
      if (next) { state = next; push(); }
    });

    ctx.on('state', d => {
      const first = !state;
      const prevLast = state?.last;
      state = d.state;
      if (!first && state.last !== prevLast && state.last !== -1) sfx.drop();
      render();
    });

    /* ── drawing ───────────────────────────────────────────────────────── */
    function render() {
      if (!state) return;
      const mySeat = ctx.seat;
      const myTurn = state.winner === null && state.turn === mySeat;

      scorebar.replaceChildren(...ctx.players.slice(0, 2).map(p => el(
        'div.score' + (state.winner === null && state.turn === p.seat ? '.turn' : ''), {},
        el('span.dot', { style: { background: seatColor(p.seat) } }),
        el('span.nm', {}, p.id === ctx.me.id ? 'You' : p.name),
      )));

      board.replaceChildren(...Array.from({ length: COLS }, (_, c) => {
        const open = state.board[idx(0, c)] === -1;
        return el('div.col' + (myTurn && open ? '.playable' : ''), {
          onclick: () => {
            if (!myTurn) { sfx.bad(); return; }
            if (!open) { sfx.bad(); return; }
            sfx.tap();
            ctx.send('drop', { col: c });
          },
        }, Array.from({ length: ROWS }, (_, r) => {
          const i = idx(r, c), v = state.board[i];
          return el('div.cell' + (v === -1 ? '' : '.f') + (state.line.includes(i) ? '.win' : '')
                    + (i === state.last ? '.new' : ''),
            { style: v === -1 ? {} : { background: seatColor(v) } });
        }));
      }));

      if (state.winner === null) {
        ctx.status(myTurn ? 'Your turn' : `${ctx.players.find(p => p.seat === state.turn)?.name || '…'}'s turn`);
      } else if (state.winner === 'draw') {
        ctx.status('Draw');
        if (!ended) { ended = true; ctx.finish({ won: null, text: "It's a draw", emoji: '🤝' }); }
      } else {
        const won = state.winner === mySeat;
        ctx.status(won ? 'You win!' : 'You lost');
        if (!ended) {
          ended = true;
          ctx.finish({ won, text: won ? 'Four in a row!' : 'They got four.' });
        }
      }
    }

    render();
  },
};

const CSS = `
.c4{display:grid;grid-template-columns:repeat(${COLS},1fr);gap:6px;width:100%;max-width:400px;
  background:linear-gradient(160deg,#232634,#1b1d27);border:2px solid #2e3242;
  border-radius:18px;padding:8px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.c4 .col{display:flex;flex-direction:column;gap:6px;border-radius:12px;padding:2px;
  transition:background .15s}
.c4 .col.playable{cursor:pointer}
.c4 .col.playable:hover{background:rgba(255,209,102,.13)}
.c4 .cell{aspect-ratio:1;border-radius:50%;background:#0e0f16;
  box-shadow:inset 0 3px 7px rgba(0,0,0,.65)}
.c4 .cell.f{box-shadow:inset 0 -3px 6px rgba(0,0,0,.35),0 2px 5px rgba(0,0,0,.4)}
.c4 .cell.new{animation:c4drop .28s cubic-bezier(.35,1.5,.5,1)}
.c4 .cell.win{outline:3px solid #ffd166;outline-offset:-3px;animation:c4pulse .9s ease-in-out infinite}
@keyframes c4drop{from{transform:translateY(-260%)}to{transform:none}}
@keyframes c4pulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.45)}}
`;
