/* Rommé-Karten, französisches Blatt, Joker extra. */
(function (root) {
  'use strict';
  const E = root.RommeEngine;
  const PIPS = {
    H: '<path d="M50 90C22 68 6 52 6 32 6 17 17 7 30 7c9 0 16 5 20 13 4-8 11-13 20-13 13 0 24 10 24 25 0 20-16 36-44 58z"/>',
    D: '<path d="M50 4 86 50 50 96 14 50z"/>',
    S: '<path d="M50 5C36 25 9 39 9 60c0 13 10 22 22 22 7 0 13-3 16-8-1 9-5 15-12 21h30c-7-6-11-12-12-21 3 5 9 8 16 8 12 0 22-9 22-22C91 39 64 25 50 5z"/>',
    C: '<circle cx="50" cy="29" r="19"/><circle cx="28" cy="59" r="19"/><circle cx="72" cy="59" r="19"/><circle cx="50" cy="52" r="10"/><path d="M45 55c0 19-4 30-12 40h34c-8-10-12-21-12-40z"/>',
  };
  function pip(s, cls) {
    if (s === 'J' || !PIPS[s]) return '<span class="' + (cls || 'pip') + ' star" aria-hidden="true">★</span>';
    return '<svg class="' + (cls || 'pip') + '" viewBox="0 0 100 100" aria-hidden="true">' + PIPS[s] + '</svg>';
  }
  const COURT = { J: 'B', Q: 'D', K: 'K' };
  const CROWN = '<svg class="crown" viewBox="0 0 60 30" aria-hidden="true"><path d="M4 26 8 6l12 11L30 2l10 15L52 6l4 20z"/></svg>';

  function cardEl(card, opts) {
    opts = opts || {};
    const s = E.suitOf(card), r = E.rankOf(card);
    const el = document.createElement(opts.tag || 'div');
    el.className = 'card s-' + s + (opts.cls ? ' ' + opts.cls : '') + (E.isJoker(card) ? ' joker' : '');
    el.dataset.card = card;
    el.setAttribute('aria-label', E.cardName(card));
    if (opts.tag === 'button') el.type = 'button';
    const label = E.RANK_SHORT[r];
    let center;
    if (E.isJoker(card)) center = '<div class="joker-face"><b>Joker</b><span>★</span></div>';
    else if (COURT[r]) center = '<div class="court">' + CROWN + '<span class="court-l">' + COURT[r] + '</span>' + pip(s, 'pip court-pip') + '</div>';
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
  function inlineCard(card) {
    if (E.isJoker(card)) return '<span class="ic s-J">★J</span>';
    const s = E.suitOf(card);
    return '<span class="ic s-' + s + '">' + pip(s, 'pip ic-pip') + E.RANK_SHORT[E.rankOf(card)] + '</span>';
  }
  root.RommeCards = { cardEl: cardEl, backEl: backEl, inlineCard: inlineCard, pip: pip };
})(typeof self !== 'undefined' ? self : this);
