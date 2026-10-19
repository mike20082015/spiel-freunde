/* Spiel-Freunde Schafkopf: Tisch, Spiele und Mitreden. */
(function () {
  'use strict';
  const E = window.SchafkopfEngine;
  const AI = window.SchafkopfAI;
  const Talk = window.SchafkopfTalk;
  const Voice = window.SchafkopfVoice;
  const C = window.SchafkopfCards;
  const Seats = window.SchafkopfSeats;

  const SPEEDS = { slow: 1.45, normal: 1, fast: 0.35 };
  const LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  const DEFAULTS = {
    level: 'kneipe', target: '20', targetCustom: 20, sound: true, volume: 80,
    talk: 'chat', handsFree: false, hints: false, speed: 'normal', face: 'bavaria',
    rules: {
      deck: 'long', ruf: 1, solo: 5, einheit: 1, unit: 'Punkte',
      wenz: true, farbwenz: true, geier: false, farbgeier: false, tout: true, sie: true,
      allPass: 'throw', legen: false, stoss: true, supra: false, wenzLaufende: 2,
      laufendeMax: 0, davon: true, bock: false,
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

  const settings = load('sf-schafkopf-settings', DEFAULTS);
  settings.rules = Object.assign({}, DEFAULTS.rules, settings.rules || {});
  if (!LEVELS[settings.level]) settings.level = 'kneipe';
  if (params.get('speed')) settings.speed = params.get('speed');
  if (LEVELS[params.get('level')]) settings.level = params.get('level');
  const saveSettings = () => store('sf-schafkopf-settings', settings);
  if (params.get('fresh')) { try { localStorage.removeItem('sf-schafkopf-match'); } catch (e) { /* egal */ } }
  if (Voice) Voice.init({ getSettings: () => settings });

  let rng = params.get('seed') ? E.seededRng(+params.get('seed') || 1) : E.cryptoRng();
  let match = load('sf-schafkopf-match', null);
  function blankMatch() {
    return { scores: [0, 0, 0, 0], dealer: 3, handNo: 0, rows: [], pot: 0, bock: false, winner: null };
  }
  if (!match || !match.scores || match.scores.length !== 4) match = blankMatch();
  match.rows = match.rows || [];
  match.pot = match.pot || 0;
  function saveMatch() {
    store('sf-schafkopf-match', {
      scores: match.scores, dealer: match.dealer, handNo: match.handNo,
      rows: match.rows.slice(-80), pot: match.pot, bock: !!match.bock, winner: match.winner,
    });
  }

  const S = {
    state: null, gen: 0, busy: false, humanWait: null, kontraWait: null, nextWait: null,
    started: false, lastTalk: [0, 0, 0, 0], bubbleTimers: [], settled: false,
    showLast: false, contractSaid: '', watch: params.get('watch') === '1',
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
  function refreshOpponents() {
    if (window.SpielpartnerLineup) SpielpartnerLineup.dress(Seats.seats, 'schafkopf', localStorage);
    Seats.seats.forEach((p) => {
      if (!p || p.id === 'du') return;
      const wrap = $('ava-' + p.seat);
      if (!wrap) return;
      const ini = wrap.querySelector('.ini');
      if (ini) ini.textContent = p.initials;
      const name = $('name-' + p.seat);
      if (name) name.textContent = p.name;
      if (window.SpielpartnerLineup) SpielpartnerLineup.paintSeat(wrap, p);
    });
  }
  async function mountPortraits() {
    refreshOpponents();
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
      if (st && st.game && st.game.declarer === s && st.phase !== 'legen' && st.phase !== 'bid') tags.push('Spieler');
      if (st && st.game && st.game.type === 'sauspiel' && E.partnerKnown(st) && st.game.partner === s) tags.push('Partner');
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
    if (!st || !st.game || st.phase === 'bid' || st.phase === 'legen' || st.phase === 'also' || st.phase === 'choose') {
      mid.innerHTML = st && st.phase === 'legen' ? 'Klopfen' : 'Stich';
      return;
    }
    let html = esc(E.describeGame(st.game));
    if (st.lastTrick && st.phase === 'play') html += '<button type="button" class="last-toggle" id="btn-last">' + (S.showLast ? 'Aktueller Stich' : 'Letzter Stich') + '</button>';
    mid.innerHTML = html;
    const btn = $('btn-last');
    if (btn) btn.addEventListener('click', () => { S.showLast = !S.showLast; renderTrick(); });
  }
  function renderHand() {
    const el = $('hand');
    el.innerHTML = '';
    const st = S.state;
    if (!st) return;
    const mine = st.turn === 0 && st.phase === 'play' && S.humanWait;
    const legal = mine ? E.legalCards(st, 0) : [];
    const hintCard = settings.hints && mine ? AI.playCard(st, 0, 'anfaenger') : null;
    E.sortHand(st.hands[0], st.game).forEach((card) => {
      const node = C.cardEl(card, { tag: 'button' });
      const playable = legal.indexOf(card) >= 0;
      if (playable) node.classList.add('playable');
      if (hintCard === card) node.classList.add('suggest');
      node.addEventListener('click', () => {
        if (!S.humanWait || st.turn !== 0 || st.phase !== 'play') return;
        const res = E.actPlay(st, 0, card);
        if (!res.ok) { note(res.reason); return; }
        S.showLast = false;
        releaseHuman();
      });
      el.appendChild(node);
    });
  }
  function renderChooser() {
    const st = S.state;
    const box = $('chooser');
    const show = !!(st && st.phase === 'choose' && st.turn === 0 && S.humanWait);
    box.hidden = !show;
    if (!show) return;
    $('chooser-title').textContent = st.must ? 'Du musst ein Spiel nennen.' : 'Was spielst du?';
    const wrap = $('chooser-games');
    wrap.innerHTML = '';
    E.legalGames(st, 0).forEach((g) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = g.tout ? 'tout' : '';
      b.textContent = g.type === 'sauspiel' ? (E.SUIT_NAMES[g.suit] + ' rufen') : E.describeGame(g);
      b.addEventListener('click', () => choose(g));
      wrap.appendChild(b);
    });
    if (!st.must) {
      const pass = document.createElement('button');
      pass.type = 'button';
      pass.className = 'chooser-pass';
      pass.textContent = 'Doch nicht';
      pass.addEventListener('click', () => choose(null));
      wrap.appendChild(pass);
    }
  }
  function choose(game) {
    const res = E.actChoose(S.state, 0, game);
    if (!res.ok) { note(res.reason); return; }
    releaseHuman();
  }
  function renderActions() {
    const box = $('actions');
    box.innerHTML = '';
    const st = S.state;
    if (!st || !S.humanWait || st.turn !== 0) {
      if (st && st.phase === 'play' && (E.canStoss(st, 0) || E.canRetour(st, 0) || E.canSupra(st, 0))) fillKontra(box);
      return;
    }
    const add = (label, act, primary) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.act = act;
      if (primary) b.className = 'primary';
      b.textContent = label;
      box.appendChild(b);
    };
    if (st.phase === 'legen') { add('Klopfen', 'knock', true); add('Nicht klopfen', 'nock'); }
    else if (st.phase === 'bid') { add('Ich würde spielen', 'play', true); add('Weiter', 'pass'); }
    else if (st.phase === 'also') { add('Ich spiel auch', 'also', true); add('Weiter', 'pass'); }
    else if (st.phase === 'play') fillKontra(box);
  }
  function fillKontra(box) {
    const st = S.state;
    const add = (label, act) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.act = act;
      b.textContent = label;
      box.appendChild(b);
    };
    if (E.canStoss(st, 0)) add('Stoß', 'stoss');
    if (E.canRetour(st, 0)) add('Retour', 'retour');
    if (E.canSupra(st, 0)) add('Noch mal doppelt', 'supra');
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
      if (box.textContent.indexOf('nicht') < 0) box.hidden = true;
      return;
    }
    let text = '';
    if (st.phase === 'bid') text = 'Weiter, oder sag, dass du spielen würdest. Ein Rufspiel lohnt ab vier Trümpfen mit zwei Obern.';
    else if (st.phase === 'choose') text = 'Die Herz-Sau ist Trumpf und wird nicht gerufen. Tout verlierst du, sobald die anderen einen Stich haben.';
    else if (st.phase === 'play') text = 'Farbe bedienen. Die gerufene Sau muss auf die Farbe, abwerfen darfst du sie erst im letzten Stich.';
    else if (st.phase === 'legen') text = 'Klopfen verdoppelt den späteren Spielwert. Es ist eine Hausregel.';
    if (!text) { box.hidden = true; return; }
    box.hidden = false;
    box.textContent = text;
  }
  function renderStatus() {
    const st = S.state;
    const main = $('st-main');
    const chips = $('st-chips');
    chips.innerHTML = '';
    if (!st) { main.textContent = 'Willkommen am Stammtisch'; return; }
    const name = who(st.turn) ? who(st.turn).name : '';
    if (st.phase === 'done' && st.result) main.innerHTML = esc(st.result.note || st.result.label);
    else if (st.phase === 'legen') main.innerHTML = (st.turn === 0 ? 'Du' : esc(name)) + ' darfst klopfen';
    else if (st.phase === 'bid') main.innerHTML = (st.turn === 0 ? 'Du bist' : esc(name) + ' ist') + ' dran: spielen oder weiter';
    else if (st.phase === 'also') main.innerHTML = (st.turn === 0 ? 'Du' : esc(name)) + ' kannst noch einsteigen';
    else if (st.phase === 'choose') main.innerHTML = (st.turn === 0 ? 'Du nennst' : esc(name) + ' nennt') + ' das Spiel';
    else if (st.phase === 'play') main.innerHTML = (st.turn === 0 ? 'Du spielst' : esc(name) + ' spielt') + ' eine Karte';
    else main.textContent = 'Am Stammtisch';
    if (st.game && st.phase !== 'bid' && st.phase !== 'legen') chips.appendChild(chip('<b>' + esc(E.describeGame(st.game)) + '</b>'));
    if (st.stoss) chips.appendChild(chip(st.retour ? 'Retour' : 'Stoß'));
    if (st.supra) chips.appendChild(chip('doppelt'));
    if (st.bock) chips.appendChild(chip('Bock'));
    if (match.pot) chips.appendChild(chip('Stock <b>' + match.pot + '</b>'));
    if (st.legen) chips.appendChild(chip('Klopfen ×' + Math.pow(2, st.legen)));
  }
  function renderScore() {
    const target = targetValue();
    $('mode-badge').textContent = settings.rules.unit === 'Cent' ? 'ct' : String(target);
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
    $('target-info').innerHTML = '<div class="ti-head"><span>bis ' + target + '</span><b>' + (match.pot ? ('Stock ' + match.pot) : 'ohne Einsatz') + '</b></div>' + bars;
    const r = rulesNow();
    const unit = r.unit === 'Cent' ? 'ct' : 'P';
    $('tariff').textContent = 'Rufspiel ' + r.ruf + ' ' + unit + ', Einzelspiel ' + r.solo + ' ' + unit + ', Einheit ' + r.einheit + ' ' + unit + ' für Schneider, Schwarz und Laufende. Kein Geld.';
  }
  function render() {
    document.body.classList.toggle('deck-french', settings.face === 'french');
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
  function waitHuman() {
    return new Promise((res) => { S.humanWait = res; });
  }
  function humanToMove(st) {
    return st && st.turn === 0 && st.phase !== 'done' && !S.watch;
  }
  function offerKontra() {
    const st = S.state;
    if (!st || st.turn === 0 || st.phase !== 'play') return Promise.resolve();
    if (!E.canStoss(st, 0) && !E.canRetour(st, 0) && !E.canSupra(st, 0)) return Promise.resolve();
    render();
    return new Promise((res) => {
      let done = false;
      const fin = () => { if (done) return; done = true; S.kontraWait = null; res(); };
      S.kontraWait = fin;
      setTimeout(fin, 900 * (SPEEDS[settings.speed] || 1));
    });
  }

  function onAct(act) {
    const st = S.state;
    if (!st) return;
    let res = null;
    if (act === 'knock' || act === 'nock') res = E.actLegen(st, 0, act === 'knock');
    else if (act === 'play' || act === 'pass') res = st.phase === 'also' ? E.actAlso(st, 0, 'pass') : E.actIntent(st, 0, act === 'play' ? 'play' : 'pass');
    else if (act === 'also') res = E.actAlso(st, 0, 'also');
    else if (act === 'stoss') res = E.actStoss(st, 0);
    else if (act === 'retour') res = E.actRetour(st, 0);
    else if (act === 'supra') res = E.actSupra(st, 0);
    if (!res || !res.ok) { if (res) note(res.reason); return; }
    if (act === 'stoss' || act === 'retour' || act === 'supra') {
      talk(0, act === 'stoss' ? 'stoss' : 'retour', null, true);
      render();
      if (S.kontraWait) S.kontraWait();
      return;
    }
    releaseHuman();
  }

  function aiKontra() {
    const st = S.state;
    if (!st || st.phase !== 'play' || !E.windowOpen(st)) return false;
    for (let s = 1; s < 4; s++) {
      if (AI.wantStoss(st, s, settings.level)) { E.actStoss(st, s); talk(s, 'stoss', 1, true); return true; }
      if (AI.wantRetour(st, s, settings.level)) { E.actRetour(st, s); talk(s, 'retour', 1, true); return true; }
      if (AI.wantSupra(st, s, settings.level)) { E.actSupra(st, s); return true; }
    }
    return false;
  }

  function commentContract(st) {
    if (!st.game || S.contractSaid === E.describeGame(st.game) + st.handNo) return;
    S.contractSaid = E.describeGame(st.game);
    const map = { sauspiel: 'sauspiel', solo: 'solo', wenz: 'wenz', farbwenz: 'wenz', geier: 'wenz', farbgeier: 'wenz', ramsch: 'ramsch', sie: 'solo' };
    const ev = map[st.game.type] || 'gameStart';
    const seat = st.game.declarer == null ? 2 : st.game.declarer;
    if (seat !== 0) talk(seat, ev, 1, true);
    else talk(2, ev, 0.8, true);
  }

  async function playHand() {
    const gen = S.gen;
    let guard = 0;
    while (S.state && S.state.phase !== 'done' && guard < 500) {
      guard += 1;
      if (gen !== S.gen) throw CANCEL;
      commentContract(S.state);
      if (aiKontra()) {
        render();
        await delay(320);
        continue;
      }
      if (humanToMove(S.state)) {
        await new Promise((res) => { S.humanWait = res; render(); });
        await delay(180);
        continue;
      }
      render();
      await offerKontra();
      if (gen !== S.gen) throw CANCEL;
      if (humanToMove(S.state)) continue;
      const seat = S.state.turn;
      const phase = S.state.phase;
      const res = AI.apply(S.state, seat, settings.level);
      if (!res || !res.ok) {
        sys((res && res.reason) || 'Der Zug geht nicht.');
        break;
      }
      if (phase === 'bid' && Math.random() < 0.35) talk(seat, 'bid', 1);
      if (S.state.phase === 'done' && S.state.result && S.state.result.kind === 'throw') talk(2, 'throw', 0.9, true);
      await delay(S.state.phase === 'play' ? 420 : 280);
    }
  }

  function showSummary(result) {
    const box = $('summary');
    const won = result.winners && result.winners.indexOf(0) >= 0;
    const title = result.kind === 'throw' ? 'Zusammengeworfen' : result.kind === 'stock' ? 'In den Stock' : (won ? 'Gewonnen' : 'Verloren');
    let rows = Seats.seats.map((p) => '<tr><td>' + esc(p.name) + '</td><td class="' + (result.deltas[p.seat] > 0 ? 'pos' : 'neg') + '">' + (result.deltas[p.seat] > 0 ? '+' : '') + result.deltas[p.seat] + '</td></tr>').join('');
    box.innerHTML = '<p class="sum-title ' + (won ? 'won' : 'lost') + '">' + title + '</p>' +
      '<p>' + esc(result.note || '') + '</p>' +
      '<p class="sum-quote">' + esc(Talk.line(won ? 'sepp' : 'horst', won ? 'win' : 'lose') || '') + '</p>' +
      '<table class="sum-table"><tbody>' + rows + '</tbody></table>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-next">Weiter</button></div>';
    $('modal-summary').hidden = false;
    $('btn-next').addEventListener('click', () => {
      if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
      $('modal-summary').hidden = true;
      if (S.nextWait) { const fn = S.nextWait; S.nextWait = null; fn(); }
    });
  }
  function showSession() {
    const seat = match.winner;
    const box = $('session');
    const names = Seats.seats.map((p, i) => ({ name: p.name, score: match.scores[i], i: i })).sort((a, b) => b.score - a.score);
    box.innerHTML = '<h3 class="session-title">' + esc(who(seat).name) + ' führt den Abend</h3>' +
      '<p>Ziel ' + targetValue() + ' erreicht. Gezählt wurden Punkte, kein Geld.</p>' +
      '<ol class="standings">' + names.map((n, idx) => '<li class="' + (idx === 0 ? 'first' : '') + '"><span>' + (idx + 1) + '</span><span>' + esc(n.name) + '</span><b>' + n.score + '</b></li>').join('') + '</ol>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-again">Neue Punkteliste</button></div>';
    $('modal-session').hidden = false;
    $('btn-again').addEventListener('click', () => {
      if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
      $('modal-session').hidden = true;
      const dealer = match.dealer;
      match = blankMatch();
      match.dealer = dealer;
      saveMatch();
      if (S.nextWait) { const fn = S.nextWait; S.nextWait = null; fn(); }
    });
  }

  async function dealAndPlay() {
    if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
    const gen = ++S.gen;
    try {
      match.rules = rulesNow();
      match.target = targetValue();
      S.contractSaid = '';
      S.showLast = false;
      S.state = E.dealHand(match, rng);
      sys(S.state.phase === 'legen' ? 'Die ersten Karten liegen. Wer klopft, verdoppelt.' : 'Acht Karten. Vorhand fängt an.');
      talk(2, 'gameStart', 0.85, true);
      await playHand();
      if (gen !== S.gen) return;
      if (!S.state.result) S.state.result = { kind: 'throw', label: 'Offen', deltas: [0, 0, 0, 0], note: 'Das Spiel bleibt liegen.', winners: [] };
      const result = S.state.result;
      if (result.kind === 'game' || result.kind === 'sie' || result.kind === 'ramsch') {
        const good = result.declarerWon;
        if (result.kind !== 'ramsch' && result.declarer != null && result.declarer !== 0) talk(result.declarer, good ? 'win' : 'lose', 0.9, true);
        else if (result.loserSeat != null && result.loserSeat !== 0) talk(result.loserSeat, 'lose', 0.7);
        if (result.schneider) talk(2, 'schneider', 0.6);
      }
      E.applyToMatch(match, S.state);
      saveMatch();
      render();
      if (window.SpielpartnerRounds) SpielpartnerRounds.finish();
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
    val('ruf', settings.rules.ruf);
    $('opt-solo').value = settings.rules.solo;
    $('opt-einheit').value = settings.rules.einheit;
    val('unit', settings.rules.unit);
    $('opt-wenz').checked = !!settings.rules.wenz;
    $('opt-farbwenz').checked = !!settings.rules.farbwenz;
    $('opt-geier').checked = !!settings.rules.geier;
    $('opt-farbgeier').checked = !!settings.rules.farbgeier;
    $('opt-tout').checked = !!settings.rules.tout;
    $('opt-sie').checked = settings.rules.sie !== false;
    val('allPass', settings.rules.allPass);
    $('opt-legen').checked = !!settings.rules.legen;
    $('opt-stoss').checked = settings.rules.stoss !== false;
    $('opt-supra').checked = !!settings.rules.supra;
    $('opt-davon').checked = settings.rules.davon !== false;
    $('opt-bock').checked = !!settings.rules.bock;
    val('wenzLauf', settings.rules.wenzLaufende);
    val('laufMax', settings.rules.laufendeMax);
    val('deck', settings.rules.deck);
    val('face', settings.face || 'bavaria');
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
    settings.rules.ruf = val('ruf') === '2' ? 2 : 1;
    settings.rules.solo = +$('opt-solo').value || 5;
    settings.rules.einheit = +$('opt-einheit').value || 1;
    settings.rules.unit = val('unit') === 'Cent' ? 'Cent' : 'Punkte';
    settings.rules.wenz = $('opt-wenz').checked;
    settings.rules.farbwenz = $('opt-farbwenz').checked;
    settings.rules.geier = $('opt-geier').checked;
    settings.rules.farbgeier = $('opt-farbgeier').checked;
    settings.rules.tout = $('opt-tout').checked;
    settings.rules.sie = $('opt-sie').checked;
    settings.rules.allPass = val('allPass') || 'throw';
    settings.rules.legen = $('opt-legen').checked;
    settings.rules.stoss = $('opt-stoss').checked;
    settings.rules.supra = $('opt-supra').checked;
    settings.rules.davon = $('opt-davon').checked;
    settings.rules.bock = $('opt-bock').checked;
    settings.rules.wenzLaufende = val('wenzLauf') === '3' ? 3 : 2;
    settings.rules.laufendeMax = val('laufMax') === '4' ? 4 : 0;
    settings.rules.deck = val('deck') === 'short' ? 'short' : 'long';
    settings.face = val('face') === 'french' ? 'french' : 'bavaria';
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
    const game = S.state ? E.publicSummary(S.state, match.scores) : { phase: 'play', game: 'Schafkopf', scores: match.scores };
    for (let i = 0; i < people.length; i++) {
      const person = seatById(people[i]);
      if (!person) continue;
      const typing = showTyping(person.name);
      let reply = '';
      try { reply = await Talk.askAI(person.id, { message: message, game: game }); }
      catch (e) { reply = Talk.cannedReply(person.id, message); }
      if (person.id === 'sepp') await new Promise((res) => setTimeout(res, 280));
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

  $('actions').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.act) onAct(btn.dataset.act);
  });
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
    sys(settings.sound ? 'Ton an. Horst und Margarethe sprechen, Sepp bleibt bei der Blase.' : 'Ton aus. Alle bleiben bei der Sprechblase.');
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
    if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
    S.started = true;
    $('intro').hidden = true;
    if (Voice) Voice.unlock();
    sys('Die Karten sind gemischt. Sepp sitzt gegenüber.');
    dealAndPlay();
  }

  function showShot() {
    if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
    $('intro').hidden = true;
    S.started = true;
    match.rules = rulesNow();
    match.target = targetValue();
    S.state = E.dealHand(match, E.seededRng(params.get('seed') ? +params.get('seed') : 11));
    S.humanWait = function () {};
    render();
    logLine('<b>Sepp:</b> Servus, setz di her. A Maß steht scho.', 'sepp');
    logLine('<b>Horst:</b> Na endlich. Spiel lieber, statt zu reden.', 'horst');
    say(2, 'Basst scho. Wer a Sauspiel hat, der sagts.', { force: true });
    sys('Punkte statt Geld. Rufspiel, Wenz und Solo.');
  }

  mountPortraits();
  renderTop();
  renderScore();
  applyTalk(false);
  sys('Schafkopf am Stammtisch. Nimm Platz, dann wird gegeben.');
  if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();

  window.__schafkopf = {
    get state() { return S.state; },
    settings: settings,
    seats: Seats,
    E: E,
    AI: AI,
    match: match,
    render: render,
  };

  if (window.SpielpartnerRunde) SpielpartnerRunde.mount({
    game: 'schafkopf',
    count: function () { return 3; },
    inHand: function () {
      if (!S.started || !S.state || S.state.phase === 'done') return false;
      const summary = $('modal-summary');
      const session = $('modal-session');
      if (summary && !summary.hidden) return false;
      if (session && !session.hidden) return false;
      return true;
    },
    apply: refreshOpponents,
  });

  if (params.get('shot') === '1') showShot();
  else if (params.get('autostart') === '1') start();
})();
