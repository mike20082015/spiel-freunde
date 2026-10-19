/*
 * Spiel-Freunde Schafkopf: Mitspieler.
 * Anfänger, Kneipe, Turnier. Jede Stufe sieht nur die eigene Hand und was schon liegt.
 */
(function (root, factory) {
  const api = factory(typeof require === 'function' && typeof module === 'object' ? require('./engine.js') : root.SchafkopfEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SchafkopfAI = api;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  function trumpsOf(hand, game) {
    return hand.filter((c) => E.isTrump(c, game));
  }
  function obersIn(cards) {
    return cards.filter((c) => E.rankOf(c) === 'O').length;
  }
  function untersIn(cards) {
    return cards.filter((c) => E.rankOf(c) === 'U').length;
  }
  function sauspielTrumps(hand) {
    return trumpsOf(hand, { type: 'sauspiel' });
  }

  function callSuit(hand) {
    const prefer = ['7', '8', '9', 'K', '10'];
    let best = null;
    E.CALL_SUITS.forEach((suit) => {
      if (!E.canCall(hand, suit)) return;
      const color = hand.filter((c) => E.suitOf(c) === suit && E.rankOf(c) !== 'O' && E.rankOf(c) !== 'U');
      const low = color.length === 1 && prefer.indexOf(E.rankOf(color[0])) >= 0;
      const score = (low ? 0 : 10) + color.length;
      if (!best || score < best.score) best = { suit: suit, score: score };
    });
    return best ? best.suit : null;
  }

  function soloOffer(hand, rules, level) {
    let best = null;
    E.SUITS.forEach((suit) => {
      const game = { type: 'solo', suit: suit };
      const tr = trumpsOf(hand, game);
      const high = tr.filter((c) => E.trumpIndex(c, game) < 3).length;
      const ace = hand.indexOf(suit + 'A') >= 0;
      let take = false;
      if (level === 'anfaenger') take = tr.length >= 7 && high >= 2;
      else if (level === 'turnier') take = (tr.length >= 6 && high >= 3) || (tr.length >= 7 && high >= 2);
      else take = (tr.length >= 6 && high >= 2) || (tr.length >= 5 && ace && high >= 1);
      if (!take) return;
      const tout = !!rules.tout && tr.length >= (level === 'turnier' ? 9 : 8) && high >= 3;
      const offer = { type: 'solo', suit: suit, tout: tout };
      if (!best || tr.length > best.n || (tr.length === best.n && E.gameRank('solo', tout) > E.gameRank(best.type, best.tout))) {
        best = { type: 'solo', suit: suit, tout: tout, n: tr.length };
      }
    });
    return best;
  }

  function wenzOffer(hand, rules, level) {
    if (!rules.wenz || level === 'anfaenger') return null;
    const u = untersIn(hand);
    const aces = E.SUITS.filter((s) => hand.indexOf(s + 'A') >= 0).length;
    if (u < 3) return null;
    if (aces < 2 && u < 4) return null;
    const tout = !!rules.tout && u === 4 && aces >= 2 && level === 'turnier';
    return { type: 'wenz', suit: null, tout: tout };
  }

  function farbwenzOffer(hand, rules, level) {
    if (!rules.farbwenz || level === 'anfaenger') return null;
    if (untersIn(hand) < 3) return null;
    let best = null;
    E.SUITS.forEach((suit) => {
      const color = hand.filter((c) => E.suitOf(c) === suit && E.rankOf(c) !== 'U');
      const guarded = hand.indexOf(suit + 'A') >= 0 || hand.indexOf(suit + '10') >= 0;
      if (color.length >= 4 && guarded) best = { type: 'farbwenz', suit: suit, tout: false };
    });
    return best;
  }

  function geierOffer(hand, rules, level) {
    if (!rules.geier || level === 'anfaenger') return null;
    const o = obersIn(hand);
    if (o < 3) return null;
    const tout = !!rules.tout && o === 4 && level === 'turnier';
    return { type: 'geier', suit: null, tout: tout };
  }

  function sauspielOffer(hand, level) {
    const tr = sauspielTrumps(hand);
    const o = obersIn(tr);
    if (level === 'anfaenger') {
      if (tr.length < 4 || o < 2) return null;
    } else if (level === 'turnier') {
      if (tr.length < 4 || o < 1) return null;
      if (tr.length < 5 && o < 2) return null;
    } else if (tr.length < 4 || o < 1) return null;
    const suit = callSuit(hand);
    if (!suit) return null;
    return { type: 'sauspiel', suit: suit, tout: false };
  }

  function chooseGame(state, seat, level) {
    const hand = state.hands[seat];
    const rules = state.rules;
    const offers = [
      soloOffer(hand, rules, level),
      wenzOffer(hand, rules, level),
      farbwenzOffer(hand, rules, level),
      geierOffer(hand, rules, level),
      sauspielOffer(hand, level),
    ].filter(Boolean);
    if (state.must && !offers.length) return { type: 'solo', suit: longestSuit(hand), tout: false };
    if (!offers.length) return null;
    offers.sort((a, b) => E.gameRank(b.type, b.tout) - E.gameRank(a.type, a.tout));
    const top = offers[0];
    const legal = E.legalGames(state, seat);
    const found = legal.find((g) => g.type === top.type && (g.suit || null) === (top.suit || null) && !!g.tout === !!top.tout);
    return found ? { type: found.type, suit: found.suit, tout: found.tout } : null;
  }

  function longestSuit(hand) {
    let best = 'H';
    let n = -1;
    E.SUITS.forEach((s) => {
      const c = hand.filter((card) => E.suitOf(card) === s).length;
      if (c > n) { n = c; best = s; }
    });
    return best;
  }

  function wantPlay(state, seat, level) {
    return !!chooseGame(state, seat, level);
  }

  function wantAlso(state, seat, level) {
    if (level === 'anfaenger') return false;
    const offer = chooseGame(state, seat, level);
    return !!(offer && E.gameRank(offer.type, offer.tout) >= E.gameRank('wenz', false));
  }

  function knowsPlay(state, seat) {
    const g = state.game;
    if (!g || g.type === 'ramsch' || g.declarer == null) return false;
    if (seat === g.declarer) return true;
    if (g.type !== 'sauspiel' || !g.calledSuit) return false;
    if (state.hands[seat].indexOf(g.calledSuit + 'A') >= 0) return true;
    return E.partnerKnown(state) && g.partner === seat;
  }

  function trickLead(state) {
    return state.trick.length ? E.effSuit(state.trick[0].card, state.game) : null;
  }

  function currentWinner(state) {
    if (!state.trick.length) return null;
    return E.trickWinner(state.trick, state.game);
  }

  function partnerWinning(state, seat) {
    const w = currentWinner(state);
    const g = state.game;
    if (w == null || !g || g.type !== 'sauspiel' || !g.calledSuit) return false;
    const holds = state.hands[seat].indexOf(g.calledSuit + 'A') >= 0;
    if ((holds || (E.partnerKnown(state) && g.partner === seat)) && w === g.declarer) return true;
    if (seat === g.declarer && E.partnerKnown(state) && w === g.partner) return true;
    return false;
  }

  function lowest(cards, game) {
    return cards.slice().sort((a, b) => {
      const ta = E.isTrump(a, game);
      const tb = E.isTrump(b, game);
      if (ta !== tb) return ta ? 1 : -1;
      if (ta) return E.trumpIndex(b, game) - E.trumpIndex(a, game);
      return E.eyesOf(a) - E.eyesOf(b) || E.rankOf(a).localeCompare(E.rankOf(b));
    })[0];
  }
  function highest(cards, game) {
    return cards.slice().sort((a, b) => {
      const ta = E.isTrump(a, game);
      const tb = E.isTrump(b, game);
      if (ta !== tb) return ta ? -1 : 1;
      if (ta) return E.trumpIndex(a, game) - E.trumpIndex(b, game);
      return E.eyesOf(b) - E.eyesOf(a);
    })[0];
  }

  function beatsTrick(card, state) {
    if (!state.trick.length) return true;
    const trial = state.trick.concat([{ seat: -1, card: card }]);
    return E.trickWinner(trial, state.game) === -1;
  }

  function playCard(state, seat, level) {
    const legal = E.legalCards(state, seat);
    if (legal.length === 1) return legal[0];
    const game = state.game;
    const called = game && game.calledSuit;
    if (!state.trick.length) {
      const holdsAce = called && state.hands[seat].indexOf(called + 'A') >= 0;
      if (called && game.declarer !== seat && !holdsAce) {
        const search = legal.filter((c) => E.suitOf(c) === called && E.rankOf(c) !== 'O' && E.rankOf(c) !== 'U');
        if (search.length) return lowest(search, game);
      }
      if (knowsPlay(state, seat) || (game && game.type === 'ramsch' && level !== 'anfaenger')) {
        const tr = legal.filter((c) => E.isTrump(c, game));
        if (tr.length) return level === 'anfaenger' ? lowest(tr, game) : highest(tr, game);
      }
      const plain = legal.filter((c) => !E.isTrump(c, game));
      return lowest(plain.length ? plain : legal, game);
    }
    if (partnerWinning(state, seat) && level !== 'anfaenger') {
      const smear = legal.filter((c) => !E.isTrump(c, game) || E.eyesOf(c) >= 10);
      if (smear.length && (trickLead(state) !== 'T' || legal.every((c) => E.isTrump(c, game)))) return highest(legal, game);
    }
    const winners = legal.filter((c) => beatsTrick(c, state));
    if (winners.length && (knowsPlay(state, seat) || level === 'turnier' || (game && game.type === 'ramsch'))) {
      return lowest(winners, game);
    }
    return lowest(legal, game);
  }

  function wantStoss(state, seat, level) {
    if (!E.canStoss(state, seat) || level === 'anfaenger') return false;
    const tr = trumpsOf(state.hands[seat], state.game);
    const high = tr.filter((c) => E.trumpIndex(c, state.game) < 4).length;
    if (level === 'turnier') return tr.length >= 4 && high >= 2;
    return tr.length >= 5 && high >= 2;
  }
  function wantRetour(state, seat, level) {
    if (!E.canRetour(state, seat)) return false;
    const tr = trumpsOf(state.hands[seat], state.game);
    return tr.length >= (level === 'anfaenger' ? 99 : 5);
  }
  function wantSupra(state, seat, level) {
    if (!E.canSupra(state, seat) || level !== 'turnier') return false;
    return trumpsOf(state.hands[seat], state.game).length >= 6;
  }

  function act(state, seat, level) {
    if (state.phase === 'legen') return { fn: 'legen', knock: level !== 'anfaenger' && obersIn(state.hands[seat]) >= 2 };
    if (state.phase === 'bid') return { fn: 'intent', say: wantPlay(state, seat, level) ? 'play' : 'pass' };
    if (state.phase === 'also') return { fn: 'also', say: wantAlso(state, seat, level) ? 'also' : 'pass' };
    if (state.phase === 'choose') {
      const g = chooseGame(state, seat, level);
      return { fn: 'choose', game: g };
    }
    if (state.phase === 'play') {
      if (wantStoss(state, seat, level)) return { fn: 'stoss' };
      if (wantRetour(state, seat, level)) return { fn: 'retour' };
      if (wantSupra(state, seat, level)) return { fn: 'supra' };
      if (state.turn === seat) return { fn: 'play', card: playCard(state, seat, level) };
    }
    return null;
  }

  function apply(state, seat, level) {
    const decision = act(state, seat, level);
    if (!decision) return { ok: false, reason: 'kein Zug' };
    if (decision.fn === 'legen') return E.actLegen(state, seat, decision.knock);
    if (decision.fn === 'intent') return E.actIntent(state, seat, decision.say);
    if (decision.fn === 'also') return E.actAlso(state, seat, decision.say);
    if (decision.fn === 'choose') return E.actChoose(state, seat, decision.game);
    if (decision.fn === 'stoss') return E.actStoss(state, seat);
    if (decision.fn === 'retour') return E.actRetour(state, seat);
    if (decision.fn === 'supra') return E.actSupra(state, seat);
    if (decision.fn === 'play') return E.actPlay(state, seat, decision.card);
    return { ok: false, reason: 'unbekannt' };
  }

  function preemptKontra(state, level) {
    if (state.phase !== 'play' || !E.windowOpen(state)) return false;
    for (let s = 0; s < 4; s++) {
      if (wantStoss(state, s, level)) return E.actStoss(state, s);
      if (wantRetour(state, s, level)) return E.actRetour(state, s);
      if (wantSupra(state, s, level)) return E.actSupra(state, s);
    }
    return false;
  }

  function runHand(match, level, rng, guard) {
    const state = E.dealHand(match, rng);
    let steps = 0;
    const limit = guard || 500;
    while (state.phase !== 'done' && steps < limit) {
      steps += 1;
      if (preemptKontra(state, level)) continue;
      const seat = state.turn;
      const decision = act(state, seat, level);
      if (decision && (decision.fn === 'stoss' || decision.fn === 'retour' || decision.fn === 'supra')) {
        const again = preemptKontra(state, level);
        if (again) continue;
      }
      const res = apply(state, seat, level);
      if (!res.ok) break;
    }
    return { state: state, steps: steps };
  }

  return {
    chooseGame: chooseGame,
    wantPlay: wantPlay,
    playCard: playCard,
    wantStoss: wantStoss,
    wantRetour: wantRetour,
    wantSupra: wantSupra,
    act: act,
    apply: apply,
    runHand: runHand,
    callSuit: callSuit,
  };
});
