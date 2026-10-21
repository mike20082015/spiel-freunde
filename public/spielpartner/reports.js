/*
 * Community-Testing: Fehler melden.
 * Dieselbe API-Basis und derselbe Bearer-Token wie das Spielerkonto.
 * POST /bug-reports, GET /bug-reports/mine.
 * Das Bildschirmfoto lädt html2canvas erst beim Absenden, und nur wenn es klappt.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpielpartnerReports = api;
  if (typeof window !== 'undefined' && window.document && typeof api.boot === 'function') {
    var start = function () {
      try { api.boot(); }
      catch (err) { /* Seite ohne Speicher */ }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var GAMES = ['skat', 'schafkopf', 'jass', 'canasta', 'maumau', 'tisch', 'other'];
  var REPORT_GAMES = ['skat', 'schafkopf', 'jass', 'canasta', 'maumau', 'tisch'];
  var MIN_DESCRIPTION = 10;
  var MAX_DESCRIPTION = 2000;
  var MAX_STEPS = 2000;
  var STATE_LIMIT = 50 * 1024;
  var SHOT_LIMIT = Math.floor(1.5 * 1024 * 1024);
  var SHOT_TARGET = Math.floor(1.2 * 1024 * 1024);
  var INTRO = 'Community-Testing: Du hilfst uns, Spiel-Freunde fehlerfrei zu machen. Für jeden bestätigten Fehler bekommst Du 4 Wochen Premium gratis, zusätzlich nach Deiner Testphase.';
  var SUCCESS = 'Danke! Wir prüfen Deine Meldung und melden uns per Mail.';
  var ACCOUNT_LINE = 'Zum Melden brauchst Du ein kostenloses Konto. Wir schicken Dir einen Anmeldelink, kein Passwort nötig.';
  var booted = false;
  var html2canvasPromise = null;

  function entitlement() {
    if (typeof window !== 'undefined' && window.SpielpartnerEntitlement) return window.SpielpartnerEntitlement;
    return null;
  }

  function account() {
    if (typeof window !== 'undefined' && window.SpielpartnerAccount) return window.SpielpartnerAccount;
    return null;
  }

  function apiBase() {
    var Ent = entitlement();
    return Ent && Ent.BILLING_API_BASE ? Ent.BILLING_API_BASE : '';
  }

  function storageOf(storage) {
    if (storage) return storage;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (err) { /* privat */ }
    return null;
  }

  function escapeText(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function utf8Length(text) {
    var n = 0;
    var value = String(text || '');
    for (var i = 0; i < value.length; i++) {
      var code = value.charCodeAt(i);
      if (code < 0x80) n += 1;
      else if (code < 0x800) n += 2;
      else if (code >= 0xD800 && code <= 0xDBFF) { n += 4; i += 1; }
      else n += 3;
    }
    return n;
  }

  function gameFromPath(path) {
    var value = String(path || '');
    var match = /\/(skat|schafkopf|jass|canasta|maumau|tisch)(?:\/|$|\?)/.exec(value);
    return match ? match[1] : 'other';
  }

  function normalizeGame(value) {
    var game = String(value || '').trim().toLowerCase();
    if (game === 'mau-mau' || game === 'maumau') return 'maumau';
    if (GAMES.indexOf(game) !== -1) return game;
    return 'other';
  }

  function gameLabel(game) {
    if (game === 'skat') return 'Skat';
    if (game === 'schafkopf') return 'Schafkopf';
    if (game === 'jass') return 'Jass';
    if (game === 'canasta') return 'Canasta';
    if (game === 'maumau') return 'Mau-Mau';
    if (game === 'tisch') return 'Privater Tisch';
    return 'Anderes Spiel';
  }

  function statusLabel(status) {
    if (status === 'new') return 'Neu';
    if (status === 'confirmed') return 'Bestätigt';
    if (status === 'rejected') return 'Abgelehnt';
    if (status === 'duplicate') return 'Doppelt';
    if (status === 'fixed') return 'Behoben';
    return 'Neu';
  }

  function messageFor(code) {
    if (code === 'invalid_request') return 'Das können wir so nicht lesen. Schreib bitte in ein paar Worten, was passiert ist.';
    if (code === 'unauthorized') return 'Die Anmeldung ist abgelaufen. Hol Dir einen neuen Link, dann kannst Du den Fehler melden.';
    if (code === 'screenshot_too_large') return 'Das Bildschirmfoto ist zu groß. Schick die Meldung ohne Foto.';
    if (code === 'state_too_large') return 'Der Spielstand ist zu groß. Versuch es noch einmal, wir kürzen ihn dann.';
    if (code === 'rate_limited') return 'Das war zu oft hintereinander. Warte einen Moment und versuch es noch einmal.';
    if (code === 'netz') return 'Wir erreichen den Server gerade nicht. Versuch es gleich noch einmal. Dein Text bleibt stehen.';
    return 'Das hat gerade nicht geklappt. Versuch es gleich noch einmal.';
  }

  function fail(code) {
    var error = new Error(code);
    error.code = code;
    error.userMessage = messageFor(code);
    return error;
  }

  function readBody(res) {
    if (!res) return Promise.reject(fail('netz'));
    if (res.status === 204) return Promise.resolve({ status: 204, ok: true, body: null });
    var parsed;
    try { parsed = typeof res.json === 'function' ? res.json() : null; }
    catch (err) { parsed = null; }
    return Promise.resolve(parsed).then(function (body) {
      return { status: res.status, ok: !!res.ok, body: body || null };
    }).catch(function () {
      return { status: res.status, ok: !!res.ok, body: null };
    });
  }

  function send(fetcher, url, opts) {
    return Promise.resolve().then(function () {
      if (!url || !fetcher) throw fail('netz');
      return fetcher(url, opts);
    }).then(readBody).catch(function (err) {
      if (err && err.code && err.userMessage) throw err;
      if (err && err.status) throw err;
      throw fail('netz');
    });
  }

  function post(fetcher, url, body, token) {
    var headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    return send(fetcher, url, {
      method: 'POST',
      headers: headers,
      body: body == null ? '{}' : JSON.stringify(body)
    });
  }

  function get(fetcher, url, token) {
    return send(fetcher, url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + token }
    });
  }

  function codeFrom(result) {
    var code = result && result.body && result.body.error ? String(result.body.error) : '';
    if (code) return code;
    if (!result) return 'netz';
    if (result.status === 400) return 'invalid_request';
    if (result.status === 401) return 'unauthorized';
    if (result.status === 413) return 'screenshot_too_large';
    if (result.status === 429) return 'rate_limited';
    return 'netz';
  }

  function sessionOf(storage, now) {
    var Acc = account();
    var store = storageOf(storage);
    if (!Acc || !store || typeof Acc.readSession !== 'function') return null;
    try { return Acc.readSession(store, now); }
    catch (err) { return null; }
  }

  function screenshotBytes(dataUrl) {
    if (typeof dataUrl !== 'string') return -1;
    var match = /^data:image\/(png|jpeg|jpg|webp);base64,/.exec(dataUrl);
    if (!match) return -1;
    var b64 = dataUrl.slice(match[0].length).replace(/\s+/g, '');
    if (!b64 || /[^A-Za-z0-9+/=]/.test(b64)) return -1;
    var pad = 0;
    if (b64.slice(-2) === '==') pad = 2;
    else if (b64.slice(-1) === '=') pad = 1;
    return Math.floor(b64.length * 3 / 4) - pad;
  }

  function normalizeShot(dataUrl) {
    if (typeof dataUrl !== 'string') return '';
    if (dataUrl.indexOf('data:image/jpg;') === 0) {
      return 'data:image/jpeg;' + dataUrl.slice('data:image/jpg;'.length);
    }
    return dataUrl;
  }

  function skipKey(key) {
    if (!key) return true;
    if (key.charAt(0) === '_') return true;
    return key === 'token' || key === 'password' || key === 'authorization' || key === 'cookie' || key === 'email' || key === 'ws';
  }

  function plain(value, depth, seen) {
    if (depth == null) depth = 0;
    if (value == null) return value;
    var kind = typeof value;
    if (kind === 'string') return value.length > 8000 ? value.slice(0, 8000) : value;
    if (kind === 'number') return isFinite(value) ? value : null;
    if (kind === 'boolean') return value;
    if (kind !== 'object') return undefined;
    if (depth > 12) return undefined;
    if (typeof value.nodeType === 'number' && typeof value.nodeName === 'string') return undefined;
    if (!seen) seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    if (seen) {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    if (Array.isArray(value)) {
      var list = [];
      var max = Math.min(value.length, 200);
      for (var i = 0; i < max; i++) {
        var item = plain(value[i], depth + 1, seen);
        if (item !== undefined) list.push(item);
      }
      return list;
    }
    var out = {};
    var keys;
    try { keys = Object.keys(value); }
    catch (err) { return undefined; }
    for (var k = 0; k < keys.length; k++) {
      if (skipKey(keys[k])) continue;
      var child = plain(value[keys[k]], depth + 1, seen);
      if (child !== undefined) out[keys[k]] = child;
    }
    return out;
  }

  function shrinkOnce(node) {
    var bestParent = null;
    var bestKey = null;
    var bestSize = 0;
    function visit(obj) {
      if (!obj || typeof obj !== 'object') return;
      var keys = Object.keys(obj);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var val = obj[key];
        var size = 0;
        if (typeof val === 'string') size = val.length;
        else if (val && typeof val === 'object') {
          try { size = JSON.stringify(val).length; }
          catch (err) { size = 0; }
        }
        if (size > bestSize) {
          bestSize = size;
          bestParent = obj;
          bestKey = key;
        }
        if (val && typeof val === 'object') visit(val);
      }
    }
    visit(node);
    if (!bestParent || bestSize < 48) return false;
    var current = bestParent[bestKey];
    if (typeof current === 'string') {
      if (current.length < 48) {
        delete bestParent[bestKey];
        return true;
      }
      bestParent[bestKey] = current.slice(0, Math.floor(current.length / 2));
      return true;
    }
    if (Array.isArray(current)) {
      if (current.length <= 1) {
        delete bestParent[bestKey];
        return true;
      }
      current.length = Math.floor(current.length / 2);
      return true;
    }
    delete bestParent[bestKey];
    return true;
  }

  function fitState(value) {
    if (value == null) return null;
    var clean = plain(value);
    if (clean == null) return null;
    var json = '';
    try { json = JSON.stringify(clean); }
    catch (err) { return null; }
    var guard = 0;
    while (json && utf8Length(json) > STATE_LIMIT && guard < 80) {
      guard += 1;
      if (!shrinkOnce(clean)) break;
      try { json = JSON.stringify(clean); }
      catch (err) { return { note: 'Spielstand gekürzt' }; }
    }
    if (!json || utf8Length(json) > STATE_LIMIT) return { note: 'Spielstand gekürzt' };
    return clean;
  }

  function collectState(game, win) {
    var host = win || (typeof window !== 'undefined' ? window : null);
    if (!host) return null;
    var name = normalizeGame(game);
    try {
      if (name === 'skat' && host.__skat) return { state: host.__skat.state, match: host.__skat.match };
      if (name === 'schafkopf' && host.__schafkopf) return { state: host.__schafkopf.state, match: host.__schafkopf.match };
      if (name === 'jass' && host.__jass) return { table: host.__jass.table || host.__jass.state };
      if (name === 'canasta' && host.__canasta) return { state: host.__canasta.state };
      if (name === 'maumau' && host.__maumau) return { state: host.__maumau.state, match: host.__maumau.match };
      if (name === 'tisch' && host.__tisch) return { view: host.__tisch.view || host.__tisch.state };
    } catch (err) { return null; }
    return null;
  }

  function pageUrl(href) {
    var raw = href;
    if (!raw && typeof location !== 'undefined') raw = location.href;
    if (!raw) return '';
    try {
      var url = new URL(raw);
      url.searchParams.delete('token');
      return url.toString().slice(0, 2000);
    } catch (err) {
      return '';
    }
  }

  function buildPayload(input) {
    var source = input || {};
    var description = String(source.description == null ? '' : source.description).trim();
    if (description.length < MIN_DESCRIPTION || description.length > MAX_DESCRIPTION) throw fail('invalid_request');
    var body = {
      game: normalizeGame(source.game),
      description: description
    };
    var steps = String(source.steps == null ? '' : source.steps).trim();
    if (steps) body.steps = steps.slice(0, MAX_STEPS);
    if (source.url) body.url = String(source.url).slice(0, 2000);
    if (source.userAgent) body.userAgent = String(source.userAgent).slice(0, 400);
    if (source.screenshot) {
      var shot = normalizeShot(source.screenshot);
      var bytes = screenshotBytes(shot);
      if (bytes < 0 || bytes > SHOT_LIMIT) throw fail('screenshot_too_large');
      body.screenshot = shot;
    }
    if (source.clientState != null) {
      var fitted = fitState(source.clientState);
      if (fitted != null) {
        var encoded = JSON.stringify(fitted);
        if (utf8Length(encoded) > STATE_LIMIT) throw fail('state_too_large');
        body.clientState = fitted;
      }
    }
    return body;
  }

  function fetcherOf(fetcher) {
    if (fetcher) return fetcher;
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') return window.fetch.bind(window);
    return null;
  }

  function submitReport(storage, input, fetcher, now) {
    var store = storageOf(storage);
    var session = sessionOf(store, now);
    if (!session || !session.token) return Promise.reject(fail('unauthorized'));
    var body;
    try { body = buildPayload(input); }
    catch (err) { return Promise.reject(err.code ? err : fail('invalid_request')); }
    return post(fetcherOf(fetcher), apiBase() + '/bug-reports', body, session.token).then(function (result) {
      if (result.ok && result.body && result.body.id) return { id: result.body.id };
      throw fail(codeFrom(result));
    });
  }

  function normalizeItem(raw) {
    var item = raw && typeof raw === 'object' ? raw : {};
    return {
      id: item.id || '',
      game: normalizeGame(item.game),
      description: String(item.description || ''),
      steps: item.steps ? String(item.steps) : '',
      url: item.url ? String(item.url) : '',
      status: item.status === 'confirmed' || item.status === 'rejected' || item.status === 'duplicate' || item.status === 'fixed' || item.status === 'new' ? item.status : 'new',
      hasScreenshot: !!item.hasScreenshot,
      createdAt: item.createdAt || '',
      decidedAt: item.decidedAt || ''
    };
  }

  function listMine(storage, fetcher, now) {
    var store = storageOf(storage);
    var session = sessionOf(store, now);
    if (!session || !session.token) return Promise.reject(fail('unauthorized'));
    return get(fetcherOf(fetcher), apiBase() + '/bug-reports/mine', session.token).then(function (result) {
      if (!result.ok) throw fail(codeFrom(result));
      var items = result.body && result.body.items;
      if (!Array.isArray(items)) return { items: [] };
      return { items: items.map(normalizeItem) };
    });
  }

  function formatWhen(value) {
    var time = Date.parse(value);
    if (!isFinite(time)) return '';
    var date = new Date(time);
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return pad(date.getDate()) + '.' + pad(date.getMonth() + 1) + '.' + date.getFullYear();
  }

  function clip(text, max) {
    var value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length <= max) return value;
    return value.slice(0, max - 1).trim() + '…';
  }

  function itemMarkup(item) {
    var status = item && item.status ? item.status : 'new';
    var when = formatWhen(item && item.createdAt);
    var decided = formatWhen(item && item.decidedAt);
    var html = '<li class="sf-report-item">';
    html += '<div class="sf-report-meta">';
    html += '<span class="sf-report-status" data-status="' + escapeText(status) + '">' + escapeText(statusLabel(status)) + '</span>';
    html += '<b>' + escapeText(gameLabel(item && item.game)) + '</b>';
    if (when) html += '<span>' + escapeText(when) + '</span>';
    if (item && item.hasScreenshot) html += '<span>mit Bild</span>';
    html += '</div>';
    html += '<p>' + escapeText(clip(item && item.description, 240)) + '</p>';
    if (item && item.steps) html += '<p>' + escapeText(clip(item.steps, 180)) + '</p>';
    if (decided) html += '<p>Entschieden am ' + escapeText(decided) + '.</p>';
    html += '</li>';
    return html;
  }

  function listMarkup(items) {
    if (!items || !items.length) {
      return '<p class="pw-lead">Du hast noch keine Meldung geschickt. Wenn beim Spiel etwas hakt, tippe auf Fehler melden.</p>';
    }
    var html = '<ul class="sf-report-list">';
    for (var i = 0; i < items.length; i++) html += itemMarkup(items[i]);
    return html + '</ul>';
  }

  function buttonMarkup() {
    return '<button type="button" class="tbtn sf-report" data-sf-report>' +
      '<svg class="sf-report-ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">' +
      '<path fill="currentColor" d="M6 3h2v18H6V3zm2 1h11l-2.4 4.2L19 12H8V4z"/></svg>' +
      '<span>Fehler melden</span></button>';
  }

  function dialogMarkup() {
    return '<div class="sf-report-dialog">' +
      '<p class="pw-kicker">Community-Testing</p>' +
      '<h3 id="report-title">Fehler melden</h3>' +
      '<p class="pw-lead">' + escapeText(INTRO) + '</p>' +
      '<p class="sf-more"><a href="/community-testing/">So funktioniert die Prämie</a></p>' +
      '<form data-report-form>' +
      '<label class="pw-field">Was ist passiert?' +
      '<textarea data-report-what required maxlength="2000" placeholder="Zum Beispiel: Die Zehn blieb liegen, obwohl sie stechen musste."></textarea>' +
      '<span class="sf-hint">Ein kurzer Satz reicht. Wir müssen es nachspielen können.</span>' +
      '</label>' +
      '<label class="pw-field sf-optional">Wie kam es dazu?' +
      '<textarea data-report-steps maxlength="2000" placeholder="Was hast Du kurz davor getippt oder gespielt?"></textarea>' +
      '<span class="sf-hint">Darfst Du leer lassen.</span>' +
      '</label>' +
      '<label class="sf-check"><input data-report-shot type="checkbox" checked> <span>Bildschirmfoto der Spielansicht anhängen</span></label>' +
      '<p class="pw-status" data-report-status role="status"></p>' +
      '<div class="pw-actions">' +
      '<button type="button" class="btn btn-ghost-dark" data-report-close>Später</button>' +
      '<button type="submit" class="btn btn-gold" data-report-send>Meldung schicken</button>' +
      '</div></form></div>';
  }

  function loggedOutMarkup() {
    return '<div class="sf-report-dialog">' +
      '<p class="pw-kicker">Community-Testing</p>' +
      '<h3 id="report-title">Fehler melden</h3>' +
      '<p class="pw-lead">' + escapeText(INTRO) + '</p>' +
      '<p class="pw-lead">' + escapeText(ACCOUNT_LINE) + '</p>' +
      '<div class="pw-actions">' +
      '<button type="button" class="btn btn-ghost-dark" data-report-close>Später</button>' +
      '<button type="button" class="btn btn-gold" data-report-signup>Konto anlegen</button>' +
      '</div></div>';
  }

  function successMarkup(extra) {
    return '<div class="sf-report-dialog">' +
      '<p class="pw-kicker">Community-Testing</p>' +
      '<h3 id="report-title">Danke</h3>' +
      '<p class="pw-lead">' + escapeText(SUCCESS) + escapeText(extra || '') + '</p>' +
      '<div class="pw-actions"><button type="button" class="btn btn-gold" data-report-close>Weiter spielen</button></div></div>';
  }

  function listShell(inner) {
    return '<div class="sf-list-dialog">' +
      '<p class="pw-kicker">Community-Testing</p>' +
      '<h3 id="reports-title">Meine Meldungen</h3>' +
      '<div data-report-list>' + inner + '</div>' +
      '<div class="pw-actions"><button type="button" class="btn btn-ghost-dark" data-report-close>Schließen</button></div></div>';
  }

  function ensureModal(id, labelledBy) {
    if (typeof document === 'undefined') return null;
    var modal = document.getElementById(id);
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = id;
    modal.hidden = true;
    modal.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="' + labelledBy + '"></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (event) {
      if (event.target === modal) modal.hidden = true;
    });
    return modal;
  }

  function closeModal(id) {
    var modal = typeof document !== 'undefined' ? document.getElementById(id) : null;
    if (modal) modal.hidden = true;
  }

  function bindClose(root) {
    if (!root) return;
    var buttons = root.querySelectorAll('[data-report-close]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function () {
        closeModal('modal-report');
        closeModal('modal-reports');
      });
    }
  }

  function openSignupOver() {
    var Acc = account();
    if (!Acc || typeof Acc.openSignup !== 'function') return false;
    var opened = false;
    try { opened = Acc.openSignup() !== false; }
    catch (err) { opened = false; }
    var signup = typeof document !== 'undefined' ? document.getElementById('modal-signup') : null;
    if (signup) signup.style.zIndex = '90';
    return opened;
  }

  function loggedIn(now) {
    var session = sessionOf(null, now);
    return !!(session && session.token);
  }

  function openDialog() {
    var modal = ensureModal('modal-report', 'report-title');
    if (!modal) return false;
    var card = modal.querySelector('.modal-card');
    if (!loggedIn()) {
      card.innerHTML = loggedOutMarkup();
      bindClose(card);
      modal.hidden = false;
      modal.style.zIndex = '70';
      openSignupOver();
      return false;
    }
    card.innerHTML = dialogMarkup();
    bindClose(card);
    var form = card.querySelector('[data-report-form]');
    if (form) form.addEventListener('submit', onSubmit);
    modal.hidden = false;
    modal.style.zIndex = '80';
    var field = card.querySelector('[data-report-what]');
    if (field && field.focus) {
      try { field.focus(); } catch (err) { /* egal */ }
    }
    return true;
  }

  function openList() {
    var modal = ensureModal('modal-reports', 'reports-title');
    if (!modal) return false;
    var card = modal.querySelector('.modal-card');
    if (!loggedIn()) {
      card.innerHTML = listShell('<p class="pw-lead">' + escapeText(ACCOUNT_LINE) + '</p>' +
        '<div class="pw-actions"><button type="button" class="btn btn-gold" data-report-signup>Konto anlegen</button></div>');
      bindClose(card);
      modal.hidden = false;
      openSignupOver();
      return false;
    }
    card.innerHTML = listShell('<p class="pw-lead">Einen Moment, ich hole Deine Meldungen.</p>');
    bindClose(card);
    modal.hidden = false;
    var slot = card.querySelector('[data-report-list]');
    var fetcher = window.fetch ? window.fetch.bind(window) : null;
    listMine(null, fetcher).then(function (result) {
      if (slot) slot.innerHTML = listMarkup(result.items);
    }).catch(function (err) {
      if (slot) slot.innerHTML = '<p class="pw-lead">' + escapeText(err.userMessage || messageFor(err.code)) + '</p>';
      if (err.code === 'unauthorized') openSignupOver();
    });
    return true;
  }

  function paintInlineList() {
    if (typeof document === 'undefined') return;
    var slot = document.getElementById('sf-report-list');
    if (!slot) return;
    if (!loggedIn()) {
      slot.innerHTML = '<p class="pw-lead">' + escapeText(ACCOUNT_LINE) + '</p>' +
        '<p><button type="button" class="btn btn-gold" data-report-signup>Konto anlegen</button></p>';
      return;
    }
    slot.innerHTML = '<p class="pw-lead">Einen Moment, ich hole Deine Meldungen.</p>';
    var fetcher = window.fetch ? window.fetch.bind(window) : null;
    listMine(null, fetcher).then(function (result) {
      slot.innerHTML = listMarkup(result.items);
    }).catch(function (err) {
      slot.innerHTML = '<p class="pw-lead">' + escapeText(err.userMessage || messageFor(err.code)) + '</p>';
    });
  }

  function onSubmit(event) {
    event.preventDefault();
    var rootNode = document.getElementById('modal-report');
    if (!rootNode) return;
    var what = rootNode.querySelector('[data-report-what]');
    var steps = rootNode.querySelector('[data-report-steps]');
    var shot = rootNode.querySelector('[data-report-shot]');
    var status = rootNode.querySelector('[data-report-status]');
    var button = rootNode.querySelector('[data-report-send]');
    var description = what ? what.value : '';
    if (String(description).trim().length < MIN_DESCRIPTION) {
      if (status) status.textContent = 'Schreib bitte noch ein paar Worte. Wir müssen verstehen, was passiert ist.';
      if (what && what.focus) {
        try { what.focus(); } catch (err) { /* egal */ }
      }
      return;
    }
    if (button) button.disabled = true;
    var wantedShot = !!(shot && shot.checked);
    if (status) status.textContent = wantedShot ? 'Einen Moment, ich lege das Bildschirmfoto dazu.' : 'Einen Moment.';
    var game = gameFromPath(location.pathname || '');
    Promise.resolve().then(function () {
      return wantedShot ? captureGame() : null;
    }).then(function (screenshot) {
      var missed = wantedShot && !screenshot;
      return submitReport(null, {
        game: game,
        description: description,
        steps: steps ? steps.value : '',
        url: pageUrl(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        screenshot: screenshot || undefined,
        clientState: collectState(game)
      }).then(function () {
        var card = rootNode.querySelector('.modal-card');
        if (card) {
          var extra = missed ? ' Das Bildschirmfoto hat nicht geklappt. Die Meldung geht auch ohne Foto raus.' : '';
          card.innerHTML = successMarkup(extra);
          bindClose(card);
        }
      });
    }).catch(function (err) {
      if (button) button.disabled = false;
      if (status) status.textContent = (err && err.userMessage) || messageFor(err && err.code);
      if (err && err.code === 'unauthorized') openSignupOver();
      if (err && (err.code === 'screenshot_too_large') && shot) shot.checked = false;
    });
  }

  function gameArea() {
    return document.getElementById('tabletop')
      || document.querySelector('.table-area')
      || document.querySelector('.room')
      || document.querySelector('main')
      || document.getElementById('app');
  }

  function loadHtml2Canvas() {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (typeof window.html2canvas === 'function') return Promise.resolve(window.html2canvas);
    if (html2canvasPromise) return html2canvasPromise;
    html2canvasPromise = new Promise(function (resolve) {
      var script = document.createElement('script');
      script.src = '/spielpartner/html2canvas.min.js';
      script.async = true;
      script.onload = function () { resolve(typeof window.html2canvas === 'function' ? window.html2canvas : null); };
      script.onerror = function () { resolve(null); };
      document.head.appendChild(script);
    });
    return html2canvasPromise;
  }

  function scaleCanvas(canvas, scale) {
    var next = document.createElement('canvas');
    next.width = Math.max(1, Math.round(canvas.width * scale));
    next.height = Math.max(1, Math.round(canvas.height * scale));
    var ctx = next.getContext('2d');
    if (!ctx) return canvas;
    ctx.fillStyle = '#173b30';
    ctx.fillRect(0, 0, next.width, next.height);
    ctx.drawImage(canvas, 0, 0, next.width, next.height);
    return next;
  }

  function canvasToJpeg(canvas) {
    try {
      var edge = Math.max(canvas.width, canvas.height);
      var current = edge > 1600 ? scaleCanvas(canvas, 1600 / edge) : canvas;
      var quality = 0.82;
      var url = current.toDataURL('image/jpeg', quality);
      var guard = 0;
      while (screenshotBytes(url) > SHOT_TARGET && guard < 8) {
        guard += 1;
        if (quality > 0.45) {
          quality = Math.round((quality - 0.1) * 100) / 100;
          url = current.toDataURL('image/jpeg', quality);
        } else if (current.width > 480) {
          current = scaleCanvas(current, 0.72);
          quality = 0.68;
          url = current.toDataURL('image/jpeg', quality);
        } else break;
      }
      if (screenshotBytes(url) < 0 || screenshotBytes(url) > SHOT_LIMIT) return null;
      return url;
    } catch (err) {
      return null;
    }
  }

  function foreignObjectShot(el) {
    return new Promise(function (resolve) {
      try {
        var rect = el.getBoundingClientRect();
        var width = Math.max(1, Math.min(1400, Math.round(rect.width || el.clientWidth || 800)));
        var height = Math.max(1, Math.min(1200, Math.round(rect.height || el.clientHeight || 600)));
        var clone = el.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
        clone.style.width = width + 'px';
        clone.style.height = height + 'px';
        clone.style.margin = '0';
        var xml = new XMLSerializer().serializeToString(clone);
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
          '<foreignObject width="100%" height="100%">' + xml + '</foreignObject></svg>';
        var img = new Image();
        img.onload = function () {
          try {
            var canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#173b30';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas);
          } catch (err) { resolve(null); }
        };
        img.onerror = function () { resolve(null); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      } catch (err) {
        resolve(null);
      }
    });
  }

  function shotOf(el) {
    if (!el) return Promise.resolve(null);
    var canvas = el.tagName === 'CANVAS' ? el : el.querySelector('canvas');
    if (canvas && canvas.width > 20 && canvas.height > 20 && typeof canvas.toDataURL === 'function') {
      var direct = canvasToJpeg(canvas);
      if (direct) return Promise.resolve(direct);
    }
    return loadHtml2Canvas().then(function (html2canvas) {
      if (typeof html2canvas === 'function') {
        return html2canvas(el, {
          scale: 1,
          useCORS: true,
          backgroundColor: '#173b30',
          logging: false,
          imageTimeout: 4000
        }).then(canvasToJpeg).catch(function () { return null; });
      }
      return foreignObjectShot(el).then(function (drawn) {
        return drawn ? canvasToJpeg(drawn) : null;
      });
    }).catch(function () { return null; });
  }

  function within(promise, ms) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        resolve(null);
      }, ms);
      Promise.resolve(promise).then(function (value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      }, function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      });
    });
  }

  function captureGame() {
    var modal = document.getElementById('modal-report');
    var wasHidden = !modal || modal.hidden;
    if (modal) modal.hidden = true;
    var area = gameArea();
    return within(shotOf(area), 8000).then(function (url) {
      if (modal && !wasHidden) modal.hidden = false;
      return url || null;
    });
  }

  function mountButton() {
    if (typeof document === 'undefined') return;
    if (document.querySelector('[data-sf-report]')) return;
    var game = gameFromPath(location.pathname || '');
    if (REPORT_GAMES.indexOf(game) === -1) return;
    var host = document.querySelector('.topbar-actions');
    if (!host) return;
    host.insertAdjacentHTML('beforeend', buttonMarkup());
  }

  function mountListEntry() {
    if (typeof document === 'undefined') return;
    var host = document.querySelector('[data-sf-account]');
    if (!host || host.querySelector('[data-sf-reports]')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-sf-reports', '');
    button.textContent = 'Meine Meldungen';
    var logout = host.querySelector('[data-sf-logout]');
    if (logout) host.insertBefore(button, logout);
    else host.appendChild(button);
  }

  function closest(node, selector) {
    var current = node;
    while (current && current.nodeType === 1) {
      if (current.matches && current.matches(selector)) return current;
      current = current.parentNode;
    }
    return null;
  }

  function onClick(event) {
    var target = event.target;
    if (closest(target, '[data-sf-report]')) {
      event.preventDefault();
      openDialog();
      return;
    }
    if (closest(target, '[data-sf-reports]')) {
      event.preventDefault();
      openList();
      return;
    }
    if (closest(target, '[data-report-signup]')) {
      event.preventDefault();
      openSignupOver();
    }
  }

  function onKey(event) {
    if (!event || event.key !== 'Escape') return;
    closeModal('modal-report');
    closeModal('modal-reports');
  }

  function ensureCss() {
    if (typeof document === 'undefined') return;
    if (document.querySelector('link[data-sf-reports-css], link[href$="/spielpartner/reports.css"], link[href$="reports.css"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/spielpartner/reports.css';
    link.setAttribute('data-sf-reports-css', '');
    document.head.appendChild(link);
  }

  function boot() {
    ensureCss();
    mountButton();
    mountListEntry();
    paintInlineList();
    if (booted || typeof document === 'undefined') return;
    booted = true;
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  }

  return {
    GAMES: GAMES,
    REPORT_GAMES: REPORT_GAMES,
    INTRO: INTRO,
    SUCCESS: SUCCESS,
    ACCOUNT_LINE: ACCOUNT_LINE,
    MIN_DESCRIPTION: MIN_DESCRIPTION,
    MAX_DESCRIPTION: MAX_DESCRIPTION,
    STATE_LIMIT: STATE_LIMIT,
    SHOT_LIMIT: SHOT_LIMIT,
    SHOT_TARGET: SHOT_TARGET,
    gameFromPath: gameFromPath,
    normalizeGame: normalizeGame,
    gameLabel: gameLabel,
    statusLabel: statusLabel,
    messageFor: messageFor,
    screenshotBytes: screenshotBytes,
    fitState: fitState,
    collectState: collectState,
    pageUrl: pageUrl,
    buildPayload: buildPayload,
    submitReport: submitReport,
    listMine: listMine,
    listMarkup: listMarkup,
    buttonMarkup: buttonMarkup,
    dialogMarkup: dialogMarkup,
    loggedOutMarkup: loggedOutMarkup,
    successMarkup: successMarkup,
    formatWhen: formatWhen,
    boot: boot,
    mountButton: mountButton,
    mountListEntry: mountListEntry,
    openDialog: openDialog,
    openList: openList
  };
});
