/* Server: Eingabe, Persona, Grenzen. Aufruf über `node --test tests/`. */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const H = require('../../api/lib/handlers');

const ENV = {
  XAI_API_KEY: 'test-key',
  ELEVENLABS_API_KEY: 'test-eleven',
  VOICE_HORST: 'MockHorstVoice01',
  XAI_MODEL: 'grok-4.3',
  ELEVEN_MODEL: 'eleven_flash_v2_5',
  DAILY_LIMIT: '50',
};

function event(method, body, extra) {
  return Object.assign({
    http: {
      method,
      headers: Object.assign({ origin: 'https://spiel-freunde.com' }, (extra && extra.headers) || {}),
      body: body == null ? '' : JSON.stringify(body),
    },
  }, extra && extra.fields);
}

function chatDeps(fetchImpl, env) {
  return { env: env || ENV, fetch: fetchImpl, now: () => 1700000000000 };
}

test.describe('Tisch-API', { concurrency: 1 }, () => {
  test.beforeEach(() => H.resetLimits());

  test('Persona bleibt in der Rolle und nennt keinen Anbieter', () => {
    assert.match(H.PERSONA.horst, /Stinkstiefel/);
    assert.match(H.PERSONA.horst, /Berliner Mundart/);
    assert.match(H.PERSONA.margarethe, /Schätzchen/);
    assert.match(H.PERSONA.margarethe, /von Hohenfels/);
    assert.doesNotMatch(H.PERSONA.horst + H.PERSONA.margarethe, /grok|elevenlabs|openai|x\.?ai/i);
  });

  test('nur öffentlicher Spielstand landet im Prompt', () => {
    const parsed = H.validateChat({
      character: 'horst',
      message: 'Was liegt im Skat?',
      game: {
        phase: 'play', declarer: 1, game: 'Grand', scores: [10, 20, -30],
        hands: ['VERDECKT-PIK-ASS'], skat: ['VERDECKT-KARO'],
      },
      history: [
        { role: 'du', text: 'Moin' },
        { role: 'gast', text: 'VERDECKT-HISTORIE' },
        { role: 'horst', text: 'Na.' },
        { role: 'user', text: 'x'.repeat(500) },
      ],
    });
    assert.equal(parsed.ok, true);
    assert.equal(parsed.value.game.hands, undefined);
    assert.equal(parsed.value.history.length, 3);
    assert.equal(parsed.value.history[2].text.length, 300);
    const body = H.buildChatBody(parsed.value, {});
    const blob = JSON.stringify(body);
    assert.equal(body.max_tokens, 80);
    assert.equal(body.model, 'grok-4.3');
    assert.equal(body.temperature, 0.7);
    assert.deepEqual(Object.keys(body).sort(), ['max_tokens', 'messages', 'model', 'temperature']);
    assert.equal(body.reasoning_effort, undefined);
    assert.equal(body.search_parameters, undefined);
    assert.equal(body.max_completion_tokens, undefined);
    assert.equal(body.n, undefined);
    assert.match(blob, /Grand/);
    assert.match(blob, /Alleinspieler: Horst/);
    assert.match(blob, /Horst 20/);
    assert.match(blob, /Phase Spiel/);
    assert.doesNotMatch(blob, /VERDECKT/);
    assert.equal(body.messages[0].role, 'system');
    assert.equal(body.messages[1].role, 'user');
    assert.equal(body.messages[2].role, 'assistant');
    const other = H.buildChatBody(Object.assign({}, parsed.value, { character: 'margarethe' }), { XAI_MODEL: 'grok-4.7' });
    assert.equal(other.model, 'grok-4.7');
    assert.equal(other.reasoning_effort, undefined);
    assert.deepEqual(Object.keys(other).sort(), ['max_tokens', 'messages', 'model', 'temperature']);
    assert.match(other.messages[0].content, /Schätzchen/);
    assert.equal(other.messages[2].content, 'Horst sagt: Na.');
  });

  test('ungültige Eingabe wird 503, ohne Aufruf nach außen', async () => {
    let calls = 0;
    const fetchImpl = async () => { calls += 1; throw new Error('nicht rufen'); };
    const tooLong = await H.handleChat(event('POST', { character: 'horst', message: 'a'.repeat(301) }), chatDeps(fetchImpl));
    assert.equal(tooLong.status, 503);
    assert.equal(tooLong.json.reason, 'invalid_input');
    const bad = await H.handleChat(event('POST', { character: 'fremd', message: 'hallo' }), chatDeps(fetchImpl));
    assert.equal(bad.status, 503);
    const empty = await H.handleChat(event('POST', { character: 'horst', message: '   ' }), chatDeps(fetchImpl));
    assert.equal(empty.status, 503);
    assert.equal(calls, 0);
    assert.equal(JSON.stringify(tooLong.json).includes('x.ai'), false);
  });

  test('Gesundheit, Antwort und Fehler bleiben ohne Schlüsseldetails', async () => {
    const missing = await H.handleChat(event('GET'), chatDeps(async () => { throw new Error('nein'); }, { XAI_API_KEY: '' }));
    assert.equal(missing.status, 503);
    assert.equal(missing.json.reason, 'no_key');
    const health = await H.handleChat(event('GET'), chatDeps(async () => { throw new Error('nein'); }));
    assert.equal(health.status, 200);
    assert.deepEqual(health.json, { ok: true });
    assert.equal(health.headers['Access-Control-Allow-Origin'], 'https://spiel-freunde.com');

    let sent;
    const ok = await H.handleChat(event('POST', {
      character: 'horst',
      message: '  Na,   wie läuft es?  ',
      game: { phase: 'bidding', declarer: null, scores: [0, 4, 0] },
    }), chatDeps(async (url, options) => {
      sent = { url, options };
      assert.ok(options.signal);
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Erster Satz. Zweiter Satz. Dritter Satz, der weg muss.' } }] }) };
    }));
    assert.equal(ok.status, 200);
    assert.equal(ok.json.text, 'Erster Satz. Zweiter Satz.');
    assert.equal(sent.url, H.CHAT_URL);
    assert.equal(sent.options.headers.Authorization, 'Bearer test-key');
    assert.equal(sent.options.body.includes('test-key'), false);

    const slipped = await H.handleChat(event('POST', { character: 'margarethe', message: 'Wer bist du?' }), chatDeps(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Ich bin ein Sprachmodell von Grok.' } }] }),
    })));
    assert.equal(slipped.status, 503);
    assert.equal(slipped.json.reason, 'filtered');
    assert.equal(JSON.stringify(slipped.json).includes('Grok'), false);

    const logs = [];
    const prevErr = console.error;
    console.error = function () { logs.push(Array.prototype.slice.call(arguments)); };
    let down;
    try {
      down = await H.handleChat(event('POST', { character: 'horst', message: 'hallo' }), chatDeps(async () => ({
        ok: false,
        status: 401,
        headers: { get: () => 'application/json', Authorization: 'Bearer test-key' },
        json: async () => ({ error: 'SUPERSECRET test-key' }),
      })));
    } finally {
      console.error = prevErr;
    }
    assert.equal(down.status, 503);
    assert.equal(down.json.reason, 'upstream_401');
    assert.equal(JSON.stringify(down.json).includes('SUPERSECRET'), false);
    assert.equal(JSON.stringify(down.json).includes('test-key'), false);
    assert.equal(logs.length, 1);
    assert.deepEqual(logs[0].slice(0, 2), ['upstream', 401]);
    assert.match(logs[0][2], /SUPERSECRET/);
    assert.equal(String(logs[0][2]).includes('test-key'), false);
    assert.equal(JSON.stringify(logs[0]).includes('Authorization'), false);
    assert.equal(JSON.stringify(logs[0]).includes('Bearer'), false);
  });

  test('langes Gerede wird auf zwei Sätze und 40 Wörter gekürzt', () => {
    const words = [];
    for (let i = 0; i < 50; i++) words.push('wort' + i);
    const cut = H.clampSpeech(words.join(' ') + '.');
    assert.ok(cut.split(/\s+/).length <= 40);
  });

  test('Tages- und Minutengrenze', async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Na jut.' } }] }) };
    };
    const tight = chatDeps(fetchImpl, Object.assign({}, ENV, { DAILY_LIMIT: '2' }));
    assert.equal((await H.handleChat(event('POST', { character: 'horst', message: 'eins' }), tight)).status, 200);
    assert.equal((await H.handleChat(event('POST', { character: 'horst', message: 'zwei' }), tight)).status, 200);
    const limited = await H.handleChat(event('POST', { character: 'horst', message: 'drei' }), tight);
    assert.equal(limited.status, 503);
    assert.equal(limited.json.reason, 'rate_limited');
    assert.equal(calls, 2);

    H.resetLimits();
    calls = 0;
    const fast = chatDeps(fetchImpl, Object.assign({}, ENV, { DAILY_LIMIT: '100' }));
    for (let i = 0; i < H.PER_MINUTE; i++) {
      assert.equal((await H.handleChat(event('POST', { character: 'horst', message: 'm' + i }), fast)).status, 200);
    }
    const perMinute = await H.handleChat(event('POST', { character: 'horst', message: 'zu viel' }), fast);
    assert.equal(perMinute.status, 503);
    assert.equal(perMinute.json.reason, 'rate_limited');
    assert.equal(calls, H.PER_MINUTE);
  });

  test('CORS nur für die eigenen Adressen', () => {
    assert.equal(H.allowOrigin('https://spiel-freunde.com'), 'https://spiel-freunde.com');
    assert.equal(H.allowOrigin('https://www.spiel-freunde.com'), 'https://www.spiel-freunde.com');
    assert.equal(H.allowOrigin('https://spiel-freunde-x.ondigitalocean.app'), 'https://spiel-freunde-x.ondigitalocean.app');
    assert.equal(H.allowOrigin('http://127.0.0.1:8765'), 'http://127.0.0.1:8765');
    assert.equal(H.allowOrigin('https://evil.example'), '');
    assert.equal(H.allowOrigin('https://spiel-freunde.com.evil.com'), '');
    assert.equal(H.allowOrigin('http://spiel-freunde.com'), '');
    assert.equal(H.allowOrigin('https://evil.ondigitalocean.app.attacker.com'), '');
  });

  test('Stimme: Horst braucht eine ID, Margarethe hat einen Default, Audio kommt als MPEG', async () => {
    let calls = 0;
    const noHorst = await H.handleTts(event('POST', { character: 'horst', text: 'Na endlich.' }), {
      env: { ELEVENLABS_API_KEY: 'test-eleven', VOICE_HORST: '' },
      fetch: async () => { calls += 1; throw new Error('nicht rufen'); },
      now: () => 1700000000000,
    });
    assert.equal(noHorst.status, 503);
    assert.equal(noHorst.json.reason, 'invalid_input');
    assert.equal(calls, 0);

    const longText = await H.handleTts(event('POST', { character: 'margarethe', text: 'a'.repeat(301) }), chatDeps(async () => { calls += 1; throw new Error('nicht'); }));
    assert.equal(longText.status, 503);
    assert.equal(longText.json.reason, 'invalid_input');
    assert.equal(calls, 0);

    let sent;
    const bytes = Uint8Array.from([0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]);
    const audio = await H.handleTts(event('POST', { character: 'margarethe', text: 'Aber Schätzchen.' }), {
      env: { ELEVENLABS_API_KEY: 'test-eleven' },
      fetch: async (url, options) => {
        sent = { url, options };
        return { ok: true, headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => bytes };
      },
      now: () => 1700000000000,
    });
    assert.equal(audio.status, 200);
    assert.equal(audio.headers['Content-Type'], 'audio/mpeg');
    assert.ok(sent.url.indexOf('/' + H.DEFAULT_MARGARETHE + '/stream') !== -1);
    assert.equal(sent.options.headers['xi-api-key'], 'test-eleven');
    assert.equal(JSON.parse(sent.options.body).model_id, 'eleven_flash_v2_5');
    assert.equal(JSON.parse(sent.options.body).language_code, 'de');
    const wrapped = H.toFunctionResponse(audio);
    assert.equal(wrapped.headers['Content-Type'], 'audio/mpeg');
    assert.equal(Buffer.from(wrapped.body, 'base64')[0], 0xff);

    const evil = await H.handleTts(event('POST', { character: 'margarethe', text: 'Hallo' }, {
      headers: { origin: 'https://evil.example' },
    }), {
      env: { ELEVENLABS_API_KEY: 'test-eleven' },
      fetch: async () => ({ ok: true, headers: { get: () => 'audio/mpeg' }, arrayBuffer: async () => bytes }),
      now: () => 1700000000000,
    });
    assert.equal(evil.headers['Access-Control-Allow-Origin'], undefined);

    const logs = [];
    const prevErr = console.error;
    console.error = function () { logs.push(Array.prototype.slice.call(arguments)); };
    let denied;
    try {
      denied = await H.handleTts(event('POST', { character: 'margarethe', text: 'Hallo' }), {
        env: { ELEVENLABS_API_KEY: 'test-eleven' },
        fetch: async () => ({
          ok: false,
          status: 401,
          headers: { get: () => 'application/json', 'xi-api-key': 'test-eleven' },
          json: async () => ({ detail: 'rejected test-eleven' }),
        }),
        now: () => 1700000000000,
      });
    } finally {
      console.error = prevErr;
    }
    assert.equal(denied.status, 503);
    assert.equal(denied.json.reason, 'upstream_401');
    assert.equal(JSON.stringify(denied.json).includes('test-eleven'), false);
    assert.equal(logs.length, 1);
    assert.deepEqual(logs[0].slice(0, 2), ['upstream', 401]);
    assert.match(logs[0][2], /rejected/);
    assert.equal(String(logs[0][2]).includes('test-eleven'), false);
    assert.equal(JSON.stringify(logs[0]).includes('xi-api-key'), false);
  });

  test('Avatar: nur erfundene Erwachsene, kleines Bild, kein Schlüssel nach außen', async () => {
    const good = H.validateAvatar({
      typ: 'frau',
      alter: '30-44',
      haare: 'lockig',
      brille: 'nein',
      stimmung: 'froh',
      text: '  Sommersprossen und ein Schal  ',
      name: 'Angela Merkel',
    });
    assert.equal(good.ok, true);
    assert.equal(good.value.text, 'Sommersprossen und ein Schal');
    assert.equal(good.value.name, undefined);
    const body = H.buildAvatarBody(good.value, {});
    assert.equal(body.model, H.DEFAULT_IMAGE_MODEL);
    assert.equal(body.model, 'grok-imagine-image-2.0');
    assert.equal(body.n, 1);
    assert.equal(body.aspect_ratio, '1:1');
    assert.equal(body.resolution, '1k');
    assert.equal(body.quality, 'low');
    assert.equal(body.response_format, 'b64_json');
    assert.match(body.prompt, /adult/i);
    assert.match(body.prompt, /pub/i);
    assert.match(body.prompt, /Sommersprossen/);
    assert.doesNotMatch(body.prompt, /Merkel|grok|openai|elevenlabs|x\.ai/i);
    const pinned = H.buildAvatarBody(good.value, { XAI_IMAGE_MODEL: 'grok-imagine-image-test' });
    assert.equal(pinned.model, 'grok-imagine-image-test');
    const placeholder = H.buildAvatarBody(good.value, { XAI_IMAGE_MODEL: '${XAI_IMAGE_MODEL}' });
    assert.equal(placeholder.model, H.DEFAULT_IMAGE_MODEL);

    let calls = 0;
    const fetchImpl = async () => { calls += 1; throw new Error('nicht rufen'); };
    const minor = await H.handleAvatar(event('POST', { alter: '30-44', text: 'ein Kind mit 8 Jahren' }), chatDeps(fetchImpl));
    assert.equal(minor.status, 503);
    assert.equal(minor.json.error, 'nicht erreichbar');
    assert.equal(minor.json.reason, 'refused');
    assert.equal(JSON.stringify(minor.json).toLowerCase().includes('kind'), false);
    const nude = await H.handleAvatar(event('POST', { alter: '18-29', text: 'bitte nackt' }), chatDeps(fetchImpl));
    assert.equal(nude.json.reason, 'refused');
    const famous = await H.handleAvatar(event('POST', { alter: '60-74', text: 'Sieht aus wie Angela Merkel' }), chatDeps(fetchImpl));
    assert.equal(famous.json.reason, 'refused');
    assert.equal(JSON.stringify(famous.json).includes('Merkel'), false);
    const young = await H.handleAvatar(event('POST', { alter: '12', text: 'freundlich' }), chatDeps(fetchImpl));
    assert.equal(young.json.reason, 'invalid_input');
    const huge = await H.handleAvatar(event('POST', { alter: '30-44', text: 'a'.repeat(H.MAX_AVATAR_TEXT + 1) }), chatDeps(fetchImpl));
    assert.equal(huge.json.reason, 'invalid_input');
    assert.equal(calls, 0);

    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    let sent;
    const ok = await H.handleAvatar(event('POST', { alter: '75+', haare: 'grau', text: 'ruhiger Blick' }), chatDeps(async (url, options) => {
      sent = { url, options };
      return { ok: true, json: async () => ({ data: [{ b64_json: jpeg.toString('base64') }] }) };
    }));
    assert.equal(ok.status, 200);
    assert.equal(ok.json.mime, 'image/jpeg');
    assert.equal(Buffer.from(ok.json.image, 'base64').equals(jpeg), true);
    assert.equal(sent.url, H.IMAGE_URL);
    assert.equal(sent.options.headers.Authorization, 'Bearer test-key');
    assert.equal(sent.options.body.includes('test-key'), false);
    assert.equal(JSON.stringify(ok.json).includes('test-key'), false);
    assert.equal(JSON.stringify(ok.json).toLowerCase().includes('grok'), false);
    const posted = JSON.parse(sent.options.body);
    assert.equal(posted.model, 'grok-imagine-image-2.0');

    const logs = [];
    const prevErr = console.error;
    console.error = function () { logs.push(Array.prototype.slice.call(arguments)); };
    let down;
    try {
      down = await H.handleAvatar(event('POST', { alter: '30-44', text: 'Bart' }), chatDeps(async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: 'SUPERSECRET test-key' }),
      })));
    } finally {
      console.error = prevErr;
    }
    assert.equal(down.status, 503);
    assert.equal(down.json.reason, 'upstream_429');
    assert.equal(JSON.stringify(down.json).includes('test-key'), false);
    assert.equal(String(logs[0][2]).includes('test-key'), false);

    H.resetLimits();
    let drawn = 0;
    const limitedFetch = async () => {
      drawn += 1;
      return { ok: true, json: async () => ({ data: [{ b64_json: jpeg.toString('base64') }] }) };
    };
    const ip = { headers: { 'x-forwarded-for': '203.0.113.10' } };
    for (let i = 0; i < H.AVATAR_PER_HOUR; i++) {
      assert.equal((await H.handleAvatar(event('POST', { alter: '30-44', text: 'Bild ' + i }, ip), chatDeps(limitedFetch))).status, 200);
    }
    const blocked = await H.handleAvatar(event('POST', { alter: '30-44', text: 'noch eins' }, ip), chatDeps(limitedFetch));
    assert.equal(blocked.status, 503);
    assert.equal(blocked.json.reason, 'rate_limited');
    const other = await H.handleAvatar(event('POST', { alter: '30-44', text: 'andere Leitung' }, { headers: { 'x-forwarded-for': '203.0.113.11' } }), chatDeps(limitedFetch));
    assert.equal(other.status, 200);
    assert.equal(drawn, H.AVATAR_PER_HOUR + 1);
  });

  test('Function-Einstieg antwortet auf GET', async () => {
    const prev = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = 'test-key';
    try {
      const chat = require('../../api/packages/sf/chat/index.js');
      const tts = require('../../api/packages/sf/tts/index.js');
      const avatar = require('../../api/packages/sf/avatar/index.js');
      const out = await chat.main({ http: { method: 'GET', headers: {} } });
      assert.equal(out.statusCode, 200);
      assert.deepEqual(out.body, { ok: true });
      assert.equal(typeof tts.main, 'function');
      const face = await avatar.main({ http: { method: 'GET', headers: {} } });
      assert.equal(face.statusCode, 200);
      assert.deepEqual(face.body, { ok: true });
      delete process.env.XAI_API_KEY;
      const missing = await chat.main({ http: { method: 'GET', headers: {} } });
      assert.equal(missing.statusCode, 503);
      assert.deepEqual(missing.body, { error: 'nicht erreichbar', reason: 'no_key' });
    } finally {
      if (prev == null) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = prev;
    }
  });

  test('Funktionsordner sind eigenständig und main zeigt auf den Export', () => {
    const root = path.join(__dirname, '../../api');
    const lib = fs.readFileSync(path.join(root, 'lib/handlers.js'));
    const project = fs.readFileSync(path.join(root, 'project.yml'), 'utf8');
    assert.equal(project.includes('main: index.js'), false);
    assert.equal(project.split('main: index.main').length - 1, 3);
    for (const name of ['chat', 'tts', 'avatar']) {
      const dir = path.join(root, 'packages/sf', name);
      assert.equal(fs.existsSync(path.join(dir, '.include')), false);
      const copy = fs.readFileSync(path.join(dir, 'handlers.js'));
      assert.equal(copy.equals(lib), true);
      const index = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
      assert.match(index, /require\('\.\/handlers\.js'\)/);
      assert.equal(index.includes('../../../lib/'), false);
      assert.match(index, /exports\.main = main/);
    }
    const audio = H.toFunctionResponse({
      status: 200,
      audio: Buffer.from([0xff, 0xfb]),
      headers: { 'Content-Type': 'audio/mpeg' },
    });
    assert.equal(typeof audio.body, 'string');
    assert.equal(Buffer.from(audio.body, 'base64')[0], 0xff);
    const json = H.toFunctionResponse({ status: 200, json: { ok: true }, headers: {} });
    assert.deepEqual(json.body, { ok: true });
    assert.equal(typeof json.body, 'object');
  });

  test('lokaler Server: Seite, Chat, Ablehnung', async () => {
    const { createServer } = require('../../api/server');
    const server = createServer({ mock: true, delayMs: 0 });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    try {
      const health = await fetch('http://127.0.0.1:' + port + '/api/chat');
      assert.equal(health.status, 200);
      assert.deepEqual(await health.json(), { ok: true });
      const healthSf = await fetch('http://127.0.0.1:' + port + '/api/sf/chat');
      assert.equal(healthSf.status, 200);
      assert.deepEqual(await healthSf.json(), { ok: true });
      const healthOld = await fetch('http://127.0.0.1:' + port + '/api/default/chat');
      assert.equal(healthOld.status, 200);
      const page = await fetch('http://127.0.0.1:' + port + '/skat/');
      assert.equal(page.status, 200);
      assert.match(await page.text(), /chat-log/);
      const post = await fetch('http://127.0.0.1:' + port + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:' + port },
        body: JSON.stringify({ character: 'margarethe', message: 'Guten Abend', history: [] }),
      });
      assert.equal(post.status, 200);
      assert.match((await post.json()).text, /Schätzchen/);
      assert.equal(post.headers.get('access-control-allow-origin'), 'http://127.0.0.1:' + port);
      const bad = await fetch('http://127.0.0.1:' + port + '/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character: 'fremd', message: 'hallo' }),
      });
      assert.equal(bad.status, 503);
      const secret = fs.readFileSync(path.join(__dirname, '../../public/skat/js/talk.js'), 'utf8');
      assert.equal(secret.includes('VITE_'), false);
      assert.equal(secret.includes('XAI_API_KEY'), false);
      assert.equal(secret.includes('ELEVENLABS_API_KEY'), false);
      const avatarHealth = await fetch('http://127.0.0.1:' + port + '/api/sf/avatar');
      assert.equal(avatarHealth.status, 200);
      assert.deepEqual(await avatarHealth.json(), { ok: true });
      const avatarBad = await fetch('http://127.0.0.1:' + port + '/api/sf/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alter: '30-44', text: 'Sieht aus wie Angela Merkel' }),
      });
      assert.equal(avatarBad.status, 503);
      assert.equal((await avatarBad.json()).reason, 'refused');
      const avatarOk = await fetch('http://127.0.0.1:' + port + '/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:' + port },
        body: JSON.stringify({ alter: '45-59', haare: 'grau', brille: 'ja', stimmung: 'gemuetlich', text: 'Sommersprossen' }),
      });
      assert.equal(avatarOk.status, 200);
      const avatarBody = await avatarOk.json();
      assert.equal(avatarBody.mime, 'image/jpeg');
      assert.equal(Buffer.from(avatarBody.image, 'base64')[0], 0xff);
      assert.equal(avatarOk.headers.get('access-control-allow-origin'), 'http://127.0.0.1:' + port);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
