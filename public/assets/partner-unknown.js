/*
 * Fehlerseite: ein einzelner unbekannter Slug zeigt die Partnerseite.
 * Der Button führt auf den Partnerlink oder, wenn niemand hinterlegt ist,
 * auf https://spiel-freunde.com/. Bestehende Routen bleiben die normale 404.
 */
(function () {
  'use strict';

  var path = location.pathname.replace(/\/+$/, '');
  var raw = path.charAt(0) === '/' ? path.slice(1) : path;
  if (!raw || raw.indexOf('/') !== -1) return;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(raw)) return;
  var slug = raw.toLowerCase();
  var reserved = window.SPIEL_FREUNDE_PARTNER_RESERVED || [];
  if (reserved.indexOf(slug) !== -1) return;
  var map = window.SPIEL_FREUNDE_PARTNER || {};
  var known = Object.prototype.hasOwnProperty.call(map, slug);
  if (known && raw !== slug) {
    location.replace('/' + slug + '/');
    return;
  }
  var href = known ? map[slug] : 'https://spiel-freunde.com/';
  var root = document.getElementById('partner-fallback');
  if (!root) return;
  var links = root.querySelectorAll('a.lead-go');
  for (var i = 0; i < links.length; i++) links[i].href = href;
  var headerLogo = document.querySelector('.nav .logo');
  if (headerLogo) headerLogo.setAttribute('href', href);
  if (window.SpielFreundeLead) window.SpielFreundeLead.captureFrom(href);
  document.body.classList.add('is-partner');
  root.hidden = false;
  var miss = document.querySelector('.miss-main');
  if (miss) miss.hidden = true;
  document.title = 'Spiel-Freunde: Die schönsten Kartenspiele aus Deutschland, Österreich und der Schweiz';
  if (window.SpielFreundeLead) window.SpielFreundeLead.boot(root);
})();
