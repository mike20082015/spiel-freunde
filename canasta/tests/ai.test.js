/* KI-Stufen und ganze Runden. */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../../public/canasta/js/engine.js');
const AI = require('../../public/canasta/js/ai.js');

function kings(n) {
  const suits = ['H', 'S', 'D', 'C'];
  const out = [];
  for (let i = 0; i < n; i++) out.push(suits[i % 4] + 'K#' + (i < 4 ? 0 : 1));
  return out;
}

function sitting(partial) {
  const s = E.blankState(partial.rules, partial.scores);
  s.hands[0] = (partial.hand || []).slice();
  if (partial.melds) s.melds = partial.melds;
  if (partial.discard) s.discard = partial.discard.slice();
  if (partial.frozen) s.frozen = true;
  if (partial.stockCount) s.stock.length = partial.stockCount;
  E.noteTurnStart(s, 0);
  s.phase = partial.phase || 'meld';
  s.handAtTurnStart = s.hands[0].slice();
  if (partial.stockCount === 0) s.stock = [];
  return s;
}

test('Die KI liest keine fremden Hände', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../public/canasta/js/ai.js'), 'utf8');
  assert.doesNotMatch(src, /hands\[\s*[123]\s*\]/);
  assert.doesNotMatch(src, /state\.hands\[\s*(1|2|3)\s*\]/);
  const a = E.newGame({ dealer: 3, rng: E.seededRng(4) });
  const b = E.snap(a);
  b.hands[1].reverse();
  const rng = E.seededRng(9);
  const rb = E.seededRng(9);
  const da = AI.act(a, a.turn, 'turnier', rng);
  const db = AI.act(b, b.turn, 'turnier', rb);
  assert.deepStrictEqual(da, db);
});

test('Anfänger wirft die höchste Einzelkarte, Kneipe nicht den Rang der Gegner', () => {
  const hand = ['SK#0', 'C4#0', 'HA#0', 'SA#0'];
  const fresh = sitting({ hand: hand, stockCount: 20 });
  const beginner = AI.act(fresh, 0, 'anfaenger', () => 0);
  assert.strictEqual(beginner.type, 'discard');
  assert.strictEqual(beginner.card, 'SK#0');

  const guarded = sitting({
    hand: hand,
    stockCount: 20,
    melds: [[], [{ rank: 'K', cards: ['HK#0', 'DK#0', 'CK#0', 'HK#1'], black: false }]],
  });
  const pub = AI.act(guarded, 0, 'kneipe', () => 0.5);
  assert.strictEqual(pub.type, 'discard');
  assert.notStrictEqual(pub.card, 'SK#0');
  assert.strictEqual(pub.card, 'C4#0');
});

test('Anfänger nimmt einen offenen Stapel, sobald es geht', () => {
  const s = sitting({
    phase: 'draw',
    hand: ['SK#0', 'DK#0', 'HA#0', 'SA#0', 'DA#0', 'C4#0'],
    discard: ['C6#0', 'D6#0', 'HK#0'],
    stockCount: 30,
  });
  const action = AI.act(s, 0, 'anfaenger', () => 0);
  assert.strictEqual(action.type, 'take');
  assert.ok(action.handCards.indexOf('SK#0') !== -1);
});

test('Kneipe blockt mit der schwarzen Drei, statt den Gegnern die Ablage zu schenken', () => {
  const s = sitting({
    hand: ['S3#0', 'C4#0', 'H9#0'],
    stockCount: 20,
    melds: [
      [{ rank: 'A', cards: ['HA#0', 'SA#0', 'DA#0'], black: false }],
      [{ rank: 'K', cards: kings(3), black: false }],
    ],
  });
  s.minMet = [true, true];
  const action = AI.act(s, 0, 'kneipe', () => 0.9);
  assert.strictEqual(action.type, 'discard');
  assert.strictEqual(action.card, 'S3#0');
});

test('Volle Runden laufen bei allen drei Stufen zu Ende', () => {
  for (const level of ['anfaenger', 'kneipe', 'turnier']) {
    for (let seed = 1; seed <= 4; seed++) {
      const rng = E.seededRng(seed * 17 + level.length);
      const state = E.newGame({ dealer: (seed + 3) % 4, rng: rng });
      let guard = 0;
      let abandoned = false;
      while (state.phase !== 'done' && guard++ < 800) {
        const stepped = AI.step(state, level, rng);
        if (stepped.res && stepped.res.abandoned) abandoned = true;
      }
      assert.strictEqual(state.phase, 'done', level + ' seed ' + seed + ' bleibt hängen');
      assert.strictEqual(abandoned, false, level + ' seed ' + seed + ' bricht ab');
      assert.ok(state.result);
      assert.strictEqual(typeof state.result.teams[0].total, 'number');
      assert.strictEqual(typeof state.result.teams[1].total, 'number');
      const all = state.hands.flat().concat(state.stock.filter(Boolean), state.discard, state.reds.flat(), state.melds.flat().flatMap((m) => m.cards));
      assert.strictEqual(new Set(all).size, all.length);
    }
  }
});
