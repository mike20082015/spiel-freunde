'use strict';

/*
 * Privater Skat-Tisch. Der Server mischt und gibt. Clients bekommen nur die
 * eigene Sicht (SkatEngine.viewFor). Sitze vergibt immer der Server.
 *
 * Turnier später (K.-o., hier nicht gebaut):
 *   createRoom({ tournamentId, roundId, target, seats }) legt einen Tisch
 *   programmatisch an. seats kommt in der übergebenen Reihenfolge auf 0, 1, 2.
 *   target ist das Rundenziel (Standard 301, dieselbe Skala wie im Solotisch).
 *   Erreicht jemand das Ziel allein an der Spitze, wird status 'ended'.
 *   Der ResultStore behält je Spiel und je Serie Sieger und Endstand,
 *   inklusive externalId, damit ein späterer Verteiler die Menschen
 *   an den nächsten Tisch setzen kann.
 *
 * Spielerkonto später (hier kein Login):
 *   Ein Platz kann eine playerId aus dem Spiel-Freunde-Konto tragen
 *   (LeadMonster /api/public/spiel-freunde, me). Die setzt nur der
 *   Programm-Aufruf createRoom/join, nicht die öffentliche Seite.
 *   Am Tisch gilt weiter der Anzeigename. Die playerId steht im
 *   Ergebnis und nur in der eigenen Sicht.
 */

const crypto = require('crypto');
const path = require('path');
const E = require(path.join(__dirname, '..', '..', 'public', 'skat', 'js', 'engine.js'));
const AI = require(path.join(__dirname, '..', '..', 'public', 'skat', 'js', 'ai.js'));
const { createResultStore } = require('./results');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_TTL_MS = 45 * 60 * 1000;
const DEFAULT_TARGET = 301;
const LEVELS = ['anfaenger', 'kneipe', 'turnier'];
const PARTNERS = {
  horst: 'Horst',
  margarethe: 'Margarethe',
  urs: 'Urs',
  vreni: 'Vreni',
  sepp: 'Sepp',
  hilde: 'Oma Hilde',
  lena: 'Lena',
  jonas: 'Jonas',
  oemer: 'Ömer',
  ruediger: 'Rüdiger',
  chantal: 'Chantal',
};

class TischError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status || 400;
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function cleanName(value) {
  const name = String(value || '').replace(/\s+/g, ' ').trim();
  if (!name || name.length > 24) return '';
  if (/[\u0000-\u001f]/.test(name)) return '';
  return name;
}

function cleanId(value, label) {
  if (value == null || value === '') return null;
  const id = String(value).trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new TischError(label + ' ist ungültig.');
  return id;
}

function cleanExternal(value) {
  if (value == null || value === '') return null;
  const id = String(value).trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new TischError('Spielerkennung ist ungültig.');
  return id;
}

function cleanPlayerId(value) {
  if (value == null || value === '') return null;
  const id = String(value).trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new TischError('Spielerkonto ist ungültig.');
  return id;
}

function resolveTarget(spec) {
  if (!spec || (spec.target === undefined && spec.targetCustom === undefined)) return DEFAULT_TARGET;
  if (spec.target === 'none' || spec.target === null || spec.target === '') return null;
  const target = E.normalizeTarget(spec.target, spec.targetCustom);
  if (target == null) throw new TischError('Das Ziel liegt zwischen 51 und 2001.');
  return target;
}

function normCode(value) {
  const raw = String(value || '').toUpperCase();
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charAt(i);
    if (ALPHABET.indexOf(ch) !== -1) out += ch;
  }
  return out;
}

function emptySeat(index) {
  return {
    index,
    token: null,
    tokenHash: null,
    name: '',
    kind: 'empty',
    aiId: null,
    externalId: null,
    playerId: null,
    conn: 0,
    lastSeen: 0,
  };
}

function freeSeat(seat) {
  seat.token = null;
  seat.tokenHash = null;
  seat.name = '';
  seat.kind = 'empty';
  seat.aiId = null;
  seat.externalId = null;
  seat.playerId = null;
  seat.conn = 0;
  seat.lastSeen = 0;
}

function tokenMatches(seat, token) {
  if (!seat || !seat.token || typeof token !== 'string') return false;
  if (token.length !== seat.token.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(seat.token), Buffer.from(token));
  } catch (e) {
    return false;
  }
}

function publicSeat(seat, you, now) {
  const connected = seat.kind === 'ai' || seat.conn > 0 || (seat.lastSeen && now - seat.lastSeen < 20000);
  return {
    index: seat.index,
    name: seat.name,
    kind: seat.kind,
    aiId: seat.kind === 'ai' ? seat.aiId : null,
    externalId: seat.externalId || null,
    playerId: seat.index === you ? (seat.playerId || null) : null,
    connected: seat.kind === 'empty' ? false : !!connected,
    host: false,
    you: seat.index === you,
  };
}

