/* Spiel-Freunde Mau-Mau: Tisch, Runden und Mitreden. */
(function () {
  'use strict';
  const E = window.MauMauEngine;
  const AI = window.MauMauAI;
  const Talk = window.MauMauTalk;
  const Voice = window.MauMauVoice;
  const C = window.MauMauCards;
  const Seats = window.MauMauSeats;

  const SPEEDS = { slow: 1.45, normal: 1, fast: 0.35 };
  const LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  const DEFAULTS = {
    level: 'kneipe', target: '100', targetCustom: 100, sound: true, volume: 80,
    talk: 'chat', handsFree: false, hints: false, speed: 'normal',
    rules: E.normalizeRules({}),
  };
  const CANCEL = { cancelled: true };
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RANK_ORDER = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
  const SUIT_ORDER = { C: 0, S: 1, H: 2, D: 3 };

  function load(key, def) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ? Object.assign({}, def, v) : Object.assign({}, def);
    } catch (e) { return Object.assign({}, def); }
  }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* privat */ } }

  const settings = load('sf-maumau-settings', DEFAULTS);
  settings.rules = E.normalizeRules(Object.assign({}, DEFAULTS.rules, settings.rules || {}));
  if (!LEVELS[settings.level]) settings.level = 'kneipe';
  if (params.get('speed')) settings.speed = params.get('speed');
  if (LEVELS[params.get('level')]) settings.level = params.get('level');
  const saveSettings = () => store('sf-maumau-settings', settings);
  if (params.get('fresh')) {
    try {
      localStorage.removeItem('sf-maumau-match');
      localStorage.removeItem('sf-maumau-settings');
    } catch (e) { /* egal */ }
    settings.level = DEFAULTS.level;
    settings.target = DEFAULTS.target;
    settings.targetCustom = DEFAULTS.targetCustom;
    settings.sound = DEFAULTS.sound;
    settings.volume = DEFAULTS.volume;
    settings.talk = DEFAULTS.talk;
    settings.handsFree = false;
    settings.hints = false;
    settings.speed = params.get('speed') || DEFAULTS.speed;
    settings.rules = E.normalizeRules({});
  }
  if (Voice) Voice.init({ getSettings: () => settings });

  let rng = params.get('seed') ? E.seededRng(+params.get('seed') || 1) : E.cryptoRng();
  const targetValue = () => E.normalizeTarget(settings.target, settings.targetCustom);
  const rulesNow = () => E.normalizeRules(settings.rules);

  function blankMatch() {
    return E.blankMatch(rulesNow(), targetValue());
  }
  let match = load('sf-maumau-match', null);
  if (params.get('fresh') || !match || !match.scores || match.scores.length !== rulesNow().opponents + 1) match = blankMatch();
  match.rules = rulesNow();
  match.target = targetValue();
  match.rows = match.rows || [];
  function saveMatch() {
    store('sf-maumau-match', {
      rules: match.rules, target: match.target, scores: match.scores, wins: match.wins,
      dealer: match.dealer, handNo: match.handNo, rows: (match.rows || []).slice(-80), winner: match.winner,
    });
  }

  const S = {
    state: null, gen: 0, started: false, humanWait: null, humanTimer: 0, nextWait: null,
    armed: null, seats: Seats.layout(rulesNow().opponents), lastTalk: {}, bubbleTimers: {},
    watch: params.get('watch') === '1',
  };

  function delay(ms) {
    const g = S.gen;
    return new Promise((res) => setTimeout(res, ms * (SPEEDS[settings.speed] || 1))).then(() => {
      if (g !== S.gen) throw CANCEL;
    });
  }
  function person(seat) { return S.seats[seat] || null; }
  function seatById(id) { return S.seats.find((p) => p.id === id); }
  function refreshSeats() {
    const n = S.state ? S.state.players - 1 : rulesNow().opponents;
    S.seats = Seats.layout(n);
  }

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
    const who = person(seat);
    if (!who) return false;
    const now = Date.now();
    if (!opts.force && now - (S.lastTalk[seat] || 0) < 2200) return false;
    S.lastTalk[seat] = now;
    if (seat !== 0) logLine('<b>' + esc(who.name) + ':</b> ' + esc(text), who.id);
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
    if (who.voice && Voice && settings.sound) {
      const queued = Voice.speak(who.id, text, {
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
    const who = person(seat);
    if (!who || who.id === 'du') return false;
    let ev = event;
    if (settings.level === 'anfaenger' && ev === 'lose') ev = 'encourage';
    return say(seat, Talk.line(who.id, ev), { force: !!force });
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
  function paintPortrait(p) {
    const wrap = $('ava-' + p.seat);
    if (!wrap) return;
    const ini = wrap.querySelector('.ini');
    if (ini) ini.textContent = p.initials;
    const name = $('name-' + p.seat);
    if (name) name.textContent = p.name;
    if (!p.portrait) return;
    let img = wrap.querySelector('img.ava');
    if (!img) {
      img = document.createElement('img');
      img.className = 'ava';
      img.addEventListener('error', () => img.remove());
      wrap.insertBefore(img, wrap.firstChild);
    }
    if (img.dataset.slug !== p.slug) {
      img.dataset.slug = p.slug;
      img.alt = p.full;
      img.src = p.portrait;
    }
  }
  async function mountYou() {
    const face = await playerFace();
    if (!face) return;
    $('you-ini').textContent = face.initials || 'Du';
    if (face.name && face.name !== 'Du') S.youName = face.name;
    if (!face.src) return;
    let img = $('you-ava').querySelector('img');
    if (!img) {
      img = document.createElement('img');
      img.alt = face.name || 'Du';
      img.addEventListener('error', () => img.remove());
      $('you-ava').appendChild(img);
    }
    if (img.src !== face.src) img.src = face.src;
  }

  function chip(text) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.innerHTML = text;
    return span;
  }
  function sortHand(cards) {
    return cards.slice().sort((a, b) => {
      const ds = SUIT_ORDER[E.suitOf(a)] - SUIT_ORDER[E.suitOf(b)];
      if (ds) return ds;
      return (RANK_ORDER[E.rankOf(a)] || 0) - (RANK_ORDER[E.rankOf(b)] || 0);
    });
  }
  function youName() { return S.youName || 'Du'; }
  function nameOf(seat) {
    if (seat === 0) return youName();
    const who = person(seat);
    return who ? who.name : 'Jemand';
  }

  function renderBacks(seat) {
    const box = $('backs-' + seat);
    if (!box || !S.state) return;
    box.innerHTML = '';
    const n = Math.min(S.state.hands[seat].length, 6);
    for (let i = 0; i < n; i++) box.appendChild(C.backEl());
  }
  function renderSeats() {
    refreshSeats();
    const norths = S.seats.filter((p) => p.place === 'north' || p.place === 'north2');
    for (let i = 1; i <= 4; i++) {
      const node = $('seat-' + i);
      const p = S.seats[i];
      if (!node) continue;
      node.hidden = !p;
      if (!p) continue;
      node.className = 'seat seat-' + p.place + (norths.length === 1 && p.place === 'north' ? ' alone' : '');
      if (S.state && S.state.phase !== 'done' && S.state.turn === i && S.state.phase !== 'call') node.classList.add('active');
      if (S.state && S.state.phase === 'call' && S.state.pendingCall && S.state.pendingCall.seat === i) node.classList.add('active');
      paintPortrait(p);
      const role = $('role-' + i);
      if (role) {
        const n = S.state ? S.state.hands[i].length : 0;
        const mau = S.state && S.state.hands[i].length === 1 && S.state.phase !== 'done' ? ' <span class="tag">Mau</span>' : '';
        role.innerHTML = (S.state ? '<span class="tag">' + n + '</span>' : '') + mau;
      }
      if (S.state) renderBacks(i);
    }
    const me = $('seat-0');
    if (me) me.classList.toggle('active', !!(S.state && S.state.turn === 0 && S.state.phase !== 'done'));
    const role0 = $('role-0');
    if (role0 && S.state) {
      const n = S.state.hands[0].length;
      role0.innerHTML = '<span class="tag">' + n + (n === 1 ? ' · Mau' : '') + '</span>';
    }
  }

  function renderPile() {
    const st = S.state;
    const talon = $('talon');
    const discard = $('discard');
    talon.innerHTML = '';
    discard.innerHTML = '';
    if (!st) {
      $('talon-count').textContent = '0';
      $('pile-note').textContent = '';
      return;
    }
    C.setDeck(st.rules.deck);
    if (st.talon.length) talon.appendChild(C.backEl());
    $('talon-count').textContent = String(st.talon.length);
    const top = E.topCard(st);
    const under = st.discard.length > 1 ? st.discard[st.discard.length - 2] : null;
    if (under) discard.appendChild(C.cardEl(under, { cls: 'under' }));
    if (top) discard.appendChild(C.cardEl(top));
    const suit = E.suitName(st.activeSuit, st.rules);
    const symbol = E.suitSymbol(st.activeSuit, st.rules);
    let extra = '';
    if (st.pendingDraw > 0) extra = '<small>' + st.pendingDraw + ' ziehen</small>';
    else if (st.direction < 0) extra = '<small>rechtsherum</small>';
    $('pile-note').innerHTML = symbol + ' ' + suit + extra;
  }

  function humanTurn() {
    const st = S.state;
    return !!(st && st.turn === 0 && st.phase !== 'done' && !S.watch);
  }
  function releaseHuman(move) {
    clearTimeout(S.humanTimer);
    const wait = S.humanWait;
    S.humanWait = null;
    if (wait) wait(move);
    else S.queued = move;
  }
  function waitHuman(ms) {
    return new Promise((res) => {
      if (S.queued) {
        const queued = S.queued;
        S.queued = null;
        res(queued);
        return;
      }
      S.humanWait = res;
      if (ms) {
        S.humanTimer = setTimeout(() => {
          if (S.humanWait === res) {
            S.humanWait = null;
            res(null);
          }
        }, ms * (SPEEDS[settings.speed] || 1));
      }
    });
  }

  function renderHand() {
    const hand = $('hand');
    hand.innerHTML = '';
    const st = S.state;
    if (!st) return;
    C.setDeck(st.rules.deck);
    const mine = st.hands[0];
    const moves = humanTurn() || (st.phase === 'drawn' && st.turn === 0) ? E.legalMoves(st, 0) : [];
    const playable = {};
    moves.forEach((m) => { if (m.type === 'play') playable[m.card] = 1; });
    const hintCard = settings.hints && (st.turn === 0) ? (AI.act(st, 0, 'anfaenger', () => 0) || {}).card : null;
    sortHand(mine).forEach((card) => {
      const el = C.cardEl(card, { tag: 'button' });
      if (playable[card]) el.classList.add('playable');
      if (hintCard && card === hintCard) el.classList.add('suggest');
      if (st.drawnCard === card) el.classList.add('fresh');
      el.addEventListener('click', () => chooseCard(card));
      hand.appendChild(el);
    });
  }
  function chooseCard(card) {
    const st = S.state;
    if (!st || st.turn !== 0) return;
    if (st.phase !== 'play' && st.phase !== 'drawn') return;
    const legal = E.legalMoves(st, 0).some((m) => m.type === 'play' && m.card === card);
    if (!legal) {
      note('Die Karte passt nicht. Farbe oder Wert, sonst ziehen.');
      return;
    }
    const left = st.hands[0].length - 1;
    let call = null;
    if (left === 1 && S.armed === 'mau') call = 'mau';
    if (left === 0 && S.armed === 'maumau') call = 'maumau';
    S.armed = null;
    releaseHuman({ type: 'play', card: card, call: call });
  }

  function actionButton(label, move, primary) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    if (primary) btn.className = 'primary';
    btn.addEventListener('click', () => {
      if (move.type === 'arm') {
        if (S.state && S.state.phase === 'call' && S.state.pendingCall && S.state.pendingCall.seat === 0) {
          releaseHuman({ type: 'call' });
          return;
        }
        S.armed = S.armed === move.call ? null : move.call;
        renderActions();
        return;
      }
      releaseHuman(move);
    });
    return btn;
  }
  function renderActions() {
    const box = $('actions');
    const chooser = $('chooser');
    const games = $('chooser-games');
    box.innerHTML = '';
    games.innerHTML = '';
    chooser.hidden = true;
    const st = S.state;
    if (!st || st.phase === 'done' || S.watch) return;
    const waiting = !!S.humanWait || st.turn === 0 || st.phase === 'call' || st.phase === 'suit';
    if (!waiting) return;
    if (st.phase === 'suit' && st.turn === 0) {
      chooser.hidden = false;
      $('chooser-title').textContent = st.rules.deck === 'german' ? 'Welche Farbe wünscht der Unter?' : 'Welche Farbe wünscht der Bube?';
      E.SUITS.forEach((s) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = E.suitSymbol(s, st.rules) + ' ' + E.suitName(s, st.rules);
        btn.addEventListener('click', () => releaseHuman({ type: 'suit', suit: s }));
        games.appendChild(btn);
      });
      return;
    }
    if (st.phase === 'call') {
      const debtor = st.pendingCall.seat;
      const word = st.pendingCall.kind === 'maumau' ? 'Mau-Mau' : 'Mau';
      if (debtor === 0) box.appendChild(actionButton(word + '!', { type: 'call' }, true));
      else box.appendChild(actionButton('Vergessen, Strafkarte', { type: 'notice' }, true));
      return;
    }
    if (st.turn !== 0) return;
    const moves = E.legalMoves(st, 0);
    if (moves.some((m) => m.type === 'drawPenalty')) {
      box.appendChild(actionButton(st.pendingDraw + ' ziehen', { type: 'drawPenalty' }, true));
    }
    if (moves.some((m) => m.type === 'draw')) box.appendChild(actionButton('Ziehen', { type: 'draw' }, !moves.some((m) => m.type === 'play')));
    if (moves.some((m) => m.type === 'keep')) box.appendChild(actionButton('Behalten', { type: 'keep' }));
    if (moves.some((m) => m.type === 'aces')) box.appendChild(actionButton('Drei Asse', { type: 'aces' }, true));
    const n = st.hands[0].length;
    if (st.rules.mauPenalty > 0 && (n === 2 || n === 1) && (st.phase === 'play' || st.phase === 'drawn')) {
      const kind = n === 1 ? 'maumau' : 'mau';
      const label = (S.armed === kind ? '✓ ' : '') + (kind === 'maumau' ? 'Mau-Mau' : 'Mau');
      box.appendChild(actionButton(label, { type: 'arm', call: kind }, S.armed === kind));
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
      if (!box.classList.contains('shake')) box.hidden = true;
      return;
    }
    let text = 'Leg Farbe oder denselben Wert. Sonst ziehst du eine Karte.';
    if (st.phase === 'suit') text = 'Such dir eine Farbe aus. Danach muss die nächste Karte dazu passen, oder es kommt wieder ein Bube.';
    else if (st.phase === 'call') text = st.pendingCall.seat === 0 ? 'Sag es jetzt, sonst gibt es Strafkarten.' : 'Du kannst die vergessene Ansage noch melden.';
    else if (st.pendingDraw > 0) text = 'Eine 7 liegt. Zieh ' + st.pendingDraw + ' Karten, oder leg selbst eine 7, wenn stapeln erlaubt ist.';
    else if (st.hands[0].length === 2) text = 'Vorletzte Karte: drück Mau, bevor du legst.';
    else if (st.hands[0].length === 1) text = 'Letzte Karte: drück Mau-Mau, sonst hast du nicht gewonnen.';
    box.hidden = false;
    box.textContent = text;
  }

  function renderStatus() {
    const st = S.state;
    let text = 'Willkommen am Mau-Mau-Tisch';
    if (st && st.phase === 'done') text = nameOf(st.winner) + ' ist raus.';
    else if (st && st.phase === 'suit') text = nameOf(st.turn) + ' wünscht eine Farbe.';
    else if (st && st.phase === 'call') {
      const word = st.pendingCall.kind === 'maumau' ? 'Mau-Mau' : 'Mau';
      text = nameOf(st.pendingCall.seat) + ' muss ' + word + ' sagen.';
    } else if (st && st.phase === 'drawn' && st.turn === 0) text = 'Die gezogene Karte passt. Legen oder behalten.';
    else if (st && st.pendingDraw > 0 && st.turn === 0) text = 'Zieh ' + st.pendingDraw + ' Karten oder leg eine 7.';
    else if (st && st.turn === 0) text = 'Du bist dran.';
    else if (st) text = nameOf(st.turn) + ' ist dran.';
    $('st-main').textContent = text;
    const chips = $('st-chips');
    chips.innerHTML = '';
    if (!st) return;
    chips.appendChild(chip(st.direction < 0 ? 'rechtsherum' : 'linksherum'));
    chips.appendChild(chip(E.suitSymbol(st.activeSuit, st.rules) + ' ' + E.suitName(st.activeSuit, st.rules)));
    if (st.pendingDraw > 0) chips.appendChild(chip('<b>' + st.pendingDraw + '</b> ziehen'));
    if (st.handSize) chips.appendChild(chip(st.handSize + ' auf die Hand'));
  }

  function renderScore() {
    const target = targetValue();
    $('mode-badge').textContent = String(target);
    const scoring = rulesNow().scoring && (!S.state || S.state.rules.scoring);
    const names = S.seats.map((p, i) => (i === 0 ? youName() : p.name));
    const scores = match.scores || [];
    let head = '<thead><tr><th>Name</th><th>Letzte</th><th>' + (scoring ? 'Punkte' : 'Siege') + '</th></tr></thead>';
    const lastRow = match.rows && match.rows.length ? match.rows[match.rows.length - 1] : null;
    let body = '';
    const arr = scoring ? scores : (match.wins || []);
    let best = arr.length ? arr[0] : 0;
    for (let i = 1; i < arr.length; i++) {
      if (scoring ? arr[i] < best : arr[i] > best) best = arr[i];
    }
    for (let i = 0; i < scores.length; i++) {
      const lead = arr[i] === best ? ' class="pos"' : '';
      const roundPts = lastRow && lastRow.points ? lastRow.points[i] : '–';
      body += '<tr><td>' + esc(names[i] || ('Sitz ' + (i + 1))) + '</td><td>' + roundPts + '</td><td' + lead + '>' + (scoring ? scores[i] : (match.wins[i] || 0)) + '</td></tr>';
    }
    $('score-table').innerHTML = head + '<tbody>' + body + '</tbody>';
    let bars = '';
    for (let i = 0; i < arr.length; i++) {
      const pct = target > 0 ? Math.max(0, Math.min(100, Math.round(arr[i] / target * 100))) : 0;
      const lead = arr[i] === best ? ' lead' : '';
      bars += '<div class="ti-row' + lead + '"><span class="ti-name">' + esc(names[i] || '') + '</span><span class="ti-bar"><i style="width:' + pct + '%"></i></span><span class="ti-val">' + arr[i] + '</span></div>';
    }
    $('target-info').innerHTML = '<div class="ti-head"><span>bis ' + target + '</span><b>' + match.handNo + (match.handNo === 1 ? ' Runde' : ' Runden') + '</b></div>' + bars;
    $('tariff').textContent = scoring
      ? 'Wenig Punkte sind gut. Bube 20, Ass 11, König, Dame und 10 je 10.'
      : 'Gezählt werden gewonnene Runden. Punkte der Karten bleiben aus.';
  }

  function render() {
    if (S.state) C.setDeck(S.state.rules.deck);
    renderSeats();
    renderPile();
    renderHand();
    renderActions();
    renderHint();
    renderStatus();
    renderScore();
  }
  function renderTop() {
    $('level-label').textContent = LEVELS[settings.level] || 'Kneipe';
    $('btn-level').dataset.level = settings.level;
    $('btn-sound').setAttribute('aria-pressed', String(!!settings.sound));
    $('btn-sound').classList.toggle('off', !settings.sound);
    $('btn-talk').setAttribute('aria-pressed', String(settings.talk === 'voice'));
    $('btn-hint').setAttribute('aria-pressed', String(!!settings.hints));
    const r = rulesNow();
    $('intro-small').textContent = 'Spielstärke ' + (LEVELS[settings.level] || '') + ' · bis ' + targetValue() + ' · ' + (r.opponents + 1) + ' am Tisch · Ton ' + (settings.sound ? 'an' : 'aus');
    const unit = $('target-unit');
    if (unit) unit.textContent = r.scoring ? 'Punkte' : 'Siege';
  }

  function drainEvents(actor) {
    const st = S.state;
    if (!st) return;
    const events = st.events.splice(0);
    events.forEach((ev) => {
      const seat = ev.seat != null ? ev.seat : actor;
      if (ev.type === 'play') {
        const rank = E.rankOf(ev.card);
        if (ev.call === 'maumau') talk(seat, 'maumau', 1, true);
        else if (ev.call === 'mau') talk(seat, 'mau', 1, true);
        else if (rank === '7' && st.rules.seven) talk(seat, 'seven', 0.8, false);
        else if (rank === '8' && st.rules.eight) talk(seat, 'eight', 0.7, false);
      } else if (ev.type === 'wish') talk(seat, 'wish', 0.75, false);
      else if (ev.type === 'draw' && seat !== 0) talk(seat, 'draw', 0.3, false);
      else if (ev.type === 'penaltyDraw' && seat !== 0) talk(seat, 'penalty', 0.45, false);
      else if (ev.type === 'penalty') talk(ev.by, 'forgot', 1, true);
      else if (ev.type === 'reshuffle') sys('Der Talon ist leer. Die Ablage wird gemischt, die oberste Karte bleibt liegen.');
    });
  }

  async function resolveCall() {
    const st = S.state;
    if (!st || st.phase !== 'call') return;
    render();
    let humanMove = null;
    if (!S.watch) humanMove = await waitHuman(st.pendingCall.seat === 0 ? 1300 : 1500);
    else await delay(280);
    if (!S.state || S.state.phase !== 'call') return;
    if (humanMove && E.legalMoves(st, 0).some((m) => m.type === humanMove.type)) {
      E.apply(st, 0, humanMove);
      drainEvents(0);
      return;
    }
    const debtor = st.pendingCall.seat;
    if (debtor !== 0) {
      const self = AI.act(st, debtor, settings.level, Math.random);
      if (self && self.type === 'call' && E.apply(st, debtor, self).ok) {
        drainEvents(debtor);
        return;
      }
    }
    let actor = (debtor + 1) % st.players;
    if (actor === 0) actor = st.players > 2 ? 2 : 1;
    if (actor === debtor) actor = (debtor + 2) % st.players;
    const harsh = settings.level !== 'anfaenger' || Math.random() < 0.45;
    const type = harsh ? 'notice' : 'forgive';
    if (!E.apply(st, actor, { type: type }).ok) E.apply(st, actor, { type: 'forgive' });
    drainEvents(actor);
  }

  async function playLoop(gen) {
    S.queued = null;
    let guard = 0;
    while (S.state && S.state.phase !== 'done') {
      if (gen !== S.gen) throw CANCEL;
      if (++guard > 800) {
        sys('Diese Runde findet kein Ende. Nimm noch einmal Platz.');
        break;
      }
      if (S.state.phase === 'call') {
        await resolveCall();
        render();
        continue;
      }
      const st = S.state;
      const seat = st.turn;
      if (seat !== 0 || S.watch) S.queued = null;
      if (seat === 0 && !S.watch) {
        render();
        const move = await waitHuman();
        if (gen !== S.gen) throw CANCEL;
        if (!move) continue;
        const res = E.apply(st, 0, move);
        if (!res.ok) {
          note('Das geht so nicht.');
          continue;
        }
        drainEvents(0);
        render();
        await delay(240);
        continue;
      }
      render();
      await delay(seat === 0 ? 180 : 520);
      if (gen !== S.gen) throw CANCEL;
      let mv = AI.act(st, seat, settings.level, Math.random);
      if (!mv) {
        const legal = E.legalMoves(st, seat);
        mv = legal[legal.length - 1] || null;
      }
      if (!mv || !E.apply(st, seat, mv).ok) {
        sys('Da stockt eine Karte. Die Runde wird neu gegeben.');
        break;
      }
      drainEvents(seat);
      render();
      await delay(220);
    }
  }

  function showSummary(result) {
    const st = S.state;
    const won = st.winner === 0;
    const who = nameOf(st.winner);
    let rows = '';
    st.points.forEach((pts, i) => {
      rows += '<tr><td>' + esc(nameOf(i)) + '</td><td>' + pts + '</td><td>' + match.scores[i] + '</td></tr>';
    });
    $('summary').innerHTML =
      '<p class="sum-title ' + (won ? 'won' : 'lost') + '">' + (won ? 'Mau-Mau!' : esc(who) + ' ist raus') + '</p>' +
      '<p class="sum-quote">' + esc(Talk.line(won ? 'horst' : ((person(st.winner) || {}).id), won ? 'lose' : 'win') || 'Weiter geht es.') + '</p>' +
      '<p>' + (st.doubled ? 'Die letzte Karte war ein Bube. Die Punkte zählen doppelt. ' : '') +
      (st.winReason === 'aces' ? 'Drei Asse, die Runde ist sofort zu Ende. ' : '') +
      'Gezählt werden Punkte, kein Geld.</p>' +
      '<table class="sum-table"><thead><tr><th>Name</th><th>Runde</th><th>Stand</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" data-next>Nächste Runde</button></div>';
    $('modal-summary').hidden = false;
    if (st.winner !== 0) talk(st.winner, 'win', 1, true);
    else {
      const other = S.seats[1];
      if (other) talk(1, 'lose', 0.8, true);
    }
  }
  function showSession() {
    const scoring = match.rules.scoring;
    const arr = scoring ? match.scores : match.wins;
    const order = arr.map((v, i) => ({ i: i, v: v })).sort((a, b) => scoring ? a.v - b.v : b.v - a.v);
    const winner = match.winner;
    let list = '';
    order.forEach((row, idx) => {
      list += '<li class="' + (row.i === winner ? 'first' : '') + '"><span>' + (idx + 1) + '</span><span>' + esc(nameOf(row.i)) + '</span><b>' + row.v + '</b></li>';
    });
    let bits = '';
    for (let i = 0; i < 14; i++) bits += '<i style="--x:' + (i * 7) + '%;--d:' + (i * 0.08) + 's">' + '♣♥♠♦'[i % 4] + '</i>';
    $('session').innerHTML =
      '<div class="confetti" aria-hidden="true">' + bits + '</div>' +
      '<p class="session-title">' + esc(nameOf(winner)) + ' gewinnt den Abend</p>' +
      '<p>Ziel ' + match.target + ' ' + (scoring ? 'Punkte' : 'Siege') + '. ' + match.handNo + ' Runden sind zu Ende gegangen. Kein Geld.</p>' +
      '<ol class="standings">' + list + '</ol>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" data-next>Neue Punkteliste</button></div>';
    $('modal-session').hidden = false;
    if (winner === 0) talk(1, 'lose', 1, true);
    else talk(winner, 'win', 1, true);
  }
  function waitNext() {
    return new Promise((res) => { S.nextWait = res; });
  }

  function ensureMatch() {
    const rules = rulesNow();
    const n = rules.opponents + 1;
    if (!match.scores || match.scores.length !== n || (match.rules && match.rules.scoring !== rules.scoring && match.handNo === 0)) {
      match = E.blankMatch(rules, targetValue());
    }
    match.rules = rules;
    match.target = targetValue();
    match.winner = null;
    refreshSeats();
  }

  async function dealAndPlay() {
    const gen = ++S.gen;
    if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) {
      sys('Die freien Runden für heute sind gespielt.');
      return;
    }
    try {
      ensureMatch();
      if (S.state && S.state.rules && (S.state.players !== match.scores.length)) {
        match = E.blankMatch(rulesNow(), targetValue());
        sys('Neue Mitspieler, die Punkte fangen bei null an.');
      }
      S.armed = null;
      S.state = E.dealHand(match, rng);
      S.state.events.splice(0);
      saveMatch();
      render();
      const starter = S.state.turn;
      if (starter !== 0) talk(starter, 'gameStart', 0.7, false);
      else sys('Du gibst den Anfang. Farbe oder Wert.');
      await playLoop(gen);
      if (gen !== S.gen || !S.state || S.state.phase !== 'done') return;
      const scored = E.scoreHand(match, S.state);
      saveMatch();
      render();
      if (scored && window.SpielpartnerRounds) {
        SpielpartnerRounds.finish();
        SpielpartnerRounds.paint($('intro-rounds'));
      }
      if (match.winner != null) {
        showSession();
        await waitNext();
        if (gen !== S.gen) return;
        $('modal-session').hidden = true;
        match = blankMatch();
        saveMatch();
      } else {
        showSummary(scored);
        await waitNext();
        if (gen !== S.gen) return;
        $('modal-summary').hidden = true;
      }
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
    val('opponents', settings.rules.opponents);
    val('hand', settings.rules.handSize);
    val('deck', settings.rules.deck);
    val('ace', settings.rules.ace);
    val('nine', settings.rules.nine);
    val('mau', settings.rules.mauPenalty);
    $('opt-seven').checked = settings.rules.seven !== false;
    $('opt-stack').checked = settings.rules.sevenStack !== false;
    $('opt-seven-skip').checked = !!settings.rules.sevenSkip;
    $('opt-eight').checked = settings.rules.eight !== false;
    $('opt-jack-wish').checked = settings.rules.jackWish !== false;
    $('opt-jack-wild').checked = settings.rules.jackWild !== false;
    $('opt-jack-on-jack').checked = !!settings.rules.jackOnJack;
    $('opt-play-drawn').checked = settings.rules.playDrawn !== false;
    $('opt-start').checked = !!settings.rules.startEffect;
    $('opt-scoring').checked = settings.rules.scoring !== false;
    $('opt-double').checked = !!settings.rules.jackDouble;
    $('opt-aces').checked = !!settings.rules.threeAces;
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
    settings.rules = E.normalizeRules({
      opponents: +val('opponents'),
      handSize: +val('hand'),
      deck: val('deck'),
      ace: val('ace'),
      nine: val('nine'),
      mauPenalty: +val('mau'),
      seven: $('opt-seven').checked,
      sevenStack: $('opt-stack').checked,
      sevenSkip: $('opt-seven-skip').checked,
      eight: $('opt-eight').checked,
      jackWish: $('opt-jack-wish').checked,
      jackWild: $('opt-jack-wild').checked,
      jackOnJack: $('opt-jack-on-jack').checked,
      playDrawn: $('opt-play-drawn').checked,
      startEffect: $('opt-start').checked,
      scoring: $('opt-scoring').checked,
      jackDouble: $('opt-double').checked,
      threeAces: $('opt-aces').checked,
    });
    settings.sound = $('opt-sound').checked;
    settings.volume = +$('opt-volume').value;
    settings.talk = val('talk') || 'chat';
    settings.handsFree = $('opt-handsfree').checked;
    settings.speed = val('speed') || 'normal';
    saveSettings();
    if (!S.state && match.scores.length !== settings.rules.opponents + 1) {
      match = blankMatch();
      saveMatch();
    }
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
    logLine('<b>' + esc(youName()) + ':</b> ' + esc(message), 'you');
    rememberSpoken(message);
    let people = Talk.responders(message, Math.random).filter((id) => seatById(id));
    if (!people.length) {
      const fallback = S.seats.filter((p) => p.id !== 'du');
      if (fallback.length) people = [fallback[Math.floor(Math.random() * fallback.length)].id];
    }
    const game = S.state ? E.publicSummary(S.state, match.scores) : { phase: 'play', game: 'Mau-Mau', scores: match.scores };
    for (let i = 0; i < people.length; i++) {
      const who = seatById(people[i]);
      if (!who) continue;
      const typing = showTyping(who.name);
      let reply = '';
      try { reply = await Talk.askAI(who.id, { message: message, game: game }); }
      catch (e) { reply = Talk.cannedReply(who.id, message); }
      typing.remove();
      say(who.seat, reply, { force: true, priority: true });
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
    sys(settings.sound ? 'Ton an. Horst, Lena, Rüdiger und Margarethe sprechen.' : 'Ton aus. Alle bleiben bei der Sprechblase.');
  });
  $('btn-talk').addEventListener('click', () => {
    settings.talk = settings.talk === 'voice' ? 'chat' : 'voice';
    saveSettings();
    renderTop();
    applyTalk(true);
    if (!$('modal-settings').hidden) syncSettingsForm();
  });
  document.addEventListener('click', (e) => {
    const next = e.target.closest('[data-next]');
    if (next) {
      const wait = S.nextWait;
      S.nextWait = null;
      const modal = next.closest('.modal');
      if (modal) modal.hidden = true;
      if (wait) wait();
      return;
    }
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
  $('chat-input').addEventListener('input', () => { MIC.userEdit = true; });
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
    if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
    S.started = true;
    $('intro').hidden = true;
    if (Voice) Voice.unlock();
    sys('Die Karten sind gemischt. Horst sitzt links, Margarethe rechts.');
    const lena = seatById('lena');
    if (lena) say(lena.seat, Talk.line('lena', 'welcome'), { force: true });
    dealAndPlay();
  }

  function showShot() {
    if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
    S.started = true;
    $('intro').hidden = true;
    if (Voice) Voice.unlock();
    const opp = params.get('opp');
    if (opp === '3' || opp === '4') settings.rules.opponents = +opp;
    ensureMatch();
    const hands = [
      ['H9', 'HJ', 'S8', 'D10', 'CA'],
      ['C7', 'SK', 'HQ', 'S9', 'DA'],
      ['D7', 'H8', 'CJ', 'SA', 'C9'],
    ];
    let talon = ['D8', 'CK', 'HA', 'C8', 'SQ', 'HK', 'D9', 'S7'];
    if (settings.rules.opponents >= 3) {
      hands.push(['C10', 'CQ', 'SJ', 'H10', 'DJ']);
      talon = ['DQ', 'DK'];
    }
    if (settings.rules.opponents >= 4) {
      hands.push(['DQ', 'DK', 'S7', 'HK', 'D9']);
      talon = ['C8', 'HA'];
    }
    S.state = E.setup({
      rules: rulesNow(),
      hands: hands,
      discard: ['H7', 'S10'],
      talon: talon,
      turn: 0,
      activeSuit: 'S',
    });
    const seeded = [4, 18, 7, 11, 0];
    match.scores = hands.map(function (_, i) { return seeded[i] || 0; });
    match.wins = hands.map(function () { return 0; });
    match.wins[0] = 1;
    match.handNo = 1;
    match.rules = S.state.rules;
    S.state.events.splice(0);
    render();
    logLine('<b>Horst:</b> Fünf Karten. Ick seh schon, det wird nix.', 'horst');
    logLine('<b>Margarethe:</b> Mau-Mau, ganz gemütlich. Aber bitte mit Stil.', 'margarethe');
    const lenaSeat = seatById('lena');
    if (lenaSeat) logLine('<b>Lena:</b> ' + esc(Talk.line('lena', 'welcome')), 'lena');
    say(1, 'Mau. Gleich is Feierabend.', { force: true });
    if (lenaSeat) say(lenaSeat.seat, 'Hi! Der Kaffee ist warm, die Karten auch.', { force: true });
    sys('Punkte statt Geld. Eine 7 zieht zwei, eine 8 setzt aus, der Bube wünscht.');
    const gen = S.gen;
    playLoop(gen).then(() => {
      if (S.state && S.state.phase === 'done') {
        E.scoreHand(match, S.state);
        if (window.SpielpartnerRounds) SpielpartnerRounds.finish();
        showSummary();
      }
    }).catch(() => {});
  }

  refreshSeats();
  S.seats.forEach(paintPortrait);
  mountYou();
  renderTop();
  renderScore();
  renderSeats();
  applyTalk(false);
  sys('Mau-Mau am Küchentisch. Nimm Platz, dann wird gegeben.');
  if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();

  window.__maumau = {
    get state() { return S.state; },
    settings: settings,
    get seats() { return S.seats; },
    E: E,
    AI: AI,
    get match() { return match; },
    render: render,
  };

  if (params.get('shot') === '1') showShot();
  else if (params.get('autostart') === '1') start();
})();
