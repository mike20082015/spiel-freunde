'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WebSocket } = require('ws');
const E = require('../../public/skat/js/engine.js');
const { createHub } = require('../lib/room');
const { listen } = require('../server');

function secretOk(views) {
  for (const view of views) {
    const blob = JSON.stringify(view);
    assert.equal(Object.prototype.hasOwnProperty.call(view, 'token'), false);
    assert.equal(blob.includes('"hands"'), false);
    for (const other of views) {
      if (!other || other.you === view.you) continue;
      assert.equal(blob.includes(other._token || '___none___'), false);
      for (const card of other.hand || []) {
        if ((view.hand || []).includes(card)) continue;
        if ((view.trick || []).some((entry) => entry.card === card)) continue;
        if ((view.tricks || []).some((trick) => trick.cards.some((entry) => entry.card === card))) continue;
        if (view.skatKnown && view.skatKnown.includes(card)) continue;
        if (view.openHand && view.openHand.includes(card)) continue;
        assert.equal(blob.includes('"' + card + '"'), false, card + ' liegt in der Sicht von Platz ' + view.you);
      }
    }
  }
}

function monsterDeck() {
  const deck = new Array(32);
  const mine = ['CJ', 'SJ', 'HJ', 'DJ', 'CA', 'SA', 'HA', 'DA', 'C10', 'S10'];
  const slots = [6, 7, 8, 19, 20, 21, 22, 29, 30, 31];
  slots.forEach((index, pos) => { deck[index] = mine[pos]; });
  const rest = E.createDeck().filter((card) => mine.indexOf(card) === -1);
  let cursor = 0;
  for (let i = 0; i < 32; i++) if (!deck[i]) deck[i] = rest[cursor++];
  return deck;
}

function drive(hub, code, claims) {
  for (let step = 0; step < 80; step++) {
    const views = claims.map((claim) => {
      const view = hub.rejoin(code, claim.token);
      view._token = claim.token;
      return view;
    });
    secretOk(views);
    const live = views[0];
    if (live.status === 'ended' || live.phase === 'done') return views;
    const actor = views.find((view) => view.yourTurn);
    assert.ok(actor, 'niemand ist dran, Phase ' + live.phase);
    const token = claims[actor.you].token;
    if (actor.phase === 'bidding') hub.act(code, token, 'bid', { yes: actor.you === 0 });
    else if (actor.phase === 'skat') hub.act(code, token, 'hand');
    else if (actor.phase === 'discard') hub.act(code, token, 'discard', { cards: actor.hand.slice(0, 2) });
    else if (actor.phase === 'declare') hub.act(code, token, 'declare', { game: { type: 'grand' } });
    else if (actor.doubling) hub.act(code, token, 'double', { yes: actor.doubling.kind === 'kontra' && actor.you === 1 });
    else if (actor.phase === 'play') hub.act(code, token, 'play', { card: actor.legal[0] });
    else assert.fail('unerwartete Phase ' + actor.phase);
  }
  assert.fail('Spiel endet nicht');
}

test('Gastgeber, Code, Beitritt, KI-Platz und Chat', () => {
  const hub = createHub({ aiDelayMs: 0, ttlMs: 60000 });
  const made = hub.createRoom({ name: 'Anna', target: 301 });
  assert.equal(made.summary.target, 301);
  assert.equal(made.summary.tournamentId, null);
  assert.equal(made.summary.status, 'lobby');
  assert.equal(made.claims.length, 1);
  assert.equal(made.claims[0].seat, 0);
  assert.equal(made.summary.code.length, 6);

  const ben = hub.join(made.summary.code, 'Ben');
  assert.equal(ben.claim.seat, 1);
  const view = hub.act(made.summary.code, made.claims[0].token, 'fill', { aiId: 'horst' });
  assert.equal(view.seats[2].kind, 'ai');
  assert.equal(view.seats[2].name, 'Horst');
  assert.equal(view.seats.every((seat) => seat.kind !== 'empty'), true);
  assert.throws(() => hub.join(made.summary.code, 'Clara'), (err) => err.status === 409);

  hub.act(made.summary.code, ben.claim.token, 'chat', { text: 'Moin an den Tisch' });
  const hostView = hub.rejoin(made.summary.code, made.claims[0].token);
  assert.equal(hostView.chat.some((line) => line.text === 'Moin an den Tisch' && line.seat === 1), true);
  assert.equal(JSON.stringify(hostView).includes(ben.claim.token), false);
  assert.equal(hostView.you, 0);
  assert.equal(hostView.hand.length, 0);

  const again = hub.rejoin(made.summary.code, ben.claim.token);
  assert.equal(again.you, 1);
  assert.equal(again.seats[1].you, true);
});

