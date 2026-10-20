/*
 * Spielerkonto im Browser.
 * Eine Proberunde ohne Konto. Danach E-Mail und Spielername, der Server
 * schickt einen Anmeldelink. Der Bearer-Token liegt in localStorage, kein Cookie.
 * Test und Tageslimit kommen angemeldet aus GET /me. Ist die API nicht
 * erreichbar, bleibt der Tisch offen und wir schreiben eine Zeile in die Konsole.
 *
 * Die API-Basis und der Empfehlungscode kommen aus SpielpartnerEntitlement.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpielpartnerAccount = api;
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

  var SESSION_KEY = 'sf-account';
  var PROBE_KEY = 'sf-proberunde';
  var RETURN_KEY = 'sf-account-return';
  var FAILOPEN_KEY = 'sf-failopen';
  var FAILOPEN_MS = 12 * 60 * 60 * 1000;
  var booted = false;

  function entitlement() {
    if (typeof window !== 'undefined' && window.SpielpartnerEntitlement) return window.SpielpartnerEntitlement;
    return null;
  }

  function apiBase() {
    var Ent = entitlement();
    return Ent && Ent.BILLING_API_BASE ? Ent.BILLING_API_BASE : '';
  }

  function logFail(what, err) {
    var detail = err && err.message ? err.message : err;
    try { console.warn('Spiel-Freunde', what, detail || ''); }
    catch (e) { /* Konsole gesperrt */ }
  }

  function nowOf(now) {
    return now == null ? Date.now() : now;
  }

  function storageOf(storage) {
    if (storage) return storage;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (err) { /* privat */ }
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    } catch (err) { /* privat */ }
    return null;
  }

  function parseTime(value) {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      var parsed = Date.parse(value);
      if (isFinite(parsed)) return parsed;
    }
    return null;
  }

  function validEmail(value) {
    var Ent = entitlement();
    if (Ent && typeof Ent.validEmail === 'function') return Ent.validEmail(value);
    var email = String(value || '').trim();
    if (!email || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '';
    return email;
  }

  function validName(value) {
    var raw = String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
    var out = '';
    for (var i = 0; i < raw.length; i++) {
      var ch = raw.charAt(i);
      if (/^[\p{L}\p{N} .'\-]$/u.test(ch)) out += ch;
    }
    out = out.replace(/\s+/g, ' ').trim().slice(0, 24);
    if (out.length < 2) return '';
    return out;
  }

  function readSession(storage, now) {
    if (!storage) return null;
    try {
      var raw = JSON.parse(storage.getItem(SESSION_KEY));
      if (!raw || typeof raw !== 'object' || !raw.token) return null;
      var exp = parseTime(raw.expiresAt);
      if (exp != null && !(nowOf(now) < exp)) return null;
      return raw;
    } catch (err) {
      return null;
    }
  }

  function writeSession(storage, session) {
    storage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  function clearSession(storage) {
    try { storage.removeItem(SESSION_KEY); }
    catch (err) { /* privat */ }
  }

  function probeUsed(storage) {
    try { return storage.getItem(PROBE_KEY) === '1'; }
    catch (err) { return false; }
  }

  function markProbe(storage) {
    try { storage.setItem(PROBE_KEY, '1'); }
    catch (err) { /* privat */ }
  }

  function markFailOpen(storage, now) {
    try { storage.setItem(FAILOPEN_KEY, String(nowOf(now))); }
    catch (err) { /* privat */ }
  }

  function failOpen(storage, now) {
    try {
      var raw = storage.getItem(FAILOPEN_KEY);
      if (!raw) return false;
      var at = Number(raw);
      return isFinite(at) && nowOf(now) - at < FAILOPEN_MS;
    } catch (err) {
      return false;
    }
  }

  function clearFailOpen(storage) {
    try { storage.removeItem(FAILOPEN_KEY); }
    catch (err) { /* egal */ }
  }

  function safePath(value) {
    if (typeof value !== 'string') return '';
    if (value.charAt(0) !== '/' || value.charAt(1) === '/' || value.indexOf('://') !== -1) return '';
    if (value.indexOf('/anmelden') === 0) return '';
    return value;
  }

  function rememberReturn(storage, path) {
    var target = safePath(path);
    if (!target && typeof location !== 'undefined') target = safePath(location.pathname || '');
    if (!target) return '';
    try { storage.setItem(RETURN_KEY, target); }
    catch (err) { return ''; }
    return target;
  }

  function returnPath(storage) {
    try { return safePath(storage.getItem(RETURN_KEY) || ''); }
    catch (err) { return ''; }
  }

  function partnerRef(storage, now) {
    var Ent = entitlement();
    if (!Ent || typeof Ent.readRef !== 'function') return '';
    try { return Ent.readRef(storage, nowOf(now)) || ''; }
    catch (err) { return ''; }
  }

  function uuid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    var hex = '0123456789abcdef';
    var out = '';
    for (var i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
      else if (i === 14) out += '4';
      else out += hex.charAt(Math.floor(Math.random() * 16));
    }
    return out;
  }

  function readBody(res) {
    if (!res) return Promise.reject(new Error('netz'));
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
      if (!url) throw new Error('netz');
      return fetcher(url, opts);
    }).then(readBody).catch(function (err) {
      if (err && err.status) throw err;
      var wrapped = new Error('netz');
      wrapped.cause = err;
      throw wrapped;
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

  function errorCode(result) {
    return result && result.body && result.body.error ? String(result.body.error) : '';
  }

  function messageFor(code) {
    if (code === 'invalid_request') return 'Prüfe E-Mail und Spielername.';
    if (code === 'origin_not_allowed') return 'Die Anmeldung ist von hier gerade nicht erlaubt.';
    if (code === 'rate_limited') return 'Das war zu oft hintereinander. Warte einen Moment.';
    if (code === 'mail_failed' || code === 'mail_unavailable') return 'Die Mail ist gerade nicht rausgegangen. Versuch es noch einmal.';
    if (code === 'session_unavailable') return 'Die Anmeldung ist gerade nicht erreichbar. Du kannst weiter spielen.';
    if (code === 'invalid_token') return 'Dieser Anmeldelink gilt nicht.';
    if (code === 'token_expired') return 'Der Anmeldelink ist abgelaufen. Fordere einen neuen an.';
    if (code === 'token_used') return 'Dieser Anmeldelink wurde schon benutzt.';
    if (code === 'unauthorized') return 'Die Anmeldung ist abgelaufen. Hol Dir einen neuen Link.';
    if (code === 'netz') return 'Wir erreichen den Server gerade nicht. Du kannst weiter spielen.';
    return 'Das hat gerade nicht geklappt. Du kannst weiter spielen.';
  }

  function signupBody(storage, input, now) {
    var email = validEmail(input && input.email);
    var name = validName(input && input.name);
    if (!email || !name) {
      var error = new Error('invalid_request');
      error.code = 'invalid_request';
      throw error;
    }
    var body = { email: email, name: name };
    var ref = partnerRef(storage, now);
    if (ref) body.ref = ref;
    return body;
  }

  function requestLink(storage, input, now, fetcher) {
    var body;
    try { body = signupBody(storage, input, now); }
    catch (err) { return Promise.reject(err); }
    rememberReturn(storage, input && input.returnPath);
    return post(fetcher, apiBase() + '/signup-or-login', body, '').then(function (result) {
      if (result.ok && result.body && result.body.ok === true) {
        clearFailOpen(storage);
        return { ok: true, email: body.email, name: body.name };
      }
      var code = errorCode(result) || 'invalid_request';
      var error = new Error(code);
      error.code = code;
      error.status = result.status;
      throw error;
    }).catch(function (err) {
      var code = err && err.code ? err.code : (err && err.message === 'netz' ? 'netz' : 'netz');
      if (code === 'netz' || code === 'session_unavailable' || code === 'mail_unavailable') {
        markFailOpen(storage, now);
        logFail('Anmeldelink', err);
      }
      if (!err.code) err.code = code;
      err.userMessage = messageFor(err.code);
      throw err;
    });
  }

  function storeVerified(storage, data) {
    var player = data && data.player ? data.player : null;
    if (!data || !data.token || !player || !player.displayName) {
      var error = new Error('invalid_token');
      error.code = 'invalid_token';
      throw error;
    }
    var session = {
      token: data.token,
      tokenType: data.tokenType || 'Bearer',
      expiresAt: data.expiresAt || null,
      player: {
        id: player.id || '',
        email: player.email || '',
        displayName: player.displayName
      },
      me: null
    };
    writeSession(storage, session);
    return session;
  }

  function saveMe(storage, me) {
    var raw;
    try { raw = JSON.parse(storage.getItem(SESSION_KEY)); }
    catch (err) { return null; }
    if (!raw || !raw.token) return null;
    raw.me = me;
    if (me && me.player && me.player.displayName) {
      raw.player = raw.player || {};
      raw.player.displayName = me.player.displayName;
      if (me.player.email) raw.player.email = me.player.email;
      if (me.player.id) raw.player.id = me.player.id;
    }
    writeSession(storage, raw);
    clearFailOpen(storage);
    return raw;
  }

  function refresh(storage, now, fetcher) {
    var session = readSession(storage, now);
    if (!session) return Promise.resolve(null);
    return get(fetcher, apiBase() + '/me', session.token).then(function (result) {
      if (result.status === 401) {
        clearSession(storage);
        logFail('Profil', 'unauthorized');
        return null;
      }
      if (!result.ok || !result.body) {
        markFailOpen(storage, now);
        logFail('Profil', errorCode(result) || result.status);
        return null;
      }
      return saveMe(storage, result.body);
    }).catch(function (err) {
      markFailOpen(storage, now);
      logFail('Profil', err);
      return null;
    });
  }

  function verify(storage, token, now, fetcher) {
    var clean = String(token || '').trim();
    if (!clean) {
      var missing = new Error('invalid_token');
      missing.code = 'invalid_token';
      missing.userMessage = messageFor('invalid_token');
      return Promise.reject(missing);
    }
    return post(fetcher, apiBase() + '/verify', { token: clean }, '').then(function (result) {
      if (!result.ok) {
        var code = errorCode(result) || 'invalid_token';
        var error = new Error(code);
        error.code = code;
        error.userMessage = messageFor(code);
        throw error;
      }
      var session = storeVerified(storage, result.body);
      return refresh(storage, now, fetcher).then(function () {
        return readSession(storage, now) || session;
      });
    }).catch(function (err) {
      if (err && err.message === 'netz') {
        markFailOpen(storage, now);
        logFail('Anmeldelink', err);
        err.code = 'netz';
        err.userMessage = messageFor('netz');
      }
      if (err && !err.userMessage) err.userMessage = messageFor(err.code || 'invalid_token');
      throw err;
    });
  }

  function logout(storage, now, fetcher) {
    var session = readSession(storage, now);
    clearSession(storage);
    booted = false;
    var done = Promise.resolve();
    if (session && fetcher) {
      done = post(fetcher, apiBase() + '/logout', {}, session.token).catch(function (err) {
        logFail('Abmelden', err);
      });
    }
    return done.then(function () { return { ok: true }; });
  }

  function accessFromMe(me) {
    if (!me) return { ok: true, failOpen: true };
    var free = me.freeRounds || {};
    var trialOn = !!(me.trial && me.trial.active) || me.tier === 'trial';
    if (free.unlimited || trialOn || me.tier === 'premium' || me.tier === 'standard') {
      return { ok: true, unlimited: true };
    }
    if (typeof free.remaining === 'number') {
      if (free.remaining > 0) return { ok: true, remaining: free.remaining, limit: free.limit };
      return { ok: false, paywall: true, remaining: 0, limit: free.limit };
    }
    return { ok: true, failOpen: true };
  }

  function openPaywall() {
    var wall = typeof window !== 'undefined' ? window.SpielpartnerPaywall : null;
    if (wall && typeof wall.open === 'function') wall.open();
  }

  function signupMarkup() {
    return '<p class="pw-kicker">Eine Runde hast Du</p>' +
      '<h3 id="signup-title">Setz Dich richtig dazu</h3>' +
      '<p class="pw-lead">Wir schicken Dir einen Anmeldelink, kein Passwort nötig.</p>' +
      '<form data-signup>' +
      '<label class="pw-field">E-Mail' +
      '<input data-email type="email" autocomplete="email" inputmode="email" maxlength="200" required placeholder="du@example.com">' +
      '</label>' +
      '<label class="pw-field">Spielername' +
      '<input data-name type="text" autocomplete="nickname" maxlength="24" required placeholder="Wie Du am Tisch heißt">' +
      '</label>' +
      '<button type="submit" class="btn btn-gold">Link schicken</button>' +
      '<p class="pw-status" data-status role="status"></p>' +
      '</form>' +
      '<div class="pw-actions"><button type="button" class="btn btn-ghost-dark" data-signup-close>Später</button></div>';
  }

  function sentMarkup(email) {
    return '<p class="pw-kicker">Postfach</p>' +
      '<h3 id="signup-title">Der Link ist unterwegs</h3>' +
      '<p class="pw-lead">Schau in Dein Postfach' + (email ? ' bei ' + escapeText(email) : '') +
      '. Wir schicken Dir einen Anmeldelink, kein Passwort nötig.</p>' +
      '<div class="pw-actions"><button type="button" class="btn btn-ghost-dark" data-signup-close>Später</button></div>';
  }

  function escapeText(value) {
    return String(value || '').replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function welcomeLine(name) {
    return 'Willkommen, ' + String(name || '').trim() + '! Deine 14 Testtage laufen.';
  }

  function ensureModal() {
    if (typeof document === 'undefined') return null;
    var modal = document.getElementById('modal-signup');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'modal-signup';
    modal.hidden = true;
    modal.innerHTML = '<div class="modal-card paywall" role="dialog" aria-modal="true" aria-labelledby="signup-title">' +
      '<div class="pw signup-card" id="signup-root"></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (event) {
      if (event.target === modal) modal.hidden = true;
    });
    return modal;
  }

  function bindSignup(modal, storage, fetcher) {
    var root = modal.querySelector('#signup-root');
    if (!root) return;
    root.innerHTML = signupMarkup();
    var form = root.querySelector('[data-signup]');
    var close = root.querySelector('[data-signup-close]');
    if (close) close.addEventListener('click', function () { modal.hidden = true; });
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = root.querySelector('[data-status]');
      var email = form.querySelector('[data-email]').value;
      var name = form.querySelector('[data-name]').value;
      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      requestLink(storage, { email: email, name: name }, Date.now(), fetcher).then(function (result) {
        root.innerHTML = sentMarkup(result.email);
        var later = root.querySelector('[data-signup-close]');
        if (later) later.addEventListener('click', function () { modal.hidden = true; });
      }).catch(function (err) {
        if (button) button.disabled = false;
        if (status) status.textContent = err.userMessage || messageFor(err.code);
        if (err.code === 'netz' || err.code === 'session_unavailable') modal.hidden = false;
      });
    });
  }

  function openSignup(storage, fetcher) {
    var modal = ensureModal();
    if (!modal) return false;
    var fetchFn = fetcher || (typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null);
    var store = storage;
    if (!store) {
      try { store = window.localStorage; }
      catch (err) { store = null; }
    }
    if (!store || !fetchFn) return false;
    bindSignup(modal, store, fetchFn);
    modal.hidden = false;
    var field = modal.querySelector('[data-email]');
    if (field && typeof field.focus === 'function') {
      try { field.focus(); } catch (err) { /* egal */ }
    }
    return true;
  }

  function gate(storage, now) {
    var store = storageOf(storage);
    if (!store) return true;
    var moment = nowOf(now);
    var session = readSession(store, moment);
    if (session && session.me) {
      if (failOpen(store, moment)) return true;
      var access = accessFromMe(session.me);
      if (access.paywall) {
        openPaywall();
        return false;
      }
      return true;
    }
    if (session && session.token) {
      if (!session.me) logFail('Profil', 'noch nicht geladen');
      return true;
    }
    if (!probeUsed(store) || failOpen(store, moment)) return true;
    openSignup(store);
    return false;
  }

  function finish(storage, now, fetcher) {
    var store = storageOf(storage);
    if (!store) return { paywall: false, failOpen: true };
    storage = store;
    var moment = nowOf(now);
    var session = readSession(storage, moment);
    if (session && session.token) {
      var roundId = uuid();
      if (!fetcher && typeof window !== 'undefined' && window.fetch) fetcher = window.fetch.bind(window);
      var pending = fetcher
        ? post(fetcher, apiBase() + '/rounds', { roundId: roundId }, session.token).then(function (result) {
          if (result.status === 403 && errorCode(result) === 'free_round_limit') {
            var next = Object.assign({}, session.me || {}, { freeRounds: result.body && result.body.freeRounds });
            saveMe(storage, next);
            openPaywall();
            return { paywall: true, error: 'free_round_limit', roundId: roundId };
          }
          if (!result.ok) {
            markFailOpen(storage, moment);
            logFail('Runde', errorCode(result) || result.status);
            return { paywall: false, failOpen: true, roundId: roundId };
          }
          if (result.body && result.body.freeRounds) {
            var merged = Object.assign({}, session.me || {}, { freeRounds: result.body.freeRounds });
            saveMe(storage, merged);
          }
          return {
            paywall: false,
            roundId: roundId,
            duplicate: !!(result.body && result.body.duplicate),
            freeRounds: result.body && result.body.freeRounds
          };
        }).catch(function (err) {
          markFailOpen(storage, moment);
          logFail('Runde', err);
          return { paywall: false, failOpen: true, roundId: roundId };
        })
        : Promise.resolve({ paywall: false, failOpen: true, roundId: roundId });
      return { ok: true, roundId: roundId, pending: pending };
    }
    if (!probeUsed(storage)) {
      markProbe(storage);
      openSignup(storage);
      return { proberunde: true, signup: true };
    }
    openSignup(storage);
    return { proberunde: false, signup: true };
  }

  function hint(storage, now) {
    var store = storageOf(storage);
    if (!store) return '';
    storage = store;
    var moment = nowOf(now);
    var session = readSession(storage, moment);
    if (session && session.me) {
      var me = session.me;
      if (me.trial && me.trial.active) {
        var days = typeof me.trial.daysLeft === 'number' ? me.trial.daysLeft : me.daysLeft;
        if (days === 1) return 'Test läuft noch 1 Tag.';
        if (typeof days === 'number') return 'Test läuft noch ' + days + ' Tage.';
      }
      var access = accessFromMe(me);
      if (access.unlimited) return '';
      if (access.paywall) return 'Die drei freien Runden für heute sind gespielt.';
      if (typeof access.remaining === 'number') {
        return 'Heute noch ' + access.remaining + ' von ' + (access.limit || 3) + ' freien Runden.';
      }
    }
    if (!session) {
      if (!probeUsed(storage)) return 'Eine Proberunde ohne Anmeldung.';
      return 'Melde Dich an, dann laufen 14 Testtage.';
    }
    return '';
  }

  function headerHtml(name) {
    return '<span class="sf-who" data-sf-account><b data-sf-name>' + escapeText(name) +
      '</b><button type="button" data-sf-logout>Abmelden</button></span>';
  }

  function mountHeader(storage) {
    if (typeof document === 'undefined') return;
    var host = document.querySelector('.topbar-actions') || document.querySelector('.nav-cta');
    var session = storage ? readSession(storage, Date.now()) : null;
    var existing = document.querySelector('[data-sf-account]');
    if (!host || !session || !session.player || !session.player.displayName) {
      if (existing) existing.remove();
      return;
    }
    if (!existing) {
      host.insertAdjacentHTML('afterbegin', headerHtml(session.player.displayName));
      var button = host.querySelector('[data-sf-logout]');
      if (button) {
        button.addEventListener('click', function () {
          var fetcher = window.fetch ? window.fetch.bind(window) : null;
          logout(storage, Date.now(), fetcher).then(function () {
            mountHeader(storage);
            try { window.location.reload(); }
            catch (err) { /* egal */ }
          });
        });
      }
    } else {
      var label = existing.querySelector('[data-sf-name]');
      if (label) label.textContent = session.player.displayName;
    }
    paintTableName(session.player.displayName);
  }

  function paintTableName(name) {
    if (!name || typeof document === 'undefined') return;
    var nodes = document.querySelectorAll('#me-name, #settings-ava-name');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = name;
    try { window.dispatchEvent(new CustomEvent('sf-avatar')); }
    catch (err) { /* alter Browser */ }
  }

  function ensureCss() {
    if (typeof document === 'undefined') return;
    if (document.querySelector('link[data-sf-account-css], link[href$="/spielpartner/account.css"], link[href$="account.css"]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/spielpartner/account.css';
    link.setAttribute('data-sf-account-css', '');
    document.head.appendChild(link);
  }

  function boot(storage, now) {
    ensureCss();
    var store = storage;
    if (!store) {
      try { store = typeof localStorage !== 'undefined' ? localStorage : null; }
      catch (err) { store = null; }
    }
    if (!store) return null;
    mountHeader(store);
    if (booted) return readSession(store, now);
    booted = true;
    var session = readSession(store, now);
    if (!session || !session.token) return session;
    var fetcher = typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null;
    if (!fetcher) return session;
    refresh(store, now, fetcher).then(function () { mountHeader(store); });
    return session;
  }

  function acceptLink(search, storage, now, fetcher) {
    var token = '';
    try { token = new URLSearchParams(search || '').get('token') || ''; }
    catch (err) { token = ''; }
    if (!token) return Promise.resolve({ kind: 'missing', line: 'Der Anmeldelink fehlt.' });
    return verify(storage, token, now, fetcher).then(function (session) {
      var name = session && session.player ? session.player.displayName : '';
      return {
        kind: 'ok',
        name: name,
        line: welcomeLine(name),
        href: returnPath(storage) || '/skat/'
      };
    }).catch(function (err) {
      return { kind: 'error', line: err.userMessage || messageFor(err.code) };
    });
  }

  return {
    SESSION_KEY: SESSION_KEY,
    PROBE_KEY: PROBE_KEY,
    RETURN_KEY: RETURN_KEY,
    validName: validName,
    validEmail: validEmail,
    readSession: readSession,
    signupBody: signupBody,
    requestLink: requestLink,
    verify: verify,
    refresh: refresh,
    logout: logout,
    accessFromMe: accessFromMe,
    gate: gate,
    finish: finish,
    hint: hint,
    openSignup: openSignup,
    signupMarkup: signupMarkup,
    sentMarkup: sentMarkup,
    welcomeLine: welcomeLine,
    headerHtml: headerHtml,
    rememberReturn: rememberReturn,
    returnPath: returnPath,
    acceptLink: acceptLink,
    messageFor: messageFor,
    probeUsed: probeUsed,
    boot: boot,
    mountHeader: mountHeader
  };
});
