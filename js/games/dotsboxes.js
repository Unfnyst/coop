// ─── Dots & Boxes ───────────────────────────────────────────────────────
// 5×5 dots = 16 boxes. Draw a line between two dots; close a box and you
// keep your turn (that's where the big chains come from).

import { el, styleOnce, sfx, seatColor } from '../kit.js';

const N = 4;                    // boxes per side
const DOTS = N + 1;
const H_COUNT = DOTS * N;       // horizontal edges
const V_COUNT = N * DOTS;       // vertical edges

export function newState() {
  return {
    h: Array(H_COUNT).fill(-1),
    v: Array(V_COUNT).fill(-1),
    owner: Array(N * N).fill(-1),
    turn: 0, scores: [0, 0], last: null, claimed: [],
  };
}

export const boxEdges = (r, c) => ({
  top: r * N + c, bottom: (r + 1) * N + c,          // into h
  left: r * DOTS + c, right: r * DOTS + c + 1,      // into v
});

const boxesTouching = (kind, i) => {
  if (kind === 'h') {
    const r = Math.floor(i / N), c = i % N;
    return [[r - 1, c], [r, c]].filter(([br]) => br >= 0 && br < N);
  }
  const r = Math.floor(i / DOTS), c = i % DOTS;
  return [[r, c - 1], [r, c]].filter(([, bc]) => bc >= 0 && bc < N);
};

export function applyLine(s, kind, i, seat) {
  if (s.turn !== seat) return null;
  if (s[kind][i] !== -1) return null;

  const next = {
    ...s,
    h: s.h.slice(), v: s.v.slice(), owner: s.owner.slice(),
    scores: s.scores.slice(), last: { kind, i }, claimed: [],
  };
  next[kind][i] = seat;

  for (const [br, bc] of boxesTouching(kind, i)) {
    const b = br * N + bc;
    if (next.owner[b] !== -1) continue;
    const e = boxEdges(br, bc);
    const closed = next.h[e.top] !== -1 && next.h[e.bottom] !== -1
                && next.v[e.left] !== -1 && next.v[e.right] !== -1;
    if (closed) { next.owner[b] = seat; next.scores[seat]++; next.claimed.push(b); }
  }

  // Closing a box means you go again.
  if (!next.claimed.length) next.turn = 1 - seat;
  return next;
}

export const isOver = s => s.owner.every(o => o !== -1);

