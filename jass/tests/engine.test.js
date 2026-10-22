/* Schieber: Karten, Bedienen, Weis, Stöck, Ausmachen. Aufruf über `node --test tests/`. */
const test = require('node:test');
const assert = require('node:assert');
const E = require('../../public/jass/js/engine.js');

function C(suit, rank) { return { suit: suit, rank: rank, id: String(suit) + rank }; }
function ids(cards) { return cards.map((c) => c.id).sort(); }

test('Blatt hat 36 Karten, jede Farbe 6 bis As', () => {
  const deck = E.freshDeck();
  assert.equal(deck.length, 36);
  assert.equal(new Set(deck.map((c) => c.id)).size, 36);
  for (let s = 0; s < 4; s++) {
    assert.deepEqual(deck.filter((c) => c.suit === s).map((c) => c.rank).sort(), E.RANKS.slice().sort());
  }
});

test('Geben: 9 Karten, Vorhand rechts vom Geber, erster Geber aus dem Zufall, dann weiter', () => {
  const rng = E.mulberry32(7);
  const table = E.newTable({ target: 1000 }, rng);
  assert.ok(table.dealer >= 0 && table.dealer <= 3);
  assert.equal(table.forehand, E.nextSeat(table.dealer));
  assert.equal(table.turn, table.forehand);
  const all = [];
  for (let s = 0; s < 4; s++) {
    assert.equal(table.hands[s].length, 9);
    all.push(...table.hands[s]);
  }
  assert.equal(new Set(all.map((c) => c.id)).size, 36);
  assert.equal(E.teamOf(0), 0);
  assert.equal(E.teamOf(2), 0);
  assert.equal(E.teamOf(1), 1);
  assert.equal(E.teamOf(3), 1);
  const again = E.newTable({}, E.mulberry32(7));
  assert.equal(again.dealer, table.dealer);
  assert.deepEqual(again.hands[0].map((c) => c.id), table.hands[0].map((c) => c.id));
});

test('Ziel: 1000, 1500, 2500 und eigene Zahl', () => {
  assert.equal(E.normalizeTarget(undefined), 1000);
  assert.equal(E.normalizeTarget('1500'), 1500);
  assert.equal(E.normalizeTarget('2500'), 2500);
  assert.equal(E.normalizeTarget('custom', 1800), 1800);
  assert.equal(E.normalizeTarget('custom', 12), 1000);
});

test('Trumpfrang und Punkte, Obenabe und Undenufe klassisch, Summe 152', () => {
  const trump = { mode: 'suit', suit: 1 };
  assert.ok(E.rankPower(E.makeCard(1, 'U'), trump) > E.rankPower(E.makeCard(1, '9'), trump));
  assert.ok(E.rankPower(E.makeCard(1, '9'), trump) > E.rankPower(E.makeCard(1, 'A'), trump));
  assert.equal(E.pointsOf(E.makeCard(1, 'U'), trump), 20);
  assert.equal(E.pointsOf(E.makeCard(1, '9'), trump), 14);
  assert.equal(E.pointsOf(E.makeCard(0, 'U'), trump), 2);
  assert.equal(E.pointsOf(E.makeCard(0, '8'), trump), 0);
  const oben = { mode: 'obenabe' };
  assert.ok(E.rankPower(E.makeCard(0, 'A'), oben) > E.rankPower(E.makeCard(0, '6'), oben));
  assert.equal(E.pointsOf(E.makeCard(2, '8'), oben), 8);
  assert.equal(E.pointsOf(E.makeCard(2, 'A'), oben), 11);
  const unden = { mode: 'undenufe' };
  assert.ok(E.rankPower(E.makeCard(3, '6'), unden) > E.rankPower(E.makeCard(3, 'A'), unden));
  assert.equal(E.pointsOf(E.makeCard(3, '6'), unden), 0);
  assert.equal(E.pointsOf(E.makeCard(3, 'A'), unden), 11);
  assert.equal(E.pointsOf(E.makeCard(3, '8'), unden), 8);
  assert.equal(E.sumPoints(E.freshDeck(), trump), 152);
  assert.equal(E.sumPoints(E.freshDeck(), oben), 152);
  assert.equal(E.sumPoints(E.freshDeck(), unden), 152);
});

