// ─── app.js ─────────────────────────────────────────────────────────────
// Screens, rooms, and the glue that hands a connected room to a game.

import { $, el, fill, toast, sfx, confetti, seatColor } from './kit.js';
import { createRoom, makeCode, makeId, IS_ONLINE } from './net.js';
import { mountChat } from './chat.js';
import { GAMES, byId, loadGame } from './games/index.js';

/* ── who am I ──────────────────────────────────────────────────────────── */
const me = {
  id: sessionStorage.getItem('coop.id') || makeId(),
  name: localStorage.getItem('coop.name') || '',
};
sessionStorage.setItem('coop.id', me.id);   // per-tab, so 2 tabs = 2 players

let room = null, chat = null, pick = GAMES[0].id, game = null, gameNonce = 0;

/* ── screens ───────────────────────────────────────────────────────────── */
const screens = { home: $('#s-home'), room: $('#s-room'), game: $('#s-game') };
function show(name) {
  for (const [k, s] of Object.entries(screens)) s.hidden = k !== name;
}

/* ── home ──────────────────────────────────────────────────────────────── */
const nameInput = $('#nameInput');
const codeInput = $('#codeInput');
nameInput.value = me.name;

$('#modeNote').innerHTML = IS_ONLINE
  ? 'Online — share your code with anyone, anywhere.'
  : '<b>Local mode.</b> Right now only tabs on this computer can play each other — '
  + 'open a second tab and join the same code. Add your keys to <code>config.js</code> '
  + 'to play over the internet.';

function currentName() {
  const n = nameInput.value.trim().slice(0, 12);
  if (!n) { nameInput.focus(); toast('Pick a name first'); return null; }
  me.name = n;
  localStorage.setItem('coop.name', n);
  return n;
}

$('#btnCreate').onclick = () => { if (currentName()) join(makeCode()); };

$('#joinForm').onsubmit = e => {
  e.preventDefault();
  const code = codeInput.value.trim().toUpperCase();
  if (code.length !== 4) { toast('Room codes are 4 letters'); return; }
  if (currentName()) join(code);
};
codeInput.oninput = () => { codeInput.value = codeInput.value.toUpperCase(); };

// Someone shared a ?room=ABCD link with us
const fromLink = new URLSearchParams(location.search).get('room');
if (fromLink) {
  codeInput.value = fromLink.toUpperCase().slice(0, 4);
  if (me.name) join(codeInput.value); else nameInput.focus();
}

/* ── joining ───────────────────────────────────────────────────────────── */
async function join(code) {
  const btn = $('#btnCreate');
  btn.disabled = true; btn.textContent = 'Connecting…';
  try {
    room = createRoom(code, me);
    await room.connect();
  } catch (err) {
    console.error(err);
    toast('Could not connect. Check config.js');
    btn.disabled = false; btn.textContent = 'Create a room';
    room = null;
    return;
  }
  btn.disabled = false; btn.textContent = 'Create a room';

  history.replaceState(null, '', `?room=${code}`);
  $('#roomCode').textContent = code;

  chat = mountChat(room);
  chat.system(`Room ${code} — say hi 👋`);

  if (!wireRoom()) return;    // turned away (room full) — stay on the home screen
  renderGameGrid();
  show('room');
}

function wireRoom() {
  const mine = room;                      // these handlers belong to this room
  const stale = () => room !== mine;      // ...and must go quiet once we leave

  room.on('players', players => {
    if (stale()) return;
    if (enforceRoomCap(players)) return;  // check before touching the DOM
    renderPlayers(players);
    updateStart();
    // Host re-announces the pick so a late joiner sees the same game selected.
    if (room.isHost) room.send('pick', { id: pick });

    // End the game if one of the two people actually playing disappears —
    // not merely because the headcount changed.
    if (game && !game.roster.every(r => players.some(p => p.id === r.id))) {
      chat?.system('Your opponent left.');
      toast('Opponent left');
      backToRoom();
    }
  });

  room.on('pick', d => {
    if (stale()) return;
    if (byId(d.id)) { pick = d.id; renderGameGrid(); }
  });

  room.on('start', async d => {
    if (stale() || !byId(d.id)) return;
    // The host says who is playing. Anyone else in the room sits this one out
    // rather than being silently mistaken for one of the players.
    const roster = d.roster?.length === 2 ? d.roster
                 : room.players.slice(0, 2).map(p => ({ id: p.id, name: p.name }));
    pick = d.id; gameNonce = d.n;
    if (!roster.some(p => p.id === me.id)) {
      toast(`${byId(d.id).name} is in progress`);
      return;
    }
    await openGame(d.id, d.n, roster);
  });

  room.on('exit', () => { if (!stale() && game) backToRoom(); });

  room.on('down', () => toast('Connection dropped'));

  // connect() emits its first players event before we could subscribe, so the
  // cap has to be checked once directly rather than only on later changes.
  if (enforceRoomCap()) return false;
  renderPlayers(room.players);
  updateStart();
  return true;
}

