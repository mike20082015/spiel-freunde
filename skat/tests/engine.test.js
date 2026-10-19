/* Regeltests. Aufruf: node --test tests/   (oder: node tests/run-all.js) */
const test = require('node:test');
const assert = require('assert');
const E = require('../../public/skat/js/engine.js');
const AI = require('../../public/skat/js/ai.js');
const { simulate } = require('./simulate.js');

const suitGame = (t, extra) => Object.assign({ type: 'suit', trump: t }, extra || {});

test('Deck: 32 Karten, 120 Augen', () => {
  const d = E.createDeck();
  assert.strictEqual(d.length, 32);
  assert.strictEqual(new Set(d).size, 32);
  assert.strictEqual(E.sumPoints(d), 120);
});

test('Geben 3-Skat-4-3: jeder 10 Karten, Skat 2, Reihenfolge ab Vorhand', () => {
  const deck = E.createDeck(); // feste Reihenfolge
  const dealer = 0; // Vorhand = 1, Mittelhand = 2, Hinterhand = 0
  const { hands, skat } = E.deal(deck, dealer);
  assert.deepStrictEqual(hands.map((h) => h.length), [10, 10, 10]);
  assert.strictEqual(skat.length, 2);
  assert.deepStrictEqual(hands[1].slice(0, 3), deck.slice(0, 3)); // Vorhand bekommt die ersten 3
  assert.deepStrictEqual(hands[2].slice(0, 3), deck.slice(3, 6));
  assert.deepStrictEqual(hands[0].slice(0, 3), deck.slice(6, 9));
  assert.deepStrictEqual(skat, deck.slice(9, 11)); // dann 2 in den Skat
  assert.deepStrictEqual(hands[1].slice(3, 7), deck.slice(11, 15)); // dann 4
  assert.deepStrictEqual(hands[1].slice(7), deck.slice(23, 26)); // dann 3
  const all = hands.flat().concat(skat);
  assert.strictEqual(new Set(all).size, 32);
});

test('Positionen rotieren mit dem Geber', () => {
  const m = new E.Match({ dealer: 2 });
  const vh = [];
  for (let i = 0; i < 3; i++) vh.push(m.start(E.seededRng(i)).pos.vorhand);
  assert.deepStrictEqual(vh, [1, 2, 0]);
});

test('Trumpfreihenfolge Farbspiel und Grand', () => {
  assert.deepStrictEqual(E.trumpOrder(suitGame('H')), ['CJ', 'SJ', 'HJ', 'DJ', 'HA', 'H10', 'HK', 'HQ', 'H9', 'H8', 'H7']);
  assert.deepStrictEqual(E.trumpOrder({ type: 'grand' }), ['CJ', 'SJ', 'HJ', 'DJ']);
  assert.deepStrictEqual(E.trumpOrder({ type: 'null' }), []);
  const g = suitGame('H');
  const order = E.trumpOrder(g);
  for (let i = 0; i < order.length - 1; i++) assert(E.beats(order[i], order[i + 1], 'T', g), order[i] + ' > ' + order[i + 1]);
  assert(E.beats('D7', 'CA', 'C', suitGame('D')), 'kleinster Trumpf sticht Fehl-Ass');
  assert(E.beats('DJ', 'DA', 'T', suitGame('D')), 'Karo-Bube sticht Karo-Ass');
  assert(E.beats('C10', 'CK', 'C', { type: 'grand' }), 'Zehn über König');
  assert(E.beats('CK', 'C10', 'C', { type: 'null' }), 'Null: König über Zehn');
  assert(E.beats('CJ', 'C10', 'C', { type: 'null' }), 'Null: Bube ist normale Karte über Zehn');
  assert(!E.beats('CJ', 'CQ', 'C', { type: 'null' }));
});

