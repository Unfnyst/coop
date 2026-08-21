// ─── net.js ─────────────────────────────────────────────────────────────
// One room = one message channel that every player in it is connected to.
//
// Three backends, same interface:
//   AblyRoom      – real internet multiplayer (needs ABLY_KEY in config.js)
//   SupabaseRoom  – real internet multiplayer (needs Supabase keys instead)
//   LocalRoom     – other tabs on THIS computer (BroadcastChannel, no setup)
//
// A room gives you:
//   room.send(type, data)      broadcast to everyone (including yourself)
//   room.on(type, fn)          listen; returns an unsubscribe function
//   room.players               [{id, name, joinedAt, seat}] sorted by join time
//   room.seat                  your index in that list (0 or 1)
//   room.isHost                true if you're seat 0 (the referee)
//
// Special events you can listen for: 'players' (list changed), 'down' (lost
// connection). Everything else is whatever the games send.

import { ABLY_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export const BACKEND = ABLY_KEY ? 'ably'
                     : (SUPABASE_URL && SUPABASE_ANON_KEY) ? 'supabase'
                     : 'local';
export const IS_ONLINE = BACKEND !== 'local';

const HEARTBEAT = 1500;   // how often local tabs shout "still here"
const TIMEOUT   = 5000;   // ...and how long before we assume they left

class Emitter {
  #h = {};
  on(type, fn) {
    (this.#h[type] ||= []).push(fn);
    return () => { this.#h[type] = this.#h[type].filter(f => f !== fn); };
  }
  emit(type, ...args) { (this.#h[type] || []).forEach(f => f(...args)); }
}

class BaseRoom extends Emitter {
  constructor(code, me) {
    super();
    this.code = code;
    this.me = me;                 // {id, name}
    this.joinedAt = Date.now();
    this.players = [];
    this.hostId = null;
  }
  get seat()   { return this.players.findIndex(p => p.id === this.me.id); }
  get isHost() { return this.hostId === this.me.id; }
  get other()  { return this.players.find(p => p.id !== this.me.id) || null; }

  // Whoever joined first is the host. Ties broken by id so both sides agree.
  _setPlayers(list) {
    list.sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
    const changed = JSON.stringify(list) !== JSON.stringify(this.players.map(p => ({
      id: p.id, name: p.name, joinedAt: p.joinedAt,
    })));
    this.players = list.map((p, i) => ({ ...p, seat: i }));
    this.hostId = this.players[0]?.id ?? null;
    if (changed) this.emit('players', this.players);
  }
}

/* ── Real multiplayer, over Ably ───────────────────────────────────────── */
class AblyRoom extends BaseRoom {
  async connect() {
    // Browsers load the SDK from the CDN. test/ably.live.test.js injects the
    // npm build via globalThis.__ABLY__ instead, since Node can't import a URL.
    const Ably = globalThis.__ABLY__ ?? (await import('https://esm.sh/ably@2')).default;
    // echoMessages defaults to true, so — like the other two backends — you
    // also receive your own messages. Games rely on that.
    this.client = new Ably.Realtime({ key: ABLY_KEY, clientId: this.me.id });

    await new Promise((resolve, reject) => {
      const bail = setTimeout(() => reject(new Error('Timed out connecting')), 12000);
      this.client.connection.once('connected', () => { clearTimeout(bail); resolve(); });
      this.client.connection.once('failed', e => {
        clearTimeout(bail); reject(e?.reason || new Error('Connection failed'));
      });
    });

    this.ch = this.client.channels.get(`coop:${this.code}`);
    this.ch.subscribe('m', msg => this.emit(msg.data.type, msg.data.data, msg.data));
    this.ch.presence.subscribe(() => this._syncPresence());

    await this.ch.presence.enter({ name: this.me.name, joinedAt: this.joinedAt });
    await this._syncPresence();

    this.client.connection.on('disconnected', () => this.emit('down'));
  }

  async _syncPresence() {
    const members = await this.ch.presence.get();
    this._setPlayers(members.map(m => ({
      id: m.clientId, name: m.data?.name ?? '???', joinedAt: m.data?.joinedAt ?? 0,
    })));
  }

  send(type, data) {
    this.ch.publish('m', { type, data, from: this.me.id });
  }

  leave() {
    // presence.leave() is async and rejects if the channel already detached,
    // so it needs a promise catch, not just a try/catch. Closing the
    // connection clears presence anyway, so a failed leave is harmless —
    // just don't let it escape as an unhandled rejection.
    const close = () => { try { this.client?.close(); } catch {} };
    try {
      const leaving = this.ch?.presence?.leave();
      if (leaving?.then) leaving.then(close, close);
      else close();
    } catch { close(); }
  }
}

/* ── Real multiplayer, over Supabase Realtime ──────────────────────────── */
class SupabaseRoom extends BaseRoom {
  async connect() {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 20 } },
    });
    this.ch = this.sb.channel(`coop:${this.code}`, {
      config: { presence: { key: this.me.id }, broadcast: { self: true } },
    });

    this.ch.on('broadcast', { event: 'm' }, ({ payload }) => {
      this.emit(payload.type, payload.data, payload);
    });
    this.ch.on('presence', { event: 'sync' }, () => {
      const state = this.ch.presenceState();
      this._setPlayers(Object.values(state).flat().map(p => ({
        id: p.id, name: p.name, joinedAt: p.joinedAt,
      })));
    });

    await new Promise((resolve, reject) => {
      const bail = setTimeout(() => reject(new Error('Timed out connecting')), 12000);
      this.ch.subscribe(async (status, err) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(bail);
          await this.ch.track({ id: this.me.id, name: this.me.name, joinedAt: this.joinedAt });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(bail);
          reject(err || new Error(status));
        } else if (status === 'CLOSED') {
          this.emit('down');
        }
      });
    });
  }

  send(type, data) {
    this.ch.send({ type: 'broadcast', event: 'm', payload: { type, data, from: this.me.id } });
  }

  leave() {
    try { this.ch?.untrack(); this.sb?.removeAllChannels(); } catch {}
  }
}

