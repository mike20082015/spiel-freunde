/* Eigene SVG-Gesichter: österreichisches Blatt und französische Farben. */
(function (root) {
  'use strict';
  var E = root.SchnapsenEngine;
  var PIPS = {
    herz: '<path d="M50 88C20 64 8 48 8 32 8 16 20 8 32 8c8 0 14 4 18 12 4-8 10-12 18-12 12 0 24 8 24 24 0 16-12 32-42 56z"/>',
    schelle: '<path d="M50 14c-8 8-16 14-16 26 0 10 6 16 16 16s16-6 16-16c0-12-8-18-16-26z"/><path d="M50 52c-14 0-22 10-22 22 0 8 6 14 14 16v8h16v-8c8-2 14-8 14-16 0-12-8-22-22-22z"/>',
    blatt: '<path d="M50 8 82 28 74 78 50 92 26 78 18 28z"/><path d="M50 24 66 36 62 70 50 78 38 70 34 36z"/>',
    eichel: '<path d="M50 16c10 8 18 8 22 20-8 2-12 10-10 20 8 2 10 12 4 22-10-4-16 2-16 12V16z"/><path d="M50 16C40 24 32 24 28 36c8 2 12 10 10 20-8 2-10 12-4 22 10-4 16 2 16 12V16z"/>',
    karo: '<path d="M50 6 90 50 50 94 10 50z"/>',
    pik: '<path d="M50 8C34 28 12 40 12 58c0 12 10 20 20 20 6 0 10-2 14-6-2 8-6 14-12 18h32c-6-4-10-10-12-18 4 4 8 6 14 6 10 0 20-8 20-20C88 40 66 28 50 8z"/>',
    kreuz: '<circle cx="50" cy="28" r="16"/><circle cx="32" cy="52" r="16"/><circle cx="68" cy="52" r="16"/><path d="M44 58c0 16-6 28-16 36h44c-10-8-16-20-16-36z"/>'
  };
  var GERMAN = ['herz', 'schelle', 'blatt', 'eichel'];
  var FRENCH = ['herz', 'karo', 'pik', 'kreuz'];

  function pip(deck, suit, cls) {
    var name = (deck === 'french' ? FRENCH : GERMAN)[suit] || 'herz';
    return '<svg class="' + (cls || 'pip') + '" viewBox="0 0 100 100" aria-hidden="true">' + PIPS[name] + '</svg>';
  }

  function label(card, deck) {
    if (deck === 'french') return { '10': '10', U: 'B', O: 'D', K: 'K', A: 'A' }[card.rank] || card.rank;
    return { '10': '10', U: 'U', O: 'O', K: 'K', A: 'A' }[card.rank] || card.rank;
  }

  function cardEl(card, opts) {
    opts = opts || {};
    var deck = opts.deck === 'french' ? 'french' : 'german';
    var el = document.createElement(opts.tag || 'button');
    if (el.tagName === 'BUTTON') el.type = 'button';
    el.className = 'card s-' + card.suit + (opts.cls ? ' ' + opts.cls : '');
    el.dataset.card = card.id;
    el.setAttribute('aria-label', E.cardName(card, deck));
    var text = label(card, deck);
    var face = (card.rank === 'U' || card.rank === 'O' || card.rank === 'K') ? 'court' : (card.rank === 'A' ? 'ace' : 'num');
    el.innerHTML =
      '<span class="corner tl"><b>' + text + '</b>' + pip(deck, card.suit, 'pip mini') + '</span>' +
      '<span class="' + face + '">' + pip(deck, card.suit, 'pip face-pip') + '</span>' +
      '<span class="corner br"><b>' + text + '</b>' + pip(deck, card.suit, 'pip mini') + '</span>';
    return el;
  }

  function backEl() {
    var el = document.createElement('div');
    el.className = 'card back';
    el.innerHTML = '<span class="back-in"></span>';
    return el;
  }

  root.SchnapsenCards = { cardEl: cardEl, backEl: backEl, pip: pip };
})(typeof self !== 'undefined' ? self : this);
