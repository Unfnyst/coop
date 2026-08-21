// ─── chat.js ────────────────────────────────────────────────────────────
// Lightweight room chat. Rides the same connection the game uses, so it
// works in the lobby and during a game with no extra setup.

import { $, el, sfx } from './kit.js';

const QUICK = ['👋', '😂', '😭', '🔥', '🤝', 'gg', 'nice', 'oof'];
const MAX_KEPT = 120;

export function mountChat(room) {
  const panel  = $('#chatPanel');
  const log    = $('#chatLog');
  const form   = $('#chatForm');
  const input  = $('#chatInput');
  const badge  = $('#chatBadge');
  const quick  = $('#chatQuick');
  const toggle = $('#btnChat');

  let unread = 0;
  const isOpen = () => !panel.hidden;

  log.replaceChildren();
  quick.replaceChildren(...QUICK.map(q =>
    el('button', { type: 'button', onclick: () => send(q) }, q)));

  function bump() {
    if (isOpen()) return;
    unread++;
    badge.textContent = unread > 9 ? '9+' : unread;
    badge.hidden = false;
    toggle.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }],
      { duration: 260 });
  }

  function add(node) {
    log.append(node);
    while (log.children.length > MAX_KEPT) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  }

  function system(text) {
    add(el('div.msg.sys', {}, text));
  }

  function bubble({ name, text, mine }) {
    const b = el('div.msg' + (mine ? '.mine' : ''));
    if (!mine) b.append(el('span.who', {}, name));
    b.append(document.createTextNode(text));   // never innerHTML — names are user text
    add(b);
  }

  function send(text) {
    text = String(text).trim().slice(0, 140);
    if (!text) return;
    room.send('chat', { name: room.me.name, text });
    input.value = '';
    input.focus();
  }

  form.onsubmit = e => { e.preventDefault(); send(input.value); };

  const offChat = room.on('chat', (d, msg) => {
    const mine = msg.from === room.me.id;
    bubble({ name: d.name || 'someone', text: d.text, mine });
    if (!mine) { sfx.tap(); bump(); }
  });

  const api = {
    system,
    open() {
      panel.hidden = false;
      unread = 0; badge.hidden = true;
      log.scrollTop = log.scrollHeight;
      if (window.matchMedia('(min-width: 700px)').matches) input.focus();
    },
    close() { panel.hidden = true; },
    toggle() { isOpen() ? api.close() : api.open(); },
    destroy() { offChat(); api.close(); log.replaceChildren(); },
  };

  toggle.onclick = api.toggle;
  $('#btnChatClose').onclick = api.close;
  return api;
}
