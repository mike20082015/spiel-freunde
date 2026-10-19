/*
 * Karten für /spielpartner/.
 * Im Browser: window.SpielpartnerCards. In Node: require.
 * Ohne Video nur der Hinweis „Video folgt“, kein video-Element.
 * Mit Video: stummer Player mit Poster, Abspielen per Klick.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpielpartnerCards = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SKIP = { von: 1, van: 1, de: 1, der: 1, den: 1, und: 1, zu: 1 };

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

  function hasPlayableVideo(avatar) {
    return !!(avatar && avatar.hasVideo === true && avatar.video);
  }

  function mediaHtml(avatar) {
    if (!hasPlayableVideo(avatar)) return '<p class="sp-pending">Video folgt</p>';
    var poster = avatar.portrait ? ' poster="' + escapeHtml(avatar.portrait) + '"' : '';
    var label = 'Kurzes Vorstellungsvideo von ' + (avatar.name || 'Spielpartner');
    return '<div class="sp-player">' +
      '<video class="sp-video" muted playsinline preload="none" controls' + poster +
      ' src="' + escapeHtml(avatar.video) + '"' +
      ' aria-label="' + escapeHtml(label) + '"></video>' +
      '</div>';
  }

  function cardHtml(avatar) {
    var tier = avatar && avatar.tier === 'premium' ? 'premium' : 'standard';
    var badge = tier === 'premium' ? 'Premium' : 'Standard';
    var portrait = avatar && avatar.portrait
      ? '<img src="' + escapeHtml(avatar.portrait) + '" alt="">'
      : '';
    return '<article class="sp-card" data-tier="' + tier + '" data-slug="' + escapeHtml(avatar && avatar.slug) + '">' +
      '<div class="sp-portrait">' +
        '<span class="sp-initials" aria-hidden="true">' + escapeHtml(initials(avatar && avatar.name)) + '</span>' +
        portrait +
      '</div>' +
      '<div class="sp-body">' +
        '<p class="sp-origin">' + escapeHtml(avatar && avatar.origin) + '</p>' +
        '<h3 class="sp-name"><span class="sp-who">' + escapeHtml(avatar && avatar.name) + '</span>' +
          '<span class="sp-badge sp-badge-' + tier + '">' + badge + '</span></h3>' +
        '<p class="sp-intro">' + escapeHtml(avatar && avatar.intro) + '</p>' +
        '<p class="sp-personality">' + escapeHtml(avatar && avatar.personality) + '</p>' +
        '<p class="sp-access" data-access></p>' +
        '<div class="sp-media">' + mediaHtml(avatar) + '</div>' +
      '</div>' +
    '</article>';
  }

  return {
    escapeHtml: escapeHtml,
    initials: initials,
    hasPlayableVideo: hasPlayableVideo,
    mediaHtml: mediaHtml,
    cardHtml: cardHtml
  };
});
