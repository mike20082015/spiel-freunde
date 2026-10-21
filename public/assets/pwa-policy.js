/* Welche Anfragen der Service Worker anfassen darf.
   API, Anmeldung und fremde Server gehen immer direkt ins Netz und
   landen nicht im Cache. HTML kommt aus dem Netz, damit eine neue
   Fassung sofort ankommt. Statische Dateien dürfen aus dem Cache. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpielpartnerPwa = api;
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : null), function () {
  var STATIC = /\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?)$/i;

  function classify(requestUrl, options) {
    var opts = options || {};
    var origin = opts.origin || 'https://spiel-freunde.com';
    var url = new URL(requestUrl, origin);
    var method = String(opts.method || 'GET').toUpperCase();
    if (method !== 'GET') return 'bypass';
    if (url.origin !== origin) return 'bypass';
    if (opts.authorization) return 'bypass';
    if (url.pathname === '/api' || url.pathname.indexOf('/api/') === 0) return 'bypass';
    if (/(^|\/)(auth|session|login|account|anmelden)(\/|$)/i.test(url.pathname)) return 'bypass';
    if (url.searchParams.has('token') || url.searchParams.has('access_token') || url.searchParams.has('code')) return 'bypass';

    var accept = opts.accept || '';
    var destination = opts.destination || '';
    var html = destination === 'document'
      || opts.mode === 'navigate'
      || accept.indexOf('text/html') !== -1
      || /\.html?$/i.test(url.pathname)
      || /\/$/.test(url.pathname);
    if (html) return 'network-first';
    if (url.pathname === '/manifest.json') return 'cache-first';
    if (STATIC.test(url.pathname)) return 'cache-first';
    return 'bypass';
  }

  return { classify: classify };
});
