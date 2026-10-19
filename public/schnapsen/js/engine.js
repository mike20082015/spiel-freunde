/*
 * Spiel-Freunde Schnapsen: österreichisches Zweier-Schnapsen, Bummerl.
 * Sitze: 0 Süden Du, 1 Norden der Gegner. Vorhand ist der Nichtgeber.
 *
 * Weiches Schnapsen, wie es am Tisch üblich ist:
 *   20 Karten, je 5, Talon mit offenem Trumpf als letzter Karte.
 *   Offener Talon: kein Farb- und kein Stichzwang. Gewinner zieht zuerst.
 *   Zugedreht oder Talon leer: Farbzwang vor Stichzwang. Stechen nur,
 *   wenn die Farbe fehlt oder die Farbe den Stich nicht nehmen kann.
 *   20er und 40er beim Ausspiel. Die Augen zählen erst mit eigenem Stich,
 *   bis dahin bleiben sie vorgemerkt.
 *   Trumpf-Unter tauscht gegen die offene Karte, solange noch eine
 *   verdeckte Karte im Talon liegt.
 *   Zudrehen friert die Augen des Gegners für die 1/2/3 ein. Wer zudreht,
 *   muss 66 erreichen, sonst schreibt der Gegner mindestens 2.
 *   66 Augen: 3 bei keinem Stich des Gegners, 2 unter 33, sonst 1.
 *   Geht der Talon leer aus und hat niemand 66, gewinnt der letzte Stich
 *   mit 1 Punkt. Partie bis 7, der Verlierer hat das Bummerl.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SchnapsenEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RANKS = ['A', '10', 'K', 'O', 'U'];
  var SUIT_DE = ['Herz', 'Schelle', 'Blatt', 'Eichel'];
  var SUIT_FR = ['Herz', 'Karo', 'Pik', 'Kreuz'];
  var RANK_DE = { A: 'Ass', '10': 'Zehner', K: 'König', O: 'Ober', U: 'Unter' };
  var RANK_FR = { A: 'Ass', '10': 'Zehn', K: 'König', O: 'Dame', U: 'Bube' };
  var EYES = { A: 11, '10': 10, K: 4, O: 3, U: 2 };
  var POWER = { A: 5, '10': 4, K: 3, O: 2, U: 1 };

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

  function nextSeat(seat) { return seat === 0 ? 1 : 0; }

  function makeCard(suit, rank) {
    return { suit: suit, rank: rank, id: String(suit) + rank };
  }

  function cloneCard(card) {
    if (!card) return null;
    return { suit: card.suit, rank: card.rank, id: card.id || (String(card.suit) + card.rank) };
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
    if (target === 11 || target === '11') return 11;
    if (target === 7 || target === '7') return 7;
    if (target === 'custom') {
      var n = Math.round(Number(custom));
      if (n >= 1 && n <= 21) return n;
    }
    return 7;
  }

  function rulesFrom(opts) {
    opts = opts || {};
    return {
      target: normalizeTarget(opts.target, opts.custom != null ? opts.custom : opts.targetCustom),
      deck: opts.deck === 'french' ? 'french' : 'german',
      marriageNeedsTrick: opts.marriageNeedsTrick !== false,
      allowExchange: opts.allowExchange !== false,
      exchangeStrict: !!opts.exchangeStrict,
      allowClose: opts.allowClose !== false,
      lastTrickWins: opts.lastTrickWins !== false
    };
  }

  function pointsOf(card) {
    return card ? (EYES[card.rank] || 0) : 0;
  }

  function powerOf(card) {
    return card ? (POWER[card.rank] || 0) : 0;
  }

  function sumPoints(cards) {
    var n = 0;
    for (var i = 0; i < cards.length; i++) n += pointsOf(cards[i]);
    return n;
  }

  function cardName(card, deck) {
    if (!card) return '';
    var french = deck === 'french';
    var suits = french ? SUIT_FR : SUIT_DE;
    var ranks = french ? RANK_FR : RANK_DE;
    return (ranks[card.rank] || card.rank) + ' ' + (suits[card.suit] || '');
  }

  function suitName(suit, deck) {
    var suits = deck === 'french' ? SUIT_FR : SUIT_DE;
    return suits[suit] || '';
  }

  function isStrict(table) {
    return !!(table.closed || (table.stock.length === 0 && !table.trumpCard));
  }

  function findCard(hand, id) {
    for (var i = 0; i < hand.length; i++) if (hand[i].id === id) return i;
    return -1;
  }

  function holdsMarriage(hand, suit) {
    var king = false;
    var upper = false;
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].suit !== suit) continue;
      if (hand[i].rank === 'K') king = true;
      if (hand[i].rank === 'O') upper = true;
    }
    return king && upper;
  }

  function cardBeats(card, other, trump) {
    if (!other) return true;
    if (!card) return false;
    var cardTrump = card.suit === trump;
    var otherTrump = other.suit === trump;
    if (cardTrump && !otherTrump) return true;
    if (!cardTrump && otherTrump) return false;
    if (card.suit !== other.suit) return false;
    return powerOf(card) > powerOf(other);
  }

  function currentWinner(trick, trump) {
    var best = 0;
    for (var i = 1; i < trick.length; i++) {
      if (cardBeats(trick[i].card, trick[best].card, trump)) best = i;
    }
    return trick[best];
  }

  function legalCards(table, seat) {
    var hand = table.hands[seat] || [];
    if (table.phase !== 'play' || table.turn !== seat) return [];
    if (!table.trick.length || !isStrict(table)) return hand.slice();
    var lead = table.trick[0].card;
    var winning = currentWinner(table.trick, table.trump).card;
    var inSuit = hand.filter(function (c) { return c.suit === lead.suit; });
    if (inSuit.length) {
      var beaters = inSuit.filter(function (c) { return cardBeats(c, winning, table.trump); });
      return beaters.length ? beaters : inSuit;
    }
    var trumps = hand.filter(function (c) { return c.suit === table.trump; });
    if (trumps.length) {
      var over = trumps.filter(function (c) { return cardBeats(c, winning, table.trump); });
      if (over.length) return over;
    }
    return hand.slice();
  }

  function marriagesOf(table, seat) {
    if (table.phase !== 'play' || table.turn !== seat || table.trick.length) return [];
    var out = [];
    for (var s = 0; s < 4; s++) {
      if (table.marriages[seat].indexOf(s) >= 0) continue;
      if (!holdsMarriage(table.hands[seat], s)) continue;
      out.push({ suit: s, points: s === table.trump ? 40 : 20 });
    }
    return out;
  }

  function canExchange(table, seat) {
    if (table.phase !== 'play' || table.turn !== seat || table.trick.length) return false;
    if (!table.rules.allowExchange || table.closed || !table.trumpCard) return false;
    var minHidden = table.rules.exchangeStrict ? 2 : 1;
    if (table.stock.length < minHidden) return false;
    return table.hands[seat].some(function (c) { return c.suit === table.trump && c.rank === 'U'; });
  }

  function canClose(table, seat) {
    if (table.phase !== 'play' || table.turn !== seat || table.trick.length) return false;
    if (!table.rules.allowClose || table.closed) return false;
    return table.stock.length > 0 || !!table.trumpCard;
  }

  function legalState(table, seat) {
    return {
      cards: legalCards(table, seat),
      marriages: marriagesOf(table, seat),
      exchange: canExchange(table, seat),
      close: canClose(table, seat)
    };
  }

  function gamePoints(eyes, tricks) {
    if (!tricks) return 3;
    if (eyes < 33) return 2;
    return 1;
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
      doppel: false,
      dealer: 0,
      forehand: 1,
      turn: 1,
      phase: 'play',
      hands: [[], []],
      stock: [],
      trumpCard: null,
      trump: 0,
      closed: false,
      closer: null,
      freeze: null,
      points: [0, 0],
      tricks: [0, 0],
      pending: [0, 0],
      marriages: [[], []],
      trick: [],
      gained: [0, 0],
      lastReason: ''
    };
  }

  function dealInto(table, rng) {
    var deck = shuffle(freshDeck(), rng || Math.random);
    var fore = nextSeat(table.dealer);
    var hands = [[], []];
    var i;
    for (i = 0; i < 3; i++) hands[fore].push(deck[i]);
    for (i = 0; i < 3; i++) hands[table.dealer].push(deck[3 + i]);
    for (i = 0; i < 2; i++) hands[fore].push(deck[6 + i]);
    for (i = 0; i < 2; i++) hands[table.dealer].push(deck[8 + i]);
    table.hands = hands;
    table.trumpCard = deck[10];
    table.trump = deck[10].suit;
    table.stock = deck.slice(11);
    table.forehand = fore;
    table.turn = fore;
    table.phase = 'play';
    table.closed = false;
    table.closer = null;
    table.freeze = null;
    table.points = [0, 0];
    table.tricks = [0, 0];
    table.pending = [0, 0];
    table.marriages = [[], []];
    table.trick = [];
    table.gained = [0, 0];
    table.lastReason = '';
  }

  function newTable(opts, rng) {
    var random = typeof rng === 'function' ? rng : Math.random;
    var table = blank(opts);
    table.dealer = Math.floor(random() * 2);
    dealInto(table, random);
    return table;
  }

  function fromPosition(pos) {
    pos = pos || {};
    var table = blank(pos);
    table.hands = (pos.hands || [[], []]).map(function (hand) {
      return (hand || []).map(cloneCard);
    });
    table.stock = (pos.stock || []).map(cloneCard);
    table.trumpCard = cloneCard(pos.trumpCard);
    table.trump = pos.trump != null ? pos.trump : (table.trumpCard ? table.trumpCard.suit : 0);
    table.dealer = pos.dealer || 0;
    table.forehand = pos.forehand != null ? pos.forehand : nextSeat(table.dealer);
    table.turn = pos.turn != null ? pos.turn : table.forehand;
    table.points = pos.points ? pos.points.slice() : [0, 0];
    table.tricks = pos.tricks ? pos.tricks.slice() : [0, 0];
    table.pending = pos.pending ? pos.pending.slice() : [0, 0];
    table.marriages = pos.marriages ? pos.marriages.map(function (m) { return (m || []).slice(); }) : [[], []];
    table.trick = (pos.trick || []).map(function (t) { return { seat: t.seat, card: cloneCard(t.card) }; });
    table.closed = !!pos.closed;
    table.closer = pos.closer != null ? pos.closer : null;
    table.freeze = pos.freeze ? { points: pos.freeze.points.slice(), tricks: pos.freeze.tricks.slice() } : null;
    table.phase = pos.phase || 'play';
    table.scores = pos.scores ? pos.scores.slice() : [0, 0];
    table.history = pos.history ? pos.history.slice() : [];
    table.target = table.rules.target;
    return table;
  }

  function finishHand(table, winner, reason, events) {
    if (table.phase === 'handEnd' || table.phase === 'matchEnd') return;
    var opp = nextSeat(winner);
    var gp;
    if (table.closed && table.freeze) {
      var other = nextSeat(table.closer);
      var would = gamePoints(table.freeze.points[other], table.freeze.tricks[other]);
      gp = winner === table.closer ? would : Math.max(2, would);
    } else if (reason === '66') {
      gp = gamePoints(table.points[opp], table.tricks[opp]);
    } else {
      gp = 1;
    }
    table.scores[winner] += gp;
    table.gained = winner === 0 ? [gp, 0] : [0, gp];
    table.lastReason = reason;
    table.history.push({
      winner: winner,
      points: gp,
      reason: reason,
      eyes: table.points.slice()
    });
    events.push({
      type: 'handEnd',
      winner: winner,
      points: gp,
      reason: reason,
      eyes: table.points.slice(),
      scores: table.scores.slice()
    });
    if (table.scores[winner] >= table.target) {
      table.over = true;
      table.winner = winner;
      table.doppel = table.scores[opp] === 0;
      table.phase = 'matchEnd';
      events.push({ type: 'matchEnd', winner: winner, doppel: table.doppel });
    } else {
      table.phase = 'handEnd';
    }
  }

  function settleTie(table, events) {
    table.gained = [0, 0];
    table.lastReason = 'tie';
    table.history.push({ winner: null, points: 0, reason: 'tie', eyes: table.points.slice() });
    table.phase = 'handEnd';
    events.push({ type: 'handEnd', winner: null, points: 0, reason: 'tie', eyes: table.points.slice(), scores: table.scores.slice() });
  }

  function drawOne(table) {
    if (table.stock.length) return table.stock.shift();
    if (table.trumpCard) {
      var card = table.trumpCard;
      table.trumpCard = null;
      return card;
    }
    return null;
  }

  function resolveTrick(table, events) {
    var winner = currentWinner(table.trick, table.trump).seat;
    var eyes = 0;
    for (var i = 0; i < table.trick.length; i++) eyes += pointsOf(table.trick[i].card);
    table.points[winner] += eyes;
    table.tricks[winner] += 1;
    if (table.pending[winner]) {
      table.points[winner] += table.pending[winner];
      events.push({ type: 'marriage', seat: winner, points: table.pending[winner], pending: false, reason: 'stich' });
      table.pending[winner] = 0;
    }
    events.push({
      type: 'trick',
      winner: winner,
      cards: table.trick.map(function (t) { return { seat: t.seat, card: t.card }; }),
      points: eyes
    });
    if (table.points[winner] >= 66) {
      finishHand(table, winner, '66', events);
      return;
    }
    var emptyHands = table.hands[0].length === 0 && table.hands[1].length === 0;
    if (!table.closed && !emptyHands) {
      var first = drawOne(table);
      var second = drawOne(table);
      if (first) {
        table.hands[winner].push(first);
        events.push({ type: 'draw', seat: winner, card: first });
      }
      var loser = nextSeat(winner);
      if (second) {
        table.hands[loser].push(second);
        events.push({ type: 'draw', seat: loser, card: second });
      }
    }
    emptyHands = table.hands[0].length === 0 && table.hands[1].length === 0;
    if (emptyHands) {
      if (table.closed) finishHand(table, nextSeat(table.closer), 'close-fail', events);
      else if (table.rules.lastTrickWins) finishHand(table, winner, 'last', events);
      else if (table.points[0] === table.points[1]) settleTie(table, events);
      else finishHand(table, table.points[0] > table.points[1] ? 0 : 1, 'eyes', events);
      return;
    }
    table.trick = [];
    table.turn = winner;
  }

  function exchangeTrump(table, seat) {
    if (!canExchange(table, seat)) return { ok: false, reason: 'exchange' };
    var hand = table.hands[seat];
    var idx = -1;
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].suit === table.trump && hand[i].rank === 'U') { idx = i; break; }
    }
    var jack = hand[idx];
    hand[idx] = table.trumpCard;
    table.trumpCard = jack;
    return { ok: true, events: [{ type: 'exchange', seat: seat, card: hand[idx], jack: jack }] };
  }

  function closeTalon(table, seat) {
    if (!canClose(table, seat)) return { ok: false, reason: 'close' };
    table.closed = true;
    table.closer = seat;
    table.freeze = { points: table.points.slice(), tricks: table.tricks.slice() };
    return {
      ok: true,
      events: [{ type: 'close', seat: seat, freeze: { points: table.freeze.points.slice(), tricks: table.freeze.tricks.slice() } }]
    };
  }

  function playCard(table, seat, cardId, opts) {
    opts = opts || {};
    if (table.phase !== 'play') return { ok: false, reason: 'phase' };
    if (table.turn !== seat) return { ok: false, reason: 'turn' };
    var hand = table.hands[seat];
    var idx = findCard(hand, cardId);
    if (idx < 0) return { ok: false, reason: 'card' };
    var allowed = legalCards(table, seat);
    if (!allowed.some(function (c) { return c.id === cardId; })) return { ok: false, reason: 'illegal' };
    var card = hand[idx];
    if (opts.marriage != null) {
      var suit = opts.marriage;
      if (table.trick.length) return { ok: false, reason: 'marriage' };
      if (card.suit !== suit || (card.rank !== 'K' && card.rank !== 'O')) return { ok: false, reason: 'marriage' };
      if (!holdsMarriage(hand, suit)) return { ok: false, reason: 'marriage' };
      if (table.marriages[seat].indexOf(suit) >= 0) return { ok: false, reason: 'marriage' };
    }
    hand.splice(idx, 1);
    table.trick.push({ seat: seat, card: card });
    var events = [{ type: 'play', seat: seat, card: card }];
    if (opts.marriage != null) {
      var pts = opts.marriage === table.trump ? 40 : 20;
      table.marriages[seat].push(opts.marriage);
      var live = table.tricks[seat] > 0 || !table.rules.marriageNeedsTrick;
      if (live) {
        table.points[seat] += pts;
        events.push({ type: 'marriage', seat: seat, points: pts, suit: opts.marriage, pending: false });
        if (table.points[seat] >= 66) {
          finishHand(table, seat, '66', events);
          return { ok: true, events: events };
        }
      } else {
        table.pending[seat] += pts;
        events.push({ type: 'marriage', seat: seat, points: pts, suit: opts.marriage, pending: true });
      }
    }
    if (table.trick.length < 2) {
      table.turn = nextSeat(seat);
      return { ok: true, events: events };
    }
    resolveTrick(table, events);
    return { ok: true, events: events };
  }

  function applyAction(table, seat, action) {
    if (!action) return { ok: false, reason: 'none' };
    if (action.type === 'exchange') return exchangeTrump(table, seat);
    if (action.type === 'close') return closeTalon(table, seat);
    if (action.type === 'marriage') {
      var king = null;
      var hand = table.hands[seat] || [];
      for (var i = 0; i < hand.length; i++) {
        if (hand[i].suit === action.suit && hand[i].rank === 'K') king = hand[i];
      }
      if (!king) return { ok: false, reason: 'marriage' };
      return playCard(table, seat, king.id, { marriage: action.suit });
    }
    if (action.type === 'card') return playCard(table, seat, action.id, {});
    return { ok: false, reason: 'action' };
  }

  function nextHand(table, rng) {
    if (table.over) return { ok: false, reason: 'match' };
    table.dealer = nextSeat(table.dealer);
    dealInto(table, rng || Math.random);
    return { ok: true };
  }

  return {
    RANKS: RANKS,
    SUIT_DE: SUIT_DE,
    SUIT_FR: SUIT_FR,
    RANK_DE: RANK_DE,
    RANK_FR: RANK_FR,
    EYES: EYES,
    mulberry32: mulberry32,
    nextSeat: nextSeat,
    makeCard: makeCard,
    freshDeck: freshDeck,
    shuffle: shuffle,
    normalizeTarget: normalizeTarget,
    rulesFrom: rulesFrom,
    pointsOf: pointsOf,
    powerOf: powerOf,
    sumPoints: sumPoints,
    cardName: cardName,
    suitName: suitName,
    isStrict: isStrict,
    cardBeats: cardBeats,
    legalCards: legalCards,
    legalState: legalState,
    gamePoints: gamePoints,
    newTable: newTable,
    fromPosition: fromPosition,
    exchangeTrump: exchangeTrump,
    closeTalon: closeTalon,
    playCard: playCard,
    applyAction: applyAction,
    nextHand: nextHand
  };
});
