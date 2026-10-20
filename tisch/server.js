'use strict';

/*
 * HTTP und WebSocket für den privaten Tisch.
 * Auf App Platform läuft dieser Prozess als Web-Service (eine Instanz).
 * Lokal hängt api/server.js dieselben Routen an den Seiten-Server.
 *
 * Öffentlich:  /api/tisch/create|join|rejoin|act|poll|results|health
 * Programm:    /api/tisch/rooms  nur mit TISCH_ADMIN_TOKEN (sonst 404)
 * WebSocket:   /api/tisch/ws     erste Nachricht { type:'hello', code, token }
 *
 * Keine Schlüssel hier. Chat und Stimmen bleiben bei /api/sf/chat und /api/sf/tts.
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const { createHub, TischError } = require('./lib/room');

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 16000) {
        reject(new TischError('Das ist zu groß.', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new TischError('Das ist kein gültiges JSON.', 400)); }
    });
    req.on('error', () => reject(new TischError('Das hat nicht geklappt.', 400)));
  });
}

function bearer(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header !== 'string') return '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function claimResponse(summary, claim, view) {
  return {
    ok: true,
    code: summary.code,
    tableId: summary.id,
    tournamentId: summary.tournamentId,
    roundId: summary.roundId,
    target: summary.target,
    status: summary.status,
    seat: claim.seat,
    token: claim.token,
    name: claim.name,
    invitePath: '/tisch/?code=' + summary.code,
    view,
  };
}

async function handleRequest(req, res, hub) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const path = url.pathname;
  const isHealth = req.method === 'GET' && (path === '/health' || path === '/' || path === '/api/tisch/health' || path === '/api/tisch');
  if (isHealth && req.method === 'GET' && (path === '/health' || path === '/api/tisch/health')) {
    send(res, 200, { ok: true, service: 'tisch' });
    return;
  }
  if (req.method === 'GET' && (path === '/' || path === '/api/tisch')) {
    send(res, 200, { ok: true, service: 'tisch' });
    return;
  }
  const routes = {
    '/api/tisch/create': 'create',
    '/api/tisch/rooms': 'rooms',
    '/api/tisch/join': 'join',
    '/api/tisch/rejoin': 'rejoin',
    '/api/tisch/act': 'act',
    '/api/tisch/poll': 'poll',
    '/api/tisch/results': 'results',
  };
  const name = routes[path];
  if (!name) {
    send(res, 404, { ok: false, error: 'Nicht gefunden.' });
    return;
  }
  if (!hub) {
    send(res, 503, { ok: false, error: 'Der Tisch ist gerade nicht da.' });
    return;
  }
  if (name === 'results' && req.method === 'GET') {
    await handleResults(req, url, res, hub);
    return;
  }
  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: 'Bitte POST.' });
    return;
  }
  const body = await readBody(req);
  if (name === 'create') {
    const made = hub.createRoom({
      name: body.name,
      target: body.target,
      targetCustom: body.targetCustom,
      mode: body.mode,
      level: body.level,
    });
    const claim = made.claims[0];
    const view = hub.rejoin(made.summary.code, claim.token);
    send(res, 200, claimResponse(made.summary, claim, view));
    return;
  }
  if (name === 'rooms') {
    if (!hub.hasAdmin || !hub.adminOk(req.headers.authorization || '')) {
      send(res, 404, { ok: false, error: 'Nicht gefunden.' });
      return;
    }
    const made = hub.createRoom(body || {});
    send(res, 200, {
      ok: true,
      id: made.summary.id,
      code: made.summary.code,
      tournamentId: made.summary.tournamentId,
      roundId: made.summary.roundId,
      target: made.summary.target,
      status: made.summary.status,
      hostSeat: made.summary.hostSeat,
      claims: made.claims,
      invitePath: '/tisch/?code=' + made.summary.code,
    });
    return;
  }
  if (name === 'join') {
    const joined = hub.join(body.code, body.name);
    const view = joined.view;
    send(res, 200, claimResponse({
      code: view.code,
      id: view.tableId,
      tournamentId: view.tournamentId,
      roundId: view.roundId,
      target: view.target,
      status: view.status,
    }, joined.claim, view));
    return;
  }
  if (name === 'rejoin' || name === 'poll') {
    const view = hub.rejoin(body.code, body.token || bearer(req));
    send(res, 200, { ok: true, view });
    return;
  }
  if (name === 'act') {
    const view = hub.act(body.code, body.token || bearer(req), body.action, body);
    if (view && view.left) {
      send(res, 200, { ok: true, left: true });
      return;
    }
    send(res, 200, { ok: true, view });
    return;
  }
  if (name === 'results') {
    await handleResults(req, url, res, hub, body);
    return;
  }
  send(res, 404, { ok: false, error: 'Nicht gefunden.' });
}

function handleResults(req, url, res, hub, body) {
  const source = body || {};
  const tournamentId = url.searchParams.get('tournamentId') || source.tournamentId || '';
  const code = url.searchParams.get('code') || source.code || '';
  const roundId = url.searchParams.get('roundId') || source.roundId || '';
  const kind = url.searchParams.get('kind') || source.kind || '';
  const header = req.headers.authorization || '';
  const token = source.token || bearer(req);
  if (tournamentId) {
    if (!hub.adminOk(header)) {
      send(res, 404, { ok: false, error: 'Nicht gefunden.' });
      return;
    }
    send(res, 200, { ok: true, results: hub.listResults({ tournamentId, roundId, kind }, { admin: true }) });
    return;
  }
  const results = hub.listResults({ code, kind }, { token, admin: hub.adminOk(header) });
  send(res, 200, { ok: true, results });
}

function attach(server, hub) {
  if (!server || server._tischAttached) return;
  server._tischAttached = true;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16000 });
  const sockets = new Set();

  function broadcast(room) {
    for (const meta of sockets) {
      if (meta.code !== room.code || meta.ws.readyState !== 1) continue;
      try {
        const view = hub.viewOf(room, meta.seat);
        meta.ws.send(JSON.stringify({ type: 'state', view }));
      } catch (e) { /* Platz weg oder Socket zu */ }
    }
  }

  server.on('upgrade', (req, socket, head) => {
    let url;
    try { url = new URL(req.url, 'http://127.0.0.1'); }
    catch (e) { socket.destroy(); return; }
    if (url.pathname !== '/api/tisch/ws' && url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => accept(ws));
  });

  function accept(ws) {
    const meta = { ws, code: '', token: '', seat: -1, hello: false };
    sockets.add(meta);
    const timer = setTimeout(() => {
      if (!meta.hello) ws.close(4001, 'hello');
    }, 8000);
    ws.on('message', (data) => {
      let msg;
      try { msg = JSON.parse(String(data)); }
      catch (e) { return; }
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'hello' || (!meta.hello && msg.code && msg.token)) {
        try {
          const view = hub.rejoin(msg.code, msg.token);
          meta.hello = true;
          meta.code = view.code;
          meta.token = msg.token;
          meta.seat = view.you;
          clearTimeout(timer);
          hub.markConn(meta.code, meta.token, 1);
          ws.send(JSON.stringify({ type: 'state', view: hub.rejoin(meta.code, meta.token) }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', error: e.message || 'Das hat nicht geklappt.', status: e.status || 400 }));
          ws.close();
        }
        return;
      }
      if (!meta.hello) return;
      if (msg.type === 'ping') {
        try { hub.rejoin(meta.code, meta.token); } catch (e) { ws.close(); }
        return;
      }
      if (msg.type === 'act') {
        try {
          const view = hub.act(meta.code, meta.token, msg.action, msg);
          if (view && view.left) ws.send(JSON.stringify({ type: 'left' }));
          else ws.send(JSON.stringify({ type: 'state', view }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', error: e.message || 'Das hat nicht geklappt.', status: e.status || 400 }));
        }
      }
    });
    ws.on('close', () => {
      clearTimeout(timer);
      sockets.delete(meta);
      if (meta.hello) hub.markConn(meta.code, meta.token, -1);
    });
    ws.on('error', () => { try { ws.close(); } catch (e) { /* egal */ } });
  }

  const wrapped = (room) => broadcast(room);
  const existing = server._tischOnRev;
  void existing;
  server._tischBroadcast = wrapped;
  return { broadcast: wrapped, sockets };
}

function createListeningHub(extra) {
  let broadcast = () => {};
  const hub = createHub(Object.assign({
    aiDelayMs: Number(process.env.TISCH_AI_DELAY_MS || 700),
    ttlMs: Number(process.env.TISCH_TTL_MS || 45 * 60 * 1000),
    dataDir: process.env.TISCH_DATA_DIR || '',
    adminToken: process.env.TISCH_ADMIN_TOKEN || '',
    onRev: (room) => broadcast(room),
  }, extra || {}));
  return {
    hub,
    setBroadcast(fn) { broadcast = fn; },
  };
}

function wire(server, bundle) {
  const attached = attach(server, bundle.hub);
  bundle.setBroadcast(attached.broadcast);
  if (!server._tischSweep) {
    const timer = setInterval(() => bundle.hub.sweep(), 30000);
    if (timer.unref) timer.unref();
    server._tischSweep = timer;
  }
  return bundle.hub;
}

function listen(options) {
  const port = Number((options && options.port) || process.env.PORT || 8080);
  const host = (options && options.host) || '0.0.0.0';
  const bundle = createListeningHub(options && options.hubOptions);
  const server = http.createServer((req, res) => {
    handleRequest(req, res, bundle.hub).catch((err) => {
      if (res.headersSent) return;
      const status = err && err.status ? err.status : 500;
      const message = err instanceof TischError ? err.message : 'Das hat nicht geklappt.';
      send(res, status, { ok: false, error: message });
    });
  });
  wire(server, bundle);
  server.listen(port, host);
  return server;
}

if (require.main === module) {
  const server = listen();
  server.on('listening', () => {
    const addr = server.address();
    console.log('Privater Tisch auf http://' + addr.address + ':' + addr.port + '/api/tisch/health');
  });
}

module.exports = {
  handleRequest,
  attach,
  listen,
  createHub,
  createListeningHub,
  wire,
  TischError,
};
