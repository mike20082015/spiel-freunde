/* "Re" bleibt auf dem Tisch stehen und wird nur für die Stimme zu "Reh". */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Talk = require('../../public/skat/js/talk.js').SkatTalk;
const root = path.join(__dirname, '../..');

test('gesprochene Ansage Re wird Reh, die übrigen kurzen Ansagen bleiben Wörter', () => {
  const say = Talk.spokenText;
  assert.equal(say('Re.'), 'Reh.');
  assert.equal(say('Re!'), 'Reh!');
  assert.equal(say('Re'), 'Reh');
  assert.equal(say('Kein Re'), 'Kein Reh');
  assert.equal(say('Re, Schätzchen. Haltung bewahren.'), 'Reh, Schätzchen. Haltung bewahren.');
  assert.equal(say('dann sind wir Re.'), 'dann sind wir Reh.');
  assert.equal(say('Re und Kontra, und dann Re.'), 'Reh und Kontra, und dann Reh.');
  assert.equal(say('Kontra.'), 'Kontra.');
  assert.equal(say('Kontra!'), 'Kontra!');
  assert.equal(say('Rekontra.'), 'Rekontra.');
  assert.equal(say('Bock! Jetze zählt et doppelt, passt uff.'), 'Bock! Jetze zählt et doppelt, passt uff.');
  assert.equal(say('Schneider! Det tut weh, wa?'), 'Schneider! Det tut weh, wa?');
  assert.equal(say('Im Schneider, wie bei mir uff de Straße im Januar.'), 'Im Schneider, wie bei mir uff de Straße im Januar.');
  assert.equal(say('Retour. Noch doller.'), 'Retour. Noch doller.');
  assert.equal(say('Null Ouvert!'), 'Null Ouvert!');
  assert.equal(say('Reizen bleibt ein Wort.'), 'Reizen bleibt ein Wort.');
  assert.equal(say('rheinischem Herzen'), 'rheinischem Herzen');
  assert.equal(say(say('Re.')), 'Reh.');
  assert.equal(say(''), '');
  assert.equal(say(null), '');
});

test('Blase und Punkteliste zeigen weiter Re, die Stimme spricht den umgeschriebenen Text', () => {
  const app = fs.readFileSync(path.join(root, 'public/skat/js/app.js'), 'utf8');
  const voice = fs.readFileSync(path.join(root, 'public/skat/js/voice.js'), 'utf8');
  const tisch = fs.readFileSync(path.join(root, 'public/tisch/tisch.js'), 'utf8');
  assert.match(app, /const word = dbl\.kind === 'kontra' \? 'Kontra' : 'Re'/);
  assert.match(app, /say\(dbl\.player, word \+ '!', \{ kind: 'bid', speech: word \+ '\.' \}\)/);
  assert.match(app, /'Kontra · Re'/);
  assert.match(tisch, /event\.kind === 'kontra' \? 'Kontra' : 'Re'/);
  assert.match(tisch, /'Kein Re'/);
  assert.match(tisch, /bubble\(event\.seat, word\)/);
  assert.match(voice, /function forSpeech\(text\)/);
  assert.match(voice, /Talk\.spokenText\(text\)/);
  assert.match(voice, /const spoken = forSpeech\(opts\.speech \|\| text\)/);
  assert.equal(Talk.spokenText('Re.'), 'Reh.');
  for (const who of ['horst', 'margarethe']) {
    for (const line of Talk.LINES[who].schneider.concat(Talk.LINES[who].bock)) {
      assert.equal(Talk.spokenText(line), line);
    }
  }
});

test('jede Figur sagt Reizen auf Deutsch, Horst und Margarethe behalten ihren Ton', () => {
  const others = ['lena', 'jonas', 'oemer', 'hilde', 'oma-hilde', 'sepp', 'ruediger', 'chantal', 'urs', 'vreni'];
  for (const who of others) {
    assert.equal(Talk.callText(who, 'pass'), 'Ich passe.', who);
    assert.equal(Talk.callText(who, 'hold'), 'Ja.', who);
    assert.equal(Talk.callText(who, 'open'), 'Ich spiele.', who);
    assert.equal(Talk.callText(who, 18), 'Achtzehn.', who);
    assert.equal(Talk.callText(who, '20'), 'Zwanzig.', who);
    assert.equal(Talk.callText(who, 22), 'Zweiundzwanzig.', who);
    assert.equal(Talk.callText(who, 'Grand'), 'Grand!', who);
    assert.equal(Talk.callText(who, 'Null Ouvert'), 'Null Ouvert!', who);
    assert.equal(Talk.spokenText(Talk.callText(who, 'pass')), 'Ich passe.', who);
    assert.doesNotMatch(Talk.callText(who, 18), /^\d/, who);
    assert.equal(Talk.allCalls(who).some((row) => row.text === 'Ich passe.'), true, who);
    assert.doesNotMatch(Talk.callText(who, 22), /—/, who);
  }
  assert.equal(Talk.callText('horst', 'pass'), 'Weg.');
  assert.equal(Talk.callText('horst', 'hold'), 'Jo.');
  assert.equal(Talk.callText('horst', 18), 'Achtzehn.');
  assert.equal(Talk.callText('margarethe', 'pass'), 'Ich passe.');
  assert.equal(Talk.callText('margarethe', 'hold'), 'Ja.');
  assert.equal(Talk.callText('margarethe', 'open'), 'Dann spiele ich eben.');
  assert.equal(Talk.spokenText('Re.'), 'Reh.');
  assert.equal(Talk.spokenText(Talk.callText('oemer', 18)), 'Achtzehn.');
  const tisch = fs.readFileSync(path.join(root, 'public/tisch/tisch.js'), 'utf8');
  assert.match(tisch, /callText\(id, token\) \|\| \(event\.action === 'pass' \? 'Ich passe\.'/);
  assert.match(tisch, /bubble\(event\.seat, event\.action === 'pass' \? 'Passe'/);
});
