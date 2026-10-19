/* Eigene SVG-Gesichter fürs bayerische Blatt, samt Weli. */
(function (root) {
  'use strict';
  var E = root.WattenEngine;
  var PIPS = {
    eichel: '<path d="M50 16c10 8 18 8 22 20-8 2-12 10-10 20 8 2 10 12 4 22-10-4-16 2-16 12V16z"/><path d="M50 16C40 24 32 24 28 36c8 2 12 10 10 20-8 2-10 12-4 22 10-4 16 2 16 12V16z"/>',
    gras: '<path d="M50 8 82 28 74 78 50 92 26 78 18 28z"/><path d="M50 24 66 36 62 70 50 78 38 70 34 36z"/>',
    herz: '<path d="M50 88C20 64 8 48 8 32 8 16 20 8 32 8c8 0 14 4 18 12 4-8 10-12 18-12 12 0 24 8 24 24 0 16-12 32-42 56z"/>',
    schelle: '<path d="M50 14c-8 8-16 14-16 26 0 10 6 16 16 16s16-6 16-16c0-12-8-18-16-26z"/><path d="M50 52c-14 0-22 10-22 22 0 8 6 14 14 16v8h16v-8c8-2 14-8 14-16 0-12-8-22-22-22z"/>'
  };
  var SUIT = ['eichel', 'gras', 'herz', 'schelle'];

  function pip(suit, cls) {
    var name = SUIT[suit] || 'eichel';
    return '<svg class="' + (cls || 'pip') + '" viewBox="0 0 100 100" aria-hidden="true">' + PIPS[name] + '</svg>';
  }

  function label(card) {
    if (E.isWeli(card)) return 'W';
    return { A: 'A', K: 'K', O: 'O', U: 'U', '10': '10', '9': '9', '8': '8', '7': '7' }[card.rank] || card.rank;
  }

  function cardEl(card, opts) {
    opts = opts || {};
    var el = document.createElement(opts.tag || 'button');
    if (el.tagName === 'BUTTON') el.type = 'button';
    var suit = E.isWeli(card) ? 3 : card.suit;
    el.className = 'card s-' + suit + (E.isWeli(card) ? ' weli' : '') + (opts.cls ? ' ' + opts.cls : '');
    el.dataset.card = card.id;
    el.setAttribute('aria-label', E.cardName(card));
    var text = label(card);
    var face = E.isWeli(card) ? 'weli-face' : ((card.rank === 'U' || card.rank === 'O' || card.rank === 'K') ? 'court' : (card.rank === 'A' ? 'ace' : 'num'));
    var inner = E.isWeli(card)
      ? '<span class="weli-word">Weli</span>' + pip(suit, 'pip face-pip')
      : pip(suit, 'pip face-pip');
    el.innerHTML =
      '<span class="corner tl"><b>' + text + '</b>' + pip(suit, 'pip mini') + '</span>' +
      '<span class="' + face + '">' + inner + '</span>' +
      '<span class="corner br"><b>' + text + '</b>' + pip(suit, 'pip mini') + '</span>';
    return el;
  }

  function backEl() {
    var el = document.createElement('div');
    el.className = 'card back';
    el.innerHTML = '<span class="back-in"></span>';
    return el;
  }

  root.WattenCards = { cardEl: cardEl, backEl: backEl, pip: pip };
})(typeof self !== 'undefined' ? self : this);
