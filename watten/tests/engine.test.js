/* Watten: Kritische, Schlag, Bieten, drei Stiche. Aufruf über `node --test tests/`. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/watten/js/engine.js');
const AI = require('../../public/watten/js/ai.js');

function C(suit, rank) { return { suit: suit, rank: rank, id: String(suit) + rank }; }
function W() { return { suit: 3, rank: 'W', id: 'W', weli: true }; }
function ids(cards) { return cards.map((c) => c.id).sort(); }

test('32er und 33er Blatt, Weli nur im großen', () => {
  assert.equal(E.freshDeck('33').length, 33);
  assert.equal(E.freshDeck('32').length, 32);
  assert.equal(E.freshDeck('33').some((c) => c.id === 'W'), true);
  assert.equal(E.freshDeck('32').some((c) => c.id === 'W'), false);
  assert.equal(E.normalizeTarget(undefined), 15);
  assert.equal(E.normalizeTarget('13'), 13);
  assert.equal(E.normalizeTarget('custom', 11), 11);
  assert.equal(E.teamOf(0), 0);
  assert.equal(E.teamOf(2), 0);
  assert.equal(E.teamOf(1), 1);
  assert.equal(E.partnerOf(0), 2);
});

test('Geben: fünf Karten, Vorhand sagt den Schlag an, der Geber die Farbe', () => {
  const rng = E.mulberry32(9);
  const table = E.newTable({ deck: '33', dealer: 3 }, rng);
  assert.equal(table.dealer, 3);
  assert.equal(table.forehand, 0);
  assert.equal(table.phase, 'schlag');
  assert.equal(table.turn, 0);
  for (let s = 0; s < 4; s++) assert.equal(table.hands[s].length, 5);
  assert.equal(table.stockCount, 13);
  const small = E.newTable({ deck: '32', dealer: 0 }, E.mulberry32(2));
  assert.equal(small.stockCount, 12);
  const again = E.newTable({ deck: '33', dealer: 3 }, E.mulberry32(9));
  assert.deepEqual(again.hands[0].map((c) => c.id), table.hands[0].map((c) => c.id));
});

test('Max schlägt Belle und Spitz, Haube schlägt die anderen Schläge, der erste Schlag bleibt', () => {
  const table = E.fromPosition({
    critical: 'bayern',
    deck: '33',
    schlag: 'K',
    trump: 1,
    phase: 'play',
  });
  assert.equal(E.criticalRole(C(2, 'K'), table), 'max');
  assert.equal(E.criticalRole(C(3, '7'), table), 'belle');
  assert.equal(E.criticalRole(C(0, '7'), table), 'spitz');
  assert.equal(E.isHaube(C(1, 'K'), table), true);
  assert.equal(E.isSchlag(C(2, 'K'), table), false);
  assert.equal(E.isSchlag(C(3, 'K'), table), true);
  const trick = [
    { seat: 0, card: C(1, 'U') },
    { seat: 1, card: C(3, 'K') },
    { seat: 2, card: C(1, 'K') },
    { seat: 3, card: C(2, 'K') },
  ];
  assert.equal(E.trickWinner(trick, table), 3);
  const schlaege = [
    { seat: 0, card: C(3, 'K') },
    { seat: 1, card: C(0, 'K') },
    { seat: 2, card: C(1, '9') },
    { seat: 3, card: C(3, 'A') },
  ];
  assert.equal(E.trickWinner(schlaege, table), 0);
  const trump = [
    { seat: 0, card: C(0, 'A') },
    { seat: 1, card: C(0, '10') },
    { seat: 2, card: C(1, '7') },
    { seat: 3, card: C(3, 'A') },
  ];
  assert.equal(E.trickWinner(trump, table), 2);
  const suit = [
    { seat: 0, card: C(0, '10') },
    { seat: 1, card: C(0, 'A') },
    { seat: 2, card: C(3, 'O') },
    { seat: 3, card: C(2, '10') },
  ];
  assert.equal(E.trickWinner(suit, table), 1);
});

test('Tirol: der Weli ist die Belle und sonst die kleinste Schelle', () => {
  const tirol = E.fromPosition({ critical: 'tirol', deck: '33', schlag: 'A', trump: 3, phase: 'play' });
  assert.equal(E.criticalRole(W(), tirol), 'belle');
  assert.equal(E.criticalRole(C(3, '7'), tirol), '');
  assert.equal(E.isTrumpCard(C(3, '7'), tirol), true);
  const bayern = E.fromPosition({ critical: 'bayern', deck: '33', schlag: 'A', trump: 0, phase: 'play' });
  assert.equal(E.isTrumpCard(W(), bayern), false);
  assert.equal(E.classOf(W(), bayern).cat, 0);
  assert.equal(E.classOf(W(), bayern).suit, 3);
  const fallen = E.rulesFrom({ critical: 'tirol', deck: '32' });
  assert.equal(fallen.critical, 'bayern');
});

test('Haube verlangt Trumpf oder Kritisch, bis ein Kritischer liegt', () => {
  const table = E.fromPosition({
    critical: 'bayern',
    schlag: 'K',
    trump: 1,
    phase: 'play',
    turn: 1,
    tricksPlayed: 0,
    trick: [{ seat: 0, card: C(1, 'K') }],
    hands: [
      [],
      [C(1, '9'), C(0, 'A'), C(2, 'K')],
      [C(3, '8'), C(1, 'U')],
      [C(3, 'A'), C(0, '10')],
    ],
  });
  assert.deepEqual(ids(E.legalCards(table, 1)), ['19', '2K'].sort());
  table.turn = 3;
  assert.deepEqual(ids(E.legalCards(table, 3)), ['010', '3A'].sort());
  table.turn = 1;
  E.applyAction(table, 1, { type: 'card', id: '2K' });
  assert.equal(table.turn, 2);
  assert.deepEqual(ids(E.legalCards(table, 2)), ['1U', '38'].sort());
});

test('Schlag und Trumpf, Schlagwechsel, drei Stiche schreiben 2', () => {
  const rng = E.mulberry32(1);
  const table = E.newTable({ dealer: 3, critical: 'none', maschine: false, schlagwechsel: true, gespannt: false }, rng);
  assert.equal(E.applyAction(table, 0, { type: 'swap' }).ok, true);
  assert.equal(table.phase, 'swap');
  assert.equal(E.applyAction(table, 3, { type: 'decline' }).ok, true);
  const rank = AI.choose(table, 0, 'kneipe', rng);
  assert.equal(E.applyAction(table, 0, rank).ok, true);
  assert.equal(table.phase, 'trump');
  assert.equal(table.turn, 3);
  assert.equal(E.applyAction(table, 3, { type: 'trump', suit: 1 }).ok, true);
  assert.equal(table.phase, 'bieten');
  assert.equal(E.applyAction(table, 0, { type: 'spielen' }).ok, true);
  assert.equal(table.turn, 0);
  assert.equal(table.stake, 2);
  let guard = 0;
  while (table.phase === 'play' && guard < 30) {
    guard += 1;
    const seat = table.turn;
    const card = E.legalCards(table, seat)[0];
    const res = E.applyAction(table, seat, { type: 'card', id: card.id });
    assert.equal(res.ok, true, res.reason);
  }
  assert.equal(table.phase === 'handEnd' || table.phase === 'matchEnd', true);
  assert.equal(table.gained[0] + table.gained[1], 2);
  assert.ok(table.tricksWon[0] >= 3 || table.tricksWon[1] >= 3);
});

test('Bieten: Halten erhöht, Gehen schreibt den alten Wert', () => {
  const fold = E.fromPosition({
    phase: 'bieten',
    turn: 0,
    forehand: 0,
    dealer: 3,
    schlag: 'A',
    trump: 0,
    stake: 2,
    gespannt: false,
    hands: [[C(0, 'A')], [C(1, 'A')], [C(2, 'A')], [C(3, 'A')]],
  });
  assert.equal(E.applyAction(fold, 0, { type: 'bieten' }).ok, true);
  assert.equal(fold.phase, 'raise');
  assert.equal(fold.stake, 2);
  assert.equal(E.applyAction(fold, fold.turn, { type: 'gehen' }).ok, true);
  assert.equal(fold.scores[0], 2);
  assert.equal(fold.phase, 'handEnd');

  const hold = E.fromPosition({
    phase: 'bieten',
    turn: 0,
    forehand: 0,
    dealer: 3,
    schlag: 'O',
    trump: 2,
    stake: 2,
    gespannt: false,
    hands: [[C(0, 'A')], [C(1, 'A')], [C(2, 'A')], [C(3, 'A')]],
  });
  E.applyAction(hold, 0, { type: 'bieten' });
  const who = hold.turn;
  assert.equal(E.applyAction(hold, who, { type: 'halten' }).ok, true);
  assert.equal(hold.stake, 3);
  assert.equal(hold.phase, 'bieten');
  assert.equal(E.applyAction(hold, who, { type: 'spielen' }).ok, true);
  assert.equal(hold.phase, 'play');
  assert.equal(hold.stake, 3);
});

test('gespannt ab 13 bei 15: nicht bieten, Gehen gibt 2, Halten spielt um 3', () => {
  const rng = E.mulberry32(5);
  const table = E.newTable({ dealer: 3, scores: [13, 4], target: 15, critical: 'none', maschine: false, schlagwechsel: false }, rng);
  E.applyAction(table, 0, { type: 'schlag', rank: 'A' });
  E.applyAction(table, 3, { type: 'trump', suit: 0 });
  assert.equal(table.phase, 'concede');
  assert.equal(E.teamOf(table.turn), 0);
  assert.equal(E.canRaise(table, table.turn), false);
  const go = E.fromPosition({
    phase: 'concede',
    turn: 0,
    forehand: 0,
    scores: [13, 4],
    target: 15,
    schlag: 'A',
    trump: 0,
    critical: 'none',
  });
  E.applyAction(go, 0, { type: 'gehen' });
  assert.equal(go.scores[1], 6);
  assert.equal(go.gained[1], 2);

  const stay = E.fromPosition({
    phase: 'concede',
    turn: 2,
    forehand: 0,
    scores: [4, 14],
    target: 15,
    schlag: 'U',
    trump: 1,
    critical: 'none',
    hands: [[C(0, 'A')], [C(1, 'K')], [C(2, 'A')], [C(3, 'A')]],
  });
  E.applyAction(stay, 2, { type: 'halten' });
  assert.equal(stay.phase, 'play');
  assert.equal(stay.stake, 3);
  assert.equal(stay.turn, 0);
});

test('Maschine mit den drei Kritischen schreibt sofort 2', () => {
  const table = E.fromPosition({
    phase: 'trump',
    turn: 3,
    forehand: 0,
    dealer: 3,
    schlag: 'A',
    critical: 'bayern',
    maschine: true,
    scores: [0, 0],
    target: 15,
    hands: [
      [C(2, 'K'), C(3, '7'), C(0, '7'), C(1, '9'), C(1, '8')],
      [C(1, 'A'), C(1, 'K'), C(1, 'O'), C(1, 'U'), C(1, '10')],
      [C(2, 'A')],
      [C(3, 'A')],
    ],
  });
  const res = E.applyAction(table, 3, { type: 'trump', suit: 1 });
  assert.equal(res.ok, true);
  assert.equal(res.events.some((e) => e.type === 'maschine'), true);
  assert.equal(table.scores[0], 2);
  assert.equal(table.phase, 'handEnd');
});

test('Ziel 13 und eine ganze Partie mit den Mitspielern', () => {
  assert.equal(E.gespanntTeams(E.fromPosition({ scores: [11, 2], target: 13 })).join(), '0');
  for (let seed = 1; seed <= 6; seed++) {
    const rng = E.mulberry32(seed + 20);
    const table = E.newTable({ target: 4, deck: seed % 2 ? '33' : '32', critical: seed % 2 ? 'tirol' : 'bayern' }, rng);
    let guard = 0;
    while (!table.over && guard < 600) {
      guard += 1;
      if (table.phase === 'handEnd') {
        E.nextHand(table, rng);
        continue;
      }
      const seat = table.turn;
      const action = AI.choose(table, seat, 'kneipe', rng);
      const res = E.applyAction(table, seat, action);
      assert.equal(res.ok, true, seed + ' ' + table.phase + ' ' + (res.reason || '') + ' ' + JSON.stringify(action));
    }
    assert.equal(table.over, true, 'seed ' + seed);
    assert.ok(table.scores[table.winner] >= 4);
  }
});
