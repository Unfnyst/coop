// ─── Battleship ─────────────────────────────────────────────────────────
// This one is deliberately NOT host-authoritative. Nobody ever sends their
// ship positions over the wire — each player keeps their own fleet on their
// own device and only answers "hit" or "miss". So the host can't peek.

import { el, styleOnce, sfx, seatColor, toast } from '../kit.js';

const SIZE = 8;
export const FLEET = [
  { name: 'Battleship', len: 4 },
  { name: 'Cruiser',    len: 3 },
  { name: 'Sub',        len: 3 },
  { name: 'Destroyer',  len: 2 },
  { name: 'Patrol',     len: 2 },
];
const TOTAL_CELLS = FLEET.reduce((n, s) => n + s.len, 0);

const idx = (x, y) => y * SIZE + x;
const inBounds = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

export function cellsFor(x, y, len, horiz) {
  const out = [];
  for (let k = 0; k < len; k++) {
    const cx = horiz ? x + k : x, cy = horiz ? y : y + k;
    if (!inBounds(cx, cy)) return null;
    out.push(idx(cx, cy));
  }
  return out;
}

export function randomFleet() {
  for (let attempt = 0; attempt < 200; attempt++) {
    const taken = new Set(), ships = [];
    let ok = true;
    for (const spec of FLEET) {
      let placed = null;
      for (let t = 0; t < 300 && !placed; t++) {
        const horiz = Math.random() < 0.5;
        const x = Math.floor(Math.random() * SIZE), y = Math.floor(Math.random() * SIZE);
        const cells = cellsFor(x, y, spec.len, horiz);
        if (cells && cells.every(c => !taken.has(c))) placed = cells;
      }
      if (!placed) { ok = false; break; }
      placed.forEach(c => taken.add(c));
      ships.push({ ...spec, cells: placed, horiz: true });
    }
    if (ok) return ships;
  }
  return [];
}

