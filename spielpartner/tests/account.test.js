/* Konto, Proberunde, Anmeldelink. Aufruf: node --test spielpartner/tests */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../../public/spielpartner/entitlement.js');
const Account = require('../../public/spielpartner/account.js');
const Rounds = require('../../public/spielpartner/rounds.js');

const START = 1700000000000;
const DAY = 24 * 60 * 60 * 1000;

function jsonResponse(status, body) {
  return {
    status: status,
    ok: status >= 200 && status < 300,
    json: async () => body
  };
}

function trialMe(name, daysLeft) {
  return {
    player: { id: 'p1', email: 'helga@example.com', displayName: name, createdAt: new Date(START).toISOString() },
    trial: {
      startedAt: new Date(START).toISOString(),
      endsAt: START + daysLeft * DAY,
      active: true,
      daysLeft: daysLeft
    },
    tier: 'trial',
    license: null,
    daysLeft: daysLeft,
    freeRounds: { limit: null, used: 0, remaining: null, unlimited: true, day: '2023-11-14' }
  };
}

function freeMe(remaining) {
  return {
    player: { id: 'p1', email: 'helga@example.com', displayName: 'Helga', createdAt: new Date(START).toISOString() },
    trial: { startedAt: new Date(START).toISOString(), endsAt: START, active: false, daysLeft: 0 },
    tier: 'free',
    license: null,
    daysLeft: 0,
    freeRounds: { limit: 3, used: 3 - remaining, remaining: remaining, unlimited: false, day: '2023-11-29' }
  };
}

function seedSession(storage, me) {
  storage.setItem(Account.SESSION_KEY, JSON.stringify({
    token: 'sf1.test',
    tokenType: 'Bearer',
    expiresAt: START + 180 * DAY,
    player: me.player,
    me: me
  }));
}

test('Tische rufen gate() ohne Speicher auf und treffen trotzdem die Proberunde', () => {
  const storage = E.memoryStorage();
  const previousWindow = global.window;
  const previousStorage = global.localStorage;
  global.localStorage = storage;
  global.window = {
    localStorage: storage,
    SpielpartnerEntitlement: E,
    SpielpartnerPaywall: { open() {} },
    SpielpartnerAccount: Account
  };
  try {
    storage.setItem(Account.PROBE_KEY, '1');
    assert.strictEqual(Account.gate(undefined, START), false);
    assert.strictEqual(Rounds.gate(undefined, START), false);
    assert.match(Account.hint(undefined, START), /Melde Dich an/);
  } finally {
    global.window = previousWindow;
    if (previousStorage === undefined) delete global.localStorage;
    else global.localStorage = previousStorage;
  }
});

