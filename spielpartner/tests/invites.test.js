/* Spieler empfehlen Spieler. Aufruf: node --test spielpartner/tests */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../../public/spielpartner/entitlement.js');
const Account = require('../../public/spielpartner/account.js');
const Invites = require('../../public/spielpartner/invites.js');

const START = 1700000000000;
const DAY = 24 * 60 * 60 * 1000;
const TOKEN = 'inviteToken_123456';
const root = path.join(__dirname, '../..');

function jsonResponse(status, body) {
  return {
    status: status,
    ok: status >= 200 && status < 300,
    json: async () => body
  };
}

function withWindow() {
  const previous = global.window;
  global.window = { SpielpartnerEntitlement: E, SpielpartnerAccount: Account };
  return function restore() {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  };
}

function seed(storage, email, name) {
  storage.setItem(Account.SESSION_KEY, JSON.stringify({
    token: 'sf1.session',
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + 30 * DAY).toISOString(),
    player: { id: 'p1', email: email || 'michael@example.com', displayName: name || 'Michael' }
  }));
}

test('Einladungscode: erster gilt, 90 Tage, Anmeldung und Kasse', async () => {
  const storage = E.memoryStorage();
  const restore = withWindow();
  try {
    assert.strictEqual(E.captureInvite(storage, START, '?invite=' + TOKEN), TOKEN);
    assert.strictEqual(E.captureInvite(storage, START + DAY, '?invite=andererToken_654321'), TOKEN);
    assert.strictEqual(E.captureInvite(storage, START, '?invite=kurz'), TOKEN);
    assert.strictEqual(E.readInvite(storage, START + 89 * DAY), TOKEN);
    const body = Account.signupBody(storage, { email: 'lena@example.com', name: 'Lena' }, START);
    assert.strictEqual(body.invite, TOKEN);
    assert.strictEqual(E.readInvite(storage, START + 90 * DAY), null);
    E.captureInvite(storage, START, '?invite=' + TOKEN);
    E.captureRef(storage, START, '?ref=tisch42');
    let sent = null;
    await E.startCheckout(storage, { tier: 'premium', months: 1, email: '' }, START, async (url, opts) => {
      sent = JSON.parse(opts.body);
      assert.strictEqual(url, E.BILLING_API_BASE + '/checkout');
      return { ok: true, json: async () => ({ orderId: 'ord_9', invoiceUrl: 'https://pay.example/rech/9' }) };
    });
    assert.deepStrictEqual(sent, { tier: 'premium', months: 1, ref: 'tisch42', invite: TOKEN });
    assert.equal(JSON.stringify(sent).includes('sf-invite'), false);
  } finally {
    restore();
  }
});

test('bis zu 5 Freunde, keine Selbst-Einladung, keine doppelte E-Mail', () => {
  assert.strictEqual(Invites.OPEN_LIMIT, 5);
  assert.strictEqual(Invites.BONUS_WEEKS, 4);
  assert.strictEqual(Invites.MAX_WEEKS, 20);
  assert.match(Invites.HEADLINE, /bis zu 20 Wochen Premium gratis/);
  assert.strictEqual(Invites.subjectLine('Michael', 'skat'), 'Michael lädt Dich zum Skat ein');
  assert.strictEqual(Invites.subjectLine('Michael', 'canasta'), 'Michael lädt Dich zur Canasta ein');
  assert.strictEqual(Invites.subjectLine('', 'jass'), 'Jemand lädt Dich zum Jass ein');
  const ok = Invites.validateFriend(
    { name: ' Lena ', email: ' Lena@Example.com ', game: 'schafkopf' },
    { selfEmail: 'michael@example.com', existingEmails: [], slotsLeft: 5 }
  );
  assert.deepStrictEqual(ok.body, { name: 'Lena', email: 'Lena@Example.com', game: 'schafkopf' });
  assert.strictEqual(Invites.validateFriend(
    { name: 'Ich', email: 'Michael@Example.com', game: 'skat' },
    { selfEmail: 'michael@example.com', slotsLeft: 5 }
  ).code, 'self_invite');
  assert.strictEqual(Invites.validateFriend(
    { name: 'Lena', email: 'lena@example.com', game: 'skat' },
    { selfEmail: 'michael@example.com', existingEmails: ['Lena@Example.com'], slotsLeft: 2 }
  ).code, 'duplicate_email');
  assert.strictEqual(Invites.validateFriend(
    { name: 'Uwe', email: 'uwe@example.com', game: 'skat' },
    { slotsLeft: 0, existingEmails: [] }
  ).code, 'invite_limit');
  assert.strictEqual(Invites.validateFriend({ name: 'A', email: 'uwe@example.com' }, { slotsLeft: 1 }).code, 'invalid_request');
  assert.strictEqual(Invites.slotsLeft([{ id: '1' }, { id: '2' }], 5), 3);
  assert.strictEqual(Invites.slotsLeft(new Array(5), 5), 0);
});

