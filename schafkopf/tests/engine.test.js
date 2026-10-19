/* Regeltests Schafkopf. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/schafkopf/js/engine.js');

const RUF = { type: 'sauspiel' };
const DECK = () => E.createDeck('long');

test('Langes Blatt: 32 Karten, 120 Augen, kurzes Blatt ohne 7 und 8', () => {
  const long = DECK();
  const short = E.createDeck('short');
  assert.equal(long.length, 32);
  assert.equal(new Set(long).size, 32);
  assert.equal(E.sumEyes(long), 120);
  assert.equal(short.length, 24);
  assert.equal(E.sumEyes(short), 120);
  assert.equal(short.some((c) => c.endsWith('7') || c.endsWith('8')), false);
  assert.equal(E.cardName('EO'), 'Eichel-Ober');
  assert.equal(E.eyesOf('SA'), 11);
  assert.equal(E.eyesOf('G10'), 10);
  assert.equal(E.eyesOf('HK'), 4);
  assert.equal(E.eyesOf('SO'), 3);
  assert.equal(E.eyesOf('EU'), 2);
  assert.equal(E.eyesOf('H7'), 0);
});

test('Trumpf: Rufspiel 14, Wenz 4, Farbwenz 11, Solo 14, Ober und Unter nie in der Farbe', () => {
  assert.equal(E.trumpList(RUF).length, 14);
  assert.deepEqual(E.trumpList(RUF).slice(0, 8), ['EO', 'GO', 'HO', 'SO', 'EU', 'GU', 'HU', 'SU']);
  assert.deepEqual(E.trumpList(RUF).slice(8), ['HA', 'H10', 'HK', 'H9', 'H8', 'H7']);
  assert.deepEqual(E.trumpList({ type: 'wenz' }), ['EU', 'GU', 'HU', 'SU']);
  assert.equal(E.trumpList({ type: 'farbwenz', suit: 'E' }).length, 11);
  assert.equal(E.trumpList({ type: 'solo', suit: 'G' }).length, 14);
  assert.equal(E.isTrump('EO', RUF), true);
  assert.equal(E.isTrump('EA', RUF), false);
  assert.equal(E.isTrump('EO', { type: 'wenz' }), false);
  assert.equal(E.effSuit('EO', RUF), 'T');
  assert.equal(E.effSuit('E9', RUF), 'E');
});

test('Rufbare Sau: nicht auf der Hand, mindestens eine Farbkarte, Herz nicht rufbar', () => {
  assert.equal(E.canCall(['E9', 'GK', 'HA'], 'E'), true);
  assert.equal(E.canCall(['EA', 'E9'], 'E'), false);
  assert.equal(E.canCall(['EO', 'EU'], 'E'), false);
  assert.equal(E.canCall(['H9', 'HK'], 'H'), false);
  assert.equal(E.canCall(['S10'], 'S'), true);
});

test('Stich: höchster Trumpf, sonst die Farbe', () => {
  const color = [
    { seat: 0, card: 'EA' },
    { seat: 1, card: 'E10' },
    { seat: 2, card: 'EK' },
    { seat: 3, card: 'E9' },
  ];
  assert.equal(E.trickWinner(color, RUF), 0);
  color[3] = { seat: 3, card: 'SU' };
  assert.equal(E.trickWinner(color, RUF), 3);
  const trump = [
    { seat: 0, card: 'HA' },
    { seat: 1, card: 'HK' },
    { seat: 2, card: 'SU' },
    { seat: 3, card: 'EO' },
  ];
  assert.equal(E.trickWinner(trump, RUF), 3);
});

test('Bedienen, Sau muss auf die Ruffarbe, Abwerfen erst im letzten Stich', () => {
  const lead = E.installPosition({
    hands: [
      ['EA', 'E9', 'GK', 'S7'],
      ['EO', 'HA', 'G10', 'SK'],
      ['E10', 'EU', 'H10', 'S9'],
      ['EK', 'GO', 'HK', 'S8'],
    ],
    game: { type: 'sauspiel', suit: 'E', declarer: 1 },
    leader: 2,
    turn: 2,
  });
  assert.equal(lead.game.partner, 0);
  E.actPlay(lead, 2, 'E10');
  assert.equal(lead.searched, true);
  assert.deepEqual(E.legalCards(lead, 3), ['EK']);
  E.actPlay(lead, 3, 'EK');
  assert.deepEqual(E.legalCards(lead, 0), ['EA']);

  const discard = E.installPosition({
    hands: [['EA', 'GO', 'H9'], ['SK'], ['E10'], ['S9']],
    game: { type: 'sauspiel', suit: 'E', declarer: 1 },
    leader: 1,
    turn: 1,
    trickNo: 2,
  });
  E.actPlay(discard, 1, 'SK');
  assert.equal(E.legalCards(discard, 0).indexOf('EA'), -1);

  const last = E.installPosition({
    hands: [['EA', 'GO'], ['S9'], ['E10'], ['HK']],
    game: { type: 'sauspiel', suit: 'E', declarer: 1 },
    leader: 1,
    turn: 1,
    trickNo: 7,
  });
  E.actPlay(last, 1, 'S9');
  assert.ok(E.legalCards(last, 0).indexOf('EA') >= 0);
});

test('Davonlaufen ab vier Karten der Ruffarbe, sonst keine kleine Ruffarbe anspielen', () => {
  const blocked = E.installPosition({
    hands: [['EA', 'E9', 'E8', 'GO'], ['S7'], ['S8'], ['S9']],
    game: { type: 'sauspiel', suit: 'E', declarer: 1 },
    leader: 0,
    turn: 0,
  });
  assert.equal(E.legalCards(blocked, 0).indexOf('E9'), -1);
  assert.ok(E.legalCards(blocked, 0).indexOf('EA') >= 0);
  const run = E.installPosition({
    hands: [['EA', 'E9', 'E8', 'E7', 'GO'], ['S7'], ['S8'], ['S9']],
    game: { type: 'sauspiel', suit: 'E', declarer: 1 },
    leader: 0,
    turn: 0,
  });
  assert.ok(E.legalCards(run, 0).indexOf('E9') >= 0);
  E.actPlay(run, 0, 'E9');
  assert.equal(run.aceFree, true);
  assert.equal(run.davon, true);
  const off = E.installPosition({
    hands: [['EA', 'E9', 'E8', 'E7', 'GO'], ['S7'], ['S8'], ['S9']],
    rules: { davon: false },
    game: { type: 'sauspiel', suit: 'E', declarer: 1 },
    leader: 0,
    turn: 0,
  });
  assert.equal(E.legalCards(off, 0).indexOf('E9'), -1);
});

test('Kurzblatt: die Sau darf im sechsten Stich fallen', () => {
  const last = E.installPosition({
    rules: { deck: 'short' },
    hands: [['GA', 'EO'], ['S9'], ['E10'], ['HK']],
    game: { type: 'sauspiel', suit: 'G', declarer: 3 },
    leader: 1,
    turn: 1,
    trickNo: 5,
  });
  assert.equal(last.trickCount, 6);
  E.actPlay(last, 1, 'S9');
  assert.ok(E.legalCards(last, 0).indexOf('GA') >= 0);
});

test('Rangfolge und gleicher Rang: früher nach dem Geber', () => {
  assert.ok(E.gameRank('sie', false) > E.gameRank('solo', true));
  assert.ok(E.gameRank('solo', true) > E.gameRank('wenz', true));
  assert.ok(E.gameRank('wenz', true) > E.gameRank('farbwenz', true));
  assert.ok(E.gameRank('farbwenz', true) > E.gameRank('solo', false));
  assert.ok(E.gameRank('solo', false) > E.gameRank('wenz', false));
  assert.ok(E.gameRank('wenz', false) > E.gameRank('farbwenz', false));
  assert.ok(E.gameRank('farbwenz', false) > E.gameRank('sauspiel', false));
  assert.ok(E.gameRank('wenz', false) > E.gameRank('geier', false));
  const order = E.orderFrom(0);
  const win = E.bestChoice(order, [
    { seat: 3, type: 'solo', suit: 'H', tout: false, rank: E.gameRank('solo', false) },
    { seat: 1, type: 'solo', suit: 'E', tout: false, rank: E.gameRank('solo', false) },
  ]);
  assert.equal(win.seat, 1);
});

function freshBid(rules) {
  const match = E.newMatch({ rules: rules, dealer: 0 });
  const state = E.dealHand(match, E.seededRng(1));
  state.hands = [
    ['E9', 'GK', 'S8', 'H7', 'EU', 'G10', 'SK', 'S9'],
    ['EA', 'EO', 'GO', 'HA', 'H10', 'GU', 'E8', 'S7'],
    ['G8', 'G9', 'HK', 'H9', 'H8', 'SU', 'EK', 'G7'],
    ['SA', 'GA', 'HU', 'HO', 'SO', 'E10', 'E7', 'S10'],
  ];
  state.result = null;
  state.game = null;
  state.phase = 'bid';
  state.bidStep = 0;
  state.intents = [null, null, null, null];
  state.interested = [];
  state.choices = [];
  state.must = false;
  state.turn = state.order[0];
  return state;
}

function sayAll(state, intents) {
  state.order.forEach((seat) => {
    const res = E.actIntent(state, seat, intents[seat]);
    assert.equal(res.ok, true, res.reason);
  });
  while (state.phase === 'also') assert.equal(E.actAlso(state, state.turn, 'pass').ok, true);
}

test('Ansage: das höhere Spiel gewinnt', () => {
  const state = freshBid();
  sayAll(state, { 0: 'pass', 1: 'play', 2: 'play', 3: 'pass' });
  assert.equal(state.phase, 'choose');
  assert.equal(E.actChoose(state, 1, { type: 'sauspiel', suit: 'S', tout: false }).ok, true);
  assert.equal(E.actChoose(state, 2, { type: 'solo', suit: 'H', tout: false }).ok, true);
  assert.equal(state.game.type, 'solo');
  assert.equal(state.game.declarer, 2);
  assert.equal(state.turn, state.order[0]);
});

test('Herz-Solo ist erlaubt, die Herz-Sau aber nicht rufbar', () => {
  const state = freshBid();
  const legal = E.legalGames(state, 1);
  assert.equal(legal.some((g) => g.type === 'sauspiel' && g.suit === 'H'), false);
  assert.equal(legal.some((g) => g.type === 'solo' && g.suit === 'H'), true);
  assert.equal(legal.some((g) => g.type === 'sauspiel' && g.suit === 'E'), false);
});

test('Alle weiter: zusammenwerfen, Stock oder der Geber muss', () => {
  const thrown = freshBid({ allPass: 'throw' });
  sayAll(thrown, { 0: 'pass', 1: 'pass', 2: 'pass', 3: 'pass' });
  assert.equal(thrown.result.kind, 'throw');
  assert.deepEqual(thrown.result.deltas, [0, 0, 0, 0]);

  const stock = freshBid({ allPass: 'stock', ruf: 2 });
  sayAll(stock, { 0: 'pass', 1: 'pass', 2: 'pass', 3: 'pass' });
  assert.equal(stock.result.kind, 'stock');
  assert.deepEqual(stock.result.deltas, [-2, -2, -2, -2]);
  const match = E.newMatch({ rules: { allPass: 'stock', ruf: 2 }, dealer: 0 });
  E.applyToMatch(match, stock);
  assert.equal(match.pot, 8);
  assert.deepEqual(match.scores, [-2, -2, -2, -2]);

  const must = freshBid({ allPass: 'must' });
  sayAll(must, { 0: 'pass', 1: 'pass', 2: 'pass', 3: 'pass' });
  assert.equal(must.phase, 'choose');
  assert.equal(must.turn, 0);
  assert.equal(E.actChoose(must, 0, null).ok, false);
  assert.equal(E.actChoose(must, 0, { type: 'solo', suit: 'G', tout: false }).ok, true);
  assert.equal(must.game.type, 'solo');
  assert.equal(must.game.declarer, 0);
});

function score(game, tricks, extra) {
  extra = extra || {};
  const state = E.installPosition({
    hands: [[], [], [], []],
    opening: extra.opening || [[], ['EA'], [], []],
    tricks: tricks,
    game: game,
    phase: 'play',
    trickNo: extra.toutLost ? 1 : 8,
    stoss: extra.stoss,
    retour: extra.retour,
    supra: extra.supra,
    legen: extra.legen,
    bock: extra.bock,
    rules: extra.rules,
  });
  return E.finishPlayed(state, { toutLost: !!extra.toutLost });
}

test('61 Augen gewinnen, 60 verlieren, Zahlung ist nullsummig', () => {
  const deck = DECK();
  const high = ['SA', 'S10', 'SK', 'GA', 'G10', 'GK', 'HA', 'H10'];
  assert.equal(E.sumEyes(high), 11 + 10 + 4 + 11 + 10 + 4 + 11 + 10);
  assert.ok(E.sumEyes(high) >= 61);
  const win = score(
    { type: 'sauspiel', suit: 'E', declarer: 0 },
    [high, [], deck.filter((c) => high.indexOf(c) < 0), []]
  );
  assert.equal(win.declarerWon, true);
  assert.equal(win.deltas.reduce((s, n) => s + n, 0), 0);
  assert.equal(win.deltas[0], win.wert);
  assert.equal(win.deltas[2], -win.wert);

  const low = ['S7', 'S8', 'S9', 'G7', 'G8', 'G9', 'E7', 'E8'];
  assert.equal(E.sumEyes(low), 0);
  const lose = score(
    { type: 'sauspiel', suit: 'E', declarer: 0 },
    [low, [], deck.filter((c) => low.indexOf(c) < 0), []]
  );
  assert.equal(lose.declarerWon, false);
  assert.equal(lose.deltas[0], -lose.wert);
  assert.equal(lose.deltas[2], lose.wert);
});

test('Schneider 30 oder weniger, Gegner erst ab 29, Schwarz braucht alle Stiche', () => {
  const deck = DECK();
  const thirty = ['SA', 'S10', 'SK', 'SO', 'SU'];
  assert.equal(E.sumEyes(thirty), 30);
  const at30 = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [thirty, [], deck.filter((c) => thirty.indexOf(c) < 0), []]);
  assert.equal(at30.declarerWon, false);
  assert.equal(at30.schneider, 1);

  const thirtyone = ['SA', 'S10', 'SK', 'GK', 'EU'];
  assert.equal(E.sumEyes(thirtyone), 31);
  const at31 = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [thirtyone, [], deck.filter((c) => thirtyone.indexOf(c) < 0), []]);
  assert.equal(at31.declarerWon, false);
  assert.equal(at31.schneider, 0);

  const opp30 = thirty.slice();
  const at90 = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [deck.filter((c) => opp30.indexOf(c) < 0), [], opp30, []]);
  assert.equal(at90.playEyes, 90);
  assert.equal(at90.declarerWon, true);
  assert.equal(at90.schneider, 0);

  const opp29 = ['SA', 'S10', 'SK', 'EU', 'GU'];
  assert.equal(E.sumEyes(opp29), 29);
  const at91 = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [deck.filter((c) => opp29.indexOf(c) < 0), [], opp29, []]);
  assert.equal(at91.playEyes, 91);
  assert.equal(at91.schneider, 1);
  assert.equal(at91.schwarz, 0);

  const all = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [deck, [], [], []]);
  assert.equal(all.schwarz, 1);
  assert.equal(all.schneider, 1);
  const zeroTrick = ['S7', 'S8', 'S9', 'G7'];
  const withEmpty = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [deck.filter((c) => zeroTrick.indexOf(c) < 0), [], zeroTrick, []]);
  assert.equal(withEmpty.schwarz, 0);
});

test('Laufende ab drei Obern, im Wenz ab zwei, höchstens vier, auch bei den Gegnern', () => {
  const three = E.countLaufende([['EO', 'GO', 'HO', 'EU'], ['SO'], [], []], { type: 'sauspiel', declarer: 0, partner: 2 });
  assert.equal(three.count, 3);
  assert.equal(three.party, 'play');
  assert.equal(E.paidLaufende(three, RUF, E.normalizeRules({})), 3);
  const two = E.countLaufende([['EO', 'GO'], ['HO'], [], []], { type: 'sauspiel', declarer: 0, partner: 2 });
  assert.equal(E.paidLaufende(two, RUF, E.normalizeRules({})), 0);
  const wenz = E.countLaufende([['EU', 'GU'], ['HU'], [], []], { type: 'wenz', declarer: 0 });
  assert.equal(E.paidLaufende(wenz, { type: 'wenz' }, E.normalizeRules({ wenzLaufende: 2 })), 2);
  assert.equal(E.paidLaufende(wenz, { type: 'wenz' }, E.normalizeRules({ wenzLaufende: 3 })), 0);
  const many = E.countLaufende([['EO', 'GO', 'HO', 'SO', 'EU'], [], [], []], RUF);
  assert.equal(E.paidLaufende(many, RUF, E.normalizeRules({ laufendeMax: 4 })), 4);
  assert.equal(E.paidLaufende(many, RUF, E.normalizeRules({ laufendeMax: 0 })), 5);

  const priced = score(
    { type: 'solo', suit: 'H', declarer: 0 },
    [[], [], [], DECK()],
    { opening: [[], ['EO', 'GO', 'HO'], [], []] }
  );
  assert.equal(priced.declarerWon, false);
  assert.equal(priced.laufendeParty, 'opp');
  assert.equal(priced.laufende, 3);
  assert.equal(priced.schneider, 1);
  assert.equal(priced.schwarz, 1);
  assert.equal(priced.wert, 5 + 1 + 1 + 3);
  assert.equal(priced.deltas[0], -priced.wert * 3);
});

test('Tout zählt doppelt ohne Schneider und Schwarz, Sie ist der vierfache Solo-Preis mit acht Laufenden', () => {
  const tout = score(
    { type: 'solo', suit: 'H', tout: true, declarer: 0 },
    [DECK(), [], [], []],
    { opening: [['EO', 'GO', 'HO'], [], [], []] }
  );
  assert.equal(tout.declarerWon, true);
  assert.equal(tout.schneider, 0);
  assert.equal(tout.schwarz, 0);
  assert.equal(tout.wert, (5 + 3) * 2);

  const lost = score(
    { type: 'wenz', tout: true, declarer: 1 },
    [['EU'], [], [], []],
    { toutLost: true, opening: [[], ['EU', 'GU'], [], []] }
  );
  assert.equal(lost.declarerWon, false);
  assert.equal(lost.wert, (5 + 2) * 2);
  assert.equal(lost.deltas[1], -lost.wert * 3);

  const state = E.installPosition({
    hands: [
      ['EO', 'GO', 'HO', 'SO', 'EU', 'GU', 'HU', 'SU'],
      ['EA', 'E10', 'EK', 'E9', 'E8', 'E7', 'GA', 'G10'],
      ['GK', 'G9', 'G8', 'G7', 'HA', 'H10', 'HK', 'H9'],
      ['H8', 'H7', 'SA', 'S10', 'SK', 'S9', 'S8', 'S7'],
    ],
    rules: { sie: true, solo: 5, einheit: 1 },
  });
  state.legen = 1;
  state.bock = true;
  const res = E.checkSie(state);
  assert.equal(res.ok, true);
  assert.equal(state.result.kind, 'sie');
  assert.equal(state.result.wert, (5 + 8) * 4 * 2 * 2);
  assert.equal(state.result.deltas[0], state.result.wert * 3);
  assert.equal(state.result.deltas.reduce((s, n) => s + n, 0), 0);
  assert.equal(state.phase, 'done');
});

test('Stoß verdoppelt, Retour vervierfacht, Klopfen und Bock je mal zwei', () => {
  const plain = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [DECK(), [], [], []], { rules: { ruf: 1, einheit: 1 } });
  const grund = plain.wert;
  const stoss = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [DECK(), [], [], []], { stoss: true });
  assert.equal(stoss.wert, grund * 2);
  const retour = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [DECK(), [], [], []], { stoss: true, retour: true });
  assert.equal(retour.wert, grund * 4);
  const supra = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [DECK(), [], [], []], { stoss: true, retour: true, supra: true, rules: { supra: true } });
  assert.equal(supra.multiplier, 8);
  assert.equal(supra.wert, grund * 8);
  const knock = score({ type: 'sauspiel', suit: 'E', declarer: 0 }, [DECK(), [], [], []], { legen: 2, bock: true });
  assert.equal(knock.wert, grund * 4 * 2);
});

test('Kontra nur bis zur zweiten Karte, der Partner gibt keinen Stoß', () => {
  const state = E.installPosition({
    hands: [
      ['EA', 'E9', 'GK', 'S7'],
      ['EO', 'HA', 'G10', 'SK'],
      ['E10', 'EU', 'H10', 'S9'],
      ['EK', 'GO', 'HK', 'S8'],
    ],
    game: { type: 'sauspiel', suit: 'E', declarer: 1 },
    leader: 2,
    turn: 2,
  });
  assert.equal(state.game.partner, 0);
  assert.equal(E.canStoss(state, 0), false);
  assert.equal(E.canStoss(state, 2), true);
  assert.equal(E.canRetour(state, 1), false);
  E.actStoss(state, 3);
  assert.equal(E.canRetour(state, 0), true);
  assert.equal(E.canRetour(state, 1), true);
  E.actPlay(state, 2, 'S9');
  assert.equal(E.windowOpen(state), true);
  E.actPlay(state, 3, 'S8');
  assert.equal(state.kontraClosed, true);
  assert.equal(E.canRetour(state, 1), false);
});

test('Ramsch: meiste Augen zahlen, Jungfrau verdoppelt, Durchmarsch gewinnt', () => {
  const deck = DECK();
  const rich = ['SA', 'S10', 'GA', 'G10', 'EA', 'E10'];
  assert.ok(E.sumEyes(rich) > 60);
  const rest = deck.filter((c) => rich.indexOf(c) < 0);
  const ramsch = score({ type: 'ramsch', declarer: null }, [rich, rest.slice(0, 10), rest.slice(10, 20), rest.slice(20)]);
  assert.equal(ramsch.kind, 'ramsch');
  assert.equal(ramsch.loserSeat, 0);
  assert.equal(ramsch.deltas[0], -ramsch.wert * 3);
  assert.equal(ramsch.deltas.reduce((s, n) => s + n, 0), 0);

  const maiden = score({ type: 'ramsch', declarer: null }, [rich, rest.slice(0, 13), rest.slice(13), []]);
  assert.equal(maiden.wert, ramsch.wert * 2);

  const march = score({ type: 'ramsch', declarer: null }, [[], deck, [], []]);
  assert.equal(march.declarerWon, true);
  assert.equal(march.winnerSeat, 1);
  assert.equal(march.deltas[1], march.wert * 3);
  assert.ok(march.wert >= 2);
});

test('Zielpunktzahl und Stock geht an die Gewinner', () => {
  assert.equal(E.normalizeTarget('20'), 20);
  assert.equal(E.normalizeTarget('custom', 80), 80);
  assert.equal(E.normalizeTarget('custom', 2), 5);
  const scores = [4, 20, 20, 3];
  assert.equal(E.matchWinner(scores, 20), null);
  scores[1] = 21;
  assert.equal(E.matchWinner(scores, 20), 1);

  const match = E.newMatch({ rules: { ruf: 1 }, dealer: 0 });
  match.pot = 4;
  const won = E.installPosition({
    dealer: 0,
    tricks: [DECK(), [], [], []],
    opening: [[], ['EA'], [], []],
    game: { type: 'sauspiel', suit: 'E', declarer: 0 },
  });
  E.finishPlayed(won, {});
  E.applyToMatch(match, won);
  assert.equal(match.pot, 0);
  assert.equal(match.scores[0], won.result.wert + 2);
  assert.equal(match.scores[1], won.result.wert + 2);
  assert.equal(match.dealer, 1);
});

test('Klopfen gibt die zweiten vier Karten danach', () => {
  const match = E.newMatch({ rules: { legen: true }, dealer: 3 });
  const state = E.dealHand(match, E.seededRng(9));
  assert.equal(state.phase, 'legen');
  assert.deepEqual(state.hands.map((h) => h.length), [4, 4, 4, 4]);
  state.order.forEach((seat, i) => {
    const res = E.actLegen(state, seat, i === 0);
    assert.equal(res.ok, true, res.reason);
  });
  assert.equal(state.legen, 1);
  assert.deepEqual(state.hands.map((h) => h.length), [8, 8, 8, 8]);
  assert.notEqual(state.phase, 'legen');
});