// A room only seats two. A third person is turned away rather than silently
// shifting everyone's seat numbers underneath a running game.
function enforceRoomCap(players = room.players) {
  if (players.findIndex(p => p.id === me.id) > 1) {
    toast('That room is full');
    leaveRoom();
    return true;
  }
  return false;
}

/* ── room screen ───────────────────────────────────────────────────────── */
function renderPlayers(players) {
  const list = $('#playerList');
  fill(list,
    ...players.map((p, i) => el('div.player', {},
      el('span.dot', { style: { background: ['#ff6b6b', '#4ecdc4'][i] || '#959cb4' } }),
      el('span.nm', {}, p.name),
      el('span.tags', {},
        p.id === room.hostId ? el('span.pill', {}, 'host') : null,
        p.id === me.id ? el('span.pill.you', {}, 'you') : null),
    )),
    players.length < 2 ? el('div.player.empty', {}, 'waiting for a friend…') : null,
  );
}

function renderGameGrid() {
  const grid = $('#gameGrid');
  grid.replaceChildren(...GAMES.map(g => {
    const card = el('button.game-card' + (g.id === pick ? '.sel' : ''), {
      type: 'button',
      onclick: () => {
        if (!room.isHost) { toast('Only the host picks the game'); return; }
        pick = g.id; sfx.tap(); renderGameGrid(); room.send('pick', { id: g.id });
      },
    },
      el('span.ge', {}, g.emoji),
      el('div.gn', {}, g.name),
      el('div.gb', {}, g.blurb));
    return card;
  }));
}

function updateStart() {
  const btn = $('#btnStart');
  const ready = room.players.length >= 2;
  btn.disabled = !ready || !room.isHost;
  btn.textContent = !ready ? 'Waiting for a friend…'
                  : room.isHost ? `Start ${byId(pick).name}`
                  : 'Waiting for the host…';
  $('#roomHint').textContent = ready
    ? (room.isHost ? '' : 'The host starts the game.')
    : (IS_ONLINE ? 'Share the code above 👆' : 'Open a second tab and join this code.');
}

$('#btnStart').onclick = () => {
  if (!room.isHost || room.players.length < 2) return;
  const roster = room.players.slice(0, 2).map(p => ({ id: p.id, name: p.name }));
  room.send('start', { id: pick, n: Date.now(), roster });
};

$('#codeCard').onclick = async () => {
  const url = `${location.origin}${location.pathname}?room=${room.code}`;
  try { await navigator.clipboard.writeText(url); }
  catch { prompt('Copy this link:', url); return; }
  const card = $('#codeCard');
  card.classList.add('copied');
  $('#copyHint').textContent = 'copied!';
  sfx.good();
  setTimeout(() => {
    card.classList.remove('copied');
    $('#copyHint').textContent = 'tap to copy invite link';
  }, 1600);
};

function leaveRoom() {
  destroyGame();
  chat?.destroy(); room?.leave(); room = null; chat = null;
  history.replaceState(null, '', location.pathname);
  show('home');
}
$('#btnLeaveRoom').onclick = leaveRoom;

