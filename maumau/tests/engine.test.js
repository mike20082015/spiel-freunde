/* Regeltests Mau-Mau. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/maumau/js/engine.js');

function rules(extra) {
  return E.normalizeRules(Object.assign({ opponents: 2 }, extra || {}));
}

test('Voreinstellung ist das verbreitete deutsche Mau-Mau', () => {
  const r = E.normalizeRules({});
  assert.equal(r.deck, 'french');
  assert.equal(r.handSize, 5);
  assert.equal(r.opponents, 2);
  assert.equal(r.seven, true);
  assert.equal(r.sevenStack, true);
  assert.equal(r.sevenSkip, false);
  assert.equal(r.eight, true);
  assert.equal(r.jackWish, true);
  assert.equal(r.jackWild, true);
  assert.equal(r.jackOnJack, false);
  assert.equal(r.ace, 'off');
  assert.equal(r.nine, 'off');
  assert.equal(r.playDrawn, true);
  assert.equal(r.mauPenalty, 1);
  assert.equal(r.startEffect, false);
  assert.equal(r.scoring, true);
  assert.equal(r.jackDouble, false);
  assert.equal(r.threeAces, false);
  assert.equal(E.deckCards(r).length, 32);
  assert.equal(E.cardPoints('CJ'), 20);
  assert.equal(E.cardPoints('HA'), 11);
  assert.equal(E.cardPoints('SK'), 10);
  assert.equal(E.cardPoints('DQ'), 10);
  assert.equal(E.cardPoints('H10'), 10);
  assert.equal(E.cardPoints('S9'), 9);
  assert.equal(E.cardPoints('C7'), 7);
});

test('Geben teilt gleich viele Karten und behält das Blatt beisammen', () => {
  const match = E.blankMatch(rules(), 100);
  const st = E.dealHand(match, E.seededRng(3));
  assert.equal(st.players, 3);
  assert.equal(st.hands[0].length, 5);
  assert.equal(st.hands[1].length, 5);
  assert.equal(st.hands[2].length, 5);
  assert.equal(st.discard.length, 1);
  assert.equal(st.talon.length, 32 - 16);
  assert.equal(st.turn, 0);
  const all = st.hands.flat().concat(st.talon, st.discard);
  assert.equal(new Set(all).size, 32);
});

test('Fünf Spieler und sieben Karten auf 32 Karten werden auf eine ziehbare Größe gekürzt', () => {
  const match = E.blankMatch(rules({ opponents: 4, handSize: 7 }), 100);
  const st = E.dealHand(match, E.seededRng(1));
  assert.equal(st.players, 5);
  assert.ok(st.handSize <= 6);
  assert.equal(st.talon.length + st.discard.length + st.hands.reduce((s, h) => s + h.length, 0), 32);
  assert.ok(st.discard.length === 1);
});

test('52 Karten und deutsches Blatt benennen Unter statt Bube', () => {
  assert.equal(E.deckCards(rules({ deck: 'french52' })).length, 52);
  assert.equal(E.cardName('CJ', rules({ deck: 'german' })), 'Eichel Unter');
  assert.equal(E.cardName('HQ', rules({ deck: 'german' })), 'Herz Ober');
  assert.equal(E.rankShort('J', rules({ deck: 'german' })), 'U');
  assert.equal(E.cardName('CJ', rules()), 'Kreuz Bube');
});

test('gelegt wird nur Farbe oder Wert', () => {
  const st = E.setup({
    rules: rules(),
    hands: [['H8', 'S9', 'C7'], ['DK'], ['HA']],
    discard: ['C9'],
    talon: ['D8'],
  });
  assert.equal(E.apply(st, 0, { type: 'play', card: 'H8' }).ok, false);
  assert.equal(E.apply(st, 0, { type: 'play', card: 'S9' }).ok, true);
  assert.equal(E.topCard(st), 'S9');
  assert.equal(st.turn, 1);
});

test('eine 7 zieht zwei und lässt sich stapeln', () => {
  const st = E.setup({
    rules: rules(),
    hands: [['H7', 'C8'], ['S7', 'D9'], ['CK', 'HA', 'S8']],
    discard: ['D10'],
    talon: ['C9', 'H9', 'S10', 'D8', 'CA', 'HQ'],
    pendingDraw: 2,
  });
  assert.equal(E.apply(st, 0, { type: 'play', card: 'H7', call: 'mau' }).ok, true);
  assert.equal(st.pendingDraw, 4);
  assert.equal(st.turn, 1);
  assert.equal(E.apply(st, 1, { type: 'play', card: 'S7', call: 'mau' }).ok, true);
  assert.equal(st.pendingDraw, 6);
  assert.equal(E.apply(st, 2, { type: 'drawPenalty' }).ok, true);
  assert.equal(st.hands[2].length, 3 + 6);
  assert.equal(st.pendingDraw, 0);
  assert.equal(st.turn, 0);
});

test('wer die Strafe zieht und die Hausregel aussetzen an ist, überspringt den Nächsten', () => {
  const st = E.setup({
    rules: rules({ sevenSkip: true }),
    hands: [['C9'], ['D8'], ['HK']],
    discard: ['S7'],
    talon: ['HA', 'SK'],
    pendingDraw: 2,
    turn: 0,
  });
  E.apply(st, 0, { type: 'drawPenalty' });
  assert.equal(st.hands[0].length, 3);
  assert.equal(st.turn, 2);
});

test('eine 8 setzt den Nächsten aus, zu zweit heißt das noch einmal', () => {
  const three = E.setup({
    rules: rules(),
    hands: [['S8', 'C7'], ['D9'], ['HK', 'CA']],
    discard: ['H8'],
  });
  E.apply(three, 0, { type: 'play', card: 'S8', call: 'mau' });
  assert.equal(three.turn, 2);
  const two = E.setup({
    rules: rules(),
    hands: [['S8', 'C7'], ['D9', 'HA']],
    discard: ['H8'],
  });
  E.apply(two, 0, { type: 'play', card: 'S8', call: 'mau' });
  assert.equal(two.phase, 'play');
  assert.equal(two.turn, 0);
  assert.equal(two.hands[0].length, 1);
});

test('der Bube passt auf alles, wünscht, und liegt nicht auf einem Buben', () => {
  const st = E.setup({
    rules: rules(),
    hands: [['CJ', 'S8'], ['HJ', 'D9'], ['H8', 'CK']],
    discard: ['S9'],
    talon: ['DA'],
  });
  assert.equal(E.apply(st, 0, { type: 'play', card: 'CJ', call: 'mau' }).ok, true);
  assert.equal(st.phase, 'suit');
  assert.equal(E.apply(st, 0, { type: 'suit', suit: 'H' }).ok, true);
  assert.equal(st.activeSuit, 'H');
  assert.equal(st.turn, 1);
  assert.equal(E.legalMoves(st, 1).some((m) => m.card === 'HJ'), false);
  assert.equal(E.apply(st, 1, { type: 'play', card: 'D9' }).ok, false);
  assert.equal(E.apply(st, 1, { type: 'draw' }).ok, true);
});

test('Bube auf Bube geht nur, wenn die Runde es erlaubt', () => {
  const banned = E.setup({
    rules: rules({ jackOnJack: false }),
    hands: [['HJ'], ['S9'], ['CK']],
    discard: ['CJ'],
    activeSuit: 'H',
  });
  assert.equal(E.canPlay(banned, 'HJ'), false);
  const allowed = E.setup({
    rules: rules({ jackOnJack: true }),
    hands: [['HJ'], ['S9'], ['CK']],
    discard: ['CJ'],
    activeSuit: 'H',
  });
  assert.equal(E.canPlay(allowed, 'HJ'), true);
});

test('Mau mit Ansage bleibt straffrei, vergessen kostet eine Karte', () => {
  const said = E.setup({
    rules: rules(),
    hands: [['H9', 'S8'], ['D7'], ['CK']],
    discard: ['C9'],
  });
  E.apply(said, 0, { type: 'play', card: 'H9', call: 'mau' });
  assert.equal(said.phase, 'play');
  assert.equal(said.hands[0].length, 1);
  assert.equal(said.turn, 1);

  const forgot = E.setup({
    rules: rules(),
    hands: [['H9', 'S8'], ['D7'], ['CK']],
    discard: ['C9'],
    talon: ['HA'],
  });
  E.apply(forgot, 0, { type: 'play', card: 'H9' });
  assert.equal(forgot.phase, 'call');
  assert.equal(E.apply(forgot, 1, { type: 'notice' }).ok, true);
  assert.equal(forgot.hands[0].length, 2);
  assert.equal(forgot.phase, 'play');
  assert.notEqual(forgot.winner, 0);
});

test('vergessenes Mau-Mau gewinnt nicht, verziehen schon', () => {
  const noticed = E.setup({
    rules: rules({ mauPenalty: 2 }),
    hands: [['H9'], ['D7', 'S8'], ['CK']],
    discard: ['C9'],
    talon: ['HA', 'SQ'],
  });
  E.apply(noticed, 0, { type: 'play', card: 'H9' });
  assert.equal(noticed.phase, 'call');
  E.apply(noticed, 2, { type: 'notice' });
  assert.equal(noticed.phase, 'play');
  assert.equal(noticed.winner, null);
  assert.equal(noticed.hands[0].length, 2);

  const forgiven = E.setup({
    rules: rules(),
    hands: [['H9'], ['D7'], ['CK']],
    discard: ['C9'],
  });
  E.apply(forgiven, 0, { type: 'play', card: 'H9' });
  E.apply(forgiven, 1, { type: 'forgive' });
  assert.equal(forgiven.phase, 'done');
  assert.equal(forgiven.winner, 0);
  assert.equal(forgiven.points[0], 0);
  assert.equal(forgiven.points[1], E.cardPoints('D7'));
});

test('Ass und 9 drehen die Richtung, Ass kann auch noch einmal legen', () => {
  const rev = E.setup({
    rules: rules({ ace: 'reverse' }),
    hands: [['HA', 'S7'], ['D9'], ['SK']],
    discard: ['H9'],
  });
  E.apply(rev, 0, { type: 'play', card: 'HA', call: 'mau' });
  assert.equal(rev.direction, -1);
  assert.equal(rev.turn, 2);

  const nine = E.setup({
    rules: rules({ nine: 'reverse' }),
    hands: [['S9', 'C7'], ['D8'], ['HK']],
    discard: ['H9'],
  });
  E.apply(nine, 0, { type: 'play', card: 'S9', call: 'mau' });
  assert.equal(nine.direction, -1);
  assert.equal(nine.turn, 2);

  const again = E.setup({
    rules: rules({ ace: 'again' }),
    hands: [['HA', 'S7'], ['D9'], ['SK']],
    discard: ['CA'],
  });
  E.apply(again, 0, { type: 'play', card: 'HA' });
  assert.equal(again.turn, 0);
  assert.equal(again.hands[0].length, 1);
});

test('die 9 als Alleskönner liegt auf jeder Karte', () => {
  const st = E.setup({
    rules: rules({ nine: 'wild' }),
    hands: [['D9'], ['H8'], ['CK']],
    discard: ['CJ'],
    activeSuit: 'S',
  });
  assert.equal(E.canPlay(st, 'D9'), true);
  assert.equal(E.apply(st, 0, { type: 'play', card: 'D9', call: 'maumau' }).ok, true);
  assert.equal(st.winner, 0);
});

test('leerer Talon wird aus der Ablage neu gemischt, ein einzelner Rest passt', () => {
  const st = E.setup({
    rules: rules({ playDrawn: false }),
    hands: [['C7'], ['D8'], ['HK']],
    discard: ['S9', 'HA', 'DQ', 'CK'],
    talon: [],
    turn: 0,
  });
  E.apply(st, 0, { type: 'draw' });
  assert.equal(st.hands[0].length, 2);
  assert.equal(st.discard.length, 1);
  assert.equal(E.topCard(st), 'CK');
  assert.ok(st.talon.length >= 0);

  const stuck = E.setup({
    rules: rules(),
    hands: [['C7'], ['D8'], ['HK']],
    discard: ['CK'],
    talon: [],
  });
  E.apply(stuck, 0, { type: 'draw' });
  assert.equal(stuck.hands[0].length, 1);
  assert.equal(stuck.turn, 1);
});

test('gezogene Karte darf sofort gelegt werden', () => {
  const st = E.setup({
    rules: rules(),
    hands: [['C7'], ['D8'], ['HK']],
    discard: ['H9'],
    talon: ['S9'],
  });
  E.apply(st, 0, { type: 'draw' });
  assert.equal(st.phase, 'drawn');
  assert.equal(st.drawnCard, 'S9');
  E.apply(st, 0, { type: 'play', card: 'S9', call: 'mau' });
  assert.equal(E.topCard(st), 'S9');
  assert.equal(st.turn, 1);
});

test('die Startkarte wirkt nur, wenn die Runde es will', () => {
  let quiet = false;
  let live = false;
  for (let seed = 1; seed < 120; seed++) {
    const off = E.dealHand(E.blankMatch(rules({ startEffect: false }), 100), E.seededRng(seed));
    const on = E.dealHand(E.blankMatch(rules({ startEffect: true }), 100), E.seededRng(seed));
    if (E.rankOf(E.topCard(off)) === '7') {
      assert.equal(off.pendingDraw, 0);
      assert.equal(on.pendingDraw, 2);
      quiet = true;
      live = true;
      break;
    }
  }
  assert.equal(quiet && live, true);
});

test('Punkte der Restkarten, Bube als letzte Karte verdoppelt, drei Asse gewinnen sofort', () => {
  const st = E.setup({
    rules: rules({ jackDouble: true }),
    hands: [['CJ'], ['HA', 'S7'], ['DK']],
    discard: ['C9'],
    activeSuit: 'C',
  });
  E.apply(st, 0, { type: 'play', card: 'CJ', call: 'maumau' });
  assert.equal(st.doubled, true);
  assert.equal(st.points[0], 0);
  assert.equal(st.points[1], (11 + 7) * 2);
  assert.equal(st.points[2], 10 * 2);

  const aces = E.setup({
    rules: rules({ threeAces: true }),
    hands: [['CA', 'SA', 'HA', 'D7'], ['CK'], ['D8']],
    discard: ['H9'],
  });
  assert.equal(E.apply(aces, 0, { type: 'aces' }).ok, true);
  assert.equal(aces.winner, 0);
  assert.equal(aces.points[0], 0);
  assert.equal(aces.points[1], 10);
});

test('die Runde endet, wenn jemand die Grenze allein oben erreicht', () => {
  const match = E.blankMatch(rules(), 30);
  match.scores = [0, 10, 20];
  const st = E.setup({
    rules: match.rules,
    hands: [['H9'], ['CJ'], ['D7']],
    discard: ['C9'],
  });
  E.apply(st, 0, { type: 'play', card: 'H9', call: 'maumau' });
  E.scoreHand(match, st);
  assert.ok(match.scores[1] >= 30);
  assert.equal(match.winner, 0);
});

test('ohne Punktewertung gewinnt, wer zuerst genug Hände gewinnt', () => {
  const match = E.blankMatch(rules({ scoring: false }), 1);
  const st = E.setup({
    rules: match.rules,
    hands: [['H9'], ['CJ'], ['D7']],
    discard: ['C9'],
  });
  E.apply(st, 0, { type: 'play', card: 'H9', call: 'maumau' });
  E.scoreHand(match, st);
  assert.equal(match.wins[0], 1);
  assert.equal(match.winner, 0);
  assert.equal(match.scores[1] > 0, true);
});
