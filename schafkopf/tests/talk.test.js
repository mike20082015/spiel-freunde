const test = require('node:test');
const assert = require('node:assert/strict');
const Talk = require('../../public/schafkopf/js/talk.js');

test('Sepp hat mindestens 30 feste Sätze und keine Stimme in der Runde', () => {
  assert.ok(Talk.countLines('sepp') >= 30);
  assert.equal(typeof Talk.LINES.sepp, 'object');
  const sample = Talk.cannedReply('sepp', 'Servus Sepp');
  assert.equal(typeof sample, 'string');
  assert.ok(sample.length > 0);
});

test('Sepp geht nicht an die Schnittstelle, Horst schon als Figur', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../public/schafkopf/js/talk.js'), 'utf8');
  assert.match(src, /character !== 'horst' && character !== 'margarethe'/);
  assert.doesNotMatch(src, /grok|xai|openai|elevenlabs/i);
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
  return Talk.askAI('sepp', { message: 'No a Maß?' }).then((text) => {
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
  });
});

test('Stichwort Sepp landet beim Wirt, Horst bei Horst', () => {
  assert.deepEqual(Talk.responders('Sepp, no a Maß'), ['sepp']);
  assert.deepEqual(Talk.responders('Horst, das war mies'), ['horst']);
  assert.deepEqual(Talk.responders('Margarethe, die Perlen'), ['margarethe']);
});