test('Bedienen, Puur-Ausnahme, kein Trumpfzwang, Untertrumpfen nur mit lauter Trümpfen', () => {
  const trump = { mode: 'suit', suit: 0 };
  const table = E.fromPosition({
    trump,
    forehand: 0,
    turn: 1,
    lead: 0,
    trick: [{ seat: 0, card: C(1, 'A') }],
    hands: [
      [],
      [C(1, 'K'), C(0, '9'), C(0, '6'), C(2, 'A')],
      [],
      [],
    ],
  });
  assert.deepEqual(ids(E.legalCards(table, 1)), ['09', '06', '1K'].sort());
  table.trick = [{ seat: 0, card: C(1, 'A') }, { seat: 1, card: C(0, 'A') }];
  table.hands[2] = [C(0, '7'), C(0, '8'), C(2, 'K')];
  assert.deepEqual(ids(E.legalCards(table, 2)), ['2K']);
  table.hands[2] = [C(0, '7'), C(0, 'U')];
  assert.deepEqual(ids(E.legalCards(table, 2)), ['07', '0U'].sort());
  table.trick = [{ seat: 0, card: C(0, 'A') }];
  table.turn = 1;
  table.hands[1] = [C(0, 'U'), C(1, 'A'), C(2, 'K')];
  assert.deepEqual(ids(E.legalCards(table, 1)), ['0U', '1A', '2K'].sort());
  table.hands[1] = [C(0, 'U'), C(0, '6'), C(1, 'A')];
  assert.deepEqual(ids(E.legalCards(table, 1)), ['0U', '06'].sort());
  table.hands[1] = [C(1, 'K'), C(2, 'A')];
  assert.deepEqual(ids(E.legalCards(table, 1)), ['1K', '2A'].sort());
  const oben = E.fromPosition({
    trump: { mode: 'obenabe' },
    trick: [{ seat: 0, card: C(2, 'K') }],
    turn: 1,
    hands: [[], [C(2, '6'), C(2, 'A'), C(0, 'A')], [], []],
  });
  assert.deepEqual(ids(E.legalCards(oben, 1)), ['26', '2A'].sort());
});

test('Schieben einmal zum Partner, kein Zurückschieben, Obenabe abschaltbar, Vorhand spielt aus', () => {
  const table = E.fromPosition({
    phase: 'trump',
    forehand: 0,
    turn: 0,
    dealer: 3,
    hands: [[C(0, '6')], [C(1, '6')], [C(2, '6')], [C(3, '6')]],
    allowOben: false,
  });
  assert.equal(E.chooseTrump(table, 0, 'obenabe').ok, false);
  assert.equal(E.chooseTrump(table, 0, 'schieben').ok, true);
  assert.equal(table.phase, 'trumpPartner');
  assert.equal(table.turn, 2);
  assert.equal(E.chooseTrump(table, 2, 'schieben').ok, false);
  assert.equal(E.chooseTrump(table, 2, 1).ok, true);
  assert.equal(table.trump.suit, 1);
  assert.equal(table.turn, 0);
  assert.equal(table.phase, 'play');
});

test('Weis in natürlicher Reihe, eine Karte ein Weis, nur das bessere Team schreibt alle', () => {
  const trump = { mode: 'suit', suit: 0 };
  const hand = [C(1, '6'), C(1, '7'), C(1, '8'), C(1, '9'), C(1, '10'), C(0, 'A'), C(2, 'A'), C(3, 'A'), C(1, 'A')];
  const weis = E.selectMelds(hand, trump);
  assert.equal(weis.best.points, 100);
  assert.equal(weis.best.length, 5);
  assert.equal(weis.total, 200);
  const fourAces = [C(0, 'A'), C(1, 'A'), C(2, 'A'), C(3, 'A'), C(0, '6'), C(0, '7'), C(0, '8')];
  const fours = E.selectMelds(fourAces, trump);
  assert.equal(fours.best.kind, 'vier');
  assert.equal(fours.best.points, 100);
  const both = E.selectMelds([
    C(0, 'A'), C(1, 'A'), C(2, 'A'), C(3, 'A'),
    C(1, '6'), C(1, '7'), C(1, '8'), C(1, '9'), C(1, '10'),
  ], trump);
  assert.equal(both.best.length, 5);
  assert.equal(both.total, 200);
  const nine = [0, 1, 2, 3].map((s) => C(s, '9'));
  assert.equal(E.selectMelds(nine.concat([C(0, '6'), C(0, '7'), C(0, '8')]), trump).best.points, 150);
  const unders = [0, 1, 2, 3].map((s) => C(s, 'U'));
  assert.equal(E.selectMelds(unders, trump).best.points, 200);
  const natural = E.selectMelds([C(0, '9'), C(0, 'U'), C(0, 'A')], trump);
  assert.equal(natural.total, 0);
  const table = E.fromPosition({
    trump,
    forehand: 0,
    turn: 0,
    scores: [0, 0],
    target: 5000,
    hands: [
      [C(1, '6'), C(1, '7'), C(1, '8'), C(1, '9')],
      [C(2, '6'), C(2, '7'), C(2, '8'), C(3, '6')],
      [C(1, '10'), C(1, 'U'), C(1, 'O'), C(0, '7')],
      [C(3, 'A'), C(3, 'K'), C(3, '7'), C(0, '8')],
    ],
  });
  assert.equal(table.weis[0].topPoints, 50);
  assert.equal(table.weis[2].topPoints, 20);
  assert.equal(table.weis[1].topPoints, 20);
  E.playCard(table, 0, '16');
  E.playCard(table, 1, '26');
  E.playCard(table, 2, '110');
  const done = E.playCard(table, 3, '3A');
  const weisScore = done.events.filter((e) => e.reason === 'weis');
  assert.equal(weisScore.length, 1);
  assert.equal(weisScore[0].team, 0);
  assert.equal(weisScore[0].raw, 70);
  const order = done.events.map((e) => e.type + (e.reason ? ':' + e.reason : ''));
  const weisAt = order.indexOf('score:weis');
  const trickAt = order.indexOf('score:stich');
  assert.ok(weisAt >= 0 && weisAt < trickAt);
});

