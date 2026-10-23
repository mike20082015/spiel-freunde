/* Vorrat, Beutel und Abstand der Tischsprüche. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const Sprueche = require('../../public/assets/sprueche.js');
const root = path.join(__dirname, '../..');

const SITS = ['greetings', 'bidding', 'winning', 'losing', 'goodMove', 'badLuck', 'banter'];
/* Vorher hatte die gemeinsame Bank je Lage genau eine Zeile. */
const BEFORE = 1;

function store() {
  const mem = {};
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null; },
    setItem(key, value) { mem[key] = String(value); },
    removeItem(key) { delete mem[key]; },
    mem,
  };
}

test('jede Figur hat in jeder Lage mindestens viermal so viele Sprüche', () => {
  assert.equal(Sprueche.characters.length, 11);
  for (const id of Sprueche.characters) {
    for (const sit of SITS) {
      const lines = Sprueche.pool(id, sit);
      assert.ok(lines.length >= BEFORE * 4, id + ' ' + sit + ' ' + lines.length);
      assert.ok(lines.length >= 12, id + ' ' + sit);
      const seen = new Set(lines);
      assert.equal(seen.size, lines.length, id + ' ' + sit);
      for (const line of lines) {
        assert.doesNotMatch(line, /—|–/);
        assert.doesNotMatch(line, /grok|openai|eleven|xai|politik|partei|einkommen/i);
      }
    }
  }
});

test('der Beutel wiederholt eine Zeile nicht, bis der Vorrat weitgehend aufgebraucht ist', () => {
  const box = store();
  Sprueche.reset({ store: box, wipe: true });
  const pool = Sprueche.pool('horst', 'greetings');
  const seen = [];
  for (let i = 0; i < pool.length; i++) {
    const line = Sprueche.line('horst', 'welcome', [], () => 0.17);
    assert.ok(line);
    assert.equal(seen.includes(line), false, line);
    seen.push(line);
  }
  assert.equal(seen.length, pool.length);
  const saved = JSON.parse(box.mem['sf-sprueche-v1']);
  assert.ok(saved.recent.horst.length >= pool.length - 1);
});

test('zwei Avatare sagen nicht denselben Satz direkt hintereinander', () => {
  Sprueche.reset({ store: store(), wipe: true });
  const shared = ['Gleicher Spruch am Tisch heute', 'Zweite Zeile nur für den Beutel'];
  const first = Sprueche.line('gast-a', 'welcome', shared, () => 0);
  const second = Sprueche.line('gast-b', 'welcome', shared, () => 0);
  assert.notEqual(first, second);
  assert.ok(shared.includes(first));
  assert.ok(shared.includes(second));
});

test('Reizworte kommen aus dem Beutel und hängen nicht am ersten Satz', () => {
  const box = store();
  Sprueche.reset({ store: box, wipe: true });
  for (const id of Sprueche.characters) {
    for (const token of ['pass', 'hold', 'open']) {
      const lines = Sprueche.callPool(id, token);
      assert.ok(lines.length >= 8, id + ' ' + token + ' ' + lines.length);
      assert.equal(new Set(lines).size, lines.length, id + ' ' + token);
      for (const line of lines) {
        assert.doesNotMatch(line, /—|–/);
        assert.doesNotMatch(line, /grok|openai|eleven|xai|politik|partei|einkommen/i);
      }
    }
  }
  assert.ok(Sprueche.callPool('horst', 'pass').includes('Weg.'));
  assert.ok(Sprueche.callPool('horst', 'hold').includes('Jo.'));
  assert.ok(Sprueche.callPool('horst', 'open').includes('Na jut, ick spiele.'));
  assert.ok(Sprueche.callPool('margarethe', 'open').includes('Dann spiele ich eben.'));
  assert.ok(Sprueche.callPool('oemer', 'pass').includes('Ich passe.'));
  const seen = [];
  const pool = Sprueche.callPool('horst', 'pass');
  for (let i = 0; i < pool.length; i++) {
    const line = Sprueche.call('horst', 'pass', ['Weg.'], () => 0.17);
    assert.equal(seen.includes(line), false, line);
    seen.push(line);
  }
  assert.equal(seen.length, pool.length);
  assert.ok(seen.some((line) => line !== 'Weg.'));
});

