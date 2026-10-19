/* Client: Fallback, wenn /api/chat fehlt oder ausfällt. */
const test = require('node:test');
const assert = require('assert');

const Talk = require('../../public/skat/js/talk.js').SkatTalk;

function jsonRes(body, ok) {
  return { ok: ok !== false, status: ok === false ? 503 : 200, json: async () => body, blob: async () => new Blob() };
}

test.describe('askAI und speakAI', { concurrency: 1 }, () => {
  let realFetch;
  let realCreate;
  test.beforeEach(() => {
    realFetch = global.fetch;
    realCreate = URL.createObjectURL;
    Talk.resetForTests();
  });
  test.afterEach(() => {
    global.fetch = realFetch;
    URL.createObjectURL = realCreate;
  });

  test('ohne erreichbare API bleibt der feste Spruch, danach kein weiterer Versuch', async () => {
    let calls = 0;
    global.fetch = async () => {
      calls += 1;
      return jsonRes({}, false);
    };
    const first = await Talk.askAI('horst', { message: 'hallo' });
    assert.ok(Talk.REPLIES.horst.greet.includes(first));
    const seen = calls;
    assert.equal(seen, 2);
    const second = await Talk.askAI('horst', { message: 'hallo nochmal' });
    assert.ok(Talk.REPLIES.horst.greet.includes(second));
    assert.equal(calls, seen);
  });

  test('Antwort vom Server ersetzt den festen Spruch', async () => {
    const seen = [];
    global.fetch = async (url, opts) => {
      seen.push(url);
      if (!opts || opts.method !== 'POST') return jsonRes({ ok: true });
      const body = JSON.parse(opts.body);
      assert.equal(body.character, 'horst');
      assert.equal(body.message, 'Was ist das für ein Blatt?');
      assert.equal(body.game.game, 'Grand');
      return jsonRes({ text: 'Det Blatt ist ein Witz, Kollege.' });
    };
    const text = await Talk.askAI('horst', {
      message: 'Was ist das für ein Blatt?',
      game: { phase: 'play', declarer: 0, game: 'Grand', scores: [0, 0, 0] },
    });
    assert.equal(text, 'Det Blatt ist ein Witz, Kollege.');
    assert.deepEqual(seen, ['/api/chat', '/api/chat']);
  });

  test('zweiter Pfad auf App Platform und Verlauf der letzten Runden', async () => {
    const posts = [];
    global.fetch = async (url, opts) => {
      if (!opts || opts.method !== 'POST') {
        if (url === '/api/chat') return jsonRes({}, false);
        return jsonRes({ ok: true });
      }
      posts.push(JSON.parse(opts.body));
      assert.equal(url, '/api/default/chat');
      return jsonRes({ text: posts.length === 1 ? 'Na jut.' : 'Nu aber.' });
    };
    assert.equal(await Talk.askAI('horst', { message: 'erste Frage' }), 'Na jut.');
    assert.equal(await Talk.askAI('margarethe', { message: 'zweite Frage' }), 'Nu aber.');
    assert.equal(posts[1].history.length >= 2, true);
    assert.equal(posts[1].history.some((turn) => turn.text === 'Na jut.'), true);
    assert.ok(posts[1].history.length <= 6);
  });

  test('zwei fehlgeschlagene Antworten schalten für den Besuch ab', async () => {
    let posts = 0;
    global.fetch = async (url, opts) => {
      if (!opts || opts.method !== 'POST') return jsonRes({ ok: true });
      posts += 1;
      return jsonRes({}, false);
    };
    const a = await Talk.askAI('horst', { message: 'hallo' });
    const b = await Talk.askAI('horst', { message: 'hallo' });
    assert.ok(Talk.REPLIES.horst.greet.includes(a));
    assert.ok(Talk.REPLIES.horst.greet.includes(b));
    assert.equal(posts, 2);
    await Talk.askAI('horst', { message: 'hallo' });
    assert.equal(posts, 2);
  });

  test('speakAI liefert eine Objekt-URL und bleibt stumm, wenn abgeschaltet', async () => {
    global.fetch = async (url, opts) => {
      if (!opts || opts.method !== 'POST') return jsonRes({ ok: true });
      assert.equal(url, '/api/tts');
      return { ok: true, status: 200, blob: async () => new Blob([Uint8Array.from([1, 2, 3, 4])]) };
    };
    URL.createObjectURL = () => 'blob:mock-horst';
    assert.equal(await Talk.speakAI('horst', 'Ein ganz neuer Satz.'), 'blob:mock-horst');
    Talk.disableLive();
    let calls = 0;
    global.fetch = async () => { calls += 1; throw new Error('aus'); };
    assert.equal(await Talk.speakAI('horst', 'Noch ein Satz.'), null);
    assert.equal(calls, 0);
  });
});
