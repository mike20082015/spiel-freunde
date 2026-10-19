/*
 * Spiel-Freunde Doppelkopf: Regel-Engine.
 * Läuft ohne Abhängigkeiten im Browser (window.DoppelkopfEngine) und in Node (require).
 *
 * Voreinstellung: DDV-Turnierspielregeln, Stand 21.02.2026, mit einer Kneipen-Abweichung:
 * die zweite Herz-Zehn (Dulle) sticht die erste. Abschaltbar.
 * Weitere Hausregeln (ohne Neunen, Schweinchen, Armut, Pflichtsolo) sind aus, außer wo genannt.
 *
 * Karten: Farbe + Rang + Kopie, z. B. "H10.0" und "H10.1" (zwei Herz-Zehner).
 * Farben: C Kreuz, S Pik, H Herz, D Karo. Ränge: A 10 K Q J 9.
 * Sitze: 0 unten, dann links herum 1, 2, 3. Vorhand ist links vom Geber.
 * Punkte, keine Einsätze.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DoppelkopfEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['C', 'S', 'H', 'D'];
  const RANKS = ['9', 'J', 'Q', 'K', '10', 'A'];
  const SUIT_NAMES = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
  const SUIT_SYMBOLS = { C: '♣', S: '♠', H: '♥', D: '♦' };
  const RANK_NAMES = { A: 'Ass', '10': 'Zehn', K: 'König', Q: 'Dame', J: 'Bube', '9': 'Neun' };
  const RANK_SHORT = { A: 'A', '10': '10', K: 'K', Q: 'D', J: 'B', '9': '9' };
  const EYES = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0 };
  const QUEENS = ['CQ', 'SQ', 'HQ', 'DQ'];
  const JACKS = ['CJ', 'SJ', 'HJ', 'DJ'];
  const ABSAGE = ['keine90', 'keine60', 'keine30', 'schwarz'];

  const DEFAULT_RULES = {
    neunen: true,
    zweiteDulle: true,
    schweinchen: false,
    armut: false,
    hochzeit: true,
    damen: true,
    buben: true,
    farben: true,
    fleischlos: true,
    sonderpunkte: true,
    pflichtsolo: false,
  };

  const suitOf = (c) => c.charAt(0);
  const typeOf = (c) => c.slice(0, c.indexOf('.'));
  const rankOf = (c) => typeOf(c).slice(1);
  const eyesOf = (c) => EYES[rankOf(c)] || 0;
  const sumEyes = (cards) => (cards || []).reduce((s, c) => s + eyesOf(c), 0);
  const nextSeat = (seat) => (seat + 1) % 4;
  const others = (seat) => [0, 1, 2, 3].filter((s) => s !== seat);

  function cardName(c) {
    return SUIT_NAMES[suitOf(c)] + '-' + RANK_NAMES[rankOf(c)];
  }
  function cardShort(c) {
    return SUIT_SYMBOLS[suitOf(c)] + RANK_SHORT[rankOf(c)];
  }
  function orderFrom(dealer) {
    return [1, 2, 3, 4].map((i) => (dealer + i) % 4);
  }
  function fail(reason) { return { ok: false, reason: reason }; }
  function ok(extra) { return Object.assign({ ok: true }, extra || {}); }

  function createDeck(withNines) {
    const ranks = withNines === false ? ['A', '10', 'K', 'Q', 'J'] : ['A', '10', 'K', 'Q', 'J', '9'];
    const deck = [];
    SUITS.forEach((s) => ranks.forEach((r) => {
      deck.push(s + r + '.0');
      deck.push(s + r + '.1');
    }));
    return deck;
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
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function clampInt(n, min, max, fallback) {
    const x = Math.round(+n);
    if (!isFinite(x)) return fallback;
    return Math.max(min, Math.min(max, x));
  }
  function normalizeRules(raw) {
    const r = Object.assign({}, DEFAULT_RULES, raw || {});
    r.neunen = r.neunen !== false;
    r.zweiteDulle = r.zweiteDulle !== false;
    r.schweinchen = !!r.schweinchen;
    r.armut = !!r.armut;
    r.hochzeit = r.hochzeit !== false;
    r.damen = r.damen !== false;
    r.buben = r.buben !== false;
    r.farben = r.farben !== false;
    r.fleischlos = r.fleischlos !== false;
    r.sonderpunkte = r.sonderpunkte !== false;
    r.pflichtsolo = !!r.pflichtsolo;
    if (r.pflichtsolo && !r.damen && !r.buben && !r.farben && !r.fleischlos) r.farben = true;
    return r;
  }
  function normalizeTarget(target, custom) {
    if (target === '10' || target === 10) return 10;
    if (target === '20' || target === 20 || target == null) return 20;
    if (target === '40' || target === 40) return 40;
    if (target === 'custom') return clampInt(custom, 4, 400, 20);
    return clampInt(target, 4, 400, 20);
  }
  function handSize(rules) { return rules.neunen === false ? 10 : 12; }
  function trickCount(rules) { return handSize(rules); }

  function emptyAnn() {
    return {
      re: false,
      kontra: false,
      by: { re: [], kontra: [] },
      absage: {
        re: { keine90: false, keine60: false, keine30: false, schwarz: false },
        kontra: { keine90: false, keine60: false, keine30: false, schwarz: false },
      },
    };
  }
  function blankHands() { return [[], [], [], []]; }

  function baseShape() {
    return { type: 'normal', solo: null, suit: 'D', re: [], kontra: [], clarifyShift: 0, clarified: true };
  }
  function dulleLives(game) {
    if (!game || game.solo === 'damen' || game.solo === 'buben' || game.solo === 'fleischlos') return false;
    return true;
  }
  function colorRun(suit, withNines, heartAsFailBesideDulle) {
    let ranks = ['A', '10', 'K', '9'];
    if (suit === 'H' && heartAsFailBesideDulle) ranks = ['A', 'K', '9'];
    if (!withNines) ranks = ranks.filter((r) => r !== '9');
    return ranks.map((r) => suit + r);
  }
  function trumpTypes(game, rules, pigsOn) {
    const nine = !rules || rules.neunen !== false;
    const g = game || baseShape();
    if (g.solo === 'fleischlos') return [];
    if (g.solo === 'damen') return QUEENS.slice();
    if (g.solo === 'buben') return JACKS.slice();
    let list;
    if (g.solo === 'farbe' && g.suit && g.suit !== 'D') {
      list = ['H10'].concat(QUEENS, JACKS, colorRun(g.suit, nine, true));
    } else {
      list = ['H10'].concat(QUEENS, JACKS, colorRun('D', nine, false));
    }
    if (pigsOn && list.indexOf('DA') >= 0) list = ['DA'].concat(list.filter((t) => t !== 'DA'));
    return list;
  }
  function isTrump(card, game, rules, pigsOn) {
    return trumpTypes(game, rules, pigsOn).indexOf(typeOf(card)) >= 0;
  }
  function failRanks(game, suit, rules) {
    const nine = !rules || rules.neunen !== false;
    const g = game || baseShape();
    let ranks;
    if (!g || g.solo === 'fleischlos') ranks = ['A', '10', 'K', 'Q', 'J', '9'];
    else if (g.solo === 'damen') ranks = ['A', '10', 'K', 'J', '9'];
    else if (g.solo === 'buben') ranks = ['A', '10', 'K', 'Q', '9'];
    else if (suit === 'H' && dulleLives(g)) ranks = ['A', 'K', '9'];
    else ranks = ['A', '10', 'K', '9'];
    if (!nine) ranks = ranks.filter((r) => r !== '9');
    return ranks;
  }
  function rankValue(card, game, rules, pigsOn) {
    const t = typeOf(card);
    if (isTrump(card, game, rules, pigsOn)) {
      const idx = trumpTypes(game, rules, pigsOn).indexOf(t);
      return 500 - idx;
    }
    const order = failRanks(game, suitOf(card), rules);
    const idx = order.indexOf(rankOf(card));
    return 80 - (idx < 0 ? 40 : idx);
  }
  function effSuit(card, game, rules, pigsOn) {
    return isTrump(card, game, rules, pigsOn) ? 'T' : suitOf(card);
  }
  function secondSpecial(a, b, game, rules, pigsOn) {
    if (!rules || rules.zweiteDulle === false) return false;
    if (typeOf(a) !== typeOf(b)) return false;
    if (!isTrump(a, game, rules, pigsOn)) return false;
    if (typeOf(a) === 'H10') return true;
    if (pigsOn && typeOf(a) === 'DA') return true;
    return false;
  }
  function relevant(card, led, game, rules, pigsOn) {
    if (effSuit(card, game, rules, pigsOn) === led) return true;
    return led !== 'T' && isTrump(card, game, rules, pigsOn);
  }
  function laterWins(a, b, led, game, rules, pigsOn) {
    const aOk = relevant(a, led, game, rules, pigsOn);
    const bOk = relevant(b, led, game, rules, pigsOn);
    if (!aOk) return false;
    if (!bOk) return true;
    const aT = isTrump(a, game, rules, pigsOn);
    const bT = isTrump(b, game, rules, pigsOn);
    if (aT !== bT) return aT;
    const ra = rankValue(a, game, rules, pigsOn);
    const rb = rankValue(b, game, rules, pigsOn);
    if (ra !== rb) return ra > rb;
    return secondSpecial(a, b, game, rules, pigsOn);
  }
  function trickWinnerIndex(trick, game, rules, pigsOn) {
    const led = effSuit(trick[0].card, game, rules, pigsOn);
    let best = 0;
    for (let i = 1; i < trick.length; i++) {
      if (laterWins(trick[i].card, trick[best].card, led, game, rules, pigsOn)) best = i;
    }
    return best;
  }
  function trickWinner(trick, game, rules, pigsOn) {
    return trick[trickWinnerIndex(trick, game, rules, pigsOn)].seat;
  }

  function countType(hand, type) {
    return (hand || []).filter((c) => typeOf(c) === type).length;
  }
  function queenHolders(hands) {
    const seats = [];
    for (let s = 0; s < 4; s++) if (countType(hands[s], 'CQ') > 0) seats.push(s);
    return seats;
  }
  function findPig(hands) {
    for (let s = 0; s < 4; s++) if (countType(hands[s], 'DA') >= 2) return s;
    return null;
  }
  function partyOf(state, seat) {
    const g = state.game;
    if (!g) return null;
    if (g.re && g.re.indexOf(seat) >= 0) return 're';
    if (g.kontra && g.kontra.indexOf(seat) >= 0) return 'kontra';
    return null;
  }
  function solosOn(rules) {
    return !!(rules.damen || rules.buben || rules.farben || rules.fleischlos);
  }

  function fresh(match, rules, dealer) {
    return {
      rules: rules,
      dealer: dealer,
      hands: blankHands(),
      phase: 'reserve',
      order: orderFrom(dealer),
      turn: orderFrom(dealer)[0],
      bids: [null, null, null, null],
      trick: [],
      trickLog: [],
      tricksWon: blankHands(),
      trickNo: 0,
      lastTrick: null,
      leader: orderFrom(dealer)[0],
      game: null,
      ann: emptyAnn(),
      pigSeat: null,
      pigsOn: false,
      result: null,
      matchPflicht: (match && match.pflicht ? match.pflicht.slice() : [false, false, false, false]),
      roundGames: match && match.roundGames ? match.roundGames : 0,
      forcedSolo: false,
      vorfuehrung: false,
      armut: null,
      events: [],
    };
  }

  function newMatch(opts) {
    opts = opts || {};
    const rules = normalizeRules(opts.rules);
    return {
      scores: [0, 0, 0, 0],
      dealer: opts.dealer == null ? 3 : opts.dealer,
      handNo: 0,
      rows: [],
      winner: null,
      target: normalizeTarget(opts.target, opts.targetCustom),
      rules: rules,
      pflicht: [false, false, false, false],
      roundGames: 0,
    };
  }

  function dealHand(match, rng) {
    const rules = normalizeRules(match.rules);
    match.rules = rules;
    const deck = shuffle(createDeck(rules.neunen), rng || Math.random);
    const n = handSize(rules);
    const state = fresh(match, rules, match.dealer);
    for (let s = 0; s < 4; s++) state.hands[s] = deck.slice(s * n, (s + 1) * n);
    state.pigSeat = rules.schweinchen ? findPig(state.hands) : null;
    if (rules.pflichtsolo && solosOn(rules)) {
      const missing = state.order.filter((s) => !state.matchPflicht[s]);
      const left = 24 - state.roundGames;
      if (missing.length && left <= missing.length) {
        state.phase = 'solo';
        state.turn = missing[0];
        state.forcedSolo = true;
        state.vorfuehrung = true;
        state.events.push({ type: 'vorfuehrung', seat: missing[0] });
        return state;
      }
    }
    state.phase = 'reserve';
    state.turn = state.order[0];
    return state;
  }

  function normalParties(hands) {
    const re = queenHolders(hands);
    return { re: re, kontra: [0, 1, 2, 3].filter((s) => re.indexOf(s) < 0) };
  }

  function shapeSolo(seat, choice, flags) {
    flags = flags || {};
    let solo = choice.solo;
    let suit = choice.suit || null;
    if (solo === 'farbe' && suit === 'D') solo = 'karo';
    if (solo === 'karo') suit = 'D';
    return {
      type: 'solo',
      solo: solo,
      suit: suit,
      declarer: seat,
      partner: null,
      re: [seat],
      kontra: others(seat),
      silent: !!flags.silent,
      pflicht: !!flags.pflicht,
      vorfuehrung: !!flags.vorfuehrung,
      clarified: true,
      clarifyShift: 0,
    };
  }

  function soloLegal(rules, choice) {
    if (!choice) return false;
    if (choice.solo === 'damen') return !!rules.damen;
    if (choice.solo === 'buben') return !!rules.buben;
    if (choice.solo === 'fleischlos') return !!rules.fleischlos;
    if (choice.solo === 'karo') return !!rules.farben;
    if (choice.solo === 'farbe') return !!rules.farben && (choice.suit === 'C' || choice.suit === 'S' || choice.suit === 'H' || choice.suit === 'D');
    return false;
  }

  function beginPlay(state) {
    const g = state.game;
    const leader = g && g.type === 'solo' && g.pflicht ? g.declarer : nextSeat(state.dealer);
    state.leader = leader;
    state.turn = leader;
    state.trick = [];
    state.phase = 'play';
    state.events.push({ type: 'spiel', label: describeGame(g) });
    return ok();
  }

  function finishRedeal(state) {
    state.phase = 'done';
    state.result = {
      kind: 'redeal',
      label: 'Neu geben',
      note: 'Niemand nimmt die Armut mit. Es wird neu gegeben.',
      deltas: [0, 0, 0, 0],
      winners: [],
      reWon: false,
      kontraWon: false,
      completed: false,
      sameDealer: false,
      pflichtSeat: null,
      wert: 0,
      reEyes: 0,
      kontraEyes: 0,
    };
    return ok();
  }

  function startNormal(state) {
    const parties = normalParties(state.hands);
    state.game = {
      type: 'normal', solo: null, suit: 'D', declarer: null, partner: null,
      re: parties.re, kontra: parties.kontra, silent: false, pflicht: false, vorfuehrung: false,
      clarified: true, clarifyShift: 0,
    };
    return beginPlay(state);
  }

  function startSilent(state, seat) {
    state.game = shapeSolo(seat, { solo: 'karo', suit: 'D' }, { silent: true });
    return beginPlay(state);
  }

  function startHochzeit(state, seat) {
    state.game = {
      type: 'hochzeit', solo: null, suit: 'D', declarer: seat, partner: null,
      re: [seat], kontra: [], silent: false, pflicht: false, vorfuehrung: false,
      clarified: false, clarifyShift: 0,
    };
    return beginPlay(state);
  }

  function startArmutOffer(state, seat) {
    state.game = null;
    state.armut = { poor: seat, taker: null, given: null, passes: 0 };
    state.phase = 'armutTake';
    state.turn = nextSeat(seat);
    state.events.push({ type: 'armut', seat: seat });
    return ok();
  }

  function resolveBids(state) {
    const bids = state.bids;
    const solos = [];
    let armutSeat = null;
    let hochzeitSeat = null;
    for (let s = 0; s < 4; s++) {
      const b = bids[s];
      if (!b || b.kind === 'gesund') continue;
      if (b.kind === 'solo') solos.push(b);
      else if (b.kind === 'armut') armutSeat = s;
      else if (b.kind === 'hochzeit') hochzeitSeat = s;
    }
    const byOrder = (list) => list.slice().sort((a, b) => state.order.indexOf(a.seat) - state.order.indexOf(b.seat));
    const pflicht = byOrder(solos.filter((b) => b.pflicht));
    const lust = byOrder(solos.filter((b) => !b.pflicht));
    if (pflicht.length) {
      const b = pflicht[0];
      state.game = shapeSolo(b.seat, b, { pflicht: true, vorfuehrung: false });
      return beginPlay(state);
    }
    if (lust.length) {
      const b = lust[0];
      state.game = shapeSolo(b.seat, b, { pflicht: false });
      return beginPlay(state);
    }
    if (armutSeat != null) return startArmutOffer(state, armutSeat);
    if (hochzeitSeat != null) return startHochzeit(state, hochzeitSeat);
    if (state.rules.hochzeit) {
      for (let s = 0; s < 4; s++) {
        if (countType(state.hands[s], 'CQ') >= 2) return startSilent(state, s);
      }
    }
    return startNormal(state);
  }

  function actReserve(state, seat, choice) {
    if (!state || state.phase !== 'reserve') return fail('Jetzt wird nicht vorbehalten.');
    if (state.turn !== seat) return fail('Du bist nicht dran.');
    choice = choice || { kind: 'gesund' };
    const rules = state.rules;
    const hand = state.hands[seat];
    if (choice.kind === 'gesund') {
      state.bids[seat] = { kind: 'gesund', seat: seat };
    } else if (choice.kind === 'hochzeit') {
      if (!rules.hochzeit) return fail('Hochzeit ist aus.');
      if (countType(hand, 'CQ') < 2) return fail('Hochzeit braucht beide Kreuz-Damen.');
      state.bids[seat] = { kind: 'hochzeit', seat: seat };
    } else if (choice.kind === 'armut') {
      if (!rules.armut) return fail('Armut ist aus.');
      const tr = hand.filter((c) => isTrump(c, baseShape(), rules, false)).length;
      if (tr > 3) return fail('Armut geht nur mit höchstens drei Trümpfen.');
      state.bids[seat] = { kind: 'armut', seat: seat };
    } else if (choice.kind === 'solo') {
      if (!soloLegal(rules, choice)) return fail('Dieses Solo ist nicht verabredet.');
      let pflicht = !!choice.pflicht && !!rules.pflichtsolo;
      if (rules.pflichtsolo && !state.matchPflicht[seat] && !pflicht) return fail('Erst das Pflichtsolo.');
      if (pflicht && state.matchPflicht[seat]) return fail('Das Pflichtsolo ist schon gespielt.');
      state.bids[seat] = {
        kind: 'solo', seat: seat, solo: choice.solo, suit: choice.suit || null, pflicht: pflicht,
      };
    } else return fail('Unbekannter Vorbehalt.');
    const idx = state.order.indexOf(seat);
    if (idx >= 3) return resolveBids(state);
    state.turn = state.order[idx + 1];
    return ok();
  }

  function actSolo(state, seat, choice) {
    if (!state || state.phase !== 'solo') return fail('Jetzt kein Solo.');
    if (state.turn !== seat) return fail('Du bist nicht dran.');
    if (!soloLegal(state.rules, choice)) return fail('Dieses Solo ist nicht verabredet.');
    state.game = shapeSolo(seat, choice, { pflicht: true, vorfuehrung: !!state.vorfuehrung });
    return beginPlay(state);
  }

  function actArmutTake(state, seat, take) {
    if (!state || state.phase !== 'armutTake') return fail('Jetzt nimmt niemand mit.');
    if (state.turn !== seat) return fail('Du bist nicht dran.');
    if (seat === state.armut.poor) return fail('Die Armut nimmt sich nicht selbst mit.');
    if (take) {
      state.armut.taker = seat;
      state.phase = 'armutGive';
      state.turn = state.armut.poor;
      state.events.push({ type: 'mitnehmen', seat: seat });
      return ok();
    }
    state.armut.passes += 1;
    if (state.armut.passes >= 3) return finishRedeal(state);
    let n = nextSeat(seat);
    if (n === state.armut.poor) n = nextSeat(n);
    state.turn = n;
    return ok();
  }

  function asTrump(card, rules) {
    return isTrump(card, baseShape(), rules, false);
  }
  function actArmutGive(state, seat, cards) {
    if (!state || state.phase !== 'armutGive') return fail('Jetzt wird nicht abgegeben.');
    if (seat !== state.armut.poor || state.turn !== seat) return fail('Du bist nicht dran.');
    if (!Array.isArray(cards)) return fail('Karten fehlen.');
    const hand = state.hands[seat];
    const uniq = [];
    for (let i = 0; i < cards.length; i++) {
      if (hand.indexOf(cards[i]) < 0 || uniq.indexOf(cards[i]) >= 0) return fail('Diese Karte hast du nicht.');
      uniq.push(cards[i]);
    }
    if (uniq.length < 1 || uniq.length > 3) return fail('Es gehen eine bis drei Karten.');
    const trumps = hand.filter((c) => asTrump(c, state.rules));
    for (let i = 0; i < trumps.length; i++) {
      if (uniq.indexOf(trumps[i]) < 0) return fail('Alle Trümpfe gehören in die Armut.');
    }
    if (!trumps.length && uniq.length !== 3) return fail('Ohne Trumpf gehen drei Karten weg.');
    state.hands[seat] = hand.filter((c) => uniq.indexOf(c) < 0);
    state.armut.given = uniq;
    state.phase = 'armutBack';
    state.turn = state.armut.taker;
    return ok();
  }
  function actArmutBack(state, seat, cards) {
    if (!state || state.phase !== 'armutBack') return fail('Jetzt kommt nichts zurück.');
    if (seat !== state.armut.taker || state.turn !== seat) return fail('Du bist nicht dran.');
    const n = state.armut.given.length;
    if (!Array.isArray(cards) || cards.length !== n) return fail('Es müssen ' + n + ' Karten zurück.');
    const hand = state.hands[seat];
    const uniq = [];
    for (let i = 0; i < cards.length; i++) {
      if (hand.indexOf(cards[i]) < 0 || uniq.indexOf(cards[i]) >= 0) return fail('Diese Karte hast du nicht.');
      uniq.push(cards[i]);
    }
    const returnedTrumps = uniq.filter((c) => asTrump(c, state.rules));
    const owned = hand.filter((c) => asTrump(c, state.rules)).slice().sort((a, b) => {
      return rankValue(a, baseShape(), state.rules, false) - rankValue(b, baseShape(), state.rules, false);
    });
    const lowest = owned.slice(0, returnedTrumps.length).slice().sort();
    const got = returnedTrumps.slice().sort();
    if (lowest.join('|') !== got.join('|')) return fail('Trümpfe nur von unten zurück.');
    state.hands[seat] = hand.filter((c) => uniq.indexOf(c) < 0).concat(state.armut.given);
    state.hands[state.armut.poor] = state.hands[state.armut.poor].concat(uniq);
    const poor = state.armut.poor;
    const taker = seat;
    state.game = {
      type: 'armut', solo: null, suit: 'D', declarer: poor, partner: taker,
      re: [poor, taker], kontra: [0, 1, 2, 3].filter((s) => s !== poor && s !== taker),
      silent: false, pflicht: false, vorfuehrung: false, clarified: true, clarifyShift: 0,
    };
    state.pigSeat = state.rules.schweinchen ? findPig(state.hands) : null;
    state.pigsOn = false;
    state.events.push({ type: 'getauscht', trumps: returnedTrumps.length, n: n });
    return beginPlay(state);
  }

  function opponentSpoke(state, party) {
    const other = party === 're' ? 'kontra' : 're';
    if (state.ann[other]) return true;
    const bag = state.ann.absage[other];
    return ABSAGE.some((k) => bag[k]);
  }
  function needCards(state, party, kind) {
    const base = { re: 11, kontra: 11, keine90: 10, keine60: 9, keine30: 8, schwarz: 7 };
    let n = base[kind];
    if (!n && n !== 0) return 99;
    if (state.rules.neunen === false) n -= 2;
    if (state.game && state.game.clarifyShift) n -= state.game.clarifyShift;
    if (opponentSpoke(state, party)) n -= 1;
    return n;
  }
  function legalAnnouncements(state, seat) {
    if (!state || state.phase !== 'play' || state.turn !== seat || !state.game) return [];
    if (state.game.type === 'hochzeit' && !state.game.clarified) return [];
    const party = partyOf(state, seat);
    if (!party) return [];
    const n = state.hands[seat].length;
    const out = [];
    if (!state.ann[party] && n >= needCards(state, party, party)) out.push(party);
    if (state.ann[party]) {
      ABSAGE.forEach((k) => {
        if (!state.ann.absage[party][k] && n >= needCards(state, party, k)) out.push(k);
      });
    }
    return out;
  }
  function actAnnounce(state, seat, kind) {
    if (!state || state.phase !== 'play') return fail('Jetzt keine Ansage.');
    if (state.turn !== seat) return fail('Du bist nicht dran.');
    if (legalAnnouncements(state, seat).indexOf(kind) < 0) return fail('Diese Ansage geht nicht.');
    const party = partyOf(state, seat);
    if (kind === 're' || kind === 'kontra') {
      state.ann[kind] = true;
      state.ann.by[kind].push(seat);
    } else {
      const idx = ABSAGE.indexOf(kind);
      const n = state.hands[seat].length;
      for (let i = 0; i <= idx; i++) {
        const step = ABSAGE[i];
        if (n >= needCards(state, party, step)) state.ann.absage[party][step] = true;
      }
    }
    state.events.push({ type: 'ansage', seat: seat, kind: kind });
    return ok({ kind: kind });
  }

  function legalCards(state, seat) {
    const hand = state.hands[seat] || [];
    if (!state.trick || !state.trick.length) return hand.slice();
    const led = effSuit(state.trick[0].card, state.game, state.rules, state.pigsOn);
    const follow = hand.filter((c) => effSuit(c, state.game, state.rules, state.pigsOn) === led);
    return follow.length ? follow : hand.slice();
  }
  function currentWinner(state) {
    if (!state.trick || !state.trick.length) return null;
    return trickWinner(state.trick, state.game, state.rules, state.pigsOn);
  }
  function wouldWin(state, card) {
    if (!state.trick || !state.trick.length) return false;
    const led = effSuit(state.trick[0].card, state.game, state.rules, state.pigsOn);
    const idx = trickWinnerIndex(state.trick, state.game, state.rules, state.pigsOn);
    return laterWins(card, state.trick[idx].card, led, state.game, state.rules, state.pigsOn);
  }

  function allPlays(state) {
    const out = [];
    (state.trickLog || []).forEach((t) => t.plays.forEach((p) => out.push(p)));
    (state.trick || []).forEach((p) => out.push(p));
    return out;
  }
  function visiblePartners(state, seat) {
    const g = state.game;
    if (!g) return [];
    if (g.type === 'solo') {
      if (seat === g.declarer) return [];
      return g.kontra.filter((s) => s !== seat);
    }
    if (g.type === 'armut') {
      const side = g.re.indexOf(seat) >= 0 ? g.re : g.kontra;
      return side.filter((s) => s !== seat);
    }
    if (g.type === 'hochzeit') {
      if (!g.clarified) return [];
      const side = g.re.indexOf(seat) >= 0 ? g.re : g.kontra;
      return side.filter((s) => s !== seat);
    }
    const reShown = {};
    const kontraShown = {};
    state.ann.by.re.forEach((s) => { reShown[s] = 1; });
    state.ann.by.kontra.forEach((s) => { kontraShown[s] = 1; });
    allPlays(state).forEach((p) => { if (typeOf(p.card) === 'CQ') reShown[p.seat] = 1; });
    const mine = (state.hands[seat] || []).some((c) => typeOf(c) === 'CQ') || reShown[seat];
    const reList = Object.keys(reShown).map((s) => +s);
    if (mine) return reList.filter((s) => s !== seat);
    if (reList.length >= 2) return [0, 1, 2, 3].filter((s) => s !== seat && !reShown[s]);
    return Object.keys(kontraShown).map((s) => +s).filter((s) => s !== seat);
  }
  function revealedRole(state, seat) {
    const g = state.game;
    if (!g) return '';
    if (g.type === 'solo' || g.type === 'armut' || (g.type === 'hochzeit' && g.clarified)) {
      const p = partyOf(state, seat);
      return p === 're' ? 'Re' : p === 'kontra' ? 'Kontra' : '';
    }
    if (g.type === 'hochzeit') return seat === g.declarer ? 'Hochzeit' : '';
    const reShown = {};
    const kontraShown = {};
    state.ann.by.re.forEach((s) => { reShown[s] = 1; });
    state.ann.by.kontra.forEach((s) => { kontraShown[s] = 1; });
    allPlays(state).forEach((p) => { if (typeOf(p.card) === 'CQ') reShown[p.seat] = 1; });
    if (reShown[seat]) return 'Re';
    if (kontraShown[seat]) return 'Kontra';
    if (seat === 0) {
      const p = partyOf(state, 0);
      if (p === 're') return 'Re';
      if (p === 'kontra') return 'Kontra';
    }
    return '';
  }

  function clarifyWedding(state, winner) {
    const g = state.game;
    if (!g || g.type !== 'hochzeit' || g.clarified) return;
    if (winner !== g.declarer) {
      const partner = winner;
      g.partner = partner;
      g.re = [g.declarer, partner];
      g.kontra = [0, 1, 2, 3].filter((s) => s !== g.declarer && s !== partner);
      g.clarified = true;
      g.clarifyShift = state.trickNo === 1 ? 0 : state.trickNo - 1;
      state.events.push({ type: 'geklaert', seat: partner, shift: g.clarifyShift });
      return;
    }
    if (state.trickNo >= 3) {
      state.game = shapeSolo(g.declarer, { solo: 'karo', suit: 'D' }, { pflicht: false });
      state.events.push({ type: 'karo-solo', seat: g.declarer });
    }
  }

  function underPoints(eyes, tricks) {
    let p = 0;
    if (eyes < 90) p += 1;
    if (eyes < 60) p += 1;
    if (eyes < 30) p += 1;
    if (tricks === 0) p += 1;
    return p;
  }
  function againstPoints(eyes, oppAbsage) {
    if (!ABSAGE.some((k) => oppAbsage[k])) return 0;
    let p = 0;
    if (eyes >= 30) p += 1;
    if (eyes >= 60) p += 1;
    if (eyes >= 90) p += 1;
    if (eyes >= 120) p += 1;
    return p;
  }
  function absagePoints(bag) {
    return ABSAGE.reduce((s, k) => s + (bag[k] ? 1 : 0), 0);
  }
  function highestAbsage(bag) {
    if (bag.schwarz) return 'schwarz';
    if (bag.keine30) return 'keine30';
    if (bag.keine60) return 'keine60';
    if (bag.keine90) return 'keine90';
    return null;
  }
  function goalOf(party, state, total) {
    const own = state.ann.absage[party];
    const other = party === 're' ? 'kontra' : 're';
    const opp = state.ann.absage[other];
    const ownTop = highestAbsage(own);
    const oppTop = highestAbsage(opp);
    if (ownTop === 'schwarz') return { all: true };
    if (ownTop === 'keine30') return { eyes: 211 };
    if (ownTop === 'keine60') return { eyes: 181 };
    if (ownTop === 'keine90') return { eyes: 151 };
    if (oppTop === 'schwarz') return { tricks: 1 };
    if (oppTop === 'keine30') return { eyes: 30 };
    if (oppTop === 'keine60') return { eyes: 60 };
    if (oppTop === 'keine90') return { eyes: 90 };
    const anyAbs = !!ownTop || !!oppTop;
    if (!anyAbs && state.ann.kontra && !state.ann.re) {
      return { eyes: party === 'kontra' ? 121 : 120 };
    }
    return { eyes: party === 're' ? 121 : 120 };
  }
  function reachedGoal(goal, eyes, tricks, total) {
    if (goal.all) return tricks >= total;
    if (goal.tricks) return tricks >= goal.tricks;
    return eyes >= goal.eyes;
  }
  function partyStats(state, party) {
    let eyes = 0;
    let tricks = 0;
    for (let s = 0; s < 4; s++) {
      if (partyOf(state, s) !== party) continue;
      eyes += sumEyes(state.tricksWon[s]);
      tricks += state.trickLog.filter((t) => t.winner === s).length;
    }
    return { eyes: eyes, tricks: tricks };
  }

  function specials(state) {
    const g = state.game;
    let re = 0;
    let kontra = 0;
    if (!state.rules.sonderpunkte) return { re: 0, kontra: 0 };
    if (!g || g.type === 'solo') return { re: 0, kontra: 0 };
    state.trickLog.forEach((t) => {
      const winParty = partyOf(state, t.winner);
      if (t.eyes >= 40) {
        if (winParty === 're') re += 1;
        else if (winParty === 'kontra') kontra += 1;
      }
      t.plays.forEach((p) => {
        if (typeOf(p.card) !== 'DA') return;
        const owner = partyOf(state, p.seat);
        if (owner && winParty && owner !== winParty) {
          if (winParty === 're') re += 1;
          else kontra += 1;
        }
      });
      if (t === state.trickLog[state.trickLog.length - 1] && typeOf(t.winningCard) === 'CJ') {
        if (winParty === 're') re += 1;
        else if (winParty === 'kontra') kontra += 1;
      }
    });
    return { re: re, kontra: kontra };
  }

  function scoreState(state) {
    const g = state.game;
    const total = trickCount(state.rules);
    const reS = partyStats(state, 're');
    const koS = partyStats(state, 'kontra');
    const reGoal = goalOf('re', state, total);
    const koGoal = goalOf('kontra', state, total);
    const reHit = reachedGoal(reGoal, reS.eyes, reS.tricks, total);
    const koHit = reachedGoal(koGoal, koS.eyes, koS.tricks, total);
    let reWon = false;
    let kontraWon = false;
    if (reHit && !koHit) reWon = true;
    else if (koHit && !reHit) kontraWon = true;
    const sp = specials(state);
    if (kontraWon && g && (g.type === 'normal' || g.type === 'hochzeit')) sp.kontra += 1;
    let wert = 0;
    let signedRe = 0;
    if (reWon || kontraWon) {
      const loserEyes = reWon ? koS.eyes : reS.eyes;
      const loserTricks = reWon ? koS.tricks : reS.tricks;
      const winnerParty = reWon ? 're' : 'kontra';
      const loserParty = reWon ? 'kontra' : 're';
      const winnerEyes = reWon ? reS.eyes : koS.eyes;
      wert = 1 + underPoints(loserEyes, loserTricks);
      if (state.ann.re) wert += 2;
      if (state.ann.kontra) wert += 2;
      wert += absagePoints(state.ann.absage[winnerParty]);
      wert += againstPoints(winnerEyes, state.ann.absage[loserParty]);
      const net = sp.re - sp.kontra;
      signedRe = (reWon ? wert : -wert) + net;
    } else {
      const limRe = underPoints(koS.eyes, koS.tricks) + againstPoints(reS.eyes, state.ann.absage.kontra);
      const limKo = underPoints(reS.eyes, reS.tricks) + againstPoints(koS.eyes, state.ann.absage.re);
      signedRe = (limRe - limKo) + (sp.re - sp.kontra);
    }
    const deltas = [0, 0, 0, 0];
    const solo = g && g.type === 'solo';
    if (solo) {
      deltas[g.re[0]] += 3 * signedRe;
      g.kontra.forEach((s) => { deltas[s] -= signedRe; });
    } else if (g) {
      g.re.forEach((s) => { deltas[s] += signedRe; });
      g.kontra.forEach((s) => { deltas[s] -= signedRe; });
    }
    const winners = [];
    if (reWon && g) g.re.forEach((s) => winners.push(s));
    if (kontraWon && g) g.kontra.forEach((s) => winners.push(s));
    const bits = [];
    bits.push('Re ' + reS.eyes + ' Augen, Kontra ' + koS.eyes);
    if (!reWon && !kontraWon) bits.push('niemand gewinnt');
    else bits.push((reWon ? 'Re' : 'Kontra') + ' gewinnt');
    if (wert) bits.push('Spielwert ' + wert);
    if (sp.re || sp.kontra) bits.push('Sonderpunkte Re ' + sp.re + ', Kontra ' + sp.kontra);
    if (state.ann.re) bits.push('Re angesagt');
    if (state.ann.kontra) bits.push('Kontra angesagt');
    const label = g && g.silent ? 'Normalspiel' : describeGame(g);
    if (g && g.silent) bits.push('stille Hochzeit, als Solo gewertet');
    state.phase = 'done';
    state.result = {
      kind: 'game',
      label: label,
      note: bits.join('. ') + '.',
      deltas: deltas,
      winners: winners,
      reWon: reWon,
      kontraWon: kontraWon,
      completed: true,
      sameDealer: !!(g && g.type === 'solo' && g.pflicht && !g.vorfuehrung),
      pflichtSeat: g && g.pflicht ? g.declarer : null,
      wert: wert,
      signedRe: signedRe,
      reEyes: reS.eyes,
      kontraEyes: koS.eyes,
      specialRe: sp.re,
      specialKontra: sp.kontra,
      solo: !!solo,
      declarer: g ? g.declarer : null,
    };
    return state.result;
  }

  function actPlay(state, seat, card) {
    if (!state || state.phase !== 'play') return fail('Jetzt wird nicht gespielt.');
    if (state.turn !== seat) return fail('Du bist nicht dran.');
    if (state.hands[seat].indexOf(card) < 0) return fail('Die Karte ist nicht auf deiner Hand.');
    if (legalCards(state, seat).indexOf(card) < 0) return fail('Die Farbe ist noch da. Du musst bedienen.');
    state.hands[seat] = state.hands[seat].filter((c) => c !== card);
    if (state.rules.schweinchen && state.pigSeat === seat && typeOf(card) === 'DA' && !state.pigsOn && isTrump(card, state.game, state.rules, true)) {
      state.pigsOn = true;
      state.events.push({ type: 'schweinchen', seat: seat });
    }
    state.trick.push({ seat: seat, card: card });
    if (state.trick.length < 4) {
      state.turn = nextSeat(seat);
      return ok();
    }
    const idx = trickWinnerIndex(state.trick, state.game, state.rules, state.pigsOn);
    const winner = state.trick[idx].seat;
    const plays = state.trick.map((p) => ({ seat: p.seat, card: p.card }));
    const eyes = sumEyes(plays.map((p) => p.card));
    state.trickLog.push({ winner: winner, winningCard: state.trick[idx].card, plays: plays, eyes: eyes });
    plays.forEach((p) => state.tricksWon[winner].push(p.card));
    state.lastTrick = plays;
    state.trick = [];
    state.trickNo += 1;
    clarifyWedding(state, winner);
    if (state.trickNo >= trickCount(state.rules)) return ok(scoreState(state));
    state.leader = winner;
    state.turn = winner;
    return ok();
  }

  function describeGame(game) {
    if (!game) return 'Doppelkopf';
    if (game.silent) return 'Normalspiel';
    if (game.type === 'normal') return 'Normalspiel';
    if (game.type === 'hochzeit') return 'Hochzeit';
    if (game.type === 'armut') return 'Armut';
    if (game.solo === 'damen') return 'Damensolo';
    if (game.solo === 'buben') return 'Bubensolo';
    if (game.solo === 'fleischlos') return 'Fleischlos';
    if (game.solo === 'karo' || game.suit === 'D') return 'Karo-Solo';
    if (game.suit && SUIT_NAMES[game.suit]) return SUIT_NAMES[game.suit] + '-Solo';
    return 'Solo';
  }
  function announceName(kind) {
    const names = {
      re: 'Re', kontra: 'Kontra', keine90: 'keine 90', keine60: 'keine 60', keine30: 'keine 30', schwarz: 'schwarz',
    };
    return names[kind] || kind;
  }

  function applyToMatch(match, state) {
    const r = state.result;
    if (!r) return match;
    for (let i = 0; i < 4; i++) match.scores[i] += r.deltas[i] || 0;
    match.rows.push({
      label: r.label,
      deltas: (r.deltas || [0, 0, 0, 0]).slice(),
      handNo: match.handNo + (r.completed ? 1 : 0),
      note: r.note,
    });
    if (match.rows.length > 80) match.rows = match.rows.slice(-80);
    if (r.completed) {
      if (r.pflichtSeat != null && match.rules.pflichtsolo) match.pflicht[r.pflichtSeat] = true;
      if (match.rules.pflichtsolo) {
        match.roundGames += 1;
        if (match.roundGames >= 24) {
          match.roundGames = 0;
          match.pflicht = [false, false, false, false];
        }
      }
      match.handNo += 1;
      match.dealer = r.sameDealer ? state.dealer : nextSeat(state.dealer);
    }
    match.winner = matchWinner(match.scores, match.target);
    return match;
  }
  function matchWinner(scores, target) {
    let best = 0;
    for (let i = 1; i < 4; i++) if (scores[i] > scores[best]) best = i;
    if (scores[best] < target) return null;
    const tied = scores.filter((s) => s === scores[best]).length;
    return tied === 1 ? best : null;
  }

  function publicSummary(state, scores) {
    const g = state && state.game;
    return {
      phase: state ? state.phase : 'idle',
      game: g ? describeGame(g) : 'Doppelkopf',
      re: !!(state && state.ann && state.ann.re),
      kontra: !!(state && state.ann && state.ann.kontra),
      scores: scores || null,
      schweinchen: !!(state && state.pigsOn),
    };
  }
  function sortHand(cards, game, rules, pigsOn) {
    const g = game || baseShape();
    const r = rules || normalizeRules();
    return (cards || []).slice().sort((a, b) => {
      const ta = isTrump(a, g, r, pigsOn);
      const tb = isTrump(b, g, r, pigsOn);
      if (ta !== tb) return ta ? -1 : 1;
      if (!ta && suitOf(a) !== suitOf(b)) return SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b));
      return rankValue(b, g, r, pigsOn) - rankValue(a, g, r, pigsOn);
    });
  }

  function installPosition(partial) {
    partial = partial || {};
    const rules = normalizeRules(partial.rules);
    const dealer = partial.dealer == null ? 3 : partial.dealer;
    const state = fresh({ pflicht: partial.matchPflicht, roundGames: partial.roundGames }, rules, dealer);
    state.hands = (partial.hands || blankHands()).map((h) => h.slice());
    state.phase = partial.phase || 'play';
    state.trick = (partial.trick || []).map((t) => ({ seat: t.seat, card: t.card }));
    state.trickLog = partial.trickLog ? partial.trickLog.map((t) => Object.assign({}, t)) : [];
    state.tricksWon = (partial.tricksWon || blankHands()).map((h) => h.slice());
    state.trickNo = partial.trickNo || 0;
    state.leader = partial.leader == null ? nextSeat(dealer) : partial.leader;
    state.turn = partial.turn == null ? state.leader : partial.turn;
    state.pigsOn = !!partial.pigsOn;
    state.pigSeat = partial.pigSeat == null ? null : partial.pigSeat;
    state.bids = partial.bids || [null, null, null, null];
    state.ann = partial.ann || emptyAnn();
    if (partial.game) state.game = Object.assign({ clarifyShift: 0, clarified: true, silent: false, pflicht: false, vorfuehrung: false }, partial.game);
    else if (state.phase === 'play') {
      const parties = normalParties(state.hands);
      state.game = Object.assign(baseShape(), { type: 'normal', re: parties.re, kontra: parties.kontra });
    }
    return state;
  }

  function listSolos(rules) {
    const out = [];
    if (rules.farben) {
      ['C', 'S', 'H', 'D'].forEach((s) => out.push({ solo: s === 'D' ? 'karo' : 'farbe', suit: s }));
    }
    if (rules.damen) out.push({ solo: 'damen', suit: null });
    if (rules.buben) out.push({ solo: 'buben', suit: null });
    if (rules.fleischlos) out.push({ solo: 'fleischlos', suit: null });
    return out;
  }

  return {
    SUITS: SUITS,
    RANKS: RANKS,
    SUIT_NAMES: SUIT_NAMES,
    SUIT_SYMBOLS: SUIT_SYMBOLS,
    RANK_NAMES: RANK_NAMES,
    RANK_SHORT: RANK_SHORT,
    EYES: EYES,
    QUEENS: QUEENS,
    JACKS: JACKS,
    ABSAGE: ABSAGE,
    DEFAULT_RULES: DEFAULT_RULES,
    suitOf: suitOf,
    typeOf: typeOf,
    rankOf: rankOf,
    eyesOf: eyesOf,
    sumEyes: sumEyes,
    cardName: cardName,
    cardShort: cardShort,
    createDeck: createDeck,
    seededRng: seededRng,
    cryptoRng: cryptoRng,
    shuffle: shuffle,
    normalizeRules: normalizeRules,
    normalizeTarget: normalizeTarget,
    handSize: handSize,
    nextSeat: nextSeat,
    orderFrom: orderFrom,
    trumpTypes: trumpTypes,
    isTrump: isTrump,
    rankValue: rankValue,
    effSuit: effSuit,
    laterWins: laterWins,
    trickWinner: trickWinner,
    newMatch: newMatch,
    dealHand: dealHand,
    actReserve: actReserve,
    actSolo: actSolo,
    actArmutTake: actArmutTake,
    actArmutGive: actArmutGive,
    actArmutBack: actArmutBack,
    actAnnounce: actAnnounce,
    actPlay: actPlay,
    legalCards: legalCards,
    legalAnnouncements: legalAnnouncements,
    needCards: needCards,
    partyOf: partyOf,
    visiblePartners: visiblePartners,
    revealedRole: revealedRole,
    currentWinner: currentWinner,
    wouldWin: wouldWin,
    scoreState: scoreState,
    applyToMatch: applyToMatch,
    matchWinner: matchWinner,
    describeGame: describeGame,
    announceName: announceName,
    publicSummary: publicSummary,
    sortHand: sortHand,
    installPosition: installPosition,
    listSolos: listSolos,
    soloLegal: soloLegal,
    countType: countType,
    findPig: findPig,
  };
});
