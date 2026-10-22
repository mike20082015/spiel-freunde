/* Spiel-Freunde Elfer raus: Tisch, Runden und Mitreden. */
(function () {
  'use strict';
  const E = window.ElferRausEngine;
  const AI = window.ElferRausAI;
  const Talk = window.ElferRausTalk;
  const Voice = window.ElferRausVoice;
  const C = window.ElferRausCards;
  const Seats = window.ElferRausSeats;

  const SPEEDS = { slow: 1.45, normal: 1, fast: 0.35 };
  const LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  const DEFAULTS = {
    level: 'kneipe', targetWins: '3', targetPenalty: '100', targetCustom: 3,
    sound: true, volume: 80, talk: 'chat', handsFree: false, hints: false, speed: 'normal',
    rules: E.normalizeRules({}),
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

  const settings = load('sf-elfer-settings', DEFAULTS);
  settings.rules = E.normalizeRules(Object.assign({}, DEFAULTS.rules, settings.rules || {}));
  if (!LEVELS[settings.level]) settings.level = 'kneipe';
  if (params.get('speed')) settings.speed = params.get('speed');
  if (LEVELS[params.get('level')]) settings.level = params.get('level');
  const saveSettings = () => store('sf-elfer-settings', settings);
  if (params.get('fresh')) {
    try {
      localStorage.removeItem('sf-elfer-match');
      localStorage.removeItem('sf-elfer-settings');
    } catch (e) { /* egal */ }
    Object.assign(settings, DEFAULTS, { rules: E.normalizeRules({}), speed: params.get('speed') || 'normal' });
  }
  if (Voice) Voice.init({ getSettings: () => settings });

  let rng = params.get('seed') ? E.seededRng(+params.get('seed') || 1) : E.cryptoRng();
  const rulesNow = () => E.normalizeRules(settings.rules);
  function targetValue() {
    const r = rulesNow();
    if (r.mode === 'penalty') return E.normalizeTarget('penalty', settings.targetPenalty, settings.targetCustom);
    return E.normalizeTarget('wins', settings.targetWins, settings.targetCustom);
  }
  function blankMatch() { return E.blankMatch(rulesNow(), targetValue()); }
  let match = load('sf-elfer-match', null);
  if (params.get('fresh') || !match || !match.scores || match.scores.length !== rulesNow().opponents + 1) match = blankMatch();
  match.rules = rulesNow();
  match.target = targetValue();
  match.rows = match.rows || [];
  match.wins = match.wins || match.scores.map(() => 0);
  function saveMatch() {
    store('sf-elfer-match', {
      rules: match.rules, target: match.target, scores: match.scores, wins: match.wins,
      dealer: match.dealer, handNo: match.handNo, rows: (match.rows || []).slice(-40), winner: match.winner,
    });
  }

  const S = {
    state: null, gen: 0, started: false, humanWait: null, nextWait: null,
    seats: Seats.layout(rulesNow().opponents), lastTalk: {}, bubbleTimers: {},
    watch: params.get('watch') === '1',
    learn: false,
  };
  function zui() { return window.SpielpartnerZuschauen; }
  function lernen() { return !!(S.learn && zui() && zui().aktiv()); }
  function autoPlatz() { return !!(S.watch || lernen()); }
  function lern(text, platz) { if (lernen() && text) zui().kommentar(text, { platz: platz }); }
  function elferSatz(seat, mv) {
    if (!zui()) return '';
    const name = nameOf(seat);
    if (mv && mv.type === 'play') return zui().erklaere('elfer', { art: 'legen', name: name, karte: mv.card ? E.cardName(mv.card) : 'eine Karte' });
    return zui().erklaere('elfer', { art: 'ziehen', name: name });
  }

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
    if (window.SpielpartnerLineup) SpielpartnerLineup.dress(S.seats, 'elfer-raus', localStorage, n);
  }
  function youName() { return S.youName || 'Du'; }
  function nameOf(seat) {
    if (seat === 0) return youName();
    const who = person(seat);
    return who ? who.name : 'Jemand';
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
    if (el) { el.textContent = text; el.classList.add('show'); }
    const hideLater = (ms) => {
      clearTimeout(S.bubbleTimers[seat]);
      S.bubbleTimers[seat] = setTimeout(() => { if (el) el.classList.remove('show'); }, ms);
    };
    if (who.voice && Voice && settings.sound) {
      const queued = Voice.speak(who.id, text, {
        priority: opts.priority,
        onStart: () => { if (node) node.classList.add('speaking'); },
        onEnd: () => { if (node) node.classList.remove('speaking'); hideLater(500); },
      });
      if (queued) return true;
    }
    hideLater(Math.min(5200, 1800 + text.length * 36));
    return true;
  }
  function talk(seat, event, prob, force) {
    if (prob != null && Math.random() > prob) return false;
    if (typeof window !== 'undefined' && window.SpielpartnerSprueche && !window.SpielpartnerSprueche.allow({ force: !!force })) return false;
    const who = person(seat);
    if (!who || who.id === 'du') return false;
    const ev = settings.level === 'anfaenger' && event === 'lose' ? 'encourage' : event;
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
    return { src: typeof src === 'string' ? src : '', initials: initials, name: typeof info.name === 'string' && info.name ? info.name : 'Du' };
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
    if (img.dataset.slug !== p.slug) { img.dataset.slug = p.slug; img.alt = p.full; img.src = p.portrait; }
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
  function humanTurn() {
    const st = S.state;
    return !!(st && st.turn === 0 && st.phase !== 'done' && !autoPlatz());
  }
  function releaseHuman(move) {
    commitNote();
    const wait = S.humanWait;
    S.humanWait = null;
    if (wait) wait(move);
    else S.queued = move;
  }
  function waitHuman() {
    return new Promise((res) => {
      if (S.queued) { const q = S.queued; S.queued = null; res(q); return; }
      S.humanWait = res;
    });
  }
  function sortHand(cards) {
    return cards.slice().sort((a, b) => (E.suitOf(a).localeCompare(E.suitOf(b))) || (E.rankOf(a) - E.rankOf(b)));
  }

  function renderBacks(seat) {
    const box = $('backs-' + seat);
    if (!box || !S.state) return;
    box.innerHTML = '';
    const n = Math.min((S.state.hands[seat] || []).length, 8);
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
      if (S.state && S.state.phase !== 'done' && S.state.turn === i) node.classList.add('active');
      paintPortrait(p);
      const role = $('role-' + i);
      const n = S.state && S.state.hands[i] ? S.state.hands[i].length : 0;
      if (role) role.innerHTML = S.state ? '<span class="tag">' + n + '</span>' : '';
      if (S.state) renderBacks(i);
    }
    const me = $('seat-0');
    if (me) me.classList.toggle('active', humanTurn());
    const role0 = $('role-0');
    if (role0 && S.state) role0.innerHTML = '<span class="tag">' + S.state.hands[0].length + '</span>';
    const names = S.seats.filter((p) => p.id !== 'du').map((p) => p.name);
    const copy = $('intro-copy');
    if (copy && names.length) {
      copy.textContent = 'Du spielst gegen ' + names.join(', ').replace(/, ([^,]+)$/, ' und $1') + '. Vier Farben von 1 bis 20. Die 11 öffnet die Reihe, danach geht es Zahl für Zahl nach oben und nach unten. Bis zu drei legen, bis zu drei nachziehen. Wer zuerst leer ist, gewinnt. Kein Einsatz.';
    }
  }
  function renderRows() {
    const st = S.state;
    const box = $('rows');
    const talon = $('talon');
    box.innerHTML = '';
    talon.innerHTML = '';
    if (!st) { $('talon-count').textContent = '0'; return; }
    if (st.talon.length) talon.appendChild(C.backEl());
    $('talon-count').textContent = String(st.talon.length);
    E.SUITS.forEach((suit) => {
      const row = st.rows[suit];
      const wrap = document.createElement('div');
      wrap.className = 'color-row s-' + suit;
      const name = document.createElement('span');
      name.className = 'color-name';
      name.textContent = E.suitName(suit);
      wrap.appendChild(name);
      if (!row.open) {
        const wait = document.createElement('span');
        wait.className = 'gap-note';
        wait.textContent = '11 fehlt';
        wrap.appendChild(wait);
      } else {
        wrap.appendChild(C.cardEl(suit + row.low));
        if (row.high !== row.low) {
          if (row.high - row.low > 1) {
            const mid = document.createElement('span');
            mid.className = 'gap-note';
            mid.textContent = '…';
            wrap.appendChild(mid);
          }
          wrap.appendChild(C.cardEl(suit + row.high));
        }
      }
      box.appendChild(wrap);
    });
  }
  function renderHand() {
    const hand = $('hand');
    hand.innerHTML = '';
    const st = S.state;
    if (!st) return;
    const mine = st.hands[0] || [];
    hand.classList.toggle('crowded', mine.length > 8);
    const playable = {};
    if (humanTurn()) E.legalMoves(st, 0).forEach((m) => { if (m.type === 'play') playable[m.card] = 1; });
    const hint = settings.hints && humanTurn() ? AI.act(st, 0, 'kneipe', () => 0) : null;
    sortHand(mine).forEach((card) => {
      const el = C.cardEl(card, { tag: 'button' });
      if (playable[card]) el.classList.add('playable');
      if (hint && hint.card === card) el.classList.add('suggest');
      el.addEventListener('click', () => {
        if (!playable[card]) { note('Die Karte passt nicht. Nur die 11 oder die nächste Zahl an einer offenen Farbe.'); return; }
        releaseHuman({ type: 'play', card: card });
      });
      hand.appendChild(el);
    });
  }
  function renderActions() {
    const box = $('actions');
    box.innerHTML = '';
    const st = S.state;
    if (!st || !humanTurn()) return;
    const moves = E.legalMoves(st, 0);
    const end = moves.some((m) => m.type === 'end');
    if (!end) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'primary';
    btn.textContent = st.plays > 0 ? 'Zug beenden' : 'Ziehen';
    btn.addEventListener('click', () => releaseHuman({ type: 'end' }));
    box.appendChild(btn);
  }
  function noteToken() {
    const st = S.state;
    if (!st) return '0';
    const rows = st.rows ? ['R', 'Y', 'G', 'B'].map((s) => {
      const row = st.rows[s] || {};
      return s + ':' + (row.open ? 1 : 0) + ':' + row.low + ':' + row.high;
    }).join(',') : '';
    return [
      match.handNo,
      st.phase,
      st.turn,
      st.plays,
      (st.hands || []).map((h) => h.join('.')).join('/'),
      rows,
    ].join('|');
  }
  const notes = window.HintNote.create({
    box: () => $('hint-box'),
    token: () => noteToken(),
    onExpire: () => renderHint(),
  });
  function commitNote() {
    if (!notes.active()) return;
    notes.clear();
    renderHint();
  }
  function note(text) {
    notes.show(text);
  }
  function renderHint() {
    const box = $('hint-box');
    notes.sync();
    if (notes.hold(box)) return;
    box.classList.remove('shake');
    if (!settings.hints || !humanTurn()) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    const st = S.state;
    const left = st.rules.playLimit - st.plays;
    box.hidden = false;
    box.textContent = 'Leg eine 11 oder die direkte Nachbarzahl. Noch ' + left + ' Karte' + (left === 1 ? '' : 'n') + ' in diesem Zug, danach wird nachgezogen.';
  }
  function renderStatus() {
    const st = S.state;
    let text = 'Willkommen bei Elfer raus';
    if (st && st.phase === 'done' && st.reason === 'out') text = nameOf(st.winner) + ' ist leer.';
    else if (st && st.phase === 'done') text = 'Keine Züge mehr. Die Restkarten werden gezählt.';
    else if (humanTurn() && st.plays > 0 && st.drawn) text = 'Die gezogene Karte darfst du noch legen.';
    else if (humanTurn()) text = 'Du bist dran.';
    else if (st) text = nameOf(st.turn) + ' ist dran.';
    $('st-main').textContent = text;
    const chips = $('st-chips');
    chips.innerHTML = '';
    if (!st) return;
    E.SUITS.forEach((suit) => {
      const row = st.rows[suit];
      chips.appendChild(chip(E.suitSymbol(suit) + ' ' + (row.open ? row.low + '–' + row.high : 'zu')));
    });
  }
  function pointsOf(i) {
    return rulesNow().mode === 'penalty' ? (match.scores[i] || 0) : (match.wins[i] || 0);
  }
  function renderScore() {
    const penalty = rulesNow().mode === 'penalty';
    const target = match.target || targetValue();
    $('mode-badge').textContent = penalty ? String(target) : target + ' Siege';
    const names = S.seats.map((p, i) => (i === 0 ? youName() : p.name));
    const last = match.rows && match.rows.length ? match.rows[match.rows.length - 1] : null;
    let body = '';
    const arr = names.map((_, i) => pointsOf(i));
    let best = arr.length ? arr[0] : 0;
    for (let i = 1; i < arr.length; i++) if (penalty ? arr[i] < best : arr[i] > best) best = arr[i];
    for (let i = 0; i < arr.length; i++) {
      const roundPts = last && last.penalties ? last.penalties[i] : '–';
      body += '<tr><td>' + esc(names[i] || '') + '</td><td>' + roundPts + '</td><td' + (arr[i] === best ? ' class="pos"' : '') + '>' + arr[i] + '</td></tr>';
    }
    $('score-table').innerHTML = '<thead><tr><th>Name</th><th>Letzte</th><th>' + (penalty ? 'Punkte' : 'Siege') + '</th></tr></thead><tbody>' + body + '</tbody>';
    let bars = '';
    for (let i = 0; i < arr.length; i++) {
      const pct = target ? Math.max(0, Math.min(100, Math.round(arr[i] / target * 100))) : 0;
      bars += '<div class="ti-row"><span class="ti-name">' + esc(names[i] || '') + '</span><span class="ti-bar"><i style="width:' + pct + '%"></i></span><span class="ti-val">' + arr[i] + '</span></div>';
    }
    $('target-info').innerHTML = '<div class="ti-head"><span>bis ' + target + '</span><b>' + (match.handNo || 0) + ' Runden</b></div>' + bars;
    $('tariff').textContent = penalty
      ? 'Wenig Punkte sind gut. ' + (rulesNow().penalty === 'count' ? 'Jede Restkarte zählt eins.' : 'Gezählt wird die Summe der Zahlen.') + ' Kein Geld.'
      : 'Wer zuerst keine Karte mehr hat, gewinnt die Runde. Kein Geld.';
  }
  function render() {
    renderSeats();
    renderRows();
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
    const unit = $('target-unit');
    if (unit) unit.textContent = r.mode === 'penalty' ? 'Punkte' : 'Siege';
    $('intro-small').textContent = 'Spielstärke ' + (LEVELS[settings.level] || '') + ' · bis ' + targetValue() + ' · ' + (r.opponents + 1) + ' am Tisch · Ton ' + (settings.sound ? 'an' : 'aus');
  }
  function drainEvents() {
    const st = S.state;
    if (!st) return;
    st.events.splice(0).forEach((ev) => {
      if (ev.type === 'play' && E.rankOf(ev.card) === 11) talk(ev.seat, 'eleven', 0.85, false);
      else if (ev.type === 'play') talk(ev.seat, 'play', 0.22, false);
      else if (ev.type === 'draw' && ev.n > 0) talk(ev.seat, 'draw', 0.35, false);
    });
  }
  async function playLoop(gen) {
    S.queued = null;
    let guard = 0;
    while (S.state && S.state.phase !== 'done') {
      if (gen !== S.gen) throw CANCEL;
      if (++guard > 800) { sys('Diese Runde findet kein Ende. Nimm noch einmal Platz.'); break; }
      const st = S.state;
      const seat = st.turn;
      if (seat === 0 && !autoPlatz()) {
        render();
        const move = await waitHuman();
        if (gen !== S.gen) throw CANCEL;
        if (!move) continue;
        if (!E.apply(st, 0, move).ok) { note('Das geht so nicht.'); continue; }
        drainEvents();
        render();
        await delay(220);
        continue;
      }
      render();
      if (lernen()) await zui().takt();
      else await delay(seat === 0 ? 160 : 480);
      if (gen !== S.gen) throw CANCEL;
      if (seat === 0 && !autoPlatz()) continue;
      let mv = AI.act(st, seat, settings.level, Math.random);
      if (!mv || !E.apply(st, seat, mv).ok) {
        const legal = E.legalMoves(st, seat);
        mv = legal[legal.length - 1];
        if (!mv || !E.apply(st, seat, mv).ok) { sys('Da stockt eine Karte. Die Runde wird neu gegeben.'); break; }
      }
      lern(elferSatz(seat, mv), seat);
      drainEvents();
      render();
      if (!lernen()) await delay(200);
    }
  }
  function showSummary() {
    const st = S.state;
    const won = st.winner === 0;
    const penalty = st.rules.mode === 'penalty';
    const rows = (st.penalties || []).map((pts, i) => '<tr><td>' + esc(nameOf(i)) + '</td><td>' + pts + '</td><td>' + pointsOf(i) + '</td></tr>').join('');
    $('summary').innerHTML =
      '<p class="sum-title ' + (won ? 'won' : 'lost') + '">' + (st.reason === 'stall' ? 'Keine Züge mehr' : esc(nameOf(st.winner)) + ' ist raus') + '</p>' +
      '<p class="sum-quote">' + esc(Talk.line((person(st.winner) || {}).id || 'hilde', st.reason === 'stall' ? 'stall' : 'win') || 'Weiter geht es.') + '</p>' +
      '<p>' + (penalty ? 'Die Restkarten sind Strafpunkte. ' : 'Gezählt wird der Sieg. ') + 'Kein Geld.</p>' +
      '<table class="sum-table"><thead><tr><th>Name</th><th>Rest</th><th>Stand</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" data-next>Nächste Runde</button></div>';
    $('modal-summary').hidden = false;
    if (st.winner != null && st.winner !== 0) talk(st.winner, 'win', 1, true);
    else if (st.winner === 0) talk(1, 'lose', 0.8, true);
  }
  function showSession() {
    const penalty = match.rules.mode === 'penalty';
    const arr = penalty ? match.scores : match.wins;
    const order = arr.map((v, i) => ({ i: i, v: v })).sort((a, b) => penalty ? a.v - b.v : b.v - a.v);
    let list = '';
    order.forEach((row, idx) => {
      list += '<li class="' + (row.i === match.winner ? 'first' : '') + '"><span>' + (idx + 1) + '</span><span>' + esc(nameOf(row.i)) + '</span><b>' + row.v + '</b></li>';
    });
    $('session').innerHTML =
      '<p class="session-title">' + esc(nameOf(match.winner)) + ' gewinnt den Abend</p>' +
      '<p>Ziel ' + match.target + ' ' + (penalty ? 'Punkte' : 'Siege') + '. ' + match.handNo + ' Runden. Kein Geld.</p>' +
      '<ol class="standings">' + list + '</ol>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" data-next>Neue Punkteliste</button></div>';
    $('modal-session').hidden = false;
    if (match.winner === 0) talk(1, 'lose', 1, true);
    else talk(match.winner, 'win', 1, true);
  }
  function waitNext() { return new Promise((res) => { S.nextWait = res; }); }
  function ensureMatch() {
    const rules = rulesNow();
    const n = rules.opponents + 1;
    if (!match.scores || match.scores.length !== n || (match.rules && match.rules.mode !== rules.mode && !match.handNo)) match = blankMatch();
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
      S.state = E.dealHand(match, rng);
      saveMatch();
      render();
      if (S.state.turn !== 0) talk(S.state.turn, 'gameStart', 0.75, false);
      else sys('Du fängst an. Eine 11 öffnet die Farbe.');
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
        showSummary();
        if (lernen()) zui().nachRunde(() => {
          const btn = document.querySelector('#modal-summary [data-next]');
          if (btn) btn.click();
        });
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
    const r = settings.rules;
    val('level', settings.level);
    val('mode', r.mode);
    val('targetWins', settings.targetWins);
    val('targetPenalty', settings.targetPenalty);
    $('target-custom').value = settings.targetCustom;
    val('penalty', r.penalty);
    val('opponents', r.opponents);
    val('hand', r.handSize);
    val('playLimit', r.playLimit);
    val('drawLimit', r.drawLimit);
    $('opt-must').checked = r.mustPlay !== false;
    $('opt-drawn').checked = r.playDrawn !== false;
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
    settings.targetWins = val('targetWins') || settings.targetWins;
    settings.targetPenalty = val('targetPenalty') || settings.targetPenalty;
    settings.targetCustom = +$('target-custom').value || settings.targetCustom;
    settings.rules = E.normalizeRules({
      mode: val('mode'),
      penalty: val('penalty'),
      opponents: +val('opponents'),
      handSize: +val('hand'),
      playLimit: +val('playLimit'),
      drawLimit: +val('drawLimit'),
      mustPlay: $('opt-must').checked,
      playDrawn: $('opt-drawn').checked,
    });
    settings.sound = $('opt-sound').checked;
    settings.volume = +$('opt-volume').value;
    settings.talk = val('talk') || 'chat';
    settings.handsFree = $('opt-handsfree').checked;
    settings.speed = val('speed') || 'normal';
    saveSettings();
    if (!S.state) { match = blankMatch(); saveMatch(); }
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
  function normSpeech(s) { return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function rememberSpoken(text) {
    const norm = normSpeech(text);
    if (!norm) return;
    MIC.spoken.push({ norm: norm, at: Date.now() });
    MIC.spoken = MIC.spoken.filter((l) => Date.now() - l.at < 15000).slice(-8);
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
  function shouldListen() { return settings.talk === 'voice' && settings.handsFree && micSupport().ok && !MIC.muted && !MIC.pausedForVoice && MIC.gesture; }
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
    rec.onerror = (ev) => { if (ev && (ev.error === 'not-allowed' || ev.error === 'audio-capture')) { MIC.want = false; setMicStatus('aus'); sys('Das Mikrofon ist nicht frei. Schreib einfach.'); } };
    rec.onend = () => { if (MIC.rec !== rec) return; MIC.on = false; MIC.rec = null; $('btn-mic').classList.remove('rec'); if (MIC.want && shouldListen()) setTimeout(startHandsFree, 250); };
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
  function stopMic() { if (MIC.mode === 'handsfree') return; if (MIC.rec) { try { MIC.rec.stop(); } catch (e) { /* egal */ } } }
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
    const game = S.state ? E.publicSummary(S.state) : { phase: 'play', game: 'Elfer raus' };
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
  $('btn-hint').addEventListener('click', () => { settings.hints = !settings.hints; saveSettings(); renderTop(); renderHint(); renderHand(); });
  $('btn-sound').addEventListener('click', () => {
    settings.sound = !settings.sound;
    saveSettings();
    if (!settings.sound && Voice) Voice.stopAll();
    if (settings.sound && Voice) Voice.unlock();
    renderTop();
    sys(settings.sound ? 'Ton an. Oma Hilde, Lena und Jonas sprechen.' : 'Ton aus. Alle bleiben bei der Sprechblase.');
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
    if (MIC.muted) { stopAllMic(); setMicStatus('aus'); } else startHandsFree();
    syncHandsFree();
  });
  $('btn-mic').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    MIC.gesture = true;
    if (settings.handsFree && settings.talk === 'voice') {
      MIC.muted = !MIC.muted;
      if (MIC.muted) { stopAllMic(); setMicStatus('aus'); } else startHandsFree();
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
        MIC.restart = setTimeout(() => { MIC.pausedForVoice = false; if (!MIC.muted && settings.handsFree) startHandsFree(); }, 300);
      }
    });
  }
  document.addEventListener('pointerdown', () => { if (Voice) Voice.unlock(); MIC.gesture = true; }, { once: true, capture: true });

  function start() {
    if (S.started) return false;
    if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return false;
    S.started = true;
    $('intro').hidden = true;
    if (Voice) Voice.unlock();
    sys('Die Karten sind gemischt. Oma Hilde sitzt links, Jonas rechts, Lena gegenüber.');
    const hilde = seatById('hilde');
    if (hilde) say(hilde.seat, Talk.line('hilde', 'welcome'), { force: true });
    dealAndPlay();
    return true;
  }
  if (zui()) {
    zui().mount({
      start: function () {
        const vorher = S.watch;
        S.learn = true;
        S.watch = true;
        const ok = start();
        if (!ok) { S.learn = false; S.watch = vorher; }
        return ok;
      },
      uebernehmen: function () {
        S.learn = false;
        S.watch = params.get('watch') === '1';
        render();
      },
      sprich: function (platz, text) {
        const who = S.seats[platz];
        const id = who && who.id && who.id !== 'du' ? who.id : (S.seats[1] && S.seats[1].id);
        if (!id || !Voice || !settings.sound) return false;
        Voice.unlock();
        return Voice.speak(id, text, { priority: true });
      }
    });
  }

  function showShot() {
    if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
    S.started = true;
    $('intro').hidden = true;
    if (Voice) Voice.unlock();
    settings.rules = E.normalizeRules(Object.assign({}, settings.rules, { opponents: 3 }));
    match = E.blankMatch(rulesNow(), 3);
    match.wins = [1, 0, 1, 0];
    match.handNo = 2;
    const rows = E.emptyRows();
    rows.R = { open: true, low: 9, high: 12 };
    rows.Y = { open: true, low: 11, high: 11 };
    rows.G = { open: true, low: 11, high: 13 };
    S.state = E.setup({
      rules: rulesNow(),
      hands: [
        ['R8', 'R13', 'Y12', 'G10', 'B11', 'Y9'],
        ['R7', 'Y10', 'G9', 'B12', 'R14'],
        ['Y13', 'G14', 'B10', 'R6', 'Y8', 'G8'],
        ['B13', 'R5', 'Y7', 'G7', 'B9'],
      ],
      rows: rows,
      talon: ['R4', 'Y6', 'G6', 'B8', 'R15', 'Y14', 'G15', 'B14'],
      turn: 0,
      plays: 1,
    });
    S.state.events.splice(0);
    render();
    logLine('<b>Oma Hilde:</b> Die Elf ist draußen. Nun die Nachbarn, Kind.', 'hilde');
    logLine('<b>Lena:</b> Bis zu drei Karten, dann ziehen wir nach.', 'lena');
    logLine('<b>Jonas:</b> Rot steht auf 9 bis 12. Blau wartet noch auf die 11.', 'jonas');
    say(1, 'Die Elf kommt in die Mitte, dann kann die Reihe wachsen.', { force: true });
    say(3, 'Blau ist noch zu. Wenn du die 11 hast, leg sie.', { force: true });
    sys('Vier Farben, von der 11 nach oben und unten. Kein Einsatz.');
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
  sys('Elfer raus am Küchentisch. Nimm Platz, dann wird gegeben.');
  if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();

  window.__elfer = { get state() { return S.state; }, settings: settings, get seats() { return S.seats; }, E: E, AI: AI, get match() { return match; }, render: render };

  if (window.SpielpartnerRunde) SpielpartnerRunde.mount({
    game: 'elfer-raus',
    count: function () { return S.state ? S.state.players - 1 : rulesNow().opponents; },
    inHand: function () {
      if (!S.started || !S.state || S.state.phase === 'done') return false;
      const summary = $('modal-summary');
      const session = $('modal-session');
      if (summary && !summary.hidden) return false;
      if (session && !session.hidden) return false;
      return true;
    },
    apply: function () { refreshSeats(); S.seats.forEach(paintPortrait); render(); },
  });

  if (params.get('shot') === '1') showShot();
  else if (params.get('autostart') === '1') start();
})();
