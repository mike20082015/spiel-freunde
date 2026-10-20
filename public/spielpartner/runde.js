/*
 * „Runde wechseln“ an jedem Tisch.
 * Der Knopf und das Fenster kommen von hier. Das Spiel liefert nur,
 * wie viele Gegner sitzen, ob eine Runde läuft, und wie es neu malt.
 */
(function (root) {
  'use strict';

  var hook = null;
  var draft = [];
  var active = 0;
  var pendingHref = '';

  function $(id) { return document.getElementById(id); }

  function lineup() { return root.SpielpartnerLineup; }
  function voices() { return root.SpielpartnerStimmen; }
  function entitlement() { return root.SpielpartnerEntitlement; }
  function storage() {
    try { return root.localStorage; } catch (err) { return null; }
  }

  function count() {
    var n = hook && typeof hook.count === 'function' ? hook.count() : 0;
    var L = lineup();
    if (!L) return n || 0;
    return L.countOf(hook.game, n);
  }

  function inHand() {
    try { return !!(hook && typeof hook.inHand === 'function' && hook.inHand()); }
    catch (err) { return false; }
  }

  function currentIds() {
    var L = lineup();
    var store = storage();
    if (!L || !hook) return [];
    return L.resolveIds(store, hook.game, count(), { entitlement: entitlement(), storage: store, now: Date.now() });
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function allowed(person, seatIndex) {
    var L = lineup();
    if (!L || !person) return false;
    var base = L.defaults(hook.game, count());
    if (person.id === base[seatIndex]) return true;
    return L.maySit(person, entitlement(), storage(), Date.now());
  }

  function stopPreview() {
    var api = voices();
    if (api && typeof api.stopPreview === 'function') api.stopPreview();
    try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (err) { /* fehlt */ }
  }

  function ensure() {
    if ($('modal-runde')) return;
    var nav = document.querySelector('.topbar-actions');
    if (nav && !$('btn-runde')) {
      var btn = document.createElement('button');
      btn.className = 'tbtn';
      btn.id = 'btn-runde';
      btn.type = 'button';
      btn.title = 'Runde wechseln';
      btn.innerHTML = '<span class="lbl-long">Runde wechseln</span><span class="lbl-short">Runde</span>';
      nav.insertBefore(btn, nav.firstChild);
      btn.addEventListener('click', open);
    }
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'modal-runde';
    modal.hidden = true;
    modal.innerHTML = '' +
      '<div class="modal-card runde-sheet" role="dialog" aria-modal="true" aria-labelledby="runde-title">' +
      '<h3 id="runde-title">Runde wechseln</h3>' +
      '<p class="runde-lead">Such dir für jeden Platz eine andere Stimme, oder geh an einen anderen Tisch.</p>' +
      '<div class="runde-seats" id="runde-seats"></div>' +
      '<div class="runde-grid" id="runde-grid"></div>' +
      '<p class="runde-note" id="runde-note"></p>' +
      '<h4 class="runde-next">Anderes Spiel</h4>' +
      '<div class="runde-games" id="runde-games"></div>' +
      '<div class="runde-warn" id="runde-warn" hidden>' +
      '<p>Die laufende Runde wird abgebrochen.</p>' +
      '<div class="runde-warn-actions">' +
      '<button type="button" class="btn btn-ghost-dark" id="runde-keep">Weiter spielen</button>' +
      '<button type="button" class="btn btn-gold" id="runde-anyway">Trotzdem wechseln</button>' +
      '</div></div>' +
      '<div class="modal-actions runde-actions">' +
      '<button type="button" class="btn btn-ghost-dark" id="runde-standard">Standard-Besetzung</button>' +
      '<button type="button" class="btn btn-ghost-dark" id="runde-close">Schließen</button>' +
      '<button type="button" class="btn btn-gold" id="runde-apply">Übernehmen</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (event) {
      if (event.target === modal) close();
    });
    $('runde-close').addEventListener('click', close);
    $('runde-standard').addEventListener('click', useDefaults);
    $('runde-apply').addEventListener('click', requestApply);
    $('runde-keep').addEventListener('click', hideWarn);
    $('runde-anyway').addEventListener('click', confirmAnyway);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && $('modal-runde') && !$('modal-runde').hidden) close();
    });
  }

  function renderSeats() {
    var L = lineup();
    var box = $('runde-seats');
    if (!box || !L) return;
    var labels = L.places(draft.length);
    box.innerHTML = draft.map(function (id, index) {
      var person = L.avatar(id);
      var on = index === active ? ' is-on' : '';
      return '<button type="button" class="runde-seat' + on + '" data-seat="' + index + '">' +
        '<span class="runde-where">' + esc(labels[index] || '') + '</span>' +
        '<b>' + esc(person ? person.name : '') + '</b></button>';
    }).join('');
    var buttons = box.querySelectorAll('[data-seat]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (event) {
        active = +event.currentTarget.getAttribute('data-seat');
        render();
      });
    }
  }

  function renderGrid() {
    var L = lineup();
    var box = $('runde-grid');
    if (!box || !L) return;
    var chosen = draft[active];
    var intros = root.SpielpartnerIntro;
    box.innerHTML = L.AVATARS.map(function (person) {
      var on = person.id === chosen ? ' is-on' : '';
      var locked = !allowed(person, active);
      var face = '<img src="' + esc(L.portrait(person)) + '" alt="">';
      var introBtn = intros && typeof intros.buttonHtml === 'function'
        ? intros.buttonHtml({
          slug: person.slug,
          poster: L.portrait(person),
          name: person.full
        })
        : '';
      return '<article class="runde-person' + on + (locked ? ' is-locked' : '') + '" data-id="' + esc(person.id) + '">' +
        '<div class="runde-layout">' +
        '<div class="runde-side">' +
        '<button type="button" class="runde-face-btn" data-pick="' + esc(person.id) + '">' +
        '<span class="runde-face">' + face + '<span class="runde-ini">' + esc(L.initials(person.full)) + '</span></span>' +
        '</button>' +
        introBtn +
        '</div>' +
        '<button type="button" class="runde-pick runde-copy-btn" data-pick="' + esc(person.id) + '">' +
        '<span class="runde-copy"><b>' + esc(person.name) + '</b><small>' + esc(person.line) + '</small></span>' +
        (locked ? '<span class="runde-lock">Premium</span>' : '') +
        '</button>' +
        '</div>' +
        '<button type="button" class="runde-hear" data-hear="' + esc(person.id) + '">Stimme hören</button>' +
        '</article>';
    }).join('');
    var images = box.querySelectorAll('.runde-face img');
    for (var i = 0; i < images.length; i++) {
      images[i].addEventListener('error', function (event) {
        event.currentTarget.remove();
      });
    }
    var picks = box.querySelectorAll('[data-pick]');
    for (var p = 0; p < picks.length; p++) {
      picks[p].addEventListener('click', function (event) {
        choose(event.currentTarget.getAttribute('data-pick'));
      });
    }
    var hears = box.querySelectorAll('[data-hear]');
    for (var h = 0; h < hears.length; h++) {
      hears[h].addEventListener('click', function (event) {
        hear(event.currentTarget);
      });
    }
  }

  function renderGames() {
    var L = lineup();
    var box = $('runde-games');
    if (!box || !L) return;
    box.innerHTML = L.GAMES.map(function (game) {
      var here = game.id === hook.game;
      return '<a class="runde-game' + (here ? ' is-here' : '') + '" href="' + esc(game.href) + '"' +
        (here ? ' aria-current="page"' : '') + ' data-game="' + esc(game.href) + '">' + esc(game.label) + '</a>';
    }).join('');
    var links = box.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      links[i].addEventListener('click', onGame);
    }
  }

  function renderNote() {
    var note = $('runde-note');
    if (!note) return;
    var L = lineup();
    var base = L.defaults(hook.game, count());
    note.textContent = draft.join('|') === base.join('|')
      ? 'Das ist die Standard-Besetzung.'
      : 'Die Wahl gilt für dieses Spiel auf diesem Gerät.';
  }

  function render() {
    hideWarn();
    renderSeats();
    renderGrid();
    renderGames();
    renderNote();
  }

  function open() {
    ensure();
    var L = lineup();
    if (!L || !hook) return;
    draft = currentIds();
    active = 0;
    pendingHref = '';
    render();
    $('modal-runde').hidden = false;
    var focus = $('runde-title');
    if (focus && focus.focus) focus.setAttribute('tabindex', '-1'), focus.focus();
  }

  function close() {
    stopPreview();
    hideWarn();
    var modal = $('modal-runde');
    if (modal) modal.hidden = true;
  }

  function choose(id) {
    var L = lineup();
    var person = L.avatar(id);
    if (!person) return;
    if (!allowed(person, active)) {
      var wall = root.SpielpartnerPaywall;
      if (wall && typeof wall.open === 'function') wall.open();
      return;
    }
    var other = draft.indexOf(person.id);
    if (other >= 0 && other !== active) {
      var swap = draft[active];
      draft[active] = person.id;
      draft[other] = swap;
    } else draft[active] = person.id;
    render();
  }

  function hear(button) {
    var id = button.getAttribute('data-hear');
    var api = voices();
    if (!api || typeof api.preview !== 'function') return;
    stopPreview();
    button.disabled = true;
    var label = button.textContent;
    button.textContent = 'Einen Moment';
    api.preview(id).then(function () {
      button.disabled = false;
      button.textContent = label;
    }, function () {
      button.disabled = false;
      button.textContent = label;
    });
  }

  function useDefaults() {
    var L = lineup();
    draft = L.defaults(hook.game, count());
    active = 0;
    render();
  }

  function sameAsNow() {
    return draft.join('|') === currentIds().join('|');
  }

  function requestApply() {
    if (sameAsNow()) { close(); return; }
    if (inHand()) {
      pendingHref = '';
      $('runde-warn').hidden = false;
      return;
    }
    commit();
  }

  function onGame(event) {
    var href = event.currentTarget.getAttribute('href');
    if (!href || event.currentTarget.getAttribute('aria-current') === 'page') {
      event.preventDefault();
      return;
    }
    if (!inHand()) return;
    event.preventDefault();
    pendingHref = href;
    $('runde-warn').hidden = false;
  }

  function hideWarn() {
    pendingHref = '';
    var warn = $('runde-warn');
    if (warn) warn.hidden = true;
  }

  function persist() {
    var L = lineup();
    var store = storage();
    if (sameAsNow()) return true;
    var saved = L.save(store, hook.game, draft, { entitlement: entitlement(), storage: store, now: Date.now() });
    if (!saved) {
      var wall = root.SpielpartnerPaywall;
      if (wall && typeof wall.open === 'function') wall.open();
      return false;
    }
    return true;
  }

  function confirmAnyway() {
    var href = pendingHref;
    pendingHref = '';
    if (!persist()) return;
    close();
    if (href) {
      root.location.href = href;
      return;
    }
    root.location.reload();
  }

  function commit() {
    if (!persist()) return;
    close();
    if (typeof hook.apply === 'function') hook.apply();
  }

  function mount(options) {
    if (!options || !options.game || !lineup() || !lineup().gameById(options.game)) return;
    hook = options;
    ensure();
    if (typeof hook.apply === 'function') hook.apply();
  }

  root.SpielpartnerRunde = { mount: mount, open: open };
})(typeof window !== 'undefined' ? window : globalThis);
