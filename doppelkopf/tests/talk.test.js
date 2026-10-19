const test = require('node:test');
const assert = require('node:assert/strict');
const Talk = require('../../public/doppelkopf/js/talk.js');

test('Rüdiger hat mindestens 30 feste Sätze und keine Stimme in der Runde', () => {
  assert.ok(Talk.countLines('ruediger') >= 30);
  assert.equal(typeof Talk.LINES.ruediger, 'object');
  const sample = Talk.cannedReply('ruediger', 'Hömma Rüdiger');
  assert.equal(typeof sample, 'string');
  assert.ok(sample.length > 0);
});

test('Rüdiger geht nicht an die Schnittstelle, Horst schon als Figur', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../public/doppelkopf/js/talk.js'), 'utf8');
  const voice = require('fs').readFileSync(require('path').join(__dirname, '../../public/doppelkopf/js/voice.js'), 'utf8');
  assert.match(src, /character !== 'horst' && character !== 'margarethe'/);
  assert.doesNotMatch(src, /grok|xai|openai|elevenlabs/i);
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
  assert.match(voice, /\/api\/sf\/tts|Talk\.speakAI/);
  assert.doesNotMatch(voice, /ruediger:\s*1/);
  return Talk.askAI('ruediger', { message: 'Noch ein Pils?' }).then((text) => {
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
  });
});

test('Stichwort Rüdiger landet bei Rüdiger, Horst bei Horst', () => {
  assert.deepEqual(Talk.responders('Rüdiger, noch ein Pils'), ['ruediger']);
  assert.deepEqual(Talk.responders('Horst, das war mies'), ['horst']);
  assert.deepEqual(Talk.responders('Margarethe, die Perlen'), ['margarethe']);
});
