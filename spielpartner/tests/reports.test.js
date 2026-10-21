/* Community-Testing und Premium-Bonus. Aufruf: node --test spielpartner/tests */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../../public/spielpartner/entitlement.js');
const Account = require('../../public/spielpartner/account.js');
const Rounds = require('../../public/spielpartner/rounds.js');
const Reports = require('../../public/spielpartner/reports.js');

const START = 1700000000000;
const DAY = 24 * 60 * 60 * 1000;
const root = path.join(__dirname, '../..');

function jsonResponse(status, body) {
  return {
    status: status,
    ok: status >= 200 && status < 300,
    json: async () => body
  };
}

function withWindow(extra) {
  const previous = global.window;
  global.window = Object.assign({
    SpielpartnerEntitlement: E,
    SpielpartnerAccount: Account
  }, extra || {});
  return function restore() {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  };
}

function seed(storage, me, token) {
  storage.setItem(Account.SESSION_KEY, JSON.stringify({
    token: token || 'sf1.session',
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 180 * DAY).toISOString(),
    player: { id: 'p1', email: 'helga@example.com', displayName: 'Helga' },
    me: me
  }));
}

function bonusMe(days, extra) {
  return Object.assign({
    player: { id: 'p1', email: 'helga@example.com', displayName: 'Helga' },
    entitlement: 'bonus',
    tier: 'free',
    trial: { active: false, daysLeft: 0, endsAt: START },
    license: null,
    bonus: {
      until: new Date(Date.now() + days * DAY).toISOString(),
      active: true,
      pending: false,
      daysLeft: days
    },
    freeRounds: { limit: 3, used: 3, remaining: 0, unlimited: false, day: '2026-10-21' }
  }, extra || {});
}

const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

test('Bonus zählt als Premium, ohne Sperre, mit den restlichen Tagen', () => {
  const storage = E.memoryStorage();
  const restore = withWindow();
  seed(storage, bonusMe(12));
  try {
    const state = E.load(storage);
    assert.strictEqual(state.bonus.active, true);
    assert.strictEqual(state.bonus.daysLeft, 12);
    const view = E.describe(state, START);
    assert.strictEqual(view.phase, 'bonus');
    assert.strictEqual(view.daysLeft, 12);
    assert.strictEqual(view.trialActive, false);
    assert.strictEqual(view.allUnlocked, true);
    assert.strictEqual(view.unlimited, true);
    assert.strictEqual(E.isUnlocked('premium', state, START, 9), true);
    assert.strictEqual(E.isUnlocked('standard', view, START, 9), true);
    const round = E.canStartRound(storage, START);
    assert.strictEqual(round.ok, true);
    assert.strictEqual(round.unlimited, true);
    assert.strictEqual(round.paywall, false);
    assert.strictEqual(E.recordRound(storage, START).counted, false);
    const access = Account.accessFromMe(bonusMe(12));
    assert.strictEqual(access.ok, true);
    assert.strictEqual(access.unlimited, true);
    assert.strictEqual(access.paywall, undefined);
    assert.strictEqual(Account.hint(storage, START), 'Premium-Bonus läuft noch 12 Tage.');
    assert.strictEqual(E.bonusHint(1), 'Premium-Bonus läuft noch 1 Tag.');
    seed(storage, bonusMe(1));
    assert.strictEqual(Account.hint(storage, START), 'Premium-Bonus läuft noch 1 Tag.');
    const saved = JSON.parse(storage.getItem(E.STORAGE_KEY) || 'null');
    assert.strictEqual(saved, null);
    E.save(storage, E.load(storage));
    assert.strictEqual(JSON.parse(storage.getItem(E.STORAGE_KEY)).bonus, undefined);
    assert.strictEqual(E.describe(E.load(storage), START).phase, 'bonus');
  } finally {
    restore();
  }
});

