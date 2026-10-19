/* Spielstärke der KI messen. Aufruf: node tests/ai-strength.js [N] [seed]
   Teil 1: KI-Kartenspiel gegen Zufallsspieler (Grundcheck, dass die Heuristik überhaupt etwas taugt).
   Teil 2: Vergleich der Stufen Anfänger, Kneipe, Turnier. Je Stufe sitzt ein Spieler dieser Stufe gegen zwei
           Kneipen-Spieler, auf denselben Kartenverteilungen, auf jedem der drei Plätze einmal ("Duplikat-Skat").
           Gemessen: Punkte je Spiel (einfache Liste), Gewinnquote als Alleinspieler, Erfolgsquote als Gegenspieler. */
const E = require('../../public/skat/js/engine.js');
const AI = require('../../public/skat/js/ai.js');

function runRandom(n, declSmart, defSmart, seed) {
  const rng = E.seededRng(seed);
  const pick = E.seededRng(seed + 1);
  let games = 0, won = 0, pts = 0;
  for (let i = 0; i < n; i++) {
    const st = E.newGame({ dealer: i % 3, rng });
    while (st.phase === 'bidding') { const t = E.biddingTurn(st); E.bidAction(st, AI.decideBid(E.viewFor(st, t.player), t, 'neutral')); }
    if (st.phase !== 'skat') continue;
    const d = AI.decideSkat(E.viewFor(st, st.declarer), 'neutral');
    if (d.hand) { E.playHand(st); E.declare(st, d.game); }
    else { E.takeSkat(st); const x = AI.chooseDiscardAndGame(E.viewFor(st, st.declarer), 'neutral'); E.discard(st, x.discard); E.declare(st, x.game); }
    if (st.game.type === 'null') continue;
    while (st.phase === 'play') {
      const p = st.turn;
      const smart = p === st.declarer ? declSmart : defSmart;
      const legal = E.legalFor(st, p);
      const card = smart ? AI.chooseCard(E.viewFor(st, p), 'neutral').card : legal[Math.floor(pick() * legal.length)];
      E.playCard(st, p, card);
    }
    games++; if (st.result.won) won++; pts += st.result.declarerPoints;
  }
  return `${games} Spiele, Alleinspieler gewinnt ${Math.round((100 * won) / games)} %, Schnitt ${Math.round(pts / games)} Augen`;
}

// Ein Spiel mit gegebener Kartenverteilung; levels[p] = Stufe von Spieler p
function playDeal(deck, dealer, levels, rng) {
  const who = (p) => ({ persona: 'neutral', level: levels[p], rng, samples: 12 });
  const st = E.newGame({ dealer, deck, rules: { mode: 'official' } });
  while (st.phase === 'bidding') { const t = E.biddingTurn(st); E.bidAction(st, AI.decideBid(E.viewFor(st, t.player), t, who(t.player))); }
  if (st.phase === 'skat') {
    const d = AI.decideSkat(E.viewFor(st, st.declarer), who(st.declarer));
    if (d.hand) { E.playHand(st); E.declare(st, d.game); }
    else { E.takeSkat(st); const x = AI.chooseDiscardAndGame(E.viewFor(st, st.declarer), who(st.declarer)); E.discard(st, x.discard); E.declare(st, x.game); }
  }
  while (st.phase === 'play') { const p = st.turn; E.playCard(st, p, AI.chooseCard(E.viewFor(st, p), who(p)).card); }
  return st;
}

function compareLevel(level, n, seed) {
  const deckRng = E.seededRng(seed);
  const rng = E.seededRng(seed + 7);
  const s = { games: 0, score: 0, decl: 0, declWon: 0, def: 0, defWon: 0, grandNull: 0 };
  for (let i = 0; i < n; i++) {
    const deck = E.shuffle(E.createDeck(), deckRng);
    for (let seat = 0; seat < 3; seat++) {
      const levels = ['kneipe', 'kneipe', 'kneipe'];
      levels[seat] = level;
      const st = playDeal(deck, i % 3, levels, rng);
      const r = st.result;
      s.games++;
      s.score += r.score[seat];
      if (r.passedIn) continue;
      if (r.declarer === seat) { s.decl++; if (r.won) s.declWon++; if (r.game.type !== 'suit') s.grandNull++; }
      else { s.def++; if (!r.won) s.defWon++; }
    }
  }
  return s;
}

function pct(a, b) { return b ? Math.round((1000 * a) / b) / 10 : 0; }

if (require.main === module) {
  const n = +process.argv[2] || 300;
  const seed = +process.argv[3] || 2026;
  console.log('Teil 1: Heuristik gegen Zufall (' + n + ' Verteilungen)');
  console.log('  KI gegen KI               :', runRandom(n, true, true, 11));
  console.log('  KI-Alleinspieler vs Zufall:', runRandom(n, true, false, 11));
  console.log('  Zufall vs KI-Gegenspieler :', runRandom(n, false, true, 11));
  console.log('  Zufall gegen Zufall       :', runRandom(n, false, false, 11));
  console.log('\nTeil 2: Stufe X gegen zwei Kneipen-Spieler, ' + n + ' Verteilungen x 3 Plätze');
  const out = {};
  for (const level of ['anfaenger', 'kneipe', 'turnier']) {
    const t0 = Date.now();
    const s = compareLevel(level, n, seed);
    out[level] = s;
    console.log(`  ${level.padEnd(9)}: ${(s.score / s.games).toFixed(2).padStart(6)} Punkte/Spiel | Alleinspieler ${s.decl}x, gewonnen ${pct(s.declWon, s.decl)} % (Grand/Null ${s.grandNull}) | Gegenspieler ${s.def}x, Spiel verhindert ${pct(s.defWon, s.def)} % | ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  const avg = (l) => out[l].score / out[l].games;
  const ok = avg('turnier') >= avg('kneipe') && avg('kneipe') > avg('anfaenger');
  console.log('\nErgebnis: Turnier >= Kneipe > Anfänger ' + (ok ? 'bestätigt' : 'NICHT bestätigt'));
  process.exitCode = ok ? 0 : 1;
}
module.exports = { compareLevel, playDeal };
