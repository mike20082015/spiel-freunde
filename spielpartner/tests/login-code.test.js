/* Anmeldecode: anfordern, einlösen, falsch, abgelaufen, schon benutzt.
   Aufruf: node --test spielpartner/tests/login-code.test.js */
const test = require('node:test');
const assert = require('assert');
const Auth = require('../auth/login-code.js');
const E = require('../../public/spielpartner/entitlement.js');
const Account = require('../../public/spielpartner/account.js');

const START = 1700000000000;
const DAY = 24 * 60 * 60 * 1000;

function jsonResponse(status, body) {
  return {
    status: status,
    ok: status >= 200 && status < 300,
    json: async () => body
  };
}

function trialMe(name) {
  return {
    player: { id: 'p1', email: 'helga@example.com', displayName: name, createdAt: new Date(START).toISOString() },
    trial: { startedAt: new Date(START).toISOString(), endsAt: START + 14 * DAY, active: true, daysLeft: 14 },
    tier: 'trial',
    license: null,
    daysLeft: 14,
    freeRounds: { limit: null, used: 0, remaining: null, unlimited: true, day: '2023-11-14' }
  };
}

function harness(auth, clock) {
  const box = { mail: null, code: '', linkToken: '' };
  const fetcher = async (url, opts) => {
    const path = url.slice(E.BILLING_API_BASE.length);
    const body = opts && opts.body ? JSON.parse(opts.body) : {};
    if (path === '/signup-or-login') {
      assert.equal(body.code, undefined);
      const issued = auth.request({ email: body.email, name: body.name }, clock.now);
      if (!issued.ok) return jsonResponse(429, { error: issued.error });
      box.mail = issued.mail;
      box.code = issued.code;
      box.linkToken = issued.linkToken;
      assert.equal(JSON.stringify({ ok: true }).includes(issued.code), false);
      assert.equal(issued.record.codeHash === issued.code, false);
      assert.equal(Object.prototype.hasOwnProperty.call(issued.record, 'code'), false);
      return jsonResponse(200, { ok: true });
    }
    if (path === '/verify-code') {
      const result = auth.verifyCode({ email: body.email, code: body.code }, clock.now);
      if (!result.ok) return jsonResponse(400, { error: result.error });
      return jsonResponse(200, result.session);
    }
    if (path === '/verify') {
      const result = auth.verifyLink({ token: body.token }, clock.now);
      if (!result.ok) return jsonResponse(400, { error: result.error });
      return jsonResponse(200, result.session);
    }
    if (path === '/me') return jsonResponse(200, trialMe('Helga'));
    throw new Error('unbekannt ' + path);
  };
  return { fetcher: fetcher, box: box };
}

function withWindow(fn) {
  const previous = global.window;
  global.window = { SpielpartnerEntitlement: E };
  return Promise.resolve().then(fn).finally(() => {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  });
}

test('die Mail zeigt den Code groß und der Link bleibt', () => {
  const mail = Auth.mailFor({
    name: 'Helga',
    code: '123456',
    link: 'https://spiel-freunde.com/anmelden/?token=einmal'
  });
  assert.equal(Auth.formatCode('123456'), '123 456');
  assert.match(mail.text, /Dein Anmeldecode: 123 456/);
  assert.match(mail.text, /https:\/\/spiel-freunde\.com\/anmelden\/\?token=einmal/);
  assert.match(mail.html, /font-size:42px/);
  assert.match(mail.html, /123 456/);
  assert.match(mail.html, /token=einmal/);
  assert.doesNotMatch(mail.text + mail.html, /—|–/);
  assert.equal(Auth.TTL_MS, 15 * 60 * 1000);
  assert.equal(Auth.MAX_ATTEMPTS, 5);
});

