/* Mitspieler Schwimmen. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/schwimmen/js/engine.js');
const AI = require('../../public/schwimmen/js/ai.js');

test('jede Stufe spielt nur erlaubte Züge und eine Runde endet', () => {
  ['anfaenger', 'kneipe', 'turnier'].forEach((level) => {
    const match = E.blankMatch(E.normalizeRules({ opponents: 2 }));
    const st = E.dealHand(match, E.seededRng(level.length + 3));
    let guard = 0;
    while (st.phase !== 'done' && guard < 80) {
      const mv = AI.act(st, st.turn, level, E.seededRng(guard + 9));
      assert.equal(E.apply(st, st.turn, mv).ok, true, level + ' ' + guard);
      guard += 1;
    }
    assert.equal(st.phase, 'done');
    assert.ok(Array.isArray(st.losers));
  });
});

test('Turnier deckt Feuer auf und tauscht nicht dagegen', () => {
  const st = E.setup({
    rules: E.normalizeRules({ opponents: 1 }),
    hands: [['CA', 'DA', 'SA'], ['H7', 'S8', 'C9']],
    middle: ['HK', 'D8', 'S7'],
    turn: 0,
  });
  assert.equal(AI.act(st, 0, 'turnier', () => 0).type, 'reveal');
});
