/* Siebener-Stapel: die Strafe ist immer 2 mal die Anzahl der gehaltenen Siebenen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/maumau/js/engine.js');
const AI = require('../../public/maumau/js/ai.js');

function rules(extra) {
  return E.normalizeRules(Object.assign({ opponents: 2 }, extra || {}));
}

function seatAfter(seat, dir, n, steps) {
  let s = seat;
  for (let i = 0; i < (steps == null ? 1 : steps); i++) s = E.nextIndex(s, dir, n);
  return s;
}

const TALON = ['CA', 'DA', 'SA', 'HA', 'CK', 'CQ', 'HQ', 'SJ', 'D8', 'D9', 'H10', 'S10', 'C8', 'SK', 'C10', 'D10', 'DJ', 'S9', 'C9', 'HK', 'SQ', 'H8'];

function table(partial) {
  return E.setup(Object.assign({
    rules: rules(),
    talon: TALON.slice(),
    direction: 1,
    discard: ['H9'],
  }, partial));
}

function pay(st, seat, move) {
  const before = st.hands[seat].length;
  const owed = st.pendingDraw;
  assert.equal(E.apply(st, seat, move).ok, true);
  assert.equal(st.hands[seat].length - before, owed);
  assert.equal(st.pendingDraw, 0);
  const last = st.log[st.log.length - 1];
  assert.equal(last.type, 'penaltyDraw');
  assert.equal(last.cards, owed);
  return owed;
}

test('Horst muss sechs Karten ziehen, wenn der Mensch die dritte 7 legt', () => {
  const st = table({
    hands: [
      ['C7', 'H8', 'S8', 'D8'],
      ['H7', 'DK', 'DQ', 'CJ'],
      ['D7', 'C8', 'HK', 'SQ'],
    ],
    turn: 1,
  });
  assert.equal(E.apply(st, 1, { type: 'play', card: 'H7' }).ok, true);
  assert.equal(st.pendingDraw, 2);
  assert.equal(st.turn, 2);
  assert.equal(E.apply(st, 2, { type: 'play', card: 'D7' }).ok, true);
  assert.equal(st.pendingDraw, 4);
  assert.equal(st.turn, 0);
  assert.equal(E.apply(st, 0, { type: 'play', card: 'C7' }).ok, true);
  assert.equal(st.pendingDraw, 6);
  assert.equal(st.turn, 1);
  assert.equal(st.hands[1].indexOf('H7'), -1);
  const mv = AI.act(st, 1, 'kneipe', () => 0.2);
  assert.equal(mv.type, 'drawPenalty');
  assert.equal(pay(st, 1, mv), 6);
  assert.equal(st.phase, 'play');
  assert.equal(st.winner, null);
});

test('Mensch an KI, KI an KI und KI an Mensch geben den vollen Stapel weiter', () => {
  function chain(dir, lastSeat) {
    const n = 3;
    const order = [];
    let seat = lastSeat;
    for (let i = 0; i < 3; i++) {
      order.push(seat);
      seat = seatAfter(seat, dir, n, 1);
    }
    assert.equal(seat, lastSeat);
    const cards = ['H7', 'D7', 'C7'];
    const hands = [
      ['S8', 'D8', 'C8', 'HK'],
      ['S9', 'D9', 'C9', 'SK'],
      ['SJ', 'DJ', 'CJ', 'SQ'],
    ];
    order.forEach((s, i) => { hands[s] = [cards[i], 'HA', 'DA', 'CA']; });
    const st = table({ hands: hands, direction: dir, turn: order[0] });
    order.forEach((s, i) => {
      assert.equal(st.turn, s);
      assert.equal(st.pendingDraw, i * 2);
      assert.equal(E.apply(st, s, { type: 'play', card: cards[i] }).ok, true);
      assert.equal(st.pendingDraw, (i + 1) * 2);
    });
    assert.equal(st.turn, lastSeat);
    const level = lastSeat === 0 ? null : 'kneipe';
    const mv = level ? AI.act(st, lastSeat, level, () => 0.8) : { type: 'drawPenalty' };
    assert.equal(mv.type, 'drawPenalty');
    assert.equal(pay(st, lastSeat, mv), 6);
  }
  chain(1, 1);
  chain(-1, 1);
  chain(1, 0);
  chain(-1, 2);
});

test('zu dritt stapeln 2, 4, 6 und 8 und der Nächste ohne 7 zahlt alles', () => {
  const sevens = ['C7', 'S7', 'H7', 'D7'];
  [1, -1].forEach((dir) => {
    [1, 2, 3, 4].forEach((count) => {
      const hands = [
        ['SK', 'SQ', 'SJ'],
        ['HK', 'HQ', 'HJ'],
        ['DK', 'DQ', 'DJ'],
      ];
      let seat = 0;
      for (let i = 0; i < count; i++) {
        hands[seat] = [sevens[i]].concat(hands[seat]);
        seat = seatAfter(seat, dir, 3, 1);
      }
      const drawer = seat;
      const st = table({ hands: hands, direction: dir, turn: 0, discard: ['C9'] });
      seat = 0;
      for (let i = 0; i < count; i++) {
        assert.equal(E.apply(st, seat, { type: 'play', card: sevens[i] }).ok, true);
        assert.equal(st.pendingDraw, (i + 1) * 2);
        seat = seatAfter(seat, dir, 3, 1);
      }
      assert.equal(st.turn, drawer);
      assert.equal(E.legalMoves(st, drawer).some((m) => m.type === 'play'), false);
      const mv = drawer === 0 ? { type: 'drawPenalty' } : AI.act(st, drawer, 'turnier', () => 0);
      assert.equal(mv.type, 'drawPenalty');
      assert.equal(pay(st, drawer, mv), count * 2);
    });
  });
});

test('eine letzte 7 lässt den ganzen Stapel stehen, auch bei sechs Karten', () => {
  const st = table({
    hands: [['H7'], ['S8', 'D8', 'C8'], ['D7', 'HK', 'SK', 'CQ']],
    discard: ['H8'],
    turn: 0,
  });
  assert.equal(E.apply(st, 0, { type: 'play', card: 'H7', call: 'maumau' }).ok, true);
  assert.equal(st.hands[0].length, 0);
  assert.equal(st.winner, null);
  assert.equal(E.apply(st, 2, { type: 'play', card: 'D7' }).ok, false);
  assert.equal(st.turn, 1);
  const held = AI.act(st, 1, 'kneipe', () => 1);
  assert.equal(held.type, 'drawPenalty');
  assert.equal(pay(st, 1, held), 2);
  assert.equal(st.phase, 'done');
  assert.equal(st.winner, 0);

  const deep = table({
    hands: [
      ['C7', 'S8', 'D8'],
      ['H7'],
      ['D7', 'HK', 'SK'],
    ],
    discard: ['H9'],
    turn: 1,
  });
  assert.equal(E.apply(deep, 1, { type: 'play', card: 'H7', call: 'maumau' }).ok, true);
  assert.equal(E.apply(deep, 2, { type: 'play', card: 'D7' }).ok, true);
  assert.equal(E.apply(deep, 0, { type: 'play', card: 'C7' }).ok, true);
  assert.equal(deep.pendingDraw, 6);
  assert.equal(deep.turn, 1);
  assert.equal(deep.hands[1].length, 0);
  const mv = AI.act(deep, 1, 'kneipe', () => 0);
  assert.equal(mv.type, 'drawPenalty');
  assert.equal(pay(deep, 1, mv), 6);
  assert.equal(deep.phase, 'play');
  assert.equal(deep.winner, null);
  assert.equal(deep.hands[1].length, 6);
});

test('wer statt zu stapeln zieht oder behält, zahlt den ganzen Stapel', () => {
  const draw = table({
    hands: [['C7', 'H8', 'S8'], ['DK', 'DQ'], ['HK', 'SK']],
    pendingDraw: 6,
    turn: 0,
  });
  assert.equal(E.legalMoves(draw, 0).some((m) => m.card === 'C7'), true);
  assert.equal(E.legalMoves(draw, 0).some((m) => m.type === 'draw'), false);
  assert.equal(pay(draw, 0, { type: 'draw' }), 6);
  assert.equal(draw.hands[0].indexOf('C7') >= 0, true);

  const kept = table({
    hands: [['H9', 'D8'], ['DK'], ['HK']],
    discard: ['S7'],
    pendingDraw: 6,
    phase: 'drawn',
    drawnCard: 'D8',
    turn: 0,
  });
  assert.equal(E.legalMoves(kept, 0).some((m) => m.type === 'keep'), false);
  assert.equal(E.legalMoves(kept, 0).some((m) => m.type === 'drawPenalty'), true);
  const ai = AI.act(kept, 0, 'kneipe', () => 0.5);
  assert.equal(ai.type, 'drawPenalty');
  assert.equal(pay(kept, 0, { type: 'keep' }), 6);
  assert.equal(kept.phase, 'play');
});

test('über viele zufällige Partien ist jede Strafe doppelt so groß wie der Stapel', () => {
  const levels = ['anfaenger', 'kneipe', 'turnier'];
  for (let seed = 1; seed <= 80; seed++) {
    levels.forEach((level) => {
      const rng = E.seededRng(seed * 17 + level.length);
      const match = E.blankMatch(rules({
        sevenSkip: seed % 5 === 0,
        startEffect: seed % 4 === 0,
        playDrawn: seed % 3 !== 0,
      }), 100);
      const st = E.dealHand(match, rng);
      let sevens = st.pendingDraw / 2;
      for (let guard = 0; guard < 500 && st.phase !== 'done'; guard++) {
        assert.equal(st.pendingDraw, sevens * 2, seed + ' ' + level);
        let actor = st.turn;
        let mv;
        if (st.phase === 'call') {
          const debtor = st.pendingCall.seat;
          if (rng() < 0.4) {
            actor = debtor;
            mv = { type: 'call' };
          } else {
            actor = seatAfter(debtor, 1, st.players, 1);
            if (actor === debtor) actor = seatAfter(debtor, 1, st.players, 2);
            mv = rng() < 0.5 ? { type: 'notice' } : { type: 'forgive' };
          }
        } else if (actor === 0) {
          const legal = E.legalMoves(st, 0);
          mv = legal[Math.floor(rng() * legal.length)];
          if (st.pendingDraw >= 6 && legal.some((m) => m.type === 'drawPenalty') && rng() < 0.5) {
            mv = { type: 'draw' };
          }
        } else {
          mv = AI.act(st, actor, level, rng) || { type: 'draw' };
        }
        const owed = st.pendingDraw;
        const before = st.hands[actor].length;
        const available = st.talon.length + Math.max(0, st.discard.length - 1);
        const res = E.apply(st, actor, mv);
        assert.equal(res.ok, true, seed + ' ' + level + ' ' + JSON.stringify(mv));
        if (mv.type === 'play' && E.rankOf(mv.card) === '7') sevens += 1;
        else if (mv.type === 'drawPenalty' || (owed > 0 && (mv.type === 'draw' || mv.type === 'keep'))) {
          const got = st.hands[actor].length - before;
          const expect = Math.min(owed, available);
          assert.equal(got, expect, seed + ' ' + level + ' expected ' + expect + ' got ' + got);
          if (available >= owed) assert.equal(got, owed);
          assert.equal(st.log[st.log.length - 1].cards, got);
          sevens = 0;
        } else if (mv.type === 'draw') {
          assert.equal(owed, 0);
        }
        if (st.phase === 'done' && st.winReason !== 'aces') assert.equal(sevens, 0);
      }
    });
  }
});
