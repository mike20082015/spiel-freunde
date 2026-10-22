/* Ort des Tisches. Die Wahl gilt in jedem Spiel, pro Spieler im Browser.
   Ohne Serverfeld bleibt sie in localStorage und, wenn eine Sitzung da ist,
   zusätzlich am lokalen Profil. Leer heißt: das Spiel behält seinen Look. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpielpartnerOrte = api;
  if (typeof document !== 'undefined' && document.documentElement) {
    try {
      var search = (typeof location !== 'undefined' && location.search) || '';
      api.apply(api.previewId(search) || api.read(), undefined, undefined, search);
    } catch (err) { /* privat */ }
    var boot = function () { api.install(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var GUEST_KEY = 'sf-ort';
  var SESSION_KEY = 'sf-account';
  /* Asia/Bangkok hat keinen Sommerzeitversatz, deshalb +07:00.
     from und until sind inklusive. Ein abgelaufener Saison-Tisch
     verschwindet aus der Auswahl, und eine gespeicherte Wahl fällt
     auf den normalen Look zurück. Neue Saison: Eintrag hier und die
     Szene in orte.css. ?saison=id zeigt einen Tisch vor seinem Datum,
     nur für diese Ansicht. */
  var SEASON_ZONE = 'Asia/Bangkok';
  var SEASONS = [
    {
      id: 'halloween',
      name: 'Halloween-Tisch',
      scene: 'halloween',
      from: '2026-10-22T00:00:00+07:00',
      until: '2026-11-05T23:59:59+07:00',
      badge: 'Nur bis 5. November'
    },
    {
      id: 'nikolaus',
      name: 'Nikolaus-Tisch',
      scene: 'nikolaus',
      from: '2026-11-27T00:00:00+07:00',
      until: '2026-12-06T23:59:59+07:00',
      badge: 'Nur bis 6. Dezember'
    },
    {
      id: 'weihnachten',
      name: 'Weihnachtstisch',
      scene: 'weihnachten',
      from: '2026-12-07T00:00:00+07:00',
      until: '2026-12-26T23:59:59+07:00',
      badge: 'Nur bis 26. Dezember'
    }
  ];
  var ORTE = [
    { id: '', name: 'Wie bisher', scene: 'default' },
    { id: 'stammtisch', name: 'Gemütlicher Stammtisch', scene: 'stammtisch', image: '/assets/stammtisch-szene.jpg' },
    { id: 'kneipe', name: 'Gemütliche Eckkneipe', scene: 'kneipe', image: '/assets/ort-kneipe.jpg' },
    { id: 'wohnzimmer', name: 'Wohnzimmer mit Kamin', scene: 'wohnzimmer' },
    { id: 'biergarten', name: 'Biergarten', scene: 'biergarten' },
    { id: 'rayong', name: 'Strand in Rayong bei Sonnenuntergang', scene: 'rayong', image: '/assets/ort-rayong.jpg' },
    { id: 'terrasse', name: 'Terrasse am Abend', scene: 'terrasse' },
    { id: 'anden', name: 'Berghütte in den Anden', scene: 'anden', image: '/assets/ort-anden.jpg' }
  ];

  function timeOf(now) {
    if (now instanceof Date) return now.getTime();
    if (typeof now === 'number') return now;
    if (typeof now === 'string') return Date.parse(now);
    return Date.now();
  }

  function seasonById(id) {
    for (var i = 0; i < SEASONS.length; i++) if (SEASONS[i].id === id) return SEASONS[i];
    return null;
  }

  function pageSearch() {
    try {
      if (typeof location !== 'undefined' && location.search) return location.search;
    } catch (err) { /* ohne Fenster */ }
    return '';
  }

  function previewId(search) {
    var query = search == null ? pageSearch() : String(search);
    var match = /(?:\?|&)saison=([a-z0-9_-]+)/i.exec(query);
    if (!match) return '';
    var id = match[1].toLowerCase();
    return seasonById(id) ? id : '';
  }

  function seasonOpen(id, now, search) {
    var season = typeof id === 'object' && id ? id : seasonById(id);
    if (!season) return false;
    if (previewId(search) === season.id) return true;
    var t = timeOf(now);
    return t >= Date.parse(season.from) && t <= Date.parse(season.until);
  }

  function permanent(id) {
    for (var i = 0; i < ORTE.length; i++) if (ORTE[i].id === id) return ORTE[i];
    return null;
  }

  function catalog(now, search) {
    var open = [];
    for (var i = 0; i < SEASONS.length; i++) if (seasonOpen(SEASONS[i], now, search)) open.push(SEASONS[i]);
    return [ORTE[0]].concat(open).concat(ORTE.slice(1));
  }

  function byId(id, now, search) {
    var list = catalog(now, search);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    var season = seasonById(id);
    if (season && seasonOpen(season, now, search)) return season;
    return permanent(id) || ORTE[0];
  }

  function known(id, now, search) {
    if (id === '') return true;
    if (permanent(id)) return true;
    return seasonOpen(id, now, search);
  }

  function storageOf(storage) {
    if (storage) return storage;
    try { return localStorage; }
    catch (err) { return null; }
  }

  function getRaw(storage, key) {
    if (!storage) return null;
    try {
      var value = storage.getItem(key);
      return value == null ? null : String(value);
    } catch (err) {
      return null;
    }
  }

  function readSession(storage) {
    var raw = getRaw(storage, SESSION_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (err) { return null; }
  }

  function playerId(storage) {
    var session = readSession(storage);
    var id = session && session.player && session.player.id;
    if (!id && session && session.me && session.me.player) id = session.me.player.id;
    id = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    return id;
  }

  function storageKey(storage) {
    var id = playerId(storage);
    return id ? 'sf-ort-' + id : GUEST_KEY;
  }

  function sessionOrt(storage) {
    var session = readSession(storage);
    if (!session || !playerId(storage)) return null;
    if (typeof session.ort === 'string') return session.ort;
    if (session.me && typeof session.me.ort === 'string') return session.me.ort;
    return null;
  }

  function read(storage, now) {
    storage = storageOf(storage);
    var key = storageKey(storage);
    var raw = getRaw(storage, key);
    if (raw == null && playerId(storage)) {
      raw = sessionOrt(storage);
      if (raw == null) raw = getRaw(storage, GUEST_KEY);
    }
    if (raw == null) return '';
    if (!known(raw, now)) {
      if (seasonById(raw)) write(storage, '', now);
      return '';
    }
    return raw;
  }

  function write(storage, id, now, search) {
    storage = storageOf(storage);
    if (!known(id, now, search)) id = '';
    if (!storage) return id;
    try { storage.setItem(storageKey(storage), id); }
    catch (err) { /* privat */ }
    var session = readSession(storage);
    if (session && session.token && playerId(storage)) {
      session.ort = id;
      if (session.me && typeof session.me === 'object') session.me.ort = id;
      try { storage.setItem(SESSION_KEY, JSON.stringify(session)); }
      catch (err) { /* privat */ }
    }
    return id;
  }

  function apply(id, doc, now, search) {
    var root = (doc || document).documentElement;
    if (!root) return '';
    if (!known(id, now, search)) id = '';
    if (!id) {
      if (root.removeAttribute) root.removeAttribute('data-ort');
      if (root.dataset) delete root.dataset.ort;
    } else if (root.setAttribute) {
      root.setAttribute('data-ort', id);
    } else if (root.dataset) {
      root.dataset.ort = id;
    }
    return id;
  }

  function el(doc, tag, className) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function choiceButton(doc, ort) {
    var button = el(doc, 'button', 'ort-choice');
    button.type = 'button';
    button.setAttribute('data-ort-id', ort.id);
    button.title = ort.name;
    var thumb = el(doc, 'span', 'ort-thumb is-' + ort.scene);
    thumb.setAttribute('aria-hidden', 'true');
    if (ort.image) thumb.style.backgroundImage = 'url("' + ort.image + '")';
    if (ort.badge) {
      var badge = el(doc, 'span', 'ort-badge');
      badge.textContent = ort.badge;
      thumb.appendChild(badge);
      button.title = ort.name + ', ' + ort.badge;
    }
    var name = el(doc, 'span', 'ort-name');
    name.textContent = ort.name;
    button.appendChild(thumb);
    button.appendChild(name);
    return button;
  }

  function fillGrid(doc, grid, now, search) {
    grid.textContent = '';
    catalog(now, search).forEach(function (ort) {
      grid.appendChild(choiceButton(doc, ort));
    });
  }

  function install(doc, storage) {
    doc = doc || document;
    storage = storageOf(storage);
    if (!doc.querySelector || doc.getElementById('btn-ort') || !doc.querySelector('.topbar-actions')) return false;
    var actions = doc.querySelector('.topbar-actions');
    apply(read(storage), doc);

    var button = el(doc, 'button', 'tbtn');
    button.id = 'btn-ort';
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span class="lbl-long">Ort</span><span class="lbl-short">Ort</span>';
    var settingsBtn = doc.getElementById('btn-settings');
    if (settingsBtn && settingsBtn.parentNode === actions) actions.insertBefore(button, settingsBtn);
    else actions.appendChild(button);

    var pop = el(doc, 'div', 'ort-pop');
    pop.id = 'ort-pop';
    pop.hidden = true;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Ort wählen');
    pop.innerHTML = '<div class="ort-pop-head"><b>Wo steht der Tisch?</b><button type="button" class="ort-close" data-ort-close>Schließen</button></div>';
    var popGrid = el(doc, 'div', 'ort-grid');
    popGrid.setAttribute('data-ort-grid', '');
    pop.appendChild(popGrid);
    (doc.body || doc.documentElement).appendChild(pop);
    fillGrid(doc, popGrid);

    var host = doc.querySelector('#modal-settings .opt-grid') || doc.querySelector('#modal-settings .modal-card');
    if (host && !doc.getElementById('ort-settings')) {
      var field = el(doc, 'fieldset', 'opt ort-settings');
      field.id = 'ort-settings';
      var legend = el(doc, 'legend');
      legend.textContent = 'Ort';
      var note = el(doc, 'p', 'note');
      note.textContent = 'Der Ort gilt in allen Spielen auf diesem Gerät.';
      var grid = el(doc, 'div', 'ort-grid');
      grid.setAttribute('data-ort-grid', '');
      field.appendChild(legend);
      field.appendChild(grid);
      field.appendChild(note);
      fillGrid(doc, grid);
      if (host.classList && host.classList.contains('opt-grid')) host.insertBefore(field, host.firstChild);
      else {
        var heading = host.querySelector('h3');
        if (heading && heading.nextSibling) host.insertBefore(field, heading.nextSibling);
        else host.appendChild(field);
      }
    }

    var intro = doc.getElementById('intro') || doc.getElementById('lobby');
    if (intro && !doc.getElementById('btn-ort-intro')) {
      var introBtn = el(doc, 'button', 'ort-intro-btn');
      introBtn.id = 'btn-ort-intro';
      introBtn.type = 'button';
      introBtn.textContent = 'Ort wählen';
      var start = intro.querySelector('#btn-start');
      if (start) intro.insertBefore(introBtn, start);
      else intro.appendChild(introBtn);
    }

    var room = doc.querySelector('.room');
    if (room && !doc.getElementById('ort-banner')) {
      var glow = el(doc, 'div', 'ort-glow');
      glow.id = 'ort-glow';
      glow.setAttribute('aria-hidden', 'true');
      var snow = el(doc, 'div', 'ort-snow');
      snow.id = 'ort-snow';
      snow.setAttribute('aria-hidden', 'true');
      var banner = el(doc, 'p', 'ort-banner');
      banner.id = 'ort-banner';
      banner.hidden = true;
      room.insertBefore(banner, room.firstChild);
      room.insertBefore(snow, room.firstChild);
      room.insertBefore(glow, room.firstChild);
    }

    var visitPick = null;
    function searchNow() {
      try { return (typeof location !== 'undefined' && location.search) || ''; }
      catch (err) { return ''; }
    }
    function shownId() {
      if (visitPick != null) return visitPick;
      var preview = previewId(searchNow());
      if (preview) return preview;
      return read(storage);
    }

    function paint() {
      var search = searchNow();
      var sig = catalog(undefined, search).map(function (ort) { return ort.id; }).join('|');
      if (sig !== paint.sig) {
        paint.sig = sig;
        var grids = doc.querySelectorAll('[data-ort-grid]');
        for (var g = 0; g < grids.length; g++) fillGrid(doc, grids[g], undefined, search);
      }
      var current = shownId();
      apply(current, doc, undefined, search);
      var meta = byId(current, undefined, search);
      var nodes = doc.querySelectorAll('[data-ort-id]');
      for (var i = 0; i < nodes.length; i++) {
        var on = nodes[i].getAttribute('data-ort-id') === current;
        nodes[i].setAttribute('aria-pressed', on ? 'true' : 'false');
        nodes[i].classList.toggle('is-on', on);
      }
      button.title = current ? meta.name : 'Ort des Tisches';
      var banner = doc.getElementById('ort-banner');
      if (banner) {
        banner.hidden = !current;
        banner.textContent = current ? meta.name : '';
      }
    }

    function open() {
      pop.hidden = false;
      button.setAttribute('aria-expanded', 'true');
    }

    function close() {
      pop.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }

    function choose(id) {
      visitPick = id;
      write(storage, id, undefined, searchNow());
      paint();
      close();
    }

    button.addEventListener('click', function (event) {
      event.stopPropagation();
      if (pop.hidden) open();
      else close();
    });
    var introBtn = doc.getElementById('btn-ort-intro');
    if (introBtn) introBtn.addEventListener('click', function (event) {
      event.stopPropagation();
      open();
    });
    pop.addEventListener('click', function (event) {
      event.stopPropagation();
      var pick = event.target.closest ? event.target.closest('[data-ort-id]') : null;
      if (pick) choose(pick.getAttribute('data-ort-id'));
      if (event.target.closest && event.target.closest('[data-ort-close]')) close();
    });
    var settings = doc.getElementById('ort-settings');
    if (settings) settings.addEventListener('click', function (event) {
      var pick = event.target.closest ? event.target.closest('[data-ort-id]') : null;
      if (pick) choose(pick.getAttribute('data-ort-id'));
    });
    doc.addEventListener('click', function () { close(); });
    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') close();
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', function (event) {
        if (event.key && event.key.indexOf('sf-ort') === 0) paint();
      });
    }
    function arm() {
      if (typeof setTimeout !== 'function') return;
      var now = Date.now();
      var next = null;
      for (var i = 0; i < SEASONS.length; i++) {
        var points = [Date.parse(SEASONS[i].from), Date.parse(SEASONS[i].until) + 1];
        for (var p = 0; p < points.length; p++) {
          if (points[p] > now && (next == null || points[p] < next)) next = points[p];
        }
      }
      if (next == null) return;
      setTimeout(function () { paint(); arm(); }, Math.min(next - Date.now() + 30, 2147483647));
    }
    paint();
    arm();
    return true;
  }

  return {
    ORTE: ORTE,
    SEASONS: SEASONS,
    SEASON_ZONE: SEASON_ZONE,
    GUEST_KEY: GUEST_KEY,
    catalog: catalog,
    previewId: previewId,
    seasonOpen: seasonOpen,
    byId: byId,
    known: known,
    playerId: playerId,
    storageKey: storageKey,
    read: read,
    write: write,
    apply: apply,
    install: install
  };
});
