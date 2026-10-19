/*
 * Spiel-Freunde Canasta: regelbasierte Mitspieler.
 * Anfänger, Kneipe, Turnier. Die KI sieht nur die eigene Hand und das, was am Tisch offen liegt.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.CanastaAI = factory(root.CanastaEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  function shadow(view) {
    const s = E.blankState(view.rules, view.scoresBefore);
    s.scoresBefore = view.scoresBefore.slice();
    s.hands[view.seat] = view.hand.slice();
    s.discard = view.discard.slice();
    s.frozen = !!view.frozen;
    s.stock.length = view.stockCount;
    s.melds = view.melds.map((list) => list.map((m) => ({ rank: m.rank, cards: m.cards.slice(), black: !!m.black })));
    s.reds = view.reds.map((list) => list.slice());
    s.phase = view.phase;
    s.turn = view.turn;
    s.minMet = view.minMet.slice();
    s.hadMeldAtTurnStart = view.hadMeldAtTurnStart.slice();
    s.meldedThisTurn = view.meldedThisTurn;
    s.mustGoOut = view.mustGoOut;
    s.forbidGoOut = view.forbidGoOut;
    s.asked = view.asked;
    s.asker = view.asker;
    s.forcedTake = view.forcedTake;
    s.mayEnd = view.mayEnd;
    s.openingPoints = view.openingPoints;
    s.discardLog = (view.discardLog || []).slice();
    s.dealer = view.dealer;
    return s;
  }

  function pack(hand) {
    const naturals = {};
    const wilds = [];
    const black = [];
    for (const c of hand) {
      if (E.isWild(c)) wilds.push(c);
      else if (E.isBlackThree(c)) black.push(c);
      else if (E.isNatural(c)) {
        const r = E.rankOf(c);
        if (!naturals[r]) naturals[r] = [];
        naturals[r].push(c);
      }
    }
    return { naturals: naturals, wilds: wilds, black: black };
  }

  function countRank(hand, rank) {
    let n = 0;
    for (const c of hand) if (E.isNatural(c) && E.rankOf(c) === rank) n += 1;
    return n;
  }

  function oppTeam(view) { return view.team === 0 ? 1 : 0; }

  function oppCards(view) {
    const seats = view.team === 0 ? [1, 3] : [0, 2];
    return (view.handCounts[seats[0]] || 0) + (view.handCounts[seats[1]] || 0);
  }

  function ourCanastas(view) {
    return view.melds[view.team].filter((m) => !m.black && m.cards.length >= 7).length;
  }

  function leaveOne(hand, cards) {
    if (hand.length - cards.length >= 1) return cards.slice();
    if (cards.length <= 3) return null;
    return cards.slice(0, -1);
  }

  function playableAfter(view, action) {
    const copy = E.snap(shadow(view));
    let res = { ok: true };
    if (action.type === 'meld') res = E.meld(copy, view.seat, action.groups);
    else if (action.type === 'layoff') res = E.layoff(copy, view.seat, action.cards, action.rank);
    if (!res.ok) return false;
    if (copy.phase === 'done') return true;
    if (E.planGoOut(copy, view.seat)) return true;
    return E.legalDiscardCards(copy, view.seat).length > 0;
  }

  function findTakes(view) {
    if (view.phase !== 'draw') return [];
    const s = shadow(view);
    const top = E.topCard(s);
    if (!top || !E.isNatural(top)) return [];
    const rank = E.rankOf(top);
    const hand = view.hand;
    const naturals = hand.filter((c) => E.isNatural(c) && E.rankOf(c) === rank);
    const wilds = hand.filter(E.isWild);
    const frozen = E.isFrozenFor(s, view.team);
    const existing = E.findMeld(s, view.team, rank);
    const extras = [];
    const grouped = pack(hand);
    for (const r of Object.keys(grouped.naturals)) {
      if (r === rank) continue;
      if (grouped.naturals[r].length >= 3 && !E.findMeld(s, view.team, r)) extras.push(grouped.naturals[r].slice());
    }
    const tries = [];
    const push = (handCards, extra) => {
      tries.push({ handCards: handCards.slice(), extraGroups: (extra || []).map((g) => g.slice()) });
    };
    if (!frozen && existing && !(view.rules.noCanastaPickup && existing.cards.length >= 7)) push([], []);
    if (naturals.length >= 2) {
      push(naturals.slice(0, 2), []);
      if (extras.length) push(naturals.slice(0, 2), extras);
      if (naturals.length > 2) push(naturals.slice(), extras);
    }
    if (!frozen && naturals.length >= 1 && wilds.length >= 1) {
      push([naturals[0], wilds[0]], []);
      if (extras.length) push([naturals[0], wilds[0]], extras);
    }
    const found = [];
    const seen = {};
    for (const t of tries) {
      const key = t.handCards.concat(t.extraGroups.flat()).join(',');
      if (seen[key]) continue;
      seen[key] = true;
      const copy = E.snap(s);
      const res = E.takePile(copy, view.seat, t.handCards, t.extraGroups);
      if (res.ok && copy.phase !== 'done') found.push(Object.assign({ gain: view.discard.length }, t));
    }
    return found;
  }

  function takeScore(view, option, level) {
    const top = view.discard[view.discard.length - 1];
    const rank = E.rankOf(top);
    const existing = view.melds[view.team].find((m) => m.rank === rank);
    let score = option.gain * (level === 'anfaenger' ? 12 : 7);
    if (existing && existing.cards.length === 6) score += 90;
    else if (existing && existing.cards.length >= 4 && existing.cards.length < 7) score += 28;
    if (!view.minMet[view.team]) score += 18;
    if (level === 'turnier') score += E.sumPoints(view.discard) / 4;
    if (option.gain === 1 && !(existing && existing.cards.length >= 6)) score -= 40;
    if (level === 'anfaenger' && option.gain >= 2) score += 30;
    return score;
  }

  function bestTake(view, level) {
    const options = findTakes(view);
    if (!options.length) return null;
    let best = options[0];
    let bestScore = takeScore(view, best, level);
    for (let i = 1; i < options.length; i++) {
      const sc = takeScore(view, options[i], level);
      if (sc > bestScore) { best = options[i]; bestScore = sc; }
    }
    best.score = bestScore;
    return best;
  }

  function wantFreeze(view) {
    if (view.frozen || view.rules.pileTake === 'always') return false;
    if (view.discard.length < 3) return false;
    if (!view.melds[oppTeam(view)].length) return false;
    const wilds = view.hand.filter(E.isWild);
    if (!wilds.length) return false;
    const near = view.melds[view.team].some((m) => !m.black && m.cards.length >= 5 && m.cards.length < 7);
    if (near && wilds.length < 2) return false;
    return true;
  }

  function decideDraw(view, level) {
    const take = bestTake(view, level);
    if (view.forcedTake) {
      if (take) return { type: 'take', handCards: take.handCards, extraGroups: take.extraGroups };
      return { type: 'end' };
    }
    if (!view.stockCount && !take) return { type: 'end' };
    if (take) {
      const useful = take.gain >= 2 || take.score >= 70;
      if (level === 'anfaenger' && useful) return { type: 'take', handCards: take.handCards, extraGroups: take.extraGroups };
      if (level !== 'anfaenger' && take.score >= (level === 'turnier' ? 16 : 14) && (useful || take.score >= 70)) {
        return { type: 'take', handCards: take.handCards, extraGroups: take.extraGroups };
      }
      if (!view.stockCount) return { type: 'take', handCards: take.handCards, extraGroups: take.extraGroups };
    }
    return { type: 'stock' };
  }

  function openingAction(view) {
    if (view.minMet[view.team]) return null;
    const grouped = pack(view.hand);
    const ranks = Object.keys(grouped.naturals).filter((r) => grouped.naturals[r].length >= 3);
    ranks.sort((a, b) => E.sumPoints(grouped.naturals[b]) - E.sumPoints(grouped.naturals[a]));
    const groups = [];
    let pts = view.openingPoints;
    let used = 0;
    const need = view.need;
    for (const r of ranks) {
      if (pts >= need) break;
      const cards = grouped.naturals[r].slice();
      groups.push(cards);
      pts += E.sumPoints(cards);
      used += cards.length;
    }
    if (pts < need && groups.length && grouped.wilds.length) {
      const g = groups[0];
      const wilds = g.filter(E.isWild).length;
      const naturals = g.filter(E.isNatural).length;
      const room = view.rules.wildMajority ? Math.min(3 - wilds, naturals - wilds) : 3 - wilds;
      if (room > 0) {
        g.push(grouped.wilds[0]);
        pts += E.cardPoints(grouped.wilds[0]);
        used += 1;
      }
    }
    if (pts < need || !groups.length) return null;
    const action = { type: 'meld', groups: groups };
    if (view.hand.length - used < 1) {
      const g = groups[groups.length - 1];
      if (g.length <= 3) return null;
      const dropped = g.pop();
      pts -= E.cardPoints(dropped);
      if (pts < need || g.length < 3) return null;
    }
    return playableAfter(view, action) ? action : null;
  }

  function layoffAction(view, level) {
    if (!view.minMet[view.team]) return null;
    const grouped = pack(view.hand);
    const melds = view.melds[view.team].filter((m) => !m.black).slice().sort((a, b) => {
      const gap = (m) => (m.cards.length >= 7 ? 20 : 7 - m.cards.length);
      return gap(a) - gap(b);
    });
    for (const m of melds) {
      const have = grouped.naturals[m.rank];
      if (!have || !have.length) continue;
      if (level !== 'anfaenger' && m.cards.length >= 7) continue;
      const use = leaveOne(view.hand, have);
      if (!use || !use.length) continue;
      const action = { type: 'layoff', cards: use, rank: m.rank };
      if (!playableAfter(view, action)) continue;
      return action;
    }
    if (level === 'anfaenger') return null;
    for (const m of melds) {
      if (m.cards.length < 5 || m.cards.length >= 7) continue;
      const wilds = m.cards.filter(E.isWild).length;
      const naturals = m.cards.filter(E.isNatural).length;
      if (wilds >= 3) continue;
      if (view.rules.wildMajority && wilds + 1 > naturals) continue;
      if (!grouped.wilds.length || view.hand.length < 2) continue;
      if (level === 'turnier' && m.cards.length < 6 && ourCanastas(view) === 0) continue;
      const action = { type: 'layoff', cards: [grouped.wilds[0]], rank: m.rank };
      if (!playableAfter(view, action)) continue;
      return action;
    }
    return null;
  }

  function newMeldAction(view, level) {
    if (!view.minMet[view.team]) return null;
    const grouped = pack(view.hand);
    const ours = view.melds[view.team];
    const growing = ours.filter((m) => !m.black && m.cards.length < 7).length;
    if (level !== 'anfaenger' && growing >= 3) return null;
    const ranks = Object.keys(grouped.naturals).filter((r) => grouped.naturals[r].length >= (level === 'anfaenger' ? 3 : 3) && !ours.some((m) => m.rank === r));
    if (!ranks.length) return null;
    if (level === 'turnier' && ours.some((m) => !m.black && m.cards.length >= 5 && m.cards.length < 7) && grouped.naturals[ranks[0]].length < 5) {
      return null;
    }
    ranks.sort((a, b) => grouped.naturals[b].length - grouped.naturals[a].length || E.sumPoints(grouped.naturals[b]) - E.sumPoints(grouped.naturals[a]));
    const use = leaveOne(view.hand, grouped.naturals[ranks[0]]);
    if (!use || use.length < 3) return null;
    const action = { type: 'meld', groups: [use] };
    return playableAfter(view, action) ? action : null;
  }

  function chooseDiscard(view, level, rng) {
    const cards = E.legalDiscardCards(shadow(view), view.seat).slice();
    if (!cards.length) return null;
    if (level === 'anfaenger') {
      const singles = cards.filter((c) => !E.isWild(c) && !E.isBlackThree(c) && countRank(view.hand, E.rankOf(c)) === 1);
      const pool = singles.length ? singles : cards.filter((c) => !E.isWild(c));
      const use = (pool.length ? pool : cards).slice();
      use.sort((a, b) => E.cardPoints(b) - E.cardPoints(a));
      return use[0];
    }
    const oppRanks = {};
    for (const m of view.melds[oppTeam(view)]) oppRanks[m.rank] = true;
    const freeze = wantFreeze(view);
    const frozenForThem = view.frozen || view.rules.pileTake === 'always';
    const keep = (c) => {
      if (E.isWild(c)) {
        if (freeze && E.rankOf(c) === '2') return 12;
        if (freeze) return 35;
        return 100;
      }
      if (E.isBlackThree(c)) return (!frozenForThem && view.melds[oppTeam(view)].length) ? 6 : 28;
      const rank = E.rankOf(c);
      const n = countRank(view.hand, rank);
      let value = 18 + (n === 2 ? 36 : n >= 3 ? 48 : 0) + E.cardPoints(c) / 8;
      if (oppRanks[rank] && !frozenForThem) value += 90;
      if (view.melds[view.team].some((m) => m.rank === rank && m.cards.length < 7)) value += 40;
      if (level === 'turnier' && n === 1) {
        const thrown = (view.discardLog || []).filter((d) => d.seat % 2 !== view.team && E.rankOf(d.card) === rank).length;
        value -= thrown * 7;
      }
      return value;
    };
    cards.sort((a, b) => keep(a) - keep(b) || (rng() - 0.5));
    return cards[0];
  }

  function wantGoOut(view, level) {
    if (view.mustGoOut) return true;
    if (view.forbidGoOut) return false;
    if (level === 'anfaenger') return true;
    const behind = view.scoresBefore[oppTeam(view)] - view.scoresBefore[view.team];
    const short = oppCards(view) <= 8 || view.stockCount < 8;
    if (level === 'kneipe') return short || ourCanastas(view) >= 2 || view.hand.length <= 4 || behind < 200;
    if (behind > 350 && view.stockCount > 18 && oppCards(view) > 14 && ourCanastas(view) < 2) return false;
    return true;
  }

  function shouldAsk(view, level, rng) {
    if (!view.rules.askPartner || view.asked || view.meldedThisTurn || view.mustGoOut) return false;
    if (level === 'anfaenger') return false;
    if (level === 'kneipe') return rng() < 0.2;
    const gap = Math.abs(view.scoresBefore[0] - view.scoresBefore[1]);
    return gap < 700 || view.scoresBefore[oppTeam(view)] >= view.scoresBefore[view.team];
  }

  function shouldAllow(view, level, rng) {
    if (level === 'anfaenger') return true;
    if (oppCards(view) <= 7 || view.stockCount < 8) return true;
    if (view.scoresBefore[view.team] >= view.scoresBefore[oppTeam(view)]) return true;
    if (level === 'turnier' && view.stockCount > 16) return false;
    return rng() < 0.65;
  }

  function decide(view, level, rng) {
    const random = rng || Math.random;
    const strength = level === 'turnier' || level === 'anfaenger' ? level : 'kneipe';
    if (view.phase === 'ask') {
      if (view.seat !== E.partnerSeat(view.asker)) return { type: 'wait' };
      return { type: 'answer', yes: shouldAllow(view, strength, random) };
    }
    if (view.phase === 'draw') return decideDraw(view, strength);
    if (view.phase !== 'meld') return { type: 'wait' };
    const plan = E.planGoOut(shadow(view), view.seat);
    if (plan && wantGoOut(view, strength)) {
      if (shouldAsk(view, strength, random)) return { type: 'ask' };
      return { type: 'goOut', plan: plan };
    }
    const opening = openingAction(view);
    if (opening) return opening;
    const lay = layoffAction(view, strength);
    if (lay) return lay;
    const fresh = newMeldAction(view, strength);
    if (fresh) return fresh;
    const card = chooseDiscard(view, strength, random);
    if (card) return { type: 'discard', card: card };
    if (plan) return { type: 'goOut', plan: plan };
    return { type: 'wait' };
  }

  function act(state, seat, level, rng) {
    return decide(E.viewFor(state, seat), level || 'kneipe', rng || Math.random);
  }

  function apply(state, seat, action) {
    if (!action) return { ok: false, reason: 'Kein Zug.' };
    if (action.type === 'stock') return E.drawStock(state, seat);
    if (action.type === 'end') return E.endHand(state, seat);
    if (action.type === 'take') return E.takePile(state, seat, action.handCards || [], action.extraGroups || []);
    if (action.type === 'meld') return E.meld(state, seat, action.groups || []);
    if (action.type === 'layoff') return E.layoff(state, seat, action.cards || [], action.rank);
    if (action.type === 'discard') return E.discard(state, seat, action.card);
    if (action.type === 'goOut') return E.goOut(state, seat, action.plan);
    if (action.type === 'ask') return E.askPartner(state, seat);
    if (action.type === 'answer') return E.answerPartner(state, seat, !!action.yes);
    return { ok: false, reason: 'Unbekannter Zug.' };
  }

  function recover(state, seat) {
    if (state.phase === 'ask') return E.answerPartner(state, seat, true);
    if (state.phase === 'draw') {
      if (state.stock.length && !state.forcedTake) return E.drawStock(state, seat);
      const take = bestTake(E.viewFor(state, seat), 'kneipe');
      if (take) return E.takePile(state, seat, take.handCards, take.extraGroups);
      if (!state.stock.length) return E.endHand(state, seat);
      return E.drawStock(state, seat);
    }
    const plan = E.planGoOut(state, seat);
    if (plan && (state.mustGoOut || state.hands[seat].length <= 2)) return E.goOut(state, seat, plan);
    const legal = E.legalDiscardCards(state, seat);
    if (legal.length) {
      const safe = legal.filter((c) => !E.isWild(c));
      return E.discard(state, seat, (safe.length ? safe : legal)[0]);
    }
    if (plan) return E.goOut(state, seat, plan);
    return { ok: false, reason: 'Kein Zug.' };
  }

  function step(state, level, rng) {
    if (state.phase === 'done') return { action: { type: 'done' }, res: { ok: true } };
    const seat = state.phase === 'ask' ? E.partnerSeat(state.asker) : state.turn;
    const action = act(state, seat, level, rng);
    let res = apply(state, seat, action);
    if (!res.ok) res = recover(state, seat);
    if (!res.ok) {
      E.finish(state, 'stock');
      res = { ok: true, abandoned: true };
    }
    return { action: action, res: res };
  }

  function suggest(state, seat) {
    const view = E.viewFor(state, seat);
    if (view.phase === 'draw') {
      if (view.forcedTake) return 'Der Talon ist leer und die oberste Karte passt an eure Meldung. Du musst den Ablagestapel nehmen.';
      if (!view.stockCount) return 'Der Talon ist leer. Nimm den Stapel nur, wenn die oberste Karte wirklich passt, sonst endet die Runde.';
      const take = bestTake(view, 'kneipe');
      if (take && take.score >= 20) return 'Die Ablage ist einen Blick wert. Du brauchst passende Karten aus der Hand, bevor du sie nimmst.';
      return 'Zieh vom Talon, wenn die Ablage nicht sicher zu dir passt. Eine wilde Karte oder eine schwarze Drei oben sperrt den Stapel.';
    }
    if (view.phase === 'meld') {
      if (!view.minMet[view.team]) return 'Eure erste Meldung muss mindestens ' + view.need + ' Punkte wert sein. Der Rest eines genommenen Stapels zählt nicht mit.';
      if (ourCanastas(view) < view.rules.canastasToGoOut) return 'Ausmachen geht erst mit ' + (view.rules.canastasToGoOut === 2 ? 'zwei Canastas' : 'einem Canasta') + '. Sieben Karten eines Rangs, wilde zählen mit, höchstens drei.';
      return 'Du kannst anlegen, neu melden oder eine Karte abwerfen. Eine wilde Karte friert die Ablage ein, eine schwarze Drei sperrt sie nur für den Nächsten.';
    }
    if (view.phase === 'ask') return 'Die Antwort gilt für diesen Zug. Ja heißt ausmachen, Nein heißt liegen lassen.';
    return 'Sammelt gleiche Ränge. Joker und Zweien sind wild.';
  }

  return { act: act, decide: decide, apply: apply, step: step, suggest: suggest, findTakes: findTakes, chooseDiscard: chooseDiscard };
});
