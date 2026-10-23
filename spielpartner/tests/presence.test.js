'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const E = require('../../public/spielpartner/entitlement.js');
const Account = require('../../public/spielpartner/account.js');

const START = Date.parse('2026-10-23T09:00:00.000Z');

test('der erste Besuch bleibt, auch ohne Kampagne', () => {
  const storage = E.memoryStorage();
  const first = E.captureSource(storage, START, '', 'https://spiel-freunde.com/skat/');
  assert.equal(first.utmSource, null);
  assert.equal(first.referrerDomain, null);
  const second = E.captureSource(storage, START + 1000, '?utm_source=facebook&utm_campaign=skat-oktober', 'https://www.facebook.com/ads');
  assert.equal(second.utmSource, null);
  assert.equal(second.utmCampaign, null);
  assert.equal(second.referrerDomain, null);
});

test('utm und die Referrer-Domain gehen an Anmeldung und Herzschlag', () => {
  const storage = E.memoryStorage();
  const previous = global.window;
  global.window = { SpielpartnerEntitlement: E };
  try {
    E.captureSource(storage, START, '?utm_source=facebook&utm_medium=paid&utm_campaign=skat-oktober&utm_content=video', 'https://www.facebook.com/ads');
    E.captureSource(storage, START + 5000, '?utm_campaign=andere', 'https://google.com/');
    const source = E.readSource(storage);
    assert.equal(source.utmSource, 'facebook');
    assert.equal(source.utmMedium, 'paid');
    assert.equal(source.utmCampaign, 'skat-oktober');
    assert.equal(source.utmContent, 'video');
    assert.equal(source.referrerDomain, 'facebook.com');
    const id = E.clientId(storage);
    assert.equal(E.readClientId(storage), id);
    const body = Account.signupBody(storage, { email: 'helga@example.com', name: 'Helga' }, START);
    assert.equal(body.email, 'helga@example.com');
    assert.deepEqual(body.source, {
      utmSource: 'facebook',
      utmMedium: 'paid',
      utmCampaign: 'skat-oktober',
      utmContent: 'video',
      referrerDomain: 'facebook.com'
    });
    assert.equal(body.clientId, id);
    assert.equal(E.presenceBody(storage, '/skat/').game, 'skat');
    assert.equal(E.presenceBody(storage, '/').game, 'startseite');
    assert.equal(E.presenceBody(storage, '/tisch/').game, 'tisch');
    assert.equal(E.gameFromPath('/impressum.html'), '');
    assert.equal(E.PRESENCE_HEARTBEAT_MS, 60000);
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('der Herzschlag läuft nur im sichtbaren Spiel-Tab und nennt den Namen nicht', () => {
  const storage = E.memoryStorage();
  E.captureSource(storage, START, '?utm_source=facebook&utm_campaign=skat-oktober', '');
  storage.setItem('sf-account', JSON.stringify({ token: 'geheim', expiresAt: new Date(Date.now() + 60000).toISOString() }));
  const calls = [];
  const hidden = {
    visibilityState: 'hidden',
    addEventListener: function () {}
  };
  E.startPresence({
    document: hidden,
    fetch: function () { calls.push('hidden'); return Promise.resolve(); },
    storage: storage,
    base: E.BILLING_API_BASE,
    path: '/skat/'
  }).stop();
  assert.equal(calls.length, 0);

  let listener = null;
  const doc = {
    visibilityState: 'visible',
    addEventListener: function (name, fn) { if (name === 'visibilitychange') listener = fn; }
  };
  const handle = E.startPresence({
    document: doc,
    fetch: function (url, opts) {
      calls.push({ url: url, body: opts.body, headers: opts.headers });
      return Promise.resolve();
    },
    storage: storage,
    base: E.BILLING_API_BASE,
    path: '/skat/'
  });
  try {
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, E.BILLING_API_BASE + '/presence');
    const payload = JSON.parse(calls[0].body);
    assert.equal(payload.game, 'skat');
    assert.equal(payload.source.utmCampaign, 'skat-oktober');
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'displayName'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'email'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(payload, 'name'), false);
    assert.equal(calls[0].headers.Authorization, 'Bearer geheim');
    doc.visibilityState = 'hidden';
    listener();
    assert.equal(calls.length, 1);
  } finally {
    handle.stop();
  }

  doc.visibilityState = 'visible';
  const quiet = [];
  E.startPresence({
    document: doc,
    fetch: function () { quiet.push('legal'); return Promise.resolve(); },
    storage: storage,
    base: E.BILLING_API_BASE,
    path: '/impressum.html'
  }).stop();
  assert.equal(quiet.length, 0);

  const src = fs.readFileSync(path.join(__dirname, '../../public/spielpartner/entitlement.js'), 'utf8');
  assert.match(src, /api\.startPresence\(/);
  assert.match(src, /visibilityState === 'hidden'/);
  assert.doesNotMatch(src, /—|–/);
});

test('ein fehlender Presence-Server bleibt still', () => {
  const storage = E.memoryStorage();
  E.clientId(storage);
  const doc = {
    visibilityState: 'visible',
    addEventListener: function () {}
  };
  assert.doesNotThrow(() => {
    E.startPresence({
      document: doc,
      fetch: function () { throw new Error('netz'); },
      storage: storage,
      base: E.BILLING_API_BASE,
      path: '/skat/'
    }).stop();
  });
  const rejected = E.startPresence({
    document: doc,
    fetch: function () { return Promise.reject(new Error('nicht da')); },
    storage: storage,
    base: E.BILLING_API_BASE,
    path: '/maumau/'
  });
  rejected.stop();
  const missing = E.startPresence({
    document: doc,
    fetch: function () { return Promise.resolve({ ok: false, status: 404 }); },
    storage: storage,
    base: E.BILLING_API_BASE,
    path: '/skat/'
  });
  missing.stop();
});
