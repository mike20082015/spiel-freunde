/* Bridgetisch: Reizungskasten, Strohmann, Chat und Freisprechen. */
(function () {
  'use strict';
  var E = window.BridgeEngine;
  var AI = window.BridgeAI;
  var Seats = window.BridgeSeats.seats;
  var Cards = window.BridgeCards;
  var Talk = window.BridgeTalk;
  var Voice = window.BridgeVoice;
  var KEY = 'sf-bridge-settings';
  var DEFAULTS = {
    level: 'kneipe', mode: 'rubber', honours: false, sound: true, volume: 80,
    talk: 'chat', handsFree: false, hints: false, speed: 'normal'
  };
  var LEVELS = { anfaenger: 'Anfänger', kneipe: 'Kneipe', turnier: 'Turnier' };
  var DELAY = { slow: 980, normal: 520, fast: 240 };
  var RANK = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };
  var NAMES = ['Du', 'Jonas', 'Margarethe', 'Rüdiger'];

  var settings = loadSettings();
  var table = null;
  var started = false;
  var generation = 0;
  var bidLevel = 1;
  var holdTrick = false;
  var endShown = false;
  var finishedRound = false;
  var rush = false;
  var bubbles = {};
  var chatBusy = false;

  function $(id) { return document.getElementById(id); }
  function zui() { return window.SpielpartnerZuschauen; }
  function lernen() { return !!(zui() && zui().aktiv()); }
  function lern(text, platz) { if (lernen() && text) zui().kommentar(text, { platz: platz }); }
  function bridgeSatz(seat, call) {
    var text = '';
    try { text = AI.explain(table, seat, call) || ''; }
    catch (err) { text = ''; }
    text = String(text).replace('Vorschlag: ', '');
    if (!text && call) text = E.callLabel(call);
    return zui().erklaere('bridge', { art: 'reiz', name: NAMES[seat], text: text });
  }
  function bridgeKarte(seat, card) {
    var name = NAMES[seat];
    var karte = E.cardName(card);
    var lead = table.trick && table.trick[0] && table.trick[0].card;
    var strain = table.contract && table.contract.strain;
    var trump = strain && strain !== 'NT' ? { C: 0, D: 1, H: 2, S: 3 }[strain] : null;
    if (!lead) return zui().erklaere('stich', { art: 'raus', name: name, karte: karte, trumpf: trump != null && card.suit === trump, regel: 'Beim Bridge gilt Farbzwang. Der Strohmann liegt offen, die Gegner bleiben verdeckt.' });
    if (card.suit === lead.suit) return zui().erklaere('stich', { art: 'bedienen', name: name, karte: karte, trumpf: trump != null && lead.suit === trump });
    if (trump != null && card.suit === trump) return zui().erklaere('stich', { art: 'stechen', name: name, karte: karte });
    return zui().erklaere('stich', { art: 'abwerfen', name: name, karte: karte });
  }
  function loadSettings() {
    var out = Object.assign({}, DEFAULTS);
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      Object.keys(DEFAULTS).forEach(function (k) { if (raw[k] != null) out[k] = raw[k]; });
    } catch (e) { /* leerer Speicher */ }
    if (out.mode !== 'chicago') out.mode = 'rubber';
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
    if (team === 0) return 'Du und ' + (Seats[2] ? Seats[2].name : 'Margarethe');
    return (Seats[1] ? Seats[1].name : 'Jonas') + ' und ' + (Seats[3] ? Seats[3].name : 'Rüdiger');
  }
  function stepDelay() { return rush ? 70 : (DELAY[settings.speed] || DELAY.normal); }
  function roundsAllow() { return !window.SpielpartnerRounds || SpielpartnerRounds.gate(); }
  function sortCards(cards) {
    return (cards || []).slice().sort(function (a, b) {
      if (a.suit !== b.suit) return b.suit - a.suit;
      return RANK[b.rank] - RANK[a.rank];
    });
  }
  function scoresOf() {
    if (!table) return [0, 0];
    return table.mode === 'chicago' ? table.chicago.scores : table.rubber.total;
  }
  function humanActs() {
    if (lernen()) return false;
    if (!table || holdTrick) return false;
    if (table.phase === 'bidding') return table.turn === 0;
    if (table.phase !== 'play' || !table.contract) return false;
    if (table.contract.declarer === 2) return false;
    if (table.contract.declarer === 0) return table.turn === 0 || table.turn === 2;
    return table.turn === 0;
  }
  function terminal() {
    return table && (table.phase === 'scored' || table.phase === 'passed' || table.phase === 'match');
  }

  function refreshFaces() {
    if (window.SpielpartnerLineup) SpielpartnerLineup.dress(Seats, 'bridge', localStorage);
    for (var i = 0; i < Seats.length; i++) NAMES[i] = Seats[i].name;
    Seats.forEach(function (p) {
      if (!p || p.id === 'du') return;
      var name = $('name-' + p.seat);
      if (name) name.textContent = p.name;
      var ini = document.querySelector('#ava-' + p.seat + ' .ini');
      if (ini) ini.textContent = p.initials;
      if (window.SpielpartnerLineup) SpielpartnerLineup.paintSeat($('ava-' + p.seat), p);
    });
    if (Talk.setSeated) {
      Talk.setSeated(Seats.filter(function (p) { return p.id !== 'du'; }).map(function (p) { return p.id; }));
    }
    var copy = $('intro-copy');
    if (copy) {
      copy.textContent = 'Rubber zu viert. Du sitzt im Süden, dein Partner ' + NAMES[2] + ' im Norden. Links ' + NAMES[1] + ', rechts ' + NAMES[3] + '. Gereizt wird natürlich, gezählt wird in Punkten, nie in Geld.';
    }
  }
  async function playerFace() {
    var api = window.SpielFreundeAvatar;
    if (!api || typeof api.playerSeat !== 'function') return null;
    var info;
    try { info = await api.playerSeat(); } catch (e) { return null; }
    if (!info || typeof info !== 'object') return null;
    var src = info.imageUrl || info.image || info.portrait || info.src || info.photo || '';
    return {
      src: typeof src === 'string' ? src : '',
      initials: (typeof info.initials === 'string' && info.initials) || 'Du',
      name: typeof info.name === 'string' && info.name ? info.name : 'Du'
    };
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
    var node = $('seat-' + seat);
    if (node && seat !== 0) {
      node.classList.add('speaking');
      setTimeout(function () { node.classList.remove('speaking'); }, 2800);
    }
    if (seat !== 0 && opts.log !== false) logLine('<b>' + esc(NAMES[seat]) + ':</b> ' + esc(text));
    if (seat !== 0 && settings.sound && opts.voice !== false && Seats[seat]) {
      Voice.speak(Seats[seat].id, text, { priority: !!opts.priority });
    }
  }

  function tableFacts(seat, event) {
    var person = Seats[seat];
    var g = publicGame() || {};
    var bits = ['Spieler ' + ((person && person.name) || 'jemand')];
    if (event) bits.push(event);
    if (g.phase) bits.push('Phase ' + g.phase);
    if (g.game) bits.push('Spiel ' + g.game);
    if (table && table.trick && table.trick.length) bits.push('Karten im Stich ' + table.trick.length);
    if (table && table.tricksWon) bits.push('Stiche ' + table.tricksWon.join(', '));
    if (g.scores) bits.push('Punkte ' + g.scores.join(', '));
    return bits.join('. ');
  }
  function remark(seat, event, opts) {
    var gate = window.SpielpartnerSprueche;
    if (gate && !gate.allow({ force: !!(opts && opts.force) })) return false;
    var person = Seats[seat];
    if (!person || person.id === 'du') return false;
    var fallback = function () { return Talk.line(person.id, event); };
    if (!gate || typeof gate.freshComment !== 'function') {
      say(seat, fallback(), opts || {});
      return true;
    }
    gate.freshComment({
      character: person.id,
      event: event,
      situation: tableFacts(seat, event),
      game: publicGame(),
      fallback: fallback
    }).then(function (text) { if (text) say(seat, text, opts || {}); });
    return true;
  }
  function publicGame() {
    if (!table) return null;
    return {
      table: 'bridge',
      phase: table.phase,
      game: table.contract ? E.contractLabel(table.contract) : 'Reizung',
      teams: teamName(0) + ' gegen ' + teamName(1),
      scores: scoresOf().slice(),
      mode: table.mode
    };
  }

  function renderBacks() {
    for (var s = 1; s < 4; s++) {
      var box = $('backs-' + s);
      box.innerHTML = '';
      var dummy = table && table.dummyVisible && table.contract && table.contract.dummy === s;
      if (dummy) continue;
      var n = table && table.hands ? Math.min(table.hands[s].length, 13) : 0;
      var shown = Math.min(n, 8);
      for (var i = 0; i < shown; i++) box.appendChild(Cards.backEl());
    }
  }
  function paintHand(box, cards, seat, playable) {
    box.innerHTML = '';
    var legal = {};
    if (playable) E.legalCards(table, seat).forEach(function (card) { legal[card.id] = 1; });
    var prevSuit = null;
    sortCards(cards).forEach(function (card) {
      var el = Cards.cardEl(card);
      if (prevSuit != null && card.suit !== prevSuit) el.classList.add('suit-gap');
      prevSuit = card.suit;
      var ok = !!(playable && legal[card.id]);
      el.classList.toggle('playable', ok);
      el.classList.toggle('blocked', !!(playable && !legal[card.id]));
      el.disabled = !ok;
      box.appendChild(el);
    });
  }
  function renderHand() {
    if (!table) { $('hand').innerHTML = ''; return; }
    var playable = humanActs() && table.phase === 'play' && table.turn === 0;
    paintHand($('hand'), table.hands[0], 0, playable);
  }
  function renderDummy() {
    var row = $('dummy');
    var show = !!(table && table.dummyVisible && table.contract && table.contract.dummy !== 0 && (table.phase === 'play' || holdTrick));
    row.hidden = !show;
    $('tabletop').classList.toggle('has-dummy', show);
    if (!show) return;
    var seat = table.contract.dummy;
    $('dummy-who').textContent = 'Strohmann · ' + NAMES[seat];
    var playable = humanActs() && table.phase === 'play' && table.turn === seat;
    paintHand($('dummy-hand'), table.hands[seat], seat, playable);
  }
  function renderTrick() {
    var box = $('trick');
    box.innerHTML = '';
    if (!table) return;
    var cards = table.trick.length ? table.trick : (holdTrick && table.lastTrick ? table.lastTrick : []);
    var winner = holdTrick && !table.trick.length && table.tricks.length ? table.tricks[table.tricks.length - 1].winner : null;
    cards.forEach(function (play) {
      var el = Cards.cardEl(play.card, { tag: 'div' });
      el.classList.add('p' + play.seat);
      if (winner === play.seat) el.classList.add('win');
      box.appendChild(el);
    });
  }
  function renderAuction() {
    var box = $('auction');
    var line = $('auction-line');
    if (!table || !started) { box.hidden = true; if (line) line.textContent = ''; return; }
    if (line) line.textContent = table.auction.map(function (entry) { return E.callShort(entry.call); }).join(' · ');
    if (table.phase !== 'bidding') {
      box.hidden = false;
      var c = table.contract;
      var tricks = table.tricksWon || [0, 0];
      var label = c ? E.contractLabel(c) : 'Passen';
      var who = c ? NAMES[c.declarer] + ' · Alleinspieler' : '';
      box.innerHTML = '<div class="contract"><small>Kontrakt</small><b>' + esc(label) + '</b><span>' + esc(who) + '</span><span>Wir ' + tricks[0] + ' Stiche · Sie ' + tricks[1] + '</span></div>';
      return;
    }
    var html = '<table><thead><tr>';
    for (var s = 0; s < 4; s++) html += '<th>' + esc(NAMES[s]) + '</th>';
    html += '</tr></thead><tbody>';
    var rows = 0;
    for (var r = 0; r < 8; r++) {
      var any = false;
      var cells = ['', '', '', ''];
      for (var seat = 0; seat < 4; seat++) {
        var nth = 0;
        for (var i = 0; i < table.auction.length; i++) {
          if (table.auction[i].seat !== seat) continue;
          if (nth === r) { cells[seat] = E.callShort(table.auction[i].call); any = true; break; }
          nth += 1;
        }
      }
      if (!any) break;
      html += '<tr>' + cells.map(function (cell) { return '<td>' + esc(cell) + '</td>'; }).join('') + '</tr>';
      rows += 1;
    }
    if (!rows) html += '<tr><td colspan="4">Die Reizung beginnt.</td></tr>';
    html += '</tbody></table>';
    box.hidden = false;
    box.innerHTML = html;
  }
  function renderBidbox() {
    var box = $('bidbox');
    var on = !!(table && started && humanActs() && table.phase === 'bidding');
    box.hidden = !on;
    if (!on) return;
    var legal = E.legalCalls(table, 0);
    var levels = {};
    legal.bids.forEach(function (b) { levels[b.level] = 1; });
    if (!levels[bidLevel]) {
      bidLevel = 1;
      for (var n = 1; n <= 7; n++) if (levels[n]) { bidLevel = n; break; }
    }
    var html = '<div class="bid-row">';
    for (var level = 1; level <= 7; level++) {
      html += '<button type="button" data-level="' + level + '"' + (bidLevel === level ? ' class="is-on"' : '') + (levels[level] ? '' : ' disabled') + '>' + level + '</button>';
    }
    html += '</div><div class="bid-row">';
    E.STRAINS.forEach(function (strain) {
      var ok = legal.bids.some(function (b) { return b.level === bidLevel && b.strain === strain; });
      var cls = strain === 'H' ? 's-heart' : strain === 'S' ? 's-spade' : strain === 'D' ? 's-diamond' : strain === 'C' ? 's-club' : '';
      html += '<button type="button" data-strain="' + strain + '" class="' + cls + '"' + (ok ? '' : ' disabled') + '>' + esc(E.STRAIN_SHORT[strain]) + '</button>';
    });
    html += '</div><div class="bid-row">';
    html += '<button type="button" data-kind="pass" class="pass">Passen</button>';
    html += '<button type="button" data-kind="double" class="dbl"' + (legal.double ? '' : ' disabled') + '>Kontra</button>';
    html += '<button type="button" data-kind="redouble" class="rdbl"' + (legal.redouble ? '' : ' disabled') + '>Rekontra</button>';
    html += '</div>';
    box.innerHTML = html;
  }
  function renderRoles() {
    for (var s = 0; s < 4; s++) {
      var bits = [];
      if (table && table.dealer === s && (table.phase === 'bidding' || table.phase === 'play')) bits.push('<span class="tag">Geber</span>');
      if (table && table.contract && table.contract.declarer === s) bits.push('<span class="tag">Alleinspieler</span>');
      if (table && table.dummyVisible && table.contract && table.contract.dummy === s) bits.push('<span class="tag">Strohmann</span>');
      var role = $('role-' + s);
      if (role) role.innerHTML = bits.join('');
      var seat = $('seat-' + s);
      var active = !!(table && !terminal() && !holdTrick && table.turn === s && (table.phase === 'bidding' || table.phase === 'play'));
      if (seat) seat.classList.toggle('active', active);
    }
  }
  function vulnText() {
    if (!table) return '';
    var v = table.vuln || [false, false];
    if (v[0] && v[1]) return 'Beide gefährdet';
    if (v[0]) return 'Wir gefährdet';
    if (v[1]) return 'Sie gefährdet';
    return 'Niemand gefährdet';
  }
  function renderScore() {
    var chicago = table && table.mode === 'chicago';
    $('mode-badge').textContent = chicago ? 'Chicago' : 'Rubber';
    if (!table) $('target-info').textContent = 'Rubber bis zwei Spiele. Chicago als Schalter.';
    else if (chicago) $('target-info').textContent = 'Blatt ' + table.chicago.deal + (table.chicago.deal > 4 ? '' : ' von 4') + '. ' + vulnText() + '.';
    else $('target-info').textContent = 'Spiele: Wir ' + table.rubber.games[0] + ', Sie ' + table.rubber.games[1] + '. ' + vulnText() + '. Unter dem Strich ' + table.rubber.currentBelow[0] + ' : ' + table.rubber.currentBelow[1] + '.';
    var rows = table ? table.history : [];
    var html = '<thead><tr><th>Blatt</th><th>Wir</th><th>Sie</th></tr></thead><tbody>';
    if (!rows.length) html += '<tr><td colspan="3">Noch kein Blatt.</td></tr>';
    rows.forEach(function (row) {
      html += '<tr><td>' + esc(row.text || '') + '</td><td>' + (row.ns || 0) + '</td><td>' + (row.ew || 0) + '</td></tr>';
    });
    var scores = scoresOf();
    html += '</tbody><tfoot><tr><td>Stand</td><td>' + scores[0] + '</td><td>' + scores[1] + '</td></tr></tfoot>';
    $('score-table').innerHTML = html;
  }
  function renderStatus() {
    var main = 'Nimm Platz, dann wird gegeben.';
    var chips = '';
    if (table && started) {
      var scores = scoresOf();
      chips = '<span class="chip">Wir <b>' + scores[0] + '</b></span><span class="chip">Sie <b>' + scores[1] + '</b></span>';
      chips += '<span class="chip">' + esc(vulnText()) + '</span>';
      if (table.phase === 'bidding') main = table.turn === 0 ? 'Du reizt.' : NAMES[table.turn] + ' reizt.';
      else if (table.phase === 'play') {
        if (table.contract && table.contract.declarer === 2) main = 'Du bist Strohmann. ' + NAMES[2] + ' spielt.';
        else if (table.contract && table.contract.declarer === 0 && table.turn === 2) main = 'Du spielst den Strohmann.';
        else main = table.turn === 0 ? 'Du bist am Zug.' : NAMES[table.turn] + ' ist am Zug.';
        if (table.contract) chips += '<span class="chip">' + esc(E.contractLabel(table.contract)) + '</span>';
      } else if (table.phase === 'passed') main = 'Alle haben gepasst.';
      else if (table.phase === 'scored') main = (table.result && table.result.text) || 'Blatt zu Ende.';
      else if (table.phase === 'match') main = table.winner === 0 ? 'Ihr habt die Partie gewonnen.' : table.winner === 1 ? 'Sie haben die Partie gewonnen.' : 'Unentschieden.';
    }
    $('st-main').textContent = main;
    $('st-chips').innerHTML = chips;
  }
  function renderWatch() {
    var on = !!(table && started && table.phase === 'play' && table.contract && table.contract.declarer === 2);
    $('watch').hidden = !on;
    if (on) $('watch-copy').textContent = NAMES[2] + ' ist Alleinspieler. Du liegst als Strohmann.';
  }
  function renderHint() {
    var box = $('hint-box');
    var on = !!(settings.hints && table && started && (table.phase === 'bidding' || table.phase === 'play'));
    box.hidden = !on;
    document.body.classList.toggle('hints', !!settings.hints);
    if (!on) return;
    if (table.phase === 'bidding') {
      var hcp = E.hcp(table.hands[0] || []);
      if (table.turn === 0) box.textContent = AI.suggestBid(table, 0).text;
      else box.textContent = hcp + (hcp === 1 ? ' Figurenpunkt' : ' Figurenpunkte') + '. Die anderen reizen noch.';
      return;
    }
    if (table.contract && table.contract.declarer === 0) box.textContent = 'Du bist Alleinspieler und spielst auch den Strohmann. Grün ist erlaubt. Bedienen ist Pflicht.';
    else if (table.contract && table.contract.declarer === 2) box.textContent = 'Du bist Strohmann. ' + NAMES[2] + ' spielt beide Hände. Vorspulen oder den Rest überspringen.';
    else box.textContent = 'Bedienen ist Pflicht. Grün markiert, was du legen darfst. Der Strohmann liegt offen.';
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
    renderDummy();
    renderTrick();
    renderAuction();
    renderBidbox();
    renderRoles();
    renderScore();
    renderStatus();
    renderWatch();
    renderHint();
    renderTop();
  }

  function spokenBid(call) {
    return E.spokenCall(call);
  }
  function applyEvents(events) {
    (events || []).forEach(function (ev) {
      if (ev.type === 'trick') {
        holdTrick = true;
        if (ev.winner && Math.random() < 0.34) remark(ev.winner, 'trick');
      }
      if (ev.type === 'contract') sys('Kontrakt: ' + E.contractLabel(ev.contract) + '. Alleinspieler ' + NAMES[ev.contract.declarer] + '.');
      if (ev.type === 'passed') sys('Alle haben gepasst.');
    });
  }
  function aiStep() {
    if (!table || humanActs() || terminal()) return;
    var seat = table.turn;
    var res = null;
    if (table.phase === 'bidding') {
      var call = AI.chooseBid(table, seat, settings.level);
      if (lernen()) lern(bridgeSatz(seat, call), seat);
      res = E.call(table, seat, call);
      if (res && res.ok && seat !== 0) say(seat, spokenBid(call));
    } else if (table.phase === 'play') {
      var card = AI.chooseCard(table, seat, settings.level, Math.random);
      if (card) {
        if (lernen()) lern(bridgeKarte(seat, card), seat);
        res = E.playCard(table, seat, card.id);
      }
    }
    if (res && res.ok) applyEvents(res.events);
  }
  function showEnd() {
    if (!finishedRound) {
      finishedRound = true;
      if (window.SpielpartnerRounds) {
        SpielpartnerRounds.finish();
        SpielpartnerRounds.paint($('intro-rounds'));
      }
    }
    if (table.phase === 'match') showSession();
    else showSummary();
  }
  function poke() {
    var gen = ++generation;
    render();
    if (!table) return;
    if (terminal()) {
      if (!endShown) { endShown = true; showEnd(); }
      return;
    }
    if (holdTrick) {
      setTimeout(function () {
        if (gen !== generation) return;
        holdTrick = false;
        poke();
      }, stepDelay());
      return;
    }
    if (humanActs()) return;
    var warte = lernen() ? zui().takt() : new Promise(function (r) { setTimeout(r, stepDelay()); });
    Promise.resolve(warte).then(function () {
      if (gen !== generation || !table) return;
      if (humanActs()) { render(); return; }
      aiStep();
      poke();
    });
  }

  function showSummary() {
    var result = table.result || { text: 'Blatt zu Ende.', ns: 0, ew: 0 };
    var won = (result.ns || 0) >= (result.ew || 0);
    var speaker = won ? Seats[2].id : Seats[1].id;
    var quote = Talk.line(speaker, result.passed ? 'bid' : (won ? 'handWin' : 'handLose')) || '';
    var html = '<p class="intro-kicker">Blatt</p><h3 class="sum-title">' + esc(result.text || '') + '</h3>';
    html += '<p>Wir ' + (result.ns || 0) + ', sie ' + (result.ew || 0) + '. Stand ' + scoresOf()[0] + ' zu ' + scoresOf()[1] + '.</p>';
    if (quote) html += '<p class="sum-quote">' + esc(quote) + '</p>';
    html += '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-next">' + (result.passed ? 'Neu geben' : 'Nächstes Blatt') + '</button></div>';
    $('summary').innerHTML = html;
    $('modal-summary').hidden = false;
    if (lernen()) zui().nachRunde(function () { var btn = $('btn-next'); if (btn) btn.click(); });
    $('btn-next').addEventListener('click', function () {
      if (!roundsAllow()) return;
      $('modal-summary').hidden = true;
      endShown = false;
      finishedRound = false;
      holdTrick = false;
      rush = false;
      var res = E.nextHand(table, Math.random);
      if (!res.ok) return;
      sys('Neu gegeben. Geber: ' + NAMES[table.dealer] + '.');
      poke();
    });
  }
  function showSession() {
    var scores = scoresOf();
    var winner = table.winner;
    var title = winner == null ? 'Unentschieden' : (winner === 0 ? teamName(0) : teamName(1));
    var won = winner === 0;
    var who = won ? Seats[2].id : Seats[1].id;
    var html = '<p class="intro-kicker">' + (table.mode === 'chicago' ? 'Chicago' : 'Rubber') + '</p>';
    html += '<h3 class="sum-title">' + esc(title) + '</h3>';
    html += '<p>Stand ' + scores[0] + ' zu ' + scores[1] + '.</p>';
    var quote = winner == null ? '' : (Talk.line(who, won ? 'matchWin' : 'matchLose') || '');
    if (quote) html += '<p class="sum-quote">' + esc(quote) + '</p>';
    html += '<div class="modal-actions"><button class="btn btn-gold" type="button" id="btn-again">Neue Partie</button></div>';
    $('session').innerHTML = html;
    $('modal-session').hidden = false;
    if (quote) say(won ? 2 : 1, quote, { log: false });
    $('btn-again').addEventListener('click', function () {
      if (!roundsAllow()) return;
      $('modal-session').hidden = true;
      begin();
    });
  }

  function begin() {
    if (!roundsAllow()) return false;
    table = E.newTable({ mode: settings.mode, honours: !!settings.honours, dealer: 0 }, Math.random);
    holdTrick = false;
    endShown = false;
    finishedRound = false;
    rush = false;
    bidLevel = 1;
    sys('Geber: ' + NAMES[table.dealer] + '. ' + (table.mode === 'chicago' ? 'Chicago, vier Blätter.' : 'Rubber bis zwei Spiele.'));
    poke();
    return true;
  }
  function submitCall(call) {
    if (lernen() || !table || table.turn !== 0 || table.phase !== 'bidding') return;
    var res = E.call(table, 0, call);
    if (!res.ok) return;
    say(0, spokenBid(call), { voice: false });
    applyEvents(res.events);
    poke();
  }
  function submitCard(cardId) {
    if (lernen() || !humanActs() || !table || table.phase !== 'play') return;
    var seat = table.turn;
    var res = E.playCard(table, seat, cardId);
    if (!res.ok) {
      $('hint-box').hidden = false;
      $('hint-box').textContent = res.error || 'Die Karte ist nicht erlaubt.';
      return;
    }
    applyEvents(res.events);
    poke();
  }
  function skipRest() {
    if (!table || !table.contract || table.contract.declarer !== 2) return;
    generation += 1;
    holdTrick = false;
    var guard = 0;
    while ((table.phase === 'play' || table.phase === 'bidding') && guard < 80) {
      guard += 1;
      var before = table.phase + ':' + table.turn + ':' + table.cardsPlayed;
      aiStep();
      if (table.phase + ':' + table.turn + ':' + table.cardsPlayed === before) break;
    }
    endShown = false;
    poke();
  }

  function openSettings() { syncSettings(); $('modal-settings').hidden = false; }
  function syncSettings() {
    document.querySelectorAll('#modal-settings input[type=radio]').forEach(function (input) {
      if (settings[input.name] != null) input.checked = String(settings[input.name]) === input.value;
    });
    $('opt-honours').checked = !!settings.honours;
    $('opt-sound').checked = !!settings.sound;
    $('opt-volume').value = settings.volume;
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
  $('opt-honours').addEventListener('change', function () { settings.honours = $('opt-honours').checked; saveSettings(); });
  $('opt-sound').addEventListener('change', function () {
    settings.sound = $('opt-sound').checked;
    saveSettings();
    if (!settings.sound) Voice.stopAll();
    renderTop();
  });
  $('opt-volume').addEventListener('input', function () { settings.volume = +$('opt-volume').value; saveSettings(); });
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
  $('btn-faster').addEventListener('click', function () { rush = !rush; });
  $('btn-skip').addEventListener('click', skipRest);
  $('bidbox').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn || btn.disabled) return;
    if (btn.dataset.level) { bidLevel = +btn.dataset.level; renderBidbox(); return; }
    if (btn.dataset.kind) submitCall({ kind: btn.dataset.kind });
    else if (btn.dataset.strain) submitCall({ kind: 'bid', level: bidLevel, strain: btn.dataset.strain });
  });
  function onCardClick(e) {
    var btn = e.target.closest('[data-card]');
    if (!btn || btn.disabled) return;
    submitCard(btn.dataset.card);
  }
  $('hand').addEventListener('click', onCardClick);
  $('dummy-hand').addEventListener('click', onCardClick);

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
  playerFace().then(function (face) {
    if (!face) return;
    $('you-ini').textContent = face.initials || 'Du';
    if (!face.src) return;
    var img = document.createElement('img');
    img.alt = face.name || 'Du';
    img.addEventListener('error', function () { img.remove(); });
    img.src = face.src;
    $('you-ava').appendChild(img);
  });
  $('intro-small').textContent = (LEVELS[settings.level] || 'Kneipe') + ' · ' + (settings.mode === 'chicago' ? 'Chicago' : 'Rubber');
  if (window.SpielpartnerRounds) SpielpartnerRounds.paint($('intro-rounds'));
  render();
  applyTalk(false);
  sys('Willkommen am Bridgetisch. Nimm Platz, dann wird gegeben.');
  var params = new URLSearchParams(window.location.search);
  if (params.get('ai') === '0' && Talk.disableLive) Talk.disableLive();
  else if (Talk.probe) Talk.probe();
  if (params.get('demo') === 'reizen' || params.get('demo') === 'spiel') {
    started = true;
    $('intro').hidden = true;
    table = E.demo(params.get('demo') === 'spiel' ? 'play' : 'bid');
    if (table.phase === 'play') say(2, 'Ich liege offen. Du spielst den Strohmann.');
    else remark(2, 'welcome', { force: true });
    poke();
  }
  if (window.SpielpartnerRunde) SpielpartnerRunde.mount({
    game: 'bridge',
    count: function () { return 3; },
    inHand: function () {
      if (!started || !table) return false;
      if (table.phase === 'scored' || table.phase === 'passed' || table.phase === 'match') return false;
      var summary = $('modal-summary');
      var session = $('modal-session');
      if (summary && !summary.hidden) return false;
      if (session && !session.hidden) return false;
      return true;
    },
    apply: function () { refreshFaces(); render(); }
  });
})();
