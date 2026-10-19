/*
 * Spiel-Freunde Schwimmen, auch 31 oder Schnauz.
 * Läuft im Browser (window.SchwimmenEngine) und in Node (require).
 *
 * Voreinstellung, verbreitete deutsche Hausregeln, kein Einsatz:
 * Skatblatt 32, drei Karten, drei offen in der Mitte.
 * Tauschen einer Karte oder aller drei, einmal schieben je Spieler,
 * klopfen, danach hat jede andere Hand noch genau einen Zug.
 * Augen nur in einer Farbe: Ass 11, Zehn und Figuren 10, Rest der Aufdruck.
 * Drilling 30½. 31 (eine Farbe) und Feuer (drei Asse) beenden sofort.
 * Drei Leben, danach das eine Mal Schwimmen. Wer das verliert, ist raus.
 * Gewonnen hat, wer als Letzte noch dabei ist.
 *
 * Karten: Farbe + Rang, z. B. "H10", "CA". Farben C S H D.
 * Sitz 0 ist der Mensch, danach links herum.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SchwimmenEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['C', 'S', 'H', 'D'];
  const FRENCH_SUIT = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
  const FRENCH_SYMBOL = { C: '♣', S: '♠', H: '♥', D: '♦' };
  const GERMAN_SUIT = { C: 'Eichel', S: 'Grün', H: 'Herz', D: 'Schellen' };
  const GERMAN_SYMBOL = { C: 'E', S: 'G', H: '♥', D: 'B' };
  const POINTS = { A: 11, K: 10, Q: 10, J: 10, '10': 10, '9': 9, '8': 8, '7': 7 };
  const FEUER = 100;

  function suitOf(card) { return String(card || '').charAt(0); }
  function rankOf(card) { return String(card || '').slice(1); }

  function normalizeRules(input) {
    const r = input || {};
    const opponents = [1, 2, 3, 4].indexOf(+r.opponents) >= 0 ? +r.opponents : 3;
    const lives = [1, 2, 3, 5].indexOf(+r.lives) >= 0 ? +r.lives : 3;
    const maxHands = [0, 5, 8, 12].indexOf(+r.maxHands) >= 0 ? +r.maxHands : 0;
    const feuerCost = +r.feuerCost === 2 ? 2 : 1;
    const deck = r.deck === 'german' ? 'german' : 'french';
    const schiebenMode = r.schiebenMode === 'fresh' ? 'fresh' : 'once';
    const knockFrom = r.knockFrom === 'acted' ? 'acted' : 'anytime';
    return {
      opponents: opponents,
      lives: lives,
      maxHands: maxHands,
      feuerCost: feuerCost,
      deck: deck,
      schiebenMode: schiebenMode,
      knockFrom: knockFrom,
      swim: r.swim !== false,
      schieben: r.schieben !== false,
      allSwap: r.allSwap !== false,
      knockPenalty: !!r.knockPenalty,
      instant31: r.instant31 !== false,
      feuerInstant: r.feuerInstant !== false,
    };
  }

  function playerCount(rules) { return normalizeRules(rules).opponents + 1; }
  function german(rules) { return normalizeRules(rules).deck === 'german'; }
  function suitName(suit, rules) { return (german(rules) ? GERMAN_SUIT : FRENCH_SUIT)[suit] || suit; }
  function suitSymbol(suit, rules) { return (german(rules) ? GERMAN_SYMBOL : FRENCH_SYMBOL)[suit] || ''; }
  function rankName(rank) {
    if (rank === 'A') return 'Ass';
    if (rank === 'K') return 'König';
    if (rank === 'Q') return 'Dame';
    if (rank === 'J') return 'Bube';
    if (rank === '10') return 'Zehn';
    return rank;
  }
  function rankShort(rank, rules) {
    if (rank === 'A') return 'A';
    if (rank === 'K') return 'K';
    if (rank === 'Q') return german(rules) ? 'O' : 'D';
    if (rank === 'J') return german(rules) ? 'U' : 'B';
    return rank;
  }
  function cardName(card, rules) { return suitName(suitOf(card), rules) + ' ' + rankName(rankOf(card)); }
  function cardPoints(card) {
    const n = POINTS[rankOf(card)];
    return n == null ? 0 : n;
  }

  function deckCards() {
    const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    const cards = [];
    for (let s = 0; s < SUITS.length; s++) {
      for (let i = 0; i < ranks.length; i++) cards.push(SUITS[s] + ranks[i]);
    }
    return cards;
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

  function handScore(cards) {
    const list = cards || [];
    if (list.length !== 3) return { value: 0, kind: 'low', label: '0' };
    const ranks = list.map(rankOf);
    const suits = list.map(suitOf);
    if (ranks[0] === 'A' && ranks[1] === 'A' && ranks[2] === 'A') {
      return { value: FEUER, kind: 'feuer', label: 'Feuer' };
    }
    if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
      return { value: 30.5, kind: 'set', label: '30½' };
    }
    const sums = {};
    for (let i = 0; i < 3; i++) sums[suits[i]] = (sums[suits[i]] || 0) + cardPoints(list[i]);
    let best = 0;
    Object.keys(sums).forEach(function (s) { if (sums[s] > best) best = sums[s]; });
    if (best >= 31) return { value: 31, kind: '31', label: '31' };
    return { value: best, kind: 'sum', label: String(best) };
  }

  function isInstant(cards, rules) {
    const score = handScore(cards);
    const r = normalizeRules(rules);
    if (score.kind === 'feuer') return !!r.feuerInstant;
    if (score.kind === '31') return !!r.instant31;
    return false;
  }

  function nextActive(from, active) {
    if (!active || !active.length) return 0;
    const sorted = active.slice().sort(function (a, b) { return a - b; });
    for (let i = 0; i < sorted.length; i++) if (sorted[i] > from) return sorted[i];
    return sorted[0];
  }

  function blankMatch(rules) {
    const r = normalizeRules(rules);
    const n = r.opponents + 1;
    return {
      rules: r,
      lives: Array(n).fill(r.lives),
      swimming: Array(n).fill(false),
      out: Array(n).fill(false),
      lost: Array(n).fill(0),
      dealer: n - 1,
      handNo: 0,
      rows: [],
      winner: null,
    };
  }

  function freshState(rules, players) {
    const n = players || playerCount(rules);
    return {
      rules: normalizeRules(rules),
      players: n,
      hands: Array.from({ length: n }, function () { return []; }),
      middle: [],
      talon: [],
      discard: [],
      turn: 0,
      phase: 'play',
      knocker: null,
      closingLeft: 0,
      changed: false,
      schiebenUsed: Array(n).fill(false),
      actions: 0,
      active: Array.from({ length: n }, function (_, i) { return i; }),
      events: [],
      log: [],
      values: null,
      labels: null,
      losers: null,
      reason: null,
      revealer: null,
      dealer: n - 1,
    };
  }

  function setup(opts) {
    const o = opts || {};
    const hands = (o.hands || []).map(function (h) { return h.slice(); });
    const rules = normalizeRules(o.rules);
    const n = hands.length || playerCount(rules);
    const st = freshState(rules, n);
    st.hands = hands.length ? hands : st.hands;
    st.middle = (o.middle || []).slice();
    st.talon = (o.talon || []).slice();
    st.discard = (o.discard || []).slice();
    st.turn = o.turn || 0;
    st.phase = o.phase || 'play';
    st.knocker = o.knocker == null ? null : o.knocker;
    st.closingLeft = o.closingLeft || 0;
    st.changed = !!o.changed;
    st.actions = o.actions || 0;
    st.schiebenUsed = (o.schiebenUsed || Array(n).fill(false)).slice();
    st.active = (o.active || Array.from({ length: n }, function (_, i) { return i; })).slice();
    st.dealer = o.dealer == null ? n - 1 : o.dealer;
    return st;
  }

  function dealHand(match, rng) {
    const rules = normalizeRules(match.rules);
    const n = rules.opponents + 1;
    while (match.lives.length < n) {
      match.lives.push(rules.lives);
      match.swimming.push(false);
      match.out.push(false);
      match.lost.push(0);
    }
    match.lives.length = n;
    match.swimming.length = n;
    match.out.length = n;
    match.lost.length = n;
    const active = [];
    for (let i = 0; i < n; i++) if (!match.out[i]) active.push(i);
    const st = freshState(rules, n);
    st.active = active;
    if (active.length < 2) {
      st.phase = 'done';
      st.reason = 'match';
      st.losers = [];
      st.values = Array(n).fill(null);
      st.labels = Array(n).fill('');
      return st;
    }
    let deck = shuffle(deckCards(), rng || Math.random);
    active.forEach(function (seat) { st.hands[seat] = deck.splice(0, 3); });
    st.middle = deck.splice(0, 3);
    st.talon = deck;
    const dealer = match.dealer == null ? n - 1 : match.dealer;
    st.dealer = dealer;
    st.turn = nextActive(dealer, active);
    match.handNo = (match.handNo || 0) + 1;
    match.rules = rules;
    match.winner = null;
    return st;
  }

  function inHand(state, seat) {
    return state.active.indexOf(seat) >= 0 && state.phase !== 'done';
  }

  function schiebenLegal(state, seat) {
    const rules = state.rules;
    if (!rules.schieben || state.phase === 'closing') return false;
    if (state.talon.length < 3) return false;
    if (rules.schiebenMode === 'fresh') return !state.changed && !state.schiebenUsed.some(Boolean);
    return !state.schiebenUsed[seat];
  }

  function knockLegal(state) {
    if (state.phase !== 'play') return false;
    if (state.rules.knockFrom === 'acted' && state.actions < 1) return false;
    return true;
  }

  function legalMoves(state, seat) {
    if (!state || state.phase === 'done' || state.turn !== seat || !inHand(state, seat)) return [];
    const moves = [];
    if (isInstant(state.hands[seat], state.rules)) moves.push({ type: 'reveal' });
    const hand = state.hands[seat];
    for (let i = 0; i < hand.length; i++) {
      for (let j = 0; j < state.middle.length; j++) {
        moves.push({ type: 'swap', card: hand[i], with: j });
      }
    }
    if (state.rules.allSwap && hand.length === 3 && state.middle.length === 3) moves.push({ type: 'swapAll' });
    if (schiebenLegal(state, seat)) moves.push({ type: 'schieben' });
    if (knockLegal(state)) moves.push({ type: 'knock' });
    return moves;
  }

  function sameMove(a, b) {
    if (!a || !b || a.type !== b.type) return false;
    if (a.type === 'swap') return a.card === b.card && a.with === b.with;
    return true;
  }

  function allowed(state, seat, move) {
    return legalMoves(state, seat).some(function (m) { return sameMove(m, move); });
  }

  function advance(state) {
    if (state.phase === 'done') return;
    const from = state.turn;
    let next = nextActive(from, state.active);
    if (state.phase === 'closing' && next === state.knocker) next = nextActive(next, state.active);
    state.turn = next;
  }

  function afterAction(state, seat) {
    state.actions += 1;
    const score = handScore(state.hands[seat]);
    if ((score.kind === 'feuer' && state.rules.feuerInstant) || (score.kind === '31' && state.rules.instant31)) {
      finishInstant(state, seat, score);
      return;
    }
    if (state.phase === 'closing') {
      state.closingLeft -= 1;
      if (state.closingLeft <= 0) {
        finishShowdown(state);
        return;
      }
    }
    advance(state);
  }

  function finishInstant(state, seat, score) {
    const values = Array(state.players).fill(null);
    const labels = Array(state.players).fill('');
    state.active.forEach(function (i) {
      const v = i === seat ? score : handScore(state.hands[i]);
      values[i] = v.value;
      labels[i] = v.label;
    });
    state.values = values;
    state.labels = labels;
    state.reason = score.kind === 'feuer' ? 'feuer' : '31';
    state.revealer = seat;
    state.losers = state.active.filter(function (i) { return i !== seat; });
    state.phase = 'done';
    state.events.push({ type: 'reveal', seat: seat, kind: state.reason, label: score.label });
  }

  function finishShowdown(state) {
    const values = Array(state.players).fill(null);
    const labels = Array(state.players).fill('');
    let max = -1;
    let min = 999;
    state.active.forEach(function (i) {
      const v = handScore(state.hands[i]);
      values[i] = v.value;
      labels[i] = v.label;
      if (v.value > max) max = v.value;
      if (v.value < min) min = v.value;
    });
    let losers = [];
    let reason = 'showdown';
    if (state.rules.knockPenalty && state.knocker != null && values[state.knocker] < max) {
      losers = [state.knocker];
      reason = 'knock';
    } else if (min === max) {
      losers = [];
      reason = 'push';
    } else {
      losers = state.active.filter(function (i) { return values[i] === min; });
    }
    state.values = values;
    state.labels = labels;
    state.losers = losers;
    state.reason = reason;
    state.phase = 'done';
    state.events.push({ type: 'showdown', losers: losers.slice(), reason: reason });
  }

  function apply(state, seat, move) {
    if (!allowed(state, seat, move)) return { ok: false };
    const hand = state.hands[seat];
    if (move.type === 'reveal') {
      finishInstant(state, seat, handScore(hand));
      return { ok: true };
    }
    if (move.type === 'swap') {
      const idx = hand.indexOf(move.card);
      const mid = state.middle[move.with];
      hand[idx] = mid;
      state.middle[move.with] = move.card;
      state.changed = true;
      state.events.push({ type: 'swap', seat: seat, card: move.card, got: mid });
      state.log.push({ type: 'swap', seat: seat });
      afterAction(state, seat);
      return { ok: true };
    }
    if (move.type === 'swapAll') {
      const old = hand.slice();
      state.hands[seat] = state.middle.slice();
      state.middle = old;
      state.changed = true;
      state.events.push({ type: 'swapAll', seat: seat });
      state.log.push({ type: 'swapAll', seat: seat });
      afterAction(state, seat);
      return { ok: true };
    }
    if (move.type === 'schieben') {
      state.discard = state.discard.concat(state.middle);
      state.middle = state.talon.splice(0, 3);
      state.schiebenUsed[seat] = true;
      if (state.rules.schiebenMode === 'fresh') state.changed = true;
      state.events.push({ type: 'schieben', seat: seat });
      state.log.push({ type: 'schieben', seat: seat });
      afterAction(state, seat);
      return { ok: true };
    }
    if (move.type === 'knock') {
      const score = handScore(hand);
      if ((score.kind === 'feuer' && state.rules.feuerInstant) || (score.kind === '31' && state.rules.instant31)) {
        finishInstant(state, seat, score);
        return { ok: true };
      }
      state.phase = 'closing';
      state.knocker = seat;
      state.closingLeft = state.active.length - 1;
      state.events.push({ type: 'knock', seat: seat });
      state.log.push({ type: 'knock', seat: seat });
      if (state.closingLeft <= 0) finishShowdown(state);
      else advance(state);
      return { ok: true };
    }
    return { ok: false };
  }

  function applyLoss(match, seat, times) {
    const rules = normalizeRules(match.rules);
    for (let t = 0; t < (times || 1); t++) {
      if (match.out[seat]) return;
      if (match.lives[seat] > 0) {
        match.lives[seat] -= 1;
        match.lost[seat] += 1;
        if (match.lives[seat] === 0) {
          if (rules.swim) match.swimming[seat] = true;
          else match.out[seat] = true;
        }
      } else if (match.swimming[seat]) {
        match.swimming[seat] = false;
        match.out[seat] = true;
        match.lost[seat] += 1;
      }
    }
  }

  function scoreHand(match, state) {
    if (!state || state.phase !== 'done' || state.reason === 'match') return false;
    const times = state.reason === 'feuer' ? (state.rules.feuerCost || 1) : 1;
    (state.losers || []).forEach(function (seat) { applyLoss(match, seat, times); });
    match.rows = match.rows || [];
    match.rows.push({
      values: state.values,
      labels: state.labels,
      losers: (state.losers || []).slice(),
      reason: state.reason,
    });
    if (match.rows.length > 80) match.rows.shift();
    const alive = [];
    for (let i = 0; i < match.out.length; i++) if (!match.out[i]) alive.push(i);
    match.winner = null;
    if (alive.length <= 1) match.winner = alive.length === 1 ? alive[0] : null;
    else if (state.rules.maxHands && match.handNo >= state.rules.maxHands) {
      let best = -1;
      const seats = [];
      alive.forEach(function (i) {
        const key = match.lives[i] * 2 + (match.swimming[i] ? 0 : 1);
        if (key > best) { best = key; seats.length = 0; seats.push(i); }
        else if (key === best) seats.push(i);
      });
      if (seats.length === 1) match.winner = seats[0];
    }
    const living = [];
    for (let i = 0; i < match.out.length; i++) if (!match.out[i]) living.push(i);
    match.dealer = nextActive(state.dealer == null ? match.dealer : state.dealer, living.length ? living : [0]);
    return true;
  }

  function publicSummary(state) {
    if (!state) return { game: 'Schwimmen', phase: 'wait' };
    return {
      game: 'Schwimmen',
      phase: state.phase,
      turn: state.turn,
      middle: state.middle.slice(),
      yourScore: state.hands[0] ? handScore(state.hands[0]).label : '',
      talon: state.talon.length,
      reason: state.reason,
    };
  }

  return {
    SUITS: SUITS,
    FEUER: FEUER,
    suitOf: suitOf,
    rankOf: rankOf,
    normalizeRules: normalizeRules,
    playerCount: playerCount,
    suitName: suitName,
    suitSymbol: suitSymbol,
    rankName: rankName,
    rankShort: rankShort,
    cardName: cardName,
    cardPoints: cardPoints,
    deckCards: deckCards,
    handScore: handScore,
    isInstant: isInstant,
    seededRng: seededRng,
    cryptoRng: cryptoRng,
    shuffle: shuffle,
    blankMatch: blankMatch,
    setup: setup,
    dealHand: dealHand,
    legalMoves: legalMoves,
    apply: apply,
    scoreHand: scoreHand,
    applyLoss: applyLoss,
    nextActive: nextActive,
    publicSummary: publicSummary,
  };
});
