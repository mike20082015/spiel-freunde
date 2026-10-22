/* Ort des Tisches. Die Wahl gilt in jedem Spiel, pro Spieler im Browser.
   Ohne Serverfeld bleibt sie in localStorage und, wenn eine Sitzung da ist,
   zusätzlich am lokalen Profil. Leer heißt: das Spiel behält seinen Look. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SpielpartnerOrte = api;
  if (typeof document !== 'undefined' && document.documentElement) {
    try { api.apply(api.read()); }
    catch (err) { /* privat */ }
    var boot = function () { api.install(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var GUEST_KEY = 'sf-ort';
  var SESSION_KEY = 'sf-account';
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

  function byId(id) {
    for (var i = 0; i < ORTE.length; i++) if (ORTE[i].id === id) return ORTE[i];
    return ORTE[0];
  }

  function known(id) {
    return !!byId(id) && (id === '' || byId(id).id === id);
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

  function read(storage) {
    storage = storageOf(storage);
    var key = storageKey(storage);
    var raw = getRaw(storage, key);
    if (raw == null && playerId(storage)) {
      raw = sessionOrt(storage);
      if (raw == null) raw = getRaw(storage, GUEST_KEY);
    }
    if (raw == null || !known(raw)) return '';
    return raw;
  }

  function write(storage, id) {
    storage = storageOf(storage);
    if (!known(id)) id = '';
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

  function apply(id, doc) {
    var root = (doc || document).documentElement;
    if (!root) return '';
    if (!known(id)) id = '';
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
    var name = el(doc, 'span', 'ort-name');
    name.textContent = ort.name;
    button.appendChild(thumb);
    button.appendChild(name);
    return button;
  }

  function fillGrid(doc, grid) {
    grid.textContent = '';
    ORTE.forEach(function (ort) {
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
      var banner = el(doc, 'p', 'ort-banner');
      banner.id = 'ort-banner';
      banner.hidden = true;
      room.insertBefore(banner, room.firstChild);
    }

    function paint() {
      var current = read(storage);
      apply(current, doc);
      var meta = byId(current);
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
      write(storage, id);
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
    paint();
    return true;
  }

  return {
    ORTE: ORTE,
    GUEST_KEY: GUEST_KEY,
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