test('Bedienpflicht: Bube ist Trumpf und keine Farbe', () => {
  const g = suitGame('S');
  const hand = ['CJ', 'C7', 'S8', 'H10'];
  assert.deepStrictEqual(E.legalCards(hand, ['CA'], g), ['C7']); // Kreuz bedienen, Bube zählt nicht als Kreuz
  assert.deepStrictEqual(E.legalCards(hand, ['DJ'], g).sort(), ['CJ', 'S8'].sort()); // Trumpf bedienen
  assert.deepStrictEqual(E.legalCards(hand, ['DA'], g), hand); // frei: alles erlaubt
  assert.deepStrictEqual(E.legalCards(hand, [], g), hand);
  // Null: Bube gehört zu seiner Farbe
  assert.deepStrictEqual(E.legalCards(hand, ['C9'], { type: 'null' }).sort(), ['C7', 'CJ'].sort());
  // Grand: nur Buben sind Trumpf
  assert.deepStrictEqual(E.legalCards(['CJ', 'S8', 'SA'], ['S7'], { type: 'grand' }).sort(), ['S8', 'SA'].sort());
});

test('Stichgewinner', () => {
  assert.strictEqual(E.trickWinnerIndex(['HA', 'H10', 'HK'], suitGame('C')), 0);
  assert.strictEqual(E.trickWinnerIndex(['HA', 'C7', 'HK'], suitGame('C')), 1);
  assert.strictEqual(E.trickWinnerIndex(['HA', 'C7', 'DJ'], suitGame('C')), 2);
  assert.strictEqual(E.trickWinnerIndex(['H7', 'SA', 'DA'], suitGame('C')), 0); // abwerfen sticht nicht
  assert.strictEqual(E.trickWinnerIndex(['HA', 'CJ', 'SJ'], { type: 'grand' }), 1);
  assert.strictEqual(E.trickWinnerIndex(['H7', 'H8', 'HA'], { type: 'null' }), 2);
  assert.strictEqual(E.trickWinnerIndex(['H10', 'HJ', 'H9'], { type: 'null' }), 1);
});

test('Reizwerte beginnen korrekt', () => {
  assert.deepStrictEqual(E.BID_VALUES.slice(0, 12), [18, 20, 22, 23, 24, 27, 30, 33, 35, 36, 40, 44]);
  assert.strictEqual(E.nextBid(18), 20);
  assert.strictEqual(E.nextBid(24), 27);
  assert.strictEqual(E.BID_VALUES[E.BID_VALUES.length - 1], 264);
});

test('Spielwerte', () => {
  assert.strictEqual(E.calcGameValue({ game: suitGame('C'), matadors: 2 }), 36); // Kreuz mit 2, Spiel 3
  assert.strictEqual(E.calcGameValue({ game: { type: 'grand', hand: true }, matadors: 1, mit: false }), 72); // Grand ohne 1, Spiel 2, Hand 3
  assert.strictEqual(E.calcGameValue({ game: suitGame('D'), matadors: 1 }), 18);
  assert.strictEqual(E.calcGameValue({ game: suitGame('H'), matadors: 1, schneider: true }), 30);
  assert.strictEqual(E.calcGameValue({ game: suitGame('S', { hand: true, schneiderAnnounced: true }), matadors: 1 }), 55); // 1+1+H+S+SA = 5 * 11
  assert.strictEqual(E.calcGameValue({ game: suitGame('C', { hand: true, schwarzAnnounced: true }), matadors: 1 }), 12 * 7);
  assert.strictEqual(E.calcGameValue({ game: { type: 'null' } }), 23);
  assert.strictEqual(E.calcGameValue({ game: { type: 'null', hand: true } }), 35);
  assert.strictEqual(E.calcGameValue({ game: { type: 'null', ouvert: true } }), 46);
  assert.strictEqual(E.calcGameValue({ game: { type: 'null', ouvert: true, hand: true } }), 59);
});

