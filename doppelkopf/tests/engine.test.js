/* Regeltests Doppelkopf. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/doppelkopf/js/engine.js');

const R = E.normalizeRules();

test('Blatt mit Neunen: 48 Karten, 240 Augen, ohne Neunen 40 Karten', () => {
  const full = E.createDeck(true);
  const kurz = E.createDeck(false);
  assert.equal(full.length, 48);
  assert.equal(new Set(full).size, 48);
  assert.equal(E.sumEyes(full), 240);
  assert.equal(kurz.length, 40);
  assert.equal(E.sumEyes(kurz), 240);
  assert.equal(kurz.some((c) => c.indexOf('9.') >= 0), false);
  assert.equal(E.cardName('CQ.0'), 'Kreuz-Dame');
  assert.equal(E.eyesOf('DA.1'), 11);
  assert.equal(E.eyesOf('H10.0'), 10);
  assert.equal(E.eyesOf('SK.0'), 4);
  assert.equal(E.eyesOf('HQ.1'), 3);
  assert.equal(E.eyesOf('CJ.0'), 2);
  assert.equal(E.eyesOf('D9.1'), 0);
});

test('Voreinstellung: Neunen an, zweite Dulle sticht, Hochzeit an, Schweinchen und Armut aus', () => {
  assert.equal(R.neunen, true);
  assert.equal(R.zweiteDulle, true);
  assert.equal(R.hochzeit, true);
  assert.equal(R.damen, true);
  assert.equal(R.buben, true);
  assert.equal(R.farben, true);
  assert.equal(R.fleischlos, true);
  assert.equal(R.sonderpunkte, true);
  assert.equal(R.schweinchen, false);
  assert.equal(R.armut, false);
  assert.equal(R.pflichtsolo, false);
  assert.equal(E.normalizeTarget('20'), 20);
  assert.equal(E.normalizeTarget('custom', 7), 7);
});

test('Normalspiel: 26 Trümpfe, Dulle über den Damen, Herz-Zehn fehlt in der Fehlfarbe', () => {
  const list = E.trumpTypes({ type: 'normal' }, R, false);
  assert.equal(list.length, 13);
  assert.deepEqual(list.slice(0, 5), ['H10', 'CQ', 'SQ', 'HQ', 'DQ']);
  assert.deepEqual(list.slice(5, 9), ['CJ', 'SJ', 'HJ', 'DJ']);
  assert.deepEqual(list.slice(9), ['DA', 'D10', 'DK', 'D9']);
  assert.equal(E.isTrump('H10.0', { type: 'normal' }, R, false), true);
  assert.equal(E.isTrump('HA.0', { type: 'normal' }, R, false), false);
  assert.equal(E.isTrump('CA.0', { type: 'normal' }, R, false), false);
  const herz = E.trumpTypes({ type: 'solo', solo: 'farbe', suit: 'H' }, R, false);
  assert.equal(herz.indexOf('H10'), 0);
  assert.equal(herz.indexOf('HA'), herz.length - 3);
  assert.equal(herz.filter((t) => t === 'H10').length, 1);
  assert.deepEqual(E.trumpTypes({ type: 'solo', solo: 'damen' }, R, false), ['CQ', 'SQ', 'HQ', 'DQ']);
  assert.deepEqual(E.trumpTypes({ type: 'solo', solo: 'buben' }, R, false), ['CJ', 'SJ', 'HJ', 'DJ']);
  assert.deepEqual(E.trumpTypes({ type: 'solo', solo: 'fleischlos' }, R, false), []);
});

test('Gleicher Rang: die erste Karte sticht, die zweite Dulle nur mit der Option', () => {
  const game = { type: 'normal' };
  const trick = [
    { seat: 0, card: 'H10.0' },
    { seat: 1, card: 'DA.0' },
    { seat: 2, card: 'H10.1' },
    { seat: 3, card: 'D9.0' },
  ];
  assert.equal(E.trickWinner(trick, game, E.normalizeRules({ zweiteDulle: true }), false), 2);
  assert.equal(E.trickWinner(trick, game, E.normalizeRules({ zweiteDulle: false }), false), 0);
  const queens = [
    { seat: 0, card: 'CQ.0' },
    { seat: 1, card: 'CQ.1' },
    { seat: 2, card: 'SQ.0' },
    { seat: 3, card: 'D9.0' },
  ];
  assert.equal(E.trickWinner(queens, game, R, false), 0);
});

test('Schweinchen stehen über den Dullen, sobald sie angesagt sind', () => {
  const game = { type: 'normal' };
  const pigs = E.trumpTypes(game, E.normalizeRules({ schweinchen: true }), true);
  assert.equal(pigs[0], 'DA');
  assert.equal(pigs[1], 'H10');
  const trick = [
    { seat: 0, card: 'H10.0' },
    { seat: 1, card: 'DA.0' },
    { seat: 2, card: 'DA.1' },
    { seat: 3, card: 'CQ.0' },
  ];
  const rules = E.normalizeRules({ schweinchen: true, zweiteDulle: true });
  assert.equal(E.trickWinner(trick, game, rules, true), 2);
  assert.equal(E.trickWinner(trick, game, rules, false), 0);
});

test('Bedienen: Trumpf auf Trumpf, Farbe auf Farbe, sonst frei', () => {
  const state = E.installPosition({
    hands: [['CQ.0', 'CA.0', 'D9.0', 'HA.0'], ['CJ.0', 'S9.0'], ['H10.0'], ['DA.0']],
    game: { type: 'normal', re: [0], kontra: [1, 2, 3] },
    leader: 1,
    turn: 1,
  });
  E.actPlay(state, 1, 'CJ.0');
  assert.deepEqual(E.legalCards(state, 2).map(E.typeOf).sort(), ['H10']);
  E.actPlay(state, 2, 'H10.0');
  const legal = E.legalCards(state, 3);
  assert.ok(legal.indexOf('DA.0') >= 0);
  const color = E.installPosition({
    hands: [['CA.0', 'CQ.0'], ['C10.0', 'SA.0'], ['C9.0'], ['CK.0']],
    game: { type: 'normal', re: [0], kontra: [1, 2, 3] },
    leader: 0,
    turn: 0,
  });
  E.actPlay(color, 0, 'CA.0');
  assert.deepEqual(E.legalCards(color, 1), ['C10.0']);
});

test('Ansagefristen, Erwiderung und Hochzeit-Verschiebung', () => {
  const state = E.installPosition({
    hands: [[], [], [], []],
    game: { type: 'normal', re: [0, 2], kontra: [1, 3], clarified: true, clarifyShift: 0 },
    turn: 0,
    phase: 'play',
  });
  state.hands[0] = new Array(11).fill('S9.0');
  state.hands[0][0] = 'CQ.0';
  assert.equal(E.needCards(state, 're', 're'), 11);
  assert.ok(E.legalAnnouncements(state, 0).indexOf('re') >= 0);
  assert.equal(E.actAnnounce(state, 0, 're').ok, true);
  state.turn = 1;
  state.hands[1] = new Array(10).fill('S9.0');
  assert.equal(E.needCards(state, 'kontra', 'kontra'), 10);
  assert.equal(E.actAnnounce(state, 1, 'kontra').ok, true);
  state.turn = 0;
  state.hands[0] = new Array(8).fill('S9.0');
  state.hands[0][0] = 'CQ.0';
  assert.equal(E.needCards(state, 're', 'keine60'), 8);
  assert.equal(E.needCards(state, 're', 'keine90'), 9);
  assert.equal(E.actAnnounce(state, 0, 'keine60').ok, true);
  assert.equal(state.ann.absage.re.keine90, false);
  assert.equal(state.ann.absage.re.keine60, true);

  const wedding = E.installPosition({
    hands: [new Array(10).fill('D9.0'), [], [], []],
    game: { type: 'hochzeit', declarer: 0, re: [0, 1], kontra: [2, 3], clarified: true, clarifyShift: 1 },
    turn: 0,
  });
  wedding.hands[0][0] = 'CQ.0';
  wedding.hands[0][1] = 'CQ.1';
  assert.equal(E.needCards(wedding, 're', 're'), 10);
  assert.equal(E.actAnnounce(wedding, 0, 're').ok, true);

  const kurz = E.installPosition({
    rules: { neunen: false },
    hands: [new Array(9).fill('DA.0'), [], [], []],
    game: { type: 'normal', re: [0], kontra: [1, 2, 3] },
    turn: 0,
  });
  assert.equal(E.needCards(kurz, 're', 're'), 9);
  assert.equal(E.needCards(kurz, 're', 'keine90'), 8);
});

test('Gewinnschwellen: 121, nur Kontra, keine 90, niemand', () => {
  function pack(n, suit) {
    const denoms = [11, 10, 4, 3, 2];
    const rank = { 11: 'A', 10: '10', 4: 'K', 3: 'Q', 2: 'J' };
    function rec(left, start) {
      if (left === 0) return [];
      for (let i = start; i < denoms.length; i++) {
        if (denoms[i] <= left) {
          const rest = rec(left - denoms[i], i);
          if (rest) return [denoms[i]].concat(rest);
        }
      }
      return null;
    }
    return rec(n, 0).map((p, i) => suit + rank[p] + '.' + (i % 2));
  }
  function scored(reEyes, koEyes, ann) {
    const reCards = pack(reEyes, 'C');
    const koCards = pack(koEyes, 'S');
    assert.equal(E.sumEyes(reCards), reEyes);
    assert.equal(E.sumEyes(koCards), koEyes);
    const state = E.installPosition({
      game: { type: 'normal', re: [0, 2], kontra: [1, 3] },
      tricksWon: [reCards, koCards, [], []],
      trickLog: [
        { winner: 0, winningCard: 'S9.0', plays: [{ seat: 0, card: 'S9.0' }], eyes: 0 },
        { winner: 1, winningCard: 'C9.0', plays: [{ seat: 1, card: 'C9.0' }], eyes: 0 },
      ],
      ann: ann || E.installPosition().ann,
    });
    if (ann) state.ann = ann;
    return E.scoreState(state);
  }
  const plain = scored(121, 119);
  assert.equal(plain.reWon, true);
  assert.equal(plain.wert, 1);
  assert.deepEqual(plain.deltas, [1, -1, 1, -1]);

  const tie = scored(120, 120);
  assert.equal(tie.kontraWon, true);
  assert.equal(tie.wert, 1);
  assert.equal(tie.specialKontra, 1);
  assert.equal(tie.deltas[1], 2);

  const ann = E.installPosition().ann;
  ann.kontra = true;
  const onlyK = scored(120, 120, ann);
  assert.equal(onlyK.reWon, true);
  assert.equal(onlyK.wert, 3);

  const both = E.installPosition().ann;
  both.re = true;
  both.kontra = true;
  both.absage.re.keine90 = true;
  both.absage.kontra.keine60 = true;
  const none = scored(130, 110, both);
  assert.equal(none.reWon, false);
  assert.equal(none.kontraWon, false);
  assert.equal(none.wert, 0);
  assert.equal(none.deltas.reduce((s, n) => s + n, 0), 0);

  const made = scored(151, 89, both);
  assert.equal(made.reWon, true);
  assert.ok(made.wert >= 1);
});

test('Sonderpunkte: Fuchs, Karlchen, Doppelkopf, gegen die Damen, Solo dreifach', () => {
  const ann = E.installPosition().ann;
  const trick = {
    winner: 0,
    winningCard: 'CJ.0',
    eyes: 42,
    plays: [
      { seat: 1, card: 'DA.0' },
      { seat: 0, card: 'CJ.0' },
      { seat: 2, card: 'CA.0' },
      { seat: 3, card: 'HA.0' },
    ],
  };
  const state = E.installPosition({
    game: { type: 'normal', re: [0, 2], kontra: [1, 3] },
    tricksWon: [['DA.0', 'CJ.0', 'CA.0', 'HA.0'], [], [], []],
    trickLog: [trick],
    ann: ann,
  });
  while (E.sumEyes(state.tricksWon[0]) < 121) state.tricksWon[0].push('SA.0');
  const result = E.scoreState(state);
  assert.equal(result.reWon, true);
  assert.ok(result.specialRe >= 3);
  assert.equal(result.deltas.reduce((s, n) => s + n, 0), 0);

  const solo = E.installPosition({
    game: { type: 'solo', solo: 'karo', suit: 'D', declarer: 0, re: [0], kontra: [1, 2, 3], silent: true },
    tricksWon: [[], [], [], []],
    trickLog: [{ winner: 0, winningCard: 'S9.0', plays: [{ seat: 0, card: 'S9.0' }], eyes: 0 }],
  });
  solo.tricksWon[0] = ['CA.0', 'SA.0', 'HA.0', 'DA.0', 'C10.0', 'S10.0', 'H10.0', 'D10.0', 'CK.0', 'SK.0', 'HK.0', 'CA.1', 'SA.1', 'C10.1'];
  const soloResult = E.scoreState(solo);
  assert.equal(soloResult.reWon, true);
  assert.equal(soloResult.specialRe, 0);
  assert.equal(soloResult.label, 'Normalspiel');
  assert.equal(soloResult.deltas[0], 3 * soloResult.wert);
  assert.equal(soloResult.deltas[1], -soloResult.wert);
  assert.equal(soloResult.deltas.reduce((s, n) => s + n, 0), 0);
});

test('Hochzeit: der erste fremde Stich klärt, drei eigene werden Karo-Solo', () => {
  const hands = [
    ['CQ.0', 'CQ.1', 'H10.0', 'H10.1', 'DA.0', 'DA.1', 'DK.0', 'DK.1', 'D10.0', 'D10.1', 'DJ.0', 'CJ.0'],
    ['S9.0', 'C9.0', 'SA.0', 'SK.0', 'S10.0', 'SQ.0', 'SJ.0', 'HJ.0', 'HA.0', 'HK.0', 'C10.0', 'CK.0'],
    ['S9.1', 'C9.1', 'SA.1', 'SK.1', 'S10.1', 'SQ.1', 'SJ.1', 'HJ.1', 'HA.1', 'HK.1', 'C10.1', 'CK.1'],
    ['D9.0', 'D9.1', 'CA.0', 'CA.1', 'HQ.0', 'HQ.1', 'DQ.0', 'DQ.1', 'CJ.1', 'DJ.1', 'H9.0', 'H9.1'],
  ];
  const match = E.newMatch({ dealer: 3, rules: { hochzeit: true } });
  const state = E.installPosition({
    phase: 'reserve',
    dealer: 3,
    turn: 0,
    hands: hands,
    rules: { hochzeit: true },
  });
  state.order = E.orderFrom(3);
  assert.equal(E.actReserve(state, 0, { kind: 'hochzeit' }).ok, true);
  assert.equal(E.actReserve(state, 1, { kind: 'gesund' }).ok, true);
  assert.equal(E.actReserve(state, 2, { kind: 'gesund' }).ok, true);
  assert.equal(E.actReserve(state, 3, { kind: 'gesund' }).ok, true);
  assert.equal(state.game.type, 'hochzeit');
  assert.equal(state.leader, 0);
  assert.equal(E.actPlay(state, 0, 'DJ.0').ok, true);
  assert.equal(E.actPlay(state, 1, 'SQ.0').ok, true);
  assert.equal(E.actPlay(state, 2, 'SJ.1').ok, true);
  assert.equal(E.actPlay(state, 3, 'D9.0').ok, true);
  assert.equal(state.game.clarified, true);
  assert.equal(state.game.partner, 1);
  assert.equal(state.game.clarifyShift, 0);
  assert.equal(state.game.type, 'hochzeit');

  const solo = E.installPosition({
    phase: 'reserve',
    dealer: 3,
    turn: 0,
    hands: hands,
    rules: { hochzeit: true },
  });
  solo.order = E.orderFrom(3);
  E.actReserve(solo, 0, { kind: 'hochzeit' });
  E.actReserve(solo, 1, { kind: 'gesund' });
  E.actReserve(solo, 2, { kind: 'gesund' });
  E.actReserve(solo, 3, { kind: 'gesund' });
  for (let i = 0; i < 3; i++) {
    const card = solo.hands[0].slice().sort((a, b) => E.rankValue(b, solo.game, solo.rules, false) - E.rankValue(a, solo.game, solo.rules, false))[0];
    assert.equal(E.actPlay(solo, 0, card).ok, true);
    [1, 2, 3].forEach((s) => {
      const legal = E.legalCards(solo, s);
      assert.equal(E.actPlay(solo, s, legal[0]).ok, true);
    });
  }
  assert.equal(solo.game.type, 'solo');
  assert.equal(solo.game.solo, 'karo');
  assert.equal(solo.game.pflicht, false);
  assert.equal(match.dealer, 3);
});

test('Stille Hochzeit, wenn beide Kreuz-Damen gesund bleiben', () => {
  const hands = [[], [], [], []];
  const deck = E.createDeck(true);
  deck.forEach((c, i) => hands[i % 4].push(c));
  const queens = deck.filter((c) => E.typeOf(c) === 'CQ');
  for (let s = 0; s < 4; s++) hands[s] = hands[s].filter((c) => E.typeOf(c) !== 'CQ');
  hands[1].push(queens[0], queens[1]);
  hands[1].splice(0, 2);
  const state = E.installPosition({ phase: 'reserve', dealer: 3, turn: 0, hands: hands, rules: { hochzeit: true } });
  state.order = E.orderFrom(3);
  [0, 1, 2, 3].forEach((s) => assert.equal(E.actReserve(state, s, { kind: 'gesund' }).ok, true));
  assert.equal(state.game.type, 'solo');
  assert.equal(state.game.silent, true);
  assert.equal(state.game.declarer, 1);
  assert.equal(state.game.pflicht, false);
  assert.equal(state.leader, 0);
});

test('Armut: Tausch, Parteien, Neu geben wenn niemand mitnimmt', () => {
  const poor = ['CQ.0', 'S9.0', 'S9.1', 'C9.0', 'C9.1', 'H9.0', 'H9.1', 'SK.0', 'SK.1', 'SA.0', 'SA.1', 'CK.0'];
  const taker = ['H10.0', 'H10.1', 'SQ.0', 'HQ.0', 'DQ.0', 'CJ.0', 'SJ.0', 'HJ.0', 'DJ.0', 'DA.0', 'DA.1', 'D10.0'];
  const otherA = ['CQ.1', 'SQ.1', 'HQ.1', 'DQ.1', 'CJ.1', 'SJ.1', 'HJ.1', 'DJ.1', 'D10.1', 'DK.0', 'DK.1', 'D9.0'];
  const otherB = ['CA.0', 'CA.1', 'C10.0', 'C10.1', 'CK.1', 'S10.0', 'S10.1', 'HA.0', 'HA.1', 'HK.0', 'HK.1', 'D9.1'];
  const state = E.installPosition({
    phase: 'reserve',
    dealer: 3,
    turn: 0,
    rules: { armut: true, hochzeit: false },
    hands: [poor, taker, otherA, otherB],
  });
  state.order = E.orderFrom(3);
  assert.equal(E.actReserve(state, 0, { kind: 'armut' }).ok, true);
  assert.equal(E.actReserve(state, 1, { kind: 'gesund' }).ok, true);
  assert.equal(E.actReserve(state, 2, { kind: 'gesund' }).ok, true);
  assert.equal(E.actReserve(state, 3, { kind: 'gesund' }).ok, true);
  assert.equal(state.phase, 'armutTake');
  assert.equal(E.actArmutTake(state, 1, true).ok, true);
  assert.equal(E.actArmutGive(state, 0, ['CQ.0']).ok, true);
  const back = E.actArmutBack(state, 1, ['D10.0']);
  assert.equal(back.ok, true, back.reason);
  assert.equal(state.game.type, 'armut');
  assert.deepEqual(state.game.re.slice().sort(), [0, 1]);
  assert.equal(state.phase, 'play');
  assert.equal(state.hands[0].length, 12);
  assert.equal(state.hands[1].length, 12);

  const none = E.installPosition({
    phase: 'reserve', dealer: 3, turn: 0, rules: { armut: true, hochzeit: false },
    hands: [poor, taker, otherA, otherB],
  });
  none.order = E.orderFrom(3);
  ;[0, 1, 2, 3].forEach((s) => E.actReserve(none, s, s === 0 ? { kind: 'armut' } : { kind: 'gesund' }));
  assert.equal(E.actArmutTake(none, 1, false).ok, true);
  assert.equal(E.actArmutTake(none, 2, false).ok, true);
  assert.equal(E.actArmutTake(none, 3, false).ok, true);
  assert.equal(none.result.kind, 'redeal');
  assert.equal(none.result.completed, false);
});

test('Pflichtsolo: Solist spielt auf, derselbe Geber, Vorführung wechselt', () => {
  const match = E.newMatch({ rules: { pflichtsolo: true }, dealer: 3 });
  match.pflicht = [false, false, false, false];
  match.roundGames = 21;
  const state = E.dealHand(match, E.seededRng(3));
  assert.equal(state.phase, 'solo');
  assert.equal(state.vorfuehrung, true);
  assert.equal(state.turn, 0);
  assert.equal(E.actSolo(state, 0, { solo: 'damen' }).ok, true);
  assert.equal(state.leader, 0);
  assert.equal(state.game.pflicht, true);
  state.phase = 'done';
  state.result = {
    kind: 'game', label: 'Damensolo', note: '', deltas: [3, -1, -1, -1], winners: [0],
    completed: true, sameDealer: false, pflichtSeat: 0, reWon: true, kontraWon: false, wert: 1,
  };
  E.applyToMatch(match, state);
  assert.equal(match.dealer, 0);
  assert.equal(match.pflicht[0], true);
  assert.equal(match.handNo, 1);

  const stay = E.newMatch({ rules: { pflichtsolo: true }, dealer: 3 });
  const hand = E.dealHand(stay, E.seededRng(9));
  if (hand.phase === 'reserve') {
    E.actReserve(hand, hand.turn, { kind: 'solo', solo: 'buben', pflicht: true });
    while (hand.phase === 'reserve') E.actReserve(hand, hand.turn, { kind: 'gesund' });
  }
  if (hand.game && hand.game.pflicht && !hand.game.vorfuehrung) {
    hand.phase = 'done';
    hand.result = {
      kind: 'game', label: 'x', note: '', deltas: [0, 0, 0, 0], winners: [],
      completed: true, sameDealer: true, pflichtSeat: hand.game.declarer, reWon: true, kontraWon: false, wert: 1,
    };
    const dealer = hand.dealer;
    E.applyToMatch(stay, hand);
    assert.equal(stay.dealer, dealer);
    assert.equal(stay.pflicht[hand.game.declarer], true);
  }
});