export default {
  id: 'battleship',

  mount(ctx) {
    styleOnce('css-battleship', CSS);

    /* ── my private state ──────────────────────────────────────────────── */
    let ships = randomFleet();          // [{name,len,cells}]
    let incoming = new Map();           // index -> 'hit' | 'miss'  (shots at me)
    let shots = new Map();              // index -> 'hit' | 'miss'  (my shots)
    let sunkEnemy = new Set();          // enemy cells confirmed sunk
    let phase = 'place';
    let ready = new Set();              // seats that said "ready"
    let turn = 0;
    let picking = null;                 // ship index being re-placed
    let horiz = true;
    let ended = false;

    const mySeat = () => ctx.seat;
    const oppName = () => ctx.players.find(p => p.id !== ctx.me.id)?.name || 'them';

    const shipAt = i => ships.find(s => s.cells.includes(i));
    const myLive = () => TOTAL_CELLS - [...incoming.values()].filter(v => v === 'hit').length;

    /* ── layout ────────────────────────────────────────────────────────── */
    const enemyWrap = el('div.bs-side');
    const myWrap    = el('div.bs-side');
    const controls  = el('div.row');
    const fleetList = el('div.bs-fleet');
    ctx.root.append(enemyWrap, myWrap, fleetList, controls,
      el('p.tiny.bs-note', {}, ''));
    const note = ctx.root.querySelector('.bs-note');

    /* ── messages ──────────────────────────────────────────────────────── */
    ctx.on('ready', (d, msg) => {
      const seat = ctx.players.find(p => p.id === msg.from)?.seat;
      if (seat == null) return;
      ready.add(seat);
      // If they got ready after us, let them know we already were.
      if (msg.from !== ctx.me.id && ready.has(mySeat()) && phase === 'place') ctx.send('ready', {});
      // Only ever start once — a late "ready" echo must not reset whose turn it is.
      if (ready.size >= 2 && phase === 'place') { phase = 'play'; turn = 0; sfx.good(); }
      render();
    });

    ctx.on('fire', (d, msg) => {
      if (msg.from === ctx.me.id) return;           // my own echo
      const i = idx(d.x, d.y);
      const ship = shipAt(i);
      incoming.set(i, ship ? 'hit' : 'miss');

      const sunk = ship && ship.cells.every(c => incoming.get(c) === 'hit');
      const lost = myLive() <= 0;
      ctx.send('result', {
        x: d.x, y: d.y,
        hit: Boolean(ship),
        by: ctx.players.find(p => p.id === msg.from)?.seat ?? 0,
        sunkCells: sunk ? ship.cells : null,
        sunkName: sunk ? ship.name : null,
        lost,
      });
      (ship ? sfx.bad : sfx.tap)();
      render();
    });

    ctx.on('result', d => {
      const i = idx(d.x, d.y);
      const mine = d.by === mySeat();
      if (mine) {
        shots.set(i, d.hit ? 'hit' : 'miss');
        if (d.sunkCells) { d.sunkCells.forEach(c => sunkEnemy.add(c)); toast(`Sank their ${d.sunkName}!`); sfx.good(); }
        else (d.hit ? sfx.good : sfx.tap)();
      } else if (d.sunkName) {
        toast(`They sank your ${d.sunkName}`);
      }
      turn = d.hit ? d.by : 1 - d.by;       // a hit means you fire again
      if (d.lost) finish(mine);
      render();
    });

    function finish(iWon) {
      if (ended) return;
      ended = true; phase = 'done';
      render();
      // Let the last ship finish sinking before the card drops.
      ctx.finish({
        won: iWon,
        winner: iWon ? mySeat() : 1 - mySeat(),
        values: { [mySeat()]: `${myLive()}/${TOTAL_CELLS}` },
        text: iWon ? 'Their whole fleet is on the seabed.' : 'Every one of your ships is down.',
        delay: 2300,
      });
    }

    /* ── drawing ───────────────────────────────────────────────────────── */
    function enemyGrid() {
      const myTurn = phase === 'play' && turn === mySeat() && !ended;
      return el('div.bs-grid' + (myTurn ? '.live' : ''), {},
        ...Array.from({ length: SIZE * SIZE }, (_, i) => {
          const r = shots.get(i);
          return el('div.c' + (r ? '.' + r : '') + (sunkEnemy.has(i) ? '.sunk' : ''), {
            onclick: () => {
              if (!myTurn) { sfx.bad(); return; }
              if (shots.has(i)) return;
              ctx.send('fire', { x: i % SIZE, y: Math.floor(i / SIZE) });
            },
          }, r === 'hit' ? '✖' : r === 'miss' ? '·' : '');
        }));
    }

    function myGrid() {
      const placing = phase === 'place' && picking !== null;
      return el('div.bs-grid.mine' + (placing ? '.live' : ''), {},
        ...Array.from({ length: SIZE * SIZE }, (_, i) => {
          const ship = shipAt(i);
          const r = incoming.get(i);
          return el('div.c' + (ship ? '.ship' : '') + (r ? '.' + r : ''), {
            onclick: () => {
              if (phase !== 'place') return;
              if (picking === null) {
                if (!ship) return;
                picking = ships.indexOf(ship);          // pick it back up
                sfx.tap(); render(); return;
              }
              const spec = ships[picking];
              const cells = cellsFor(i % SIZE, Math.floor(i / SIZE), spec.len, horiz);
              const others = new Set(ships.flatMap((s, n) => n === picking ? [] : s.cells));
              if (!cells || cells.some(c => others.has(c))) { sfx.bad(); toast("Won't fit there"); return; }
              ships[picking] = { ...spec, cells };
              picking = null; sfx.good(); render();
            },
          }, r === 'hit' ? '✖' : r === 'miss' ? '·' : '');
        }));
    }

    function render() {
      const seat = mySeat();
      const iAmReady = ready.has(seat);

      /* enemy board — only during play */
      enemyWrap.replaceChildren();
      if (phase === 'play' || phase === 'done') {
        enemyWrap.append(
          el('div.bs-label', {}, `${oppName()}'s waters`),
          enemyGrid(),
        );
      }

      /* my board */
      myWrap.replaceChildren(
        el('div.bs-label', {},
          el('span', {}, 'Your fleet'),
          el('span.bs-count', { style: { color: seatColor(seat) } }, `${myLive()}/${TOTAL_CELLS}`)),
        myGrid(),
      );

      /* fleet list + controls, placement phase only */
      fleetList.replaceChildren();
      controls.replaceChildren();
      if (phase === 'place') {
        fleetList.append(...ships.map((s, n) => el('button.bs-ship' + (picking === n ? '.sel' : ''), {
          type: 'button', disabled: iAmReady,
          onclick: () => { picking = picking === n ? null : n; sfx.tap(); render(); },
        }, `${s.name} ${'▪'.repeat(s.len)}`)));

        if (!iAmReady) {
          controls.append(
            el('button.btn.ghost.sm', { type: 'button', onclick: () => {
              horiz = !horiz; sfx.tap(); toast(horiz ? 'Horizontal' : 'Vertical'); render();
            } }, horiz ? '↔ Horizontal' : '↕ Vertical'),
            el('button.btn.ghost.sm', { type: 'button', onclick: () => {
              ships = randomFleet(); picking = null; sfx.tap(); render();
            } }, '🎲 Shuffle'),
            el('button.btn.sm', { type: 'button', onclick: () => {
              if (picking !== null) { toast('Place that ship first'); return; }
              ctx.send('ready', {});
            } }, 'Ready'),
          );
        }
      }

      /* status + note */
      if (phase === 'place') {
        ctx.status(iAmReady ? `Waiting for ${oppName()}…` : 'Place your fleet', null);
        note.textContent = iAmReady
          ? 'Locked in. Sit tight.'
          : picking !== null
            ? `Tap a square to drop the ${ships[picking].name}. Use the rotate button to turn it.`
            : 'Shuffle until you like it, or tap a ship on your grid to move it.';
      } else if (phase === 'play') {
        const myTurn = turn === seat;
        ctx.status(myTurn ? 'Your turn — fire!' : `${oppName()} is aiming…`, turn);
        note.textContent = myTurn
          ? 'Tap a square in their waters. A hit means you go again.'
          : '';
      } else {
        note.textContent = '';
      }
    }

    render();
  },
};

