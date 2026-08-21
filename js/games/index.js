// ─── games/index.js ─────────────────────────────────────────────────────
// The lobby only needs the name + blurb, so game code is loaded lazily —
// you don't download Battleship to play Connect 4.
//
// To add a game: drop a file in this folder and add a line here.

export const GAMES = [
  { id: 'connect4',   name: 'Connect 4',    emoji: '🔴', blurb: 'Four in a row, any direction.' },
  { id: 'battleship', name: 'Battleship',   emoji: '🚢', blurb: 'Hide your fleet, sink theirs.' },
  { id: 'dotsboxes',  name: 'Dots & Boxes', emoji: '🟦', blurb: 'Close a box, go again.' },
  { id: 'anagrams',   name: 'Anagrams',     emoji: '🔤', blurb: '90 seconds. Most words wins.' },
  { id: 'chess',      name: 'Chess',        emoji: '♟️', blurb: 'The real thing. Full rules.' },
];

export const byId = id => GAMES.find(g => g.id === id);

const cache = new Map();
export async function loadGame(id) {
  if (!cache.has(id)) cache.set(id, (await import(`./${id}.js`)).default);
  return cache.get(id);
}
