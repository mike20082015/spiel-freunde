/*
 * Spiel-Freunde Schwimmen: Mitspieler.
 * Sie sehen nur die eigene Hand und die offene Mitte.
 * Anfänger tauscht oft die erste bessere Karte und klopft früh.
 * Kneipe klopft ab 27, Turnier hält auf 30, 31 und Feuer.
 */
(function (root, factory) {
  const engine = typeof require === 'function' && typeof module === 'object' ? require('./engine.js') : root.SchwimmenEngine;
  const api = factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SchwimmenAI = api;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  function rngOf(rng) { return typeof rng === 'function' ? rng : Math.random; }

  function bestSwap(state, seat) {
    const hand = state.hands[seat];
    const now = E.handScore(hand).value;
    let best = null;
    let bestVal = now;
    for (let i = 0; i < hand.length; i++) {
      for (let j = 0; j < state.middle.length; j++) {
        const next = hand.slice();
        next[i] = state.middle[j];
        const value = E.handScore(next).value;
        if (value > bestVal) {
          bestVal = value;
          best = { type: 'swap', card: hand[i], with: j, value: value };
        }
      }
    }
    if (state.rules.allSwap && state.middle.length === 3) {
      const all = E.handScore(state.middle).value;
      if (all > bestVal) best = { type: 'swapAll', value: all };
    }
    return best;
  }

  function has(moves, type) { return moves.some(function (m) { return m.type === type; }); }

  function act(state, seat, level, rngIn) {
    const rng = rngOf(rngIn);
    const strength = level === 'anfaenger' || level === 'turnier' ? level : 'kneipe';
    if (!state || state.phase === 'done') return null;
    const moves = E.legalMoves(state, seat);
    if (!moves.length) return null;
    const score = E.handScore(state.hands[seat]);
    if (has(moves, 'reveal') && (strength !== 'anfaenger' || score.value >= 31 || rng() < 0.85)) {
      return { type: 'reveal' };
    }
    const swap = bestSwap(state, seat);
    const door = strength === 'anfaenger' ? 24 : strength === 'turnier' ? 30 : 27;
    if (swap && (strength !== 'anfaenger' || rng() < 0.82)) return { type: swap.type, card: swap.card, with: swap.with };
    if (has(moves, 'schieben') && score.value < (strength === 'turnier' ? 21 : 18)) return { type: 'schieben' };
    if (has(moves, 'knock') && (score.value >= door || !swap)) {
      if (strength === 'anfaenger' && score.value < 20 && has(moves, 'schieben') && rng() < 0.5) return { type: 'schieben' };
      return { type: 'knock' };
    }
    if (has(moves, 'schieben')) return { type: 'schieben' };
    if (swap) return { type: swap.type, card: swap.card, with: swap.with };
    if (has(moves, 'knock')) return { type: 'knock' };
    return moves[0];
  }

  return { act: act, bestSwap: bestSwap };
});
