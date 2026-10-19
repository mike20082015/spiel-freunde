const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Talk = require('../../public/romme/js/talk.js');

test('Oma Hilde hat mindestens 30 feste Sätze und keine Stimme über die Schnittstelle', () => {
  assert.ok(Talk.countLines('oma-hilde') >= 30);
  assert.equal(typeof Talk.LINES['oma-hilde'], 'object');
  const sample = Talk.cannedReply('oma-hilde', 'Hallo Oma');
  assert.equal(typeof sample, 'string');
  assert.ok(sample.length > 0);
  const src = fs.readFileSync(path.join(__dirname, '../../public/romme/js/talk.js'), 'utf8');
  assert.match(src, /character !== 'horst' && character !== 'margarethe'/);
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
  assert.doesNotMatch(src, /grok|xai|openai|elevenlabs/i);
  let fetched = 0;
  global.fetch = () => { fetched += 1; return Promise.resolve({ ok: false }); };
  return Talk.askAI('oma-hilde', { message: 'Kaffee?' }).then((text) => {
    assert.equal(fetched, 0);
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
    return Talk.speakAI('oma-hilde', text);
  }).then((audio) => {
    assert.equal(audio, null);
    assert.equal(fetched, 0);
    delete global.fetch;
  });
});

test('Stichwort Oma landet bei Hilde, nicht bei den beiden anderen', () => {
  assert.deepEqual(Talk.responders('Oma Hilde, noch Kaffee?'), ['oma-hilde']);
  assert.deepEqual(Talk.responders('Horst, das war mies'), ['horst']);
  assert.deepEqual(Talk.responders('Margarethe, die Perlen'), ['margarethe']);
});
