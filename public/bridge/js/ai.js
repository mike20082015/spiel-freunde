/*
 * Natürliche Reizung, absichtlich klein und lesbar.
 * Fünf Oberfarben, 1 Sans Atout 15 bis 17 ohne fünf Oberfarben,
 * Stayman (2 Kreuz) und Blackwood (4 Sans Atout, 5 Kreuz = 0 oder 4 Asse).
 * Anfänger eröffnen ab 13 und ohne Kontra, Absage oder Schlemmfrage.
 * Die KI sieht nur die eigene Hand, den offenen Strohmann und die gespielten Karten.
 */
(function (root, factory) {
  var E = (typeof module === 'object' && module.exports) ? require('./engine.js') : root.BridgeEngine;
  var api = factory(E);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BridgeAI = api;
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  var STRAIN_OF = ['C', 'D', 'H', 'S'];

  function describe(hand) {
    var len = E.lengths(hand);
    var majors = [];
    if (len[2] >= 5) majors.push('H');
    if (len[3] >= 5) majors.push('S');
    return {
      hcp: E.hcp(hand),
      len: len,
      balanced: E.isBalanced(hand),
      majors: majors,
      aces: hand.filter(function (card) { return card.rank === 'A'; }).length
    };
  }

  function bid(level, strain) { return { kind: 'bid', level: level, strain: strain }; }
  function pass() { return { kind: 'pass' }; }

  function has(legal, call) { return E.callAllowed(legal, call); }

  function take(legal, call) {
    return call && has(legal, call) ? call : null;
  }

  function lowest(legal, strain) {
    for (var level = 1; level <= 7; level++) {
      var call = bid(level, strain);
      if (has(legal, call)) return call;
    }
    return null;
  }

  function atLeast(legal, level, strain) {
    for (var n = level; n <= 7; n++) {
      var call = bid(n, strain);
      if (has(legal, call)) return call;
    }
    return null;
  }

  function factsOf(state, seat) {
    var partner = E.partnerOf(seat);
    var bids = [];
    for (var i = 0; i < state.auction.length; i++) {
      if (state.auction[i].call.kind === 'bid') bids.push(state.auction[i]);
    }
    var lastBid = bids.length ? bids[bids.length - 1] : null;
    var myBids = bids.filter(function (entry) { return entry.seat === seat; });
    var partnerBids = bids.filter(function (entry) { return entry.seat === partner; });
    var oppBids = bids.filter(function (entry) { return E.teamOf(entry.seat) !== E.teamOf(seat); });
    var running = { C: 0, D: 0, H: 0, S: 0 };
    var agreed = null;
    bids.forEach(function (entry) {
      if (E.teamOf(entry.seat) !== E.teamOf(seat) || entry.call.strain === 'NT') return;
      running[entry.call.strain] += 1;
      if (running[entry.call.strain] >= 2) agreed = entry.call.strain;
    });
    var opening = bids[0] || null;
    var noOpp = oppBids.length === 0;
    var partnerLast = partnerBids.length ? partnerBids[partnerBids.length - 1] : null;
    var myLast = myBids.length ? myBids[myBids.length - 1] : null;
    return {
      lastBid: lastBid,
      myBids: myBids,
      partnerBids: partnerBids,
      oppBids: oppBids,
      agreed: agreed,
      opening: opening,
      noOpp: noOpp,
      partnerOpened: !!(opening && opening.seat === partner),
      iOpened: !!(opening && opening.seat === seat),
      staymanResponse: !!(opening && opening.seat === seat && noOpp && myBids.length === 1
        && myBids[0].call.level === 1 && myBids[0].call.strain === 'NT'
        && partnerBids.length === 1 && partnerBids[0].call.level === 2 && partnerBids[0].call.strain === 'C'
        && lastBid && lastBid.seat === partner),
      staymanAsk: !!(opening && opening.seat === partner && noOpp && partnerBids.length === 1
        && partnerBids[0].call.level === 1 && partnerBids[0].call.strain === 'NT' && myBids.length === 0),
      afterStayman: !!(opening && opening.seat === partner && noOpp && myBids.length === 1
        && myBids[0].call.level === 2 && myBids[0].call.strain === 'C' && partnerBids.length >= 2
        && partnerBids[0].call.strain === 'NT'),
      blackwood: !!(agreed && lastBid && lastBid.seat === partner && lastBid.call.level === 4 && lastBid.call.strain === 'NT'),
      blackwoodAnswer: !!(agreed && myLast && myLast.call.level === 4 && myLast.call.strain === 'NT'
        && partnerLast && partnerLast.call.level === 5 && partnerLast.call.strain !== 'NT'
        && lastBid && lastBid.seat === partner)
    };
  }

  function openBid(info, level) {
    var min = level === 'anfaenger' ? 13 : 12;
    if (info.balanced && info.hcp >= 15 && info.hcp <= 17 && !info.majors.length) return bid(1, 'NT');
    if (info.balanced && info.hcp >= 20 && info.hcp <= 21 && !info.majors.length) return bid(2, 'NT');
    if (info.hcp >= min && info.len[3] >= 5 && info.len[3] >= info.len[2]) return bid(1, 'S');
    if (info.hcp >= min && info.len[2] >= 5) return bid(1, 'H');
    if (level !== 'anfaenger' && info.hcp <= 9 && info.hcp >= 5) {
      if (info.len[3] >= 7) return bid(3, 'S');
      if (info.len[2] >= 7) return bid(3, 'H');
      if (info.len[1] >= 7) return bid(3, 'D');
      if (info.len[0] >= 7) return bid(3, 'C');
    }
    if (info.hcp < min) return pass();
    if (info.len[1] >= info.len[0]) return bid(1, 'D');
    return bid(1, 'C');
  }

  function supportRaise(info, strain, legal) {
    var count = info.len[{ C: 0, D: 1, H: 2, S: 3 }[strain]];
    var need = strain === 'H' || strain === 'S' ? 3 : 5;
    if (count < need || info.hcp < 6) return null;
    var level = info.hcp >= 13 ? 4 : info.hcp >= 10 ? 3 : 2;
    if (strain === 'C' || strain === 'D') level = Math.min(level, 3);
    return take(legal, atLeast(legal, level, strain));
  }

  function staymanAnswer(info, legal) {
    if (info.len[2] >= 4) return take(legal, bid(2, 'H'));
    if (info.len[3] >= 4) return take(legal, bid(2, 'S'));
    return take(legal, bid(2, 'D'));
  }

  function blackwoodResponse(info, legal) {
    var strain = info.aces === 1 ? 'D' : info.aces === 2 ? 'H' : info.aces === 3 ? 'S' : 'C';
    return take(legal, bid(5, strain)) || pass();
  }

  function placeAfterBlackwood(info, facts, legal) {
    var shown = { C: 0, D: 1, H: 2, S: 3 }[facts.partnerBids[facts.partnerBids.length - 1].call.strain];
    if (facts.partnerBids[facts.partnerBids.length - 1].call.strain === 'C') shown = info.aces >= 1 ? 0 : 4;
    var total = shown + info.aces;
    var trump = facts.agreed;
    if (total >= 4 && info.hcp >= 18) return take(legal, atLeast(legal, 7, trump)) || take(legal, atLeast(legal, 6, trump)) || pass();
    if (total >= 3) return take(legal, atLeast(legal, 6, trump)) || pass();
    return take(legal, atLeast(legal, 5, trump)) || pass();
  }

  function respondToOneNotrump(info, legal, level) {
    var fourMajor = info.len[2] >= 4 || info.len[3] >= 4;
    if (info.hcp >= 8 && fourMajor) return take(legal, bid(2, 'C'));
    if (info.len[3] >= 6 && info.hcp >= 10) return take(legal, bid(4, 'S'));
    if (info.len[2] >= 6 && info.hcp >= 10) return take(legal, bid(4, 'H'));
    if (info.len[3] >= 5 && info.hcp >= 10) return take(legal, bid(3, 'S'));
    if (info.len[2] >= 5 && info.hcp >= 10) return take(legal, bid(3, 'H'));
    if (info.hcp >= 10) return take(legal, bid(3, 'NT'));
    if (info.hcp >= 8) return take(legal, bid(2, 'NT'));
    return pass();
  }

  function afterStaymanBid(info, facts, legal) {
    var reply = facts.partnerBids[facts.partnerBids.length - 1].call;
    var fit = (reply.strain === 'H' && info.len[2] >= 4) || (reply.strain === 'S' && info.len[3] >= 4);
    if (fit) {
      if (info.hcp >= 10) return take(legal, bid(4, reply.strain));
      return take(legal, bid(3, reply.strain));
    }
    if (info.hcp >= 10) return take(legal, bid(3, 'NT'));
    if (info.hcp >= 8) return take(legal, bid(2, 'NT'));
    return pass();
  }

  function respondToSuit(info, opening, legal) {
    var strain = opening.call.strain;
    if (strain !== 'NT') {
      var raised = supportRaise(info, strain, legal);
      if (raised) return raised;
    }
    var suit = { C: 0, D: 1, H: 2, S: 3 }[strain];
    for (var s = 3; s >= 0; s--) {
      if (s === suit) continue;
      if (info.len[s] >= 4 && info.hcp >= 6) {
        var one = take(legal, bid(1, STRAIN_OF[s]));
        if (one) return one;
      }
    }
    if (info.hcp >= 10) {
      for (var t = 3; t >= 0; t--) {
        if (info.len[t] >= 5) {
          var two = take(legal, bid(2, STRAIN_OF[t]));
          if (two) return two;
        }
      }
    }
    if (info.hcp >= 13 && info.len[Math.max(0, suit)] < 7) return take(legal, atLeast(legal, 2, 'NT'));
    if (info.hcp >= 10) return take(legal, atLeast(legal, 2, 'NT'));
    if (info.hcp >= 6) return take(legal, bid(1, 'NT'));
    return null;
  }

  function rebid(info, facts, legal, level) {
    var partnerBid = facts.partnerBids[facts.partnerBids.length - 1];
    if (!partnerBid) return null;
    var mine = facts.myBids[0];
    var p = partnerBid.call;
    if (facts.agreed && info.hcp >= (level === 'turnier' ? 17 : 18) && level !== 'anfaenger') {
      var ask = take(legal, bid(4, 'NT'));
      if (ask && facts.lastBid.call.level < 5) return ask;
    }
    if (p.strain === mine.call.strain && p.strain !== 'NT') {
      if (p.level >= 4) return pass();
      if (p.level === 3) return info.hcp >= 15 ? take(legal, atLeast(legal, 4, p.strain)) : pass();
      if (info.hcp >= 18) return take(legal, atLeast(legal, 4, p.strain));
      if (info.hcp >= 16) return take(legal, atLeast(legal, 3, p.strain));
      return pass();
    }
    if (p.strain !== 'NT') {
      var count = info.len[{ C: 0, D: 1, H: 2, S: 3 }[p.strain]];
      if (count >= 4) {
        var raise = info.hcp >= 18 ? 4 : info.hcp >= 16 ? 3 : 2;
        return take(legal, atLeast(legal, raise, p.strain));
      }
    }
    if (mine.call.strain !== 'NT' && info.len[{ C: 0, D: 1, H: 2, S: 3 }[mine.call.strain]] >= 6) {
      return take(legal, lowest(legal, mine.call.strain));
    }
    return take(legal, atLeast(legal, 1, 'NT'));
  }

  function compete(info, facts, legal, level) {
    var last = facts.lastBid;
    if (!last) return null;
    var partnerBid = facts.partnerBids.length ? facts.partnerBids[facts.partnerBids.length - 1] : null;
    if (partnerBid && partnerBid.call.strain !== 'NT') {
      var count = info.len[{ C: 0, D: 1, H: 2, S: 3 }[partnerBid.call.strain]];
      var need = partnerBid.call.strain === 'H' || partnerBid.call.strain === 'S' ? 3 : 4;
      if (count >= need && info.hcp >= 6) {
        var raise = info.hcp >= 13 ? partnerBid.call.level + 2 : partnerBid.call.level + 1;
        var raised = take(legal, atLeast(legal, Math.min(raise, 4), partnerBid.call.strain));
        if (raised) return raised;
      }
    }
    if (!facts.myBids.length && E.teamOf(last.seat) !== E.teamOf(facts.opening ? facts.opening.seat : last.seat)) {
      /* Gegner haben gereizt. */
    }
    var oppStrain = last.call.strain;
    var oppSuit = { C: 0, D: 1, H: 2, S: 3 }[oppStrain];
    if (level !== 'anfaenger' && legal.double && oppStrain !== 'NT' && info.hcp >= 12 && oppSuit != null && info.len[oppSuit] <= 2) {
      return { kind: 'double' };
    }
    var minOver = level === 'anfaenger' ? 10 : 8;
    if (info.hcp >= minOver && info.hcp <= 16) {
      for (var s = 3; s >= 0; s--) {
        if (info.len[s] >= 5) {
          var over = take(legal, lowest(legal, STRAIN_OF[s]));
          if (over && over.level <= 2) return over;
        }
      }
    }
    if (facts.agreed && info.hcp >= 16) {
      var game = take(legal, atLeast(legal, 4, facts.agreed));
      if (game) return game;
    }
    return null;
  }

  function decide(state, seat, level) {
    var hand = state.hands[seat] || [];
    var info = describe(hand);
    var facts = factsOf(state, seat);
    var legal = E.legalCalls(state, seat);
    if (facts.blackwood) return blackwoodResponse(info, legal);
    if (facts.blackwoodAnswer) return placeAfterBlackwood(info, facts, legal);
    if (facts.staymanResponse) return staymanAnswer(info, legal) || pass();
    if (facts.staymanAsk) return respondToOneNotrump(info, legal, level) || pass();
    if (facts.afterStayman) return afterStaymanBid(info, facts, legal) || pass();
    if (!facts.lastBid) return openBid(info, level);
    if (facts.noOpp && facts.partnerOpened && !facts.myBids.length && facts.opening) {
      if (facts.opening.call.level === 1 && facts.opening.call.strain === 'NT') return respondToOneNotrump(info, legal, level) || pass();
      return respondToSuit(info, facts.opening, legal) || pass();
    }
    if (facts.noOpp && facts.iOpened && facts.partnerBids.length) {
      return rebid(info, facts, legal, level) || pass();
    }
    return compete(info, facts, legal, level) || pass();
  }

  function chooseBid(state, seat, level) {
    var legal = E.legalCalls(state, seat);
    var choice = decide(state, seat, level || 'kneipe');
    if (choice && E.callAllowed(legal, choice)) return choice;
    return pass();
  }

  function explain(state, seat, call) {
    var info = describe(state.hands[seat] || []);
    var facts = factsOf(state, seat);
    var head = info.hcp + (info.hcp === 1 ? ' Figurenpunkt' : ' Figurenpunkte');
    if (facts.staymanAsk && call.kind === 'bid' && call.level === 2 && call.strain === 'C') {
      return head + '. Vorschlag: 2 Kreuz, Stayman. Das fragt nach einer Oberfarbe zu viert.';
    }
    if (facts.staymanResponse && call.kind === 'bid') {
      if (call.strain === 'D') return head + '. Vorschlag: 2 Karo. Keine Oberfarbe zu viert, Antwort auf Stayman.';
      return head + '. Vorschlag: ' + E.callLabel(call) + '. Oberfarbe zu viert, Antwort auf Stayman.';
    }
    if (facts.blackwood && call.kind === 'bid') {
      return head + '. Vorschlag: ' + E.callLabel(call) + '. Blackwood: 5 Kreuz bedeutet 0 oder 4 Asse.';
    }
    if (call.kind === 'pass') return head + '. Vorschlag: Passen.';
    if (call.kind === 'double') return head + '. Vorschlag: Kontra. Kurz in der Gegnerfarbe, die anderen Farben liegen.';
    if (call.kind === 'redouble') return head + '. Vorschlag: Rekontra.';
    if (call.strain === 'NT' && call.level === 1) return head + ', ausgeglichen, keine fünf Oberfarben. Vorschlag: 1 Sans Atout.';
    if (call.level === 4 && call.strain === 'NT') return head + '. Vorschlag: 4 Sans Atout, Blackwood. Frage nach den Assen.';
    return head + '. Vorschlag: ' + E.callLabel(call) + '.';
  }

  function suggestBid(state, seat) {
    var call = chooseBid(state, seat, 'kneipe');
    return {
      hcp: E.hcp(state.hands[seat] || []),
      call: call,
      text: explain(state, seat, call)
    };
  }

  function rankValue(card) {
    return { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 }[card.rank];
  }

  function byRank(cards, dir) {
    return cards.slice().sort(function (a, b) { return (rankValue(a) - rankValue(b)) * dir; });
  }

  function visible(state, seat) {
    var seen = {};
    (state.hands[seat] || []).forEach(function (card) { seen[card.id] = card; });
    if (state.dummyVisible && state.contract) {
      (state.hands[state.contract.dummy] || []).forEach(function (card) { seen[card.id] = card; });
    }
    (state.tricks || []).forEach(function (trick) {
      trick.cards.forEach(function (play) { seen[play.card.id] = play.card; });
    });
    (state.trick || []).forEach(function (play) { seen[play.card.id] = play.card; });
    return seen;
  }

  function currentWinner(state) {
    if (!state.trick.length || !state.contract) return null;
    var trick = state.trick;
    var strain = state.contract.strain;
    var lead = trick[0].card.suit;
    var trump = strain === 'NT' ? -1 : { C: 0, D: 1, H: 2, S: 3 }[strain];
    var best = 0;
    for (var i = 1; i < trick.length; i++) {
      var a = trick[best].card;
      var b = trick[i].card;
      var bTrump = b.suit === trump;
      var aTrump = a.suit === trump;
      var better = false;
      if (bTrump && !aTrump) better = true;
      else if (bTrump && aTrump && rankValue(b) > rankValue(a)) better = true;
      else if (!bTrump && !aTrump && b.suit === lead && (a.suit !== lead || rankValue(b) > rankValue(a))) better = true;
      if (better) best = i;
    }
    return trick[best].seat;
  }

  function chooseCard(state, seat, level, rng) {
    var legal = E.legalCards(state, seat);
    if (!legal.length) return null;
    if (legal.length === 1) return legal[0];
    var random = typeof rng === 'function' ? rng : Math.random;
    if (level === 'anfaenger' && random() < 0.25) return byRank(legal, 1)[0];
    if (!state.trick.length) return leadCard(state, seat, legal);
    return followCard(state, seat, legal);
  }

  function leadCard(state, seat, legal) {
    var contract = state.contract;
    var decl = contract && (seat === contract.declarer || seat === contract.dummy);
    if (decl && contract.strain !== 'NT') {
      var trump = { C: 0, D: 1, H: 2, S: 3 }[contract.strain];
      var trumps = legal.filter(function (card) { return card.suit === trump; });
      var ours = (state.hands[contract.declarer] || []).concat(state.hands[contract.dummy] || []).filter(function (card) { return card.suit === trump; }).length;
      var drawn = (state.tricks || []).reduce(function (n, trick) {
        return n + trick.cards.filter(function (play) { return play.card.suit === trump; }).length;
      }, 0);
      if (trumps.length && ours + drawn < 13 && drawn < 6) return byRank(trumps, 1)[0];
    }
    var groups = {};
    legal.forEach(function (card) {
      if (!groups[card.suit]) groups[card.suit] = [];
      groups[card.suit].push(card);
    });
    var bestSuit = legal[0].suit;
    Object.keys(groups).forEach(function (suit) {
      if (groups[suit].length > groups[bestSuit].length) bestSuit = Number(suit);
    });
    var pile = groups[bestSuit];
    var high = byRank(pile, -1)[0];
    if (rankValue(high) >= 14) return high;
    return byRank(pile, 1)[Math.min(3, pile.length - 1)];
  }

  function followCard(state, seat, legal) {
    var winner = currentWinner(state);
    var partner = E.partnerOf(seat);
    var ordered = byRank(legal, 1);
    if (winner === partner) return ordered[0];
    var winning = ordered.filter(function (card) {
      var trial = state.trick.concat([{ seat: seat, card: card }]);
      return E.trickWinner(trial, state.contract.strain) === seat;
    });
    if (winning.length) return byRank(winning, 1)[0];
    return ordered[0];
  }

  return {
    describe: describe,
    factsOf: factsOf,
    chooseBid: chooseBid,
    suggestBid: suggestBid,
    explain: explain,
    chooseCard: chooseCard
  };
});
