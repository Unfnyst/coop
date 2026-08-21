// Chess engine correctness.
//
// The heart of this is perft: walk every legal move to a given depth and
// count the leaf positions. The expected numbers are long-established for
// these standard positions, so a single wrong count means a real bug —
// a missed pin, a bad castling rule, en passant off by one, anything.

import {
  fromFen, legalMoves, makeMove, findMove, status, perft, squareName,
  START_FEN, inCheck,
} from '../js/games/chess-engine.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? (pass++, console.log('  ok   ' + n))
                                 : (fail++, console.log('  FAIL ' + n + (e ? '   <' + e + '>' : ''))); };

/* ── perft ────────────────────────────────────────────────────────────── */
const POSITIONS = [
  { name: 'start position', fen: START_FEN,
    counts: [20, 400, 8902, 197281] },
  { name: 'kiwipete',       fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    counts: [48, 2039, 97862] },
  { name: 'endgame w/ eps', fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    counts: [14, 191, 2812, 43238] },
  { name: 'promotion maze', fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    counts: [6, 264, 9467] },
  { name: 'tricky pins',    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    counts: [44, 1486, 62379] },
  { name: 'quiet middlegame', fen: 'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10',
    counts: [46, 2079, 89890] },
];

console.log('\nperft (legal move generation)');
for (const { name, fen, counts } of POSITIONS) {
  const s = fromFen(fen);
  counts.forEach((expected, i) => {
    const t0 = Date.now();
    const got = perft(s, i + 1);
    const ms = Date.now() - t0;
    ok(`${name} depth ${i + 1} = ${expected}`, got === expected,
       got === expected ? '' : `got ${got}`);
    if (ms > 400) console.log(`  ..   (${ms}ms)`);
  });
}

/* ── rules ────────────────────────────────────────────────────────────── */
console.log('\nrules');
{
  const s = fromFen(START_FEN);
  ok('white moves first', s.turn === 'w');
  ok('20 opening moves', legalMoves(s).length === 20);
  ok('nobody is in check at the start', !inCheck(s));
}
{
  // fool's mate: 1.f3 e5 2.g4 Qh4#
  const s = fromFen('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  const st = status(s);
  ok('checkmate is detected', st.over && st.result === 'checkmate', st.result);
  ok('the mating side wins', st.winner === 'b', String(st.winner));
  ok('no legal moves when mated', legalMoves(s).length === 0);
}
{
  const s = fromFen('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  const st = status(s);
  ok('stalemate is not a win', st.over && st.result === 'stalemate' && st.winner === null, st.result);
  ok('stalemated side is not in check', !st.checked);
}
{
  const s = fromFen('8/8/8/4k3/8/8/8/4K3 w - - 0 1');
  ok('king vs king is a draw', status(s).result === 'material');
  const b = fromFen('8/8/8/4k3/8/5N2/8/4K3 w - - 0 1');
  ok('king and knight vs king is a draw', status(b).result === 'material');
  const r = fromFen('8/8/8/4k3/8/5R2/8/4K3 w - - 0 1');
  ok('king and rook vs king is NOT a draw', status(r).over === false);
}
{
  const s = fromFen('4k3/8/8/8/8/8/8/4K2R w K - 99 60');
  ok('fifty-move rule ends it', status(makeMove(s, findMove(s, 63, 62))).result === 'fifty');
}
{
  const s = fromFen('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
  const castle = findMove(s, 60, 62);
  ok('kingside castling is offered', Boolean(castle) && castle.castle === 'k');
  const after = makeMove(s, castle);
  ok('castling moves the king to g1', after.board[62] === 'K');
  ok('castling moves the rook to f1', after.board[61] === 'R');
  ok('castling rights are spent', after.castling.K === false);
}
{
  // can't castle out of, through, or into check
  const thru = fromFen('4k3/8/8/8/8/8/5q2/4K2R w K - 0 1');
  ok('cannot castle through an attacked square', !findMove(thru, 60, 62));
  const outOf = fromFen('4k3/8/8/8/8/8/4q3/4K2R w K - 0 1');
  ok('cannot castle out of check', !findMove(outOf, 60, 62));
}
{
  // black pawn a4 takes en passant on b3
  const s = fromFen('7k/8/8/8/pP6/8/8/7K b - b3 0 1');
  const ep = findMove(s, 32, 41);
  ok('en passant is offered', Boolean(ep) && ep.ep === true);
  const after = makeMove(s, ep);
  ok('en passant removes the passed pawn', after.board[33] === null, String(after.board[33]));
  ok('en passant lands on the target square', after.board[41] === 'p');
}
{
  const s = fromFen('7k/P7/8/8/8/8/8/7K w - - 0 1');
  const promos = legalMoves(s).filter(m => m.from === 8);
  ok('a promoting pawn gets four choices', promos.length === 4, 'n=' + promos.length);
  const q = makeMove(s, promos.find(m => m.promo === 'q'));
  ok('promotion makes the chosen piece', q.board[0] === 'Q', String(q.board[0]));
}
{
  // knight on e2 is pinned to the king on e1 by the rook on e8
  const s = fromFen('4r2k/8/8/8/8/8/4N3/4K3 w - - 0 1');
  ok('a pinned piece cannot move', !legalMoves(s).some(m => m.from === 52), 'pin leaks');
  // ...but it may capture the pinner or move along the pin line
  const t = fromFen('4r2k/8/8/8/8/8/4R3/4K3 w - - 0 1');
  ok('a pinned rook can still move along the pin', legalMoves(t).some(m => m.from === 52 && m.to === 4));
}
{
  const s = fromFen(START_FEN);
  ok('square names read correctly', squareName(0) === 'a8' && squareName(63) === 'h1',
     squareName(0) + '/' + squareName(63));
}
{
  const s = fromFen(START_FEN);
  ok('threefold repetition is a draw', status(s, 3).result === 'repetition');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
