/* Spiel-Freunde Canasta: Tisch, Runden und Mitreden. */
(function () {
  'use strict';
  const E = window.CanastaEngine;
  const AI = window.CanastaAI;
  const Talk = window.CanastaTalk;
  const Voice = window.CanastaVoice;
  const C = window.CanastaCards;
  const Seats = window.CanastaSeats;

  const SPEEDS = { slow: 1.55, normal: 1, fast: 0.28 };
  const LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  const DEFAULTS = {
    level: 'kneipe', target: '5000', targetCustom: 5000, sound: true, volume: 80,
    talk: 'chat', handsFree: false, hints: false, speed: 'normal', deck: 'four',
    rules: {
      pileTake: 'frozen', minMeld: 'byScore', canastasToGoOut: 1, redThrees: 'classic',
      wildMajority: false, concealedBonus: 200, askPartner: true, noCanastaPickup: false,
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

  const settings = load('sf-canasta-settings', DEFAULTS);
  settings.rules = Object.assign({}, DEFAULTS.rules, settings.rules || {});
  if (!LEVELS[settings.level]) settings.level = 'kneipe';
  if (params.get('speed')) settings.speed = params.get('speed');
  if (LEVELS[params.get('level')]) settings.level = params.get('level');
  const saveSettings = () => store('sf-canasta-settings', settings);
  if (params.get('fresh')) { try { localStorage.removeItem('sf-canasta-match'); } catch (e) { /* egal */ } }
  if (Voice) Voice.init({ getSettings: () => settings });

  let rng = params.get('seed') ? E.seededRng(+params.get('seed') || 1) : E.cryptoRng();
  let match = load('sf-canasta-match', { scores: [0, 0], dealer: 3, handNo: 0, rows: [] });
  if (!match.scores) match = { scores: [0, 0], dealer: 3, handNo: 0, rows: [] };
  match.rows = match.rows || [];
  function saveMatch() {
    store('sf-canasta-match', { scores: match.scores, dealer: match.dealer, handNo: match.handNo, rows: match.rows.slice(-80) });
  }

  const S = {
    state: null, gen: 0, selected: [], fresh: null, error: null, busy: false,
    humanWait: null, askWait: null, nextWait: null, started: false,
    lastTalk: [0, 0, 0, 0], bubbleTimers: [], watchSteps: 0, settled: false,
    watch: params.get('watch') === '1' || params.get('demo') === '1',
  };

  function delay(ms) {
    const g = S.gen;
    return new Promise((res) => setTimeout(res, ms * (SPEEDS[settings.speed] || 1))).then(() => {
      if (g !== S.gen) throw CANCEL;
    });
  }
  const targetValue = () => E.normalizeTarget(settings.target, settings.targetCustom);
  const seatById = (id) => Seats.seats.find((p) => p.id === id);

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
    p.setAttribute('aria-label', name + ' schreibt');
    p.innerHTML = '<b>' + esc(name) + ':</b><span class="typing-label"> schreibt</span><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>';
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  function say(seat, text, opts) {
    opts = opts || {};
    if (!text) return false;
    const who = Seats.seats[seat];
    if (!who) return false;
    const now = Date.now();
    if (!opts.force && now - S.lastTalk[seat] < 2200) return false;
    S.lastTalk[seat] = now;
    if (seat !== 0) logLine('<b>' + esc(who.name) + ':</b> ' + esc(text), who.id);
    const el = $('bubble-' + seat);
    const node = $('seat-' + seat);
    const show = () => {
      if (!el) return;
      el.textContent = text;
      el.classList.add('show');
      clearTimeout(S.bubbleTimers[seat]);
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
    const who = Seats.seats[seat];
    if (!who || who.id === 'du') return false;
    let ev = event;
    if (settings.level === 'anfaenger' && ev === 'roundLose') ev = 'encourage';
    return say(seat, Talk.line(who.id, ev), { force: force });
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
      const ini = wrap.querySelector('.ini');
      ini.textContent = p.initials;
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

  function renderBacks(seat) {
    const el = $('backs-' + seat);
    if (!el || !S.state) return;
    const n = Math.min(S.state.hands[seat].length, 11);
    el.innerHTML = '';
    el.style.setProperty('--cw', seat === 2 ? '26px' : '22px');
    for (let i = 0; i < n; i++) el.appendChild(C.backEl());
  }
  function renderSeats() {
    const st = S.state;
    for (let s = 0; s < 4; s++) {
      const node = $('seat-' + s);
      if (node) node.classList.toggle('active', !!(st && ((st.phase === 'ask' ? E.partnerSeat(st.asker) : st.turn) === s) && st.phase !== 'done'));
      const role = $('role-' + s);
      if (!role) continue;
      role.innerHTML = '';
      const tags = [];
      if (s === 2) tags.push('Partner');
      if (s === 1 || s === 3) tags.push('Gegner');
      if (st && st.dealer === s) tags.push('Geber');
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
  function renderMelds() {
    const st = S.state;
    [0, 1].forEach((team) => {
      const el = $('melds-' + team);
      el.innerHTML = '';
      const h = document.createElement('h3');
      h.textContent = team === 0 ? 'Wir' : 'Horst & Oma Hilde';
      el.appendChild(h);
      const reds = st.reds[team];
      if (reds.length) {
        const chip = document.createElement('div');
        chip.className = 'reds';
        chip.textContent = 'Rote Dreien · ' + reds.length;
        el.appendChild(chip);
      }
      if (!st.melds[team].length) {
        const empty = document.createElement('p');
        empty.className = 'meld-empty';
        empty.textContent = 'noch nichts ausgelegt';
        el.appendChild(empty);
        return;
      }
      st.melds[team].forEach((m) => {
        const row = document.createElement('div');
        row.className = 'meld-row';
        const wild = m.cards.some(E.isWild);
        const canasta = !m.black && m.cards.length >= 7;
        const badge = document.createElement('span');
        badge.className = 'mbadge' + (canasta ? (wild ? ' mixed' : ' pure') : '');
        badge.textContent = m.black ? 'schwarz' : (canasta ? (wild ? 'gemischt ' : 'rein ') + m.cards.length : (E.RANK_NAMES[m.rank] || m.rank));
        row.appendChild(badge);
        const cards = document.createElement('div');
        cards.className = 'meld-cards';
        m.cards.forEach((c) => cards.appendChild(C.cardEl(c)));
        row.appendChild(cards);
        el.appendChild(row);
      });
    });
  }
  function renderPiles() {
    const st = S.state;
    const stock = $('stock');
    stock.innerHTML = '';
    if (st.stock.length) stock.appendChild(C.backEl());
    else {
      const empty = document.createElement('div');
      empty.className = 'pile-empty';
      empty.textContent = 'leer';
      stock.appendChild(empty);
    }
    const sn = document.createElement('b');
    sn.textContent = 'Talon ' + st.stock.length;
    stock.appendChild(sn);
    const disc = $('discard');
    disc.innerHTML = '';
    disc.classList.toggle('frozen', !!st.frozen);
    if (!st.discard.length) {
      const empty = document.createElement('div');
      empty.className = 'pile-empty';
      empty.textContent = 'Ablage';
      disc.appendChild(empty);
    } else {
      st.discard.slice(-3).forEach((c, i, arr) => {
        const el = C.cardEl(c);
        if (i < arr.length - 1) el.classList.add('under');
        disc.appendChild(el);
      });
      const dn = document.createElement('b');
      dn.textContent = st.discard.length + (st.frozen ? ' · eingefroren' : '');
      disc.appendChild(dn);
    }
  }
  function renderHand() {
    const st = S.state;
    const hand = $('hand');
    hand.innerHTML = '';
    const mine = st.turn === 0 && st.phase !== 'done' && st.phase !== 'ask';
    let sug = null;
    if (settings.hints && st.phase === 'meld' && st.turn === 0) {
      try { sug = AI.chooseDiscard(E.viewFor(st, 0), settings.level, Math.random); } catch (e) { sug = null; }
    }
    st.hands[0].forEach((card) => {
      const cls = ['playable'];
      if (S.selected.indexOf(card) >= 0) cls.push('selected');
      if (card === S.fresh) cls.push('fresh');
      if (sug && card === sug) cls.push('suggest');
      const el = C.cardEl(card, { tag: 'button', cls: cls.join(' ') });
      el.disabled = !mine;
      el.addEventListener('click', () => {
        if (!mine) return;
        const i = S.selected.indexOf(card);
        if (i >= 0) S.selected.splice(i, 1);
        else S.selected.push(card);
        renderHand();
      });
      hand.appendChild(el);
    });
  }
  function renderActions() {
    const st = S.state;
    const mine = !!(st && st.turn === 0 && st.phase !== 'done' && !S.watch && S.humanWait);
    const draw = st && st.phase === 'draw' && mine;
    const meld = st && st.phase === 'meld' && mine;
    const set = (id, on) => { const b = $(id); if (b) b.disabled = !on; };
    set('act-draw', draw && st.stock.length > 0 && !st.forcedTake);
    set('act-take', draw);
    set('act-meld', meld);
    set('act-lay', meld);
    set('act-discard', meld && !st.mustGoOut);
    set('act-out', meld || (draw && st.mustGoOut));
    set('act-ask', meld && st.rules.askPartner && !st.meldedThisTurn && !st.asked);
    const end = $('act-end');
    end.hidden = !(st && st.mayEnd && st.phase === 'draw');
    end.disabled = !(draw && st.mayEnd);
    $('stock').disabled = !draw || !st.stock.length || st.forcedTake;
    $('act-ask').hidden = !(st && st.rules.askPartner);
  }
  function renderStatus() {
    const st = S.state;
    if (!st) return;
    const who = Seats.seats[st.phase === 'ask' ? E.partnerSeat(st.asker) : st.turn];
    let text = 'Die Runde läuft.';
    if (st.phase === 'done') text = 'Die Runde ist ausgezählt.';
    else if (st.phase === 'ask') text = who.name + ' soll sagen, ob ausgemacht wird.';
    else if (st.turn === 0) text = st.phase === 'draw'
      ? (st.forcedTake ? 'Der Talon ist leer. Die Ablage musst du nehmen.' : (st.mayEnd ? 'Der Talon ist leer. Nimm die Ablage oder beende die Runde.' : 'Du bist dran. Zieh vom Talon oder nimm die Ablage.'))
      : (st.mustGoOut ? 'Du hast ausmachen gesagt. Mach die Hand fertig.' : 'Du bist dran. Melde, leg an oder wirf ab.');
    else text = who.name + ' ist dran.';
    $('st-main').textContent = text;
    const chips = $('st-chips');
    chips.innerHTML = '';
    const add = (label, cls) => {
      const s = document.createElement('span');
      s.className = 'chip' + (cls ? ' ' + cls : '');
      s.innerHTML = label;
      chips.appendChild(s);
    };
    const need = E.minMeldFor(st.scoresBefore[0], st.rules);
    if (!st.minMet[0]) add('Erste Meldung <b>' + need + '</b>');
    add('Canastas <b>' + E.canastaCount(st, 0) + '</b> : <b>' + E.canastaCount(st, 1) + '</b>');
    if (st.frozen || st.rules.pileTake === 'always') add(st.rules.pileTake === 'always' ? 'immer zwei Natürliche' : 'eingefroren', 'frozen');
    if (st.rules.canastasToGoOut === 2) add('zwei Canastas zum Ausmachen');
  }
  function renderHint() {
    const box = $('hint-box');
    if (S.error) {
      box.hidden = false;
      box.textContent = S.error;
      return;
    }
    if (!settings.hints || !S.state || S.state.turn !== 0 || S.state.phase === 'done') { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<b>Tipp.</b> ' + esc(AI.suggest(S.state, 0));
  }
  function renderScore() {
    const target = targetValue();
    $('mode-badge').textContent = 'bis ' + target;
    const info = $('target-info');
    const lead = match.scores[0] === match.scores[1] ? -1 : (match.scores[0] > match.scores[1] ? 0 : 1);
    info.innerHTML = '<div class="ti-head"><span>Ziel</span><b>' + target + '</b></div>' +
      [0, 1].map((t) => {
        const pct = Math.max(0, Math.min(100, Math.round(match.scores[t] / target * 100)));
        return '<div class="ti-row' + (lead === t ? ' lead' : '') + '"><span class="ti-name">' + (t === 0 ? 'Wir' : 'Gegner') + '</span><span class="ti-bar"><i style="width:' + pct + '%"></i></span><span class="ti-val">' + match.scores[t] + '</span></div>';
      }).join('');
    const table = $('score-table');
    let html = '<thead><tr><th>#</th><th>Wir</th><th>Gegner</th></tr></thead><tbody>';
    if (!match.rows.length) html += '<tr><td colspan="3">Noch keine Runde.</td></tr>';
    match.rows.slice(-12).forEach((row) => {
      html += '<tr><td>' + row.n + '</td><td class="' + (row.us >= 0 ? 'pos' : 'neg') + '">' + row.us + '</td><td class="' + (row.them >= 0 ? 'pos' : 'neg') + '">' + row.them + '</td></tr>';
    });
    html += '</tbody><tfoot><tr><td>Stand</td><td>' + match.scores[0] + '</td><td>' + match.scores[1] + '</td></tr></tfoot>';
    table.innerHTML = html;
  }
  function render() {
    if (!S.state) return;
    renderSeats();
    renderMelds();
    renderPiles();
    renderHand();
    renderActions();
    renderStatus();
    renderHint();
    renderScore();
    document.body.classList.toggle('deck-two', settings.deck === 'two');
  }

  function releaseHuman() {
    if (!S.humanWait) return;
    const go = S.humanWait;
    S.humanWait = null;
    go();
  }
  function waitHuman() {
    return new Promise((res) => { S.humanWait = res; renderActions(); });
  }
  function noteHuman(res) {
    if (!res || !res.ok) {
      S.error = (res && res.reason) || 'Das geht so nicht.';
      const box = $('hint-box');
      box.classList.remove('shake');
      renderHint();
      void box.offsetWidth;
      box.classList.add('shake');
      return;
    }
    S.error = null;
    S.selected = [];
    if (res.card) S.fresh = res.card;
    else S.fresh = null;
    render();
    if (!S.state || S.state.phase === 'done' || S.state.turn !== 0 || S.state.phase === 'ask') releaseHuman();
  }
  function onAction(kind) {
    const st = S.state;
    if (!st || S.busy || !S.humanWait || S.watch) return;
    if (st.turn !== 0 || st.phase === 'done' || st.phase === 'ask') return;
    S.busy = true;
    try {
      if (kind === 'draw') noteHuman(E.drawStock(st, 0));
      else if (kind === 'take') {
        const parsed = E.parseTake(st, 0, S.selected.slice());
        if (!parsed.ok) { noteHuman(parsed); return; }
        noteHuman(E.takePile(st, 0, parsed.handCards, parsed.extraGroups));
      } else if (kind === 'meld') {
        const parsed = E.parseMeld(S.selected.slice());
        if (!parsed.ok) { noteHuman(parsed); return; }
        noteHuman(E.meld(st, 0, parsed.groups));
      } else if (kind === 'lay') {
        const sel = S.selected.slice();
        const natural = sel.find((c) => E.isNatural(c));
        if (!natural) { noteHuman({ ok: false, reason: 'Wähl natürliche Karten für einen Rang.' }); return; }
        const rank = E.rankOf(natural);
        if (sel.some((c) => E.isNatural(c) && E.rankOf(c) !== rank)) {
          noteHuman({ ok: false, reason: 'Anlegen geht nur an einen Rang.' });
          return;
        }
        noteHuman(E.layoff(st, 0, sel, rank));
      } else if (kind === 'discard') {
        if (S.selected.length !== 1) { noteHuman({ ok: false, reason: 'Wähl genau eine Karte zum Abwerfen.' }); return; }
        noteHuman(E.discard(st, 0, S.selected[0]));
      } else if (kind === 'out') {
        const plan = E.planGoOut(st, 0);
        if (!plan) { noteHuman({ ok: false, reason: 'So kannst du noch nicht ausmachen.' }); return; }
        noteHuman(E.goOut(st, 0, plan));
      } else if (kind === 'ask') {
        const asked = E.askPartner(st, 0);
        if (!asked.ok) { noteHuman(asked); return; }
        S.error = null;
        render();
        const before = S.watchSteps;
        const out = AI.step(st, settings.level, rng);
        narrate(2, out.action, out.res);
        if (st.phase === 'done' || st.turn !== 0) releaseHuman();
        else render();
        void before;
      } else if (kind === 'end') noteHuman(E.endHand(st, 0));
    } finally { S.busy = false; }
  }

  function narrate(seat, action, res) {
    if (!action || !res || !res.ok) return;
    if (action.type === 'take') talk(seat, 'takePile', 0.85, true);
    else if (action.type === 'meld' || action.type === 'layoff') {
      const team = E.teamOf(seat);
      const finished = S.state.melds[team].some((m) => !m.black && m.cards.length >= 7 && S.state.completedCanastaThisTurn);
      talk(seat, finished || (res && S.state.completedCanastaThisTurn) ? 'canasta' : 'meld', 0.75, true);
    } else if (action.type === 'discard') {
      if (res.wentOut) talk(seat, 'goOut', 1, true);
      else if (E.isWild(action.card)) talk(seat, 'freeze', 0.8, true);
      else if (E.isBlackThree(action.card)) talk(seat, 'block', 0.65);
    } else if (action.type === 'goOut') talk(seat, 'goOut', 1, true);
    else if (action.type === 'ask') talk(seat, 'partnerAsk', 1, true);
    else if (action.type === 'answer') talk(seat, action.yes ? 'answerYes' : 'answerNo', 1, true);
    else if (action.type === 'stock' && (res.red || (res.ended && S.state.endReason === 'redThree'))) talk(seat, 'redThree', 1, true);
    else if (action.type === 'stock') talk(seat, 'draw', 0.18);
  }

  function askHuman() {
    const st = S.state;
    const asker = Seats.seats[st.asker];
    $('ask-title').textContent = (asker ? asker.name : 'Dein Partner') + ' fragt';
    $('ask-text').textContent = 'Darf ich ausmachen? Die Antwort gilt für diesen Zug.';
    $('modal-ask').hidden = false;
    return new Promise((res) => { S.askWait = res; });
  }
  function answerAsk(yes) {
    $('modal-ask').hidden = true;
    if (S.state && S.state.phase === 'ask') E.answerPartner(S.state, 0, yes);
    say(0, yes ? 'Ja, mach zu.' : 'Nein, lass liegen.', { force: true });
    const go = S.askWait;
    S.askWait = null;
    if (go) go();
  }

  async function playHand() {
    const st = S.state;
    let guard = 0;
    while (st.phase !== 'done') {
      if (++guard > 900) { E.finish(st, 'stock'); break; }
      render();
      const melds = st.melds[0].length + st.melds[1].length;
      if (S.watch && S.watchSteps >= 14 && (melds >= 1 || S.watchSteps >= 14)) {
        S.settled = true;
        if (window.__canasta) window.__canasta.settled = true;
        return;
      }
      if (st.phase === 'ask') {
        const partner = E.partnerSeat(st.asker);
        if (partner === 0 && !S.watch) {
          talk(st.asker, 'partnerAsk', 1, true);
          await askHuman();
          render();
        } else {
          await delay(640);
          const out = AI.step(st, settings.level, rng);
          S.watchSteps += 1;
          narrate(partner, out.action, out.res);
        }
        continue;
      }
      if (st.turn === 0 && !S.watch) {
        S.fresh = null;
        await waitHuman();
        continue;
      }
      await delay(S.watch ? 80 : 780);
      const seat = st.turn;
      if (!S.watch && Math.random() < 0.12) talk(seat, 'thinking', 1);
      const out = AI.step(st, settings.level, rng);
      S.watchSteps += 1;
      narrate(seat, out.action, out.res);
    }
  }

  function reasonText(result) {
    if (!result) return '';
    if (result.endReason === 'goOut') {
      const who = Seats.seats[result.wentOut.seat];
      return (who ? who.name : 'Jemand') + ' hat ausgemacht' + (result.wentOut.concealed ? ', verdeckt' : '') + '.';
    }
    if (result.endReason === 'redThree') return 'Die letzte Karte im Talon war eine rote Drei.';
    if (result.endReason === 'stock') return 'Der Talon ist leer, niemand konnte ausmachen.';
    return 'Die Runde ist zu Ende.';
  }
  function showSummary(result) {
    const us = result.teams[0];
    const them = result.teams[1];
    const won = result.winner === 0;
    const title = result.winner == null ? 'Unentschieden' : (won ? 'Runde an euch' : 'Runde an Horst und Oma Hilde');
    const quote = result.winner == null ? '' : (Talk.line(won ? 'margarethe' : 'hilde', 'roundWin') || '');
    const row = (label, a, b) => '<tr><td>' + label + '</td><td>' + a + '</td><td>' + b + '</td></tr>';
    $('summary').innerHTML =
      '<p class="sum-kicker">Abrechnung</p><h3 class="sum-title ' + (won ? 'won' : 'lost') + '">' + esc(title) + '</h3>' +
      '<p>' + esc(reasonText(result)) + '</p>' +
      (quote ? '<p class="sum-quote">' + esc(quote) + '</p>' : '') +
      '<table class="sum-table"><thead><tr><th></th><th>Wir</th><th>Gegner</th></tr></thead><tbody>' +
      row('Karten auf dem Tisch', us.cards, them.cards) +
      row('Canasta', us.canasta, them.canasta) +
      row('Abzug Hand', us.hand ? '-' + us.hand : 0, them.hand ? '-' + them.hand : 0) +
      row('Rote Dreien', us.red, them.red) +
      row('Ausmachen', us.goingOut, them.goingOut) +
      '</tbody><tfoot>' + row('Runde', us.total, them.total) +
      row('Stand', match.scores[0], match.scores[1]) + '</tfoot></table>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-next">Nächste Runde</button></div>';
    $('modal-summary').hidden = false;
    $('btn-next').addEventListener('click', () => {
      if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
      $('modal-summary').hidden = true;
      if (S.nextWait) { const go = S.nextWait; S.nextWait = null; go(); }
    });
  }
  function showCeremony(winner) {
    const ours = winner === 0;
    const title = ours ? 'Ihr habt den Abend gewonnen' : 'Horst und Oma Hilde haben den Abend gewonnen';
    const line = Talk.line(ours ? 'margarethe' : 'hilde', ours ? 'sessionHuman' : 'sessionSelf');
    const bits = ['♣', '♥', '♠', '♦', '★'];
    let conf = '';
    for (let i = 0; i < 16; i++) {
      conf += '<i style="--x:' + (i * 6 + 4) + '%;--d:' + (i * 0.12) + 's">' + bits[i % bits.length] + '</i>';
    }
    $('session').innerHTML =
      '<div class="confetti">' + conf + '</div>' +
      '<p class="intro-kicker">Ziel ' + targetValue() + '</p>' +
      '<h3 class="session-title">' + esc(title) + '</h3>' +
      (line ? '<p class="sum-quote">' + esc(line) + '</p>' : '') +
      '<ul class="standings"><li class="first"><span>1</span><span>' + (ours ? 'Du und Margarethe' : 'Horst und Oma Hilde') + '</span><b>' + match.scores[ours ? 0 : 1] + '</b></li>' +
      '<li><span>2</span><span>' + (ours ? 'Horst und Oma Hilde' : 'Du und Margarethe') + '</span><b>' + match.scores[ours ? 1 : 0] + '</b></li></ul>' +
      '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-again">Noch einen Abend</button></div>';
    $('modal-session').hidden = false;
    if (ours) { talk(2, 'sessionHuman', 1, true); talk(3, 'encourage', 1, true); }
    else { talk(3, 'sessionSelf', 1, true); talk(1, 'sessionSelf', 1, true); }
    $('btn-again').addEventListener('click', () => {
      if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
      $('modal-session').hidden = true;
      match.scores = [0, 0];
      match.rows = [];
      match.handNo = 0;
      match.dealer = 3;
      saveMatch();
      dealAndPlay();
    });
  }

  function dealAndPlay() {
    if (window.SpielpartnerRounds && !SpielpartnerRounds.gate()) return;
    S.gen += 1;
    const gen = S.gen;
    S.selected = [];
    S.error = null;
    S.fresh = null;
    S.watchSteps = 0;
    S.humanWait = null;
    const rules = E.normalizeRules(settings.rules);
    S.state = E.newGame({ rules: rules, rng: rng, dealer: match.dealer, scores: match.scores.slice() });
    render();
    talk(2, 'gameStart', 1, true);
    talk(3, 'gameStart', 0.65);
    runLoop(gen);
  }
  async function runLoop(gen) {
    try {
      await playHand();
      if (gen !== S.gen) return;
      if (S.watch && S.settled) { render(); return; }
      const st = S.state;
      if (st.phase !== 'done') { render(); return; }
      const result = st.result || E.scoreState(st);
      match.handNo += 1;
      match.scores[0] += result.teams[0].total;
      match.scores[1] += result.teams[1].total;
      match.rows.push({ n: match.handNo, us: result.teams[0].total, them: result.teams[1].total });
      match.dealer = (match.dealer + 1) % 4;
      saveMatch();
      renderScore();
      if (window.SpielpartnerRounds) SpielpartnerRounds.finish();
      if (result.winner === 0) { talk(2, 'roundWin', 1, true); talk(1, 'roundLose', 0.7); }
      else if (result.winner === 1) { talk(1, 'roundWin', 1, true); talk(3, 'roundWin', 0.8, true); talk(2, 'roundLose', 0.6); }
      const winner = E.matchWinner(match.scores, targetValue());
      if (winner === 0 || winner === 1) {
        showSummary(result);
        await new Promise((res) => { S.nextWait = res; });
        if (gen !== S.gen) return;
        showCeremony(winner);
        return;
      }
      showSummary(result);
      await new Promise((res) => { S.nextWait = res; });
      if (gen !== S.gen) return;
      dealAndPlay();
    } catch (e) {
      if (e === CANCEL) return;
      sys('Die Runde stockt. Nimm noch einmal Platz.');
    }
  }

  function syncSettingsForm() {
    document.querySelectorAll('input[name="level"]').forEach((el) => { el.checked = el.value === settings.level; });
    document.querySelectorAll('input[name="target"]').forEach((el) => { el.checked = el.value === String(settings.target); });
    $('target-custom').value = settings.targetCustom;
    document.querySelectorAll('input[name="pileTake"]').forEach((el) => { el.checked = el.value === settings.rules.pileTake; });
    document.querySelectorAll('input[name="minMeld"]').forEach((el) => { el.checked = el.value === settings.rules.minMeld; });
    document.querySelectorAll('input[name="canastas"]').forEach((el) => { el.checked = el.value === String(settings.rules.canastasToGoOut); });
    document.querySelectorAll('input[name="concealed"]').forEach((el) => { el.checked = el.value === String(settings.rules.concealedBonus); });
    document.querySelectorAll('input[name="redThrees"]').forEach((el) => { el.checked = el.value === settings.rules.redThrees; });
    $('opt-ask').checked = settings.rules.askPartner !== false;
    $('opt-wild').checked = !!settings.rules.wildMajority;
    $('opt-nocanasta').checked = !!settings.rules.noCanastaPickup;
    $('opt-sound').checked = !!settings.sound;
    $('opt-volume').value = settings.volume;
    $('opt-volume-out').textContent = settings.volume;
    document.querySelectorAll('input[name="talk"]').forEach((el) => { el.checked = el.value === settings.talk; });
    document.querySelectorAll('input[name="deck"]').forEach((el) => { el.checked = el.value === settings.deck; });
    document.querySelectorAll('input[name="speed"]').forEach((el) => { el.checked = el.value === settings.speed; });
    $('opt-handsfree').checked = !!settings.handsFree;
    syncHandsFree();
  }
  function readSettingsForm() {
    const val = (name) => { const el = document.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; };
    settings.level = val('level') || settings.level;
    settings.target = val('target') || settings.target;
    settings.targetCustom = +$('target-custom').value || settings.targetCustom;
    settings.rules.pileTake = val('pileTake') || 'frozen';
    settings.rules.minMeld = val('minMeld') || 'byScore';
    settings.rules.canastasToGoOut = val('canastas') === '2' ? 2 : 1;
    settings.rules.concealedBonus = val('concealed') === '300' ? 300 : 200;
    settings.rules.redThrees = val('redThrees') === 'vienna' ? 'vienna' : 'classic';
    settings.rules.askPartner = $('opt-ask').checked;
    settings.rules.wildMajority = $('opt-wild').checked;
    settings.rules.noCanastaPickup = $('opt-nocanasta').checked;
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
    $('intro-small').textContent = 'Spielstärke ' + (LEVELS[settings.level] || '') + ' · bis ' + targetValue() + ' · Ton ' + (settings.sound ? 'an' : 'aus');
  }

  /* Spracheingabe, angelehnt an den Skattisch. */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const MIC = { rec: null, on: false, mode: '', finalText: '', interim: '', want: false, muted: false, pausedForVoice: false, gesture: false, userEdit: false, writing: false, spoken: [], silence: 0, restart: 0, downAt: 0 };
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
    const game = S.state ? E.publicSummary(S.state, match.scores) : { phase: 'play', game: 'Canasta. Wir ' + match.scores[0] + ', Gegner ' + match.scores[1], scores: null };
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
    if (!modal || modal.id === 'modal-ask') return;
    if (modal.id === 'modal-settings') readSettingsForm();
    modal.hidden = true;
  }

  $('actions').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn && btn.dataset.act) onAction(btn.dataset.act);
  });
  $('stock').addEventListener('click', () => onAction('draw'));
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
    sys(settings.sound ? 'Ton an. Horst, Oma Hilde und Margarethe sprechen.' : 'Ton aus. Alle bleiben bei der Sprechblase.');
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
    match = { scores: [0, 0], dealer: 3, handNo: 0, rows: [] };
    saveMatch();
    renderScore();
    sys('Die Punkteliste ist leer. Die laufende Runde zählt noch mit dem alten Stand.');
  });
  $('opt-volume').addEventListener('input', () => { $('opt-volume-out').textContent = $('opt-volume').value; });
  $('modal-settings').addEventListener('change', () => {
    const talk = document.querySelector('input[name="talk"]:checked');
    if (talk) settings.talk = talk.value;
    settings.handsFree = $('opt-handsfree').checked;
    syncHandsFree();
  });
  $('ask-yes').addEventListener('click', () => answerAsk(true));
  $('ask-no').addEventListener('click', () => answerAsk(false));
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
    sys('Die Karten sind gemischt. Margarethe sitzt dir gegenüber.');
    dealAndPlay();
  }

  mountPortraits();
  renderTop();
  renderScore();
  applyTalk(false);
  sys('Canasta am Küchentisch. Nimm Platz, dann wird gegeben.');
  if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();

  window.__canasta = {
    get state() { return S.state; },
    get settled() { return S.settled; },
    set settled(v) { S.settled = v; },
    settings: settings,
    seats: Seats,
    E: E,
    AI: AI,
    render: render,
    get watchSteps() { return S.watchSteps; },
  };

  if (params.get('autostart') === '1') start();
})();
