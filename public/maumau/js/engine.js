/*
 * Spiel-Freunde Mau-Mau.
 * Läuft im Browser (window.MauMauEngine) und in Node (require).
 *
 * Voreinstellung, verbreitete deutsche Hausregeln:
 * französisches Skatblatt (32), fünf Karten, 7 zieht zwei und lässt sich stapeln,
 * 8 setzt aus, Bube wünscht und passt auf alles, Bube auf Bube ist verboten,
 * gezogene Karte darf sofort gelegt werden, Mau und Mau-Mau mit einer Strafkarte,
 * Punkte der Restkarten (Bube 20, Ass 11, König Dame 10 je 10, 9 bis 7 nach Augen).
 * Die Startkarte wirkt nicht. Ass und 9 sind erst Schalter.
 *
 * Karten: Farbe + Rang, z. B. "H10", "CJ". Farben C S H D.
 * Sitz 0 ist der Mensch, danach links herum. Richtung +1 ist links herum.
 * Gezählt werden Punkte, kein Geld. Wer die Grenze allein oben erreicht, hat verloren.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MauMauEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['C', 'S', 'H', 'D'];
  const FRENCH_SUIT = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
  const FRENCH_SYMBOL = { C: '♣', S: '♠', H: '♥', D: '♦' };
  const GERMAN_SUIT = { C: 'Eichel', S: 'Grün', H: 'Herz', D: 'Schellen' };
  const GERMAN_SYMBOL = { C: 'E', S: 'G', H: '♥', D: 'B' };
  const RANK_POINTS = { J: 20, A: 11, K: 10, Q: 10, '10': 10, '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2 };

  function suitOf(card) { return String(card || '').charAt(0); }
  function rankOf(card) { return String(card || '').slice(1); }

  function normalizeRules(input) {
    const r = input || {};
    const deck = r.deck === 'german' || r.deck === 'french52' ? r.deck : 'french';
    const handSize = [5, 6, 7].indexOf(+r.handSize) >= 0 ? +r.handSize : 5;
    const opponents = [2, 3, 4].indexOf(+r.opponents) >= 0 ? +r.opponents : 2;
    const ace = r.ace === 'again' || r.ace === 'reverse' ? r.ace : 'off';
    const nine = r.nine === 'reverse' || r.nine === 'wild' ? r.nine : 'off';
    const mauPenalty = [0, 1, 2].indexOf(+r.mauPenalty) >= 0 ? +r.mauPenalty : 1;
    return {
      deck: deck,
      handSize: handSize,
      opponents: opponents,
      ace: ace,
      nine: nine,
      mauPenalty: mauPenalty,
      seven: r.seven !== false,
      sevenStack: r.sevenStack !== false,
      sevenSkip: !!r.sevenSkip,
      eight: r.eight !== false,
      jackWish: r.jackWish !== false,
      jackWild: r.jackWild !== false,
      jackOnJack: !!r.jackOnJack,
      playDrawn: r.playDrawn !== false,
      startEffect: !!r.startEffect,
      scoring: r.scoring !== false,
      jackDouble: !!r.jackDouble,
      threeAces: !!r.threeAces,
    };
  }

  function normalizeTarget(target, custom) {
    if (target === '50' || target === '100' || target === '150') return +target;
    const n = Math.round(+custom || +target || 100);
    if (!isFinite(n)) return 100;
    return Math.max(1, Math.min(500, n));
  }

  function playerCount(rules) { return normalizeRules(rules).opponents + 1; }

  function ranksFor(rules) {
    if (normalizeRules(rules).deck === 'french52') return ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  }

  function deckCards(rules) {
    const ranks = ranksFor(rules);
    const cards = [];
    for (let s = 0; s < SUITS.length; s++) {
      for (let i = 0; i < ranks.length; i++) cards.push(SUITS[s] + ranks[i]);
    }
    return cards;
  }

  function german(rules) { return normalizeRules(rules).deck === 'german'; }

  function suitName(suit, rules) {
    return (german(rules) ? GERMAN_SUIT : FRENCH_SUIT)[suit] || suit;
  }
  function suitSymbol(suit, rules) {
    return (german(rules) ? GERMAN_SYMBOL : FRENCH_SYMBOL)[suit] || '';
  }
  function rankName(rank, rules) {
    if (rank === 'J') return german(rules) ? 'Unter' : 'Bube';
    if (rank === 'Q') return german(rules) ? 'Ober' : 'Dame';
    if (rank === 'K') return 'König';
    if (rank === 'A') return 'Ass';
    if (rank === '10') return 'Zehn';
    return rank;
  }
  function rankShort(rank, rules) {
    if (rank === 'J') return german(rules) ? 'U' : 'B';
    if (rank === 'Q') return german(rules) ? 'O' : 'D';
    return rank;
  }
  function cardName(card, rules) {
    return suitName(suitOf(card), rules) + ' ' + rankName(rankOf(card), rules);
  }
  function cardPoints(card) {
    const r = rankOf(card);
    return RANK_POINTS[r] != null ? RANK_POINTS[r] : 0;
  }

  function nextIndex(index, direction, count) {
    const dir = direction < 0 ? -1 : 1;
    return (index + dir + count * 4) % count;
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

  function blankMatch(rules, target) {
    const n = playerCount(rules);
    return {
      rules: normalizeRules(rules),
      target: normalizeTarget(target, target),
      scores: Array(n).fill(0),
      wins: Array(n).fill(0),
      dealer: n - 1,
      handNo: 0,
      rows: [],
      winner: null,
    };
  }

  function freshState(rules, rng) {
    const n = playerCount(rules);
    return {
      rules: normalizeRules(rules),
      players: n,
      hands: Array.from({ length: n }, function () { return []; }),
      talon: [],
      discard: [],
      activeSuit: 'H',
      pendingDraw: 0,
      direction: 1,
      turn: 0,
      dealer: n - 1,
      phase: 'play',
      drawnCard: null,
      pendingCall: null,
      resume: null,
      afterSuit: null,
      winner: null,
      winReason: null,
      lastCard: null,
      doubled: false,
      outOrder: [],
      points: null,
      handSize: normalizeRules(rules).handSize,
      log: [],
      events: [],
      rng: rng || Math.random,
    };
  }

  function emit(state, event) {
    state.events.push(event);
    return event;
  }

  function refill(state) {
    if (state.discard.length <= 1) return false;
    const top = state.discard[state.discard.length - 1];
    const rest = state.discard.slice(0, -1);
    state.talon = shuffle(rest, state.rng);
    state.discard = [top];
    emit(state, { type: 'reshuffle' });
    return true;
  }

  function take(state, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      if (!state.talon.length) refill(state);
      if (!state.talon.length) break;
      out.push(state.talon.pop());
    }
    return out;
  }

  function topCard(state) { return state.discard[state.discard.length - 1] || null; }

  function canPlay(state, card) {
    const top = topCard(state);
    if (!top || !card) return false;
    const rules = state.rules;
    const rank = rankOf(card);
    const topRank = rankOf(top);
    if (state.pendingDraw > 0) return !!(rules.seven && rules.sevenStack && rank === '7');
    if (rank === 'J' && topRank === 'J' && !rules.jackOnJack) return false;
    if (rank === 'J' && rules.jackWild) return true;
    if (rank === '9' && rules.nine === 'wild') return true;
    if (suitOf(card) === state.activeSuit) return true;
    if (rank === topRank) return true;
    return false;
  }

  function aceCount(hand) {
    let n = 0;
    for (let i = 0; i < hand.length; i++) if (rankOf(hand[i]) === 'A') n += 1;
    return n;
  }

  function legalMoves(state, seat) {
    if (!state || state.phase === 'done') return [];
    if (seat < 0 || seat >= state.players) return [];
    if (state.phase === 'suit') {
      if (seat !== state.turn) return [];
      return SUITS.map(function (s) { return { type: 'suit', suit: s }; });
    }
    if (state.phase === 'call') {
      const debtor = state.pendingCall && state.pendingCall.seat;
      if (seat === debtor) return [{ type: 'call' }];
      return [{ type: 'notice' }, { type: 'forgive' }];
    }
    if (seat !== state.turn) return [];
    if (state.phase === 'drawn') {
      if (state.pendingDraw > 0) {
        const moves = [];
        if (state.drawnCard && canPlay(state, state.drawnCard)) moves.push({ type: 'play', card: state.drawnCard });
        moves.push({ type: 'drawPenalty' });
        return moves;
      }
      const moves = [{ type: 'keep' }];
      if (state.drawnCard && canPlay(state, state.drawnCard)) moves.push({ type: 'play', card: state.drawnCard });
      return moves;
    }
    if (state.phase !== 'play') return [];
    const moves = [];
    const hand = state.hands[seat];
    if (state.pendingDraw > 0) {
      if (state.rules.seven && state.rules.sevenStack) {
        for (let i = 0; i < hand.length; i++) {
          if (rankOf(hand[i]) === '7') moves.push({ type: 'play', card: hand[i] });
        }
      }
      moves.push({ type: 'drawPenalty' });
      return moves;
    }
    if (state.rules.threeAces && aceCount(hand) >= 3) moves.push({ type: 'aces' });
    for (let i = 0; i < hand.length; i++) {
      if (canPlay(state, hand[i])) moves.push({ type: 'play', card: hand[i] });
    }
    moves.push({ type: 'draw' });
    return moves;
  }

  function fail(reason) { return { ok: false, reason: reason }; }

  function handPoints(hand, doubled) {
    let sum = 0;
    for (let i = 0; i < hand.length; i++) sum += cardPoints(hand[i]);
    return doubled ? sum * 2 : sum;
  }

  function finishWin(state, seat, reason) {
    state.phase = 'done';
    state.winner = seat;
    state.winReason = reason || 'out';
    state.pendingCall = null;
    state.drawnCard = null;
    state.doubled = !!(state.rules.jackDouble && state.lastCard && rankOf(state.lastCard) === 'J' && state.winReason === 'out');
    state.pendingDraw = 0;
    state.outOrder = [];
    state.points = state.hands.map(function (hand, i) {
      return i === seat ? 0 : handPoints(hand, state.doubled);
    });
    emit(state, { type: 'win', seat: seat, reason: state.winReason, points: state.points.slice(), doubled: state.doubled });
    return { ok: true };
  }

  function goNext(state, from, skip, extra) {
    state.phase = 'play';
    state.pendingCall = null;
    state.resume = null;
    state.drawnCard = null;
    if (extra && state.hands[from].length > 0) {
      state.turn = from;
      emit(state, { type: 'again', seat: from });
      return;
    }
    const steps = 1 + (skip ? 1 : 0);
    let seat = from;
    for (let i = 0; i < steps; i++) seat = nextIndex(seat, state.direction, state.players);
    state.turn = seat;
    if (skip) emit(state, { type: 'skip', seat: nextIndex(from, state.direction, state.players) });
  }

  function openCall(state, seat, kind, resume) {
    state.phase = 'call';
    state.pendingCall = { seat: seat, kind: kind };
    state.resume = resume;
    state.turn = seat;
    emit(state, { type: 'callWindow', seat: seat, kind: kind });
    return { ok: true };
  }

  function rememberOut(state, seat) {
    if (!state.outOrder) state.outOrder = [];
    if (state.hands[seat].length === 0 && state.outOrder.indexOf(seat) < 0) state.outOrder.push(seat);
  }

  function finishIfOut(state) {
    if (state.pendingDraw > 0 || !state.outOrder || !state.outOrder.length) return null;
    while (state.outOrder.length && state.hands[state.outOrder[0]].length !== 0) state.outOrder.shift();
    if (!state.outOrder.length) return null;
    return finishWin(state, state.outOrder[0], 'out');
  }

  // Eine 7 als letzte Karte gewinnt erst, wenn jemand den Stapel zieht.
  function deferSevenWin(state, seat, plan) {
    if (!(state.pendingDraw > 0 && state.hands[seat].length === 0)) return null;
    rememberOut(state, seat);
    const resume = plan || { skip: false, extra: false };
    goNext(state, seat, !!resume.skip, false);
    return { ok: true };
  }

  function afterPlay(state, seat, plan) {
    if (plan.needCall && !plan.calledOk) return openCall(state, seat, plan.kind, { skip: plan.skip, extra: plan.extra });
    if (plan.jumpTo != null) {
      state.phase = 'play';
      state.turn = plan.jumpTo;
      state.pendingCall = null;
      state.resume = null;
      return { ok: true };
    }
    const deferred = deferSevenWin(state, seat, plan);
    if (deferred) return deferred;
    goNext(state, seat, plan.skip, plan.extra);
    return { ok: true };
  }

  function removeCard(hand, card) {
    const i = hand.indexOf(card);
    if (i < 0) return false;
    hand.splice(i, 1);
    return true;
  }

  function wantedCall(left) {
    if (left === 0) return 'maumau';
    if (left === 1) return 'mau';
    return null;
  }

  function playCard(state, seat, card, call) {
    const hand = state.hands[seat];
    if (state.phase === 'drawn' && card !== state.drawnCard) return fail('drawn');
    if (!canPlay(state, card)) return fail('illegal');
    if (!removeCard(hand, card)) return fail('missing');
    state.discard.push(card);
    state.lastCard = card;
    state.drawnCard = null;
    state.activeSuit = suitOf(card);
    const rank = rankOf(card);
    const rules = state.rules;
    const left = hand.length;
    if (rank === '7' && rules.seven) state.pendingDraw += 2;
    const plan = {
      skip: rank === '8' && rules.eight,
      extra: rank === 'A' && rules.ace === 'again' && left > 0,
      kind: wantedCall(left),
      needCall: rules.mauPenalty > 0 && (left === 0 || left === 1),
      calledOk: false,
      jumpTo: null,
    };
    if (rank === 'A' && rules.ace === 'reverse') state.direction *= -1;
    if (rank === '9' && rules.nine === 'reverse') state.direction *= -1;
    plan.calledOk = !plan.needCall || call === plan.kind;
    state.log.push({ seat: seat, type: 'play', card: card, suit: state.activeSuit, call: call || null });
    emit(state, {
      type: 'play', seat: seat, card: card, left: left,
      pendingDraw: state.pendingDraw, call: call || null, forgot: plan.needCall && !plan.calledOk,
    });
    if (left === 0 && plan.calledOk) {
      const deferred = deferSevenWin(state, seat, plan);
      if (deferred) return deferred;
      return finishWin(state, seat, 'out');
    }
    if (rank === 'J' && rules.jackWish && left > 0) {
      state.phase = 'suit';
      state.afterSuit = plan;
      state.turn = seat;
      emit(state, { type: 'wish', seat: seat });
      return { ok: true };
    }
    return afterPlay(state, seat, plan);
  }

  function payPenalty(state, seat) {
    const n = state.pendingDraw;
    const drawn = take(state, n);
    for (let i = 0; i < drawn.length; i++) state.hands[seat].push(drawn[i]);
    state.pendingDraw = 0;
    state.drawnCard = null;
    state.log.push({ seat: seat, type: 'penaltyDraw', cards: drawn.length, suit: state.activeSuit });
    emit(state, { type: 'penaltyDraw', seat: seat, cards: drawn.length });
    goNext(state, seat, !!state.rules.sevenSkip, false);
    return finishIfOut(state) || { ok: true };
  }

  function apply(state, seat, move) {
    if (!state || state.phase === 'done') return fail('done');
    move = move || {};
    // Ziehen oder Behalten bei offenem Stapel zahlt die ganze Strafe, nicht nur zwei.
    if (state.pendingDraw > 0 && (move.type === 'draw' || move.type === 'keep')) move = { type: 'drawPenalty' };
    const legal = legalMoves(state, seat);
    const allowed = legal.some(function (m) {
      if (m.type !== move.type) return false;
      if (m.type === 'play') return m.card === move.card;
      if (m.type === 'suit') return m.suit === move.suit;
      return true;
    });
    if (!allowed) return fail('illegal');

    if (move.type === 'suit') {
      state.activeSuit = move.suit;
      const plan = state.afterSuit || { skip: false, extra: false, needCall: false, calledOk: true, jumpTo: null };
      state.afterSuit = null;
      state.log.push({ seat: seat, type: 'suit', suit: move.suit });
      emit(state, { type: 'suit', seat: seat, suit: move.suit });
      return afterPlay(state, seat, plan);
    }

    if (move.type === 'call') {
      const pending = state.pendingCall;
      const resume = state.resume || { skip: false, extra: false };
      emit(state, { type: 'called', seat: seat, kind: pending.kind });
      if (pending.kind === 'maumau') {
        const deferred = deferSevenWin(state, seat, resume);
        if (deferred) return deferred;
        return finishWin(state, seat, 'out');
      }
      goNext(state, seat, resume.skip, resume.extra);
      return { ok: true };
    }

    if (move.type === 'notice') {
      const pending = state.pendingCall;
      const debtor = pending.seat;
      const resume = state.resume || { skip: false, extra: false };
      const drawn = take(state, state.rules.mauPenalty);
      for (let i = 0; i < drawn.length; i++) state.hands[debtor].push(drawn[i]);
      emit(state, { type: 'penalty', seat: debtor, by: seat, cards: drawn.length, kind: pending.kind });
      state.log.push({ seat: debtor, type: 'penalty', cards: drawn.length, suit: state.activeSuit });
      goNext(state, debtor, resume.skip, false);
      return { ok: true };
    }

    if (move.type === 'forgive') {
      const pending = state.pendingCall;
      const resume = state.resume || { skip: false, extra: false };
      emit(state, { type: 'forgive', seat: pending.seat, kind: pending.kind });
      if (pending.kind === 'maumau') {
        const deferred = deferSevenWin(state, pending.seat, resume);
        if (deferred) return deferred;
        return finishWin(state, pending.seat, 'out');
      }
      goNext(state, pending.seat, resume.skip, resume.extra);
      return { ok: true };
    }

    if (move.type === 'aces') return finishWin(state, seat, 'aces');

    if (move.type === 'drawPenalty') return payPenalty(state, seat);

    if (move.type === 'draw') {
      const drawn = take(state, 1);
      state.log.push({ seat: seat, type: 'draw', suit: state.activeSuit, cards: drawn.length });
      if (!drawn.length) {
        emit(state, { type: 'pass', seat: seat });
        goNext(state, seat, false, false);
        return { ok: true };
      }
      state.hands[seat].push(drawn[0]);
      emit(state, { type: 'draw', seat: seat, card: drawn[0] });
      if (state.rules.playDrawn && canPlay(state, drawn[0])) {
        state.phase = 'drawn';
        state.drawnCard = drawn[0];
        state.turn = seat;
        return { ok: true };
      }
      goNext(state, seat, false, false);
      return { ok: true };
    }

    if (move.type === 'keep') {
      emit(state, { type: 'keep', seat: seat });
      state.drawnCard = null;
      goNext(state, seat, false, false);
      return { ok: true };
    }

    if (move.type === 'play') return playCard(state, seat, move.card, move.call || null);
    return fail('illegal');
  }

  function dealHand(match, rng) {
    const rules = normalizeRules(match.rules);
    const random = rng || Math.random;
    const n = match.scores.length;
    const state = freshState(rules, random);
    state.players = n;
    state.hands = Array.from({ length: n }, function () { return []; });
    state.dealer = match.dealer;
    const deck = shuffle(deckCards(rules), random);
    const maxHand = Math.max(1, Math.floor((deck.length - 1) / n));
    const handSize = Math.min(rules.handSize, maxHand);
    state.handSize = handSize;
    let i = 0;
    for (let c = 0; c < handSize; c++) {
      for (let p = 0; p < n; p++) state.hands[p].push(deck[i++]);
    }
    state.discard = [deck[i++]];
    state.talon = deck.slice(i);
    state.activeSuit = suitOf(state.discard[0]);
    let direction = 1;
    let starter = nextIndex(state.dealer, 1, n);
    const top = state.discard[0];
    const rank = rankOf(top);
    if (rules.startEffect) {
      if ((rank === 'A' && rules.ace === 'reverse') || (rank === '9' && rules.nine === 'reverse')) {
        direction = -1;
        starter = nextIndex(state.dealer, -1, n);
      }
      if (rank === '8' && rules.eight) starter = nextIndex(starter, direction, n);
      if (rank === '7' && rules.seven) state.pendingDraw = 2;
    }
    state.direction = direction;
    state.turn = starter;
    state.phase = 'play';
    if (rank === 'J' && rules.jackWish && rules.startEffect) {
      state.phase = 'suit';
      state.turn = state.dealer;
      state.afterSuit = { skip: false, extra: false, needCall: false, calledOk: true, jumpTo: starter, kind: null };
      emit(state, { type: 'wish', seat: state.dealer, start: true });
    }
    emit(state, { type: 'deal', starter: starter, top: top, handSize: handSize, pendingDraw: state.pendingDraw });
    return state;
  }

  function scoreHand(match, state) {
    if (!state || state.phase !== 'done' || !state.points) return null;
    const points = state.points;
    for (let i = 0; i < points.length; i++) {
      match.scores[i] += points[i];
      if (state.winner === i) match.wins[i] += 1;
    }
    match.handNo += 1;
    match.dealer = nextIndex(match.dealer, 1, match.scores.length);
    match.rows.push({
      winner: state.winner,
      points: points.slice(),
      doubled: !!state.doubled,
      reason: state.winReason,
    });
    if (match.rows.length > 80) match.rows.shift();
    match.winner = matchWinner(match);
    return { points: points.slice(), winner: state.winner, matchWinner: match.winner };
  }

  function matchWinner(match) {
    const arr = match.rules.scoring ? match.scores : match.wins;
    let max = arr[0];
    for (let i = 1; i < arr.length; i++) if (arr[i] > max) max = arr[i];
    if (max < match.target) return null;
    const top = [];
    for (let i = 0; i < arr.length; i++) if (arr[i] === max) top.push(i);
    if (top.length !== 1) return null;
    if (!match.rules.scoring) return top[0];
    let min = arr[0];
    for (let i = 1; i < arr.length; i++) if (arr[i] < min) min = arr[i];
    const best = [];
    for (let i = 0; i < arr.length; i++) if (arr[i] === min) best.push(i);
    return best.length === 1 ? best[0] : null;
  }

  function publicSummary(state, scores) {
    const top = state ? topCard(state) : null;
    return {
      game: 'Mau-Mau',
      phase: state ? state.phase : 'idle',
      turn: state ? state.turn : null,
      top: top,
      activeSuit: state ? state.activeSuit : null,
      pendingDraw: state ? state.pendingDraw : 0,
      direction: state ? state.direction : 1,
      cards: state ? state.hands.map(function (h) { return h.length; }) : [],
      talon: state ? state.talon.length : 0,
      scores: scores || null,
    };
  }

  function setup(partial) {
    const rules = normalizeRules(partial && partial.rules);
    const hands = (partial && partial.hands) || [[], [], []];
    const state = freshState(rules, (partial && partial.rng) || function () { return 0.5; });
    state.players = hands.length;
    state.hands = hands.map(function (h) { return h.slice(); });
    state.talon = ((partial && partial.talon) || []).slice();
    state.discard = ((partial && partial.discard) || ['H7']).slice();
    state.activeSuit = (partial && partial.activeSuit) || suitOf(topCard(state));
    state.pendingDraw = (partial && partial.pendingDraw) || 0;
    state.direction = partial && partial.direction < 0 ? -1 : 1;
    state.turn = partial && partial.turn != null ? partial.turn : 0;
    state.dealer = partial && partial.dealer != null ? partial.dealer : state.players - 1;
    state.phase = (partial && partial.phase) || 'play';
    state.drawnCard = (partial && partial.drawnCard) || null;
    state.pendingCall = (partial && partial.pendingCall) || null;
    state.resume = (partial && partial.resume) || null;
    state.outOrder = (partial && partial.outOrder) ? partial.outOrder.slice() : [];
    return state;
  }

  return {
    SUITS: SUITS,
    suitOf: suitOf,
    rankOf: rankOf,
    normalizeRules: normalizeRules,
    normalizeTarget: normalizeTarget,
    playerCount: playerCount,
    deckCards: deckCards,
    suitName: suitName,
    suitSymbol: suitSymbol,
    rankName: rankName,
    rankShort: rankShort,
    cardName: cardName,
    cardPoints: cardPoints,
    nextIndex: nextIndex,
    seededRng: seededRng,
    cryptoRng: cryptoRng,
    shuffle: shuffle,
    blankMatch: blankMatch,
    dealHand: dealHand,
    legalMoves: legalMoves,
    canPlay: canPlay,
    apply: apply,
    scoreHand: scoreHand,
    matchWinner: matchWinner,
    publicSummary: publicSummary,
    setup: setup,
    topCard: topCard,
  };
});
