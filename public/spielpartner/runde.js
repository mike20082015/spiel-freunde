/*
 * Spielpartner an jedem Tisch.
 * Der Knopf und das Fenster kommen von hier. Das Spiel sagt, wie viele
 * Gegner sitzen, ob eine Runde läuft, und wie es neu malt.
 * Die Auswahl startet leer. Übernehmen setzt genau diese Anzahl an den Tisch.
 */
(function (root) {
  'use strict';

  var hook = null;
  var draft = [];
  var pendingHref = '';
  var ORD = ['erste', 'zweite', 'dritte', 'vierte'];
  var WORD = { 1: 'einen', 2: 'zwei', 3: 'drei', 4: 'vier' };

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

  function gateOpts() {
    return { entitlement: entitlement(), storage: storage(), now: Date.now() };
  }

  function currentIds() {
    var L = lineup();
    var store = storage();
    if (!L || !hook) return [];
    return L.resolveIds(store, hook.game, count(), gateOpts());
  }

  function preview() {
    var L = lineup();
    if (!L || !hook) return null;
    return L.previewLineup(draft, hook.game, count(), gateOpts());
  }

  function arrangedIds() {
    var view = preview();
    if (!view || !view.ready) return null;
    var ids = [];
    for (var i = 0; i < view.slots.length; i++) {
      if (!view.slots[i]) return null;
      ids.push(view.slots[i]);
    }
    return ids;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function word(n) { return WORD[n] || String(n); }

  function joinNames(ids) {
    var L = lineup();
    var names = [];
    for (var i = 0; i < ids.length; i++) {
      var person = L && L.avatar(ids[i]);
      if (person) names.push(person.name);
    }
    if (names.length < 2) return names.join('');
    if (names.length === 2) return names[0] + ' und ' + names[1];
    return names.slice(0, -1).join(', ') + ' und ' + names[names.length - 1];
  }

  function leadText(n) {
    var L = lineup();
    var labels = L.places(n).map(function (label) { return label.toLocaleLowerCase('de-DE'); });
    if (n === 1) return 'Tippe genau einen Spielpartner an. Der Platz ist ' + labels[0] + '.';
    var bits = labels.map(function (label, i) {
      var head = i === 0 ? 'Der ' : 'der ';
      return head + (ORD[i] || (i + 1) + '.') + ' sitzt ' + label;
    });
    return 'Tippe genau ' + word(n) + ' Spielpartner an. ' + bits.join(', ') + '.';
  }

  function seatIndex(personId, view) {
    if (!view) return -1;
    for (var i = 0; i < view.picks.length; i++) {
      if (view.picks[i].id === personId) return view.picks[i].seat;
    }
    return -1;
  }

  function locked(person) {
    if (!person || draft.indexOf(person.id) >= 0) return false;
    var L = lineup();
    if (!L) return true;
    if (L.maySit(person, entitlement(), storage(), Date.now())) return false;
    return L.defaults(hook.game, count()).indexOf(person.id) < 0;
  }

  function stopPreview() {
    var api = voices();
    if (api && typeof api.stopPreview === 'function') api.stopPreview();
    try { if (root.speechSynthesis) root.speechSynthesis.cancel(); } catch (err) { /* fehlt */ }
  }

  function openPaywall() {
    var wall = root.SpielpartnerPaywall;
    if (wall && typeof wall.open === 'function') wall.open();
  }

  function ensure() {
    if ($('modal-runde')) return;
    var nav = document.querySelector('.topbar-actions');
    if (nav && !$('btn-runde')) {
      var btn = document.createElement('button');
      btn.className = 'tbtn';
      btn.id = 'btn-runde';
      btn.type = 'button';
      btn.title = 'Spielpartner wählen';
      btn.innerHTML = '<span class="lbl-long">Spielpartner</span><span class="lbl-short">Partner</span>';
      nav.insertBefore(btn, nav.firstChild);
      btn.addEventListener('click', open);
    }
    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'modal-runde';
    modal.hidden = true;
    modal.innerHTML = '' +
      '<div class="modal-card runde-sheet" role="dialog" aria-modal="true" aria-labelledby="runde-title">' +
      '<div class="runde-head">' +
      '<h3 id="runde-title">Spielpartner</h3>' +
      '<p class="runde-lead" id="runde-lead"></p>' +
      '<p class="runde-count" id="runde-count"></p>' +
      '<p class="runde-note" id="runde-note"></p>' +
      '</div>' +
      '<div class="runde-scroll">' +
      '<div class="runde-grid" id="runde-grid"></div>' +
      '<h4 class="runde-next">Anderes Spiel</h4>' +
      '<div class="runde-games" id="runde-games"></div>' +
      '</div>' +
      '<div class="runde-warn" id="runde-warn" hidden>' +
      '<p>Die laufende Runde wird abgebrochen.</p>' +
      '<div class="runde-warn-actions">' +
      '<button type="button" class="btn btn-ghost-dark" id="runde-keep">Weiter spielen</button>' +
      '<button type="button" class="btn btn-gold" id="runde-anyway">Trotzdem wechseln</button>' +
      '</div></div>' +
      '<div class="modal-actions runde-actions">' +
      '<button type="button" class="btn btn-ghost-dark" id="runde-clear">Auswahl löschen</button>' +
      '<button type="button" class="btn btn-ghost-dark" id="runde-standard">Standard-Besetzung</button>' +
      '<button type="button" class="btn btn-ghost-dark" id="runde-close">Schließen</button>' +
      '<button type="button" class="btn btn-gold" id="runde-apply" disabled>Übernehmen</button>' +
      '</div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (event) {
      if (event.target === modal) close();
    });
    $('runde-close').addEventListener('click', close);
    $('runde-clear').addEventListener('click', clearDraft);
    $('runde-standard').addEventListener('click', useDefaults);
    $('runde-apply').addEventListener('click', requestApply);
    $('runde-keep').addEventListener('click', hideWarn);
    $('runde-anyway').addEventListener('click', confirmAnyway);
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && $('modal-runde') && !$('modal-runde').hidden) close();
    });
    bindPartnerLinks();
  }

  function bindPartnerLinks() {
    var links = document.querySelectorAll('.intro-partners a[href="/spielpartner/"], .partner-foot a[href="/spielpartner/"]');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('data-runde-bound')) continue;
      links[i].setAttribute('data-runde-bound', '1');
      links[i].addEventListener('click', function (event) {
        event.preventDefault();
        open();
      });
    }
  }

  function renderGrid() {
    var L = lineup();
    var box = $('runde-grid');
    if (!box || !L) return;
    var view = preview();
    var labels = L.places(count());
    var intros = root.SpielpartnerIntro;
    var full = view && view.ready;
    box.innerHTML = L.AVATARS.map(function (person) {
      var seat = seatIndex(person.id, view);
      var on = seat >= 0;
      var isLocked = locked(person);
      var place = on ? (labels[seat] || '') : '';
      var face = '<img src="' + esc(L.portrait(person)) + '" alt="">';
      var introBtn = intros && typeof intros.buttonHtml === 'function'
        ? intros.buttonHtml({
          slug: person.slug,
          poster: L.portrait(person),
          name: person.full
        })
        : '';
      var order = on ? '<span class="runde-order">' + (seat + 1) + '</span>' : '';
      var pressed = on ? 'true' : 'false';
      var wait = full && !on && !isLocked ? ' is-full' : '';
      return '<article class="runde-person' + (on ? ' is-on' : '') + (isLocked ? ' is-locked' : '') + wait + '" data-id="' + esc(person.id) + '">' +
        '<div class="runde-layout">' +
        '<div class="runde-side">' +
        '<button type="button" class="runde-face-btn" data-pick="' + esc(person.id) + '" aria-pressed="' + pressed + '">' +
        '<span class="runde-face">' + face + order + '<span class="runde-ini">' + esc(L.initials(person.full)) + '</span></span>' +
        '</button>' +
        introBtn +
        '</div>' +
        '<button type="button" class="runde-pick runde-copy-btn" data-pick="' + esc(person.id) + '" aria-pressed="' + pressed + '">' +
        '<span class="runde-copy"><b>' + esc(person.name) + '</b><small>' + esc(place ? place + '. ' + person.line : person.line) + '</small></span>' +
        (isLocked ? '<span class="runde-lock">Premium</span>' : '') +
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
    var lead = $('runde-lead');
    var counter = $('runde-count');
    var apply = $('runde-apply');
    var n = count();
    var view = preview();
    var ready = !!(view && view.ready);
    if (lead) lead.textContent = leadText(n);
    if (counter) counter.textContent = draft.length + ' von ' + n + ' gewählt';
    if (apply) apply.disabled = !ready;
    if (!note) return;
    var L = lineup();
    if (ready && view) {
      var labels = L.places(n);
      var line = view.slots.map(function (id, index) {
        var person = L.avatar(id);
        return (labels[index] || '') + ': ' + (person ? person.name : '');
      }).join(' · ');
      var base = L.defaults(hook.game, n);
      note.textContent = (view.slots.join('|') === base.join('|') ? 'Das ist die Standard-Besetzung. ' : '') + line;
      return;
    }
    var sitting = joinNames(currentIds());
    var now = sitting ? ' Gerade sitzen ' + sitting + '.' : '';
    if (!draft.length) {
      note.textContent = 'Die Auswahl ist leer.' + now;
      return;
    }
    var left = n - draft.length;
    note.textContent = (left === 1 ? 'Wähl noch einen.' : 'Wähl noch ' + word(left) + '.') + now;
  }

  function render() {
    hideWarn();
    renderGrid();
    renderGames();
    renderNote();
  }

  function open() {
    ensure();
    var L = lineup();
    if (!L || !hook) return;
    draft = [];
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
    var at = draft.indexOf(person.id);
    if (at >= 0) {
      draft.splice(at, 1);
      render();
      return;
    }
    if (draft.length >= count()) return;
    var next = draft.concat([person.id]);
    var view = L.previewLineup(next, hook.game, count(), gateOpts());
    if (!view) {
      if (person.tier === 'premium') openPaywall();
      return;
    }
    draft = next;
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

  function clearDraft() {
    draft = [];
    render();
  }

  function useDefaults() {
    var L = lineup();
    draft = L.defaults(hook.game, count()).slice();
    render();
  }

  function requestApply() {
    var ids = arrangedIds();
    if (!ids) return;
    if (ids.join('|') === currentIds().join('|')) { close(); return; }
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
    var ids = arrangedIds();
    if (!ids) return false;
    if (ids.join('|') === currentIds().join('|')) return true;
    var L = lineup();
    var store = storage();
    var saved = L.save(store, hook.game, ids, gateOpts());
    if (!saved) {
      openPaywall();
      return false;
    }
    return true;
  }

  function confirmAnyway() {
    var href = pendingHref;
    pendingHref = '';
    var ids = arrangedIds();
    if (ids && ids.join('|') !== currentIds().join('|')) {
      if (!persist()) return;
    }
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
