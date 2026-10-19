/*
 * Mitspieler für Rommé. Sie sehen nur die eigene Hand und den offenen Tisch.
 * Anfänger legt aus, sobald es geht. Kneipe sammelt bis 40 und schont den Nächsten.
 * Turnier hält auf Hand-Rommé, gibt Joker ungern her und legt bei Gefahr früh.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.RommeAI = factory(root.RommeEngine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';

  function nextNeeds(view) {
    const next = (view.seat + 1) % 4;
    const ranks = {};
    const from = Math.max(0, view.log.length - 16);
    for (let i = view.log.length - 1; i >= from; i--) {
      const entry = view.log[i];
      if (entry && entry.type === 'take' && entry.seat === next && entry.card && !E.isJoker(entry.card)) {
        ranks[E.rankOf(entry.card)] = true;
      }
    }
    return ranks;
  }

  function shouldLay(view, level, plan) {
    if (!plan || !plan.groups.length) return false;
    const opened = view.opened[view.seat];
    const initial = view.rules.initial;
    const nobody = view.opened.every((flag) => !flag);
    const canOut = plan.rest.length === 1;
    if (view.mustUse && plan.groups.some((g) => g.cards.indexOf(view.mustUse) >= 0)) return true;
    if (canOut && (opened || plan.points >= initial || nobody)) return true;
    if (!opened && plan.points < initial) return false;
    if (level === 'turnier' && nobody && !canOut) {
      const late = view.log.length >= 18;
      const danger = view.handCounts.some((n, i) => i !== view.seat && n > 0 && n <= 4);
      const heavy = E.deadwood(plan.rest) >= 35;
      if (!late && !danger && !heavy) return false;
    }
    return opened || plan.points >= initial;
  }

  function pickDiscard(view, level, rest) {
    const hand = view.hand.slice();
    let pool = (rest && rest.length ? rest : hand).filter((card) => hand.indexOf(card) >= 0);
    if (!pool.length) pool = hand.slice();
    if (view.rules.jokerDiscardLastOnly && hand.length > 1) {
      const quiet = pool.filter((card) => !E.isJoker(card));
      if (quiet.length) pool = quiet;
    }
    if (level !== 'anfaenger') {
      const avoid = nextNeeds(view);
      const safe = pool.filter((card) => E.isJoker(card) || !avoid[E.rankOf(card)]);
      if (safe.length) pool = safe;
    }
    pool.sort((a, b) => E.deadwoodPoints(b) - E.deadwoodPoints(a));
    if (level === 'turnier') {
      const plain = pool.filter((card) => !E.isJoker(card));
      if (plain.length) return plain[0];
    }
    return pool[0];
  }

  function layPlan(state, seat, level, steps) {
    const view = E.publicView(state, seat);
    const pile = view.hand.concat(view.held, view.workspace);
    const plan = E.planHand(pile, view.rules, view.mustUse || null);
    const layNow = shouldLay(view, level || 'kneipe', plan);
    if (!layNow) return;
    const groups = plan.groups.slice().sort((a, b) => {
      const au = view.mustUse && a.cards.indexOf(view.mustUse) >= 0 ? 0 : 1;
      const bu = view.mustUse && b.cards.indexOf(view.mustUse) >= 0 ? 0 : 1;
      return au - bu;
    });
    for (let i = 0; i < groups.length; i++) {
      const have = state.hands[seat].concat(state.held, state.workspace);
      const cards = groups[i].cards.filter((card) => have.indexOf(card) >= 0);
      if (cards.length < 3 || cards.length !== groups[i].cards.length) continue;
      const laid = E.lay(state, seat, cards, { mode: groups[i].mode });
      if (laid.ok) steps.push({ op: 'lay', cards: cards.slice(), points: laid.meld.points });
    }
  }

  function throwOne(state, seat, level, steps) {
    const view = E.publicView(state, seat);
    const order = [];
    const first = pickDiscard(view, level || 'kneipe', null);
    if (first) order.push(first);
    view.hand.forEach((card) => { if (order.indexOf(card) < 0) order.push(card); });
    for (let i = 0; i < order.length; i++) {
      const thrown = E.discard(state, seat, order[i]);
      if (thrown.ok) {
        steps.push({ op: 'discard', card: order[i], out: !!thrown.out });
        return true;
      }
    }
    return false;
  }

  function layoffLoose(state, seat, steps) {
    if (!state.opened[seat]) return;
    let guard = 0;
    while (state.hands[seat].length > 1 && guard < 24) {
      guard += 1;
      const prefer = state.mustUse && state.hands[seat].indexOf(state.mustUse) >= 0 ? state.mustUse : null;
      const cards = prefer ? [prefer].concat(state.hands[seat].filter((c) => c !== prefer)) : state.hands[seat].slice();
      let placed = false;
      for (let c = 0; c < cards.length && !placed; c++) {
        for (let m = 0; m < state.melds.length; m++) {
          const res = E.layoff(state, seat, state.melds[m].id, [cards[c]]);
          if (res.ok) {
            steps.push({ op: 'layoff', card: cards[c] });
            placed = true;
            break;
          }
        }
      }
      if (!placed) break;
    }
  }

  function finishMeld(state, seat, level, steps) {
    layPlan(state, seat, level, steps);
    layoffLoose(state, seat, steps);
    if (state.mustUse && state.hands[seat].indexOf(state.mustUse) >= 0) {
      while (E.undo(state, seat).ok) { /* Auslage ohne die Ablagekarte zurück */ }
      steps.length = 0;
      return false;
    }
    if (throwOne(state, seat, level, steps)) return true;
    while (E.undo(state, seat).ok) { /* noch einmal nur mit Abwurf */ }
    if (throwOne(state, seat, level, steps)) return true;
    if (!state.mustUse && state.phase === 'meld' && state.turn === seat) {
      E.finishRound(state, null);
      steps.push({ op: 'blocked' });
      return true;
    }
    return false;
  }

  function playTurn(state, seat, level) {
    const steps = [];
    if (!state || state.phase === 'done' || state.turn !== seat) return steps;
    if (state.phase === 'draw') {
      const take = E.canTakeDiscard(state, seat) && wantsPile(state, seat);
      if (take) {
        const drawn = E.drawDiscard(state, seat);
        if (drawn.ok) {
          const trial = [];
          if (finishMeld(state, seat, level, trial)) {
            steps.push({ op: 'take', card: drawn.card });
            trial.forEach((step) => steps.push(step));
            return steps;
          }
          E.cancelDraw(state, seat);
        }
      }
      const drawn = E.drawStock(state, seat);
      if (drawn.ok) steps.push({ op: drawn.blocked ? 'blocked' : 'draw', card: drawn.card });
      if (!drawn.ok || drawn.blocked || state.phase === 'done') return steps;
    }
    finishMeld(state, seat, level, steps);
    return steps;
  }

  function wantsPile(state, seat) {
    if (!state.rules.discardMustUse) {
      const view = E.publicView(state, seat);
      if (!view.top) return false;
      const alone = E.planHand(view.hand, view.rules);
      const withTop = E.planHand(view.hand.concat([view.top]), view.rules, view.top);
      return withTop.points > alone.points;
    }
    return true;
  }

  return { playTurn: playTurn, shouldLay: shouldLay, pickDiscard: pickDiscard };
});
