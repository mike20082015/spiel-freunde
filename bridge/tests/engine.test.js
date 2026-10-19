/* Rubber, Chicago, Reizung und Stich. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/bridge/js/engine.js');

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

function codes(suit, ranks) {
  return ranks.map((rank) => suit + ':' + rank);
}

function pack(partial) {
  const used = new Set();
  const hands = [[], [], [], []];
  for (let seat = 0; seat < 4; seat++) {
    for (const code of partial[seat] || []) {
      if (used.has(code)) throw new Error('doppelt ' + code);
      used.add(code);
      hands[seat].push(code);
    }
  }
  const rest = [];
  for (const suit of ['C', 'D', 'H', 'S']) {
    for (const rank of RANKS) {
      const code = suit + ':' + rank;
      if (!used.has(code)) rest.push(code);
    }
  }
  let i = 0;
  for (let seat = 0; seat < 4; seat++) {
    while (hands[seat].length < 13) hands[seat].push(rest[i++]);
  }
  if (i !== rest.length) throw new Error('Blatt geht nicht auf');
  return hands;
}

function unique(hands) {
  const ids = hands.flat().map((card) => (typeof card === 'string' ? card : card.id));
  assert.equal(ids.length, 52);
  assert.equal(new Set(ids).size, 52);
}

test('52 Karten, vier Farben, Figurenpunkte und ausgeglichen', () => {
  const deck = E.freshDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map((card) => card.id)).size, 52);
  RANKS.forEach((rank) => assert.equal(deck.filter((card) => card.rank === rank).length, 4));
  const balanced = E.makeHand(codes('S', ['A', 'K', '4', '3']).concat(codes('H', ['Q', '5', '4', '2']), codes('D', ['A', '6', '5']), codes('C', ['K', '3'])));
  assert.equal(E.hcp(balanced), 16);
  assert.equal(E.isBalanced(balanced), true);
  assert.equal(E.hcp(E.makeHand(['S:A', 'H:A', 'D:A', 'C:A'])), 16);
  assert.equal(E.cardName(E.parseCode('H:Q')), 'Dame Herz');
  assert.equal(E.callLabel({ kind: 'bid', level: 3, strain: 'NT' }), '3 Sans Atout');
  assert.equal(E.callLabel({ kind: 'double' }), 'Kontra');
  assert.equal(E.callLabel({ kind: 'redouble' }), 'Rekontra');
});

test('Gebote müssen höher sein, Kontra und Rekontra nur an der Reihe', () => {
  const t = E.newTable({ dealer: 0 }, 2);
  assert.equal(E.call(t, 1, { kind: 'pass' }).ok, false);
  assert.equal(E.call(t, 0, { kind: 'bid', level: 1, strain: 'H' }).ok, true);
  assert.equal(E.call(t, 1, { kind: 'bid', level: 1, strain: 'D' }).ok, false);
  assert.equal(E.call(t, 1, { kind: 'pass' }).ok, true);
  assert.equal(E.call(t, 2, { kind: 'double' }).ok, false);
  assert.equal(E.call(t, 2, { kind: 'pass' }).ok, true);
  assert.equal(E.call(t, 3, { kind: 'double' }).ok, true);
  assert.equal(E.call(t, 0, { kind: 'double' }).ok, false);
  assert.equal(E.call(t, 0, { kind: 'redouble' }).ok, true);
  assert.equal(E.call(t, 1, { kind: 'redouble' }).ok, false);
});

test('vier Passen geben neu, drei Passen schließen, Alleinspieler ist der erste der Farbe', () => {
  const passed = E.newTable({ dealer: 0 }, 3);
  ['pass', 'pass', 'pass', 'pass'].forEach(() => {
    assert.equal(E.call(passed, passed.turn, { kind: 'pass' }).ok, true);
  });
  assert.equal(passed.phase, 'passed');
  assert.equal(passed.result.passed, true);
  assert.equal(E.nextHand(passed, 4).ok, true);
  assert.equal(passed.dealer, 1);
  assert.equal(passed.phase, 'bidding');

  const raised = E.fromAuction({
    dealer: 2,
    calls: [
      { kind: 'bid', level: 1, strain: 'H' },
      { kind: 'pass' },
      { kind: 'bid', level: 4, strain: 'H' },
      { kind: 'pass' },
      { kind: 'pass' },
      { kind: 'pass' }
    ]
  });
  assert.equal(raised.phase, 'play');
  assert.equal(raised.contract.declarer, 2);
  assert.equal(raised.contract.dummy, 0);
  assert.equal(raised.contract.leader, 3);
  assert.equal(raised.contract.strain, 'H');
  assert.equal(raised.dummyVisible, false);
  assert.equal(E.contractLabel(raised.contract), '4 Herz');
});

test('bedienen, Trumpf sticht, Strohmann erst nach dem Ausspiel', () => {
  const hands = pack({
    0: codes('H', ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']).concat(['S:2', 'S:3']),
    1: ['H:2'].concat(codes('C', ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4'])),
    2: ['H:A', 'S:A', 'S:K', 'S:Q', 'S:J', 'S:10', 'S:9', 'S:8', 'S:7', 'S:6', 'S:5', 'S:4', 'D:A']
  });
  const t = E.fromAuction({
    dealer: 0,
    hands: hands,
    calls: [
      { kind: 'bid', level: 1, strain: 'NT' },
      { kind: 'pass' },
      { kind: 'pass' },
      { kind: 'pass' }
    ]
  });
  assert.equal(t.turn, 1);
  assert.equal(t.dummyVisible, false);
  assert.equal(E.playCard(t, 1, '3:A').ok, false);
  const lead = E.playCard(t, 1, '2:2');
  assert.equal(lead.ok, true);
  assert.equal(t.dummyVisible, true);
  const legal = E.legalCards(t, 2);
  assert.deepEqual(legal.map((card) => card.id), ['2:A']);
  assert.equal(E.playCard(t, 2, '3:A').error, 'Die Farbe ist zu bedienen.');

  const trump = E.fromAuction({
    dealer: 0,
    hands: pack({
      0: codes('H', RANKS),
      1: ['C:2']
    }),
    calls: [
      { kind: 'bid', level: 1, strain: 'H' },
      { kind: 'pass' },
      { kind: 'pass' },
      { kind: 'pass' }
    ]
  });
  assert.equal(trump.contract.declarer, 0);
  assert.equal(E.playCard(trump, 1, '0:2').ok, true);
  const north = E.legalCards(trump, 2)[0];
  assert.equal(E.playCard(trump, 2, north.id).ok, true);
  const east = E.legalCards(trump, 3)[0];
  assert.equal(E.playCard(trump, 3, east.id).ok, true);
  assert.equal(E.playCard(trump, 0, '2:2').ok, true);
  assert.equal(trump.tricks[0].winner, 0);
  assert.equal(trump.tricksWon[0], 1);
});

test('Stichpunkte, Gefahr, Kontra, Schlemm und Strafen', () => {
  assert.equal(E.evaluate({ level: 1, strain: 'NT', doubled: 0 }, 7, false, 'rubber').below, 40);
  const over = E.evaluate({ level: 1, strain: 'NT', doubled: 0 }, 8, false, 'rubber');
  assert.equal(over.below, 40);
  assert.equal(over.above, 30);
  const game = E.evaluate({ level: 3, strain: 'NT', doubled: 0 }, 9, false, 'rubber');
  assert.equal(game.below, 100);
  assert.equal(game.game, true);
  const hearts = E.evaluate({ level: 4, strain: 'H', doubled: 0 }, 11, false, 'rubber');
  assert.equal(hearts.below, 120);
  assert.equal(hearts.above, 30);
  const doubled = E.evaluate({ level: 4, strain: 'H', doubled: 1 }, 10, false, 'rubber');
  assert.equal(doubled.below, 240);
  assert.equal(doubled.insult, 50);
  const doubledOver = E.evaluate({ level: 4, strain: 'H', doubled: 1 }, 11, false, 'rubber');
  assert.equal(doubledOver.above, 150);
  const doubledVul = E.evaluate({ level: 4, strain: 'H', doubled: 1 }, 11, true, 'rubber');
  assert.equal(doubledVul.above, 250);
  const down = E.evaluate({ level: 3, strain: 'H', doubled: 1 }, 7, false, 'rubber');
  assert.equal(down.penalty, 300);
  const downVul = E.evaluate({ level: 3, strain: 'H', doubled: 1 }, 7, true, 'rubber');
  assert.equal(downVul.penalty, 500);
  const redouble = E.evaluate({ level: 4, strain: 'S', doubled: 2 }, 9, false, 'rubber');
  assert.equal(redouble.penalty, 200);
  const slam = E.evaluate({ level: 6, strain: 'S', doubled: 0 }, 12, false, 'rubber');
  assert.equal(slam.below, 180);
  assert.equal(slam.slam, 500);
  assert.equal(E.evaluate({ level: 6, strain: 'S', doubled: 0 }, 12, true, 'rubber').slam, 750);
  const grand = E.evaluate({ level: 7, strain: 'NT', doubled: 0 }, 13, false, 'rubber');
  assert.equal(grand.below, 220);
  assert.equal(grand.slam, 1000);
  const minor = E.evaluate({ level: 5, strain: 'C', doubled: 0 }, 11, false, 'rubber');
  assert.equal(minor.below, 100);
  assert.equal(minor.game, true);
});

test('Rubber: Spiel, Gefahr, Prämie 500 oder 700, Teilpunkt zählt mit', () => {
  const t = E.fromAuction({
    dealer: 0,
    calls: [
      { kind: 'bid', level: 4, strain: 'H' },
      { kind: 'pass' },
      { kind: 'pass' },
      { kind: 'pass' }
    ]
  });
  const first = E.scoreDeal(t, 10);
  assert.equal(first.ns, 120);
  assert.equal(first.game, true);
  assert.equal(t.rubber.games[0], 1);
  assert.equal(t.rubber.vulnerable[0], true);
  assert.deepEqual(t.rubber.currentBelow, [0, 0]);
  assert.equal(t.phase, 'scored');

  t.contract = { level: 2, strain: 'S', doubled: 0, declarer: 1, dummy: 3 };
  t.vuln = [true, false];
  const part = E.scoreDeal(t, 8);
  assert.equal(part.ew, 60);
  assert.equal(part.game, false);
  assert.equal(t.rubber.currentBelow[1], 60);
  assert.equal(t.rubber.games[1], 0);

  t.contract = { level: 3, strain: 'NT', doubled: 0, declarer: 2, dummy: 0 };
  t.vuln = [true, false];
  const rubber = E.scoreDeal(t, 9);
  assert.equal(rubber.rubberBonus, 500);
  assert.equal(rubber.game, true);
  assert.equal(t.phase, 'match');
  assert.equal(t.winner, 0);
  assert.equal(t.rubber.total[0], 720);
  assert.equal(t.rubber.total[1], 60);

  const vul = E.fromAuction({
    dealer: 0,
    calls: [
      { kind: 'bid', level: 4, strain: 'S' },
      { kind: 'pass' },
      { kind: 'pass' },
      { kind: 'pass' }
    ]
  });
  vul.rubber.games = [1, 1];
  vul.rubber.vulnerable = [true, true];
  vul.vuln = [true, true];
  const bonus = E.scoreDeal(vul, 10);
  assert.equal(bonus.rubberBonus, 700);
  assert.equal(vul.phase, 'match');
});

test('zwei Teilpunkte unter dem Strich werden zusammen ein Spiel', () => {
  const t = E.fromAuction({
    dealer: 0,
    calls: [
      { kind: 'bid', level: 2, strain: 'H' },
      { kind: 'pass' },
      { kind: 'pass' },
      { kind: 'pass' }
    ]
  });
  const first = E.scoreDeal(t, 8);
  assert.equal(first.ns, 60);
  assert.equal(first.game, false);
  assert.equal(t.rubber.currentBelow[0], 60);
  t.contract = { level: 2, strain: 'H', doubled: 0, declarer: 0, dummy: 2 };
  const second = E.scoreDeal(t, 8);
  assert.equal(second.game, true);
  assert.equal(t.rubber.games[0], 1);
  assert.equal(t.rubber.total[0], 120);
  assert.deepEqual(t.rubber.currentBelow, [0, 0]);
});

test('Ehrenpunkte sind optional und gehen an die Hand, die sie hält', () => {
  const hands = [
    E.makeHand(codes('H', ['A', 'K', 'Q', 'J', '9', '8', '7', '6', '5', '4', '3', '2']).concat(['S:2'])),
    E.makeHand(['H:10', 'S:3']),
    E.makeHand(['S:4']),
    E.makeHand(['S:5'])
  ];
  assert.deepEqual(E.honourScore(hands, 'H'), [100, 0]);
  hands[0] = E.makeHand(codes('H', ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']));
  assert.deepEqual(E.honourScore(hands, 'H'), [150, 0]);
  const aces = [0, 1, 2, 3].map((suit) => [E.makeCard(suit, 'A')]);
  aces[0] = [0, 1, 2, 3].map((suit) => E.makeCard(suit, 'A'));
  assert.deepEqual(E.honourScore(aces, 'NT'), [150, 0]);

  const t = E.fromAuction({
    dealer: 0,
    honours: true,
    hands: pack({ 0: codes('H', ['A', 'K', 'Q', 'J']), 1: ['H:10'] }),
    calls: [
      { kind: 'bid', level: 1, strain: 'H' },
      { kind: 'pass' },
      { kind: 'pass' },
      { kind: 'pass' }
    ]
  });
  const row = E.scoreDeal(t, 7);
  assert.equal(row.honours[0], 100);
  assert.equal(row.ns, 30 + 100);
  const quiet = E.fromAuction({
    dealer: 0,
    honours: false,
    hands: pack({ 0: codes('H', ['A', 'K', 'Q', 'J']), 1: ['H:10'] }),
    calls: [
      { kind: 'bid', level: 1, strain: 'H' },
      { kind: 'pass' },
      { kind: 'pass' },
      { kind: 'pass' }
    ]
  });
  assert.equal(E.scoreDeal(quiet, 7).honours[0], 0);
});

test('Chicago: Gefahr nach Blatt, Teilpunkt 50, Spiel 300 oder 500, kein Rubber', () => {
  const t = E.newTable({ mode: 'chicago', dealer: 0 }, 5);
  assert.equal(t.chicago.deal, 1);
  assert.deepEqual(t.vuln, [false, false]);
  for (let n = 0; n < 4; n++) assert.equal(E.call(t, t.turn, { kind: 'pass' }).ok, true);
  assert.equal(E.nextHand(t, 6).ok, true);
  assert.equal(t.chicago.deal, 2);
  assert.equal(t.dealer, 1);
  assert.deepEqual(t.vuln, [false, true]);
  for (let n = 0; n < 4; n++) E.call(t, t.turn, { kind: 'pass' });
  E.nextHand(t, 7);
  assert.deepEqual(t.vuln, [true, false]);
  for (let n = 0; n < 4; n++) E.call(t, t.turn, { kind: 'pass' });
  E.nextHand(t, 8);
  assert.equal(t.chicago.deal, 4);
  assert.deepEqual(t.vuln, [true, true]);

  const part = E.evaluate({ level: 2, strain: 'D', doubled: 0 }, 8, false, 'chicago');
  assert.equal(part.below, 40);
  assert.equal(part.partBonus, 50);
  assert.equal(part.gameBonus, 0);
  const nv = E.evaluate({ level: 4, strain: 'H', doubled: 0 }, 10, false, 'chicago');
  assert.equal(nv.gameBonus, 300);
  const vul = E.evaluate({ level: 4, strain: 'H', doubled: 0 }, 10, true, 'chicago');
  assert.equal(vul.gameBonus, 500);

  const board = E.fromAuction({
    mode: 'chicago',
    dealer: 0,
    calls: [
      { kind: 'bid', level: 2, strain: 'C' },
      { kind: 'pass' },
      { kind: 'pass' },
      { kind: 'pass' }
    ]
  });
  const row = E.scoreDeal(board, 8);
  assert.equal(row.ns, 40 + 50);
  assert.equal(row.rubberBonus, 0);
  assert.equal(board.phase, 'scored');
  board.chicago.deal = 4;
  board.vuln = [true, true];
  board.contract = { level: 4, strain: 'S', doubled: 0, declarer: 3, dummy: 1 };
  const last = E.scoreDeal(board, 10);
  assert.equal(last.ew, 120 + 500);
  assert.equal(board.phase, 'match');
  assert.equal(board.winner, 1);
});

test('Vorführblätter sind vollständig und liegen in Reizung und Spiel', () => {
  const bid = E.demo('bid');
  unique(bid.hands);
  assert.equal(bid.phase, 'bidding');
  assert.equal(bid.turn, 0);
  const play = E.demo('play');
  unique(play.dealt);
  assert.equal(play.phase, 'play');
  assert.equal(play.contract.declarer, 0);
  assert.equal(play.contract.strain, 'H');
  assert.equal(play.dummyVisible, true);
  assert.equal(play.turn, 2);
  assert.equal(play.trick.length, 1);
  assert.equal(play.trick[0].card.id, '1:J');
});
