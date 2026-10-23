/* Anmeldecode neben dem Anmeldelink.
   Der Klartext des Codes und des Links steht nur in der Mail.
   Gespeichert wird der SHA-256-Hash. Ein Treffer über den Code oder
   den Link liefert denselben Sitzungsschlüssel und macht den anderen
   weg. Fünf falsche Versuche oder 15 Minuten machen den Code ungültig. */
'use strict';

var crypto = require('crypto');

var TTL_MS = 15 * 60 * 1000;
var MAX_ATTEMPTS = 5;
var RATE_LIMIT = 5;
var RATE_WINDOW_MS = 15 * 60 * 1000;
var ORIGIN = 'https://spiel-freunde.com';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

function sameHash(left, right) {
  if (!Buffer.isBuffer(left) || !Buffer.isBuffer(right) || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function randomCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function formatCode(code) {
  var digits = String(code || '').replace(/\D/g, '');
  if (digits.length !== 6) return '';
  return digits.slice(0, 3) + ' ' + digits.slice(3);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"]/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
  });
}

function mailFor(input) {
  var code = formatCode(input && input.code);
  var link = String(input && input.link || '');
  var name = String(input && input.name || '').trim();
  var hello = name ? 'Hallo ' + name + ',' : 'Hallo,';
  var text = [
    hello,
    '',
    'Dein Anmeldecode: ' + code,
    '',
    'Tippe den Code in der App ein. Er gilt 15 Minuten und nur einmal.',
    '',
    'Oder öffne diesen Link:',
    link,
    '',
    'Spiel-Freunde'
  ].join('\n');
  var html = '' +
    '<div style="font-family:Georgia,serif;color:#2a2420;background:#fffaf0;padding:28px 22px">' +
    '<p style="font-size:18px;margin:0 0 12px">' + escapeHtml(hello) + '</p>' +
    '<p style="font-size:16px;margin:0 0 8px">Dein Anmeldecode</p>' +
    '<p style="font-size:42px;letter-spacing:8px;font-weight:800;margin:0 0 18px">' + escapeHtml(code) + '</p>' +
    '<p style="font-size:16px;line-height:1.45;margin:0 0 16px">Tippe den Code in der App ein. Er gilt 15 Minuten und nur einmal.</p>' +
    '<p style="font-size:16px;margin:0 0 8px">Oder öffne diesen Link:</p>' +
    '<p style="font-size:16px;margin:0"><a href="' + escapeHtml(link) + '">' + escapeHtml(link) + '</a></p>' +
    '</div>';
  return {
    subject: 'Dein Anmeldecode für Spiel-Freunde',
    text: text,
    html: html
  };
}

function createAuth(options) {
  var opts = options || {};
  var ttl = opts.ttlMs || TTL_MS;
  var maxAttempts = opts.maxAttempts || MAX_ATTEMPTS;
  var rateLimit = opts.rateLimit || RATE_LIMIT;
  var rateWindow = opts.rateWindowMs || RATE_WINDOW_MS;
  var challenges = [];
  var hits = [];
  var seq = 0;
  var nextCode = opts.randomCode || randomCode;
  var nextToken = opts.randomToken || randomToken;
  var nextSession = opts.randomSession || function () { return 'sf1.' + randomToken(); };

  function stamp(now) {
    return now == null ? Date.now() : now;
  }

  function emailOf(value) {
    return String(value || '').trim().toLowerCase();
  }

  function fail(error) {
    return { ok: false, error: error };
  }

  function latestOpen(email, now) {
    var found = null;
    for (var i = 0; i < challenges.length; i++) {
      var row = challenges[i];
      if (row.email !== email || row.used) continue;
      if (!found || row.createdAt >= found.createdAt) found = row;
    }
    return found;
  }

  function sessionOf(row) {
    return {
      token: row.sessionToken,
      tokenType: 'Bearer',
      expiresAt: new Date(row.createdAt + 180 * 24 * 60 * 60 * 1000).toISOString(),
      player: {
        id: row.playerId,
        email: row.email,
        displayName: row.name
      }
    };
  }

  function request(input, now) {
    var moment = stamp(now);
    var email = emailOf(input && input.email);
    var name = String(input && input.name || '').trim();
    if (!email || !name) return fail('invalid_request');
    var recent = 0;
    for (var i = 0; i < hits.length; i++) {
      if (hits[i].email === email && moment - hits[i].at < rateWindow) recent += 1;
    }
    if (recent >= rateLimit) return fail('rate_limited');
    hits.push({ email: email, at: moment });
    for (var c = 0; c < challenges.length; c++) {
      if (challenges[c].email === email && !challenges[c].used) challenges[c].used = true;
    }
    var code = nextCode();
    var linkToken = nextToken();
    var sessionToken = nextSession();
    seq += 1;
    var row = {
      id: 'c' + seq,
      email: email,
      name: name,
      playerId: 'p' + seq,
      codeHash: sha256(email + '\n' + code),
      linkHash: sha256(linkToken),
      sessionToken: sessionToken,
      createdAt: moment,
      expiresAt: moment + ttl,
      attempts: 0,
      used: false
    };
    challenges.push(row);
    var link = ORIGIN + '/anmelden/?token=' + encodeURIComponent(linkToken);
    return {
      ok: true,
      email: email,
      mail: mailFor({ name: name, code: code, link: link }),
      linkToken: linkToken,
      code: code,
      record: {
        email: row.email,
        codeHash: row.codeHash.toString('hex'),
        linkHash: row.linkHash.toString('hex'),
        expiresAt: row.expiresAt,
        attempts: row.attempts
      }
    };
  }

  function verifyCode(input, now) {
    var moment = stamp(now);
    var email = emailOf(input && input.email);
    var digits = String(input && input.code || '').replace(/\D/g, '');
    if (!email || digits.length !== 6) return fail('invalid_code');
    var row = latestOpen(email, moment);
    if (!row) {
      var spent = false;
      for (var i = 0; i < challenges.length; i++) {
        if (challenges[i].email === email && challenges[i].used) spent = true;
      }
      return fail(spent ? 'code_used' : 'invalid_code');
    }
    if (moment > row.expiresAt) return fail('code_expired');
    if (row.attempts >= maxAttempts) return fail('too_many_attempts');
    if (!sameHash(row.codeHash, sha256(email + '\n' + digits))) {
      row.attempts += 1;
      return fail(row.attempts >= maxAttempts ? 'too_many_attempts' : 'invalid_code');
    }
    row.used = true;
    return { ok: true, session: sessionOf(row) };
  }

  function verifyLink(input, now) {
    var moment = stamp(now);
    var token = String(input && input.token || '').trim();
    if (!token) return fail('invalid_token');
    var hash = sha256(token);
    var row = null;
    for (var i = 0; i < challenges.length; i++) {
      if (sameHash(challenges[i].linkHash, hash)) row = challenges[i];
    }
    if (!row) return fail('invalid_token');
    if (row.used) return fail('token_used');
    if (moment > row.expiresAt) return fail('token_expired');
    row.used = true;
    return { ok: true, session: sessionOf(row) };
  }

  return {
    request: request,
    verifyCode: verifyCode,
    verifyLink: verifyLink
  };
}

module.exports = {
  TTL_MS: TTL_MS,
  MAX_ATTEMPTS: MAX_ATTEMPTS,
  RATE_LIMIT: RATE_LIMIT,
  formatCode: formatCode,
  mailFor: mailFor,
  createAuth: createAuth
};
