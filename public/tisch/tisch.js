/* Privater Skat-Tisch. Der Server mischt. Hier siehst Du nur Deine Karten. */
(function () {
  'use strict';

  const E = window.SkatEngine;
  const C = window.SkatCards;
  const Talk = window.SkatTalk;
  const Voice = window.SkatVoice;
  const $ = (id) => document.getElementById(id);
  const SESSION_KEY = 'sf-tisch-session';
  const SOUND_KEY = 'sf-tisch-sound';
  const PARTNERS = [
    { id: 'horst', name: 'Horst' },
    { id: 'margarethe', name: 'Margarethe' },
    { id: 'urs', name: 'Urs', premium: true },
    { id: 'vreni', name: 'Vreni', premium: true },
    { id: 'sepp', name: 'Sepp', premium: true },
    { id: 'hilde', name: 'Oma Hilde', premium: true },
    { id: 'lena', name: 'Lena', premium: true },
    { id: 'jonas', name: 'Jonas', premium: true },
    { id: 'oemer', name: 'Ömer', premium: true },
    { id: 'ruediger', name: 'Rüdiger', premium: true },
    { id: 'chantal', name: 'Chantal', premium: true },
  ];
  const AI_SLUG = { hilde: 'oma-hilde' };

  const S = {
    view: null,
    session: null,
    ws: null,
    wsWait: 1000,
    discard: [],
    handKey: '',
    panelKey: '',
    trickKey: '',
    oppKey: '',
    chatSeen: 0,
    chatPrimed: false,
    eventsPrimed: false,
    eventCursor: 0,
    counted: 0,
    answered: 0,
    busy: false,
    youFace: null,
    sound: true,
  };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toLocaleUpperCase('de-DE');
  }

  function normCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z2-9]/g, '').replace(/[01OI]/g, '');
  }

  function loadSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function saveSession(session) {
    S.session = session;
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) { /* privat */ }
  }

  function premium() {
    try {
      const Ent = window.SpielpartnerEntitlement;
      if (!Ent) return false;
      const view = Ent.describe(Ent.load(localStorage), Date.now());
      return !!(view && view.allUnlocked);
    } catch (e) { return false; }
  }

  function partners() {
    return PARTNERS.filter((person) => !person.premium || premium());
  }

  function portrait(aiId) {
    if (!aiId) return '';
    const slug = AI_SLUG[aiId] || aiId;
    return '/media/spielpartner/' + slug + '.jpg';
  }

  function allowDeal() {
    if (window.SpielpartnerRounds && window.SpielpartnerRounds.gate() === false) return false;
    return true;
  }

  function dealLabel(label) {
    const rounds = window.SpielpartnerRounds;
    if (rounds && typeof rounds.nextPlayLabel === 'function') return rounds.nextPlayLabel(label);
    return label;
  }

  function paintRounds() {
    if (!window.SpielpartnerRounds) return;
    window.SpielpartnerRounds.paint($('home-rounds'));
    window.SpielpartnerRounds.paint($('lobby-rounds'));
  }

  async function post(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    let data = {};
    try { data = await res.json(); } catch (e) { data = {}; }
    if (!res.ok || data.ok === false) {
      const error = new Error(data.error || 'Das hat nicht geklappt.');
      error.status = res.status;
      throw error;
    }
    return data;
  }

  function showHome(message) {
    S.view = null;
    $('screen-home').hidden = false;
    $('screen-table').hidden = true;
    document.body.classList.add('tisch-home');
    document.body.classList.remove('in-play');
    document.body.dataset.screen = 'home';
    $('home-error').textContent = message || '';
    paintRounds();
  }

  function showTable() {
    $('screen-home').hidden = true;
    $('screen-table').hidden = false;
  }

  function face(el, seat, you) {
    if (!el) return;
    el.replaceChildren();
    if (you && S.youFace && S.youFace.imageUrl) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = S.youFace.imageUrl;
      el.appendChild(img);
      el.classList.add('has-photo');
      return;
    }
    el.classList.remove('has-photo');
    if (seat && seat.kind === 'ai') {
      const img = document.createElement('img');
      img.alt = seat.name || '';
      img.src = portrait(seat.aiId);
      el.appendChild(img);
      return;
    }
    el.textContent = initials(seat && seat.name);
  }

  function visual(player, you) {
    return (player - you + 3) % 3;
  }

  function seatByVisual(view, slot) {
    const index = (view.you + slot) % 3;
    return view.seats[index];
  }

  function back(parent) {
    const el = C.backEl();
    const img = el.querySelector('img');
    if (img) img.src = '/skat/assets/variante-a-favicon-dunkel.svg';
    parent.appendChild(el);
    return el;
  }

  function bubble(player, text) {
    if (!S.view || player == null) return;
    const slot = visual(player, S.view.you);
    const el = slot === 0 ? $('bubble-me') : (slot === 1 ? $('bubble-left') : $('bubble-right'));
    if (!el) return;
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 4200);
  }

  function paintSeats(view) {
    const map = [
      { slot: 0, name: $('me-name'), role: $('role-me'), ava: $('ava-you'), root: $('seat-me') },
      { slot: 1, name: $('name-left'), role: $('role-left'), ava: $('ava-left'), root: $('seat-left') },
      { slot: 2, name: $('name-right'), role: $('role-right'), ava: $('ava-right'), root: $('seat-right') },
    ];
    const active = view.status === 'live' && view.phase !== 'done' ? view.turn : null;
    map.forEach((item) => {
      const seat = seatByVisual(view, item.slot);
      item.root.classList.toggle('active', !!(seat && seat.index === active));
      const label = seat && seat.kind !== 'empty' ? seat.name : 'Frei';
      item.name.textContent = label;
      item.role.textContent = seat && seat.role ? seat.role : (seat && seat.kind === 'ai' ? 'Spielpartner' : '');
    });
    const faceKey = view.seats.map((seat) => [seat.index, seat.kind, seat.name, seat.aiId].join(':')).join('|')
      + '|' + ((S.youFace && S.youFace.imageUrl) || '');
    if (faceKey === S.seatKey) return;
    S.seatKey = faceKey;
    map.forEach((item) => {
      const seat = seatByVisual(view, item.slot);
      if (item.slot === 0) face(item.ava, seat, true);
      else {
        item.ava.replaceChildren();
        item.ava.className = 'ava-wrap';
        if (!seat || seat.kind === 'empty') {
          const span = document.createElement('span');
          span.className = 'ava ava-fallback';
          span.textContent = '·';
          item.ava.appendChild(span);
        } else if (seat.kind === 'ai') {
          const img = document.createElement('img');
          img.className = 'ava';
          img.alt = seat.name;
          img.src = portrait(seat.aiId);
          const ring = document.createElement('span');
          ring.className = 'turn-ring';
          item.ava.appendChild(img);
          item.ava.appendChild(ring);
        } else {
          const span = document.createElement('span');
          span.className = 'ava ava-fallback';
          span.textContent = initials(seat.name);
          const ring = document.createElement('span');
          ring.className = 'turn-ring';
          item.ava.appendChild(span);
          item.ava.appendChild(ring);
        }
      }
    });
  }

  function paintOpp(view) {
    const key = view.seats.map((seat) => seat.kind + (seat.aiId || '') + (view.handSizes ? view.handSizes[seat.index] : 0)).join('|')
      + ':' + (view.openHand || []).join(',');
    if (key === S.oppKey) return;
    S.oppKey = key;
    [['opp-left', 1], ['opp-right', 2]].forEach((pair) => {
      const parent = $(pair[0]);
      const seat = seatByVisual(view, pair[1]);
      parent.replaceChildren();
      if (!seat || seat.kind === 'empty' || view.status === 'lobby') return;
      if (view.openHand && seat.index === view.declarer) {
        view.openHand.forEach((card) => parent.appendChild(C.cardEl(card)));
        return;
      }
      const count = view.handSizes ? view.handSizes[seat.index] : 0;
      for (let i = 0; i < count; i++) back(parent);
    });
  }

  function paintHand(view) {
    const cards = (view.hand || []).slice();
    const sorted = E ? E.sortHand(cards, view.game || { type: 'grand' }) : cards;
    const key = sorted.join(',') + ':' + view.phase + ':' + view.yourTurn;
    if (key !== S.handKey) {
      S.handKey = key;
      S.discard = S.discard.filter((card) => sorted.includes(card));
      const hand = $('hand');
      hand.replaceChildren();
      sorted.forEach((card) => {
        const el = C.cardEl(card, { tag: 'button' });
        el.dataset.card = card;
        el.addEventListener('click', () => onCard(card));
        hand.appendChild(el);
      });
    }
    const legal = view.legal || [];
    $('hand').querySelectorAll('.card').forEach((el) => {
      const card = el.dataset.card;
      const playable = view.phase === 'play' && view.yourTurn && legal.includes(card);
      const picking = view.phase === 'discard' && view.yourTurn;
      el.classList.toggle('playable', playable || picking);
      el.classList.toggle('blocked', view.phase === 'play' && view.yourTurn && !legal.includes(card));
      el.classList.toggle('selected', S.discard.includes(card));
      el.disabled = !(playable || picking);
    });
    $('tabletop').classList.toggle('hints', view.phase === 'play' && view.yourTurn);
  }

  function paintTrick(view) {
    const trick = view.trick || [];
    const key = trick.map((entry) => entry.player + entry.card).join(',');
    if (key === S.trickKey) return;
    S.trickKey = key;
    const parent = $('trick');
    parent.replaceChildren();
    trick.forEach((entry) => {
      const el = C.cardEl(entry.card);
      el.classList.add('p' + visual(entry.player, view.you));
      parent.appendChild(el);
    });
    const pile = $('skat-pile');
    pile.replaceChildren();
    if (view.status === 'live' && (view.phase === 'bidding' || view.phase === 'skat')) {
      back(pile);
      back(pile);
    }
  }

  function paintScore(view) {
    const table = $('score-table');
    table.replaceChildren();
    const head = document.createElement('tr');
    view.seats.forEach((seat) => {
      const th = document.createElement('th');
      th.textContent = seat.kind === 'empty' ? 'Frei' : seat.name;
      head.appendChild(th);
    });
    table.appendChild(head);
    const row = document.createElement('tr');
    view.scores.forEach((score) => {
      const td = document.createElement('td');
      td.textContent = String(score);
      row.appendChild(td);
    });
    table.appendChild(row);
    const mode = view.rules && view.rules.mode === 'kneipe' ? 'Kneipe' : 'Offiziell';
    const goal = view.target == null ? 'ohne Limit' : 'bis ' + view.target;
    $('mode-badge').textContent = goal;
    $('target-line').textContent = mode + ', ' + goal + (view.gameLabel ? ' · ' + view.gameLabel : '');
  }

  function paintChat(view) {
    const log = $('chat-log');
    const lines = view.chat || [];
    if (!S.chatPrimed) {
      log.replaceChildren();
      lines.forEach((line) => log.appendChild(chatLine(line)));
      S.chatSeen = lines.reduce((max, line) => Math.max(max, line.id || 0), 0);
      S.chatPrimed = true;
      log.scrollTop = log.scrollHeight;
      return;
    }
    lines.forEach((line) => {
      if (line.id <= S.chatSeen) return;
      S.chatSeen = line.id;
      log.appendChild(chatLine(line));
      log.scrollTop = log.scrollHeight;
      if (line.ai && line.aiId) {
        bubble(line.seat, line.text);
        if (Voice) Voice.speak(line.aiId, line.text, { priority: true });
      }
    });
  }

  function chatLine(line) {
    const p = document.createElement('p');
    p.className = 'cl' + (!line.ai && S.view && line.seat === S.view.you ? ' you' : '');
    const b = document.createElement('b');
    b.textContent = (line.name || 'Jemand') + ': ';
    p.appendChild(b);
    p.appendChild(document.createTextNode(line.text || ''));
    return p;
  }

  function lobbyRow(view, seat) {
    const row = document.createElement('div');
    row.className = 'seat-row';
    const who = document.createElement('div');
    who.className = 'who';
    const title = document.createElement('b');
    if (seat.kind === 'empty') title.textContent = 'Platz ' + (seat.index + 1) + ' ist frei';
    else title.textContent = seat.name + (seat.you ? ' (Du)' : '') + (seat.host ? ' · Gastgeber' : '');
    who.appendChild(title);
    if (seat.kind === 'ai') {
      const small = document.createElement('small');
      small.textContent = 'Spielpartner';
      who.appendChild(small);
    } else if (seat.kind === 'human') {
      const small = document.createElement('small');
      small.textContent = seat.connected ? 'ist da' : 'kommt gleich wieder';
      who.appendChild(small);
    }
    row.appendChild(who);
    if (view.youAreHost && view.status === 'lobby' && seat.kind === 'empty') {
      partners().filter((person) => !person.premium).forEach((person) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn btn-sm ' + (person.id === 'horst' ? 'btn-gold' : 'btn-ghost-dark');
        button.textContent = person.name;
        button.addEventListener('click', () => act('fill', { seatIndex: seat.index, aiId: person.id }));
        row.appendChild(button);
      });
      const extra = partners().filter((person) => person.premium);
      if (extra.length) {
        const select = document.createElement('select');
        select.className = 'more-partner';
        const first = document.createElement('option');
        first.value = '';
        first.textContent = 'Weitere';
        select.appendChild(first);
        extra.forEach((person) => {
          const option = document.createElement('option');
          option.value = person.id;
          option.textContent = person.name;
          select.appendChild(option);
        });
        select.addEventListener('change', () => {
          if (!select.value) return;
          act('fill', { seatIndex: seat.index, aiId: select.value });
        });
        row.appendChild(select);
      }
    }
    if (view.youAreHost && view.status === 'lobby' && seat.kind === 'ai') {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-ghost-dark btn-sm';
      button.textContent = 'Frei machen';
      button.addEventListener('click', () => act('clear', { seatIndex: seat.index }));
      row.appendChild(button);
    }
    return row;
  }

  function paintLobby(view) {
    const lobby = $('lobby');
    const show = view.status === 'lobby';
    lobby.hidden = !show;
    if (!show) return;
    $('lobby-code').textContent = view.code;
    $('lobby-code').dataset.code = view.code;
    $('lobby-link').textContent = location.origin + '/tisch/?code=' + view.code;
    const full = view.seats.every((seat) => seat.kind !== 'empty');
    $('btn-start').hidden = !view.youAreHost;
    $('btn-start').disabled = !full;
    $('btn-start').textContent = full ? 'Spiel starten' : 'Noch ist ein Platz frei';
    const mode = view.rules && view.rules.mode === 'kneipe' ? 'Kneipenskat' : 'Offizielle Skatordnung';
    $('lobby-rules').textContent = mode + (view.target == null ? ', ohne Limit.' : ', bis ' + view.target + '.');
    const key = view.seats.map((seat) => [seat.kind, seat.name, seat.aiId, seat.connected, seat.host, seat.you].join(':')).join('|')
      + '|' + view.youAreHost + '|' + (premium() ? '1' : '0');
    if (key === S.lobbyKey) return;
    S.lobbyKey = key;
    const box = $('lobby-seats');
    box.replaceChildren();
    view.seats.forEach((seat) => box.appendChild(lobbyRow(view, seat)));
  }

  function panelSignature(view) {
    return [
      view.status, view.phase, view.yourTurn, view.bidValue, view.gameLabel, view.winnerSeat,
      view.kontra ? 1 : 0, view.re ? 1 : 0, view.doubling && view.doubling.kind, view.doubling && view.doubling.player,
      (view.bidding && view.bidding.role), (view.bidding && view.bidding.value),
      (view.result && view.result.value), (view.hand || []).length,
    ].join('|');
  }

  function paintPanel(view) {
    const key = panelSignature(view);
    if (key === S.panelKey) return;
    S.panelKey = key;
    const panel = $('panel');
    if (view.status === 'lobby') { panel.hidden = true; panel.replaceChildren(); return; }
    if (view.status === 'ended') {
      panel.hidden = false;
      const winner = view.seats[view.winnerSeat];
      panel.innerHTML = '<h3>' + esc(winner ? winner.name : 'Jemand') + ' hat den Tisch gewonnen</h3>'
        + '<p>Ziel ' + esc(view.target) + '. Endstand ' + esc(view.scores.join(' : ')) + '.</p>'
        + '<p class="tip">Der Tisch ist beendet. Ein späteres Turnier würde ' + esc(winner ? winner.name : 'den Sieger') + ' in die nächste Runde schicken.</p>';
      return;
    }
    if (!view.yourTurn && view.phase !== 'done') { panel.hidden = true; panel.replaceChildren(); return; }
    panel.hidden = false;
    if (view.phase === 'done') {
      const next = view.youAreHost
        ? '<div class="panel-row"><button class="btn btn-gold" type="button" id="btn-next" data-play-label="Nächstes Spiel">' + dealLabel('Nächstes Spiel') + '</button></div>'
        : '<p>Warte auf den Gastgeber.</p>';
      panel.innerHTML = '<h3>Spiel zu Ende</h3><p>' + esc(resultText(view)) + '</p>' + next;
      const button = $('btn-next');
      if (button) button.addEventListener('click', () => { if (allowDeal()) act('next'); });
      return;
    }
    if (view.phase === 'bidding' && view.bidding) {
      const turn = view.bidding;
      const value = turn.value || 18;
      const yes = turn.role === 'hear' ? 'Ja, ' + value : (turn.role === 'open' ? 'Ich spiele 18' : value + ' sagen');
      panel.innerHTML = '<h3>Reizen</h3><p class="big">' + esc(String(value)) + '</p>'
        + '<div class="panel-row"><button class="btn btn-gold" type="button" id="bid-yes">' + esc(yes) + '</button>'
        + '<button class="btn btn-wine" type="button" id="bid-no">Passe</button></div>';
      $('bid-yes').addEventListener('click', () => act('bid', { yes: true }));
      $('bid-no').addEventListener('click', () => act('bid', { yes: false }));
      return;
    }
    if (view.phase === 'skat') {
      panel.innerHTML = '<h3>Hand oder Skat?</h3><p>Zwei Karten liegen verdeckt. Du kannst sie aufnehmen oder aus der Hand spielen.</p>'
        + '<div class="panel-row"><button class="btn btn-gold" type="button" id="do-hand">Hand spielen</button>'
        + '<button class="btn btn-wine" type="button" id="do-take">Skat aufnehmen</button></div>';
      $('do-hand').addEventListener('click', () => act('hand'));
      $('do-take').addEventListener('click', () => act('take'));
      return;
    }
    if (view.phase === 'discard') {
      panel.innerHTML = '<h3>Zwei Karten drücken</h3><p>Tippe zwei Karten an, die in den Skat sollen.</p>'
        + '<div class="panel-row"><button class="btn btn-gold" type="button" id="do-discard">Drücken</button></div>';
      $('do-discard').addEventListener('click', () => {
        if (S.discard.length !== 2) return setError('Genau zwei Karten.');
        act('discard', { cards: S.discard.slice() });
      });
      return;
    }
    if (view.phase === 'declare') {
      const hand = !view.skatKnown;
      panel.innerHTML = '<h3>Ansage</h3><div class="games-grid">'
        + suitButton('C', 'Kreuz') + suitButton('S', 'Pik') + suitButton('H', 'Herz') + suitButton('D', 'Karo')
        + '<button class="gbtn" type="button" data-game="grand"><span class="gname">Grand</span></button>'
        + '<button class="gbtn" type="button" data-game="null"><span class="gname">Null</span></button>'
        + '</div>'
        + (hand ? '<div class="checks"><label><input type="checkbox" id="ann-schneider"> Schneider</label><label><input type="checkbox" id="ann-schwarz"> Schwarz</label><label><input type="checkbox" id="ann-ouvert"> Ouvert (nur Null)</label></div>' : '');
      panel.querySelectorAll('[data-trump]').forEach((button) => {
        button.addEventListener('click', () => declare({ type: 'suit', trump: button.dataset.trump }));
      });
      panel.querySelector('[data-game="grand"]').addEventListener('click', () => declare({ type: 'grand' }));
      panel.querySelector('[data-game="null"]').addEventListener('click', () => declare({ type: 'null' }));
      return;
    }
    if (view.doubling && view.yourTurn) {
      const kontra = view.doubling.kind === 'kontra';
      panel.innerHTML = kontra
        ? '<h3>Kontra?</h3><p>Kontra verdoppelt den Spielwert, noch bevor die erste Karte kommt. Gewonnen wie verloren.</p>'
        : '<h3>Re?</h3><p>Es liegt Kontra. Re verdoppelt noch einmal, der Spielwert zählt vierfach.</p>';
      panel.innerHTML += '<div class="panel-row"><button class="btn ' + (kontra ? 'btn-wine' : 'btn-gold') + '" type="button" id="dbl-yes">'
        + (kontra ? 'Kontra' : 'Re') + '</button><button class="btn btn-ghost-dark" type="button" id="dbl-no">'
        + (kontra ? 'Weiter ohne Kontra' : 'Kein Re') + '</button></div>';
      $('dbl-yes').addEventListener('click', () => act('double', { yes: true }));
      $('dbl-no').addEventListener('click', () => act('double', { yes: false }));
      return;
    }
    panel.hidden = true;
  }

  function suitButton(suit, name) {
    const icon = C && C.suitIcon ? C.suitIcon(suit) : '';
    return '<button class="gbtn" type="button" data-trump="' + suit + '"><span class="gname s-' + suit + '">' + icon + esc(name) + '</span></button>';
  }

  function declare(game) {
    const schneider = $('ann-schneider');
    const schwarz = $('ann-schwarz');
    const ouvert = $('ann-ouvert');
    if (schneider && schneider.checked) game.schneiderAnnounced = true;
    if (schwarz && schwarz.checked) game.schwarzAnnounced = true;
    if (ouvert && ouvert.checked && game.type === 'null') game.ouvert = true;
    act('declare', { game: game });
  }

  function resultText(view) {
    const result = view.result;
    if (!result) return 'Das Spiel ist aus.';
    if (result.passedIn) return 'Alle haben gepasst.';
    if (result.ramsch) return 'Ramsch ist durch.';
    const seat = view.seats[result.declarer];
    const name = seat ? seat.name : 'Jemand';
    return name + (result.won ? ' gewinnt ' : ' verliert ') + (result.value || 0) + '.';
  }

  function paint(view) {
    showTable();
    const playing = view.status === 'live' || view.status === 'ended';
    document.body.classList.toggle('tisch-home', view.status === 'lobby');
    document.body.classList.toggle('in-play', playing);
    document.body.dataset.screen = view.status === 'ended' ? 'ended' : (view.status === 'lobby' ? 'lobby' : 'game');
    $('st-main').textContent = view.statusLine || 'Am Tisch';
    const chips = $('st-chips');
    chips.replaceChildren();
    if (view.status === 'lobby') {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = 'Code ' + view.code;
      chips.appendChild(chip);
    }
    if (view.kontra) {
      const chip = document.createElement('span');
      chip.className = 'chip kontra';
      chip.textContent = view.re ? 'Kontra · Re' : 'Kontra';
      chips.appendChild(chip);
    }
    paintSeats(view);
    paintOpp(view);
    paintHand(view);
    paintTrick(view);
    paintScore(view);
    paintChat(view);
    paintLobby(view);
    paintPanel(view);
    paintRounds();
  }

  function noteEvents() {
    const events = (S.view && S.view.events) || [];
    if (!S.eventsPrimed) {
      S.eventCursor = events.reduce((max, event) => Math.max(max, event.seq || 0), 0);
      S.eventsPrimed = true;
      return;
    }
    events.forEach((event) => {
      if (!event.seq || event.seq <= S.eventCursor) return;
      S.eventCursor = event.seq;
      speakEvent(event);
    });
  }

  function speakEvent(event) {
    const seat = S.view.seats[event.seat];
    if (!seat || seat.kind !== 'ai' || !Talk || !Voice) return;
    const id = seat.aiId;
    if (event.kind === 'bid') {
      const token = event.action === 'pass' ? 'pass' : (event.action === 'hold' ? 'hold' : (event.action === 'bid' ? event.value : 'open'));
      const said = Talk.callText(id, token) || (event.action === 'pass' ? 'Ich passe.' : (event.action === 'hold' ? 'Ja.' : 'Ich spiele.'));
      bubble(event.seat, event.action === 'pass' ? 'Passe' : (event.action === 'hold' ? 'Ja' : String(event.value || '18')));
      Voice.speak(id, said, { kind: 'bid' });
    } else if (event.kind === 'kontra' || event.kind === 're') {
      const word = event.yes ? (event.kind === 'kontra' ? 'Kontra' : 'Re') : (event.kind === 'kontra' ? 'Weiter' : 'Kein Re');
      bubble(event.seat, word);
      Voice.speak(id, word);
    } else if (event.kind === 'declare') {
      bubble(event.seat, event.label || 'Ansage');
      speakFresh(id, event.seat, 'declare', event);
    } else if (event.kind === 'gameOver') {
      speakFresh(id, event.seat, 'selfWins', event);
    }
  }

  function noteRounds() {
    const view = S.view;
    if (!view || !view.code) return;
    if (!S.counted) {
      try { S.counted = Number(localStorage.getItem('sf-tisch-counted-' + view.code) || 0); }
      catch (e) { S.counted = 0; }
    }
    if (view.gameNo > S.counted && (view.phase === 'done' || view.status === 'ended')) {
      S.counted = view.gameNo;
      try { localStorage.setItem('sf-tisch-counted-' + view.code, String(S.counted)); } catch (e) { /* privat */ }
      if (window.SpielpartnerRounds) window.SpielpartnerRounds.finish();
      paintRounds();
    }
  }

  function speakFresh(id, seat, ev, event) {
    const fallback = () => (Talk.line(id, ev) || '');
    const speak = (line) => { if (line) Voice.speak(id, line); };
    const sprueche = window.SpielpartnerSprueche;
    if (!sprueche || typeof sprueche.freshComment !== 'function') { speak(fallback()); return; }
    const view = S.view || {};
    const name = (view.seats && view.seats[seat] && view.seats[seat].name) || id;
    const scores = Array.isArray(view.scores) ? view.scores.join(', ') : '';
    sprueche.freshComment({
      character: id,
      event: ev,
      situation: ['Spieler ' + name, view.phase ? ('Phase ' + view.phase) : '', event && event.label ? event.label : '', scores ? ('Punkte ' + scores) : ''].filter(Boolean).join('. '),
      game: { phase: view.phase || '', game: event && event.label ? event.label : null, scores: view.scores || null },
      fallback: fallback,
    }).then(speak);
  }

  async function maybeAi() {
    const view = S.view;
    if (!view || !view.aiSpeaker || !Talk) return;
    const last = (view.chat || [])[view.chat.length - 1];
    if (!last || last.ai || last.id <= S.answered) return;
    const seated = view.seats.filter((seat) => seat.kind === 'ai' && (seat.aiId === 'horst' || seat.aiId === 'margarethe'));
    if (!seated.length) return;
    S.answered = last.id;
    let ids = Talk.responders(last.text).filter((id) => seated.some((seat) => seat.aiId === id));
    if (!ids.length) ids = [seated[0].aiId];
    for (const id of ids) {
      let text = '';
      try { text = await Talk.askAI(id, { message: last.text, game: { phase: view.phase, scores: view.scores } }); }
      catch (e) { text = ''; }
      if (!text) {
        try { text = Talk.cannedReply(id, last.text); } catch (e) { text = ''; }
      }
      if (text) {
        try { await act('aiSay', { aiId: id, text: text, replyTo: last.id }); }
        catch (e) { /* der Tisch hat die Antwort schon */ }
      }
    }
  }

  function applyView(view) {
    if (!view || !view.code) return;
    if (S.view && S.view.code === view.code && view.rev < S.view.rev) return;
    const first = !S.view || S.view.code !== view.code;
    if (first) {
      S.chatPrimed = false;
      S.eventsPrimed = false;
      S.handKey = '';
      S.panelKey = '';
      S.trickKey = '';
      S.oppKey = '';
      S.counted = 0;
      try { S.counted = Number(localStorage.getItem('sf-tisch-counted-' + view.code) || 0); }
      catch (e) { S.counted = 0; }
    }
    S.view = view;
    setError('');
    paint(view);
    noteEvents();
    noteRounds();
    maybeAi();
  }

  function setError(message) {
    const home = $('home-error');
    const lobby = $('lobby-error');
    if (home && document.body.dataset.screen === 'home') home.textContent = message || '';
    if (lobby) lobby.textContent = message || '';
  }

  async function act(action, extra) {
    if (!S.session) return null;
    const foreground = action !== 'aiSay';
    if (S.busy && foreground) return null;
    if (foreground) S.busy = true;
    try {
      const data = await post('/api/tisch/act', Object.assign({
        code: S.session.code,
        token: S.session.token,
        action: action,
      }, extra || {}));
      if (data.left) {
        saveSession(null);
        showHome('Du bist aufgestanden.');
        return null;
      }
      if (data.view) applyView(data.view);
      return data.view;
    } catch (error) {
      setError(error.message);
      if (error.status === 410) {
        saveSession(null);
        showHome(error.message);
      }
      return null;
    } finally {
      if (foreground) S.busy = false;
    }
  }

  function onCard(card) {
    const view = S.view;
    if (!view || !view.yourTurn) return;
    if (view.phase === 'play') {
      if ((view.legal || []).includes(card)) act('play', { card: card });
      return;
    }
    if (view.phase === 'discard') {
      const index = S.discard.indexOf(card);
      if (index >= 0) S.discard.splice(index, 1);
      else if (S.discard.length < 2) S.discard.push(card);
      else S.discard = [S.discard[1], card];
      paintHand(view);
    }
  }

  function connect() {
    if (!S.session || S.ws) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let socket;
    try { socket = new WebSocket(proto + '//' + location.host + '/api/tisch/ws'); }
    catch (e) { scheduleSocket(); return; }
    S.ws = socket;
    socket.addEventListener('open', () => {
      S.wsWait = 1000;
      socket.send(JSON.stringify({ type: 'hello', code: S.session.code, token: S.session.token }));
    });
    socket.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }
      if (msg.type === 'state' && msg.view) applyView(msg.view);
      if (msg.type === 'error' && msg.status === 410) {
        saveSession(null);
        showHome(msg.error || 'Der Tisch ist abgelaufen.');
      } else if (msg.type === 'error') setError(msg.error || '');
    });
    socket.addEventListener('close', () => {
      if (S.ws === socket) S.ws = null;
      scheduleSocket();
    });
    socket.addEventListener('error', () => { try { socket.close(); } catch (e) { /* egal */ } });
  }

  function scheduleSocket() {
    if (!S.session) return;
    const wait = S.wsWait;
    S.wsWait = Math.min(8000, S.wsWait * 2);
    setTimeout(connect, wait);
  }

  async function poll() {
    if (!S.session) return;
    try {
      const data = await post('/api/tisch/poll', { code: S.session.code, token: S.session.token });
      if (data.view) applyView(data.view);
    } catch (error) {
      if (error.status === 410 || error.status === 404 || error.status === 401) {
        saveSession(null);
        showHome(error.message);
      }
    }
  }

  async function enter(session) {
    saveSession(session);
    const url = new URL(location.href);
    url.searchParams.set('code', session.code);
    history.replaceState(null, '', url.pathname + url.search);
    connect();
    await poll();
  }

  async function refreshFace() {
    const api = window.SpielFreundeAvatar;
    if (!api || typeof api.playerSeat !== 'function') return;
    try { S.youFace = await api.playerSeat(); } catch (e) { return; }
    if (S.view) {
      S.oppKey = '';
      paintSeats(S.view);
    } else face($('ava-you'), { name: (S.youFace && S.youFace.name) || 'Du' }, true);
  }

  function bindHome() {
    $('create-target').addEventListener('change', () => {
      $('custom-wrap').hidden = $('create-target').value !== 'custom';
    });
    $('form-create').addEventListener('submit', async (event) => {
      event.preventDefault();
      setError('');
      const target = $('create-target').value;
      try {
        const data = await post('/api/tisch/create', {
          name: $('create-name').value,
          target: target,
          targetCustom: Number($('create-custom').value),
          mode: (new FormData($('form-create')).get('mode') || 'official'),
        });
        await enter({ code: data.code, token: data.token, name: data.name });
      } catch (error) {
        setError(error.message);
      }
    });
    $('form-join').addEventListener('submit', async (event) => {
      event.preventDefault();
      setError('');
      try {
        const data = await post('/api/tisch/join', {
          code: $('join-code').value,
          name: $('join-name').value,
        });
        await enter({ code: data.code, token: data.token, name: data.name });
      } catch (error) {
        setError(error.message);
      }
    });
  }

  function bindTable() {
    $('btn-copy').addEventListener('click', async () => {
      if (!S.view) return;
      const link = location.origin + '/tisch/?code=' + S.view.code;
      try {
        await navigator.clipboard.writeText(link);
        $('btn-copy').textContent = 'Kopiert';
        setTimeout(() => { $('btn-copy').textContent = 'Link kopieren'; }, 1600);
      } catch (e) {
        setError(link);
      }
    });
    $('btn-start').addEventListener('click', () => { if (allowDeal()) act('start'); });
    $('btn-leave').addEventListener('click', () => act('leave'));
    $('chat-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const input = $('chat-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      act('chat', { text: text });
    });
    $('btn-sound').addEventListener('click', () => {
      S.sound = !S.sound;
      try { localStorage.setItem(SOUND_KEY, S.sound ? '1' : '0'); } catch (e) { /* privat */ }
      $('btn-sound').setAttribute('aria-pressed', S.sound ? 'true' : 'false');
      $('btn-sound').classList.toggle('off', !S.sound);
      if (!S.sound && Voice) Voice.stopAll();
    });
    document.addEventListener('pointerdown', () => {
      if (Voice && Voice.unlock) Voice.unlock();
    }, { once: true });
  }

  async function boot() {
    try { S.sound = localStorage.getItem(SOUND_KEY) !== '0'; } catch (e) { S.sound = true; }
    $('btn-sound').setAttribute('aria-pressed', S.sound ? 'true' : 'false');
    $('btn-sound').classList.toggle('off', !S.sound);
    if (Voice && Voice.init) Voice.init({ getSettings: () => ({ sound: S.sound, volume: 80 }) });
    bindHome();
    bindTable();
    paintRounds();
    refreshFace();
    const params = new URLSearchParams(location.search);
    const urlCode = normCode(params.get('code') || '');
    if (urlCode) $('join-code').value = urlCode;
    const saved = loadSession();
    if (saved && saved.token && (!urlCode || normCode(saved.code) === urlCode)) {
      try { await enter(saved); }
      catch (error) {
        saveSession(null);
        showHome(error.status === 410 ? 'Der Tisch ist abgelaufen. Mach einen neuen auf.' : (error.message || ''));
      }
    } else showHome('');
    setInterval(poll, 1500);
    setInterval(() => {
      if (S.ws && S.ws.readyState === 1 && S.session) {
        try { S.ws.send(JSON.stringify({ type: 'ping' })); } catch (e) { /* egal */ }
      }
    }, 20000);
  }

  window.__tisch = {
    get view() { return S.view; },
    get state() { return S.view; }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
