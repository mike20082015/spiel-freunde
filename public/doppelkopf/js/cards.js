/* Französisches Blatt, vierfarbig: Kreuz, Pik, Herz, Karo. Dame als D, Bube als B. */
(function (root) {
  'use strict';
  const E = root.DoppelkopfEngine;
  const SYM = { C: '♣', S: '♠', H: '♥', D: '♦' };
  const COURT = { Q: 1, J: 1, K: 1 };

  function pip(s, cls) {
    return '<span class="' + (cls || 'pip') + ' star" aria-hidden="true">' + (SYM[s] || '') + '</span>';
  }
  function faceLabel(rank) {
    if (rank === 'Q') return 'D';
    if (rank === 'J') return 'B';
    return E.RANK_SHORT[rank] || rank;
  }
  function cardEl(card, opts) {
    opts = opts || {};
    const s = E.suitOf(card);
    const r = E.rankOf(card);
    const el = document.createElement(opts.tag || 'div');
    el.className = 'card s-' + s + (opts.cls ? ' ' + opts.cls : '');
    el.dataset.card = card;
    el.setAttribute('aria-label', E.cardName(card));
    if (opts.tag === 'button') el.type = 'button';
    const label = faceLabel(r);
    let center;
    if (COURT[r]) center = '<div class="court"><span class="court-l">' + label + '</span>' + pip(s, 'pip court-pip') + '</div>';
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
  root.DoppelkopfCards = { cardEl: cardEl, backEl: backEl, pip: pip };
})(typeof self !== 'undefined' ? self : this);
