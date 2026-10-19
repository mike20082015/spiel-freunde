const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Talk = require('../../public/elfer-raus/js/talk.js');

test('Oma Hilde, Lena und Jonas haben feste Sätze und eine Stimme in der Runde', async () => {
  assert.ok(Talk.countLines('hilde') >= 30);
  assert.ok(Talk.countLines('lena') >= 30);
  assert.ok(Talk.countLines('jonas') >= 30);
  const sample = Talk.cannedReply('hilde', 'Hallo Oma');
  assert.equal(typeof sample, 'string');
  assert.ok(sample.length > 8);
  const src = fs.readFileSync(path.join(__dirname, '../../public/elfer-raus/js/talk.js'), 'utf8');
  const voice = fs.readFileSync(path.join(__dirname, '../../public/elfer-raus/js/voice.js'), 'utf8');
  const seats = fs.readFileSync(path.join(__dirname, '../../public/elfer-raus/js/seats.js'), 'utf8');
  assert.match(src, /hilde:\s*1/);
  assert.match(src, /lena:\s*1/);
  assert.match(src, /jonas:\s*1/);
  assert.doesNotMatch(src, /grok|xai|openai|elevenlabs/i);
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
  assert.match(voice, /Talk\.speakAI/);
  assert.match(voice, /hilde:\s*1/);
  assert.match(voice, /lena:\s*1/);
  assert.match(voice, /jonas:\s*1/);
  assert.match(seats, /id: 'hilde'.*voice: true/);
  assert.match(seats, /id: 'lena'.*voice: true/);
  assert.match(seats, /id: 'jonas'.*voice: true/);
  Talk.resetForTests();
  const prev = global.fetch;
  global.fetch = async () => ({ ok: false, json: async () => ({}) });
  try {
    const text = await Talk.askAI('jonas', { message: 'Hallo Jonas, wo ist die Elf?' });
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
    Talk.resetForTests();
    global.fetch = async (url, opts) => {
      if (!opts || opts.method !== 'POST') return { ok: true, json: async () => ({ ok: true }) };
      assert.equal(JSON.parse(opts.body).character, 'jonas');
      assert.equal(url, '/api/sf/chat');
      return { ok: true, json: async () => ({ text: 'Die Elf liegt in der Mitte.' }) };
    };
    assert.equal(await Talk.askAI('jonas', { message: 'Hallo Jonas' }), 'Die Elf liegt in der Mitte.');
  } finally {
    global.fetch = prev;
    Talk.resetForTests();
  }
});

test('Stichwort Oma Hilde landet bei Hilde, Lena bei Lena, Jonas bei Jonas', () => {
  assert.deepEqual(Talk.responders('Oma Hilde, die Elf'), ['hilde']);
  assert.deepEqual(Talk.responders('Lena, die nächste Zahl'), ['lena']);
  assert.deepEqual(Talk.responders('Jonas, Blau ist noch zu'), ['jonas']);
});

test('die Seite folgt dem Tisch, dem Rundenlimit und der Fußzeile', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../public/elfer-raus/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../../public/elfer-raus/js/app.js'), 'utf8');
  const home = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf8');
  assert.match(html, /Vorschau/);
  assert.match(html, /Ein Angebot der Interconsult LLC/);
  assert.match(html, /href="\/impressum\.html"/);
  assert.match(html, /href="\/datenschutz\.html"/);
  assert.match(html, /href="\/agb\.html"/);
  assert.match(html, /href="\/widerruf\.html"/);
  assert.match(html, /href="\/partnerprogramm\/"/);
  assert.match(html, /id="modal-paywall"/);
  assert.match(html, /entitlement\.js/);
  assert.match(html, /offer\.js/);
  assert.match(html, /checkout\.js/);
  assert.match(html, /paywall\.js/);
  assert.match(html, /rounds\.js/);
  assert.match(html, /avatar-store\.js/);
  assert.match(html, /lineup\.js/);
  assert.match(html, /stimmen\.js/);
  assert.match(html, /runde\.js/);
  const seats = fs.readFileSync(path.join(__dirname, '../../public/elfer-raus/js/seats.js'), 'utf8');
  assert.match(app, /SpielpartnerRounds\.gate/);
  assert.match(app, /SpielpartnerRounds\.finish/);
  assert.match(app, /SpielpartnerRunde\.mount/);
  assert.match(app, /game: 'elfer-raus'/);
  assert.match(app, /playerSeat/);
  assert.match(seats, /\/media\/spielpartner\//);
  assert.match(home, /<b>Spiele<\/b>[\s\S]*href="\/elfer-raus\/"/);
  const beforeTitle = home.split('<h3>Elfer raus</h3>')[0];
  const card = beforeTitle.slice(beforeTitle.lastIndexOf('<article'));
  assert.match(card, /<span class="badge">Neu<\/span>/);
  assert.match(home, /href="\/elfer-raus\/">Elfer raus spielen/);
  assert.equal(html.includes('Michael Manns'), false);
  assert.equal(html.includes('Michael Schaller'), false);
  assert.equal(html.includes('Chiang Mai'), false);
});
