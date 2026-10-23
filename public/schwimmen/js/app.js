/* Spiel-Freunde Schwimmen: Tisch, Runden und Mitreden. */
(function () {
  'use strict';
  const E = window.SchwimmenEngine;
  const AI = window.SchwimmenAI;
  const Talk = window.SchwimmenTalk;
  const Voice = window.SchwimmenVoice;
  const C = window.SchwimmenCards;
  const Seats = window.SchwimmenSeats;

  const SPEEDS = { slow: 1.45, normal: 1, fast: 0.35 };
  const LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  const DEFAULTS = {
    level: 'kneipe', sound: true, volume: 80, talk: 'chat', handsFree: false, hints: false, speed: 'normal',
    rules: E.normalizeRules({}),
  };
  const CANCEL = { cancelled: true };
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const RANK_ORDER = { '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
  const SUIT_ORDER = { C: 0, S: 1, H: 2, D: 3 };

  function load(key, def) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v ? Object.assign({}, def, v) : Object.assign({}, def);
    } catch (e) { return Object.assign({}, def); }
  }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* privat */ } }

  const settings = load('sf-schwimmen-settings', DEFAULTS);
  settings.rules = E.normalizeRules(Object.assign({}, DEFAULTS.rules, settings.rules || {}));
  if (!LEVELS[settings.level]) settings.level = 'kneipe';
  if (params.get('speed')) settings.speed = params.get('speed');
  if (LEVELS[params.get('level')]) settings.level = params.get('level');
  const saveSettings = () => store('sf-schwimmen-settings', settings);
  if (params.get('fresh')) {
    try {
      localStorage.removeItem('sf-schwimmen-match');
      localStorage.removeItem('sf-schwimmen-settings');
    } catch (e) { /* egal */ }
    Object.assign(settings, DEFAULTS, { rules: E.normalizeRules({}), speed: params.get('speed') || 'normal' });
  }
  if (Voice) Voice.init({ getSettings: () => settings });

  let rng = params.get('seed') ? E.seededRng(+params.get('seed') || 1) : E.cryptoRng();
  const rulesNow = () => E.normalizeRules(settings.rules);
  function blankMatch() { return E.blankMatch(rulesNow()); }
  let match = load('sf-schwimmen-match', null);
  if (params.get('fresh') || !match || !match.lives || match.lives.length !== rulesNow().opponents + 1) match = blankMatch();
  match.rules = rulesNow();
  match.rows = match.rows || [];
  function saveMatch() {
    store('sf-schwimmen-match', {
      rules: match.rules, lives: match.lives, swimming: match.swimming, out: match.out, lost: match.lost,
      dealer: match.dealer, handNo: match.handNo, rows: (match.rows || []).slice(-80), winner: match.winner,
    });
  }

  const S = {
    state: null, gen: 0, started: false, humanWait: null, humanTimer: 0, nextWait: null,
    pick: null, seats: Seats.layout(rulesNow().opponents), lastTalk: {}, bubbleTimers: {},
    watch: params.get('watch') === '1',
    learn: false,
  };
  function zui() { return window.SpielpartnerZuschauen; }
  function lernen() { return !!(S.learn && zui() && zui().aktiv()); }
  function autoPlatz() { return !!(S.watch || lernen()); }
  function lern(text, platz) { if (lernen() && text) zui().kommentar(text, { platz: platz }); }
  function schwimmSatz(seat, mv, st) {
    if (!mv || !zui()) return '';
    const name = nameOf(seat);
    if (mv.type === 'swapAll') return zui().erklaere('schwimmen', { art: 'alle', name: name });
    if (mv.type === 'swap') return zui().erklaere('schwimmen', { art: 'tausch', name: name, karte: mv.card ? E.cardName(mv.card, st.rules) : 'eine Karte' });
    if (mv.type === 'knock') return zui().erklaere('schwimmen', { art: 'klopfen', name: name });
    if (mv.type === 'reveal') return zui().erklaere('schwimmen', { art: 'aufdecken', name: name });
    if (mv.type === 'schieben') return zui().erklaere('schwimmen', { art: 'schieben', name: name });
    return name + ' ist am Zug.';
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
    if (window.SpielpartnerLineup) SpielpartnerLineup.dress(S.seats, 'schwimmen', localStorage, n);
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
    const show = () => {
      if (!el) return;
      el.textContent = text;
      el.classList.add('show');
    };
    const hideLater = (ms) => {
      clearTimeout(S.bubbleTimers[seat]);
      S.bubbleTimers[seat] = setTimeout(() => { if (el) el.classList.remove('show'); }, ms);
    };
    show();
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
  function tableFacts(seat, event) {
    const who = person(seat);
    const st = S.state;
    const bits = ['Spieler ' + ((who && who.name) || 'jemand')];
    if (event) bits.push(event);
    if (st && st.phase) bits.push('Phase ' + st.phase);
    if (match && Array.isArray(match.scores)) bits.push('Punkte ' + match.scores.join(', '));
    return bits.join('. ');
  }
  function talk(seat, event, prob, force) {
    if (prob != null && Math.random() > prob) return false;
    if (typeof window !== 'undefined' && window.SpielpartnerSprueche && !window.SpielpartnerSprueche.allow({ force: !!force })) return false;
    const who = person(seat);
    if (!who || who.id === 'du') return false;
    const ev = settings.level === 'anfaenger' && event === 'lose' ? 'encourage' : event;
    const sprueche = typeof window !== 'undefined' ? window.SpielpartnerSprueche : null;
    const fallback = () => Talk.line(who.id, ev);
    if (!sprueche || typeof sprueche.freshComment !== 'function') return say(seat, fallback(), { force: !!force });
    sprueche.freshComment({
      character: who.id,
      event: ev,
      situation: tableFacts(seat, ev),
      game: S.state ? { phase: S.state.phase, scores: match && match.scores ? match.scores.slice() : null } : null,
      fallback: fallback,
    }).then((text) => { if (text) say(seat, text, { force: !!force }); });
    return true;
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
  function lifeHtml(i) {
    const start = (match.rules && match.rules.lives) || rulesNow().lives;
    let html = '<span class="pips" aria-label="' + (match.lives[i] || 0) + ' Leben">';
    for (let k = 0; k < start; k++) html += '<i class="pip-life' + (k < match.lives[i] ? '' : ' off') + '"></i>';
    html += '</span>';
    if (match.out[i]) html += ' <span class="tag out">raus</span>';
    else if (match.swimming[i]) html += ' <span class="tag swim">Schwimmt</span>';
    return html;
  }
  function sortHand(cards) {
    return cards.slice().sort((a, b) => (SUIT_ORDER[E.suitOf(a)] - SUIT_ORDER[E.suitOf(b)]) || ((RANK_ORDER[E.rankOf(a)] || 0) - (RANK_ORDER[E.rankOf(b)] || 0)));
  }
  function humanTurn() {
    const st = S.state;
    return !!(st && st.turn === 0 && st.phase !== 'done' && !autoPlatz());
  }
  function releaseHuman(move) {
    commitNote();
    clearTimeout(S.humanTimer);
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

  function renderBacks(seat) {
    const box = $('backs-' + seat);
    if (!box || !S.state) return;
    box.innerHTML = '';
    const n = Math.min((S.state.hands[seat] || []).length, 3);
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
      if (match.out[i - 1] || (S.seats[i] && match.out[S.seats[i].seat])) node.classList.toggle('out', !!match.out[i]);
      paintPortrait(p);
      const role = $('role-' + i);
      if (role) role.innerHTML = lifeHtml(i);
      if (S.state) renderBacks(i);
    }
    const me = $('seat-0');
    if (me) me.classList.toggle('active', humanTurn());
    const role0 = $('role-0');
    if (role0) {
      let extra = '';
      if (S.state && S.state.hands[0] && S.state.hands[0].length === 3) extra = ' <span class="tag">' + esc(E.handScore(S.state.hands[0]).label) + '</span>';
      role0.innerHTML = lifeHtml(0) + extra;
    }
    const names = S.seats.filter((p) => p.id !== 'du').map((p) => p.name);
    const copy = $('intro-copy');
    if (copy && names.length) copy.textContent = 'Du spielst gegen ' + names.join(', ').replace(/, ([^,]+)$/, ' und $1') + '. Drei Karten, drei offen in der Mitte. Tausch eine oder alle, schieb einmal, oder klopfe. 31 und Feuer zählen sofort. Drei Leben, danach Schwimmen. Kein Einsatz.';
  }
  function renderMiddle() {
    const st = S.state;
    const box = $('middle');
    const talon = $('talon');
    box.innerHTML = '';
    talon.innerHTML = '';
    if (!st) { $('talon-count').textContent = '0'; return; }
    C.setDeck(st.rules.deck);
    if (st.talon.length) talon.appendChild(C.backEl());
    $('talon-count').textContent = String(st.talon.length);
    st.middle.forEach((card, index) => {
      const el = C.cardEl(card, { tag: 'button' });
      if (humanTurn() && S.pick) el.classList.add('playable');
      el.addEventListener('click', () => {
        if (!humanTurn()) return;
        if (!S.pick) { note('Wähl zuerst eine Karte aus deiner Hand.'); return; }
        releaseHuman({ type: 'swap', card: S.pick, with: index });
      });
      box.appendChild(el);
    });
  }
  function renderHand() {
    const hand = $('hand');
    hand.innerHTML = '';
    const st = S.state;
    if (!st) return;
    C.setDeck(st.rules.deck);
    const mine = st.hands[0] || [];
    hand.classList.toggle('crowded', mine.length > 8);
    sortHand(mine).forEach((card) => {
      const el = C.cardEl(card, { tag: 'button' });
      if (humanTurn()) el.classList.add('playable');
      if (S.pick === card) el.classList.add('selected');
      const hint = settings.hints && humanTurn() ? (AI.act(st, 0, 'kneipe', () => 0) || {}) : null;
      if (hint && hint.type === 'swap' && hint.card === card) el.classList.add('suggest');
      el.addEventListener('click', () => {
        if (!humanTurn()) return;
        S.pick = S.pick === card ? null : card;
        renderHand();
        renderMiddle();
      });
      hand.appendChild(el);
    });
  }
  function actionButton(label, move, primary) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    if (primary) btn.className = 'primary';
    btn.addEventListener('click', () => releaseHuman(move));
    return btn;
  }
  function renderActions() {
    const box = $('actions');
    box.innerHTML = '';
    const st = S.state;
    if (!st || st.phase === 'done' || !humanTurn()) return;
    const moves = E.legalMoves(st, 0);
    if (moves.some((m) => m.type === 'reveal')) {
      const kind = E.handScore(st.hands[0]).kind === 'feuer' ? 'Feuer' : '31';
      box.appendChild(actionButton(kind + ' aufdecken', { type: 'reveal' }, true));
    }
    if (moves.some((m) => m.type === 'swapAll')) box.appendChild(actionButton('Alle tauschen', { type: 'swapAll' }));
    if (moves.some((m) => m.type === 'schieben')) box.appendChild(actionButton('Schieben', { type: 'schieben' }));
    if (moves.some((m) => m.type === 'knock')) box.appendChild(actionButton('Klopfen', { type: 'knock' }, true));
  }
  function noteToken() {
    const st = S.state;
    if (!st) return '0';
    return [
      match.handNo,
      st.phase,
      st.turn,
      (st.hands || []).map((h) => h.join('.')).join('/'),
      (st.middle || []).join('.'),
      st.knocker == null ? '' : st.knocker,
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
    const st = S.state;
    if (!settings.hints || !humanTurn()) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    const score = E.handScore(st.hands[0]);
    let text = 'Deine Hand steht auf ' + score.label + '. Tausch eine Karte mit der Mitte, alle drei, schieb oder klopfe.';
    if (st.phase === 'closing') text = 'Es ist geklopft. Du hast noch genau diesen Zug, dann wird aufgedeckt.';
    if (score.kind === '31' || score.kind === 'feuer') text = score.label + ' liegt bei dir. Deck auf, dann ist die Runde vorbei.';
    box.hidden = false;
    box.textContent = text;
  }
  function renderStatus() {
    const st = S.state;
    let text = 'Willkommen am Schwimmen-Tisch';
    if (st && st.phase === 'done') {
      if (st.reason === '31' || st.reason === 'feuer') text = nameOf(st.revealer) + ' zeigt ' + (st.reason === 'feuer' ? 'Feuer' : '31') + '.';
      else if (st.reason === 'push') text = 'Gleichstand. Niemand verliert ein Leben.';
      else if (st.reason === 'knock') text = nameOf(st.knocker) + ' hat geklopft und zahlt.';
      else text = 'Aufgedeckt. Die niedrigste Hand gibt ein Leben ab.';
    } else if (st && st.phase === 'closing' && st.turn === 0) text = nameOf(st.knocker) + ' hat geklopft. Du hast noch einen Zug.';
    else if (st && st.phase === 'closing') text = nameOf(st.knocker) + ' hat geklopft. ' + nameOf(st.turn) + ' ist noch dran.';
    else if (humanTurn()) text = 'Du bist dran. Hand: ' + E.handScore(st.hands[0]).label + '.';
    else if (st) text = nameOf(st.turn) + ' ist dran.';
    $('st-main').textContent = text;
    const chips = $('st-chips');
    chips.innerHTML = '';
    if (!st) return;
    chips.appendChild(chip('Mitte <b>' + st.middle.length + '</b>'));
    chips.appendChild(chip('Talon <b>' + st.talon.length + '</b>'));
    if (st.phase === 'closing') chips.appendChild(chip('letzte Züge'));
  }
  function renderScore() {
    const lives = match.lives || [];
    $('mode-badge').textContent = (match.rules.lives || 3) + ' Leben';
    const names = S.seats.map((p, i) => (i === 0 ? youName() : p.name));
    let body = '';
    const last = match.rows && match.rows.length ? match.rows[match.rows.length - 1] : null;
    let best = -1;
    lives.forEach((n, i) => { if (!match.out[i] && n >= best) best = n; });
    for (let i = 0; i < lives.length; i++) {
      const lead = !match.out[i] && lives[i] === best ? ' class="pos"' : '';
      const label = last && last.labels ? (last.labels[i] || '–') : '–';
      const state = match.out[i] ? 'raus' : match.swimming[i] ? 'Schwimmt' : 'dabei';
      body += '<tr><td>' + esc(names[i] || '') + '</td><td>' + esc(label) + '</td><td>' + esc(state) + '</td><td' + lead + '>' + lives[i] + '</td></tr>';
    }
    $('score-table').innerHTML = '<thead><tr><th>Name</th><th>Letzte</th><th></th><th>Leben</th></tr></thead><tbody>' + body + '</tbody>';
    const start = match.rules.lives || 3;
    let bars = '';
    for (let i = 0; i < lives.length; i++) {
      const pct = start ? Math.round((lives[i] / start) * 100) : 0;
      bars += '<div class="ti-row"><span class="ti-name">' + esc(names[i] || '') + '</span><span class="ti-bar"><i style="width:' + pct + '%"></i></span><span class="ti-val">' + lives[i] + '</span></div>';
    }
    const cap = match.rules.maxHands ? 'nach ' + match.rules.maxHands : 'bis einer übrig ist';
    $('target-info').innerHTML = '<div class="ti-head"><span>' + cap + '</span><b>' + (match.handNo || 0) + ' Runden</b></div>' + bars;
    $('tariff').textContent = 'Ass 11, Figuren und Zehn je 10, nur eine Farbe. Drilling 30½. Kein Geld.';
  }
  function render() {
    if (S.state) C.setDeck(S.state.rules.deck);
    renderSeats();
    renderMiddle();
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
    $('intro-small').textContent = 'Spielstärke ' + (LEVELS[settings.level] || '') + ' · ' + r.lives + ' Leben · ' + (r.opponents + 1) + ' am Tisch · Ton ' + (settings.sound ? 'an' : 'aus');
  }

  function drainEvents() {
    const st = S.state;
    if (!st) return;
    st.events.splice(0).forEach((ev) => {
      const seat = ev.seat;
      if (ev.type === 'knock') talk(seat, 'knock', 1, true);
      else if (ev.type === 'reveal' && ev.kind === 'feuer') talk(seat, 'feuer', 1, true);
      else if (ev.type === 'reveal') talk(seat, 'thirty', 1, true);
      else if (ev.type === 'schieben') talk(seat, 'schieben', 0.8, false);
      else if (ev.type === 'swapAll') talk(seat, 'swapAll', 0.55, false);
      else if (ev.type === 'swap') talk(seat, 'swap', 0.28, false);
      else if (ev.type === 'showdown') {
        (ev.losers || []).forEach((who) => talk(who, 'lose', 0.9, false));
      }
    });
  }

  async function playLoop(gen) {
    S.queued = null;
    let guard = 0;
    while (S.state && S.state.phase !== 'done') {
      if (gen !== S.gen) throw CANCEL;
      if (++guard > 200) { sys('Diese Runde findet kein Ende. Nimm noch einmal Platz.'); break; }
      const st = S.state;
      const seat = st.turn;
      if (seat === 0 && !autoPlatz()) {
        S.pick = null;
        render();
        const move = await waitHuman();
        if (gen !== S.gen) throw CANCEL;
        if (!move) continue;
        const res = E.apply(st, 0, move);
        if (!res.ok) { note('Das geht so nicht.'); continue; }
        S.pick = null;
        drainEvents();
        render();
        await delay(280);
        continue;
      }
      render();
      if (lernen()) await zui().takt();
      else await delay(seat === 0 ? 180 : 560);
      if (gen !== S.gen) throw CANCEL;
      if (seat === 0 && !autoPlatz()) continue;
      let mv = AI.act(st, seat, settings.level, Math.random);
      if (!mv || !E.apply(st, seat, mv).ok) {
        const legal = E.legalMoves(st, seat);
        mv = legal[0];
        if (!mv || !E.apply(st, seat, mv).ok) { sys('Da stockt eine Karte. Die Runde wird neu gegeben.'); break; }
      }
      lern(schwimmSatz(seat, mv, st), seat);
      drainEvents();
      render();
      if (!lernen()) await delay(240);
    }
  }

  function dealLabel(label) {
    const rounds = window.SpielpartnerRounds;
    if (rounds && typeof rounds.nextPlayLabel === 'function') return rounds.nextPlayLabel(label);
    return label;
  }
  function showSummary() {
    const st = S.state;
    const rows = (st.labels || []).map((label, i) => '<tr><td>' + esc(nameOf(i)) + '</td><td>' + esc(label || '–') + '</td><td>' + (match.out[i] ? 'raus' : match.swimming[i] ? 'Schwimmt' : match.lives[i]) + '</td></tr>').join('');
    const title = st.reason === 'feuer' ? 'Feuer' : st.reason === '31' ? '31' : st.reason === 'push' ? 'Gleichstand' : 'Aufgedeckt';
    $('summary').innerHTML =
      '<p class="sum-title">' + title + '</p>' +
      '<p class="sum-quote">' + esc(Talk.line('horst', st.reason === 'feuer' ? 'feuer' : 'close') || 'Weiter geht es.') + '</p>' +
      '<p>Gezählt werden Leben, kein Geld. ' + (st.losers && st.losers.length ? st.losers.map(nameOf).join(', ') + (st.losers.length > 1 ? ' verlieren' : ' verliert') + ' ein Leben.' : 'Niemand verliert ein Leben.') + '</p>' +
      '<table class="sum-table"><thead><tr><th>Name</th><th>Hand</th><th>Leben</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" data-next data-play-label="Nächste Runde">' + dealLabel('Nächste Runde') + '</button></div>';
    $('modal-summary').hidden = false;
  }
  function showSession() {
    const alive = match.winner;
    let list = '';
    const order = match.lives.map((v, i) => ({ i: i, v: v })).sort((a, b) => b.v - a.v);
    order.forEach((row, idx) => {
      list += '<li class="' + (row.i === alive ? 'first' : '') + '"><span>' + (idx + 1) + '</span><span>' + esc(nameOf(row.i)) + '</span><b>' + (match.out[row.i] ? 'raus' : row.v) + '</b></li>';
    });
    $('session').innerHTML =
      '<p class="session-title">' + esc(nameOf(alive)) + ' bleibt übrig</p>' +
      '<p>' + match.handNo + ' Runden. Leben statt Geld.</p>' +
      '<ol class="standings">' + list + '</ol>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" data-next>Neue Runde Leben</button></div>';
    $('modal-session').hidden = false;
    if (alive === 0) talk(1, 'lose', 1, true);
    else if (alive != null) talk(alive, 'win', 1, true);
  }
  function waitNext() { return new Promise((res) => { S.nextWait = res; }); }
  function ensureMatch() {
    const rules = rulesNow();
    const n = rules.opponents + 1;
    if (!match.lives || match.lives.length !== n) match = E.blankMatch(rules);
    match.rules = rules;
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
      S.pick = null;
      S.state = E.dealHand(match, rng);
      if (S.state.phase === 'done') { showSession(); return; }
      saveMatch();
      render();
      if (S.state.turn !== 0) talk(S.state.turn, 'gameStart', 0.75, false);
      else sys('Du fängst an. Eine Karte, alle drei, schieben oder klopfen.');
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
    val('lives', r.lives);
    val('maxHands', r.maxHands);
    val('opponents', r.opponents);
    val('deck', r.deck);
    val('schiebenMode', r.schiebenMode);
    val('knockFrom', r.knockFrom);
    val('feuerCost', r.feuerCost);
    $('opt-swim').checked = r.swim !== false;
    $('opt-schieben').checked = r.schieben !== false;
    $('opt-all').checked = r.allSwap !== false;
    $('opt-penalty').checked = !!r.knockPenalty;
    $('opt-instant').checked = r.instant31 !== false;
    $('opt-feuer').checked = r.feuerInstant !== false;
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
    settings.rules = E.normalizeRules({
      lives: +val('lives'),
      maxHands: +val('maxHands'),
      opponents: +val('opponents'),
      deck: val('deck'),
      schiebenMode: val('schiebenMode'),
      knockFrom: val('knockFrom'),
      feuerCost: +val('feuerCost'),
      swim: $('opt-swim').checked,
      schieben: $('opt-schieben').checked,
      allSwap: $('opt-all').checked,
      knockPenalty: $('opt-penalty').checked,
      instant31: $('opt-instant').checked,
      feuerInstant: $('opt-feuer').checked,
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
    const game = S.state ? E.publicSummary(S.state) : { phase: 'play', game: 'Schwimmen' };
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
    sys(settings.sound ? 'Ton an. Horst, Lena und Chantal sprechen.' : 'Ton aus. Alle bleiben bei der Sprechblase.');
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
    sys('Die Leben stehen wieder voll. Das laufende Spiel zählt noch.');
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
    sys('Die Karten sind gemischt. Horst sitzt links, Chantal rechts, Lena gegenüber.');
    const lena = seatById('lena');
    if (lena) talk(lena.seat, 'welcome', 1, true);
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
    match = E.blankMatch(rulesNow());
    match.lives = [3, 2, 3, 0];
    match.swimming = [false, false, false, true];
    match.out = [false, false, false, false];
    match.lost = [0, 1, 0, 3];
    match.handNo = 2;
    S.state = E.setup({
      rules: rulesNow(),
      hands: [
        ['HA', 'H10', 'S9'],
        ['CK', 'D9', 'C7'],
        ['SJ', 'HJ', 'DJ'],
        ['S7', 'C9', 'D10'],
      ],
      middle: ['HK', 'S8', 'CA'],
      talon: ['C8', 'H8', 'D7', 'SQ', 'HQ', 'SA', 'H9', 'C10'],
      turn: 0,
    });
    S.state.events.splice(0);
    render();
    logLine('<b>Horst:</b> Drei Leben. Wer absäuft, is selber schuld.', 'horst');
    logLine('<b>Lena:</b> Augen nur in einer Farbe. 31 und Feuer machen sofort Schluss.', 'lena');
    logLine('<b>Chantal:</b> Hömma, ich schwimm schon. Macht nich denselben Fehler.', 'chantal');
    say(1, 'Eine Karte. Die Mitte war mir zu freundlich.', { force: true });
    say(2, 'Deine Hand steht gut. Schau auf die Farbe.', { force: true });
    sys('Leben statt Geld. Eine tauschen, alle drei, schieben oder klopfen.');
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
  sys('Schwimmen am Küchentisch, auch 31 oder Schnauz. Nimm Platz, dann wird gegeben.');
  if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();

  window.__schwimmen = { get state() { return S.state; }, settings: settings, get seats() { return S.seats; }, E: E, AI: AI, get match() { return match; }, render: render };

  if (window.SpielpartnerRunde) SpielpartnerRunde.mount({
    game: 'schwimmen',
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
