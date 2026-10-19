const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Talk = require('../../public/romme/js/talk.js');

test('Oma Hilde hat mindestens 30 feste Sätze und spricht über die Schnittstelle', async () => {
  assert.ok(Talk.countLines('oma-hilde') >= 30);
  assert.equal(typeof Talk.LINES['oma-hilde'], 'object');
  const sample = Talk.cannedReply('oma-hilde', 'Hallo Oma');
  assert.equal(typeof sample, 'string');
  assert.ok(sample.length > 0);
  const src = fs.readFileSync(path.join(__dirname, '../../public/romme/js/talk.js'), 'utf8');
  const voice = fs.readFileSync(path.join(__dirname, '../../public/romme/js/voice.js'), 'utf8');
  assert.match(src, /'oma-hilde':\s*1/);
  assert.match(voice, /'oma-hilde':\s*1/);
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
  assert.doesNotMatch(src, /grok|xai|openai|elevenlabs/i);
  Talk.resetForTests();
  const prev = global.fetch;
  let posts = [];
  global.fetch = (url, opts) => {
    if (!opts || opts.method !== 'POST') return Promise.resolve({ ok: false, json: async () => ({}) });
    posts.push(url);
    return Promise.resolve({ ok: false, json: async () => ({}) });
  };
  try {
    const text = await Talk.askAI('oma-hilde', { message: 'Kaffee?' });
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
    assert.ok(posts.length === 0);
    Talk.resetForTests();
    posts = [];
    global.fetch = (url, opts) => {
      if (!opts || opts.method !== 'POST') return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
      posts.push(JSON.parse(opts.body).character + ' ' + url);
      if (String(url).indexOf('tts') !== -1) {
        return Promise.resolve({ ok: true, blob: async () => ({ size: 4 }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ text: 'Der Kaffee ist warm.' }) });
    };
    const g = global;
    const prevUrl = g.URL && g.URL.createObjectURL;
    if (g.URL) g.URL.createObjectURL = () => 'blob:oma';
    assert.equal(await Talk.askAI('oma-hilde', { message: 'Kaffee?' }), 'Der Kaffee ist warm.');
    assert.equal(await Talk.speakAI('oma-hilde', 'Der Kaffee ist warm.'), 'blob:oma');
    assert.ok(posts.indexOf('oma-hilde /api/sf/chat') !== -1);
    assert.ok(posts.indexOf('oma-hilde /api/sf/tts') !== -1);
    if (g.URL && prevUrl) g.URL.createObjectURL = prevUrl;
  } finally {
    global.fetch = prev;
    Talk.resetForTests();
  }
});

test('Stichwort Oma landet bei Hilde, nicht bei den beiden anderen', () => {
  assert.deepEqual(Talk.responders('Oma Hilde, noch Kaffee?'), ['oma-hilde']);
  assert.deepEqual(Talk.responders('Horst, das war mies'), ['horst']);
  assert.deepEqual(Talk.responders('Margarethe, die Perlen'), ['margarethe']);
});
