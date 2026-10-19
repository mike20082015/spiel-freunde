/*
 * Spiel-Freunde Jass: Mitspieler.
 * Anfänger sagt die längste Farbe an und spielt die kleinste erlaubte Karte.
 * Kneipe bewertet Trumpf (Puur 3, Nell 2, Ass 1,5, Länge 1) und schmiert.
 * Turnier zählt die bereits gespielten Karten, ohne in fremde Blätter zu sehen.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JassAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function engineOf() {
    var host = typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (host && host.JassEngine) return host.JassEngine;
    return require('./engine.js');
  }

  function install(E) {
    function suitScore(hand, suit) {
      var cards = hand.filter(function (c) { return c.suit === suit; });
      var score = cards.length;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i].rank === 'U') score += 3;
        else if (cards[i].rank === '9') score += 2;
        else if (cards[i].rank === 'A') score += 1.5;
      }
      return score;
    }

    function chooseTrump(table, seat, level, rng) {
      var random = rng || Math.random;
      var hand = table.hands[seat];
      var allowPush = table.phase === 'trump';
      var bestSuit = 0;
      var best = -1;
      for (var s = 0; s < 4; s++) {
        var sc = suitScore(hand, s);
        if (sc > best) { best = sc; bestSuit = s; }
      }
      var aces = hand.filter(function (c) { return c.rank === 'A'; }).length;
      var sixes = hand.filter(function (c) { return c.rank === '6'; }).length;
      var oben = table.allowOben && aces >= 3 ? aces * 2 : -1;
      var unden = table.allowOben && sixes >= 3 ? sixes * 2 : -1;
      var pick = { mode: 'suit', suit: bestSuit, score: best };
      if (oben > pick.score) pick = { mode: 'obenabe', score: oben };
      if (unden > pick.score) pick = { mode: 'undenufe', score: unden };
      var threshold = level === 'turnier' ? 7 : 6;
      if (level === 'anfaenger') {
        var longest = 0;
        var suit = 0;
        for (var i = 0; i < 4; i++) {
          var n = hand.filter(function (c) { return c.suit === i; }).length;
          if (n > longest) { longest = n; suit = i; }
        }
        if (allowPush && longest <= 2 && random() < 0.75) return 'schieben';
        if (table.allowOben && aces >= 4) return 'obenabe';
        return suit;
      }
      if (allowPush && pick.score < threshold) return 'schieben';
      if (pick.mode === 'suit') return pick.suit;
      return pick.mode;
    }

    function unknownCards(table, seat) {
      var known = {};
      var hand = table.hands[seat] || [];
      for (var i = 0; i < hand.length; i++) known[hand[i].id] = 1;
      var seen = table.seen || [];
      for (var j = 0; j < seen.length; j++) known[seen[j].id] = 1;
      var trick = table.trick || [];
      for (var k = 0; k < trick.length; k++) known[trick[k].card.id] = 1;
      return E.freshDeck().filter(function (c) { return !known[c.id]; });
    }

    function higherTrumpsOut(table, seat, card) {
      if (!table.trump || table.trump.mode !== 'suit') return 0;
      if (card.suit !== table.trump.suit) return 0;
      var power = E.rankPower(card, table.trump);
      return unknownCards(table, seat).filter(function (c) {
        return c.suit === table.trump.suit && E.rankPower(c, table.trump) > power;
      }).length;
    }

    function trickPoints(table) {
      var n = 0;
      var trick = table.trick || [];
      for (var i = 0; i < trick.length; i++) n += E.pointsOf(trick[i].card, table.trump);
      return n;
    }

    function wouldWin(table, card) {
      var trick = (table.trick || []).slice();
      if (!trick.length) return true;
      var lead = trick[0].card.suit;
      var best = trick[0].card;
      for (var i = 1; i < trick.length; i++) {
        if (E.beats(trick[i].card, best, lead, table.trump)) best = trick[i].card;
      }
      return E.beats(card, best, lead, table.trump);
    }

    function partnerWinning(table, seat) {
      var trick = table.trick || [];
      if (!trick.length) return false;
      var winner = E.trickWinner(trick, table.trump);
      return E.teamOf(winner) === E.teamOf(seat) && winner !== seat;
    }

    function chooseCard(table, seat, level, rng) {
      var random = rng || Math.random;
      var legal = E.legalCards(table, seat);
      if (!legal.length) return null;
      if (legal.length === 1) return legal[0];
      if (level === 'anfaenger' && random() < 0.18) return legal[Math.floor(random() * legal.length)];

      var leading = !(table.trick || []).length;
      var partner = partnerWinning(table, seat);
      var scored = legal.map(function (card) {
        var win = wouldWin(table, card);
        var pts = E.pointsOf(card, table.trump);
        var value = 0;
        if (leading) {
          if (table.trump && table.trump.mode === 'suit' && card.suit === table.trump.suit) {
            value += level === 'turnier' && (card.rank === 'U' || card.rank === '9') ? 4 : 1;
          } else value -= pts * 0.15;
          value -= E.rankPower(card, table.trump) * 0.02;
        } else if (win) {
          var gain = trickPoints(table) + pts;
          if (partner) value -= 3 + pts;
          else value += 2 + gain;
          if (level === 'turnier') {
            var higher = higherTrumpsOut(table, seat, card);
            if (card.suit === (table.trump && table.trump.suit) && higher === 0) value += 3;
            if (higher > 0 && pts >= 10) value -= 2;
          }
          value -= E.rankPower(card, table.trump) * 0.05;
        } else if (partner) {
          value += pts * (level === 'anfaenger' ? 0.2 : 1.1);
        } else {
          value -= pts * (level === 'anfaenger' ? 0.4 : 1);
        }
        if (level === 'turnier' && table.tricksDone >= 7 && win && !partner) value += 2;
        return { card: card, value: value };
      });
      scored.sort(function (a, b) { return b.value - a.value; });
      return scored[0].card;
    }

    return { chooseTrump: chooseTrump, chooseCard: chooseCard, suitScore: suitScore };
  }

  return install(engineOf());
});