test('Programm legt einen K.-o.-Tisch an, der Server setzt die Plätze, Serie endet mit Sieger', () => {
  const hub = createHub({ aiDelayMs: 0, allowDecks: true, ttlMs: 60000 });
  const made = hub.createRoom({
    tournamentId: 'ko-herbst',
    roundId: 'viertel',
    target: 51,
    decks: [monsterDeck()],
    seats: [
      { name: 'Anna', externalId: 'p-anna', playerId: 'plyr_anna' },
      { name: 'Ben', externalId: 'p-ben', playerId: 'plyr_ben' },
      { name: 'Clara', externalId: 'p-clara' },
    ],
  });
  assert.equal(made.summary.tournamentId, 'ko-herbst');
  assert.equal(made.summary.roundId, 'viertel');
  assert.deepEqual(made.claims.map((claim) => claim.seat), [0, 1, 2]);
  assert.deepEqual(made.claims.map((claim) => claim.externalId), ['p-anna', 'p-ben', 'p-clara']);
  assert.deepEqual(made.claims.map((claim) => claim.playerId), ['plyr_anna', 'plyr_ben', null]);
  assert.throws(() => hub.join(made.summary.code, 'Noch jemand'), (err) => err.status === 409);

  hub.act(made.summary.code, made.claims[0].token, 'start');
  const opening = made.claims.map((claim) => hub.rejoin(made.summary.code, claim.token));
  const shown = opening.flatMap((view) => view.hand);
  const hidden = E.createDeck().filter((card) => shown.indexOf(card) === -1);
  assert.equal(hidden.length, 2);
  for (const view of opening) {
    const blob = JSON.stringify(view);
    for (const card of hidden) assert.equal(blob.includes('"' + card + '"'), false, 'Skat ' + card);
  }
  assert.equal(opening[0].hand.length, 10);
  assert.equal(opening[0].seats[0].playerId, 'plyr_anna');
  assert.equal(opening[0].seats[1].playerId, null);
  assert.equal(opening[1].seats[0].playerId, null);
  assert.equal(opening[1].seats[1].playerId, 'plyr_ben');
  const views = drive(hub, made.summary.code, made.claims);
  const end = views[0];
  assert.equal(end.status, 'ended');
  assert.equal(end.kontra, true);
  assert.equal(end.re, false);
  assert.equal(end.winnerSeat, 0);
  assert.ok(end.scores[0] >= 51);
  assert.equal(end.scores[1], 0);
  assert.equal(end.scores[2], 0);
  assert.throws(() => hub.act(made.summary.code, made.claims[0].token, 'next'), (err) => err.status === 409);

  const series = hub.listResults({ tournamentId: 'ko-herbst' }, { admin: true }).filter((row) => row.kind === 'series');
  assert.equal(series.length, 1);
  assert.equal(series[0].status, 'ended');
  assert.equal(series[0].reason, 'target');
  assert.equal(series[0].winnerSeat, 0);
  assert.equal(series[0].winner.externalId, 'p-anna');
  assert.equal(series[0].winner.playerId, 'plyr_anna');
  assert.equal(series[0].seats[2].playerId, null);
  assert.deepEqual(series[0].scores, end.scores);
  assert.equal(series[0].target, 51);
  assert.equal(series[0].access, undefined);
  assert.ok(series[0].gameIds.length >= 1);

  const games = hub.listResults({ code: made.summary.code }, { token: made.claims[1].token }).filter((row) => row.kind === 'game');
  assert.ok(games.length >= 1);
  assert.equal(games[0].access, undefined);
  assert.equal(JSON.stringify(games).includes('"CJ"'), false);
});

test('fremdes Blatt bleibt verdeckt, auch während die KI spielt', () => {
  const hub = createHub({ aiDelayMs: 0, ttlMs: 60000 });
  const made = hub.createRoom({ name: 'Anna', target: 'none' });
  hub.act(made.summary.code, made.claims[0].token, 'fill', { seatIndex: 1, aiId: 'horst' });
  hub.act(made.summary.code, made.claims[0].token, 'fill', { seatIndex: 2, aiId: 'margarethe' });
  let view = hub.act(made.summary.code, made.claims[0].token, 'start');
  assert.equal(view.hand.length, 10);
  assert.equal(view.handSizes[1], 10);
  assert.equal(view.skatKnown, null);
  for (let step = 0; step < 40 && view.status === 'live' && view.phase !== 'done'; step++) {
    const tagged = Object.assign({ _token: made.claims[0].token }, view);
    const aiViews = [tagged];
    secretOk(aiViews);
    if (view.yourTurn) {
      if (view.phase === 'bidding') view = hub.act(made.summary.code, made.claims[0].token, 'bid', { yes: false });
      else if (view.phase === 'skat') view = hub.act(made.summary.code, made.claims[0].token, 'hand');
      else if (view.phase === 'discard') view = hub.act(made.summary.code, made.claims[0].token, 'discard', { cards: view.hand.slice(0, 2) });
      else if (view.phase === 'declare') view = hub.act(made.summary.code, made.claims[0].token, 'declare', { game: { type: 'suit', trump: 'H' } });
      else if (view.doubling) view = hub.act(made.summary.code, made.claims[0].token, 'double', { yes: false });
      else view = hub.act(made.summary.code, made.claims[0].token, 'play', { card: view.legal[0] });
    } else break;
  }
  assert.notEqual(view.phase, 'lobby');
  assert.ok(view.events.some((event) => event.kind === 'play' || event.kind === 'bid' || event.kind === 'declare' || event.kind === 'gameOver'));
});

