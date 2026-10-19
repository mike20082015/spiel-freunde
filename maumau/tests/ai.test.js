/* Mitspieler Mau-Mau. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/maumau/js/engine.js');
const AI = require('../../public/maumau/js/ai.js');

function playOut(rules, level, seed) {
  const match = E.blankMatch(rules, 100);
  const rng = E.seededRng(seed);
  const st = E.dealHand(match, rng);
  let guard = 0;
  while (st.phase !== 'done' && guard < 700) {
    guard += 1;
    let actor = st.turn;
    let mv = null;
    if (st.phase === 'call') {
      const self = AI.act(st, st.pendingCall.seat, level, rng);
      if (self && self.type === 'call') {
        actor = st.pendingCall.seat;
        mv = self;
      } else {
        actor = (st.pendingCall.seat + 1) % st.players;
        mv = AI.act(st, actor, level, rng) || { type: 'forgive' };
      }
    } else {
      mv = AI.act(st, actor, level, rng);
    }
    const res = E.apply(st, actor, mv);
    if (!res.ok) throw new Error(level + ' ' + seed + ' ' + res.reason + ' ' + JSON.stringify(mv) + ' phase ' + st.phase);
  }
  if (st.phase !== 'done') throw new Error('keine Entscheidung, ' + level + ' ' + seed);
  return st;
}

test('jede Stufe spielt eine ganze Runde zu Ende und bleibt bei legalen Zügen', () => {
  ['anfaenger', 'kneipe', 'turnier'].forEach((level) => {
    for (let seed = 1; seed <= 12; seed++) {
      const st = playOut({ opponents: 2 + (seed % 3), handSize: seed % 2 ? 5 : 6 }, level, seed);
      assert.equal(st.phase, 'done');
      assert.ok(st.winner >= 0);
      const sum = st.points.reduce((a, b) => a + b, 0);
      assert.equal(st.points[st.winner], 0);
      assert.ok(sum >= 0);
    }
  });
});

test('Kneipe wünscht eine Farbe aus der eigenen Hand, wenn sie welche hat', () => {
  const st = E.setup({
    rules: { opponents: 2 },
    hands: [['CJ', 'H9', 'H8', 'D7'], ['S9'], ['CK']],
    discard: ['S8'],
    turn: 0,
    phase: 'suit',
  });
  const suit = AI.wishSuit(st, 0, 'kneipe', () => 0);
  assert.equal(suit, 'H');
});

test('Anfänger legt den Buben früh und vergisst manchmal Mau', () => {
  const st = E.setup({
    rules: { opponents: 2 },
    hands: [['H9', 'CJ'], ['D8'], ['SK']],
    discard: ['S9'],
  });
  const mv = AI.act(st, 0, 'anfaenger', () => 0);
  assert.equal(mv.type, 'play');
  assert.equal(mv.card, 'CJ');

  let forgot = 0;
  for (let i = 0; i < 30; i++) {
    const hand = E.setup({
      rules: { opponents: 2 },
      hands: [['H9', 'S8'], ['D7'], ['CK']],
      discard: ['C9'],
    });
    const move = AI.act(hand, 0, 'anfaenger', E.seededRng(i + 9));
    if (move && move.type === 'play' && !move.call) forgot += 1;
  }
  assert.ok(forgot > 0);
});