test('Proberunde, dann die Anmeldekarte, kein lokaler 14-Tage-Test', () => {
  const storage = E.memoryStorage();
  const previous = global.window;
  let paywall = 0;
  global.window = {
    SpielpartnerEntitlement: E,
    SpielpartnerPaywall: { open() { paywall += 1; } },
    SpielpartnerAccount: Account
  };
  try {
    assert.strictEqual(Rounds.gate(storage, START), true);
    const done = Rounds.finish(storage, START);
    assert.strictEqual(done.proberunde, true);
    assert.strictEqual(done.signup, true);
    assert.strictEqual(E.load(storage).trialEndsAt, null);
    assert.strictEqual(Rounds.gate(storage, START + 1), false);
    assert.strictEqual(paywall, 0);
    assert.match(Account.signupMarkup(), /Wir schicken Dir einen Anmeldecode und einen Anmeldelink, kein Passwort nötig/);
    assert.match(Account.signupMarkup(), /Sichere Anmeldung per Link oder Code\. Ohne Passwort, es wird keins gespeichert\./);
    assert.match(Account.signupMarkup(), /<svg/);
    assert.doesNotMatch(Account.signupMarkup(), /—|–|absolut sicher/);
    assert.match(Account.signupMarkup(), /E-Mail/);
    assert.match(Account.signupMarkup(), /Code schicken/);
    assert.match(Account.signupMarkup(), /Schöne Runde! Melde Dich an/);
    assert.doesNotMatch(Account.signupMarkup(), /Spielername/);
    assert.doesNotMatch(Account.signupMarkup(), /data-name/);
    assert.match(Account.signupMarkup(), /Falls die Mail fehlt, schau kurz in den Spam-Ordner/);
    assert.match(Account.sentMarkup('helga@example.com'), /Der Link ist unterwegs/);
    assert.match(Account.sentMarkup('helga@example.com'), /helga@example.com/);
    assert.match(Account.sentMarkup('helga@example.com'), /E-Mail erneut senden/);
    assert.match(Account.sentMarkup('helga@example.com'), /data-resend/);
    assert.match(Account.sentMarkup('helga@example.com'), /Code aus der E-Mail eingeben/);
    assert.match(Account.sentMarkup('helga@example.com'), /es wird keins gespeichert/);
    assert.match(Account.sentMarkup('helga@example.com'), /inputmode="numeric"/);
    assert.match(Account.sentMarkup('helga@example.com'), /autocomplete="one-time-code"/);
    assert.match(Account.sentMarkup('helga@example.com'), /Gib den Code hier ein/);
    assert.match(Account.sentMarkup('helga@example.com'), /Falls die Mail fehlt, schau kurz in den Spam-Ordner/);
    assert.doesNotMatch(Account.sentMarkup('helga@example.com'), /data-paste/);
    assert.equal(Account.digitsFrom('123 456'), '123456');
    assert.equal(Account.digitsFrom('123456'), '123456');
    assert.equal(Account.digitsFrom('12345'), '');
    assert.equal(Account.messageFor('invalid_code'), 'Der Code ist falsch.');
    assert.equal(Account.messageFor('code_expired'), 'Der Code ist abgelaufen. Fordere einen neuen an.');
    assert.equal(Account.messageFor('too_many_attempts'), 'Zu viele Versuche. Fordere einen neuen Code an.');
    assert.equal(Account.messageFor('code_used'), 'Der Code wurde schon benutzt. Fordere einen neuen an.');
    assert.equal(Account.MAIL_HINT, 'Falls die Mail fehlt, schau kurz in den Spam-Ordner.');
    assert.doesNotMatch(Account.MAIL_HINT, /—|–/);
    const inApp = Account.sentMarkup('helga@example.com', { standalone: true });
    assert.match(inApp, /Link einlösen/);
    assert.match(inApp, /Tippe den Link in der Mail nicht an/);
    assert.doesNotMatch(inApp, /—/);
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('ein Gateway-Fehler ist nicht eine falsche E-Mail', async () => {
  const storage = E.memoryStorage();
  const previous = global.window;
  global.window = { SpielpartnerEntitlement: E };
  try {
    await assert.rejects(
      () => Account.requestLink(storage, { email: 'helga@example.com', name: 'Helga' }, START, async () => ({
        status: 504,
        ok: false,
        json: async () => { throw new Error('html'); }
      })),
      (err) => err.code === 'session_unavailable' && /nicht erreichbar/.test(err.userMessage)
    );
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('Anmelden auf der Startseite öffnet die Karte und bleibt auf dem Handy sichtbar', () => {
  assert.strictEqual(Account.loginHref('#anmelden'), true);
  assert.strictEqual(Account.loginHref('#'), true);
  assert.strictEqual(Account.loginHref('/#preise'), false);
  const home = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../../public/assets/style.css'), 'utf8');
  const card = fs.readFileSync(path.join(__dirname, '../../public/spielpartner/account.css'), 'utf8');
  const account = fs.readFileSync(path.join(__dirname, '../../public/spielpartner/account.js'), 'utf8');
  assert.match(home, /<button type="button" class="link-login" id="btn-anmelden">Anmelden<\/button>/);
  assert.match(home, /href="\/skat\/">Jetzt eine Runde spielen</);
  assert.match(home, /Eine Runde sofort spielen, dann 14 Tage kostenlos per E-Mail/);
  assert.doesNotMatch(home, /14 Tage kostenlos spielen/);
  assert.doesNotMatch(css, /\.nav-links,\s*\.link-login\{display:\s*none\}/);
  assert.match(css, /@media \(max-width:860px\)\{\s*\.nav-links\{display:none\}/);
  assert.match(account, /getElementById\('btn-anmelden'\)/);
  assert.match(account, /addEventListener\('click', open, true\)/);
  assert.match(card, /#modal-signup/);
  assert.match(card, /#modal-signup\[hidden\]\{display:none !important\}/);
  assert.doesNotMatch(home + css + card, /—/);
  assert.match(home, /Sichere Anmeldung ohne Passwort/);
  assert.match(home, /Du bekommst einen Link und einen Code per E-Mail\. Es gibt kein Passwort, das gestohlen werden könnte\./);
  assert.match(home, /<summary>Brauche ich ein Passwort\?<\/summary>/);
  assert.doesNotMatch(home, /absolut sicher/);
});

test('Anmeldelink schickt den gespeicherten Empfehlungscode mit', async () => {
  const storage = E.memoryStorage();
  const previous = global.window;
  global.window = { SpielpartnerEntitlement: E };
  E.captureRef(storage, START, '?ref=tisch42');
  let sent = null;
  try {
    const body = Account.signupBody(storage, { email: ' Helga@Example.com ', name: '  Helga  ' }, START);
    assert.deepStrictEqual(body, { email: 'Helga@Example.com', name: 'Helga', ref: 'tisch42' });
    const result = await Account.requestLink(storage, { email: 'helga@example.com', name: 'Helga', returnPath: '/skat/' }, START, async (url, opts) => {
      sent = { url: url, body: JSON.parse(opts.body) };
      return jsonResponse(200, { ok: true });
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(sent.url, E.BILLING_API_BASE + '/signup-or-login');
    assert.deepStrictEqual(sent.body, { email: 'helga@example.com', name: 'Helga', ref: 'tisch42' });
    assert.strictEqual(Account.returnPath(storage), '/skat/');
    assert.equal(JSON.stringify(sent.body).includes('sf-ref'), false);
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('verify speichert den Bearer-Token und begrüßt mit den 14 Testtagen', async () => {
  const storage = E.memoryStorage();
  const previous = global.window;
  global.window = { SpielpartnerEntitlement: E };
  storage.setItem(Account.RETURN_KEY, '/canasta/');
  const me = trialMe('Helga', 14);
  try {
    const result = await Account.acceptLink('?token=einmal', storage, START, async (url, opts) => {
      const path = url.slice(E.BILLING_API_BASE.length);
      if (path === '/verify') {
        assert.deepStrictEqual(JSON.parse(opts.body), { token: 'einmal' });
        assert.equal(opts.headers.Authorization, undefined);
        return jsonResponse(200, {
          token: 'sf1.session',
          tokenType: 'Bearer',
          expiresAt: new Date(Date.now() + 180 * DAY).toISOString(),
          player: { id: 'p1', email: 'helga@example.com', displayName: 'Helga' }
        });
      }
      assert.strictEqual(path, '/me');
      assert.strictEqual(opts.headers.Authorization, 'Bearer sf1.session');
      return jsonResponse(200, me);
    });
    assert.strictEqual(result.kind, 'ok');
    assert.strictEqual(result.line, 'Willkommen, Helga! Deine 14 Testtage laufen.');
    assert.strictEqual(result.href, '/canasta/');
    const session = Account.readSession(storage, START);
    assert.strictEqual(session.token, 'sf1.session');
    assert.strictEqual(session.tokenType, 'Bearer');
    assert.strictEqual(session.me.tier, 'trial');
    const src = fs.readFileSync(path.join(__dirname, '../../public/spielpartner/account.js'), 'utf8');
    assert.equal(src.includes('cookie'), false);
    assert.match(Account.headerHtml('Helga'), /Helga/);
    assert.match(Account.headerHtml('Helga'), /Abmelden/);
    const view = E.describe(E.load(storage), START + DAY);
    assert.strictEqual(view.phase, 'trial');
    assert.strictEqual(E.isUnlocked('premium', E.load(storage), START + DAY), true);
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('im Test zählt der Server keine Sperre, danach 403 free_round_limit', async () => {
  const storage = E.memoryStorage();
  const previous = global.window;
  let paywall = 0;
  global.window = {
    SpielpartnerEntitlement: E,
    SpielpartnerPaywall: { open() { paywall += 1; } },
    SpielpartnerAccount: Account
  };
  seedSession(storage, trialMe('Helga', 14));
  let posts = 0;
  const fetcher = async (url) => {
    posts += 1;
    assert.ok(url.endsWith('/rounds'));
    return jsonResponse(201, { ok: true, duplicate: false, freeRounds: trialMe('Helga', 14).freeRounds });
  };
  try {
    for (let n = 0; n < 4; n++) {
      assert.strictEqual(Rounds.gate(storage, START + n), true, 'runde ' + n);
      const done = Account.finish(storage, START + n, fetcher);
      const settled = await done.pending;
      assert.strictEqual(settled.paywall, false);
    }
    assert.strictEqual(posts, 4);
    assert.strictEqual(paywall, 0);

    seedSession(storage, freeMe(0));
    assert.strictEqual(Rounds.gate(storage, START + 20 * DAY), false);
    assert.strictEqual(paywall, 1);

    seedSession(storage, freeMe(1));
    assert.strictEqual(Account.gate(storage, START + 20 * DAY), true);
    const blocked = await Account.finish(storage, START + 20 * DAY, async () => jsonResponse(403, {
      error: 'free_round_limit',
      freeRounds: { limit: 3, used: 3, remaining: 0, unlimited: false, day: '2023-11-29' }
    })).pending;
    assert.strictEqual(blocked.paywall, true);
    assert.strictEqual(blocked.error, 'free_round_limit');
    assert.strictEqual(Account.gate(storage, START + 20 * DAY), false);
    assert.strictEqual(paywall, 3);
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('unerreichbare API lässt weiter spielen und schreibt eine Zeile', async () => {
  const storage = E.memoryStorage();
  const previous = global.window;
  const logs = [];
  const warn = console.warn;
  console.warn = function () { logs.push(Array.prototype.join.call(arguments, ' ')); };
  global.window = { SpielpartnerEntitlement: E, SpielpartnerAccount: Account };
  seedSession(storage, freeMe(0));
  try {
    const done = await Account.finish(storage, START, async () => { throw new Error('offline'); }).pending;
    assert.strictEqual(done.failOpen, true);
    assert.match(logs.join('\n'), /Spiel-Freunde/);
    assert.strictEqual(Account.gate(storage, START), true);
  } finally {
    console.warn = warn;
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('jedes Spiel lädt das Konto neben dem Rundenzähler', () => {
  const games = ['skat', 'canasta', 'schafkopf', 'jass', 'doppelkopf', 'maumau', 'romme', 'schwimmen', 'elfer-raus', 'schnapsen', 'watten', 'bridge'];
  games.forEach((game) => {
    const page = fs.readFileSync(path.join(__dirname, '../../public', game, 'index.html'), 'utf8');
    assert.match(page, /\/spielpartner\/account\.js/, game);
    assert.match(page, /\/spielpartner\/account\.css/, game);
  });
  const anmelden = fs.readFileSync(path.join(__dirname, '../../public/anmelden/index.html'), 'utf8');
  assert.match(anmelden, /account\.js/);
  assert.match(anmelden, /anmelden\.js/);
  assert.match(anmelden, /Ein Angebot der Interconsult LLC/);
  const pageJs = fs.readFileSync(path.join(__dirname, '../../public/anmelden/anmelden.js'), 'utf8');
  assert.match(pageJs, /acceptLink/);
  assert.match(pageJs, /redeem/);
  assert.match(anmelden, /id="anmelden-paste"/);
  assert.match(anmelden, /Link einlösen/);
  assert.doesNotMatch(anmelden, /—/);
  assert.doesNotMatch(pageJs, /—/);
});

test('ein eingefügter Anmeldelink gilt in der App, eine fremde Adresse nicht', async () => {
  const storage = E.memoryStorage();
  const previous = global.window;
  global.window = { SpielpartnerEntitlement: E };
  storage.setItem(Account.RETURN_KEY, '/mein-avatar/');
  try {
    assert.strictEqual(Account.tokenFrom(' https://spiel-freunde.com/anmelden/?token=einmal '), 'einmal');
    assert.strictEqual(Account.tokenFrom('/anmelden/?foo=1&token=abc%2Fdef'), 'abc/def');
    assert.strictEqual(Account.tokenFrom('roh-token'), 'roh-token');
    assert.strictEqual(Account.tokenFrom('https://spiel-freunde.com/anmelden/'), '');
    assert.strictEqual(Account.tokenFrom(''), '');
    const missing = await Account.redeem('https://example.com/', storage, START, async () => {
      throw new Error('soll nicht fragen');
    });
    assert.strictEqual(missing.kind, 'invalid');
    const result = await Account.redeem('https://spiel-freunde.com/anmelden/?token=einmal', storage, START, async (url, opts) => {
      const path = url.slice(E.BILLING_API_BASE.length);
      if (path === '/verify') {
        assert.deepStrictEqual(JSON.parse(opts.body), { token: 'einmal' });
        return jsonResponse(200, {
          token: 'sf1.session',
          tokenType: 'Bearer',
          expiresAt: new Date(Date.now() + 180 * DAY).toISOString(),
          player: { id: 'p1', email: 'helga@example.com', displayName: 'Helga' }
        });
      }
      return jsonResponse(200, trialMe('Helga', 14));
    });
    assert.strictEqual(result.kind, 'ok');
    assert.strictEqual(result.href, '/mein-avatar/');
    assert.strictEqual(Account.readSession(storage, START).token, 'sf1.session');
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('ohne Namen geht der Teil vor dem @ mit, ein echter Name bleibt', () => {
  const storage = E.memoryStorage();
  const previous = global.window;
  global.window = { SpielpartnerEntitlement: E };
  E.clientId(storage);
  try {
    const guessed = Account.signupBody(storage, { email: 'helga.berg@example.com' }, START);
    assert.equal(guessed.email, 'helga.berg@example.com');
    assert.equal(guessed.name, 'Helga Berg');
    assert.equal(guessed.clientId, E.readClientId(storage));
    const short = Account.signupBody(storage, { email: 'a@example.com' }, START);
    assert.equal(short.name, 'Freund');
    const kept = Account.signupBody(storage, { email: 'helga@example.com', name: '  Helga  ' }, START);
    assert.equal(kept.name, 'Helga');
    assert.throws(() => Account.signupBody(storage, { email: 'helga@example.com', name: 'X' }, START), (err) => err.code === 'invalid_request');
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('die Proberunde zählt einmal, Eingepasst gibt neu und der Knopf sagt die Wahrheit', () => {
  const storage = E.memoryStorage();
  const previousWindow = global.window;
  const previousStorage = global.localStorage;
  const calls = [];
  global.window = {
    SpielpartnerEntitlement: E,
    location: { pathname: '/skat/' },
    fetch: function (url, opts) {
      calls.push({ url: url, body: JSON.parse(opts.body), headers: opts.headers || {} });
      return Promise.resolve({ ok: true });
    }
  };
  global.localStorage = storage;
  try {
    assert.equal(Account.probeStillFree(storage, START), true);
    assert.equal(Account.nextPlayLabel('Nächstes Spiel', storage, START), 'Nächstes Spiel');
    const first = Account.finish(storage, START);
    assert.equal(first.proberunde, true);
    assert.equal(storage.getItem(Account.PROBE_KEY), '1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, E.BILLING_API_BASE + '/event');
    assert.equal(calls[0].body.type, 'trial_finished');
    assert.equal(calls[0].body.game, 'skat');
    assert.equal(calls[0].body.clientId, E.readClientId(storage));
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0].headers, 'Authorization'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0].body, 'email'), false);
    const second = Account.finish(storage, START + 1);
    assert.equal(second.proberunde, false);
    assert.equal(calls.length, 1);
    assert.equal(Account.probeStillFree(storage, START), false);
    assert.equal(Account.nextPlayLabel('Nächstes Spiel', storage, START), 'Anmelden und weiterspielen');
    assert.equal(Account.nextPlayLabel('Weiter', storage, START), 'Anmelden und weiterspielen');
    storage.setItem(Account.SESSION_KEY, JSON.stringify({ token: 'sf1.session', player: { displayName: 'Helga' } }));
    assert.equal(Account.probeStillFree(storage, START), false);
    assert.equal(Account.nextPlayLabel('Nächstes Spiel', storage, START), 'Nächstes Spiel');
    const skat = fs.readFileSync(path.join(__dirname, '../../public/skat/js/app.js'), 'utf8');
    const start = skat.indexOf('async function finishGame()');
    const passed = skat.indexOf('r.passedIn && probeStillFree()', start);
    const noted = skat.indexOf('noteFinishedRound();', start);
    assert.ok(passed > start);
    assert.ok(noted > passed);
    assert.match(skat, /Deine kostenlose Runde zählt noch/);
    assert.match(Account.hint(E.memoryStorage(), START), /Diese eine Runde geht ohne Anmeldung/);
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
    if (previousStorage === undefined) delete global.localStorage;
    else global.localStorage = previousStorage;
  }
});

test('die Anmeldekarte meldet sich, ein kaputtes Netz bleibt still', () => {
  const storage = E.memoryStorage();
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousStorage = global.localStorage;
  const calls = [];
  const root = {
    innerHTML: '',
    querySelector: function () { return null; }
  };
  const modal = {
    hidden: true,
    style: {},
    querySelector: function (sel) {
      if (sel === '#signup-root') return root;
      if (sel === '.pw-horst') return { ok: true };
      return null;
    },
    removeAttribute: function () {}
  };
  global.document = {
    getElementById: function (id) { return id === 'modal-signup' ? modal : null; },
    body: { classList: { add: function () {}, remove: function () {} }, className: '' },
    querySelector: function () { return { href: 'account.css' }; },
    createElement: function () { return {}; },
    head: { appendChild: function () {} }
  };
  global.window = {
    SpielpartnerEntitlement: E,
    location: { pathname: '/' },
    document: global.document,
    fetch: function (url, opts) {
      calls.push({ url: url, body: JSON.parse(opts.body), headers: opts.headers || {} });
      return Promise.reject(new Error('nicht da'));
    },
    SpielpartnerStimmen: {
      speak: function () { throw new Error('keine stimme'); }
    }
  };
  global.localStorage = storage;
  try {
    assert.equal(Account.openSignup(storage), true);
    assert.equal(Account.openSignup(storage), true);
    assert.equal(modal.hidden, false);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.type, 'signup_prompt_shown');
    assert.equal(calls[0].body.game, 'startseite');
    assert.equal(Object.prototype.hasOwnProperty.call(calls[0].headers, 'Authorization'), false);
    assert.doesNotThrow(function () {
      E.trackEvent(storage, 'trial_finished', {
        fetch: function () { throw new Error('netz'); },
        path: '/skat/'
      });
      E.trackEvent(storage, 'anders', {
        fetch: function () { throw new Error('soll nicht'); },
        path: '/'
      });
    });
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
    if (previousStorage === undefined) delete global.localStorage;
    else global.localStorage = previousStorage;
  }
});