test('Spitzen mit/ohne', () => {
  assert.deepStrictEqual(E.matadors(['CJ', 'SJ', 'DJ', 'CA'], suitGame('C')), { count: 2, mit: true });
  assert.deepStrictEqual(E.matadors(['HJ', 'DJ'], suitGame('C')), { count: 2, mit: false });
  assert.deepStrictEqual(E.matadors(['SJ'], { type: 'grand' }), { count: 1, mit: false });
  assert.deepStrictEqual(E.matadors(['CJ', 'SJ', 'HJ', 'DJ', 'HA', 'H10', 'H7'], suitGame('H')), { count: 6, mit: true });
  assert.deepStrictEqual(E.matadors(['H7'], suitGame('H')), { count: 10, mit: false });
});

// Hilfsfunktion: spielt einen vorgegebenen Spielverlauf durch
function scripted(hands, skat, opts) {
  const deck = [];
  // deal() verteilt ab Vorhand: wir bauen das Deck rückwärts aus gewünschten Händen
  const dealer = 2; // Vorhand 0, Mittelhand 1, Hinterhand 2
  const order = [0, 1, 2];
  const take = (p, n, from) => hands[p].slice(from, from + n);
  for (const p of order) deck.push(...take(p, 3, 0));
  deck.push(...skat);
  for (const p of order) deck.push(...take(p, 4, 3));
  for (const p of order) deck.push(...take(p, 3, 7));
  return E.newGame({ dealer, deck, rules: opts && opts.rules });
}

test('Reizen: Ablauf mit Sagen, Hören und Passen', () => {
  const st = E.newGame({ dealer: 2, rng: E.seededRng(1) }); // VH 0, MH 1, HH 2
  let t = E.biddingTurn(st);
  assert.deepStrictEqual([t.player, t.role, t.value], [1, 'say', 18]);
  E.bidAction(st, true); // MH sagt 18
  t = E.biddingTurn(st);
  assert.deepStrictEqual([t.player, t.role, t.value], [0, 'hear', 18]);
  E.bidAction(st, true); // VH hält
  t = E.biddingTurn(st);
  assert.deepStrictEqual([t.player, t.role, t.value], [1, 'say', 20]);
  E.bidAction(st, false); // MH passt
  t = E.biddingTurn(st);
  assert.deepStrictEqual([t.player, t.role, t.value], [2, 'say', 20]); // HH sagt VH weiter
  E.bidAction(st, true);
  E.bidAction(st, false); // VH passt bei 20
  assert.strictEqual(st.phase, 'skat');
  assert.strictEqual(st.declarer, 2);
  assert.strictEqual(st.bid, 20);
});

test('Reizen: alle passen -> eingepasst (offiziell) bzw. Ramsch (Kneipe)', () => {
  const st = E.newGame({ dealer: 2, rng: E.seededRng(2) });
  E.bidAction(st, false); // MH
  E.bidAction(st, false); // HH
  assert.strictEqual(E.biddingTurn(st).role, 'open');
  E.bidAction(st, false); // VH
  assert.strictEqual(st.phase, 'done');
  assert(st.result.passedIn);
  const k = E.newGame({ dealer: 2, rng: E.seededRng(2), rules: { mode: 'kneipe' } });
  E.bidAction(k, false); E.bidAction(k, false); E.bidAction(k, false);
  assert.strictEqual(k.phase, 'play');
  assert.strictEqual(k.game.type, 'ramsch');
});

