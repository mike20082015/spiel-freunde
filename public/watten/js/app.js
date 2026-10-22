/* Tisch fürs Watten: Karten, Ansage, Bieten, Chat, Freisprechen. */
(function () {
  'use strict';
  var E = window.WattenEngine;
  var AI = window.WattenAI;
  var Seats = window.WattenSeats.seats;
  var Cards = window.WattenCards;
  var Talk = window.WattenTalk;
  var Voice = window.WattenVoice;
  var KEY = 'sf-watten-settings';
  var DEFAULTS = {
    level: 'kneipe', target: '15', targetCustom: 15, deck: '33', critical: 'bayern',
    gespannt: true, haubeForce: true, maschine: true, schlagwechsel: true,
    sound: true, volume: 80, talk: 'chat', handsFree: false, hints: false, speed: 'normal'
  };
  var LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  var DELAY = { slow: 900, normal: 480, fast: 220 };
  var REASON = { stiche: 'drei Stiche', gehen: 'gegangen', maschine: 'Maschine' };
  var NAMES = ['Du', 'Horst', 'Sepp', 'Oma Hilde'];

  var settings = loadSettings();
  var table = null;
  var started = false;
  var generation = 0;
  var lastTrick = null;
  var bubbles = {};
  var chatBusy = false;
  var handClosed = false;

  function $(id) { return document.getElementById(id); }
  function zui() { return window.SpielpartnerZuschauen; }
  function lernen() { return !!(zui() && zui().aktiv()); }
  function lern(text, platz) { if (lernen() && text) zui().kommentar(text, { platz: platz }); }
  function wattenSatz(seat, action) {
    var name = nameOf(seat);
    if (!action || !zui()) return '';
    if (action.type === 'schlag') return zui().erklaere('watten', { art: 'schlag', name: name, text: E.rankName(action.rank) });
    if (action.type === 'swap' || action.type === 'accept') return zui().erklaere('watten', { art: 'tausch', name: name });
    if (action.type === 'decline') return name + ' lässt den Tausch aus. Die Karten bleiben, wie sie gegeben sind.';
    if (action.type === 'trump') return zui().erklaere('watten', { art: 'trumpfwahl', name: name, trumpf: ['Eichel', 'Gras', 'Herz', 'Schellen'][action.suit] || 'eine Farbe' });
    if (action.type === 'bieten') return zui().erklaere('watten', { art: 'bieten', name: name });
    if (action.type === 'spielen' || action.type === 'halten') return zui().erklaere('watten', { art: 'halten', name: name });
    if (action.type === 'gehen') return zui().erklaere('watten', { art: 'gehen', name: name });
    var card = (table.hands[seat] || []).filter(function (c) { return c.id === action.id; })[0];
    return zui().erklaere('watten', { art: 'karte', name: name, karte: card ? E.cardName(card) : 'eine Karte' });
  }
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
      critical: settings.critical,
      gespannt: !!settings.gespannt,
      haubeForce: !!settings.haubeForce,
      maschine: !!settings.maschine,
      schlagwechsel: !!settings.schlagwechsel
    };
  }
  function roundsAllow() {
    return !window.SpielpartnerRounds || SpielpartnerRounds.gate();
  }
  function nameOf(seat) {
    return Seats[seat] ? Seats[seat].name : NAMES[seat] || 'Spieler';
  }
  function teamName(team) {
    return team === 0 ? 'Wir' : 'Sie';
  }

  function refreshFaces() {
    if (window.SpielpartnerLineup) SpielpartnerLineup.dress(Seats, 'watten', localStorage);
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
      table: 'watten',
      phase: table.phase,
      schlag: table.schlag ? E.rankName(table.schlag) : '',
      trump: table.trump != null ? E.SUITS[table.trump] : '',
      game: 'Watten' + (table.schlag ? ', Schlag ' + E.rankName(table.schlag) : ''),
      scores: table.scores.slice(),
      stake: table.stake,
      tricks: table.tricksWon.slice()
    };
  }

  function renderBacks() {
    for (var s = 1; s < 4; s++) {
      var box = $('backs-' + s);
      if (!box) continue;
      box.innerHTML = '';
      var n = table && table.hands ? Math.min(table.hands[s].length, 5) : 0;
      for (var i = 0; i < n; i++) box.appendChild(Cards.backEl());
    }
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
      var ca = E.classOf(a, table);
      var cb = E.classOf(b, table);
      if (ca.cat !== cb.cat) return cb.cat - ca.cat;
      var as = a.rank === 'W' ? 3 : a.suit;
      var bs = b.rank === 'W' ? 3 : b.suit;
      if (as !== bs) return as - bs;
      return (cb.rank || 0) - (ca.rank || 0);
    });
    mine.forEach(function (card) {
      var el = Cards.cardEl(card);
      var playable = table.phase === 'play' && table.turn === 0 && !lernen() && legal[card.id];
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
      var el = Cards.cardEl(t.card, { tag: 'div' });
      el.classList.add('p' + t.seat);
      box.appendChild(el);
    });
  }
  function renderRoles() {
    for (var s = 0; s < 4; s++) {
      var role = $('role-' + s);
      var bits = [];
      if (table && table.dealer === s) bits.push('<span class="tag">Geber</span>');
      if (table && table.forehand === s && table.phase !== 'play' && table.phase !== 'handEnd' && table.phase !== 'matchEnd') bits.push('<span class="tag">Vorhand</span>');
      if (table && E.teamOf(s) === 0) bits.push('<span class="tag">Wir</span>');
      role.innerHTML = bits.join('');
      var seat = $('seat-' + s);
      var live = table && table.turn === s && table.phase !== 'handEnd' && table.phase !== 'matchEnd';
      if (seat) seat.classList.toggle('active', !!live);
    }
  }
  function renderScore() {
    var target = table ? table.target : E.normalizeTarget(settings.target, settings.targetCustom);
    $('mode-badge').textContent = String(target);
    $('target-info').textContent = 'Du und ' + nameOf(2) + ' gegen ' + nameOf(1) + ' und ' + nameOf(3) + '. Ziel ' + target + '.';
    var rows = table ? table.history : [];
    var html = '<thead><tr><th>Spiel</th><th>Wir</th><th>Sie</th></tr></thead><tbody>';
    if (!rows.length) html += '<tr><td colspan="3">Noch keine Runde.</td></tr>';
    rows.forEach(function (row) {
      var ours = row.team === 0 ? row.points : 0;
      var theirs = row.team === 1 ? row.points : 0;
      html += '<tr><td>' + esc(REASON[row.reason] || row.reason || '') + '</td><td>' + ours + '</td><td>' + theirs + '</td></tr>';
    });
    var scores = table ? table.scores : [0, 0];
    html += '</tbody><tfoot><tr><td>Stand</td><td>' + scores[0] + '</td><td>' + scores[1] + '</td></tr></tfoot>';
    $('score-table').innerHTML = html;
  }
  function renderMark() {
    var mark = $('trump-mark');
    if (!table || !started || (table.schlag == null && table.trump == null)) {
      mark.hidden = true;
      return;
    }
    mark.hidden = false;
    var bits = [];
    if (table.schlag) bits.push(E.rankName(table.schlag));
    if (table.trump != null) bits.push(E.SUITS[table.trump]);
    $('trump-kicker').textContent = table.trump != null ? 'Schlag · Trumpf' : 'Schlag';
    $('trump-name').textContent = bits.join(' · ') || 'noch offen';
  }
  function renderStatus() {
    var main = 'Nimm Platz, dann wird gegeben.';
    var chips = '';
    if (table && started) {
      chips = '<span class="chip">Wir <b>' + table.scores[0] + '</b></span><span class="chip">Sie <b>' + table.scores[1] + '</b></span>';
      if (table.phase === 'play' || table.phase === 'bieten' || table.phase === 'raise' || table.phase === 'concede') {
        chips += '<span class="chip">Spiel <b>' + table.stake + '</b></span>';
      }
      if (table.phase === 'play') chips += '<span class="chip">Stiche <b>' + table.tricksWon[0] + ' : ' + table.tricksWon[1] + '</b></span>';
      if (table.phase === 'schlag') main = table.turn === 0 ? 'Du sagst den Schlag an.' : nameOf(table.turn) + ' sagt den Schlag an.';
      else if (table.phase === 'swap') main = table.turn === 0 ? 'Schlagwechsel: annehmen oder ablehnen.' : nameOf(table.turn) + ' entscheidet über den Schlagwechsel.';
      else if (table.phase === 'trump') main = table.turn === 0 ? 'Du sagst den Trumpf an.' : nameOf(table.turn) + ' sagt den Trumpf an.';
      else if (table.phase === 'concede') main = table.turn === 0 ? 'Ihr seid gespannt. Gehen oder halten.' : nameOf(table.turn) + ' ist gespannt.';
      else if (table.phase === 'bieten') main = table.turn === 0 ? 'Spielen oder bieten.' : nameOf(table.turn) + ' kann spielen oder bieten.';
      else if (table.phase === 'raise') main = table.turn === 0 ? 'Halten oder gehen.' : nameOf(table.turn) + ' muss halten oder gehen.';
      else if (table.phase === 'play') main = table.turn === 0 ? 'Du bist am Zug.' : nameOf(table.turn) + ' ist am Zug.';
      else if (table.phase === 'handEnd') main = 'Runde zu Ende.';
      else if (table.phase === 'matchEnd') main = teamName(table.winner) + ' haben das Ziel erreicht.';
    }
    $('st-main').textContent = main;
    $('st-chips').innerHTML = chips;
    renderMark();
  }
  function renderPanel() {
    var panel = $('panel');
    var phase = table && table.turn === 0 && !lernen() ? table.phase : '';
    var show = phase === 'schlag' || phase === 'swap' || phase === 'trump' || phase === 'concede' || phase === 'bieten' || phase === 'raise';
    panel.hidden = !show;
    if (!show) { panel.innerHTML = ''; return; }
    var legal = E.legalState(table, 0);
    var html = '';
    if (phase === 'schlag') {
      html += '<h3>Du sagst den Schlag an</h3><p>Die Vorhand wählt den Rang. Kritische bleiben Kritische.</p><div class="choice-grid">';
      legal.ranks.forEach(function (rank) {
        html += '<button type="button" class="choice" data-act="schlag" data-rank="' + rank + '">' + esc(E.rankName(rank)) + '</button>';
      });
      html += '</div>';
      if (legal.swap) html += '<div class="choice-grid"><button type="button" class="choice push" data-act="swap">Schlagwechsel anbieten</button></div>';
    } else if (phase === 'swap') {
      html += '<h3>Schlagwechsel</h3><p>' + esc(nameOf(table.forehand)) + ' bietet dir den Schlag an. Nimmst du an, sagst du den Schlag, und die Vorhand den Trumpf.</p>';
      html += '<div class="choice-grid"><button type="button" class="choice" data-act="accept">Annehmen</button><button type="button" class="choice" data-act="decline">Ablehnen</button></div>';
    } else if (phase === 'trump') {
      html += '<h3>Du sagst den Trumpf an</h3><p>Schlag ist ' + esc(E.rankName(table.schlag)) + '.</p><div class="choice-grid">';
      legal.suits.forEach(function (suit) {
        html += '<button type="button" class="choice" data-act="trump" data-suit="' + suit + '">' + esc(E.SUITS[suit]) + '</button>';
      });
      html += '</div>';
    } else if (phase === 'concede') {
      html += '<h3>Gespannt</h3><p>Gehen gibt der anderen Partei 2. Halten spielt um 3.</p>';
      html += '<div class="choice-grid"><button type="button" class="choice" data-act="gehen">Gehen</button><button type="button" class="choice" data-act="halten">Halten</button></div>';
    } else if (phase === 'bieten') {
      html += '<h3>Spielen oder bieten</h3><p>Das Spiel gilt ' + table.stake + '.</p><div class="choice-grid">';
      html += '<button type="button" class="choice" data-act="spielen">Spielen</button>';
      if (legal.raise) html += '<button type="button" class="choice" data-act="bieten">Bieten auf ' + (table.stake + 1) + '</button>';
      html += '</div>';
    } else if (phase === 'raise') {
      var next = table.pendingRaise ? table.pendingRaise.next : table.stake + 1;
      html += '<h3>Gebot auf ' + next + '</h3><p>Halten hebt das Spiel. Gehen schreibt der anderen Partei die alten ' + table.stake + '.</p>';
      html += '<div class="choice-grid"><button type="button" class="choice" data-act="halten">Halten</button><button type="button" class="choice" data-act="gehen">Gehen</button></div>';
    }
    panel.innerHTML = html;
  }
  function renderActions() {
    var box = $('actions');
    if (!table || lernen() || table.turn !== 0 || table.phase !== 'play' || !E.canRaise(table, 0)) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.hidden = false;
    box.innerHTML = '<button type="button" class="choice" data-act="bieten">Bieten auf ' + (table.stake + 1) + '</button>';
  }
  function renderHint() {
    var box = $('hint-box');
    var on = settings.hints && table && table.turn === 0 && table.phase === 'play';
    box.hidden = !on;
    document.body.classList.toggle('hints', !!settings.hints);
    if (!on) return;
    box.textContent = table.rules.haubeForce
      ? 'Grün ist erlaubt. Kein Farbzwang, außer die Haube liegt als erste Karte: dann Trumpf oder ein Kritischer.'
      : 'Grün ist erlaubt. Es gibt keinen Farbzwang. Drei Stiche gewinnen das Spiel.';
  }
  function renderTop() {
    $('level-label').textContent = LEVELS[settings.level] || 'Kneipe';
    $('btn-sound').setAttribute('aria-pressed', String(!!settings.sound));
    $('btn-sound').classList.toggle('off', !settings.sound);
    $('btn-talk').setAttribute('aria-pressed', String(settings.talk === 'voice'));
    $('btn-hint').setAttribute('aria-pressed', String(!!settings.hints));
  }
  function render() {
    renderBacks();
    renderHand();
    renderTrick();
    renderRoles();
    renderScore();
    renderStatus();
    renderPanel();
    renderActions();
    renderHint();
    renderTop();
  }

  function actFrom(btn) {
    var act = btn.getAttribute('data-act');
    if (act === 'schlag') return { type: 'schlag', rank: btn.getAttribute('data-rank') };
    if (act === 'trump') return { type: 'trump', suit: Number(btn.getAttribute('data-suit')) };
    return { type: act };
  }
  function humanAct(action) {
    if (!table || lernen() || table.turn !== 0 || !action) return;
    var res = E.applyAction(table, 0, action);
    if (!res.ok) return;
    applyEvents(res.events);
    poke();
  }

  function applyEvents(events) {
    var ended = false;
    (events || []).forEach(function (ev) {
      if (ev.type === 'schlag') say(ev.seat, Talk.line(Seats[ev.seat].id, 'schlag'));
      if (ev.type === 'trump') say(ev.seat, Talk.line(Seats[ev.seat].id, 'trump'));
      if (ev.type === 'bieten') say(ev.seat, Talk.line(Seats[ev.seat].id, 'bieten'));
      if (ev.type === 'gehen') say(ev.seat, Talk.line(Seats[ev.seat].id, 'gehen'));
      if (ev.type === 'maschine') sys(nameOf(ev.seat) + ' hat die Maschine.');
      if (ev.type === 'trick') {
        lastTrick = ev.cards;
        if (ev.winner !== 0 && Math.random() < 0.45) say(ev.winner, Talk.line(Seats[ev.winner].id, 'trick'));
      }
      if (ev.type === 'handEnd' && !ended) {
        ended = true;
        handClosed = true;
        if (window.SpielpartnerRounds) SpielpartnerRounds.finish();
        sys(teamName(ev.team) + ' schreiben ' + ev.points + ' (' + (REASON[ev.reason] || ev.reason) + ').');
      }
      if (ev.type === 'matchEnd') ended = 'match';
    });
    if (ended === 'match') showSession();
    else if (ended) showSummary();
  }

  function poke() {
    var gen = ++generation;
    render();
    if (!table || table.phase === 'handEnd' || table.phase === 'matchEnd') return;
    if (table.turn === 0 && !lernen()) return;
    var warte = lernen() ? zui().takt() : new Promise(function (r) { setTimeout(r, delay()); });
    Promise.resolve(warte).then(function () {
      if (gen !== generation || !table || table.phase === 'handEnd' || table.phase === 'matchEnd') return;
      if (table.turn === 0 && !lernen()) { render(); return; }
      var seat = table.turn;
      var action = AI.choose(table, seat, settings.level, Math.random);
      lern(wattenSatz(seat, action), seat);
      var res = action && E.applyAction(table, seat, action);
      if (res && res.ok) applyEvents(res.events);
      else { sys(nameOf(seat) + ' setzt aus.'); return; }
      poke();
    });
  }

  function showSummary() {
    if (!table || table.phase === 'matchEnd') return;
    var gained = table.gained || [0, 0];
    var html = '<p class="intro-kicker">Runde</p><h3 class="sum-title">' + esc(REASON[table.lastReason] || 'Runde') + '</h3>';
    html += '<p>Wir ' + gained[0] + ', sie ' + gained[1] + '. Stand ' + table.scores[0] + ' zu ' + table.scores[1] + '.</p>';
    var speaker = gained[0] >= gained[1] ? Seats[2].id : Seats[1].id;
    html += '<p class="sum-quote">' + esc(Talk.line(speaker, gained[0] >= gained[1] ? 'handWin' : 'handLose') || '') + '</p>';
    html += '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-next">Nächstes Spiel</button></div>';
    $('summary').innerHTML = html;
    $('modal-summary').hidden = false;
    if (lernen()) zui().nachRunde(function () { var btn = $('btn-next'); if (btn) btn.click(); });
    $('btn-next').addEventListener('click', function () {
      if (!roundsAllow()) return;
      $('modal-summary').hidden = true;
      handClosed = false;
      table.rules = E.rulesFrom(opts());
      table.target = table.rules.target;
      if (table.scores[0] >= table.target || table.scores[1] >= table.target) {
        table.over = true;
        table.winner = table.scores[0] >= table.scores[1] ? 0 : 1;
        table.phase = 'matchEnd';
        showSession();
        return;
      }
      E.nextHand(table, Math.random);
      sys('Neu gegeben. Vorhand: ' + nameOf(table.forehand) + '. Geber: ' + nameOf(table.dealer) + '.');
      poke();
    });
  }

  function showSession() {
    var won = table.winner === 0;
    var who = won ? Seats[2].id : Seats[3].id;
    var html = '<p class="intro-kicker">Ausgemacht</p><h3 class="sum-title">' + (won ? 'Ihr habt gewonnen' : 'Sie haben gewonnen') + '</h3>';
    html += '<p>Stand ' + table.scores[0] + ' zu ' + table.scores[1] + '. Ziel war ' + table.target + '.</p>';
    html += '<p class="sum-quote">' + esc(Talk.line(who, won ? 'matchWin' : 'matchLose') || '') + '</p>';
    html += '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-again">Neue Partie</button></div>';
    $('session').innerHTML = html;
    $('modal-session').hidden = false;
    $('modal-summary').hidden = true;
    say(won ? 2 : 3, Talk.line(who, won ? 'matchWin' : 'matchLose'), { log: false });
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
    sys('Geber: ' + nameOf(table.dealer) + '. Vorhand: ' + nameOf(table.forehand) + '.');
    if (table.turn !== 0) say(table.turn, Talk.line(Seats[table.turn].id, 'welcome'));
    poke();
    return true;
  }

  function openSettings() { syncSettings(); $('modal-settings').hidden = false; }
  function syncSettings() {
    document.querySelectorAll('#modal-settings input[type=radio]').forEach(function (input) {
      if (settings[input.name] != null) input.checked = input.value === String(settings[input.name]);
    });
    $('opt-gespannt').checked = !!settings.gespannt;
    $('opt-haube').checked = !!settings.haubeForce;
    $('opt-maschine').checked = !!settings.maschine;
    $('opt-swap').checked = !!settings.schlagwechsel;
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
  bindCheck('opt-gespannt', 'gespannt');
  bindCheck('opt-haube', 'haubeForce');
  bindCheck('opt-maschine', 'maschine');
  bindCheck('opt-swap', 'schlagwechsel');
  $('opt-sound').addEventListener('change', function () {
    settings.sound = $('opt-sound').checked;
    saveSettings();
    if (!settings.sound) Voice.stopAll();
    renderTop();
  });
  $('opt-volume').addEventListener('input', function () { settings.volume = +$('opt-volume').value; saveSettings(); });
  $('target-custom').addEventListener('change', function () {
    var n = Math.round(Number($('target-custom').value));
    if (!(n >= 5 && n <= 31)) n = 15;
    settings.targetCustom = n;
    $('target-custom').value = n;
    saveSettings();
  });
  $('btn-reset').addEventListener('click', function () {
    if (!window.confirm('Punkteliste zurücksetzen und neu geben?')) return;
    $('modal-settings').hidden = true;
    $('modal-summary').hidden = true;
    $('modal-session').hidden = true;
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
    lastTrick.forEach(function (t) { box.appendChild(Cards.cardEl(t.card, { tag: 'div' })); });
    $('modal-last').hidden = false;
  });
  $('panel').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    humanAct(actFrom(btn));
  });
  $('actions').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    humanAct(actFrom(btn));
  });
  $('hand').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-card]');
    if (!btn || !table || lernen() || table.turn !== 0 || table.phase !== 'play') return;
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

  function start() {
    if (started) return false;
    if (!roundsAllow()) return false;
    started = true;
    $('intro').hidden = true;
    Voice.unlock();
    begin();
    return true;
  }
  $('btn-start').addEventListener('click', start);
  if (zui()) {
    zui().mount({
      start: start,
      uebernehmen: function () { render(); },
      sprich: function (platz, text) {
        var person = Seats[platz] && Seats[platz].id !== 'du' ? Seats[platz] : Seats[1];
        if (!person || !settings.sound) return false;
        Voice.unlock();
        return Voice.speak(person.id, text, { priority: true });
      }
    });
  }

  Voice.setGetter(function () { return { sound: settings.sound, volume: settings.volume }; });
  refreshFaces();
  mountYou();
  $('intro-small').textContent = (LEVELS[settings.level] || 'Kneipe') + ' · bis ' + E.normalizeTarget(settings.target, settings.targetCustom);
  if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  render();
  applyTalk(false);
  sys('Willkommen in der Stube. Nimm Platz, dann wird gegeben.');
  var params = new URLSearchParams(window.location.search);
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();
  if (window.SpielpartnerRunde) SpielpartnerRunde.mount({
    game: 'watten',
    count: function () { return 3; },
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
