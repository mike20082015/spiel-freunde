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

function memStore() {
  const mem = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null; },
    setItem(key, value) { mem[key] = String(value); },
    removeItem(key) { delete mem[key]; },
  };
}

test('jede Figur sagt Reizen auf Deutsch, Horst und Margarethe behalten ihren Ton', () => {
  const Sprueche = require('../../public/assets/sprueche.js');
  Sprueche.reset({ store: memStore(), wipe: true });
  const others = ['lena', 'jonas', 'oemer', 'hilde', 'oma-hilde', 'sepp', 'ruediger', 'chantal', 'urs', 'vreni'];
  for (const who of others) {
    const id = who === 'oma-hilde' ? 'hilde' : who;
    const passPool = Sprueche.callPool(id, 'pass', ['Ich passe.']);
    const holdPool = Sprueche.callPool(id, 'hold', ['Ja.']);
    const openPool = Sprueche.callPool(id, 'open', ['Ich spiele.']);
    const pass = Talk.callText(who, 'pass');
    const hold = Talk.callText(who, 'hold');
    const open = Talk.callText(who, 'open');
    assert.ok(passPool.includes(pass), who + ' ' + pass);
    assert.ok(holdPool.includes(hold), who + ' ' + hold);
    assert.ok(openPool.includes(open), who + ' ' + open);
    assert.ok(passPool.includes('Ich passe.'), who);
    assert.ok(holdPool.includes('Ja.'), who);
    assert.ok(openPool.includes('Ich spiele.'), who);
    assert.equal(Talk.spokenText(pass), pass, who);
    assert.equal(Talk.callText(who, 18), 'Achtzehn.', who);
    assert.equal(Talk.callText(who, '20'), 'Zwanzig.', who);
    assert.equal(Talk.callText(who, 22), 'Zweiundzwanzig.', who);
    assert.equal(Talk.callText(who, 'Grand'), 'Grand!', who);
    assert.equal(Talk.callText(who, 'Null Ouvert'), 'Null Ouvert!', who);
    assert.doesNotMatch(Talk.callText(who, 18), /^\d/, who);
    assert.equal(Talk.allCalls(who).some((row) => row.text === 'Ich passe.'), true, who);
    assert.doesNotMatch(Talk.callText(who, 22), /—/, who);
  }
  Sprueche.reset({ store: memStore(), wipe: true });
  const horstPass = Sprueche.callPool('horst', 'pass', ['Weg.']);
  const horstSeen = new Set();
  for (let i = 0; i < horstPass.length; i++) {
    const line = Talk.callText('horst', 'pass');
    assert.ok(horstPass.includes(line), line);
    horstSeen.add(line);
  }
  assert.equal(horstSeen.size, horstPass.length);
  assert.ok([...horstSeen].some((line) => line !== 'Weg.'));
  const horstHold = Sprueche.callPool('horst', 'hold', ['Jo.']);
  assert.ok(horstHold.includes('Jo.'));
  Sprueche.reset({ store: memStore(), wipe: true });
  const holdSeen = new Set();
  for (let i = 0; i < horstHold.length; i++) holdSeen.add(Talk.callText('horst', 'hold'));
  assert.equal(holdSeen.size, horstHold.length);
  assert.ok([...holdSeen].some((line) => line !== 'Jo.'));
  const greteOpen = Sprueche.callPool('margarethe', 'open', ['Dann spiele ich eben.']);
  assert.ok(greteOpen.includes('Dann spiele ich eben.'));
  assert.ok(Sprueche.callPool('margarethe', 'pass', ['Ich passe.']).includes('Ich passe.'));
  assert.ok(Sprueche.callPool('margarethe', 'hold', ['Ja.']).includes('Ja.'));
  Sprueche.reset({ store: memStore(), wipe: true });
  const openSeen = new Set();
  for (let i = 0; i < greteOpen.length; i++) openSeen.add(Talk.callText('margarethe', 'open'));
  assert.equal(openSeen.size, greteOpen.length);
  assert.ok([...openSeen].some((line) => line !== 'Dann spiele ich eben.'));
  assert.equal(Talk.callText('horst', 18), 'Achtzehn.');
  assert.equal(Talk.callText('horst', 'Grand'), 'Grand!');
  assert.equal(Talk.spokenText('Re.'), 'Reh.');
  assert.equal(Talk.spokenText(Talk.callText('oemer', 18)), 'Achtzehn.');
  const tisch = fs.readFileSync(path.join(root, 'public/tisch/tisch.js'), 'utf8');
  assert.match(tisch, /callText\(id, token\) \|\| \(event\.action === 'pass' \? 'Ich passe\.'/);
  assert.match(tisch, /bubble\(event\.seat, event\.action === 'pass' \? 'Passe'/);
});