test('ein wartender Bonus sperrt den Test nicht und schaltet ihn nicht vor', () => {
  const storage = E.memoryStorage();
  const restore = withWindow();
  seed(storage, {
    entitlement: 'trial',
    tier: 'trial',
    trial: { active: true, daysLeft: 5, endsAt: new Date(Date.now() + 5 * DAY).toISOString() },
    bonus: { active: false, pending: true, daysLeft: 28, until: null },
    freeRounds: { unlimited: true }
  });
  try {
    const view = E.describe(E.load(storage), Date.now());
    assert.strictEqual(view.phase, 'trial');
    assert.strictEqual(view.bonus, null);
    assert.match(Account.hint(storage, Date.now()), /Test läuft noch 5 Tage/);
    assert.equal(Account.hint(storage, Date.now()).includes('Bonus'), false);
  } finally {
    restore();
  }
});

test('nur das Datum des Bonus reicht für die restlichen Tage', () => {
  const storage = E.memoryStorage();
  const restore = withWindow();
  seed(storage, {
    entitlement: 'bonus',
    tier: 'premium',
    bonus: { active: true, pending: false, until: new Date(START + 5 * DAY).toISOString() },
    freeRounds: { unlimited: true }
  });
  try {
    const view = E.describe(E.load(storage), START);
    assert.strictEqual(view.phase, 'bonus');
    assert.strictEqual(view.daysLeft, 5);
    assert.strictEqual(E.bonusHint(view.daysLeft), 'Premium-Bonus läuft noch 5 Tage.');
  } finally {
    restore();
  }
});

test('die Sperre bleibt zu, solange der Bonus läuft', async () => {
  const storage = E.memoryStorage();
  let paywall = 0;
  const restore = withWindow({ SpielpartnerPaywall: { open() { paywall += 1; } } });
  seed(storage, bonusMe(8));
  try {
    assert.strictEqual(Account.gate(storage, START), true);
    assert.strictEqual(Rounds.gate(storage, START), true);
    const el = { textContent: '' };
    Rounds.paint(el, storage, START);
    assert.strictEqual(el.textContent, 'Premium-Bonus läuft noch 8 Tage.');
    const done = await Account.finish(storage, START, async () => jsonResponse(403, {
      error: 'free_round_limit',
      entitlement: 'bonus',
      bonus: { active: true, daysLeft: 8 },
      freeRounds: { limit: 3, used: 3, remaining: 0, unlimited: false }
    })).pending;
    assert.strictEqual(done.paywall, false);
    assert.strictEqual(done.bonus, true);
    assert.strictEqual(paywall, 0);
    assert.strictEqual(Account.gate(storage, START), true);
  } finally {
    restore();
  }
});

