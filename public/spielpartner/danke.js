/*
 * Dankeseite nach der Rechnung: fragt die Bestellung alle 5 Sekunden ab
 * und legt eine bezahlte Lizenz in localStorage.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpielpartnerDanke = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var POLL_MS = 5000;

  function orderIdFromSearch(search) {
    var params;
    try { params = new URLSearchParams(search || ''); }
    catch (err) { return ''; }
    var id = params.get('order');
    if (!id) return '';
    id = String(id).trim();
    if (!id || id.length > 80) return '';
    if (!/^[A-Za-z0-9_-]+$/.test(id)) return '';
    return id;
  }

  function interpret(data) {
    var status = data && data.status;
    if (status !== 'pending' && status !== 'in_progress' && status !== 'paid' && status !== 'failed') {
      return { kind: 'unknown' };
    }
    if (status !== 'paid') return { kind: status };
    var license = data.license || null;
    return { kind: 'paid', license: license };
  }

  function paint(kind, license) {
    var status = document.getElementById('thanks-status');
    var card = document.getElementById('thanks-code');
    var code = document.getElementById('thanks-code-value');
    var meta = document.getElementById('thanks-meta');
    if (card) card.hidden = kind !== 'paid';
    if (kind === 'pending') {
      if (status) status.textContent = 'Die Zahlung ist eingegangen. Wir warten auf die Bestätigung.';
      return;
    }
    if (kind === 'in_progress') {
      if (status) status.textContent = 'Die Zahlung wird gerade ausgeführt.';
      return;
    }
    if (kind === 'failed') {
      if (status) status.textContent = 'Die Zahlung ist fehlgeschlagen. Es wurde nichts freigeschaltet. Du kannst es bei den Plänen noch einmal versuchen.';
      return;
    }
    if (kind === 'paid' && license && code) {
      code.textContent = license.code;
      if (meta) {
        var name = license.tier === 'premium' ? 'Premium' : 'Standard';
        var until = '';
        var stamp = Date.parse(license.expiresAt);
        if (!isFinite(stamp) && typeof license.expiresAt === 'number') stamp = license.expiresAt;
        if (isFinite(stamp)) until = new Date(stamp).toLocaleDateString('de-DE');
        meta.textContent = name + (until ? ' bis ' + until : '') + '.';
      }
      if (status) status.textContent = 'Bezahlt. Dein Code steht unten. Code notieren, damit Du ihn auf einem anderen Gerät eingeben kannst.';
      return;
    }
    if (status) status.textContent = 'Wir fragen die Bestellung gleich noch einmal ab.';
  }

  function poll(orderId, fetcher, onData) {
    var api = window.SpielpartnerEntitlement;
    var url = api.BILLING_API_BASE + '/orders/' + encodeURIComponent(orderId);
    var stopped = false;
    var timer = 0;
    function stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    }
    function tick() {
      if (stopped) return;
      fetcher(url, { headers: { 'Accept': 'application/json' }, cache: 'no-store' }).then(function (res) {
        if (!res || !res.ok) throw new Error('order');
        return res.json();
      }).then(function (data) {
        if (stopped) return;
        var view = interpret(data);
        onData(view, data);
        if (view.kind === 'paid' || view.kind === 'failed') stop();
        else timer = setTimeout(tick, POLL_MS);
      }).catch(function () {
        if (stopped) return;
        onData({ kind: 'retry' }, null);
        timer = setTimeout(tick, POLL_MS);
      });
    }
    tick();
    return stop;
  }

  function storePaid(license) {
    var api = window.SpielpartnerEntitlement;
    if (!license) return false;
    try {
      api.applyLicense(localStorage, license, Date.now(), { checkedOn: api.localDateKey(Date.now()) });
      return true;
    } catch (err) {
      return false;
    }
  }

  function start() {
    var api = window.SpielpartnerEntitlement;
    var orderId = orderIdFromSearch(window.location.search || '');
    var status = document.getElementById('thanks-status');
    if (!orderId) {
      if (status) status.textContent = 'In der Adresse fehlt die Bestellnummer.';
      return;
    }
    if (status) status.textContent = 'Wir schauen nach der Zahlung.';
    poll(orderId, window.fetch.bind(window), function (view) {
      if (view.kind === 'paid') {
        if (!storePaid(view.license)) {
          if (status) status.textContent = 'Die Zahlung ist da, der Code lässt sich gerade nicht speichern. Code notieren.';
          if (view.license && document.getElementById('thanks-code-value')) {
            document.getElementById('thanks-code').hidden = false;
            document.getElementById('thanks-code-value').textContent = view.license.code || '';
          }
          return;
        }
        paint('paid', view.license);
        return;
      }
      if (view.kind === 'retry') {
        if (status) status.textContent = 'Die Verbindung wackelt gerade. Wir fragen in ein paar Sekunden noch einmal.';
        return;
      }
      paint(view.kind, null);
    });
    return api;
  }

  if (typeof document !== 'undefined' && document.getElementById('thanks-status')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  return {
    POLL_MS: POLL_MS,
    orderIdFromSearch: orderIdFromSearch,
    interpret: interpret,
    poll: poll,
    storePaid: storePaid
  };
});
