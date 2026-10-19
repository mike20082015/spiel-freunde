/* Spiel-Freunde Rommé: Tisch, Auslage, Chat und Freisprechen. */
(function () {
  'use strict';
  const E = window.RommeEngine;
  const AI = window.RommeAI;
  const Talk = window.RommeTalk;
  const Voice = window.RommeVoice;
  const C = window.RommeCards;
  const Seats = window.RommeSeats;

  const SPEEDS = { slow: 1.45, normal: 1, fast: 0.35 };
  const LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  const KIND = {
    hand: 'Hand-Rommé',
    handLayoff: 'Rommé mit Anlegen',
    normal: 'Rommé',
    block: 'Keine gültige Karte mehr',
  };
  const DEFAULTS = {
    level: 'kneipe', target: '500', targetCustom: 500, endMode: 'target', rounds: 4,
    sound: true, volume: 80, talk: 'chat', handsFree: false, hints: false, speed: 'normal', deck: 'four',
    rules: Object.assign({}, E.DEFAULT_RULES),
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

  const settings = load('sf-romme-settings', DEFAULTS);
  settings.rules = E.normalizeRules(Object.assign({}, DEFAULTS.rules, settings.rules || {}));
  if (!LEVELS[settings.level]) settings.level = 'kneipe';
  if (params.get('speed')) settings.speed = params.get('speed');
  if (LEVELS[params.get('level')]) settings.level = params.get('level');
  const saveSettings = () => store('sf-romme-settings', settings);
  if (params.get('fresh')) { try { localStorage.removeItem('sf-romme-match'); } catch (e) { /* egal */ } }
  if (Voice) Voice.init({ getSettings: () => settings });

  let rng = params.get('seed') ? E.seededRng(+params.get('seed') || 1) : E.cryptoRng();
  let match = load('sf-romme-match', null);
  function blankMatch() {
    const dealer = params.get('dealer') != null ? ((+params.get('dealer') % 4) + 4) % 4 : 3;
    return { scores: [0, 0, 0, 0], dealer: dealer, handNo: 0, rows: [], winner: null };
  }
  if (!match || !match.scores || match.scores.length !== 4) match = blankMatch();
  match.rows = match.rows || [];
  function saveMatch() {
    store('sf-romme-match', {
      scores: match.scores, dealer: match.dealer, handNo: match.handNo,
      rows: match.rows.slice(-40), winner: match.winner,
    });
  }

  const S = {
    state: null, gen: 0, started: false, humanWait: null, nextWait: null,
    selected: [], meld: null, joker: null, pending: null,
    lastTalk: [0, 0, 0, 0], bubbleTimers: [], note: '', watch: params.get('watch') === '1',
  };

  function delay(ms) {
    const g = S.gen;
    return new Promise((res) => setTimeout(res, ms * (SPEEDS[settings.speed] || 1))).then(() => {
      if (g !== S.gen) throw CANCEL;
    });
  }
  const who = (seat) => Seats.seats[seat];
  const rulesNow = () => E.normalizeRules(settings.rules);
  const matchOpts = () => ({
    endMode: settings.endMode, target: settings.target, targetCustom: settings.targetCustom,
    rounds: settings.rounds, handsPlayed: match.handNo, scoring: settings.rules.scoring,
  });

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
    const show = () => { if (el) { el.textContent = text; el.classList.add('show'); } };
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
    if (settings.level === 'anfaenger' && ev === 'roundLose') ev = 'encourage';
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
      img.alt = '';
      img.addEventListener('error', () => img.remove());
      img.src = p.portrait;
      wrap.insertBefore(img, wrap.firstChild);
    });
    const face = await playerFace();
    if (!face) return;
    $('you-ini').textContent = face.initials || 'Du';
    if (!face.src) return;
    const img = document.createElement('img');
    img.alt = '';
    img.addEventListener('error', () => img.remove());
    img.src = face.src;
    $('you-ava').appendChild(img);
  }

  function emptyPile(label) {
    const el = document.createElement('div');
    el.className = 'pile-empty';
    el.textContent = label;
    return el;
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
      if (st && st.opened[s]) tags.push('draußen');
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
  function renderPiles() {
    const st = S.state;
    const stock = $('stock');
    const discard = $('discard');
    stock.innerHTML = '';
    if (!st || !st.stock.length) stock.appendChild(emptyPile('Talon'));
    else {
      stock.appendChild(C.backEl());
      const b = document.createElement('b');
      b.textContent = String(st.stock.length);
      stock.appendChild(b);
    }
    discard.innerHTML = '';
    if (!st || !st.discard.length) discard.appendChild(emptyPile('Ablage'));
    else {
      const top = E.topCard(st);
      const hidden = st.closing && st.closing.card === top && st.phase === 'done';
      discard.appendChild(hidden ? C.backEl() : C.cardEl(top));
    }
  }
  function renderMelds() {
    const el = $('melds');
    el.innerHTML = '';
    const st = S.state;
    if (!st || !st.melds.length) {
      el.innerHTML = '<p class="meld-empty">Noch keine Figur auf dem Tisch.</p>';
      return;
    }
    for (let seat = 0; seat < 4; seat++) {
      const list = st.melds.filter((m) => m.owner === seat);
      if (!list.length) continue;
      const h = document.createElement('h3');
      h.textContent = who(seat).name;
      el.appendChild(h);
      list.forEach((meld) => {
        const row = document.createElement('div');
        row.className = 'meld-row';
        const cards = document.createElement('div');
        cards.className = 'meld-cards';
        meld.slots.forEach((slot) => {
          const node = C.cardEl(slot.card, { tag: 'button' });
          if (slot.joker) node.title = 'steht für ' + E.SUIT_NAMES[slot.suit] + '-' + E.RANK_NAMES[slot.rank];
          if (S.joker && S.joker.card === slot.card) node.classList.add('pick');
          node.addEventListener('click', () => {
            S.meld = meld.id;
            S.joker = slot.joker ? { meldId: meld.id, card: slot.card } : null;
            renderMelds();
            renderActions();
          });
          cards.appendChild(node);
        });
        const meta = document.createElement('div');
        meta.className = 'meld-meta';
        const badge = document.createElement('span');
        badge.className = 'mbadge';
        badge.textContent = meld.points + ' · ' + (meld.kind === 'set' ? 'Satz' : 'Reihe');
        const note = document.createElement('span');
        note.className = 'meld-note';
        note.textContent = E.describeMeld(meld);
        meta.append(badge, note);
        row.append(cards, meta);
        el.appendChild(row);
      });
    }
  }
  function renderHand() {
    const el = $('hand');
    el.innerHTML = '';
    const st = S.state;
    if (!st) return;
    E.sortHand(st.hands[0]).forEach((card) => {
      const node = C.cardEl(card, { tag: 'button' });
      if (S.selected.indexOf(card) >= 0) node.classList.add('selected');
      if (st.mustUse === card) node.classList.add('fresh');
      node.addEventListener('click', () => {
        if (!st || st.turn !== 0 || st.phase === 'done') return;
        const at = S.selected.indexOf(card);
        if (at >= 0) S.selected.splice(at, 1);
        else S.selected.push(card);
        renderHand();
        renderActions();
      });
      el.appendChild(node);
    });
  }
  function setDisabled(id, disabled) {
    const btn = $(id);
    if (btn) btn.disabled = !!disabled;
  }
  function renderActions() {
    const st = S.state;
    const mine = !!(st && st.turn === 0 && st.phase !== 'done' && !S.watch);
    const draw = mine && st.phase === 'draw';
    const meld = mine && st.phase === 'meld';
    const n = S.selected.length;
    setDisabled('act-draw', !draw);
    setDisabled('act-take', !(draw && E.canTakeDiscard(st, 0)));
    setDisabled('act-lay', !(meld && n >= 3));
    setDisabled('act-layoff', !(meld && n >= 1 && S.meld && st.opened[0]));
    setDisabled('act-swap', !(meld && n === 1 && S.joker && st.opened[0] && st.rules.swapJokers));
    setDisabled('act-undo', !(meld && st.undo && st.undo.length > 1));
    setDisabled('act-discard', !(meld && n === 1));
    $('act-dissolve').hidden = !(st && st.rules.robber);
    setDisabled('act-dissolve', !(meld && S.meld && st.rules.robber));
    $('stock').disabled = !draw;
  }
  function renderStatus() {
    const st = S.state;
    const chips = $('st-chips');
    chips.innerHTML = '';
    const add = (text) => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.textContent = text;
      chips.appendChild(span);
    };
    if (!st) {
      $('st-main').textContent = 'Nimm Platz, dann wird gegeben.';
      return;
    }
    add('Geber ' + who(st.dealer).name);
    add(st.rules.jokers + ' Joker');
    add('ab ' + st.rules.initial);
    if (st.turn === 0 && st.phase === 'draw') $('st-main').textContent = 'Du bist dran. Zieh vom Talon oder nimm die Ablage.';
    else if (st.turn === 0 && st.phase === 'meld' && !st.opened[0]) {
      $('st-main').textContent = 'Erstmeldung ' + E.pendingPoints(st) + ' von ' + st.rules.initial + ' Augen. Eine Karte wirfst du am Ende ab.';
    } else if (st.turn === 0 && st.phase === 'meld') $('st-main').textContent = 'Du bist draußen. Anlegen, tauschen oder abwerfen.';
    else if (st.phase === 'done') $('st-main').textContent = 'Die Runde ist ausgezählt.';
    else $('st-main').innerHTML = '<em>' + esc(who(st.turn).name) + '</em> ist am Zug.';
    if (S.note) add(S.note);
  }
  function renderHint() {
    const box = $('hint-box');
    const st = S.state;
    if (!settings.hints || !st || st.turn !== 0 || st.phase === 'done') { box.hidden = true; return; }
    box.hidden = false;
    if (st.phase === 'draw') box.textContent = 'Zieh vom verdeckten Talon. Die Ablage darfst du nur nehmen, wenn du die Karte sofort auslegst oder anlegst. Mit einer letzten Karte nur vom Talon.';
    else if (!st.opened[0]) box.textContent = 'Ein Satz: gleicher Wert, verschiedene Farben. Eine Reihe: dieselbe Farbe, lückenlos. Das Ass zählt vor der 2 nur einen Punkt, sonst 11. Unter ' + st.rules.initial + ' Augen kommen die Karten zurück, außer du wirst in diesem Zug alle los.';
    else box.textContent = 'Anlegen geht an jede Figur. Einen Joker tauschst du gegen die Karte, für die er steht, und legst ihn im selben Zug wieder aus.';
  }
  function renderScore() {
    const scoring = settings.rules.scoring === 'tournament';
    const goal = settings.endMode === 'rounds' ? E.normalizeRounds(settings.rounds) + ' Runden' : String(E.normalizeTarget(settings.target, settings.targetCustom));
    $('mode-badge').textContent = (scoring ? 'Turnier ' : '') + goal;
    const names = Seats.seats.map((p) => p.name);
    const best = scoring ? Math.max.apply(null, match.scores) : Math.min.apply(null, match.scores);
    let html = '<thead><tr><th>Runde</th>' + names.map((n) => '<th>' + esc(n) + '</th>').join('') + '</tr></thead><tbody>';
    match.rows.slice(-8).forEach((row) => {
      html += '<tr><td>' + row.n + '</td>' + row.delta.map((n) => '<td>' + n + '</td>').join('') + '</tr>';
    });
    html += '</tbody><tfoot><tr><td>Stand</td>' + match.scores.map((n) => '<td class="' + (n === best ? 'pos' : '') + '">' + n + '</td>').join('') + '</tr></tfoot>';
    $('score-table').innerHTML = html;
    const info = $('target-info');
    const cap = settings.endMode === 'rounds' ? E.normalizeRounds(settings.rounds) : E.normalizeTarget(settings.target, settings.targetCustom);
    let bars = '<div class="ti-head"><span>' + (settings.endMode === 'rounds' ? 'Gespielt' : (scoring ? 'Turnierpunkte' : 'Schlechtpunkte')) + '</span><b>' + (settings.endMode === 'rounds' ? match.handNo + ' / ' + cap : 'bis ' + cap) + '</b></div>';
    match.scores.forEach((n, i) => {
      const width = settings.endMode === 'rounds' ? 0 : Math.max(4, Math.min(100, Math.round((n / cap) * 100)));
      bars += '<div class="ti-row' + (n === best ? ' lead' : '') + '"><span class="ti-name">' + esc(names[i]) + '</span><span class="ti-bar"><i style="width:' + width + '%"></i></span><span class="ti-val">' + n + '</span></div>';
    });
    info.innerHTML = bars;
  }
  function render() {
    document.body.classList.toggle('deck-two', settings.deck === 'two');
    renderSeats();
    renderPiles();
    renderMelds();
    renderHand();
    renderActions();
    renderStatus();
    renderHint();
    renderScore();
  }
  function note(text) {
    S.note = text || '';
    const box = $('hint-box');
    if (text) {
      box.hidden = false;
      box.textContent = text;
      box.classList.remove('shake');
      void box.offsetWidth;
      box.classList.add('shake');
    }
    renderStatus();
  }
  function mineDone() {
    const st = S.state;
    return !st || st.phase === 'done' || st.turn !== 0;
  }
  function releaseHuman() {
    if (mineDone() && S.humanWait) {
      const go = S.humanWait;
      S.humanWait = null;
      go();
    }
  }
  function afterHuman(res) {
    if (!res || !res.ok) {
      note(res && res.reason ? res.reason : 'Das geht so nicht.');
      render();
      return;
    }
    S.note = '';
    S.selected = S.selected.filter((card) => S.state.hands[0].indexOf(card) >= 0);
    if (res.out || mineDone()) {
      S.selected = [];
      S.meld = null;
      S.joker = null;
    }
    render();
    releaseHuman();
  }

  function askEnd(cards) {
    S.pending = cards.slice();
    $('end-text').textContent = 'Der Joker kann die Reihe nach unten oder nach oben verlängern.';
    $('modal-end').hidden = false;
  }
  function commitLay(prefer) {
    const cards = (S.pending || S.selected).slice();
    S.pending = null;
    $('modal-end').hidden = true;
    const opts = prefer ? { prefer: prefer } : null;
    afterHuman(E.lay(S.state, 0, cards, opts));
  }
  function onAction(act) {
    const st = S.state;
    if (!st || st.turn !== 0 || st.phase === 'done') return;
    if (act === 'draw') return afterHuman(E.drawStock(st, 0));
    if (act === 'take') return afterHuman(E.drawDiscard(st, 0));
    if (act === 'undo') return afterHuman(E.undo(st, 0));
    if (act === 'discard') return afterHuman(E.discard(st, 0, S.selected[0]));
    if (act === 'layoff') return afterHuman(E.layoff(st, 0, S.meld, S.selected.slice()));
    if (act === 'swap') return afterHuman(E.swapJoker(st, 0, S.joker.meldId, S.joker.card, S.selected[0]));
    if (act === 'dissolve') return afterHuman(E.dissolve(st, 0, S.meld));
    if (act === 'lay') {
      const cards = S.selected.slice();
      const found = E.arrangements(cards, st.rules).filter((m) => m.kind === 'run');
      const low = found.some((m) => m.slots[0].joker);
      const high = found.some((m) => m.slots[m.slots.length - 1].joker);
      if (low && high) return askEnd(cards);
      return afterHuman(E.lay(st, 0, cards));
    }
  }

  function narrate(seat, steps) {
    if (!steps || !steps.length) return;
    const ops = steps.map((s) => s.op);
    if (steps.some((s) => s.out)) {
      const kind = S.state.result && S.state.result.kind;
      talk(seat, kind === 'hand' || kind === 'handLayoff' ? 'handRomme' : 'goOut', 1, true);
    } else if (ops.indexOf('lay') >= 0) talk(seat, 'meld', 0.75);
    else if (ops.indexOf('layoff') >= 0) talk(seat, 'layoff', 0.4);
    else if (ops.indexOf('take') >= 0) talk(seat, 'take', 0.55);
    else if (ops.indexOf('draw') >= 0) talk(seat, 'draw', 0.28);
    else if (ops.indexOf('blocked') >= 0) talk(seat, 'thinking', 0.5);
  }

  function waitHuman() {
    render();
    return new Promise((res) => { S.humanWait = res; });
  }
  async function playHand() {
    while (S.state && S.state.phase !== 'done') {
      if (S.state.turn === 0 && !S.watch) {
        await waitHuman();
        continue;
      }
      await delay(S.watch ? 40 : 720);
      const seat = S.state.turn;
      if (!S.watch && Math.random() < 0.1) talk(seat, 'thinking', 1);
      const steps = AI.playTurn(S.state, seat, settings.level);
      narrate(seat, steps);
      render();
    }
  }

  function showSummary(result) {
    const names = Seats.seats.map((p) => p.name);
    const winner = result.winner;
    const title = winner == null ? 'Unentschieden' : names[winner] + ' macht Rommé';
    const quote = winner == null ? '' : (Talk.line(who(winner).id === 'du' ? 'margarethe' : who(winner).id, winner === 0 ? 'roundLose' : 'roundWin') || '');
    let rows = '';
    result.rows.forEach((row) => {
      const extra = result.delta[row.seat];
      rows += '<tr><td>' + esc(names[row.seat]) + '</td><td>' + row.eyes + '</td><td>' + extra + '</td><td>' + match.scores[row.seat] + '</td></tr>';
    });
    $('summary').innerHTML =
      '<p class="sum-kicker">Abrechnung</p><h3 class="sum-title ' + (winner === 0 ? 'won' : 'lost') + '">' + esc(title) + '</h3>' +
      '<p>' + esc(KIND[result.kind] || 'Rommé') + (result.multiplier > 1 ? ', Schlechtpunkte doppelt' : '') + '.</p>' +
      (quote ? '<p class="sum-quote">' + esc(quote) + '</p>' : '') +
      '<table class="sum-table"><thead><tr><th></th><th>Augen</th><th>Diese Runde</th><th>Stand</th></tr></thead><tbody>' +
      rows + '</tbody></table>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-next">Weiter</button></div>';
    $('modal-summary').hidden = false;
    $('btn-next').addEventListener('click', () => {
      if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
      $('modal-summary').hidden = true;
      if (S.nextWait) { const go = S.nextWait; S.nextWait = null; go(); }
    });
  }
  function showCeremony(winner) {
    const names = Seats.seats.map((p) => p.name);
    const order = [0, 1, 2, 3].sort((a, b) => settings.rules.scoring === 'tournament' ? match.scores[b] - match.scores[a] : match.scores[a] - match.scores[b]);
    const mine = order[0] === 0;
    const line = Talk.line(mine ? 'margarethe' : who(order[0]).id, mine ? 'sessionHuman' : 'sessionSelf');
    let list = '';
    order.forEach((seat, i) => {
      list += '<li class="' + (i === 0 ? 'first' : '') + '"><span>' + (i + 1) + '</span><span>' + esc(names[seat]) + '</span><b>' + match.scores[seat] + '</b></li>';
    });
    $('session').innerHTML =
      '<p class="intro-kicker">' + (settings.endMode === 'rounds' ? 'Runden' : 'Ziel') + '</p>' +
      '<h3 class="session-title">' + esc(names[order[0]]) + ' gewinnt den Abend</h3>' +
      (line ? '<p class="sum-quote">' + esc(line) + '</p>' : '') +
      '<ul class="standings">' + list + '</ul>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-again">Noch einen Abend</button></div>';
    $('modal-session').hidden = false;
    if (order[0] !== 0) talk(order[0], 'sessionSelf', 1, true);
    else { talk(2, 'sessionHuman', 1, true); talk(3, 'encourage', 1, true); }
    $('btn-again').addEventListener('click', () => {
      if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
      $('modal-session').hidden = true;
      match.scores = [0, 0, 0, 0];
      match.rows = [];
      match.handNo = 0;
      match.winner = null;
      saveMatch();
      dealAndPlay();
    });
  }

  function dealAndPlay() {
    if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
    S.gen += 1;
    const gen = S.gen;
    S.selected = [];
    S.meld = null;
    S.joker = null;
    S.note = '';
    S.humanWait = null;
    S.state = E.newGame({
      rules: rulesNow(), rng: rng, dealer: match.dealer, scores: match.scores.slice(),
    });
    render();
    talk(2, 'gameStart', 1, true);
    talk(3, 'gameStart', 0.7);
    runLoop(gen);
  }
  async function runLoop(gen) {
    try {
      await playHand();
      if (gen !== S.gen) return;
      const st = S.state;
      if (!st || st.phase !== 'done' || !st.result) { render(); return; }
      const result = st.result;
      match.handNo += 1;
      for (let i = 0; i < 4; i++) match.scores[i] += result.delta[i];
      match.rows.push({ n: match.handNo, delta: result.delta.slice(), kind: result.kind });
      match.dealer = (match.dealer + 1) % 4;
      saveMatch();
      renderScore();
      if (window.SpielpartnerRounds) SpielpartnerRounds.finish();
      if (result.winner === 0) { talk(2, 'roundWin', 0.8); talk(1, 'roundLose', 0.6); }
      else if (result.winner != null) { talk(result.winner, 'roundWin', 1, true); talk(0, 'encourage', 0); }
      const winner = E.matchWinner(match.scores, matchOpts());
      showSummary(result);
      await new Promise((res) => { S.nextWait = res; });
      if (gen !== S.gen) return;
      if (winner != null) {
        match.winner = winner;
        saveMatch();
        showCeremony(winner);
        return;
      }
      dealAndPlay();
    } catch (e) {
      if (e === CANCEL) return;
      sys('Die Runde stockt. Nimm noch einmal Platz.');
    }
  }

  function syncSettingsForm() {
    const check = (name, value) => {
      document.querySelectorAll('input[name="' + name + '"]').forEach((el) => { el.checked = String(el.value) === String(value); });
    };
    check('level', settings.level);
    check('target', settings.target);
    check('endMode', settings.endMode || 'target');
    check('jokers', settings.rules.jokers);
    check('initial', settings.rules.initial);
    check('jokerLayout', settings.rules.jokerLayout);
    check('scoring', settings.rules.scoring);
    check('talk', settings.talk);
    check('deck', settings.deck);
    check('speed', settings.speed);
    $('target-custom').value = settings.targetCustom;
    $('opt-rounds').value = settings.rounds || 4;
    $('opt-corner').checked = !!settings.rules.corner;
    $('opt-swap').checked = settings.rules.swapJokers !== false;
    $('opt-fullset').checked = !!settings.rules.fullSetToSwap;
    $('opt-use').checked = settings.rules.discardMustUse !== false;
    $('opt-cut').checked = settings.rules.keepCutJoker !== false;
    $('opt-last').checked = settings.rules.noLastFromDiscard !== false;
    $('opt-jokerlast').checked = settings.rules.jokerDiscardLastOnly !== false;
    $('opt-double').checked = settings.rules.handRommeDouble !== false;
    $('opt-robber').checked = !!settings.rules.robber;
    $('opt-sound').checked = !!settings.sound;
    $('opt-volume').value = settings.volume;
    $('opt-volume-out').textContent = settings.volume;
    $('opt-handsfree').checked = !!settings.handsFree;
    syncHandsFree();
  }
  function readSettingsForm() {
    const val = (name) => { const el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; };
    settings.level = val('level') || settings.level;
    settings.target = val('target') || settings.target;
    settings.targetCustom = +$('target-custom').value || settings.targetCustom;
    settings.endMode = val('endMode') === 'rounds' ? 'rounds' : 'target';
    settings.rounds = +$('opt-rounds').value || 4;
    settings.rules.jokers = val('jokers') === '4' ? 4 : 6;
    settings.rules.initial = Number(val('initial')) || 40;
    settings.rules.jokerLayout = val('jokerLayout') === 'strict' ? 'strict' : 'house';
    settings.rules.scoring = val('scoring') === 'tournament' ? 'tournament' : 'penalty';
    settings.rules.corner = $('opt-corner').checked;
    settings.rules.swapJokers = $('opt-swap').checked;
    settings.rules.fullSetToSwap = $('opt-fullset').checked;
    settings.rules.discardMustUse = $('opt-use').checked;
    settings.rules.keepCutJoker = $('opt-cut').checked;
    settings.rules.noLastFromDiscard = $('opt-last').checked;
    settings.rules.jokerDiscardLastOnly = $('opt-jokerlast').checked;
    settings.rules.handRommeDouble = $('opt-double').checked;
    settings.rules.robber = $('opt-robber').checked;
    settings.rules = E.normalizeRules(settings.rules);
    settings.sound = $('opt-sound').checked;
    settings.volume = +$('opt-volume').value;
    settings.talk = val('talk') || 'chat';
    settings.handsFree = $('opt-handsfree').checked;
    settings.deck = val('deck') || 'four';
    settings.speed = val('speed') || 'normal';
    saveSettings();
    if (!settings.sound && Voice) Voice.stopAll();
    if (Voice) Voice.setVolume();
    renderTop();
    render();
    applyTalk(false);
  }
  function renderTop() {
    $('level-label').textContent = LEVELS[settings.level] || 'Kneipe';
    $('btn-level').dataset.level = settings.level;
    $('btn-sound').setAttribute('aria-pressed', String(!!settings.sound));
    $('btn-sound').classList.toggle('off', !settings.sound);
    $('btn-talk').setAttribute('aria-pressed', String(settings.talk === 'voice'));
    $('btn-hint').setAttribute('aria-pressed', String(!!settings.hints));
    const goal = settings.endMode === 'rounds' ? E.normalizeRounds(settings.rounds) + ' Runden' : E.normalizeTarget(settings.target, settings.targetCustom) + ' Punkte';
    $('intro-small').textContent = 'Spielstärke ' + (LEVELS[settings.level] || '') + ' · ' + goal + ' · Ton ' + (settings.sound ? 'an' : 'aus');
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
    MIC.spoken = MIC.spoken.filter((l) => Date.now() - l.at < 15000).slice(-8);
  }
  function isEcho(text) {
    const a = normSpeech(text);
    if (!a) return false;
    return MIC.spoken.some((line) => line.norm === a || (a.length >= 10 && line.norm.indexOf(a) >= 0) || (line.norm.length >= 10 && a.indexOf(line.norm) >= 0));
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
    say(0, message, { force: true });
    rememberSpoken(message);
    const people = Talk.responders(message, Math.random);
    const game = S.state ? E.publicSummary(S.state) : { phase: 'play', game: 'Rommé. Noch keine Karten.' };
    for (let i = 0; i < people.length; i++) {
      const person = Seats.seats.find((p) => p.id === people[i]);
      if (!person) continue;
      const typing = showTyping(person.name);
      let reply = '';
      try { reply = await Talk.askAI(person.id, { message: message, game: game }); }
      catch (e) { reply = Talk.cannedReply(person.id, message); }
      if (person.id === 'oma-hilde') await new Promise((res) => setTimeout(res, 280));
      typing.remove();
      say(person.seat, reply, { force: true, priority: true });
    }
  }

  function openModal(id) { $(id).hidden = false; if (id === 'modal-settings') syncSettingsForm(); }
  function closeModal(node) {
    const modal = node.closest('.modal');
    if (!modal || modal.id === 'modal-end') return;
    if (modal.id === 'modal-settings') readSettingsForm();
    modal.hidden = true;
  }

  $('actions').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.act) onAction(btn.dataset.act);
  });
  $('stock').addEventListener('click', () => onAction('draw'));
  $('discard').addEventListener('click', () => onAction('take'));
  $('btn-start').addEventListener('click', start);
  $('btn-settings').addEventListener('click', () => openModal('modal-settings'));
  $('btn-level').addEventListener('click', () => openModal('modal-settings'));
  $('btn-hint').addEventListener('click', () => {
    settings.hints = !settings.hints;
    saveSettings();
    renderTop();
    renderHint();
  });
  $('btn-sound').addEventListener('click', () => {
    settings.sound = !settings.sound;
    saveSettings();
    if (!settings.sound && Voice) Voice.stopAll();
    if (settings.sound && Voice) Voice.unlock();
    renderTop();
    sys(settings.sound ? 'Ton an. Horst und Margarethe sprechen, Oma Hilde bleibt bei der Blase.' : 'Ton aus. Alle bleiben bei der Sprechblase.');
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
    match = blankMatch();
    match.dealer = 3;
    saveMatch();
    renderScore();
    sys('Die Punkteliste ist leer. Die laufende Runde zählt noch mit dem alten Stand.');
  });
  $('opt-volume').addEventListener('input', () => { $('opt-volume-out').textContent = $('opt-volume').value; });
  $('modal-settings').addEventListener('change', () => {
    const talkMode = document.querySelector('input[name="talk"]:checked');
    if (talkMode) settings.talk = talkMode.value;
    settings.handsFree = $('opt-handsfree').checked;
    syncHandsFree();
  });
  $('end-low').addEventListener('click', () => commitLay('low'));
  $('end-high').addEventListener('click', () => commitLay('high'));
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
  $('btn-mic').addEventListener('pointerup', () => {
    if (settings.handsFree) return;
    if (Date.now() - MIC.downAt > 400) stopMic();
  });
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
    sys('Rommé am Küchentisch. Horst links, Margarethe gegenüber, Oma Hilde rechts.');
    dealAndPlay();
  }

  mountPortraits();
  renderTop();
  renderScore();
  applyTalk(false);
  sys('Rommé am Küchentisch. Nimm Platz, dann wird gegeben.');
  if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();
  window.__romme = { get state() { return S.state; }, settings: settings, seats: Seats, E: E, AI: AI };
  if (params.get('autostart') === '1') start();
})();
