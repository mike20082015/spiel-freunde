/*
 * Spiel-Freunde Elfer raus: Mitspieler.
 * Die Reihen liegen offen. Anfänger legt eine Karte.
 * Kneipe und Turnier ketten bis zum Limit und ziehen danach nach.
 */
(function (root, factory) {
  const engine = typeof require === 'function' && typeof module === 'object' ? require('./engine.js') : root.ElferRausEngine;
  const api = factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ElferRausAI = api;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  function rngOf(rng) { return typeof rng === 'function' ? rng : Math.random; }

  function applyRow(rows, card) {
    const next = E.emptyRows();
    E.SUITS.forEach(function (s) {
      next[s] = { open: rows[s].open, low: rows[s].low, high: rows[s].high };
    });
    const suit = E.suitOf(card);
    const rank = E.rankOf(card);
    if (!next[suit].open) { next[suit] = { open: true, low: 11, high: 11 }; }
    else if (rank === next[suit].low - 1) next[suit].low = rank;
    else if (rank === next[suit].high + 1) next[suit].high = rank;
    return next;
  }

  function chain(hand, rows, limit) {
    const legal = hand.filter(function (card) { return E.canPlayCard(rows, card); });
    if (!legal.length || limit <= 0) return { n: 0, rank: 0, card: null };
    let best = null;
    for (let i = 0; i < legal.length; i++) {
      const card = legal[i];
      const restHand = hand.filter(function (c) { return c !== card; });
      const rest = chain(restHand, applyRow(rows, card), limit - 1);
      const key = [1 + rest.n, E.rankOf(card) + rest.rank];
      if (!best || key[0] > best.key[0] || (key[0] === best.key[0] && key[1] > best.key[1])) {
        best = { key: key, card: card };
      }
    }
    return { n: best.key[0], rank: best.key[1], card: best.card };
  }

  function act(state, seat, level, rngIn) {
    const rng = rngOf(rngIn);
    const strength = level === 'anfaenger' || level === 'turnier' ? level : 'kneipe';
    if (!state || state.phase === 'done') return null;
    const moves = E.legalMoves(state, seat);
    if (!moves.length) return null;
    const plays = moves.filter(function (m) { return m.type === 'play'; });
    if (!plays.length) return { type: 'end' };
    if (strength === 'anfaenger') {
      if (state.plays > 0) return { type: 'end' };
      const elevens = plays.filter(function (m) { return E.rankOf(m.card) === 11; });
      const pick = (elevens[0] || plays[Math.floor(rng() * plays.length)]);
      return { type: 'play', card: pick.card };
    }
    const limit = Math.max(1, state.rules.playLimit - state.plays);
    const best = chain(state.hands[seat], state.rows, Math.min(limit, 4));
    if (!best.card) return { type: 'end' };
    return { type: 'play', card: best.card };
  }

  return { act: act, chain: chain };
});
