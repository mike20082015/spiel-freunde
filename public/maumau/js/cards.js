/* Französisches Blatt, vierfarbig. Deutsches Blatt mit Unter und Ober, wenn die Regeln das sagen. */
(function (root) {
  'use strict';
  const E = root.MauMauEngine;
  let deck = 'french';

  function setDeck(next) { deck = next === 'german' ? 'german' : 'french'; }
  function rules() { return { deck: deck }; }
  function pip(s, cls) {
    return '<span class="' + (cls || 'pip') + ' star" aria-hidden="true">' + (E.suitSymbol(s, rules()) || '') + '</span>';
  }
  function faceLabel(rank) { return E.rankShort(rank, rules()); }
  function cardEl(card, opts) {
    opts = opts || {};
    const s = E.suitOf(card);
    const r = E.rankOf(card);
    const el = document.createElement(opts.tag || 'div');
    el.className = 'card s-' + s + (opts.cls ? ' ' + opts.cls : '');
    el.dataset.card = card;
    el.setAttribute('aria-label', E.cardName(card, rules()));
    if (opts.tag === 'button') el.type = 'button';
    const label = faceLabel(r);
    const court = r === 'J' || r === 'Q' || r === 'K';
    let center;
    if (court) center = '<div class="court"><span class="court-l">' + label + '</span>' + pip(s, 'pip court-pip') + '</div>';
    else if (r === 'A') center = '<div class="ace">' + pip(s, 'pip ace-pip') + '</div>';
    else center = '<div class="num">' + pip(s, 'pip num-pip') + '</div>';
    el.innerHTML =
      '<span class="corner tl"><b>' + label + '</b>' + pip(s, 'pip mini') + '</span>' +
      center +
      '<span class="corner br"><b>' + label + '</b>' + pip(s, 'pip mini') + '</span>';
    return el;
  }
  function backEl(cls) {
    const el = document.createElement('div');
    el.className = 'card back' + (cls ? ' ' + cls : '');
    el.innerHTML = '<span class="back-in"><img src="../assets/variante-a-favicon-dunkel.svg" alt=""></span>';
    return el;
  }
  root.MauMauCards = { cardEl: cardEl, backEl: backEl, pip: pip, setDeck: setDeck };
})(typeof self !== 'undefined' ? self : this);