test('Tisch läuft nach Inaktivität ab, das Ergebnis bleibt', () => {
  let clock = 1000;
  const hub = createHub({ aiDelayMs: 0, ttlMs: 1000, now: () => clock, allowDecks: true });
  const made = hub.createRoom({
    name: 'Anna',
    target: 51,
    decks: [monsterDeck()],
    seats: [
      { name: 'Anna', externalId: 'p-anna' },
      { name: 'Ben', externalId: 'p-ben' },
      { name: 'Clara', externalId: 'p-clara' },
    ],
  });
  const code = made.summary.code;
  hub.act(code, made.claims[0].token, 'start');
  drive(hub, code, made.claims);
  clock = 5000;
  hub.sweep();
  assert.throws(() => hub.rejoin(code, made.claims[0].token), (err) => err.status === 410);
  const rows = hub.listResults({ code }, { token: made.claims[0].token });
  assert.equal(rows.some((row) => row.kind === 'series'), true);
  clock = 9000;
  hub.sweep();
  const later = hub.listResults({ code }, { token: made.claims[2].token });
  assert.equal(later.some((row) => row.kind === 'series' && row.winnerSeat === 0), true);
});

test('HTTP, WebSocket und Admin-Route', async () => {
  const server = listen({
    port: 0,
    host: '127.0.0.1',
    hubOptions: { aiDelayMs: 0, adminToken: 'test-admin-token', ttlMs: 60000 },
  });
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const base = 'http://127.0.0.1:' + port;

  async function post(pathname, body, headers) {
    const res = await fetch(base + pathname, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
      body: JSON.stringify(body || {}),
    });
    const json = await res.json();
    return { status: res.status, json };
  }

  try {
    const health = await fetch(base + '/health');
    assert.equal(health.status, 200);
    const closed = await post('/api/tisch/rooms', { tournamentId: 'x', name: 'A' });
    assert.equal(closed.status, 404);

    const created = await post('/api/tisch/create', {
      name: 'Anna',
      playerId: 'plyr_spoof',
      tournamentId: 'soll-weg',
      seats: [{ name: 'Fremd' }, { name: 'Auch' }, { name: 'Noch' }],
      decks: [['CJ']],
      target: '301',
    });
    assert.equal(created.status, 200);
    assert.equal(created.json.ok, true);
    assert.equal(created.json.tournamentId, null);
    assert.equal(created.json.seat, 0);
    assert.equal(created.json.view.seats[0].playerId, null);
    assert.equal(created.json.view.seats[1].kind, 'empty');
    assert.equal(typeof created.json.token, 'string');

    const joined = await post('/api/tisch/join', { code: created.json.code.toLowerCase(), name: 'Ben', playerId: 'plyr_spoof' });
    assert.equal(joined.status, 200);
    assert.equal(joined.json.seat, 1);
    assert.equal(joined.json.view.seats[1].playerId, null);
    const polled = await post('/api/tisch/poll', { code: created.json.code, token: created.json.token });
    assert.equal(polled.json.view.seats[1].name, 'Ben');
    assert.equal(JSON.stringify(polled.json).includes(joined.json.token), false);

    const opened = await post('/api/tisch/rooms', {
      tournamentId: 'ko-1',
      roundId: 'r1',
      target: 301,
      seats: [{ name: 'Eva', externalId: 'e1', playerId: 'plyr_eva' }, { kind: 'ai', aiId: 'horst' }],
    }, { Authorization: 'Bearer test-admin-token' });
    assert.equal(opened.status, 200);
    assert.equal(opened.json.tournamentId, 'ko-1');
    assert.equal(opened.json.claims.length, 1);
    assert.equal(opened.json.claims[0].externalId, 'e1');
    assert.equal(opened.json.claims[0].playerId, 'plyr_eva');

    await new Promise((resolve, reject) => {
      const ws = new WebSocket('ws://127.0.0.1:' + port + '/api/tisch/ws');
      ws.on('open', () => ws.send(JSON.stringify({ type: 'hello', code: created.json.code, token: joined.json.token })));
      ws.on('message', (raw) => {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'state' && msg.view && msg.view.you === 1) {
          ws.close();
          resolve();
        }
      });
      ws.on('error', reject);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('Datei-Ablage lädt Ergebnisse wieder', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-tisch-'));
  const { createResultStore } = require('../lib/results');
  const store = createResultStore(dir);
  store.add({
    kind: 'series', code: 'ABCDEF', tournamentId: 'ko', status: 'ended',
    winnerSeat: 1, scores: [0, 51, 0], access: ['geheim'],
  });
  const rows = createResultStore(dir).list({ tournamentId: 'ko' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].winnerSeat, 1);
  assert.equal(rows[0].status, 'ended');
  assert.equal(rows[0].access, undefined);
  assert.deepEqual(rows[0].scores, [0, 51, 0]);
});
