/*
 * Spiel-Freunde Skat: Heuristische KI
 *
 * FAIRNESS: Die KI schummelt nie. Jede Funktion bekommt ausschließlich die "Sicht" (view) eines Spielers
 * aus SkatEngine.viewFor(): eigene Karten, Reizverlauf, Ansage, bereits gespielte Karten, den Skat nur dann,
 * wenn sie ihn selbst aufgenommen hat, und bei Null Ouvert die offen liegenden Karten des Alleinspielers.
 * Verdeckte Karten der Mitspieler oder der verdeckte Skat sind für die KI nicht erreichbar.
 * Fehlfarben, die ein Spieler nicht bedienen konnte, werden nur aus dem öffentlichen Spielverlauf abgeleitet.
 *
 * SPIELSTÄRKE (who darf ein String "horst" oder ein Objekt { persona, level, rng } sein):
 *  - anfaenger: reizt vorsichtig und sprunghaft, spielt selten Grand oder Null, wählt in rund 25 % der Züge
 *    eine plausible, aber schwächere Karte und schmiert nicht immer.
 *  - kneipe:    die heuristische Standard-KI.
 *  - turnier:   wie kneipe, dazu beim Kartenspiel eine Monte-Carlo-Suche: Die unbekannten Karten werden
 *    viele Male zufällig neu verteilt, passend zu allem, was öffentlich bekannt ist (gespielte Karten, aus
 *    Nicht-Bedienen abgeleitete Fehlfarben, offene Null-Ouvert-Karten, grobe Plausibilität der Ansage).
 *    Jede erlaubte Karte wird in diesen Verteilungen zu Ende gespielt, die beste im Schnitt gewinnt.
 *    Auch das ist kein Schummeln: Die echten verdeckten Karten werden nie angesehen, nur geschätzt.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.SkatAI = factory(root.SkatEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  const { suitOf, rankOf, points, isJack, effSuit, power, SUITS } = E;

  // Persönlichkeit: Margarethe reizt mutiger, Horst kühl und vorsichtig.
  const PERSONAS = {
    horst: { risk: -0.2 },
    margarethe: { risk: 0.45 },
    neutral: { risk: 0 },
  };
  const LEVELS = ['anfaenger', 'kneipe', 'turnier'];
  function cfg(who) {
    if (who && typeof who === 'object') return { persona: who.persona || 'neutral', level: LEVELS.includes(who.level) ? who.level : 'kneipe', rng: who.rng || Math.random, samples: who.samples || 14 };
    return { persona: who || 'neutral', level: 'kneipe', rng: Math.random, samples: 14 };
  }
  const persona = (who) => PERSONAS[cfg(who).persona] || PERSONAS.neutral;

  // Schwellen (per Simulation kalibriert)
  const T = { suit: 5.6, grand: 6.0, handBonus: 2.4, skatGain: 0.9 };

  /* ---------- Handbewertung ---------- */

  const JACK_VAL = { CJ: 1.7, SJ: 1.45, HJ: 1.25, DJ: 1.05 };

  function suitStrength(hand, trump) {
    const g = { type: 'suit', trump };
    let s = 0;
    const trumps = hand.filter((c) => effSuit(c, g) === 'T');
    const nT = trumps.length;
    const has = new Set(hand);
    for (const c of trumps) {
      if (isJack(c)) s += JACK_VAL[c];
      else {
        const r = rankOf(c);
        s += r === 'A' ? 1.1 : r === '10' ? (has.has(trump + 'A') ? 1.0 : 0.75) : r === 'K' ? 0.65 : 0.5;
      }
    }
    if (nT >= 7) s += 0.4 * (nT - 6);
    if (nT <= 3) s -= 1.2;
    for (const su of SUITS) {
      if (su === trump) continue;
      s += sideSuitValue(hand.filter((c) => suitOf(c) === su && !isJack(c)), nT, su);
    }
    return s;
  }
  function sideSuitValue(cards, nT, su) {
    const has = (r) => cards.includes(su + r);
    let s = 0;
    const n = cards.length;
    if (n === 0) return nT >= 5 ? 0.45 : 0.1;
    if (has('A')) s += 1.1;
    if (has('10')) s += has('A') ? 0.9 : n >= 3 ? 0.3 : n === 2 ? 0.1 : -0.35;
    if (has('K')) s += has('A') && has('10') ? 0.35 : 0.05;
    const losers = Math.max(0, Math.min(n, 3) - (has('A') ? 1 : 0) - (has('A') && has('10') ? 1 : 0));
    s -= 0.18 * losers;
    if (n === 1 && !has('A') && nT >= 6) s += 0.15;
    return s;
  }

  function grandStrength(hand) {
    let s = 0;
    const nJ = hand.filter(isJack).length;
    for (const c of hand) if (isJack(c)) s += JACK_VAL[c] * 1.25;
    for (const su of SUITS) {
      const cards = hand.filter((c) => suitOf(c) === su && !isJack(c));
      const has = (r) => cards.includes(su + r);
      const n = cards.length;
      if (has('A')) s += 1.45;
      if (has('10')) s += has('A') ? 1.25 : n >= 3 ? 0.35 : -0.3;
      if (has('A') && has('10') && has('K')) s += 0.6;
      if (has('A') && has('10') && n >= 4) s += 0.45 * (n - 3);
      const tops = (has('A') ? 1 : 0) + (has('A') && has('10') ? 1 : 0) + (has('A') && has('10') && has('K') ? 1 : 0);
      s -= 0.35 * Math.max(0, Math.min(n, 3) - tops);
    }
    if (nJ <= 1) s -= 2.5;
    return s;
  }

  // Null: k-te niedrigste Karte einer Farbe (0-basiert) gilt als sicher, wenn ihr Rangindex <= 2k ist.
  const NULL_IDX = (c) => E.NULL_VALUES && ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'].indexOf(rankOf(c));
  function nullAnalysis(hand) {
    const unsafe = [];
    let danger = 0;
    for (const su of SUITS) {
      const idx = hand.filter((c) => suitOf(c) === su).map(NULL_IDX).sort((a, b) => a - b);
      let bad = 0;
      idx.forEach((r, k) => { if (r > 2 * k) bad++; });
      if (bad) unsafe.push({ suit: su, bad, len: idx.length });
      danger += bad;
    }
    return { unsafe, danger };
  }

  function mat(hand, game) { return E.matadors(hand, game); }
  function valueFor(hand, game) {
    if (game.type === 'null') return E.nullValue(game);
    const m = mat(hand, game);
    return E.calcGameValue({ game, matadors: m.count, mit: m.mit });
  }

  /* Bewertet alle Spielarten einer 10-Karten-Hand vor dem Skat. */
  function evaluateHand(hand, risk) {
    risk = risk || 0;
    const opts = [];
    for (const t of SUITS) {
      const g = { type: 'suit', trump: t };
      const st = suitStrength(hand, t);
      opts.push({ game: g, strength: st, margin: st + T.skatGain + risk - T.suit, value: valueFor(hand, g) });
    }
    const gst = grandStrength(hand);
    opts.push({ game: { type: 'grand' }, strength: gst, margin: gst + T.skatGain + risk - T.grand, value: valueFor(hand, { type: 'grand' }) });
    const na = nullAnalysis(hand);
    const nullMargin = na.danger === 0 ? 1.2 : na.danger === 1 && na.unsafe[0].len <= 2 ? 0.3 + risk : na.danger === 2 && na.unsafe.length === 1 && na.unsafe[0].len <= 2 ? -0.2 + risk : -5;
    opts.push({ game: { type: 'null' }, strength: 0, margin: nullMargin, value: 23, null: na });
    if (na.danger === 0) {
      opts.push({ game: { type: 'null', hand: true }, margin: 1.0, value: 35, hand: true });
      if (hand.filter((c) => ['A', 'K'].includes(rankOf(c))).length <= 1) opts.push({ game: { type: 'null', ouvert: true, hand: true }, margin: 0.8, value: 59, hand: true });
    }
    return opts;
  }

  // Höchster Reizwert, den die KI mitgehen würde.
  function maxBid(hand, who) {
    const c = cfg(who);
    let risk = persona(who).risk;
    // Anfänger: vorsichtiger und sprunghaft (jede Reizentscheidung würfelt neu)
    if (c.level === 'anfaenger') risk += -0.45 + (c.rng() - 0.5) * 1.4;
    let best = 0;
    for (const o of evaluateHand(hand, risk)) {
      if (c.level === 'anfaenger' && o.game.type !== 'suit') o.margin -= 1.8; // Grand und Null traut er sich selten
      if (o.margin < 0) continue;
      let v = o.value;
      // Bei "ohne" vorsichtiger: ein Bube im Skat kann die Spitzen verringern
      if (o.game.type !== 'null' && !mat(hand, o.game).mit && mat(hand, o.game).count >= 2 && o.margin < 1.5) v = E.baseValue(o.game) * 2;
      best = Math.max(best, v);
    }
    return best;
  }

  /* ---------- Reizen ---------- */
  function decideBid(view, turn, who) {
    const max = maxBid(view.hand, who);
    return turn.value != null && turn.value <= max;
  }

  /* ---------- Skat: Hand oder aufnehmen ---------- */
  function decideSkat(view, who) {
    const c = cfg(who);
    const risk = persona(who).risk - (c.level === 'anfaenger' ? 1.0 : 0);
    const bid = view.bid;
    const opts = evaluateHand(view.hand, risk);
    let best = null;
    for (const o of opts) {
      let handMargin;
      if (o.game.type === 'null') {
        if (!o.hand) continue;
        handMargin = o.margin - 0.3;
      } else handMargin = o.strength + risk - (o.game.type === 'grand' ? T.grand : T.suit) - T.handBonus;
      const handValue = o.game.type === 'null' ? o.value : o.value + E.baseValue(o.game);
      if (handValue < bid || handMargin < 0) continue;
      if (!best || handMargin > best.margin) best = { game: Object.assign({}, o.game), margin: handMargin };
    }
    if (best) return { hand: true, game: best.game };
    return { hand: false };
  }

  /* ---------- Drücken und Ansage nach Skataufnahme ---------- */
  // Bewertet alle Ansagen für 10 Restkarten (rest) nach dem Drücken von disc; cards12 = Hand + Skat für die Spitzen.
  function scoreGames(rest, disc, cards12, bid, risk, level) {
    const dp = disc.reduce((s, c) => s + points(c), 0);
    const cands = [];
    for (const t of SUITS) {
      const g = { type: 'suit', trump: t };
      if (disc.some((c) => effSuit(c, g) === 'T')) continue; // keine Trümpfe drücken
      cands.push({ game: g, score: suitStrength(rest, t) - T.suit + dp * 0.035 });
    }
    if (!disc.some(isJack)) cands.push({ game: { type: 'grand' }, score: grandStrength(rest) - T.grand + dp * 0.03 });
    const na = nullAnalysis(rest);
    cands.push({ game: { type: 'null' }, score: na.danger === 0 ? 1.0 : na.danger === 1 ? -1.2 : -6 });
    if (na.danger === 0 && rest.filter((c) => ['A', 'K', 'Q'].includes(rankOf(c))).length === 0) cands.push({ game: { type: 'null', ouvert: true }, score: 0.6 });
    for (const c of cands) {
      const v = valueFor(cards12, c.game);
      c.value = v;
      if (level === 'anfaenger' && c.game.type !== 'suit') c.score -= 1.5;
      c.total = c.score + risk * 0.2 + (v >= bid ? 0 : -50) + (c.game.type !== 'null' ? Math.min(v - bid, 24) * 0.005 : 0);
    }
    return cands.sort((a, b) => b.total - a.total);
  }

  function chooseDiscardAndGame(view, who) {
    const c = cfg(who);
    const risk = persona(who).risk;
    const cards = view.hand; // 12 Karten
    const all = [];
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const disc = [cards[i], cards[j]];
        const rest = cards.filter((x, k) => k !== i && k !== j);
        const top = scoreGames(rest, disc, cards, view.bid, risk, c.level)[0];
        all.push({ discard: disc, game: top.game, total: top.total });
      }
    }
    all.sort((a, b) => b.total - a.total);
    let best = all[0];
    // Anfänger drückt nicht immer optimal: eine der nächstbesten, noch vernünftigen Varianten
    if (c.level === 'anfaenger' && c.rng() < 0.5) {
      const ok = all.slice(0, 6).filter((x) => x.total > best.total - 0.9 && x.total > -40);
      best = ok[Math.floor(c.rng() * ok.length)] || best;
    }
    return { discard: best.discard, game: best.game };
  }

  // Ansage-Vorschlag, nachdem schon gedrückt wurde (für Tipps)
  function suggestGame(hand10, discarded, bid) {
    return scoreGames(hand10, discarded, hand10.concat(discarded), bid, 0)[0].game;
  }

  /* ---------- Kartenspiel ---------- */

  function knowledge(view) {
    const played = new Set();
    for (const t of view.tricks) for (const x of t.cards) played.add(x.card);
    for (const x of view.trick) played.add(x.card);
    const own = new Set(view.hand);
    const known = new Set(view.skatKnown || []);
    const outstanding = E.createDeck().filter((c) => !played.has(c) && !own.has(c) && !known.has(c));
    // Fehlfarben aus dem öffentlichen Verlauf ableiten
    const voids = [new Set(), new Set(), new Set()];
    const allTricks = view.tricks.map((t) => t.cards).concat(view.trick.length ? [view.trick] : []);
    for (const cards of allTricks) {
      const lead = effSuit(cards[0].card, view.game);
      for (let k = 1; k < cards.length; k++) if (effSuit(cards[k].card, view.game) !== lead) voids[cards[k].player].add(lead);
    }
    return { played, outstanding, voids };
  }

  function lowest(cards, game) { return cards.slice().sort((a, b) => points(a) - points(b) || rankCost(a, game) - rankCost(b, game))[0]; }
  function highestPoints(cards, game) { return cards.slice().sort((a, b) => points(b) - points(a) || rankCost(a, game) - rankCost(b, game))[0]; }
  // "Kosten" einer Karte: Trümpfe und hohe Karten sind wertvoll
  function rankCost(c, game) {
    const t = effSuit(c, game) === 'T';
    return (t ? 50 : 0) + power(c, game);
  }
  function beatsCurrent(card, view) {
    if (!view.trick.length) return true;
    const cards = view.trick.map((x) => x.card);
    const lead = effSuit(cards[0], view.game);
    const best = cards[E.trickWinnerIndex(cards, view.game)];
    return E.beats(card, best, lead, view.game);
  }
  // Ist die Karte unschlagbar? (keine ausstehende Karte derselben effektiven Farbe ist höher)
  function isMaster(card, know, game) {
    const es = effSuit(card, game);
    return !know.outstanding.some((o) => {
      const eo = effSuit(o, game);
      if (eo === es) return power(o, game) > power(card, game);
      return false;
    });
  }

  function heuristicCard(view, legal, know) {
    const game = view.game;
    if (game.type === 'null') return view.me === view.declarer ? nullDeclarer(view, legal, know) : nullDefender(view, legal, know);
    if (game.type === 'ramsch') return ramschPlay(view, legal, know);
    return trumpGamePlay(view, legal, know);
  }

  function chooseCard(view, who) {
    const c = cfg(who);
    const game = view.game;
    const legal = E.legalCards(view.hand, view.trick.map((x) => x.card), game);
    if (legal.length === 1) return { card: legal[0], reason: 'Du hast nur diese eine erlaubte Karte.' };
    const know = knowledge(view);
    let res = heuristicCard(view, legal, know);
    if (c.level === 'anfaenger') res = beginnerSlip(view, legal, res, c.rng);
    else if (c.level === 'turnier' && game.type !== 'ramsch') res = monteCarlo(view, legal, know, c, res);
    return res;
  }

  /* ---------- Anfänger: menschliche Fehler ---------- */
  function beginnerSlip(view, legal, res, rng) {
    const game = view.game;
    // nicht immer schmieren
    if (/^Schmieren/.test(res.reason) && rng() < 0.45) {
      const low = discardLow(legal, view.hand, game);
      if (low !== res.card) return { card: low, reason: res.reason };
    }
    if (rng() >= 0.25) return res;
    // plausible, aber schwächere Karte: keine Asse oder Zehnen verschenken, wenn es Alternativen gibt
    let pool = legal.filter((x) => x !== res.card);
    const cheap = pool.filter((x) => points(x) < 10);
    if (cheap.length) pool = cheap;
    if (!pool.length) return res;
    return { card: pool[Math.floor(rng() * pool.length)], reason: res.reason };
  }

  /* ---------- Turnier: Monte-Carlo-Suche über plausible Kartenverteilungen ---------- */
  // Verteilt die unbekannten Karten zufällig auf die Mitspieler (und den Skat), passend zu allen
  // öffentlich bekannten Fehlfarben. Liefert null, wenn es nicht gelingt.
  function sampleWorld(view, know, rng) {
    const game = view.game;
    const me = view.me, decl = view.declarer;
    const others = [0, 1, 2].filter((p) => p !== me);
    const hands = [[], [], []];
    hands[me] = view.hand.slice();
    const cap = {};
    let unknown = know.outstanding.slice();
    if (view.openHand && me !== decl) {
      hands[decl] = view.openHand.slice();
      const open = new Set(view.openHand);
      unknown = unknown.filter((x) => !open.has(x));
      cap[decl] = 0;
    } else cap[decl] = view.handSizes[decl];
    for (const p of others) if (p !== decl) cap[p] = view.handSizes[p];
    const skatSlots = unknown.length - others.reduce((s, p) => s + cap[p], 0);
    if (skatSlots < 0) return null;
    const holders = others.concat(['skat']);
    cap.skat = skatSlots;
    const skat = [];
    const ok = (p, card) => p === 'skat' || !know.voids[p].has(effSuit(card, game));
    for (let attempt = 0; attempt < 12; attempt++) {
      const left = Object.assign({}, cap);
      const H = { skat: [] }; for (const p of others) H[p] = [];
      const cards = shuffleArr(unknown.slice(), rng)
        .map((card) => ({ card, opts: holders.filter((p) => ok(p, card)).length }))
        .sort((a, b) => a.opts - b.opts);
      let fail = false;
      for (const { card } of cards) {
        const el = holders.filter((p) => left[p] > 0 && ok(p, card));
        if (!el.length) { fail = true; break; }
        const tot = el.reduce((s, p) => s + left[p], 0);
        let r = rng() * tot, pick = el[0];
        for (const p of el) { r -= left[p]; if (r < 0) { pick = p; break; } }
        H[pick].push(card); left[pick]--;
      }
      if (fail) continue;
      // Plausibilität: Ein Alleinspieler hat meist genug Trümpfe (Farbspiel) bzw. Buben (Grand)
      if (me !== decl && !view.openHand && game.type !== 'null' && attempt < 8) {
        const declPlayed = [];
        for (const t of view.tricks) for (const x of t.cards) if (x.player === decl) declPlayed.push(x.card);
        for (const x of view.trick) if (x.player === decl) declPlayed.push(x.card);
        const all = declPlayed.concat(H[decl]);
        const need = game.type === 'grand' ? all.filter(isJack).length >= 2 : all.filter((x) => effSuit(x, game) === 'T').length >= 5;
        if (!need) continue;
      }
      for (const p of others) if (!(view.openHand && p === decl)) hands[p] = H[p];
      skat.push(...H.skat);
      return { hands, skat: view.skatKnown ? view.skatKnown.slice() : skat };
    }
    return null;
  }
  function shuffleArr(a, rng) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // Spielt eine Verteilung mit der Kneipen-Heuristik zu Ende. Rückgabe: Nutzen aus Sicht des Alleinspielers.
  function rollout(view, world, first) {
    const game = view.game, decl = view.declarer;
    const hands = world.hands.map((h) => h.slice());
    const tricks = view.tricks.map((t) => ({ cards: t.cards.slice(), winner: t.winner }));
    let trick = view.trick.slice();
    let turn = view.me;
    let card = first;
    const skatTaken = !game.hand;
    for (let guard = 0; guard < 40; guard++) {
      if (card == null) {
        const v = {
          me: turn, hand: hands[turn], declarer: decl, game, bid: view.bid, trick, tricks,
          handSizes: hands.map((h) => h.length), pos: view.pos, dealer: view.dealer,
        };
        if (turn === decl && skatTaken) v.skatKnown = world.skat;
        if (game.type === 'null' && game.ouvert && turn !== decl) v.openHand = hands[decl].slice();
        const legal = E.legalCards(hands[turn], trick.map((x) => x.card), game);
        card = legal.length === 1 ? legal[0] : heuristicCard(v, legal, knowledge(v)).card;
      }
      hands[turn] = hands[turn].filter((x) => x !== card);
      trick = trick.concat([{ player: turn, card }]);
      card = null;
      if (trick.length < 3) { turn = (turn + 1) % 3; continue; }
      const w = trick[E.trickWinnerIndex(trick.map((x) => x.card), game)].player;
      tricks.push({ cards: trick, winner: w });
      trick = [];
      turn = w;
      if (game.type === 'null' && w === decl) return -1;
      if (tricks.length === 10) break;
    }
    if (game.type === 'null') return 1;
    let dp = 0, dt = 0;
    for (const t of tricks) if (t.winner === decl) { dt++; for (const x of t.cards) dp += points(x.card); }
    for (const x of world.skat) dp += points(x);
    return (dp >= 61 ? 1 : -1) + (dp >= 90 ? 0.35 : 0) - (dp <= 30 ? 0.35 : 0) + (dt === 10 ? 0.3 : 0) + (dp - 60) / 300;
  }

  function monteCarlo(view, legal, know, c, fallback) {
    const worlds = [];
    for (let i = 0; i < c.samples; i++) { const w = sampleWorld(view, know, c.rng); if (w) worlds.push(w); }
    if (worlds.length < 4) return fallback;
    const sign = view.me === view.declarer ? 1 : -1;
    let best = null;
    for (const card of legal) {
      let sum = 0;
      for (const w of worlds) sum += sign * rollout(view, w, card);
      // kleiner Bonus für die Heuristik-Karte: bei Gleichstand ihrer Erfahrung folgen
      const score = sum / worlds.length + (card === fallback.card ? 0.03 : 0);
      if (!best || score > best.score) best = { card, score };
    }
    if (best.card === fallback.card) return fallback;
    return { card: best.card, reason: 'Durchgerechnet: Diese Karte schneidet in den möglichen Kartenverteilungen am besten ab.' };
  }

  function trumpGamePlay(view, legal, know) {
    const game = view.game;
    const me = view.me, decl = view.declarer;
    const amDecl = me === decl;
    const trick = view.trick;
    const trumpsOut = know.outstanding.filter((c) => effSuit(c, game) === 'T');
    const myTrumps = view.hand.filter((c) => effSuit(c, game) === 'T');

    if (trick.length === 0) {
      if (amDecl) {
        const defenders = [0, 1, 2].filter((p) => p !== me);
        const oppMayHaveTrump = trumpsOut.length > 0 && !defenders.every((p) => know.voids[p].has('T'));
        if (oppMayHaveTrump && myTrumps.length) {
          const top = myTrumps.slice().sort((a, b) => power(b, game) - power(a, game))[0];
          if (isMaster(top, know, game)) return { card: top, reason: 'Trumpf ziehen: Mit dem höchsten Trumpf holst Du den Gegenspielern die Trümpfe raus.' };
          if (myTrumps.length > trumpsOut.length || myTrumps.length >= 4) {
            const low = myTrumps.slice().sort((a, b) => power(a, game) - power(b, game) + (points(a) - points(b)) * 0.01)[0];
            const nonJackLow = myTrumps.filter((c) => !isJack(c)).sort((a, b) => points(a) - points(b) || power(a, game) - power(b, game))[0];
            return { card: nonJackLow || low, reason: 'Trumpf ziehen: Ein kleiner Trumpf zwingt die Gegner, ihre Trümpfe abzugeben.' };
          }
        }
        const masters = legal.filter((c) => effSuit(c, game) !== 'T' && isMaster(c, know, game) && !defenders.some((p) => know.voids[p].has(suitOf(c)) && trumpsOut.length));
        if (masters.length) return { card: highestPoints(masters, game), reason: 'Die Karte ist nicht mehr zu schlagen: Augen sichern.' };
        const side = legal.filter((c) => effSuit(c, game) !== 'T');
        if (side.length) return { card: shortSuitLow(side, view.hand, game), reason: 'Kleine Karte aus einer kurzen Farbe: So wirst Du frei und kannst später stechen.' };
        return { card: lowest(legal, game), reason: 'Kleinsten Trumpf spielen.' };
      }
      // Gegenspieler spielt aus
      const partner = 3 - me - decl;
      const declNext = (me + 1) % 3 === decl; // kurzer Weg
      const sideLegal = legal.filter((c) => effSuit(c, game) !== 'T');
      const declVoid = (s) => know.voids[decl].has(s) && (trumpsOut.length > 0 || !know.voids[decl].has('T'));
      const aces = sideLegal.filter((c) => rankOf(c) === 'A' && !declVoid(suitOf(c)));
      if (aces.length) return { card: aces[0], reason: 'Ass vorspielen: Die Augen sind sicher, bevor der Alleinspieler frei wird.' };
      const masters = sideLegal.filter((c) => isMaster(c, know, game) && points(c) >= 10 && !declVoid(suitOf(c)));
      if (masters.length) return { card: masters[0], reason: 'Die Zehn ist jetzt die höchste Karte ihrer Farbe: abholen.' };
      // Partner ist frei in einer Farbe, in der der Alleinspieler nicht frei ist: dort anspielen, Partner sticht
      const partnerVoidSuit = sideLegal.filter((c) => know.voids[partner].has(suitOf(c)) && !know.voids[partner].has('T') && !declVoid(suitOf(c)));
      if (partnerVoidSuit.length) return { card: lowest(partnerVoidSuit, game), reason: 'Dein Partner hat diese Farbe nicht mehr und kann stechen.' };
      const bySuit = groupSuits(sideLegal.filter((c) => !declVoid(suitOf(c))));
      const suitsList = Object.keys(bySuit);
      if (suitsList.length) {
        suitsList.sort((a, b) => (declNext ? bySuit[b].length - bySuit[a].length : bySuit[a].length - bySuit[b].length));
        const pick = bySuit[suitsList[0]].filter((c) => !(rankOf(c) === '10' && bySuit[suitsList[0]].length > 1));
        const card = lowest(pick.length ? pick : bySuit[suitsList[0]], game);
        return { card, reason: declNext ? 'Kurzer Weg, lange Farbe: Der Alleinspieler sitzt direkt hinter Dir.' : 'Langer Weg, kurze Farbe: So kann Dein Partner hinter dem Alleinspieler reagieren.' };
      }
      if (sideLegal.length) return { card: lowest(sideLegal, game), reason: 'Kleine Karte, nichts verschenken.' };
      return { card: lowest(legal, game), reason: 'Nur noch Trümpfe: den kleinsten.' };
    }

    // Folgen
    const cards = trick.map((x) => x.card);
    const winIdx = E.trickWinnerIndex(cards, game);
    const winner = trick[winIdx].player;
    const lead = effSuit(cards[0], game);
    const trickPts = cards.reduce((s, c) => s + points(c), 0);
    const last = trick.length === 2;
    const sameTeam = (a, b) => a !== decl && b !== decl;
    const beating = legal.filter((c) => beatsCurrent(c, view));
    const following = legal.some((c) => effSuit(c, game) === lead);

    if (!amDecl && sameTeam(winner, me)) {
      // Partner liegt vorn
      const winCard = cards[winIdx];
      const declStillToPlay = !last && decl !== winner;
      const safe = !declStillToPlay || partnerSafe(winCard, lead, know, decl, game);
      if (safe) {
        const nonTrump = legal.filter((c) => effSuit(c, game) !== 'T' || !following);
        const pool = following ? legal : legal.filter((c) => effSuit(c, game) !== 'T');
        const pick = highestPoints(pool.length ? pool : nonTrump.length ? nonTrump : legal, game);
        if (points(pick) >= 10) return { card: pick, reason: 'Schmieren: Dein Partner bekommt den Stich, gib ihm volle Augen.' };
        return { card: pick, reason: 'Dein Partner liegt vorn: Augen dazugeben.' };
      }
      const masterBeat = beating.filter((c) => isMaster(c, know, game) && effSuit(c, game) === lead);
      if (masterBeat.length) return { card: highestPoints(masterBeat, game), reason: 'Mit einer unschlagbaren Karte übernehmen.' };
      return { card: discardLow(legal, view.hand, game), reason: 'Der Alleinspieler kommt noch: lieber nichts riskieren.' };
    }

    // Gegner liegt vorn (bzw. ich bin Alleinspieler)
    if (beating.length) {
      if (last) {
        const pick = beating.slice().sort((a, b) => scoreLastWin(b, game) - scoreLastWin(a, game))[0];
        const worth = trickPts + points(pick) >= 3 || effSuit(pick, game) !== 'T' || !amDecl;
        if (worth) return { card: pick, reason: effSuit(pick, game) === 'T' && lead !== 'T' ? 'Stechen: Der Stich lohnt sich.' : 'Als Letzter kannst Du sicher übernehmen.' };
      } else {
        // zweite Position: nur sichere Gewinner oder bei vielen Augen
        const safeWins = beating.filter((c) => isMaster(c, know, game) && (effSuit(c, game) === lead || !voidAfter(view, know, lead)));
        if (safeWins.length) {
          const pick = following ? highestPoints(safeWins, game) : safeWins.sort((a, b) => rankCost(a, game) - rankCost(b, game))[0];
          return { card: pick, reason: 'Diese Karte gewinnt den Stich sicher.' };
        }
        const nextIsPartner = !amDecl && (me + 1) % 3 !== decl;
        if (!nextIsPartner && trickPts >= 10) {
          const trumpBeat = beating.filter((c) => effSuit(c, game) === 'T' && lead !== 'T').sort((a, b) => power(a, game) - power(b, game));
          if (trumpBeat.length) {
            const mid = trumpBeat.find((c) => power(c, game) >= 5 && !isJack(c)) || trumpBeat[trumpBeat.length - 1];
            return { card: mid, reason: 'Viele Augen im Stich: hoch genug stechen.' };
          }
        }
      }
    }
    return { card: discardLow(legal, view.hand, game), reason: 'Den Stich bekommst Du nicht: billig abwerfen.' };
  }

  function scoreLastWin(c, game) {
    // als Letzter: Augen mitnehmen, aber keine hohen Trümpfe verschwenden
    return points(c) - (effSuit(c, game) === 'T' ? rankCost(c, game) * 0.6 : 0);
  }
  function voidAfter(view, know, lead) {
    // spielt nach mir noch ein Gegner, der in dieser Farbe frei ist?
    const after = (view.me + 1) % 3;
    return know.voids[after].has(lead);
  }
  function partnerSafe(winCard, lead, know, decl, game) {
    // kann der Alleinspieler die Karte des Partners noch schlagen?
    const declVoid = know.voids[decl].has(lead);
    if (!declVoid || lead === 'T') return isMaster(winCard, know, game);
    // Alleinspieler frei: sticht er? nur sicher, wenn er keine Trümpfe mehr hat
    return know.voids[decl].has('T');
  }
  function groupSuits(cards) {
    const g = {};
    for (const c of cards) (g[suitOf(c)] = g[suitOf(c)] || []).push(c);
    return g;
  }
  function shortSuitLow(side, hand, game) {
    const g = groupSuits(side);
    const suits = Object.keys(g).sort((a, b) => g[a].length - g[b].length);
    for (const s of suits) {
      const lowC = g[s].slice().sort((a, b) => power(a, game) - power(b, game))[0];
      if (points(lowC) < 10) return lowC;
    }
    return lowest(side, game);
  }
  function discardLow(legal, hand, game) {
    // wenig Augen, keine Trümpfe wenn möglich; bevorzugt aus kurzen Farben
    const nonTrump = legal.filter((c) => effSuit(c, game) !== 'T');
    const pool = nonTrump.length ? nonTrump : legal;
    const g = groupSuits(hand.filter((c) => effSuit(c, game) !== 'T'));
    return pool.slice().sort((a, b) => {
      const pa = points(a), pb = points(b);
      if (pa !== pb) return pa - pb;
      const la = (g[suitOf(a)] || []).length, lb = (g[suitOf(b)] || []).length;
      return la - lb || power(a, game) - power(b, game);
    })[0];
  }

  /* Null */
  function nullDeclarer(view, legal, know) {
    const game = view.game;
    const trick = view.trick;
    const lowerOut = (c) => know.outstanding.filter((o) => suitOf(o) === suitOf(c) && power(o, game) < power(c, game)).length;
    const higherOut = (c) => know.outstanding.filter((o) => suitOf(o) === suitOf(c) && power(o, game) > power(c, game)).length;
    if (!trick.length) {
      const sorted = legal.slice().sort((a, b) => lowerOut(a) - lowerOut(b) || higherOut(b) - higherOut(a));
      return { card: sorted[0], reason: 'Null: Spiel die Karte, unter die niemand mehr drunter kann.' };
    }
    const cards = trick.map((x) => x.card);
    const best = cards[E.trickWinnerIndex(cards, game)];
    const lead = suitOf(cards[0]);
    const following = legal.some((c) => suitOf(c) === lead);
    if (!following) {
      // abwerfen: gefährlichste Karte loswerden
      const pick = legal.slice().sort((a, b) => danger(b, view.hand, know, game) - danger(a, view.hand, know, game))[0];
      return { card: pick, reason: 'Null: Wirf Deine gefährlichste Karte ab.' };
    }
    const under = legal.filter((c) => power(c, game) < power(best, game));
    if (under.length) return { card: under.sort((a, b) => power(b, game) - power(a, game))[0], reason: 'Null: Bleib knapp unter der höchsten Karte im Stich.' };
    return { card: legal.slice().sort((a, b) => power(a, game) - power(b, game))[0], reason: 'Null: Leider musst Du drüber, also die kleinste Karte.' };
  }
  function danger(c, hand, know, game) {
    const lowerMine = hand.filter((h) => suitOf(h) === suitOf(c) && power(h, game) < power(c, game)).length;
    const lowerOut = know.outstanding.filter((o) => suitOf(o) === suitOf(c) && power(o, game) < power(c, game)).length;
    return lowerOut - lowerMine * 0.5 + power(c, game) * 0.1;
  }
  function nullDefender(view, legal, know) {
    const game = view.game;
    const decl = view.declarer;
    const trick = view.trick;
    const declVoid = (s) => know.voids[decl].has(s) || (view.openHand && !view.openHand.some((c) => suitOf(c) === s));
    if (!trick.length) {
      if (view.openHand) {
        // offene Karten: Farbe suchen, in der der Alleinspieler nicht drunter kommt
        let best = null;
        for (const c of legal) {
          const s = suitOf(c);
          const dc = view.openHand.filter((x) => suitOf(x) === s);
          if (!dc.length) continue;
          const minD = Math.min(...dc.map((x) => power(x, game)));
          if (power(c, game) < minD) {
            const score = minD - power(c, game);
            if (!best || score > best.score) best = { card: c, score };
          }
        }
        if (best) return { card: best.card, reason: 'Null Ouvert: Der Alleinspieler kommt in dieser Farbe nicht drunter.' };
      }
      const pool = legal.filter((c) => !declVoid(suitOf(c)));
      const pick = (pool.length ? pool : legal).slice().sort((a, b) => power(a, game) - power(b, game))[0];
      return { card: pick, reason: 'Gegen Null: kleine Karten anspielen, damit der Alleinspieler drüber muss.' };
    }
    const cards = trick.map((x) => x.card);
    const winIdx = E.trickWinnerIndex(cards, game);
    const winner = trick[winIdx].player;
    const lead = suitOf(cards[0]);
    const following = legal.some((c) => suitOf(c) === lead);
    const declPlayed = trick.some((x) => x.player === decl);
    if (!following) {
      return { card: legal.slice().sort((a, b) => power(b, game) - power(a, game))[0], reason: 'Gegen Null: hohe Karten abwerfen.' };
    }
    if (declPlayed && winner === decl) {
      const under = legal.filter((c) => power(c, game) < power(cards[winIdx], game));
      if (under.length) return { card: under.sort((a, b) => power(b, game) - power(a, game))[0], reason: 'Bleib unter dem Alleinspieler, dann hat er den Stich.' };
    }
    return { card: legal.slice().sort((a, b) => power(a, game) - power(b, game))[0], reason: 'Kleine Karte, damit der Alleinspieler drüber muss.' };
  }

  /* Ramsch: möglichst wenig Augen sammeln */
  function ramschPlay(view, legal, know) {
    const game = view.game;
    const trick = view.trick;
    if (!trick.length) {
      const pool = legal.filter((c) => !isJack(c));
      const pick = (pool.length ? pool : legal).slice().sort((a, b) => power(a, game) - power(b, game) || points(a) - points(b))[0];
      return { card: pick, reason: 'Ramsch: kleine Karte vorspielen, damit andere stechen.' };
    }
    const cards = trick.map((x) => x.card);
    const best = cards[E.trickWinnerIndex(cards, game)];
    const lead = effSuit(cards[0], game);
    const under = legal.filter((c) => !E.beats(c, best, lead, game));
    if (under.length) return { card: highestPoints(under, game), reason: 'Ramsch: Bleib drunter und schieb die Augen weiter.' };
    if (trick.length === 2) return { card: lowest(legal, game), reason: 'Ramsch: Der Stich gehört Dir sowieso, also wenig Augen.' };
    return { card: legal.slice().sort((a, b) => power(a, game) - power(b, game))[0], reason: 'Ramsch: so niedrig wie möglich.' };
  }

  return { PERSONAS, LEVELS, suggestGame, scoreGames, evaluateHand, suitStrength, grandStrength, nullAnalysis, maxBid, decideBid, decideSkat, chooseDiscardAndGame, chooseCard, knowledge };
});