/* ── running a game ────────────────────────────────────────────────────── */
async function openGame(id, nonce, roster) {
  destroyGame();
  const stage = $('#gameStage');
  stage.replaceChildren(el('p.tiny', {}, 'Loading…'));
  $('#gameOver').hidden = true;
  show('game');

  const mod = await loadGame(id);
  if (gameNonce !== nonce) return;          // a newer start won the race
  stage.replaceChildren();

  const offs = [];
  let lastTurn = null, finishTimer = 0;
  // Seats are frozen for the whole game. room.players changes whenever anyone
  // joins or leaves, so deriving seats from it live meant a third person in
  // the room — or a stale tab — could shift who counted as "the opponent".
  const seats = roster.map((p, i) => ({ ...p, seat: i }));
  const playing = new Set(seats.map(p => p.id));

  const ctx = {
    root: stage,
    room, me,
    seat: seats.findIndex(p => p.id === me.id),
    isHost: seats[0]?.id === me.id,
    players: seats,
    nonce,
    // Game messages are namespaced + nonce-stamped so a rematch never sees
    // stray packets from the previous round.
    send(type, data) { room.send(`g:${type}`, { ...data, _n: nonce }); },
    on(type, fn) {
      const off = room.on(`g:${type}`, (d, msg) => {
        if (d && d._n !== nonce) return;
        if (!playing.has(msg.from)) return;   // ignore anyone not in this game
        fn(d, msg);
      });
      offs.push(off);
      return off;
    },
    rematch() { room.send('start', { id, n: Date.now(), roster }); },
    exit()    { room.send('exit', {}); },
    // status(text) — top bar. Pass whose turn it is and the screen picks up a
    // soft wash of that player's colour, plus a chime when it flips to you.
    status(text, turnSeat) {
      const bar = $('#gameStatus');
      bar.replaceChildren(text?.nodeType ? text : document.createTextNode(text ?? ''));
      const glow = $('#turnGlow');
      if (turnSeat == null) { glow.classList.remove('on', 'mine'); lastTurn = null; return; }
      glow.style.setProperty('--turn', seatColor(turnSeat));
      glow.classList.add('on');
      glow.classList.toggle('mine', turnSeat === ctx.seat);
      if (lastTurn !== null && lastTurn !== turnSeat) {
        (turnSeat === ctx.seat ? sfx.mine : sfx.theirs)();
      }
      lastTurn = turnSeat;
    },

    // finish() — the results card. `delay` holds it back so you can actually
    // see the winning move before the screen is covered.
    finish({ won, text, emoji, title, winner, values, delay = 0 }) {
      clearTimeout(finishTimer);
      const seat = winner !== undefined ? winner
                 : won === true ? ctx.seat
                 : won === false ? ctx.players.find(p => p.id !== me.id)?.seat ?? null
                 : null;
      finishTimer = setTimeout(() => {
        $('#goEmoji').textContent = emoji || (won ? '🎉' : won === false ? '😵' : '🤝');
        $('#goText').textContent = title || (won ? 'You win!' : won === false ? 'You lost' : "It's a draw");
        $('#goSub').textContent = text || '';
        $('#goScores').replaceChildren(...ctx.players.map(p => el(
          'div.go-row' + (seat === p.seat ? '.won' : ''), {},
          el('span.dot', { style: { background: seatColor(p.seat) } }),
          el('span.nm', {}, p.id === me.id ? 'You' : p.name),
          seat === p.seat ? el('span.crown', {}, '👑') : null,
          values && values[p.seat] != null
            ? el('span.val', { style: { color: seatColor(p.seat) } }, String(values[p.seat]))
            : el('span.note', {}, seat === null ? 'draw' : seat === p.seat ? 'winner' : ''),
        )));
        $('#goHint').textContent = 'Either of you can start a rematch.';
        $('#gameOver').hidden = false;
        if (won) { sfx.win(); confetti(); } else if (won === false) sfx.lose();
        else sfx.reveal();
      }, delay);
    },
    chat,
    onDestroy(fn) { offs.push(fn); },
  };

  ctx.status(byId(id).name);
  offs.push(() => clearTimeout(finishTimer));
  game = { id, offs, roster };
  try {
    mod.mount(ctx);
  } catch (err) {
    console.error(err);
    stage.replaceChildren(el('p.tiny', {}, 'That game crashed. Back to the room.'));
  }
}

function destroyGame() {
  if (!game) return;
  game.offs.forEach(fn => { try { fn(); } catch {} });
  game = null;
  $('#gameStage').replaceChildren();
  $('#turnGlow').classList.remove('on', 'mine');
}

function backToRoom() {
  destroyGame();
  $('#gameOver').hidden = true;
  chat?.close();
  renderPlayers(room.players);
  updateStart();
  show('room');
}

$('#btnQuit').onclick    = () => { room.send('exit', {}); };
$('#btnBackRoom').onclick = () => { room.send('exit', {}); };
$('#btnRematch').onclick = () => {
  if (!game) return;
  room.send('start', { id: game.id, n: Date.now(), roster: game.roster });
};

/* ── nice-to-haves ─────────────────────────────────────────────────────── */
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#chatPanel').hidden) chat?.close();
});
addEventListener('beforeunload', () => room?.leave());