test('Stöck 20 beim zweiten Blatt, nicht bei Obenabe, verbraucht keine Weis-Karte', () => {
  const oben = E.fromPosition({
    trump: { mode: 'obenabe' },
    hands: [
      [C(0, 'K'), C(0, 'O'), C(1, '6'), C(1, '7')],
      [C(2, '6'), C(2, '7'), C(2, '8'), C(2, '9')],
      [C(3, '6'), C(3, '7'), C(3, '8'), C(3, '9')],
      [C(1, '8'), C(1, '9'), C(1, '10'), C(1, 'U')],
    ],
    target: 1000,
  });
  assert.equal(oben.stoeckSeat, null);
  const trump = { mode: 'suit', suit: 0 };
  const withStock = E.selectMelds([C(0, '6'), C(0, '7'), C(0, '8'), C(0, '9'), C(0, 'K'), C(0, 'O')], trump);
  assert.equal(withStock.total, 50);
  const table = E.fromPosition({
    trump,
    forehand: 0,
    turn: 0,
    target: 1000,
    hands: [
      [C(0, 'K'), C(0, 'O'), C(1, 'A'), C(2, 'A')],
      [C(1, '6'), C(1, '7'), C(1, '8'), C(1, '9')],
      [C(2, '6'), C(2, '7'), C(2, '8'), C(2, '9')],
      [C(3, '6'), C(3, '7'), C(3, '8'), C(3, '9')],
    ],
  });
  assert.equal(table.stoeckSeat, 0);
  assert.equal(table.weis[0].total, 0);
  const first = E.playCard(table, 0, '0K');
  assert.equal(first.events.some((e) => e.type === 'stoeck'), false);
  E.playCard(table, 1, '16');
  E.playCard(table, 2, '26');
  E.playCard(table, 3, '36');
  assert.equal(table.turn, 0);
  const second = E.playCard(table, 0, '0O');
  const stock = second.events.find((e) => e.reason === 'stoeck');
  assert.equal(stock.team, 0);
  assert.equal(stock.points, 20);
});

test('Ausmachen: Stöck, dann Weis, dann Stich. Spätere Punkte dieses Augenblicks fallen weg', () => {
  const table = E.fromPosition({
    trump: { mode: 'suit', suit: 0 },
    forehand: 0,
    turn: 0,
    scores: [976, 0],
    target: 1000,
    multipliers: false,
    hands: [
      [C(0, 'K'), C(0, 'O'), C(1, '6'), C(2, '9'), C(3, 'A')],
      [C(1, '7'), C(2, '6'), C(3, '7'), C(1, '9'), C(2, '8')],
      [C(1, '8'), C(2, '7'), C(3, '8'), C(1, '10'), C(2, '10')],
      [C(1, 'A'), C(2, 'A'), C(3, '6'), C(3, '9'), C(0, '6')],
    ],
  });
  assert.equal(table.weis[0].total, 0);
  E.playCard(table, 0, '0K');
  E.playCard(table, 1, '17');
  E.playCard(table, 2, '18');
  E.playCard(table, 3, '06');
  assert.equal(table.over, false);
  assert.equal(table.scores[0], 980);
  const end = E.playCard(table, 0, '0O');
  assert.equal(table.over, true);
  assert.equal(table.winner, 0);
  assert.equal(table.scores[0], 1000);
  assert.equal(end.events.some((e) => e.reason === 'weis'), false);
  assert.equal(end.events.some((e) => e.reason === 'stich'), false);
  assert.equal(end.events.some((e) => e.type === 'bedanken'), true);
});

