const test = require('node:test');
const assert = require('node:assert/strict');
const Talk = require('../../public/doppelkopf/js/talk.js');

test('Rüdiger hat mindestens 30 feste Sätze und eine Stimme in der Runde', async () => {
  assert.ok(Talk.countLines('ruediger') >= 30);
  assert.equal(typeof Talk.LINES.ruediger, 'object');
  const sample = Talk.cannedReply('ruediger', 'Hömma Rüdiger');
  assert.equal(typeof sample, 'string');
  assert.ok(sample.length > 0);
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../public/doppelkopf/js/talk.js'), 'utf8');
  const voice = require('fs').readFileSync(require('path').join(__dirname, '../../public/doppelkopf/js/voice.js'), 'utf8');
  const seats = require('fs').readFileSync(require('path').join(__dirname, '../../public/doppelkopf/js/seats.js'), 'utf8');
  assert.match(src, /ruediger:\s*1/);
  assert.doesNotMatch(src, /grok|xai|openai|elevenlabs/i);
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
  assert.match(voice, /Talk\.speakAI/);
  assert.match(voice, /ruediger:\s*1/);
  assert.match(seats, /id: 'ruediger'.*voice: true/);
  Talk.resetForTests();
  const prev = global.fetch;
  global.fetch = async () => ({ ok: false, json: async () => ({}) });
  try {
    const text = await Talk.askAI('ruediger', { message: 'Noch ein Pils?' });
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 0);
    Talk.resetForTests();
    global.fetch = async (url, opts) => {
      if (!opts || opts.method !== 'POST') return { ok: true, json: async () => ({ ok: true }) };
      assert.equal(JSON.parse(opts.body).character, 'ruediger');
      return { ok: true, json: async () => ({ text: 'Hömma, erst die Regel.' }) };
    };
    assert.equal(await Talk.askAI('ruediger', { message: 'Noch ein Pils?' }), 'Hömma, erst die Regel.');
  } finally {
    global.fetch = prev;
    Talk.resetForTests();
  }
});

test('Re bleibt in den Sprüchen stehen und wird nur zum Sprechen Reh', () => {
  assert.ok(Talk.LINES.horst.re.some((line) => line.startsWith('Re!')));
  assert.ok(Talk.LINES.margarethe.re.some((line) => line.startsWith('Re,')));
  assert.equal(Talk.spokenText('Re! Und wehe, der Partner pennt.'), 'Reh! Und wehe, der Partner pennt.');
  assert.equal(Talk.spokenText('Re, Schätzchen. Haltung bewahren.'), 'Reh, Schätzchen. Haltung bewahren.');
  assert.equal(Talk.spokenText('Armut auf dem Tisch. Tauschen, ansagen, und dann sind wir Re.'), 'Armut auf dem Tisch. Tauschen, ansagen, und dann sind wir Reh.');
  assert.equal(Talk.spokenText('Kontra. Die Damen sitzen falsch.'), 'Kontra. Die Damen sitzen falsch.');
  assert.equal(Talk.spokenText('Ich bin der aus dem Pott mit rheinischem Herzen.'), 'Ich bin der aus dem Pott mit rheinischem Herzen.');
  assert.equal(Talk.spokenText(Talk.spokenText('Re.')), 'Reh.');
  const voice = require('fs').readFileSync(require('path').join(__dirname, '../../public/doppelkopf/js/voice.js'), 'utf8');
  assert.match(voice, /function forSpeech\(text\)/);
  assert.match(voice, /forSpeech\(opts\.speech \|\| text\)/);
  for (const who of Object.keys(Talk.LINES)) {
    for (const lines of Object.values(Talk.LINES[who])) {
      for (const line of lines) {
        assert.equal(Talk.spokenText(Talk.spokenText(line)), Talk.spokenText(line));
        assert.equal(line.includes('Kontra'), Talk.spokenText(line).includes('Kontra'));
      }
    }
  }
});

test('Stichwort Rüdiger landet bei Rüdiger, Horst bei Horst', () => {
  assert.deepEqual(Talk.responders('Rüdiger, noch ein Pils'), ['ruediger']);
  assert.deepEqual(Talk.responders('Horst, das war mies'), ['horst']);
  assert.deepEqual(Talk.responders('Margarethe, die Perlen'), ['margarethe']);
});