/* ── Local multiplayer: other tabs on this computer ────────────────────── */
class LocalRoom extends BaseRoom {
  async connect() {
    this.bc = new BroadcastChannel(`coop:${this.code}`);
    this.seen = new Map([[this.me.id, { ...this.me, joinedAt: this.joinedAt, t: Date.now() }]]);

    this.bc.onmessage = ({ data: m }) => {
      if (m.k === 'hb') {
        this.seen.set(m.p.id, { ...m.p, t: Date.now() });
        this._refresh();
        if (m.hello) this._beat(false);   // answer a newcomer so they see us
      } else if (m.k === 'bye') {
        this.seen.delete(m.id);
        this._refresh();
      } else {
        this.emit(m.type, m.data, m);
      }
    };

    this._beat(true);
    this.timer = setInterval(() => { this._beat(false); this._prune(); }, HEARTBEAT);
    this._refresh();
  }

  _beat(hello) {
    this.bc.postMessage({
      k: 'hb', hello,
      p: { id: this.me.id, name: this.me.name, joinedAt: this.joinedAt },
    });
  }
  _prune() {
    const now = Date.now();
    let dropped = false;
    for (const [id, p] of this.seen) {
      if (id !== this.me.id && now - p.t > TIMEOUT) { this.seen.delete(id); dropped = true; }
    }
    if (dropped) this._refresh();
  }
  _refresh() {
    this._setPlayers([...this.seen.values()].map(p => ({
      id: p.id, name: p.name, joinedAt: p.joinedAt,
    })));
  }

  send(type, data) {
    const msg = { type, data, from: this.me.id };
    this.bc.postMessage(msg);
    this.emit(type, data, msg);   // BroadcastChannel skips the sender, so echo
  }

  leave() {
    clearInterval(this.timer);
    try { this.bc.postMessage({ k: 'bye', id: this.me.id }); this.bc.close(); } catch {}
  }
}

// Exported so tests can drive one backend directly, whatever config.js holds.
export { LocalRoom, AblyRoom, SupabaseRoom };

export function createRoom(code, me) {
  if (BACKEND === 'ably')     return new AblyRoom(code, me);
  if (BACKEND === 'supabase') return new SupabaseRoom(code, me);
  return new LocalRoom(code, me);
}

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  // no I/L/O/0/1 mix-ups
export function makeCode() {
  const n = crypto.getRandomValues(new Uint8Array(4));
  return [...n].map(b => ALPHABET[b % ALPHABET.length]).join('');
}
export function makeId() {
  return crypto.randomUUID ? crypto.randomUUID().slice(0, 8)
                           : Math.random().toString(36).slice(2, 10);
}