test('Komplettes Spiel, Überreizt und Abrechnung', () => {
  // Spieler 0 hat Kreuz mit 1 (nur Kreuz-Bube, kein Pik-Bube)
  const hands = [
    ['CJ', 'HJ', 'CA', 'C10', 'CK', 'CQ', 'C9', 'SA', 'HA', 'DA'],
    ['SJ', 'C8', 'S10', 'SK', 'SQ', 'S9', 'H10', 'HK', 'HQ', 'H9'],
    ['DJ', 'C7', 'S8', 'S7', 'H8', 'H7', 'D10', 'DK', 'DQ', 'D9'],
  ];
  const skat = ['D8', 'D7'];
  const run = (bid) => {
    const st = scripted(hands, skat);
    // Reizen bis bid: MH (1) sagt, VH (0) hält; dann passen
    let guard = 0;
    while (st.phase === 'bidding' && guard++ < 100) {
      const t = E.biddingTurn(st);
      if (t.player === 1) E.bidAction(st, t.role === 'say' && t.value <= bid);
      else if (t.player === 2) E.bidAction(st, false);
      else E.bidAction(st, true);
    }
    assert.strictEqual(st.declarer, 0);
    E.takeSkat(st);
    E.discard(st, ['D8', 'D7']);
    E.declare(st, { type: 'suit', trump: 'C' });
    // jeder spielt die KI-Karte, das Ergebnis ist deterministisch
    while (st.phase === 'play') {
      const p = st.turn;
      E.playCard(st, p, AI.chooseCard(E.viewFor(st, p), 'neutral').card);
    }
    return st.result;
  };
  const ok = run(24);
  assert.strictEqual(ok.bid, 24);
  assert.strictEqual(ok.matadors.count, 1);
  assert.strictEqual(ok.declarerPoints + ok.defenderPoints, 120);
  assert(ok.won, 'Kreuz mit 1 bei 24 gewonnen');
  assert(!ok.overbid);
  assert.strictEqual(ok.value % 12, 0);
  assert.strictEqual(ok.scoreChange, ok.value);

  const over = run(48); // Kreuz mit 1: 24 (bzw. 36 mit Schneider, 48 mit Schwarz)
  assert(!over.schwarz, "Testaufbau: darf nicht schwarz sein");
  {
    assert(over.overbid, 'muss überreizt sein');
    assert(!over.won);
    assert.strictEqual(over.value, 48); // nächstes Vielfaches von 12 >= 48
    assert.strictEqual(over.scoreChange, -96);
  }
});

test('Überreizt: Wert wird auf das nächste Vielfache des Grundwerts angehoben', () => {
  const st = E.newGame({ dealer: 2, deck: E.createDeck() });
  // künstliches Endergebnis prüfen
  st.declarer = 0; st.bid = 30; st.game = { type: 'suit', trump: 'D' };
  st.startHands[0] = ['CJ', 'D7', 'D8', 'D9', 'H7', 'H8', 'H9', 'S7', 'S8', 'S9'];
  st.originalSkat = ['C7', 'C8'];
  st.skat = ['C7', 'C8'];
  // Alleinspieler macht alle Stiche mit gesamt 61+ Augen -> trotzdem Wert 2*9=18 (+ Schneider/Schwarz)
  st.tricks = [];
  const rest = E.createDeck().filter((c) => !['C7', 'C8'].includes(c));
  for (let i = 0; i < 10; i++) st.tricks.push({ cards: rest.slice(i * 3, i * 3 + 3).map((c, k) => ({ player: k, card: c })), winner: i < 6 ? 0 : 1 });
  const r = E.computeResult(st);
  const expectedRaw = 9 * (2 + (r.schneider ? 1 : 0) + (r.schwarz ? 1 : 0));
  assert.strictEqual(r.declarerPoints, 70); assert.strictEqual(expectedRaw, 18);
  {
    assert(r.overbid);
    assert(!r.won);
    assert.strictEqual(r.value, 36); // 4 * 9
    assert.strictEqual(r.scoreChange, -72);
  }
});

test('Null: verloren beim ersten eigenen Stich (Spiel endet sofort), Wert 23', () => {
  const hands = [
    ['HA', 'C7', 'C8', 'C9', 'S7', 'S8', 'S9', 'D7', 'D8', 'D9'],
    ['H7', 'H8', 'C10', 'CJ', 'CQ', 'S10', 'SJ', 'SQ', 'D10', 'DJ'],
    ['H9', 'H10', 'CK', 'CA', 'SK', 'SA', 'DQ', 'DK', 'DA', 'HJ'],
  ];
  const st = scripted(hands, ['HQ', 'HK']);
  E.bidAction(st, false); E.bidAction(st, false); E.bidAction(st, true); // VH spielt
  E.playHand(st);
  E.declare(st, { type: 'null' });
  assert.strictEqual(st.game.hand, true);
  E.playCard(st, 0, 'HA'); E.playCard(st, 1, 'H7'); E.playCard(st, 2, 'H9');
  assert.strictEqual(st.phase, 'done');
  assert.strictEqual(st.tricks.length, 1);
  assert.strictEqual(st.result.won, false);
  assert.strictEqual(st.result.value, 35); // Null Hand
  assert.strictEqual(st.result.scoreChange, -70);
});

