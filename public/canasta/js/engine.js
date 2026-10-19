/*
 * Spiel-Freunde Canasta: Regel-Engine (klassisches Partnerschafts-Canasta)
 * Läuft ohne Abhängigkeiten im Browser (window.CanastaEngine) und in Node (require).
 *
 * Karten sind Strings: Farbe + Rang + Kopie, z. B. "HA#0", "H10#1", "JK#2".
 * Farben: C Kreuz, S Pik, H Herz, D Karo. Joker: "JK#0" bis "JK#3".
 * Zwei französische Blätter und vier Joker, 108 Karten.
 * Sitze im Uhrzeigersinn: 0 Du (unten), 1 Horst (links), 2 Margarethe (oben, Partner), 3 Oma Hilde (rechts).
 * Parteien: 0 und 2 gegen 1 und 3.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CanastaEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['C', 'S', 'H', 'D'];
  const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  const MELD_RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4'];
  const SUIT_NAMES = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo', J: 'Joker' };
  const SUIT_SYMBOLS = { C: '♣', S: '♠', H: '♥', D: '♦', J: '★' };
  const RANK_NAMES = {
    A: 'Ass', K: 'König', Q: 'Dame', J: 'Bube', '10': 'Zehn', '9': 'Neun', '8': 'Acht',
    '7': 'Sieben', '6': 'Sechs', '5': 'Fünf', '4': 'Vier', '3': 'Drei', '2': 'Zwei', JK: 'Joker',
  };
  const RANK_SHORT = {
    A: 'A', K: 'K', Q: 'D', J: 'B', '10': '10', '9': '9', '8': '8', '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2', JK: 'J',
  };
  const RANK_ORDER = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'JK'];
  const DEFAULT_RULES = {
    pileTake: 'frozen',
    minMeld: 'byScore',
    canastasToGoOut: 1,
    redThrees: 'classic',
    wildMajority: false,
    concealedBonus: 200,
    askPartner: true,
    noCanastaPickup: false,
    turnBlackThree: false,
  };

  function normalizeRules(raw) {
    const r = Object.assign({}, DEFAULT_RULES, raw || {});
    r.pileTake = r.pileTake === 'always' ? 'always' : 'frozen';
    r.minMeld = r.minMeld === 'fixed50' ? 'fixed50' : 'byScore';
    r.canastasToGoOut = r.canastasToGoOut === 2 ? 2 : 1;
    r.redThrees = r.redThrees === 'vienna' ? 'vienna' : 'classic';
    r.wildMajority = !!r.wildMajority;
    r.concealedBonus = r.concealedBonus === 300 ? 300 : 200;
    r.askPartner = r.askPartner !== false;
    r.noCanastaPickup = !!r.noCanastaPickup;
    r.turnBlackThree = !!r.turnBlackThree;
    return r;
  }

  function normalizeTarget(target, custom) {
    if (target === '3000' || target === 3000) return 3000;
    if (target === '5000' || target === 5000 || target == null) return 5000;
    if (target === 'custom') {
      const n = Math.round(+custom);
      if (!Number.isFinite(n)) return 5000;
      return Math.max(1000, Math.min(20000, n));
    }
    const n = Math.round(+target);
    if (!Number.isFinite(n) || n <= 0) return 5000;
    return n;
  }

  function parseCard(id) {
    const parts = String(id).split('#');
    const body = parts[0];
    const copy = parts.length > 1 ? +parts[1] : 0;
    if (body === 'JK') return { id: String(id), suit: 'J', rank: 'JK', copy: copy };
    return { id: String(id), suit: body.charAt(0), rank: body.slice(1), copy: copy };
  }
  const suitOf = (c) => parseCard(c).suit;
  const rankOf = (c) => parseCard(c).rank;
  const isJoker = (c) => rankOf(c) === 'JK';
  const isWild = (c) => rankOf(c) === '2' || isJoker(c);
  const isRedThree = (c) => rankOf(c) === '3' && (suitOf(c) === 'H' || suitOf(c) === 'D');
  const isBlackThree = (c) => rankOf(c) === '3' && (suitOf(c) === 'C' || suitOf(c) === 'S');
  const isNatural = (c) => MELD_RANKS.indexOf(rankOf(c)) !== -1;

  function cardPoints(c) {
    if (isJoker(c)) return 50;
    const r = rankOf(c);
    if (r === '2' || r === 'A') return 20;
    if (r === 'K' || r === 'Q' || r === 'J' || r === '10' || r === '9' || r === '8') return 10;
    if (r === '7' || r === '6' || r === '5' || r === '4' || r === '3') return 5;
    return 0;
  }
  function sumPoints(cards) {
    return (cards || []).reduce((s, c) => s + cardPoints(c), 0);
  }
  function cardName(c) {
    if (isJoker(c)) return 'Joker';
    return SUIT_NAMES[suitOf(c)] + '-' + RANK_NAMES[rankOf(c)];
  }
  function cardShort(c) {
    if (isJoker(c)) return '★J';
    return SUIT_SYMBOLS[suitOf(c)] + RANK_SHORT[rankOf(c)];
  }

  function createDeck() {
    const d = [];
    for (let copy = 0; copy < 2; copy++) {
      for (const s of SUITS) for (const r of RANKS) d.push(s + r + '#' + copy);
    }
    for (let i = 0; i < 4; i++) d.push('JK#' + i);
    return d;
  }

  function seededRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cryptoRng() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      return function () { crypto.getRandomValues(buf); return buf[0] / 4294967296; };
    }
    return Math.random;
  }
  function shuffle(deck, rng) {
    const a = deck.slice();
    const random = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function teamOf(seat) { return seat % 2; }
  function partnerSeat(seat) { return (seat + 2) % 4; }
  function seatsOf(team) { return team === 0 ? [0, 2] : [1, 3]; }

  function minMeldFor(score, rules) {
    const r = rules || DEFAULT_RULES;
    if (r.minMeld === 'fixed50') return 50;
    const s = +score || 0;
    if (s < 0) return 15;
    if (s < 1500) return 50;
    if (s < 3000) return 90;
    return 120;
  }

  function redThreePoints(count, positive) {
    const n = count | 0;
    if (n <= 0) return 0;
    const mag = n === 4 ? 800 : n * 100;
    return positive ? mag : -mag;
  }

  function canastaBonus(cards) {
    const list = cards || [];
    if (list.length < 7) return 0;
    if (list.some(isBlackThree) && list.every(isBlackThree)) return 0;
    return list.some(isWild) ? 300 : 500;
  }

  function sortCards(cards) {
    return cards.slice().sort((a, b) => {
      const d = RANK_ORDER.indexOf(rankOf(a)) - RANK_ORDER.indexOf(rankOf(b));
      if (d) return d;
      if (suitOf(a) !== suitOf(b)) return suitOf(a) < suitOf(b) ? -1 : 1;
      return parseCard(a).copy - parseCard(b).copy;
    });
  }

  function fail(reason) { return { ok: false, reason: reason }; }
  function ok(extra) { return Object.assign({ ok: true }, extra || {}); }

  function pull(hand, ids) {
    const need = ids.slice();
    const next = [];
    for (const c of hand) {
      const i = need.indexOf(c);
      if (i >= 0) need.splice(i, 1);
      else next.push(c);
    }
    if (need.length) return null;
    return next;
  }

  function validateNewMeld(cards, rules, allowBlack) {
    const r = rules || DEFAULT_RULES;
    const list = cards || [];
    if (allowBlack && list.length >= 3 && list.length <= 4 && list.every(isBlackThree)) {
      return { ok: true, rank: '3', black: true, points: list.length * 5, canasta: false, pure: false, wilds: 0, naturals: 0 };
    }
    if (list.length < 3) return fail('Eine Meldung braucht mindestens drei Karten.');
    if (list.some(isBlackThree) || list.some(isRedThree)) return fail('Dreien meldest du so nicht.');
    const wilds = list.filter(isWild);
    const naturals = list.filter(isNatural);
    if (wilds.length + naturals.length !== list.length) return fail('Diese Karten passen nicht zusammen.');
    if (naturals.length < 2) return fail('Mindestens zwei natürliche Karten, reine wilde Meldungen gibt es nicht.');
    if (wilds.length > 3) return fail('Höchstens drei wilde Karten in einer Meldung.');
    if (r.wildMajority && wilds.length > naturals.length) return fail('Wilde Karten dürfen nicht in der Mehrzahl sein.');
    const ranks = [];
    for (const c of naturals) if (ranks.indexOf(rankOf(c)) === -1) ranks.push(rankOf(c));
    if (ranks.length !== 1) return fail('Nur Karten gleichen Rangs.');
    const size = list.length;
    return {
      ok: true, rank: ranks[0], black: false, points: sumPoints(list),
      canasta: size >= 7, pure: size >= 7 && wilds.length === 0,
      wilds: wilds.length, naturals: naturals.length,
    };
  }

  function extensionValid(existing, add, rules) {
    const all = existing.concat(add);
    if (all.some(isBlackThree) || all.some(isRedThree)) return false;
    const wilds = all.filter(isWild).length;
    const naturals = all.filter(isNatural);
    if (naturals.length < 2 || wilds > 3) return false;
    if ((rules || DEFAULT_RULES).wildMajority && wilds > naturals.length) return false;
    const rank = rankOf(naturals[0]);
    return naturals.every((c) => rankOf(c) === rank);
  }

  function blankState(rules, scores) {
    return {
      rules: normalizeRules(rules),
      dealer: 3,
      scoresBefore: scores ? scores.slice() : [0, 0],
      hands: [[], [], [], []],
      stock: [],
      discard: [],
      frozen: false,
      melds: [[], []],
      reds: [[], []],
      phase: 'draw',
      turn: 0,
      playerMelded: [false, false, false, false],
      hadMeldAtTurnStart: [false, false],
      playerMeldedAtTurnStart: [false, false, false, false],
      handAtTurnStart: [],
      nonCounting: [],
      meldedThisTurn: false,
      asked: false,
      asker: null,
      mustGoOut: false,
      forbidGoOut: false,
      topTaken: null,
      wentOut: null,
      endReason: null,
      result: null,
      discardLog: [],
      forcedTake: false,
      mayEnd: false,
      openingPoints: 0,
      minMet: [false, false],
      completedCanastaThisTurn: false,
    };
  }

  function snap(state) { return JSON.parse(JSON.stringify(state)); }
  function restore(state, saved) {
    const keys = Object.keys(state);
    for (const k of keys) delete state[k];
    Object.assign(state, saved);
  }

  function topCard(state) {
    return state.discard.length ? state.discard[state.discard.length - 1] : null;
  }
  function findMeld(state, team, rank) {
    return state.melds[team].find((m) => m.rank === rank) || null;
  }
  function canastaCount(state, team) {
    return state.melds[team].filter((m) => !m.black && m.cards.length >= 7).length;
  }
  function isFrozenFor(state, team) {
    if (state.rules.pileTake === 'always') return true;
    if (state.frozen) return true;
    if (!state.minMet[team] && state.melds[team].length === 0) return true;
    if (state.melds[team].length === 0) return true;
    return false;
  }

  function noteTurnStart(state, seat) {
    state.turn = seat;
    state.phase = 'draw';
    state.meldedThisTurn = false;
    state.asked = false;
    state.asker = null;
    state.mustGoOut = false;
    state.forbidGoOut = false;
    state.openingPoints = 0;
    state.handAtTurnStart = state.hands[seat].slice();
    state.hadMeldAtTurnStart = [state.melds[0].length > 0, state.melds[1].length > 0];
    state.playerMeldedAtTurnStart = state.playerMelded.slice();
    state.nonCounting = [];
    state.topTaken = null;
    state.completedCanastaThisTurn = false;
    state.minMet = [state.melds[0].length > 0, state.melds[1].length > 0];
    state.forcedTake = false;
    state.mayEnd = false;
    if (!state.stock.length) {
      if (mustTake(state, seat)) state.forcedTake = true;
      else state.mayEnd = true;
    }
  }

  function pileBlockedByTop(state) {
    const top = topCard(state);
    if (!top) return true;
    return isWild(top) || isBlackThree(top) || isRedThree(top);
  }

  function mustTake(state, seat) {
    if (state.stock.length || pileBlockedByTop(state)) return false;
    const team = teamOf(seat);
    if (isFrozenFor(state, team)) return false;
    const top = topCard(state);
    const existing = findMeld(state, team, rankOf(top));
    if (!existing) return false;
    if (state.rules.noCanastaPickup && existing.cards.length >= 7) return false;
    if (state.hands[seat].length === 1 && state.discard.length === 1) return false;
    return true;
  }

  function placeRedAndReplace(state, seat) {
    let guard = 0;
    while (guard++ < 30) {
      const red = state.hands[seat].find(isRedThree);
      if (!red) return ok();
      if (!state.stock.length) return ok();
      state.hands[seat] = state.hands[seat].filter((c) => c !== red);
      state.reds[teamOf(seat)].push(red);
      const rep = state.stock.pop();
      if (isRedThree(rep) && !state.stock.length) {
        state.reds[teamOf(seat)].push(rep);
        finish(state, 'redThree');
        return ok({ ended: true });
      }
      state.hands[seat].push(rep);
    }
    return ok();
  }

  function newGame(opts) {
    opts = opts || {};
    const rules = normalizeRules(opts.rules);
    const rng = opts.rng || Math.random;
    const deck = opts.deck ? opts.deck.slice() : shuffle(createDeck(), rng);
    const state = blankState(rules, opts.scores);
    state.dealer = opts.dealer == null ? 3 : opts.dealer;
    const start = (state.dealer + 1) % 4;
    let i = 0;
    for (let round = 0; round < 11; round++) {
      for (let p = 0; p < 4; p++) state.hands[(start + p) % 4].push(deck[i++]);
    }
    state.stock = deck.slice(i);
    while (state.stock.length) {
      const c = state.stock.pop();
      state.discard.push(c);
      if (isWild(c) || isRedThree(c)) { state.frozen = true; continue; }
      if (isBlackThree(c) && rules.turnBlackThree) continue;
      break;
    }
    for (let p = 0; p < 4; p++) {
      const placed = placeRedAndReplace(state, (start + p) % 4);
      if (placed.ended) return state;
    }
    for (let s = 0; s < 4; s++) state.hands[s] = sortCards(state.hands[s]);
    noteTurnStart(state, start);
    return state;
  }

  function drawStock(state, seat) {
    if (state.phase === 'done') return fail('Die Runde ist zu Ende.');
    if (state.phase !== 'draw' || state.turn !== seat) return fail('Du kannst jetzt nicht vom Talon ziehen.');
    if (state.forcedTake) return fail('Der Talon ist leer. Die oberste Ablage passt, du musst den Stapel nehmen.');
    if (!state.stock.length) {
      finish(state, 'stock');
      return ok({ ended: true });
    }
    let card = null;
    while (state.stock.length) {
      const c = state.stock.pop();
      if (isRedThree(c)) {
        state.reds[teamOf(seat)].push(c);
        if (!state.stock.length) {
          finish(state, 'redThree');
          return ok({ ended: true, red: true });
        }
        continue;
      }
      card = c;
      state.hands[seat].push(c);
      break;
    }
    state.hands[seat] = sortCards(state.hands[seat]);
    state.phase = 'meld';
    return ok({ card: card });
  }

  function countingPoints(cards, nonCounting) {
    const skip = nonCounting || [];
    let pts = 0;
    for (const c of cards) if (skip.indexOf(c) === -1 && !isRedThree(c)) pts += cardPoints(c);
    return pts;
  }

  function rememberCanasta(state, before, meld) {
    if (!meld.black && before < 7 && meld.cards.length >= 7) state.completedCanastaThisTurn = true;
  }

  function commitNew(state, team, cards, black) {
    const meld = { rank: black ? '3' : rankOf(cards.find(isNatural) || cards[0]), cards: cards.slice(), black: !!black };
    const before = 0;
    state.melds[team].push(meld);
    rememberCanasta(state, before, meld);
    return meld;
  }

  function commitAdd(state, meld, cards) {
    const before = meld.cards.length;
    meld.cards = meld.cards.concat(cards);
    rememberCanasta(state, before, meld);
  }

  function applyMelds(state, seat, groups, layoffs, opts) {
    opts = opts || {};
    const rules = state.rules;
    const team = teamOf(seat);
    const allowBlack = !!opts.allowBlack;
    const waive = !!opts.waiveMin;
    groups = groups || [];
    layoffs = layoffs || [];
    if (!groups.length && !layoffs.length) return fail('Nichts zu melden.');

    const used = [];
    const addUsed = (cards) => {
      for (const c of cards) {
        if (used.indexOf(c) !== -1) return false;
        used.push(c);
      }
      return true;
    };

    const prepared = [];
    for (const g of groups) {
      const cards = g.slice();
      if (!addUsed(cards)) return fail('Eine Karte liegt doppelt in der Meldung.');
      const v = validateNewMeld(cards, rules, allowBlack);
      if (!v.ok) return v;
      if (!v.black && findMeld(state, team, v.rank)) return fail('Diesen Rang habt ihr schon gemeldet.');
      if (prepared.some((p) => p.rank === v.rank)) return fail('Pro Rang nur eine Meldung.');
      prepared.push({ cards: cards, rank: v.rank, black: v.black });
    }
    const preparedLay = [];
    for (const lay of layoffs) {
      const cards = (lay.cards || lay).slice();
      const rank = lay.rank;
      if (!addUsed(cards)) return fail('Eine Karte liegt doppelt in der Meldung.');
      const meld = findMeld(state, team, rank);
      if (!meld) return fail('An diesen Rang könnt ihr nicht anlegen.');
      if (!extensionValid(meld.cards, cards, rules)) return fail('Das Anlegen sprengt die Meldung.');
      if (rules.noCanastaPickup && opts.blockCanasta && meld.cards.length >= 7) {
        return fail('An einen fertigen Canasta darfst du den Stapel so nicht nehmen.');
      }
      preparedLay.push({ meld: meld, cards: cards, rank: rank });
    }
    if (!pull(state.hands[seat], used)) return fail('Diese Karten sind nicht auf deiner Hand.');
    if (!opts.allowEmpty && state.hands[seat].length === used.length) {
      return fail('So wäre die Hand leer. Dafür musst du ausmachen.');
    }

    if (!state.minMet[team] && !waive) {
      const add = countingPoints(used, state.nonCounting);
      const need = minMeldFor(state.scoresBefore[team], rules);
      if (state.openingPoints + add < need) {
        return fail('Die erste Meldung muss mindestens ' + need + ' Punkte wert sein. Diese Karten zählen ' + (state.openingPoints + add) + '.');
      }
    }

    state.hands[seat] = pull(state.hands[seat], used);
    for (const p of prepared) commitNew(state, team, p.cards, p.black);
    for (const p of preparedLay) commitAdd(state, p.meld, p.cards);
    const addPts = countingPoints(used, state.nonCounting);
    state.openingPoints += addPts;
    if (state.hadMeldAtTurnStart[team] || state.openingPoints >= minMeldFor(state.scoresBefore[team], rules) || state.melds[team].length) {
      if (state.hadMeldAtTurnStart[team] || state.openingPoints >= minMeldFor(state.scoresBefore[team], rules)) state.minMet[team] = true;
    }
    state.meldedThisTurn = true;
    state.playerMelded[seat] = true;
    state.hands[seat] = sortCards(state.hands[seat]);
    return ok({ points: addPts });
  }

  function meld(state, seat, groups) {
    if (state.phase !== 'meld' || state.turn !== seat) return fail('Jetzt ist nicht die Zeit zum Melden.');
    if (state.mustGoOut) return fail('Du hast ausmachen gesagt. Mach die Hand fertig.');
    return applyMelds(state, seat, groups, [], { allowBlack: false });
  }

  function layoff(state, seat, cards, rank) {
    if (state.phase !== 'meld' || state.turn !== seat) return fail('Jetzt kannst du nicht anlegen.');
    if (state.mustGoOut) return fail('Du hast ausmachen gesagt. Mach die Hand fertig.');
    if (!state.minMet[teamOf(seat)] && !state.hadMeldAtTurnStart[teamOf(seat)]) {
      return fail('Zuerst die erste Meldung, dann anlegen.');
    }
    let useRank = rank;
    if (!useRank) {
      const natural = (cards || []).find(isNatural);
      if (!natural) return fail('Sag, an welchen Rang die wilden Karten sollen.');
      useRank = rankOf(natural);
    }
    return applyMelds(state, seat, [], [{ rank: useRank, cards: cards }], { allowBlack: false });
  }

  function takePile(state, seat, handCards, extraGroups, opts) {
    opts = opts || {};
    if (state.phase !== 'draw' || state.turn !== seat) return fail('Den Ablagestapel kannst du jetzt nicht nehmen.');
    const top = topCard(state);
    if (!top) return fail('Es liegt nichts auf der Ablage.');
    if (isWild(top) || isBlackThree(top) || isRedThree(top)) return fail('Die oberste Karte gibt den Stapel nicht frei.');
    if (state.hands[seat].length === 1 && state.discard.length === 1) {
      return fail('Mit einer einzelnen Karte darfst du eine einzelne Ablage nicht nehmen.');
    }
    handCards = (handCards || []).slice();
    extraGroups = extraGroups || [];
    const team = teamOf(seat);
    const frozenFor = isFrozenFor(state, team);
    const rank = rankOf(top);
    const existing = findMeld(state, team, rank);

    if (frozenFor) {
      const naturals = handCards.filter((c) => isNatural(c) && rankOf(c) === rank);
      if (naturals.length < 2 || naturals.length !== handCards.length) {
        return fail('Der Stapel ist eingefroren. Nimm ihn mit zwei natürlichen Karten gleichen Rangs aus der Hand.');
      }
    }

    let primaryGroups = [];
    let primaryLays = [];
    if (!handCards.length) {
      if (frozenFor) return fail('Der Stapel ist eingefroren. Zwei natürliche Karten aus der Hand.');
      if (!existing) return fail('Die oberste Karte passt an keine eurer Meldungen.');
      if (state.rules.noCanastaPickup && existing.cards.length >= 7) {
        return fail('An einen fertigen Canasta darfst du den Stapel so nicht nehmen.');
      }
      primaryLays.push({ rank: rank, cards: [top] });
    } else if (existing && handCards.every((c) => isWild(c) || rankOf(c) === rank)) {
      if (state.rules.noCanastaPickup && existing.cards.length >= 7) {
        return fail('An einen fertigen Canasta darfst du den Stapel so nicht nehmen.');
      }
      if (!extensionValid(existing.cards, [top].concat(handCards), state.rules)) {
        return fail('So passt die oberste Karte nicht an eure Meldung.');
      }
      primaryLays.push({ rank: rank, cards: [top].concat(handCards) });
    } else {
      const group = [top].concat(handCards);
      const v = validateNewMeld(group, state.rules, false);
      if (!v.ok) return v;
      if (existing) return fail('Diesen Rang habt ihr schon gemeldet.');
      primaryGroups.push(group);
    }

    const body = state.discard.slice(0, -1);
    const saved = snap(state);
    state.discard = [];
    state.hands[seat] = state.hands[seat].concat([top]);
    const bodyPlayable = body.filter((c) => !isRedThree(c));
    const applied = applyMelds(state, seat, primaryGroups.concat(extraGroups), primaryLays, {
      allowBlack: false,
      waiveMin: !!opts.waiveMin,
      allowEmpty: bodyPlayable.length > 0 || !!opts.allowEmpty,
      blockCanasta: false,
    });
    if (!applied.ok) { restore(state, saved); return applied; }
    if (!state.minMet[team] && !opts.waiveMin) {
      restore(state, saved);
      return fail('Die erste Meldung reicht noch nicht, und der Rest des Stapels zählt nicht mit.');
    }
    for (const c of body) {
      if (isRedThree(c)) state.reds[team].push(c);
      else {
        state.hands[seat].push(c);
        state.nonCounting.push(c);
      }
    }
    state.topTaken = top;
    state.frozen = false;
    state.phase = 'meld';
    if (!state.hands[seat].length) {
      if (canastaCount(state, team) >= state.rules.canastasToGoOut && !state.forbidGoOut) {
        state.wentOut = { seat: seat, team: team, concealed: concealedOk(state, seat) };
        state.minMet[team] = true;
        finish(state, 'goOut');
        return ok({ cards: body.length + 1, wentOut: true });
      }
      restore(state, saved);
      return fail('Danach wäre die Hand leer, und ausmachen geht so nicht.');
    }
    state.forcedTake = false;
    state.mayEnd = false;
    state.hands[seat] = sortCards(state.hands[seat]);
    return ok({ cards: body.length + 1 });
  }

  function legalDiscardCards(state, seat) {
    if (state.phase !== 'meld' || state.turn !== seat) return [];
    if (state.mustGoOut) return [];
    if (!state.minMet[teamOf(seat)] && state.meldedThisTurn) return [];
    const cards = state.hands[seat].filter((c) => !isRedThree(c));
    if (state.hands[seat].length <= 1) {
      const team = teamOf(seat);
      const can = !state.forbidGoOut && canastaCount(state, team) >= state.rules.canastasToGoOut;
      return can ? cards : [];
    }
    return cards;
  }

  function discard(state, seat, card) {
    if (state.phase !== 'meld' || state.turn !== seat) return fail('Jetzt ist nicht der Abwurf.');
    if (state.mustGoOut && state.hands[seat].length !== 1) return fail('Du musst ausmachen, nicht abwerfen.');
    if (state.hands[seat].indexOf(card) === -1) return fail('Die Karte ist nicht auf deiner Hand.');
    if (isRedThree(card)) return fail('Eine rote Drei wird ausgelegt, nicht abgeworfen.');
    const team = teamOf(seat);
    if (!state.minMet[team] && state.meldedThisTurn) {
      return fail('Die erste Meldung ist noch zu klein.');
    }
    const last = state.hands[seat].length === 1;
    if (last) {
      if (state.forbidGoOut) return fail('Dein Partner hat Nein gesagt. Du darfst nicht ausmachen.');
      if (canastaCount(state, team) < state.rules.canastasToGoOut) {
        return fail('Ohne Canasta darfst du nicht alle Karten loswerden.');
      }
    }
    state.hands[seat] = state.hands[seat].filter((c) => c !== card);
    state.discard.push(card);
    state.discardLog.push({ seat: seat, card: card });
    if (isWild(card)) state.frozen = true;
    if (last) {
      const concealed = concealedOk(state, seat);
      state.wentOut = { seat: seat, team: team, concealed: concealed };
      finish(state, 'goOut');
      return ok({ wentOut: true, concealed: concealed });
    }
    noteTurnStart(state, (seat + 1) % 4);
    return ok();
  }

  function concealedOk(state, seat) {
    if (state.playerMeldedAtTurnStart[seat]) return false;
    if (!state.completedCanastaThisTurn) return false;
    return true;
  }

  function goOut(state, seat, plan) {
    if (state.phase === 'done') return fail('Die Runde ist zu Ende.');
    if (state.turn !== seat) return fail('Du bist nicht dran.');
    if (state.phase !== 'meld' && state.phase !== 'draw') return fail('Jetzt kannst du nicht ausmachen.');
    if (state.forbidGoOut) return fail('Dein Partner hat Nein gesagt.');
    if (!plan) return fail('So geht das Ausmachen nicht.');
    const noMelds = !(plan.groups || []).length && !(plan.layoffs || []).length;
    if (noMelds) {
      if (state.phase !== 'meld' || !plan.discard) return fail('So geht das Ausmachen nicht.');
      const dumped = discard(state, seat, plan.discard);
      if (!dumped.ok) return dumped;
      if (!dumped.wentOut) return fail('Damit ist die Hand noch nicht leer.');
      return dumped;
    }
    const saved = snap(state);
    if (state.phase === 'draw') {
      if (!plan.take) { return fail('Zieh zuerst eine Karte oder nimm den Stapel.'); }
      const taken = takePile(state, seat, plan.take.handCards || [], plan.take.extraGroups || [], { waiveMin: true });
      if (!taken.ok) return taken;
    }
    const applied = applyMelds(state, seat, plan.groups || [], plan.layoffs || [], { allowBlack: true, waiveMin: true, allowEmpty: true });
    if (!applied.ok) { restore(state, saved); return applied; }
    if (plan.discard) {
      if (state.hands[seat].indexOf(plan.discard) === -1 || isRedThree(plan.discard)) {
        restore(state, saved);
        return fail('Diese Karte kannst du beim Ausmachen nicht abwerfen.');
      }
      state.hands[seat] = state.hands[seat].filter((c) => c !== plan.discard);
      state.discard.push(plan.discard);
      state.discardLog.push({ seat: seat, card: plan.discard });
      if (isWild(plan.discard)) state.frozen = true;
    }
    if (state.hands[seat].length) {
      restore(state, saved);
      return fail('Zum Ausmachen muss die Hand leer werden.');
    }
    const team = teamOf(seat);
    if (canastaCount(state, team) < state.rules.canastasToGoOut) {
      restore(state, saved);
      return fail(state.rules.canastasToGoOut === 2 ? 'Zum Ausmachen braucht ihr zwei Canastas.' : 'Zum Ausmachen braucht ihr einen Canasta.');
    }
    if (!state.hadMeldAtTurnStart[team]) {
      const need = minMeldFor(state.scoresBefore[team], state.rules);
      const met = state.openingPoints >= need;
      const exception = state.completedCanastaThisTurn;
      if (!met && !exception) {
        restore(state, saved);
        return fail('Die erste Meldung muss mindestens ' + need + ' Punkte wert sein.');
      }
    }
    const concealed = concealedOk(state, seat);
    state.wentOut = { seat: seat, team: team, concealed: concealed };
    state.minMet[team] = true;
    finish(state, 'goOut');
    return ok({ concealed: concealed });
  }

  function askPartner(state, seat) {
    if (!state.rules.askPartner) return fail('In dieser Runde fragt ihr nicht vor dem Ausmachen.');
    if (state.phase !== 'meld' || state.turn !== seat) return fail('Fragen darfst du direkt nach dem Ziehen.');
    if (state.meldedThisTurn) return fail('Fragen geht nur, bevor du meldest.');
    if (state.asked) return fail('Du hast in diesem Zug schon gefragt.');
    state.asked = true;
    state.asker = seat;
    state.phase = 'ask';
    return ok({ partner: partnerSeat(seat) });
  }

  function answerPartner(state, seat, yes) {
    if (state.phase !== 'ask') return fail('Niemand hat gefragt.');
    if (seat !== partnerSeat(state.asker)) return fail('Nur der Partner antwortet.');
    state.mustGoOut = !!yes;
    state.forbidGoOut = !yes;
    state.phase = 'meld';
    return ok({ yes: !!yes });
  }

  function endHand(state, seat) {
    if (state.phase !== 'draw' || state.turn !== seat) return fail('Jetzt endet die Runde nicht.');
    if (state.stock.length) return fail('Im Talon liegen noch Karten.');
    if (state.forcedTake) return fail('Die oberste Ablage passt. Du musst den Stapel nehmen.');
    finish(state, 'stock');
    return ok({ ended: true });
  }

  function sweepReds(state) {
    for (let seat = 0; seat < 4; seat++) {
      const keep = [];
      for (const c of state.hands[seat]) {
        if (isRedThree(c)) state.reds[teamOf(seat)].push(c);
        else keep.push(c);
      }
      state.hands[seat] = keep;
    }
  }

  function scoreState(state) {
    const rules = state.rules;
    const teams = [0, 1].map((team) => {
      let cards = 0;
      let canastaPts = 0;
      let pure = 0;
      let mixed = 0;
      let canastas = 0;
      for (const m of state.melds[team]) {
        cards += sumPoints(m.cards);
        if (!m.black && m.cards.length >= 7) {
          canastas += 1;
          if (m.cards.some(isWild)) { canastaPts += 300; mixed += 1; }
          else { canastaPts += 500; pure += 1; }
        }
      }
      let hand = 0;
      for (const seat of seatsOf(team)) {
        for (const c of state.hands[seat]) if (!isRedThree(c)) hand += cardPoints(c);
      }
      const positive = rules.redThrees === 'vienna' ? canastas > 0 : state.melds[team].length > 0;
      const red = redThreePoints(state.reds[team].length, positive);
      let goingOut = 0;
      if (state.wentOut && state.wentOut.team === team) {
        goingOut = state.wentOut.concealed ? rules.concealedBonus : 100;
      }
      return {
        cards: cards, canasta: canastaPts, pure: pure, mixed: mixed, canastas: canastas,
        hand: hand, red: red, goingOut: goingOut, reds: state.reds[team].length,
        total: cards + canastaPts - hand + red + goingOut,
      };
    });
    return {
      teams: teams,
      wentOut: state.wentOut,
      endReason: state.endReason,
      winner: teams[0].total === teams[1].total ? null : (teams[0].total > teams[1].total ? 0 : 1),
    };
  }

  function finish(state, reason) {
    if (state.phase === 'done') return state.result;
    sweepReds(state);
    state.endReason = reason;
    state.result = scoreState(state);
    state.phase = 'done';
    return state.result;
  }

  function tryPlace(cards, existing, rules) {
    if (!cards.length) return null;
    const wilds = cards.filter(isWild);
    const black = cards.filter(isBlackThree);
    const naturals = cards.filter(isNatural);
    if (cards.some(isRedThree)) return null;
    if (black.length && (black.length < 3 || black.length > 4)) return null;
    const byRank = {};
    for (const c of naturals) {
      const r = rankOf(c);
      if (!byRank[r]) byRank[r] = [];
      byRank[r].push(c);
    }
    const groups = [];
    const layoffs = [];
    for (const rank of Object.keys(byRank)) {
      const list = byRank[rank];
      if (existing[rank]) layoffs.push({ rank: rank, cards: list.slice() });
      else if (list.length >= 2) groups.push({ rank: rank, cards: list.slice(), wilds: [] });
      else return null;
    }
    if (black.length) groups.push({ rank: '3', cards: black.slice(), wilds: [], black: true });
    let pool = wilds.slice();
    const room = (g) => {
      const n = g.cards.length;
      const w = g.wilds.length;
      let r = 3 - w;
      if (rules.wildMajority) r = Math.min(r, n - w);
      return Math.max(0, r);
    };
    for (const g of groups) {
      if (g.black) continue;
      if (g.cards.length < 3) {
        if (!pool.length || room(g) < 1) return null;
        g.wilds.push(pool.pop());
      }
      if (g.cards.length + g.wilds.length < 3) return null;
    }
    const oldExtra = {};
    while (pool.length) {
      let best = null;
      let bestScore = -1;
      for (const g of groups) {
        if (g.black || room(g) <= 0) continue;
        const size = g.cards.length + g.wilds.length;
        const score = size < 7 ? 100 - (7 - size) : (g.wilds.length ? 8 : 1);
        if (score > bestScore) { bestScore = score; best = { kind: 'new', g: g }; }
      }
      for (const rank of Object.keys(existing)) {
        const m = existing[rank];
        const added = oldExtra[rank] || [];
        const w = m.cards.filter(isWild).length + added.filter(isWild).length;
        const n = m.cards.filter(isNatural).length + added.filter(isNatural).length;
        let r = 3 - w;
        if (rules.wildMajority) r = Math.min(r, n - w);
        if (r <= 0) continue;
        const size = m.cards.length + added.length;
        const pure = m.cards.filter(isWild).length + added.filter(isWild).length === 0;
        const score = size < 7 ? 90 - (7 - size) : (pure ? 0 : 4);
        if (score > bestScore) { bestScore = score; best = { kind: 'old', rank: rank }; }
      }
      if (!best) return null;
      const wcard = pool.pop();
      if (best.kind === 'new') best.g.wilds.push(wcard);
      else {
        if (!oldExtra[best.rank]) oldExtra[best.rank] = [];
        oldExtra[best.rank].push(wcard);
        layoffs.push({ rank: best.rank, cards: [wcard] });
      }
    }
    const outGroups = groups.map((g) => (g.black ? g.cards.slice() : g.cards.concat(g.wilds)));
    const map = {};
    for (const l of layoffs) {
      if (!map[l.rank]) map[l.rank] = [];
      map[l.rank] = map[l.rank].concat(l.cards);
    }
    return { groups: outGroups, layoffs: Object.keys(map).map((rank) => ({ rank: rank, cards: map[rank] })) };
  }

  function planGoOut(state, seat) {
    if (state.forbidGoOut) return null;
    if (state.phase !== 'meld' || state.turn !== seat) return null;
    const hand = state.hands[seat];
    const existing = {};
    for (const m of state.melds[teamOf(seat)]) existing[m.rank] = m;
    const options = [null].concat(hand);
    let best = null;
    for (const discardCard of options) {
      const rest = discardCard ? hand.filter((c) => c !== discardCard) : hand.slice();
      let plan = null;
      if (!rest.length && discardCard) {
        const dumped = discard(snap(state), seat, discardCard);
        if (dumped.ok && dumped.wentOut) plan = { groups: [], layoffs: [], discard: discardCard };
      }
      const placed = plan ? null : tryPlace(rest, existing, state.rules);
      if (!plan) {
        if (!placed) continue;
        plan = { groups: placed.groups, layoffs: placed.layoffs, discard: discardCard };
      }
      const copy = snap(state);
      const res = goOut(copy, seat, plan);
      if (!res.ok) continue;
      const score = (discardCard ? 0 : 5) + (res.concealed ? 3 : 0) + copy.result.teams[teamOf(seat)].canasta / 100;
      if (!best || score > best.score) best = { plan: plan, score: score, concealed: res.concealed };
    }
    return best ? best.plan : null;
  }

  function parseTake(state, seat, selected) {
    const top = topCard(state);
    if (!top || !isNatural(top)) return fail('Die oberste Karte kannst du nicht melden.');
    const rank = rankOf(top);
    const frozenFor = isFrozenFor(state, teamOf(seat));
    const handCards = [];
    const rest = [];
    for (const c of selected || []) {
      if (isWild(c)) {
        if (frozenFor) return fail('Der Stapel ist eingefroren. Nimm ihn mit zwei natürlichen Karten aus der Hand.');
        handCards.push(c);
      } else if (isNatural(c) && rankOf(c) === rank) handCards.push(c);
      else if (isNatural(c)) rest.push(c);
      else return fail('Diese Karte gehört nicht in die Meldung.');
    }
    const by = {};
    for (const c of rest) {
      const r = rankOf(c);
      if (!by[r]) by[r] = [];
      by[r].push(c);
    }
    return ok({ handCards: handCards, extraGroups: Object.keys(by).map((r) => by[r]) });
  }

  function parseMeld(selected) {
    const by = {};
    const wilds = [];
    for (const c of selected || []) {
      if (isWild(c)) wilds.push(c);
      else if (isNatural(c)) {
        const r = rankOf(c);
        if (!by[r]) by[r] = [];
        by[r].push(c);
      } else return fail('Diese Karte kannst du so nicht melden.');
    }
    const ranks = Object.keys(by);
    if (!ranks.length) return fail('Eine Meldung braucht natürliche Karten.');
    if (wilds.length && ranks.length !== 1) return fail('Wilde Karten bitte nur zusammen mit einem Rang legen.');
    return ok({ groups: ranks.map((r) => by[r].concat(r === ranks[0] ? wilds : [])) });
  }

  function previewTake(state, seat, selected) {
    const top = topCard(state);
    if (!top || !isNatural(top)) return fail('Die oberste Karte kannst du nicht melden.');
    const rank = rankOf(top);
    const handCards = [];
    const rest = [];
    for (const c of selected || []) {
      if (isWild(c) || (isNatural(c) && rankOf(c) === rank)) handCards.push(c);
      else rest.push(c);
    }
    const by = {};
    const wilds = [];
    for (const c of rest) {
      if (isWild(c)) wilds.push(c);
      else if (isNatural(c)) {
        const r = rankOf(c);
        if (!by[r]) by[r] = [];
        by[r].push(c);
      } else return fail('Diese Karte gehört nicht in die Meldung.');
    }
    if (wilds.length) return fail('Wilde Karten legst du direkt zu der obersten Karte oder zu einem einzelnen Rang.');
    const extra = Object.keys(by).map((r) => by[r]);
    return takePile(snap(state), seat, handCards, extra, {});
  }

  function previewMeld(state, seat, selected) {
    const by = {};
    const wilds = [];
    for (const c of selected || []) {
      if (isWild(c)) wilds.push(c);
      else if (isNatural(c)) {
        const r = rankOf(c);
        if (!by[r]) by[r] = [];
        by[r].push(c);
      } else return fail('Diese Karte kannst du so nicht melden.');
    }
    const ranks = Object.keys(by);
    if (!ranks.length) return fail('Eine Meldung braucht natürliche Karten.');
    if (wilds.length && ranks.length !== 1) return fail('Wilde Karten bitte nur zusammen mit einem Rang.');
    const groups = ranks.map((r) => by[r].concat(r === ranks[0] ? wilds : []));
    return meld(snap(state), seat, groups);
  }

  function viewFor(state, seat) {
    return {
      seat: seat,
      team: teamOf(seat),
      partner: partnerSeat(seat),
      hand: state.hands[seat].slice(),
      handCounts: state.hands.map((h) => h.length),
      stockCount: state.stock.length,
      discard: state.discard.slice(),
      frozen: state.frozen,
      frozenForUs: isFrozenFor(state, teamOf(seat)),
      melds: state.melds.map((list) => list.map((m) => ({ rank: m.rank, cards: m.cards.slice(), black: !!m.black }))),
      reds: state.reds.map((list) => list.slice()),
      phase: state.phase,
      turn: state.turn,
      scoresBefore: state.scoresBefore.slice(),
      rules: Object.assign({}, state.rules),
      minMet: state.minMet.slice(),
      hadMeldAtTurnStart: state.hadMeldAtTurnStart.slice(),
      meldedThisTurn: state.meldedThisTurn,
      asked: state.asked,
      asker: state.asker,
      mustGoOut: state.mustGoOut,
      forbidGoOut: state.forbidGoOut,
      forcedTake: state.forcedTake,
      mayEnd: state.mayEnd,
      wentOut: state.wentOut,
      result: state.result,
      endReason: state.endReason,
      dealer: state.dealer,
      discardLog: state.discardLog.slice(),
      openingPoints: state.openingPoints,
      need: minMeldFor(state.scoresBefore[teamOf(seat)], state.rules),
    };
  }

  function matchWinner(scores, target) {
    if (!target) return null;
    if (scores[0] < target && scores[1] < target) return null;
    if (scores[0] === scores[1]) return null;
    return scores[0] > scores[1] ? 0 : 1;
  }

  function publicSummary(state, scores) {
    const us = scores ? scores[0] : 0;
    const them = scores ? scores[1] : 0;
    const top = topCard(state);
    return {
      phase: 'play',
      game: ('Canasta. Wir ' + us + ', Gegner ' + them).slice(0, 80),
      scores: null,
      stock: state ? state.stock.length : 0,
      frozen: state ? state.frozen : false,
      top: top ? cardName(top) : '',
    };
  }

  return {
    SUITS, RANKS, MELD_RANKS, SUIT_NAMES, SUIT_SYMBOLS, RANK_NAMES, RANK_SHORT, RANK_ORDER, DEFAULT_RULES,
    normalizeRules, normalizeTarget, createDeck, shuffle, seededRng, cryptoRng,
    parseCard, suitOf, rankOf, isJoker, isWild, isRedThree, isBlackThree, isNatural,
    cardPoints, sumPoints, cardName, cardShort, sortCards,
    minMeldFor, redThreePoints, canastaBonus, validateNewMeld,
    teamOf, partnerSeat, seatsOf, blankState, newGame, noteTurnStart,
    drawStock, takePile, meld, layoff, discard, goOut, askPartner, answerPartner, endHand,
    planGoOut, previewTake, previewMeld, parseTake, parseMeld, legalDiscardCards,
    topCard, findMeld, canastaCount, isFrozenFor, mustTake, scoreState, finish, viewFor,
    matchWinner, publicSummary, snap,
  };
});
