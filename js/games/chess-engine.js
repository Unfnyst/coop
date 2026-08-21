// ─── chess-engine.js ────────────────────────────────────────────────────
// Full legal chess: castling, en passant, promotion, check, checkmate,
// stalemate, the fifty-move rule and insufficient material.
//
// Squares are 0..63 with 0 = a8 and 63 = h1, so index = rank*8 + file where
// rank 0 is the top of the board as White sees it.
// Pieces are letters: uppercase = White, lowercase = Black.
//
// Verified with perft — see test/chess.test.js.

export const W = 'w', B = 'b';
export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const rank = i => i >> 3;
const file = i => i & 7;
const sq = (r, f) => r * 8 + f;
const onBoard = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;
const isWhite = p => p === p.toUpperCase();
export const sideOf = p => (isWhite(p) ? W : B);
const other = s => (s === W ? B : W);

const N_OFF = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const K_OFF = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const ROOK  = [[-1,0],[1,0],[0,-1],[0,1]];
const BISH  = [[-1,-1],[-1,1],[1,-1],[1,1]];

/* ── FEN ──────────────────────────────────────────────────────────────── */
export function fromFen(fen = START_FEN) {
  const [pos, turn, cast, ep, half, full] = fen.trim().split(/\s+/);
  const board = Array(64).fill(null);
  let i = 0;
  for (const ch of pos) {
    if (ch === '/') continue;
    if (ch >= '1' && ch <= '8') i += +ch;
    else board[i++] = ch;
  }
  return {
    board, turn,
    castling: { K: cast.includes('K'), Q: cast.includes('Q'),
                k: cast.includes('k'), q: cast.includes('q') },
    ep: !ep || ep === '-' ? null : sq(8 - +ep[1], ep.charCodeAt(0) - 97),
    half: +(half ?? 0), full: +(full ?? 1),
  };
}

export const squareName = i => 'abcdefgh'[file(i)] + (8 - rank(i));

/** Position identity for threefold repetition — everything but the clocks. */
export function posKey(s) {
  const c = (s.castling.K ? 'K' : '') + (s.castling.Q ? 'Q' : '')
          + (s.castling.k ? 'k' : '') + (s.castling.q ? 'q' : '');
  return s.board.map(p => p || '.').join('') + s.turn + (c || '-') + (s.ep ?? '-');
}

/* ── attacks ──────────────────────────────────────────────────────────── */
/** Is `target` attacked by any piece of side `by`? */
export function attacked(board, target, by) {
  const r0 = rank(target), f0 = file(target);

  // A `by` pawn that attacks this square sits one rank "behind" it.
  const back = by === W ? 1 : -1;
  for (const df of [-1, 1]) {
    const r = r0 + back, f = f0 + df;
    if (!onBoard(r, f)) continue;
    const p = board[sq(r, f)];
    if (p && sideOf(p) === by && p.toLowerCase() === 'p') return true;
  }
  for (const [offs, kind] of [[N_OFF, 'n'], [K_OFF, 'k']]) {
    for (const [dr, df] of offs) {
      const r = r0 + dr, f = f0 + df;
      if (!onBoard(r, f)) continue;
      const p = board[sq(r, f)];
      if (p && sideOf(p) === by && p.toLowerCase() === kind) return true;
    }
  }
  for (const [dirs, kinds] of [[ROOK, 'rq'], [BISH, 'bq']]) {
    for (const [dr, df] of dirs) {
      let r = r0 + dr, f = f0 + df;
      while (onBoard(r, f)) {
        const p = board[sq(r, f)];
        if (p) {
          if (sideOf(p) === by && kinds.includes(p.toLowerCase())) return true;
          break;
        }
        r += dr; f += df;
      }
    }
  }
  return false;
}

export function kingSquare(board, side) {
  const k = side === W ? 'K' : 'k';
  return board.indexOf(k);
}

export const inCheck = (s, side = s.turn) =>
  attacked(s.board, kingSquare(s.board, side), other(side));

