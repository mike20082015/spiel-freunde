/*
 * Spielerkonto im Browser.
 * Eine Proberunde ohne Konto. Danach reicht die E-Mail, der Server
 * schickt einen Anmeldecode und einen Anmeldelink. Der Name am Tisch
 * kommt aus dem Teil vor dem @, bis er später geändert werden kann.
 * Der Bearer-Token liegt in localStorage, kein Cookie.
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
  var shownAt = 0;

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

  function probeStillFree(storage, now) {
    var store = storageOf(storage);
    if (!store) return false;
    if (readSession(store, nowOf(now))) return false;
    return !probeUsed(store);
  }

  function nextPlayLabel(label, storage, now) {
    var playing = label ? String(label) : 'Nächstes Spiel';
    var store = storageOf(storage);
    if (!store) return playing;
    if (readSession(store, nowOf(now))) return playing;
    if (probeUsed(store)) return NEXT_LOCKED;
    return playing;
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

  function inviteCode(storage, now) {
    var Ent = entitlement();
    if (!Ent || typeof Ent.readInvite !== 'function') return '';
    try { return Ent.readInvite(storage, nowOf(now)) || ''; }
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
    var code = result && result.body && result.body.error ? String(result.body.error) : '';
    if (code) return code;
    if (result && result.status >= 500) return 'session_unavailable';
    return '';
  }

  function loginHref(value) {
    var href = String(value == null ? '' : value).trim();
    return href === '#' || href === '#anmelden';
  }

  function loginControl(node) {
    var current = node;
    if (current && current.nodeType !== 1) current = current.parentNode;
    while (current && current.nodeType === 1) {
      if (current.id === 'btn-anmelden') return current;
      if (current.classList && current.classList.contains('link-login')) {
        var href = current.getAttribute('href');
        if (href == null || loginHref(href)) return current;
      }
      current = current.parentNode;
    }
    return null;
  }

  function messageFor(code) {
    if (code === 'invalid_request') return 'Prüfe Deine E-Mail.';
    if (code === 'origin_not_allowed') return 'Die Anmeldung ist von hier gerade nicht erlaubt.';
    if (code === 'rate_limited') return 'Das war zu oft hintereinander. Warte einen Moment.';
    if (code === 'mail_failed' || code === 'mail_unavailable') return 'Die Mail ist gerade nicht rausgegangen. Versuch es noch einmal.';
    if (code === 'session_unavailable') return 'Die Anmeldung ist gerade nicht erreichbar. Du kannst weiter spielen.';
    if (code === 'invalid_token') return 'Dieser Anmeldelink gilt nicht.';
    if (code === 'token_expired') return 'Der Anmeldelink ist abgelaufen. Fordere einen neuen an.';
    if (code === 'token_used') return 'Dieser Anmeldelink wurde schon benutzt.';
    if (code === 'invalid_code') return 'Der Code ist falsch.';
    if (code === 'code_expired') return 'Der Code ist abgelaufen. Fordere einen neuen an.';
    if (code === 'code_used') return 'Der Code wurde schon benutzt. Fordere einen neuen an.';
    if (code === 'too_many_attempts') return 'Zu viele Versuche. Fordere einen neuen Code an.';
    if (code === 'unauthorized') return 'Die Anmeldung ist abgelaufen. Hol Dir einen neuen Link.';
    if (code === 'netz') return 'Wir erreichen den Server gerade nicht. Du kannst weiter spielen.';
    return 'Das hat gerade nicht geklappt. Du kannst weiter spielen.';
  }

  function nameFromEmail(email) {
    var local = String(email || '').split('@')[0].replace(/[._+\-]+/g, ' ');
    var name = validName(local);
    if (!name) return 'Freund';
    return name.replace(/\p{L}+/gu, function (word) {
      return word.charAt(0).toLocaleUpperCase('de') + word.slice(1);
    });
  }

  function signupBody(storage, input, now) {
    var email = validEmail(input && input.email);
    var rawName = input && input.name;
    var name = validName(rawName);
    if (!email || (rawName != null && String(rawName).trim() !== '' && !name)) {
      var error = new Error('invalid_request');
      error.code = 'invalid_request';
      throw error;
    }
    if (!name) name = nameFromEmail(email);
    var body = { email: email, name: name };
    var ref = partnerRef(storage, now);
    if (ref) body.ref = ref;
    var invite = inviteCode(storage, now);
    if (invite) body.invite = invite;
    var Ent = entitlement();
    if (Ent && typeof Ent.readSource === 'function') {
      var source = Ent.readSource(storage, now);
      if (source) {
        body.source = {
          utmSource: source.utmSource || null,
          utmMedium: source.utmMedium || null,
          utmCampaign: source.utmCampaign || null,
          utmContent: source.utmContent || null,
          referrerDomain: source.referrerDomain || null
        };
      }
    }
    if (Ent && typeof Ent.readClientId === 'function') {
      var clientId = Ent.readClientId(storage);
      if (clientId) body.clientId = clientId;
    }
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

  function digitsFrom(value) {
    var digits = String(value == null ? '' : value).replace(/\D/g, '');
    return digits.length === 6 ? digits : '';
  }

  function acceptSession(storage, result, now, fetcher, fallback) {
    if (!result.ok) {
      var code = errorCode(result) || fallback || 'invalid_token';
      var error = new Error(code);
      error.code = code;
      error.status = result.status;
      error.userMessage = messageFor(code);
      throw error;
    }
    var session = storeVerified(storage, result.body);
    return refresh(storage, now, fetcher).then(function () {
      var current = readSession(storage, now) || session;
      noteWillkommen(storage, current, result.body, now);
      showWillkommen(storage);
      return current;
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
      return acceptSession(storage, result, now, fetcher, 'invalid_token');
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

  function verifyCode(storage, input, now, fetcher) {
    var email = validEmail(input && input.email);
    var code = digitsFrom(input && input.code);
    if (!email || !code) {
      var missing = new Error('invalid_code');
      missing.code = 'invalid_code';
      missing.userMessage = messageFor('invalid_code');
      return Promise.reject(missing);
    }
    return post(fetcher, apiBase() + '/verify-code', { email: email, code: code }, '').then(function (result) {
      return acceptSession(storage, result, now, fetcher, 'invalid_code');
    }).catch(function (err) {
      if (err && err.message === 'netz') {
        markFailOpen(storage, now);
        logFail('Anmeldecode', err);
        err.code = 'netz';
        err.userMessage = messageFor('netz');
      }
      if (err && !err.userMessage) err.userMessage = messageFor(err.code || 'invalid_code');
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

  function bonusOn(me) {
    var Ent = entitlement();
    if (Ent && typeof Ent.bonusActive === 'function') return Ent.bonusActive(me);
    return !!(me && (me.entitlement === 'bonus' || (me.bonus && me.bonus.active)));
  }

  function bonusLine(me, now) {
    var Ent = entitlement();
    var left = null;
    if (Ent && typeof Ent.bonusFromMe === 'function' && typeof Ent.daysOfBonus === 'function') {
      left = Ent.daysOfBonus(Ent.bonusFromMe(me), nowOf(now));
    } else if (me && me.bonus && typeof me.bonus.daysLeft === 'number') {
      left = me.bonus.daysLeft;
    }
    if (Ent && typeof Ent.bonusHint === 'function') return Ent.bonusHint(left);
    if (left === 1) return 'Premium-Bonus läuft noch 1 Tag.';
    if (typeof left === 'number') return 'Premium-Bonus läuft noch ' + left + ' Tage.';
    return 'Dein Premium-Bonus läuft.';
  }

  function accessFromMe(me) {
    if (!me) return { ok: true, failOpen: true };
    var free = me.freeRounds || {};
    var trialOn = !!(me.trial && me.trial.active) || me.tier === 'trial';
    var bonus = bonusOn(me);
    if (free.unlimited || trialOn || bonus || me.tier === 'premium' || me.tier === 'standard') {
      return { ok: true, unlimited: true, bonus: bonus };
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

  var HORST_LINE = 'Schöne Runde! Melde Dich an, dann spielst Du 14 Tage kostenlos weiter, und Dein Punktestand bleibt.';
  var NEXT_LOCKED = 'Anmelden und weiterspielen';
  var MAIL_HINT = 'Falls die Mail fehlt, schau kurz in den Spam-Ordner.';

  function mailHintMarkup() {
    return '<p class="pw-spam">' + MAIL_HINT + '</p>';
  }

  function resendButton() {
    return '<button type="button" class="btn btn-gold pw-resend" data-resend>E-Mail erneut senden</button>' +
      '<p class="pw-status" data-resend-status role="status"></p>';
  }

  var LOCK_ICON = '<svg class="pw-lock" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function trustMarkup() {
    return '<p class="pw-trust">' + LOCK_ICON +
      '<span>Sichere Anmeldung per Link oder Code. Ohne Passwort, es wird keins gespeichert.</span></p>';
  }

  function horstMarkup() {
    return '<div class="pw-horst">' +
      '<img src="/media/spielpartner/horst.jpg" alt="Horst" width="72" height="72">' +
      '<p class="pw-horst-line">' + escapeText(HORST_LINE) + '</p>' +
      '</div>';
  }

  function signupMarkup() {
    return horstMarkup() +
      '<p class="pw-kicker">Eine Runde hast Du</p>' +
      '<h3 id="signup-title">Setz Dich richtig dazu</h3>' +
      '<p class="pw-lead">Wir schicken Dir einen Anmeldecode und einen Anmeldelink, kein Passwort nötig.</p>' +
      trustMarkup() +
      '<form data-signup>' +
      '<label class="pw-field">E-Mail' +
      '<input data-email type="email" autocomplete="email" inputmode="email" maxlength="200" required placeholder="du@example.com">' +
      '</label>' +
      '<button type="submit" class="btn btn-gold">Code schicken</button>' +
      '<p class="pw-status" data-status role="status"></p>' +
      '</form>' +
      mailHintMarkup() +
      '<div class="pw-actions"><button type="button" class="btn btn-ghost-dark" data-signup-close>Später</button></div>';
  }

  function standaloneNow() {
    try {
      var win = typeof window !== 'undefined' ? window : null;
      if (win && typeof win.matchMedia === 'function') {
        if (win.matchMedia('(display-mode: standalone)').matches) return true;
        if (win.matchMedia('(display-mode: fullscreen)').matches) return true;
      }
      if (win && win.navigator && win.navigator.standalone === true) return true;
      return false;
    } catch (err) {
      return false;
    }
  }

  function tokenFrom(value) {
    var raw = String(value == null ? '' : value).trim();
    if (!raw || raw.length > 2000) return '';
    var match = raw.match(/[?&#]token=([^&#\s]+)/i);
    if (match) {
      try { raw = decodeURIComponent(match[1]); }
      catch (err) { raw = match[1]; }
      raw = String(raw || '').trim();
    } else if (/^https?:\/\//i.test(raw) || raw.charAt(0) === '/') {
      return '';
    }
    if (!raw || /\s/.test(raw)) return '';
    return raw;
  }

  function pasteMarkup() {
    return '<form data-paste>' +
      '<p class="pw-lead">Tippe den Link in der Mail nicht an, wenn Du in der App bist. Sonst landet die Anmeldung im Browser. Kopiere den Link und füge ihn hier ein.</p>' +
      '<label class="pw-field">Anmeldelink' +
      '<input data-token type="text" autocomplete="off" spellcheck="false" maxlength="2000" placeholder="Link aus der Mail">' +
      '</label>' +
      '<button type="submit" class="btn btn-gold">Link einlösen</button>' +
      '<p class="pw-status" data-paste-status role="status"></p>' +
      '</form>';
  }

  function codeMarkup() {
    return '<form data-code>' +
      '<p class="pw-lead" id="code-title">Code aus der E-Mail eingeben</p>' +
      '<label class="pw-field pw-code">Anmeldecode' +
      '<input data-code-input type="text" inputmode="numeric" autocomplete="one-time-code" enterkeyhint="done" maxlength="16" spellcheck="false" placeholder="123 456">' +
      '</label>' +
      '<button type="submit" class="btn btn-gold">Code einlösen</button>' +
      '<p class="pw-status" data-code-status role="status"></p>' +
      '</form>';
  }

  function sentMarkup(email, options) {
    var standalone = !!(options && options.standalone);
    return '<p class="pw-kicker">Postfach</p>' +
      '<h3 id="signup-title">Der Link ist unterwegs</h3>' +
      '<p class="pw-lead">Schau in Dein Postfach' + (email ? ' bei ' + escapeText(email) : '') +
      '. Gib den Code hier ein. Der Link in der Mail geht auch.</p>' +
      trustMarkup() +
      codeMarkup() +
      mailHintMarkup() +
      resendButton() +
      (standalone ? pasteMarkup() : '') +
      '<div class="pw-actions"><button type="button" class="btn btn-ghost-dark" data-signup-close>Später</button></div>';
  }

  function bindCode(root, storage, fetcher, email, onOk) {
    if (!root) return;
    var form = root.querySelector('[data-code]');
    if (!form || form.getAttribute('data-bound') === '1') return;
    form.setAttribute('data-bound', '1');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = root.querySelector('[data-code-status]');
      var field = form.querySelector('[data-code-input]');
      var button = form.querySelector('button[type="submit"]');
      var typed = digitsFrom(field ? field.value : '');
      if (!typed) {
        if (status) status.textContent = 'Der Code hat sechs Ziffern.';
        return;
      }
      if (button) button.disabled = true;
      if (status) status.textContent = '';
      verifyCode(storage, { email: email, code: typed }, Date.now(), fetcher).then(function (session) {
        if (typeof onOk === 'function') onOk(session);
      }).catch(function (err) {
        if (button) button.disabled = false;
        if (status) status.textContent = (err && err.userMessage) || messageFor(err && err.code);
      });
    });
  }

  function bindResend(root, storage, fetcher, input) {
    var again = root.querySelector('[data-resend]');
    if (!again) return;
    again.addEventListener('click', function () {
      var status = root.querySelector('[data-resend-status]');
      again.disabled = true;
      if (status) status.textContent = '';
      requestLink(storage, input, Date.now(), fetcher).then(function () {
        again.disabled = false;
        if (status) status.textContent = 'Wir haben die Mail noch einmal geschickt.';
      }).catch(function (err) {
        again.disabled = false;
        if (status) status.textContent = (err && err.userMessage) || messageFor(err && err.code);
      });
    });
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
      if (event.target === modal) hideSignup(modal);
    });
    return modal;
  }

  function hideSignup(modal) {
    if (!modal) return;
    modal.hidden = true;
    paintSignupOpen(false);
  }

  function paintSignupOpen(open) {
    if (typeof document === 'undefined' || !document.body) return;
    if (open) {
      document.body.classList.add('sf-signup-offen');
      var dock = document.getElementById('zuschauen-dock');
      if (dock) dock.hidden = true;
      document.body.classList.remove('zuschauen-an');
    } else {
      document.body.classList.remove('sf-signup-offen');
    }
  }

  function track(type, storage) {
    var Ent = entitlement();
    if (!Ent || typeof Ent.trackEvent !== 'function') return;
    var fetchFn = null;
    var path = '/';
    try {
      var win = typeof window !== 'undefined' ? window : null;
      if (win && win.fetch) fetchFn = win.fetch.bind(win);
      if (win && win.location && win.location.pathname) path = win.location.pathname;
      else if (typeof location !== 'undefined' && location.pathname) path = location.pathname;
    } catch (err) { /* ohne Fenster */ }
    try { Ent.trackEvent(storage || storageOf(null), type, { fetch: fetchFn, path: path }); }
    catch (err) { /* Netz */ }
  }

  function speakHorst(modal) {
    if (!modal || !modal.querySelector || !modal.querySelector('.pw-horst')) return;
    var Stimmen = null;
    try { Stimmen = typeof window !== 'undefined' ? window.SpielpartnerStimmen : null; }
    catch (err) { Stimmen = null; }
    if (!Stimmen || typeof Stimmen.speak !== 'function') return;
    var pending;
    try { pending = Stimmen.speak('horst', HORST_LINE); }
    catch (err) { return; }
    if (!pending || typeof pending.then !== 'function') return;
    pending.then(function (url) {
      if (!url) return;
      try {
        var AudioRef = typeof Audio === 'function' ? Audio : null;
        if (!AudioRef && typeof window !== 'undefined') AudioRef = window.Audio;
        if (typeof AudioRef !== 'function') return;
        var audio = new AudioRef(url);
        var played = audio.play();
        if (played && typeof played.catch === 'function') played.catch(function () {});
      } catch (err) { /* der Text bleibt stehen */ }
    }).catch(function () {});
  }

  function nextControl() {
    if (typeof document === 'undefined' || !document.querySelectorAll) return null;
    var list = document.querySelectorAll('[data-a="next"], #btn-next, [data-next]');
    for (var i = 0; i < list.length; i++) {
      var node = list[i];
      if (node.closest && node.closest('[hidden]')) continue;
      return node;
    }
    return null;
  }

  function continueAtTable() {
    var button = nextControl();
    if (!button) return false;
    var playing = button.getAttribute('data-play-label');
    if (playing) button.textContent = playing;
    try { button.click(); }
    catch (err) { return false; }
    return true;
  }

  function bindSignup(modal, storage, fetcher) {
    var root = modal.querySelector('#signup-root');
    if (!root) return;
    root.innerHTML = signupMarkup();
    var form = root.querySelector('[data-signup]');
    var close = root.querySelector('[data-signup-close]');
    if (close) close.addEventListener('click', function () { hideSignup(modal); });
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = root.querySelector('[data-status]');
      var email = form.querySelector('[data-email]').value;
      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      requestLink(storage, { email: email }, Date.now(), fetcher).then(function (result) {
        root.innerHTML = sentMarkup(result.email, { standalone: standaloneNow() });
        var later = root.querySelector('[data-signup-close]');
        if (later) later.addEventListener('click', function () { hideSignup(modal); });
        bindResend(root, storage, fetcher, { email: result.email, name: result.name });
        var welcome = function (session) {
          var name = session && session.player ? session.player.displayName : '';
          var atTable = !!nextControl();
          root.innerHTML = '<p class="pw-kicker">Angemeldet</p>' +
            '<h3 id="signup-title">Willkommen</h3>' +
            '<p class="pw-lead">' + escapeText(welcomeLine(name)) +
            (atTable ? ' Dein Punktestand bleibt, Du spielst an diesem Tisch weiter.' : '') + '</p>' +
            '<div class="pw-actions"><button type="button" class="btn btn-ghost-dark" data-signup-close>' +
            (atTable ? 'Weiter spielen' : 'Weiter') + '</button></div>';
          var next = root.querySelector('[data-signup-close]');
          if (next) next.addEventListener('click', function () {
            hideSignup(modal);
            continueAtTable();
          });
          mountHeader(storage);
        };
        bindCode(root, storage, fetcher, result.email, welcome);
        bindPaste(root, storage, fetcher, welcome);
      }).catch(function (err) {
        if (button) button.disabled = false;
        if (status) status.textContent = err.userMessage || messageFor(err.code);
        if (err.code === 'netz' || err.code === 'session_unavailable') modal.hidden = false;
      });
    });
  }

  function revealSignup(modal) {
    if (!modal) return;
    modal.hidden = false;
    if (modal.removeAttribute) modal.removeAttribute('hidden');
    if (modal.style) modal.style.display = 'grid';
    paintSignupOpen(true);
    var card = modal.querySelector && modal.querySelector('.modal-card');
    if (card && typeof card.scrollIntoView === 'function') {
      try { card.scrollIntoView({ block: 'center' }); } catch (err) { /* altes Handy */ }
    }
    var stamp = Date.now();
    if (stamp - shownAt > 50) {
      shownAt = stamp;
      track('signup_prompt_shown', storageOf(null));
    }
    speakHorst(modal);
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
    if (!store || !fetchFn) {
      revealSignup(modal);
      var note = modal.querySelector('[data-status]');
      if (note) note.textContent = messageFor('session_unavailable');
      return false;
    }
    bindSignup(modal, store, fetchFn);
    revealSignup(modal);
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
            var reported = result.body || {};
            var mergedMe = Object.assign({}, session.me || {}, { freeRounds: reported.freeRounds });
            if (reported.entitlement) mergedMe.entitlement = reported.entitlement;
            if (reported.bonus) mergedMe.bonus = reported.bonus;
            if (bonusOn(session.me) || bonusOn(mergedMe)) {
              saveMe(storage, Object.assign({}, session.me || {}, mergedMe));
              return { paywall: false, bonus: true, roundId: roundId };
            }
            var next = Object.assign({}, session.me || {}, { freeRounds: reported.freeRounds });
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
      track('trial_finished', storage);
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
      if (bonusOn(me)) return bonusLine(me, moment);
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
      if (!probeUsed(storage)) return 'Diese eine Runde geht ohne Anmeldung. Die 14 Tage starten, sobald Du Dich anmeldest.';
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
    paintLoginLink(storage);
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
    try {
      if (typeof window !== 'undefined' && window.SpielpartnerReports && typeof window.SpielpartnerReports.mountListEntry === 'function') {
        window.SpielpartnerReports.mountListEntry();
      }
    } catch (err) { /* Liste kommt mit dem nächsten Laden */ }
  }

  function paintTableName(name) {
    if (!name || typeof document === 'undefined') return;
    var nodes = document.querySelectorAll('#me-name, #settings-ava-name');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = name;
    try { window.dispatchEvent(new CustomEvent('sf-avatar')); }
    catch (err) { /* alter Browser */ }
  }

  function willkommenApi() {
    try {
      if (typeof window !== 'undefined' && window.SpielpartnerWillkommen) return window.SpielpartnerWillkommen;
    } catch (err) { /* kein Fenster */ }
    return null;
  }

  function noteWillkommen(storage, session, body, now) {
    var W = willkommenApi();
    if (!W || typeof W.note !== 'function') return false;
    try { return !!W.note(storage, session, body, now); }
    catch (err) { return false; }
  }

  function showWillkommen(storage) {
    var W = willkommenApi();
    if (!W || typeof W.show !== 'function') return false;
    try { return !!W.show(storage); }
    catch (err) { return false; }
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

  function paintLoginLink(storage) {
    if (typeof document === 'undefined') return;
    var session = storage ? readSession(storage, Date.now()) : null;
    var on = !!(session && session.player && session.player.displayName);
    var links = document.querySelectorAll('#btn-anmelden, .link-login');
    for (var i = 0; i < links.length; i++) {
      if (!loginControl(links[i])) continue;
      if (on) links[i].setAttribute('hidden', '');
      else links[i].removeAttribute('hidden');
    }
  }

  function bindLogin(storage) {
    if (typeof document === 'undefined' || !document.documentElement) return;
    if (document.documentElement.getAttribute('data-sf-login') === '1') return;
    document.documentElement.setAttribute('data-sf-login', '1');
    var open = function (event) {
      if (!loginControl(event && event.target)) return;
      if (event && event.preventDefault) event.preventDefault();
      openSignup(storage);
    };
    document.addEventListener('click', open, true);
    var button = document.getElementById('btn-anmelden');
    if (button) button.addEventListener('click', open);
  }

  function boot(storage, now) {
    ensureCss();
    var store = storage;
    if (!store) {
      try { store = typeof localStorage !== 'undefined' ? localStorage : null; }
      catch (err) { store = null; }
    }
    bindLogin(store);
    if (!store) return null;
    paintLoginLink(store);
    mountHeader(store);
    showWillkommen(store);
    if (booted) return readSession(store, now);
    booted = true;
    var session = readSession(store, now);
    if (!session || !session.token) return session;
    var fetcher = typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null;
    if (!fetcher) return session;
    refresh(store, now, fetcher).then(function () { mountHeader(store); });
    return session;
  }

  function sessionResult(storage, session) {
    var name = session && session.player ? session.player.displayName : '';
    return {
      kind: 'ok',
      name: name,
      line: welcomeLine(name),
      href: returnPath(storage) || '/skat/'
    };
  }

  function acceptLink(search, storage, now, fetcher) {
    var token = '';
    try { token = new URLSearchParams(search || '').get('token') || ''; }
    catch (err) { token = ''; }
    if (!token) return Promise.resolve({ kind: 'missing', line: 'Der Anmeldelink fehlt.' });
    return verify(storage, token, now, fetcher).then(function (session) {
      return sessionResult(storage, session);
    }).catch(function (err) {
      return { kind: 'error', line: err.userMessage || messageFor(err.code) };
    });
  }

  function redeem(value, storage, now, fetcher) {
    var token = tokenFrom(value);
    if (!token) {
      return Promise.resolve({ kind: 'invalid', line: 'Das ist kein Anmeldelink. Kopiere den ganzen Link aus der Mail.' });
    }
    return verify(storage, token, now, fetcher).then(function (session) {
      return sessionResult(storage, session);
    }).catch(function (err) {
      return { kind: 'error', line: err.userMessage || messageFor(err.code) };
    });
  }

  function bindPaste(root, storage, fetcher, onOk) {
    if (!root) return;
    var form = root.querySelector('[data-paste]');
    if (!form || form.getAttribute('data-bound') === '1') return;
    form.setAttribute('data-bound', '1');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var status = root.querySelector('[data-paste-status]');
      var field = form.querySelector('[data-token]');
      var button = form.querySelector('button[type="submit"]');
      var token = tokenFrom(field ? field.value : '');
      if (!token) {
        if (status) status.textContent = 'Das ist kein Anmeldelink. Kopiere den ganzen Link aus der Mail.';
        return;
      }
      if (button) button.disabled = true;
      verify(storage, token, Date.now(), fetcher).then(function (session) {
        if (typeof onOk === 'function') onOk(session);
      }).catch(function (err) {
        if (button) button.disabled = false;
        if (status) status.textContent = (err && err.userMessage) || messageFor(err && err.code);
      });
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
    verifyCode: verifyCode,
    digitsFrom: digitsFrom,
    refresh: refresh,
    logout: logout,
    accessFromMe: accessFromMe,
    gate: gate,
    finish: finish,
    hint: hint,
    openSignup: openSignup,
    loginHref: loginHref,
    MAIL_HINT: MAIL_HINT,
    signupMarkup: signupMarkup,
    sentMarkup: sentMarkup,
    codeMarkup: codeMarkup,
    bindCode: bindCode,
    pasteMarkup: pasteMarkup,
    tokenFrom: tokenFrom,
    redeem: redeem,
    standaloneNow: standaloneNow,
    welcomeLine: welcomeLine,
    headerHtml: headerHtml,
    rememberReturn: rememberReturn,
    returnPath: returnPath,
    acceptLink: acceptLink,
    messageFor: messageFor,
    probeUsed: probeUsed,
    probeStillFree: probeStillFree,
    nextPlayLabel: nextPlayLabel,
    boot: boot,
    mountHeader: mountHeader
  };
});