test('Stände und gutgeschriebene Wochen', () => {
  const list = Invites.normalizeList({
    limit: 5,
    invites: [
      { id: 'a', name: 'Lena', email: 'lena@example.com', game: 'skat', status: 'invited', createdAt: '2026-10-01T12:00:00.000Z' },
      { id: 'b', name: 'Uwe', email: 'uwe@example.com', game: 'jass', status: 'signed_up', createdAt: '2026-10-02T12:00:00.000Z' },
      { id: 'c', name: 'Ida', email: 'ida@example.com', game: 'canasta', status: 'premium', bonusGranted: true, bonusWeeks: 8, createdAt: '2026-10-03T12:00:00.000Z' }
    ]
  });
  assert.strictEqual(list.invites[0].status, 'invited');
  assert.strictEqual(list.invites[1].status, 'signed_up');
  assert.strictEqual(list.invites[2].bonusWeeks, 8);
  assert.strictEqual(Invites.weeksEarned(list.invites), 8);
  assert.strictEqual(Invites.statusLabel('invited'), 'Eingeladen');
  assert.strictEqual(Invites.statusLabel('signed_up'), 'Angemeldet');
  assert.strictEqual(Invites.statusLabel('premium'), 'Premium');
  const html = Invites.listMarkup(list.invites, 'Michael');
  assert.match(html, /Eingeladen/);
  assert.match(html, /Angemeldet/);
  assert.match(html, /Premium/);
  assert.match(html, /Michael lädt Dich zum Skat ein/);
  assert.match(html, /Michael lädt Dich zum Jass ein/);
  assert.match(html, /Michael lädt Dich zur Canasta ein/);
  assert.match(html, /8 Wochen Premium gutgeschrieben/);
  assert.match(html, /lena@example.com/);
  assert.match(Invites.listMarkup([], 'Michael'), /Noch keine Einladung/);
  assert.match(Invites.summaryMarkup(list.invites, 5), /3 von 5/);
  assert.match(Invites.summaryMarkup(list.invites, 5), /8 Wochen Premium sind gutgeschrieben/);
  assert.match(Invites.formMarkup({ slotsLeft: 0 }), /schon 5 Einladungen/);
  assert.match(Invites.formMarkup({ slotsLeft: 2, inviterName: 'Michael', game: 'skat' }), /Michael lädt Dich zum Skat ein/);
  assert.match(Invites.loginMarkup(), /Anmeldelink/);
  assert.match(Invites.loginMarkup(), /Spam- oder Werbe-Ordner/);
  assert.match(Invites.sentMarkup('helga@example.com'), /E-Mail erneut senden/);
  assert.match(Invites.sentMarkup('helga@example.com'), /helga@example.com/);
  assert.match(Invites.messageFor('self_invite'), /nicht einladen/);
  assert.match(Invites.messageFor('rate_limited'), /zu oft/);
  assert.match(Invites.messageFor('not_found'), /noch nicht erreichbar/);
  const pending = Invites.normalizeInvite({ name: 'Eva', email: 'eva@example.com', status: 'premium', bonusGranted: false, bonusWeeks: 0 });
  assert.equal(pending.bonusGranted, false);
  assert.match(Invites.listMarkup([pending], 'Michael'), /werden gutgeschrieben/);
});