/* ── move generation ──────────────────────────────────────────────────── */
function pseudoMoves(s, side) {
  const { board } = s, out = [];
  const push = (from, to, extra) => out.push(extra ? { from, to, ...extra } : { from, to });

  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || sideOf(p) !== side) continue;
    const r = rank(i), f = file(i), kind = p.toLowerCase();

    if (kind === 'p') {
      const dir = side === W ? -1 : 1;
      const startRank = side === W ? 6 : 1;
      const lastRank  = side === W ? 0 : 7;
      const r1 = r + dir;

      if (onBoard(r1, f) && !board[sq(r1, f)]) {
        if (r1 === lastRank) for (const q of 'qrbn') push(i, sq(r1, f), { promo: q });
        else {
          push(i, sq(r1, f));
          const r2 = r + 2 * dir;
          if (r === startRank && !board[sq(r2, f)]) push(i, sq(r2, f), { double: true });
        }
      }
      for (const df of [-1, 1]) {
        const cf = f + df;
        if (!onBoard(r1, cf)) continue;
        const to = sq(r1, cf), q = board[to];
        if (q && sideOf(q) !== side) {
          if (r1 === lastRank) for (const pr of 'qrbn') push(i, to, { promo: pr });
          else push(i, to);
        } else if (!q && s.ep === to) {
          push(i, to, { ep: true });
        }
      }

    } else if (kind === 'n' || kind === 'k') {
      for (const [dr, df] of (kind === 'n' ? N_OFF : K_OFF)) {
        const rr = r + dr, ff = f + df;
        if (!onBoard(rr, ff)) continue;
        const to = sq(rr, ff), q = board[to];
        if (!q || sideOf(q) !== side) push(i, to);
      }
      if (kind === 'k') {
        const home = side === W ? 60 : 4;
        const opp = other(side);
        const canK = side === W ? s.castling.K : s.castling.k;
        const canQ = side === W ? s.castling.Q : s.castling.q;
        if (i === home && (canK || canQ) && !attacked(board, home, opp)) {
          if (canK && !board[home + 1] && !board[home + 2]
              && !attacked(board, home + 1, opp) && !attacked(board, home + 2, opp))
            push(i, home + 2, { castle: 'k' });
          if (canQ && !board[home - 1] && !board[home - 2] && !board[home - 3]
              && !attacked(board, home - 1, opp) && !attacked(board, home - 2, opp))
            push(i, home - 2, { castle: 'q' });
        }
      }

    } else {
      const dirs = kind === 'r' ? ROOK : kind === 'b' ? BISH : [...ROOK, ...BISH];
      for (const [dr, df] of dirs) {
        let rr = r + dr, ff = f + df;
        while (onBoard(rr, ff)) {
          const to = sq(rr, ff), q = board[to];
          if (!q) push(i, to);
          else { if (sideOf(q) !== side) push(i, to); break; }
          rr += dr; ff += df;
        }
      }
    }
  }
  return out;
}

/** The board as it would look after `m` — no clocks, just for legality tests. */
function boardAfter(board, m, side) {
  const b = board.slice();
  const p = b[m.from];
  b[m.to] = m.promo ? (side === W ? m.promo.toUpperCase() : m.promo) : p;
  b[m.from] = null;
  if (m.ep) b[sq(rank(m.to) + (side === W ? 1 : -1), file(m.to))] = null;
  if (m.castle) {
    const home = side === W ? 60 : 4;
    if (m.castle === 'k') { b[home + 1] = b[home + 3]; b[home + 3] = null; }
    else                  { b[home - 1] = b[home - 4]; b[home - 4] = null; }
  }
  return b;
}

export function legalMoves(s) {
  const side = s.turn, out = [];
  for (const m of pseudoMoves(s, side)) {
    const b = boardAfter(s.board, m, side);
    if (!attacked(b, kingSquare(b, side), other(side))) out.push(m);
  }
  return out;
}

export function makeMove(s, m) {
  const side = s.turn;
  const piece = s.board[m.from];
  const captured = s.board[m.to] || m.ep;
  const board = boardAfter(s.board, m, side);
  const castling = { ...s.castling };

  if (piece.toLowerCase() === 'k') {
    if (side === W) { castling.K = castling.Q = false; }
    else            { castling.k = castling.q = false; }
  }
  // A rook leaving — or being captured on — its home square kills that right.
  if (m.from === 63 || m.to === 63) castling.K = false;
  if (m.from === 56 || m.to === 56) castling.Q = false;
  if (m.from === 7  || m.to === 7 ) castling.k = false;
  if (m.from === 0  || m.to === 0 ) castling.q = false;

  return {
    board,
    turn: other(side),
    castling,
    ep: m.double ? sq(rank(m.from) + (side === W ? -1 : 1), file(m.from)) : null,
    half: (piece.toLowerCase() === 'p' || captured) ? 0 : s.half + 1,
    full: s.full + (side === B ? 1 : 0),
  };
}

/** Find the legal move matching a from/to (+promotion), or null. */
export function findMove(s, from, to, promo) {
  return legalMoves(s).find(m =>
    m.from === from && m.to === to && (!m.promo || !promo || m.promo === promo)) || null;
}

/* ── endings ──────────────────────────────────────────────────────────── */
function insufficientMaterial(board) {
  const minors = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    const k = p.toLowerCase();
    if (k === 'k') continue;
    if (k === 'p' || k === 'r' || k === 'q') return false;
    minors.push({ k, side: sideOf(p), light: (rank(i) + file(i)) % 2 === 0 });
  }
  if (minors.length === 0) return true;                       // K v K
  if (minors.length === 1) return true;                       // K+minor v K
  if (minors.length === 2 && minors.every(m => m.k === 'b')
      && minors[0].side !== minors[1].side
      && minors[0].light === minors[1].light) return true;    // same-colour bishops
  return false;
}

/**
 * What's the position? `reps` is how many times this exact position has now
 * occurred (threefold is a draw), passed in by the caller that tracks history.
 */
export function status(s, reps = 1) {
  const moves = legalMoves(s);
  const checked = inCheck(s);
  if (!moves.length) {
    return checked
      ? { over: true, result: 'checkmate', winner: other(s.turn), moves, checked }
      : { over: true, result: 'stalemate', winner: null, moves, checked };
  }
  if (s.half >= 100)              return { over: true, result: 'fifty',      winner: null, moves, checked };
  if (reps >= 3)                  return { over: true, result: 'repetition', winner: null, moves, checked };
  if (insufficientMaterial(s.board)) return { over: true, result: 'material', winner: null, moves, checked };
  return { over: false, result: null, winner: null, moves, checked };
}

/* ── perft (test only) ────────────────────────────────────────────────── */
export function perft(s, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(s);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(makeMove(s, m), depth - 1);
  return n;
}
