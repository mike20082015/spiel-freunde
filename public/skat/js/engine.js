/*
 * Spiel-Freunde Skat: Regel-Engine (Deutsche Skatordnung)
 * Läuft ohne Abhängigkeiten im Browser (window.SkatEngine) und in Node (require).
 *
 * Karten sind Strings: Farbe + Rang, z. B. "CJ" (Kreuz-Bube), "H10" (Herz-Zehn), "DA" (Karo-Ass).
 * Farben: C = Kreuz, S = Pik, H = Herz, D = Karo. Ränge: 7 8 9 10 J(Bube) Q(Dame) K(König) A(Ass).
 * Sitze: 0 = Du (unten), 1 = Horst (links), 2 = Margarethe (rechts). Gespielt wird im Uhrzeigersinn 0 -> 1 -> 2.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SkatEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['C', 'S', 'H', 'D'];
  const RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const SUIT_NAMES = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' };
  const SUIT_SYMBOLS = { C: '♣', S: '♠', H: '♥', D: '♦' };
  const RANK_NAMES = { J: 'Bube', Q: 'Dame', K: 'König', A: 'Ass', '10': 'Zehn', '9': 'Neun', '8': 'Acht', '7': 'Sieben' };
  const RANK_SHORT = { J: 'B', Q: 'D', K: 'K', A: 'A', '10': '10', '9': '9', '8': '8', '7': '7' };
  const POINTS = { A: 11, '10': 10, K: 4, Q: 3, J: 2, '9': 0, '8': 0, '7': 0 };
  const BASE = { C: 12, S: 11, H: 10, D: 9, grand: 24 };
  const NULL_VALUES = { plain: 23, hand: 35, ouvert: 46, ouvertHand: 59 };
  const JACK_ORDER = ['CJ', 'SJ', 'HJ', 'DJ'];
  const NORMAL_ORDER = ['7', '8', '9', 'Q', 'K', '10', 'A']; // aufsteigend, ohne Buben
  const NULL_ORDER = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A']; // aufsteigend
  const POSITION_NAMES = ['Vorhand', 'Mittelhand', 'Hinterhand'];

  const suitOf = (c) => c[0];
  const rankOf = (c) => c.slice(1);
  const points = (c) => POINTS[rankOf(c)];
  const sumPoints = (cards) => cards.reduce((s, c) => s + points(c), 0);
  const isJack = (c) => rankOf(c) === 'J';

  function cardName(c) {
    return SUIT_NAMES[suitOf(c)] + '-' + RANK_NAMES[rankOf(c)];
  }
  function cardShort(c) {
    return SUIT_SYMBOLS[suitOf(c)] + RANK_SHORT[rankOf(c)];
  }

  function createDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push(s + r);
    return d;
  }

  /* Zufall: im Browser crypto, für Tests ein reproduzierbarer Seed (mulberry32). */
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
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------- Trumpf, Rangfolge, Stich ---------- */

  // Effektive Farbe einer Karte im Spiel: 'T' für Trumpf, sonst die Farbe.
  function effSuit(c, game) {
    if (!game || game.type === 'null') return suitOf(c);
    if (isJack(c)) return 'T';
    if (game.type === 'suit' && suitOf(c) === game.trump) return 'T';
    return suitOf(c);
  }
  // Stärke innerhalb der effektiven Farbe (höher sticht).
  function power(c, game) {
    if (game && game.type === 'null') return NULL_ORDER.indexOf(rankOf(c));
    if (isJack(c)) return 100 + (3 - JACK_ORDER.indexOf(c));
    return NORMAL_ORDER.indexOf(rankOf(c));
  }
  function isTrump(c, game) { return effSuit(c, game) === 'T'; }

  // Trumpfreihenfolge von oben nach unten (für Spitzen und Anzeige).
  function trumpOrder(game) {
    if (!game || game.type === 'null') return [];
    const order = JACK_ORDER.slice();
    if (game.type === 'suit') {
      for (const r of ['A', '10', 'K', 'Q', '9', '8', '7']) order.push(game.trump + r);
    }
    return order;
  }

  // Schlägt Karte a die bisher beste Karte b? (lead = effektive Farbe des Ausspiels)
  function beats(a, b, lead, game) {
    const ea = effSuit(a, game), eb = effSuit(b, game);
    if (ea === eb) return power(a, game) > power(b, game);
    if (ea === 'T') return true;
    if (eb === 'T') return false;
    return ea === lead && eb !== lead;
  }

  // Index (0..n-1) der stechenden Karte in einem Stich (Karten in Ausspielreihenfolge).
  function trickWinnerIndex(cards, game) {
    const lead = effSuit(cards[0], game);
    let best = 0;
    for (let i = 1; i < cards.length; i++) if (beats(cards[i], cards[best], lead, game)) best = i;
    return best;
  }

  // Bedienpflicht: erlaubte Karten der Hand für den aktuellen Stich.
  function legalCards(hand, trickCards, game) {
    if (!trickCards || trickCards.length === 0) return hand.slice();
    const lead = effSuit(trickCards[0], game);
    const follow = hand.filter((c) => effSuit(c, game) === lead);
    return follow.length ? follow : hand.slice();
  }

  // Hand sortieren: Trümpfe zuerst, dann Farben abwechselnd schwarz/rot.
  function sortHand(hand, game) {
    const g = game || { type: 'grand' };
    const suitRank = { C: 0, H: 1, S: 2, D: 3 };
    if (g.type === 'suit') {
      // Trumpffarbe ganz nach vorne; Rest abwechselnd so gut es geht
      const others = ['C', 'H', 'S', 'D'].filter((s) => s !== g.trump);
      suitRank[g.trump] = -1;
      others.forEach((s, i) => (suitRank[s] = i));
    }
    return hand.slice().sort((a, b) => {
      const ta = isTrump(a, g) && g.type !== 'null', tb = isTrump(b, g) && g.type !== 'null';
      if (ta !== tb) return ta ? -1 : 1;
      if (ta && tb) return power(b, g) - power(a, g);
      const sa = suitRank[suitOf(a)], sb = suitRank[suitOf(b)];
      if (sa !== sb) return sa - sb;
      return power(b, g) - power(a, g);
    });
  }

  /* ---------- Spielwert ---------- */

  // Spitzen: mit/ohne n, gerechnet über die 12 Karten des Alleinspielers (Hand + Skat).
  function matadors(cards, game) {
    const order = trumpOrder(game);
    if (!order.length) return { count: 0, mit: true };
    const has = new Set(cards);
    const mit = has.has(order[0]);
    let n = 0;
    for (const c of order) {
      if (has.has(c) === mit) n++;
      else break;
    }
    return { count: n, mit };
  }

  function baseValue(game) {
    if (game.type === 'grand') return BASE.grand;
    if (game.type === 'suit') return BASE[game.trump];
    if (game.type === 'null') return nullValue(game);
    return 0;
  }
  function nullValue(game) {
    if (game.ouvert && game.hand) return NULL_VALUES.ouvertHand;
    if (game.ouvert) return NULL_VALUES.ouvert;
    if (game.hand) return NULL_VALUES.hand;
    return NULL_VALUES.plain;
  }

  /*
   * Spielwert berechnen.
   * opts: { game, matadors (Anzahl), schneider, schwarz }; Ansagen kommen aus game.
   * Angesagte Stufen zählen immer mit (auch wenn verloren), und Schwarz angesagt schließt Schneider angesagt ein.
   */
  function multiplierParts(opts) {
    const g = opts.game;
    const schwarzAnn = !!g.schwarzAnnounced;
    const schneiderAnn = !!g.schneiderAnnounced || schwarzAnn;
    const schneider = !!opts.schneider || schneiderAnn;
    const schwarz = !!opts.schwarz || schwarzAnn;
    const parts = [];
    parts.push({ label: (opts.mit === false ? 'ohne ' : 'mit ') + (opts.matadors || 0), n: opts.matadors || 0 });
    parts.push({ label: 'Spiel', n: 1 });
    if (g.hand) parts.push({ label: 'Hand', n: 1 });
    if (schneider) parts.push({ label: 'Schneider', n: 1 });
    if (schneiderAnn) parts.push({ label: 'Schneider angesagt', n: 1 });
    if (schwarz) parts.push({ label: 'Schwarz', n: 1 });
    if (schwarzAnn) parts.push({ label: 'Schwarz angesagt', n: 1 });
    if (g.ouvert) parts.push({ label: 'Ouvert', n: 1 });
    return parts;
  }
  function calcGameValue(opts) {
    const g = opts.game;
    if (g.type === 'null') return nullValue(g);
    const mult = multiplierParts(opts).reduce((s, p) => s + p.n, 0);
    return baseValue(g) * mult;
  }

  // Alle möglichen Reizwerte (18, 20, 22, 23, 24, 27, 30, ...)
  const BID_VALUES = (function () {
    const set = new Set(Object.values(NULL_VALUES));
    for (const b of [9, 10, 11, 12]) for (let m = 2; m <= 18; m++) set.add(b * m);
    for (let m = 2; m <= 11; m++) set.add(24 * m);
    return Array.from(set).filter((v) => v >= 18).sort((a, b) => a - b);
  })();
  function nextBid(v) {
    for (const b of BID_VALUES) if (b > v) return b;
    return null;
  }

  function gameLabel(game) {
    if (!game) return '';
    if (game.type === 'ramsch') return 'Ramsch';
    let s;
    if (game.type === 'suit') s = SUIT_NAMES[game.trump];
    else if (game.type === 'grand') s = 'Grand';
    else s = 'Null';
    if (game.type === 'null' && game.ouvert) s += ' Ouvert';
    if (game.hand) s += ' Hand';
    if (game.schwarzAnnounced) s += ', Schwarz angesagt';
    else if (game.schneiderAnnounced) s += ', Schneider angesagt';
    return s;
  }

  /* ---------- Spielablauf ---------- */

  function positions(dealer) {
    return { vorhand: (dealer + 1) % 3, mittelhand: (dealer + 2) % 3, hinterhand: dealer };
  }
  function positionName(state, player) {
    const p = positions(state.dealer);
    if (player === p.vorhand) return 'Vorhand';
    if (player === p.mittelhand) return 'Mittelhand';
    return 'Hinterhand';
  }

  // Geben: 3 - Skat(2) - 4 - 3, beginnend bei Vorhand.
  function deal(deck, dealer) {
    const p = positions(dealer);
    const order = [p.vorhand, p.mittelhand, p.hinterhand];
    const hands = [[], [], []];
    const skat = [];
    let i = 0;
    for (const pl of order) for (let k = 0; k < 3; k++) hands[pl].push(deck[i++]);
    skat.push(deck[i++], deck[i++]);
    for (const pl of order) for (let k = 0; k < 4; k++) hands[pl].push(deck[i++]);
    for (const pl of order) for (let k = 0; k < 3; k++) hands[pl].push(deck[i++]);
    return { hands, skat };
  }

  /*
   * Neues Spiel. opts: { dealer, rng, rules: {mode:'official'|'kneipe'}, special: null|'bock'|'ramsch', deck }
   */
  function newGame(opts) {
    const rng = opts.rng || cryptoRng();
    const dealer = opts.dealer || 0;
    const deck = opts.deck ? opts.deck.slice() : shuffle(createDeck(), rng);
    const { hands, skat } = deal(deck, dealer);
    const pos = positions(dealer);
    const state = {
      rules: Object.assign({ mode: 'official' }, opts.rules || {}),
      special: opts.special || null,
      dealer,
      pos,
      hands,
      startHands: hands.map((h) => h.slice()),
      skat: skat.slice(),
      originalSkat: skat.slice(),
      phase: 'bidding',
      bidding: { stage: 1, sayer: pos.mittelhand, listener: pos.vorhand, value: 0, waiting: 'say', history: [], out: [false, false, false] },
      declarer: null,
      bid: 0,
      game: null,
      skatTaken: false,
      discarded: [],
      trick: [],
      leader: pos.vorhand,
      turn: pos.vorhand,
      tricks: [],
      lastTrick: null,
      kontra: false,
      re: false,
      kontraBy: null,
      doubling: null, // { kind:'kontra'|'re', player } solange vor der ersten Karte gefragt wird
      result: null,
      log: [],
    };
    if (state.special === 'ramsch') startRamsch(state);
    return state;
  }

  function startRamsch(state) {
    state.game = { type: 'ramsch' };
    state.declarer = null;
    state.phase = 'play';
    state.leader = state.turn = state.pos.vorhand;
  }

  /* Reizen
   * Ablauf: Mittelhand sagt Vorhand, der hört (ja/passe). Danach sagt Hinterhand dem Sieger.
   * Hat niemand gereizt, darf Vorhand mit 18 spielen oder passen.
   */
  function biddingTurn(state) {
    const b = state.bidding;
    if (state.phase !== 'bidding') return null;
    if (b.stage === 3) return { player: state.pos.vorhand, role: 'open', value: 18 };
    if (b.waiting === 'say') return { player: b.sayer, role: 'say', value: nextBid(b.value), to: b.listener };
    return { player: b.listener, role: 'hear', value: b.value, from: b.sayer };
  }

  function bidAction(state, yes) {
    const b = state.bidding;
    const t = biddingTurn(state);
    if (!t) throw new Error('Kein Reizen aktiv');
    if (t.role === 'open') {
      b.history.push({ player: t.player, action: yes ? 'bid' : 'pass', value: 18 });
      if (yes) { b.value = 18; return finishBidding(state, t.player); }
      b.out[t.player] = true;
      return allPassed(state);
    }
    if (t.role === 'say') {
      if (yes) {
        if (t.value === null) throw new Error('Höher geht es nicht');
        b.value = t.value;
        b.history.push({ player: t.player, action: 'bid', value: t.value });
        b.waiting = 'hear';
        return t;
      }
      b.history.push({ player: t.player, action: 'pass', value: b.value });
      b.out[t.player] = true;
      return stageWinner(state, b.listener);
    }
    // hear
    if (yes) {
      b.history.push({ player: t.player, action: 'hold', value: b.value });
      b.waiting = 'say';
      return t;
    }
    b.history.push({ player: t.player, action: 'pass', value: b.value });
    b.out[t.player] = true;
    return stageWinner(state, b.sayer);
  }

  function stageWinner(state, winner) {
    const b = state.bidding;
    if (b.stage === 1) {
      b.stage = 2;
      b.sayer = state.pos.hinterhand;
      b.listener = winner;
      b.waiting = 'say';
      return { stage: 2 };
    }
    // Stufe 2 beendet
    if (b.value === 0) {
      // niemand hat gereizt: Vorhand darf 18 spielen
      if (!b.out[state.pos.vorhand]) { b.stage = 3; return { stage: 3 }; }
      return allPassed(state);
    }
    return finishBidding(state, winner);
  }

  function finishBidding(state, declarer) {
    state.declarer = declarer;
    state.bid = state.bidding.value;
    state.phase = 'skat';
    state.log.push({ type: 'declarer', player: declarer, bid: state.bid });
    return { declarer, bid: state.bid };
  }

  function allPassed(state) {
    if (state.rules.mode === 'kneipe') {
      state.allPassed = true;
      startRamsch(state);
      return { ramsch: true };
    }
    state.allPassed = true;
    state.phase = 'done';
    state.result = { passedIn: true, score: [0, 0, 0], text: 'Alle haben gepasst. Neu geben.' };
    return { passedIn: true };
  }

  function takeSkat(state) {
    if (state.phase !== 'skat') throw new Error('Falsche Phase');
    state.hands[state.declarer].push(...state.skat);
    state.skatTaken = true;
    state.phase = 'discard';
  }
  function playHand(state) {
    if (state.phase !== 'skat') throw new Error('Falsche Phase');
    state.skatTaken = false;
    state.phase = 'declare';
  }
  function discard(state, cards) {
    if (state.phase !== 'discard') throw new Error('Falsche Phase');
    if (!cards || cards.length !== 2 || cards[0] === cards[1]) throw new Error('Genau zwei Karten drücken');
    const h = state.hands[state.declarer];
    for (const c of cards) if (!h.includes(c)) throw new Error('Karte nicht auf der Hand: ' + c);
    state.hands[state.declarer] = h.filter((c) => !cards.includes(c));
    state.discarded = cards.slice();
    state.skat = cards.slice();
    state.phase = 'declare';
  }

  // Prüft, ob eine Ansage regelkonform ist.
  function validateDeclaration(state, game) {
    const hand = !state.skatTaken;
    if (!game || !['suit', 'grand', 'null'].includes(game.type)) return 'Unbekanntes Spiel';
    if (game.type === 'suit' && !SUITS.includes(game.trump)) return 'Trumpffarbe fehlt';
    if ((game.schneiderAnnounced || game.schwarzAnnounced) && !hand) return 'Schneider und Schwarz ansagen geht nur beim Handspiel';
    if ((game.schneiderAnnounced || game.schwarzAnnounced) && game.type === 'null') return 'Beim Null gibt es keine Schneider-Ansage';
    if (game.ouvert && game.type !== 'null') return 'Ouvert bieten wir nur beim Null an';
    return null;
  }

  function declare(state, game) {
    if (state.phase !== 'declare') throw new Error('Falsche Phase');
    const g = Object.assign({}, game, { hand: !state.skatTaken });
    const err = validateDeclaration(state, g);
    if (err) throw new Error(err);
    state.game = g;
    state.phase = 'play';
    state.leader = state.turn = state.pos.vorhand;
    state.kontra = false;
    state.re = false;
    state.kontraBy = null;
    state.log.push({ type: 'declare', player: state.declarer, game: g });
    beginDoubling(state);
  }

  /*
   * Kontra und Re, wie sie zur Skatordnung am Tisch üblich sind.
   * Nicht Teil der Turnier-ISkO, aber dieselbe Abrechnung: erst der Spielwert, dann der Faktor.
   * Gegenspieler dürfen Kontra sagen, der Alleinspieler darauf Re.
   * Beides nur bevor die erste Karte des ersten Stichs kommt, gefragt in der Reihenfolge
   * Vorhand, Mittelhand, Hinterhand. Kontra verdoppelt den Spielwert, Re vervierfacht ihn.
   * Ramsch kennt kein Kontra. Wer 18 gehalten hat, ist keine extra Bedingung.
   */
  function defenderOrder(state) {
    const p = state.pos;
    return [p.vorhand, p.mittelhand, p.hinterhand].filter((pl) => pl !== state.declarer);
  }
  function beginDoubling(state) {
    state.doubling = null;
    if (!state.game || state.game.type === 'ramsch' || state.declarer == null) return;
    const defs = defenderOrder(state);
    if (!defs.length) return;
    state.doubling = { kind: 'kontra', player: defs[0] };
  }
  function doublingTurn(state) {
    if (!state || state.phase !== 'play' || !state.doubling) return null;
    if (state.trick.length || state.tricks.length) return null;
    return { kind: state.doubling.kind, player: state.doubling.player };
  }
  function sayKontra(state, player) {
    const t = doublingTurn(state);
    if (!t || t.kind !== 'kontra' || t.player !== player) throw new Error('Kontra ist jetzt nicht dran');
    if (player === state.declarer) throw new Error('Der Alleinspieler sagt kein Kontra');
    state.kontra = true;
    state.kontraBy = player;
    state.doubling = { kind: 're', player: state.declarer };
    state.log.push({ type: 'kontra', player });
  }
  function sayRe(state, player) {
    const t = doublingTurn(state);
    if (!t || t.kind !== 're' || t.player !== player) throw new Error('Re ist jetzt nicht dran');
    if (!state.kontra) throw new Error('Re nur nach Kontra');
    state.re = true;
    state.doubling = null;
    state.log.push({ type: 're', player });
  }
  function declineDouble(state, player) {
    const t = doublingTurn(state);
    if (!t || t.player !== player) throw new Error('Keine Ansage offen');
    state.log.push({ type: t.kind === 're' ? 're-pass' : 'kontra-pass', player });
    if (t.kind === 're') { state.doubling = null; return; }
    const defs = defenderOrder(state);
    const next = defs[defs.indexOf(player) + 1];
    state.doubling = next == null ? null : { kind: 'kontra', player: next };
  }

  function currentTrickCards(state) { return state.trick.map((t) => t.card); }

  function legalFor(state, player) {
    if (state.phase !== 'play' || state.turn !== player) return [];
    return legalCards(state.hands[player], currentTrickCards(state), state.game);
  }

  function playCard(state, player, card) {
    if (state.phase !== 'play') throw new Error('Es wird gerade nicht gespielt');
    if (state.doubling) throw new Error('Kontra und Re kommen vor der ersten Karte');
    if (state.turn !== player) throw new Error('Du bist nicht dran');
    const legal = legalFor(state, player);
    if (!legal.includes(card)) throw new Error('Karte nicht erlaubt: ' + card);
    state.hands[player] = state.hands[player].filter((c) => c !== card);
    state.trick.push({ player, card });
    const info = { player, card, trickComplete: false };
    if (state.trick.length < 3) {
      state.turn = (player + 1) % 3;
      return info;
    }
    const idx = trickWinnerIndex(currentTrickCards(state), state.game);
    const winner = state.trick[idx].player;
    const done = { cards: state.trick.slice(), winner, points: sumPoints(currentTrickCards(state)) };
    state.tricks.push(done);
    state.lastTrick = done;
    state.trick = [];
    state.leader = state.turn = winner;
    info.trickComplete = true;
    info.winner = winner;
    info.trick = done;
    const nullLost = state.game.type === 'null' && winner === state.declarer;
    if (state.tricks.length === 10 || nullLost) {
      state.phase = 'done';
      state.result = computeResult(state);
      info.gameOver = true;
    }
    return info;
  }

  function cardsWonBy(state, player) {
    const out = [];
    for (const t of state.tricks) if (t.winner === player) out.push(...t.cards.map((x) => x.card));
    return out;
  }

  /* ---------- Abrechnung ---------- */

  function computeResult(state) {
    const g = state.game;
    if (g.type === 'ramsch') return computeRamschResult(state);
    const d = state.declarer;
    const declTricks = state.tricks.filter((t) => t.winner === d).length;
    const declCards = cardsWonBy(state, d).concat(state.skat); // Skat gehört dem Alleinspieler
    const declPoints = sumPoints(declCards);
    const allTricksPlayed = state.tricks.length === 10;
    const res = {
      declarer: d,
      game: g,
      bid: state.bid,
      declarerTricks: declTricks,
      declarerPoints: declPoints,
      defenderPoints: 120 - declPoints,
      bock: state.special === 'bock',
    };
    const base = baseValue(g);
    if (g.type === 'null') {
      res.won = declTricks === 0;
      res.value = nullValue(g);
      res.parts = [{ label: gameLabel(g), n: 0 }];
      res.overbid = res.value < state.bid;
      if (res.overbid) { res.won = false; res.value = Math.ceil(state.bid / base) * base; }
    } else {
      const mat = matadors(state.startHands[d].concat(state.originalSkat), g);
      const schneider = declPoints >= 90 || declPoints <= 30;
      const schwarz = allTricksPlayed && (declTricks === 10 || declTricks === 0);
      res.matadors = mat;
      res.schneider = schneider;
      res.schwarz = schwarz;
      const vopts = { game: g, matadors: mat.count, mit: mat.mit, schneider, schwarz };
      res.parts = multiplierParts(vopts);
      res.multiplier = res.parts.reduce((s, p) => s + p.n, 0);
      res.value = calcGameValue(vopts);
      let won = declPoints >= 61;
      if (g.schneiderAnnounced && declPoints < 90) won = false;
      if (g.schwarzAnnounced && declTricks !== 10) won = false;
      res.won = won;
      res.overbid = res.value < state.bid;
      if (res.overbid) {
        res.won = false;
        res.value = Math.ceil(state.bid / base) * base; // nächstes Vielfaches des Grundwerts, das den Reizwert erreicht
      }
    }
    // Kontra ×2, Re ×4 auf den fertigen Spielwert. Verlust und Bock kommen danach.
    res.kontra = !!state.kontra;
    res.re = !!state.re;
    res.kontraBy = state.kontra ? state.kontraBy : null;
    res.factor = state.kontra ? (state.re ? 4 : 2) : 1;
    res.value *= res.factor;
    let s = res.won ? res.value : -2 * res.value; // Seeger-Fabian vereinfacht
    if (res.bock) s *= 2;
    res.scoreChange = s;
    res.score = [0, 0, 0];
    res.score[d] = s;
    return res;
  }

  // Ramsch: Skat geht an den Gewinner des letzten Stichs. Wer die meisten Augen hat, verliert sie.
  function computeRamschResult(state) {
    const last = state.tricks[state.tricks.length - 1];
    const pts = [0, 1, 2].map((p) => sumPoints(cardsWonBy(state, p)));
    pts[last.winner] += sumPoints(state.skat);
    const tricksCount = [0, 1, 2].map((p) => state.tricks.filter((t) => t.winner === p).length);
    const res = { ramsch: true, points: pts, tricks: tricksCount, score: [0, 0, 0], bock: state.special === 'bock' };
    const durch = tricksCount.findIndex((n) => n === 10);
    if (durch >= 0) {
      res.durchmarsch = durch;
      res.score[durch] = 120;
    } else {
      const max = Math.max(...pts);
      const losers = [0, 1, 2].filter((p) => pts[p] === max);
      const jungfrau = tricksCount.filter((n) => n === 0).length;
      res.losers = losers;
      res.jungfrau = jungfrau;
      for (const l of losers) res.score[l] = -max * Math.pow(2, jungfrau);
    }
    if (res.bock) res.score = res.score.map((x) => x * 2);
    return res;
  }

  /* ---------- Sicht eines Spielers (für KI und Tipps) ----------
   * Enthält nur Informationen, die dieser Spieler am echten Tisch kennen würde:
   * eigene Karten, Reizverlauf, Ansage, gespielte Karten, und den Skat nur, wenn er ihn selbst aufgenommen hat.
   * Bei Null Ouvert liegen die Karten des Alleinspielers offen und sind daher öffentlich.
   */
  function viewFor(state, player) {
    const v = {
      me: player,
      hand: state.hands[player].slice(),
      dealer: state.dealer,
      pos: Object.assign({}, state.pos),
      phase: state.phase,
      bidValue: state.bidding.value,
      bidHistory: state.bidding.history.slice(),
      declarer: state.declarer,
      bid: state.bid,
      game: state.game ? Object.assign({}, state.game) : null,
      trick: state.trick.map((t) => ({ player: t.player, card: t.card })),
      tricks: state.tricks.map((t) => ({ cards: t.cards.map((x) => ({ player: x.player, card: x.card })), winner: t.winner })),
      handSizes: state.hands.map((h) => h.length),
      special: state.special,
      kontra: !!state.kontra,
      re: !!state.re,
      doubling: state.doubling ? { kind: state.doubling.kind, player: state.doubling.player } : null,
    };
    if (player === state.declarer && state.skatTaken) v.skatKnown = state.skat.slice();
    if (state.game && state.game.type === 'null' && state.game.ouvert && state.phase === 'play' && player !== state.declarer) {
      v.openHand = state.hands[state.declarer].slice();
    }
    return v;
  }

  /* ---------- Partie über mehrere Spiele (Punkteliste, Bock und Ramsch) ---------- */

  function Match(opts) {
    opts = opts || {};
    this.rules = Object.assign({ mode: 'official' }, opts.rules || {});
    this.scores = [0, 0, 0];
    this.dealer = opts.dealer != null ? opts.dealer : 2;
    this.queue = []; // anstehende Sonderspiele (Kneipenskat): 'bock' oder 'ramsch'
    this.history = [];
    this.gameNo = 0;
  }
  Match.prototype.nextSpecial = function () {
    return this.rules.mode === 'kneipe' && this.queue.length ? this.queue[0] : null;
  };
  Match.prototype.start = function (rng, deck) {
    this.dealer = (this.dealer + 1) % 3;
    this.gameNo++;
    const special = this.rules.mode === 'kneipe' ? this.queue.shift() || null : null;
    this.current = newGame({ dealer: this.dealer, rng, rules: this.rules, special, deck });
    return this.current;
  };
  Match.prototype.record = function (state) {
    const r = state.result;
    if (!r) throw new Error('Spiel noch nicht beendet');
    for (let i = 0; i < 3; i++) this.scores[i] += r.score[i];
    let bockAdded = false;
    if (this.rules.mode === 'kneipe' && !r.ramsch && !r.passedIn && r.game && r.game.type === 'grand' && !r.won) {
      // Verlorener Grand: drei Bockspiele, danach drei Ramschspiele
      this.queue.push('bock', 'bock', 'bock', 'ramsch', 'ramsch', 'ramsch');
      bockAdded = true;
    }
    this.history.push({ no: this.gameNo, dealer: state.dealer, special: state.special, result: r, totals: this.scores.slice() });
    return { bockAdded };
  };

  /* ---------- Rundenziel ("Spielen bis") ----------
   * target: 'none' | '301' | '501' | 'custom' (custom = eigene Zahl, 51 bis 2001)
   */
  const TARGET_MIN = 51, TARGET_MAX = 2001;
  function normalizeTarget(target, custom) {
    if (!target || target === 'none') return null;
    if (target === 'custom') {
      const n = Math.round(Number(custom));
      if (!isFinite(n)) return null;
      return Math.max(TARGET_MIN, Math.min(TARGET_MAX, n));
    }
    const n = Math.round(Number(target));
    return isFinite(n) && n > 0 ? Math.max(TARGET_MIN, Math.min(TARGET_MAX, n)) : null;
  }
  // Sieger der Runde: wer das Ziel erreicht oder überschritten hat und allein vorn liegt.
  // Gleichstand an der Spitze: weiterspielen, bis einer vorn liegt. Ohne Ziel: nie ein Sieger.
  function sessionWinner(scores, target) {
    if (!target) return null;
    const max = Math.max.apply(null, scores);
    if (max < target) return null;
    const top = [0, 1, 2].filter((p) => scores[p] === max);
    return top.length === 1 ? top[0] : null;
  }
  // Platzierung (Index-Liste, beste zuerst)
  function standings(scores) { return [0, 1, 2].sort((a, b) => scores[b] - scores[a] || a - b); }

  return {
    SUITS, RANKS, SUIT_NAMES, SUIT_SYMBOLS, RANK_NAMES, RANK_SHORT, POINTS, BASE, NULL_VALUES, BID_VALUES, POSITION_NAMES, JACK_ORDER,
    suitOf, rankOf, points, sumPoints, isJack, cardName, cardShort,
    createDeck, shuffle, seededRng, cryptoRng, deal, positions, positionName,
    effSuit, power, isTrump, trumpOrder, beats, trickWinnerIndex, legalCards, sortHand,
    matadors, baseValue, nullValue, calcGameValue, multiplierParts, nextBid, gameLabel,
    newGame, biddingTurn, bidAction, takeSkat, playHand, discard, declare, validateDeclaration,
    defenderOrder, doublingTurn, sayKontra, sayRe, declineDouble,
    legalFor, playCard, computeResult, cardsWonBy, viewFor, Match,
    TARGET_MIN, TARGET_MAX, normalizeTarget, sessionWinner, standings,
  };
});
