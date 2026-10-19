/* KI-Stufen: Ansage und ganze Spiele. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/schafkopf/js/engine.js');
const AI = require('../../public/schafkopf/js/ai.js');

test('Anfänger ruft ab vier Trümpfen mit zwei Obern die einzelne kleine Farbe', () => {
  const hand = ['EO', 'GO', 'HA', 'H9', 'E7', 'GK', 'S9', 'S8'];
  const state = E.installPosition({ hands: [hand, [], [], []], phase: 'choose', turn: 0 });
  const offer = AI.chooseGame(state, 0, 'anfaenger');
  assert.equal(offer.type, 'sauspiel');
  assert.equal(offer.suit, 'E');
  const weak = E.installPosition({
    hands: [['E7', 'G8', 'S9', 'H7', 'HK', 'SK', 'G9', 'E8'], [], [], []],
    phase: 'bid',
    turn: 0,
  });
  assert.equal(AI.chooseGame(weak, 0, 'anfaenger'), null);
});

test('Kneipe spielt Solo mit sechs Trümpfen und zwei hohen Obern', () => {
  const hand = ['EO', 'GO', 'EU', 'GU', 'HA', 'H10', 'S7', 'G8'];
  const state = E.installPosition({ hands: [hand, [], [], []], phase: 'choose' });
  const offer = AI.chooseGame(state, 0, 'kneipe');
  assert.equal(offer.type, 'solo');
  assert.equal(offer.suit, 'H');
});

test('Volle Spiele laufen bei allen Stufen zu Ende und bleiben nullsummig', () => {
  ['anfaenger', 'kneipe', 'turnier'].forEach((level) => {
    const match = E.newMatch({ rules: { allPass: 'ramsch', stoss: true, tout: true, farbwenz: true }, target: 500, dealer: 0 });
    for (let i = 0; i < 12; i++) {
      const ran = AI.runHand(match, level, E.seededRng(100 + i * 17 + level.length));
      assert.equal(ran.state.phase, 'done', level + ' bleibt in ' + ran.state.phase + ' nach ' + ran.steps);
      assert.ok(ran.state.result, level);
      E.applyToMatch(match, ran.state);
      const sum = match.scores.reduce((s, n) => s + n, 0);
      assert.equal(sum + match.pot, 0, level + ' Summe');
    }
    assert.ok(match.handNo === 12);
  });
});
