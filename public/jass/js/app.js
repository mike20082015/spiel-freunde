/* Tisch für den Schieber: Karten, Trumpf, Chat, Freisprechen. */
(function () {
  'use strict';
  var E = window.JassEngine;
  var AI = window.JassAI;
  var Seats = window.JassSeats.seats;
  var Cards = window.JassCards;
  var Talk = window.JassTalk;
  var Voice = window.JassVoice;
  var KEY = 'sf-jass-settings';
  var DEFAULTS = {
    level: 'kneipe', target: '1000', targetCustom: 1000, deck: 'swiss',
    multipliers: false, allowOben: true, sound: true, volume: 80,
    talk: 'chat', handsFree: false, hints: false, speed: 'normal'
  };
  var LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  var DELAY = { slow: 980, normal: 520, fast: 240 };
  var NAMES = ['Du', 'Vreni', 'Urs', 'Horst'];

  var settings = loadSettings();
  var table = null;
  var started = false;
  var generation = 0;
  var lastTrick = null;
  var bubbles = {};
  var chatBusy = false;

  function $(id) { return document.getElementById(id); }
  function zui() { return window.SpielpartnerZuschauen; }
  function lernen() { return !!(zui() && zui().aktiv()); }
  function lern(text, platz) { if (lernen() && text) zui().kommentar(text, { platz: platz }); }
  function jassSatz(seat, phase, choice, card) {
    var name = NAMES[seat] || 'Jemand';
    if (!zui()) return '';
    if (phase === 'trump' || phase === 'trumpPartner') {
      if (choice === 'schieben') return zui().erklaere('jass', { art: 'schieben', name: name });
      var label = choice === 'obenabe' ? 'Obenabe' : choice === 'undenufe' ? 'Undenufe' : E.trumpName({ mode: 'suit', suit: choice }, settings.deck);
      return zui().erklaere('jass', { art: 'trumpfwahl', name: name, trumpf: label });
    }
    var karte = card ? E.cardName(card, settings.deck) : 'eine Karte';
    var lead = table.trick[0] && table.trick[0].card;
    var trumpSuit = table.trump && table.trump.mode === 'suit' ? table.trump.suit : null;
    if (!lead) return zui().erklaere('stich', { art: 'raus', name: name, karte: karte, trumpf: !!(card && trumpSuit != null && card.suit === trumpSuit), regel: 'Beim Jass gilt Farbzwang.' });
    var trumpf = trumpSuit != null && lead.suit === trumpSuit;
    if (card && (card.suit === lead.suit || (trumpf && card.suit === trumpSuit))) return zui().erklaere('stich', { art: 'bedienen', name: name, karte: karte, trumpf: trumpf });
    if (card && trumpSuit != null && card.suit === trumpSuit) return zui().erklaere('stich', { art: 'stechen', name: name, karte: karte });
    return zui().erklaere('stich', { art: 'abwerfen', name: name, karte: karte });
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
  function teamName(team) {
    if (team === 0) return 'Du und ' + (Seats[2] ? Seats[2].name : 'Urs');
    return (Seats[1] ? Seats[1].name : 'Vreni') + ' und ' + (Seats[3] ? Seats[3].name : 'Horst');
  }
  function delay() { return DELAY[settings.speed] || DELAY.normal; }

  function roundsAllow() {
    return !window.SpielpartnerRounds || SpielpartnerRounds.gate();
  }

  function refreshFaces() {
    if (window.SpielpartnerLineup) SpielpartnerLineup.dress(Seats, 'jass', localStorage);
    for (var i = 0; i < Seats.length; i++) NAMES[i] = Seats[i].name;
    Seats.forEach(function (p) {
      if (!p || p.id === 'du') return;
      var node = $('seat-' + p.seat);
      if (node) {
        var label = node.querySelector('.seat-name');
        if (label) label.textContent = p.name;
        var ini = node.querySelector('.ini');
        if (ini && p.initials) ini.textContent = p.initials;
      }
      if (!p.portrait) return;
      var wrap = $('ava-' + p.seat);
      if (!wrap) return;
      var img = wrap.querySelector('img.ava');
      if (!img) {
        img = document.createElement('img');
        img.className = 'ava';
        img.addEventListener('error', function () {
          if (p.id === 'horst' && img.dataset.fallback !== '1') {
            img.dataset.fallback = '1';
            img.src = '../skat/assets/avatar-berliner-foto.jpg';
            return;
          }
          img.remove();
        });
        wrap.appendChild(img);
      }
      img.alt = p.full;
      if (img.dataset.fallback !== '1' && img.getAttribute('src') !== p.portrait) img.src = p.portrait;
    });
    var line = $('intro-line');
    if (line && NAMES[1] && NAMES[2] && NAMES[3]) {
      line.textContent = 'Schieber zu viert. Du spielst mit ' + NAMES[2] + ' gegen ' + NAMES[1] + ' und ' + NAMES[3] + '. Neun Karten, Trumpf oder schieben, und wer zuerst am Ziel ist, hat gewonnen.';
    }
    if (typeof renderScore === 'function') renderScore();
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
  function say(seat, text, opts) {
    opts = opts || {};
    if (!text) return;
    var bubble = $('bubble-' + seat);
    if (bubble) {
      bubble.textContent = text;
      bubble.classList.add('show');
      clearTimeout(bubbles[seat]);
      bubbles[seat] = setTimeout(function () { bubble.classList.remove('show'); }, 3400);
    }
    if (seat !== 0 && opts.log !== false) logLine('<b>' + esc(NAMES[seat]) + ':</b> ' + esc(text));
    if (seat !== 0 && settings.sound && opts.voice !== false) Voice.speak(Seats[seat].id, text, { priority: !!opts.priority });
  }


  function remark(seat, event, opts) {
    var gate = window.SpielpartnerSprueche;
    if (gate && !gate.allow({ force: !!(opts && opts.force) })) return false;
    var person = Seats[seat];
    if (!person || person.id === 'du') return false;
    say(seat, Talk.line(person.id, event), opts || {});
    return true;
  }
  function publicGame() {
    if (!table) return null;
    return {
      table: 'jass',
      phase: table.phase,
      trump: E.trumpName(table.trump, settings.deck),
      teams: teamName(0) + ' gegen ' + teamName(1),
      game: E.trumpName(table.trump, settings.deck),
      scores: table.scores.slice()
    };
  }

  function renderBacks() {
    for (var s = 1; s < 4; s++) {
      var box = $('backs-' + s);
      box.innerHTML = '';
      var n = table && table.hands ? table.hands[s].length : 0;
      for (var i = 0; i < n; i++) box.appendChild(Cards.backEl());
    }
  }
  function renderHand() {
    var hand = $('hand');
    hand.innerHTML = '';
    if (!table) return;
    var legal = {};
    if (table.phase === 'play' && table.turn === 0 && !lernen()) {
      E.legalCards(table, 0).forEach(function (c) { legal[c.id] = 1; });
    }
    var mine = table.hands[0].slice().sort(function (a, b) {
      if (a.suit !== b.suit) return a.suit - b.suit;
      return E.RANKS.indexOf(a.rank) - E.RANKS.indexOf(b.rank);
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
  function renderRoles() {
    for (var s = 0; s < 4; s++) {
      var role = $('role-' + s);
      var bits = [];
      if (table && table.dealer === s) bits.push('<span class="tag">Geber</span>');
      if (table && table.forehand === s && (table.phase === 'trump' || table.phase === 'trumpPartner')) bits.push('<span class="tag">Vorhand</span>');
      if (table && table.announcer === s && table.trump) bits.push('<span class="tag">angesagt</span>');
      role.innerHTML = bits.join('');
      var seat = $('seat-' + s);
      if (seat) seat.classList.toggle('active', !!(table && table.turn === s && table.phase !== 'handEnd' && table.phase !== 'matchEnd'));
    }
  }
  function renderScore() {
    var target = table ? table.target : E.normalizeTarget(settings.target, settings.targetCustom);
    $('mode-badge').textContent = String(target);
    $('target-info').textContent = 'Wir: Du und ' + NAMES[2] + '. Sie: ' + NAMES[1] + ' und ' + NAMES[3] + '. Ziel ' + target + (settings.multipliers ? ', mit Faktoren.' : '.');
    var rows = table ? table.history : [];
    var html = '<thead><tr><th>Spiel</th><th>Wir</th><th>Sie</th></tr></thead><tbody>';
    if (!rows.length) html += '<tr><td colspan="3">Noch keine Runde.</td></tr>';
    rows.forEach(function (row) {
      html += '<tr><td>' + esc(E.trumpName(row.trump, settings.deck)) + '</td><td>' + row.gained[0] + '</td><td>' + row.gained[1] + '</td></tr>';
    });
    var scores = table ? table.scores : [0, 0];
    html += '</tbody><tfoot><tr><td>Stand</td><td>' + scores[0] + '</td><td>' + scores[1] + '</td></tr></tfoot>';
    $('score-table').innerHTML = html;
  }
  function renderStatus() {
    var main = 'Nimm Platz, dann wird gegeben.';
    var chips = '';
    if (table && started) {
      var scores = table.scores;
      chips = '<span class="chip">Wir <b>' + scores[0] + '</b></span><span class="chip">Sie <b>' + scores[1] + '</b></span>';
      if (table.phase === 'trump') main = NAMES[table.turn] + (table.turn === 0 ? ' bestimmst den Trumpf.' : ' bestimmt den Trumpf.');
      else if (table.phase === 'trumpPartner') main = 'Geschoben. ' + NAMES[table.turn] + (table.turn === 0 ? ' sagst an.' : ' sagt an.');
      else if (table.phase === 'play') {
        main = (table.turn === 0 ? 'Du bist am Zug.' : NAMES[table.turn] + ' ist am Zug.');
        chips += '<span class="chip">Stich <b>' + (table.tricksDone + 1) + '</b>/9</span>';
      } else if (table.phase === 'handEnd') main = 'Runde zu Ende.';
      else if (table.phase === 'matchEnd') main = teamName(table.winner) + ' haben das Ziel erreicht.';
      if (table.trump) {
        $('trump-mark').hidden = false;
        $('trump-kicker').textContent = table.multipliers ? 'Trumpf ×' + E.multiplier(table.trump, true) : 'Trumpf';
        $('trump-name').textContent = E.trumpName(table.trump, settings.deck);
      } else $('trump-mark').hidden = true;
    } else $('trump-mark').hidden = true;
    $('st-main').textContent = main;
    $('st-chips').innerHTML = chips;
  }
  function renderPanel() {
    var panel = $('panel');
    var humanChoice = table && table.turn === 0 && !lernen() && (table.phase === 'trump' || table.phase === 'trumpPartner');
    panel.hidden = !humanChoice;
    if (!humanChoice) return;
    var deck = settings.deck;
    var names = deck === 'french' ? E.SUIT_FRENCH : E.SUIT_SWISS;
    var html = '<h3>' + (table.phase === 'trumpPartner' ? 'Dein Partner hat geschoben' : 'Du bist Vorhand') + '</h3>';
    html += '<p>' + (table.phase === 'trumpPartner' ? 'Du sagst an. Zurückschieben geht nicht.' : 'Farbe, Obenabe, Undenufe, oder einmal zum Partner schieben.') + '</p><div class="choice-grid">';
    for (var s = 0; s < 4; s++) html += '<button type="button" class="choice" data-choice="' + s + '">' + esc(names[s]) + '</button>';
    if (table.allowOben) {
      html += '<button type="button" class="choice" data-choice="obenabe">Obenabe<small>Ass hoch, 8 zählt 8</small></button>';
      html += '<button type="button" class="choice" data-choice="undenufe">Undenufe<small>6 hoch, Ass bleibt 11</small></button>';
    }
    if (table.phase === 'trump') html += '<button type="button" class="choice push" data-choice="schieben">Schieben<small>' + esc(NAMES[2]) + ' muss ansagen</small></button>';
    html += '</div>';
    panel.innerHTML = html;
  }
  function noteToken() {
    if (!table) return '0';
    return [
      table.dealer,
      table.phase,
      table.turn,
      table.tricksDone || 0,
      (table.trick || []).length,
      (table.hands || []).map(function (h) { return h.length; }).join('.'),
      (table.scores || []).join('.'),
    ].join('|');
  }
  var notes = window.HintNote.create({
    box: function () { return $('hint-box'); },
    token: function () { return noteToken(); },
    onExpire: function () { renderHint(); },
  });
  function renderHint() {
    var box = $('hint-box');
    notes.sync();
    if (notes.hold(box)) {
      document.body.classList.toggle('hints', !!settings.hints);
      return;
    }
    var on = settings.hints && table && table.turn === 0 && table.phase === 'play';
    box.hidden = !on;
    box.classList.remove('shake');
    document.body.classList.toggle('hints', !!settings.hints);
    if (on) box.textContent = 'Grün ist erlaubt. Farbe bedienen, Trumpf darfst du trotzdem legen. Untertrumpfen nur, wenn du nur noch Trumpf hast. Der Puur muss bei Trumpf nicht her, wenn er dein einziger Trumpf ist.';
    else box.textContent = '';
  }
  function render() {
    document.body.classList.toggle('deck-french', settings.deck === 'french');
    renderBacks();
    renderHand();
    renderTrick();
    renderRoles();
    renderScore();
    renderStatus();
    renderPanel();
    renderHint();
    renderTop();
  }

  function applyEvents(events) {
    (events || []).forEach(function (ev) {
      if (ev.type === 'ansage') say(ev.seat, E.spokenWeis(ev.points));
      if (ev.type === 'schieben') remark(ev.seat, 'schieben');
      if (ev.type === 'trump') say(ev.seat, E.trumpName(ev.trump, settings.deck) + '.');
      if (ev.type === 'stoeck') remark(ev.seat, 'stoeck');
      if (ev.type === 'trick') lastTrick = ev.cards;
      if (ev.type === 'weis' && ev.raw) sys('Weis: ' + teamName(ev.team) + ' schreiben ' + ev.raw + '.');
      if (ev.type === 'score' && ev.reason === 'stoeck') sys('Stöck: ' + ev.points + ' für ' + teamName(ev.team) + '.');
      if (ev.type === 'bedanken' || ev.type === 'handEnd') {
        if (window.SpielpartnerRounds) SpielpartnerRounds.finish();
      }
      if (ev.type === 'bedanken') showSession();
      if (ev.type === 'handEnd') showSummary();
    });
  }

  function poke() {
    var gen = ++generation;
    render();
    if (!table || table.phase === 'handEnd' || table.phase === 'matchEnd') return;
    if (table.turn === 0 && !lernen()) return;
    var warte = lernen() ? zui().takt() : new Promise(function (r) { setTimeout(r, delay()); });
    Promise.resolve(warte).then(function () {
      if (gen !== generation || !table) return;
      if (table.turn === 0 && !lernen()) { render(); return; }
      if (table.phase === 'handEnd' || table.phase === 'matchEnd') return;
      var seat = table.turn;
      var phase = table.phase;
      var res = null;
      if (phase === 'trump' || phase === 'trumpPartner') {
        var choice = AI.chooseTrump(table, seat, settings.level, Math.random);
        lern(jassSatz(seat, phase, choice, null), seat);
        res = E.chooseTrump(table, seat, choice);
      } else if (phase === 'play') {
        var card = AI.chooseCard(table, seat, settings.level, Math.random);
        if (card) {
          lern(jassSatz(seat, phase, null, card), seat);
          res = E.playCard(table, seat, card.id);
        }
      }
      if (res && res.ok) applyEvents(res.events);
      poke();
    });
  }

  function showSummary() {
    var gained = table.gained || [0, 0];
    var html = '<p class="intro-kicker">Runde</p><h3 class="sum-title">' + esc(E.trumpName(table.trump, settings.deck)) + '</h3>';
    html += '<p>Wir ' + gained[0] + ', sie ' + gained[1] + '. Stand: ' + table.scores[0] + ' zu ' + table.scores[1] + '.</p>';
    var speaker = gained[0] >= gained[1] ? Seats[2].id : Seats[1].id;
    html += '<p class="sum-quote">' + esc(Talk.line(speaker, gained[0] >= gained[1] ? 'handWin' : 'handLose') || '') + '</p>';
    html += '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-next">Nächstes Spiel</button></div>';
    $('summary').innerHTML = html;
    $('modal-summary').hidden = false;
    if (lernen()) zui().nachRunde(function () { var btn = $('btn-next'); if (btn) btn.click(); });
    $('btn-next').addEventListener('click', function () {
      if (!roundsAllow()) return;
      $('modal-summary').hidden = true;
      E.nextHand(table, Math.random);
      sys('Neu gegeben. Vorhand: ' + NAMES[table.forehand] + '.');
      poke();
    });
  }
  function showSession() {
    var won = table.winner === 0;
    var who = won ? 'urs' : 'horst';
    var html = '<p class="intro-kicker">Ausgemacht</p><h3 class="sum-title">' + esc(teamName(table.winner)) + '</h3>';
    html += '<p>Stand ' + table.scores[0] + ' zu ' + table.scores[1] + '. Ziel war ' + table.target + '.</p>';
    html += '<p class="sum-quote">' + esc(Talk.line(who, won ? 'matchWin' : 'matchLose') || '') + '</p>';
    html += '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-again">Neue Runde</button></div>';
    $('session').innerHTML = html;
    $('modal-session').hidden = false;
    say(won ? 2 : 3, Talk.line(who, won ? 'matchWin' : 'matchLose'), { log: false });
    $('btn-again').addEventListener('click', function () {
      if (!roundsAllow()) return;
      $('modal-session').hidden = true;
      begin();
    });
  }

  function begin() {
    if (!roundsAllow()) return false;
    table = E.newTable({
      target: settings.target,
      custom: settings.targetCustom,
      multipliers: !!settings.multipliers,
      allowOben: !!settings.allowOben
    }, Math.random);
    lastTrick = null;
    sys('Geber: ' + NAMES[table.dealer] + '. Vorhand: ' + NAMES[table.forehand] + '.');
    if (table.turn !== 0) say(table.turn, Talk.line(Seats[table.turn].id, 'welcome'), { voice: true });
    poke();
    return true;
  }

  function renderTop() {
    $('level-label').textContent = LEVELS[settings.level] || 'Kneipe';
    $('btn-sound').setAttribute('aria-pressed', String(!!settings.sound));
    $('btn-sound').classList.toggle('off', !settings.sound);
    $('btn-talk').setAttribute('aria-pressed', String(settings.talk === 'voice'));
    $('btn-hint').setAttribute('aria-pressed', String(!!settings.hints));
  }

  function openSettings() { syncSettings(); $('modal-settings').hidden = false; }
  function syncSettings() {
    document.querySelectorAll('#modal-settings input[type=radio]').forEach(function (input) {
      if (settings[input.name] != null) input.checked = input.value === String(settings[input.name]);
    });
    $('opt-multi').checked = !!settings.multipliers;
    $('opt-oben').checked = !!settings.allowOben;
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
  $('opt-multi').addEventListener('change', function () { settings.multipliers = $('opt-multi').checked; saveSettings(); });
  $('opt-oben').addEventListener('change', function () { settings.allowOben = $('opt-oben').checked; saveSettings(); });
  $('opt-sound').addEventListener('change', function () {
    settings.sound = $('opt-sound').checked;
    saveSettings();
    if (!settings.sound) Voice.stopAll();
    renderTop();
  });
  $('opt-volume').addEventListener('input', function () { settings.volume = +$('opt-volume').value; saveSettings(); });
  $('target-custom').addEventListener('change', function () {
    settings.targetCustom = E.normalizeTarget('custom', $('target-custom').value);
    $('target-custom').value = settings.targetCustom;
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
    lastTrick.forEach(function (t) {
      var el = Cards.cardEl(t.card, { deck: settings.deck, tag: 'div' });
      box.appendChild(el);
    });
    $('modal-last').hidden = false;
  });
  $('panel').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-choice]');
    if (!btn || !table || table.turn !== 0 || lernen()) return;
    var raw = btn.getAttribute('data-choice');
    var choice = raw === 'obenabe' || raw === 'undenufe' || raw === 'schieben' ? raw : Number(raw);
    var res = E.chooseTrump(table, 0, choice);
    if (!res.ok) return;
    applyEvents(res.events);
    poke();
  });
  $('hand').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-card]');
    if (!btn || !table || table.turn !== 0 || lernen() || table.phase !== 'play') return;
    var res = E.playCard(table, 0, btn.dataset.card);
    if (!res.ok) {
      notes.show('Die Karte ist nicht erlaubt.');
      return;
    }
    if (notes.active()) notes.clear();
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
        var seat = Seats.findIndex(function (p) { return p.id === id; });
        var reply = '';
        try { reply = await Talk.askAI(id, { message: text, game: publicGame() }); }
        catch (err) { reply = Talk.cannedReply(id, text); }
        say(seat, reply, { priority: true });
      }
    } finally { chatBusy = false; }
  });

  /* Freisprechen: nach einer Pause geht der Satz allein raus. Während andere reden, pausiert das Mikrofon. */
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
  $('intro-small').textContent = (LEVELS[settings.level] || 'Kneipe') + ' · bis ' + E.normalizeTarget(settings.target, settings.targetCustom);
  if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  render();
  applyTalk(false);
  sys('Willkommen in der Berghütte. Nimm Platz, dann wird gegeben.');
  var params = new URLSearchParams(window.location.search);
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();
  if (window.SpielpartnerRunde) SpielpartnerRunde.mount({
    game: 'jass',
    count: function () { return 3; },
    inHand: function () {
      if (!started || !table) return false;
      if (table.phase === 'handEnd' || table.phase === 'matchEnd') return false;
      var summary = $('modal-summary');
      var session = $('modal-session');
      if (summary && !summary.hidden) return false;
      if (session && !session.hidden) return false;
      return true;
    },
    apply: refreshFaces
  });

  window.__jass = {
    get table() { return table; },
    get state() { return table; },
    settings: settings
  };
})();