function seatBrief(seat) {
  return {
    index: seat.index,
    name: seat.name,
    kind: seat.kind,
    aiId: seat.kind === 'ai' ? seat.aiId : null,
    externalId: seat.externalId || null,
    playerId: seat.playerId || null,
  };
}

function publicResult(result) {
  if (!result) return null;
  return {
    passedIn: !!result.passedIn,
    ramsch: !!result.ramsch,
    won: result.won == null ? null : !!result.won,
    declarer: result.declarer == null ? null : result.declarer,
    bid: result.bid || 0,
    value: result.value || 0,
    score: result.score ? result.score.slice() : [0, 0, 0],
    overbid: !!result.overbid,
    kontra: !!result.kontra,
    re: !!result.re,
    factor: result.factor || 1,
    points: result.points || null,
    text: result.text || null,
  };
}

function sanitizeGame(game) {
  if (!game || (game.type !== 'suit' && game.type !== 'grand' && game.type !== 'null')) {
    throw new TischError('Unbekanntes Spiel.');
  }
  const out = { type: game.type };
  if (game.type === 'suit') {
    if (!E.SUITS.includes(game.trump)) throw new TischError('Trumpffarbe fehlt.');
    out.trump = game.trump;
  }
  if (game.schneiderAnnounced) out.schneiderAnnounced = true;
  if (game.schwarzAnnounced) out.schwarzAnnounced = true;
  if (game.ouvert) out.ouvert = true;
  return out;
}

function aiWho(room, seat) {
  const id = seat.aiId || 'horst';
  const persona = id === 'horst' || id === 'margarethe' ? id : 'neutral';
  return { persona, level: room.level, rng: Math.random };
}

function actorSeat(state) {
  if (!state || state.phase === 'done') return null;
  if (state.phase === 'bidding') {
    const turn = E.biddingTurn(state);
    return turn ? turn.player : null;
  }
  if (state.phase === 'skat' || state.phase === 'discard' || state.phase === 'declare') return state.declarer;
  if (state.phase === 'play') {
    const doubling = E.doublingTurn(state);
    if (doubling) return doubling.player;
    return state.turn;
  }
  return null;
}

