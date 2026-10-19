/* Regeltests Rommé. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/romme/js/engine.js');

const rules = () => E.normalizeRules({});
const strict = () => E.normalizeRules({ jokerLayout: 'strict' });

function state(partial) {
  return E.makeState(Object.assign({ rules: rules() }, partial));
}

test('Blatt: 110 Karten mit 6 Jokern, 108 mit 4', () => {
  const full = E.createDeck(6);
  assert.equal(full.length, 110);
  assert.equal(new Set(full).size, 110);
  assert.equal(full.filter(E.isJoker).length, 6);
  const small = E.createDeck(4);
  assert.equal(small.length, 108);
  assert.equal(small.filter(E.isJoker).length, 4);
  assert.equal(E.deadwoodPoints('JK#0'), 20);
  assert.equal(E.deadwoodPoints('HA#0'), 11);
  assert.equal(E.deadwoodPoints('SK#1'), 10);
  assert.equal(E.deadwoodPoints('D7#0'), 7);
});

test('Geben: 13 Karten, Geber 14, Geber beginnt ohne Ziehen', () => {
  const s = E.newGame({ dealer: 3, rng: E.seededRng(4), cut: false });
  assert.deepEqual(s.hands.map((h) => h.length), [13, 13, 13, 14]);
  const all = s.hands.flat().concat(s.stock, s.discard);
  assert.equal(all.length, 110);
  assert.equal(new Set(all).size, 110);
  assert.equal(s.turn, 3);
  assert.equal(s.phase, 'meld');
  assert.equal(s.stock.length, 110 - 53);
});

test('Joker beim Abheben bleibt beim Spieler rechts vom Geber', () => {
  const deck = E.createDeck(6);
  const joker = deck.splice(deck.indexOf('JK#2'), 1)[0];
  deck.unshift(joker);
  const kept = E.newGame({ dealer: 0, deck: deck, rng: () => 0, rules: { keepCutJoker: true } });
  assert.equal(kept.cut.seat, 3);
  assert.equal(kept.cut.card, 'JK#2');
  assert.ok(kept.hands[3].includes('JK#2'));
  const off = E.newGame({ dealer: 0, deck: deck.slice(), rng: () => 0, rules: { keepCutJoker: false } });
  assert.equal(off.cut.card, null);
  assert.equal(off.hands.flat().concat(off.stock).filter((c) => c === 'JK#2').length, 1);
});

test('Sätze und Reihen, Ass niedrig oder hoch, Ecke nur auf Wunsch', () => {
  const house = rules();
  assert.equal(E.isSet(['HK#0', 'SK#0'], house), false);
  assert.equal(E.isSet(['HK#0', 'SK#0', 'DK#0'], house), true);
  assert.equal(E.isSet(['HK#0', 'HK#1', 'SK#0'], house), false);
  assert.equal(E.isSet(['HK#0', 'SK#0', 'JK#0'], house), true);
  assert.equal(E.isSet(['HK#0', 'JK#0', 'JK#1'], house), false);
  assert.equal(E.isRun(['H7#0', 'H8#0', 'H9#0'], house), true);
  assert.equal(E.isRun(['HA#0', 'H2#0', 'H3#0'], house), true);
  assert.equal(E.buildMeld(['HA#0', 'H2#0', 'H3#0'], house).points, 6);
  assert.equal(E.buildMeld(['HQ#0', 'HK#0', 'HA#0'], house).points, 31);
  assert.equal(E.isRun(['HK#0', 'HA#0', 'H2#0'], house), false);
  const corner = E.normalizeRules({ corner: true });
  const around = E.buildMeld(['HK#0', 'HA#0', 'H2#0'], corner);
  assert.ok(around);
  assert.equal(around.points, 23);
  assert.equal(E.buildMeld(['H7#0', 'JK#0', 'H9#0'], house).points, 24);
  assert.equal(E.buildMeld(['H7#0', 'JK#0', 'H9#0'], house).slots[1].rank, '8');
});

test('Joker nebeneinander: Hausregel ab vier Karten, Verband gar nicht', () => {
  const house = rules();
  const hard = strict();
  assert.equal(E.isRun(['H7#0', 'JK#0', 'JK#1'], house), false);
  assert.equal(E.isRun(['H7#0', 'JK#0', 'JK#1'], hard), false);
  assert.equal(E.isRun(['H7#0', 'JK#0', 'JK#1', 'H10#0'], house), true);
  assert.equal(E.isRun(['H7#0', 'JK#0', 'JK#1', 'H10#0'], hard), false);
  assert.equal(E.isRun(['H7#0', 'JK#0', 'H9#0', 'JK#1'], hard), true);
  assert.equal(E.isSet(['HK#0', 'JK#0', 'JK#1', 'JK#2'], house), true);
  assert.equal(E.isSet(['HK#0', 'JK#0', 'JK#1', 'JK#2'], hard), false);
});

test('Herauskommen ab 40, darunter kommen die Karten zurück', () => {
  const low = state({
    hand: ['HK#0', 'SK#0', 'DK#0', 'C2#0', 'C3#0'],
    phase: 'meld',
  });
  assert.equal(E.lay(low, 0, ['HK#0', 'SK#0', 'DK#0']).ok, true);
  assert.equal(low.opened[0], false);
  assert.equal(E.discard(low, 0, 'C2#0').ok, true);
  assert.equal(low.melds.length, 0);
  assert.equal(low.hands[0].length, 4);
  assert.equal(low.turn, 1);
  assert.equal(low.phase, 'draw');

  const enough = state({
    hand: ['HA#0', 'SA#0', 'DA#0', 'CA#0', 'C2#0'],
  });
  assert.equal(E.lay(enough, 0, ['HA#0', 'SA#0', 'DA#0', 'CA#0']).ok, true);
  assert.equal(enough.melds[0].points, 44);
  assert.equal(enough.opened[0], true);
  assert.equal(E.discard(enough, 0, 'C2#0').ok, true);
  assert.equal(enough.melds.length, 1);
});

test('Anlegen erst nach der Erstmeldung, Joker tauschen und voller Satz', () => {
  const s = state({
    hand: ['HA#0', 'SA#0', 'DA#0', 'CA#0', 'H7#0', 'C2#0'],
  });
  assert.equal(E.lay(s, 0, ['H7#0', 'C2#0']).ok, false);
  E.lay(s, 0, ['HA#0', 'SA#0', 'DA#0', 'CA#0']);
  const other = E.makeState({
    rules: rules(),
    hand: ['H8#0', 'C3#0'],
    melds: [s.melds[0]],
    opened: [true, false, false, false],
    openedAtStart: [true, false, false, false],
  });
  assert.equal(E.layoff(other, 0, other.melds[0].id, ['H8#0']).ok, false);

  const run = E.buildMeld(['H7#0', 'H8#0', 'JK#0'], rules());
  run.id = 1;
  run.owner = 1;
  const swap = E.makeState({
    rules: rules(),
    hands: [['H9#0', 'C4#0'], [], [], []],
    melds: [run],
    opened: [true, true, false, false],
    openedAtStart: [true, true, false, false],
  });
  assert.equal(E.swapJoker(swap, 0, 1, 'JK#0', 'H9#0').ok, true);
  assert.deepEqual(swap.held, ['JK#0']);
  assert.equal(E.discard(swap, 0, 'C4#0').ok, false);
  assert.equal(E.lay(swap, 0, ['JK#0', 'C4#0']).ok, false);
  const laid = E.layoff(swap, 0, 1, ['JK#0']);
  assert.equal(laid.ok, true);
  assert.equal(E.discard(swap, 0, 'C4#0').ok, true);

  const early = E.makeState({
    rules: E.normalizeRules({ fullSetToSwap: true }),
    hands: [['DK#0', 'C5#0'], [], [], []],
    opened: [true, false, false, false],
    openedAtStart: [true, false, false, false],
    melds: [Object.assign(E.buildMeld(['HK#0', 'SK#0', 'JK#1'], rules()), { id: 2, owner: 2 })],
  });
  assert.equal(E.swapJoker(early, 0, 2, 'JK#1', 'DK#0').ok, false);
  early.rules = E.normalizeRules({ fullSetToSwap: false });
  assert.equal(E.swapJoker(early, 0, 2, 'JK#1', 'DK#0').ok, true);
});

test('Ablage nur bei sofortiger Verwendung, letzte Karte nur vom Talon', () => {
  const open = state({
    phase: 'draw',
    hand: ['H5#0', 'H6#0', 'C9#0'],
    discard: ['H7#0'],
    opened: [true, false, false, false],
  });
  assert.equal(E.canTakeDiscard(open, 0), true);
  assert.equal(E.drawDiscard(open, 0).ok, true);
  assert.equal(open.mustUse, 'H7#0');
  assert.equal(E.discard(open, 0, 'C9#0').ok, false);
  assert.equal(E.lay(open, 0, ['H5#0', 'H6#0', 'H7#0']).ok, true);
  assert.equal(E.discard(open, 0, 'C9#0').ok, true);

  const last = state({
    phase: 'draw',
    hand: ['C3#0'],
    discard: ['HK#0'],
    stock: ['D4#0'],
    opened: [true, false, false, false],
  });
  assert.equal(E.canTakeDiscard(last, 0), false);
  assert.equal(E.drawDiscard(last, 0).ok, false);
  assert.equal(E.drawStock(last, 0).card, 'D4#0');
});

test('Joker nur als letzte Karte, Talon wird ohne die oberste Ablage neu gemischt', () => {
  const s = state({ hand: ['JK#0', 'C6#0'], opened: [true, false, false, false], openedAtStart: [true, false, false, false] });
  assert.equal(E.discard(s, 0, 'JK#0').ok, false);
  assert.equal(E.discard(s, 0, 'C6#0').ok, true);

  const only = state({ hand: ['JK#1'], opened: [true, false, false, false], openedAtStart: [true, false, false, false] });
  const done = E.discard(only, 0, 'JK#1');
  assert.equal(done.ok, true);
  assert.equal(done.out, true);

  const recycle = state({
    phase: 'draw',
    hand: ['C2#0'],
    stock: [],
    discard: ['H2#0', 'H3#0', 'H4#0', 'HK#0'],
    rng: () => 0,
  });
  const drawn = E.drawStock(recycle, 0);
  assert.equal(drawn.ok, true);
  assert.equal(E.topCard(recycle), 'HK#0');
  assert.ok(['H2#0', 'H3#0', 'H4#0'].includes(drawn.card));
  assert.equal(recycle.stock.length + 1, 3);
});

test('Hand-Rommé hebt die 40 auf und verdoppelt die Schlechtpunkte', () => {
  const s = state({
    hands: [
      ['H4#0', 'S4#0', 'D4#0', 'C2#0'],
      ['HK#0'],
      ['HA#0'],
      ['JK#0'],
    ],
  });
  assert.equal(E.lay(s, 0, ['H4#0', 'S4#0', 'D4#0']).ok, true);
  assert.equal(s.opened[0], false);
  const res = E.discard(s, 0, 'C2#0');
  assert.equal(res.out, true);
  assert.equal(res.result.kind, 'hand');
  assert.equal(res.result.multiplier, 2);
  assert.equal(res.result.rows[1].penalty, 20);
  assert.equal(res.result.rows[2].penalty, 22);
  assert.equal(res.result.rows[3].penalty, 40);
  assert.equal(res.result.rows[0].penalty, 0);
  assert.equal(res.result.award[0], 8);
});

test('Rückgängig bis zum Abwurf, Räuber löst Figuren auf', () => {
  const s = state({ hand: ['HA#0', 'SA#0', 'DA#0', 'CA#0', 'C2#0'] });
  E.lay(s, 0, ['HA#0', 'SA#0', 'DA#0', 'CA#0']);
  assert.equal(E.undo(s, 0).ok, true);
  assert.equal(s.melds.length, 0);
  assert.equal(s.hands[0].length, 5);
  assert.equal(E.dissolve(s, 0, 1).ok, false);

  const meld = Object.assign(E.buildMeld(['H6#0', 'H7#0', 'H8#0'], rules()), { id: 4, owner: 1 });
  const robber = E.makeState({
    rules: E.normalizeRules({ robber: true }),
    hand: ['H9#0', 'C3#0'],
    melds: [meld],
    opened: [true, true, false, false],
    openedAtStart: [true, true, false, false],
  });
  assert.equal(E.dissolve(robber, 0, 4).ok, true);
  assert.deepEqual(robber.workspace, ['H6#0', 'H7#0', 'H8#0']);
  assert.equal(E.discard(robber, 0, 'C3#0').ok, false);
  assert.equal(E.lay(robber, 0, ['H6#0', 'H7#0', 'H8#0']).ok, true);
  assert.equal(E.discard(robber, 0, 'C3#0').ok, true);
});

test('Partie: niedrigste Schlechtpunkte ab 500, Gleichstand spielt weiter', () => {
  assert.equal(E.matchWinner([100, 80, 40, 20], { target: 500, handsPlayed: 3 }), null);
  assert.equal(E.matchWinner([500, 200, 100, 50], { target: 500 }), 3);
  assert.equal(E.matchWinner([500, 40, 40, 90], { target: 500 }), null);
  assert.equal(E.matchWinner([10, 8, 8, 4], { endMode: 'rounds', rounds: 4, handsPlayed: 4 }), 3);
  assert.equal(E.matchWinner([9, 9, 1, 1], { scoring: 'tournament', target: 8 }), null);
  assert.equal(E.matchWinner([3, 9, 1, 4], { scoring: 'tournament', target: 8 }), 1);
  assert.equal(E.normalizeTarget('custom', 750), 750);
  assert.equal(E.gradeEyes(5), 4);
  assert.equal(E.gradeEyes(80), 1);
  assert.equal(E.gradeEyes(81), 0);
});
