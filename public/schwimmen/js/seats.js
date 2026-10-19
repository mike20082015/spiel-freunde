/*
 * Sitzordnung am Schwimmen-Tisch.
 * Süden: Du. Danach links herum Horst, Lena, Chantal.
 * Bei zwei Gegnern sitzt Chantal rechts, bei vier kommt Jonas dazu.
 * Bilder: /media/spielpartner/<slug>.jpg, sonst die Initialen.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SchwimmenSeats = factory();
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

  var ROSTER = {
    horst: { id: 'horst', name: 'Horst', full: 'Horst Kaluppke', slug: 'horst', voice: true },
    lena: { id: 'lena', name: 'Lena', full: 'Lena Berger', slug: 'lena', voice: true },
    jonas: { id: 'jonas', name: 'Jonas', full: 'Jonas Rehm', slug: 'jonas', voice: true },
    chantal: { id: 'chantal', name: 'Chantal', full: 'Chantal Kowalski', slug: 'chantal', voice: true },
  };

  function layout(opponents) {
    var n = opponents === 1 || opponents === 2 || opponents === 4 ? opponents : 3;
    var picks = n === 1 ? [ROSTER.horst]
      : n === 2 ? [ROSTER.horst, ROSTER.chantal]
      : n === 4 ? [ROSTER.horst, ROSTER.lena, ROSTER.jonas, ROSTER.chantal]
      : [ROSTER.horst, ROSTER.lena, ROSTER.chantal];
    var places = n === 1 ? ['north']
      : n === 2 ? ['west', 'east']
      : n === 4 ? ['west', 'north', 'north2', 'east']
      : ['west', 'north', 'east'];
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

  return { layout: layout, initials: initials, portrait: portrait };
});
