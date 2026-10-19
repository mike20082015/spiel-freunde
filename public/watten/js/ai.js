/*
 * Mitspieler fürs Watten.
 * Sie sehen nur das eigene Blatt, Schlag, Trumpf und die offenen Stiche.
 * Anfänger sagt die häufigste Karte an und hält jedes Gebot.
 * Kneipe und Turnier bieten bei einem starken Blatt und gehen bei einem schwachen.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WattenAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function engineOf() {
    var host = typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (host && host.WattenEngine) return host.WattenEngine;
    return require('./engine.js');
  }

  function countRank(hand, rank) {
    var n = 0;
    for (var i = 0; i < hand.length; i++) {
      if (rank === 'W' && (hand[i].rank === 'W' || hand[i].weli)) n += 1;
      else if (hand[i].rank === rank) n += 1;
    }
    return n;
  }

  function bestSchlag(E, table, hand) {
    var ranks = E.schlagRanks(table);
    var best = ranks[0];
    var score = -1;
    for (var i = 0; i < ranks.length; i++) {
      var n = countRank(hand, ranks[i]);
      if (n > score) { score = n; best = ranks[i]; }
    }
    return { rank: best, count: score };
  }

  function bestSuit(E, table, hand) {
    var best = 0;
    var score = -1;
    for (var s = 0; s < 4; s++) {
      var n = 0;
      for (var i = 0; i < hand.length; i++) {
        var card = hand[i];
        var suit = card.rank === 'W' ? 3 : card.suit;
        if (suit !== s && !(table.schlag === 'W' && card.rank === 'W')) continue;
        n += 2;
        if (table.schlag && card.rank === table.schlag && !E.isCritical(card, table)) n += 3;
        if (E.isCritical(card, table)) n += 2;
      }
      if (n > score) { score = n; best = s; }
    }
    return best;
  }

  function strength(E, table, hand) {
    var n = 0;
    for (var i = 0; i < hand.length; i++) {
      var card = hand[i];
      var role = E.criticalRole(card, table);
      if (role === 'max') n += 5;
      else if (role === 'belle') n += 4;
      else if (role === 'spitz') n += 3;
      else if (E.isHaube(card, table)) n += 3;
      else if (E.isSchlag(card, table)) n += 2;
      else if (E.isTrumpCard(card, table)) n += 1;
    }
    return n;
  }

  function plainLow(E, table, cards) {
    var plain = cards.filter(function (c) {
      return !E.isCritical(c, table) && !E.isSchlag(c, table) && !E.isTrumpCard(c, table);
    });
    var pool = plain.length ? plain : cards;
    return pool.slice().sort(function (a, b) {
      return (E.classOf(a, table).rank || 0) - (E.classOf(b, table).rank || 0);
    })[0];
  }

  function pickCard(E, table, seat) {
    var cards = E.legalCards(table, seat);
    if (!cards.length) return null;
    if (!table.trick.length) {
      var haube = cards.filter(function (c) { return E.isHaube(c, table); });
      var crit = cards.some(function (c) { return E.isCritical(c, table); });
      if (haube.length && crit) return haube[0];
      return plainLow(E, table, cards);
    }
    var winnerSeat = E.trickWinner(table.trick, table);
    var partnerWins = E.teamOf(winnerSeat) === E.teamOf(seat);
    var beaters = cards.filter(function (c) {
      var trial = table.trick.concat([{ seat: seat, card: c }]);
      return E.trickWinner(trial, table) === seat;
    });
    if (partnerWins) {
      var ducks = cards.filter(function (c) { return beaters.indexOf(c) < 0; });
      return plainLow(E, table, ducks.length ? ducks : cards);
    }
    if (beaters.length) {
      return beaters.slice().sort(function (a, b) {
        var ca = E.classOf(a, table);
        var cb = E.classOf(b, table);
        if (ca.cat !== cb.cat) return ca.cat - cb.cat;
        return ca.rank - cb.rank;
      })[0];
    }
    return plainLow(E, table, cards);
  }

  function choose(table, seat, level, rng) {
    var E = engineOf();
    var hand = table.hands[seat] || [];
    var beginner = level === 'anfaenger';
    if (table.phase === 'schlag') {
      var best = bestSchlag(E, table, hand);
      if (!beginner && table.rules.schlagwechsel && seat === table.forehand && !table.swapped && !table.swapAsked && best.count <= 1 && level === 'turnier') {
        return { type: 'swap' };
      }
      return { type: 'schlag', rank: best.rank };
    }
    if (table.phase === 'swap') {
      var own = bestSchlag(E, table, hand);
      return { type: own.count >= 2 ? 'accept' : 'decline' };
    }
    if (table.phase === 'trump') return { type: 'trump', suit: bestSuit(E, table, hand) };
    var power = table.schlag != null && table.trump != null ? strength(E, table, hand) : 0;
    if (table.phase === 'concede') return { type: !beginner && power < 4 ? 'gehen' : 'halten' };
    if (table.phase === 'raise') return { type: !beginner && level === 'turnier' && power < 3 ? 'gehen' : 'halten' };
    if (table.phase === 'bieten') {
      if (!beginner && E.canRaise(table, seat) && power >= 7 && table.stake < 4) return { type: 'bieten' };
      return { type: 'spielen' };
    }
    if (table.phase === 'play') {
      if (!beginner && level === 'turnier' && table.trick.length === 0 && E.canRaise(table, seat) && power >= 8 && table.stake < 4 && table.tricksWon[E.teamOf(seat)] === 2) {
        return { type: 'bieten' };
      }
      var card = pickCard(E, table, seat);
      if (!card) return null;
      return { type: 'card', id: card.id };
    }
    return null;
  }

  return { choose: choose };
});
