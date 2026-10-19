/* Regeltests Schwimmen. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/schwimmen/js/engine.js');

function rules(extra) {
  return E.normalizeRules(Object.assign({ opponents: 3 }, extra || {}));
}

test('Voreinstellung ist Schwimmen mit drei Leben und ohne Einsatz', () => {
  const r = E.normalizeRules({});
  assert.equal(r.opponents, 3);
  assert.equal(r.lives, 3);
  assert.equal(r.swim, true);
  assert.equal(r.schieben, true);
  assert.equal(r.schiebenMode, 'once');
  assert.equal(r.allSwap, true);
  assert.equal(r.instant31, true);
  assert.equal(r.feuerInstant, true);
  assert.equal(r.feuerCost, 1);
  assert.equal(r.knockPenalty, false);
  assert.equal(r.knockFrom, 'anytime');
  assert.equal(r.maxHands, 0);
  assert.equal(r.deck, 'french');
  assert.equal(E.deckCards().length, 32);
  assert.equal(JSON.stringify(r).includes('€'), false);
  assert.equal(E.cardPoints('HA'), 11);
  assert.equal(E.cardPoints('SK'), 10);
  assert.equal(E.cardPoints('D7'), 7);
});

test('Augen gelten nur in einer Farbe, Drilling und Feuer stehen darüber', () => {
  assert.equal(E.handScore(['H7', 'H8', 'HA']).label, '26');
  assert.equal(E.handScore(['H7', 'S8', 'HA']).label, '18');
  assert.equal(E.handScore(['HA', 'HK', 'HQ']).label, '31');
  assert.equal(E.handScore(['CK', 'DK', 'SK']).label, '30½');
  assert.equal(E.handScore(['CA', 'DA', 'HA']).kind, 'feuer');
  assert.equal(E.handScore(['CA', 'DA', 'HA']).value > 31, true);
  assert.equal(E.handScore(['CA', 'DA', 'HK']).kind, 'sum');
});

test('Geben teilt drei Karten, drei in die Mitte und behält das Blatt beisammen', () => {
  const match = E.blankMatch(rules(), null);
  const st = E.dealHand(match, E.seededRng(4));
  assert.equal(st.players, 4);
  assert.equal(st.hands[0].length, 3);
  assert.equal(st.hands[3].length, 3);
  assert.equal(st.middle.length, 3);
  assert.equal(st.talon.length, 32 - 15);
  assert.equal(st.phase, 'play');
  const all = st.hands.flat().concat(st.middle, st.talon);
  assert.equal(new Set(all).size, 32);
  assert.equal(match.handNo, 1);
  assert.equal(match.lives.join(','), '3,3,3,3');
});

test('eine Karte und alle drei lassen sich tauschen', () => {
  const st = E.setup({
    rules: rules(),
    hands: [['H7', 'S8', 'C9'], ['DA', 'DK', 'DQ'], ['HJ', 'SJ', 'CJ'], ['HA', 'SA', 'CA']],
    middle: ['HK', 'D8', 'S7'],
    talon: ['C8'],
    turn: 0,
  });
  assert.equal(E.apply(st, 0, { type: 'swap', card: 'H7', with: 0 }).ok, true);
  assert.equal(st.hands[0][0], 'HK');
  assert.equal(st.middle[0], 'H7');
  assert.equal(st.turn, 1);
  assert.equal(E.apply(st, 1, { type: 'swapAll' }).ok, true);
  assert.deepEqual(st.hands[1], ['H7', 'D8', 'S7']);
  assert.deepEqual(st.middle, ['DA', 'DK', 'DQ']);
});

test('schieben geht einmal je Spieler und nur mit drei Karten im Talon', () => {
  const st = E.setup({
    rules: rules(),
    hands: [['H7', 'S8', 'C9'], ['DA', 'DK', 'DQ'], ['HJ', 'SJ', 'CJ']],
    middle: ['HK', 'D8', 'S7'],
    talon: ['C8', 'D9', 'H10', 'S9', 'C10', 'HA'],
    turn: 0,
  });
  assert.equal(E.apply(st, 0, { type: 'schieben' }).ok, true);
  assert.deepEqual(st.middle, ['C8', 'D9', 'H10']);
  assert.equal(st.talon.length, 3);
  assert.equal(st.discard.length, 3);
  assert.equal(E.apply(st, 0, { type: 'schieben' }).ok, false);
  const thin = E.setup({
    rules: rules(),
    hands: [['H7', 'S8', 'C9'], ['DA', 'DK', 'DQ']],
    middle: ['HK', 'D8', 'S7'],
    talon: ['C8', 'D9'],
    turn: 0,
  });
  assert.equal(E.legalMoves(thin, 0).some((m) => m.type === 'schieben'), false);
});

test('klopfen gibt jedem anderen genau einen Zug, die niedrigste Hand verliert ein Leben', () => {
  const st = E.setup({
    rules: rules({ opponents: 2 }),
    hands: [['HA', 'H10', 'H9'], ['S7', 'C8', 'D9'], ['SK', 'SQ', 'SJ']],
    middle: ['C7', 'D8', 'H8'],
    talon: ['S8'],
    turn: 0,
  });
  assert.equal(E.handScore(st.hands[0]).label, '30');
  assert.equal(E.apply(st, 0, { type: 'knock' }).ok, true);
  assert.equal(st.phase, 'closing');
  assert.equal(st.knocker, 0);
  assert.equal(st.turn, 1);
  assert.equal(E.legalMoves(st, 1).some((m) => m.type === 'knock'), false);
  assert.equal(E.apply(st, 1, { type: 'swap', card: 'S7', with: 0 }).ok, true);
  assert.equal(st.turn, 2);
  assert.equal(E.apply(st, 2, { type: 'swap', card: 'SK', with: 1 }).ok, true);
  assert.equal(st.phase, 'done');
  assert.equal(st.reason, 'showdown');
  assert.deepEqual(st.losers, [1]);
  const match = E.blankMatch(rules({ opponents: 2 }));
  assert.equal(E.scoreHand(match, st), true);
  assert.deepEqual(match.lives, [3, 2, 3]);
  assert.equal(match.winner, null);
});

test('bei Gleichstand verliert niemand ein Leben', () => {
  const st = E.setup({
    rules: rules({ opponents: 1 }),
    hands: [['H7', 'S8', 'C9'], ['D7', 'C8', 'S9']],
    middle: ['H8', 'D9', 'C7'],
    turn: 0,
  });
  E.apply(st, 0, { type: 'knock' });
  E.apply(st, 1, { type: 'swap', card: 'D7', with: 0 });
  assert.equal(E.handScore(st.hands[0]).value, E.handScore(st.hands[1]).value);
  assert.equal(st.reason, 'push');
  assert.deepEqual(st.losers, []);
});

test('31 und Feuer beenden sofort, Feuer kostet auf Wunsch zwei Leben', () => {
  const thirty = E.setup({
    rules: rules({ opponents: 1 }),
    hands: [['H9', 'S8', 'C7'], ['DA', 'DK', 'DQ']],
    middle: ['HA', 'HK', 'HQ'],
    turn: 0,
  });
  assert.equal(E.apply(thirty, 0, { type: 'swapAll' }).ok, true);
  assert.equal(thirty.phase, 'done');
  assert.equal(thirty.reason, '31');
  assert.deepEqual(thirty.losers, [1]);
  const fire = E.setup({
    rules: rules({ opponents: 1, feuerCost: 2 }),
    hands: [['C9', 'D8', 'S7'], ['HK', 'HQ', 'HJ']],
    middle: ['CA', 'DA', 'HA'],
    turn: 0,
  });
  assert.equal(E.apply(fire, 0, { type: 'swapAll' }).ok, true);
  assert.equal(fire.reason, 'feuer');
  const match = E.blankMatch(rules({ opponents: 1, feuerCost: 2 }));
  E.scoreHand(match, fire);
  assert.deepEqual(match.lives, [3, 1]);
});

test('drei Leben, dann Schwimmen, dann raus', () => {
  const match = E.blankMatch(rules({ opponents: 1 }));
  E.applyLoss(match, 1, 1);
  E.applyLoss(match, 1, 1);
  E.applyLoss(match, 1, 1);
  assert.equal(match.lives[1], 0);
  assert.equal(match.swimming[1], true);
  assert.equal(match.out[1], false);
  E.applyLoss(match, 1, 1);
  assert.equal(match.out[1], true);
  const st = E.dealHand(match, E.seededRng(2));
  assert.equal(st.phase, 'done');
  assert.equal(st.reason, 'match');
});

test('klopfen erst nach einem Zug und die frische Mitte nur einmal schieben', () => {
  const st = E.setup({
    rules: rules({ opponents: 1, knockFrom: 'acted', schiebenMode: 'fresh' }),
    hands: [['H7', 'S8', 'C9'], ['DA', 'DK', 'DQ']],
    middle: ['HK', 'D8', 'S7'],
    talon: ['C8', 'D9', 'H10', 'S9', 'C10', 'HA'],
    turn: 0,
  });
  assert.equal(E.legalMoves(st, 0).some((m) => m.type === 'knock'), false);
  assert.equal(E.apply(st, 0, { type: 'schieben' }).ok, true);
  assert.equal(E.legalMoves(st, 1).some((m) => m.type === 'schieben'), false);
  assert.equal(E.legalMoves(st, 1).some((m) => m.type === 'knock'), true);
});
