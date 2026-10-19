/* Regeltests Canasta. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('assert');
const E = require('../../public/canasta/js/engine.js');

function aces(n) {
  const out = [];
  const suits = ['H', 'S', 'D', 'C'];
  for (let i = 0; i < n; i++) out.push(suits[i % 4] + 'A#' + (i < 4 ? 0 : 1));
  return out;
}
function kings(n) {
  const out = [];
  const suits = ['H', 'S', 'D', 'C'];
  for (let i = 0; i < n; i++) out.push(suits[i % 4] + 'K#' + (i < 4 ? 0 : 1));
  return out;
}
function sevens(n) {
  const out = [];
  const suits = ['H', 'S', 'D', 'C'];
  for (let i = 0; i < n; i++) out.push(suits[i % 4] + '7#' + (i < 4 ? 0 : 1));
  return out;
}

function atMeld(partial) {
  const s = E.blankState(partial && partial.rules, partial && partial.scores);
  if (partial && partial.scores) s.scoresBefore = partial.scores.slice();
  s.hands[0] = (partial.hand || []).slice();
  if (partial.melds) s.melds = partial.melds;
  if (partial.reds) s.reds = partial.reds;
  if (partial.discard) s.discard = partial.discard.slice();
  if (partial.frozen) s.frozen = true;
  if (partial.stock) s.stock = partial.stock.slice();
  E.noteTurnStart(s, partial.seat || 0);
  if (partial.phase) s.phase = partial.phase;
  else s.phase = 'meld';
  s.handAtTurnStart = s.hands[s.turn].slice();
  return s;
}

test('Blatt: 108 Karten, vier Joker, acht Zweien, vier rote und vier schwarze Dreien', () => {
  const d = E.createDeck();
  assert.strictEqual(d.length, 108);
  assert.strictEqual(new Set(d).size, 108);
  assert.strictEqual(d.filter(E.isJoker).length, 4);
  assert.strictEqual(d.filter((c) => E.rankOf(c) === '2').length, 8);
  assert.strictEqual(d.filter(E.isRedThree).length, 4);
  assert.strictEqual(d.filter(E.isBlackThree).length, 4);
  assert.strictEqual(E.cardPoints('JK#0'), 50);
  assert.strictEqual(E.cardPoints('H2#0'), 20);
  assert.strictEqual(E.cardPoints('SA#1'), 20);
  assert.strictEqual(E.cardPoints('DK#0'), 10);
  assert.strictEqual(E.cardPoints('C8#1'), 10);
  assert.strictEqual(E.cardPoints('H4#0'), 5);
  assert.strictEqual(E.cardPoints('S3#0'), 5);
});

test('Geben: jeder 11, keine rote Drei bleibt auf der Hand, alles eindeutig', () => {
  const s = E.newGame({ dealer: 3, rng: E.seededRng(7) });
  assert.deepStrictEqual(s.hands.map((h) => h.length), [11, 11, 11, 11]);
  const all = s.hands.flat().concat(s.stock, s.discard, s.reds.flat());
  assert.strictEqual(all.length, 108);
  assert.strictEqual(new Set(all).size, 108);
  for (const h of s.hands) assert.strictEqual(h.some(E.isRedThree), false);
  assert.strictEqual(s.turn, 0);
  assert.strictEqual(s.phase, 'draw');
  assert.ok(E.topCard(s));
  assert.strictEqual(E.isWild(E.topCard(s)) || E.isRedThree(E.topCard(s)), false);
});

test('Aufdecken: Joker und rote Drei frieren ein, bis eine natürliche Karte oben liegt', () => {
  const deck = E.createDeck().filter((c) => c !== 'JK#0' && c !== 'H3#0' && c !== 'SK#0');
  deck.push('SK#0', 'H3#0', 'JK#0');
  const s = E.newGame({ dealer: 3, deck: deck });
  assert.strictEqual(E.topCard(s), 'SK#0');
  assert.strictEqual(s.frozen, true);
  assert.ok(s.discard.indexOf('JK#0') !== -1);
  assert.ok(s.discard.indexOf('H3#0') !== -1);
  assert.strictEqual(s.hands.some((h) => h.indexOf('H3#0') !== -1), false);
});

test('Meldungen: zwei natürliche, höchstens drei wilde, kein reiner Wilder-Satz', () => {
  const rules = E.normalizeRules({});
  assert.strictEqual(E.validateNewMeld(['HK#0', 'SK#0'], rules).ok, false);
  assert.strictEqual(E.validateNewMeld(['HK#0', 'SK#0', 'DK#0'], rules).ok, true);
  assert.strictEqual(E.validateNewMeld(['HK#0', 'SK#0', 'H2#0'], rules).ok, true);
  assert.strictEqual(E.validateNewMeld(['HK#0', 'JK#0', 'JK#1'], rules).ok, false);
  assert.strictEqual(E.validateNewMeld(['JK#0', 'JK#1', 'H2#0'], rules).ok, false);
  assert.strictEqual(E.validateNewMeld(['HK#0', 'SK#0', 'JK#0', 'JK#1', 'JK#2', 'JK#3'], rules).ok, false);
  assert.strictEqual(E.validateNewMeld(['S3#0', 'C3#0', 'S3#1'], rules).ok, false);
  assert.strictEqual(E.validateNewMeld(['HK#0', 'SK#0', 'HQ#0'], rules).ok, false);
  const vienna = E.normalizeRules({ wildMajority: true });
  assert.strictEqual(E.validateNewMeld(['HK#0', 'SK#0', 'H2#0', 'D2#0', 'C2#0'], vienna).ok, false);
  assert.strictEqual(E.validateNewMeld(['HK#0', 'SK#0', 'DK#0', 'H2#0', 'D2#0', 'C2#0'], vienna).ok, true);
});

test('Canasta-Bonus: rein 500, gemischt 300, eine wilde Karte macht rein zu gemischt', () => {
  assert.strictEqual(E.canastaBonus(aces(7)), 500);
  assert.strictEqual(E.canastaBonus(aces(6).concat(['JK#0'])), 300);
  assert.strictEqual(E.canastaBonus(aces(6)), 0);
  const pure = atMeld({ hand: [], melds: [[{ rank: 'A', cards: aces(7), black: false }], []] });
  pure.phase = 'done';
  let score = E.scoreState(pure);
  assert.strictEqual(score.teams[0].canasta, 500);
  assert.strictEqual(score.teams[0].pure, 1);
  assert.strictEqual(score.teams[0].cards, 140);
  const mixedCards = aces(6).concat(['JK#0']);
  const mixed = atMeld({ melds: [[{ rank: 'A', cards: mixedCards, black: false }], []] });
  score = E.scoreState(mixed);
  assert.strictEqual(score.teams[0].canasta, 300);
  assert.strictEqual(score.teams[0].mixed, 1);
  assert.strictEqual(score.teams[0].cards, 170);
});

test('Rote Dreien: 100, alle vier 800, minus ohne Meldung, Wien nur mit Canasta', () => {
  assert.strictEqual(E.redThreePoints(1, true), 100);
  assert.strictEqual(E.redThreePoints(3, true), 300);
  assert.strictEqual(E.redThreePoints(4, true), 800);
  assert.strictEqual(E.redThreePoints(4, false), -800);
  const reds = ['H3#0', 'D3#0', 'H3#1', 'D3#1'];
  const none = atMeld({ reds: [reds, []] });
  assert.strictEqual(E.scoreState(none).teams[0].red, -800);
  const opened = atMeld({
    reds: [['H3#0'], []],
    melds: [[{ rank: 'K', cards: kings(3), black: false }], []],
  });
  assert.strictEqual(E.scoreState(opened).teams[0].red, 100);
  const vienna = atMeld({
    rules: { redThrees: 'vienna' },
    reds: [['H3#0', 'D3#0'], []],
    melds: [[{ rank: 'K', cards: kings(3), black: false }], []],
  });
  assert.strictEqual(E.scoreState(vienna).teams[0].red, -200);
  vienna.melds[0][0].cards = kings(7);
  assert.strictEqual(E.scoreState(vienna).teams[0].red, 200);
});

test('Erste Meldung richtet sich nach dem Stand', () => {
  assert.strictEqual(E.minMeldFor(-10, E.normalizeRules({})), 15);
  assert.strictEqual(E.minMeldFor(0, E.normalizeRules({})), 50);
  assert.strictEqual(E.minMeldFor(1495, E.normalizeRules({})), 50);
  assert.strictEqual(E.minMeldFor(1500, E.normalizeRules({})), 90);
  assert.strictEqual(E.minMeldFor(2995, E.normalizeRules({})), 90);
  assert.strictEqual(E.minMeldFor(3000, E.normalizeRules({})), 120);
  assert.strictEqual(E.minMeldFor(4000, E.normalizeRules({ minMeld: 'fixed50' })), 50);
  const low = atMeld({ hand: kings(3), scores: [0, 0] });
  assert.strictEqual(E.meld(low, 0, [kings(3)]).ok, false);
  const enough = atMeld({ hand: aces(3).concat(['C4#0']), scores: [0, 0] });
  assert.strictEqual(E.meld(enough, 0, [aces(3)]).ok, true);
  assert.strictEqual(enough.hands[0].indexOf('C4#0') !== -1, true);
  assert.strictEqual(enough.minMet[0], true);
  const tens = ['H10#0', 'S10#0', 'D10#0'];
  const high = atMeld({ hand: aces(3).concat(kings(3), tens, ['C4#0']), scores: [3000, 0] });
  assert.strictEqual(E.meld(high, 0, [aces(3)]).ok, false);
  assert.strictEqual(E.meld(high, 0, [aces(3), kings(3), tens]).ok, true);
});

test('Ablage: offen mit Paar oder Karte plus Wilder, eingefroren nur mit zwei natürlichen', () => {
  const open = atMeld({
    phase: 'draw',
    hand: ['SK#0', 'DK#0', 'H10#0', 'S10#0', 'D10#0'],
    discard: ['C4#0', 'HK#0'],
    scores: [0, 0],
  });
  assert.strictEqual(E.isFrozenFor(open, 0), true);
  assert.strictEqual(E.takePile(open, 0, ['SK#0', 'H2#0']).ok, false);
  const taken = E.takePile(open, 0, ['SK#0', 'DK#0'], [['H10#0', 'S10#0', 'D10#0']]);
  assert.strictEqual(taken.ok, true, taken.reason);
  assert.strictEqual(open.discard.length, 0);
  assert.strictEqual(open.frozen, false);
  assert.ok(open.hands[0].indexOf('C4#0') !== -1);
  assert.strictEqual(E.findMeld(open, 0, 'K').cards.indexOf('HK#0') !== -1, true);

  const frozen = atMeld({
    phase: 'draw',
    frozen: true,
    hand: ['SK#0', 'DK#0', 'HK#1', 'SA#0', 'DA#0', 'CA#0'],
    discard: ['JK#0', 'CK#0'],
    melds: [[], []],
    scores: [0, 0],
  });
  assert.strictEqual(E.takePile(frozen, 0, ['SK#0', 'H2#1']).ok, false);
  assert.strictEqual(E.takePile(snapTake(frozen), 0, ['SK#0', 'DK#0'], [['SA#0', 'DA#0', 'CA#0']]).ok, true);

  const blocked = atMeld({
    phase: 'draw',
    hand: kings(3).concat(aces(3)),
    discard: ['HK#1', 'JK#1'],
    scores: [0, 0],
  });
  assert.strictEqual(E.takePile(blocked, 0, ['HK#0', 'SK#0']).ok, false);
  blocked.discard = ['HK#1', 'S3#0'];
  blocked.frozen = false;
  assert.strictEqual(blocked.frozen, false);
  assert.strictEqual(E.takePile(blocked, 0, ['HK#0', 'SK#0']).ok, false);

  const one = atMeld({
    phase: 'draw',
    hand: ['SK#0'],
    discard: ['HK#0'],
    melds: [[{ rank: 'K', cards: kings(6).filter((c) => c !== 'SK#0' && c !== 'HK#0'), black: false }], []],
    scores: [0, 0],
  });
  one.minMet = [true, false];
  assert.strictEqual(E.takePile(one, 0, []).ok, false);
});

function snapTake(state) { return E.snap(state); }

test('Der Rest des Stapels zählt nicht zur ersten Meldung', () => {
  const s = atMeld({
    phase: 'draw',
    hand: ['SK#0', 'DK#0'],
    discard: ['SA#0', 'DA#0', 'CA#0', 'HK#0'],
    scores: [0, 0],
  });
  const res = E.takePile(s, 0, ['SK#0', 'DK#0']);
  assert.strictEqual(res.ok, false);
  assert.strictEqual(s.discard.length, 4);
  assert.strictEqual(s.melds[0].length, 0);
});

test('Ausmachen braucht einen Canasta und leert die Hand', () => {
  const no = atMeld({ hand: sevens(3).concat(['C4#0']) });
  assert.strictEqual(E.planGoOut(no, 0), null);
  assert.strictEqual(E.discard(no, 0, 'C4#0').ok, true);
  assert.notStrictEqual(no.phase, 'done');
  const stuck = atMeld({ hand: sevens(3) });
  assert.strictEqual(E.goOut(stuck, 0, { groups: [sevens(3)], layoffs: [], discard: null }).ok, false);

  const yes = atMeld({ hand: sevens(7) });
  const plan = E.planGoOut(yes, 0);
  assert.ok(plan);
  const res = E.goOut(yes, 0, plan);
  assert.strictEqual(res.ok, true, res.reason);
  assert.strictEqual(res.concealed, true);
  assert.strictEqual(yes.phase, 'done');
  assert.strictEqual(yes.result.teams[0].goingOut, 200);
  assert.strictEqual(yes.result.teams[0].canasta, 500);
  assert.ok(yes.result.teams[0].total > 0);

  const partner = atMeld({
    hand: ['C4#0'],
    melds: [[{ rank: 'A', cards: aces(7), black: false }], []],
  });
  partner.playerMelded = [true, false, false, false];
  partner.playerMeldedAtTurnStart = [true, false, false, false];
  const dumped = E.discard(partner, 0, 'C4#0');
  assert.strictEqual(dumped.wentOut, true);
  assert.strictEqual(dumped.concealed, false);
  assert.strictEqual(partner.result.teams[0].goingOut, 100);
});

test('Ohne Canasta endet kein Zug mit null Karten', () => {
  const s = atMeld({ hand: ['C4#0'], melds: [[{ rank: 'K', cards: kings(3), black: false }], []] });
  const res = E.discard(s, 0, 'C4#0');
  assert.strictEqual(res.ok, false);
  assert.strictEqual(s.hands[0].length, 1);
  assert.notStrictEqual(s.phase, 'done');
});

test('Schwarze Dreien nur beim Ausmachen, ohne wilde Karten', () => {
  const early = atMeld({ hand: ['S3#0', 'C3#0', 'S3#1', 'HA#0', 'SA#0', 'DA#0'] });
  assert.strictEqual(E.meld(early, 0, [['S3#0', 'C3#0', 'S3#1']]).ok, false);
  const hand = ['S3#0', 'C3#0', 'S3#1'].concat(aces(7));
  const s = atMeld({ hand: hand });
  const plan = E.planGoOut(s, 0);
  assert.ok(plan);
  const flat = (plan.groups || []).concat((plan.layoffs || []).map((l) => l.cards)).flat();
  assert.ok(flat.indexOf('S3#0') !== -1);
  const res = E.goOut(s, 0, plan);
  assert.strictEqual(res.ok, true, res.reason);
  const black = s.melds[0].find((m) => m.black);
  assert.ok(black);
  assert.strictEqual(black.cards.length, 3);
  assert.ok(s.result.teams[0].cards >= 7 * 20 + 15);
});

test('Verdeckt ausmachen bringt den höheren Bonus, offen nur 100', () => {
  const open = atMeld({
    hand: sevens(3),
    melds: [[{ rank: 'A', cards: aces(7), black: false }], []],
  });
  open.playerMeldedAtTurnStart = [true, false, false, false];
  const plan = E.planGoOut(open, 0);
  assert.strictEqual(E.goOut(open, 0, plan).concealed, false);
  assert.strictEqual(open.result.teams[0].goingOut, 100);

  const hidden = atMeld({
    hand: aces(7).concat(kings(3)),
    rules: { concealedBonus: 300 },
  });
  const hp = E.planGoOut(hidden, 0);
  assert.strictEqual(E.goOut(hidden, 0, hp).concealed, true);
  assert.strictEqual(hidden.result.teams[0].goingOut, 300);
});

test('Wert der Hand wird abgezogen, gemeldete Karten zählen plus', () => {
  const s = atMeld({
    hand: ['HJ#0'],
    melds: [[{ rank: 'A', cards: aces(3), black: false }], []],
  });
  s.hands[2] = ['DK#0'];
  const score = E.scoreState(s);
  assert.strictEqual(score.teams[0].cards, 60);
  assert.strictEqual(score.teams[0].hand, 20);
  assert.strictEqual(score.teams[0].total, 40);
});

test('Partner fragen ist bindend', () => {
  const s = atMeld({ hand: aces(7), rules: { askPartner: true } });
  assert.strictEqual(E.askPartner(s, 0).ok, true);
  assert.strictEqual(s.phase, 'ask');
  assert.strictEqual(E.answerPartner(s, 1, true).ok, false);
  assert.strictEqual(E.answerPartner(s, 2, false).ok, true);
  assert.strictEqual(s.forbidGoOut, true);
  assert.strictEqual(E.planGoOut(s, 0), null);
  assert.strictEqual(E.goOut(s, 0, { groups: [aces(7)], layoffs: [], discard: null }).ok, false);
});

test('Leerer Talon beendet ohne Ausmach-Bonus, rote Drei als letzte Karte sofort', () => {
  const s = atMeld({ phase: 'draw', hand: kings(3), stock: [], discard: ['S3#0'] });
  s.frozen = false;
  assert.strictEqual(E.endHand(s, 0).ok, true);
  assert.strictEqual(s.endReason, 'stock');
  assert.strictEqual(s.result.teams[0].goingOut, 0);

  const red = atMeld({ phase: 'draw', hand: ['HK#0'], stock: ['H3#0'] });
  const drawn = E.drawStock(red, 0);
  assert.strictEqual(drawn.ended, true);
  assert.strictEqual(red.endReason, 'redThree');
  assert.strictEqual(red.result.teams[0].goingOut, 0);
  assert.strictEqual(red.reds[0].indexOf('H3#0') !== -1, true);
});

test('Zwei Canastas, wenn die Hausregel das verlangt', () => {
  const s = atMeld({
    rules: { canastasToGoOut: 2 },
    hand: sevens(7),
    melds: [[{ rank: 'A', cards: aces(6), black: false }], []],
  });
  assert.strictEqual(E.planGoOut(s, 0), null);
  s.hands[0] = sevens(7).concat(['DA#1']);
  s.handAtTurnStart = s.hands[0].slice();
  const plan = E.planGoOut(s, 0);
  assert.ok(plan);
  assert.strictEqual(E.goOut(s, 0, plan).ok, true);
  assert.ok(s.result.teams[0].canastas >= 2);
});

test('Ziel: die höhere Summe gewinnt, Gleichstand spielt weiter', () => {
  assert.strictEqual(E.matchWinner([4990, 4980], 5000), null);
  assert.strictEqual(E.matchWinner([5100, 4900], 5000), 0);
  assert.strictEqual(E.matchWinner([5000, 5200], 5000), 1);
  assert.strictEqual(E.matchWinner([5100, 5100], 5000), null);
  assert.strictEqual(E.normalizeTarget('3000'), 3000);
  assert.strictEqual(E.normalizeTarget('custom', 7500), 7500);
  assert.strictEqual(E.normalizeTarget('custom', 50), 1000);
});

test('Sicht der KI enthält keine fremden Karten', () => {
  const s = E.newGame({ dealer: 3, rng: E.seededRng(3) });
  const view = E.viewFor(s, 0);
  assert.deepStrictEqual(view.hand, s.hands[0]);
  assert.strictEqual(view.handCounts[1], s.hands[1].length);
  assert.strictEqual(JSON.stringify(view).indexOf(s.hands[1][0]) === -1 || s.hands[0].indexOf(s.hands[1][0]) !== -1, true);
  assert.strictEqual(view.stockCount, s.stock.length);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(view, 'stock'), false);
});
