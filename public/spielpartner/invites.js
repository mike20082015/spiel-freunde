/*
 * Spieler empfehlen Spieler.
 * Dieselbe API-Basis und derselbe Bearer-Token wie das Spielerkonto.
 * GET /invites, POST /invites.
 *
 * Der Konto-Server (LeadMonster, /api/public/spiel-freunde) muss:
 *   - nur eine gültige Sitzung eines aktiven Spielers annehmen
 *   - höchstens 5 Einladungen je Spieler speichern
 *   - Selbst-Einladung und doppelte E-Mails ablehnen
 *   - die Mail mit den bestehenden Mail-Einstellungen schicken
 *   - den Link https://spiel-freunde.com/?invite=<token> setzen
 *   - 4 Wochen Premium je bezahlter Premium-Mitgliedschaft gutschreiben,
 *     stapelnd, über denselben Bonus wie das Community-Testing
 * Es gibt hier keine Schlüssel und keine neuen Umgebungsvariablen.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpielpartnerInvites = api;
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

  var OPEN_LIMIT = 5;
  var BONUS_WEEKS = 4;
  var MAX_WEEKS = OPEN_LIMIT * BONUS_WEEKS;
  var HEADLINE = 'Spiel mit Deinen Freunden und sichere Dir bis zu ' + MAX_WEEKS + ' Wochen Premium gratis';
  var GAMES = [
    ['skat', 'Skat', 'zum Skat'],
    ['doppelkopf', 'Doppelkopf', 'zum Doppelkopf'],
    ['schafkopf', 'Schafkopf', 'zum Schafkopf'],
    ['romme', 'Rommé', 'zum Rommé'],
    ['canasta', 'Canasta', 'zur Canasta'],
    ['schnapsen', 'Schnapsen', 'zum Schnapsen'],
    ['watten', 'Watten', 'zum Watten'],
    ['jass', 'Jass', 'zum Jass'],
    ['maumau', 'Mau-Mau', 'zum Mau-Mau'],
    ['schwimmen', 'Schwimmen', 'zum Schwimmen'],
    ['elfer-raus', 'Elfer raus', 'zum Elfer raus'],
    ['bridge', 'Bridge', 'zum Bridge']
  ];

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

  function gameById(id) {
    var key = String(id || '').trim().toLowerCase();
    if (key === 'mau-mau') key = 'maumau';
    if (key === 'elfer' || key === 'elfer_raus') key = 'elfer-raus';
    for (var i = 0; i < GAMES.length; i++) {
      if (GAMES[i][0] === key) return { id: GAMES[i][0], label: GAMES[i][1], phrase: GAMES[i][2] };
    }
    return null;
  }

  function gamePhrase(id) {
    var game = gameById(id);
    return game ? game.phrase : 'zum Skat';
  }

  function gameLabel(id) {
    var game = gameById(id);
    return game ? game.label : 'Skat';
  }

  function subjectLine(name, game) {
    var who = String(name || '').replace(/\s+/g, ' ').trim();
    if (!who) who = 'Jemand';
    return who + ' lädt Dich ' + gamePhrase(game) + ' ein';
  }

  function statusLabel(status) {
    if (status === 'signed_up') return 'Angemeldet';
    if (status === 'premium') return 'Premium';
    return 'Eingeladen';
  }

  function messageFor(code) {
    if (code === 'self_invite') return 'Dich selbst kannst Du nicht einladen.';
    if (code === 'duplicate_email') return 'Diese E-Mail wurde schon eingeladen.';
    if (code === 'already_registered') return 'Diese E-Mail hat schon ein Konto bei Spiel-Freunde.';
    if (code === 'invite_limit') return 'Du hast schon 5 Einladungen. Mehr gehen nicht.';
    if (code === 'player_inactive' || code === 'not_active') return 'Einladen kannst Du, sobald Dein Konto aktiv ist.';
    if (code === 'invalid_request' || code === 'invalid_email') return 'Prüfe Name und E-Mail.';
    if (code === 'unauthorized') return 'Die Anmeldung ist abgelaufen. Hol Dir einen neuen Link.';
    if (code === 'rate_limited') return 'Das war zu oft hintereinander. Warte einen Moment.';
    if (code === 'mail_failed' || code === 'mail_unavailable') return 'Die Mail ist gerade nicht rausgegangen. Versuch es noch einmal.';
    if (code === 'not_found') return 'Die Einladungen sind gerade noch nicht erreichbar. Versuch es später noch einmal.';
    if (code === 'netz') return 'Wir erreichen den Server gerade nicht. Versuch es gleich noch einmal.';
    return 'Das hat gerade nicht geklappt. Versuch es gleich noch einmal.';
  }

  function sameEmail(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  }

  function cleanName(value) {
    var Account = account();
    if (Account && typeof Account.validName === 'function') return Account.validName(value);
    var raw = String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (raw.length < 2 || raw.length > 24) return '';
    return raw;
  }

  function cleanEmail(value) {
    var Ent = entitlement();
    var email = Ent && typeof Ent.validEmail === 'function' ? Ent.validEmail(value) : String(value || '').trim();
    if (!email) return '';
    return email;
  }

  function normalizeStatus(value) {
    var status = String(value || '').trim().toLowerCase();
    if (status === 'signed_up' || status === 'registered' || status === 'angemeldet') return 'signed_up';
    if (status === 'premium' || status === 'paid' || status === 'subscribed') return 'premium';
    return 'invited';
  }

  function normalizeInvite(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var game = gameById(raw.game) || gameById('skat');
    var status = normalizeStatus(raw.status);
    var weeks = typeof raw.bonusWeeks === 'number' && isFinite(raw.bonusWeeks) ? Math.max(0, Math.round(raw.bonusWeeks)) : 0;
    if (status === 'premium' && weeks < BONUS_WEEKS && raw.bonusGranted !== false) weeks = Math.max(weeks, BONUS_WEEKS);
    return {
      id: raw.id == null ? '' : String(raw.id),
      name: String(raw.name || '').trim(),
      email: String(raw.email || '').trim(),
      game: game.id,
      status: status,
      createdAt: raw.createdAt || '',
      bonusGranted: raw.bonusGranted === true || (status === 'premium' && raw.bonusGranted !== false),
      bonusWeeks: weeks
    };
  }

  function normalizeList(body) {
    var raw = body && (body.invites || body.items);
    var list = [];
    if (raw && typeof raw.length === 'number') {
      for (var i = 0; i < raw.length; i++) {
        var item = normalizeInvite(raw[i]);
        if (item) list.push(item);
      }
    }
    var limit = body && typeof body.limit === 'number' && body.limit > 0 ? Math.floor(body.limit) : OPEN_LIMIT;
    return { invites: list, limit: limit };
  }

  function slotsLeft(items, limit) {
    var cap = typeof limit === 'number' && limit > 0 ? limit : OPEN_LIMIT;
    var used = items && items.length ? items.length : 0;
    return Math.max(0, cap - used);
  }

  function weeksEarned(items) {
    var sum = 0;
    if (!items) return 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].status === 'premium') sum += items[i].bonusWeeks || 0;
    }
    return sum;
  }

  function validateFriend(input, context) {
    var ctx = context || {};
    var name = cleanName(input && input.name);
    var email = cleanEmail(input && input.email);
    var game = gameById(input && input.game) || gameById('skat');
    if (!name || !email) return { ok: false, code: 'invalid_request' };
    if (ctx.selfEmail && sameEmail(email, ctx.selfEmail)) return { ok: false, code: 'self_invite' };
    var existing = ctx.existingEmails || [];
    for (var i = 0; i < existing.length; i++) {
      if (sameEmail(email, existing[i])) return { ok: false, code: 'duplicate_email' };
    }
    if (typeof ctx.slotsLeft === 'number' && ctx.slotsLeft < 1) return { ok: false, code: 'invite_limit' };
    return { ok: true, body: { name: name, email: email, game: game.id } };
  }

  function formatWhen(value) {
    var time = Date.parse(value);
    if (!isFinite(time)) return '';
    var date = new Date(time);
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return pad(date.getDate()) + '.' + pad(date.getMonth() + 1) + '.' + date.getFullYear();
  }

  function weeksLine(item) {
    if (!item || item.status !== 'premium') return '';
    if (!item.bonusGranted) return 'Premium ist da. Die Wochen werden gutgeschrieben.';
    var weeks = item.bonusWeeks || BONUS_WEEKS;
    if (weeks === 1) return '1 Woche Premium gutgeschrieben.';
    return weeks + ' Wochen Premium gutgeschrieben.';
  }

  function itemMarkup(item) {
    var html = '<li class="sf-report-item sf-invite-item">';
    html += '<div class="sf-report-meta">';
    html += '<span class="sf-report-status sf-invite-status" data-status="' + escapeText(item.status) + '">' + escapeText(statusLabel(item.status)) + '</span>';
    html += '<b>' + escapeText(item.name || 'Freund') + '</b>';
    if (item.email) html += '<span>' + escapeText(item.email) + '</span>';
    html += '</div>';
    html += '<p>' + escapeText(subjectLine(item.inviterName, item.game)) + '</p>';
    var when = formatWhen(item.createdAt);
    if (when) html += '<p>Eingeladen am ' + escapeText(when) + '.</p>';
    var bonus = weeksLine(item);
    if (bonus) html += '<p class="sf-invite-bonus">' + escapeText(bonus) + '</p>';
    html += '</li>';
    return html;
  }

  function listMarkup(items, inviterName) {
    if (!items || !items.length) {
      return '<p class="pw-lead" data-invite-empty>Noch keine Einladung. Trag oben den ersten Freund ein.</p>';
    }
    var html = '<ul class="sf-report-list" data-invite-list>';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      item.inviterName = inviterName;
      html += itemMarkup(item);
    }
    return html + '</ul>';
  }

  function summaryMarkup(items, limit) {
    var cap = typeof limit === 'number' && limit > 0 ? limit : OPEN_LIMIT;
    var used = items && items.length ? items.length : 0;
    var left = slotsLeft(items, cap);
    var earned = weeksEarned(items);
    var html = '<p class="sf-invite-summary" data-invite-summary>';
    html += 'Einladungen: ' + used + ' von ' + cap + '.';
    if (left === 0) html += ' Mehr gehen nicht.';
    else if (left === 1) html += ' Noch 1 frei.';
    else html += ' Noch ' + left + ' frei.';
    if (earned === 1) html += ' 1 Woche Premium ist gutgeschrieben.';
    else if (earned > 1) html += ' ' + earned + ' Wochen Premium sind gutgeschrieben.';
    html += '</p>';
    return html;
  }

  function gameOptions(selected) {
    var html = '';
    var current = gameById(selected) ? gameById(selected).id : 'skat';
    for (var i = 0; i < GAMES.length; i++) {
      var on = GAMES[i][0] === current ? ' selected' : '';
      html += '<option value="' + escapeText(GAMES[i][0]) + '"' + on + '>' + escapeText(GAMES[i][1]) + '</option>';
    }
    return html;
  }

  function formMarkup(state) {
    var view = state || {};
    var left = typeof view.slotsLeft === 'number' ? view.slotsLeft : OPEN_LIMIT;
    var name = view.inviterName || '';
    var game = view.game || 'skat';
    if (left < 1) {
      return '<p class="pw-lead" data-invite-full>Du hast schon ' + OPEN_LIMIT + ' Einladungen verschickt. Mehr gehen nicht.</p>';
    }
    return '<form class="invite-form" data-invite-form>' +
      '<div class="invite-row">' +
      '<label class="pw-field">Name<input data-invite-name type="text" autocomplete="name" maxlength="24" required placeholder="Wie Dein Freund heißt"></label>' +
      '<label class="pw-field">E-Mail<input data-invite-email type="email" autocomplete="email" inputmode="email" maxlength="200" required placeholder="freund@example.com"></label>' +
      '<label class="pw-field">Spiel<select data-invite-game>' + gameOptions(game) + '</select></label>' +
      '</div>' +
      '<p class="invite-preview" data-invite-preview>' + escapeText(subjectLine(name, game)) + '</p>' +
      '<p class="sf-hint">So steht es in der Betreffzeile. Der Link in der Mail ist nur für diese Person.</p>' +
      '<p class="pw-status" data-invite-status role="status"></p>' +
      '<button type="submit" class="btn btn-gold">Einladung schicken</button>' +
      '</form>';
  }

  function loginMarkup() {
    return '<form class="invite-form" data-invite-login>' +
      '<p class="pw-lead">Zum Einladen brauchst Du ein Konto. Wir schicken Dir einen Anmeldelink, kein Passwort nötig.</p>' +
      '<label class="pw-field">E-Mail<input data-email type="email" autocomplete="email" inputmode="email" maxlength="200" required placeholder="du@example.com"></label>' +
      '<label class="pw-field">Spielername<input data-name type="text" autocomplete="nickname" maxlength="24" required placeholder="Wie Du am Tisch heißt"></label>' +
      '<p class="pw-status" data-invite-status role="status"></p>' +
      '<button type="submit" class="btn btn-gold">Anmeldelink schicken</button>' +
      '</form>';
  }

  function sentMarkup(email) {
    return '<p class="pw-lead">Der Anmeldelink ist unterwegs' +
      (email ? ' an ' + escapeText(email) : '') +
      '. Danach kannst Du hier Deine Freunde einladen.</p>';
  }

  function appMarkup(state) {
    var view = state || {};
    if (!view.loggedIn) return loginMarkup();
    return summaryMarkup(view.invites, view.limit) +
      formMarkup(view) +
      '<h2>Deine Einladungen</h2>' +
      listMarkup(view.invites, view.inviterName);
  }

  function readBody(res) {
    if (!res) return Promise.reject(new Error('netz'));
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

  function authed(fetcher, method, url, token, body) {
    var headers = { 'Accept': 'application/json', 'Authorization': 'Bearer ' + token };
    var opts = { method: method, headers: headers };
    if (body != null) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return send(fetcher, url, opts);
  }

  function errorCode(result) {
    return result && result.body && result.body.error ? String(result.body.error) : '';
  }

  function fail(code, status) {
    var error = new Error(code || 'netz');
    error.code = code || 'netz';
    if (status) error.status = status;
    error.userMessage = messageFor(error.code);
    return error;
  }

  function sessionEmail(session) {
    if (!session) return '';
    if (session.player && session.player.email) return session.player.email;
    if (session.me && session.me.player && session.me.player.email) return session.me.player.email;
    return '';
  }

  function sessionName(session) {
    if (!session) return '';
    if (session.player && session.player.displayName) return session.player.displayName;
    if (session.me && session.me.player && session.me.player.displayName) return session.me.player.displayName;
    return '';
  }

  function listInvites(storage, fetcher) {
    var Account = account();
    var session = Account ? Account.readSession(storage, Date.now()) : null;
    if (!session || !session.token) return Promise.reject(fail('unauthorized'));
    return authed(fetcher, 'GET', apiBase() + '/invites', session.token).then(function (result) {
      if (result.status === 401) throw fail('unauthorized', 401);
      if (result.status === 404) throw fail('not_found', 404);
      if (!result.ok) throw fail(errorCode(result) || 'netz', result.status);
      return normalizeList(result.body);
    });
  }

  function createInvite(storage, input, fetcher) {
    var Account = account();
    var session = Account ? Account.readSession(storage, Date.now()) : null;
    if (!session || !session.token) return Promise.reject(fail('unauthorized'));
    return listInvites(storage, fetcher).then(function (current) {
      var emails = [];
      for (var i = 0; i < current.invites.length; i++) emails.push(current.invites[i].email);
      var check = validateFriend(input, {
        selfEmail: sessionEmail(session),
        existingEmails: emails,
        slotsLeft: slotsLeft(current.invites, current.limit)
      });
      if (!check.ok) throw fail(check.code);
      return authed(fetcher, 'POST', apiBase() + '/invites', session.token, check.body).then(function (result) {
        if (result.status === 401) throw fail('unauthorized', 401);
        if (result.status === 404) throw fail('not_found', 404);
        if (!result.ok) throw fail(errorCode(result) || 'netz', result.status);
        var created = normalizeInvite(result.body && (result.body.invite || result.body));
        return { invite: created, list: current };
      });
    });
  }

  function bindPreview(form, inviterName) {
    var select = form.querySelector('[data-invite-game]');
    var preview = form.querySelector('[data-invite-preview]');
    if (!select || !preview) return;
    var paint = function () { preview.textContent = subjectLine(inviterName, select.value); };
    select.addEventListener('change', paint);
    paint();
  }

  function paint(root, state) {
    if (!root) return;
    root.innerHTML = appMarkup(state);
  }

  function boot(doc, storage, fetcher) {
    var documentRef = doc;
    if (!documentRef && typeof document !== 'undefined') documentRef = document;
    var root = documentRef && documentRef.getElementById ? documentRef.getElementById('sf-invite-app') : null;
    if (!root) return null;
    var store = storageOf(storage);
    var fetchFn = fetcher;
    if (!fetchFn && typeof window !== 'undefined' && window.fetch) fetchFn = window.fetch.bind(window);
    var Account = account();
    var session = store && Account ? Account.readSession(store, Date.now()) : null;

    function showLogin() {
      paint(root, { loggedIn: false });
      var form = root.querySelector('[data-invite-login]');
      if (!form || !Account) return;
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var status = root.querySelector('[data-invite-status]');
        var button = form.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        Account.requestLink(store, {
          email: form.querySelector('[data-email]').value,
          name: form.querySelector('[data-name]').value,
          returnPath: '/freunde/'
        }, Date.now(), fetchFn).then(function (result) {
          root.innerHTML = sentMarkup(result.email);
        }).catch(function (err) {
          if (button) button.disabled = false;
          if (status) status.textContent = err.userMessage || messageFor(err.code);
        });
      });
    }

    if (!session) {
      showLogin();
      return null;
    }

    function renderList(list) {
      paint(root, {
        loggedIn: true,
        invites: list.invites,
        limit: list.limit,
        slotsLeft: slotsLeft(list.invites, list.limit),
        inviterName: sessionName(session),
        game: 'skat'
      });
      var form = root.querySelector('[data-invite-form]');
      if (!form) return;
      bindPreview(form, sessionName(session));
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var status = root.querySelector('[data-invite-status]');
        var button = form.querySelector('button[type="submit"]');
        if (button) button.disabled = true;
        if (status) status.textContent = 'Die Einladung geht raus …';
        createInvite(store, {
          name: form.querySelector('[data-invite-name]').value,
          email: form.querySelector('[data-invite-email]').value,
          game: form.querySelector('[data-invite-game]').value
        }, fetchFn).then(function () {
          return listInvites(store, fetchFn);
        }).then(function (next) {
          renderList(next);
          var note = root.querySelector('[data-invite-status]');
          if (note) note.textContent = 'Die Einladung ist unterwegs.';
        }).catch(function (err) {
          if (err && err.code === 'unauthorized' && Account) {
            Account.logout(store, Date.now(), fetchFn).then(showLogin);
            return;
          }
          if (button) button.disabled = false;
          if (status) status.textContent = (err && err.userMessage) || messageFor(err && err.code);
        });
      });
    }

    renderList({ invites: [], limit: OPEN_LIMIT });
    listInvites(store, fetchFn).then(renderList).catch(function (err) {
      var status = root.querySelector('[data-invite-status]');
      if (err && err.code === 'unauthorized' && Account) {
        Account.logout(store, Date.now(), fetchFn).then(showLogin);
        return;
      }
      if (status) status.textContent = (err && err.userMessage) || messageFor(err && err.code);
    });
    return session;
  }

  return {
    OPEN_LIMIT: OPEN_LIMIT,
    BONUS_WEEKS: BONUS_WEEKS,
    MAX_WEEKS: MAX_WEEKS,
    HEADLINE: HEADLINE,
    GAMES: GAMES,
    subjectLine: subjectLine,
    statusLabel: statusLabel,
    messageFor: messageFor,
    normalizeInvite: normalizeInvite,
    normalizeList: normalizeList,
    slotsLeft: slotsLeft,
    weeksEarned: weeksEarned,
    validateFriend: validateFriend,
    listMarkup: listMarkup,
    summaryMarkup: summaryMarkup,
    formMarkup: formMarkup,
    loginMarkup: loginMarkup,
    appMarkup: appMarkup,
    listInvites: listInvites,
    createInvite: createInvite,
    boot: boot
  };
});
