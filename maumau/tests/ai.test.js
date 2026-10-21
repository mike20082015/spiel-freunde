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

function seatAfter(seat, dir, n, steps) {
  let s = seat;
  for (let i = 0; i < (steps == null ? 1 : steps); i++) s = E.nextIndex(s, dir, n);
  return s;
}

test('Turnier und Anfänger kontern eine 7 von jedem Sitz', () => {
  ['anfaenger', 'turnier'].forEach((level) => {
    [3, 4, 5].forEach((n) => {
      [1, -1].forEach((dir) => {
        for (let seat = 0; seat < n; seat++) {
          const hands = Array.from({ length: n }, () => ['CK', 'D9', 'S8', 'HQ', 'C9']);
          hands[seat] = ['D7', 'S9'];
          const st = E.setup({
            rules: { opponents: n - 1 },
            hands: hands,
            discard: ['HK'],
            talon: ['CA', 'D8', 'H8', 'S10'],
            pendingDraw: 2,
            direction: dir,
            turn: seat,
          });
          const where = level + ' n=' + n + ' dir=' + dir + ' seat=' + seat;
          const mv = AI.act(st, seat, level, () => 1);
          assert.equal(mv.type, 'play', where);
          assert.equal(mv.card, 'D7', where);
          assert.equal(mv.call, 'mau', where);
          assert.equal(E.apply(st, seat, mv).ok, true, where);
          assert.equal(st.pendingDraw, 4, where);
          assert.equal(st.phase, 'play', where);
          assert.equal(st.turn, seatAfter(seat, dir, n, 1), where);
        }
      });
    });
  });
});

test('Kneipe kontert, wenn der Nächste wenig hat oder der Stapel schon hoch ist', () => {
  [3, 4, 5].forEach((n) => {
    [1, -1].forEach((dir) => {
      for (let seat = 0; seat < n; seat++) {
        function state(nextCount, pending) {
          const hands = Array.from({ length: n }, () => ['CK', 'D9', 'S8', 'HQ']);
          hands[seat] = ['D7', 'S9', 'C8'];
          hands[seatAfter(seat, dir, n, 1)] = ['H8', 'H9', 'H10', 'HQ', 'HK'].slice(0, nextCount);
          return E.setup({
            rules: { opponents: n - 1 },
            hands: hands,
            discard: ['SK'],
            talon: ['CA', 'DA', 'SA', 'HA', 'CJ', 'DJ', 'SJ', 'C10'],
            pendingDraw: pending,
            direction: dir,
            turn: seat,
          });
        }
        const where = 'n=' + n + ' dir=' + dir + ' seat=' + seat;
        const stack = state(3, 2);
        const stacked = AI.act(stack, seat, 'kneipe', () => 1);
        assert.equal(stacked.type, 'play', where);
        assert.equal(stacked.card, 'D7', where);
        assert.equal(E.apply(stack, seat, stacked).ok, true, where);
        assert.equal(stack.pendingDraw, 4, where);
        assert.equal(stack.turn, seatAfter(seat, dir, n, 1), where);

        const high = state(5, 4);
        const again = AI.act(high, seat, 'kneipe', () => 1);
        assert.equal(again.type, 'play', where);
        assert.equal(E.apply(high, seat, again).ok, true, where);
        assert.equal(high.pendingDraw, 6, where);

        const pass = state(4, 2);
        const drawn = AI.act(pass, seat, 'kneipe', () => 1);
        assert.equal(drawn.type, 'drawPenalty', where);
        const before = pass.hands[seat].length;
        assert.equal(E.apply(pass, seat, drawn).ok, true, where);
        assert.equal(pass.pendingDraw, 0, where);
        assert.equal(pass.hands[seat].length, before + 2, where);
        assert.equal(pass.turn, seatAfter(seat, dir, n, 1), where);
        assert.equal(pass.phase, 'play', where);
      }
    });
  });
});

test('eine KI-7 als letzte Karte lässt den Stapel stehen, bis gezogen wird', () => {
  ['anfaenger', 'turnier', 'kneipe'].forEach((level) => {
    [3, 4, 5].forEach((n) => {
      [1, -1].forEach((dir) => {
        for (let seat = 0; seat < n; seat++) {
          const hands = Array.from({ length: n }, () => ['CK', 'D9', 'S8', 'HQ']);
          hands[seat] = ['D7'];
          const st = E.setup({
            rules: { opponents: n - 1 },
            hands: hands,
            discard: ['D9'],
            talon: ['HA', 'S10', 'CQ', 'CK', 'C8', 'HJ'],
            direction: dir,
            turn: seat,
          });
          const where = level + ' n=' + n + ' dir=' + dir + ' seat=' + seat;
          const mv = AI.act(st, seat, level, () => 1);
          assert.equal(mv.type, 'play', where);
          assert.equal(mv.card, 'D7', where);
          assert.equal(mv.call, 'maumau', where);
          assert.equal(E.apply(st, seat, mv).ok, true, where);
          assert.equal(st.phase, 'play', where);
          assert.equal(st.pendingDraw, 2, where);
          assert.equal(st.hands[seat].length, 0, where);
          const nxt = seatAfter(seat, dir, n, 1);
          assert.equal(st.turn, nxt, where);
          assert.equal(E.apply(st, nxt, { type: 'drawPenalty' }).ok, true, where);
          assert.equal(st.pendingDraw, 0, where);
          assert.equal(st.phase, 'done', where);
          assert.equal(st.winner, seat, where);
          assert.equal(st.points[seat], 0, where);
          assert.equal(st.hands[nxt].length, 6, where);
        }
      });
    });
  });
});

test('Anfänger vergisst Mau-Mau auf der letzten 7, der Stapel bleibt trotzdem', () => {
  const st = E.setup({
    rules: { opponents: 2 },
    hands: [['CK', 'D9'], ['D7'], ['S8', 'HQ']],
    discard: ['D8'],
    talon: ['HA', 'SK'],
    turn: 1,
    direction: -1,
  });
  const mv = AI.act(st, 1, 'anfaenger', () => 0);
  assert.equal(mv.type, 'play');
  assert.equal(mv.card, 'D7');
  assert.equal(mv.call, undefined);
  assert.equal(E.apply(st, 1, mv).ok, true);
  assert.equal(st.phase, 'call');
  assert.equal(st.pendingDraw, 2);
  assert.equal(E.apply(st, 0, { type: 'forgive' }).ok, true);
  assert.equal(st.phase, 'play');
  assert.equal(st.pendingDraw, 2);
  assert.equal(st.hands[1].length, 0);
  assert.equal(st.turn, 0);
  assert.equal(E.apply(st, 0, { type: 'drawPenalty' }).ok, true);
  assert.equal(st.winner, 1);
  assert.equal(st.pendingDraw, 0);
});
