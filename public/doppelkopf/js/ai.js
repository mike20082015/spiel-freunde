/*
 * Spiel-Freunde Doppelkopf: Mitspieler.
 * Anfänger, Kneipe, Turnier. Jede Stufe sieht nur die eigene Hand und was schon liegt.
 */
(function (root, factory) {
  const api = factory(typeof require === 'function' && typeof module === 'object' ? require('./engine.js') : root.DoppelkopfEngine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DoppelkopfAI = api;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  function shape() {
    return { type: 'normal', solo: null, suit: 'D' };
  }
  function trumps(hand, game, rules, pigsOn) {
    return hand.filter((c) => E.isTrump(c, game || shape(), rules, !!pigsOn));
  }
  function lowest(cards, state) {
    const g = state.game || shape();
    return cards.slice().sort((a, b) => E.rankValue(a, g, state.rules, state.pigsOn) - E.rankValue(b, g, state.rules, state.pigsOn))[0];
  }
  function highest(cards, state) {
    const g = state.game || shape();
    return cards.slice().sort((a, b) => E.rankValue(b, g, state.rules, state.pigsOn) - E.rankValue(a, g, state.rules, state.pigsOn))[0];
  }
  function byEyes(cards) {
    return cards.slice().sort((a, b) => E.eyesOf(b) - E.eyesOf(a))[0];
  }

  function bestSolo(hand, rules, level) {
    if (level === 'anfaenger') return null;
    const queens = hand.filter((c) => E.rankOf(c) === 'Q').length;
    const jacks = hand.filter((c) => E.rankOf(c) === 'J').length;
    const queenNeed = level === 'turnier' ? 5 : 6;
    if (rules.damen && queens >= queenNeed) return { solo: 'damen', suit: null };
    if (rules.buben && jacks >= queenNeed) return { solo: 'buben', suit: null };
    if (rules.farben) {
      let best = null;
      ['C', 'S', 'H', 'D'].forEach((suit) => {
        const game = { type: 'solo', solo: suit === 'D' ? 'karo' : 'farbe', suit: suit };
        const tr = trumps(hand, game, rules, false);
        const dullen = tr.filter((c) => E.typeOf(c) === 'H10').length;
        const take = level === 'turnier'
          ? (tr.length >= 7 || (tr.length >= 6 && dullen === 2))
          : (tr.length >= 8 || (tr.length >= 7 && dullen === 2));
        if (!take) return;
        if (!best || tr.length > best.n) best = { solo: game.solo, suit: suit, n: tr.length };
      });
      if (best) return { solo: best.solo, suit: best.suit };
    }
    if (rules.fleischlos) {
      const aces = hand.filter((c) => E.rankOf(c) === 'A').length;
      const tens = hand.filter((c) => E.rankOf(c) === '10').length;
      if (aces >= 4 && tens >= (level === 'turnier' ? 2 : 3)) return { solo: 'fleischlos', suit: null };
    }
    return null;
  }
  function fallbackSolo(rules) {
    if (rules.farben) return { solo: 'karo', suit: 'D' };
    if (rules.damen) return { solo: 'damen', suit: null };
    if (rules.buben) return { solo: 'buben', suit: null };
    if (rules.fleischlos) return { solo: 'fleischlos', suit: null };
    return { solo: 'karo', suit: 'D' };
  }

  function bid(state, seat, level) {
    const rules = state.rules;
    const hand = state.hands[seat];
    const solo = bestSolo(hand, rules, level);
    if (solo) {
      const pflicht = !!rules.pflichtsolo && !state.matchPflicht[seat];
      return { kind: 'solo', solo: solo.solo, suit: solo.suit, pflicht: pflicht };
    }
    if (rules.hochzeit && E.countType(hand, 'CQ') >= 2 && level !== 'anfaenger') return { kind: 'hochzeit' };
    if (rules.armut && level === 'turnier' && trumps(hand, shape(), rules, false).length <= 2) return { kind: 'armut' };
    return { kind: 'gesund' };
  }

  function wantTake(state, seat, level) {
    if (level === 'anfaenger') return false;
    const n = trumps(state.hands[seat], shape(), state.rules, false).length;
    return n >= (level === 'turnier' ? 7 : 8);
  }
  function giveCards(state, seat) {
    const hand = state.hands[seat];
    const tr = hand.filter((c) => E.isTrump(c, shape(), state.rules, false));
    const fail = hand.filter((c) => !E.isTrump(c, shape(), state.rules, false));
    if (!tr.length) return fail.slice(0, 3);
    const give = tr.slice();
    for (let i = 0; give.length < Math.min(3, Math.max(tr.length, 1)) && i < fail.length; i++) give.push(fail[i]);
    return give.slice(0, 3);
  }
  function backCards(state, seat, n) {
    const hand = state.hands[seat].slice();
    const fail = hand.filter((c) => !E.isTrump(c, shape(), state.rules, false))
      .sort((a, b) => E.eyesOf(a) - E.eyesOf(b));
    const low = hand.filter((c) => E.isTrump(c, shape(), state.rules, false))
      .sort((a, b) => E.rankValue(a, shape(), state.rules, false) - E.rankValue(b, shape(), state.rules, false));
    const give = [];
    fail.forEach((c) => { if (give.length < n) give.push(c); });
    low.forEach((c) => { if (give.length < n) give.push(c); });
    return give;
  }

  function wantAnnounce(state, seat, level) {
    if (level === 'anfaenger') return null;
    const legal = E.legalAnnouncements(state, seat);
    if (!legal.length) return null;
    const hand = state.hands[seat];
    const tr = trumps(hand, state.game, state.rules, state.pigsOn);
    const dullen = tr.filter((c) => E.typeOf(c) === 'H10').length;
    const queens = E.countType(hand, 'CQ');
    const party = E.partyOf(state, seat);
    const strongRe = tr.length >= 7 || (queens >= 1 && dullen === 2) || queens >= 2;
    if (party === 're' && legal.indexOf('re') >= 0 && strongRe) return 're';
    if (party === 'kontra' && legal.indexOf('kontra') >= 0 && tr.length >= 6) return 'kontra';
    if (legal.indexOf('keine90') >= 0 && tr.length >= (level === 'turnier' ? 8 : 9)) return 'keine90';
    if (level === 'turnier' && legal.indexOf('keine60') >= 0 && tr.length >= 10) return 'keine60';
    return null;
  }

  function playCard(state, seat, level) {
    const legal = E.legalCards(state, seat);
    if (!legal.length) return null;
    const game = state.game;
    const isT = (c) => E.isTrump(c, game, state.rules, state.pigsOn);
    if (!state.trick.length) {
      if (level !== 'anfaenger') {
        const aces = legal.filter((c) => !isT(c) && E.rankOf(c) === 'A');
        if (aces.length) return lowest(aces, state);
      }
      const plain = legal.filter((c) => !isT(c));
      const pool = plain.length ? plain : legal;
      if (level !== 'anfaenger') {
        const safe = pool.filter((c) => E.typeOf(c) !== 'CJ' && E.typeOf(c) !== 'DA');
        if (safe.length) return lowest(safe, state);
      }
      return lowest(pool, state);
    }
    if (level !== 'anfaenger') {
      const partners = E.visiblePartners(state, seat);
      const win = E.currentWinner(state);
      if (partners.indexOf(win) >= 0) return byEyes(legal);
    }
    const eyes = E.sumEyes(state.trick.map((t) => t.card));
    const winners = legal.filter((c) => E.wouldWin(state, c));
    if (winners.length && (eyes >= 10 || level === 'turnier')) {
      return level === 'anfaenger' ? highest(winners, state) : lowest(winners, state);
    }
    if (level !== 'anfaenger') {
      const duck = legal.filter((c) => E.typeOf(c) !== 'CJ' && E.typeOf(c) !== 'DA');
      if (duck.length) return lowest(duck, state);
    }
    return lowest(legal, state);
  }

  function apply(state, seat, level) {
    if (state.phase === 'reserve') return E.actReserve(state, seat, bid(state, seat, level));
    if (state.phase === 'solo') return E.actSolo(state, seat, bestSolo(state.hands[seat], state.rules, level) || fallbackSolo(state.rules));
    if (state.phase === 'armutTake') return E.actArmutTake(state, seat, wantTake(state, seat, level));
    if (state.phase === 'armutGive') return E.actArmutGive(state, seat, giveCards(state, seat));
    if (state.phase === 'armutBack') return E.actArmutBack(state, seat, backCards(state, seat, state.armut.given.length));
    if (state.phase === 'play') {
      const ann = wantAnnounce(state, seat, level);
      if (ann) return E.actAnnounce(state, seat, ann);
      const card = playCard(state, seat, level);
      if (!card) return { ok: false, reason: 'keine Karte' };
      return E.actPlay(state, seat, card);
    }
    return { ok: false, reason: 'kein Zug' };
  }

  function runHand(match, level, rng, guard) {
    const state = E.dealHand(match, rng);
    let steps = 0;
    const limit = guard || 800;
    while (state.phase !== 'done' && steps < limit) {
      steps += 1;
      const seat = state.turn;
      const res = apply(state, seat, level);
      if (!res || !res.ok) return { state: state, steps: steps, stuck: res };
    }
    return { state: state, steps: steps };
  }

  return {
    bestSolo: bestSolo,
    bid: bid,
    playCard: playCard,
    wantAnnounce: wantAnnounce,
    apply: apply,
    runHand: runHand,
  };
});