function createHub(options) {
  const opts = options || {};
  const nowFn = opts.now || (() => Date.now());
  const ttlMs = opts.ttlMs == null ? DEFAULT_TTL_MS : opts.ttlMs;
  const aiDelayMs = opts.aiDelayMs == null ? 700 : opts.aiDelayMs;
  const results = opts.results || createResultStore(opts.dataDir || '');
  const allowDecks = !!opts.allowDecks;
  const adminToken = opts.adminToken || '';
  const rooms = new Map();
  const byId = new Map();

  function now() { return nowFn(); }

  function touch(room) {
    room.activityAt = now();
    room.updatedAt = room.activityAt;
  }

  function bump(room) {
    room.rev += 1;
    touch(room);
    if (typeof opts.onRev === 'function') opts.onRev(room);
  }

  function pushEvent(room, event) {
    room.eventSeq += 1;
    event.seq = room.eventSeq;
    event.at = now();
    room.events.push(event);
    if (room.events.length > 80) room.events.shift();
  }

  function uniqueCode() {
    for (let n = 0; n < 8; n++) {
      const bytes = crypto.randomBytes(CODE_LEN_BYTES());
      let code = '';
      for (let i = 0; i < 6; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
      if (!rooms.has(code)) return code;
    }
    throw new TischError('Gerade ist kein Code frei. Versuch es noch einmal.', 503);
  }

  function accessHashes(room) {
    return room.seats.filter((seat) => seat.tokenHash).map((seat) => seat.tokenHash);
  }

  function recordGame(room) {
    const state = room.state;
    const result = state && state.result;
    if (!result) return null;
    const row = {
      kind: 'game',
      id: 'gam_' + crypto.randomBytes(6).toString('hex'),
      tableId: room.id,
      code: room.code,
      tournamentId: room.tournamentId,
      roundId: room.roundId,
      label: room.label,
      gameNo: room.gameNo,
      seats: room.seats.map(seatBrief),
      score: result.score ? result.score.slice() : [0, 0, 0],
      totals: room.scores.slice(),
      declarer: result.declarer == null ? null : result.declarer,
      won: result.won == null ? null : !!result.won,
      bid: result.bid || 0,
      value: result.value || 0,
      game: result.game ? E.gameLabel(result.game) : (result.ramsch ? 'Ramsch' : (result.passedIn ? 'Gepasst' : '')),
      ramsch: !!result.ramsch,
      passedIn: !!result.passedIn,
      target: room.target,
      endedAt: now(),
      access: accessHashes(room),
    };
    results.add(row);
    room.gameIds.push(row.id);
    return row;
  }

  function recordSeries(room) {
    const winner = room.seats[room.winnerSeat] || null;
    const row = {
      kind: 'series',
      id: 'ser_' + crypto.randomBytes(6).toString('hex'),
      tableId: room.id,
      code: room.code,
      tournamentId: room.tournamentId,
      roundId: room.roundId,
      label: room.label,
      target: room.target,
      status: 'ended',
      winnerSeat: room.winnerSeat,
      winner: winner ? seatBrief(winner) : null,
      scores: room.scores.slice(),
      seats: room.seats.map(seatBrief),
      gameIds: room.gameIds.slice(),
      reason: 'target',
      endedAt: now(),
      access: accessHashes(room),
    };
    results.add(row);
    room.seriesId = row.id;
    return row;
  }

  function settleIfDone(room) {
    const state = room.state;
    if (!state || state.phase !== 'done' || state.settled) return;
    state.settled = true;
    try { room.match.record(state); } catch (e) { /* schon gezählt oder ohne Ergebnis */ }
    room.scores = room.match.scores.slice();
    const row = recordGame(room);
    pushEvent(room, {
      kind: 'gameOver',
      gameNo: room.gameNo,
      gameId: row && row.id,
      scores: room.scores.slice(),
      result: publicResult(state.result),
    });
    if (room.target != null) {
      const winner = E.sessionWinner(room.scores, room.target);
      if (winner != null) endSeries(room, winner);
    }
  }

  function endSeries(room, winnerSeat) {
    if (room.status === 'ended') return;
    room.status = 'ended';
    room.winnerSeat = winnerSeat;
    room.endedAt = now();
    const row = recordSeries(room);
    pushEvent(room, {
      kind: 'ended',
      seriesId: row.id,
      winnerSeat,
      scores: room.scores.slice(),
      target: room.target,
      reason: 'target',
    });
  }

  function takeDeck(room) {
    if (!room.scriptedDecks || !room.scriptedDecks.length) return undefined;
    return room.scriptedDecks.shift();
  }

  function deal(room) {
    if (!room.match) room.match = new E.Match({ rules: room.rules, dealer: 2 });
    const deck = takeDeck(room);
    room.state = room.match.start(E.cryptoRng(), deck);
    room.gameNo = room.match.gameNo;
    room.status = 'live';
    pushEvent(room, { kind: 'deal', gameNo: room.gameNo, dealer: room.state.dealer });
    settleIfDone(room);
  }

  function fallbackAi(room) {
    const state = room.state;
    const actor = actorSeat(state);
    if (actor == null) return false;
    if (state.phase === 'bidding') {
      E.bidAction(state, false);
      pushEvent(room, { kind: 'bid', seat: actor, action: 'pass', value: state.bid || 0 });
      return true;
    }
    if (state.phase === 'skat') {
      E.takeSkat(state);
      pushEvent(room, { kind: 'skat', seat: actor });
      return true;
    }
    if (state.phase === 'discard') {
      const hand = state.hands[actor].slice();
      E.discard(state, [hand[hand.length - 2], hand[hand.length - 1]]);
      pushEvent(room, { kind: 'discard', seat: actor });
      return true;
    }
    if (state.phase === 'declare') {
      E.declare(state, { type: 'suit', trump: 'D' });
      pushEvent(room, { kind: 'declare', seat: actor, label: E.gameLabel(state.game) });
      return true;
    }
    if (state.phase === 'play') {
      const doubling = E.doublingTurn(state);
      if (doubling && doubling.player === actor) {
        E.declineDouble(state, actor);
        pushEvent(room, { kind: doubling.kind, seat: actor, yes: false });
        return true;
      }
      const legal = E.legalFor(state, actor);
      if (!legal.length) return false;
      const info = E.playCard(state, actor, legal[0]);
      pushEvent(room, { kind: 'play', seat: actor, card: legal[0] });
      if (info.trickComplete) pushEvent(room, { kind: 'trick', winner: info.winner });
      return true;
    }
    return false;
  }

  function stepAi(room) {
    const state = room.state;
    if (!state || room.status !== 'live' || state.phase === 'done') return false;
    const actor = actorSeat(state);
    if (actor == null) return false;
    const seat = room.seats[actor];
    if (!seat || seat.kind !== 'ai') return false;
    const who = aiWho(room, seat);
    const view = E.viewFor(state, actor);
    try {
      if (state.phase === 'bidding') {
        const turn = E.biddingTurn(state);
        const yes = !!AI.decideBid(view, turn, who);
        E.bidAction(state, yes);
        const last = state.bidding.history[state.bidding.history.length - 1];
        pushEvent(room, { kind: 'bid', seat: actor, action: last ? last.action : (yes ? 'bid' : 'pass'), value: last ? last.value : turn.value, role: turn.role });
      } else if (state.phase === 'skat') {
        const decision = AI.decideSkat(view, who);
        if (decision.hand) {
          E.playHand(state);
          E.declare(state, sanitizeGame(decision.game));
          pushEvent(room, { kind: 'declare', seat: actor, label: E.gameLabel(state.game) });
        } else {
          E.takeSkat(state);
          pushEvent(room, { kind: 'skat', seat: actor });
        }
      } else if (state.phase === 'discard') {
        const decision = AI.chooseDiscardAndGame(view, who);
        E.discard(state, decision.discard);
        E.declare(state, sanitizeGame(decision.game));
        pushEvent(room, { kind: 'declare', seat: actor, label: E.gameLabel(state.game) });
      } else if (state.phase === 'declare') {
        const suggestion = AI.suggestGame(state.hands[actor], state.discarded || [], state.bid);
        E.declare(state, sanitizeGame(suggestion));
        pushEvent(room, { kind: 'declare', seat: actor, label: E.gameLabel(state.game) });
      } else if (state.phase === 'play') {
        const doubling = E.doublingTurn(state);
        if (doubling && doubling.player === actor) {
          AI.actOnDoubling(state, who);
          const yes = doubling.kind === 'kontra' ? state.kontraBy === actor : !!state.re;
          pushEvent(room, { kind: doubling.kind, seat: actor, yes: yes });
        } else {
          const choice = AI.chooseCard(view, who);
          const info = E.playCard(state, actor, choice.card);
          pushEvent(room, { kind: 'play', seat: actor, card: choice.card });
          if (info.trickComplete) pushEvent(room, { kind: 'trick', winner: info.winner });
        }
      } else return false;
    } catch (e) {
      if (!fallbackAi(room)) return false;
    }
    settleIfDone(room);
    bump(room);
    return true;
  }

  function kickAi(room) {
    if (room.status !== 'live') return;
    if (aiDelayMs === 0) {
      let guard = 0;
      while (guard++ < 80) {
        let acted = false;
        try { acted = stepAi(room); } catch (e) { break; }
        if (!acted) break;
      }
      return;
    }
    if (room.aiTimer) return;
    const loop = () => {
      room.aiTimer = null;
      let acted = false;
      try { acted = stepAi(room); } catch (e) { acted = false; }
      if (acted && room.status === 'live' && isAiTurn(room)) {
        room.aiTimer = setTimeout(loop, aiDelayMs);
      }
    };
    room.aiTimer = setTimeout(loop, aiDelayMs);
  }

  function isAiTurn(room) {
    if (!room.state || room.status !== 'live') return false;
    const actor = actorSeat(room.state);
    return actor != null && room.seats[actor] && room.seats[actor].kind === 'ai';
  }

  function requireRoom(code) {
    const room = rooms.get(normCode(code));
    if (!room || (room.purgeAt && now() > room.purgeAt)) throw new TischError('Diesen Tisch gibt es nicht.', 404);
    if (room.status === 'closed') throw new TischError('Der Tisch ist abgelaufen.', 410);
    return room;
  }

  function requireHuman(room, token) {
    const seat = room.seats.find((item) => tokenMatches(item, token));
    if (!seat) throw new TischError('Der Platz gehört Dir nicht.', 401);
    return seat;
  }

  function requireHost(room, seat) {
    if (seat.index !== room.hostSeat) throw new TischError('Nur der Gastgeber kann das.', 403);
  }

  function filled(room) {
    return room.seats.every((seat) => seat.kind === 'human' || seat.kind === 'ai');
  }

  function assignHuman(room, index, spec, claims) {
    const seat = room.seats[index];
    if (!seat || seat.kind !== 'empty') throw new TischError('Der Platz ist besetzt.', 409);
    const name = cleanName(spec && spec.name);
    if (!name) throw new TischError('Wie heißt Du?');
    const token = crypto.randomBytes(32).toString('hex');
    seat.kind = 'human';
    seat.name = name;
    seat.token = token;
    seat.tokenHash = hashToken(token);
    seat.externalId = cleanExternal(spec && spec.externalId);
    seat.playerId = cleanPlayerId(spec && spec.playerId);
    seat.conn = 0;
    seat.lastSeen = now();
    claims.push({ seat: index, token, name, externalId: seat.externalId, playerId: seat.playerId });
    return seat;
  }

  function assignAi(room, index, aiId) {
    const seat = room.seats[index];
    if (!seat || seat.kind !== 'empty') throw new TischError('Der Platz ist besetzt.', 409);
    const id = aiId && PARTNERS[aiId] ? aiId : 'horst';
    seat.kind = 'ai';
    seat.aiId = id;
    seat.name = PARTNERS[id];
    seat.token = null;
    seat.tokenHash = null;
    seat.externalId = null;
    seat.playerId = null;
    pushEvent(room, { kind: 'seat', seat: index, aiId: id, name: seat.name });
  }

  function speakerIndex(room) {
    const humans = room.seats.filter((seat) => seat.kind === 'human' && (seat.conn > 0 || now() - seat.lastSeen < 20000));
    if (!humans.length) return null;
    const host = humans.find((seat) => seat.index === room.hostSeat);
    return (host || humans[0]).index;
  }

  function statusLine(room, seatIndex) {
    if (room.status === 'lobby') return 'Wartet auf die Runde.';
    if (room.status === 'ended') {
      const winner = room.seats[room.winnerSeat];
      const name = winner ? winner.name : 'Jemand';
      return name + ' hat das Ziel ' + room.target + ' erreicht.';
    }
    if (room.status === 'closed') return 'Der Tisch ist geschlossen.';
    const state = room.state;
    if (!state) return 'Gleich geht es los.';
    if (state.phase === 'done') {
      if (state.result && state.result.passedIn) return 'Alle haben gepasst.';
      if (state.result && state.result.won != null && state.declarer != null) {
        const name = room.seats[state.declarer] ? room.seats[state.declarer].name : 'Jemand';
        return state.result.won ? name + ' gewinnt das Spiel.' : name + ' verliert das Spiel.';
      }
      return 'Spiel zu Ende.';
    }
    const actor = actorSeat(state);
    const doubling = state.phase === 'play' ? E.doublingTurn(state) : null;
    const name = room.seats[actor] && room.seats[actor].name;
    if (doubling) {
      if (actor === seatIndex) return doubling.kind === 'kontra' ? 'Kontra?' : 'Re?';
      return (name || 'Jemand') + (doubling.kind === 'kontra' ? ' überlegt ein Kontra.' : ' überlegt Re.');
    }
    const who = actor === seatIndex ? 'Du bist' : (name ? name + ' ist' : 'Jemand ist');
    if (state.phase === 'bidding') return who + ' am Reizen.';
    if (state.phase === 'skat') return who + ' dran: Hand oder Skat.';
    if (state.phase === 'discard') return who + ' drückt zwei Karten.';
    if (state.phase === 'declare') return who + ' sagt an.';
    if (state.phase === 'play') return who + ' am Zug.';
    return 'Am Tisch.';
  }

  function viewOf(room, seatIndex) {
    const seat = room.seats[seatIndex];
    if (seat) seat.lastSeen = now();
    const roles = room.state ? [0, 1, 2].map((index) => E.positionName(room.state, index)) : ['', '', ''];
    const seats = room.seats.map((item) => {
      const pub = publicSeat(item, seatIndex, now());
      pub.host = item.index === room.hostSeat;
      pub.role = roles[item.index] || '';
      pub.score = room.scores[item.index] || 0;
      return pub;
    });
    const view = {
      code: room.code,
      tableId: room.id,
      invitePath: '/tisch/?code=' + room.code,
      rev: room.rev,
      you: seatIndex,
      youAreHost: seatIndex === room.hostSeat,
      hostSeat: room.hostSeat,
      aiSpeaker: speakerIndex(room) === seatIndex,
      status: room.status,
      tournamentId: room.tournamentId,
      roundId: room.roundId,
      label: room.label,
      rules: { mode: room.rules.mode },
      level: room.level,
      target: room.target,
      winnerSeat: room.winnerSeat,
      scores: room.scores.slice(),
      gameNo: room.gameNo,
      seats,
      chat: room.chat.slice(-40).map((line) => ({
        id: line.id, at: line.at, seat: line.seat, name: line.name, text: line.text, ai: !!line.ai, aiId: line.aiId || null,
      })),
      events: room.events.slice(-40),
      yourTurn: false,
      legal: [],
      hand: [],
      handSizes: [0, 0, 0],
      phase: room.status === 'lobby' ? 'lobby' : (room.state ? room.state.phase : room.status),
      statusLine: statusLine(room, seatIndex),
      expiresAt: room.activityAt + ttlMs,
      seriesId: room.seriesId,
    };
    const state = room.state;
    if (!state) return view;
    const mine = E.viewFor(state, seatIndex);
    view.hand = mine.hand;
    view.handSizes = mine.handSizes;
    view.trick = mine.trick;
    view.tricks = mine.tricks;
    view.lastTrick = state.lastTrick
      ? { cards: state.lastTrick.cards.map((card) => ({ player: card.player, card: card.card })), winner: state.lastTrick.winner, points: state.lastTrick.points }
      : null;
    view.declarer = mine.declarer;
    view.bid = mine.bid;
    view.bidValue = mine.bidValue;
    view.bidHistory = mine.bidHistory;
    view.game = mine.game;
    view.gameLabel = state.game ? E.gameLabel(state.game) : '';
    view.dealer = mine.dealer;
    view.pos = mine.pos;
    view.turn = state.phase === 'play' ? state.turn : actorSeat(state);
    view.skatCount = 2;
    view.skatKnown = mine.skatKnown || null;
    view.openHand = mine.openHand || null;
    view.special = mine.special;
    view.bidding = state.phase === 'bidding' ? E.biddingTurn(state) : null;
    view.kontra = !!mine.kontra;
    view.re = !!mine.re;
    view.doubling = mine.doubling || null;
    view.result = publicResult(state.result);
    view.yourTurn = actorSeat(state) === seatIndex && room.status === 'live';
    if (view.yourTurn && state.phase === 'play' && !view.doubling) view.legal = E.legalFor(state, seatIndex);
    return view;
  }

  function summary(room) {
    return {
      id: room.id,
      code: room.code,
      tournamentId: room.tournamentId,
      roundId: room.roundId,
      label: room.label,
      target: room.target,
      status: room.status,
      hostSeat: room.hostSeat,
      winnerSeat: room.winnerSeat,
      scores: room.scores.slice(),
    };
  }

  function createRoom(spec) {
    const input = spec || {};
    const claims = [];
    const room = {
      id: 'tbl_' + crypto.randomBytes(8).toString('hex'),
      code: uniqueCode(),
      tournamentId: cleanId(input.tournamentId, 'Turnier'),
      roundId: cleanId(input.roundId, 'Runde'),
      label: input.label ? cleanName(input.label) || null : null,
      createdAt: now(),
      updatedAt: now(),
      activityAt: now(),
      closedAt: null,
      closeReason: null,
      purgeAt: null,
      endedAt: null,
      status: 'lobby',
      rules: { mode: input.mode === 'kneipe' || (input.rules && input.rules.mode === 'kneipe') ? 'kneipe' : 'official' },
      level: LEVELS.indexOf(input.level) === -1 ? 'kneipe' : input.level,
      target: resolveTarget(input),
      hostSeat: 0,
      seats: [emptySeat(0), emptySeat(1), emptySeat(2)],
      chat: [],
      chatSeq: 0,
      aiReplies: {},
      rev: 1,
      eventSeq: 0,
      events: [],
      scores: [0, 0, 0],
      match: null,
      state: null,
      gameNo: 0,
      gameIds: [],
      winnerSeat: null,
      seriesId: null,
      scriptedDecks: allowDecks && Array.isArray(input.decks) ? input.decks.map((deck) => deck.slice()) : null,
      lineupLocked: Array.isArray(input.seats),
      aiTimer: null,
    };
    if (Array.isArray(input.seats)) {
      if (input.seats.length < 1 || input.seats.length > 3) throw new TischError('Ein Tisch hat höchstens drei Plätze.');
      input.seats.forEach((seatSpec, index) => {
        if (!seatSpec || seatSpec.kind === 'empty') return;
        if (seatSpec.kind === 'ai') assignAi(room, index, seatSpec.aiId || 'horst');
        else assignHuman(room, index, seatSpec, claims);
      });
    } else {
      assignHuman(room, 0, { name: input.name, externalId: input.externalId, playerId: input.playerId }, claims);
    }
    if (!room.seats.some((seat) => seat.kind === 'human')) throw new TischError('Mindestens ein Mensch muss sitzen.');
    const host = room.seats.find((seat) => seat.kind === 'human');
    room.hostSeat = host.index;
    rooms.set(room.code, room);
    byId.set(room.id, room);
    return { summary: summary(room), claims };
  }

  function join(code, name, spec) {
    const room = requireRoom(code);
    if (room.status !== 'lobby') throw new TischError('Die Runde spielt schon.', 409);
    const index = room.seats.findIndex((seat) => seat.kind === 'empty');
    if (index < 0) throw new TischError('Der Tisch ist voll.', 409);
    const claims = [];
    assignHuman(room, index, {
      name,
      externalId: spec && spec.externalId,
      playerId: spec && spec.playerId,
    }, claims);
    pushEvent(room, { kind: 'join', seat: index, name: claims[0].name });
    bump(room);
    return { claim: claims[0], view: viewOf(room, index) };
  }

  function rejoin(code, token) {
    const room = requireRoom(code);
    const seat = requireHuman(room, token);
    seat.lastSeen = now();
    touch(room);
    return viewOf(room, seat.index);
  }

  function addChat(room, seatIndex, text, extra) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) throw new TischError('Die Nachricht ist leer.');
    if (clean.length > 240) throw new TischError('Die Nachricht ist zu lang.');
    const seat = room.seats[seatIndex];
    const last = seat && room.chat.length ? room.chat[room.chat.length - 1] : null;
    if (last && last.seat === seatIndex && now() - last.at < 350) throw new TischError('Kurz warten.', 429);
    room.chatSeq += 1;
    const line = {
      id: room.chatSeq,
      at: now(),
      seat: seatIndex,
      name: extra && extra.name ? extra.name : (seat ? seat.name : ''),
      text: clean,
      ai: !!(extra && extra.ai),
      aiId: extra && extra.aiId ? extra.aiId : null,
      replyTo: extra && extra.replyTo ? extra.replyTo : null,
    };
    room.chat.push(line);
    if (room.chat.length > 80) room.chat.shift();
    pushEvent(room, { kind: 'chat', id: line.id, seat: line.seat, ai: line.ai, aiId: line.aiId });
    return line;
  }

  function act(code, token, action, payload) {
    const room = requireRoom(code);
    const seat = requireHuman(room, token);
    const body = payload || {};
    const state = room.state;
    seat.lastSeen = now();

    if (action === 'chat') {
      addChat(room, seat.index, body.text);
    } else if (action === 'aiSay') {
      if (speakerIndex(room) !== seat.index) throw new TischError('Nur ein Gerät antwortet für die Spielpartner.', 403);
      const aiId = body.aiId;
      const partner = room.seats.find((item) => item.kind === 'ai' && item.aiId === aiId);
      if (!partner) throw new TischError('Der Spielpartner sitzt hier nicht.', 404);
      const replyTo = Number(body.replyTo);
      if (!replyTo) throw new TischError('Die Antwort hängt an keiner Nachricht.');
      const key = replyTo + ':' + aiId;
      if (room.aiReplies[key]) return viewOf(room, seat.index);
      room.aiReplies[key] = true;
      addChat(room, partner.index, body.text, { ai: true, aiId, name: partner.name, replyTo });
    } else if (action === 'fill') {
      requireHost(room, seat);
      if (room.status !== 'lobby') throw new TischError('Im Spiel bleiben die Plätze, wie sie sind.', 409);
      if (room.lineupLocked && room.tournamentId) throw new TischError('Die Plätze vergibt der Tisch.', 403);
      let index = body.seatIndex == null ? room.seats.findIndex((item) => item.kind === 'empty') : Number(body.seatIndex);
      if (!room.seats[index] || room.seats[index].kind !== 'empty') throw new TischError('Der Platz ist besetzt.', 409);
      assignAi(room, index, body.aiId || 'horst');
    } else if (action === 'clear') {
      requireHost(room, seat);
      if (room.status !== 'lobby') throw new TischError('Im Spiel bleiben die Plätze, wie sie sind.', 409);
      const index = Number(body.seatIndex);
      const target = room.seats[index];
      if (!target || target.kind !== 'ai') throw new TischError('Nur einen Spielpartner kannst Du wieder frei machen.', 409);
      freeSeat(target);
      pushEvent(room, { kind: 'clear', seat: index });
    } else if (action === 'leave') {
      if (room.status !== 'lobby') throw new TischError('Im Spiel bleibt Dein Platz. Lade die Seite neu.', 409);
      const leavingHost = seat.index === room.hostSeat;
      freeSeat(seat);
      pushEvent(room, { kind: 'leave', seat: seat.index });
      if (!room.seats.some((item) => item.kind === 'human')) {
        room.status = 'closed';
        room.closeReason = 'empty';
        room.closedAt = now();
        room.purgeAt = now() + ttlMs;
      } else if (leavingHost) {
        room.hostSeat = room.seats.find((item) => item.kind === 'human').index;
      }
      bump(room);
      return { left: true };
    } else if (action === 'start' || action === 'next') {
      requireHost(room, seat);
      if (room.status === 'ended') throw new TischError('Der Tisch ist beendet. ' + statusLine(room, seat.index), 409);
      if (action === 'start') {
        if (room.status !== 'lobby') throw new TischError('Das Spiel läuft schon.', 409);
        if (!filled(room)) throw new TischError('Noch ist ein Platz frei.', 409);
      } else {
        if (!state || state.phase !== 'done') throw new TischError('Erst wenn das Spiel zu Ende ist.', 409);
        if (room.status !== 'live') throw new TischError('Gerade läuft kein Spiel.', 409);
      }
      deal(room);
    } else if (action === 'bid') {
      if (!state || state.phase !== 'bidding') throw new TischError('Gerade wird nicht gereizt.', 409);
      if (actorSeat(state) !== seat.index) throw new TischError('Du bist nicht dran.', 409);
      try { E.bidAction(state, !!body.yes); }
      catch (e) { throw new TischError(e.message || 'Das geht gerade nicht.', 409); }
      const last = state.bidding.history[state.bidding.history.length - 1];
      pushEvent(room, { kind: 'bid', seat: seat.index, action: last ? last.action : 'pass', value: last ? last.value : 0 });
      settleIfDone(room);
    } else if (action === 'take') {
      if (!state || state.phase !== 'skat' || state.declarer !== seat.index) throw new TischError('Du bist nicht dran.', 409);
      E.takeSkat(state);
      pushEvent(room, { kind: 'skat', seat: seat.index });
    } else if (action === 'hand') {
      if (!state || state.phase !== 'skat' || state.declarer !== seat.index) throw new TischError('Du bist nicht dran.', 409);
      E.playHand(state);
      pushEvent(room, { kind: 'hand', seat: seat.index });
    } else if (action === 'discard') {
      if (!state || state.phase !== 'discard' || state.declarer !== seat.index) throw new TischError('Du bist nicht dran.', 409);
      const cards = Array.isArray(body.cards) ? body.cards : [];
      try { E.discard(state, cards); }
      catch (e) { throw new TischError(e.message || 'Diese Karten kannst Du nicht drücken.', 409); }
      pushEvent(room, { kind: 'discard', seat: seat.index });
    } else if (action === 'declare') {
      if (!state || state.phase !== 'declare' || state.declarer !== seat.index) throw new TischError('Du bist nicht dran.', 409);
      try { E.declare(state, sanitizeGame(body.game || body)); }
      catch (e) { throw new TischError(e.message || 'Die Ansage geht so nicht.', 409); }
      pushEvent(room, { kind: 'declare', seat: seat.index, label: E.gameLabel(state.game) });
    } else if (action === 'double') {
      const doubling = state && E.doublingTurn(state);
      if (!doubling || doubling.player !== seat.index) throw new TischError('Du bist nicht dran.', 409);
      try {
        if (body.yes && doubling.kind === 'kontra') E.sayKontra(state, seat.index);
        else if (body.yes) E.sayRe(state, seat.index);
        else E.declineDouble(state, seat.index);
      } catch (e) {
        throw new TischError(e.message || 'Das geht gerade nicht.', 409);
      }
      pushEvent(room, { kind: doubling.kind, seat: seat.index, yes: !!body.yes });
    } else if (action === 'play') {
      if (!state || state.phase !== 'play') throw new TischError('Gerade wird nicht gespielt.', 409);
      if (E.doublingTurn(state)) throw new TischError('Erst Kontra oder Re.', 409);
      try {
        const info = E.playCard(state, seat.index, body.card);
        pushEvent(room, { kind: 'play', seat: seat.index, card: body.card });
        if (info.trickComplete) pushEvent(room, { kind: 'trick', winner: info.winner });
      } catch (e) {
        throw new TischError(e.message || 'Die Karte geht nicht.', 409);
      }
      settleIfDone(room);
    } else {
      throw new TischError('Unbekannte Aktion.', 404);
    }

    bump(room);
    if (room.status === 'live') kickAi(room);
    if (seat.kind !== 'human' || !seat.token) return { left: true };
    return viewOf(room, seat.index);
  }

  function markConn(code, token, delta) {
    let room;
    try { room = requireRoom(code); } catch (e) { return; }
    const seat = room.seats.find((item) => tokenMatches(item, token));
    if (!seat) return;
    seat.conn = Math.max(0, seat.conn + delta);
    seat.lastSeen = now();
    if (delta > 0) touch(room);
  }

  function sweep() {
    const stamp = now();
    for (const room of rooms.values()) {
      if (room.status !== 'closed' && stamp - room.activityAt > ttlMs) {
        room.status = 'closed';
        room.closeReason = 'expired';
        room.closedAt = stamp;
        room.purgeAt = stamp + ttlMs;
        if (room.aiTimer) clearTimeout(room.aiTimer);
      }
      if (room.purgeAt && stamp > room.purgeAt) {
        rooms.delete(room.code);
        byId.delete(room.id);
      }
    }
  }

  function listResults(filter, auth) {
    const f = filter || {};
    if (f.tournamentId) {
      if (!auth || !auth.admin) throw new TischError('Dafür fehlt die Berechtigung.', 401);
      return results.list({ tournamentId: f.tournamentId, roundId: f.roundId, kind: f.kind });
    }
    if (!f.code) throw new TischError('Welcher Tisch?');
    const code = normCode(f.code);
    if (auth && auth.admin) return results.list({ code, kind: f.kind });
    if (!auth || !auth.token) throw new TischError('Der Platz gehört Dir nicht.', 401);
    const room = rooms.get(code);
    if (room && room.seats.some((seat) => tokenMatches(seat, auth.token))) {
      return results.list({ code, kind: f.kind });
    }
    return results.findAuthorized(code, hashToken(auth.token));
  }

  function adminOk(header) {
    if (!adminToken) return false;
    const got = String(header || '');
    const want = 'Bearer ' + adminToken;
    if (got.length !== want.length) return false;
    try { return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want)); }
    catch (e) { return false; }
  }

  return {
    createRoom,
    join,
    rejoin,
    act,
    markConn,
    sweep,
    listResults,
    adminOk,
    viewOf,
    requireRoom,
    requireHuman,
    now,
    ttlMs,
    hasAdmin: !!adminToken,
    E,
  };
}

function CODE_LEN_BYTES() { return 6; }

module.exports = {
  createHub,
  TischError,
  ALPHABET,
  PARTNERS,
  DEFAULT_TTL_MS,
  DEFAULT_TARGET,
  hashToken,
  normCode,
};
