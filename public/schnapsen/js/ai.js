/*
 * Mitspieler fürs Schnapsen.
 * Anfänger tauscht nur Ass und Zehner, dreht nicht zu und nimmt große Stiche.
 * Kneipe sagt 20er und 40er an und dreht zu, wenn die Hand die 66 trägt.
 * Turnier zählt die eigenen Augen und die offene Trumpfkarte, nicht das fremde Blatt.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SchnapsenAI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function engineOf() {
    var host = typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : null);
    if (host && host.SchnapsenEngine) return host.SchnapsenEngine;
    return require('./engine.js');
  }

  function byPower(E, cards, high) {
    return cards.slice().sort(function (a, b) {
      var d = E.powerOf(a) - E.powerOf(b);
      if (d) return high ? -d : d;
      return E.pointsOf(a) - E.pointsOf(b);
    })[0];
  }

  function choose(table, seat, level, rng) {
    var E = engineOf();
    var legal = E.legalState(table, seat);
    var hand = table.hands[seat];
    var beginner = level === 'anfaenger';
    if (legal.exchange && table.trumpCard && E.pointsOf(table.trumpCard) >= (beginner ? 10 : 3)) {
      return { type: 'exchange' };
    }
    if (!table.trick.length && legal.marriages.length) {
      var best = legal.marriages.slice().sort(function (a, b) { return b.points - a.points; })[0];
      var live = table.tricks[seat] > 0 || !table.rules.marriageNeedsTrick;
      if (live || best.points === 40 || !beginner) return { type: 'marriage', suit: best.suit };
    }
    if (legal.close && !beginner) {
      var trumps = hand.filter(function (c) { return c.suit === table.trump; }).length;
      if (table.points[seat] + E.sumPoints(hand) >= 66 && trumps >= 2 && table.points[seat] >= (level === 'turnier' ? 24 : 30)) {
        return { type: 'close' };
      }
    }
    var cards = legal.cards.length ? legal.cards : hand.slice();
    if (!cards.length) return null;
    if (!table.trick.length) {
      if (E.isStrict(table)) {
        var highTrump = cards.filter(function (c) { return c.suit === table.trump; });
        if (highTrump.length) return { type: 'card', id: byPower(E, highTrump, true).id };
      }
      var plain = cards.filter(function (c) { return c.suit !== table.trump; });
      return { type: 'card', id: byPower(E, plain.length ? plain : cards, false).id };
    }
    var led = table.trick[0].card;
    var beaters = cards.filter(function (c) { return E.cardBeats(c, led, table.trump); });
    var want = E.isStrict(table) || E.pointsOf(led) >= 10 || table.points[seat] >= 45 || level === 'turnier';
    if (beginner) want = E.pointsOf(led) >= 10 || E.isStrict(table);
    if (want && beaters.length) return { type: 'card', id: byPower(E, beaters, false).id };
    var ducks = cards.filter(function (c) { return !E.cardBeats(c, led, table.trump); });
    return { type: 'card', id: byPower(E, ducks.length ? ducks : cards, false).id };
  }

  return { choose: choose };
});