test('ohne Konto-Modul zeigt der Rundenzähler den Bonus aus dem Anspruch', () => {
  const storage = E.memoryStorage();
  const previous = global.window;
  global.window = { SpielpartnerEntitlement: E };
  seed(storage, bonusMe(3));
  try {
    const el = { textContent: '' };
    Rounds.paint(el, storage, START);
    assert.strictEqual(el.textContent, 'Premium-Bonus läuft noch 3 Tage.');
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('Meldung schickt Spiel, Text, Stand und Bearer an dieselbe API', async () => {
  const storage = E.memoryStorage();
  const restore = withWindow();
  seed(storage, bonusMe(4));
  let sent = null;
  try {
    const result = await Reports.submitReport(storage, {
      game: 'skat',
      description: '  Die Zehn blieb liegen, obwohl sie stechen musste.  ',
      steps: 'Ich habe Kreuz gespielt.',
      url: 'https://spiel-freunde.com/skat/?token=geheim',
      userAgent: 'TestBrowser',
      screenshot: TINY_PNG,
      clientState: { phase: 'play', hand: ['CA', 'C10'], token: 'nicht-mitschicken', email: 'helga@example.com' }
    }, async (url, opts) => {
      sent = { url: url, headers: opts.headers, body: JSON.parse(opts.body) };
      assert.strictEqual(opts.method, 'POST');
      return jsonResponse(201, { id: 'bug-17' });
    }, START);
    assert.strictEqual(result.id, 'bug-17');
    assert.strictEqual(sent.url, E.BILLING_API_BASE + '/bug-reports');
    assert.strictEqual(sent.headers.Authorization, 'Bearer sf1.session');
    assert.strictEqual(sent.body.game, 'skat');
    assert.strictEqual(sent.body.description, 'Die Zehn blieb liegen, obwohl sie stechen musste.');
    assert.strictEqual(sent.body.steps, 'Ich habe Kreuz gespielt.');
    assert.strictEqual(sent.body.screenshot, TINY_PNG);
    assert.strictEqual(sent.body.clientState.phase, 'play');
    assert.deepStrictEqual(sent.body.clientState.hand, ['CA', 'C10']);
    assert.equal(sent.body.clientState.token, undefined);
    assert.equal(sent.body.clientState.email, undefined);
    assert.equal(JSON.stringify(sent.body).includes('lead-monster'), false);
  } finally {
    restore();
  }
});

test('ohne Anmeldung, zu kurzer Text, zu großes Foto und zu viele Meldungen', async () => {
  const storage = E.memoryStorage();
  const restore = withWindow();
  try {
    await assert.rejects(
      Reports.submitReport(storage, { game: 'skat', description: 'Die Zehn blieb liegen.' }, async () => jsonResponse(201, { id: 'x' })),
      (err) => err.code === 'unauthorized' && /kostenloses Konto|Anmeldelink|abgelaufen/.test(err.userMessage)
    );
    seed(storage, bonusMe(2));
    assert.throws(() => Reports.buildPayload({ game: 'skat', description: 'zu kurz' }), (err) => err.code === 'invalid_request');
    assert.throws(() => Reports.buildPayload({ game: 'skat', description: 'x'.repeat(2001) }), (err) => err.code === 'invalid_request');
    const huge = 'A'.repeat(Math.ceil((Reports.SHOT_LIMIT + 1000) / 3) * 4);
    assert.throws(
      () => Reports.buildPayload({ game: 'jass', description: 'Die Karte klebt fest.', screenshot: 'data:image/jpeg;base64,' + huge }),
      (err) => err.code === 'screenshot_too_large'
    );
    assert.throws(
      () => Reports.buildPayload({ game: 'skat', description: 'Die Karte klebt fest.', screenshot: 'data:image/gif;base64,AAAA' }),
      (err) => err.code === 'screenshot_too_large'
    );
    const limited = await Reports.submitReport(storage, {
      game: 'maumau',
      description: 'Die Sieben hat den Stapel nicht verlängert.'
    }, async () => jsonResponse(429, { error: 'rate_limited' })).catch((err) => err);
    assert.strictEqual(limited.code, 'rate_limited');
    assert.match(limited.userMessage, /Moment/);
    const tooBig = await Reports.submitReport(storage, {
      game: 'tisch',
      description: 'Der Stich blieb auf dem Tisch liegen.'
    }, async () => jsonResponse(413, { error: 'state_too_large' })).catch((err) => err);
    assert.strictEqual(tooBig.code, 'state_too_large');
    assert.match(tooBig.userMessage, /Spielstand/);
    const shot = await Reports.submitReport(storage, {
      game: 'canasta',
      description: 'Der Ablegestapel hat sich nicht geöffnet.'
    }, async () => jsonResponse(413, { error: 'screenshot_too_large' })).catch((err) => err);
    assert.match(shot.userMessage, /ohne Foto/);
  } finally {
    restore();
  }
});

test('Spielstand wird unter 50 Kilobyte gekürzt und kommt aus dem Spielobjekt', () => {
  const bulky = { phase: 'play', parts: [] };
  for (let i = 0; i < 20; i++) bulky.parts.push('Karte '.repeat(2000));
  const fitted = Reports.fitState(bulky);
  const encoded = JSON.stringify(fitted);
  assert.ok(Buffer.byteLength(encoded, 'utf8') < Reports.STATE_LIMIT);
  assert.strictEqual(fitted.phase, 'play');
  const state = Reports.collectState('jass', { __jass: { table: { phase: 'play', trump: 'Eichel', token: 'weg' } } });
  const payload = Reports.buildPayload({
    game: 'jass',
    description: 'Der Trumpf wurde nicht angesagt.',
    clientState: state
  });
  assert.strictEqual(payload.game, 'jass');
  assert.strictEqual(payload.clientState.table.phase, 'play');
  assert.equal(payload.clientState.table.token, undefined);
  assert.strictEqual(Reports.collectState('tisch', { __tisch: { view: { phase: 'bidding', code: 'ABCDE2' } } }).view.code, 'ABCDE2');
  assert.strictEqual(Reports.gameFromPath('/skat/'), 'skat');
  assert.strictEqual(Reports.gameFromPath('/tisch/?code=ABC'), 'tisch');
  assert.strictEqual(Reports.gameFromPath('/community-testing/'), 'other');
  assert.strictEqual(Reports.normalizeGame('bridge'), 'other');
  const url = Reports.pageUrl('https://spiel-freunde.com/skat/?token=geheim&ai=0');
  assert.equal(url.includes('token='), false);
  assert.match(url, /ai=0/);
});

test('Meine Meldungen zeigt die Stände auf Deutsch', async () => {
  const storage = E.memoryStorage();
  const restore = withWindow();
  seed(storage, bonusMe(6));
  try {
    const result = await Reports.listMine(storage, async (url, opts) => {
      assert.strictEqual(url, E.BILLING_API_BASE + '/bug-reports/mine');
      assert.strictEqual(opts.headers.Authorization, 'Bearer sf1.session');
      return jsonResponse(200, {
        items: [
          { id: '1', game: 'skat', description: 'Die Zehn blieb liegen.', steps: 'Kreuz angespielt.', status: 'new', hasScreenshot: true, createdAt: '2026-10-01T12:00:00.000Z' },
          { id: '2', game: 'schafkopf', description: 'Der Lauf wurde nicht gezählt.', status: 'confirmed', hasScreenshot: false, createdAt: '2026-10-02T12:00:00.000Z', decidedAt: '2026-10-03T12:00:00.000Z' },
          { id: '3', game: 'jass', description: 'Obenabe hat die Punkte verdreht.', status: 'rejected', createdAt: '2026-10-04T12:00:00.000Z' },
          { id: '4', game: 'canasta', description: 'Dieselbe Meldung gab es schon.', status: 'duplicate', createdAt: '2026-10-05T12:00:00.000Z' },
          { id: '5', game: 'maumau', description: 'Die Sieben klebte.', status: 'fixed', createdAt: '2026-10-06T12:00:00.000Z' },
          { id: '6', game: 'tisch', description: 'Der private Tisch hat den Stich verschluckt.', status: 'new', createdAt: '2026-10-07T12:00:00.000Z' }
        ]
      });
    });
    assert.strictEqual(result.items.length, 6);
    assert.strictEqual(result.items[1].status, 'confirmed');
    const html = Reports.listMarkup(result.items);
    assert.match(html, /Neu/);
    assert.match(html, /Bestätigt/);
    assert.match(html, /Abgelehnt/);
    assert.match(html, /Doppelt/);
    assert.match(html, /Behoben/);
    assert.match(html, /Skat/);
    assert.match(html, /Schafkopf/);
    assert.match(html, /Privater Tisch/);
    assert.match(html, /mit Bild/);
    assert.match(html, /Die Zehn blieb liegen/);
    assert.match(Reports.listMarkup([]), /noch keine Meldung/);
  } finally {
    restore();
  }
});

test('Dialog, Knopf und Seiten bleiben beim Du und ohne Versprechen', () => {
  assert.match(Reports.INTRO, /Du hilfst uns, Spiel-Freunde fehlerfrei zu machen/);
  assert.match(Reports.INTRO, /4 Wochen Premium gratis, zusätzlich nach Deiner Testphase/);
  assert.strictEqual(Reports.SUCCESS, 'Danke! Wir prüfen Deine Meldung und melden uns per Mail.');
  assert.match(Reports.ACCOUNT_LINE, /kostenloses Konto/);
  const dialog = Reports.dialogMarkup();
  assert.match(dialog, /Was ist passiert\?/);
  assert.match(dialog, /Wie kam es dazu\?/);
  assert.match(dialog, /Bildschirmfoto der Spielansicht anhängen/);
  assert.match(dialog, /data-report-shot[^>]*checked|checked[^>]*data-report-shot/);
  assert.match(Reports.buttonMarkup(), /Fehler melden/);
  assert.match(Reports.loggedOutMarkup(), /kostenloses Konto/);
  assert.match(Reports.successMarkup(''), /Danke! Wir prüfen Deine Meldung und melden uns per Mail/);
  const blob = [
    fs.readFileSync(path.join(root, 'public/spielpartner/reports.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'public/spielpartner/reports.css'), 'utf8'),
    fs.readFileSync(path.join(root, 'public/community-testing/index.html'), 'utf8'),
    fs.readFileSync(path.join(root, 'public/index.html'), 'utf8')
  ].join('\n');
  assert.doesNotMatch(blob, /grok|openai|elevenlabs|anthropic|claude|x\.?ai/i);
  assert.doesNotMatch(blob, /einkommen|verdienst|geld verdienen|passives einkommen/i);
  const page = fs.readFileSync(path.join(root, 'public/community-testing/index.html'), 'utf8');
  assert.match(page, /4 Wochen Premium gratis/);
  assert.match(page, /zusätzlich nach Deiner Testphase/);
  assert.match(page, /kein Geld/);
  assert.match(page, /id="sf-report-list"/);
  assert.match(page, /reports\.js/);
  const home = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.match(home, /id="community-testing"/);
  assert.match(home, /4 Wochen Premium gratis/);
  assert.match(home, /href="\/community-testing\/"/);
  const app = fs.readFileSync(path.join(root, 'public/spielpartner/app.js'), 'utf8');
  assert.match(app, /phase === 'bonus'/);
  assert.match(app, /Premium-Bonus/);
  const rounds = fs.readFileSync(path.join(root, 'public/spielpartner/rounds.js'), 'utf8');
  assert.match(rounds, /phase === 'bonus'/);
});

test('jedes gemeldete Spiel hat den Knopf, den Spielstand und das Skript', () => {
  const games = [
    ['skat', 'public/skat/js/app.js', '__skat'],
    ['schafkopf', 'public/schafkopf/js/app.js', '__schafkopf'],
    ['jass', 'public/jass/js/app.js', '__jass'],
    ['canasta', 'public/canasta/js/app.js', '__canasta'],
    ['maumau', 'public/maumau/js/app.js', '__maumau'],
    ['tisch', 'public/tisch/tisch.js', '__tisch']
  ];
  games.forEach((entry) => {
    const page = fs.readFileSync(path.join(root, 'public', entry[0], 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, entry[1]), 'utf8');
    assert.match(page, /\/spielpartner\/reports\.js/, entry[0]);
    assert.match(page, /\/spielpartner\/reports\.css/, entry[0]);
    assert.match(app, new RegExp('window\\.' + entry[2]), entry[0]);
  });
  const tisch = fs.readFileSync(path.join(root, 'public/tisch/index.html'), 'utf8');
  assert.match(tisch, /\/spielpartner\/account\.js/);
  assert.match(Reports.buttonMarkup(), /data-sf-report/);
  const src = fs.readFileSync(path.join(root, 'public/spielpartner/reports.js'), 'utf8');
  assert.match(src, /html2canvas/);
  assert.match(src, /toDataURL/);
  assert.match(src, /\/bug-reports\/mine/);
  assert.match(src, /Meine Meldungen/);
  assert.equal(src.includes('lead-monster.net'), false);
});
