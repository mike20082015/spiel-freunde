/* Regeltests Elfer raus. Aufruf: node --test tests/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../public/elfer-raus/js/engine.js');

function rules(extra) {
  return E.normalizeRules(Object.assign({ opponents: 3 }, extra || {}));
}
function open11() {
  const rows = E.emptyRows();
  rows.R = { open: true, low: 11, high: 11 };
  rows.Y = { open: true, low: 11, high: 11 };
  rows.G = { open: true, low: 11, high: 11 };
  rows.B = { open: true, low: 11, high: 11 };
  return rows;
}

test('Voreinstellung ist das Familien-Elfer-raus ohne Einsatz', () => {
  const r = E.normalizeRules({});
  assert.equal(r.opponents, 3);
  assert.equal(r.handSize, 6);
  assert.equal(r.playLimit, 3);
  assert.equal(r.drawLimit, 3);
  assert.equal(r.mode, 'wins');
  assert.equal(r.penalty, 'sum');
  assert.equal(r.mustPlay, true);
  assert.equal(r.playDrawn, true);
  assert.equal(E.deckCards().length, 80);
  assert.equal(E.normalizeTarget('wins', '5'), 5);
  assert.equal(E.normalizeTarget('penalty', '100'), 100);
  assert.equal(JSON.stringify(r).includes('€'), false);
});

test('Geben teilt gleich viele Karten und behält alle 80 beisammen', () => {
  const match = E.blankMatch(rules(), 3);
  const st = E.dealHand(match, E.seededRng(6));
  assert.equal(st.players, 4);
  assert.equal(st.hands[0].length, 6);
  assert.equal(st.hands[3].length, 6);
  assert.equal(st.talon.length, 80 - 24);
  const all = st.hands.flat().concat(st.talon);
  assert.equal(new Set(all).size, 80);
  assert.equal(st.rows.R.open, false);
});

test('gebaut wird von der 11 nach oben und unten, Lücken sind verboten', () => {
  const st = E.setup({
    rules: rules({ opponents: 1 }),
    hands: [['R11', 'R12', 'R10', 'R13'], ['Y11']],
    rows: E.emptyRows(),
    talon: ['G1'],
    turn: 0,
  });
  assert.equal(E.apply(st, 0, { type: 'play', card: 'R12' }).ok, false);
  assert.equal(E.apply(st, 0, { type: 'play', card: 'R11' }).ok, true);
  assert.equal(st.rows.R.low, 11);
  assert.equal(E.apply(st, 0, { type: 'play', card: 'R13' }).ok, false);
  assert.equal(E.apply(st, 0, { type: 'play', card: 'R12' }).ok, true);
  assert.equal(E.apply(st, 0, { type: 'play', card: 'R10' }).ok, true);
  assert.equal(st.rows.R.low, 10);
  assert.equal(st.rows.R.high, 12);
  assert.equal(E.apply(st, 0, { type: 'play', card: 'R13' }).ok, false);
});

test('wer legen kann, muss mindestens eine Karte legen, höchstens drei', () => {
  const st = E.setup({
    rules: rules({ opponents: 1 }),
    hands: [['R11', 'R12', 'R13', 'R14', 'Y1'], ['G11']],
    rows: E.emptyRows(),
    talon: ['B2', 'B3'],
    turn: 0,
  });
  assert.equal(E.legalMoves(st, 0).some((m) => m.type === 'end'), false);
  E.apply(st, 0, { type: 'play', card: 'R11' });
  E.apply(st, 0, { type: 'play', card: 'R12' });
  E.apply(st, 0, { type: 'play', card: 'R13' });
  assert.equal(E.apply(st, 0, { type: 'play', card: 'R14' }).ok, false);
  assert.equal(E.apply(st, 0, { type: 'end' }).ok, true);
  assert.equal(st.turn, 1);
});

test('die leere Hand gewinnt sofort, ohne nachzuziehen', () => {
  const st = E.setup({
    rules: rules({ opponents: 1 }),
    hands: [['B11'], ['R1', 'R2']],
    rows: E.emptyRows(),
    talon: ['Y5', 'Y6', 'G7'],
    turn: 0,
  });
  assert.equal(E.apply(st, 0, { type: 'play', card: 'B11' }).ok, true);
  assert.equal(st.phase, 'done');
  assert.equal(st.winner, 0);
  assert.equal(st.reason, 'out');
  assert.equal(st.talon.length, 3);
  const match = E.blankMatch(rules({ opponents: 1 }), 3);
  E.scoreHand(match, st);
  assert.deepEqual(match.wins, [1, 0]);
  assert.equal(match.winner, null);
});

test('nachgezogen wird höchstens dreimal und höchstens bis zur Handgröße', () => {
  const st = E.setup({
    rules: rules({ opponents: 1, handSize: 6 }),
    hands: [['R1', 'R2', 'Y3', 'Y4'], ['G1']],
    rows: open11(),
    talon: ['B8', 'B9', 'G4', 'G5', 'Y8'],
    turn: 0,
  });
  assert.equal(E.canPlayCard(st.rows, 'R1'), false);
  assert.equal(E.apply(st, 0, { type: 'end' }).ok, true);
  assert.equal(st.hands[0].length, 6);
  assert.equal(st.talon.length, 3);
  assert.equal(st.turn, 1);
  const stuck = E.setup({
    rules: rules({ opponents: 1, handSize: 5 }),
    hands: [['R1', 'R2', 'R3', 'R4', 'R5'], ['Y1']],
    rows: open11(),
    talon: ['B8', 'B9', 'G4', 'G6'],
    turn: 0,
  });
  assert.equal(E.apply(stuck, 0, { type: 'end' }).ok, true);
  assert.equal(stuck.hands[0].length, 8);
  assert.equal(stuck.turn, 1);
});

test('eine gezogene passende Karte darf noch gelegt werden', () => {
  const st = E.setup({
    rules: rules({ opponents: 1, handSize: 6 }),
    hands: [['R1', 'Y2', 'G3', 'B4', 'B5'], ['Y1']],
    rows: open11(),
    talon: ['R10', 'G8'],
    turn: 0,
  });
  assert.equal(E.apply(st, 0, { type: 'end' }).ok, true);
  assert.equal(st.turn, 0);
  assert.equal(st.hands[0].indexOf('R10') >= 0, true);
  assert.equal(E.apply(st, 0, { type: 'play', card: 'R10' }).ok, true);
  assert.equal(E.apply(st, 0, { type: 'end' }).ok, true);
  assert.equal(st.turn, 1);
});

test('Strafpunkte sind die Summe der Restkarten, das Ziel gewinnt die niedrigste Summe', () => {
  const st = E.setup({
    rules: rules({ opponents: 1, mode: 'penalty' }),
    hands: [['R11'], ['Y20', 'G10']],
    rows: E.emptyRows(),
    talon: [],
    turn: 0,
  });
  E.apply(st, 0, { type: 'play', card: 'R11' });
  assert.deepEqual(st.penalties, [0, 30]);
  const match = E.blankMatch(rules({ opponents: 1, mode: 'penalty' }), 20);
  E.scoreHand(match, st);
  assert.deepEqual(match.scores, [0, 30]);
  assert.equal(match.winner, 0);
  const counted = E.penaltyOf(['Y20', 'G10'], rules({ penalty: 'count' }));
  assert.equal(counted, 2);
});

test('ohne Talon und ohne Zug endet die Runde', () => {
  const st = E.setup({
    rules: rules({ opponents: 1 }),
    hands: [['R1'], ['Y2', 'G3']],
    rows: open11(),
    talon: [],
    turn: 0,
  });
  assert.equal(E.apply(st, 0, { type: 'end' }).ok, true);
  assert.equal(st.phase, 'play');
  assert.equal(E.apply(st, 1, { type: 'end' }).ok, true);
  assert.equal(st.phase, 'done');
  assert.equal(st.reason, 'stall');
  assert.equal(st.winner, 0);
});
