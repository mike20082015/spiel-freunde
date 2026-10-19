const test = require('node:test');
const assert = require('node:assert/strict');
const Talk = require('../../public/schafkopf/js/talk.js');

test('Sepp hat mindestens 30 feste Sätze und eine Stimme in der Runde', () => {
  assert.ok(Talk.countLines('sepp') >= 30);
  assert.equal(typeof Talk.LINES.sepp, 'object');
  const sample = Talk.cannedReply('sepp', 'Servus Sepp');
  assert.equal(typeof sample, 'string');
  assert.ok(sample.length > 0);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../public/schafkopf/js/talk.js'), 'utf8');
  const voice = require('fs').readFileSync(require('path').join(__dirname, '../../public/schafkopf/js/voice.js'), 'utf8');
  const seats = require('fs').readFileSync(require('path').join(__dirname, '../../public/schafkopf/js/seats.js'), 'utf8');
  assert.match(src, /sepp:\s*1/);
  assert.match(voice, /sepp:\s*1/);
  assert.match(seats, /id: 'sepp'.*voice: true/);
  assert.doesNotMatch(src, /grok|xai|openai|elevenlabs/i);
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
});

test('Sepp fragt die Schnittstelle und fällt auf den festen Spruch zurück', async () => {
  Talk.resetForTests();
  let calls = 0;
  const prev = global.fetch;
  global.fetch = async () => {
    calls += 1;
    return { ok: false, json: async () => ({}) };
  };
  try {
    const text = await Talk.askAI('sepp', { message: 'No a Maß?' });
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
    assert.ok(calls >= 1);
    Talk.resetForTests();
    global.fetch = async (url, opts) => {
      if (!opts || opts.method !== 'POST') return { ok: true, json: async () => ({ ok: true }) };
      const body = JSON.parse(opts.body);
      assert.equal(body.character, 'sepp');
      assert.equal(url, '/api/sf/chat');
      return { ok: true, json: async () => ({ text: 'Mei, passt scho.' }) };
    };
    assert.equal(await Talk.askAI('sepp', { message: 'No a Maß?' }), 'Mei, passt scho.');
  } finally {
    global.fetch = prev;
    Talk.resetForTests();
  }
});

test('Stichwort Sepp landet beim Wirt, Horst bei Horst', () => {
  assert.deepEqual(Talk.responders('Sepp, no a Maß'), ['sepp']);
  assert.deepEqual(Talk.responders('Horst, das war mies'), ['horst']);
  assert.deepEqual(Talk.responders('Margarethe, die Perlen'), ['margarethe']);
});
