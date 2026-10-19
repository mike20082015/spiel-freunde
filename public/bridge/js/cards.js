/* Französisches Blatt, vierfarbig: Kreuz, Karo, Herz, Pik. */
(function (root) {
  'use strict';
  var E = root.BridgeEngine;
  var PIP = {
    0: '<path d="M50 14c-8 8-16 14-16 26 0 10 6 16 16 16s16-6 16-16c0-12-8-18-16-26z"/><path d="M50 52c-14 0-22 10-22 22 0 8 6 14 14 16v8h16v-8c8-2 14-8 14-16 0-12-8-22-22-22z"/>',
    1: '<path d="M50 6 90 50 50 94 10 50z"/>',
    2: '<path d="M50 88C20 64 8 48 8 32 8 16 20 8 32 8c8 0 14 4 18 12 4-8 10-12 18-12 12 0 24 8 24 24 0 16-12 32-42 56z"/>',
    3: '<path d="M50 8C34 28 12 40 12 58c0 12 10 20 20 20 6 0 10-2 14-6-2 8-6 14-12 18h32c-6-4-10-10-12-18 4 4 8 6 14 6 10 0 20-8 20-20C88 40 66 28 50 8z"/>'
  };
  var LABEL = { A: 'A', K: 'K', Q: 'D', J: 'B', '10': '10', '9': '9', '8': '8', '7': '7', '6': '6', '5': '5', '4': '4', '3': '3', '2': '2' };

  function pip(suit, cls) {
    return '<svg class="' + (cls || 'pip') + '" viewBox="0 0 100 100" aria-hidden="true">' + PIP[suit] + '</svg>';
  }

  function cardEl(card, opts) {
    opts = opts || {};
    var el = document.createElement(opts.tag || 'button');
    if (el.tagName === 'BUTTON') el.type = 'button';
    el.className = 'card s-' + card.suit + (opts.cls ? ' ' + opts.cls : '');
    el.dataset.card = card.id;
    el.setAttribute('aria-label', E.cardName(card));
    var text = LABEL[card.rank] || card.rank;
    var face = (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') ? 'court' : (card.rank === 'A' ? 'ace' : 'num');
    el.innerHTML =
      '<span class="corner tl"><b>' + text + '</b>' + pip(card.suit, 'pip mini') + '</span>' +
      '<span class="' + face + '">' + pip(card.suit, 'pip face-pip') + '</span>' +
      '<span class="corner br"><b>' + text + '</b>' + pip(card.suit, 'pip mini') + '</span>';
    return el;
  }

  function backEl() {
    var el = document.createElement('div');
    el.className = 'card back';
    el.innerHTML = '<span class="back-in"></span>';
    return el;
  }

  root.BridgeCards = { cardEl: cardEl, backEl: backEl, pip: pip };
})(typeof self !== 'undefined' ? self : this);
