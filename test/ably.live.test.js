// Live end-to-end test against real Ably, with two players.
// Needs the SDK locally first:   npm i ably
// Then:                          npm run test:live
// Skips itself (exit 0) if config.js isn't on Ably or the SDK isn't installed.

import { BACKEND } from '../js/net.js';

if (BACKEND !== 'ably') {
  console.log(`\nSkipping live test — config.js is using "${BACKEND}", not ably.`);
  process.exit(0);
}
try {
  globalThis.__ABLY__ = (await import('ably')).default;
} catch {
  console.log('\nSkipping live test — run `npm i ably` first.');
  process.exit(0);
}

const { LocalRoom: _unused, AblyRoom, makeCode, makeId } = await import('../js/net.js');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? (pass++, console.log('  ok  ' + n))
                                 : (fail++, console.log('  FAIL ' + n + (e ? '  <' + e + '>' : ''))); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const room = (name) => new AblyRoom(code, { id: makeId(), name });

console.log('\nLive Ably test (real network, real key)');
const code = makeCode();
console.log('  .. room', code);

const alice = room('Alice');
const t0 = Date.now();
await alice.connect();
ok('connected to Ably', true, Date.now() - t0 + 'ms');
await wait(400);
ok('alone: 1 player, I host, seat 0',
   alice.players.length === 1 && alice.isHost && alice.seat === 0);

await wait(50);
const bob = room('Bob');
await bob.connect();
await wait(1200);

ok('both see 2 players', alice.players.length === 2 && bob.players.length === 2,
   `a=${alice.players.length} b=${bob.players.length}`);
ok('they agree who hosts', alice.hostId === bob.hostId);
ok('first to join is host', alice.isHost && !bob.isHost);
ok('seats are 0 and 1', alice.seat === 0 && bob.seat === 1);
ok('names arrived via presence',
   alice.other?.name === 'Bob' && bob.other?.name === 'Alice');

/* how fast is a real round trip? */
const rtt = await new Promise(res => {
  const sent = Date.now();
  const off = alice.on('g:ping', () => { off(); res(Date.now() - sent); });
  bob.send('g:ping', {});
});
ok('message crosses the wire', rtt > 0 && rtt < 3000, rtt + 'ms');
console.log('  .. real round trip: ' + rtt + 'ms');

/* a Connect 4 style exchange */
const moves = [];
alice.on('g:drop', (d, m) => moves.push({ col: d.col, from: m.from }));
bob.send('g:drop', { col: 3, _n: 1 });
await wait(800);
ok('host received the move', moves.length === 1 && moves[0].col === 3);
ok('move carries the sender id', moves[0]?.from === bob.me.id);

const states = [];
bob.on('g:state', d => states.push(d.state.turn));
alice.send('g:state', { state: { turn: 0 }, _n: 1 });
await wait(800);
ok('client received broadcast state', states.length === 1 && states[0] === 0);

/* echo parity with the local + supabase backends */
const echo = [];
alice.on('g:self', () => echo.push(1));
alice.send('g:self', {});
await wait(800);
ok('sender hears their own message', echo.length === 1);

/* leaving */
bob.leave();
await wait(1500);
ok('leaving removes them from presence', alice.players.length === 1);

/* isolation */
let leaked = false;
alice.on('g:secret', () => { leaked = true; });
const stranger = new AblyRoom(makeCode(), { id: makeId(), name: 'Stranger' });
await stranger.connect();
stranger.send('g:secret', {});
await wait(800);
ok('different codes are different channels', !leaked);

alice.leave(); stranger.leave();
console.log(`\n${pass} passed, ${fail} failed`);
setTimeout(() => process.exit(fail ? 1 : 0), 600);