const CSS = `
.bs-side{width:100%;max-width:360px;display:flex;flex-direction:column;gap:7px}
.bs-label{display:flex;justify-content:space-between;align-items:center;
  font-size:12px;letter-spacing:.09em;text-transform:uppercase;color:#959cb4}
.bs-count{font-weight:800;letter-spacing:0}
.bs-grid{display:grid;grid-template-columns:repeat(${SIZE},1fr);gap:3px;
  background:linear-gradient(160deg,#1e2432,#171a24);border:2px solid #2e3242;
  border-radius:14px;padding:7px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.bs-grid .c{aspect-ratio:1;border-radius:5px;background:#11141d;display:grid;place-items:center;
  font-size:15px;font-weight:800;color:#5b6178;transition:background .12s}
.bs-grid.live .c{cursor:pointer}
.bs-grid.live .c:hover{background:rgba(255,209,102,.2)}
.bs-grid .c.ship{background:#39405a}
.bs-grid .c.miss{color:#6a7085}
.bs-grid .c.hit{background:#7a2230;color:#ff9d9d}
.bs-grid .c.sunk{background:#4a1520;color:#ff6b6b}
.bs-grid.mine .c.hit{background:#7a2230;color:#ffd0d0}
.bs-fleet{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:360px}
.bs-ship{background:#1b1d27;border:1.5px solid #2e3242;border-radius:10px;
  padding:6px 10px;font-size:12.5px;cursor:pointer;color:#eef0f7;transition:border-color .15s}
.bs-ship.sel{border-color:#ffd166;background:#232634}
.bs-ship:disabled{opacity:.45;cursor:default}
`;
