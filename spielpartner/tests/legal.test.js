/* Rechtstexte, Fuß und Dankeseite. Aufruf: node --test spielpartner/tests */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Danke = require('../../public/spielpartner/danke.js');

const root = path.join(__dirname, '../../public');

function walk(dir, acc) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.html')) acc.push(full);
  });
  return acc;
}

const pages = walk(root, []);

test('jede Seite nennt die Firma und verlinkt die Rechtstexte', () => {
  assert.ok(pages.length >= 8);
  pages.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /Ein Angebot der Interconsult LLC/, file);
    assert.match(html, /href="\/impressum\.html"/, file);
    assert.match(html, /href="\/datenschutz\.html"/, file);
    assert.match(html, /href="\/agb\.html"/, file);
    assert.match(html, /href="\/widerruf\.html"/, file);
    assert.match(html, /href="\/partnerprogramm\/"/, file);
    assert.match(html, /Partnerprogramm/, file);
    assert.match(html, /entitlement\.js/, file);
    assert.equal(html.includes('Michael Manns'), false, file);
    assert.equal(html.includes('Chiang Mai'), false, file);
  });
});

test('der Name der Geschäftsführung steht nur in Impressum und Datenschutz', () => {
  pages.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const base = path.basename(file);
    const allowed = base === 'impressum.html' || base === 'datenschutz.html';
    assert.equal(html.includes('Michael Schaller'), allowed, file);
  });
  const readme = fs.readFileSync(path.join(__dirname, '../../README.md'), 'utf8');
  assert.equal(readme.includes('Michael Manns'), false);
  assert.equal(readme.includes('Michael Schaller'), false);
});

test('Rechtstexte sind als Entwurf markiert und enthalten die Pflichtangaben', () => {
  const note = 'Entwurf: Diese Rechtstexte sind Entwürfe und sollten vor Veröffentlichung rechtlich geprüft werden.';
  ['impressum.html', 'datenschutz.html', 'agb.html', 'widerruf.html'].forEach((name) => {
    const html = fs.readFileSync(path.join(root, name), 'utf8');
    assert.match(html, new RegExp(note.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, /Interconsult LLC/);
    assert.match(html, /1309 Coffeen Avenue, STE 19065/);
    assert.match(html, /Sheridan, WY 82801/);
  });
  const impressum = fs.readFileSync(path.join(root, 'impressum.html'), 'utf8');
  assert.match(impressum, /EIN 38-4384027/);
  assert.match(impressum, /Managing Member: Michael Schaller/);
  assert.match(impressum, /admin@lead-monster\.net/);
  assert.match(impressum, /\+66930267139/);
  assert.match(impressum, /Wyoming/);

  const privacy = fs.readFileSync(path.join(root, 'datenschutz.html'), 'utf8');
  assert.match(privacy, /DigitalOcean/);
  assert.match(privacy, /Frankfurt/);
  assert.match(privacy, /localStorage/);
  assert.match(privacy, /KI-Dienstleister für Text, Sprache und Bilder/);
  assert.match(privacy, /NOWPayments/);
  assert.match(privacy, /Vertriebspartner/);
  assert.match(privacy, /90 Tage/);
  assert.match(privacy, /Auskunft/);
  assert.match(privacy, /E-Mail, Spielername/);
  assert.match(privacy, /30 Minuten/);
  assert.match(privacy, /ersten Anmeldung/);
  assert.match(privacy, /Bearer-Token/);
  assert.match(privacy, /nicht als Cookie/);
  assert.match(privacy, /Kalendertag in Berlin/);
  assert.match(privacy, /drei Runden an einem Berliner Tag/);
  assert.match(privacy, /dieselben E-Mail|derselben E-Mail/);
  assert.match(privacy, /Rechnungen und Lizenzcodes bleiben/);
  assert.match(privacy, /Pro E-Mail-Adresse gibt es ein Konto/);
  assert.equal(privacy.includes('Es gibt kein Nutzerkonto'), false);
  assert.equal(privacy.includes('—'), false);
  assert.equal(privacy.includes('OpenAI'), false);
  assert.equal(privacy.includes('ElevenLabs'), false);
  assert.equal(privacy.includes('xAI'), false);

  const terms = fs.readFileSync(path.join(root, 'agb.html'), 'utf8');
  assert.match(terms, /kein Abo/i);
  assert.match(terms, /keine automatische Verlängerung/);
  assert.match(terms, /6 Monate/);
  assert.match(terms, /12 Monate/);
  assert.match(terms, /Glücksspiel/);
  assert.match(terms, /Verbraucher/);
  assert.match(terms, /Wyoming/);
  assert.match(terms, /Proberunde/);
  assert.match(terms, /Pro E-Mail-Adresse gibt es ein Konto/);
  assert.match(terms, /Anmeldelink/);
  assert.match(terms, /Berlin/);
  assert.match(terms, /drei Runden am Tag mit Horst und Margarethe/);
  assert.equal(terms.includes('nur in Deinem Browser gezählt'), false);
  assert.equal(terms.includes('—'), false);

  const withdrawal = fs.readFileSync(path.join(root, 'widerruf.html'), 'utf8');
  assert.match(withdrawal, /§ 356 Abs\. 5 BGB/);
  assert.match(withdrawal, /Muster-Widerrufsformular/);
  assert.match(withdrawal, /vierzehn Tagen/);
});

test('Partnerprogramm nennt 20 Prozent und verspricht kein Einkommen', () => {
  const html = fs.readFileSync(path.join(root, 'partnerprogramm/index.html'), 'utf8');
  const lower = html.toLowerCase();
  assert.match(html, /20 Prozent/);
  assert.match(html, /tatsächlich bezahlt/);
  assert.match(html, /Standard/);
  assert.match(html, /Premium/);
  assert.match(html, /Verlängerung/);
  assert.match(html, /90 Tage/);
  assert.match(html, /erste Link/);
  assert.match(html, /normalen Preis/);
  assert.match(html, /normalen Auszahlung im Partnerprogramm von LeadMonster/);
  assert.match(html, /href="https:\/\/lead-monster\.net\/partner"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /Kostenlos anmelden/);
  assert.match(html, /Deinen Link teilen/);
  assert.equal(lower.includes('passiv'), false);
  assert.equal(lower.includes('garantiert'), false);
  assert.equal(/\d[\d.]*\s*€/.test(html), false);
});

test('Dankeseite liest die Bestellung und merkt sich eine bezahlte Lizenz', () => {
  assert.strictEqual(Danke.POLL_MS, 5000);
  assert.strictEqual(Danke.orderIdFromSearch('?order=abc_12'), 'abc_12');
  assert.strictEqual(Danke.orderIdFromSearch('?order='), '');
  assert.deepStrictEqual(Danke.interpret({ status: 'pending' }), { kind: 'pending' });
  assert.deepStrictEqual(Danke.interpret({ status: 'in_progress' }), { kind: 'in_progress' });
  assert.deepStrictEqual(Danke.interpret({ status: 'failed' }), { kind: 'failed' });
  const paid = Danke.interpret({
    status: 'paid',
    license: { code: 'CODE1', tier: 'premium', expiresAt: '2027-01-01T00:00:00.000Z' }
  });
  assert.strictEqual(paid.kind, 'paid');
  assert.strictEqual(paid.license.code, 'CODE1');
  const page = fs.readFileSync(path.join(root, 'spielpartner/danke.html'), 'utf8');
  assert.match(page, /Code notieren/);
  assert.match(page, /danke\.js/);
});