test('ein Tischspruch fragt gelegentlich den Chat und fällt sonst sofort auf den Beutel zurück', async () => {
  const box = store();
  Sprueche.reset({ store: box, wipe: true });
  let calls = 0;
  const ask = async () => {
    calls += 1;
    return 'Ein frischer freundlicher Satz am Tisch.';
  };
  for (let i = 0; i < 3; i++) {
    const text = await Sprueche.freshComment({
      character: 'sepp', event: 'trick', situation: 'Spieler Sepp. Stich.',
      fallback: () => 'Fest.', ask, timeout: 40,
    });
    assert.equal(text, 'Fest.');
  }
  assert.equal(calls, 0);
  const fresh = await Sprueche.freshComment({
    character: 'sepp', event: 'trick', situation: 'Spieler Sepp. Punkte 4, 8.',
    fallback: () => 'Fest.', ask, timeout: 80,
  });
  assert.equal(calls, 1);
  assert.equal(fresh, 'Ein frischer freundlicher Satz am Tisch.');
  const started = Date.now();
  const slow = await Sprueche.freshComment({
    forceFresh: true,
    timeout: 40,
    fallback: () => 'Sofort der Beutel.',
    ask: () => new Promise((resolve) => setTimeout(() => resolve('Zu spät für diesen Stich gesagt.'), 180)),
  });
  assert.equal(slow, 'Sofort der Beutel.');
  assert.ok(Date.now() - started < 150, String(Date.now() - started));
  const blocked = await Sprueche.freshComment({
    forceFresh: true,
    timeout: 40,
    fallback: () => 'Beutel bleibt.',
    ask: async () => 'Das ist Politik und grok.',
  });
  assert.equal(blocked, 'Beutel bleibt.');
  const long = await Sprueche.freshComment({
    forceFresh: true,
    timeout: 40,
    fallback: () => 'kurz',
    ask: async () => 'eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn',
  });
  assert.ok(long.split(/\s+/).length <= 12, long);
  assert.equal(long.includes('dreizehn'), false);
  Sprueche.reset({ store: store(), wipe: true });
  const seen = [];
  const prev = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    seen.push({ url, body: JSON.parse(opts.body), signal: opts.signal });
    return { ok: true, json: async () => ({ text: 'Frisch gesagt, Sepp.' }) };
  };
  try {
    for (let i = 0; i < 3; i++) {
      await Sprueche.freshComment({ character: 'oma-hilde', event: 'trick', fallback: () => 'Fest.' });
    }
    const posted = await Sprueche.freshComment({
      character: 'oma-hilde',
      event: 'trick',
      situation: 'Spieler Oma Hilde. Stich. Punkte 1, 2.',
      game: { phase: 'play', scores: [1, 2, 0] },
      fallback: () => 'Fest.',
    });
    assert.equal(posted, 'Frisch gesagt, Sepp.');
    assert.equal(seen.length, 1);
    assert.equal(seen[0].url, '/api/sf/chat');
    assert.equal(seen[0].body.purpose, 'remark');
    assert.equal(seen[0].body.character, 'hilde');
    assert.match(seen[0].body.message, /Oma Hilde/);
    assert.deepEqual(seen[0].body.history, []);
    assert.equal(seen[0].body.game.phase, 'play');
  } finally {
    globalThis.fetch = prev;
  }
});

test('Bemerkungen haben Abstand, erzwungene Ansagen bleiben', () => {
  Sprueche.reset({ store: store(), wipe: true });
  assert.equal(Sprueche.allow({ force: true, now: 1000, rng: () => 0 }), true);
  assert.equal(Sprueche.allow({ now: 1000, rng: () => 0 }), false);
  assert.equal(Sprueche.allow({ now: 2000, rng: () => 0.9 }), false);
  assert.equal(Sprueche.allow({ now: 20000, rng: () => 0.9 }), true);
  let quiet = 0;
  let spoken = 0;
  Sprueche.reset({ store: store(), wipe: true });
  let now = 0;
  for (let i = 0; i < 12; i++) {
    now += 800;
    if (Sprueche.allow({ now, rng: () => 0.5 })) spoken += 1;
    else quiet += 1;
  }
  assert.ok(quiet > 0, 'quiet ' + quiet);
  assert.ok(spoken > 0 && spoken < 12, 'spoken ' + spoken);
});

test('die Stimme fällt auf Text zurück und der Cache heißt sf-pwa-v14', () => {
  const games = ['skat', 'doppelkopf', 'bridge', 'jass', 'watten', 'schnapsen', 'romme', 'canasta', 'maumau', 'schafkopf', 'schwimmen', 'elfer-raus'];
  for (const game of games) {
    const voice = fs.readFileSync(path.join(root, 'public', game, 'js/voice.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'public', game, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(root, 'public', game, 'js/app.js'), 'utf8');
    assert.match(voice, /speakAI/, game);
    assert.match(voice, /function holdText/, game);
    assert.doesNotMatch(voice, /speechSynthesis\.speak|synth\.speak\(/, game);
    assert.match(html, /\/assets\/sprueche\.js/, game);
    assert.match(app, /freshComment/, game);
    if (['jass', 'watten', 'schnapsen', 'bridge'].includes(game)) assert.match(app, /function remark/, game);
    else assert.match(app, /SpielpartnerSprueche\.allow/, game);
    assert.match(app, /askAI/, game);
  }
  const stimmen = fs.readFileSync(path.join(root, 'public/spielpartner/stimmen.js'), 'utf8');
  assert.doesNotMatch(stimmen, /speechSynthesis\.speak/);
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(sw, /sf-pwa-v14/);
});
