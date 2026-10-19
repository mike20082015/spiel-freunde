/*
 * Sitzordnung am Doppelkopf-Tisch.
 * Süden: Du. Links Horst, gegenüber Rüdiger, rechts Margarethe.
 * Bilder: /media/spielpartner/<slug>.jpg, sonst die Initialen.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DoppelkopfSeats = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SKIP = { von: 1, van: 1, de: 1, der: 1, den: 1, und: 1, zu: 1 };

  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/);
    var keep = [];
    for (var i = 0; i < parts.length; i++) {
      var word = parts[i].replace(/^[^0-9A-Za-zÄÖÜäöüß]+|[^0-9A-Za-zÄÖÜäöüß]+$/g, '');
      if (!word || SKIP[word.toLowerCase()]) continue;
      keep.push(word);
    }
    if (!keep.length) return '?';
    var first = keep[0].charAt(0);
    var last = keep.length > 1 ? keep[keep.length - 1].charAt(0) : '';
    return (first + last).toLocaleUpperCase('de-DE');
  }

  function portrait(slug) {
    return slug ? '/media/spielpartner/' + slug + '.jpg' : '';
  }

  var seats = [
    { seat: 0, id: 'du', name: 'Du', full: 'Du', slug: null, voice: false, place: 'south' },
    { seat: 1, id: 'horst', name: 'Horst', full: 'Horst Kaluppke', slug: 'horst', voice: true, place: 'west' },
    { seat: 2, id: 'ruediger', name: 'Rüdiger', full: 'Rüdiger Falk', slug: 'ruediger', voice: false, place: 'north' },
    { seat: 3, id: 'margarethe', name: 'Margarethe', full: 'Margarethe von Hohenfels', slug: 'margarethe', voice: true, place: 'east' },
  ];

  seats.forEach(function (p) {
    p.initials = p.id === 'du' ? 'Du' : initials(p.full);
    p.portrait = portrait(p.slug);
  });

  return { seats: seats, initials: initials, portrait: portrait };
});
