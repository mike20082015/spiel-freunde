/* Horsts Begrüßung, einmal nach der ersten Anmeldung. Aufruf: node --test spielpartner/tests */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../../public/spielpartner/entitlement.js');
const Account = require('../../public/spielpartner/account.js');
const W = require('../../public/spielpartner/willkommen.js');

const START = 1700000000000;
const DAY = 24 * 60 * 60 * 1000;
const VERBOTEN = /ElevenLabs|OpenAI|Anthropic|Einkommen|Einsatz|Glücksspiel|—/;

function session(name, createdAt) {
  return {
    token: 'sf1.test',
    player: { id: 'p1', email: 'helga@example.com', displayName: name },
    me: {
      player: { id: 'p1', email: 'helga@example.com', displayName: name, createdAt: createdAt }
    }
  };
}

test('der Gruß nennt den Spielernamen und bleibt herzlich', () => {
  assert.deepStrictEqual(W.lines('Michael'), [
    'Willkommen bei Spiel-Freunde.',
    'Schön, dass Du da bist, Michael!',
    'Das ganze Avatar-Team freut sich auf spannende Spiele mit Dir.'
  ]);
  assert.doesNotMatch(W.lines('Michael')[0], /Michael/);
  assert.strictEqual(W.greeting('Helga'), 'Willkommen bei Spiel-Freunde. Schön, dass Du da bist, Helga! Das ganze Avatar-Team freut sich auf spannende Spiele mit Dir.');
  assert.ok(W.PAUSE_VOR_DEM_NAMEN >= 500);
  assert.match(W.hintText(), /Zuschauen & Lernen/);
  assert.match(W.markup('Helga'), /Willkommen bei Spiel-Freunde\./);
  assert.match(W.markup('Helga'), /Schön, dass Du da bist, Helga!/);
  assert.match(W.markup('Helga'), /Horst Kaluppke/);
  assert.match(W.markup('Helga'), /Horst begrüßt Dich/);
  assert.match(W.markup('Helga'), /Los geht's/);
  assert.match(W.markup('Helga'), /Ton aus/);
  assert.match(W.markup('Helga'), /margarethe\.jpg/);
  assert.match(W.markup('Helga'), /oma-hilde\.jpg/);
  assert.doesNotMatch(W.markup('<b>'), /<b>/);
  const src = fs.readFileSync(path.join(__dirname, '../../public/spielpartner/willkommen.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../../public/spielpartner/willkommen.css'), 'utf8');
  const talk = fs.readFileSync(path.join(__dirname, '../../public/skat/js/talk.js'), 'utf8');
  assert.doesNotMatch(src, VERBOTEN);
  assert.doesNotMatch(css, VERBOTEN);
  assert.doesNotMatch(src, /speechSynthesis|SpeechSynthesisUtterance/);
  assert.match(src, /\/api\/sf\/tts', '\/api\/tts', '\/api\/default\/tts'/);
  assert.match(talk, /\/api\/sf\/tts', '\/api\/tts', '\/api\/default\/tts'/);
  assert.match(src, /character:\s*'horst'/);
  assert.match(src, /abortSignal\(12000\)/);
  assert.match(css, /max-width:\s*640px/);
  assert.match(css, /orientation:\s*portrait/);
  assert.match(css, /orientation:\s*landscape/);
});

test('eine neue Anmeldung öffnet die Karte einmal, eine spätere nicht', () => {
  const storage = E.memoryStorage();
  const fresh = session('Helga', new Date(START).toISOString());
  assert.strictEqual(W.note(storage, fresh, null, START), true);
  assert.strictEqual(storage.getItem(W.OPEN_KEY), 'p1');
  W.ack(storage, 'p1');
  assert.strictEqual(storage.getItem(W.SEEN_KEY), 'p1');
  assert.strictEqual(storage.getItem(W.OPEN_KEY), null);
  assert.strictEqual(W.note(storage, fresh, null, START + 1000), false);
  assert.strictEqual(storage.getItem(W.OPEN_KEY), null);

  const other = E.memoryStorage();
  const old = session('Helga', new Date(START - 10 * DAY).toISOString());
  assert.strictEqual(W.fresh(old, null, START), false);
  assert.strictEqual(W.note(other, old, null, START), false);

  const flagged = E.memoryStorage();
  assert.strictEqual(W.note(flagged, old, { created: true }, START), true);
  assert.strictEqual(W.note(flagged, { token: 'x', player: { displayName: 'Helga' } }, { created: true }, START), false);
});

test('das Konto merkt sich die erste Anmeldung und jede Seite lädt die Karte', () => {
  const account = fs.readFileSync(path.join(__dirname, '../../public/spielpartner/account.js'), 'utf8');
  assert.match(account, /SpielpartnerWillkommen/);
  assert.match(account, /noteWillkommen/);
  assert.match(account, /showWillkommen/);
  const games = ['skat', 'canasta', 'schafkopf', 'jass', 'doppelkopf', 'maumau', 'romme', 'schwimmen', 'elfer-raus', 'schnapsen', 'watten', 'bridge'];
  games.forEach((game) => {
    const page = fs.readFileSync(path.join(__dirname, '../../public', game, 'index.html'), 'utf8');
    assert.match(page, /willkommen\.js/, game);
    const welcomeAt = page.indexOf('willkommen.js');
    const accountAt = page.indexOf('/spielpartner/account.js');
    assert.ok(welcomeAt !== -1 && welcomeAt < accountAt, game);
  });
  ['anmelden/index.html', 'index.html', 'freunde/index.html', 'tisch/index.html', 'community-testing/index.html', 'spielpartner/index.html'].forEach((file) => {
    const page = fs.readFileSync(path.join(__dirname, '../../public', file), 'utf8');
    assert.match(page, /willkommen\.js/, file);
  });
  assert.strictEqual(typeof Account.readSession, 'function');
});
