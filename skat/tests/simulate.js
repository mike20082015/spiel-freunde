/* 200 (oder N) komplette KI-gegen-KI-Spiele headless. Aufruf: node tests/simulate.js [N] [seed] */
const assert = require('assert');
const E = require('../../public/skat/js/engine.js');
const AI = require('../../public/skat/js/ai.js');

const WHO = ['neutral', 'horst', 'margarethe'];

function playOne(match, rng) {
  const st = match.start(rng);
  const all = st.hands.flat().concat(st.skat);
  assert.strictEqual(new Set(all).size, 32, 'Deck hat nicht 32 verschiedene Karten');
  let guard = 0;
  while (st.phase !== 'done') {
    if (++guard > 500) throw new Error('Endlosschleife in Phase ' + st.phase);
    if (st.phase === 'bidding') {
      const t = E.biddingTurn(st);
      const yes = AI.decideBid(E.viewFor(st, t.player), t, WHO[t.player]);
      E.bidAction(st, yes);
    } else if (st.phase === 'skat') {
      const d = AI.decideSkat(E.viewFor(st, st.declarer), WHO[st.declarer]);
      if (d.hand) { E.playHand(st); E.declare(st, d.game); }
      else E.takeSkat(st);
    } else if (st.phase === 'discard') {
      const d = AI.chooseDiscardAndGame(E.viewFor(st, st.declarer), WHO[st.declarer]);
      E.discard(st, d.discard);
      E.declare(st, d.game);
    } else if (st.phase === 'play') {
      const p = st.turn;
      const v = E.viewFor(st, p);
      // Fairness-Check: die Sicht enthält keine fremden verdeckten Karten
      for (const q of [0, 1, 2]) if (q !== p) for (const c of st.hands[q]) {
        if (!(v.openHand && q === st.declarer)) assert(!v.hand.includes(c), 'KI sieht fremde Karte');
      }
      const { card } = AI.chooseCard(v, WHO[p]);
      const legal = E.legalFor(st, p);
      assert(legal.includes(card), 'KI spielt illegale Karte ' + card);
      E.playCard(st, p, card);
    }
  }
  const r = st.result;
  // Augen-Kontrolle
  const trickCards = st.tricks.flatMap((t) => t.cards.map((x) => x.card));
  const total = E.sumPoints(trickCards) + E.sumPoints(st.skat) + E.sumPoints(st.hands.flat());
  assert.strictEqual(total, 120, 'Augensumme ist nicht 120');
  if (!r.passedIn && st.tricks.length === 10) {
    assert.strictEqual(E.sumPoints(trickCards) + E.sumPoints(st.skat), 120);
    if (r.ramsch) assert.strictEqual(r.points.reduce((a, b) => a + b, 0), 120);
    else assert.strictEqual(r.declarerPoints + r.defenderPoints, 120);
  }
  match.record(st);
  return st;
}

function simulate(n, seed, mode) {
  const rng = E.seededRng(seed);
  const match = new E.Match({ rules: { mode } });
  const stats = { games: 0, passed: 0, ramsch: 0, declared: 0, won: 0, overbid: 0, hand: 0, types: {}, bock: 0, totalsOK: true, winByType: {} };
  for (let i = 0; i < n; i++) {
    const st = playOne(match, rng);
    stats.games++;
    const r = st.result;
    if (r.passedIn) stats.passed++;
    else if (r.ramsch) stats.ramsch++;
    else {
      stats.declared++;
      if (r.won) stats.won++;
      if (r.overbid) stats.overbid++;
      if (r.game.hand) stats.hand++;
      const k = E.gameLabel({ type: r.game.type, trump: r.game.trump, ouvert: r.game.ouvert });
      stats.types[k] = (stats.types[k] || 0) + 1;
      stats.winByType[k] = (stats.winByType[k] || 0) + (r.won ? 1 : 0);
    }
    if (st.special === 'bock') stats.bock++;
  }
  stats.scores = match.scores;
  return stats;
}

module.exports = { simulate, playOne };

if (require.main === module) {
  const n = +process.argv[2] || 200;
  const seed = +process.argv[3] || 4711;
  for (const mode of ['official', 'kneipe']) {
    const s = simulate(n, seed, mode);
    console.log(`[${mode}] ${s.games} Spiele ok. Gereizt: ${s.declared}, gewonnen: ${s.won} (${Math.round((100 * s.won) / Math.max(1, s.declared))} %), überreizt: ${s.overbid}, Hand: ${s.hand}, eingepasst: ${s.passed}, Ramsch: ${s.ramsch}, Bock: ${s.bock}`);
    console.log('   Spielarten:', JSON.stringify(s.types), 'gewonnen:', JSON.stringify(s.winByType), 'Punkte:', s.scores.join(' / '));
  }
}
