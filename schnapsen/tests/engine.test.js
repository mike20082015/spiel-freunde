/* Schnapsen: Blatt, Zwang, Ansage, Zudrehen, Bummerl. Aufruf über `node --test tests/`. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/schnapsen/js/engine.js');
const AI = require('../../public/schnapsen/js/ai.js');

function C(suit, rank) { return { suit: suit, rank: rank, id: String(suit) + rank }; }
function ids(cards) { return cards.map((c) => c.id).sort(); }

test('Blatt hat 20 Karten und 120 Augen', () => {
  const deck = E.freshDeck();
  assert.equal(deck.length, 20);
  assert.equal(new Set(deck.map((c) => c.id)).size, 20);
  assert.equal(E.sumPoints(deck), 120);
  assert.equal(E.pointsOf(C(0, 'A')), 11);
  assert.equal(E.pointsOf(C(1, '10')), 10);
  assert.equal(E.pointsOf(C(2, 'K')), 4);
  assert.equal(E.pointsOf(C(3, 'O')), 3);
  assert.equal(E.pointsOf(C(0, 'U')), 2);
  assert.equal(E.normalizeTarget(undefined), 7);
  assert.equal(E.normalizeTarget('11'), 11);
  assert.equal(E.normalizeTarget('custom', 9), 9);
  assert.equal(E.normalizeTarget('custom', 0), 7);
});

test('Geben: fünf Karten, offener Trumpf, neun verdeckt, Vorhand führt', () => {
  const rng = E.mulberry32(4);
  const table = E.newTable({ target: 7 }, rng);
  assert.ok(table.dealer === 0 || table.dealer === 1);
  assert.equal(table.forehand, E.nextSeat(table.dealer));
  assert.equal(table.turn, table.forehand);
  assert.equal(table.hands[0].length, 5);
  assert.equal(table.hands[1].length, 5);
  assert.equal(table.stock.length, 9);
  assert.ok(table.trumpCard);
  assert.equal(table.trump, table.trumpCard.suit);
  const all = table.hands[0].concat(table.hands[1], table.stock, [table.trumpCard]);
  assert.equal(new Set(all.map((c) => c.id)).size, 20);
  const again = E.newTable({}, E.mulberry32(4));
  assert.equal(again.dealer, table.dealer);
  assert.deepEqual(again.hands[0].map((c) => c.id), table.hands[0].map((c) => c.id));
});

test('offener Talon: jede Karte, danach Farbzwang vor Stichzwang', () => {
  const open = E.fromPosition({
    trump: 0,
    trumpCard: C(0, 'K'),
    stock: [C(1, 'U')],
    turn: 1,
    trick: [{ seat: 0, card: C(1, 'A') }],
    hands: [[], [C(1, 'U'), C(0, 'A'), C(2, 'K')]],
  });
  assert.equal(E.isStrict(open), false);
  assert.deepEqual(ids(E.legalCards(open, 1)), ['0A', '1U', '2K']);

  const follow = E.fromPosition({
    trump: 0,
    turn: 1,
    closed: true,
    closer: 0,
    freeze: { points: [10, 0], tricks: [1, 0] },
    trick: [{ seat: 0, card: C(1, 'K') }],
    hands: [[], [C(1, 'U'), C(1, 'A'), C(0, 'A')]],
  });
  assert.deepEqual(ids(E.legalCards(follow, 1)), ['1A']);

  const mustSuit = E.fromPosition({
    trump: 0,
    turn: 1,
    closed: true,
    closer: 0,
    freeze: { points: [0, 0], tricks: [0, 0] },
    trick: [{ seat: 0, card: C(1, 'A') }],
    hands: [[], [C(1, 'U'), C(0, 'A')]],
  });
  assert.deepEqual(ids(E.legalCards(mustSuit, 1)), ['1U']);

  const mustTrump = E.fromPosition({
    trump: 0,
    turn: 1,
    stock: [],
    trumpCard: null,
    trick: [{ seat: 0, card: C(1, 'K') }],
    hands: [[], [C(0, 'U'), C(2, 'A')]],
  });
  assert.equal(E.isStrict(mustTrump), true);
  assert.deepEqual(ids(E.legalCards(mustTrump, 1)), ['0U']);

  const cannotBeat = E.fromPosition({
    trump: 0,
    turn: 1,
    stock: [],
    trumpCard: null,
    trick: [{ seat: 0, card: C(0, 'A') }],
    hands: [[], [C(0, 'U'), C(2, 'K')]],
  });
  assert.deepEqual(ids(E.legalCards(cannotBeat, 1)), ['0U']);
});

test('20er bleibt vorgemerkt, 40er mit Stich zählt sofort und kann die 66 machen', () => {
  const pending = E.fromPosition({
    trump: 1,
    trumpCard: C(1, 'A'),
    stock: [C(2, 'U'), C(3, 'U')],
    turn: 0,
    hands: [
      [C(0, 'K'), C(0, 'O'), C(2, 'A'), C(3, '10'), C(1, 'U')],
      [C(2, 'K'), C(2, '10'), C(3, 'A'), C(0, 'A'), C(0, '10')],
    ],
  });
  const announced = E.applyAction(pending, 0, { type: 'marriage', suit: 0 });
  assert.equal(announced.ok, true);
  assert.equal(pending.pending[0], 20);
  assert.equal(pending.points[0], 0);
  assert.equal(pending.trick[0].card.rank, 'K');
  E.playCard(pending, 1, '2K');
  assert.equal(pending.points[0], 20 + 4 + 4);
  assert.equal(pending.pending[0], 0);

  const live = E.fromPosition({
    trump: 0,
    turn: 0,
    tricks: [1, 1],
    points: [30, 20],
    hands: [
      [C(0, 'K'), C(0, 'O')],
      [C(1, 'A')],
    ],
    scores: [0, 0],
    target: 7,
  });
  const done = E.applyAction(live, 0, { type: 'marriage', suit: 0 });
  assert.equal(done.ok, true);
  assert.equal(live.points[0], 70);
  assert.equal(live.phase, 'handEnd');
  assert.equal(live.gained[0], 2);
  assert.equal(live.scores[0], 2);
});

test('Trumpf tauschen und Zudrehen', () => {
  const table = E.fromPosition({
    trump: 0,
    trumpCard: C(0, 'A'),
    stock: [C(1, 'U'), C(2, 'U')],
    turn: 0,
    hands: [[C(0, 'U'), C(1, 'K'), C(2, 'A'), C(3, '10'), C(3, 'K')], [C(1, 'A'), C(2, 'K'), C(3, 'A'), C(0, '10'), C(0, 'K')]],
  });
  const swapped = E.applyAction(table, 0, { type: 'exchange' });
  assert.equal(swapped.ok, true);
  assert.equal(table.hands[0].some((c) => c.id === '0A'), true);
  assert.equal(table.trumpCard.id, '0U');
  assert.equal(E.applyAction(table, 0, { type: 'exchange' }).ok, false);
  const closed = E.applyAction(table, 0, { type: 'close' });
  assert.equal(closed.ok, true);
  assert.equal(table.closed, true);
  assert.equal(table.closer, 0);
  assert.equal(E.isStrict(table), true);
  assert.equal(E.applyAction(table, 0, { type: 'close' }).ok, false);
});

test('gescheitertes Zudrehen gibt mindestens 2, letzter Stich gibt 1', () => {
  const closed = E.fromPosition({
    trump: 0,
    closed: true,
    closer: 0,
    freeze: { points: [4, 0], tricks: [1, 0] },
    points: [4, 0],
    tricks: [1, 0],
    turn: 0,
    hands: [[C(1, 'U')], [C(2, 'U')]],
    target: 7,
  });
  E.playCard(closed, 0, '1U');
  const end = E.playCard(closed, 1, '2U');
  assert.equal(end.ok, true);
  assert.equal(closed.phase, 'handEnd');
  assert.equal(closed.gained[1], 3);
  assert.equal(closed.points[0] < 66, true);

  const last = E.fromPosition({
    trump: 0,
    stock: [],
    trumpCard: null,
    points: [20, 20],
    tricks: [1, 1],
    turn: 0,
    hands: [[C(1, 'K')], [C(1, 'U')]],
  });
  E.playCard(last, 0, '1K');
  E.playCard(last, 1, '1U');
  assert.equal(last.lastReason, 'last');
  assert.equal(last.gained[0], 1);

  const higher = E.fromPosition({
    trump: 0,
    stock: [],
    trumpCard: null,
    points: [40, 10],
    tricks: [1, 1],
    turn: 0,
    lastTrickWins: false,
    hands: [[C(2, 'U')], [C(3, 'U')]],
  });
  E.playCard(higher, 0, '2U');
  E.playCard(higher, 1, '3U');
  assert.equal(higher.lastReason, 'eyes');
  assert.equal(higher.gained[0], 1);
});

test('66 gegen leeres Blatt gibt 3, Partie endet am Ziel', () => {
  const table = E.fromPosition({
    trump: 1,
    stock: [],
    trumpCard: null,
    points: [60, 0],
    tricks: [2, 0],
    turn: 0,
    scores: [6, 0],
    target: 7,
    hands: [[C(0, 'A')], [C(2, 'U')]],
  });
  E.playCard(table, 0, '0A');
  E.playCard(table, 1, '2U');
  assert.equal(table.lastReason, '66');
  assert.equal(table.gained[0], 3);
  assert.equal(table.phase, 'matchEnd');
  assert.equal(table.doppel, true);
  assert.equal(table.winner, 0);
});

test('eine Partie läuft mit der Mitspielerin zu Ende', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const rng = E.mulberry32(seed);
    const table = E.newTable({ target: 7 }, rng);
    let guard = 0;
    while (!table.over && guard < 800) {
      guard += 1;
      const seat = table.turn;
      if (table.phase !== 'play') break;
      const action = AI.choose(table, seat, 'kneipe', rng);
      const res = E.applyAction(table, seat, action);
      assert.equal(res.ok, true, seed + ' ' + (res.reason || ''));
      if (table.phase === 'handEnd') E.nextHand(table, rng);
    }
    assert.equal(table.over, true, 'seed ' + seed);
    assert.ok(table.scores[table.winner] >= 7);
  }
});
