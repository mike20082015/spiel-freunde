/*
 * Spiel-Freunde Jass: Schieber.
 * Sitze im Spiel im Gegenuhrzeigersinn (nach rechts):
 *   0 Süden Du, 1 Westen Vreni, 2 Norden Urs, 3 Osten Horst.
 * Teams: Du+Urs gegen Vreni+Horst. Vorhand ist der Sitz rechts vom Geber.
 * Eine Runde zählt 157 (152 Kartenpunkte + 5 für den letzten Stich). Match +100.
 * Ausmachen: Stöck beim zweiten Stöck-Blatt, dann Weis am Ende des ersten Stichs
 * vor den Stichpunkten, dann der Stich. Ist das Ziel erreicht, fallen spätere
 * Punkte dieses Augenblicks weg.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JassEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RANKS = ['6', '7', '8', '9', '10', 'U', 'O', 'K', 'A'];
  var SUIT_SWISS = ['Schellen', 'Rosen', 'Schilten', 'Eicheln'];
  var SUIT_FRENCH = ['Kreuz', 'Herz', 'Pik', 'Karo'];
  var RANK_SWISS = { '6': '6', '7': '7', '8': '8', '9': '9', '10': 'Banner', U: 'Under', O: 'Ober', K: 'König', A: 'As' };
  var RANK_FRENCH = { '6': '6', '7': '7', '8': '8', '9': '9', '10': '10', U: 'Bube', O: 'Dame', K: 'König', A: 'As' };
  var SEQ_POINTS = { 3: 20, 4: 50, 5: 100, 6: 150, 7: 200, 8: 250, 9: 300 };
  var FOUR_POINTS = { U: 200, '9': 150, A: 100, K: 100, O: 100, '10': 100 };
  var BASE_POINTS = { A: 11, K: 4, O: 3, U: 2, '10': 10, '9': 0, '8': 0, '7': 0, '6': 0 };
  var TRUMP_RANK = { U: 9, '9': 8, A: 7, K: 6, O: 5, '10': 4, '8': 3, '7': 2, '6': 1 };
  var PLAIN_RANK = { A: 9, K: 8, O: 7, U: 6, '10': 5, '9': 4, '8': 3, '7': 2, '6': 1 };
  var UNDENUFE_RANK = { '6': 9, '7': 8, '8': 7, '9': 6, '10': 5, U: 4, O: 3, K: 2, A: 1 };
  var ROUND_POINTS = 157;
  var MATCH_BONUS = 100;
  var LAST_TRICK = 5;
  var STOCK_POINTS = 20;

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
  function natural(rank) { return RANKS.indexOf(rank); }

  function makeCard(suit, rank) {
    return { suit: suit, rank: rank, id: String(suit) + rank };
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
    if (target === 1500 || target === '1500') return 1500;
    if (target === 2500 || target === '2500') return 2500;
    if (target === 1000 || target === '1000') return 1000;
    if (target === 'custom') {
      var n = Math.round(Number(custom));
      if (n >= 100 && n <= 10000) return n;
      return 1000;
    }
    return 1000;
  }

  function isTrumpCard(card, trump) {
    return !!(trump && trump.mode === 'suit' && card && card.suit === trump.suit);
  }

  function rankPower(card, trump) {
    if (!card) return 0;
    if (trump && trump.mode === 'undenufe') return UNDENUFE_RANK[card.rank];
    if (trump && trump.mode === 'obenabe') return PLAIN_RANK[card.rank];
    if (isTrumpCard(card, trump)) return 20 + TRUMP_RANK[card.rank];
    return PLAIN_RANK[card.rank];
  }

  function pointsOf(card, trump) {
    if (!card) return 0;
    if (isTrumpCard(card, trump)) {
      if (card.rank === 'U') return 20;
      if (card.rank === '9') return 14;
      return BASE_POINTS[card.rank];
    }
    if (trump && (trump.mode === 'obenabe' || trump.mode === 'undenufe') && card.rank === '8') return 8;
    return BASE_POINTS[card.rank];
  }

  function sumPoints(cards, trump) {
    var n = 0;
    for (var i = 0; i < cards.length; i++) n += pointsOf(cards[i], trump);
    return n;
  }

  function multiplier(trump, enabled) {
    if (!enabled || !trump) return 1;
    if (trump.mode === 'obenabe' || trump.mode === 'undenufe') return 3;
    if (trump.suit === 0 || trump.suit === 2) return 2;
    return 1;
  }

  function trumpName(trump, deck) {
    if (!trump) return 'noch offen';
    if (trump.mode === 'obenabe') return 'Obenabe';
    if (trump.mode === 'undenufe') return 'Undenufe';
    var names = deck === 'french' ? SUIT_FRENCH : SUIT_SWISS;
    return names[trump.suit] || 'Trumpf';
  }

  function cardName(card, deck) {
    if (!card) return '';
    var ranks = deck === 'french' ? RANK_FRENCH : RANK_SWISS;
    var suits = deck === 'french' ? SUIT_FRENCH : SUIT_SWISS;
    return ranks[card.rank] + ' ' + suits[card.suit];
  }

  function findCard(hand, id) {
    var key = id && id.id ? id.id : id;
    for (var i = 0; i < hand.length; i++) if (hand[i].id === key) return hand[i];
    return null;
  }

  function beats(card, other, leadSuit, trump) {
    var aTrump = isTrumpCard(card, trump);
    var bTrump = isTrumpCard(other, trump);
    if (aTrump && !bTrump) return true;
    if (!aTrump && bTrump) return false;
    if (aTrump && bTrump) return rankPower(card, trump) > rankPower(other, trump);
    if (card.suit !== leadSuit) return false;
    if (other.suit !== leadSuit) return true;
    return rankPower(card, trump) > rankPower(other, trump);
  }

  function highestTrump(trick, trump) {
    var best = null;
    if (!trump || trump.mode !== 'suit') return null;
    for (var i = 0; i < trick.length; i++) {
      var card = trick[i].card;
      if (card.suit !== trump.suit) continue;
      if (!best || rankPower(card, trump) > rankPower(best, trump)) best = card;
    }
    return best;
  }

  function undertrumps(card, trick, trump) {
    if (!isTrumpCard(card, trump)) return false;
    var best = highestTrump(trick, trump);
    if (!best) return false;
    return rankPower(card, trump) < rankPower(best, trump);
  }

  function legalCards(table, seat) {
    var hand = table.hands[seat] || [];
    var trick = table.trick || [];
    if (!trick.length) return hand.slice();
    var trump = table.trump;
    var lead = trick[0].card.suit;
    var trumpSuit = trump && trump.mode === 'suit' ? trump.suit : null;

    if (trumpSuit != null && lead === trumpSuit) {
      var trumps = hand.filter(function (c) { return c.suit === trumpSuit; });
      if (!trumps.length) return hand.slice();
      if (trumps.length === 1 && trumps[0].rank === 'U') return hand.slice();
      return trumps;
    }

    if (trumpSuit == null) {
      var follow = hand.filter(function (c) { return c.suit === lead; });
      return follow.length ? follow : hand.slice();
    }

    var onlyTrumps = hand.length > 0 && hand.every(function (c) { return c.suit === trumpSuit; });
    var hasLead = hand.some(function (c) { return c.suit === lead; });
    var moves = hand.filter(function (card) {
      if (undertrumps(card, trick, trump) && !onlyTrumps) return false;
      if (hasLead) return card.suit === lead || card.suit === trumpSuit;
      return true;
    });
    return moves.length ? moves : hand.slice();
  }

  function sequences(hand) {
    var out = [];
    for (var s = 0; s < 4; s++) {
      var cards = hand.filter(function (c) { return c.suit === s; }).sort(function (a, b) {
        return natural(a.rank) - natural(b.rank);
      });
      var run = [];
      function flush() {
        if (run.length >= 3) out.push(run.slice());
        run = [];
      }
      for (var i = 0; i < cards.length; i++) {
        if (!run.length || natural(cards[i].rank) === natural(run[run.length - 1].rank) + 1) run.push(cards[i]);
        else { flush(); run = [cards[i]]; }
      }
      flush();
    }
    return out.map(function (run) {
      return {
        kind: 'folge',
        cards: run,
        points: SEQ_POINTS[run.length],
        length: run.length,
        suit: run[0].suit,
        top: natural(run[run.length - 1].rank)
      };
    });
  }

  function fours(hand) {
    var out = [];
    var ranks = Object.keys(FOUR_POINTS);
    for (var i = 0; i < ranks.length; i++) {
      var rank = ranks[i];
      var cards = hand.filter(function (c) { return c.rank === rank; });
      if (cards.length === 4) {
        out.push({
          kind: 'vier',
          cards: cards,
          points: FOUR_POINTS[rank],
          length: 4,
          suit: null,
          top: natural(rank)
        });
      }
    }
    return out;
  }

  function meldKey(meld, trump) {
    if (!meld) return [-1, -1, -1, -1];
    var undenufe = trump && trump.mode === 'undenufe';
    var height = undenufe ? -meld.top : meld.top;
    var inTrump = trump && trump.mode === 'suit' && meld.suit === trump.suit ? 1 : 0;
    return [meld.points, meld.length, height, inTrump];
  }

  function keyBetter(a, b) {
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
  }

  function keySame(a, b) {
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function selectMelds(hand, trump) {
    var candidates = sequences(hand).concat(fours(hand));
    var best = { melds: [], total: 0, best: null, key: [-1, -1, -1, -1] };
    var n = candidates.length;
    var limit = 1 << n;
    for (var mask = 0; mask < limit; mask++) {
      var chosen = [];
      var used = {};
      var clash = false;
      for (var i = 0; i < n; i++) {
        if (!(mask & (1 << i))) continue;
        var meld = candidates[i];
        for (var c = 0; c < meld.cards.length; c++) {
          var key = meld.cards[c].id || (String(meld.cards[c].suit) + meld.cards[c].rank);
          if (used[key]) clash = true;
          used[key] = 1;
        }
        chosen.push(meld);
      }
      if (clash) continue;
      var key = [-1, -1, -1, -1];
      var total = 0;
      var top = null;
      for (var m = 0; m < chosen.length; m++) {
        total += chosen[m].points;
        var k = meldKey(chosen[m], trump);
        if (keyBetter(k, key)) { key = k; top = chosen[m]; }
      }
      if (keyBetter(key, best.key) || (keySame(key, best.key) && total > best.total)) {
        best = { melds: chosen, total: total, best: top, key: key };
      }
    }
    best.topPoints = best.best ? best.best.points : 0;
    return best;
  }

  function orderFromForehand(seat, forehand) {
    return (seat - forehand + 4) % 4;
  }

  function betterWeis(aSeat, bSeat, table) {
    var a = table.weis[aSeat];
    var b = table.weis[bSeat];
    if (!a || !a.best) return false;
    if (!b || !b.best) return true;
    var ka = meldKey(a.best, table.trump);
    var kb = meldKey(b.best, table.trump);
    if (keyBetter(ka, kb)) return true;
    if (keyBetter(kb, ka)) return false;
    return orderFromForehand(aSeat, table.forehand) < orderFromForehand(bSeat, table.forehand);
  }

  function stoeckHolder(hands, trump) {
    if (!trump || trump.mode !== 'suit') return null;
    for (var seat = 0; seat < 4; seat++) {
      var hasK = false;
      var hasO = false;
      var hand = hands[seat] || [];
      for (var i = 0; i < hand.length; i++) {
        if (hand[i].suit !== trump.suit) continue;
        if (hand[i].rank === 'K') hasK = true;
        if (hand[i].rank === 'O') hasO = true;
      }
      if (hasK && hasO) return seat;
    }
    return null;
  }

  function prepareWeis(table) {
    var source = table.originalHands || table.hands;
    table.weis = [0, 1, 2, 3].map(function (seat) {
      return selectMelds(source[seat] || [], table.trump);
    });
    table.stoeckSeat = stoeckHolder(source, table.trump);
    if (table.stoeckPlayed == null) table.stoeckPlayed = 0;
  }

  function dealInto(table, rng) {
    var deck = shuffle(freshDeck(), rng || Math.random);
    var forehand = nextSeat(table.dealer);
    var hands = [[], [], [], []];
    var i = 0;
    for (var round = 0; round < 3; round++) {
      for (var p = 0; p < 4; p++) {
        var seat = (forehand + p) % 4;
        hands[seat].push(deck[i], deck[i + 1], deck[i + 2]);
        i += 3;
      }
    }
    table.forehand = forehand;
    table.hands = hands;
    table.originalHands = hands.map(function (h) { return h.slice(); });
    table.phase = 'trump';
    table.turn = forehand;
    table.trump = null;
    table.pushed = false;
    table.announcer = null;
    table.trick = [];
    table.tricksDone = 0;
    table.lead = forehand;
    table.won = [[], [], [], []];
    table.trickWins = [0, 0, 0, 0];
    table.opened = [false, false, false, false];
    table.weis = [null, null, null, null];
    table.stoeckSeat = null;
    table.stoeckPlayed = 0;
    table.stoeckAwarded = false;
    table.gained = [0, 0];
    table.seen = [];
    table.handEvents = [];
  }

  function newTable(options, rng) {
    var opts = options || {};
    var random = rng || Math.random;
    var table = {
      scores: [0, 0],
      target: normalizeTarget(opts.target, opts.custom),
      multipliers: !!opts.multipliers,
      allowOben: opts.allowOben !== false,
      history: [],
      over: false,
      winner: null,
      dealer: Math.floor(random() * 4)
    };
    dealInto(table, random);
    return table;
  }

  function fromPosition(spec) {
    var src = spec || {};
    var hands = [0, 1, 2, 3].map(function (seat) {
      return (src.hands && src.hands[seat] ? src.hands[seat] : []).map(function (c) {
        return makeCard(c.suit, c.rank);
      });
    });
    var table = {
      scores: (src.scores || [0, 0]).slice(),
      target: src.target == null ? 1000 : src.target,
      multipliers: !!src.multipliers,
      allowOben: src.allowOben !== false,
      history: [],
      over: false,
      winner: null,
      dealer: src.dealer == null ? 3 : src.dealer,
      forehand: src.forehand == null ? 0 : src.forehand,
      hands: hands,
      originalHands: src.originalHands ? src.originalHands.map(function (h) {
        return h.map(function (c) { return makeCard(c.suit, c.rank); });
      }) : hands.map(function (h) { return h.slice(); }),
      phase: src.phase || 'play',
      turn: src.turn == null ? (src.forehand == null ? 0 : src.forehand) : src.turn,
      trump: src.trump || null,
      pushed: !!src.pushed,
      announcer: src.announcer == null ? null : src.announcer,
      trick: (src.trick || []).map(function (t) {
        return { seat: t.seat, card: makeCard(t.card.suit, t.card.rank) };
      }),
      tricksDone: src.tricksDone || 0,
      lead: src.lead == null ? (src.forehand == null ? 0 : src.forehand) : src.lead,
      won: [[], [], [], []],
      trickWins: src.trickWins ? src.trickWins.slice() : [0, 0, 0, 0],
      opened: src.opened ? src.opened.slice() : [false, false, false, false],
      stoeckPlayed: src.stoeckPlayed || 0,
      stoeckAwarded: !!src.stoeckAwarded,
      gained: [0, 0],
      seen: [],
      handEvents: []
    };
    if (table.trump) prepareWeis(table);
    if (src.stoeckPlayed != null) table.stoeckPlayed = src.stoeckPlayed;
    if (src.stoeckAwarded) table.stoeckAwarded = true;
    return table;
  }

  function award(table, team, raw, reason, events) {
    if (table.over || !raw) return 0;
    var mult = multiplier(table.trump, table.multipliers);
    var pts = raw * mult;
    table.scores[team] += pts;
    table.gained[team] += pts;
    events.push({ type: 'score', reason: reason, team: team, raw: raw, points: pts, mult: mult });
    if (table.scores[team] >= table.target) {
      table.over = true;
      table.winner = team;
      table.phase = 'matchEnd';
      events.push({ type: 'bedanken', team: team, scores: table.scores.slice() });
    }
    return pts;
  }

  function chooseTrump(table, seat, choice) {
    if (table.over) return { ok: false, reason: 'match' };
    if (table.phase !== 'trump' && table.phase !== 'trumpPartner') return { ok: false, reason: 'phase' };
    if (seat !== table.turn) return { ok: false, reason: 'turn' };
    var mode = choice;
    var suit = null;
    if (choice && typeof choice === 'object') {
      mode = choice.mode;
      suit = choice.suit;
    }
    if (typeof choice === 'number') { mode = 'suit'; suit = choice; }
    if (mode === 'schieben') {
      if (table.phase !== 'trump' || table.pushed) return { ok: false, reason: 'schieben' };
      table.pushed = true;
      table.phase = 'trumpPartner';
      table.turn = partnerOf(seat);
      table.announcer = seat;
      return { ok: true, events: [{ type: 'schieben', seat: seat }] };
    }
    if (mode === 'obenabe' || mode === 'undenufe') {
      if (!table.allowOben) return { ok: false, reason: 'verboten' };
      table.trump = { mode: mode, suit: null };
    } else if (mode === 'suit' && suit >= 0 && suit <= 3) {
      table.trump = { mode: 'suit', suit: suit };
    } else return { ok: false, reason: 'wahl' };
    table.announcer = seat;
    table.phase = 'play';
    table.turn = table.forehand;
    table.lead = table.forehand;
    prepareWeis(table);
    return { ok: true, events: [{ type: 'trump', seat: seat, trump: table.trump }] };
  }

  function trickWinner(trick, trump) {
    var lead = trick[0].card.suit;
    var best = 0;
    for (var i = 1; i < trick.length; i++) {
      if (beats(trick[i].card, trick[best].card, lead, trump)) best = i;
    }
    return trick[best].seat;
  }

  function scoreWeis(table, events) {
    var winner = null;
    for (var seat = 0; seat < 4; seat++) {
      if (!table.weis[seat] || !table.weis[seat].best) continue;
      if (winner == null || betterWeis(seat, winner, table)) winner = seat;
    }
    if (winner == null) {
      events.push({ type: 'weis', team: null, points: 0, melds: [] });
      return;
    }
    var team = teamOf(winner);
    var total = 0;
    var shown = [];
    for (var s = 0; s < 4; s++) {
      if (teamOf(s) !== team || !table.weis[s]) continue;
      total += table.weis[s].total;
      if (table.weis[s].melds.length) shown.push({ seat: s, melds: table.weis[s].melds, total: table.weis[s].total });
    }
    events.push({ type: 'weis', team: team, seat: winner, raw: total, shown: shown });
    if (total) award(table, team, total, 'weis', events);
  }

  function finishTrick(table, events) {
    var first = table.tricksDone === 0;
    var winner = trickWinner(table.trick, table.trump);
    events.push({ type: 'trick', winner: winner, cards: table.trick.map(function (t) { return { seat: t.seat, card: t.card }; }) });
    if (first) {
      scoreWeis(table, events);
      if (table.over) return;
    }
    var raw = 0;
    for (var i = 0; i < table.trick.length; i++) raw += pointsOf(table.trick[i].card, table.trump);
    table.trickWins[winner] += 1;
    table.tricksDone += 1;
    if (table.tricksDone === 9) {
      raw += LAST_TRICK;
      var byTeam = [0, 0];
      for (var s = 0; s < 4; s++) byTeam[teamOf(s)] += table.trickWins[s];
      if (byTeam[0] === 9 || byTeam[1] === 9) raw += MATCH_BONUS;
    }
    for (var k = 0; k < table.trick.length; k++) table.won[winner].push(table.trick[k].card);
    award(table, teamOf(winner), raw, 'stich', events);
    table.trick = [];
    if (table.over) return;
    if (table.tricksDone === 9) {
      table.phase = 'handEnd';
      table.history.push({
        trump: table.trump,
        gained: table.gained.slice(),
        scores: table.scores.slice(),
        match: table.trickWins[0] + table.trickWins[2] === 9 || table.trickWins[1] + table.trickWins[3] === 9
      });
      events.push({ type: 'handEnd', gained: table.gained.slice(), scores: table.scores.slice() });
      return;
    }
    table.lead = winner;
    table.turn = winner;
  }

  function playCard(table, seat, cardId) {
    if (table.over) return { ok: false, reason: 'match' };
    if (table.phase !== 'play') return { ok: false, reason: 'phase' };
    if (seat !== table.turn) return { ok: false, reason: 'turn' };
    var hand = table.hands[seat];
    var card = findCard(hand, cardId);
    if (!card) return { ok: false, reason: 'karte' };
    var legal = legalCards(table, seat);
    if (!legal.some(function (c) { return c.id === card.id; })) return { ok: false, reason: 'ungültig' };
    hand.splice(hand.indexOf(card), 1);
    table.seen.push(card);
    var events = [];
    if (!table.opened[seat]) {
      table.opened[seat] = true;
      var top = table.weis[seat] ? table.weis[seat].topPoints : 0;
      if (top) events.push({ type: 'ansage', seat: seat, points: top });
    }
    table.trick.push({ seat: seat, card: card });
    if (!table.stoeckAwarded && table.stoeckSeat === seat && table.trump && table.trump.mode === 'suit' && card.suit === table.trump.suit && (card.rank === 'K' || card.rank === 'O')) {
      table.stoeckPlayed += 1;
      if (table.stoeckPlayed >= 2) {
        table.stoeckAwarded = true;
        events.push({ type: 'stoeck', seat: seat, team: teamOf(seat), raw: STOCK_POINTS });
        award(table, teamOf(seat), STOCK_POINTS, 'stoeck', events);
      }
    }
    if (table.over) return { ok: true, events: events };
    if (table.trick.length < 4) {
      table.turn = nextSeat(seat);
      return { ok: true, events: events };
    }
    finishTrick(table, events);
    return { ok: true, events: events };
  }

  function nextHand(table, rng) {
    if (table.over) return { ok: false, reason: 'match' };
    table.dealer = nextSeat(table.dealer);
    dealInto(table, rng || Math.random);
    return { ok: true };
  }

  return {
    RANKS: RANKS,
    SUIT_SWISS: SUIT_SWISS,
    SUIT_FRENCH: SUIT_FRENCH,
    RANK_SWISS: RANK_SWISS,
    RANK_FRENCH: RANK_FRENCH,
    ROUND_POINTS: ROUND_POINTS,
    MATCH_BONUS: MATCH_BONUS,
    LAST_TRICK: LAST_TRICK,
    STOCK_POINTS: STOCK_POINTS,
    SEQ_POINTS: SEQ_POINTS,
    FOUR_POINTS: FOUR_POINTS,
    mulberry32: mulberry32,
    teamOf: teamOf,
    nextSeat: nextSeat,
    partnerOf: partnerOf,
    makeCard: makeCard,
    freshDeck: freshDeck,
    shuffle: shuffle,
    normalizeTarget: normalizeTarget,
    rankPower: rankPower,
    pointsOf: pointsOf,
    sumPoints: sumPoints,
    multiplier: multiplier,
    trumpName: trumpName,
    cardName: cardName,
    legalCards: legalCards,
    selectMelds: selectMelds,
    newTable: newTable,
    fromPosition: fromPosition,
    chooseTrump: chooseTrump,
    playCard: playCard,
    nextHand: nextHand,
    beats: beats,
    trickWinner: trickWinner
  };
});
