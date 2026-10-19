/* Zahlenkarten in vier Farben, 1 bis 20. */
(function (root) {
  'use strict';
  const E = root.ElferRausEngine;

  function cardEl(card, opts) {
    opts = opts || {};
    const s = E.suitOf(card);
    const r = E.rankOf(card);
    const el = document.createElement(opts.tag || 'div');
    el.className = 'card s-' + s + (opts.cls ? ' ' + opts.cls : '');
    el.dataset.card = card;
    el.setAttribute('aria-label', E.cardName(card));
    if (opts.tag === 'button') el.type = 'button';
    const mark = E.suitSymbol(s);
    el.innerHTML =
      '<span class="corner tl"><b>' + r + '</b><span class="pip mini star">' + mark + '</span></span>' +
      '<div class="num"><b class="big-rank">' + r + '</b><span class="pip star">' + mark + '</span></div>' +
      '<span class="corner br"><b>' + r + '</b><span class="pip mini star">' + mark + '</span></span>';
    return el;
  }
  function backEl(cls) {
    const el = document.createElement('div');
    el.className = 'card back' + (cls ? ' ' + cls : '');
    el.innerHTML = '<span class="back-in"><img src="../assets/variante-a-favicon-dunkel.svg" alt=""></span>';
    return el;
  }
  root.ElferRausCards = { cardEl: cardEl, backEl: backEl };
})(typeof self !== 'undefined' ? self : this);
