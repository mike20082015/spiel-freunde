/* KI-Stufen: Ansage und ganze Spiele. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/doppelkopf/js/engine.js');
const AI = require('../../public/doppelkopf/js/ai.js');

test('Anfänger sagt gesund und keine Ansage', () => {
  const hand = ['CQ.0', 'H10.0', 'H10.1', 'DA.0', 'DA.1', 'DK.0', 'CJ.0', 'SJ.0', 'CA.0', 'SA.0', 'HA.0', 'S9.0'];
  const state = E.installPosition({
    phase: 'reserve',
    turn: 0,
    hands: [hand, ['S9.1'], ['C9.0'], ['D9.0']],
    rules: E.normalizeRules(),
  });
  state.order = [0, 1, 2, 3];
  assert.equal(AI.bid(state, 0, 'anfaenger').kind, 'gesund');
  assert.equal(AI.bestSolo(hand, state.rules, 'anfaenger'), null);
});

test('Turnier spielt Damensolo ab fünf Damen', () => {
  const hand = ['CQ.0', 'CQ.1', 'SQ.0', 'SQ.1', 'HQ.0', 'S9.0', 'C9.0', 'D9.0', 'H9.0', 'SK.0', 'CK.0', 'DK.0'];
  const rules = E.normalizeRules();
  const solo = AI.bestSolo(hand, rules, 'turnier');
  assert.equal(solo.solo, 'damen');
  assert.equal(AI.bestSolo(hand, rules, 'kneipe'), null);
});

test('Volle Spiele laufen bei allen Stufen zu Ende und bleiben nullsummig', () => {
  ['anfaenger', 'kneipe', 'turnier'].forEach((level) => {
    const match = E.newMatch({
      rules: { armut: true, schweinchen: true, hochzeit: true, pflichtsolo: false },
      target: 500,
      dealer: 3,
    });
    for (let i = 0; i < 16; i++) {
      const ran = AI.runHand(match, level, E.seededRng(40 + i * 13 + level.length));
      assert.equal(ran.state.phase, 'done', level + ' bleibt in ' + ran.state.phase + ' nach ' + ran.steps + (ran.stuck ? ' ' + ran.stuck.reason : ''));
      assert.ok(ran.state.result, level);
      const before = match.handNo;
      E.applyToMatch(match, ran.state);
      const sum = match.scores.reduce((s, n) => s + n, 0);
      assert.equal(sum, 0, level + ' Summe');
      if (ran.state.result.completed) assert.equal(match.handNo, before + 1);
      else assert.equal(match.handNo, before);
    }
  });
});
