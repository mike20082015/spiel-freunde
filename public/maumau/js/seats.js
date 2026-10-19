/*
 * Sitzordnung am Mau-Mau-Tisch.
 * Süden: Du. Danach links herum: Horst, bei drei Gegnern Lena gegenüber,
 * bei vier Gegnern Lena und Rüdiger, rechts immer Margarethe.
 * Bilder: /media/spielpartner/<slug>.jpg, sonst die Initialen.
 * Lena und Rüdiger sprechen über denselben Weg wie Horst.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MauMauSeats = factory();
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

  var ROSTER = [
    { id: 'horst', name: 'Horst', full: 'Horst Kaluppke', slug: 'horst', voice: true },
    { id: 'lena', name: 'Lena', full: 'Lena Berger', slug: 'lena', voice: true },
    { id: 'ruediger', name: 'Rüdiger', full: 'Rüdiger Falk', slug: 'ruediger', voice: true },
    { id: 'margarethe', name: 'Margarethe', full: 'Margarethe von Hohenfels', slug: 'margarethe', voice: true },
  ];

  function layout(opponents) {
    var n = opponents === 4 ? 4 : opponents === 3 ? 3 : 2;
    var picks = n === 2 ? [ROSTER[0], ROSTER[3]] : n === 3 ? [ROSTER[0], ROSTER[1], ROSTER[3]] : ROSTER.slice();
    var places = n === 2 ? ['west', 'east'] : n === 3 ? ['west', 'north', 'east'] : ['west', 'north', 'north2', 'east'];
    var table = [{ seat: 0, id: 'du', name: 'Du', full: 'Du', slug: null, voice: false, place: 'south', initials: 'Du', portrait: '' }];
    picks.forEach(function (p, i) {
      table.push({
        seat: i + 1,
        id: p.id,
        name: p.name,
        full: p.full,
        slug: p.slug,
        voice: p.voice,
        place: places[i],
        initials: initials(p.full),
        portrait: portrait(p.slug),
      });
    });
    return table;
  }

  return { layout: layout, initials: initials, portrait: portrait, roster: ROSTER };
});