export default {
  id: 'dotsboxes',

  mount(ctx) {
    styleOnce('css-dotsboxes', CSS);

    let state = null, ended = false;
    const scorebar = el('div.scorebar');
    const grid = el('div.db');
    ctx.root.append(
      scorebar, grid,
      el('p.tiny', {}, 'Tap the gap between two dots. Close a box and you go again.'),
    );

    const seatOf = id => ctx.players.find(p => p.id === id)?.seat ?? -1;
    const push = () => ctx.send('state', { state });

    if (ctx.isHost) { state = newState(); push(); }
    else ctx.send('sync', {});

    ctx.on('sync', () => { if (ctx.isHost && state) push(); });

    ctx.on('line', (d, msg) => {
      if (!ctx.isHost) return;
      const next = applyLine(state, d.kind, d.i, seatOf(msg.from));
      if (next) { state = next; push(); }
    });

    ctx.on('state', d => {
      const had = state?.owner.filter(o => o !== -1).length ?? 0;
      state = d.state;
      const now = state.owner.filter(o => o !== -1).length;
      if (state.last) (now > had ? sfx.good : sfx.tap)();
      render();
    });

    /* ── drawing ───────────────────────────────────────────────────────── */
    function edge(kind, i, myTurn) {
      const owner = state[kind][i];
      const drawn = owner !== -1;
      const isLast = state.last && state.last.kind === kind && state.last.i === i;
      return el(`div.e.${kind}` + (drawn ? '.on' : '') + (isLast ? '.pop' : '')
                + (!drawn && myTurn ? '.hot' : ''), {
        onclick: () => {
          if (!myTurn) { sfx.bad(); return; }
          if (drawn) return;
          ctx.send('line', { kind, i });
        },
      }, el('i', { style: drawn ? { background: seatColor(owner) } : {} }));
    }

    function render() {
      if (!state) return;
      const mySeat = ctx.seat;
      const myTurn = !isOver(state) && state.turn === mySeat;

      scorebar.replaceChildren(...ctx.players.slice(0, 2).map(p => el(
        'div.score' + (!isOver(state) && state.turn === p.seat ? '.turn' : ''), {},
        el('span.dot', { style: { background: seatColor(p.seat) } }),
        el('span.nm', {}, p.id === ctx.me.id ? 'You' : p.name),
        el('span.n', { style: { color: seatColor(p.seat) } }, String(state.scores[p.seat] ?? 0)),
      )));

      const cells = [];
      for (let row = 0; row < DOTS * 2 - 1; row++) {
        for (let col = 0; col < DOTS * 2 - 1; col++) {
          const r = row >> 1, c = col >> 1;
          if (row % 2 === 0 && col % 2 === 0)      cells.push(el('div.dot'));
          else if (row % 2 === 0)                  cells.push(edge('h', r * N + c, myTurn));
          else if (col % 2 === 0)                  cells.push(edge('v', r * DOTS + c, myTurn));
          else {
            const o = state.owner[r * N + c];
            cells.push(el('div.box' + (o !== -1 ? '.on' : '') + (state.claimed.includes(r * N + c) ? '.pop' : ''),
              { style: o !== -1 ? { background: seatColor(o) + '33', color: seatColor(o) } : {} },
              o !== -1 ? (ctx.players.find(p => p.seat === o)?.name || '?')[0].toUpperCase() : ''));
          }
        }
      }
      grid.replaceChildren(...cells);

      if (!isOver(state)) {
        ctx.status(myTurn ? 'Your turn' : `${ctx.players.find(p => p.seat === state.turn)?.name || '…'}'s turn`);
      } else {
        const [a, b] = state.scores;
        const mine = state.scores[mySeat], theirs = state.scores[1 - mySeat];
        ctx.status(a === b ? 'Draw' : mine > theirs ? 'You win!' : 'You lost');
        if (!ended) {
          ended = true;
          ctx.finish(a === b
            ? { won: null, text: `Dead even, ${a}–${b}`, emoji: '🤝' }
            : { won: mine > theirs, text: `${mine}–${theirs}` });
        }
      }
    }

    render();
  },
};

const CSS = `
.db{display:grid;
  grid-template-columns:repeat(${N},14px 1fr) 14px;
  grid-template-rows:repeat(${N},14px 1fr) 14px;
  gap:0;width:100%;max-width:380px;aspect-ratio:1;
  background:linear-gradient(160deg,#232634,#1b1d27);border:2px solid #2e3242;
  border-radius:18px;padding:12px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.db .dot{width:14px;height:14px;display:grid;place-items:center}
.db .dot::after{content:"";width:7px;height:7px;border-radius:50%;background:#5b6178}
.db .e{display:grid;place-items:center;cursor:default}
.db .e i{display:block;background:#2a2e3c;border-radius:99px;transition:background .15s}
.db .e.h i{width:78%;height:5px}
.db .e.v i{height:78%;width:5px}
.db .e.hot{cursor:pointer}
.db .e.hot:hover i{background:rgba(255,209,102,.75)}
.db .e.on i{box-shadow:0 0 8px rgba(0,0,0,.4)}
.db .e.pop i{animation:dbpop .3s cubic-bezier(.3,1.7,.5,1)}
@keyframes dbpop{from{transform:scale(.2)}to{transform:scale(1)}}
.db .box{display:grid;place-items:center;font-weight:800;font-size:15px;
  border-radius:6px;margin:2px}
.db .box.pop{animation:dbbox .35s cubic-bezier(.3,1.6,.5,1)}
@keyframes dbbox{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
`;