test('Null gewonnen: Alleinspieler bekommt keinen Stich, Wert 23', () => {
  const hands = [
    ['C7', 'C8', 'C9', 'S7', 'S8', 'S9', 'H7', 'H8', 'D7', 'D8'],
    ['C10', 'CJ', 'CQ', 'S10', 'SJ', 'SQ', 'H9', 'H10', 'D9', 'D10'],
    ['CK', 'CA', 'SK', 'SA', 'HJ', 'HQ', 'HK', 'DJ', 'DQ', 'DK'],
  ];
  const st = scripted(hands, ['HA', 'DA']);
  E.bidAction(st, false); E.bidAction(st, false); E.bidAction(st, true);
  E.takeSkat(st);
  E.discard(st, ['HA', 'DA']);
  E.declare(st, { type: 'null' });
  while (st.phase === 'play') E.playCard(st, st.turn, AI.chooseCard(E.viewFor(st, st.turn), 'neutral').card);
  assert.strictEqual(st.result.won, true);
  assert.strictEqual(st.result.value, 23);
  assert.strictEqual(st.result.scoreChange, 23);
});

test('Null Hand / Ouvert Werte über declare()', () => {
  const st = E.newGame({ dealer: 2, rng: E.seededRng(5) });
  E.bidAction(st, false); E.bidAction(st, false); E.bidAction(st, true);
  E.playHand(st);
  E.declare(st, { type: 'null', ouvert: true });
  assert.strictEqual(E.nullValue(st.game), 59);
  assert.strictEqual(E.gameLabel(st.game), 'Null Ouvert Hand');
});

test('Ansagen: Schneider nur bei Hand', () => {
  const st = E.newGame({ dealer: 2, rng: E.seededRng(6) });
  E.bidAction(st, false); E.bidAction(st, false); E.bidAction(st, true);
  E.takeSkat(st);
  E.discard(st, st.hands[0].slice(0, 2));
  assert.throws(() => E.declare(st, { type: 'suit', trump: 'C', schneiderAnnounced: true }));
});

test('Fremde Karten tauchen in der KI-Sicht nicht auf', () => {
  const st = E.newGame({ dealer: 2, rng: E.seededRng(7) });
  const v = E.viewFor(st, 1);
  assert.deepStrictEqual(Object.keys(v).filter((k) => /hands|skat$|originalSkat|startHands/.test(k)), []);
  assert.strictEqual(v.skatKnown, undefined);
});

test('Ramsch-Abrechnung: Augensumme 120', () => {
  const st = E.newGame({ dealer: 2, rng: E.seededRng(8), rules: { mode: 'kneipe' }, special: 'ramsch' });
  while (st.phase === 'play') E.playCard(st, st.turn, AI.chooseCard(E.viewFor(st, st.turn), 'neutral').card);
  assert.strictEqual(st.result.points.reduce((a, b) => a + b, 0), 120);
  assert(st.result.score.some((s) => s !== 0));
});

test('Kneipenskat: verlorener Grand bringt 3x Bock und 3x Ramsch', () => {
  const m = new E.Match({ rules: { mode: 'kneipe' } });
  const st = m.start(E.seededRng(9));
  st.result = { game: { type: 'grand' }, won: false, score: [-96, 0, 0] };
  m.record(st);
  assert.deepStrictEqual(m.queue, ['bock', 'bock', 'bock', 'ramsch', 'ramsch', 'ramsch']);
  const next = m.start(E.seededRng(10));
  assert.strictEqual(next.special, 'bock');
});

