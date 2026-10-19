const test = require('node:test');
const assert = require('node:assert/strict');
const Talk = require('../../public/canasta/js/talk.js');

test('Oma Hilde hat mindestens 30 feste Sätze und eine Stimme unter hilde', () => {
  assert.ok(Talk.countLines('hilde') >= 30);
  assert.equal(typeof Talk.LINES.hilde, 'object');
  const sample = Talk.cannedReply('hilde', 'Hallo Oma');
  assert.equal(typeof sample, 'string');
  assert.ok(sample.length > 0);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../public/canasta/js/talk.js'), 'utf8');
  const voice = require('fs').readFileSync(require('path').join(__dirname, '../../public/canasta/js/voice.js'), 'utf8');
  const seats = require('fs').readFileSync(require('path').join(__dirname, '../../public/canasta/js/seats.js'), 'utf8');
  assert.match(src, /hilde:\s*1/);
  assert.match(voice, /hilde:\s*1/);
  assert.match(seats, /id: 'hilde'.*voice: true/);
  assert.doesNotMatch(src, /grok|xai|openai|elevenlabs/i);
});

test('Oma Hilde fragt die Schnittstelle und fällt auf den festen Spruch zurück', async () => {
  Talk.resetForTests();
  const prev = global.fetch;
  global.fetch = async () => ({ ok: false, json: async () => ({}) });
  try {
    const text = await Talk.askAI('hilde', { message: 'Kaffee?' });
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
    Talk.resetForTests();
    global.fetch = async (url, opts) => {
      if (!opts || opts.method !== 'POST') return { ok: true, json: async () => ({ ok: true }) };
      assert.equal(JSON.parse(opts.body).character, 'hilde');
      assert.equal(url, '/api/sf/chat');
      return { ok: true, json: async () => ({ text: 'Der Kaffee ist warm.' }) };
    };
    assert.equal(await Talk.askAI('hilde', { message: 'Kaffee?' }), 'Der Kaffee ist warm.');
  } finally {
    global.fetch = prev;
    Talk.resetForTests();
  }
});

test('Stichwort Oma landet bei Hilde, nicht bei den beiden anderen', () => {
  assert.deepEqual(Talk.responders('Oma Hilde, noch Kaffee?'), ['hilde']);
  assert.deepEqual(Talk.responders('Horst, das war mies'), ['horst']);
});
