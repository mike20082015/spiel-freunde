/*
 * Spiel-Freunde Mau-Mau: Mitspieler.
 * Anfänger, Kneipe, Turnier. Jede Stufe sieht nur die eigene Hand,
 * die Ablage und wie viele Karten die anderen noch haben.
 */
(function (root, factory) {
  const engine = typeof require === 'function' && typeof module === 'object' ? require('./engine.js') : root.MauMauEngine;
  const api = factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MauMauAI = api;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  function rngOf(rng) { return typeof rng === 'function' ? rng : Math.random; }
  function lengths(state) { return state.hands.map(function (h) { return h.length; }); }
  function rank(card) { return E.rankOf(card); }
  function suit(card) { return E.suitOf(card); }

  function nextSeat(state, seat) {
    return E.nextIndex(seat, state.direction, state.players);
  }

  function suitCounts(hand) {
    const n = { C: 0, S: 0, H: 0, D: 0 };
    for (let i = 0; i < hand.length; i++) n[suit(hand[i])] = (n[suit(hand[i])] || 0) + 1;
    return n;
  }

  function unseenBySuit(state, seat) {
    const seen = {};
    const own = state.hands[seat];
    for (let i = 0; i < own.length; i++) seen[own[i]] = 1;
    for (let i = 0; i < state.discard.length; i++) seen[state.discard[i]] = 1;
    const left = { C: 0, S: 0, H: 0, D: 0 };
    const deck = E.deckCards(state.rules);
    for (let i = 0; i < deck.length; i++) {
      if (!seen[deck[i]]) left[suit(deck[i])] += 1;
    }
    return left;
  }

  function drewSuit(state, seat, color) {
    for (let i = 0; i < state.log.length; i++) {
      const e = state.log[i];
      if (e.seat === seat && (e.type === 'draw' || e.type === 'penaltyDraw') && e.suit === color) return true;
    }
    return false;
  }

  function wishSuit(state, seat, level, rng) {
    const hand = state.hands[seat];
    const counts = suitCounts(hand);
    if (level === 'anfaenger' || !hand.length) return E.SUITS[Math.floor(rng() * 4)];
    const next = nextSeat(state, seat);
    const unseen = level === 'turnier' ? unseenBySuit(state, seat) : null;
    let best = 'H';
    let score = -1;
    E.SUITS.forEach(function (s) {
      let value = counts[s] * 10;
      if (drewSuit(state, next, s)) value += 6;
      if (unseen && unseen[s] === 0) value += 8;
      if (value > score) { score = value; best = s; }
    });
    return best;
  }

  function isSpecial(card, rules) {
    const r = rank(card);
    if (r === '7' && rules.seven) return true;
    if (r === '8' && rules.eight) return true;
    if (r === 'J' && (rules.jackWish || rules.jackWild)) return true;
    if (r === 'A' && rules.ace !== 'off') return true;
    if (r === '9' && rules.nine !== 'off') return true;
    return false;
  }

  // Anfänger und Turnier halten eine 7, Kneipe nur bei kleinem Nachbarn oder hohem Stapel.
  function continueSeven(state, seat, strength) {
    if (strength === 'anfaenger' || strength === 'turnier') return true;
    const nextN = lengths(state)[nextSeat(state, seat)];
    return nextN <= 3 || state.pendingDraw >= 4;
  }

  function withCall(move, hand, level, rng) {
    const left = hand.length - 1;
    if (left !== 0 && left !== 1) return move;
    const kind = left === 0 ? 'maumau' : 'mau';
    if (level === 'anfaenger' && rng() < 0.4) return move;
    move.call = kind;
    return move;
  }

  function pickPlay(state, seat, level, rng, plays) {
    const hand = state.hands[seat];
    const rules = state.rules;
    const next = nextSeat(state, seat);
    const nextN = lengths(state)[next];
    if (level === 'anfaenger') {
      const jack = plays.filter(function (m) { return rank(m.card) === 'J'; })[0];
      return withCall({ type: 'play', card: (jack || plays[0]).card }, hand, level, rng);
    }
    const attack = plays.filter(function (m) {
      const r = rank(m.card);
      return (r === '7' && rules.seven) || (r === '8' && rules.eight);
    });
    if (nextN <= 2 && attack.length) {
      attack.sort(function (a, b) { return (rank(b.card) === '7' ? 1 : 0) - (rank(a.card) === '7' ? 1 : 0); });
      return withCall({ type: 'play', card: attack[0].card }, hand, level, rng);
    }
    const normal = plays.filter(function (m) { return !isSpecial(m.card, rules); });
    const pool = normal.length ? normal : plays.filter(function (m) { return rank(m.card) !== 'J'; });
    const usable = pool.length ? pool : plays;
    const unseen = level === 'turnier' ? unseenBySuit(state, seat) : null;
    usable.sort(function (a, b) {
      function score(card) {
        let s = E.cardPoints(card);
        if (drewSuit(state, next, suit(card))) s += 15;
        if (unseen && unseen[suit(card)] === 0) s += 12;
        if (rank(card) === 'J') s -= 30;
        if (rank(card) === '7' || rank(card) === '8') s -= nextN > 3 ? 8 : 0;
        return s;
      }
      return score(b.card) - score(a.card);
    });
    const chosen = usable[0];
    if (rank(chosen.card) === 'J' && hand.length > 3 && nextN > 3 && normal.length === 0) return null;
    return withCall({ type: 'play', card: chosen.card }, hand, level, rng);
  }

  function act(state, seat, level, rngIn) {
    const rng = rngOf(rngIn);
    const strength = level === 'anfaenger' || level === 'turnier' ? level : 'kneipe';
    if (!state || state.phase === 'done') return null;
    const moves = E.legalMoves(state, seat);
    if (!moves.length) return null;

    if (state.phase === 'call') {
      if (state.pendingCall && state.pendingCall.seat === seat) {
        if (strength === 'anfaenger' && rng() < 0.75) return null;
        return { type: 'call' };
      }
      if (strength === 'anfaenger') return rng() < 0.35 ? { type: 'notice' } : { type: 'forgive' };
      return { type: 'notice' };
    }
    if (state.phase === 'suit') return { type: 'suit', suit: wishSuit(state, seat, strength, rng) };

    if (state.phase === 'drawn') {
      const play = moves.filter(function (m) { return m.type === 'play'; })[0];
      if (state.pendingDraw > 0) {
        if (play && continueSeven(state, seat, strength)) {
          return withCall({ type: 'play', card: play.card }, state.hands[seat], strength, rng);
        }
        return { type: 'drawPenalty' };
      }
      if (!play) return { type: 'keep' };
      if (strength !== 'anfaenger' && rank(play.card) === 'J' && state.hands[seat].length > 4) return { type: 'keep' };
      return withCall({ type: 'play', card: play.card }, state.hands[seat], strength, rng);
    }

    const aces = moves.filter(function (m) { return m.type === 'aces'; })[0];
    if (aces && strength !== 'anfaenger') return aces;
    const plays = moves.filter(function (m) { return m.type === 'play'; });
    if (state.pendingDraw > 0) {
      if (plays.length && continueSeven(state, seat, strength)) {
        return withCall({ type: 'play', card: plays[0].card }, state.hands[seat], strength, rng);
      }
      return { type: 'drawPenalty' };
    }
    if (!plays.length) return { type: 'draw' };
    const picked = pickPlay(state, seat, strength, rng, plays);
    if (!picked) return { type: 'draw' };
    return picked;
  }

  return { act: act, wishSuit: wishSuit };
});
