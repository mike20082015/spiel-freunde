/* Spiel-Freunde Skat: Oberfläche und Spielablauf */
(function () {
  'use strict';
  const E = window.SkatEngine, AI = window.SkatAI, Talk = window.SkatTalk, C = window.SkatCards, Voice = window.SkatVoice;

  const NAMES = ['Du', 'Horst', 'Margarethe'];
  const WHO = [null, 'horst', 'margarethe'];
  const AVATARS = [null, 'assets/avatar-berliner-foto.jpg', 'assets/avatar-witwe-foto.jpg'];
  const ORIGINAL_ALT = [null, 'Horst Kaluppke', 'Margarethe von Hohenfels'];

  function applyLineup() {
    const L = window.SpielpartnerLineup;
    if (!L) return;
    const ids = L.resolveIds(localStorage, 'skat', 2, {
      entitlement: window.SpielpartnerEntitlement,
      storage: localStorage,
      now: Date.now(),
    });
    const base = L.defaults('skat', 2);
    for (let i = 0; i < ids.length; i++) {
      const person = L.avatar(ids[i]);
      const seat = i + 1;
      if (!person) continue;
      WHO[seat] = L.talkId('skat', person.id);
      NAMES[seat] = person.name;
      const img = document.querySelector('#seat-' + seat + ' img.ava');
      const name = document.querySelector('#seat-' + seat + ' .seat-name');
      if (name) name.textContent = person.name;
      if (!img) continue;
      const wrap = img.parentNode;
      const fallback = wrap && wrap.querySelector('.ava-fallback');
      if (ids[i] === base[i]) {
        img.hidden = false;
        img.src = AVATARS[seat];
        img.alt = ORIGINAL_ALT[seat];
        if (fallback) fallback.remove();
      } else {
        img.alt = person.full;
        img.hidden = false;
        img.onerror = function () {
          img.hidden = true;
          if (!wrap || wrap.querySelector('.ava-fallback')) return;
          const span = document.createElement('span');
          span.className = 'ava ava-fallback';
          span.textContent = L.initials(person.full);
          wrap.insertBefore(span, img);
        };
        if (img.getAttribute('src') !== L.portrait(person)) img.src = L.portrait(person);
        if (fallback) fallback.remove();
      }
    }
    if (window.SpielpartnerStimmen) SpielpartnerStimmen.setSeated([WHO[1], WHO[2]]);
    const line = document.getElementById('intro-line');
    if (line && NAMES[1] && NAMES[2]) {
      line.textContent = NAMES[1] + ' und ' + NAMES[2] + ' haben schon gemischt. Mit Ton reden die beiden auch mit Dir.';
    }
    if (typeof renderScore === 'function') renderScore();
  }
  let playerSeatCache = { name: 'Du', initial: 'Du', imageUrl: null, kind: 'none', presetId: '' };

  function youFaceHtml(big) {
    const seat = playerSeatCache || {};
    const cls = 'ava-you' + (big ? ' big' : '') + (seat.imageUrl ? ' has-photo' : '');
    if (seat.imageUrl) return '<span class="' + cls + '"><img src="' + esc(seat.imageUrl) + '" alt=""></span>';
    return '<span class="' + cls + '">' + esc(seat.initial || 'Du') + '</span>';
  }

  function paintFace(el, seat) {
    if (!el) return;
    el.classList.toggle('has-photo', !!seat.imageUrl);
    el.replaceChildren();
    if (seat.imageUrl) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = seat.imageUrl;
      el.appendChild(img);
    } else el.textContent = seat.initial || 'Du';
  }

  function paintPlayerSeat() {
    const seat = playerSeatCache || { name: 'Du', initial: 'Du' };
    paintFace($('ava-you'), seat);
    paintFace($('settings-ava'), seat);
    const nameEl = $('me-name');
    if (nameEl) nameEl.textContent = seat.name || 'Du';
    const settingsName = $('settings-ava-name');
    if (settingsName) settingsName.textContent = seat.name || 'Du';
  }

  async function refreshPlayerSeat() {
    const api = window.SpielFreundeAvatar;
    if (!api || typeof api.playerSeat !== 'function') return;
    try { playerSeatCache = await api.playerSeat(); }
    catch (e) { return; }
    paintPlayerSeat();
  }
  const SPEEDS = { slow: 1.6, normal: 1, fast: 0.45 };
  const DEFAULTS = { mode: 'official', deck: 'four', speed: 'normal', hints: false, sound: true, volume: 80, talk: 'chat', handsFree: false, target: 'none', targetCustom: 1001, level: 'kneipe' };
  const LEVEL_NAMES = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  const CANCEL = { cancelled: true };
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);

  /* ---------- Speicher ---------- */
  function load(key, def) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v ? Object.assign({}, def, v) : Object.assign({}, def); }
    catch (e) { return Object.assign({}, def); }
  }
  function store(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* privat-Modus */ } }

  const settings = load('sf-skat-settings', DEFAULTS);
  if (!LEVEL_NAMES[settings.level]) settings.level = 'kneipe';
  if (params.get('speed')) settings.speed = params.get('speed');
  const saveSettings = () => store('sf-skat-settings', settings);
  const targetValue = () => E.normalizeTarget(settings.target, settings.targetCustom);
  if (Voice) Voice.init({ getSettings: () => settings });
  if (params.get('fresh')) { try { localStorage.removeItem('sf-skat-match'); } catch (e) { /* egal */ } }

  let match = restoreMatch();
  function restoreMatch() {
    const m = new E.Match({ rules: { mode: settings.mode } });
    const saved = load('sf-skat-match', {});
    if (saved.scores) {
      m.scores = saved.scores; m.dealer = saved.dealer; m.queue = saved.queue || []; m.gameNo = saved.gameNo || 0;
      m.rows = saved.rows || [];
    } else m.rows = [];
    return m;
  }
  function saveMatch() {
    store('sf-skat-match', { scores: match.scores, dealer: match.dealer, queue: match.queue, gameNo: match.gameNo, rows: match.rows.slice(-200) });
  }

  // Seed für reproduzierbare Tests: ?seed=123
  let rng = E.cryptoRng();
  if (params.get('seed')) rng = E.seededRng(+params.get('seed'));

  const S = { level: settings.level, st: null, gen: 0, displayTrick: [], winIdx: -1, collectTo: null, selected: [], busy: false, declareSel: null, fresh: [], lastTalk: [0, 0, 0], bubbleTimers: [], prevLastTrick: null };

  function delay(ms) {
    const g = S.gen;
    return new Promise((res) => setTimeout(res, ms * (SPEEDS[settings.speed] || 1))).then(() => { if (g !== S.gen) throw CANCEL; });
  }
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  function zui() { return window.SpielpartnerZuschauen; }
  function lernen() { return !!(zui() && zui().aktiv()); }
  function lern(text, platz) { if (lernen() && text) zui().kommentar(text, { platz: platz }); }
  function skatSatz(st, player, card) {
    const game = st.game;
    const leading = !st.trick.length;
    const mine = E.effSuit(card, game);
    const lead = leading ? null : E.effSuit(st.trick[0].card, game);
    const nullspiel = !!(game && game.type === 'null');
    return zui().erklaere('skat', {
      name: NAMES[player],
      art: 'karte',
      karte: E.cardName(card),
      raus: leading,
      trumpf: !nullspiel && (leading ? mine === 'T' : lead === 'T'),
      bedienen: !leading && mine === lead,
      stechen: !nullspiel && !leading && lead !== 'T' && mine === 'T',
      abwerfen: !leading && mine !== lead && (nullspiel || mine !== 'T')
    });
  }

  /* ---------- Sprechblasen und Chat ---------- */
  function logLine(html, cls) {
    const log = $('chat-log');
    const p = document.createElement('p');
    p.className = 'cl' + (cls ? ' ' + cls : '');
    p.innerHTML = html;
    log.appendChild(p);
    while (log.children.length > 120) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }
  function sys(text) { logLine(text, 'sys'); }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function showTyping(name) {
    const log = $('chat-log');
    const p = document.createElement('p');
    p.className = 'cl typing';
    p.setAttribute('aria-label', name + ' schreibt');
    const b = document.createElement('b');
    b.textContent = name + ':';
    const label = document.createElement('span');
    label.className = 'typing-label';
    label.textContent = ' schreibt';
    const dots = document.createElement('span');
    dots.className = 'dots';
    dots.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 3; i++) dots.appendChild(document.createElement('i'));
    p.appendChild(b);
    p.appendChild(label);
    p.appendChild(dots);
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  // Figur spricht. kind 'bid' = kurze Reizansage, sonst Tischgespräch (gedrosselt).
  // Mit Ton: Die Blase erscheint, wenn die Figur wirklich losredet, und bleibt bis zum Ende der Aufnahme.
  // opts.speech: Sprechtext, falls er von der Anzeige abweicht (z. B. "Achtzehn." für "18").
  function say(p, text, opts) {
    opts = opts || {};
    if (!text) return false;
    const now = Date.now();
    if (!opts.force && opts.kind !== 'bid' && now - S.lastTalk[p] < 2600) return false;
    if (opts.kind !== 'bid') S.lastTalk[p] = now;
    if (opts.kind !== 'bid' && p !== 0) logLine('<b>' + NAMES[p] + ':</b> ' + esc(text));
    const el = $('bubble-' + p);
    const show = () => {
      el.textContent = text;
      el.classList.toggle('bid', opts.kind === 'bid');
      el.classList.add('show');
      clearTimeout(S.bubbleTimers[p]);
    };
    const hideLater = (ms) => { clearTimeout(S.bubbleTimers[p]); S.bubbleTimers[p] = setTimeout(() => el.classList.remove('show'), ms); };
    if (p !== 0 && Voice) {
      const seat = $('seat-' + p);
      const queued = Voice.speak(WHO[p], text, {
        kind: opts.kind, speech: opts.speech, priority: opts.priority,
        onStart: () => { show(); seat.classList.add('speaking'); },
        onEnd: (skipped) => { seat.classList.remove('speaking'); if (!skipped) hideLater(opts.kind === 'bid' ? 400 : 500); },
      });
      if (queued) return true;
    }
    show();
    hideLater(opts.kind === 'bid' ? 1500 : Math.min(5200, 2200 + text.length * 40));
    return true;
  }
  // Auf "Anfänger" sind die beiden freundlicher und machen Mut.
  const KIND_EVENTS = { weakPlay: 'weakPlayKind', humanLoses: 'encourage' };
  function talk(p, event, prob, force) {
    if (prob != null && Math.random() > prob) return false;
    if (typeof window !== 'undefined' && window.SpielpartnerSprueche && !window.SpielpartnerSprueche.allow({ force: !!force })) return false;
    if (S.level === 'anfaenger' && KIND_EVENTS[event]) event = KIND_EVENTS[event];
    const text = Talk.line(WHO[p], event);
    const ok = say(p, text, { force });
    if (ok) S.lastLine = { p, text };
    return ok;
  }
  const otherAI = (p) => (p === 1 ? 2 : 1);
  const aiWho = (p) => ({ persona: WHO[p], level: S.level });
  const callFor = (p, token) => Talk.callText(WHO[p], token) || undefined;
  const randomAI = () => (Math.random() < 0.5 ? 1 : 2);

  /* ---------- Darstellung ---------- */
  function render() {
    const st = S.st;
    if (!st) return;
    document.body.classList.toggle('deck-two', settings.deck === 'two');
    $('app').classList.toggle('hints', settings.hints);
    renderSeats();
    renderCenter();
    renderHand();
    renderStatus();
    renderHint();
  }

  function renderSeats() {
    const st = S.st;
    for (const p of [0, 1, 2]) {
      const tags = [];
      tags.push('<span class="tag">' + E.positionName(st, p) + '</span>');
      if (st.declarer === p) tags.push('<span class="tag decl">' + (st.game ? 'Spielt ' + esc(E.gameLabel(st.game)) : 'Alleinspieler') + '</span>');
      if (st.dealer === p && st.phase === 'bidding') tags.push('<span class="tag dealer">Geber</span>');
      $('role-' + p).innerHTML = tags.join('');
      const active = isActive(p);
      if (p === 0) $('seat-0').classList.toggle('active', active);
      else $('seat-' + p).classList.toggle('active', active);
    }
    for (const p of [1, 2]) {
      const box = $('opp-' + p);
      box.innerHTML = '';
      const open = st.game && st.game.type === 'null' && st.game.ouvert && st.declarer === p && st.phase === 'play';
      box.classList.toggle('open', !!open);
      const cards = open ? E.sortHand(st.hands[p], st.game) : st.hands[p];
      for (const c of cards) box.appendChild(open ? C.cardEl(c) : C.backEl());
    }
  }
  function isActive(p) {
    const st = S.st;
    if (st.phase === 'bidding') { const t = E.biddingTurn(st); return t && t.player === p; }
    if (st.phase === 'skat' || st.phase === 'discard' || st.phase === 'declare') return st.declarer === p;
    if (st.phase === 'play') {
      const dbl = E.doublingTurn(st);
      if (dbl) return dbl.player === p;
      return st.turn === p && S.displayTrick.length < 3;
    }
    return false;
  }

  function renderCenter() {
    const st = S.st;
    const pile = $('skat-pile');
    pile.innerHTML = '';
    if (st.phase === 'bidding' || st.phase === 'skat') { pile.appendChild(C.backEl()); pile.appendChild(C.backEl()); }
    const tr = $('trick');
    tr.className = 'trick' + (S.collectTo != null ? ' collect-' + S.collectTo : '');
    tr.innerHTML = '';
    S.displayTrick.forEach((x, i) => {
      const el = C.cardEl(x.card, { cls: 'p' + x.player + (i === S.winIdx ? ' win' : '') });
      el.style.zIndex = i + 1;
      tr.appendChild(el);
    });
    $('center').classList.toggle('busy', S.displayTrick.length > 0 || st.phase === 'bidding' || st.phase === 'skat');
  }

  function humanLegal() {
    const st = S.st;
    if (E.doublingTurn(st)) return null;
    if (st.phase === 'play' && st.turn === 0 && !S.busy && S.displayTrick.length < 3) return E.legalFor(st, 0);
    return null;
  }

  function renderHand() {
    const st = S.st;
    const hand = $('hand');
    hand.innerHTML = '';
    const game = st.game || (st.phase === 'discard' || st.phase === 'declare' ? null : null);
    const sorted = E.sortHand(st.hands[0], game || { type: 'grand' });
    const legal = humanLegal();
    const discarding = st.phase === 'discard' && st.declarer === 0;
    let suggest = null;
    if (settings.hints && legal && legal.length > 1) suggest = AI.chooseCard(E.viewFor(st, 0), 'neutral').card;
    for (const c of sorted) {
      const el = C.cardEl(c);
      if (legal) {
        if (legal.includes(c)) { el.classList.add('playable'); el.tabIndex = 0; el.setAttribute('role', 'button'); }
        else el.classList.add('blocked');
        if (c === suggest) el.classList.add('suggest');
      } else if (discarding) {
        el.classList.add('playable'); el.tabIndex = 0; el.setAttribute('role', 'button');
        if (S.selected.includes(c)) el.classList.add('selected');
        if (S.fresh.includes(c)) el.classList.add('fresh');
      }
      hand.appendChild(el);
    }
  }

  function trickPointsFor(players) {
    let pts = 0;
    for (const t of S.st.tricks) if (players.includes(t.winner)) pts += t.points;
    return pts;
  }

  function renderStatus() {
    const st = S.st;
    let main = '';
    const chips = [];
    if (st.special === 'bock') chips.push('<span class="chip bock">Bock: zählt doppelt</span>');
    if (st.phase === 'bidding') {
      const t = E.biddingTurn(st);
      if (t.player === 0) {
        if (t.role === 'say') main = '<em>Du bist dran:</em> Sagst Du ' + t.value + '?';
        else if (t.role === 'hear') main = '<em>Du bist dran:</em> ' + NAMES[t.from] + ' sagt ' + t.value + '. Hältst Du?';
        else main = '<em>Du bist dran:</em> Spielst Du für 18?';
      } else main = NAMES[t.player] + ' überlegt beim Reizen ...';
      chips.push('<span class="chip">Reizwert <b>' + (st.bidding.value || 'noch keiner') + '</b></span>');
      chips.push('<span class="chip">Geber <b>' + NAMES[st.dealer] + '</b></span>');
    } else if (st.phase === 'skat' || st.phase === 'discard' || st.phase === 'declare') {
      const d = st.declarer;
      if (d === 0) main = st.phase === 'skat' ? '<em>Du spielst für ' + st.bid + '.</em> Skat aufnehmen oder Hand?' : st.phase === 'discard' ? '<em>Drücken:</em> Wähle zwei Karten für den Skat.' : '<em>Ansage:</em> Welches Spiel spielst Du?';
      else main = NAMES[d] + ' spielt für ' + st.bid + ' und überlegt die Ansage ...';
      chips.push('<span class="chip">Reizwert <b>' + st.bid + '</b></span>');
    } else if (st.phase === 'play') {
      const dbl = E.doublingTurn(st);
      const p = st.turn;
      if (dbl) {
        if (dbl.player === 0) main = dbl.kind === 'kontra'
          ? '<em>Kontra?</em> Vor der ersten Karte kannst Du den Spielwert verdoppeln.'
          : '<em>Re?</em> ' + NAMES[st.kontraBy] + ' hat Kontra gesagt. Re zählt vierfach.';
        else main = NAMES[dbl.player] + (dbl.kind === 'kontra' ? ' überlegt ein Kontra …' : ' überlegt, ob Re gesagt wird …');
      } else if (p === 0 && S.displayTrick.length < 3) {
        if (!st.trick.length) main = '<em>Du bist dran:</em> Spiel eine Karte aus.';
        else main = '<em>Du bist dran:</em> ' + followText(st);
      } else if (S.displayTrick.length === 3) main = NAMES[st.lastTrick.winner] + (st.lastTrick.winner === 0 ? ' bekommst den Stich' : ' bekommt den Stich') + ' (' + st.lastTrick.points + ' Augen).';
      else main = NAMES[p] + ' ist dran ...';
      if (st.game.type === 'ramsch') {
        chips.push('<span class="chip ramsch">Ramsch</span>');
        chips.push('<span class="chip">Augen <b>Du ' + trickPointsFor([0]) + '</b> · Horst ' + trickPointsFor([1]) + ' · Marg. ' + trickPointsFor([2]) + '</span>');
      } else {
        chips.push('<span class="chip">Spiel <b>' + esc(E.gameLabel(st.game)) + '</b> (' + (st.declarer === 0 ? 'Du' : NAMES[st.declarer]) + ')</span>');
        if (st.kontra) chips.push('<span class="chip kontra">' + (st.re ? 'Kontra · Re' : 'Kontra') + '</span>');
        chips.push('<span class="chip">Reizwert <b>' + st.bid + '</b></span>');
        if (st.game.type !== 'null') {
          const d = st.declarer;
          chips.push('<span class="chip">Augen <b>' + (d === 0 ? 'Du' : NAMES[d]) + ' ' + trickPointsFor([d]) + '</b> · Gegner ' + trickPointsFor([0, 1, 2].filter((x) => x !== d)) + '</span>');
        } else chips.push('<span class="chip">Stiche Alleinspieler <b>' + st.tricks.filter((t) => t.winner === st.declarer).length + '</b></span>');
      }
      chips.push('<span class="chip">Stich <b>' + Math.min(10, st.tricks.length + (st.trick.length ? 1 : 0) || 1) + '/10</b></span>');
    } else if (st.phase === 'done') {
      main = 'Spiel vorbei.';
    }
    $('st-main').innerHTML = main;
    $('st-chips').innerHTML = chips.join('');
    $('btn-last').disabled = !(st.lastTrick || S.prevLastTrick);
  }

  function effName(es) { return es === 'T' ? 'Trumpf' : E.SUIT_NAMES[es]; }
  function followText(st) {
    const lead = E.effSuit(st.trick[0].card, st.game);
    const can = st.hands[0].some((c) => E.effSuit(c, st.game) === lead);
    return can ? effName(lead) + ' bedienen.' : 'Kein ' + effName(lead) + ': Du darfst ' + (st.game.type === 'null' ? 'abwerfen.' : 'stechen oder abwerfen.');
  }

  function renderHint() {
    const box = $('hint-box');
    const st = S.st;
    const legal = humanLegal();
    if (!settings.hints || !legal) { box.hidden = true; return; }
    const sug = AI.chooseCard(E.viewFor(st, 0), 'neutral');
    let rule;
    if (!st.trick.length) rule = 'Du spielst aus und darfst jede Karte legen.';
    else {
      const lead = E.effSuit(st.trick[0].card, st.game);
      const can = st.hands[0].some((c) => E.effSuit(c, st.game) === lead);
      rule = can ? 'Bedienpflicht: Ausgespielt ist ' + effName(lead) + (lead !== 'T' && st.game.type !== 'null' ? ' (Buben zählen hier als Trumpf, nicht als ' + effName(lead) + ')' : '') + ', also musst Du ' + effName(lead) + ' zugeben.' : 'Du hast kein ' + effName(lead) + ', darum ist jede Karte erlaubt.';
    }
    box.innerHTML = rule + '<br><b>Tipp:</b> ' + C.inlineCard(sug.card) + ' ' + esc(sug.reason);
    box.hidden = false;
  }

  /* ---------- Panels ---------- */
  function showPanel(html, bind) {
    const p = $('panel');
    p.innerHTML = html;
    p.hidden = false;
    if (bind) bind(p);
  }
  function hidePanel() { $('panel').hidden = true; $('panel').innerHTML = ''; }

  function ladder(cur, next) {
    const vals = E.BID_VALUES;
    const i = Math.max(0, vals.indexOf(next || cur) - 4);
    return '<div class="ladder">' + vals.slice(i, i + 11).map((v) => '<span class="' + (v === cur ? 'cur' : v === next ? 'next' : '') + '">' + v + '</span>').join('') + '</div>';
  }

  function bidTip() {
    if (!settings.hints) return '';
    const max = AI.maxBid(S.st.hands[0], 'neutral');
    const t = max ? 'Mit Deinen Karten würde die KI bis etwa <b>' + max + '</b> mitgehen.' : 'Mit diesem Blatt würde die KI eher passen.';
    return '<div class="tip"><b>Tipp:</b> ' + t + ' Reizen heißt: Du bietest den Spielwert, den Dein Spiel mindestens bringt. Spielwert = Grundwert (Karo 9, Herz 10, Pik 11, Kreuz 12, Grand 24) × (Spitzen + 1).</div>';
  }

  function showBidPanel(t) {
    const st = S.st;
    let html;
    if (t.role === 'say') {
      html = '<h3>Reizen</h3><p>Du sagst ' + NAMES[t.to] + ' etwas. Nächster Reizwert:</p><div class="big">' + t.value + '</div>' + ladder(st.bidding.value, t.value) +
        '<div class="panel-row"><button class="btn btn-gold" data-a="yes">' + t.value + ' sagen</button><button class="btn btn-ghost-dark" data-a="no">Passe</button></div>';
    } else if (t.role === 'hear') {
      html = '<h3>Reizen</h3><p>' + NAMES[t.from] + ' sagt Dir:</p><div class="big">' + t.value + '</div>' + ladder(t.value, null) +
        '<div class="panel-row"><button class="btn btn-gold" data-a="yes">Ja, ich halte</button><button class="btn btn-ghost-dark" data-a="no">Passe</button></div>';
    } else {
      html = '<h3>Niemand hat gereizt</h3><p>Du sitzt in Vorhand und darfst für 18 spielen.</p>' +
        '<div class="panel-row"><button class="btn btn-gold" data-a="yes">Ja, ich spiele für 18</button><button class="btn btn-ghost-dark" data-a="no">Passe' + (st.rules.mode === 'kneipe' ? ' (dann Ramsch)' : ' (neu geben)') + '</button></div>';
    }
    showPanel(html + bidTip(), (p) => {
      p.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
        const yes = b.dataset.a === 'yes';
        hidePanel();
        const value = t.role === 'say' ? t.value : t.role === 'hear' ? t.value : 18;
        say(0, yes ? (t.role === 'hear' ? 'Ja' : String(value)) : 'Passe', { kind: 'bid' });
        sys('Du ' + (yes ? (t.role === 'hear' ? 'hältst ' + value : 'sagst ' + value) : 'passt') + '.');
        E.bidAction(st, yes);
        afterBidding();
        advance();
      }));
    });
  }

  function showDoublePanel(dbl) {
    const st = S.st;
    const kontra = dbl.kind === 'kontra';
    const html = kontra
      ? '<h3>Kontra?</h3><p>Du bist Gegenspieler. Kontra verdoppelt den Spielwert, noch bevor die erste Karte kommt. Gewonnen wie verloren.</p>'
      : '<h3>Re?</h3><p>' + NAMES[st.kontraBy] + ' hat Kontra gesagt. Re verdoppelt noch einmal, der Spielwert zählt vierfach.</p>';
    const yesLabel = kontra ? 'Kontra' : 'Re';
    const noLabel = kontra ? 'Weiter ohne Kontra' : 'Kein Re';
    const yesClass = kontra ? 'btn btn-wine' : 'btn btn-gold';
    showPanel(html + '<div class="panel-row"><button class="' + yesClass + '" data-a="yes">' + yesLabel + '</button><button class="btn btn-ghost-dark" data-a="no">' + noLabel + '</button></div>', (p) => {
      p.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => {
        const yes = b.dataset.a === 'yes';
        hidePanel();
        if (yes) {
          if (kontra) E.sayKontra(st, 0);
          else E.sayRe(st, 0);
          say(0, yesLabel + '!', { kind: 'bid', speech: yesLabel + '.' });
          sys('Du sagst ' + yesLabel + '.');
        } else E.declineDouble(st, 0);
        advance();
      }));
    });
  }

  function afterBidding() {
    const st = S.st;
    if (st.phase === 'skat') {
      sys((st.declarer === 0 ? 'Du spielst' : NAMES[st.declarer] + ' spielt') + ' für ' + st.bid + '.');
    } else if (st.allPassed && st.game && st.game.type === 'ramsch') {
      sys('Alle haben gepasst: Es wird Ramsch gespielt. Wer die meisten Augen hat, verliert.');
      talk(randomAI(), 'ramsch', 0.9, true);
    }
  }

  function showSkatPanel() {
    const st = S.st;
    let tip = '';
    if (settings.hints) {
      const d = AI.decideSkat(E.viewFor(st, 0), 'neutral');
      tip = '<div class="tip"><b>Tipp:</b> ' + (d.hand ? 'Dein Blatt ist stark genug für ein Handspiel (' + esc(E.gameLabel(Object.assign({}, d.game, { hand: true }))) + '). Hand bringt eine Stufe mehr.' : 'Nimm den Skat auf: Zwei neue Karten machen Dein Blatt meist besser, und Du darfst zwei schlechte Karten drücken.') + '</div>';
    }
    showPanel('<h3>Du bist Alleinspieler</h3><p>Du hast das Reizen für <b>' + st.bid + '</b> gewonnen. Möchtest Du den Skat aufnehmen oder Hand spielen?</p>' +
      '<div class="panel-row"><button class="btn btn-gold" data-a="take">Skat aufnehmen</button><button class="btn btn-wine" data-a="hand">Hand spielen</button></div>' + tip, (p) => {
      p.querySelector('[data-a=take]').addEventListener('click', () => {
        S.fresh = st.skat.slice();
        E.takeSkat(st);
        sys('Du nimmst den Skat auf.');
        S.selected = [];
        advance();
      });
      p.querySelector('[data-a=hand]').addEventListener('click', () => {
        E.playHand(st);
        sys('Du spielst Hand.');
        advance();
      });
    });
  }

  function showDiscardPanel() {
    const st = S.st;
    const sel = S.selected;
    const pts = sel.reduce((s, c) => s + E.points(c), 0);
    let tip = '';
    if (settings.hints) {
      const d = AI.chooseDiscardAndGame(E.viewFor(st, 0), 'neutral');
      tip = '<div class="tip"><b>Tipp:</b> Die KI würde ' + C.inlineCard(d.discard[0]) + ' und ' + C.inlineCard(d.discard[1]) + ' drücken und dann <b>' + esc(E.gameLabel(d.game)) + '</b> spielen. Gedrückte Augen zählen für Dich, blanke Zehnen sind gute Kandidaten.</div>';
    }
    showPanel('<h3>Zwei Karten drücken</h3><p>Der Skat ist jetzt auf Deiner Hand (markiert). Tippe zwei Karten an, die Du in den Skat legen möchtest. Die Augen darin zählen am Ende für Dich.</p>' +
      '<p class="calc">Ausgewählt: ' + (sel.length ? sel.map(C.inlineCard).join(' ') + ' (' + pts + ' Augen)' : 'noch nichts') + '</p>' +
      '<div class="panel-row"><button class="btn btn-gold" data-a="ok"' + (sel.length === 2 ? '' : ' disabled') + '>Drücken</button></div>' + tip, (p) => {
      p.querySelector('[data-a=ok]').addEventListener('click', () => {
        E.discard(st, S.selected.slice());
        sys('Du hast zwei Karten gedrückt.');
        S.selected = []; S.fresh = [];
        S.declareSel = null;
        advance();
      });
    });
  }

  function declareCards() {
    const st = S.st;
    return st.skatTaken ? st.hands[0].concat(st.skat) : st.hands[0].slice();
  }
  function optionValue(g) {
    const st = S.st;
    const game = Object.assign({}, g, { hand: !st.skatTaken });
    if (game.type === 'null') return { value: E.nullValue(game), text: E.gameLabel(game) + ' = ' + E.nullValue(game) };
    const m = E.matadors(declareCards(), game);
    const parts = E.multiplierParts({ game, matadors: m.count, mit: m.mit });
    const mult = parts.reduce((s, p) => s + p.n, 0);
    const v = E.baseValue(game) * mult;
    return { value: v, text: (m.mit ? 'mit ' : 'ohne ') + m.count + ', ' + parts.slice(1).map((p) => p.label).join(', ') + ': ' + mult + ' × ' + E.baseValue(game) + ' = <b>' + v + '</b>', m };
  }

  function showDeclarePanel() {
    const st = S.st;
    const hand = !st.skatTaken;
    const sel = S.declareSel;
    const opts = [
      { key: 'C', g: { type: 'suit', trump: 'C' }, label: C.suitIcon('C') + ' Kreuz' },
      { key: 'S', g: { type: 'suit', trump: 'S' }, label: C.suitIcon('S') + ' Pik' },
      { key: 'H', g: { type: 'suit', trump: 'H' }, label: C.suitIcon('H') + ' Herz' },
      { key: 'D', g: { type: 'suit', trump: 'D' }, label: C.suitIcon('D') + ' Karo' },
      { key: 'G', g: { type: 'grand' }, label: 'Grand', wide: true },
      { key: 'N', g: { type: 'null' }, label: hand ? 'Null Hand' : 'Null' },
      { key: 'NO', g: { type: 'null', ouvert: true }, label: hand ? 'Null Ouvert Hand' : 'Null Ouvert' },
    ];
    let html = '<h3>Was spielst Du?</h3><p>Reizwert: <b>' + st.bid + '</b>. ' + (hand ? 'Du spielst Hand, Deine Spitzen sind ohne Skat gerechnet (der Skat zählt am Ende mit).' : 'Der Spielwert muss mindestens Deinen Reizwert erreichen.') + '</p><div class="games-grid">';
    for (const o of opts) {
      const ov = optionValue(o.g);
      const disabled = o.g.type === 'null' && ov.value < st.bid;
      const base = o.g.type === 'null' ? ov.value : E.baseValue(o.g);
      html += '<button class="gbtn' + (o.wide ? ' wide' : '') + (sel && sel.key === o.key ? ' sel' : '') + '" data-k="' + o.key + '"' + (disabled ? ' disabled' : '') + '><span class="gname">' + o.label + '</span><span class="gval">' + (o.g.type === 'null' ? 'Wert ' + base : 'Grundwert ' + base + ' · ' + ov.value) + '</span></button>';
    }
    html += '</div>';
    if (sel && sel.g.type !== 'null' && hand) {
      html += '<div class="checks"><label><input type="checkbox" data-c="schneider"' + (sel.schneider ? ' checked' : '') + '> Schneider ansagen</label><label><input type="checkbox" data-c="schwarz"' + (sel.schwarz ? ' checked' : '') + '> Schwarz ansagen</label></div>';
    }
    if (sel) {
      const g = Object.assign({}, sel.g, { schneiderAnnounced: !!sel.schneider || !!sel.schwarz, schwarzAnnounced: !!sel.schwarz });
      const ov = optionValue(g);
      html += '<p class="calc">' + esc(E.gameLabel(Object.assign({}, g, { hand }))) + ': ' + ov.text + '</p>';
      if (ov.value < st.bid) html += '<div class="warn">Achtung: ' + ov.value + ' liegt unter Deinem Reizwert ' + st.bid + '. Ohne Schneider ' + (hand ? 'oder passende Spitzen im Skat ' : '') + 'wärst Du überreizt und verlierst.</div>';
    }
    html += '<div class="panel-row"><button class="btn btn-gold" data-a="ok"' + (sel ? '' : ' disabled') + '>Ansagen</button></div>';
    if (settings.hints) html += '<div class="tip"><b>Tipp:</b> ' + declareTip() + '</div>';
    showPanel(html, (p) => {
      p.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
        const o = opts.find((x) => x.key === b.dataset.k);
        S.declareSel = { key: o.key, g: o.g, schneider: false, schwarz: false };
        showDeclarePanel();
      }));
      p.querySelectorAll('[data-c]').forEach((cb) => cb.addEventListener('change', () => {
        S.declareSel[cb.dataset.c] = cb.checked;
        if (cb.dataset.c === 'schwarz' && cb.checked) S.declareSel.schneider = true;
        showDeclarePanel();
      }));
      p.querySelector('[data-a=ok]').addEventListener('click', () => {
        const s = S.declareSel;
        const g = Object.assign({}, s.g);
        if (s.schwarz) g.schwarzAnnounced = true;
        if (s.schneider || s.schwarz) g.schneiderAnnounced = true;
        try { E.declare(st, g); } catch (e) { alert(e.message); return; }
        sys('Du spielst ' + E.gameLabel(st.game) + '.');
        say(0, E.gameLabel(st.game) + '!', { kind: 'bid' });
        hidePanel();
        S.declareSel = null;
        advance();
      });
    });
  }
  function declareTip() {
    const st = S.st;
    let g;
    if (st.skatTaken) g = AI.suggestGame(st.hands[0], st.skat, st.bid);
    else {
      const d = AI.decideSkat(E.viewFor(st, 0), 'neutral');
      g = d.hand ? d.game : null;
      if (!g) {
        let best = null;
        for (const o of AI.evaluateHand(st.hands[0], 0)) {
          if (optionValue(o.game).value < st.bid) continue;
          if (!best || o.margin > best.margin) best = o;
        }
        g = best && best.game;
      }
    }
    if (!g) return 'Kein Spiel erreicht sicher Deinen Reizwert. Nimm das Spiel mit den meisten Trümpfen.';
    const why = g.type === 'null' ? 'Du hast lauter kleine Karten und kannst jeden Stich vermeiden.' : g.type === 'grand' ? 'Mit mehreren Buben und Assen ist ein Grand stark.' : 'Hier hast Du die meisten Trümpfe (Buben plus ' + E.SUIT_NAMES[g.trump] + ').';
    return 'Die KI würde <b>' + esc(E.gameLabel(Object.assign({}, g, { hand: !st.skatTaken }))) + '</b> wählen. ' + why;
  }

  /* ---------- Spielablauf ---------- */
  function roundGate() {
    return !window.SpielpartnerRounds || SpielpartnerRounds.gate();
  }

  function paintFreeRounds() {
    if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  }

  function noteFinishedRound() {
    return window.SpielpartnerRounds ? SpielpartnerRounds.finish() : null;
  }

  function newGame() {
    if (!roundGate()) return;
    S.gen++;
    S.prevLastTrick = S.st && S.st.lastTrick ? { trick: S.st.lastTrick, game: S.st.game } : S.prevLastTrick;
    S.displayTrick = []; S.collectTo = null; S.winIdx = -1; S.selected = []; S.fresh = []; S.busy = false; S.declareSel = null;
    hideModal('modal-summary');
    hidePanel();
    match.rules.mode = settings.mode;
    if (settings.mode !== 'kneipe') match.queue = [];
    S.level = settings.level;
    renderTopbar();
    S.st = match.start(rng);
    const st = S.st;
    sys('Spiel ' + match.gameNo + '. Geber: ' + NAMES[st.dealer] + '. Vorhand: ' + NAMES[st.pos.vorhand] + '.');
    if (st.special === 'bock') { sys('Bockspiel: Dieses Spiel zählt doppelt.'); talk(randomAI(), 'bock', 0.9, true); }
    else if (st.special === 'ramsch') { sys('Ramschrunde: Wer die meisten Augen sammelt, verliert sie.'); talk(randomAI(), 'ramsch', 0.9, true); }
    else talk(randomAI(), 'gameStart', 0.75, true);
    renderScore();
    advance();
  }

  async function advance() {
    try { await step(); }
    catch (e) { if (e !== CANCEL) console.error(e); }
  }

  async function step() {
    for (;;) {
      const st = S.st;
      render();
      if (st.phase === 'bidding') {
        const t = E.biddingTurn(st);
        if (t.player === 0 && !lernen()) { showBidPanel(t); return; }
        hidePanel();
        if (lernen()) await zui().takt();
        else await delay(750 + Math.random() * 400);
        if (!S.st || S.st.phase !== 'bidding') continue;
        if (t.player === 0 && !lernen()) { showBidPanel(t); return; }
        const yes = AI.decideBid(E.viewFor(st, t.player), t, aiWho(t.player));
        const value = t.value;
        const word = yes ? (t.role === 'hear' ? 'Ja!' : String(value)) : 'Passe';
        const token = yes ? (t.role === 'hear' ? 'hold' : t.role === 'say' ? value : 'open') : 'pass';
        say(t.player, word, { kind: 'bid', speech: callFor(t.player, token) });
        sys(NAMES[t.player] + ' ' + (yes ? (t.role === 'hear' ? 'hält ' + value : 'sagt ' + value) : 'passt') + '.');
        E.bidAction(st, yes);
        lern(zui().erklaere('skat', { art: 'reiz', name: NAMES[t.player], passe: !yes, hoeren: t.role === 'hear', wert: value }), t.player);
        if (yes && value >= 30) setTimeout(() => talk(t.player, 'bidHigh', 0.35), 1600);
        if (!yes && Math.random() < 0.3) setTimeout(() => talk(t.player, 'passBid', 1), 1600);
        afterBidding();
        if (!lernen()) await delay(450);
        continue;
      }
      if (st.phase === 'skat') {
        if (st.declarer === 0 && !lernen()) { showSkatPanel(); return; }
        hidePanel();
        const d = st.declarer;
        if (lernen()) await zui().takt();
        else await delay(1000);
        if (st.declarer === 0 && !lernen()) { showSkatPanel(); return; }
        const dec = AI.decideSkat(E.viewFor(st, d), aiWho(d));
        if (dec.hand) {
          E.playHand(st);
          E.declare(st, dec.game);
        } else {
          E.takeSkat(st);
          sys(NAMES[d] + ' nimmt den Skat auf.');
          render();
          if (lernen()) await zui().takt();
          else await delay(1100);
          const dd = AI.chooseDiscardAndGame(E.viewFor(st, d), aiWho(d));
          E.discard(st, dd.discard);
          E.declare(st, dd.game);
        }
        sys(NAMES[d] + ' spielt ' + E.gameLabel(st.game) + '.');
        say(d, E.gameLabel(st.game) + '!', { kind: 'bid', speech: callFor(d, E.gameLabel(st.game)) });
        lern(zui().erklaere('skat', { art: 'skat', name: NAMES[d], hand: !!dec.hand, spiel: E.gameLabel(st.game) }), d);
        setTimeout(() => talk(d, 'declare', 0.5), 1700);
        if (!lernen()) await delay(1300);
        continue;
      }
      if (st.phase === 'discard') { if (st.declarer === 0 && !lernen()) { showDiscardPanel(); renderHand(); } return; }
      if (st.phase === 'declare') { if (st.declarer === 0 && !lernen()) showDeclarePanel(); return; }
      if (st.phase === 'play') {
        const dbl = E.doublingTurn(st);
        if (dbl) {
          if (dbl.player === 0 && !lernen()) { showDoublePanel(dbl); return; }
          hidePanel();
          if (lernen()) await zui().takt();
          else await delay(700);
          if (dbl.player === 0 && !lernen()) { showDoublePanel(dbl); return; }
          const yes = dbl.kind === 'kontra'
            ? AI.decideKontra(E.viewFor(st, dbl.player), aiWho(dbl.player))
            : AI.decideRe(E.viewFor(st, dbl.player), aiWho(dbl.player));
          if (yes) {
            if (dbl.kind === 'kontra') E.sayKontra(st, dbl.player);
            else E.sayRe(st, dbl.player);
            const word = dbl.kind === 'kontra' ? 'Kontra' : 'Re';
            say(dbl.player, word + '!', { kind: 'bid', speech: word + '.' });
            sys(NAMES[dbl.player] + ' sagt ' + word + '.');
          } else E.declineDouble(st, dbl.player);
          lern(zui().erklaere('skat', { art: dbl.kind === 'kontra' ? 'kontra' : 're', name: NAMES[dbl.player], ja: !!yes }), dbl.player);
          if (!lernen()) await delay(450);
          continue;
        }
        hidePanel();
        const p = st.turn;
        if (p === 0 && !lernen()) { render(); return; }
        let ms = 650 + Math.random() * 350;
        if (!lernen() && E.legalFor(st, p).length > 2 && Math.random() < 0.1) { if (talk(p, 'thinking', 1)) ms += 1400; }
        if (lernen()) await zui().takt();
        else await delay(ms);
        if (p === 0 && !lernen()) { render(); return; }
        const { card } = AI.chooseCard(E.viewFor(st, p), aiWho(p));
        lern(skatSatz(st, p, card), p);
        await doPlay(p, card);
        continue;
      }
      if (st.phase === 'done') { await finishGame(); return; }
    }
  }

  async function doPlay(p, card) {
    const st = S.st;
    const legal = E.legalFor(st, p);
    const leading = st.trick.length === 0;
    const info = E.playCard(st, p, card);
    if (!info.trickComplete) { S.displayTrick = st.trick.slice(); render(); return; }
    S.displayTrick = info.trick.cards.slice();
    S.winIdx = info.trick.cards.findIndex((x) => x.player === info.winner);
    render();
    trickTalk(info, p === 0 ? { card, legal, leading } : null, info.trick.cards.find((x) => x.player === 0));
    if (lernen()) await sleep(320);
    else await delay(1150);
    S.collectTo = info.winner;
    renderCenter();
    if (lernen()) await sleep(180);
    else await delay(420);
    S.collectTo = null; S.displayTrick = []; S.winIdx = -1;
    render();
  }

  function team(p) {
    const st = S.st;
    if (!st.game || st.game.type === 'ramsch') return 'p' + p;
    return p === st.declarer ? 'D' : 'O';
  }

  function trickTalk(info, humanLast, humanPlay) {
    const st = S.st;
    const t = info.trick;
    const w = info.winner;
    const cards = t.cards.map((x) => x.card);
    const hasBig = cards.some((c) => ['A', '10'].includes(E.rankOf(c)));
    // schwacher Zug des Menschen: Ass oder Zehn landet beim Gegner, obwohl eine billigere Karte erlaubt war
    if (humanPlay && st.game.type !== 'ramsch' && st.game.type !== 'null') {
      const hc = humanPlay.card;
      const idx = t.cards.findIndex((x) => x.player === 0);
      const legalBefore = S.humanLegalAtPlay;
      if (E.points(hc) >= 10 && team(w) !== team(0) && legalBefore && legalBefore.some((c) => E.points(c) < 10) && !(idx === 0 && E.rankOf(hc) === 'A')) {
        const speaker = w !== 0 ? w : randomAI();
        if (talk(speaker === 0 ? randomAI() : speaker, 'weakPlay', 0.8)) return;
      }
    }
    if (w !== 0 && hasBig && t.points >= 14 && talk(w, 'bigTrick', 0.4)) return;
    if (w !== 0 && st.game.type !== 'ramsch' && team(w) === team(otherAI(w))) {
      const partnerCard = t.cards.find((x) => x.player === otherAI(w));
      if (partnerCard && E.points(partnerCard.card) >= 10) talk(w, 'partnerSchmier', 0.35);
    }
  }

  async function finishGame() {
    noteFinishedRound();
    const st = S.st;
    const r = st.result;
    await delay(350);
    const rec = match.record(st);
    match.rows.push(rowFor(st, r));
    saveMatch();
    renderScore();
    S.lastLine = null;
    endTalk(r);
    const quote = S.lastLine;
    if (r.passedIn) sys('Alle haben gepasst. Das Spiel wird neu gegeben.');
    else if (r.ramsch) sys('Ramsch beendet. Augen: Du ' + r.points[0] + ', Horst ' + r.points[1] + ', Margarethe ' + r.points[2] + '.');
    else sys((r.declarer === 0 ? 'Du hast ' : NAMES[r.declarer] + ' hat ') + E.gameLabel(r.game) + (r.won ? ' gewonnen' : ' verloren') + ' (' + (r.scoreChange > 0 ? '+' : '') + r.scoreChange + ').');
    if (rec.bockAdded) sys('Verlorener Grand: Jetzt kommen 3 Bockspiele und danach 3 Ramschspiele.');
    render();
    showSummary(r, quote, E.sessionWinner(match.scores, targetValue()));
  }

  function endTalk(r) {
    if (r.passedIn) { talk(randomAI(), 'passedIn', 0.9, true); return; }
    if (r.ramsch) {
      const losers = r.losers || [];
      if (losers.includes(0)) talk(randomAI(), 'humanLoses', 0.9, true);
      else if (losers.length) talk(losers[0], 'selfLoses', 0.9, true);
      return;
    }
    const d = r.declarer;
    if (d === 0) {
      if (r.overbid) talk(randomAI(), 'overbid', 1, true);
      else if (r.won && r.schneider) talk(randomAI(), 'humanWins', 1, true);
      else talk(randomAI(), r.won ? 'humanWins' : 'humanLoses', 1, true);
    } else {
      talk(d, r.won ? 'selfWins' : 'selfLoses', 1, true);
      const o = otherAI(d);
      if (r.overbid) setTimeout(() => talk(o, 'overbid', 0.9, true), 1800);
      else if (r.schwarz) setTimeout(() => talk(o, 'schwarz', 0.9, true), 1800);
      else if (r.schneider) setTimeout(() => talk(o, 'schneider', 0.8, true), 1800);
    }
  }

  function rowFor(st, r) {
    const special = st.special;
    let label;
    if (r.passedIn) label = 'eingepasst';
    else if (r.ramsch) label = r.durchmarsch != null ? 'Durchmarsch' : 'Ramsch';
    else label = (r.declarer === 0 ? 'Du' : ['', 'Horst', 'Marg.'][r.declarer]) + ': ' + E.gameLabel(r.game).replace(', Schneider angesagt', ' S.').replace(', Schwarz angesagt', ' Sw.');
    if (r.kontra) label += r.re ? ' · Kontra Re' : ' · Kontra';
    return { no: match.gameNo, label: label + (special === 'bock' ? ' ×2' : ''), change: r.score.slice(), totals: match.scores.slice() };
  }

  function renderScore() {
    const tb = $('score-table');
    const rows = match.rows;
    let html = '<thead><tr><th>Nr.</th><th>Spiel</th><th>Du</th><th>' + esc(NAMES[1]) + '</th><th>' + esc(NAMES[2]) + '</th></tr></thead><tbody>';
    if (!rows.length) html += '<tr class="empty"><td colspan="5">Noch keine Spiele. Gut Blatt!</td></tr>';
    for (const r of rows.slice(-60)) {
      html += '<tr><td>' + r.no + '</td><td class="game" title="' + esc(r.label) + '">' + esc(r.label) + '</td>' + r.change.map((c) => '<td class="' + (c > 0 ? 'pos' : c < 0 ? 'neg' : '') + '">' + (c ? (c > 0 ? '+' : '') + c : '') + '</td>').join('') + '</tr>';
    }
    html += '</tbody><tfoot><tr><td colspan="2">Summe</td>' + match.scores.map((s) => '<td>' + s + '</td>').join('') + '</tr></tfoot>';
    tb.innerHTML = html;
    const wrap = tb.parentElement;
    wrap.scrollTop = wrap.scrollHeight;
    $('mode-badge').textContent = settings.mode === 'kneipe' ? 'Kneipenskat' : 'Offiziell';
    renderTarget();
    const q = $('queue-info');
    if (settings.mode === 'kneipe' && match.queue.length) {
      const b = match.queue.filter((x) => x === 'bock').length, ra = match.queue.filter((x) => x === 'ramsch').length;
      q.textContent = 'Es stehen an: ' + (b ? b + ' Bock' : '') + (b && ra ? ', ' : '') + (ra ? ra + ' Ramsch' : '') + '.';
      q.hidden = false;
    } else q.hidden = true;
  }

  function renderTarget() {
    const box = $('target-info');
    const target = targetValue();
    if (!target) { box.hidden = true; return; }
    const lead = Math.max.apply(null, match.scores);
    let html = '<p class="ti-head"><span>Spielen bis <b>' + target + '</b></span><span>' + (lead >= target ? 'Ziel erreicht' : 'noch ' + (target - Math.max(0, lead)) + ' für die Spitze') + '</span></p>';
    for (const p of [0, 1, 2]) {
      const sc = match.scores[p];
      const pct = Math.max(0, Math.min(100, (sc / target) * 100));
      html += '<div class="ti-row' + (sc === lead && sc > 0 ? ' lead' : '') + '"><span class="ti-name">' + esc(p === 0 ? 'Du' : NAMES[p]) + '</span><span class="ti-bar"><i style="width:' + pct.toFixed(1) + '%"></i></span><span class="ti-val">' + sc + '</span></div>';
    }
    box.innerHTML = html;
    box.hidden = false;
  }

  /* ---------- Rundenende: Siegerehrung ---------- */
  function showSession(winner) {
    hideModal('modal-summary');
    const sc = match.scores.slice();
    const order = E.standings(sc);
    const target = targetValue();
    const title = winner === 0 ? 'Du gewinnst die Runde!' : NAMES[winner] + ' gewinnt die Runde!';
    const seatImg = winner === 0 ? null : document.querySelector('#seat-' + winner + ' img.ava');
    const src = seatImg && seatImg.getAttribute('src') ? seatImg.getAttribute('src') : AVATARS[winner];
    const ava = winner === 0 ? youFaceHtml(true) : '<img src="' + src + '" alt="">';
    const quotes = [];
    const speakers = winner === 2 ? [2, 1] : [1, 2];
    for (const p of speakers) {
      const ev = winner === p ? 'sessionSelfWins' : winner === 0 ? 'sessionHumanWins' : 'sessionOtherWins';
      const text = Talk.line(WHO[p], ev);
      quotes.push({ p, text });
    }
    const confetti = Array.from({ length: 18 }, (_, i) => '<i style="--x:' + ((i * 37) % 100) + '%;--d:' + (i % 6) * 0.35 + 's;--r:' + ((i * 53) % 360) + 'deg">' + ['♣', '♥', '♠', '♦'][i % 4] + '</i>').join('');
    let html = '<div class="confetti" aria-hidden="true">' + confetti + '</div>' +
      '<p class="sum-kicker">Runde beendet · Spielen bis ' + target + ' · ' + match.gameNo + ' Spiele</p>' +
      '<div class="session-hero">' + ava + '<p class="session-title">' + title + '</p></div>' +
      '<ol class="standings">' + order.map((p, i) => '<li class="' + (i === 0 ? 'first' : '') + '"><span class="place">' + (i + 1) + '.</span><span class="who">' + NAMES[p] + '</span><span class="pts">' + sc[p] + ' Punkte</span></li>').join('') + '</ol>' +
      quotes.map((q) => '<p class="sum-quote">„' + esc(q.text) + '“<small>' + NAMES[q.p] + '</small></p>').join('') +
      '<div class="modal-actions"><button class="btn btn-gold" data-a="new">Neue Runde</button></div>';
    $('session').innerHTML = html;
    showModal('modal-session');
    sys((winner === 0 ? 'Du gewinnst' : NAMES[winner] + ' gewinnt') + ' die Runde mit ' + sc[winner] + ' Punkten.');
    quotes.forEach((q, i) => setTimeout(() => say(q.p, q.text, { force: true }), 400 + i * 300));
    $('session').querySelector('[data-a=new]').addEventListener('click', () => {
      hideModal('modal-session');
      resetMatch();
      sys('Neue Runde: Die Punkteliste ist wieder leer. Gut Blatt!');
      newGame();
    });
  }
  function resetMatch() {
    match = new E.Match({ rules: { mode: settings.mode } });
    match.rows = [];
    saveMatch();
    renderScore();
  }

  /* ---------- Abrechnung ---------- */
  function showSummary(r, quote, sessionWinner) {
    const st = S.st;
    let html = '';
    const q = quote && quote.p ? '<p class="sum-quote">„' + esc(quote.text) + '“<small>' + NAMES[quote.p] + '</small></p>' : '';
    if (r.passedIn) {
      html = '<div class="sum-head"><div><p class="sum-kicker">Spiel ' + match.gameNo + '</p><p class="sum-title">Eingepasst</p></div></div><p>Niemand wollte spielen. Nach offizieller Skatordnung wird neu gegeben, der nächste Geber ist dran.</p>';
    } else if (r.ramsch) {
      const head = r.durchmarsch != null ? NAMES[r.durchmarsch] + (r.durchmarsch === 0 ? ' schaffst' : ' schafft') + ' den Durchmarsch!' : 'Ramsch';
      html = '<div class="sum-head"><div><p class="sum-kicker">Spiel ' + match.gameNo + (r.bock ? ' · Bock' : '') + '</p><p class="sum-title">' + head + '</p></div></div>' +
        '<table class="sum-table"><thead><tr><th>Spieler</th><th>Stiche</th><th>Augen</th><th>Punkte</th></tr></thead><tbody>' +
        [0, 1, 2].map((p) => '<tr><td>' + NAMES[p] + '</td><td>' + r.tricks[p] + '</td><td>' + r.points[p] + '</td><td>' + (r.score[p] > 0 ? '+' : '') + r.score[p] + '</td></tr>').join('') + '</tbody></table>' +
        '<p class="note">Der Skat (' + st.skat.map(C.inlineCard).join(' ') + ') ging an den Gewinner des letzten Stichs.' + (r.jungfrau ? ' Jungfrau: Jemand blieb ohne Stich, das verdoppelt.' : '') + (r.bock ? ' Bock: zählt doppelt.' : '') + '</p>';
    } else {
      const d = r.declarer;
      const you = d === 0;
      const title = you ? (r.won ? 'Gewonnen!' : 'Verloren') : NAMES[d] + (r.won ? ' gewinnt' : ' verliert');
      const ava = you ? youFaceHtml(false) : '<img src="' + AVATARS[d] + '" alt="">';
      const g = r.game;
      let calc;
      if (g.type === 'null') calc = E.gameLabel(g) + ' = ' + E.nullValue(g);
      else calc = r.parts.map((p) => p.label).join(' + ') + ' = ' + r.multiplier + ' × ' + E.baseValue(g) + ' = ' + (r.multiplier * E.baseValue(g));
      if (r.kontra) {
        const before = r.value / (r.re ? 4 : 2);
        calc += ' → ' + before + (r.re ? ' × 4 (Kontra und Re)' : ' × 2 (Kontra)') + ' = ' + r.value;
      }
      const extras = [];
      if (r.schwarz) extras.push('Schwarz');
      else if (r.schneider) extras.push('Schneider');
      html = '<div class="sum-head">' + ava + '<div><p class="sum-kicker">Spiel ' + match.gameNo + ' · Abrechnung' + (r.bock ? ' · Bock' : '') + '</p><p class="sum-title ' + (r.won ? 'won' : 'lost') + '">' + title + '</p></div></div>' +
        '<dl class="sum-grid">' +
        '<dt>Alleinspieler</dt><dd>' + (you ? 'Du' : NAMES[d]) + ' (' + E.positionName(st, d) + ')</dd>' +
        '<dt>Spiel</dt><dd>' + esc(E.gameLabel(g)) + '</dd>' +
        '<dt>Reizwert</dt><dd>' + r.bid + '</dd>' +
        (g.type !== 'null' ? '<dt>Augen</dt><dd>' + r.declarerPoints + ' : ' + r.defenderPoints + (extras.length ? ' (' + extras.join(', ') + ')' : '') + '</dd>' : '<dt>Stiche</dt><dd>' + r.declarerTricks + (r.won ? ', kein einziger Stich' : '') + '</dd>') +
        (g.type !== 'null' ? '<dt>Spitzen</dt><dd>' + (r.matadors.mit ? 'mit ' : 'ohne ') + r.matadors.count + '</dd>' : '') +
        '<dt>Berechnung</dt><dd>' + esc(calc) + '</dd>' +
        (r.overbid ? '<dt>Überreizt</dt><dd>Ja: Der Spielwert reicht nicht für ' + r.bid + '. Gewertet wird das nächste Vielfache des Grundwerts: ' + r.value + '.</dd>' : '') +
        '<dt>Spielwert</dt><dd>' + r.value + (r.won ? '' : ', verloren zählt doppelt') + (r.bock ? ', Bock doppelt' : '') + '</dd>' +
        '<dt>Skat</dt><dd><span class="sum-skat">' + st.skat.map(C.inlineCard).join(' ') + '</span>' + (st.skatTaken ? ' (gedrückt)' : ' (Hand)') + '</dd>' +
        '</dl>' +
        '<div class="sum-score"><span>' + (you ? 'Deine Punkte' : 'Punkte für ' + NAMES[d]) + '</span><span class="big ' + (r.scoreChange > 0 ? 'pos' : 'neg') + '">' + (r.scoreChange > 0 ? '+' : '') + r.scoreChange + '</span></div>';
    }
    html += q;
    const done = sessionWinner != null;
    if (done) html += '<p class="sum-target">' + (sessionWinner === 0 ? 'Du hast' : NAMES[sessionWinner] + ' hat') + ' das Ziel von ' + targetValue() + ' Punkten erreicht!</p>';
    html += '<div class="modal-actions"><button class="btn btn-ghost-dark" data-a="last">Letzten Stich ansehen</button><button class="btn btn-gold" data-a="next">' + (done ? 'Zur Siegerehrung' : 'Nächstes Spiel') + '</button></div>';
    $('summary').innerHTML = html;
    if (r.passedIn) $('summary').querySelector('[data-a=last]').remove();
    showModal('modal-summary');
    $('summary').querySelector('[data-a=next]').addEventListener('click', () => (done ? showSession(sessionWinner) : newGame()));
    const lb = $('summary').querySelector('[data-a=last]');
    if (lb) lb.addEventListener('click', openLastTrick);
    if (lernen() && !done && zui()) {
      zui().nachRunde(() => {
        const next = $('summary') && $('summary').querySelector('[data-a=next]');
        if (next) next.click();
      });
    }
  }

  /* ---------- Modale ---------- */
  function showModal(id) { $(id).hidden = false; }
  function hideModal(id) { $(id).hidden = true; }
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => {
      if (e.target === m && m.id !== 'modal-summary' && m.id !== 'modal-session') hideModal(m.id);
      if (e.target.closest('[data-close]')) hideModal(m.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') ['modal-last', 'modal-settings'].forEach(hideModal);
  });

  function openLastTrick() {
    const st = S.st;
    const lt = st.lastTrick ? { trick: st.lastTrick, game: st.game } : S.prevLastTrick;
    if (!lt) return;
    const box = $('last-trick');
    box.innerHTML = '';
    for (const x of lt.trick.cards) {
      const it = document.createElement('div');
      it.className = 'lt-item' + (x.player === lt.trick.winner ? ' win' : '');
      it.appendChild(C.cardEl(x.card));
      const n = document.createElement('span');
      n.textContent = NAMES[x.player] + (x.player === lt.trick.winner ? ' (sticht)' : '');
      it.appendChild(n);
      box.appendChild(it);
    }
    const p = document.createElement('p');
    p.className = 'note';
    p.style.width = '100%'; p.style.textAlign = 'center';
    p.textContent = lt.trick.points + ' Augen in diesem Stich.';
    box.appendChild(p);
    showModal('modal-last');
  }

  /* ---------- Eingaben ---------- */
  $('hand').addEventListener('click', onHandClick);
  $('hand').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHandClick(e); } });
  async function onHandClick(e) {
    const el = e.target.closest('.card');
    if (!el || !S.st) return;
    const c = el.dataset.card;
    const st = S.st;
    if (st.phase === 'discard' && st.declarer === 0) {
      if (S.selected.includes(c)) S.selected = S.selected.filter((x) => x !== c);
      else if (S.selected.length < 2) S.selected.push(c);
      else { S.selected.shift(); S.selected.push(c); }
      renderHand(); showDiscardPanel();
      return;
    }
    const legal = humanLegal();
    if (!legal) return;
    if (!legal.includes(c)) {
      if (settings.hints) { const hb = $('hint-box'); hb.classList.remove('shake'); void hb.offsetWidth; hb.classList.add('shake'); }
      return;
    }
    S.busy = true;
    S.humanLegalAtPlay = legal;
    $('hint-box').hidden = true;
    try { await doPlay(0, c); }
    catch (err) { if (err !== CANCEL) console.error(err); return; }
    finally { S.busy = false; }
    advance();
  }

  $('btn-hint').addEventListener('click', () => {
    settings.hints = !settings.hints;
    store('sf-skat-settings', settings);
    $('btn-hint').setAttribute('aria-pressed', String(settings.hints));
    if (settings.hints) sys('Regeln lernen ist an: Erlaubte Karten leuchten grün, dazu gibt es Tipps.');
    render();
    const st = S.st;
    if (st && st.declarer === 0 && !$('panel').hidden) {
      if (st.phase === 'skat') showSkatPanel(); else if (st.phase === 'discard') showDiscardPanel(); else if (st.phase === 'declare') showDeclarePanel();
    }
    if (st && st.phase === 'bidding') { const t = E.biddingTurn(st); if (t.player === 0) showBidPanel(t); }
  });
  $('btn-last').addEventListener('click', openLastTrick);
  function syncSettingsUI() {
    for (const name of ['mode', 'deck', 'speed', 'level', 'target', 'talk']) {
      document.querySelectorAll('#modal-settings input[name=' + name + ']').forEach((i) => (i.checked = i.value === String(settings[name])));
    }
    $('target-custom').value = settings.targetCustom;
    $('target-custom-wrap').classList.toggle('off', settings.target !== 'custom');
    $('target-custom').disabled = settings.target !== 'custom';
    $('opt-sound').checked = !!settings.sound;
    $('opt-volume').value = settings.volume;
    $('opt-volume').disabled = !settings.sound;
    $('opt-volume-out').textContent = settings.volume + ' %';
    const sup = micSupport();
    const note = $('talk-support');
    note.hidden = sup.ok;
    note.textContent = sup.ok ? '' : sup.text;
    syncHandsFreeControls();
  }
  function openSettings() { syncSettingsUI(); showModal('modal-settings'); }
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-level').addEventListener('click', openSettings);
  document.querySelectorAll('#modal-settings input[type=radio]').forEach((i) => i.addEventListener('change', () => {
    settings[i.name] = i.value;
    saveSettings();
    if (i.name === 'mode') { sys('Regeln ab dem nächsten Spiel: ' + (i.value === 'kneipe' ? 'Kneipenskat (Ramsch und Bock).' : 'Offizielle Skatordnung.')); }
    if (i.name === 'level') sys('Spielstärke ab dem nächsten Spiel: ' + LEVEL_NAMES[i.value] + '.');
    if (i.name === 'target') { sys(targetValue() ? 'Gespielt wird bis ' + targetValue() + ' Punkte.' : 'Gespielt wird ohne Limit.'); if (i.value === 'custom') setTimeout(() => $('target-custom').focus(), 0); }
    if (i.name === 'talk') applyTalkMode(true);
    syncSettingsUI();
    renderScore();
    renderTopbar();
    render();
  }));
  $('target-custom').addEventListener('change', () => {
    const v = E.normalizeTarget('custom', $('target-custom').value);
    settings.targetCustom = v || DEFAULTS.targetCustom;
    saveSettings();
    syncSettingsUI();
    renderScore();
    sys('Gespielt wird bis ' + settings.targetCustom + ' Punkte.');
  });
  $('opt-sound').addEventListener('change', () => setSound($('opt-sound').checked));
  $('opt-volume').addEventListener('input', () => {
    settings.volume = +$('opt-volume').value;
    $('opt-volume-out').textContent = settings.volume + ' %';
    if (Voice) Voice.setVolume();
  });
  $('opt-volume').addEventListener('change', saveSettings);
  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Punkteliste wirklich zurücksetzen? Das laufende Spiel wird neu gegeben.')) return;
    resetMatch();
    hideModal('modal-settings');
    sys('Punkteliste zurückgesetzt.');
    newGame();
  });

  let chatBusy = false;
  $('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (chatBusy) return;
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.classList.remove('interim');
    MIC.userEdit = false;
    MIC.finalText = '';
    MIC.interim = '';
    clearTimeout(MIC.silence);
    logLine('<b>Du:</b> ' + esc(text), 'you');
    say(0, text, { force: true });
    const who = Talk.responders(text);
    chatBusy = true;
    try {
      for (const w of who) {
        const seat = WHO.indexOf(w);
        if (seat < 1) continue;
        const typing = showTyping(NAMES[seat]);
        const started = Date.now();
        let reply = '';
        try {
          const st = S.st;
          reply = await Talk.askAI(w, {
            message: text,
            game: st ? { phase: st.phase, declarer: st.declarer, game: st.game ? E.gameLabel(st.game) : null, scores: match.scores.slice() } : null,
          });
        } finally {
          const left = 400 - (Date.now() - started);
          if (left > 0) await sleep(left);
          if (typing && typing.parentNode) typing.parentNode.removeChild(typing);
        }
        say(seat, reply, { force: true, priority: true });
      }
    } finally {
      chatBusy = false;
    }
  });

  /* ---------- Ton und Mitreden (Oberleiste) ---------- */
  function renderTopbar() {
    $('level-label').textContent = LEVEL_NAMES[settings.level];
    $('btn-level').dataset.level = settings.level;
    $('btn-level').title = 'Spielstärke: ' + LEVEL_NAMES[settings.level] + (settings.level !== S.level ? ' (ab dem nächsten Spiel)' : '') + '. Klick öffnet die Einstellungen.';
    $('btn-sound').setAttribute('aria-pressed', String(!!settings.sound));
    $('btn-sound').classList.toggle('off', !settings.sound);
    $('btn-sound').title = settings.sound ? 'Ton ist an: Die Mitspieler sprechen. Klick schaltet stumm.' : 'Ton ist aus. Klick schaltet die Stimmen ein.';
    $('btn-talk').setAttribute('aria-pressed', String(settings.talk === 'voice'));
    $('btn-talk').title = settings.talk === 'voice' ? 'Mitreden mit Mikrofon ist an. Klick wechselt zu Nur Chat.' : 'Mitreden: Nur Chat. Klick schaltet das Mikrofon dazu.';
  }
  function setSound(on) {
    settings.sound = !!on;
    saveSettings();
    if (!on && Voice) Voice.stopAll();
    if (on && Voice) Voice.unlock();
    renderTopbar();
    if (!$('modal-settings').hidden) syncSettingsUI();
    sys(on ? 'Ton an: Horst und Margarethe sprechen.' : 'Ton aus: Die beiden reden nur noch in Sprechblasen.');
  }
  $('btn-sound').addEventListener('click', () => setSound(!settings.sound));
  $('btn-talk').addEventListener('click', () => {
    settings.talk = settings.talk === 'voice' ? 'chat' : 'voice';
    saveSettings();
    applyTalkMode(true);
    renderTopbar();
  });

  /* ---------- Spracheingabe (Web Speech API) ----------
   * Drücken zum Sprechen, oder Freisprechen ohne Senden-Knopf.
   * Chrome und Edge können das, Safari teilweise, Firefox nicht.
   * Braucht http(s) oder localhost, von file:// aus klappt es meist nicht (siehe README).
   * TODO Produktion: optional ElevenLabs Scribe auf dem Server (Audio hochladen, Text zurück), Schlüssel nur serverseitig.
   */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SILENCE_MS = 1100;
  const MIC = { rec: null, on: false, mode: '', downAt: 0, finalText: '', interim: '', want: false, muted: false, pausedForVoice: false, gesture: false, userEdit: false, writing: false, spoken: [], silence: 0, restart: 0 };
  function micSupport() {
    if (!SR) return { ok: false, text: 'Dein Browser kann leider keine Spracheingabe (das klappt in Chrome oder Edge). Du kannst einfach weiter schreiben.' };
    if (!window.isSecureContext) return { ok: false, text: 'Die Spracheingabe braucht eine Adresse mit http://localhost. Starte die Seite mit start.command bzw. start.bat (siehe README). Bis dahin: einfach schreiben.' };
    return { ok: true };
  }
  function normSpeech(s) {
    return String(s || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9 ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function speechDist(a, b) {
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    if (Math.abs(m - n) > Math.max(m, n) * 0.45) return Math.max(m, n);
    let prev = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[n];
  }
  function rememberSpoken(text) {
    const norm = normSpeech(text);
    if (!norm) return;
    MIC.spoken.push({ norm, at: Date.now() });
    const now = Date.now();
    MIC.spoken = MIC.spoken.filter((l) => now - l.at < 15000).slice(-8);
  }
  function isEcho(text) {
    const a = normSpeech(text);
    if (!a) return false;
    const now = Date.now();
    for (const line of MIC.spoken) {
      if (now - line.at > 15000) continue;
      const b = line.norm;
      if (!b) continue;
      if (a === b) return true;
      const shorter = a.length <= b.length ? a : b;
      const longer = a.length <= b.length ? b : a;
      if (shorter.length >= 10 && longer.indexOf(shorter) !== -1) return true;
      if (shorter.length < 8) continue;
      if (1 - speechDist(a, b) / Math.max(a.length, b.length) >= 0.78) return true;
    }
    return false;
  }
  function setMicStatus(state) {
    const el = $('hf-state');
    const map = { 'hört zu': 'hoert', pausiert: 'pausiert', aus: 'aus' };
    if (el) { el.dataset.state = map[state] || 'aus'; }
    const label = $('hf-label');
    if (label) label.textContent = state;
    const input = $('chat-input');
    if (!input || MIC.userEdit) return;
    if (!(settings.handsFree && settings.talk === 'voice' && micSupport().ok)) return;
    if (state === 'hört zu') input.placeholder = 'Sprich einfach los ...';
    else if (state === 'pausiert') input.placeholder = 'Kurz pausiert, die anderen reden ...';
    else input.placeholder = 'Mikrofon ist aus';
  }
  function updateMuteButton() {
    const btn = $('btn-hf-mute');
    if (!btn) return;
    btn.textContent = MIC.muted ? 'Wieder an' : 'Stumm';
    btn.setAttribute('aria-pressed', String(!!MIC.muted));
    btn.title = MIC.muted ? 'Mikrofon wieder einschalten' : 'Mikrofon kurz stummschalten';
  }
  function writeComposer(text, interim) {
    const input = $('chat-input');
    if (!input || MIC.userEdit) return;
    MIC.writing = true;
    input.value = text;
    input.classList.toggle('interim', !!interim);
    MIC.writing = false;
  }
  function clearComposer() {
    clearTimeout(MIC.silence);
    MIC.finalText = '';
    MIC.interim = '';
    if (!MIC.userEdit) writeComposer('', false);
  }
  function syncHandsFreeControls() {
    const voice = settings.talk === 'voice';
    const sup = micSupport();
    const block = $('handsfree-block');
    if (block) block.hidden = !voice;
    const box = $('opt-handsfree');
    if (box) {
      box.disabled = !sup.ok;
      box.checked = !!(sup.ok && settings.handsFree);
    }
    const unsupported = $('handsfree-support');
    if (unsupported) {
      unsupported.hidden = !voice || sup.ok;
      unsupported.textContent = sup.ok ? '' : 'Freisprechen geht in diesem Browser nicht. Chrome und Edge können Dich hören, Firefox noch nicht. Du kannst weiter schreiben.';
    }
    const phones = $('handsfree-phones');
    if (phones) phones.hidden = !voice || !sup.ok;
    const on = voice && sup.ok && !!settings.handsFree;
    $('hf-bar').hidden = !on;
    updateMuteButton();
    $('btn-mic').title = on
      ? 'Freisprechen ist an. Klick schaltet das Mikrofon stumm oder wieder an.'
      : 'Klicken oder gedrückt halten und sprechen';
    if (!on) setMicStatus('aus');
  }
  function handsFreeWanted() {
    return settings.talk === 'voice' && !!settings.handsFree && micSupport().ok;
  }
  function shouldListen() {
    return settings.talk === 'voice' && settings.handsFree && micSupport().ok && !MIC.muted && !MIC.pausedForVoice && MIC.gesture;
  }
  function abortRec() {
    const rec = MIC.rec;
    MIC.rec = null;
    MIC.on = false;
    if (!rec) return;
    rec.onend = null;
    rec.onerror = null;
    rec.onresult = null;
    try { rec.abort(); } catch (e) { try { rec.stop(); } catch (e2) { /* egal */ } }
  }
  function stopAllMic() {
    MIC.want = false;
    clearTimeout(MIC.silence);
    clearTimeout(MIC.restart);
    abortRec();
    $('btn-mic').classList.remove('rec');
    $('btn-mic').setAttribute('aria-pressed', 'false');
    if (!settings.handsFree || settings.talk !== 'voice') {
      $('chat-input').placeholder = settings.talk === 'voice' && micSupport().ok ? 'Schreib was oder drück das Mikrofon ...' : 'Schreib was in die Runde ...';
    }
  }
  function flushUtterance() {
    if (!settings.handsFree || MIC.pausedForVoice || MIC.muted || MIC.userEdit) return;
    const text = (MIC.finalText + (MIC.interim || '')).trim();
    MIC.finalText = '';
    MIC.interim = '';
    if (!text || normSpeech(text).length < 2) { clearComposer(); return; }
    if (isEcho(text)) { clearComposer(); return; }
    writeComposer(text, false);
    $('chat-form').requestSubmit();
  }
  function armSilence() {
    clearTimeout(MIC.silence);
    MIC.silence = setTimeout(flushUtterance, SILENCE_MS);
  }
  function bindHandsFree(rec) {
    const input = $('chat-input');
    rec.onresult = (ev) => {
      if (MIC.rec !== rec || MIC.pausedForVoice) return;
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) MIC.finalText += t;
        else interim += t;
      }
      MIC.interim = interim;
      const shown = (MIC.finalText + interim).trim();
      if (shown && isEcho(shown)) {
        MIC.finalText = '';
        MIC.interim = '';
        clearTimeout(MIC.silence);
        if (!MIC.userEdit) writeComposer('', false);
        return;
      }
      writeComposer(shown, !!interim);
      if (shown) armSilence();
    };
    rec.onerror = (ev) => {
      if (!ev || ev.error === 'no-speech' || ev.error === 'aborted') return;
      const msg = { 'not-allowed': 'Das Mikrofon ist nicht freigegeben. Erlaube es in der Adressleiste oder schreib einfach.', 'service-not-allowed': 'Die Spracheingabe ist in diesem Browser gesperrt. Schreib einfach.', 'audio-capture': 'Kein Mikrofon gefunden.', network: 'Die Spracheingabe braucht eine Internetverbindung (Chrome schickt das Audio an Google).' }[ev.error];
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed' || ev.error === 'audio-capture') {
        MIC.want = false;
        setMicStatus('aus');
      }
      if (msg) sys(msg);
    };
    rec.onend = () => {
      if (MIC.rec !== rec) return;
      MIC.rec = null;
      MIC.on = false;
      $('btn-mic').classList.remove('rec');
      $('btn-mic').setAttribute('aria-pressed', 'false');
      if (MIC.want && !MIC.pausedForVoice && !MIC.muted && settings.handsFree && settings.talk === 'voice') {
        setTimeout(() => { if (shouldListen() && !MIC.on) startHandsFree(); }, 250);
      }
    };
    input.placeholder = 'Sprich einfach los ...';
  }
  function startHandsFree() {
    if (!shouldListen() || !SR) return;
    if (MIC.on && MIC.mode === 'handsfree') return;
    abortRec();
    const rec = new SR();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    MIC.rec = rec;
    MIC.on = true;
    MIC.mode = 'handsfree';
    MIC.want = true;
    bindHandsFree(rec);
    try { rec.start(); }
    catch (e) { MIC.on = false; MIC.rec = null; setMicStatus('aus'); return; }
    $('btn-mic').classList.add('rec');
    $('btn-mic').setAttribute('aria-pressed', 'true');
    $('btn-mic').title = 'Freisprechen läuft. Klick schaltet das Mikrofon stumm.';
    setMicStatus('hört zu');
  }
  function ensureHandsFree() {
    if (!shouldListen()) return;
    if (MIC.on && MIC.mode === 'handsfree') { setMicStatus('hört zu'); return; }
    startHandsFree();
  }
  function applyHandsFree(announce) {
    syncHandsFreeControls();
    const on = settings.talk === 'voice' && settings.handsFree && micSupport().ok;
    if (!on) {
      stopAllMic();
      setMicStatus('aus');
    } else if (MIC.muted) {
      stopAllMic();
      setMicStatus('aus');
    } else if (MIC.pausedForVoice) {
      setMicStatus('pausiert');
    } else {
      ensureHandsFree();
    }
    if (announce) sys(on && !MIC.muted ? 'Freisprechen ist an. Sprich einfach los, der Satz geht nach einer kurzen Pause raus. Am besten mit Kopfhörer.' : 'Freisprechen ist aus. Das Mikrofon startet nur, wenn Du auf den Knopf drückst.');
  }
  function toggleMute() {
    MIC.muted = !MIC.muted;
    MIC.gesture = true;
    if (MIC.muted) {
      clearTimeout(MIC.restart);
      clearTimeout(MIC.silence);
      MIC.want = false;
      abortRec();
      $('btn-mic').classList.remove('rec');
      $('btn-mic').setAttribute('aria-pressed', 'false');
      setMicStatus('aus');
    } else if (Voice && Voice.busy && Voice.busy()) {
      MIC.pausedForVoice = true;
      setMicStatus('pausiert');
    } else {
      MIC.pausedForVoice = false;
      ensureHandsFree();
    }
    updateMuteButton();
  }
  if (Voice && Voice.onPlayback) {
    Voice.onPlayback((phase, text) => {
      if (phase === 'start' && text) rememberSpoken(text);
      if (!(settings.handsFree && settings.talk === 'voice' && micSupport().ok)) return;
      if (phase === 'start') {
        clearTimeout(MIC.restart);
        MIC.pausedForVoice = true;
        clearTimeout(MIC.silence);
        MIC.finalText = '';
        MIC.interim = '';
        if (!MIC.userEdit) writeComposer('', false);
        MIC.want = false;
        abortRec();
        $('btn-mic').classList.remove('rec');
        $('btn-mic').setAttribute('aria-pressed', 'false');
        if (!MIC.muted) setMicStatus('pausiert');
      } else if (phase === 'idle') {
        if (MIC.muted) { setMicStatus('aus'); return; }
        clearTimeout(MIC.restart);
        MIC.restart = setTimeout(() => {
          MIC.pausedForVoice = false;
          if (MIC.muted || !settings.handsFree) { setMicStatus('aus'); return; }
          ensureHandsFree();
        }, 300);
      }
    });
  }
  $('chat-input').addEventListener('input', () => {
    if (MIC.writing) return;
    MIC.userEdit = $('chat-input').value.length > 0;
  });
  $('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.ctrlKey || e.metaKey || e.altKey) return;
    MIC.userEdit = true;
  });
  $('btn-hf-mute').addEventListener('click', () => { if (settings.handsFree && settings.talk === 'voice') toggleMute(); });
  $('opt-handsfree').addEventListener('change', () => {
    if ($('opt-handsfree').disabled) return;
    settings.handsFree = $('opt-handsfree').checked;
    MIC.muted = false;
    MIC.gesture = true;
    saveSettings();
    applyHandsFree(true);
    renderTopbar();
  });
  function applyTalkMode(announce) {
    const voice = settings.talk === 'voice';
    const sup = micSupport();
    $('btn-mic').hidden = !(voice && sup.ok);
    $('mic-hint').hidden = !(voice && !sup.ok);
    $('mic-hint').textContent = voice && !sup.ok ? sup.text : '';
    if (!voice || !settings.handsFree) {
      $('chat-input').placeholder = voice && sup.ok ? 'Schreib was oder drück das Mikrofon ...' : 'Schreib was in die Runde ...';
    }
    if (!voice) { MIC.muted = false; stopAllMic(); }
    syncHandsFreeControls();
    if (voice && settings.handsFree && sup.ok) applyHandsFree(false);
    if (announce) {
      if (!voice) sys('Mitreden: Nur Chat.');
      else if (!sup.ok) sys('Mitreden mit Stimme geht in diesem Browser nicht, Du kannst weiter schreiben.');
      else if (settings.handsFree) sys('Freisprechen ist an. Sprich einfach los, der Satz geht nach einer kurzen Pause raus. Am besten mit Kopfhörer.');
      else sys('Mitreden mit Stimme: Klick aufs Mikrofon (oder halt es gedrückt) und sprich.');
    }
  }
  function startMic() {
    if (handsFreeWanted() || MIC.on || !SR) return;
    MIC.want = false;
    MIC.mode = 'ptt';
    clearTimeout(MIC.silence);
    clearTimeout(MIC.restart);
    if (Voice) { Voice.unlock(); Voice.stopAll(); }
    const rec = new SR();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    MIC.rec = rec; MIC.on = true; MIC.finalText = '';
    const input = $('chat-input');
    rec.onresult = (ev) => {
      let interim = '', fin = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) fin += t; else interim += t;
      }
      if (fin) MIC.finalText += fin;
      input.value = (MIC.finalText + interim).trim();
      input.classList.toggle('interim', !!interim);
    };
    rec.onerror = (ev) => {
      const msg = { 'not-allowed': 'Das Mikrofon ist nicht freigegeben. Erlaube es in der Adressleiste oder schreib einfach.', 'service-not-allowed': 'Die Spracheingabe ist in diesem Browser gesperrt. Schreib einfach.', 'no-speech': 'Ich habe nichts gehört. Versuch es nochmal.', 'audio-capture': 'Kein Mikrofon gefunden.', network: 'Die Spracheingabe braucht eine Internetverbindung (Chrome schickt das Audio an Google).' }[ev.error];
      if (msg) sys(msg);
    };
    rec.onend = () => {
      if (MIC.rec !== rec || MIC.mode !== 'ptt') return;
      MIC.on = false; MIC.rec = null;
      $('btn-mic').classList.remove('rec');
      $('btn-mic').setAttribute('aria-pressed', 'false');
      input.classList.remove('interim');
      const text = MIC.finalText.trim() || input.value.trim();
      MIC.finalText = '';
      if (text && !isEcho(text)) { input.value = text; $('chat-form').requestSubmit(); }
      else if (!MIC.userEdit) input.value = '';
    };
    try { rec.start(); } catch (e) { MIC.on = false; return; }
    $('btn-mic').classList.add('rec');
    $('btn-mic').setAttribute('aria-pressed', 'true');
    input.value = '';
    input.placeholder = 'Ich höre zu ...';
  }
  function stopMic() {
    if (handsFreeWanted() || MIC.mode === 'handsfree') return;
    if (MIC.rec) { try { MIC.rec.stop(); } catch (e) { /* egal */ } }
    $('chat-input').placeholder = settings.talk === 'voice' && micSupport().ok ? 'Schreib was oder drück das Mikrofon ...' : 'Schreib was in die Runde ...';
  }
  function onMicButton(e) {
    if (!handsFreeWanted()) return false;
    if (e) e.preventDefault();
    MIC.gesture = true;
    if (MIC.muted || (MIC.on && MIC.mode === 'handsfree')) toggleMute();
    else ensureHandsFree();
    return true;
  }
  // Klicken = an/aus, gedrückt halten = sprechen solange gehalten. Bei Freisprechen: stumm oder wieder an.
  $('btn-mic').addEventListener('pointerdown', (e) => {
    if (onMicButton(e)) return;
    e.preventDefault();
    MIC.downAt = Date.now();
    MIC.wasOn = MIC.on;
    if (!MIC.on) startMic();
  });
  $('btn-mic').addEventListener('pointerup', () => {
    if (handsFreeWanted()) return;
    const held = Date.now() - MIC.downAt > 450;
    if (MIC.wasOn || held) stopMic();
  });
  $('btn-mic').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (onMicButton(e)) return;
    if (MIC.on) stopMic(); else startMic();
  });

  /* ---------- Start ---------- */
  // Browser erlauben Ton erst nach einer Nutzeraktion: der erste Klick irgendwo entsperrt die Stimmen.
  const unlockOnce = () => { if (Voice) Voice.unlock(); };
  document.addEventListener('pointerdown', unlockOnce, { once: true, capture: true });
  document.addEventListener('keydown', unlockOnce, { once: true, capture: true });
  document.addEventListener('pointerdown', (e) => {
    MIC.gesture = true;
    const t = e.target;
    if (t && t.closest && (t.closest('#btn-mic') || t.closest('#btn-hf-mute') || t.closest('#handsfree-label'))) return;
    ensureHandsFree();
  }, true);

  refreshPlayerSeat();
  window.addEventListener('sf-avatar', refreshPlayerSeat);
  window.addEventListener('storage', (e) => { if (!e.key || e.key === 'sf-player-avatar') refreshPlayerSeat(); });

  $('btn-hint').setAttribute('aria-pressed', String(settings.hints));
  document.body.classList.toggle('deck-two', settings.deck === 'two');
  renderScore();
  renderTopbar();
  applyTalkMode(false);
  $('intro-small').textContent = 'Spielstärke: ' + LEVEL_NAMES[settings.level] + ' · ' + (targetValue() ? 'Spielen bis ' + targetValue() : 'ohne Limit') + ' · Ton ' + (settings.sound ? 'an' : 'aus');
  paintFreeRounds();
  sys('Willkommen in der Eckkneipe. Nimm Platz, dann wird gegeben.');
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();

  function start() {
    if (S.started) return false;
    if (!roundGate()) return false;
    S.started = true;
    unlockOnce();
    $('intro').hidden = true;
    say(2, Talk.line(WHO[2], 'welcome'), { force: true });
    setTimeout(() => say(1, Talk.line(WHO[1], 'welcome'), { force: true }), 250);
    const w = E.sessionWinner(match.scores, targetValue());
    if (w != null && match.rows.length) { S.st = null; showSession(w); return true; }
    newGame();
    return true;
  }
  $('btn-start').addEventListener('click', start);
  if (zui()) {
    zui().mount({
      start: start,
      uebernehmen: function () { render(); },
      sprich: function (platz, text) {
        const id = WHO[platz] || WHO[1] || WHO[2];
        if (!id || !settings.sound || !Voice) return false;
        Voice.unlock();
        return Voice.speak(id, text, { priority: true });
      }
    });
  }

  // Besetzung steht, bevor eine Runde (auch per autostart) losgeht.
  if (window.SpielpartnerRunde) {
    SpielpartnerRunde.mount({
      game: 'skat',
      count: function () { return 2; },
      inHand: function () {
        if (!S.started || !S.st || S.st.phase === 'done') return false;
        const summary = $('modal-summary');
        const session = $('modal-session');
        if (summary && !summary.hidden) return false;
        if (session && !session.hidden) return false;
        return true;
      },
      apply: applyLineup,
    });
  } else applyLineup();

  if (params.get('autostart')) start();

  // Für automatisierte Tests (Screenshots): Zugriff auf den Zustand, keine Spiellogik-Abkürzungen
  window.__skat = {
    get state() { return S.st; }, get match() { return match; }, settings, E, voice: Voice, start, showSession,
    handsFree: { norm: normSpeech, echo: isEcho, remember: rememberSpoken, get mic() { return MIC; } }
  };
})();
