/* KI-Stufen und ganze Hände. Die Mitspieler sehen nur die eigene Hand. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../../public/romme/js/engine.js');
const AI = require('../../public/romme/js/ai.js');

function pile(state) {
  const cards = state.hands.flat()
    .concat(state.stock, state.discard, state.held, state.workspace);
  state.melds.forEach((meld) => cards.push.apply(cards, meld.cards));
  return cards;
}

test('Die KI liest keine fremden Hände', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../public/romme/js/ai.js'), 'utf8');
  assert.doesNotMatch(src, /hands\[\s*[123]\s*\]/);
  assert.doesNotMatch(src, /state\.hands\[\s*(1|2|3)\s*\]/);
  assert.match(src, /publicView/);
  const a = E.newGame({ dealer: 3, rng: E.seededRng(4), cut: false });
  const b = E.newGame({ dealer: 3, rng: E.seededRng(4), cut: false });
  b.hands[1].reverse();
  b.hands[2].reverse();
  const da = AI.playTurn(a, a.turn, 'kneipe');
  const db = AI.playTurn(b, b.turn, 'kneipe');
  assert.deepEqual(da, db);
  const view = E.publicView(a, 0);
  assert.equal('hands' in view, false);
  assert.deepEqual(view.handCounts.length, 4);
});

test('Volle Hände laufen bei allen drei Stufen zu Ende', () => {
  for (const level of ['anfaenger', 'kneipe', 'turnier']) {
    for (let seed = 1; seed <= 3; seed++) {
      const state = E.newGame({ dealer: seed % 4, rng: E.seededRng(seed * 17 + level.length), cut: false });
      const expected = pile(state).length;
      let guard = 0;
      while (state.phase !== 'done' && guard++ < 500) {
        const seat = state.turn;
        AI.playTurn(state, seat, level);
        if (state.turn === seat && state.phase !== 'done') break;
      }
      assert.equal(state.phase, 'done', level + ' seed ' + seed + ' bleibt hängen');
      assert.ok(state.result, level + ' seed ' + seed);
      const cards = pile(state);
      assert.equal(cards.length, expected, level + ' seed ' + seed + ' verliert Karten');
      assert.equal(new Set(cards).size, cards.length, level + ' seed ' + seed + ' doppelt Karten');
    }
  }
});
