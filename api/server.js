'use strict';

/*
 * Lokaler Server für die Seite und /api/chat plus /api/tts.
 * Dieselben Pfade gibt es mit Paketnamen: /api/sf/chat und /api/sf/tts (App Platform).
 * /api/default/chat und /api/default/tts bleiben erreichbar, damit alte Aufrufe nicht ins Leere laufen.
 * Auf App Platform laufen dieselben Handler als Functions, nicht dieser Prozess.
 *
 *   node api/server.js              Seite und API, Schlüssel aus der Umgebung
 *   node api/server.js --mock       feste Antworten, ohne echte Schlüssel
 *   node api/server.js --port 8765
 *   node api/server.js --mock --delay 8000   längere Wartezeit, nur fürs Ansehen
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const handlers = require('./lib/handlers');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return '';
}

function mockEnv() {
  return {
    XAI_API_KEY: 'mock',
    ELEVENLABS_API_KEY: 'mock',
    VOICE_HORST: 'MockHorstVoice01',
    VOICE_MARGARETHE: '28LWddKi67H2YN9L2PvK',
    XAI_MODEL: 'grok-4.3',
    ELEVEN_MODEL: 'eleven_flash_v2_5',
    DAILY_LIMIT: '1000',
  };
}

function mockFetch(delayMs) {
  return async function fetchMock(url, options) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    const target = String(url);
    if (target.indexOf('api.x.ai') !== -1) {
      let system = '';
      try { system = JSON.parse(options.body).messages[0].content; } catch (e) { system = ''; }
      const text = system.indexOf('Margarethe von Hohenfels') !== -1
        ? 'Ach Schätzchen, heute glänze ich, das spür ich schon.'
        : system.indexOf('Urs Gerber') !== -1
          ? 'Grüessech. Ruhig, mir sind no lang nid am Ziel.'
          : system.indexOf('Vreni Meier') !== -1
            ? 'Hoi! Die Farb hät ich auch genommen.'
            : 'Na endlich. Ick dachte schon, du redest gar nicht mehr.';
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ choices: [{ message: { content: text } }] }),
        arrayBuffer: async () => new Uint8Array(),
      };
    }
    return { ok: false, status: 503, headers: { get: () => 'application/json' }, json: async () => ({}), arrayBuffer: async () => new Uint8Array() };
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 8000) {
        reject(new Error('gross'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function headerMap(req) {
  const out = {};
  for (const key of Object.keys(req.headers)) out[key] = req.headers[key];
  return out;
}

function sendResult(res, result) {
  const headers = Object.assign({}, (result && result.headers) || {});
  if (result && result.audio) {
    headers['Content-Type'] = 'audio/mpeg';
    headers['Content-Length'] = result.audio.length;
    res.writeHead(result.status || 200, headers);
    res.end(result.audio);
    return;
  }
  if (result && result.status === 204) {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  const json = JSON.stringify((result && result.json) || { error: 'nicht erreichbar' });
  headers['Content-Type'] = 'application/json; charset=utf-8';
  res.writeHead((result && result.status) || 503, headers);
  res.end(json);
}

function safeFile(publicDir, pathname) {
  let rel = decodeURIComponent(pathname || '/');
  if (rel.indexOf('\0') !== -1) return null;
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(publicDir, rel));
  const root = path.normalize(publicDir + path.sep);
  if (file !== path.normalize(publicDir) && file.indexOf(root) !== 0) return null;
  return file;
}

async function handleNodeRequest(req, res, options) {
  const optionsSafe = options || {};
  const publicDir = optionsSafe.publicDir || PUBLIC_DIR;
  let url;
  try { url = new URL(req.url, 'http://127.0.0.1'); }
  catch (e) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end('{"error":"nicht erreichbar"}');
    return;
  }
  const deps = { env: optionsSafe.env || process.env, fetch: optionsSafe.fetch || fetch };
  const isChat = url.pathname === '/api/chat' || url.pathname === '/api/sf/chat' || url.pathname === '/api/default/chat';
  const isTts = url.pathname === '/api/tts' || url.pathname === '/api/sf/tts' || url.pathname === '/api/default/tts';
  if (isChat || isTts) {
    let raw = '';
    if (req.method === 'POST') {
      try { raw = await readBody(req); }
      catch (e) {
        sendResult(res, { status: 503, json: { error: 'nicht erreichbar' }, headers: {} });
        return;
      }
    }
    const event = {
      http: {
        method: req.method,
        headers: headerMap(req),
        path: url.pathname,
        body: raw,
      },
    };
    if (isChat) {
      sendResult(res, await handlers.handleChat(event, deps));
      return;
    }
    if (optionsSafe.stream && req.method === 'POST') {
      try {
        const prep = await handlers.prepareTts(event, deps);
        if (prep.result) { sendResult(res, prep.result); return; }
        const upstream = await (deps.fetch)(prep.request.url, prep.request.init);
        if (!upstream || !upstream.ok || !upstream.body) {
          sendResult(res, { status: 503, json: { error: 'nicht erreichbar' }, headers: {} });
          return;
        }
        const headers = { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
        const origin = req.headers.origin || '';
        const allow = handlers.allowOrigin(origin);
        if (allow) {
          headers['Access-Control-Allow-Origin'] = allow;
          headers.Vary = 'Origin';
        }
        res.writeHead(200, headers);
        Readable.fromWeb(upstream.body).pipe(res);
        return;
      } catch (e) {
        if (!res.headersSent) sendResult(res, { status: 503, json: { error: 'nicht erreichbar' }, headers: {} });
        else res.destroy();
        return;
      }
    }
    sendResult(res, await handlers.handleTts(event, deps));
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end('{"error":"nicht erreichbar"}');
    return;
  }
  const file = safeFile(publicDir, url.pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Nicht gefunden');
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Nicht gefunden');
      return;
    }
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
}

function createServer(options) {
  const opts = Object.assign({}, options || {});
  if (opts.mock) {
    opts.env = opts.env || mockEnv();
    opts.fetch = opts.fetch || mockFetch(opts.delayMs || 0);
  }
  return http.createServer((req, res) => {
    handleNodeRequest(req, res, opts).catch(() => {
      if (!res.headersSent) {
        res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end('{"error":"nicht erreichbar"}');
      }
    });
  });
}

function listen(options) {
  const port = Number((options && options.port) || argValue('--port') || process.env.PORT || 8000);
  const mock = options ? !!options.mock : process.argv.indexOf('--mock') !== -1;
  const delayMs = options && options.delayMs != null ? options.delayMs : (mock ? 1600 : 0);
  const server = createServer({ mock, delayMs, stream: !mock });
  server.listen(port, '127.0.0.1');
  return server;
}

if (require.main === module) {
  const mock = process.argv.indexOf('--mock') !== -1;
  const port = Number(argValue('--port') || process.env.PORT || 8000);
  const delayArg = argValue('--delay');
  const delayMs = delayArg ? Number(delayArg) : (mock ? 1600 : 0);
  const server = listen({ mock, port, delayMs });
  server.on('listening', () => {
    const shown = server.address().port;
    console.log('Spiel-Freunde auf http://127.0.0.1:' + shown + '/  und  http://127.0.0.1:' + shown + '/skat/');
    console.log(mock ? 'API im Probebetrieb, ohne echte Schlüssel.' : 'API nutzt die Schlüssel aus der Umgebung.');
  });
}

module.exports = { createServer, listen, handleNodeRequest, mockEnv, mockFetch };
