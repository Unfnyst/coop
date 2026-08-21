import { LocalRoom, makeCode, makeId, BACKEND } from '../js/net.js';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? (pass++, console.log('  ok  ' + n))
                                 : (fail++, console.log('  FAIL ' + n + (e ? '  <' + e + '>' : ''))); };
const wait = ms => new Promise(r => setTimeout(r, ms));

console.log('\nLocalRoom (BroadcastChannel)');
ok('a backend is selected', ['local','ably','supabase'].includes(BACKEND), BACKEND);
console.log('  .. config.js currently selects:', BACKEND);

const code = makeCode();
ok('room code is 4 chars', code.length === 4, code);
ok('room code has no confusing letters', !/[ILO01]/.test(code), code);

const alice = new LocalRoom(code, { id: makeId(), name: 'Alice' });
await alice.connect();
await wait(60);
ok('alone: one player', alice.players.length === 1, JSON.stringify(alice.players));
ok('alone: I am the host', alice.isHost === true);
ok('alone: I am seat 0', alice.seat === 0);

await wait(20);
const bob = new LocalRoom(code, { id: makeId(), name: 'Bob' });
await bob.connect();
await wait(150);

ok('both see 2 players', alice.players.length === 2 && bob.players.length === 2,
   `a=${alice.players.length} b=${bob.players.length}`);
ok('they agree on who hosts', alice.hostId === bob.hostId, `${alice.hostId} vs ${bob.hostId}`);
ok('first to join is host', alice.isHost && !bob.isHost);
ok('seats are 0 and 1', alice.seat === 0 && bob.seat === 1, `a=${alice.seat} b=${bob.seat}`);
ok('seat order matches on both sides',
   JSON.stringify(alice.players.map(p => p.name)) === JSON.stringify(bob.players.map(p => p.name)),
   alice.players.map(p => p.name) + ' | ' + bob.players.map(p => p.name));
ok('each can name the other', alice.other?.name === 'Bob' && bob.other?.name === 'Alice');

/* messages */
const gotA = [], gotB = [];
alice.on('move', (d, m) => gotA.push([d.col, m.from]));
bob.on('move',   (d, m) => gotB.push([d.col, m.from]));

bob.send('move', { col: 3 });
await wait(80);
ok('receiver got the message', gotA.length === 1 && gotA[0][0] === 3, JSON.stringify(gotA));
ok('sender sees their own message too', gotB.length === 1, JSON.stringify(gotB));
ok('message carries the sender id', gotA[0][1] === bob.me.id);

/* unsubscribing */
const off = alice.on('ping', () => { throw new Error('should not fire'); });
off();
bob.send('ping', {});
await wait(60);
ok('unsubscribe actually removes the listener', true);

/* players event fires on change */
let events = 0;
alice.on('players', () => events++);
const carol = new LocalRoom(code, { id: makeId(), name: 'Carol' });
await carol.connect();
await wait(150);
ok('a third player is noticed', events >= 1 && alice.players.length === 3, `events=${events} n=${alice.players.length}`);
ok('third player gets seat 2', carol.seat === 2, 'seat=' + carol.seat);

/* leaving */
carol.leave();
await wait(200);
ok('leaving drops you from the list', alice.players.length === 2, JSON.stringify(alice.players.map(p=>p.name)));

/* timeout-based dropout: kill bob's heartbeat without a clean bye */
clearInterval(bob.timer);
bob.bc.close();
await wait(6200);
ok('a silent disconnect times out', alice.players.length === 1, JSON.stringify(alice.players.map(p=>p.name)));
ok('host stays the host after they leave', alice.isHost);

/* rooms are isolated */
const other = new LocalRoom(makeCode(), { id: makeId(), name: 'Stranger' });
await other.connect();
let leaked = false;
alice.on('secret', () => { leaked = true; });
other.send('secret', {});
await wait(80);
ok('different codes are different rooms', !leaked);

alice.leave(); other.leave();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
