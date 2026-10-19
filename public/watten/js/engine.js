/*
 * Spiel-Freunde Watten: kritisches Viererwatten aus Bayern und Tirol.
 * Sitze im Uhrzeigersinn: 0 Süden Du, 1 Westen, 2 Norden Partner, 3 Osten.
 * Teams: Du+Nord gegen West+Ost. Vorhand sitzt links vom Geber.
 *
 * Hausregeln dieser Ausgabe, an den verbreiteten Stammtisch angelehnt:
 *   Fünf Karten. Standard ist das 33er Blatt mit Weli, umschaltbar auf 32.
 *   Kritische, von hoch nach niedrig: Max (Herz-König), Belle, Spitz.
 *   Belle ist im bayerischen Satz die Schellen-Sieben, im Tiroler Satz der Weli.
 *   Spitz ist die Eichel-Sieben. Danach die Schläge: die Haube (Schlag der
 *   Trumpffarbe) sticht die übrigen Schläge, untereinander gilt die zuerst
 *   gespielte. Dann Trumpf Ass bis Sieben. Der Weli ist sonst die kleinste Schelle.
 *   Kein Farbzwang. Ausnahme: die Haube als erste Karte des Spiels verlangt
 *   „Trumpf oder Kritisch“, bis ein Kritischer fällt.
 *   Vorhand sagt den Schlag an, der Geber die Farbe. Schlagwechsel ist möglich.
 *   Drei Stiche gewinnen. Grundwert 2. Bieten erhöht um eins, abwechselnd.
 *   Wer nicht hält und geht, gibt dem Bieter den bisherigen Wert.
 *   Ziel 15, auch 13. Ab zwei Punkten vor dem Ziel ist man gespannt:
 *   nicht mehr bieten, das Spiel gilt 3, und die gespannte Partei darf gehen
 *   (die andere schreibt dann 2). Drei Kritische auf einer Hand sind eine
 *   Maschine und gewinnen sofort mit 2.
 *   Nicht in dieser Ausgabe: Schlecken, Schönere, Blind ansagen, Pfeffer.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WattenEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RANKS = ['A', 'K', 'O', 'U', '10', '9', '8', '7'];
  var SUITS = ['Eichel', 'Gras', 'Herz', 'Schellen'];
  var RANK_NAME = {
    A: 'Ass', K: 'König', O: 'Ober', U: 'Unter',
    '10': 'Zehner', '9': 'Neuner', '8': 'Achter', '7': 'Siebener', W: 'Weli'
  };
  var TRUMP_POWER = { A: 8, K: 7, O: 6, U: 5, '10': 4, '9': 3, '8': 2, '7': 1, W: 0 };

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

  function teamOf(seat) { return seat % 2; }
  function nextSeat(seat) { return (seat + 1) % 4; }
  function partnerOf(seat) { return (seat + 2) % 4; }

  function makeCard(suit, rank) {
    return { suit: suit, rank: rank, id: String(suit) + rank };
  }

  function makeWeli() {
    return { suit: 3, rank: 'W', id: 'W', weli: true };
  }

  function cloneCard(card) {
    if (!card) return null;
    var copy = { suit: card.suit, rank: card.rank, id: card.id || (card.rank === 'W' ? 'W' : String(card.suit) + card.rank) };
    if (card.rank === 'W' || card.weli) copy.weli = true;
    return copy;
  }

  function isWeli(card) {
    return !!(card && (card.rank === 'W' || card.weli || card.id === 'W'));
  }

  function freshDeck(deck) {
    var cards = [];
    for (var s = 0; s < 4; s++) {
      for (var i = 0; i < RANKS.length; i++) cards.push(makeCard(s, RANKS[i]));
    }
    if (deck !== '32') cards.push(makeWeli());
    return cards;
  }

  function shuffle(cards, rng) {
    var a = cards.slice();
    var random = rng || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function normalizeTarget(target, custom) {
    if (target === 13 || target === '13') return 13;
    if (target === 15 || target === '15') return 15;
    if (typeof target === 'number' && target >= 2 && target <= 31) return target;
    if (target === 'custom') {
      var n = Math.round(Number(custom));
      if (n >= 2 && n <= 31) return n;
    }
    return 15;
  }

  function rulesFrom(opts) {
    opts = opts || {};
    var deck = opts.deck === '32' ? '32' : '33';
    var critical = opts.critical === 'none' || opts.critical === 'tirol' ? opts.critical : 'bayern';
    if (critical === 'tirol' && deck !== '33') critical = 'bayern';
    return {
      target: normalizeTarget(opts.target, opts.custom != null ? opts.custom : opts.targetCustom),
      deck: deck,
      critical: critical,
      gespannt: opts.gespannt !== false,
      haubeForce: opts.haubeForce !== false,
      maschine: opts.maschine !== false,
      schlagwechsel: opts.schlagwechsel !== false
    };
  }

  function criticalSpecs(table) {
    var mode = table.rules.critical;
    if (mode === 'none') return [];
    var belle = mode === 'tirol' ? { role: 'belle', weli: true } : { role: 'belle', suit: 3, rank: '7' };
    return [
      { role: 'max', suit: 2, rank: 'K' },
      belle,
      { role: 'spitz', suit: 0, rank: '7' }
    ];
  }

  function matches(card, spec) {
    if (!card || !spec) return false;
    if (spec.weli) return isWeli(card);
    return card.suit === spec.suit && card.rank === spec.rank;
  }

  function criticalRole(card, table) {
    var specs = criticalSpecs(table);
    for (var i = 0; i < specs.length; i++) if (matches(card, specs[i])) return specs[i].role;
    return '';
  }

  function isCritical(card, table) {
    return !!criticalRole(card, table);
  }

  function isSchlag(card, table) {
    if (!card || table.schlag == null || isCritical(card, table)) return false;
    if (table.schlag === 'W') return isWeli(card);
    return card.rank === table.schlag;
  }

  function isHaube(card, table) {
    if (!isSchlag(card, table) || table.trump == null) return false;
    if (table.schlag === 'W') return isWeli(card);
    return card.suit === table.trump;
  }

  function isTrumpCard(card, table) {
    if (!card || table.trump == null || isCritical(card, table) || isSchlag(card, table)) return false;
    if (isWeli(card)) return table.trump === 3;
    return card.suit === table.trump;
  }

  function suitOf(card) {
    if (isWeli(card)) return 3;
    return card.suit;
  }

  function rankName(rank) {
    return RANK_NAME[rank] || rank;
  }

  function cardName(card) {
    if (!card) return '';
    if (isWeli(card)) return 'Weli';
    var role = '';
    return rankName(card.rank) + ' ' + (SUITS[card.suit] || '');
  }

  function namedCard(card, table) {
    var role = table ? criticalRole(card, table) : '';
    if (role === 'max') return 'Max';
    if (role === 'belle') return 'Belle';
    if (role === 'spitz') return 'Spitz';
    if (table && isHaube(card, table)) return 'Haube';
    return cardName(card);
  }

  function classOf(card, table) {
    var role = criticalRole(card, table);
    if (role === 'max') return { cat: 3, rank: 3 };
    if (role === 'belle') return { cat: 3, rank: 2 };
    if (role === 'spitz') return { cat: 3, rank: 1 };
    if (isHaube(card, table)) return { cat: 2, rank: 1 };
    if (isSchlag(card, table)) return { cat: 2, rank: 0 };
    if (isTrumpCard(card, table)) return { cat: 1, rank: TRUMP_POWER[card.rank] || 0 };
    return { cat: 0, rank: TRUMP_POWER[card.rank] || 0, suit: suitOf(card) };
  }

  function beatsEntry(a, b, table, leadSuit) {
    var ca = classOf(a.card, table);
    var cb = classOf(b.card, table);
    if (ca.cat !== cb.cat) return ca.cat > cb.cat;
    if (ca.cat === 2 && ca.rank === 0 && cb.rank === 0) return a.index < b.index;
    if (ca.cat === 0) {
      var aLead = ca.suit === leadSuit;
      var bLead = cb.suit === leadSuit;
      if (aLead !== bLead) return aLead;
      if (!aLead) return false;
      return ca.rank > cb.rank;
    }
    return ca.rank > cb.rank;
  }

  function trickWinner(trick, table) {
    if (!trick || !trick.length) return null;
    var leadSuit = suitOf(trick[0].card);
    var best = { card: trick[0].card, seat: trick[0].seat, index: 0 };
    for (var i = 1; i < trick.length; i++) {
      var entry = { card: trick[i].card, seat: trick[i].seat, index: i };
      if (beatsEntry(entry, best, table, leadSuit)) best = entry;
    }
    return best.seat;
  }

  function haubeOpen(table) {
    if (!table.rules.haubeForce || table.tricksPlayed !== 0 || !table.trick.length) return false;
    if (!isHaube(table.trick[0].card, table)) return false;
    for (var i = 1; i < table.trick.length; i++) {
      if (isCritical(table.trick[i].card, table)) return false;
    }
    return true;
  }

  function legalCards(table, seat) {
    var hand = (table.hands && table.hands[seat]) || [];
    if (table.phase !== 'play' || table.turn !== seat) return [];
    if (!haubeOpen(table)) return hand.slice();
    var forced = hand.filter(function (c) { return isCritical(c, table) || isTrumpCard(c, table); });
    return forced.length ? forced : hand.slice();
  }

  function schlagRanks(table) {
    var ranks = RANKS.slice();
    if (table.rules.deck === '33') ranks.push('W');
    return ranks;
  }

  function findCard(hand, id) {
    for (var i = 0; i < hand.length; i++) if (hand[i].id === id) return i;
    return -1;
  }

  function gespanntTeams(table) {
    var line = table.target - 2;
    var out = [];
    if (table.scores[0] >= line && table.scores[0] < table.target) out.push(0);
    if (table.scores[1] >= line && table.scores[1] < table.target) out.push(1);
    return out;
  }

  function raisingLocked(table) {
    return !!(table.rules.gespannt && gespanntTeams(table).length);
  }

  function actorOf(table, team) {
    if (teamOf(table.forehand) === team) return table.forehand;
    return nextSeat(table.forehand);
  }

  function canRaise(table, seat) {
    if (table.turn !== seat) return false;
    if (raisingLocked(table)) return false;
    if (table.lastRaiseTeam === teamOf(seat)) return false;
    if (table.stake >= table.target) return false;
    if (table.phase === 'bieten') return true;
    return table.phase === 'play' && table.trick.length === 0;
  }

  function hasMaschine(hand, table) {
    var specs = criticalSpecs(table);
    if (specs.length < 3) return false;
    for (var i = 0; i < specs.length; i++) {
      var found = false;
      for (var j = 0; j < hand.length; j++) if (matches(hand[j], specs[i])) found = true;
      if (!found) return false;
    }
    return true;
  }

  function blank(opts) {
    var rules = rulesFrom(opts);
    return {
      rules: rules,
      target: rules.target,
      scores: [0, 0],
      history: [],
      over: false,
      winner: null,
      dealer: 0,
      forehand: 1,
      turn: 1,
      phase: 'schlag',
      hands: [[], [], [], []],
      stockCount: 0,
      schlag: null,
      trump: null,
      swapped: false,
      swapAsked: false,
      stake: 2,
      lastRaiseTeam: null,
      pendingRaise: null,
      tricksWon: [0, 0],
      tricksPlayed: 0,
      trick: [],
      leader: 1,
      gained: [0, 0],
      lastReason: ''
    };
  }

  function dealInto(table, rng) {
    var deck = shuffle(freshDeck(table.rules.deck), rng || Math.random);
    var fore = nextSeat(table.dealer);
    var hands = [[], [], [], []];
    var cursor = 0;
    var round;
    var seat;
    for (round = 0; round < 3; round++) {
      seat = fore;
      for (var k = 0; k < 4; k++) {
        hands[seat].push(deck[cursor]);
        cursor += 1;
        seat = nextSeat(seat);
      }
    }
    for (round = 0; round < 2; round++) {
      seat = fore;
      for (var n = 0; n < 4; n++) {
        hands[seat].push(deck[cursor]);
        cursor += 1;
        seat = nextSeat(seat);
      }
    }
    table.hands = hands;
    table.stockCount = deck.length - cursor;
    table.forehand = fore;
    table.turn = fore;
    table.leader = fore;
    table.phase = 'schlag';
    table.schlag = null;
    table.trump = null;
    table.swapped = false;
    table.swapAsked = false;
    table.stake = 2;
    table.lastRaiseTeam = null;
    table.pendingRaise = null;
    table.tricksWon = [0, 0];
    table.tricksPlayed = 0;
    table.trick = [];
    table.gained = [0, 0];
    table.lastReason = '';
  }

  function newTable(opts, rng) {
    var random = typeof rng === 'function' ? rng : Math.random;
    var table = blank(opts);
    if (opts && opts.scores) table.scores = opts.scores.slice();
    if (opts && opts.dealer != null) table.dealer = opts.dealer;
    else table.dealer = Math.floor(random() * 4);
    dealInto(table, random);
    return table;
  }

  function fromPosition(pos) {
    pos = pos || {};
    var table = blank(pos);
    table.hands = (pos.hands || [[], [], [], []]).map(function (hand) {
      return (hand || []).map(cloneCard);
    });
    while (table.hands.length < 4) table.hands.push([]);
    table.dealer = pos.dealer || 0;
    table.forehand = pos.forehand != null ? pos.forehand : nextSeat(table.dealer);
    table.turn = pos.turn != null ? pos.turn : table.forehand;
    table.leader = pos.leader != null ? pos.leader : table.forehand;
    table.phase = pos.phase || 'play';
    table.schlag = pos.schlag != null ? pos.schlag : null;
    table.trump = pos.trump != null ? pos.trump : null;
    table.swapped = !!pos.swapped;
    table.swapAsked = !!pos.swapAsked;
    table.stake = pos.stake != null ? pos.stake : 2;
    table.lastRaiseTeam = pos.lastRaiseTeam != null ? pos.lastRaiseTeam : null;
    table.pendingRaise = pos.pendingRaise || null;
    table.tricksWon = pos.tricksWon ? pos.tricksWon.slice() : [0, 0];
    table.tricksPlayed = pos.tricksPlayed || 0;
    table.trick = (pos.trick || []).map(function (t) { return { seat: t.seat, card: cloneCard(t.card) }; });
    table.scores = pos.scores ? pos.scores.slice() : [0, 0];
    table.history = pos.history ? pos.history.slice() : [];
    table.stockCount = pos.stockCount || 0;
    table.target = table.rules.target;
    return table;
  }

  function award(table, team, points, reason, events) {
    if (table.phase === 'handEnd' || table.phase === 'matchEnd') return;
    table.scores[team] += points;
    table.gained = team === 0 ? [points, 0] : [0, points];
    table.lastReason = reason;
    table.history.push({
      team: team,
      points: points,
      reason: reason,
      schlag: table.schlag,
      trump: table.trump,
      stake: table.stake
    });
    events.push({
      type: 'handEnd',
      team: team,
      points: points,
      reason: reason,
      scores: table.scores.slice()
    });
    if (table.scores[team] >= table.target) {
      table.over = true;
      table.winner = team;
      table.phase = 'matchEnd';
      events.push({ type: 'matchEnd', winner: team });
    } else {
      table.phase = 'handEnd';
    }
  }

  function openPlay(table, events) {
    table.pendingRaise = null;
    table.phase = 'play';
    table.leader = table.forehand;
    table.turn = table.forehand;
    table.trick = [];
    events.push({ type: 'play', stake: table.stake, schlag: table.schlag, trump: table.trump });
  }

  function afterTrump(table, events) {
    events.push({ type: 'ansage', schlag: table.schlag, trump: table.trump, swapped: table.swapped });
    if (table.rules.maschine) {
      for (var s = 0; s < 4; s++) {
        if (hasMaschine(table.hands[s], table)) {
          events.push({ type: 'maschine', seat: s });
          award(table, teamOf(s), 2, 'maschine', events);
          return;
        }
      }
    }
    var tense = table.rules.gespannt ? gespanntTeams(table) : [];
    if (tense.length === 1) {
      table.stake = 3;
      table.phase = 'concede';
      table.turn = actorOf(table, tense[0]);
      events.push({ type: 'gespannt', team: tense[0] });
      return;
    }
    table.stake = 2;
    table.phase = 'bieten';
    table.turn = table.forehand;
    table.lastRaiseTeam = null;
  }

  function chooseSchlag(table, seat, rank) {
    if (table.phase !== 'schlag' || table.turn !== seat) return { ok: false, reason: 'turn' };
    if (schlagRanks(table).indexOf(rank) < 0) return { ok: false, reason: 'schlag' };
    table.schlag = rank;
    table.phase = 'trump';
    table.turn = table.swapped ? table.forehand : table.dealer;
    return { ok: true, events: [{ type: 'schlag', seat: seat, rank: rank }] };
  }

  function offerSwap(table, seat) {
    if (table.phase !== 'schlag' || table.turn !== seat) return { ok: false, reason: 'turn' };
    if (!table.rules.schlagwechsel || seat !== table.forehand || table.swapped || table.swapAsked) {
      return { ok: false, reason: 'swap' };
    }
    table.swapAsked = true;
    table.phase = 'swap';
    table.turn = table.dealer;
    return { ok: true, events: [{ type: 'swap', seat: seat }] };
  }

  function answerSwap(table, seat, accept) {
    if (table.phase !== 'swap' || table.turn !== seat) return { ok: false, reason: 'turn' };
    var events = [{ type: 'swapAnswer', seat: seat, accept: !!accept }];
    if (accept) {
      table.swapped = true;
      table.phase = 'schlag';
      table.turn = table.dealer;
    } else {
      table.phase = 'schlag';
      table.turn = table.forehand;
    }
    return { ok: true, events: events };
  }

  function chooseTrump(table, seat, suit) {
    if (table.phase !== 'trump' || table.turn !== seat) return { ok: false, reason: 'turn' };
    if (suit !== 0 && suit !== 1 && suit !== 2 && suit !== 3) return { ok: false, reason: 'trump' };
    table.trump = suit;
    var events = [{ type: 'trump', seat: seat, suit: suit }];
    afterTrump(table, events);
    return { ok: true, events: events };
  }

  function concede(table, seat, go) {
    if (table.phase !== 'concede' || table.turn !== seat) return { ok: false, reason: 'turn' };
    var events = [{ type: 'concede', seat: seat, go: !!go }];
    if (go) {
      award(table, teamOf(seat) === 0 ? 1 : 0, 2, 'gehen', events);
      return { ok: true, events: events };
    }
    table.stake = 3;
    openPlay(table, events);
    return { ok: true, events: events };
  }

  function bieten(table, seat) {
    if (!canRaise(table, seat)) return { ok: false, reason: 'bieten' };
    table.pendingRaise = {
      team: teamOf(seat),
      next: table.stake + 1,
      resume: table.phase,
      leader: table.phase === 'play' ? table.leader : table.forehand
    };
    table.phase = 'raise';
    table.turn = actorOf(table, teamOf(seat) === 0 ? 1 : 0);
    return { ok: true, events: [{ type: 'bieten', seat: seat, next: table.stake + 1 }] };
  }

  function halten(table, seat) {
    if (table.phase !== 'raise' || table.turn !== seat || !table.pendingRaise) return { ok: false, reason: 'turn' };
    var pending = table.pendingRaise;
    table.stake = pending.next;
    table.lastRaiseTeam = pending.team;
    table.pendingRaise = null;
    var events = [{ type: 'halten', seat: seat, stake: table.stake }];
    if (pending.resume === 'play') {
      table.phase = 'play';
      table.leader = pending.leader;
      table.turn = pending.leader;
    } else {
      table.phase = 'bieten';
      table.turn = seat;
    }
    return { ok: true, events: events };
  }

  function gehen(table, seat) {
    if (table.phase === 'concede') return concede(table, seat, true);
    if (table.phase !== 'raise' || table.turn !== seat || !table.pendingRaise) return { ok: false, reason: 'turn' };
    var team = table.pendingRaise.team;
    var events = [{ type: 'gehen', seat: seat, points: table.stake }];
    award(table, team, table.stake, 'gehen', events);
    return { ok: true, events: events };
  }

  function spielen(table, seat) {
    if (table.phase !== 'bieten' || table.turn !== seat) return { ok: false, reason: 'turn' };
    var events = [{ type: 'spielen', seat: seat, stake: table.stake }];
    openPlay(table, events);
    return { ok: true, events: events };
  }

  function playCard(table, seat, cardId) {
    if (table.phase !== 'play') return { ok: false, reason: 'phase' };
    if (table.turn !== seat) return { ok: false, reason: 'turn' };
    var hand = table.hands[seat];
    var idx = findCard(hand, cardId);
    if (idx < 0) return { ok: false, reason: 'card' };
    var allowed = legalCards(table, seat);
    if (!allowed.some(function (c) { return c.id === cardId; })) return { ok: false, reason: 'illegal' };
    var card = hand[idx];
    hand.splice(idx, 1);
    table.trick.push({ seat: seat, card: card });
    var events = [{ type: 'card', seat: seat, card: card }];
    if (table.trick.length < 4) {
      table.turn = nextSeat(seat);
      return { ok: true, events: events };
    }
    var winner = trickWinner(table.trick, table);
    var team = teamOf(winner);
    table.tricksWon[team] += 1;
    table.tricksPlayed += 1;
    events.push({
      type: 'trick',
      winner: winner,
      team: team,
      cards: table.trick.map(function (t) { return { seat: t.seat, card: t.card }; }),
      tricks: table.tricksWon.slice()
    });
    if (table.tricksWon[team] >= 3) {
      award(table, team, table.stake, 'stiche', events);
      return { ok: true, events: events };
    }
    table.trick = [];
    table.leader = winner;
    table.turn = winner;
    return { ok: true, events: events };
  }

  function applyAction(table, seat, action) {
    if (!action) return { ok: false, reason: 'none' };
    if (action.type === 'schlag') return chooseSchlag(table, seat, action.rank);
    if (action.type === 'swap') return offerSwap(table, seat);
    if (action.type === 'accept') return answerSwap(table, seat, true);
    if (action.type === 'decline') return answerSwap(table, seat, false);
    if (action.type === 'trump') return chooseTrump(table, seat, action.suit);
    if (action.type === 'gehen') return gehen(table, seat);
    if (action.type === 'halten') {
      if (table.phase === 'concede') return concede(table, seat, false);
      return halten(table, seat);
    }
    if (action.type === 'bieten') return bieten(table, seat);
    if (action.type === 'spielen') return spielen(table, seat);
    if (action.type === 'card') return playCard(table, seat, action.id);
    return { ok: false, reason: 'action' };
  }

  function nextHand(table, rng) {
    if (table.over) return { ok: false, reason: 'match' };
    table.dealer = nextSeat(table.dealer);
    dealInto(table, rng || Math.random);
    return { ok: true };
  }

  function legalState(table, seat) {
    return {
      phase: table.phase,
      turn: table.turn === seat,
      cards: legalCards(table, seat),
      ranks: table.phase === 'schlag' && table.turn === seat ? schlagRanks(table) : [],
      suits: table.phase === 'trump' && table.turn === seat ? [0, 1, 2, 3] : [],
      swap: table.phase === 'schlag' && table.turn === seat && table.rules.schlagwechsel && seat === table.forehand && !table.swapped && !table.swapAsked,
      raise: canRaise(table, seat),
      answer: table.phase === 'raise' && table.turn === seat,
      concede: table.phase === 'concede' && table.turn === seat,
      spielen: table.phase === 'bieten' && table.turn === seat
    };
  }

  return {
    RANKS: RANKS,
    SUITS: SUITS,
    RANK_NAME: RANK_NAME,
    mulberry32: mulberry32,
    teamOf: teamOf,
    nextSeat: nextSeat,
    partnerOf: partnerOf,
    makeCard: makeCard,
    makeWeli: makeWeli,
    isWeli: isWeli,
    freshDeck: freshDeck,
    shuffle: shuffle,
    normalizeTarget: normalizeTarget,
    rulesFrom: rulesFrom,
    criticalSpecs: criticalSpecs,
    criticalRole: criticalRole,
    isCritical: isCritical,
    isSchlag: isSchlag,
    isHaube: isHaube,
    isTrumpCard: isTrumpCard,
    classOf: classOf,
    trickWinner: trickWinner,
    legalCards: legalCards,
    schlagRanks: schlagRanks,
    gespanntTeams: gespanntTeams,
    canRaise: canRaise,
    hasMaschine: hasMaschine,
    cardName: cardName,
    namedCard: namedCard,
    rankName: rankName,
    newTable: newTable,
    fromPosition: fromPosition,
    applyAction: applyAction,
    nextHand: nextHand,
    legalState: legalState
  };
});
