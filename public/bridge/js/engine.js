/*
 * Rubber Bridge, Chicago als Schalter.
 * Sitze im Uhrzeigersinn: 0 Süden (Mensch), 1 Westen, 2 Norden, 3 Osten.
 * Teams: Süden+Norden gegen Westen+Osten.
 *
 * Natürliches Kontrakt-Bridge. Reizung im Uhrzeigersinn, der Geber beginnt.
 * Ein Gebot muss höher sein (Kreuz < Karo < Herz < Pik < Sans Atout).
 * Kontra nur auf ein Gebot der Gegenseite, Rekontra nur auf ein Kontra der eigenen.
 * Drei Passen nach einem Gebot schließen die Reizung. Vier Passen ohne Gebot:
 * das Blatt wird neu gegeben, der nächste Geber ist dran.
 *
 * Alleinspieler ist, wer auf der Seite des letzten Gebots die Farbe
 * (oder Sans Atout) zuerst genannt hat. Ausspiel: links vom Alleinspieler.
 * Der Strohmann wird nach dem Ausspiel aufgedeckt.
 *
 * Rubber: Punkte unter dem Strich nur für die angesagten Stiche.
 *   Niedrige Farbe 20, Oberfarbe 30, Sans Atout 40 für den ersten und 30 weiter.
 *   Kontra verdoppelt, Rekontra vervierfacht. Ab 100 unter dem Strich ist ein Spiel,
 *   die Seite ist danach gefährdet, der laufende Strich beginnt bei null.
 *   Überstiche, Strafen, Prämien und Ehrenpunkte stehen über dem Strich.
 *   Rubber-Prämie 700, wenn die Gegner ein Spiel haben, sonst 500.
 * Chicago (Vier-Blatt): Blatt 1 niemand gefährdet, Blatt 2 und 3 die Geberseite,
 *   ab Blatt 4 beide. Teilpunkt bringt 50, ein Spiel 300 bzw. 500. Kein Übertrag.
 *   Bei Gleichstand nach vier Blättern wird mit beider Gefahr weitergespielt.
 * Strafen (modern): unkontra 50/100, Kontra nicht gefährdet 100/200/200/300…,
 *   Kontra gefährdet 200/300…, Rekontra das Doppelte.
 * Ehrenpunkte sind abschaltbar: vier Trümpfe AKDB10 in einer Hand 100,
 *   fünf 150, vier Asse bei Sans Atout 150.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BridgeEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var RANK_VALUE = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
  var RANK_HCP = { A: 4, K: 3, Q: 2, J: 1 };
  var RANK_NAME = { A: 'Ass', K: 'König', Q: 'Dame', J: 'Bube', '10': '10', '9': '9', '8': '8', '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2' };
  var SUITS = ['C', 'D', 'H', 'S'];
  var SUIT_NAME = ['Kreuz', 'Karo', 'Herz', 'Pik'];
  var STRAINS = ['C', 'D', 'H', 'S', 'NT'];
  var STRAIN_SUIT = { C: 0, D: 1, H: 2, S: 3 };
  var STRAIN_RANK = { C: 0, D: 1, H: 2, S: 3, NT: 4 };
  var STRAIN_NAME = { C: 'Kreuz', D: 'Karo', H: 'Herz', S: 'Pik', NT: 'Sans Atout' };
  var STRAIN_SHORT = { C: '♣', D: '♦', H: '♥', S: '♠', NT: 'SA' };
  var PLACE = ['Süd', 'West', 'Nord', 'Ost'];

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function asRng(rng) {
    if (typeof rng === 'function') return rng;
    if (typeof rng === 'number') return mulberry32(rng);
    return Math.random;
  }

  function teamOf(seat) { return seat % 2; }
  function partnerOf(seat) { return (seat + 2) % 4; }
  function nextSeat(seat) { return (seat + 1) % 4; }

  function makeCard(suit, rank) {
    return { suit: suit, rank: rank, id: suit + ':' + rank };
  }

  function parseCode(code) {
    var parts = String(code).split(':');
    var suit = STRAIN_SUIT[parts[0]];
    if (suit == null || !RANK_VALUE[parts[1]]) throw new Error('Unbekannte Karte ' + code);
    return makeCard(suit, parts[1]);
  }

  function makeHand(codes) {
    return (codes || []).map(parseCode);
  }

  function freshDeck() {
    var cards = [];
    for (var s = 0; s < 4; s++) {
      for (var i = 0; i < RANKS.length; i++) cards.push(makeCard(s, RANKS[i]));
    }
    return cards;
  }

  function shuffle(cards, rng) {
    var a = cards.slice();
    var random = asRng(rng);
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function hcp(hand) {
    var n = 0;
    for (var i = 0; i < hand.length; i++) n += RANK_HCP[hand[i].rank] || 0;
    return n;
  }

  function lengths(hand) {
    var n = [0, 0, 0, 0];
    for (var i = 0; i < hand.length; i++) n[hand[i].suit] += 1;
    return n;
  }

  function pattern(hand) {
    return lengths(hand).slice().sort(function (a, b) { return b - a; });
  }

  function isBalanced(hand) {
    var p = pattern(hand).join('');
    return p === '4333' || p === '4432' || p === '5332';
  }

  function cardName(card) {
    return RANK_NAME[card.rank] + ' ' + SUIT_NAME[card.suit];
  }

  function bidRank(level, strain) {
    return level * 5 + STRAIN_RANK[strain];
  }

  function callLabel(call) {
    if (!call) return '';
    if (call.kind === 'pass') return 'Passen';
    if (call.kind === 'double') return 'Kontra';
    if (call.kind === 'redouble') return 'Rekontra';
    return call.level + ' ' + STRAIN_NAME[call.strain];
  }

  var LEVEL_WORD = { 1: 'Eins', 2: 'Zwei', 3: 'Drei', 4: 'Vier', 5: 'Fünf', 6: 'Sechs', 7: 'Sieben' };
  function spokenCall(call) {
    if (!call) return '';
    if (call.kind === 'pass') return 'Passen.';
    if (call.kind === 'double') return 'Kontra.';
    if (call.kind === 'redouble') return 'Rekontra.';
    var level = LEVEL_WORD[call.level] || '';
    var strain = call.strain === 'NT' ? 'ohne Trumpf' : (STRAIN_NAME[call.strain] || '');
    if (!level || !strain) return 'Ich reize.';
    return level + ' ' + strain + '.';
  }

  function callShort(call) {
    if (!call) return '';
    if (call.kind === 'pass') return 'Pass';
    if (call.kind === 'double') return 'X';
    if (call.kind === 'redouble') return 'XX';
    return call.level + STRAIN_SHORT[call.strain];
  }

  function contractLabel(contract) {
    if (!contract) return '';
    var extra = contract.doubled === 2 ? ' Rekontra' : contract.doubled === 1 ? ' Kontra' : '';
    return contract.level + ' ' + STRAIN_NAME[contract.strain] + extra;
  }

  function normalizeCall(spec) {
    if (!spec || spec.kind === 'pass') return { kind: 'pass' };
    if (spec.kind === 'double') return { kind: 'double' };
    if (spec.kind === 'redouble') return { kind: 'redouble' };
    return { kind: 'bid', level: Number(spec.level), strain: spec.strain };
  }

  function sameCall(a, b) {
    if (!a || !b) return false;
    if (a.kind !== b.kind) return false;
    if (a.kind === 'bid') return a.level === b.level && a.strain === b.strain;
    return true;
  }

  function contractProgress(auction) {
    var last = null;
    var doubled = 0;
    for (var i = 0; i < auction.length; i++) {
      var kind = auction[i].call.kind;
      if (kind === 'bid') { last = auction[i]; doubled = 0; }
      else if (kind === 'double') doubled = 1;
      else if (kind === 'redouble') doubled = 2;
    }
    return { last: last, doubled: doubled };
  }

  function legalCalls(state, seat) {
    var prog = contractProgress(state.auction);
    var bids = [];
    var floor = prog.last ? bidRank(prog.last.call.level, prog.last.call.strain) : 0;
    for (var level = 1; level <= 7; level++) {
      for (var i = 0; i < STRAINS.length; i++) {
        var strain = STRAINS[i];
        if (bidRank(level, strain) > floor) bids.push({ level: level, strain: strain });
      }
    }
    var canDouble = !!(prog.last && doubledSide(prog) === 0 && teamOf(prog.last.seat) !== teamOf(seat));
    var canRedouble = !!(prog.last && prog.doubled === 1 && teamOf(prog.last.seat) === teamOf(seat));
    return { pass: true, double: canDouble, redouble: canRedouble, bids: bids };
  }

  function doubledSide(prog) {
    return prog.doubled;
  }

  function callAllowed(legal, spec) {
    var call = normalizeCall(spec);
    if (call.kind === 'pass') return !!legal.pass;
    if (call.kind === 'double') return !!legal.double;
    if (call.kind === 'redouble') return !!legal.redouble;
    if (call.kind !== 'bid' || !legal.bids) return false;
    for (var i = 0; i < legal.bids.length; i++) {
      if (legal.bids[i].level === call.level && legal.bids[i].strain === call.strain) return true;
    }
    return false;
  }

  function isPassedOut(state) {
    if (state.auction.length !== 4) return false;
    if (contractProgress(state.auction).last) return false;
    return state.auction.every(function (entry) { return entry.call.kind === 'pass'; });
  }

  function auctionClosed(state) {
    var prog = contractProgress(state.auction);
    if (!prog.last || state.auction.length < 4) return false;
    var tail = state.auction.slice(-3);
    return tail.every(function (entry) { return entry.call.kind === 'pass'; });
  }

  function findDeclarer(auction, strain, team) {
    for (var i = 0; i < auction.length; i++) {
      var entry = auction[i];
      if (entry.call.kind === 'bid' && entry.call.strain === strain && teamOf(entry.seat) === team) return entry.seat;
    }
    return null;
  }

  function trickWinner(trick, strain) {
    var lead = trick[0].card.suit;
    var trump = strain === 'NT' ? -1 : STRAIN_SUIT[strain];
    var best = 0;
    for (var i = 1; i < trick.length; i++) {
      if (beats(trick[i].card, trick[best].card, lead, trump)) best = i;
    }
    return trick[best].seat;
  }

  function beats(card, other, lead, trump) {
    var cardTrump = card.suit === trump;
    var otherTrump = other.suit === trump;
    if (cardTrump !== otherTrump) return cardTrump;
    if (cardTrump && otherTrump) return RANK_VALUE[card.rank] > RANK_VALUE[other.rank];
    if (card.suit !== lead) return false;
    if (other.suit !== lead) return true;
    return RANK_VALUE[card.rank] > RANK_VALUE[other.rank];
  }

  function legalCards(state, seat) {
    var hand = state.hands[seat] || [];
    if (!state.trick.length) return hand.slice();
    var lead = state.trick[0].card.suit;
    var follow = hand.filter(function (card) { return card.suit === lead; });
    return follow.length ? follow : hand.slice();
  }

  function fail(message) { return { ok: false, error: message }; }
  function done(events) { return { ok: true, events: events || [] }; }

  function vulnOf(state, team) {
    return !!(state.vuln && state.vuln[team]);
  }

  function setVuln(state) {
    if (state.mode === 'chicago') {
      var deal = state.chicago.deal;
      var dealerTeam = teamOf(state.dealer);
      state.vuln = [false, false];
      if (deal === 2 || deal === 3) state.vuln[dealerTeam] = true;
      else if (deal >= 4) state.vuln = [true, true];
      return;
    }
    state.vuln = [!!state.rubber.vulnerable[0], !!state.rubber.vulnerable[1]];
  }

  function deal(state, rng) {
    var deck = shuffle(freshDeck(), rng);
    state.hands = [[], [], [], []];
    for (var i = 0; i < deck.length; i++) state.hands[i % 4].push(deck[i]);
    state.dealt = state.hands.map(function (hand) { return hand.slice(); });
    state.phase = 'bidding';
    state.turn = state.dealer;
    state.auction = [];
    state.contract = null;
    state.trick = [];
    state.lastTrick = null;
    state.tricks = [];
    state.tricksWon = [0, 0];
    state.dummyVisible = false;
    state.cardsPlayed = 0;
    state.result = null;
    setVuln(state);
    return state;
  }

  function emptyRubber() {
    return {
      games: [0, 0],
      vulnerable: [false, false],
      above: [0, 0],
      currentBelow: [0, 0],
      total: [0, 0],
      history: []
    };
  }

  function newTable(opts, rng) {
    opts = opts || {};
    var dealer = opts.dealer == null ? 0 : ((opts.dealer % 4) + 4) % 4;
    var state = {
      mode: opts.mode === 'chicago' ? 'chicago' : 'rubber',
      honours: !!opts.honours,
      dealer: dealer,
      rubber: emptyRubber(),
      chicago: { deal: 1, scores: [0, 0], history: [] },
      history: []
    };
    return deal(state, rng);
  }

  function honourScore(hands, strain) {
    var points = [0, 0];
    if (!strain || !hands) return points;
    if (strain === 'NT') {
      for (var seat = 0; seat < 4; seat++) {
        var aces = (hands[seat] || []).filter(function (card) { return card.rank === 'A'; }).length;
        if (aces === 4) points[teamOf(seat)] += 150;
      }
      return points;
    }
    var trump = STRAIN_SUIT[strain];
    var honour = { A: 1, K: 1, Q: 1, J: 1, '10': 1 };
    for (var s = 0; s < 4; s++) {
      var n = (hands[s] || []).filter(function (card) { return card.suit === trump && honour[card.rank]; }).length;
      if (n >= 5) points[teamOf(s)] += 150;
      else if (n === 4) points[teamOf(s)] += 100;
    }
    return points;
  }

  function trickScore(level, strain) {
    if (strain === 'NT') return 40 + 30 * (level - 1);
    var each = strain === 'H' || strain === 'S' ? 30 : 20;
    return each * level;
  }

  function doubledFactor(doubled) {
    if (doubled === 2) return 4;
    if (doubled === 1) return 2;
    return 1;
  }

  function undertrickPenalty(under, doubled, vulnerable) {
    if (under <= 0) return 0;
    if (!doubled) return (vulnerable ? 100 : 50) * under;
    var base;
    if (!vulnerable) {
      base = 100;
      if (under >= 2) base += 200;
      if (under >= 3) base += 200;
      if (under >= 4) base += 300 * (under - 3);
    } else {
      base = 200 + 300 * (under - 1);
    }
    return doubled === 2 ? base * 2 : base;
  }

  function overtrickPoints(strain, over, doubled, vulnerable) {
    if (over <= 0) return 0;
    if (!doubled) {
      var each = strain === 'C' || strain === 'D' ? 20 : 30;
      return each * over;
    }
    var one = doubled === 2 ? (vulnerable ? 400 : 200) : (vulnerable ? 200 : 100);
    return one * over;
  }

  function evaluate(contract, tricks, vulnerable, mode) {
    var needed = contract.level + 6;
    var made = tricks >= needed;
    var over = made ? tricks - needed : 0;
    var under = made ? 0 : needed - tricks;
    var below = made ? trickScore(contract.level, contract.strain) * doubledFactor(contract.doubled) : 0;
    var above = 0;
    var penalty = 0;
    var slam = 0;
    var insult = 0;
    if (made) {
      above += overtrickPoints(contract.strain, over, contract.doubled, vulnerable);
      if (contract.doubled === 1) insult = 50;
      if (contract.doubled === 2) insult = 100;
      above += insult;
      if (contract.level === 6) slam = vulnerable ? 750 : 500;
      if (contract.level === 7) slam = vulnerable ? 1500 : 1000;
      above += slam;
    } else {
      penalty = undertrickPenalty(under, contract.doubled, vulnerable);
    }
    var gameBonus = 0;
    var partBonus = 0;
    if (mode === 'chicago' && made) {
      if (below >= 100) gameBonus = vulnerable ? 500 : 300;
      else partBonus = 50;
    }
    return {
      made: made,
      needed: needed,
      over: over,
      under: under,
      below: below,
      above: above,
      penalty: penalty,
      slam: slam,
      insult: insult,
      gameBonus: gameBonus,
      partBonus: partBonus,
      tricks: tricks,
      game: made && below >= 100
    };
  }

  function resultText(contract, scored, passed) {
    if (passed) return 'Alle haben gepasst.';
    var bits = [contractLabel(contract)];
    if (!scored.made) bits.push(scored.under === 1 ? '1 zu wenig' : scored.under + ' zu wenig');
    else if (scored.over) bits.push(scored.over === 1 ? '1 drüber' : scored.over + ' drüber');
    else bits.push('genau');
    if (scored.game) bits.push('Spiel');
    else if (scored.made) bits.push('Teilpunkt');
    return bits.join(', ');
  }

  function scoreDeal(state, declarerTricks) {
    var contract = state.contract;
    var decl = teamOf(contract.declarer);
    var def = 1 - decl;
    var vulnerable = vulnOf(state, decl);
    var scored = evaluate(contract, declarerTricks, vulnerable, state.mode);
    var honours = state.honours ? honourScore(state.dealt, contract.strain) : [0, 0];
    var before = state.mode === 'chicago' ? state.chicago.scores.slice() : state.rubber.total.slice();
    var rubberBonus = 0;
    var madeGame = !!scored.game;

    if (state.mode === 'chicago') {
      state.chicago.scores[0] += honours[0];
      state.chicago.scores[1] += honours[1];
      state.chicago.scores[decl] += scored.below + scored.above + scored.gameBonus + scored.partBonus;
      state.chicago.scores[def] += scored.penalty;
      var tiedLater = state.chicago.deal >= 4 && state.chicago.scores[0] === state.chicago.scores[1];
      if (state.chicago.deal >= 4 && !tiedLater) {
        state.phase = 'match';
        state.winner = state.chicago.scores[0] > state.chicago.scores[1] ? 0 : 1;
      } else if (state.chicago.deal >= 8 && tiedLater) {
        state.phase = 'match';
        state.winner = null;
      } else state.phase = 'scored';
    } else {
      state.rubber.total[decl] += scored.below + scored.above;
      state.rubber.total[def] += scored.penalty;
      state.rubber.total[0] += honours[0];
      state.rubber.total[1] += honours[1];
      state.rubber.above[decl] += scored.above + honours[decl];
      state.rubber.above[def] += scored.penalty + honours[def];
      state.rubber.currentBelow[decl] += scored.below;
      madeGame = state.rubber.currentBelow[decl] >= 100;
      if (madeGame) {
        state.rubber.games[decl] += 1;
        state.rubber.vulnerable[decl] = true;
        if (state.rubber.games[decl] >= 2) {
          rubberBonus = state.rubber.vulnerable[def] ? 700 : 500;
          state.rubber.above[decl] += rubberBonus;
          state.rubber.total[decl] += rubberBonus;
          state.phase = 'match';
          state.winner = decl;
        }
        state.rubber.currentBelow = [0, 0];
      }
      if (state.phase !== 'match') state.phase = 'scored';
    }

    var after = state.mode === 'chicago' ? state.chicago.scores : state.rubber.total;
    scored.game = madeGame;
    var row = {
      passed: false,
      text: resultText(contract, scored, false),
      contract: contractLabel(contract),
      declarer: contract.declarer,
      tricks: declarerTricks,
      made: scored.made,
      game: scored.game,
      below: scored.below,
      above: scored.above,
      penalty: scored.penalty,
      honours: honours.slice(),
      rubberBonus: rubberBonus,
      gameBonus: scored.gameBonus,
      partBonus: scored.partBonus,
      ns: after[0] - before[0],
      ew: after[1] - before[1],
      vuln: state.vuln.slice()
    };
    state.result = row;
    state.history.push(row);
    if (state.mode === 'chicago') state.chicago.history.push(row);
    else state.rubber.history.push(row);
    return row;
  }

  function passOut(state) {
    var row = { passed: true, text: 'Alle haben gepasst.', ns: 0, ew: 0, contract: '', tricks: 0, made: false, game: false, rubberBonus: 0 };
    state.result = row;
    state.history.push(row);
    state.phase = 'passed';
    return row;
  }

  function settleContract(state) {
    var prog = contractProgress(state.auction);
    var bid = prog.last;
    var declarer = findDeclarer(state.auction, bid.call.strain, teamOf(bid.seat));
    state.contract = {
      level: bid.call.level,
      strain: bid.call.strain,
      doubled: prog.doubled,
      declarer: declarer,
      dummy: partnerOf(declarer),
      leader: nextSeat(declarer)
    };
    state.phase = 'play';
    state.turn = state.contract.leader;
    state.trick = [];
    state.tricks = [];
    state.tricksWon = [0, 0];
    state.dummyVisible = false;
    state.cardsPlayed = 0;
  }

  function call(state, seat, spec) {
    if (!state || state.phase !== 'bidding') return fail('Jetzt wird nicht gereizt.');
    if (seat !== state.turn) return fail('Du bist nicht an der Reihe.');
    var legal = legalCalls(state, seat);
    if (!callAllowed(legal, spec)) return fail('Das Gebot ist nicht erlaubt.');
    var normalized = normalizeCall(spec);
    state.auction.push({ seat: seat, call: normalized });
    var events = [{ type: 'call', seat: seat, call: normalized }];
    if (isPassedOut(state)) {
      passOut(state);
      events.push({ type: 'passed' });
      return done(events);
    }
    if (auctionClosed(state)) {
      settleContract(state);
      events.push({ type: 'contract', contract: state.contract });
      return done(events);
    }
    state.turn = nextSeat(seat);
    return done(events);
  }

  function takeCard(hand, cardId) {
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].id === cardId) return hand.splice(i, 1)[0];
    }
    return null;
  }

  function playCard(state, seat, cardId) {
    if (!state || state.phase !== 'play') return fail('Jetzt wird nicht gespielt.');
    if (seat !== state.turn) return fail('Du bist nicht an der Reihe.');
    var owned = false;
    for (var h = 0; h < state.hands[seat].length; h++) if (state.hands[seat][h].id === cardId) owned = true;
    if (!owned) return fail('Die Karte ist nicht auf der Hand.');
    var legal = legalCards(state, seat);
    var allowed = false;
    for (var i = 0; i < legal.length; i++) if (legal[i].id === cardId) allowed = true;
    if (!allowed) return fail('Die Farbe ist zu bedienen.');
    var card = takeCard(state.hands[seat], cardId);
    var opening = state.cardsPlayed === 0;
    state.trick.push({ seat: seat, card: card });
    state.cardsPlayed += 1;
    if (opening) state.dummyVisible = true;
    var events = [{ type: 'play', seat: seat, card: card }];
    if (state.trick.length < 4) {
      state.turn = nextSeat(seat);
      return done(events);
    }
    var winner = trickWinner(state.trick, state.contract.strain);
    var cards = state.trick.slice();
    state.tricks.push({ winner: winner, cards: cards });
    state.tricksWon[teamOf(winner)] += 1;
    state.lastTrick = cards;
    state.trick = [];
    events.push({ type: 'trick', winner: winner, cards: cards });
    if (state.tricks.length === 13) {
      var declarerTricks = state.tricksWon[teamOf(state.contract.declarer)];
      scoreDeal(state, declarerTricks);
      events.push({ type: 'handEnd', result: state.result });
      return done(events);
    }
    state.turn = winner;
    return done(events);
  }

  function nextHand(state, rng) {
    if (!state || state.phase === 'match' || state.phase === 'bidding' || state.phase === 'play') {
      return fail('Das nächste Blatt gibt es erst nach diesem.');
    }
    state.dealer = nextSeat(state.dealer);
    if (state.mode === 'chicago') state.chicago.deal += 1;
    deal(state, rng);
    return done([{ type: 'deal', dealer: state.dealer }]);
  }

  function fromAuction(opts) {
    opts = opts || {};
    var state = newTable({
      mode: opts.mode,
      honours: opts.honours,
      dealer: opts.dealer == null ? 0 : opts.dealer
    }, opts.rng == null ? 1 : opts.rng);
    if (opts.hands) {
      state.hands = opts.hands.map(function (codes) { return makeHand(codes); });
      state.dealt = state.hands.map(function (hand) { return hand.slice(); });
    }
    var calls = opts.calls || [];
    for (var i = 0; i < calls.length; i++) {
      var res = call(state, state.turn, calls[i]);
      if (!res.ok) throw new Error(res.error);
    }
    return state;
  }

  function demo(kind) {
    if (kind === 'play') return demoPlay();
    return demoBid();
  }

  function demoBid() {
    var south = ['S:A', 'S:K', 'S:J', 'S:9', 'S:4', 'H:A', 'H:Q', 'H:3', 'D:K', 'D:6', 'D:2', 'C:8', 'C:5'];
    var west = ['S:Q', 'S:6', 'H:J', 'H:8', 'H:2', 'D:A', 'D:9', 'D:4', 'C:A', 'C:J', 'C:7', 'C:4', 'C:2'];
    var north = ['S:10', 'S:5', 'H:K', 'H:10', 'H:6', 'H:4', 'D:Q', 'D:8', 'D:3', 'C:K', 'C:9', 'C:6', 'C:3'];
    var east = ['S:8', 'S:7', 'S:3', 'S:2', 'H:9', 'H:7', 'H:5', 'D:J', 'D:10', 'D:7', 'D:5', 'C:Q', 'C:10'];
    return fromAuction({ dealer: 0, hands: [south, west, north, east], calls: [] });
  }

  function demoPlay() {
    var south = ['S:A', 'S:8', 'S:4', 'H:A', 'H:Q', 'H:8', 'H:5', 'D:6', 'D:3', 'C:A', 'C:7', 'C:4', 'C:2'];
    var west = ['S:K', 'S:9', 'S:3', 'H:6', 'H:2', 'D:A', 'D:J', 'D:8', 'D:2', 'C:Q', 'C:10', 'C:6', 'C:3'];
    var north = ['S:Q', 'S:7', 'H:K', 'H:J', 'H:10', 'H:4', 'D:K', 'D:9', 'D:5', 'C:K', 'C:9', 'C:8', 'C:5'];
    var east = ['S:J', 'S:10', 'S:6', 'S:5', 'S:2', 'H:9', 'H:7', 'H:3', 'D:Q', 'D:10', 'D:7', 'D:4', 'C:J'];
    var state = fromAuction({
      dealer: 0,
      hands: [south, west, north, east],
      calls: [
        { kind: 'bid', level: 1, strain: 'H' },
        { kind: 'pass' },
        { kind: 'bid', level: 4, strain: 'H' },
        { kind: 'pass' },
        { kind: 'pass' },
        { kind: 'pass' }
      ]
    });
    playCard(state, state.turn, '1:J');
    return state;
  }

  return {
    RANKS: RANKS,
    SUIT_NAME: SUIT_NAME,
    STRAINS: STRAINS,
    STRAIN_NAME: STRAIN_NAME,
    STRAIN_SHORT: STRAIN_SHORT,
    PLACE: PLACE,
    mulberry32: mulberry32,
    teamOf: teamOf,
    partnerOf: partnerOf,
    nextSeat: nextSeat,
    makeCard: makeCard,
    parseCode: parseCode,
    makeHand: makeHand,
    freshDeck: freshDeck,
    shuffle: shuffle,
    hcp: hcp,
    lengths: lengths,
    pattern: pattern,
    isBalanced: isBalanced,
    cardName: cardName,
    bidRank: bidRank,
    callLabel: callLabel,
    spokenCall: spokenCall,
    callShort: callShort,
    contractLabel: contractLabel,
    legalCalls: legalCalls,
    callAllowed: callAllowed,
    legalCards: legalCards,
    trickWinner: trickWinner,
    honourScore: honourScore,
    evaluate: evaluate,
    newTable: newTable,
    deal: deal,
    call: call,
    playCard: playCard,
    nextHand: nextHand,
    scoreDeal: scoreDeal,
    fromAuction: fromAuction,
    demo: demo,
    sameCall: sameCall
  };
});
