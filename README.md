# 🕊️ Coop

GamePigeon, but it's a website. Share a 4-letter room code, pick a game, play,
and chat while you're in it. No accounts, no app store, no install.

**Games:** Connect 4 · Battleship · Dots & Boxes · Anagrams

---

## Run it

ES modules don't work from `file://`, so you need a tiny local server:

```
cd C:\Users\minaa\coop
npm start
```

That opens <http://localhost:5173>. To test multiplayer right now, **open a
second tab** and join the same code — in local mode, tabs on this computer
play each other.

Run the tests any time with `npm test`.

## Turn on real multiplayer

Local mode only connects tabs on one computer. Fill in **one** backend in
`config.js` to play with friends anywhere.

### Ably (what this is set up for)

1. [ably.com](https://ably.com) → sign up (free, no credit card)
2. Your app → **API Keys** → **Create a new API key**
3. Give it **only** these capabilities: `subscribe`, `publish`, `presence`
4. Restrict it to the resource `coop:*`
5. Paste it into `ABLY_KEY` in `config.js`

> ⚠️ **Don't use the Root key.** `config.js` ships to the browser, so anyone
> can read it — and this repo is public. A root key would hand over your whole
> Ably account. A key scoped to `coop:*` with those three capabilities can do
> nothing except play Coop, so it's safe to commit.

Free tier is roughly 6M messages/month and 200 concurrent connections, which
you will not come close to.

### Supabase (alternative)

1. [supabase.com](https://supabase.com) → **Start your project** → sign in with GitHub
2. **New project**, any name, region near you, wait ~1 minute
3. **Project Settings** (gear) → **API**
4. Copy **Project URL** and the **anon public** key into `config.js`

No tables, no SQL. The anon key is designed to be public. Note the free tier
allows 2 *active* projects — you can pause an idle one to free a slot.

## Put it online

It's all static files, so anything works:

- **GitHub Pages** — push the folder, Settings → Pages → deploy from `main`
- **Cloudflare Pages** — connect the repo, no build command, output dir `/`
- **Vercel** — import the repo, framework preset "Other", no build command

Then the invite link (`yoursite.com/?room=ABCD`) drops people straight into
your room.

---

## How it works

```
index.html      three screens: home, room, game
config.js       your Supabase keys (or blank for local mode)
js/net.js       rooms. Ably or Supabase online, BroadcastChannel locally
js/app.js       screens, joining, starting games
js/chat.js      the chat panel
js/kit.js       helpers: el(), sounds, toasts, confetti
js/games/       one file per game
test/           `npm test` — game rules and networking, no browser needed
```

**Rooms.** A room is just a named channel. Everyone in it hears every message.
Whoever joined first is the *host* (ties broken by id, so both sides always
agree). If the host leaves, the next player takes over.

**Two ways a game can work:**

- *Host-authoritative* (Connect 4, Dots & Boxes) — the host owns the board.
  You send "I want to drop in column 3"; the host checks it and broadcasts the
  new board. The two screens can't drift apart.
- *Peer* (Battleship, Anagrams) — used when players have secrets. In
  Battleship **your ships never leave your device**; your opponent sends a
  shot and your browser replies "hit" or "miss". Nobody can peek, not even the
  host.

## Adding a game

1. Copy `js/games/connect4.js` to `js/games/yourgame.js`
2. Add one line to `js/games/index.js`

Your file exports `{ id, mount(ctx) }` and `ctx` gives you everything:

```js
ctx.root          // the element to fill with your game
ctx.seat          // 0 or 1 — which player you are
ctx.isHost        // are you the referee?
ctx.players       // [{id, name, seat}]
ctx.send(type, data)   // tell everyone something
ctx.on(type, fn)       // listen (auto-cleaned up when the game ends)
ctx.status('Your turn')     // the text in the top bar
ctx.finish({ won: true, text: 'Nice!' })   // the end-of-game card
ctx.onDestroy(fn)      // clean up timers here
```

Messages are automatically namespaced per game *and* per round, so a rematch
never sees leftover packets from the last one.

## Ideas for later

- More games: Gomoku, Checkers, Filler, Word Hunt, 20 Questions
- 3–4 player rooms (`net.js` already handles any number of seats)
- Spectators
- Emoji reactions that fly across the board
- Remember the score across rematches
