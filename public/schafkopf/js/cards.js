/* Bayerisches Blatt. Französisch nur als Bild: Kreuz Eichel, Pik Gras, Herz, Karo Schellen. */
(function (root) {
  'use strict';
  const E = root.SchafkopfEngine;
  const PIPS = {
    E: '<path d="M50 8c8 10 14 16 14 26 0 8-5 14-12 16 8 2 14 10 14 18 0 12-10 22-22 24v8h12v8H44v-8H32v-8h12v-8C32 84 22 74 22 62c0-8 6-16 14-18C29 42 24 36 24 28 24 16 34 8 50 8z"/>',
    G: '<path d="M50 6c2 16-6 28-6 40 8-6 20-8 28-2-2 10-8 16-8 26 0 14-8 24-18 26-8-2-16-10-16-24 0-10-4-16-8-24 10-8 22-6 28 2 0-14-6-26-6-42z"/>',
    H: '<path d="M50 88C22 66 8 52 8 34 8 20 18 10 30 10c8 0 15 4 20 12 5-8 12-12 20-12 12 0 22 10 22 24 0 18-14 32-42 54z"/>',
    S: '<ellipse cx="50" cy="46" rx="28" ry="30"/><path class="bell" d="M50 18v56M36 78h28"/><circle cx="50" cy="78" r="7"/>',
  };
  const FRENCH = { E: '♣', G: '♠', H: '♥', S: '♦' };

  function french() {
    return root.document && root.document.body && root.document.body.classList.contains('deck-french');
  }
  function pip(s, cls) {
    if (french()) return '<span class="' + (cls || 'pip') + ' star" aria-hidden="true">' + (FRENCH[s] || '') + '</span>';
    return '<svg class="' + (cls || 'pip') + '" viewBox="0 0 100 100" aria-hidden="true">' + (PIPS[s] || '') + '</svg>';
  }
  function faceLabel(rank) {
    if (!french()) return rank === 'O' ? 'O' : rank === 'U' ? 'U' : E.RANK_SHORT[rank];
    if (rank === 'O') return 'D';
    if (rank === 'U') return 'B';
    if (rank === 'A') return 'A';
    return E.RANK_SHORT[rank];
  }
  const COURT = { O: 1, U: 1, K: 1 };

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
    if (COURT[r]) center = '<div class="court"><span class="court-l">' + (r === 'O' ? (french() ? 'D' : 'O') : r === 'U' ? (french() ? 'B' : 'U') : 'K') + '</span>' + pip(s, 'pip court-pip') + '</div>';
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
  root.SchafkopfCards = { cardEl: cardEl, backEl: backEl, pip: pip };
})(typeof self !== 'undefined' ? self : this);