test('Code und Link liefern denselben Schlüssel und löschen einander', async () => {
  const clock = { now: START };
  const auth = Auth.createAuth({
    randomCode: () => '482913',
    randomToken: () => 'link-einmal',
    randomSession: () => 'sf1.gemeinsam'
  });
  const gate = harness(auth, clock);
  await withWindow(async () => {
    const storage = E.memoryStorage();
    const asked = await Account.requestLink(storage, {
      email: 'helga@example.com',
      name: 'Helga'
    }, clock.now, gate.fetcher);
    assert.equal(asked.ok, true);
    assert.match(gate.box.mail.text, /Dein Anmeldecode: 482 913/);
    assert.match(gate.box.mail.html, /482 913/);
    assert.match(gate.box.mail.text, /token=/);
    const session = await Account.verifyCode(storage, {
      email: 'helga@example.com',
      code: '482 913'
    }, clock.now, gate.fetcher);
    assert.equal(session.token, 'sf1.gemeinsam');
    assert.equal(session.player.displayName, 'Helga');
    assert.equal(Account.readSession(storage, clock.now).token, 'sf1.gemeinsam');
    await assert.rejects(
      () => Account.verify(storage, gate.box.linkToken, clock.now, gate.fetcher),
      (err) => err.code === 'token_used'
    );
    await assert.rejects(
      () => Account.verifyCode(storage, { email: 'helga@example.com', code: '482913' }, clock.now, gate.fetcher),
      (err) => err.code === 'code_used' && /schon benutzt/.test(err.userMessage)
    );
  });

  const again = Auth.createAuth({
    randomCode: () => '482913',
    randomToken: () => 'link-einmal',
    randomSession: () => 'sf1.gemeinsam'
  });
  const viaLink = again.verifyLink({ token: 'link-einmal' }, START);
  assert.equal(viaLink.ok, false);
  const opened = again.request({ email: 'helga@example.com', name: 'Helga' }, START);
  const linked = again.verifyLink({ token: opened.linkToken }, START);
  assert.equal(linked.ok, true);
  assert.equal(linked.session.token, 'sf1.gemeinsam');
  const afterLink = again.verifyCode({ email: 'helga@example.com', code: opened.code }, START);
  assert.equal(afterLink.ok, false);
  assert.equal(afterLink.error, 'code_used');
});

test('fünf falsche Versuche, ein abgelaufener Code und eine neue Anforderung', async () => {
  const clock = { now: START };
  const auth = Auth.createAuth({ randomCode: () => '111222' });
  const gate = harness(auth, clock);
  await withWindow(async () => {
    const storage = E.memoryStorage();
    await Account.requestLink(storage, { email: 'helga@example.com', name: 'Helga' }, clock.now, gate.fetcher);
    for (let i = 0; i < 4; i++) {
      await assert.rejects(
        () => Account.verifyCode(storage, { email: 'helga@example.com', code: '000000' }, clock.now, gate.fetcher),
        (err) => err.code === 'invalid_code' && err.userMessage === 'Der Code ist falsch.'
      );
    }
    await assert.rejects(
      () => Account.verifyCode(storage, { email: 'helga@example.com', code: '000000' }, clock.now, gate.fetcher),
      (err) => err.code === 'too_many_attempts' && /Zu viele Versuche/.test(err.userMessage)
    );
    await assert.rejects(
      () => Account.verifyCode(storage, { email: 'helga@example.com', code: '111222' }, clock.now, gate.fetcher),
      (err) => err.code === 'too_many_attempts'
    );

    const fresh = Auth.createAuth({ randomCode: () => '333444' });
    const freshGate = harness(fresh, clock);
    await Account.requestLink(storage, { email: 'helga@example.com', name: 'Helga' }, clock.now, freshGate.fetcher);
    clock.now = START + Auth.TTL_MS + 1;
    await assert.rejects(
      () => Account.verifyCode(storage, { email: 'helga@example.com', code: '333444' }, clock.now, freshGate.fetcher),
      (err) => err.code === 'code_expired' && /abgelaufen/.test(err.userMessage)
    );

    const limited = Auth.createAuth({ randomCode: () => '555666' });
    for (let n = 0; n < Auth.RATE_LIMIT; n++) {
      assert.equal(limited.request({ email: 'helga@example.com', name: 'Helga' }, START).ok, true);
    }
    assert.equal(limited.request({ email: 'helga@example.com', name: 'Helga' }, START).error, 'rate_limited');
  });
});
