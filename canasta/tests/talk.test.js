const test = require('node:test');
const assert = require('node:assert/strict');
const Talk = require('../../public/canasta/js/talk.js');

test('Oma Hilde hat mindestens 30 feste Sätze und keine Stimme in der Runde', () => {
  assert.ok(Talk.countLines('hilde') >= 30);
  assert.equal(typeof Talk.LINES.hilde, 'object');
  const sample = Talk.cannedReply('hilde', 'Hallo Oma');
  assert.equal(typeof sample, 'string');
  assert.ok(sample.length > 0);
});

test('Oma Hilde geht nicht an die Schnittstelle, Horst schon als Figur', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../public/canasta/js/talk.js'), 'utf8');
  assert.match(src, /character !== 'horst' && character !== 'margarethe'/);
  assert.doesNotMatch(src, /grok|xai|openai|elevenlabs/i);
  return Talk.askAI('hilde', { message: 'Kaffee?' }).then((text) => {
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
  });
});

test('Stichwort Oma landet bei Hilde, nicht bei den beiden anderen', () => {
  assert.deepEqual(Talk.responders('Oma Hilde, noch Kaffee?'), ['hilde']);
  assert.deepEqual(Talk.responders('Horst, das war mies'), ['horst']);
});
