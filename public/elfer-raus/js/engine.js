/*
 * Spiel-Freunde Elfer raus.
 * Läuft im Browser (window.ElferRausEngine) und in Node (require).
 *
 * Voreinstellung, verbreitete Familienregeln, kein Einsatz:
 * vier Farben, je 1 bis 20, zusammen 80 Karten.
 * Sechs Karten auf die Hand, der Rest ist der Talon.
 * Jede Farbe beginnt mit der 11 und wächst um eins nach oben und nach unten.
 * Am Zug bis zu drei passende Karten, danach bis zu drei nachziehen,
 * höchstens bis zur Handgröße. Wer nichts legen kann, zieht trotzdem.
 * Eine gezogene passende Karte darf noch gelegt werden.
 * Wer zuerst keine Karte mehr hat, gewinnt die Runde.
 * Wahlweise Strafpunkte der Restkarten bis zu einem Ziel.
 *
 * Karten: Farbe + Zahl, z. B. "R11", "G20". Farben R Y G B.
 * Sitz 0 ist der Mensch, danach links herum.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ElferRausEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['R', 'Y', 'G', 'B'];
  const SUIT_NAME = { R: 'Rot', Y: 'Gelb', G: 'Grün', B: 'Blau' };
  const SUIT_SYMBOL = { R: '●', Y: '★', G: '▲', B: '◆' };

  function suitOf(card) { return String(card || '').charAt(0); }
  function rankOf(card) { return +String(card || '').slice(1); }

  function normalizeRules(input) {
    const r = input || {};
    const opponents = [1, 2, 3, 4].indexOf(+r.opponents) >= 0 ? +r.opponents : 3;
    const handSize = [5, 6, 8, 10].indexOf(+r.handSize) >= 0 ? +r.handSize : 6;
    const playLimit = +r.playLimit === 1 ? 1 : +r.playLimit === 99 ? 99 : 3;
    const drawLimit = +r.drawLimit === 1 ? 1 : 3;
    const mode = r.mode === 'penalty' ? 'penalty' : 'wins';
    const penalty = r.penalty === 'count' ? 'count' : 'sum';
    return {
      opponents: opponents,
      handSize: handSize,
      playLimit: playLimit,
      drawLimit: drawLimit,
      mode: mode,
      penalty: penalty,
      mustPlay: r.mustPlay !== false,
      playDrawn: r.playDrawn !== false,
    };
  }

  function normalizeTarget(mode, target, custom) {
    const penalty = mode === 'penalty';
    if (!penalty && (target === '3' || target === '5' || target === '7')) return +target;
    if (penalty && (target === '50' || target === '100' || target === '200')) return +target;
    const fallback = penalty ? 100 : 3;
    const n = Math.round(+custom || +target || fallback);
    if (!isFinite(n)) return fallback;
    return penalty ? Math.max(20, Math.min(1000, n)) : Math.max(1, Math.min(20, n));
  }

  function playerCount(rules) { return normalizeRules(rules).opponents + 1; }
  function suitName(suit) { return SUIT_NAME[suit] || suit; }
  function suitSymbol(suit) { return SUIT_SYMBOL[suit] || ''; }
  function cardName(card) { return suitName(suitOf(card)) + ' ' + rankOf(card); }
  function cardPoints(card) { return rankOf(card) || 0; }

  function deckCards() {
    const cards = [];
    for (let s = 0; s < SUITS.length; s++) {
      for (let n = 1; n <= 20; n++) cards.push(SUITS[s] + n);
    }
    return cards;
  }

  function emptyRows() {
    const rows = {};
    SUITS.forEach(function (s) { rows[s] = { open: false, low: null, high: null }; });
    return rows;
  }

  function canPlayCard(rows, card) {
    const suit = suitOf(card);
    const rank = rankOf(card);
    if (!SUIT_NAME[suit] || rank < 1 || rank > 20) return false;
    const row = rows[suit];
    if (!row || !row.open) return rank === 11;
    return rank === row.low - 1 || rank === row.high + 1;
  }

  function layCard(rows, card) {
    const suit = suitOf(card);
    const rank = rankOf(card);
    const row = rows[suit];
    if (!row.open) {
      row.open = true;
      row.low = 11;
      row.high = 11;
      return;
    }
    if (rank === row.low - 1) row.low = rank;
    else if (rank === row.high + 1) row.high = rank;
  }

  function seededRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cryptoRng() {
    return function () {
      try {
        const g = typeof globalThis !== 'undefined' ? globalThis : null;
        if (g && g.crypto && g.crypto.getRandomValues) {
          const buf = new Uint32Array(1);
          g.crypto.getRandomValues(buf);
          return buf[0] / 4294967296;
        }
      } catch (e) { /* Math.random */ }
      return Math.random();
    };
  }
  function shuffle(list, rng) {
    const random = rng || Math.random;
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function nextIndex(index, count) { return (index + 1) % count; }

  function blankMatch(rules, target) {
    const r = normalizeRules(rules);
    const n = r.opponents + 1;
    return {
      rules: r,
      target: normalizeTarget(r.mode, target, target),
      scores: Array(n).fill(0),
      wins: Array(n).fill(0),
      dealer: n - 1,
      handNo: 0,
      rows: [],
      winner: null,
    };
  }

  function cloneRows(rows) {
    const next = emptyRows();
    SUITS.forEach(function (s) {
      next[s] = { open: !!rows[s].open, low: rows[s].low, high: rows[s].high };
    });
    return next;
  }

  function fresh(rules, players) {
    const r = normalizeRules(rules);
    const n = players || playerCount(r);
    return {
      rules: r,
      players: n,
      hands: Array.from({ length: n }, function () { return []; }),
      rows: emptyRows(),
      talon: [],
      turn: 0,
      phase: 'play',
      plays: 0,
      drawn: false,
      passes: 0,
      events: [],
      log: [],
      winner: null,
      reason: null,
      penalties: null,
      dealer: n - 1,
    };
  }

  function setup(opts) {
    const o = opts || {};
    const hands = (o.hands || []).map(function (h) { return h.slice(); });
    const rules = normalizeRules(o.rules);
    const n = hands.length || playerCount(rules);
    const st = fresh(rules, n);
    if (hands.length) st.hands = hands;
    st.rows = o.rows ? cloneRows(o.rows) : emptyRows();
    st.talon = (o.talon || []).slice();
    st.turn = o.turn || 0;
    st.phase = o.phase || 'play';
    st.plays = o.plays || 0;
    st.drawn = !!o.drawn;
    st.passes = o.passes || 0;
    st.dealer = o.dealer == null ? n - 1 : o.dealer;
    return st;
  }

  function dealHand(match, rng) {
    const rules = normalizeRules(match.rules);
    const n = rules.opponents + 1;
    const st = fresh(rules, n);
    let deck = shuffle(deckCards(), rng || Math.random);
    for (let i = 0; i < n; i++) st.hands[i] = deck.splice(0, rules.handSize);
    st.talon = deck;
    const dealer = match.dealer == null ? n - 1 : match.dealer;
    st.dealer = dealer;
    st.turn = nextIndex(dealer, n);
    match.handNo = (match.handNo || 0) + 1;
    match.rules = rules;
    match.winner = null;
    while (match.scores.length < n) { match.scores.push(0); match.wins.push(0); }
    return st;
  }

  function playable(state, seat) {
    return state.hands[seat].filter(function (card) { return canPlayCard(state.rows, card); });
  }

  function legalMoves(state, seat) {
    if (!state || state.phase === 'done' || state.turn !== seat) return [];
    const moves = [];
    if (state.plays < state.rules.playLimit) {
      playable(state, seat).forEach(function (card) { moves.push({ type: 'play', card: card }); });
    }
    const must = state.rules.mustPlay && state.plays === 0 && moves.some(function (m) { return m.type === 'play'; });
    if (!must) moves.push({ type: 'end' });
    return moves;
  }

  function penaltyOf(cards, rules) {
    if (rules.penalty === 'count') return cards.length;
    let sum = 0;
    for (let i = 0; i < cards.length; i++) sum += cardPoints(cards[i]);
    return sum;
  }

  function closeHand(state, winner, reason) {
    state.phase = 'done';
    state.winner = winner;
    state.reason = reason;
    state.penalties = state.hands.map(function (hand) { return penaltyOf(hand, state.rules); });
    state.events.push({ type: 'end', winner: winner, reason: reason });
  }

  function drawCount(state, seat) {
    const hand = state.hands[seat];
    const room = Math.max(0, state.rules.handSize - hand.length);
    let n = Math.min(state.rules.drawLimit, room, state.talon.length);
    if (state.plays === 0 && n === 0 && state.talon.length && !playable(state, seat).length) {
      n = Math.min(state.rules.drawLimit, state.talon.length, 3);
    }
    return n;
  }

  function advance(state) {
    if (state.plays === 0) state.passes += 1;
    else state.passes = 0;
    if (state.talon.length === 0 && state.passes >= state.players) {
      let best = null;
      for (let i = 0; i < state.players; i++) {
        const cards = state.hands[i].length;
        const sum = penaltyOf(state.hands[i], { penalty: 'sum' });
        if (!best || cards < best.cards || (cards === best.cards && sum < best.sum)) {
          best = { seat: i, cards: cards, sum: sum, tie: false };
        } else if (cards === best.cards && sum === best.sum) best.tie = true;
      }
      closeHand(state, best && !best.tie ? best.seat : null, 'stall');
      return;
    }
    state.turn = nextIndex(state.turn, state.players);
    state.plays = 0;
    state.drawn = false;
  }

  function drawAndMaybeStay(state, seat) {
    if (!state.drawn) {
      const n = drawCount(state, seat);
      const got = state.talon.splice(0, n);
      for (let i = 0; i < got.length; i++) state.hands[seat].push(got[i]);
      state.drawn = true;
      state.events.push({ type: 'draw', seat: seat, n: got.length });
      const canMore = state.rules.playDrawn && state.plays < state.rules.playLimit && playable(state, seat).length > 0 && got.length > 0;
      if (canMore) return;
    }
    advance(state);
  }

  function apply(state, seat, move) {
    if (!state || state.phase === 'done' || state.turn !== seat || !move) return { ok: false };
    const legal = legalMoves(state, seat);
    if (move.type === 'play') {
      if (!legal.some(function (m) { return m.type === 'play' && m.card === move.card; })) return { ok: false };
      const idx = state.hands[seat].indexOf(move.card);
      if (idx < 0) return { ok: false };
      state.hands[seat].splice(idx, 1);
      layCard(state.rows, move.card);
      state.plays += 1;
      state.events.push({ type: 'play', seat: seat, card: move.card });
      state.log.push({ type: 'play', seat: seat, card: move.card });
      if (!state.hands[seat].length) {
        closeHand(state, seat, 'out');
        return { ok: true };
      }
      return { ok: true };
    }
    if (move.type === 'end') {
      if (!legal.some(function (m) { return m.type === 'end'; })) return { ok: false };
      drawAndMaybeStay(state, seat);
      return { ok: true };
    }
    return { ok: false };
  }

  function scoreHand(match, state) {
    if (!state || state.phase !== 'done') return false;
    const mode = state.rules.mode;
    if (mode === 'penalty') {
      state.penalties.forEach(function (pts, i) { match.scores[i] += pts; });
    } else if (state.winner != null) {
      match.wins[state.winner] += 1;
    }
    match.rows = match.rows || [];
    match.rows.push({
      penalties: state.penalties.slice(),
      winner: state.winner,
      reason: state.reason,
    });
    if (match.rows.length > 40) match.rows.shift();
    const target = match.target;
    match.winner = null;
    if (mode === 'penalty') {
      if (match.scores.some(function (s) { return s >= target; })) {
        const min = Math.min.apply(null, match.scores);
        const who = match.scores.map(function (s, i) { return s === min ? i : -1; }).filter(function (i) { return i >= 0; });
        if (who.length === 1) match.winner = who[0];
      }
    } else {
      const max = Math.max.apply(null, match.wins);
      if (max >= target) {
        const who = match.wins.map(function (s, i) { return s === max ? i : -1; }).filter(function (i) { return i >= 0; });
        if (who.length === 1) match.winner = who[0];
      }
    }
    match.dealer = nextIndex(state.dealer == null ? match.dealer : state.dealer, state.players);
    return true;
  }

  function publicSummary(state) {
    if (!state) return { game: 'Elfer raus', phase: 'wait' };
    const open = {};
    SUITS.forEach(function (s) {
      const row = state.rows[s];
      open[s] = row.open ? row.low + '-' + row.high : '';
    });
    return {
      game: 'Elfer raus',
      phase: state.phase,
      turn: state.turn,
      rows: open,
      yourCards: state.hands[0] ? state.hands[0].length : 0,
      talon: state.talon.length,
    };
  }

  return {
    SUITS: SUITS,
    suitOf: suitOf,
    rankOf: rankOf,
    normalizeRules: normalizeRules,
    normalizeTarget: normalizeTarget,
    playerCount: playerCount,
    suitName: suitName,
    suitSymbol: suitSymbol,
    cardName: cardName,
    cardPoints: cardPoints,
    deckCards: deckCards,
    emptyRows: emptyRows,
    canPlayCard: canPlayCard,
    seededRng: seededRng,
    cryptoRng: cryptoRng,
    shuffle: shuffle,
    blankMatch: blankMatch,
    setup: setup,
    dealHand: dealHand,
    legalMoves: legalMoves,
    playable: playable,
    apply: apply,
    scoreHand: scoreHand,
    penaltyOf: penaltyOf,
    publicSummary: publicSummary,
  };
});
