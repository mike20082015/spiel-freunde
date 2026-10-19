/*
 * Spiel-Freunde Rommé: Regel-Engine.
 * Läuft im Browser (window.RommeEngine) und in Node (require).
 *
 * Karten: Farbe + Rang + Kopie, z. B. "HA#0", "H10#1", "JK#2".
 * Farben: C Kreuz, S Pik, H Herz, D Karo. Joker: "JK#0" …
 *
 * Hausregeln als Voreinstellung (Kneipen-Rommé, nicht die strenge Verbandsordnung):
 *   2×52 + 6 Joker, 13 Karten, Geber 14 und beginnt ohne Ziehen.
 *   Herauskommen ab 40, Anlegen danach, Joker tauschen (auch aus einem Dreiersatz),
 *   Joker in einer Folge ab 4 nebeneinander erlaubt, „1 echte + 2 Joker“ bleibt verboten.
 *   Ablage nur, wenn sie sofort verwendet wird. Joker beim Abheben darf behalten werden.
 *   Ecke K-A-2 aus. Hand-Rommé verdoppelt die Schlechtpunkte.
 *   Letzte Karte nicht vom offenen Stapel. Joker nur als letzte Karte abwerfen.
 *   Räuber-Rommé aus. Partie bis 500 Schlechtpunkte, niedrigste Summe gewinnt.
 * Ass in A-2-3 zählt 1, sonst 11. Joker zählt wie die Karte, die er vertritt.
 * Schlechtpunkte: Joker 20, Ass 11, Bilder 10, Zahlen nach Augen.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RommeEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SUITS = ['C', 'S', 'H', 'D'];
  const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
  const SUIT_NAMES = { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo', J: 'Joker' };
  const SUIT_SYMBOLS = { C: '♣', S: '♠', H: '♥', D: '♦', J: '★' };
  const RANK_NAMES = {
    A: 'Ass', K: 'König', Q: 'Dame', J: 'Bube', '10': 'Zehn', '9': 'Neun', '8': 'Acht',
    '7': 'Sieben', '6': 'Sechs', '5': 'Fünf', '4': 'Vier', '3': 'Drei', '2': 'Zwei', JK: 'Joker',
  };
  const RANK_SHORT = {
    A: 'A', K: 'K', Q: 'D', J: 'B', '10': '10', '9': '9', '8': '8',
    '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2', JK: 'J',
  };
  const PIP = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
  const DEFAULT_RULES = {
    jokers: 6,
    initial: 40,
    corner: false,
    jokerLayout: 'house',
    swapJokers: true,
    fullSetToSwap: false,
    discardMustUse: true,
    keepCutJoker: true,
    handRommeDouble: true,
    noLastFromDiscard: true,
    robber: false,
    jokerDiscardLastOnly: true,
    scoring: 'penalty',
  };

  function normalizeRules(raw) {
    const r = Object.assign({}, DEFAULT_RULES, raw || {});
    r.jokers = Number(r.jokers) === 4 ? 4 : 6;
    const initial = Number(r.initial);
    r.initial = initial === 30 || initial === 35 ? initial : 40;
    r.corner = !!r.corner;
    r.jokerLayout = r.jokerLayout === 'strict' ? 'strict' : 'house';
    r.swapJokers = r.swapJokers !== false;
    r.fullSetToSwap = !!r.fullSetToSwap;
    r.discardMustUse = r.discardMustUse !== false;
    r.keepCutJoker = r.keepCutJoker !== false;
    r.handRommeDouble = r.handRommeDouble !== false;
    r.noLastFromDiscard = r.noLastFromDiscard !== false;
    r.robber = !!r.robber;
    r.jokerDiscardLastOnly = r.jokerDiscardLastOnly !== false;
    r.scoring = r.scoring === 'tournament' ? 'tournament' : 'penalty';
    return r;
  }

  function normalizeTarget(target, custom) {
    if (target === '300' || target === 300) return 300;
    if (target === '500' || target === 500 || target == null) return 500;
    if (target === '1000' || target === 1000) return 1000;
    const source = target === 'custom' ? custom : target;
    const n = Math.round(+source);
    if (!Number.isFinite(n) || n <= 0) return 500;
    return Math.max(1, Math.min(5000, n));
  }

  function normalizeRounds(n) {
    const v = Math.round(+n);
    if (!Number.isFinite(v)) return 4;
    return Math.max(1, Math.min(24, v));
  }

  function parseCard(id) {
    const parts = String(id).split('#');
    const body = parts[0];
    const copy = parts.length > 1 ? +parts[1] : 0;
    if (body === 'JK') return { id: String(id), suit: 'J', rank: 'JK', copy: copy };
    return { id: String(id), suit: body.charAt(0), rank: body.slice(1), copy: copy };
  }
  const suitOf = (c) => parseCard(c).suit;
  const rankOf = (c) => parseCard(c).rank;
  const isJoker = (c) => rankOf(c) === 'JK';

  function rankAt(value) {
    if (value === 1 || value === 14) return 'A';
    if (value === 11) return 'J';
    if (value === 12) return 'Q';
    if (value === 13) return 'K';
    if (value >= 15 && value <= 23) return String(value - 13);
    if (value >= 2 && value <= 10) return String(value);
    return null;
  }
  function valueOfRank(rank, mode) {
    const p = PIP[rank];
    if (mode === 'low') return p;
    if (mode === 'high') return rank === 'A' ? 14 : p;
    if (rank === 'A') return 14;
    if (p >= 11) return p;
    return p + 13;
  }
  function pointsForValue(value) {
    if (value === 1) return 1;
    const rank = rankAt(value);
    if (rank === 'A') return 11;
    if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
    return +rank;
  }
  function rankPoints(rank, aceLow) {
    if (rank === 'A') return aceLow ? 1 : 11;
    if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
    return +rank;
  }
  function deadwoodPoints(card) {
    if (isJoker(card)) return 20;
    return rankPoints(rankOf(card), false);
  }
  function deadwood(cards) {
    return (cards || []).reduce((sum, card) => sum + deadwoodPoints(card), 0);
  }
  function cardName(card) {
    if (isJoker(card)) return 'Joker';
    return SUIT_NAMES[suitOf(card)] + '-' + RANK_NAMES[rankOf(card)];
  }
  function cardShort(card) {
    if (isJoker(card)) return '★J';
    return SUIT_SYMBOLS[suitOf(card)] + RANK_SHORT[rankOf(card)];
  }
  function describeMeld(meld) {
    if (!meld) return '';
    if (meld.kind === 'set') {
      const name = RANK_NAMES[meld.rank] || meld.rank;
      const jokers = (meld.slots || []).filter((s) => s.joker).map((s) => SUIT_NAMES[s.suit]);
      return jokers.length ? name + ' (Joker: ' + jokers.join(', ') + ')' : name;
    }
    const slots = meld.slots || [];
    const head = slots[0];
    const tail = slots[slots.length - 1];
    const label = SUIT_NAMES[meld.suit] + ' ' + RANK_SHORT[head.rank] + '–' + RANK_SHORT[tail.rank];
    const jokers = slots.filter((s) => s.joker).map((s) => RANK_SHORT[s.rank]);
    return jokers.length ? label + ' (Joker: ' + jokers.join(', ') + ')' : label;
  }

  function createDeck(jokers) {
    const n = Number(jokers) === 4 ? 4 : 6;
    const deck = [];
    for (let copy = 0; copy < 2; copy++) {
      for (let s = 0; s < SUITS.length; s++) {
        for (let r = 0; r < RANKS.length; r++) deck.push(SUITS[s] + RANKS[r] + '#' + copy);
      }
    }
    for (let i = 0; i < n; i++) deck.push('JK#' + i);
    return deck;
  }
  function seededRng(seed) {
    let a = (seed >>> 0) || 1;
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

  function fail(reason) { return { ok: false, reason: reason }; }
  function ok(extra) { return Object.assign({ ok: true }, extra || {}); }

  function setJokersOk(naturals, jokers, rules) {
    if (naturals < 1) return false;
    if (rules.jokerLayout === 'strict') return jokers <= naturals;
    if (naturals === 1 && jokers === 2) return false;
    return true;
  }
  function jokerPatternOk(flags, rules) {
    const jokers = flags.filter(Boolean).length;
    const naturals = flags.length - jokers;
    if (naturals < 1 || flags.length < 3) return false;
    let adjacent = false;
    for (let i = 0; i < flags.length - 1; i++) if (flags[i] && flags[i + 1]) adjacent = true;
    if (rules.jokerLayout === 'strict') return jokers <= naturals && !adjacent;
    if (flags.length === 3 && naturals < 2) return false;
    if (adjacent && flags.length < 4) return false;
    return true;
  }

  function makeRun(suit, start, end, natMap, jokerIds, rules, mode) {
    const flags = [];
    const slots = [];
    let ji = 0;
    for (let value = start; value <= end; value++) {
      const natural = natMap[value];
      if (natural) {
        flags.push(false);
        slots.push({
          card: natural, rank: rankAt(value), suit: suit, joker: false,
          points: pointsForValue(value), value: value,
        });
      } else {
        if (ji >= jokerIds.length) return null;
        flags.push(true);
        slots.push({
          card: jokerIds[ji++], rank: rankAt(value), suit: suit, joker: true,
          points: pointsForValue(value), value: value,
        });
      }
    }
    if (ji !== jokerIds.length) return null;
    if (!jokerPatternOk(flags, rules)) return null;
    return {
      kind: 'run',
      suit: suit,
      rank: null,
      mode: mode,
      aceLow: mode === 'low' && slots.some((s) => s.rank === 'A'),
      cards: slots.map((s) => s.card),
      slots: slots,
      points: slots.reduce((sum, s) => sum + s.points, 0),
    };
  }

  function combinations(list, count) {
    const out = [];
    function walk(start, acc) {
      if (acc.length === count) { out.push(acc.slice()); return; }
      for (let i = start; i < list.length; i++) {
        acc.push(list[i]);
        walk(i + 1, acc);
        acc.pop();
      }
    }
    walk(0, []);
    return out;
  }

  function runCandidates(suit, cards, jokers, rules) {
    const out = [];
    const modes = rules.corner ? ['low', 'high', 'corner'] : ['low', 'high'];
    for (let m = 0; m < modes.length; m++) {
      const mode = modes[m];
      const natMap = {};
      const seen = {};
      for (let i = 0; i < cards.length; i++) {
        const rank = rankOf(cards[i]);
        if (seen[rank]) continue;
        seen[rank] = true;
        natMap[valueOfRank(rank, mode)] = cards[i];
      }
      const minBound = mode === 'high' ? 2 : mode === 'corner' ? 11 : 1;
      const maxBound = mode === 'corner' ? 23 : 14;
      for (let start = minBound; start <= maxBound; start++) {
        for (let end = start + 2; end <= maxBound; end++) {
          if (end - start + 1 > cards.length + jokers.length) break;
          if (mode === 'corner' && !(start <= 14 && end >= 15)) continue;
          let need = 0;
          let naturals = 0;
          for (let value = start; value <= end; value++) {
            if (natMap[value]) naturals += 1;
            else need += 1;
          }
          if (!naturals || need > jokers.length) continue;
          const meld = makeRun(suit, start, end, natMap, jokers.slice(0, need), rules, mode);
          if (meld) out.push(meld);
        }
      }
    }
    return out;
  }

  function setCandidates(rank, cards, jokers, rules) {
    const bySuit = {};
    for (let i = 0; i < cards.length; i++) {
      const suit = suitOf(cards[i]);
      if (!bySuit[suit]) bySuit[suit] = cards[i];
    }
    const suits = SUITS.filter((s) => bySuit[s]);
    const out = [];
    const pts = rankPoints(rank, false);
    for (let mask = 1; mask < (1 << suits.length); mask++) {
      const chosen = [];
      for (let i = 0; i < suits.length; i++) if (mask & (1 << i)) chosen.push(suits[i]);
      for (let jn = 0; jn <= jokers.length; jn++) {
        const total = chosen.length + jn;
        if (total < 3 || total > 4) continue;
        if (!setJokersOk(chosen.length, jn, rules)) continue;
        const missing = SUITS.filter((s) => chosen.indexOf(s) < 0);
        if (jn > missing.length) continue;
        const suitPicks = jn === 0 ? [[]] : combinations(missing, jn);
        const useJokers = jokers.slice(0, jn);
        for (let a = 0; a < suitPicks.length; a++) {
          const map = {};
          chosen.forEach((s) => { map[s] = { card: bySuit[s], joker: false }; });
          suitPicks[a].forEach((s, i) => { map[s] = { card: useJokers[i], joker: true }; });
          const slots = [];
          SUITS.forEach((s) => {
            if (!map[s]) return;
            slots.push({
              card: map[s].card, rank: rank, suit: s, joker: map[s].joker,
              points: pts, value: rank === 'A' ? 14 : PIP[rank],
            });
          });
          out.push({
            kind: 'set', suit: null, rank: rank, mode: 'set', aceLow: false,
            cards: slots.map((s) => s.card), slots: slots, points: pts * slots.length,
          });
        }
      }
    }
    return out;
  }

  function sameCards(a, b) {
    if (a.length !== b.length) return false;
    const left = a.slice().sort();
    const right = b.slice().sort();
    for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
    return true;
  }

  function arrangements(cards, rules) {
    const list = cards || [];
    if (list.length < 3) return [];
    const jokers = list.filter(isJoker);
    const byRank = {};
    const bySuit = {};
    for (let i = 0; i < list.length; i++) {
      if (isJoker(list[i])) continue;
      const rank = rankOf(list[i]);
      const suit = suitOf(list[i]);
      (byRank[rank] || (byRank[rank] = [])).push(list[i]);
      (bySuit[suit] || (bySuit[suit] = [])).push(list[i]);
    }
    let found = [];
    Object.keys(byRank).forEach((rank) => {
      setCandidates(rank, byRank[rank], jokers, rules).forEach((meld) => {
        if (sameCards(meld.cards, list)) found.push(meld);
      });
    });
    Object.keys(bySuit).forEach((suit) => {
      runCandidates(suit, bySuit[suit], jokers, rules).forEach((meld) => {
        if (sameCards(meld.cards, list)) found.push(meld);
      });
    });
    return found;
  }

  function buildMeld(cards, rules, opts) {
    let found = arrangements(cards, rules);
    if (opts && opts.mode) found = found.filter((m) => m.mode === opts.mode);
    if (!found.length) return null;
    found.sort((a, b) => b.points - a.points || a.cards.length - b.cards.length);
    if (opts && opts.prefer === 'low') {
      const low = found.find((m) => m.kind === 'run' && m.slots[0].joker);
      if (low) return low;
    }
    if (opts && opts.prefer === 'high') {
      const high = found.find((m) => m.kind === 'run' && m.slots[m.slots.length - 1].joker);
      if (high) return high;
    }
    return found[0];
  }
  function isRun(cards, rules) {
    return arrangements(cards, rules).some((m) => m.kind === 'run');
  }
  function isSet(cards, rules) {
    return arrangements(cards, rules).some((m) => m.kind === 'set');
  }

  function candidateMelds(hand, rules) {
    const jokers = hand.filter(isJoker);
    const byRank = {};
    const bySuit = {};
    for (let i = 0; i < hand.length; i++) {
      if (isJoker(hand[i])) continue;
      const rank = rankOf(hand[i]);
      const suit = suitOf(hand[i]);
      (byRank[rank] || (byRank[rank] = [])).push(hand[i]);
      (bySuit[suit] || (bySuit[suit] = [])).push(hand[i]);
    }
    const out = [];
    const seen = {};
    function push(meld) {
      const key = meld.mode + ':' + meld.cards.slice().sort().join(',');
      if (seen[key]) return;
      seen[key] = true;
      out.push(meld);
    }
    Object.keys(byRank).forEach((rank) => setCandidates(rank, byRank[rank], jokers, rules).forEach(push));
    Object.keys(bySuit).forEach((suit) => runCandidates(suit, bySuit[suit], jokers, rules).forEach(push));
    out.sort((a, b) => b.points - a.points || a.cards.length - b.cards.length);
    return out;
  }

  function without(hand, cards) {
    const drop = cards.slice();
    const next = [];
    for (let i = 0; i < hand.length; i++) {
      const at = drop.indexOf(hand[i]);
      if (at >= 0) drop.splice(at, 1);
      else next.push(hand[i]);
    }
    return next;
  }

  function searchPlan(hand, rules, depth, mustCard) {
    const empty = { points: 0, groups: [], rest: hand.slice() };
    if (depth <= 0 || hand.length < 3) return empty;
    let pool = candidateMelds(hand, rules);
    if (mustCard) pool = pool.filter((m) => m.cards.indexOf(mustCard) >= 0);
    pool = pool.slice(0, mustCard ? 8 : 8);
    let best = empty;
    for (let i = 0; i < pool.length; i++) {
      const rest = without(hand, pool[i].cards);
      const sub = searchPlan(rest, rules, depth - 1, null);
      const points = pool[i].points + sub.points;
      if (points > best.points) {
        best = { points: points, groups: [pool[i]].concat(sub.groups), rest: sub.rest };
      }
    }
    if (mustCard && best.groups.length) return best;
    return best.points > 0 ? best : empty;
  }

  function freeDiscard(plan, rules, keep) {
    if (!plan.groups.length) return plan;
    const keeps = plan.groups.some((g) => g.cards.indexOf(keep) >= 0);
    if (plan.rest.length >= 1) {
      if (keep && !keeps) return { points: 0, groups: [], rest: plan.rest.slice() };
      return plan;
    }
    let best = null;
    for (let g = 0; g < plan.groups.length; g++) {
      const group = plan.groups[g];
      for (let i = 0; i < group.cards.length; i++) {
        const card = group.cards[i];
        if (keep && card === keep) continue;
        const left = group.cards.filter((c) => c !== card);
        const rebuilt = left.length >= 3 ? buildMeld(left, rules, { mode: group.mode }) : null;
        if (keep && left.indexOf(keep) < 0 && !(rebuilt && rebuilt.cards.indexOf(keep) >= 0)) continue;
        const groups = plan.groups.slice();
        if (rebuilt) groups[g] = rebuilt;
        else groups.splice(g, 1);
        if (keep && !groups.some((m) => m.cards.indexOf(keep) >= 0)) continue;
        const points = groups.reduce((sum, m) => sum + m.points, 0);
        if (!best || points > best.points) best = { points: points, groups: groups, rest: [card] };
      }
    }
    return best || plan;
  }

  function planHand(hand, rules, mustCard) {
    const found = searchPlan(hand, rules, 3, mustCard || null);
    return freeDiscard(found, rules, mustCard || null);
  }

  function preserves(oldMeld, built, rules) {
    for (let i = 0; i < oldMeld.slots.length; i++) {
      const slot = oldMeld.slots[i];
      const now = built.slots.find((s) => s.card === slot.card);
      if (!now) return false;
      if (!rules.robber && (now.rank !== slot.rank || now.suit !== slot.suit)) return false;
      if (!slot.joker && (now.rank !== slot.rank || now.suit !== slot.suit)) return false;
    }
    return true;
  }

  function SNAP_KEYS() {
    return ['rules', 'dealer', 'turn', 'phase', 'hands', 'stock', 'discard', 'melds', 'opened', 'openedAtStart', 'anyoneOpenedAtStart', 'laidThisTurn', 'didLayoff', 'mustUse', 'held', 'workspace', 'log', 'nextId', 'scores', 'result', 'cut', 'closing'];
  }
  function snapshot(state) {
    const out = {};
    const keys = SNAP_KEYS();
    for (let i = 0; i < keys.length; i++) out[keys[i]] = state[keys[i]];
    return JSON.parse(JSON.stringify(out));
  }
  function restoreFrom(state, snap) {
    const keys = SNAP_KEYS();
    for (let i = 0; i < keys.length; i++) state[keys[i]] = snap[keys[i]];
  }
  function cloneState(state) {
    const copy = snapshot(state);
    copy.rng = state.rng;
    copy.undo = [];
    return copy;
  }

  function blank(rules) {
    return {
      rules: normalizeRules(rules),
      rng: Math.random,
      dealer: 0,
      turn: 0,
      phase: 'meld',
      hands: [[], [], [], []],
      stock: [],
      discard: [],
      melds: [],
      opened: [false, false, false, false],
      openedAtStart: [false, false, false, false],
      anyoneOpenedAtStart: false,
      laidThisTurn: [],
      didLayoff: false,
      mustUse: null,
      held: [],
      workspace: [],
      undo: [],
      log: [],
      nextId: 1,
      scores: [0, 0, 0, 0],
      result: null,
      cut: null,
      closing: null,
    };
  }

  function cutDeck(deck, rng, rules) {
    const copy = deck.slice();
    if (copy.length < 2) return { deck: copy, kept: null, seen: null };
    const at = 1 + Math.floor((rng || Math.random)() * (copy.length - 1));
    const lifted = copy.slice(0, at);
    const seen = lifted[lifted.length - 1];
    let rest = copy.slice(at).concat(lifted);
    let kept = null;
    if (rules.keepCutJoker && isJoker(seen)) {
      kept = seen;
      rest.pop();
    }
    return { deck: rest, kept: kept, seen: seen, at: at };
  }

  function newGame(opts) {
    opts = opts || {};
    const rules = normalizeRules(opts.rules);
    const rng = opts.rng || cryptoRng();
    let deck = opts.deck ? opts.deck.slice() : shuffle(createDeck(rules.jokers), rng);
    const dealer = ((opts.dealer == null ? 3 : opts.dealer) % 4 + 4) % 4;
    const cutter = (dealer + 3) % 4;
    let cut = null;
    if (opts.cut !== false) {
      const result = cutDeck(deck, rng, rules);
      deck = result.deck;
      cut = { card: result.kept, seen: result.seen, seat: cutter };
    }
    const state = blank(rules);
    state.rng = rng;
    state.dealer = dealer;
    state.turn = dealer;
    state.cut = cut;
    state.scores = (opts.scores || [0, 0, 0, 0]).slice();
    if (cut && cut.card) state.hands[cut.seat].push(cut.card);
    let seat = (dealer + 1) % 4;
    for (let n = 0; n < 13; n++) {
      for (let p = 0; p < 4; p++) {
        state.hands[seat].push(deck.shift());
        seat = (seat + 1) % 4;
      }
    }
    state.hands[dealer].push(deck.shift());
    state.stock = deck;
    state.undo = [snapshot(state)];
    return state;
  }

  function makeState(partial) {
    partial = partial || {};
    const state = blank(partial.rules);
    state.rng = partial.rng || (() => 0.25);
    if (partial.hands) state.hands = partial.hands.map((h) => h.slice());
    else if (partial.hand) state.hands[0] = partial.hand.slice();
    if (partial.stock) state.stock = partial.stock.slice();
    if (partial.discard) state.discard = partial.discard.slice();
    if (partial.melds) state.melds = JSON.parse(JSON.stringify(partial.melds));
    if (partial.opened) state.opened = partial.opened.slice();
    if (partial.openedAtStart) state.openedAtStart = partial.openedAtStart.slice();
    if (partial.phase) state.phase = partial.phase;
    if (partial.turn != null) state.turn = partial.turn;
    if (partial.dealer != null) state.dealer = partial.dealer;
    if (partial.mustUse) state.mustUse = partial.mustUse;
    if (partial.held) state.held = partial.held.slice();
    if (partial.scores) state.scores = partial.scores.slice();
    if (partial.log) state.log = partial.log.slice();
    state.anyoneOpenedAtStart = partial.anyoneOpenedAtStart != null ? !!partial.anyoneOpenedAtStart : state.opened.some(Boolean);
    state.undo = [snapshot(state)];
    return state;
  }

  function handHas(state, seat, card) {
    return state.hands[seat].indexOf(card) >= 0;
  }
  function takeFrom(list, card) {
    const at = list.indexOf(card);
    if (at < 0) return false;
    list.splice(at, 1);
    return true;
  }
  function takeSources(state, seat, cards) {
    const need = cards.slice();
    for (let i = 0; i < need.length; i++) {
      const card = need[i];
      if (takeFrom(state.hands[seat], card)) continue;
      if (takeFrom(state.held, card)) continue;
      if (takeFrom(state.workspace, card)) continue;
      return false;
    }
    return true;
  }
  function available(state, seat) {
    return state.hands[seat].concat(state.held, state.workspace);
  }
  function commit(state) {
    state.undo.push(snapshot(state));
  }
  function restoreBaseline(state) {
    if (!state.undo.length) return;
    const base = JSON.parse(JSON.stringify(state.undo[0]));
    restoreFrom(state, base);
    state.undo = [state.undo[0]];
  }
  function pendingPoints(state) {
    let pts = 0;
    for (let i = 0; i < state.laidThisTurn.length; i++) {
      const meld = state.melds.find((m) => m.id === state.laidThisTurn[i]);
      if (meld) pts += meld.points;
    }
    return pts;
  }
  function syncOpened(state, seat) {
    if (state.openedAtStart[seat]) state.opened[seat] = true;
    else state.opened[seat] = pendingPoints(state) >= state.rules.initial;
  }
  function beginMeld(state) {
    state.phase = 'meld';
    state.openedAtStart = state.opened.slice();
    state.anyoneOpenedAtStart = state.opened.some(Boolean);
    state.laidThisTurn = [];
    state.didLayoff = false;
    state.held = [];
    state.workspace = [];
    state.undo = [snapshot(state)];
  }
  function ensureStock(state) {
    if (state.stock.length) return true;
    if (state.discard.length <= 1) return false;
    const top = state.discard.pop();
    state.stock = shuffle(state.discard, state.rng || Math.random);
    state.discard = [top];
    return state.stock.length > 0;
  }

  function canExtendCard(state, card) {
    for (let i = 0; i < state.melds.length; i++) {
      const built = buildMeld(state.melds[i].cards.concat([card]), state.rules);
      if (built && preserves(state.melds[i], built, state.rules)) return true;
    }
    return false;
  }
  function canUseDiscardCard(state, seat, card) {
    const hand = state.hands[seat].concat([card]);
    if (state.opened[seat]) {
      if (candidateMelds(hand, state.rules).some((m) => m.cards.indexOf(card) >= 0)) return true;
      return canExtendCard(state, card);
    }
    const plan = planHand(hand, state.rules, card);
    const used = plan.groups.some((g) => g.cards.indexOf(card) >= 0);
    if (!used || plan.rest.length < 1) return false;
    if (plan.points >= state.rules.initial) return true;
    return !state.opened.some(Boolean);
  }
  function canTakeDiscard(state, seat) {
    if (!state || state.phase !== 'draw' || state.turn !== seat) return false;
    if (!state.discard.length) return false;
    if (state.rules.noLastFromDiscard && state.hands[seat].length <= 1) return false;
    const card = state.discard[state.discard.length - 1];
    if (!state.rules.discardMustUse) return true;
    return canUseDiscardCard(state, seat, card);
  }

  function drawStock(state, seat) {
    if (state.phase !== 'draw' || state.turn !== seat) return fail('Jetzt ist nicht dein Zug.');
    if (!ensureStock(state)) {
      finishRound(state, null);
      return ok({ blocked: true });
    }
    const card = state.stock.shift();
    state.hands[seat].push(card);
    state.mustUse = null;
    beginMeld(state);
    return ok({ card: card });
  }
  function drawDiscard(state, seat) {
    if (state.phase !== 'draw' || state.turn !== seat) return fail('Jetzt ist nicht dein Zug.');
    if (!state.discard.length) return fail('Die Ablage ist leer.');
    if (state.rules.noLastFromDiscard && state.hands[seat].length <= 1) {
      return fail('Mit der letzten Karte darfst du nicht vom offenen Stapel nehmen.');
    }
    const card = state.discard[state.discard.length - 1];
    if (state.rules.discardMustUse && !canUseDiscardCard(state, seat, card)) {
      return fail('Die Ablage darfst du nur nehmen, wenn du sie sofort auslegst oder anlegst.');
    }
    state.discard.pop();
    state.hands[seat].push(card);
    state.log.push({ seat: seat, type: 'take', card: card });
    state.mustUse = state.rules.discardMustUse ? card : null;
    beginMeld(state);
    state.mustUse = state.rules.discardMustUse ? card : null;
    state.undo = [snapshot(state)];
    return ok({ card: card });
  }

  function lay(state, seat, cards, opts) {
    if (state.phase !== 'meld' || state.turn !== seat) return fail('Jetzt kannst du nicht auslegen.');
    const ids = (cards || []).slice();
    if (ids.length < 3) return fail('Eine Figur braucht mindestens drei Karten.');
    if (state.hands[seat].length + state.held.length + state.workspace.length - ids.length < 1) {
      return fail('Eine Karte muss zum Abwerfen übrig bleiben.');
    }
    for (let i = 0; i < ids.length; i++) {
      if (available(state, seat).indexOf(ids[i]) < 0) return fail('Diese Karten sind nicht beisammen.');
    }
    const built = buildMeld(ids, state.rules, opts);
    if (!built) return fail('Das ist kein Satz und keine Reihe.');
    const stash = {
      hand: state.hands[seat].slice(),
      held: state.held.slice(),
      workspace: state.workspace.slice(),
    };
    if (!takeSources(state, seat, ids)) {
      state.hands[seat] = stash.hand;
      state.held = stash.held;
      state.workspace = stash.workspace;
      return fail('Diese Karten sind nicht beisammen.');
    }
    const meld = Object.assign({ id: state.nextId++, owner: seat }, built);
    state.melds.push(meld);
    state.laidThisTurn.push(meld.id);
    syncOpened(state, seat);
    commit(state);
    return ok({ meld: meld });
  }

  function layoff(state, seat, meldId, cards, opts) {
    if (state.phase !== 'meld' || state.turn !== seat) return fail('Jetzt kannst du nicht anlegen.');
    if (!state.opened[seat]) return fail('Anlegen geht erst nach der eigenen Erstmeldung.');
    const meld = state.melds.find((m) => m.id === meldId);
    if (!meld) return fail('Diese Figur liegt nicht auf dem Tisch.');
    const ids = (cards || []).slice();
    if (!ids.length) return fail('Leg mindestens eine Karte an.');
    if (state.hands[seat].length + state.held.length + state.workspace.length - ids.length < 1) {
      return fail('Eine Karte muss zum Abwerfen übrig bleiben.');
    }
    const built = buildMeld(meld.cards.concat(ids), state.rules, opts || { mode: meld.mode });
    if (!built || !preserves(meld, built, state.rules)) return fail('Das passt an diese Figur nicht.');
    const stash = {
      hand: state.hands[seat].slice(),
      held: state.held.slice(),
      workspace: state.workspace.slice(),
    };
    if (!takeSources(state, seat, ids)) {
      state.hands[seat] = stash.hand;
      state.held = stash.held;
      state.workspace = stash.workspace;
      return fail('Diese Karten sind nicht auf deiner Hand.');
    }
    meld.slots = built.slots;
    meld.cards = built.cards;
    meld.points = built.points;
    meld.mode = built.mode;
    meld.aceLow = built.aceLow;
    meld.kind = built.kind;
    state.didLayoff = true;
    syncOpened(state, seat);
    commit(state);
    return ok({ meld: meld });
  }

  function swapJoker(state, seat, meldId, jokerId, cardId) {
    if (state.phase !== 'meld' || state.turn !== seat) return fail('Jetzt kannst du nicht tauschen.');
    if (!state.rules.swapJokers) return fail('Joker tauschen ist ausgeschaltet.');
    if (!state.opened[seat]) return fail('Joker tauschen geht erst nach der eigenen Erstmeldung.');
    const meld = state.melds.find((m) => m.id === meldId);
    if (!meld) return fail('Diese Figur liegt nicht auf dem Tisch.');
    const slot = meld.slots.find((s) => s.card === jokerId && s.joker);
    if (!slot) return fail('Da liegt dieser Joker nicht.');
    if (meld.kind === 'set' && state.rules.fullSetToSwap && meld.cards.length < 4) {
      return fail('Ein Joker aus einem Satz darf erst bei vier Karten getauscht werden.');
    }
    if (isJoker(cardId)) return fail('Nur eine echte Karte ersetzt den Joker.');
    if (!handHas(state, seat, cardId)) return fail('Die Karte ist nicht auf deiner Hand.');
    if (rankOf(cardId) !== slot.rank) {
      return fail('Dafür brauchst du ' + RANK_NAMES[slot.rank] + '.');
    }
    if (suitOf(cardId) !== slot.suit) {
      if (meld.kind !== 'set') {
        return fail('Dafür brauchst du ' + SUIT_NAMES[slot.suit] + '-' + RANK_NAMES[slot.rank] + '.');
      }
      const taken = meld.slots.some((s) => !s.joker && s.suit === suitOf(cardId));
      if (taken) return fail('Diese Farbe liegt in dem Satz schon.');
      slot.suit = suitOf(cardId);
    }
    takeFrom(state.hands[seat], cardId);
    slot.card = cardId;
    slot.joker = false;
    meld.cards = meld.slots.map((s) => s.card);
    state.held.push(jokerId);
    commit(state);
    return ok({ held: jokerId, meld: meld });
  }

  function dissolve(state, seat, meldId) {
    if (state.phase !== 'meld' || state.turn !== seat) return fail('Jetzt kannst du nicht umbauen.');
    if (!state.rules.robber) return fail('Umbauen geht nur bei Räuber-Rommé.');
    if (!state.opened[seat] && !state.openedAtStart[seat]) return fail('Umbauen geht erst nach der Erstmeldung.');
    const at = state.melds.findIndex((m) => m.id === meldId);
    if (at < 0) return fail('Diese Figur liegt nicht auf dem Tisch.');
    const meld = state.melds[at];
    state.workspace = state.workspace.concat(meld.cards);
    state.melds.splice(at, 1);
    state.laidThisTurn = state.laidThisTurn.filter((id) => id !== meldId);
    syncOpened(state, seat);
    commit(state);
    return ok({ cards: meld.cards.slice() });
  }

  function cancelDraw(state, seat) {
    if (state.phase !== 'meld' || state.turn !== seat || !state.mustUse) return fail('Die Ablage bleibt liegen.');
    while (state.undo.length > 1) {
      state.undo.pop();
      const prev = state.undo[state.undo.length - 1];
      const stack = state.undo;
      restoreFrom(state, JSON.parse(JSON.stringify(prev)));
      state.undo = stack;
    }
    if (!takeFrom(state.hands[seat], state.mustUse)) return fail('Die Ablagekarte liegt nicht mehr auf der Hand.');
    const card = state.mustUse;
    state.discard.push(card);
    const last = state.log[state.log.length - 1];
    if (last && last.type === 'take' && last.card === card && last.seat === seat) state.log.pop();
    state.mustUse = null;
    state.phase = 'draw';
    state.laidThisTurn = [];
    state.didLayoff = false;
    state.held = [];
    state.workspace = [];
    state.undo = [];
    return ok({ card: card });
  }

  function undo(state, seat) {
    if (state.phase !== 'meld' || state.turn !== seat) return fail('Nichts zurückzunehmen.');
    if (state.undo.length < 2) return fail('Nichts zurückzunehmen.');
    state.undo.pop();
    const prev = state.undo[state.undo.length - 1];
    const stack = state.undo;
    restoreFrom(state, JSON.parse(JSON.stringify(prev)));
    state.undo = stack;
    return ok();
  }

  function gradeEyes(eyes) {
    if (eyes <= 10) return 4;
    if (eyes <= 20) return 3;
    if (eyes <= 40) return 2;
    if (eyes <= 80) return 1;
    return 0;
  }
  function outKind(state, seat) {
    const first = !state.openedAtStart[seat];
    if (!first) return 'normal';
    if (!state.anyoneOpenedAtStart) return 'hand';
    return 'handLayoff';
  }
  function finishRound(state, winner) {
    if (state.phase === 'done' && state.result) return state.result;
    const kind = winner == null ? 'block' : outKind(state, winner);
    const mult = kind === 'hand' && state.rules.handRommeDouble ? 2 : 1;
    const rows = [0, 1, 2, 3].map((seat) => {
      const cards = state.hands[seat].concat(seat === state.turn ? state.held.concat(state.workspace) : []);
      const eyes = winner === seat ? 0 : deadwood(cards);
      const penalty = winner == null ? deadwood(state.hands[seat]) : eyes * mult;
      return { seat: seat, eyes: winner === seat ? 0 : deadwood(cards), penalty: penalty, cards: state.hands[seat].slice() };
    });
    const award = [0, 1, 2, 3].map((seat) => {
      if (winner == null) return 0;
      if (seat === winner) return kind === 'hand' ? 8 : kind === 'handLayoff' ? 6 : 5;
      return gradeEyes(rows[seat].eyes / (kind === 'hand' && mult === 2 ? 2 : 1));
    });
    if (kind === 'hand' && mult === 2) {
      for (let i = 0; i < 4; i++) if (i !== winner) award[i] = gradeEyes(rows[i].eyes / 2);
    }
    const delta = state.rules.scoring === 'tournament' ? award.slice() : rows.map((r) => r.penalty);
    const scoresAfter = state.scores.map((s, i) => s + delta[i]);
    state.result = {
      winner: winner,
      kind: kind,
      multiplier: mult,
      rows: rows,
      award: award,
      delta: delta,
      scoresBefore: state.scores.slice(),
      scoresAfter: scoresAfter,
    };
    state.phase = 'done';
    return state.result;
  }

  function discard(state, seat, cardId) {
    if (state.phase !== 'meld' || state.turn !== seat) return fail('Jetzt kannst du nicht abwerfen.');
    if (state.held.length) return fail('Der getauschte Joker muss in diesem Zug wieder ausgelegt werden.');
    if (state.workspace.length) return fail('Die umgebauten Karten müssen wieder als Figuren liegen.');
    if (!handHas(state, seat, cardId)) return fail('Diese Karte ist nicht auf deiner Hand.');
    const alone = state.hands[seat].length === 1;
    const pure = alone && !state.anyoneOpenedAtStart && (state.laidThisTurn.length > 0 || state.didLayoff);
    if (!state.opened[seat] && state.laidThisTurn.length && !pure) {
      restoreBaseline(state);
      if (!handHas(state, seat, cardId)) return fail('Ohne 40 Augen kommen die Karten zurück auf die Hand.');
    }
    if (state.mustUse && handHas(state, seat, state.mustUse)) {
      return fail('Die Ablagekarte muss in diesem Zug ausgelegt oder angelegt werden.');
    }
    if (isJoker(cardId) && state.rules.jokerDiscardLastOnly && state.hands[seat].length !== 1) {
      return fail('Einen Joker darfst du nur als letzte Karte abwerfen.');
    }
    takeFrom(state.hands[seat], cardId);
    state.discard.push(cardId);
    if (!state.hands[seat].length) {
      state.closing = { seat: seat, card: cardId, faceDown: true };
      state.log.push({ seat: seat, type: 'out', card: cardId });
      finishRound(state, seat);
      return ok({ out: true, result: state.result });
    }
    state.log.push({ seat: seat, type: 'discard', card: cardId });
    state.turn = (seat + 1) % 4;
    state.phase = 'draw';
    state.mustUse = null;
    state.laidThisTurn = [];
    state.didLayoff = false;
    state.held = [];
    state.workspace = [];
    state.undo = [];
    return ok({ out: false });
  }

  function sortHand(cards) {
    const order = { A: 0, K: 1, Q: 2, J: 3, '10': 4, '9': 5, '8': 6, '7': 7, '6': 8, '5': 9, '4': 10, '3': 11, '2': 12, JK: 13 };
    const suits = { C: 0, S: 1, H: 2, D: 3, J: 4 };
    return cards.slice().sort((a, b) => {
      const d = order[rankOf(a)] - order[rankOf(b)];
      if (d) return d;
      const s = suits[suitOf(a)] - suits[suitOf(b)];
      if (s) return s;
      return parseCard(a).copy - parseCard(b).copy;
    });
  }

  function matchWinner(scores, opts) {
    opts = opts || {};
    const list = scores || [];
    if (list.length < 2) return null;
    const endMode = opts.endMode === 'rounds' ? 'rounds' : 'target';
    const scoring = opts.scoring === 'tournament' ? 'tournament' : 'penalty';
    const ended = endMode === 'rounds'
      ? (opts.handsPlayed || 0) >= normalizeRounds(opts.rounds == null ? 4 : opts.rounds)
      : list.some((s) => s >= normalizeTarget(opts.target == null ? 500 : opts.target, opts.targetCustom));
    if (!ended) return null;
    const best = scoring === 'tournament' ? Math.max.apply(null, list) : Math.min.apply(null, list);
    const who = [];
    list.forEach((s, i) => { if (s === best) who.push(i); });
    return who.length === 1 ? who[0] : null;
  }

  function publicView(state, seat) {
    return {
      rules: state.rules,
      seat: seat,
      turn: state.turn,
      phase: state.phase,
      hand: state.hands[seat].slice(),
      held: state.held.slice(),
      workspace: state.workspace.slice(),
      handCounts: state.hands.map((h) => h.length),
      stockCount: state.stock.length,
      top: state.discard.length ? state.discard[state.discard.length - 1] : null,
      discardCount: state.discard.length,
      melds: state.melds.map((m) => ({
        id: m.id, owner: m.owner, kind: m.kind, cards: m.cards.slice(),
        slots: m.slots.map((s) => Object.assign({}, s)), points: m.points,
        mode: m.mode, rank: m.rank, suit: m.suit,
      })),
      opened: state.opened.slice(),
      openedAtStart: state.openedAtStart.slice(),
      anyoneOpenedAtStart: state.anyoneOpenedAtStart,
      mustUse: state.mustUse,
      log: state.log.slice(),
      dealer: state.dealer,
      scores: state.scores.slice(),
    };
  }

  function publicSummary(state) {
    const top = state.discard.length ? cardName(state.discard[state.discard.length - 1]) : 'keine';
    return {
      game: 'Rommé. Stand ' + state.scores.join(' : ') + '. Ablage ' + top + '.',
      phase: state.phase,
      scores: state.scores.slice(),
    };
  }

  function topCard(state) {
    return state.discard.length ? state.discard[state.discard.length - 1] : null;
  }

  return {
    SUITS: SUITS,
    RANKS: RANKS,
    SUIT_NAMES: SUIT_NAMES,
    SUIT_SYMBOLS: SUIT_SYMBOLS,
    RANK_NAMES: RANK_NAMES,
    RANK_SHORT: RANK_SHORT,
    DEFAULT_RULES: DEFAULT_RULES,
    normalizeRules: normalizeRules,
    normalizeTarget: normalizeTarget,
    normalizeRounds: normalizeRounds,
    parseCard: parseCard,
    suitOf: suitOf,
    rankOf: rankOf,
    isJoker: isJoker,
    rankPoints: rankPoints,
    deadwoodPoints: deadwoodPoints,
    deadwood: deadwood,
    pointsForValue: pointsForValue,
    cardName: cardName,
    cardShort: cardShort,
    describeMeld: describeMeld,
    createDeck: createDeck,
    seededRng: seededRng,
    cryptoRng: cryptoRng,
    shuffle: shuffle,
    cutDeck: cutDeck,
    arrangements: arrangements,
    buildMeld: buildMeld,
    isRun: isRun,
    isSet: isSet,
    candidateMelds: candidateMelds,
    planHand: planHand,
    newGame: newGame,
    makeState: makeState,
    cloneState: cloneState,
    drawStock: drawStock,
    drawDiscard: drawDiscard,
    cancelDraw: cancelDraw,
    canTakeDiscard: canTakeDiscard,
    lay: lay,
    layoff: layoff,
    swapJoker: swapJoker,
    dissolve: dissolve,
    undo: undo,
    discard: discard,
    sortHand: sortHand,
    gradeEyes: gradeEyes,
    matchWinner: matchWinner,
    publicView: publicView,
    publicSummary: publicSummary,
    topCard: topCard,
    pendingPoints: pendingPoints,
  };
});