test('Einladung geht mit Bearer an /invites und hält das Limit ein', async () => {
  const storage = E.memoryStorage();
  const restore = withWindow();
  seed(storage);
  const calls = [];
  const fetcher = async (url, opts) => {
    calls.push({ url: url, method: opts.method, headers: opts.headers, body: opts.body ? JSON.parse(opts.body) : null });
    if (opts.method === 'GET') {
      return jsonResponse(200, {
        limit: 5,
        invites: [
          { id: '1', name: 'Lena', email: 'lena@example.com', game: 'skat', status: 'invited', createdAt: '2026-10-01T00:00:00.000Z' }
        ]
      });
    }
    return jsonResponse(200, {
      ok: true,
      invite: { id: '2', name: 'Uwe', email: 'uwe@example.com', game: 'bridge', status: 'invited' }
    });
  };
  try {
    const created = await Invites.createInvite(storage, { name: 'Uwe', email: 'uwe@example.com', game: 'bridge' }, fetcher);
    assert.strictEqual(created.invite.game, 'bridge');
    assert.strictEqual(calls[0].method, 'GET');
    assert.strictEqual(calls[0].url, E.BILLING_API_BASE + '/invites');
    assert.strictEqual(calls[0].headers.Authorization, 'Bearer sf1.session');
    assert.deepStrictEqual(calls[1].body, { name: 'Uwe', email: 'uwe@example.com', game: 'bridge' });
    await assert.rejects(
      Invites.createInvite(storage, { name: 'Ich', email: 'michael@example.com', game: 'skat' }, fetcher),
      (err) => err.code === 'self_invite'
    );
    const limited = async (url, opts) => {
      if (opts.method === 'GET') {
        return jsonResponse(200, {
          limit: 5,
          invites: [1, 2, 3, 4, 5].map((n) => ({
            id: String(n),
            name: 'Freund ' + n,
            email: 'f' + n + '@example.com',
            game: 'skat',
            status: 'invited'
          }))
        });
      }
      throw new Error('darf nicht senden');
    };
    await assert.rejects(
      Invites.createInvite(storage, { name: 'Neu', email: 'neu@example.com', game: 'skat' }, limited),
      (err) => err.code === 'invite_limit'
    );
  } finally {
    restore();
  }
});

test('Seiten ohne Shop, Premium enthält alles, Einladen bleibt beim Du', () => {
  const home = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const member = fs.readFileSync(path.join(root, 'public/spielpartner/index.html'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'public/freunde/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public/assets/style.css'), 'utf8');
  const terms = fs.readFileSync(path.join(root, 'public/agb.html'), 'utf8');
  const privacy = fs.readFileSync(path.join(root, 'public/datenschutz.html'), 'utf8');
  const blob = [home, member, page, css, terms, privacy, fs.readFileSync(path.join(root, 'public/spielpartner/invites.js'), 'utf8')].join('\n');
  assert.equal(home.includes('Im Shop'), false);
  assert.equal(home.includes('class="shop"'), false);
  assert.equal(css.includes('.shop'), false);
  assert.equal(home.includes('19,95'), false);
  assert.equal(home.includes('Skat wählen'), false);
  assert.equal(home.includes('Alle Spiele wählen'), false);
  assert.equal(home.includes('Ranglisten und Turniere'), false);
  const prices = home.slice(home.indexOf('id="preise"'), home.indexOf('id="freunde-einladen"'));
  assert.match(prices, /Einen Shop gibt es nicht/);
  assert.match(prices, /data-tier="premium"/);
  assert.match(prices, /Besondere Kartendecks und Tischdesigns/);
  assert.match(prices, /Alle Orte, auch die neuen, sobald sie da sind/);
  assert.match(prices, /Dein Avatar am Tisch/);
  assert.match(prices, /Alle Spiele, von Skat bis Bridge/);
  assert.match(prices, /14,95 €/);
  assert.match(prices, /href="\/spielpartner\/#mitgliedschaft"/);
  assert.match(home, /id="freunde-einladen"/);
  assert.match(home, /bis zu 20 Wochen Premium gratis/);
  assert.match(home, /href="\/freunde\/"/);
  assert.match(member, /id="einladen"/);
  assert.match(member, /Spiel mit Deinen Freunden und sichere Dir bis zu 20 Wochen Premium gratis/);
  assert.match(member, /Michael lädt Dich zum Skat ein/);
  assert.match(member, /Besondere Kartendecks und Tischdesigns/);
  assert.match(member, /Es ist Spielzeit, kein Geld/);
  assert.match(page, /id="sf-invite-app"/);
  assert.match(page, /invites\.js/);
  assert.match(page, /Eingeladen/);
  assert.match(page, /Angemeldet/);
  assert.match(page, /4 Wochen Premium/);
  assert.match(terms, /nicht einzeln zu kaufen/);
  assert.match(terms, /4 Wochen Premium als Spielzeit/);
  assert.match(terms, /keine Auszahlung und kein Geld/);
  assert.match(privacy, /Spieler empfehlen Spieler/);
  assert.match(privacy, /Einladungscode/);
  assert.match(privacy, /90 Tage/);
  assert.doesNotMatch(blob, /—/);
  assert.doesNotMatch(blob, /grok|openai|elevenlabs|anthropic|claude|x\.?ai/i);
  assert.doesNotMatch(blob, /einkommen|verdienst|geld verdienen|passives einkommen/i);
  assert.equal(blob.includes('VITE_'), false);
});
