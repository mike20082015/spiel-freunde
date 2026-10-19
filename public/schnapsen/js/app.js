/* Tisch fürs Schnapsen: Karten, Talon, Chat, Freisprechen. */
(function () {
  'use strict';
  var E = window.SchnapsenEngine;
  var AI = window.SchnapsenAI;
  var Seats = window.SchnapsenSeats.seats;
  var Cards = window.SchnapsenCards;
  var Talk = window.SchnapsenTalk;
  var Voice = window.SchnapsenVoice;
  var KEY = 'sf-schnapsen-settings';
  var DEFAULTS = {
    level: 'kneipe', target: '7', targetCustom: 7, deck: 'german',
    marriageNeedsTrick: true, allowExchange: true, exchangeStrict: false,
    allowClose: true, lastTrickWins: true,
    sound: true, volume: 80, talk: 'chat', handsFree: false, hints: false, speed: 'normal'
  };
  var LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  var DELAY = { slow: 900, normal: 480, fast: 220 };
  var REASON = {
    '66': '66 Augen',
    last: 'letzter Stich',
    eyes: 'mehr Augen',
    'close-fail': 'Zudrehen nicht gehalten',
    tie: 'unentschieden'
  };
  var NAMES = ['Du', 'Sepp'];

  var settings = loadSettings();
  var table = null;
  var started = false;
  var generation = 0;
  var lastTrick = null;
  var bubbles = {};
  var chatBusy = false;
  var handClosed = false;

  function $(id) { return document.getElementById(id); }
  function loadSettings() {
    var out = Object.assign({}, DEFAULTS);
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      Object.keys(DEFAULTS).forEach(function (k) { if (raw[k] != null) out[k] = raw[k]; });
    } catch (e) { /* leerer Speicher */ }
    return out;
  }
  function saveSettings() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* privat */ }
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function delay() { return DELAY[settings.speed] || DELAY.normal; }
  function opts() {
    return {
      target: settings.target,
      custom: settings.targetCustom,
      deck: settings.deck,
      marriageNeedsTrick: !!settings.marriageNeedsTrick,
      allowExchange: !!settings.allowExchange,
      exchangeStrict: !!settings.exchangeStrict,
      allowClose: !!settings.allowClose,
      lastTrickWins: !!settings.lastTrickWins
    };
  }
  function roundsAllow() {
    return !window.SpielpartnerRounds || SpielpartnerRounds.gate();
  }
  function nameOf(seat) {
    return Seats[seat] ? Seats[seat].name : NAMES[seat] || 'Spieler';
  }

  function refreshFaces() {
    if (window.SpielpartnerLineup) SpielpartnerLineup.dress(Seats, 'schnapsen', localStorage);
    Seats.forEach(function (p) {
      NAMES[p.seat] = p.name;
      if (p.id === 'du') return;
      var node = $('seat-' + p.seat);
      if (!node) return;
      var name = node.querySelector('.seat-name');
      if (name) name.textContent = p.name;
      var ini = node.querySelector('.ini');
      if (ini) ini.textContent = p.initials;
      if (window.SpielpartnerLineup) SpielpartnerLineup.paintSeat($('ava-' + p.seat), p);
    });
  }

  async function mountYou() {
    var api = window.SpielFreundeAvatar;
    if (!api || typeof api.playerSeat !== 'function') return;
    var info;
    try { info = await api.playerSeat(); } catch (e) { return; }
    if (!info) return;
    if ($('you-ini')) $('you-ini').textContent = info.initial || 'Du';
    if (!info.imageUrl) return;
    var img = document.createElement('img');
    img.className = 'ava';
    img.alt = '';
    img.addEventListener('error', function () { img.remove(); });
    img.src = info.imageUrl;
    $('you-ava').appendChild(img);
  }

  function logLine(html, cls) {
    var row = document.createElement('p');
    row.className = 'cl' + (cls ? ' ' + cls : '');
    row.innerHTML = html;
    var log = $('chat-log');
    log.appendChild(row);
    log.scrollTop = log.scrollHeight;
  }
  function sys(text) { logLine(esc(text), 'sys'); }
  function say(seat, text, optsSay) {
    optsSay = optsSay || {};
    if (!text) return;
    var bubble = $('bubble-' + seat);
    if (bubble) {
      bubble.textContent = text;
      bubble.classList.add('show');
      clearTimeout(bubbles[seat]);
      bubbles[seat] = setTimeout(function () { bubble.classList.remove('show'); }, 3400);
    }
    if (seat !== 0 && optsSay.log !== false) logLine('<b>' + esc(nameOf(seat)) + ':</b> ' + esc(text));
    if (seat !== 0 && settings.sound && optsSay.voice !== false) Voice.speak(Seats[seat].id, text, { priority: !!optsSay.priority });
  }

  function publicGame() {
    if (!table) return null;
    return {
      table: 'schnapsen',
      phase: table.phase,
      trump: E.suitName(table.trump, settings.deck),
      game: 'Schnapsen, Trumpf ' + E.suitName(table.trump, settings.deck),
      scores: table.scores.slice(),
      eyes: table.points.slice()
    };
  }

  function renderBacks() {
    var box = $('backs-1');
    if (!box) return;
    box.innerHTML = '';
    var n = table && table.hands ? Math.min(table.hands[1].length, 5) : 0;
    for (var i = 0; i < n; i++) box.appendChild(Cards.backEl());
  }
  function renderHand() {
    var hand = $('hand');
    hand.innerHTML = '';
    if (!table) return;
    var legal = {};
    if (table.phase === 'play' && table.turn === 0) {
      E.legalCards(table, 0).forEach(function (c) { legal[c.id] = 1; });
    }
    var mine = table.hands[0].slice().sort(function (a, b) {
      var at = a.suit === table.trump ? -1 : a.suit;
      var bt = b.suit === table.trump ? -1 : b.suit;
      if (at !== bt) return at - bt;
      return E.powerOf(b) - E.powerOf(a);
    });
    mine.forEach(function (card) {
      var el = Cards.cardEl(card, { deck: settings.deck });
      var playable = table.phase === 'play' && table.turn === 0 && legal[card.id];
      el.classList.toggle('playable', !!playable);
      el.classList.toggle('blocked', table.phase === 'play' && table.turn === 0 && !legal[card.id]);
      el.disabled = !playable;
      hand.appendChild(el);
    });
  }
  function renderTrick() {
    var box = $('trick');
    box.innerHTML = '';
    if (!table) return;
    (table.trick || []).forEach(function (t) {
      var el = Cards.cardEl(t.card, { deck: settings.deck, tag: 'div' });
      el.classList.add('p' + t.seat);
      box.appendChild(el);
    });
  }
  function renderTalon() {
    var box = $('talon');
    if (!table || !started || table.phase === 'matchEnd') { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '';
    var pile = document.createElement('div');
    pile.className = 'stock-pile';
    var n = Math.min(table.stock.length, 4);
    for (var i = 0; i < n; i++) pile.appendChild(Cards.backEl());
    if (n) box.appendChild(pile);
    if (table.trumpCard) box.appendChild(Cards.cardEl(table.trumpCard, { deck: settings.deck, tag: 'div' }));
    var note = document.createElement('div');
    note.className = 'talon-note';
    var left = table.stock.length + (table.trumpCard ? 1 : 0);
    note.textContent = table.closed ? 'zugedreht · ' + E.suitName(table.trump, settings.deck) : (left ? left + ' im Talon' : 'Talon leer');
    box.appendChild(note);
  }
  function renderRoles() {
    for (var s = 0; s < 2; s++) {
      var role = $('role-' + s);
      var bits = [];
      if (table && table.dealer === s) bits.push('<span class="tag">Geber</span>');
      if (table && table.forehand === s && table.tricks[0] + table.tricks[1] === 0 && !table.trick.length) bits.push('<span class="tag">Vorhand</span>');
      if (table && table.closed && table.closer === s) bits.push('<span class="tag">zugedreht</span>');
      role.innerHTML = bits.join('');
      var seat = $('seat-' + s);
      if (seat) seat.classList.toggle('active', !!(table && table.turn === s && table.phase === 'play'));
    }
  }
  function renderScore() {
    var target = table ? table.target : E.normalizeTarget(settings.target, settings.targetCustom);
    $('mode-badge').textContent = String(target);
    $('target-info').textContent = 'Du gegen ' + nameOf(1) + '. Ziel ' + target + '.';
    var rows = table ? table.history : [];
    var html = '<thead><tr><th>Spiel</th><th>Du</th><th>' + esc(nameOf(1)) + '</th></tr></thead><tbody>';
    if (!rows.length) html += '<tr><td colspan="3">Noch keine Runde.</td></tr>';
    rows.forEach(function (row) {
      var mine = row.winner === 0 ? row.points : 0;
      var theirs = row.winner === 1 ? row.points : 0;
      html += '<tr><td>' + esc(REASON[row.reason] || row.reason || '') + '</td><td>' + mine + '</td><td>' + theirs + '</td></tr>';
    });
    var scores = table ? table.scores : [0, 0];
    html += '</tbody><tfoot><tr><td>Stand</td><td>' + scores[0] + '</td><td>' + scores[1] + '</td></tr></tfoot>';
    $('score-table').innerHTML = html;
  }
  function renderStatus() {
    var main = 'Nimm Platz, dann wird gegeben.';
    var chips = '';
    if (table && started) {
      chips = '<span class="chip">Du <b>' + table.points[0] + '</b></span><span class="chip">' + esc(nameOf(1)) + ' <b>' + table.points[1] + '</b></span>';
      chips += '<span class="chip">Bummerl <b>' + table.scores[0] + ' : ' + table.scores[1] + '</b></span>';
      if (table.phase === 'play') {
        main = table.turn === 0 ? 'Du bist am Zug.' : nameOf(table.turn) + ' ist am Zug.';
        if (E.isStrict(table)) chips += '<span class="chip">Farb- und Stichzwang</span>';
      } else if (table.phase === 'handEnd') main = 'Runde zu Ende.';
      else if (table.phase === 'matchEnd') main = (table.winner === 0 ? 'Du hast' : nameOf(table.winner) + ' hat') + ' das Bummerl gewonnen.';
    }
    $('st-main').textContent = main;
    $('st-chips').innerHTML = chips;
  }
  function renderActions() {
    var box = $('actions');
    if (!table || table.turn !== 0 || table.phase !== 'play') { box.hidden = true; box.innerHTML = ''; return; }
    var legal = E.legalState(table, 0);
    var bits = [];
    if (legal.exchange) bits.push('<button type="button" class="choice" data-act="exchange">Trumpf tauschen</button>');
    if (legal.close) bits.push('<button type="button" class="choice" data-act="close">Zudrehen</button>');
    legal.marriages.forEach(function (m) {
      bits.push('<button type="button" class="choice" data-act="marriage" data-suit="' + m.suit + '">' + m.points + ' ' + esc(E.suitName(m.suit, settings.deck)) + '</button>');
    });
    box.hidden = !bits.length;
    box.innerHTML = bits.join('');
  }
  function renderHint() {
    var box = $('hint-box');
    var on = settings.hints && table && table.turn === 0 && table.phase === 'play';
    box.hidden = !on;
    document.body.classList.toggle('hints', !!settings.hints);
    if (!on) return;
    box.textContent = E.isStrict(table)
      ? 'Grün ist erlaubt. Erst die Farbe bedienen. Kannst du den Stich nehmen, musst du ihn nehmen. Trumpf nur, wenn die Farbe fehlt.'
      : 'Der Talon ist offen. Du darfst jede Karte legen. Zwanzig und Vierzig sagst du beim Ausspielen an.';
  }
  function renderTop() {
    $('level-label').textContent = LEVELS[settings.level] || 'Kneipe';
    $('btn-sound').setAttribute('aria-pressed', String(!!settings.sound));
    $('btn-sound').classList.toggle('off', !settings.sound);
    $('btn-talk').setAttribute('aria-pressed', String(settings.talk === 'voice'));
    $('btn-hint').setAttribute('aria-pressed', String(!!settings.hints));
  }
  function render() {
    document.body.classList.toggle('deck-french', settings.deck === 'french');
    renderBacks();
    renderHand();
    renderTrick();
    renderTalon();
    renderRoles();
    renderScore();
    renderStatus();
    renderActions();
    renderHint();
    renderTop();
  }

  function applyEvents(events) {
    var ended = false;
    (events || []).forEach(function (ev) {
      if (ev.type === 'exchange') say(ev.seat, Talk.line(Seats[ev.seat].id, 'exchange'));
      if (ev.type === 'close') say(ev.seat, Talk.line(Seats[ev.seat].id, 'close'));
      if (ev.type === 'marriage' && !ev.reason) {
        var word = ev.points >= 40 ? 'Vierzig' : 'Zwanzig';
        say(ev.seat, word + (ev.pending ? ', noch ohne Stich.' : '.'));
      }
      if (ev.type === 'trick') {
        lastTrick = ev.cards;
        if (ev.winner !== 0 && Math.random() < 0.4) say(ev.winner, Talk.line(Seats[ev.winner].id, 'trick'));
      }
      if (ev.type === 'handEnd' && !ended) {
        ended = true;
        handClosed = true;
        if (window.SpielpartnerRounds) SpielpartnerRounds.finish();
        if (ev.winner == null) sys('Niemand schreibt. Die Augen stehen gleich.');
        else sys((ev.winner === 0 ? 'Du schreibst ' : nameOf(ev.winner) + ' schreibt ') + ev.points + ' (' + (REASON[ev.reason] || ev.reason) + ').');
      }
      if (ev.type === 'matchEnd') ended = 'match';
    });
    if (ended === 'match') showSession();
    else if (ended) showSummary();
  }

  function poke() {
    var gen = ++generation;
    render();
    if (!table || table.turn === 0 || table.phase !== 'play') return;
    setTimeout(function () {
      if (gen !== generation || !table || table.turn === 0 || table.phase !== 'play') return;
      var seat = table.turn;
      var action = AI.choose(table, seat, settings.level, Math.random);
      var res = action && E.applyAction(table, seat, action);
      if (res && res.ok) applyEvents(res.events);
      else sys('Sepp setzt aus.');
      poke();
    }, delay());
  }

  function showSummary() {
    if (!table || table.phase === 'matchEnd') return;
    var gained = table.gained || [0, 0];
    var html = '<p class="intro-kicker">Runde</p><h3 class="sum-title">' + esc(REASON[table.lastReason] || 'Runde') + '</h3>';
    html += '<p>Augen ' + table.points[0] + ' zu ' + table.points[1] + '. Bummerl ' + table.scores[0] + ' zu ' + table.scores[1] + '.</p>';
    html += '<p class="sum-quote">' + esc(Talk.line(Seats[1].id, gained[0] > gained[1] ? 'handLose' : 'handWin') || '') + '</p>';
    html += '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-next">Nächstes Spiel</button></div>';
    $('summary').innerHTML = html;
    $('modal-summary').hidden = false;
    $('btn-next').addEventListener('click', function () {
      if (!roundsAllow()) return;
      $('modal-summary').hidden = true;
      handClosed = false;
      table.rules = E.rulesFrom(opts());
      table.target = table.rules.target;
      if (table.scores[0] >= table.target || table.scores[1] >= table.target) {
        table.over = true;
        table.winner = table.scores[0] >= table.scores[1] ? 0 : 1;
        table.doppel = table.scores[table.winner === 0 ? 1 : 0] === 0;
        table.phase = 'matchEnd';
        showSession();
        return;
      }
      E.nextHand(table, Math.random);
      sys('Neu gegeben. Vorhand: ' + nameOf(table.forehand) + '.');
      poke();
    });
  }

  function showSession() {
    var won = table.winner === 0;
    var html = '<p class="intro-kicker">' + (table.doppel ? 'Doppel-Bummerl' : 'Bummerl') + '</p>';
    html += '<h3 class="sum-title">' + (won ? 'Du hast gewonnen' : nameOf(1) + ' hat gewonnen') + '</h3>';
    html += '<p>Stand ' + table.scores[0] + ' zu ' + table.scores[1] + '. Ziel war ' + table.target + '.</p>';
    html += '<p class="sum-quote">' + esc(Talk.line('sepp', won ? 'matchLose' : 'matchWin') || '') + '</p>';
    html += '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-again">Neue Partie</button></div>';
    $('session').innerHTML = html;
    $('modal-session').hidden = false;
    $('modal-summary').hidden = true;
    say(1, Talk.line('sepp', won ? 'matchLose' : 'matchWin'), { log: false });
    $('btn-again').addEventListener('click', function () {
      if (!roundsAllow()) return;
      $('modal-session').hidden = true;
      begin();
    });
  }

  function begin() {
    if (!roundsAllow()) return false;
    handClosed = false;
    table = E.newTable(opts(), Math.random);
    lastTrick = null;
    sys('Geber: ' + nameOf(table.dealer) + '. Vorhand: ' + nameOf(table.forehand) + '. Trumpf ' + E.suitName(table.trump, settings.deck) + '.');
    if (table.turn !== 0) say(table.turn, Talk.line(Seats[table.turn].id, 'welcome'));
    poke();
    return true;
  }

  function openSettings() { syncSettings(); $('modal-settings').hidden = false; }
  function syncSettings() {
    document.querySelectorAll('#modal-settings input[type=radio]').forEach(function (input) {
      if (settings[input.name] != null) input.checked = input.value === String(settings[input.name]);
    });
    $('opt-marriage').checked = !!settings.marriageNeedsTrick;
    $('opt-exchange').checked = !!settings.allowExchange;
    $('opt-strict').checked = !!settings.exchangeStrict;
    $('opt-close').checked = !!settings.allowClose;
    $('opt-last').checked = !!settings.lastTrickWins;
    $('opt-sound').checked = !!settings.sound;
    $('opt-volume').value = settings.volume;
    $('target-custom').value = settings.targetCustom;
    syncHands();
  }

  $('btn-settings').addEventListener('click', openSettings);
  $('btn-level').addEventListener('click', openSettings);
  document.querySelectorAll('#modal-settings input[type=radio]').forEach(function (input) {
    input.addEventListener('change', function () {
      settings[input.name] = input.value;
      saveSettings();
      if (input.name === 'talk') applyTalk(true);
      render();
    });
  });
  function bindCheck(id, key) {
    $(id).addEventListener('change', function () {
      settings[key] = $(id).checked;
      saveSettings();
    });
  }
  bindCheck('opt-marriage', 'marriageNeedsTrick');
  bindCheck('opt-exchange', 'allowExchange');
  bindCheck('opt-strict', 'exchangeStrict');
  bindCheck('opt-close', 'allowClose');
  bindCheck('opt-last', 'lastTrickWins');
  $('opt-sound').addEventListener('change', function () {
    settings.sound = $('opt-sound').checked;
    saveSettings();
    if (!settings.sound) Voice.stopAll();
    renderTop();
  });
  $('opt-volume').addEventListener('input', function () { settings.volume = +$('opt-volume').value; saveSettings(); });
  $('target-custom').addEventListener('change', function () {
    var n = Math.round(Number($('target-custom').value));
    if (!(n >= 3 && n <= 21)) n = 7;
    settings.targetCustom = n;
    $('target-custom').value = n;
    saveSettings();
  });
  $('btn-reset').addEventListener('click', function () {
    if (!window.confirm('Punkteliste zurücksetzen und neu geben?')) return;
    $('modal-settings').hidden = true;
    if (started) begin();
  });
  document.body.addEventListener('click', function (e) {
    if (e.target && e.target.hasAttribute('data-close')) e.target.closest('.modal').hidden = true;
  });
  $('btn-sound').addEventListener('click', function () {
    settings.sound = !settings.sound;
    saveSettings();
    if (!settings.sound) Voice.stopAll();
    else Voice.unlock();
    renderTop();
  });
  $('btn-talk').addEventListener('click', function () {
    settings.talk = settings.talk === 'voice' ? 'chat' : 'voice';
    saveSettings();
    applyTalk(true);
    renderTop();
  });
  $('btn-hint').addEventListener('click', function () {
    settings.hints = !settings.hints;
    saveSettings();
    render();
  });
  $('btn-last').addEventListener('click', function () {
    var box = $('last-trick');
    box.innerHTML = '';
    if (!lastTrick) { sys('Es liegt noch kein Stich.'); return; }
    lastTrick.forEach(function (t) { box.appendChild(Cards.cardEl(t.card, { deck: settings.deck, tag: 'div' })); });
    $('modal-last').hidden = false;
  });
  $('actions').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn || !table || table.turn !== 0) return;
    var act = btn.getAttribute('data-act');
    var action = act === 'marriage' ? { type: 'marriage', suit: Number(btn.getAttribute('data-suit')) } : { type: act };
    var res = E.applyAction(table, 0, action);
    if (!res.ok) return;
    applyEvents(res.events);
    poke();
  });
  $('hand').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-card]');
    if (!btn || !table || table.turn !== 0 || table.phase !== 'play') return;
    var res = E.applyAction(table, 0, { type: 'card', id: btn.dataset.card });
    if (!res.ok) {
      $('hint-box').hidden = false;
      $('hint-box').textContent = 'Die Karte ist nicht erlaubt.';
      return;
    }
    applyEvents(res.events);
    poke();
  });

  $('chat-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    if (chatBusy) return;
    var input = $('chat-input');
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    MIC.userEdit = false;
    logLine('<b>Du:</b> ' + esc(text), 'you');
    say(0, text, { voice: false });
    var who = Talk.responders(text);
    chatBusy = true;
    try {
      for (var i = 0; i < who.length; i++) {
        var id = who[i];
        var seat = -1;
        for (var s = 0; s < Seats.length; s++) if (Seats[s].id === id) seat = s;
        if (seat < 0) continue;
        var reply = '';
        try { reply = await Talk.askAI(id, { message: text, game: publicGame() }); }
        catch (err) { reply = Talk.cannedReply(id, text); }
        say(seat, reply, { priority: true });
      }
    } finally { chatBusy = false; }
  });

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var MIC = { rec: null, on: false, mode: '', finalText: '', interim: '', want: false, muted: false, paused: false, gesture: false, userEdit: false, writing: false, spoken: [], silence: 0, restart: 0, downAt: 0 };
  function micSupport() {
    if (!SR) return { ok: false, text: 'Dieser Browser hört nicht zu. Chrome und Edge können es, du kannst weiter schreiben.' };
    if (!window.isSecureContext) return { ok: false, text: 'Zum Sprechen brauchst du http://localhost oder https. Bis dahin einfach schreiben.' };
    return { ok: true };
  }
  function norm(s) {
    return String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function rememberSpoken(text) {
    var n = norm(text);
    if (!n) return;
    MIC.spoken.push({ n: n, at: Date.now() });
    MIC.spoken = MIC.spoken.filter(function (l) { return Date.now() - l.at < 15000; }).slice(-8);
  }
  function isEcho(text) {
    var a = norm(text);
    if (!a) return false;
    return MIC.spoken.some(function (l) { return l.n === a || (a.length > 12 && l.n.indexOf(a) !== -1) || (l.n.length > 12 && a.indexOf(l.n) !== -1); });
  }
  function setMicStatus(state) {
    var map = { 'hört zu': 'hoert', pausiert: 'pausiert', aus: 'aus' };
    $('hf-state').dataset.state = map[state] || 'aus';
    $('hf-label').textContent = state;
  }
  function syncHands() {
    var voice = settings.talk === 'voice';
    var sup = micSupport();
    $('handsfree-block').hidden = !voice;
    $('opt-handsfree').disabled = !sup.ok;
    $('opt-handsfree').checked = !!(sup.ok && settings.handsFree);
    $('handsfree-support').hidden = !voice || sup.ok;
    $('handsfree-support').textContent = sup.ok ? '' : 'Freisprechen geht hier nicht. Du kannst weiter schreiben.';
    $('handsfree-phones').hidden = !voice || !sup.ok;
    $('talk-support').hidden = sup.ok || !voice;
    $('talk-support').textContent = sup.text || '';
    var on = voice && sup.ok && settings.handsFree;
    $('hf-bar').hidden = !on;
    $('btn-mic').hidden = !(voice && sup.ok);
    $('btn-hf-mute').textContent = MIC.muted ? 'Wieder an' : 'Stumm';
    if (!on) setMicStatus('aus');
  }
  function shouldListen() {
    return settings.talk === 'voice' && settings.handsFree && micSupport().ok && !MIC.muted && !MIC.paused && MIC.gesture;
  }
  function abortRec() {
    var rec = MIC.rec;
    MIC.rec = null;
    MIC.on = false;
    if (!rec) return;
    rec.onend = null;
    try { rec.abort(); } catch (e) { try { rec.stop(); } catch (e2) { /* weg */ } }
  }
  function stopMic() {
    MIC.want = false;
    clearTimeout(MIC.silence);
    clearTimeout(MIC.restart);
    abortRec();
    $('btn-mic').classList.remove('rec');
  }
  function flushUtterance() {
    if (!settings.handsFree || MIC.paused || MIC.muted) return;
    var text = (MIC.finalText + (MIC.interim || '')).trim();
    MIC.finalText = '';
    MIC.interim = '';
    if (!text || isEcho(text) || norm(text).length < 2) { $('chat-input').value = ''; return; }
    $('chat-input').value = text;
    $('chat-form').requestSubmit();
  }
  function startHandsFree() {
    if (!shouldListen() || MIC.on) return;
    abortRec();
    var rec = new SR();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = true;
    MIC.rec = rec;
    MIC.on = true;
    MIC.mode = 'handsfree';
    MIC.want = true;
    rec.onresult = function (ev) {
      if (MIC.rec !== rec || MIC.paused) return;
      var interim = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) MIC.finalText += t;
        else interim += t;
      }
      MIC.interim = interim;
      var shown = (MIC.finalText + interim).trim();
      if (shown && isEcho(shown)) { MIC.finalText = ''; MIC.interim = ''; return; }
      if (!MIC.userEdit) $('chat-input').value = shown;
      clearTimeout(MIC.silence);
      if (shown) MIC.silence = setTimeout(flushUtterance, 1100);
    };
    rec.onerror = function (ev) {
      if (!ev || ev.error === 'no-speech' || ev.error === 'aborted') return;
      if (ev.error === 'not-allowed' || ev.error === 'audio-capture') { MIC.want = false; setMicStatus('aus'); sys('Das Mikrofon ist nicht frei. Du kannst schreiben.'); }
    };
    rec.onend = function () {
      if (MIC.rec !== rec) return;
      MIC.rec = null;
      MIC.on = false;
      if (MIC.want && shouldListen()) setTimeout(startHandsFree, 250);
    };
    try { rec.start(); } catch (e) { MIC.on = false; MIC.rec = null; return; }
    $('btn-mic').classList.add('rec');
    setMicStatus('hört zu');
  }
  function startPtt() {
    if (!SR || MIC.on) return;
    MIC.mode = 'ptt';
    var rec = new SR();
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = false;
    MIC.rec = rec;
    MIC.on = true;
    MIC.finalText = '';
    rec.onresult = function (ev) {
      var interim = '', fin = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) fin += t; else interim += t;
      }
      if (fin) MIC.finalText += fin;
      $('chat-input').value = (MIC.finalText + interim).trim();
    };
    rec.onend = function () {
      if (MIC.mode !== 'ptt') return;
      MIC.on = false;
      MIC.rec = null;
      $('btn-mic').classList.remove('rec');
      var text = ($('chat-input').value || '').trim();
      if (text && !isEcho(text)) $('chat-form').requestSubmit();
    };
    try { rec.start(); } catch (e) { MIC.on = false; return; }
    $('btn-mic').classList.add('rec');
  }
  function applyTalk(announce) {
    syncHands();
    var on = settings.talk === 'voice' && settings.handsFree && micSupport().ok;
    if (!on || MIC.muted) stopMic();
    else if (!MIC.paused) startHandsFree();
    if (announce) sys(settings.talk !== 'voice' ? 'Mitreden: nur schreiben.' : (on ? 'Freisprechen ist an. Nach einer kurzen Pause geht der Satz raus. Am besten mit Kopfhörer.' : 'Mikrofon: Knopf drücken und sprechen.'));
  }
  $('opt-handsfree').addEventListener('change', function () {
    settings.handsFree = $('opt-handsfree').checked;
    MIC.muted = false;
    MIC.gesture = true;
    saveSettings();
    applyTalk(true);
  });
  $('btn-hf-mute').addEventListener('click', function () {
    MIC.muted = !MIC.muted;
    MIC.gesture = true;
    if (MIC.muted) { stopMic(); setMicStatus('aus'); }
    else startHandsFree();
    $('btn-hf-mute').textContent = MIC.muted ? 'Wieder an' : 'Stumm';
  });
  $('btn-mic').addEventListener('pointerdown', function (e) {
    e.preventDefault();
    MIC.gesture = true;
    Voice.unlock();
    if (settings.handsFree) {
      MIC.muted = !MIC.muted;
      if (MIC.muted) { stopMic(); setMicStatus('aus'); }
      else startHandsFree();
      $('btn-hf-mute').textContent = MIC.muted ? 'Wieder an' : 'Stumm';
      return;
    }
    MIC.downAt = Date.now();
    if (!MIC.on) startPtt();
  });
  $('btn-mic').addEventListener('pointerup', function () {
    if (settings.handsFree) return;
    if (MIC.rec) { try { MIC.rec.stop(); } catch (e) { /* loslassen */ } }
  });
  Voice.onPlayback(function (phase, text) {
    if (phase === 'start' && text) rememberSpoken(text);
    if (!(settings.handsFree && settings.talk === 'voice')) return;
    if (phase === 'start') {
      MIC.paused = true;
      clearTimeout(MIC.silence);
      MIC.finalText = '';
      MIC.interim = '';
      stopMic();
      if (!MIC.muted) setMicStatus('pausiert');
    } else if (!MIC.muted) {
      MIC.paused = false;
      setTimeout(startHandsFree, 300);
    }
  });
  $('chat-input').addEventListener('input', function () { if (!MIC.writing) MIC.userEdit = $('chat-input').value.length > 0; });
  document.addEventListener('pointerdown', function () { MIC.gesture = true; Voice.unlock(); if (shouldListen()) startHandsFree(); }, true);

  $('btn-start').addEventListener('click', function () {
    if (started) return;
    if (!roundsAllow()) return;
    started = true;
    $('intro').hidden = true;
    Voice.unlock();
    begin();
  });

  Voice.setGetter(function () { return { sound: settings.sound, volume: settings.volume }; });
  refreshFaces();
  mountYou();
  $('intro-small').textContent = (LEVELS[settings.level] || 'Kneipe') + ' · bis ' + E.normalizeTarget(settings.target, settings.targetCustom);
  if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  render();
  applyTalk(false);
  sys('Willkommen im Kaffeehaus. Nimm Platz, dann wird gegeben.');
  var params = new URLSearchParams(window.location.search);
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();
  if (window.SpielpartnerRunde) SpielpartnerRunde.mount({
    game: 'schnapsen',
    count: function () { return 1; },
    inHand: function () {
      if (!started || !table) return false;
      if (handClosed || table.phase === 'handEnd' || table.phase === 'matchEnd') return false;
      var summary = $('modal-summary');
      var session = $('modal-session');
      if (summary && !summary.hidden) return false;
      if (session && !session.hidden) return false;
      return true;
    },
    apply: refreshFaces
  });
})();