test('Simulation: 200 KI-Spiele je Regelvariante ohne Absturz, Augen immer 120', () => {
  for (const mode of ['official', 'kneipe']) {
    const s = simulate(200, 12345, mode);
    assert.strictEqual(s.games, 200);
  }
});

/* ---------- Rundenziel "Spielen bis" ---------- */
test('Rundenziel: Auswahl wird normalisiert (301, 501, eigene Zahl 51 bis 2001, ohne Limit)', () => {
  assert.strictEqual(E.normalizeTarget('none'), null);
  assert.strictEqual(E.normalizeTarget(undefined), null);
  assert.strictEqual(E.normalizeTarget('301'), 301);
  assert.strictEqual(E.normalizeTarget('501'), 501);
  assert.strictEqual(E.normalizeTarget('custom', 750), 750);
  assert.strictEqual(E.normalizeTarget('custom', '1000.4'), 1000);
  assert.strictEqual(E.normalizeTarget('custom', 10), 51);
  assert.strictEqual(E.normalizeTarget('custom', 99999), 2001);
  assert.strictEqual(E.normalizeTarget('custom', 'abc'), null);
});

test('Rundenziel: Sieger erst bei erreichtem Ziel und alleiniger Führung', () => {
  assert.strictEqual(E.sessionWinner([300, 120, -40], 301), null);
  assert.strictEqual(E.sessionWinner([301, 120, -40], 301), 0);   // genau erreicht
  assert.strictEqual(E.sessionWinner([280, 340, 310], 301), 1);   // zwei drüber: der Höchste gewinnt
  assert.strictEqual(E.sessionWinner([320, 320, 10], 301), null); // Gleichstand an der Spitze: weiter
  assert.strictEqual(E.sessionWinner([5000, 0, 0], null), null);  // ohne Limit nie
  assert.deepStrictEqual(E.standings([10, 340, 120]), [1, 2, 0]);
});

test('Rundenziel: Match mit Ziel 301 endet nach dem Spiel, das die Grenze überschreitet', () => {
  const m = new E.Match({ rules: { mode: 'official' } });
  const target = E.normalizeTarget('301');
  const fake = (score) => { const st = m.start(E.seededRng(m.gameNo + 1)); st.result = { score, game: { type: 'suit' }, won: true }; m.record(st); };
  fake([120, 0, 0]); assert.strictEqual(E.sessionWinner(m.scores, target), null);
  fake([0, 0, -96]); assert.strictEqual(E.sessionWinner(m.scores, target), null);
  fake([192, 0, 0]); assert.strictEqual(E.sessionWinner(m.scores, target), 0);
  assert.deepStrictEqual(m.scores, [312, 0, -96]);
});

/* ---------- Spielstärke ---------- */
test('Spielstärke: alle Stufen spielen nur erlaubte Karten und sehen keine fremden Karten', () => {
  const rng = E.seededRng(77);
  for (const level of AI.LEVELS) {
    for (let i = 0; i < 6; i++) {
      const st = E.newGame({ dealer: i % 3, rng });
      const who = { persona: 'neutral', level, rng, samples: 6 };
      while (st.phase === 'bidding') { const t = E.biddingTurn(st); E.bidAction(st, AI.decideBid(E.viewFor(st, t.player), t, who)); }
      if (st.phase === 'skat') {
        const d = AI.decideSkat(E.viewFor(st, st.declarer), who);
        if (d.hand) { E.playHand(st); E.declare(st, d.game); }
        else { E.takeSkat(st); const x = AI.chooseDiscardAndGame(E.viewFor(st, st.declarer), who); E.discard(st, x.discard); E.declare(st, x.game); }
      }
      while (st.phase === 'play') {
        const p = st.turn;
        const v = E.viewFor(st, p);
        for (const q of [0, 1, 2]) if (q !== p && !(v.openHand && q === st.declarer)) for (const c of st.hands[q]) assert(!v.hand.includes(c));
        const card = AI.chooseCard(v, who).card;
        assert(E.legalFor(st, p).includes(card), level + ': illegale Karte');
        E.playCard(st, p, card);
      }
    }
  }
});
