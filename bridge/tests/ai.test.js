/* Natürliche Reizung: fünf Oberfarben, 1 Sans Atout, Stayman, Blackwood. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/bridge/js/engine.js');
const AI = require('../../public/bridge/js/ai.js');

function codes(suit, ranks) {
  return ranks.map((rank) => suit + ':' + rank);
}

test('Eröffnung: 1 Sans Atout, fünf Oberfarben, Passen unter zwölf', () => {
  const nt = E.newTable({ dealer: 0 }, 1);
  nt.hands[0] = E.makeHand(codes('S', ['A', 'K', '4', '3']).concat(codes('H', ['Q', '5', '4', '2']), codes('D', ['A', '6', '5']), codes('C', ['K', '3'])));
  assert.equal(E.hcp(nt.hands[0]), 16);
  assert.deepEqual(AI.chooseBid(nt, 0, 'kneipe'), { kind: 'bid', level: 1, strain: 'NT' });

  const spades = E.newTable({ dealer: 0 }, 1);
  spades.hands[0] = E.makeHand(codes('S', ['A', 'K', '5', '4', '3']).concat(codes('H', ['A', '4', '3']), codes('D', ['K', '4', '3']), codes('C', ['Q', '4'])));
  assert.deepEqual(AI.chooseBid(spades, 0, 'kneipe'), { kind: 'bid', level: 1, strain: 'S' });

  const both = E.newTable({ dealer: 0 }, 1);
  both.hands[0] = E.makeHand(codes('S', ['A', 'K', '5', '4', '3']).concat(codes('H', ['A', 'Q', '5', '4', '3']), codes('D', ['K', '4']), ['C:5']));
  assert.equal(AI.chooseBid(both, 0, 'kneipe').strain, 'S');

  const weak = E.newTable({ dealer: 0 }, 1);
  weak.hands[0] = E.makeHand(codes('S', ['A', 'K', '4', '3']).concat(codes('H', ['Q', 'J', '4', '3']), codes('D', ['J', '5', '4']), codes('C', ['6', '5'])));
  assert.equal(E.hcp(weak.hands[0]), 11);
  assert.deepEqual(AI.chooseBid(weak, 0, 'kneipe'), { kind: 'pass' });
});

test('Stayman und die Antwort des Eröffners', () => {
  const t = E.fromAuction({
    dealer: 0,
    calls: [
      { kind: 'bid', level: 1, strain: 'NT' },
      { kind: 'pass' }
    ]
  });
  t.hands[2] = E.makeHand(codes('S', ['A', 'K', '5', '4']).concat(codes('H', ['3', '2']), codes('D', ['A', '4', '3']), codes('C', ['5', '4', '3', '2'])));
  assert.equal(E.hcp(t.hands[2]), 11);
  assert.deepEqual(AI.chooseBid(t, 2, 'kneipe'), { kind: 'bid', level: 2, strain: 'C' });
  const hint = AI.suggestBid(t, 2);
  assert.equal(hint.hcp, 11);
  assert.match(hint.text, /Stayman/);
  assert.match(hint.text, /11 Figurenpunkte/);

  E.call(t, 2, { kind: 'bid', level: 2, strain: 'C' });
  E.call(t, 3, { kind: 'pass' });
  t.hands[0] = E.makeHand(codes('H', ['A', 'K', '5', '4']).concat(codes('S', ['Q', '3']), codes('D', ['K', 'Q', '4']), codes('C', ['A', '6', '3', '2'])));
  assert.deepEqual(AI.chooseBid(t, 0, 'kneipe'), { kind: 'bid', level: 2, strain: 'H' });

  const none = E.fromAuction({
    dealer: 0,
    calls: [
      { kind: 'bid', level: 1, strain: 'NT' },
      { kind: 'pass' },
      { kind: 'bid', level: 2, strain: 'C' },
      { kind: 'pass' }
    ]
  });
  none.hands[0] = E.makeHand(codes('C', ['A', 'K', '5', '4']).concat(codes('D', ['A', 'Q', '4', '3']), codes('H', ['K', '3']), codes('S', ['6', '5', '2'])));
  assert.deepEqual(AI.chooseBid(none, 0, 'kneipe'), { kind: 'bid', level: 2, strain: 'D' });
});

test('Blackwood: zwei Asse antworten 5 Herz, null oder vier Asse 5 Kreuz', () => {
  const t = E.fromAuction({
    dealer: 0,
    calls: [
      { kind: 'bid', level: 1, strain: 'H' },
      { kind: 'pass' },
      { kind: 'bid', level: 3, strain: 'H' },
      { kind: 'pass' },
      { kind: 'bid', level: 4, strain: 'NT' },
      { kind: 'pass' }
    ]
  });
  t.hands[2] = E.makeHand(['S:A', 'H:A', 'H:K', 'H:5', 'H:4', 'D:K', 'D:4', 'D:3', 'C:6', 'C:5', 'C:4', 'C:3', 'C:2']);
  assert.equal(AI.describe(t.hands[2]).aces, 2);
  assert.deepEqual(AI.chooseBid(t, 2, 'kneipe'), { kind: 'bid', level: 5, strain: 'H' });
  assert.match(AI.suggestBid(t, 2).text, /Blackwood/);

  t.hands[2] = E.makeHand(['S:K', 'S:Q', 'S:J', 'H:K', 'H:5', 'H:4', 'D:K', 'D:Q', 'D:4', 'C:K', 'C:Q', 'C:6', 'C:5']);
  assert.equal(AI.describe(t.hands[2]).aces, 0);
  assert.equal(AI.chooseBid(t, 2, 'turnier').strain, 'C');
});

test('jeder Vorschlag ist erlaubt, und die Farbe wird bedient', () => {
  for (let seed = 1; seed <= 6; seed++) {
    const t = E.newTable({ dealer: seed % 4 }, seed);
    const hint = AI.suggestBid(t, t.turn);
    assert.equal(E.callAllowed(E.legalCalls(t, t.turn), hint.call), true, hint.text);
    assert.match(hint.text, /Figurenpunkt/);
  }
  const letters = ['C', 'D', 'H', 'S'];
  const hands = [[], [], [], []];
  E.freshDeck().forEach((card, index) => {
    hands[index % 4].push(letters[card.suit] + ':' + card.rank);
  });
  const play = E.fromAuction({
    dealer: 0,
    hands: hands,
    calls: [
      { kind: 'bid', level: 1, strain: 'NT' },
      { kind: 'pass' },
      { kind: 'pass' },
      { kind: 'pass' }
    ]
  });
  const lead = AI.chooseCard(play, play.turn, 'kneipe', () => 0.9);
  assert.equal(E.playCard(play, play.turn, lead.id).ok, true);
  const answer = AI.chooseCard(play, play.turn, 'kneipe', () => 0);
  const legal = E.legalCards(play, play.turn);
  assert.equal(legal.some((card) => card.id === answer.id), true);
});

test('ein paar Blätter laufen mit der KI bis zum Ergebnis', () => {
  for (let seed = 1; seed <= 6; seed++) {
    let table = E.newTable({ mode: seed % 2 ? 'rubber' : 'chicago', honours: seed % 2 === 0 }, seed);
    for (let hand = 0; hand < 2; hand++) {
      let guard = 0;
      while ((table.phase === 'bidding' || table.phase === 'play') && guard < 80) {
        guard += 1;
        if (table.phase === 'bidding') {
          const call = AI.chooseBid(table, table.turn, 'kneipe');
          const res = E.call(table, table.turn, call);
          assert.equal(res.ok, true, res.error);
        } else {
          const card = AI.chooseCard(table, table.turn, 'kneipe', E.mulberry32(seed + guard));
          const res = E.playCard(table, table.turn, card.id);
          assert.equal(res.ok, true, res.error);
        }
      }
      assert.ok(table.phase === 'scored' || table.phase === 'passed' || table.phase === 'match');
      if (table.phase === 'match') break;
      assert.equal(E.nextHand(table, seed + 30 + hand).ok, true);
    }
  }
});
