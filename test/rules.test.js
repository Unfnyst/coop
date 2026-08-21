import * as C4 from '../js/games/connect4.js';
import * as DB from '../js/games/dotsboxes.js';
import * as BS from '../js/games/battleship.js';
import * as AG from '../js/games/anagrams.js';
import { WORDS, SEEDS } from '../js/games/words.js';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  <' + extra + '>' : '')); }
};
const section = s => console.log('\n' + s);

/* ── Connect 4 ─────────────────────────────────────────────────────────── */
section('Connect 4');
{
  let s = C4.newState();
  ok('starts empty, seat 0 to move', s.board.every(v => v === -1) && s.turn === 0);

  ok('seat 1 cannot move first', C4.applyDrop(s, 0, 1) === null);

  // horizontal win for seat 0: cols 0,1,2,3 bottom row
  let g = C4.newState();
  for (const [col, seat] of [[0,0],[0,1],[1,0],[1,1],[2,0],[2,1],[3,0]]) {
    const n = C4.applyDrop(g, col, seat);
    ok(`legal drop col ${col} seat ${seat}`, n !== null);
    g = n || g;
  }
  ok('horizontal four detected', g.winner === 0, 'winner=' + g.winner);
  ok('winning line is 4 cells', g.line.length === 4, 'len=' + g.line.length);
  ok('no moves after a win', C4.applyDrop(g, 5, 1) === null);

  // vertical win for seat 1
  let v = C4.newState();
  for (const [col, seat] of [[0,0],[1,1],[0,0],[1,1],[0,0],[1,1],[2,0],[1,1]]) {
    v = C4.applyDrop(v, col, seat) || v;
  }
  ok('vertical four detected', v.winner === 1, 'winner=' + v.winner);

  // diagonal win for seat 0  (build a staircase)
  let d = C4.newState();
  const seq = [[0,0],[1,1],[1,0],[2,1],[2,0],[3,1],[2,0],[3,1],[3,0],[6,1],[3,0]];
  for (const [col, seat] of seq) d = C4.applyDrop(d, col, seat) || d;
  ok('diagonal four detected', d.winner === 0, 'winner=' + d.winner);

  // column fills up and rejects
  let f = C4.newState();
  for (let k = 0; k < 6; k++) f = C4.applyDrop(f, 0, k % 2) || f;
  ok('column holds exactly 6', f.board.filter(x => x !== -1).length === 6);
  ok('full column rejects', C4.applyDrop(f, 0, f.turn) === null);
}

/* ── Dots & Boxes ──────────────────────────────────────────────────────── */
section('Dots & Boxes');
{
  let s = DB.newState();
  ok('16 boxes, all unowned', s.owner.length === 16 && s.owner.every(o => o === -1));

  // no box closed -> turn passes
  let a = DB.applyLine(s, 'h', 0, 0);
  ok('first line legal', a !== null);
  ok('turn passes when no box closes', a.turn === 1, 'turn=' + a.turn);
  ok('same line twice is rejected', DB.applyLine(a, 'h', 0, 1) === null);

  // close box (0,0): h0 (top), h4 (bottom), v0 (left), v1 (right)
  let b = DB.newState();
  b = DB.applyLine(b, 'h', 0, 0);   // seat0 -> turn 1
  b = DB.applyLine(b, 'h', 4, 1);   // seat1 -> turn 0
  b = DB.applyLine(b, 'v', 0, 0);   // seat0 -> turn 1
  const before = b.turn;
  b = DB.applyLine(b, 'v', 1, 1);   // seat1 closes the box
  ok('closing a box awards it', b.owner[0] === 1, 'owner=' + b.owner[0]);
  ok('closing a box scores', b.scores[1] === 1);
  ok('closing a box keeps your turn', b.turn === 1, 'turn=' + b.turn);

  // play a whole random game
  let g = DB.newState(), guard = 0;
  while (!DB.isOver(g) && guard++ < 500) {
    const moves = [];
    g.h.forEach((o, i) => o === -1 && moves.push(['h', i]));
    g.v.forEach((o, i) => o === -1 && moves.push(['v', i]));
    if (!moves.length) break;
    const [k, i] = moves[Math.floor(Math.random() * moves.length)];
    g = DB.applyLine(g, k, i, g.turn) || g;
  }
  ok('random game finishes', DB.isOver(g), 'guard=' + guard);
  ok('exactly 40 lines drawn', g.h.filter(o => o !== -1).length + g.v.filter(o => o !== -1).length === 40);
  ok('scores add up to 16', g.scores[0] + g.scores[1] === 16, g.scores.join('+'));
}

/* ── Battleship ────────────────────────────────────────────────────────── */
section('Battleship');
{
  const total = BS.FLEET.reduce((n, s) => n + s.len, 0);
  for (let t = 0; t < 300; t++) {
    const fleet = BS.randomFleet();
    if (fleet.length !== BS.FLEET.length) { ok('fleet size', false); break; }
    const cells = fleet.flatMap(s => s.cells);
    if (new Set(cells).size !== total) { ok('no overlapping ships', false, 'try ' + t); break; }
    if (cells.some(c => c < 0 || c >= 64)) { ok('all cells in bounds', false); break; }
    if (fleet.some(s => s.cells.length !== s.len)) { ok('ship lengths', false); break; }
    if (t === 299) {
      ok('300 random fleets: right count', true);
      ok('300 random fleets: never overlap', true);
      ok('300 random fleets: in bounds', true);
    }
  }
  ok('ship cannot hang off the right edge', BS.cellsFor(6, 0, 4, true) === null);
  ok('ship cannot hang off the bottom', BS.cellsFor(0, 6, 4, false) === null);
  ok('vertical ship spans rows', JSON.stringify(BS.cellsFor(0, 0, 3, false)) === '[0,8,16]');
  ok('horizontal ship spans cols', JSON.stringify(BS.cellsFor(0, 0, 3, true)) === '[0,1,2]');
}

/* ── Anagrams ──────────────────────────────────────────────────────────── */
section('Anagrams');
{
  const tray = ['C','A','T','S','E','R','N'];
  ok('word in tray accepted', AG.fitsTray('cats', tray));
  ok('letter not in tray rejected', !AG.fitsTray('dog', tray));
  ok('respects duplicate counts', !AG.fitsTray('cass', tray));
  ok('allows a real duplicate', AG.fitsTray('sea', ['S','E','A','A','X','Y','Z']));
  for (let i = 0; i < 50; i++) {
    const t = AG.makeTray();
    if (t.length !== 7) { ok('tray is always 7 letters', false, t.join('')); break; }
    if (i === 49) ok('tray is always 7 letters', true);
  }
  ok('word list is substantial', WORDS.size > 1500, 'size=' + WORDS.size);
  ok('common words present', ['cat','stone','rain','planet','the'].every(w => WORDS.has(w)));
  ok('seeds are all real-ish', SEEDS.length > 50);
  const shortSeeds = SEEDS.filter(s => s.length < 6);
  ok('seeds long enough to make a tray', shortSeeds.length === 0, shortSeeds.join(','));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
