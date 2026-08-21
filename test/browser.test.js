// Two real players in a real browser. This is the test that catches the
// things headless logic tests never will — CSS covering the board, a click
// that does nothing, a move that never reaches the other screen.
//
//   1. npm start          (in another terminal)
//   2. npm run test:browser
//
// It drives Chromium over CDP with puppeteer-core. Both are already on this
// machine; override with PUPPETEER_DIR / CHROME_PATH / BASE_URL if they move.
// Skips itself (exit 0) rather than failing if it can't find them.

import { existsSync } from 'node:fs';

const BASE    = process.env.BASE_URL    || 'http://127.0.0.1:5173/';
const CHROME  = process.env.CHROME_PATH ||
  'C:/Users/minaa/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const PUP_DIR = process.env.PUPPETEER_DIR ||
  'C:/Users/minaa/whatsapp-sender/node_modules/puppeteer-core';

if (!existsSync(CHROME)) {
  console.log(`
Skipping browser test — no Chromium at ${CHROME}`);
  console.log('Set CHROME_PATH, or run: npx playwright install chromium');
  process.exit(0);
}
if (!existsSync(PUP_DIR)) {
  console.log(`
Skipping browser test — no puppeteer-core at ${PUP_DIR}`);
  console.log('Set PUPPETEER_DIR, or run: npm i puppeteer-core');
  process.exit(0);
}
try {
  const res = await fetch(BASE, { signal: AbortSignal.timeout(3000) });
  if (!res.ok) throw new Error(String(res.status));
} catch {
  console.log(`
Skipping browser test — nothing serving at ${BASE}. Run \`npm start\` first.`);
  process.exit(0);
}

const puppeteer = (await import(`file:///${PUP_DIR}/lib/esm/puppeteer/puppeteer-core.js`)).default;

const GAMES = ['Connect 4', 'Battleship', 'Dots & Boxes', 'Anagrams'];

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? (pass++, console.log('  ok   ' + n))
                                 : (fail++, console.log('  FAIL ' + n + (e ? '   <' + e + '>' : ''))); };
const wait = ms => new Promise(r => setTimeout(r, ms));

// ElementHandle.evaluate hangs with this chromium build, so use page.evaluate only.
const set   = (p, sel, v) => p.evaluate((s, val) => { document.querySelector(s).value = val; }, sel, v);
const click = (p, sel)    => p.evaluate(s => document.querySelector(s).click(), sel);
const text  = (p, sel)    => p.evaluate(s => document.querySelector(s)?.textContent.trim() ?? '', sel);
const count = (p, sel)    => p.evaluate(s => document.querySelectorAll(s).length, sel);
const shown = (p, sel)    => p.evaluate(s => getComputedStyle(document.querySelector(s)).display !== 'none', sel);

async function until(p, fn, label, timeout = 25000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await p.evaluate(fn)) return true;
    await wait(250);
  }
  throw new Error('timed out waiting for: ' + label);
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true,
  protocolTimeout: 45000, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });

const openPlayer = async (name) => {
  const p = await browser.newPage();
  await p.setViewport({ width: 430, height: 900 });
  p.on('pageerror', e => console.log(`  !! [${name}] ${e.message.slice(0, 130)}`));
  await p.goto(BASE, { waitUntil: 'domcontentloaded' });
  await p.evaluate(() => new Promise(r => setTimeout(r, 400)));
  await set(p, '#nameInput', name);
  return p;
};

console.log(`\n=== ${BASE} ===`);
const A = await openPlayer('Alice');
const B = await openPlayer('Bob');

await click(A, '#btnCreate');
await until(A, () => !document.querySelector('#s-room').hidden, 'host room screen');
const code = await text(A, '#roomCode');
ok('host created a room', /^[A-Z0-9]{4}$/.test(code), code);

await set(B, '#codeInput', code);
await click(B, '#joinForm button[type="submit"]');
await until(B, () => !document.querySelector('#s-room').hidden, 'guest room screen');

try {
  await until(A, () => document.querySelectorAll('#playerList .player:not(.empty)').length === 2, 'two players');
  ok('both players show in the lobby', true);
} catch { ok('both players show in the lobby', false, 'timed out'); }

for (let g = 0; g < GAMES.length; g++) {
  console.log(`\n  -- ${GAMES[g]} --`);
  await A.evaluate(i => document.querySelectorAll('#gameGrid .game-card')[i].click(), g);
  await wait(700);
  await click(A, '#btnStart');
  await until(A, () => !document.querySelector('#s-game').hidden, 'host game screen');
  await until(B, () => !document.querySelector('#s-game').hidden, 'guest game screen');
  await wait(2400);

  const [oa, ob] = [await shown(A, '#gameOver'), await shown(B, '#gameOver')];
  ok('game-over overlay is NOT covering the board', !oa && !ob, `host=${oa} guest=${ob}`);
  ok('the game rendered', await count(A, '#gameStage > *') > 0);
  ok('status bar says something', (await text(A, '#gameStatus')).length > 0, await text(A, '#gameStatus'));

  if (g === 0) {
    ok('Connect 4 board has 7 columns', await count(A, '.c4 .col') === 7);
    await A.evaluate(() => document.querySelectorAll('.c4 .col')[0].click());
    await wait(2600);
    const [da, db] = [await count(A, '.c4 .cell.f'), await count(B, '.c4 .cell.f')];
    ok('a disc dropped for the host', da === 1, 'n=' + da);
    ok('the move reached the other player', db === 1, 'n=' + db);
    ok('turn passed to the guest', (await text(B, '#gameStatus')) === 'Your turn', await text(B, '#gameStatus'));
  }
  if (g === 1) {
    ok('Battleship drew a grid', await count(A, '.bs-grid') >= 1);
    ok('all 5 ships placed', await count(A, '.bs-ship') === 5);
    ok('64 squares on your board', await count(A, '.bs-grid .c') === 64);
  }
  if (g === 2) ok('Dots & Boxes drew 25 dots', await count(A, '.db .dot') === 25, 'n=' + await count(A, '.db .dot'));
  if (g === 3) ok('Anagrams dealt 7 letters + 2 buttons', await count(A, '.ag-tile') === 9, 'n=' + await count(A, '.ag-tile'));

  if (process.env.SHOT_DIR) {
    try {
      await Promise.race([
        A.screenshot({ path: `${process.env.SHOT_DIR}/${g}-${GAMES[g].replace(/\W+/g, '')}.png`,
                       captureBeyondViewport: false, optimizeForSpeed: true }),
        new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 9000)),
      ]);
      console.log('  ..   screenshot saved');
    } catch { console.log('  ..   screenshot skipped'); }
  }
  await click(A, '#btnQuit');
  await until(A, () => !document.querySelector('#s-room').hidden, 'host room screen');
  await until(B, () => !document.querySelector('#s-room').hidden, 'guest room screen');
  await wait(500);
}

console.log('\n  -- chat --');
await click(A, '#btnChat');
await set(A, '#chatInput', 'hi sis');
await A.evaluate(() => document.querySelector('#chatForm').requestSubmit());
await wait(2500);
const log = await B.evaluate(() => [...document.querySelectorAll('#chatLog .msg')].map(e => e.textContent).join(' | '));
ok('chat reached the other player', log.includes('hi sis'), log.slice(0, 90));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
