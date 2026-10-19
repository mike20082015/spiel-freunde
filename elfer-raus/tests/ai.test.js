/* Mitspieler Elfer raus. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/elfer-raus/js/engine.js');
const AI = require('../../public/elfer-raus/js/ai.js');

test('jede Stufe legt nur passende Karten und eine kurze Runde endet', () => {
  ['anfaenger', 'kneipe', 'turnier'].forEach((level) => {
    const match = E.blankMatch(E.normalizeRules({ opponents: 1, handSize: 5, playLimit: 3 }), 1);
    const st = E.dealHand(match, E.seededRng(11 + level.length));
    let guard = 0;
    while (st.phase !== 'done' && guard < 400) {
      const seat = st.turn;
      const mv = AI.act(st, seat, level, E.seededRng(guard + 2));
      assert.equal(E.apply(st, seat, mv).ok, true, level + ' ' + guard + ' ' + JSON.stringify(mv));
      guard += 1;
    }
    assert.equal(st.phase, 'done', level);
  });
});

test('Turnier öffnet mit der 11 und legt die Folge gleich dahinter', () => {
  const st = E.setup({
    rules: E.normalizeRules({ opponents: 1 }),
    hands: [['R12', 'R11', 'Y3'], ['G4']],
    rows: E.emptyRows(),
    talon: ['B1'],
    turn: 0,
  });
  assert.equal(AI.act(st, 0, 'turnier', () => 0).card, 'R11');
  E.apply(st, 0, { type: 'play', card: 'R11' });
  assert.equal(AI.act(st, 0, 'turnier', () => 0).card, 'R12');
});
