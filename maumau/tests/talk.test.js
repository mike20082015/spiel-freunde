const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Talk = require('../../public/maumau/js/talk.js');

test('Lena und Rüdiger haben feste Sätze und eine Stimme in der Runde', async () => {
  assert.ok(Talk.countLines('lena') >= 30);
  const sample = Talk.cannedReply('lena', 'Hallo Lena');
  assert.equal(typeof sample, 'string');
  assert.ok(sample.length > 8);
  const src = fs.readFileSync(path.join(__dirname, '../../public/maumau/js/talk.js'), 'utf8');
  const voice = fs.readFileSync(path.join(__dirname, '../../public/maumau/js/voice.js'), 'utf8');
  const seats = fs.readFileSync(path.join(__dirname, '../../public/maumau/js/seats.js'), 'utf8');
  assert.match(src, /lena:\s*1/);
  assert.match(src, /ruediger:\s*1/);
  assert.doesNotMatch(src, /grok|xai|openai|elevenlabs/i);
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
  assert.match(voice, /Talk\.speakAI/);
  assert.match(voice, /lena:\s*1/);
  assert.match(voice, /ruediger:\s*1/);
  assert.match(seats, /id: 'lena'.*voice: true/);
  assert.match(seats, /id: 'ruediger'.*voice: true/);
  Talk.resetForTests();
  const prev = global.fetch;
  global.fetch = async () => ({ ok: false, json: async () => ({}) });
  try {
    const text = await Talk.askAI('lena', { message: 'Hallo Lena, wie geht Mau?' });
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
    Talk.resetForTests();
    global.fetch = async (url, opts) => {
      if (!opts || opts.method !== 'POST') return { ok: true, json: async () => ({ ok: true }) };
      assert.equal(JSON.parse(opts.body).character, 'lena');
      assert.equal(url, '/api/sf/chat');
      return { ok: true, json: async () => ({ text: 'Moin! Mau geht gut.' }) };
    };
    assert.equal(await Talk.askAI('lena', { message: 'Hallo Lena' }), 'Moin! Mau geht gut.');
  } finally {
    global.fetch = prev;
    Talk.resetForTests();
  }
});

test('Stichwort Lena landet bei Lena, Horst bei Horst, Margarethe bei Margarethe', () => {
  assert.deepEqual(Talk.responders('Lena, wie war die Vorlesung?'), ['lena']);
  assert.deepEqual(Talk.responders('Horst, das war mies'), ['horst']);
  assert.deepEqual(Talk.responders('Margarethe, die Perlen'), ['margarethe']);
  assert.deepEqual(Talk.responders('Rüdiger, noch ein Pils'), ['ruediger']);
});

test('die Seite folgt dem Tisch, dem Rundenlimit und der Fußzeile', () => {
  const html = fs.readFileSync(path.join(__dirname, '../../public/maumau/index.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../../public/maumau/js/app.js'), 'utf8');
  const home = fs.readFileSync(path.join(__dirname, '../../public/index.html'), 'utf8');
  assert.doesNotMatch(html, /\(Vorschau\)/);
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
  const seats = fs.readFileSync(path.join(__dirname, '../../public/maumau/js/seats.js'), 'utf8');
  assert.match(app, /SpielpartnerRounds\.gate/);
  assert.match(app, /SpielpartnerRounds\.finish/);
  assert.match(app, /playerSeat/);
  assert.match(seats, /\/media\/spielpartner\//);
  assert.match(home, /<b>Spiele<\/b>[\s\S]*href="\/maumau\/"/);
  const beforeTitle = home.split('<h3>Mau-Mau</h3>')[0];
  const card = beforeTitle.slice(beforeTitle.lastIndexOf('<article'));
  assert.match(card, /<span class="badge">Neu<\/span>/);
  assert.match(home, /href="\/maumau\/"/);
  assert.equal(html.includes('Michael Manns'), false);
  assert.equal(html.includes('Michael Schaller'), false);
  assert.equal(html.includes('Chiang Mai'), false);
});
