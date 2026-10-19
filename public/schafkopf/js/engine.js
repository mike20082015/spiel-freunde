/*
 * Spiel-Freunde Schafkopf: Regel-Engine (bayerisch, Schafkopfschule April 2024).
 * Läuft ohne Abhängigkeiten im Browser (window.SchafkopfEngine) und in Node (require).
 *
 * Karten: Farbe + Rang, z. B. "EA" (Eichel-Sau), "G10" (Gras-Zehn), "HO" (Herz-Ober), "SU" (Schellen-Unter).
 * Farben: E Eichel, G Gras, H Herz, S Schellen. Ränge: 7 8 9 10 U(Unter) O(Ober) K(König) A(Sau).
 * Sitze: 0 unten, dann im Uhrzeigersinn links herum 1, 2, 3. Vorhand ist links vom Geber.
 * Punkte, keine Einsätze. "Cent" ist nur die alte Bezeichnung in der Tariftafel.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SchafkopfEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['E', 'G', 'H', 'S'];
  const RANKS = ['7', '8', '9', '10', 'U', 'O', 'K', 'A'];
  const SUIT_NAMES = { E: 'Eichel', G: 'Gras', H: 'Herz', S: 'Schellen' };
  const SUIT_SYMBOLS = { E: '♣', G: '♠', H: '♥', S: '♦' };
  const RANK_NAMES = { U: 'Unter', O: 'Ober', K: 'König', A: 'Sau', '10': 'Zehn', '9': 'Neun', '8': 'Acht', '7': 'Sieben' };
  const RANK_SHORT = { U: 'U', O: 'O', K: 'K', A: 'A', '10': '10', '9': '9', '8': '8', '7': '7' };
  const EYES = { A: 11, '10': 10, K: 4, O: 3, U: 2, '9': 0, '8': 0, '7': 0 };
  const CALL_SUITS = ['E', 'G', 'S'];
  const COLOR_PLAIN = ['A', '10', 'K', '9', '8', '7'];
  const COLOR_WENZ = ['A', '10', 'K', 'O', '9', '8', '7'];
  const COLOR_GEIER = ['A', '10', 'K', 'U', '9', '8', '7'];

  const DEFAULT_RULES = {
    deck: 'long',
    ruf: 1,
    solo: 5,
    einheit: 1,
    unit: 'Punkte',
    wenz: true,
    farbwenz: true,
    geier: false,
    farbgeier: false,
    tout: true,
    sie: true,
    allPass: 'throw',
    legen: false,
    stoss: true,
    supra: false,
    wenzLaufende: 2,
    laufendeMax: 0,
    davon: true,
    bock: false,
    ramschBase: 0,
  };

  const RANK_GAME = {
    sauspiel: 10,
    farbgeier: 20,
    farbwenz: 30,
    geier: 40,
    wenz: 50,
    solo: 60,
    farbgeierTout: 70,
    farbwenzTout: 80,
    geierTout: 90,
    wenzTout: 100,
    soloTout: 110,
    sie: 120,
  };

  const suitOf = (c) => c.charAt(0);
  const rankOf = (c) => c.slice(1);
  const eyesOf = (c) => EYES[rankOf(c)] || 0;
  const sumEyes = (cards) => (cards || []).reduce((s, c) => s + eyesOf(c), 0);

  function cardName(c) {
    return SUIT_NAMES[suitOf(c)] + '-' + RANK_NAMES[rankOf(c)];
  }
  function cardShort(c) {
    return SUIT_SYMBOLS[suitOf(c)] + RANK_SHORT[rankOf(c)];
  }

  function createDeck(kind) {
    const ranks = kind === 'short' ? RANKS.filter((r) => r !== '7' && r !== '8') : RANKS;
    const d = [];
    SUITS.forEach((s) => ranks.forEach((r) => d.push(s + r)));
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
    r.deck = r.deck === 'short' ? 'short' : 'long';
    r.ruf = r.ruf === 2 ? 2 : 1;
    r.solo = clampInt(r.solo, 1, 50, 5);
    r.einheit = clampInt(r.einheit, 1, 20, 1);
    r.unit = r.unit === 'Cent' ? 'Cent' : 'Punkte';
    r.wenz = !!r.wenz;
    r.farbwenz = !!r.farbwenz;
    r.geier = !!r.geier;
    r.farbgeier = !!r.farbgeier;
    r.tout = !!r.tout;
    r.sie = !!r.sie;
    r.allPass = ['throw', 'ramsch', 'stock', 'must'].indexOf(r.allPass) >= 0 ? r.allPass : 'throw';
    r.legen = !!r.legen;
    r.stoss = !!r.stoss;
    r.supra = !!r.supra;
    r.wenzLaufende = r.wenzLaufende === 3 ? 3 : 2;
    r.laufendeMax = r.laufendeMax === 4 ? 4 : 0;
    r.davon = r.davon !== false;
    r.bock = !!r.bock;
    r.ramschBase = r.ramschBase ? clampInt(r.ramschBase, 1, 50, r.ruf) : r.ruf;
    return r;
  }

  function normalizeTarget(target, custom) {
    if (target === '10' || target === 10) return 10;
    if (target === '20' || target === 20 || target == null) return 20;
    if (target === '50' || target === 50) return 50;
    if (target === 'custom') return clampInt(custom, 5, 500, 20);
    return clampInt(target, 5, 500, 20);
  }

  function trickCountOf(rules) {
    return rules.deck === 'short' ? 6 : 8;
  }
  function nextSeat(seat) { return (seat + 1) % 4; }
  function orderFrom(dealer) {
    return [1, 2, 3, 4].map((i) => (dealer + i) % 4);
  }
  function fail(reason) { return { ok: false, reason: reason }; }
  function ok(extra) { return Object.assign({ ok: true }, extra || {}); }

  function obers() { return SUITS.map((s) => s + 'O'); }
  function unters() { return SUITS.map((s) => s + 'U'); }
  function colorRun(suit, ranks) { return ranks.map((r) => suit + r); }

  function gameFamily(type) {
    if (type === 'ramsch' || type === 'sauspiel') return 'ruf';
    if (type === 'wenz' || type === 'farbwenz') return 'wenz';
    if (type === 'geier' || type === 'farbgeier') return 'geier';
    return 'solo';
  }

  function trumpList(game) {
    if (!game) return obers().concat(unters(), colorRun('H', COLOR_PLAIN));
    const type = game.type === 'ramsch' ? 'sauspiel' : game.type;
    if (type === 'sauspiel') return obers().concat(unters(), colorRun('H', COLOR_PLAIN));
    if (type === 'wenz') return unters();
    if (type === 'geier') return obers();
    if (type === 'farbwenz') return unters().concat(colorRun(game.suit, COLOR_WENZ));
    if (type === 'farbgeier') return obers().concat(colorRun(game.suit, COLOR_GEIER));
    if (type === 'solo' || type === 'sie') return obers().concat(unters(), colorRun(game.suit || 'H', COLOR_PLAIN));
    return obers().concat(unters(), colorRun('H', COLOR_PLAIN));
  }

  function isTrump(card, game) {
    return trumpList(game).indexOf(card) >= 0;
  }
  function trumpIndex(card, game) {
    return trumpList(game).indexOf(card);
  }
  function plainRanks(game) {
    const fam = gameFamily(game && game.type);
    if (fam === 'wenz') return COLOR_WENZ;
    if (fam === 'geier') return COLOR_GEIER;
    return COLOR_PLAIN;
  }
  function effSuit(card, game) {
    return isTrump(card, game) ? 'T' : suitOf(card);
  }
  function plainIndex(card, game) {
    return plainRanks(game).indexOf(rankOf(card));
  }

  function trickWinner(trick, game) {
    const led = effSuit(trick[0].card, game);
    let best = trick[0];
    for (let i = 1; i < trick.length; i++) {
      const cur = trick[i];
      const s = effSuit(cur.card, game);
      const bs = effSuit(best.card, game);
      if (s === 'T' && bs !== 'T') best = cur;
      else if (s === bs && s === 'T' && trumpIndex(cur.card, game) < trumpIndex(best.card, game)) best = cur;
      else if (s === bs && s === led && plainIndex(cur.card, game) < plainIndex(best.card, game)) best = cur;
    }
    return best.seat;
  }

  function holderOf(hands, card) {
    for (let s = 0; s < hands.length; s++) if (hands[s].indexOf(card) >= 0) return s;
    return -1;
  }

  function colorCards(hand, suit) {
    return hand.filter((c) => suitOf(c) === suit && rankOf(c) !== 'O' && rankOf(c) !== 'U');
  }

  function canCall(hand, suit) {
    if (CALL_SUITS.indexOf(suit) < 0) return false;
    if (hand.indexOf(suit + 'A') >= 0) return false;
    return colorCards(hand, suit).length > 0;
  }

  function hasSie(hand) {
    return SUITS.every((s) => hand.indexOf(s + 'O') >= 0 && hand.indexOf(s + 'U') >= 0);
  }

  function gameRank(type, tout) {
    if (type === 'sauspiel') return RANK_GAME.sauspiel;
    if (type === 'sie') return RANK_GAME.sie;
    const key = type + (tout ? 'Tout' : '');
    return RANK_GAME[key] || 0;
  }

  function legalGames(state, seat) {
    const rules = state.rules;
    const hand = state.hands[seat];
    const out = [];
    CALL_SUITS.forEach((suit) => {
      if (canCall(hand, suit)) out.push(choice(seat, 'sauspiel', suit, false));
    });
    if (rules.wenz) {
      out.push(choice(seat, 'wenz', null, false));
      if (rules.tout) out.push(choice(seat, 'wenz', null, true));
    }
    if (rules.geier) {
      out.push(choice(seat, 'geier', null, false));
      if (rules.tout) out.push(choice(seat, 'geier', null, true));
    }
    SUITS.forEach((suit) => {
      if (rules.farbwenz) {
        out.push(choice(seat, 'farbwenz', suit, false));
        if (rules.tout) out.push(choice(seat, 'farbwenz', suit, true));
      }
      if (rules.farbgeier) {
        out.push(choice(seat, 'farbgeier', suit, false));
        if (rules.tout) out.push(choice(seat, 'farbgeier', suit, true));
      }
      out.push(choice(seat, 'solo', suit, false));
      if (rules.tout) out.push(choice(seat, 'solo', suit, true));
    });
    return out;
  }

  function choice(seat, type, suit, tout) {
    return { seat: seat, type: type, suit: suit, tout: !!tout, rank: gameRank(type, tout) };
  }

  function sameChoice(a, b) {
    return a && b && a.type === b.type && (a.suit || null) === (b.suit || null) && !!a.tout === !!b.tout;
  }

  function bestChoice(order, choices) {
    let best = choices[0];
    for (let i = 1; i < choices.length; i++) {
      const c = choices[i];
      if (c.rank > best.rank) best = c;
      else if (c.rank === best.rank && order.indexOf(c.seat) < order.indexOf(best.seat)) best = c;
    }
    return best;
  }

  function blankHands() { return [[], [], [], []]; }

  function newMatch(opts) {
    opts = opts || {};
    const rules = normalizeRules(opts.rules);
    return {
      scores: [0, 0, 0, 0],
      dealer: opts.dealer == null ? 3 : ((opts.dealer % 4) + 4) % 4,
      handNo: 0,
      pot: 0,
      bock: false,
      rows: [],
      target: normalizeTarget(opts.target, opts.targetCustom),
      winner: null,
      rules: rules,
    };
  }

  function freshState(match, rules, dealer) {
    return {
      rules: rules,
      dealer: dealer,
      order: orderFrom(dealer),
      hands: blankHands(),
      remaining: [],
      phase: 'bid',
      turn: orderFrom(dealer)[0],
      bidStep: 0,
      intents: [null, null, null, null],
      alsoQueue: [],
      alsoStep: 0,
      interested: [],
      chooseStep: 0,
      choices: [],
      must: false,
      game: null,
      opening: null,
      trick: [],
      lastTrick: null,
      leader: orderFrom(dealer)[0],
      tricks: blankHands(),
      trickNo: 0,
      trickCount: trickCountOf(rules),
      aceFree: false,
      searched: false,
      davon: false,
      kontraClosed: false,
      stoss: false,
      stossBy: null,
      retour: false,
      retourBy: null,
      supra: false,
      legen: 0,
      legenVotes: [null, null, null, null],
      legenStep: 0,
      bock: !!(match && match.bock),
      result: null,
    };
  }

  function dealPackets(state, n, deck, cursor) {
    const start = state.order[0];
    let i = cursor;
    for (let r = 0; r < n; r++) {
      for (let s = 0; s < 4; s++) state.hands[(start + s) % 4].push(deck[i++]);
    }
    return i;
  }

  function dealHand(match, rng) {
    const rules = normalizeRules(match.rules);
    const random = rng || Math.random;
    const deck = shuffle(createDeck(rules.deck), random);
    const state = freshState(match, rules, match.dealer);
    const packets = rules.legen ? (rules.deck === 'short' ? 3 : 4) : state.trickCount;
    const cursor = dealPackets(state, packets, deck, 0);
    state.remaining = deck.slice(cursor);
    if (rules.legen) {
      state.phase = 'legen';
      state.turn = state.order[0];
      state.legenStep = 0;
    } else {
      openBidding(state);
    }
    return state;
  }

  function checkSie(state) {
    const sie = findSie(state);
    if (sie < 0) return ok({ sie: false });
    state.game = {
      type: 'sie', suit: null, tout: false, declarer: sie, calledSuit: null, partner: null, rank: RANK_GAME.sie,
    };
    state.opening = state.hands.map((h) => h.slice());
    return finishSie(state);
  }

  function findSie(state) {
    if (!state.rules.sie) return -1;
    for (let s = 0; s < 4; s++) if (hasSie(state.hands[s])) return s;
    return -1;
  }

  function openBidding(state) {
    const sie = findSie(state);
    if (sie >= 0) {
      state.game = { type: 'sie', suit: null, tout: false, declarer: sie, calledSuit: null, partner: null, rank: RANK_GAME.sie };
      state.opening = state.hands.map((h) => h.slice());
      return finishSie(state);
    }
    state.phase = 'bid';
    state.bidStep = 0;
    state.turn = state.order[0];
    return ok();
  }

  function actLegen(state, seat, knock) {
    if (state.phase !== 'legen' || state.turn !== seat) return fail('Jetzt ist nicht Klopfen.');
    state.legenVotes[seat] = !!knock;
    if (knock) state.legen += 1;
    state.legenStep += 1;
    if (state.legenStep < 4) {
      state.turn = state.order[state.legenStep];
      return ok();
    }
    const n = state.rules.deck === 'short' ? 3 : 4;
    dealPackets(state, n, state.remaining, 0);
    state.remaining = [];
    return openBidding(state);
  }

  function actIntent(state, seat, say) {
    if (state.phase !== 'bid' || state.turn !== seat) return fail('Du bist nicht dran.');
    if (say !== 'pass' && say !== 'play') return fail('Sag weiter oder dass du spielen würdest.');
    state.intents[seat] = say;
    state.bidStep += 1;
    if (state.bidStep < 4) {
      state.turn = state.order[state.bidStep];
      return ok();
    }
    const players = state.order.filter((s) => state.intents[s] === 'play');
    if (!players.length) return allPass(state);
    state.interested = players.slice();
    state.alsoQueue = state.order.filter((s) => state.intents[s] !== 'play');
    if (!state.alsoQueue.length) return startChoose(state);
    state.phase = 'also';
    state.alsoStep = 0;
    state.turn = state.alsoQueue[0];
    return ok();
  }

  function actAlso(state, seat, say) {
    if (state.phase !== 'also' || state.turn !== seat) return fail('Du bist nicht dran.');
    if (say !== 'pass' && say !== 'also') return fail('Sag weiter oder dass du auch spielst.');
    if (say === 'also') state.interested.push(seat);
    state.alsoStep += 1;
    if (state.alsoStep < state.alsoQueue.length) {
      state.turn = state.alsoQueue[state.alsoStep];
      return ok();
    }
    return startChoose(state);
  }

  function startChoose(state) {
    state.interested = state.order.filter((s) => state.interested.indexOf(s) >= 0);
    state.phase = 'choose';
    state.chooseStep = 0;
    state.choices = [];
    state.turn = state.interested[0];
    return ok();
  }

  function actChoose(state, seat, pick) {
    if (state.phase !== 'choose' || state.turn !== seat) return fail('Du bist nicht dran.');
    if (pick == null) {
      if (state.must && state.interested.length === 1) return fail('Der Geber muss ein Spiel nennen.');
    } else {
      const found = legalGames(state, seat).find((g) => sameChoice(g, pick));
      if (!found) return fail('Das Spiel darfst du so nicht ansagen.');
      state.choices.push(found);
    }
    state.chooseStep += 1;
    if (state.chooseStep < state.interested.length) {
      state.turn = state.interested[state.chooseStep];
      return ok();
    }
    if (!state.choices.length) return allPass(state);
    return startContract(state, bestChoice(state.order, state.choices));
  }

  function allPass(state) {
    const mode = state.rules.allPass;
    if (mode === 'ramsch') return startContract(state, { seat: null, type: 'ramsch', suit: null, tout: false, rank: 0 });
    if (mode === 'must') {
      state.must = true;
      state.interested = [state.dealer];
      state.phase = 'choose';
      state.chooseStep = 0;
      state.choices = [];
      state.turn = state.dealer;
      return ok({ must: true });
    }
    if (mode === 'stock') {
      const stake = state.rules.ruf;
      state.phase = 'done';
      state.result = {
        kind: 'stock',
        label: 'In den Stock',
        deltas: [-stake, -stake, -stake, -stake],
        potAdd: stake * 4,
        wert: 0,
        declarerWon: false,
        winners: [],
        losers: [],
        note: 'Zusammengeworfen. Jeder legt ' + stake + ' in den Stock.',
      };
      return ok({ done: true });
    }
    state.phase = 'done';
    state.result = {
      kind: 'throw',
      label: 'Zusammengeworfen',
      deltas: [0, 0, 0, 0],
      potAdd: 0,
      wert: 0,
      declarerWon: false,
      winners: [],
      losers: [],
      note: 'Alle weiter. Die Karten werden neu gegeben.',
    };
    return ok({ done: true });
  }

  function startContract(state, pick) {
    const partner = pick.type === 'sauspiel' ? holderOf(state.hands, pick.suit + 'A') : null;
    state.game = {
      type: pick.type,
      suit: pick.suit || null,
      tout: !!pick.tout,
      declarer: pick.seat,
      calledSuit: pick.type === 'sauspiel' ? pick.suit : null,
      partner: partner,
      rank: pick.rank || 0,
    };
    state.opening = state.hands.map((h) => h.slice());
    state.phase = 'play';
    state.leader = state.order[0];
    state.turn = state.leader;
    state.trick = [];
    state.tricks = blankHands();
    state.trickNo = 0;
    state.aceFree = false;
    state.searched = false;
    state.davon = false;
    state.kontraClosed = false;
    return ok({ contract: describeGame(state.game) });
  }

  function windowOpen(state) {
    return !!(state.phase === 'play' && state.rules.stoss && state.game && state.game.type !== 'ramsch' && state.game.type !== 'sie' && !state.kontraClosed && state.trickNo === 0 && state.trick.length < 2);
  }
  function isOpponent(state, seat) {
    const g = state.game;
    if (!g || g.declarer == null) return false;
    if (seat === g.declarer) return false;
    if (g.partner != null && seat === g.partner) return false;
    return true;
  }
  function canStoss(state, seat) {
    return windowOpen(state) && !state.stoss && isOpponent(state, seat);
  }
  function canRetour(state, seat) {
    if (!windowOpen(state) || !state.stoss || state.retour) return false;
    const g = state.game;
    return seat === g.declarer || (g.partner != null && seat === g.partner);
  }
  function canSupra(state, seat) {
    return windowOpen(state) && !!state.rules.supra && state.retour && !state.supra && isOpponent(state, seat);
  }
  function actStoss(state, seat) {
    if (!canStoss(state, seat)) return fail('Stoß geht jetzt nicht.');
    state.stoss = true;
    state.stossBy = seat;
    return ok();
  }
  function actRetour(state, seat) {
    if (!canRetour(state, seat)) return fail('Retour geht jetzt nicht.');
    state.retour = true;
    state.retourBy = seat;
    return ok();
  }
  function actSupra(state, seat) {
    if (!canSupra(state, seat)) return fail('Eine weitere Verdopplung geht jetzt nicht.');
    state.supra = true;
    return ok();
  }

  function legalCards(state, seat) {
    const hand = state.hands[seat];
    if (!hand || !hand.length) return [];
    const game = state.game;
    if (!state.trick.length) return legalLead(state, seat, hand);
    const led = effSuit(state.trick[0].card, game);
    const follow = hand.filter((c) => effSuit(c, game) === led);
    let cards = follow.length ? follow.slice() : hand.slice();
    const ace = game && game.calledSuit ? game.calledSuit + 'A' : null;
    const restricted = ace && game.partner === seat && hand.indexOf(ace) >= 0 && !state.aceFree;
    if (restricted && led === game.calledSuit) return [ace];
    if (restricted && !follow.length && state.trickNo < state.trickCount - 1) {
      const without = cards.filter((c) => c !== ace);
      if (without.length) return without;
    }
    return cards;
  }

  function legalLead(state, seat, hand) {
    const game = state.game;
    const ace = game && game.calledSuit ? game.calledSuit + 'A' : null;
    if (!ace || game.partner !== seat || hand.indexOf(ace) < 0 || state.aceFree) return hand.slice();
    const mine = colorCards(hand, game.calledSuit);
    const davonOk = !!state.rules.davon && mine.length >= 4;
    return hand.filter((c) => {
      if (c === ace) return true;
      if (suitOf(c) === game.calledSuit && rankOf(c) !== 'O' && rankOf(c) !== 'U') return davonOk;
      return true;
    });
  }

  function pull(hand, card) {
    const i = hand.indexOf(card);
    if (i < 0) return false;
    hand.splice(i, 1);
    return true;
  }

  function noteAce(state, seat, card) {
    const game = state.game;
    if (!game || !game.calledSuit) return;
    const ace = game.calledSuit + 'A';
    const calledColor = suitOf(card) === game.calledSuit && rankOf(card) !== 'O' && rankOf(card) !== 'U';
    if (card === ace) state.aceFree = true;
    if (seat === game.partner && calledColor && card !== ace && state.trick.length === 0) {
      state.aceFree = true;
      state.davon = true;
    }
    if (seat !== game.partner && calledColor && state.trick.length === 0) state.searched = true;
  }

  function actPlay(state, seat, card) {
    if (state.phase !== 'play' || state.turn !== seat) return fail('Du bist nicht dran.');
    if (legalCards(state, seat).indexOf(card) < 0) return fail('Die Karte ist nicht erlaubt.');
    noteAce(state, seat, card);
    if (!pull(state.hands[seat], card)) return fail('Die Karte ist nicht auf der Hand.');
    state.trick.push({ seat: seat, card: card });
    if (state.trickNo === 0 && state.trick.length >= 2) state.kontraClosed = true;
    if (state.trick.length < 4) {
      state.turn = nextSeat(seat);
      return ok();
    }
    const winner = trickWinner(state.trick, state.game);
    const won = state.trick.map((t) => t.card);
    state.tricks[winner] = state.tricks[winner].concat(won);
    state.lastTrick = state.trick.slice();
    state.trick = [];
    state.trickNo += 1;
    state.leader = winner;
    state.turn = winner;
    const g = state.game;
    if (g.tout && g.declarer != null && winner !== g.declarer && winner !== g.partner) {
      finishPlayed(state, { toutLost: true });
      return ok({ done: true, trickWinner: winner });
    }
    if (state.trickNo >= state.trickCount) {
      finishPlayed(state, {});
      return ok({ done: true, trickWinner: winner });
    }
    return ok({ trickWinner: winner });
  }

  function partyOf(game, seat) {
    if (!game || game.type === 'ramsch') return 'self';
    if (game.type === 'sauspiel') return (seat === game.declarer || seat === game.partner) ? 'play' : 'opp';
    return seat === game.declarer ? 'play' : 'opp';
  }

  function countLaufende(opening, game) {
    if (!game || game.type === 'ramsch' || game.type === 'sie' || !opening) return { count: 0, party: null, paid: 0 };
    const order = trumpList(game);
    let party = null;
    let n = 0;
    for (let i = 0; i < order.length; i++) {
      const seat = holderOf(opening, order[i]);
      if (seat < 0) break;
      const p = partyOf(game, seat);
      if (party == null) party = p;
      if (p !== party) break;
      n += 1;
    }
    return { count: n, party: party, paid: 0 };
  }

  function paidLaufende(info, game, rules) {
    if (!info || !info.count) return 0;
    let need = 3;
    if (game.type === 'wenz' || game.type === 'geier') need = rules.wenzLaufende === 3 ? 3 : 2;
    if (info.count < need) return 0;
    if (rules.laufendeMax === 4) return Math.min(4, info.count);
    return info.count;
  }

  function multiplierOf(state) {
    let m = 1;
    if (state.retour) m *= 4;
    else if (state.stoss) m *= 2;
    if (state.supra) m *= 2;
    if (state.legen) m *= Math.pow(2, state.legen);
    if (state.bock) m *= 2;
    return m;
  }

  function eyesBySeat(tricks) {
    return tricks.map(sumEyes);
  }

  function finishPlayed(state, flags) {
    const rules = state.rules;
    const game = state.game;
    const eyes = eyesBySeat(state.tricks);
    const trickN = state.tricks.map((t) => t.length / 4);
    if (game.type === 'ramsch') {
      state.result = scoreRamsch(state, eyes, trickN);
      state.phase = 'done';
      return state.result;
    }
    const playSeats = [0, 1, 2, 3].filter((s) => partyOf(game, s) === 'play');
    const oppSeats = [0, 1, 2, 3].filter((s) => partyOf(game, s) === 'opp');
    const playEyes = playSeats.reduce((s, i) => s + eyes[i], 0);
    const playTricks = playSeats.reduce((s, i) => s + trickN[i], 0);
    const oppTricks = oppSeats.reduce((s, i) => s + trickN[i], 0);
    const toutLost = !!(flags && flags.toutLost) || (game.tout && oppTricks > 0);
    const declarerWon = game.tout ? !toutLost && playTricks === state.trickCount : playEyes >= 61;
    const lauf = countLaufende(state.opening, game);
    const laufende = paidLaufende(lauf, game, rules);
    let schneider = 0;
    let schwarz = 0;
    if (!game.tout) {
      if (declarerWon) {
        if (playEyes >= 91) schneider = 1;
        if (oppTricks === 0) schwarz = 1;
      } else {
        if (playEyes <= 30) schneider = 1;
        if (playTricks === 0) schwarz = 1;
      }
    }
    const grund = game.type === 'sauspiel' ? rules.ruf : rules.solo;
    let wert = game.tout ? (grund + rules.einheit * laufende) * 2 : grund + rules.einheit * (schneider + schwarz + laufende);
    wert *= multiplierOf(state);
    const deltas = [0, 0, 0, 0];
    const winners = declarerWon ? playSeats : oppSeats;
    const losers = declarerWon ? oppSeats : playSeats;
    if (game.type === 'sauspiel') {
      losers.forEach((s) => { deltas[s] -= wert; });
      winners.forEach((s) => { deltas[s] += wert; });
    } else {
      const solo = game.declarer;
      const others = [0, 1, 2, 3].filter((s) => s !== solo);
      if (declarerWon) {
        others.forEach((s) => { deltas[s] -= wert; });
        deltas[solo] += wert * others.length;
      } else {
        others.forEach((s) => { deltas[s] += wert; });
        deltas[solo] -= wert * others.length;
      }
    }
    state.phase = 'done';
    state.result = {
      kind: 'game',
      label: describeGame(game),
      deltas: deltas,
      wert: wert,
      grund: grund,
      laufende: laufende,
      laufendeParty: lauf.party,
      schneider: schneider,
      schwarz: schwarz,
      multiplier: multiplierOf(state),
      playEyes: playEyes,
      declarerWon: declarerWon,
      winners: winners,
      losers: losers,
      toutLost: toutLost,
      potAdd: 0,
      note: toutLost && !declarerWon
        ? 'Tout verloren. Die Gegenspieler haben einen Stich gemacht.'
        : scoreNote(game, declarerWon, playEyes, schneider, schwarz, laufende),
    };
    return state.result;
  }

  function finishSie(state) {
    const rules = state.rules;
    const solo = state.game.declarer;
    let wert = (rules.solo + 8 * rules.einheit) * 4;
    wert *= multiplierOf(state);
    const deltas = [0, 0, 0, 0];
    [0, 1, 2, 3].forEach((s) => {
      if (s === solo) deltas[s] += wert * 3;
      else deltas[s] -= wert;
    });
    state.phase = 'done';
    state.result = {
      kind: 'sie',
      label: 'Sie',
      deltas: deltas,
      wert: wert,
      grund: rules.solo,
      laufende: 8,
      laufendeParty: 'play',
      schneider: 0,
      schwarz: 0,
      multiplier: multiplierOf(state),
      playEyes: 120,
      declarerWon: true,
      winners: [solo],
      losers: [0, 1, 2, 3].filter((s) => s !== solo),
      toutLost: false,
      potAdd: 0,
      note: 'Alle Ober und alle Unter. Sie zählt sofort, ohne Ausspielen.',
    };
    return ok({ done: true });
  }

  function highestTrump(cards, game) {
    let best = null;
    let bestI = 99;
    cards.forEach((c) => {
      if (!isTrump(c, game)) return;
      const i = trumpIndex(c, game);
      if (i >= 0 && i < bestI) { bestI = i; best = c; }
    });
    return { card: best, index: bestI };
  }

  function scoreRamsch(state, eyes, trickN) {
    const game = state.game;
    const rules = state.rules;
    const trumpN = state.tricks.map((pile) => pile.filter((c) => isTrump(c, game)).length);
    const highs = state.tricks.map((pile) => highestTrump(pile, game).index);
    let loser = 0;
    for (let s = 1; s < 4; s++) {
      if (eyes[s] > eyes[loser]) loser = s;
      else if (eyes[s] === eyes[loser] && trickN[s] > trickN[loser]) loser = s;
      else if (eyes[s] === eyes[loser] && trickN[s] === trickN[loser] && trumpN[s] > trumpN[loser]) loser = s;
      else if (eyes[s] === eyes[loser] && trickN[s] === trickN[loser] && trumpN[s] === trumpN[loser] && highs[s] < highs[loser]) loser = s;
    }
    const durch = trickN.findIndex((n) => n === state.trickCount);
    const jungfrau = durch < 0 && trickN.some((n, i) => n === 0 && i !== loser);
    let pay = rules.ramschBase || rules.ruf;
    pay *= multiplierOf(state);
    if (jungfrau) pay *= 2;
    if (durch >= 0) pay *= 2;
    const deltas = [0, 0, 0, 0];
    if (durch >= 0) {
      [0, 1, 2, 3].forEach((s) => {
        if (s === durch) deltas[s] += pay * 3;
        else deltas[s] -= pay;
      });
    } else {
      [0, 1, 2, 3].forEach((s) => {
        if (s === loser) deltas[s] -= pay * 3;
        else deltas[s] += pay;
      });
    }
    const winner = durch >= 0 ? durch : null;
    return {
      kind: 'ramsch',
      label: durch >= 0 ? 'Ramsch, Durchmarsch' : 'Ramsch',
      deltas: deltas,
      wert: pay,
      grund: rules.ramschBase || rules.ruf,
      laufende: 0,
      schneider: 0,
      schwarz: 0,
      multiplier: multiplierOf(state),
      playEyes: eyes[durch >= 0 ? durch : loser],
      declarerWon: durch >= 0,
      declarer: durch >= 0 ? durch : loser,
      winners: durch >= 0 ? [durch] : [0, 1, 2, 3].filter((s) => s !== loser),
      losers: durch >= 0 ? [0, 1, 2, 3].filter((s) => s !== durch) : [loser],
      potAdd: 0,
      eyes: eyes,
      note: durch >= 0
        ? 'Durchmarsch. Alle Stiche, der Ramsch ist gewonnen.'
        : 'Ramsch. Die meisten Augen zahlen' + (jungfrau ? ', Jungfrau verdoppelt' : '') + '.',
      winnerSeat: winner,
      loserSeat: durch >= 0 ? null : loser,
    };
  }

  function scoreNote(game, won, playEyes, schneider, schwarz, laufende) {
    const who = won ? 'Spielerpartei' : 'Gegenspieler';
    let t = who + ' mit ' + (won ? playEyes : (120 - playEyes)) + ' Augen.';
    if (schneider) t += ' Schneider.';
    if (schwarz) t += ' Schwarz.';
    if (laufende) t += ' ' + laufende + ' Laufende.';
    if (game.tout) t += won ? ' Tout gehalten.' : ' Tout verloren.';
    return t;
  }

  function describeGame(game) {
    if (!game) return '';
    if (game.type === 'ramsch') return 'Ramsch';
    if (game.type === 'sie') return 'Sie';
    if (game.type === 'sauspiel') return SUIT_NAMES[game.suit] + ' gerufen';
    const suit = game.suit ? SUIT_NAMES[game.suit] + '-' : '';
    const names = { solo: 'Solo', wenz: 'Wenz', farbwenz: 'Farbwenz', geier: 'Geier', farbgeier: 'Farbgeier' };
    return suit + (names[game.type] || game.type) + (game.tout ? '-Tout' : '');
  }

  function unitWord(rules, n) {
    const one = rules.unit === 'Cent' ? 'ct' : 'Punkt';
    const many = rules.unit === 'Cent' ? 'ct' : 'Punkte';
    return n + ' ' + (Math.abs(n) === 1 && rules.unit !== 'Cent' ? one : many);
  }

  function applyToMatch(match, state) {
    const r = state.result;
    if (!r) return match;
    if (r.kind === 'stock') match.pot += r.potAdd || 0;
    if ((r.kind === 'game' || r.kind === 'sie') && match.pot) {
      if (r.declarerWon) {
        const winners = r.winners.slice();
        const share = Math.floor(match.pot / winners.length);
        let rest = match.pot - share * winners.length;
        winners.forEach((s) => { r.deltas[s] += share; });
        if (rest && r.winners.length) r.deltas[state.game.declarer] += rest;
        r.potTaken = match.pot;
        match.pot = 0;
      } else {
        match.pot *= 2;
        r.potDoubled = true;
      }
    }
    for (let i = 0; i < 4; i++) match.scores[i] += r.deltas[i];
    if (state.rules.bock && (r.kind === 'game' || r.kind === 'sie')) match.bock = !r.declarerWon;
    match.rows.push({
      label: r.label,
      deltas: r.deltas.slice(),
      handNo: match.handNo + 1,
      note: r.note,
    });
    if (match.rows.length > 80) match.rows = match.rows.slice(-80);
    match.handNo += 1;
    match.dealer = nextSeat(state.dealer);
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

  function partnerKnown(state) {
    return !!(state.game && state.game.type === 'sauspiel' && state.aceFree);
  }

  function publicSummary(state, scores) {
    const g = state && state.game;
    return {
      phase: state ? state.phase : 'idle',
      game: g ? describeGame(g) : 'Schafkopf',
      called: g && g.calledSuit ? SUIT_NAMES[g.calledSuit] + '-Sau' : null,
      partnerKnown: state ? partnerKnown(state) : false,
      scores: scores || null,
      stoss: !!(state && state.stoss),
      retour: !!(state && state.retour),
    };
  }

  function sortHand(cards, game) {
    const g = game && game.type ? game : { type: 'sauspiel' };
    return cards.slice().sort((a, b) => {
      const ta = isTrump(a, g);
      const tb = isTrump(b, g);
      if (ta && tb) return trumpIndex(a, g) - trumpIndex(b, g);
      if (ta) return -1;
      if (tb) return 1;
      if (suitOf(a) !== suitOf(b)) return SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b));
      return plainIndex(a, g) - plainIndex(b, g);
    });
  }

  function installPosition(partial) {
    const rules = normalizeRules(partial.rules);
    const dealer = partial.dealer == null ? 3 : partial.dealer;
    const state = freshState({ bock: !!partial.bock }, rules, dealer);
    state.hands = (partial.hands || blankHands()).map((h) => h.slice());
    state.opening = (partial.opening || state.hands).map((h) => h.slice());
    state.phase = partial.phase || 'play';
    state.trick = (partial.trick || []).map((t) => ({ seat: t.seat, card: t.card }));
    state.tricks = (partial.tricks || blankHands()).map((h) => h.slice());
    state.trickNo = partial.trickNo || 0;
    state.leader = partial.leader == null ? state.order[0] : partial.leader;
    state.turn = partial.turn == null ? state.leader : partial.turn;
    state.aceFree = !!partial.aceFree;
    state.searched = !!partial.searched;
    state.stoss = !!partial.stoss;
    state.retour = !!partial.retour;
    state.supra = !!partial.supra;
    state.legen = partial.legen || 0;
    state.bock = !!partial.bock;
    state.kontraClosed = !!partial.kontraClosed;
    if (partial.game) {
      const g = partial.game;
      const partner = g.type === 'sauspiel' ? holderOf(state.opening, g.suit + 'A') : (g.partner == null ? null : g.partner);
      state.game = {
        type: g.type,
        suit: g.suit || null,
        tout: !!g.tout,
        declarer: g.declarer,
        calledSuit: g.type === 'sauspiel' ? g.suit : null,
        partner: partner,
        rank: gameRank(g.type, g.tout),
      };
    }
    return state;
  }

  return {
    SUITS: SUITS,
    RANKS: RANKS,
    SUIT_NAMES: SUIT_NAMES,
    SUIT_SYMBOLS: SUIT_SYMBOLS,
    RANK_NAMES: RANK_NAMES,
    RANK_SHORT: RANK_SHORT,
    EYES: EYES,
    CALL_SUITS: CALL_SUITS,
    DEFAULT_RULES: DEFAULT_RULES,
    RANK_GAME: RANK_GAME,
    suitOf: suitOf,
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
    trumpList: trumpList,
    isTrump: isTrump,
    trumpIndex: trumpIndex,
    effSuit: effSuit,
    trickWinner: trickWinner,
    canCall: canCall,
    hasSie: hasSie,
    gameRank: gameRank,
    legalGames: legalGames,
    legalCards: legalCards,
    bestChoice: bestChoice,
    countLaufende: countLaufende,
    paidLaufende: paidLaufende,
    newMatch: newMatch,
    dealHand: dealHand,
    actLegen: actLegen,
    actIntent: actIntent,
    actAlso: actAlso,
    actChoose: actChoose,
    actPlay: actPlay,
    actStoss: actStoss,
    actRetour: actRetour,
    actSupra: actSupra,
    canStoss: canStoss,
    canRetour: canRetour,
    canSupra: canSupra,
    finishPlayed: finishPlayed,
    applyToMatch: applyToMatch,
    matchWinner: matchWinner,
    describeGame: describeGame,
    unitWord: unitWord,
    publicSummary: publicSummary,
    partnerKnown: partnerKnown,
    checkSie: checkSie,
    sortHand: sortHand,
    installPosition: installPosition,
    nextSeat: nextSeat,
    orderFrom: orderFrom,
    partyOf: partyOf,
    multiplierOf: multiplierOf,
    windowOpen: windowOpen,
  };
});
