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
