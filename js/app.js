// ─── app.js ─────────────────────────────────────────────────────────────
// Screens, rooms, and the glue that hands a connected room to a game.

import { $, el, toast, sfx, confetti } from './kit.js';
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

  wireRoom();
  renderGameGrid();
  show('room');
}

function wireRoom() {
  room.on('players', players => {
    renderPlayers(players);
    updateStart();
    // Host re-announces the pick so a late joiner sees the same game selected.
    if (room.isHost) room.send('pick', { id: pick });
    if (game && players.length < 2) {
      chat?.system('Your opponent left.');
      toast('Opponent left');
      backToRoom();
    }
  });

  room.on('pick', d => {
    if (byId(d.id)) { pick = d.id; renderGameGrid(); }
  });

  room.on('start', async d => {
    if (!byId(d.id)) return;
    pick = d.id; gameNonce = d.n;
    await openGame(d.id, d.n);
  });

  room.on('exit', () => { if (game) backToRoom(); });

  room.on('down', () => toast('Connection dropped'));

  renderPlayers(room.players);
  updateStart();
}

/* ── room screen ───────────────────────────────────────────────────────── */
function renderPlayers(players) {
  const list = $('#playerList');
  list.replaceChildren(
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
  room.send('start', { id: pick, n: Date.now() });
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

$('#btnLeaveRoom').onclick = () => {
  chat?.destroy(); room?.leave(); room = null; chat = null;
  history.replaceState(null, '', location.pathname);
  show('home');
};

/* ── running a game ────────────────────────────────────────────────────── */
async function openGame(id, nonce) {
  destroyGame();
  const stage = $('#gameStage');
  stage.replaceChildren(el('p.tiny', {}, 'Loading…'));
  $('#gameOver').hidden = true;
  show('game');

  const mod = await loadGame(id);
  if (gameNonce !== nonce) return;          // a newer start won the race
  stage.replaceChildren();

  const offs = [];
  const ctx = {
    root: stage,
    room, me,
    get seat()    { return room.seat; },
    get isHost()  { return room.isHost; },
    get players() { return room.players; },
    nonce,
    // Game messages are namespaced + nonce-stamped so a rematch never sees
    // stray packets from the previous round.
    send(type, data) { room.send(`g:${type}`, { ...data, _n: nonce }); },
    on(type, fn) {
      const off = room.on(`g:${type}`, (d, msg) => {
        if (d && d._n !== nonce) return;
        fn(d, msg);
      });
      offs.push(off);
      return off;
    },
    status(text) {
      const bar = $('#gameStatus');
      bar.replaceChildren(text?.nodeType ? text : document.createTextNode(text ?? ''));
    },
    finish({ won, text, emoji }) {
      $('#goEmoji').textContent = emoji || (won ? '🎉' : won === false ? '😵' : '🤝');
      $('#goText').textContent = text;
      $('#goHint').textContent = 'Either of you can start a rematch.';
      $('#gameOver').hidden = false;
      if (won) { sfx.win(); confetti(); } else if (won === false) sfx.lose();
    },
    chat,
    onDestroy(fn) { offs.push(fn); },
  };

  ctx.status(byId(id).name);
  game = { id, offs };
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
  room.send('start', { id: game?.id || pick, n: Date.now() });
};

/* ── nice-to-haves ─────────────────────────────────────────────────────── */
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#chatPanel').hidden) chat?.close();
});
addEventListener('beforeunload', () => room?.leave());