test('Weis vor dem Stich, wenn Stöck das Ziel noch nicht erreicht', () => {
  const table = E.fromPosition({
    trump: { mode: 'suit', suit: 3 },
    forehand: 0,
    turn: 0,
    scores: [970, 0],
    target: 1000,
    hands: [
      [C(1, '6'), C(1, '7'), C(1, '8'), C(1, '9')],
      [C(2, '6'), C(3, '6'), C(2, '9'), C(0, 'K')],
      [C(3, '9'), C(2, '10'), C(3, 'A'), C(0, 'O')],
      [C(3, '7'), C(2, '8'), C(0, '7'), C(0, '6')],
    ],
  });
  assert.equal(table.weis[0].total, 50);
  assert.equal(table.weis[2].total, 0);
  E.playCard(table, 0, '16');
  E.playCard(table, 1, '26');
  E.playCard(table, 2, '39');
  const done = E.playCard(table, 3, '28');
  assert.equal(table.over, true);
  assert.equal(table.winner, 0);
  const reasons = done.events.filter((e) => e.type === 'score').map((e) => e.reason);
  assert.deepEqual(reasons, ['weis']);
  assert.equal(table.scores[0], 1020);
});

test('Multiplikator: Schellen und Schilten mal 2, Rosen und Eicheln mal 1, Obenabe und Undenufe mal 3, aus ist 1', () => {
  assert.equal(E.multiplier({ mode: 'suit', suit: 0 }, true), 2);
  assert.equal(E.multiplier({ mode: 'suit', suit: 2 }, true), 2);
  assert.equal(E.multiplier({ mode: 'suit', suit: 1 }, true), 1);
  assert.equal(E.multiplier({ mode: 'suit', suit: 3 }, true), 1);
  assert.equal(E.multiplier({ mode: 'obenabe' }, true), 3);
  assert.equal(E.multiplier({ mode: 'undenufe' }, true), 3);
  assert.equal(E.multiplier({ mode: 'suit', suit: 0 }, false), 1);
  const table = E.fromPosition({
    trump: { mode: 'suit', suit: 0 },
    multipliers: true,
    scores: [0, 0],
    target: 5000,
    forehand: 0,
    turn: 0,
    stoeckPlayed: 1,
    hands: [
      [C(0, 'O'), C(1, '6')],
      [C(1, '7'), C(1, '8')],
      [C(1, '9'), C(1, '10')],
      [C(1, 'U'), C(1, 'A')],
    ],
  });
  table.stoeckSeat = 0;
  const played = E.playCard(table, 0, '0O');
  const stock = played.events.find((e) => e.reason === 'stoeck');
  assert.equal(stock.raw, 20);
  assert.equal(stock.points, 40);
});

test('Voller Stichzähler: 157 ohne Match, Match gibt 100 extra, erstes Team am Ziel gewinnt', () => {
  const rng = E.mulberry32(3);
  const table = E.newTable({ target: 1000, allowOben: true }, rng);
  const ai = require('../../public/jass/js/ai.js');
  let guard = 0;
  while (!table.over && table.history.length < 8 && guard < 400) {
    guard += 1;
    if (table.phase === 'trump' || table.phase === 'trumpPartner') {
      const choice = ai.chooseTrump(table, table.turn, 'kneipe', rng);
      assert.equal(E.chooseTrump(table, table.turn, choice).ok, true);
    } else if (table.phase === 'play') {
      const card = ai.chooseCard(table, table.turn, 'kneipe', rng);
      const res = E.playCard(table, table.turn, card.id);
      assert.equal(res.ok, true, res.reason);
    } else if (table.phase === 'handEnd') {
      let cardPts = 0;
      for (let s = 0; s < 4; s++) {
        for (let i = 0; i < table.won[s].length; i++) cardPts += E.pointsOf(table.won[s][i], table.trump);
      }
      assert.equal(cardPts, 152);
      const row = table.history[table.history.length - 1];
      assert.ok(row.gained[0] + row.gained[1] >= E.ROUND_POINTS);
      E.nextHand(table, rng);
    }
  }
  assert.ok(table.history.length >= 1);
  const first = table.history[0];
  assert.ok(first.gained[0] + first.gained[1] === 157 || first.gained[0] + first.gained[1] === 257 || first.gained[0] + first.gained[1] > 157);
});

test('Weis wird als deutsches Wort angesagt', () => {
  assert.equal(E.spokenWeis(20), 'Weis zwanzig.');
  assert.equal(E.spokenWeis(50), 'Weis fünfzig.');
  assert.equal(E.spokenWeis(100), 'Weis hundert.');
  assert.equal(E.spokenWeis(300), 'Weis dreihundert.');
  assert.equal(E.spokenWeis(0), 'Weis.');
  assert.doesNotMatch(E.spokenWeis(20), /\d/);
});
