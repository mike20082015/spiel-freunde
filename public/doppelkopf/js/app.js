/* Spiel-Freunde Doppelkopf: Tisch, Spiele und Mitreden. */
(function () {
  'use strict';
  const E = window.DoppelkopfEngine;
  const AI = window.DoppelkopfAI;
  const Talk = window.DoppelkopfTalk;
  const Voice = window.DoppelkopfVoice;
  const C = window.DoppelkopfCards;
  const Seats = window.DoppelkopfSeats;

  const SPEEDS = { slow: 1.45, normal: 1, fast: 0.35 };
  const LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  const DEFAULTS = {
    level: 'kneipe', target: '20', targetCustom: 20, sound: true, volume: 80,
    talk: 'chat', handsFree: false, hints: false, speed: 'normal',
    rules: {
      neunen: true, zweiteDulle: true, schweinchen: false, armut: false, hochzeit: true,
      damen: true, buben: true, farben: true, fleischlos: true, sonderpunkte: true, pflichtsolo: false,
    },
  };
  const CANCEL = { cancelled: true };
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function load(key, def) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ? Object.assign({}, def, v) : Object.assign({}, def);
    } catch (e) { return Object.assign({}, def); }
  }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* privat */ } }

  const settings = load('sf-doppelkopf-settings', DEFAULTS);
  settings.rules = E.normalizeRules(Object.assign({}, DEFAULTS.rules, settings.rules || {}));
  if (!LEVELS[settings.level]) settings.level = 'kneipe';
  if (params.get('speed')) settings.speed = params.get('speed');
  if (LEVELS[params.get('level')]) settings.level = params.get('level');
  const saveSettings = () => store('sf-doppelkopf-settings', settings);
  if (params.get('fresh')) { try { localStorage.removeItem('sf-doppelkopf-match'); } catch (e) { /* egal */ } }
  if (Voice) Voice.init({ getSettings: () => settings });

  let rng = params.get('seed') ? E.seededRng(+params.get('seed') || 1) : E.cryptoRng();
  let match = load('sf-doppelkopf-match', null);
  function blankMatch() {
    return { scores: [0, 0, 0, 0], dealer: 3, handNo: 0, rows: [], winner: null, pflicht: [false, false, false, false], roundGames: 0 };
  }
  if (!match || !match.scores || match.scores.length !== 4) match = blankMatch();
  match.rows = match.rows || [];
  match.pflicht = match.pflicht && match.pflicht.length === 4 ? match.pflicht : [false, false, false, false];
  match.roundGames = match.roundGames || 0;
  function saveMatch() {
    store('sf-doppelkopf-match', {
      scores: match.scores, dealer: match.dealer, handNo: match.handNo,
      rows: match.rows.slice(-80), winner: match.winner, pflicht: match.pflicht, roundGames: match.roundGames,
    });
  }

  const S = {
    state: null, gen: 0, busy: false, humanWait: null, nextWait: null,
    started: false, lastTalk: [0, 0, 0, 0], bubbleTimers: [], settled: false,
    showLast: false, contractSaid: '', evAt: 0, pick: [],
    watch: params.get('watch') === '1',
  };

  function delay(ms) {
    const g = S.gen;
    return new Promise((res) => setTimeout(res, ms * (SPEEDS[settings.speed] || 1))).then(() => {
      if (g !== S.gen) throw CANCEL;
    });
  }
  const targetValue = () => E.normalizeTarget(settings.target, settings.targetCustom);
  const rulesNow = () => E.normalizeRules(settings.rules);
  const seatById = (id) => Seats.seats.find((p) => p.id === id);
  const who = (seat) => Seats.seats[seat];

  function logLine(html, cls) {
    const log = $('chat-log');
    const p = document.createElement('p');
    p.className = 'cl' + (cls ? ' ' + cls : '');
    p.innerHTML = html;
    log.appendChild(p);
    while (log.children.length > 120) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
  function sys(text) { logLine(esc(text), 'sys'); }
  function showTyping(name) {
    const log = $('chat-log');
    const p = document.createElement('p');
    p.className = 'cl typing';
    p.innerHTML = '<b>' + esc(name) + ':</b><span class="typing-label"> schreibt</span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  function say(seat, text, opts) {
    opts = opts || {};
    if (!text) return false;
    const person = who(seat);
    if (!person) return false;
    const now = Date.now();
    if (!opts.force && now - S.lastTalk[seat] < 2200) return false;
    S.lastTalk[seat] = now;
    if (seat !== 0) logLine('<b>' + esc(person.name) + ':</b> ' + esc(text), person.id);
    const el = $('bubble-' + seat);
    const node = $('seat-' + seat);
    const show = () => {
      if (!el) return;
      el.textContent = text;
      el.classList.add('show');
    };
    const hideLater = (ms) => {
      clearTimeout(S.bubbleTimers[seat]);
      S.bubbleTimers[seat] = setTimeout(() => { if (el) el.classList.remove('show'); }, ms);
    };
    if (person.voice && Voice && settings.sound) {
      const queued = Voice.speak(person.id, text, {
        priority: opts.priority,
        onStart: () => { show(); if (node) node.classList.add('speaking'); },
        onEnd: () => { if (node) node.classList.remove('speaking'); hideLater(500); },
      });
      if (queued) return true;
    }
    show();
    hideLater(Math.min(5200, 1800 + text.length * 36));
    return true;
  }
  function talk(seat, event, prob, force) {
    if (prob != null && Math.random() > prob) return false;
    const person = who(seat);
    if (!person || person.id === 'du') return false;
    let ev = event;
    if (settings.level === 'anfaenger' && ev === 'lose') ev = 'encourage';
    return say(seat, Talk.line(person.id, ev), { force: force });
  }

  async function playerFace() {
    const api = window.SpielFreundeAvatar;
    if (!api || typeof api.playerSeat !== 'function') return null;
    let info;
    try { info = await api.playerSeat(); } catch (e) { return null; }
    if (!info || typeof info !== 'object') return null;
    const src = info.imageUrl || info.image || info.portrait || info.src || info.photo || '';
    const initials = (typeof info.initials === 'string' && info.initials) || (typeof info.initial === 'string' && info.initial) || 'Du';
    return {
      src: typeof src === 'string' ? src : '',
      initials: initials,
      name: typeof info.name === 'string' && info.name ? info.name : 'Du',
    };
  }
  async function mountPortraits() {
    Seats.seats.forEach((p) => {
      if (p.seat === 0) return;
      const wrap = $('ava-' + p.seat);
      wrap.querySelector('.ini').textContent = p.initials;
      $('name-' + p.seat).textContent = p.name;
      if (!p.portrait) return;
      const img = document.createElement('img');
      img.className = 'ava';
      img.alt = p.full;
      img.addEventListener('error', () => img.remove());
      img.src = p.portrait;
      wrap.insertBefore(img, wrap.firstChild);
    });
    const face = await playerFace();
    if (!face) return;
    $('you-ini').textContent = face.initials || 'Du';
    if (!face.src) return;
    const img = document.createElement('img');
    img.alt = face.name || 'Du';
    img.addEventListener('error', () => img.remove());
    img.src = face.src;
    $('you-ava').appendChild(img);
  }

  function chip(text) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.innerHTML = text;
    return span;
  }
  function renderBacks(seat) {
    const el = $('backs-' + seat);
    if (!el || !S.state) return;
    const n = Math.min(S.state.hands[seat].length, 8);
    el.innerHTML = '';
    for (let i = 0; i < n; i++) el.appendChild(C.backEl());
  }
  function renderSeats() {
    const st = S.state;
    for (let s = 0; s < 4; s++) {
      const node = $('seat-' + s);
      if (node) node.classList.toggle('active', !!(st && st.turn === s && st.phase !== 'done'));
      const role = $('role-' + s);
      if (!role) continue;
      role.innerHTML = '';
      const tags = [];
      if (st && st.dealer === s) tags.push('Geber');
      if (st && st.game) {
        const shown = E.revealedRole(st, s);
        if (shown) tags.push(shown);
        if (st.game.type === 'solo' && st.game.declarer === s) tags.push('Solo');
        if (st.game.type === 'hochzeit' && st.game.declarer === s && !st.game.clarified) tags.push('Hochzeit');
      }
      if (st && st.phase !== 'done') tags.push(st.hands[s].length + ' Karten');
      tags.forEach((t) => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = t;
        role.appendChild(span);
      });
      if (s > 0) renderBacks(s);
    }
  }
  function renderTrick() {
    const st = S.state;
    const cards = (S.showLast && st && st.lastTrick && (!st.trick || !st.trick.length)) ? st.lastTrick : (st && st.trick) || [];
    for (let s = 0; s < 4; s++) {
      const slot = $('trick-' + s);
      slot.innerHTML = '';
      const found = cards.find((t) => t.seat === s);
      if (found) slot.appendChild(C.cardEl(found.card));
    }
    const mid = $('trick-mid');
    if (!st || !st.game || st.phase === 'reserve' || st.phase === 'solo' || st.phase === 'armutTake' || st.phase === 'armutGive' || st.phase === 'armutBack') {
      mid.textContent = st && st.phase.indexOf('armut') === 0 ? 'Armut' : 'Stich';
      return;
    }
    let html = esc(E.describeGame(st.game));
    if (st.lastTrick && st.phase === 'play') html += '<button type="button" class="last-toggle" id="btn-last">' + (S.showLast ? 'Aktueller Stich' : 'Letzter Stich') + '</button>';
    mid.innerHTML = html;
    const btn = $('btn-last');
    if (btn) btn.addEventListener('click', () => { S.showLast = !S.showLast; renderTrick(); });
  }
  function selecting() {
    const st = S.state;
    return !!(st && st.turn === 0 && (st.phase === 'armutGive' || st.phase === 'armutBack'));
  }
  function renderHand() {
    const el = $('hand');
    el.innerHTML = '';
    const st = S.state;
    if (!st) return;
    const mine = st.turn === 0 && st.phase === 'play' && S.humanWait;
    const legal = mine ? E.legalCards(st, 0) : [];
    const hintCard = settings.hints && mine ? AI.playCard(st, 0, 'anfaenger') : null;
    const shape = st.game || { type: 'normal', solo: null, suit: 'D' };
    E.sortHand(st.hands[0], shape, st.rules, st.pigsOn).forEach((card) => {
      const node = C.cardEl(card, { tag: 'button' });
      const playable = legal.indexOf(card) >= 0;
      if (playable) node.classList.add('playable');
      if (selecting()) node.classList.add('playable');
      if (S.pick.indexOf(card) >= 0) node.classList.add('selected');
      if (hintCard === card) node.classList.add('suggest');
      node.addEventListener('click', () => {
        if (selecting()) {
          const i = S.pick.indexOf(card);
          if (i >= 0) S.pick.splice(i, 1);
          else if (S.pick.length < 3) S.pick.push(card);
          renderHand();
          renderActions();
          return;
        }
        if (!S.humanWait || st.turn !== 0 || st.phase !== 'play') return;
        const res = E.actPlay(st, 0, card);
        if (!res.ok) { note(res.reason); return; }
        S.showLast = false;
        releaseHuman();
      });
      el.appendChild(node);
    });
  }
  function pflichtNow(seat) {
    return !!(S.state && S.state.rules.pflichtsolo && !S.state.matchPflicht[seat]);
  }
  function renderChooser() {
    const st = S.state;
    const box = $('chooser');
    const show = !!(st && st.turn === 0 && S.humanWait && (st.phase === 'reserve' || st.phase === 'solo'));
    box.hidden = !show;
    if (!show) return;
    $('chooser-title').textContent = st.phase === 'solo' ? 'Vorführung: du musst ein Solo nennen.' : 'Gesund, oder ein Vorbehalt?';
    const wrap = $('chooser-games');
    wrap.innerHTML = '';
    const add = (label, fn, cls) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls || '';
      b.textContent = label;
      b.addEventListener('click', fn);
      wrap.appendChild(b);
    };
    if (st.phase === 'reserve') {
      add('Gesund', () => sendBid({ kind: 'gesund' }), 'chooser-pass');
      if (st.rules.hochzeit && E.countType(st.hands[0], 'CQ') >= 2) add('Hochzeit', () => sendBid({ kind: 'hochzeit' }));
      const tr = st.hands[0].filter((c) => E.isTrump(c, { type: 'normal' }, st.rules, false)).length;
      if (st.rules.armut && tr <= 3) add('Armut', () => sendBid({ kind: 'armut' }));
    }
    const mustPflicht = st.phase === 'solo' || pflichtNow(0);
    E.listSolos(st.rules).forEach((s) => {
      const label = E.describeGame({ type: 'solo', solo: s.solo, suit: s.suit }) + (mustPflicht ? ' · Pflicht' : '');
      add(label, () => sendBid({ kind: 'solo', solo: s.solo, suit: s.suit, pflicht: mustPflicht && st.phase !== 'solo' }));
    });
  }
  function sendBid(choice) {
    const st = S.state;
    const res = st.phase === 'solo'
      ? E.actSolo(st, 0, choice)
      : E.actReserve(st, 0, choice);
    if (!res.ok) { note(res.reason); return; }
    releaseHuman();
  }
  function renderActions() {
    const box = $('actions');
    box.innerHTML = '';
    const st = S.state;
    if (!st || !S.humanWait || st.turn !== 0) return;
    const add = (label, fn, primary) => {
      const b = document.createElement('button');
      b.type = 'button';
      if (primary) b.className = 'primary';
      b.textContent = label;
      b.addEventListener('click', fn);
      box.appendChild(b);
    };
    if (st.phase === 'armutTake') {
      add('Mitnehmen', () => {
        const res = E.actArmutTake(st, 0, true);
        if (!res.ok) { note(res.reason); return; }
        releaseHuman();
      }, true);
      add('Weiter', () => {
        const res = E.actArmutTake(st, 0, false);
        if (!res.ok) { note(res.reason); return; }
        releaseHuman();
      });
    } else if (st.phase === 'armutGive' || st.phase === 'armutBack') {
      const n = st.phase === 'armutBack' ? st.armut.given.length : S.pick.length;
      add(st.phase === 'armutGive' ? 'Abgeben (' + S.pick.length + ')' : 'Zurückgeben (' + S.pick.length + '/' + n + ')', () => {
        const res = st.phase === 'armutGive' ? E.actArmutGive(st, 0, S.pick.slice()) : E.actArmutBack(st, 0, S.pick.slice());
        if (!res.ok) { note(res.reason); return; }
        S.pick = [];
        releaseHuman();
      }, true);
    } else if (st.phase === 'play') {
      E.legalAnnouncements(st, 0).forEach((kind) => {
        add(E.announceName(kind), () => {
          const res = E.actAnnounce(st, 0, kind);
          if (!res.ok) { note(res.reason); return; }
          drainEvents();
          render();
        }, kind === 're' || kind === 'kontra');
      });
    }
  }
  function note(text) {
    const box = $('hint-box');
    box.hidden = false;
    box.textContent = text;
    box.classList.remove('shake');
    void box.offsetWidth;
    box.classList.add('shake');
  }
  function renderHint() {
    const box = $('hint-box');
    const st = S.state;
    if (!settings.hints || !st || st.turn !== 0 || st.phase === 'done') {
      if (!box.textContent || box.textContent.indexOf('nicht') < 0) box.hidden = true;
      return;
    }
    let text = '';
    if (st.phase === 'reserve') text = 'Gesund, oder ein Vorbehalt. Hochzeit nur mit beiden Kreuz-Damen. Ein Solo lohnt mit vielen Trümpfen.';
    else if (st.phase === 'solo') text = 'Vorführung: du musst jetzt ein Solo spielen. Danach wechselt der Geber.';
    else if (st.phase === 'play') text = 'Farbe bedienen, Trumpf auf Trumpf. Re und Kontra, solange du noch genug Karten hast. Stechen musst du nicht.';
    else if (st.phase === 'armutGive') text = 'Alle Trümpfe abgeben, höchstens drei Karten. Der Partner gibt ebenso viele zurück.';
    else if (st.phase === 'armutBack') text = 'Trümpfe nur von unten. Sag mit den Karten, wie viele Trümpfe zurückgehen.';
    else if (st.phase === 'armutTake') text = 'Mitnehmen heißt: ihr zwei seid Re. Wer passt, lässt die Armut weitergehen.';
    if (!text) { box.hidden = true; return; }
    box.hidden = false;
    box.textContent = text;
  }
  function renderStatus() {
    const st = S.state;
    const main = $('st-main');
    const chips = $('st-chips');
    chips.innerHTML = '';
    if (!st) { main.textContent = 'Willkommen am Doppelkopf-Tisch'; return; }
    const name = who(st.turn) ? who(st.turn).name : '';
    const you = st.turn === 0;
    if (st.phase === 'done' && st.result) main.textContent = st.result.note || st.result.label;
    else if (st.phase === 'reserve') main.textContent = (you ? 'Du bist' : name + ' ist') + ' dran: gesund oder Vorbehalt';
    else if (st.phase === 'solo') main.textContent = (you ? 'Du musst' : name + ' muss') + ' ein Solo vorführen';
    else if (st.phase === 'armutTake') main.textContent = (you ? 'Du' : name) + ' kannst die Armut mitnehmen';
    else if (st.phase === 'armutGive') main.textContent = (you ? 'Du gibst' : name + ' gibt') + ' die Armut ab';
    else if (st.phase === 'armutBack') main.textContent = (you ? 'Du gibst' : name + ' gibt') + ' Karten zurück';
    else if (st.phase === 'play') main.textContent = (you ? 'Du spielst' : name + ' spielt') + ' eine Karte';
    else main.textContent = 'Am Tisch';
    if (st.game && st.phase === 'play') chips.appendChild(chip('<b>' + esc(E.describeGame(st.game)) + '</b>'));
    if (st.ann && st.ann.re) chips.appendChild(chip('Re'));
    if (st.ann && st.ann.kontra) chips.appendChild(chip('Kontra'));
    if (st.pigsOn) chips.appendChild(chip('Schweinchen'));
    if (st.rules && st.rules.pflichtsolo) chips.appendChild(chip('Spiel ' + (match.handNo + 1)));
  }
  function renderScore() {
    const target = targetValue();
    $('mode-badge').textContent = String(target);
    const names = Seats.seats.map((p) => p.name);
    let html = '<thead><tr><th>Spiel</th>' + names.map((n) => '<th>' + esc(n) + '</th>').join('') + '</tr></thead><tbody>';
    match.rows.slice(-12).forEach((row) => {
      html += '<tr><td>' + esc(row.label) + '</td>' + row.deltas.map((n) => '<td class="' + (n > 0 ? 'pos' : n < 0 ? 'neg' : '') + '">' + (n > 0 ? '+' : '') + n + '</td>').join('') + '</tr>';
    });
    html += '</tbody><tfoot><tr><td>Stand</td>' + match.scores.map((n) => '<td>' + n + '</td>').join('') + '</tr></tfoot>';
    $('score-table').innerHTML = html;
    const best = match.scores.reduce((m, n) => Math.max(m, n), 0);
    let bars = '';
    match.scores.forEach((n, i) => {
      const pct = target > 0 ? Math.max(0, Math.min(100, Math.round(n / target * 100))) : 0;
      bars += '<div class="ti-row' + (n === best && best > 0 ? ' lead' : '') + '"><span class="ti-name">' + esc(names[i]) + '</span><span class="ti-bar"><i style="width:' + pct + '%"></i></span><span class="ti-val">' + n + '</span></div>';
    });
    $('target-info').innerHTML = '<div class="ti-head"><span>bis ' + target + '</span><b>' + match.handNo + ' Spiele</b></div>' + bars;
    const r = rulesNow();
    $('tariff').textContent = (r.neunen ? '48 Karten' : 'ohne Neunen') + ', ' + (r.zweiteDulle ? 'zweite Dulle sticht' : 'erste Dulle sticht') + '. Re 121, Kontra 120 ohne Ansage. Kein Geld.';
  }
  function render() {
    renderSeats();
    renderTrick();
    renderHand();
    renderChooser();
    renderActions();
    renderStatus();
    renderHint();
    renderScore();
  }
  function renderTop() {
    $('level-label').textContent = LEVELS[settings.level] || 'Kneipe';
    $('btn-level').dataset.level = settings.level;
    $('btn-sound').setAttribute('aria-pressed', String(!!settings.sound));
    $('btn-sound').classList.toggle('off', !settings.sound);
    $('btn-talk').setAttribute('aria-pressed', String(settings.talk === 'voice'));
    $('btn-hint').setAttribute('aria-pressed', String(!!settings.hints));
    $('intro-small').textContent = 'Spielstärke ' + (LEVELS[settings.level] || '') + ' · bis ' + targetValue() + ' · Ton ' + (settings.sound ? 'an' : 'aus');
  }

  function releaseHuman() {
    const fn = S.humanWait;
    S.humanWait = null;
    if (fn) fn();
  }
  function humanToMove(st) {
    return st && st.turn === 0 && st.phase !== 'done' && !S.watch;
  }
  function drainEvents() {
    const st = S.state;
    if (!st || !st.events) return;
    while (S.evAt < st.events.length) {
      const e = st.events[S.evAt];
      S.evAt += 1;
      if (e.type === 'ansage') {
        sys(who(e.seat).name + ' sagt ' + E.announceName(e.kind) + '.');
        if (e.seat !== 0 && (e.kind === 're' || e.kind === 'kontra')) talk(e.seat, e.kind, 1, true);
      } else if (e.type === 'schweinchen') {
        sys('Schweinchen. Die Karo-Asse stehen über den Dullen.');
        if (e.seat !== 0) talk(e.seat, 'schweinchen', 1, true);
        else talk(2, 'schweinchen', 0.8, true);
      } else if (e.type === 'geklaert') {
        sys('Hochzeit geklärt. Partner ist ' + who(e.seat).name + '.');
      } else if (e.type === 'karo-solo') {
        sys('Die ersten drei Stiche bleiben beim Hochzeiter. Es ist ein Karo-Solo.');
      } else if (e.type === 'vorfuehrung') {
        sys(who(e.seat).name + ' muss das Pflichtsolo vorführen.');
      }
    }
  }
  function commentContract(st) {
    if (!st.game) return;
    const key = E.describeGame(st.game) + ':' + st.game.type + ':' + (st.game.declarer == null ? '' : st.game.declarer) + ':' + match.handNo;
    if (S.contractSaid === key) return;
    S.contractSaid = key;
    const map = { normal: 'gameStart', hochzeit: 'hochzeit', armut: 'armut', solo: 'solo' };
    const ev = map[st.game.type] || 'gameStart';
    const seat = st.game.declarer == null ? 2 : st.game.declarer;
    if (seat !== 0) talk(seat, ev, 1, true);
    else talk(2, ev, 0.8, true);
  }

  async function playHand() {
    const gen = S.gen;
    let guard = 0;
    while (S.state && S.state.phase !== 'done' && guard < 900) {
      guard += 1;
      if (gen !== S.gen) throw CANCEL;
      drainEvents();
      commentContract(S.state);
      if (humanToMove(S.state)) {
        S.pick = [];
        await new Promise((res) => { S.humanWait = res; render(); });
        await delay(160);
        continue;
      }
      render();
      const phase = S.state.phase;
      const seat = S.state.turn;
      await delay(phase === 'play' ? 420 : 260);
      if (gen !== S.gen) throw CANCEL;
      if (humanToMove(S.state)) continue;
      const res = AI.apply(S.state, seat, settings.level);
      if (!res || !res.ok) {
        sys((res && res.reason) || 'Der Zug geht nicht.');
        break;
      }
    }
    drainEvents();
  }

  function showSummary(result) {
    const box = $('summary');
    const won = result.winners && result.winners.indexOf(0) >= 0;
    const none = result.kind !== 'redeal' && !result.reWon && !result.kontraWon;
    const title = result.kind === 'redeal' ? 'Neu geben' : none ? 'Unentschieden' : (won ? 'Gewonnen' : 'Verloren');
    const rows = Seats.seats.map((p) => '<tr><td>' + esc(p.name) + '</td><td class="' + (result.deltas[p.seat] > 0 ? 'pos' : result.deltas[p.seat] < 0 ? 'neg' : '') + '">' + (result.deltas[p.seat] > 0 ? '+' : '') + result.deltas[p.seat] + '</td></tr>').join('');
    const quote = result.kind === 'redeal' ? '' : (Talk.line(won ? 'ruediger' : 'horst', won ? 'win' : none ? 'encourage' : 'lose') || '');
    box.innerHTML = '<p class="sum-title ' + (won ? 'won' : 'lost') + '">' + title + '</p>' +
      '<p>' + esc(result.note || '') + '</p>' +
      (quote ? '<p class="sum-quote">' + esc(quote) + '</p>' : '') +
      '<table class="sum-table"><tbody>' + rows + '</tbody></table>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-next">Weiter</button></div>';
    $('modal-summary').hidden = false;
    $('btn-next').addEventListener('click', () => {
      $('modal-summary').hidden = true;
      if (S.nextWait) { const fn = S.nextWait; S.nextWait = null; fn(); }
    });
  }
  function showSession() {
    const seat = match.winner;
    const box = $('session');
    const names = Seats.seats.map((p, i) => ({ name: p.name, score: match.scores[i], i: i })).sort((a, b) => b.score - a.score);
    box.innerHTML = '<h3 class="session-title">' + esc(who(seat).name) + ' führt den Abend</h3>' +
      '<p>Ziel ' + targetValue() + ' erreicht. Gezählt wurden Punkte, kein Geld. ' + match.handNo + ' Spiele sind zu Ende gegangen.</p>' +
      '<ol class="standings">' + names.map((n, idx) => '<li class="' + (idx === 0 ? 'first' : '') + '"><span>' + (idx + 1) + '</span><span>' + esc(n.name) + '</span><b>' + n.score + '</b></li>').join('') + '</ol>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-again">Neue Punkteliste</button></div>';
    $('modal-session').hidden = false;
    $('btn-again').addEventListener('click', () => {
      $('modal-session').hidden = true;
      const dealer = match.dealer;
      match = blankMatch();
      match.dealer = dealer;
      saveMatch();
      if (S.nextWait) { const fn = S.nextWait; S.nextWait = null; fn(); }
    });
  }

  async function dealAndPlay() {
    const gen = ++S.gen;
    try {
      match.rules = rulesNow();
      match.target = targetValue();
      S.contractSaid = '';
      S.showLast = false;
      S.evAt = 0;
      S.pick = [];
      S.state = E.dealHand(match, rng);
      const n = E.handSize(match.rules);
      sys(n + ' Karten. Vorhand ist links vom Geber. Re und Kontra bleiben erst einmal geheim.');
      talk(2, 'gameStart', 0.85, true);
      await playHand();
      if (gen !== S.gen) return;
      if (!S.state.result) S.state.result = { kind: 'redeal', label: 'Offen', deltas: [0, 0, 0, 0], note: 'Das Spiel bleibt liegen.', winners: [], completed: false, reWon: false, kontraWon: false };
      const result = S.state.result;
      if (result.kind === 'game') {
        const good = result.reWon ? result.winners.indexOf(result.declarer == null ? 0 : result.declarer) >= 0 : false;
        if (result.declarer != null && result.declarer !== 0) talk(result.declarer, (result.reWon && result.winners.indexOf(result.declarer) >= 0) || (result.kontraWon && result.winners.indexOf(result.declarer) >= 0) ? 'win' : 'lose', 0.85, true);
        else if (!good) talk(2, result.winners.indexOf(0) >= 0 ? 'win' : 'lose', 0.7, true);
        void good;
      }
      E.applyToMatch(match, S.state);
      saveMatch();
      render();
      if (match.winner != null) {
        showSession();
        await new Promise((res) => { S.nextWait = res; });
      } else {
        showSummary(result);
        await new Promise((res) => { S.nextWait = res; });
      }
      if (gen !== S.gen) return;
      dealAndPlay();
    } catch (e) {
      if (e === CANCEL) return;
      sys('Das Spiel stockt. Nimm noch einmal Platz.');
    }
  }

  function syncSettingsForm() {
    const val = (name, value) => document.querySelectorAll('input[name="' + name + '"]').forEach((el) => { el.checked = el.value === String(value); });
    val('level', settings.level);
    val('target', settings.target);
    $('target-custom').value = settings.targetCustom;
    val('neunen', settings.rules.neunen ? '1' : '0');
    val('zweiteDulle', settings.rules.zweiteDulle ? '1' : '0');
    $('opt-farben').checked = settings.rules.farben !== false;
    $('opt-damen').checked = settings.rules.damen !== false;
    $('opt-buben').checked = settings.rules.buben !== false;
    $('opt-fleischlos').checked = settings.rules.fleischlos !== false;
    $('opt-hochzeit').checked = settings.rules.hochzeit !== false;
    $('opt-schweinchen').checked = !!settings.rules.schweinchen;
    $('opt-armut').checked = !!settings.rules.armut;
    $('opt-pflicht').checked = !!settings.rules.pflichtsolo;
    $('opt-sonder').checked = settings.rules.sonderpunkte !== false;
    $('opt-sound').checked = !!settings.sound;
    $('opt-volume').value = settings.volume;
    $('opt-volume-out').textContent = settings.volume;
    val('talk', settings.talk);
    val('speed', settings.speed);
    $('opt-handsfree').checked = !!settings.handsFree;
    syncHandsFree();
  }
  function readSettingsForm() {
    const val = (name) => { const el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; };
    settings.level = val('level') || settings.level;
    settings.target = val('target') || settings.target;
    settings.targetCustom = +$('target-custom').value || settings.targetCustom;
    settings.rules.neunen = val('neunen') !== '0';
    settings.rules.zweiteDulle = val('zweiteDulle') !== '0';
    settings.rules.farben = $('opt-farben').checked;
    settings.rules.damen = $('opt-damen').checked;
    settings.rules.buben = $('opt-buben').checked;
    settings.rules.fleischlos = $('opt-fleischlos').checked;
    settings.rules.hochzeit = $('opt-hochzeit').checked;
    settings.rules.schweinchen = $('opt-schweinchen').checked;
    settings.rules.armut = $('opt-armut').checked;
    settings.rules.pflichtsolo = $('opt-pflicht').checked;
    settings.rules.sonderpunkte = $('opt-sonder').checked;
    settings.sound = $('opt-sound').checked;
    settings.volume = +$('opt-volume').value;
    settings.talk = val('talk') || 'chat';
    settings.handsFree = $('opt-handsfree').checked;
    settings.speed = val('speed') || 'normal';
    settings.rules = E.normalizeRules(settings.rules);
    saveSettings();
    if (!settings.sound && Voice) Voice.stopAll();
    if (Voice) Voice.setVolume();
    renderTop();
    render();
    applyTalk(false);
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const MIC = { rec: null, on: false, mode: '', finalText: '', interim: '', want: false, muted: false, pausedForVoice: false, gesture: false, userEdit: false, spoken: [], silence: 0, restart: 0, downAt: 0 };
  function micSupport() {
    if (!SR) return { ok: false, text: 'Dein Browser kann keine Spracheingabe. Chrome und Edge können es, du kannst weiter schreiben.' };
    if (!window.isSecureContext) return { ok: false, text: 'Die Spracheingabe braucht eine Adresse mit http://localhost. Bis dahin einfach schreiben.' };
    return { ok: true };
  }
  function normSpeech(s) {
    return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function rememberSpoken(text) {
    const norm = normSpeech(text);
    if (!norm) return;
    MIC.spoken.push({ norm: norm, at: Date.now() });
    const now = Date.now();
    MIC.spoken = MIC.spoken.filter((l) => now - l.at < 15000).slice(-8);
  }
  function isEcho(text) {
    const a = normSpeech(text);
    if (!a) return false;
    const now = Date.now();
    return MIC.spoken.some((line) => now - line.at < 15000 && (line.norm === a || (a.length >= 10 && line.norm.indexOf(a) >= 0) || (line.norm.length >= 10 && a.indexOf(line.norm) >= 0)));
  }
  function setMicStatus(state) {
    const map = { 'hört zu': 'hoert', pausiert: 'pausiert', aus: 'aus' };
    $('hf-state').dataset.state = map[state] || 'aus';
    $('hf-label').textContent = state;
  }
  function syncHandsFree() {
    const voice = settings.talk === 'voice';
    const sup = micSupport();
    $('handsfree-block').hidden = !voice;
    $('opt-handsfree').disabled = !sup.ok;
    $('handsfree-support').hidden = !voice || sup.ok;
    $('handsfree-support').textContent = sup.ok ? '' : 'Freisprechen geht hier nicht. Du kannst weiter schreiben.';
    $('handsfree-phones').hidden = !voice || !sup.ok;
    const on = voice && sup.ok && !!settings.handsFree;
    $('hf-bar').hidden = !on;
    $('btn-hf-mute').textContent = MIC.muted ? 'Wieder an' : 'Stumm';
    $('btn-hf-mute').setAttribute('aria-pressed', String(!!MIC.muted));
    if (!on) setMicStatus('aus');
  }
  function shouldListen() {
    return settings.talk === 'voice' && settings.handsFree && micSupport().ok && !MIC.muted && !MIC.pausedForVoice && MIC.gesture;
  }
  function abortRec() {
    const rec = MIC.rec;
    MIC.rec = null;
    MIC.on = false;
    if (!rec) return;
    rec.onend = rec.onerror = rec.onresult = null;
    try { rec.abort(); } catch (e) { try { rec.stop(); } catch (e2) { /* egal */ } }
  }
  function stopAllMic() {
    MIC.want = false;
    clearTimeout(MIC.silence);
    clearTimeout(MIC.restart);
    abortRec();
    $('btn-mic').classList.remove('rec');
    $('btn-mic').setAttribute('aria-pressed', 'false');
  }
  function flushUtterance() {
    if (!settings.handsFree || MIC.pausedForVoice || MIC.muted) return;
    const text = (MIC.finalText + (MIC.interim || '')).trim();
    MIC.finalText = '';
    MIC.interim = '';
    if (!text || isEcho(text)) { $('chat-input').value = ''; return; }
    $('chat-input').value = text;
    $('chat-form').requestSubmit();
  }
  function startHandsFree() {
    if (!shouldListen() || MIC.on) return;
    abortRec();
    const rec = new SR();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = true;
    MIC.rec = rec;
    MIC.on = true;
    MIC.mode = 'handsfree';
    MIC.want = true;
    rec.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) MIC.finalText += t;
        else interim += t;
      }
      MIC.interim = interim;
      const shown = (MIC.finalText + interim).trim();
      if (shown && isEcho(shown)) { MIC.finalText = ''; MIC.interim = ''; return; }
      if (!MIC.userEdit) $('chat-input').value = shown;
      clearTimeout(MIC.silence);
      MIC.silence = setTimeout(flushUtterance, 1100);
    };
    rec.onerror = (ev) => {
      if (!ev || ev.error === 'no-speech' || ev.error === 'aborted') return;
      if (ev.error === 'not-allowed' || ev.error === 'audio-capture') { MIC.want = false; setMicStatus('aus'); sys('Das Mikrofon ist nicht frei. Schreib einfach.'); }
    };
    rec.onend = () => {
      if (MIC.rec !== rec) return;
      MIC.on = false;
      MIC.rec = null;
      $('btn-mic').classList.remove('rec');
      if (MIC.want && shouldListen()) setTimeout(startHandsFree, 250);
    };
    try { rec.start(); } catch (e) { MIC.on = false; MIC.rec = null; return; }
    $('btn-mic').classList.add('rec');
    $('btn-mic').setAttribute('aria-pressed', 'true');
    setMicStatus('hört zu');
  }
  function applyTalk(announce) {
    const voice = settings.talk === 'voice';
    const sup = micSupport();
    $('btn-mic').hidden = !(voice && sup.ok);
    $('mic-hint').hidden = !(voice && !sup.ok);
    $('mic-hint').textContent = voice && !sup.ok ? sup.text : '';
    $('talk-support').hidden = !(voice && !sup.ok);
    $('talk-support').textContent = voice && !sup.ok ? sup.text : '';
    syncHandsFree();
    if (!voice) stopAllMic();
    else if (settings.handsFree && sup.ok && !MIC.muted && MIC.gesture) startHandsFree();
    if (announce) sys(voice ? (settings.handsFree ? 'Freisprechen ist an. Am besten mit Kopfhörer.' : 'Mitreden mit Stimme: Klick aufs Mikrofon.') : 'Mitreden: nur schreiben.');
  }
  function startMic() {
    if (settings.handsFree || !SR || MIC.on) return;
    if (Voice) Voice.stopAll();
    const rec = new SR();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    MIC.rec = rec;
    MIC.on = true;
    MIC.mode = 'ptt';
    MIC.finalText = '';
    rec.onresult = (ev) => {
      let interim = '';
      let fin = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) fin += t;
        else interim += t;
      }
      if (fin) MIC.finalText += fin;
      $('chat-input').value = (MIC.finalText + interim).trim();
      $('chat-input').classList.toggle('interim', !!interim);
    };
    rec.onend = () => {
      MIC.on = false;
      MIC.rec = null;
      $('btn-mic').classList.remove('rec');
      $('chat-input').classList.remove('interim');
      const text = (MIC.finalText || $('chat-input').value || '').trim();
      if (text && !isEcho(text)) { $('chat-input').value = text; $('chat-form').requestSubmit(); }
    };
    try { rec.start(); } catch (e) { MIC.on = false; return; }
    $('btn-mic').classList.add('rec');
    $('btn-mic').setAttribute('aria-pressed', 'true');
  }
  function stopMic() {
    if (MIC.mode === 'handsfree') return;
    if (MIC.rec) { try { MIC.rec.stop(); } catch (e) { /* egal */ } }
  }

  async function onChat(text) {
    const message = String(text || '').trim();
    if (!message) return;
    $('chat-input').value = '';
    logLine('<b>Du:</b> ' + esc(message), 'you');
    rememberSpoken(message);
    const people = Talk.responders(message, Math.random);
    const game = S.state ? E.publicSummary(S.state, match.scores) : { phase: 'play', game: 'Doppelkopf', scores: match.scores };
    for (let i = 0; i < people.length; i++) {
      const person = seatById(people[i]);
      if (!person) continue;
      const typing = showTyping(person.name);
      let reply = '';
      try { reply = await Talk.askAI(person.id, { message: message, game: game }); }
      catch (e) { reply = Talk.cannedReply(person.id, message); }
      if (person.id === 'ruediger') await new Promise((res) => setTimeout(res, 280));
      typing.remove();
      say(person.seat, reply, { force: true, priority: true });
    }
  }

  function openModal(id) { $(id).hidden = false; if (id === 'modal-settings') syncSettingsForm(); }
  function closeModal(node) {
    const modal = node.closest('.modal');
    if (!modal || modal.id === 'modal-summary' || modal.id === 'modal-session') return;
    if (modal.id === 'modal-settings') readSettingsForm();
    modal.hidden = true;
  }

  $('btn-start').addEventListener('click', start);
  $('btn-settings').addEventListener('click', () => openModal('modal-settings'));
  $('btn-level').addEventListener('click', () => openModal('modal-settings'));
  $('btn-hint').addEventListener('click', () => {
    settings.hints = !settings.hints;
    saveSettings();
    renderTop();
    renderHint();
    renderHand();
  });
  $('btn-sound').addEventListener('click', () => {
    settings.sound = !settings.sound;
    saveSettings();
    if (!settings.sound && Voice) Voice.stopAll();
    if (settings.sound && Voice) Voice.unlock();
    renderTop();
    sys(settings.sound ? 'Ton an. Horst und Margarethe sprechen, Rüdiger bleibt bei der Blase.' : 'Ton aus. Alle bleiben bei der Sprechblase.');
  });
  $('btn-talk').addEventListener('click', () => {
    settings.talk = settings.talk === 'voice' ? 'chat' : 'voice';
    saveSettings();
    renderTop();
    applyTalk(true);
    if (!$('modal-settings').hidden) syncSettingsForm();
  });
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (closer) closeModal(closer);
  });
  $('btn-reset').addEventListener('click', () => {
    const dealer = match.dealer;
    match = blankMatch();
    match.dealer = dealer;
    saveMatch();
    renderScore();
    sys('Die Punkteliste ist leer. Das laufende Spiel zählt noch.');
  });
  $('opt-volume').addEventListener('input', () => { $('opt-volume-out').textContent = $('opt-volume').value; });
  $('modal-settings').addEventListener('change', () => {
    const talk = document.querySelector('input[name="talk"]:checked');
    if (talk) settings.talk = talk.value;
    settings.handsFree = $('opt-handsfree').checked;
    syncHandsFree();
  });
  $('chat-form').addEventListener('submit', (e) => { e.preventDefault(); onChat($('chat-input').value); });
  $('btn-hf-mute').addEventListener('click', () => {
    MIC.muted = !MIC.muted;
    MIC.gesture = true;
    if (MIC.muted) { stopAllMic(); setMicStatus('aus'); }
    else startHandsFree();
    syncHandsFree();
  });
  $('btn-mic').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    MIC.gesture = true;
    if (settings.handsFree && settings.talk === 'voice') {
      MIC.muted = !MIC.muted;
      if (MIC.muted) { stopAllMic(); setMicStatus('aus'); }
      else startHandsFree();
      syncHandsFree();
      return;
    }
    MIC.downAt = Date.now();
    startMic();
  });
  $('btn-mic').addEventListener('pointerup', () => { if (settings.handsFree) return; if (Date.now() - MIC.downAt > 350) stopMic(); });
  if (Voice && Voice.onPlayback) {
    Voice.onPlayback((phase, text) => {
      if (phase === 'start' && text) rememberSpoken(text);
      if (!(settings.handsFree && settings.talk === 'voice')) return;
      if (phase === 'start') {
        MIC.pausedForVoice = true;
        clearTimeout(MIC.silence);
        MIC.want = false;
        abortRec();
        if (!MIC.muted) setMicStatus('pausiert');
      } else if (phase === 'idle') {
        MIC.restart = setTimeout(() => {
          MIC.pausedForVoice = false;
          if (!MIC.muted && settings.handsFree) startHandsFree();
        }, 300);
      }
    });
  }
  document.addEventListener('pointerdown', () => { if (Voice) Voice.unlock(); MIC.gesture = true; }, { once: true, capture: true });

  function start() {
    if (S.started) return;
    S.started = true;
    $('intro').hidden = true;
    if (Voice) Voice.unlock();
    sys('Die Karten sind gemischt. Rüdiger sitzt gegenüber.');
    dealAndPlay();
  }

  function showShot() {
    $('intro').hidden = true;
    S.started = true;
    match.rules = rulesNow();
    match.target = targetValue();
    S.state = E.dealHand(match, E.seededRng(params.get('seed') ? +params.get('seed') : 11));
    let guard = 0;
    while (S.state.phase !== 'play' && S.state.phase !== 'done' && guard < 24) {
      guard += 1;
      const res = AI.apply(S.state, S.state.turn, 'kneipe');
      if (!res || !res.ok) break;
    }
    while (S.state.phase === 'play' && S.state.trick.length < 2 && guard < 40) {
      guard += 1;
      const res = AI.apply(S.state, S.state.turn, 'kneipe');
      if (!res || !res.ok) break;
    }
    S.humanWait = function () {};
    render();
    logLine('<b>Rüdiger:</b> Hömma, setz dich. Dat Pils is kalt, die Karten sind warm.', 'ruediger');
    logLine('<b>Horst:</b> Na endlich. Spiel lieber, statt zu reden.', 'horst');
    say(2, 'Zwölf Karten, zweimal dat Blatt. Wer gesund ist, der sag et.', { force: true });
    sys('Punkte statt Geld. Re, Kontra, Hochzeit und Solo.');
  }

  mountPortraits();
  renderTop();
  renderScore();
  applyTalk(false);
  sys('Doppelkopf am Tisch. Nimm Platz, dann wird gegeben.');
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();

  window.__doppelkopf = {
    get state() { return S.state; },
    settings: settings,
    seats: Seats,
    E: E,
    AI: AI,
    get match() { return match; },
    render: render,
  };

  if (params.get('shot') === '1') showShot();
  else if (params.get('autostart') === '1') start();
})();
