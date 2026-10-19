(function () {
  'use strict';

  var E = window.SpielpartnerEntitlement;
  var C = window.SpielpartnerCards;
  var grid = document.getElementById('sp-grid');
  var statusEl = document.getElementById('sp-status');
  var buttons = document.querySelectorAll('.js-trial');

  function daysLabel(days) {
    return days === 1 ? '1 Tag' : days + ' Tage';
  }

  function statusText(view, rounds) {
    var noAuto = ' Kein Abo, keine automatische Verlängerung.';
    if (view.phase === 'trial') {
      return 'Dein Test läuft noch ' + daysLabel(view.daysLeft) + '. Alle Spielpartner sind frei.' + noAuto;
    }
    if (view.phase === 'premium' || view.phase === 'standard') {
      var name = view.phase === 'premium' ? 'Premium' : 'Standard';
      var who = view.phase === 'premium' ? 'Alle Spielpartner sind frei.' : 'Horst und Margarethe sind frei, ohne Rundenlimit.';
      return name + ' gilt noch ' + daysLabel(view.licenseDaysLeft) + '. ' + who + noAuto;
    }
    var left = Math.max(0, E.FREE_DAILY_ROUNDS - (rounds || 0));
    var roundLine = left === 0
      ? 'Die drei freien Runden für heute sind gespielt. Morgen geht es mit Horst und Margarethe weiter.'
      : 'Ohne Lizenz sind heute noch ' + left + ' von ' + E.FREE_DAILY_ROUNDS + ' Runden mit Horst und Margarethe frei.';
    if (view.phase === 'ended') {
      return 'Die 14 Tage sind vorbei. ' + roundLine + noAuto;
    }
    return 'Dein erster Klick startet 14 Tage Premium in diesem Browser: alle Spielpartner. ' + roundLine + noAuto;
  }

  function buttonText(view) {
    if (view.phase === 'trial') return 'Test läuft: noch ' + daysLabel(view.daysLeft);
    if (view.phase === 'new') return '14 Tage alle Spielpartner gratis testen';
    return 'Test beendet';
  }

  function paint(view) {
    var now = Date.now();
    var rounds = 0;
    try { rounds = E.roundsUsed(localStorage, now); } catch (err) { rounds = 0; }
    if (statusEl) statusEl.textContent = statusText(view, rounds);
    buttons.forEach(function (button) {
      var fresh = view.phase === 'new';
      button.textContent = buttonText(view);
      button.setAttribute('aria-disabled', fresh ? 'false' : 'true');
      if (button.tagName === 'BUTTON') button.disabled = !fresh;
    });
    document.querySelectorAll('.sp-card').forEach(function (card) {
      var tier = card.getAttribute('data-tier');
      var open = E.isUnlocked(tier, view, now, rounds);
      card.classList.toggle('is-locked', !open);
      var access = card.querySelector('[data-access]');
      if (!access) return;
      if (view.trialActive) access.textContent = 'Frei in Deinem Test';
      else if (view.phase === 'premium') access.textContent = 'Frei mit Premium';
      else if (view.phase === 'standard' && open) access.textContent = 'Frei mit Standard';
      else if (open) access.textContent = 'Frei in den heutigen Runden';
      else if (tier === 'standard') access.textContent = 'Heute keine freie Runde mehr';
      else access.textContent = 'Mit Premium oder im Test';
    });
  }

  function currentView() {
    return E.describe(E.load(localStorage), Date.now());
  }

  function start(event) {
    if (event) event.preventDefault();
    var view;
    try {
      view = E.startTrial(localStorage, Date.now());
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Dein Browser speichert den Test gerade nicht. Es wird trotzdem nichts abgebucht.';
      return;
    }
    paint(view);
  }

  buttons.forEach(function (button) {
    button.addEventListener('click', start);
  });

  function applyFilter() {
    var pressed = document.querySelector('.sp-filters button[aria-pressed="true"]');
    var filter = pressed ? pressed.getAttribute('data-filter') : 'alle';
    document.querySelectorAll('.sp-card').forEach(function (card) {
      card.hidden = filter !== 'alle' && card.getAttribute('data-tier') !== filter;
    });
  }

  document.querySelectorAll('.sp-filters button').forEach(function (button) {
    button.addEventListener('click', function () {
      document.querySelectorAll('.sp-filters button').forEach(function (other) {
        other.setAttribute('aria-pressed', other === button ? 'true' : 'false');
      });
      applyFilter();
    });
  });

  if (grid) {
    grid.addEventListener('error', function (event) {
      var target = event.target;
      if (!target || !target.tagName) return;
      if (target.tagName === 'IMG') {
        target.remove();
        return;
      }
      if (target.tagName === 'VIDEO') {
        var box = target.closest('.sp-media');
        if (box) box.innerHTML = '<p class="sp-pending">Video folgt</p>';
      }
    }, true);
  }

  paint(currentView());
  window.addEventListener('sf-entitlement', function () { paint(currentView()); });

  fetch('avatare.json')
    .then(function (response) {
      if (!response.ok) throw new Error('json');
      return response.json();
    })
    .then(function (list) {
      if (!grid) return;
      grid.innerHTML = list.map(C.cardHtml).join('');
      applyFilter();
      paint(currentView());
    })
    .catch(function () {
      if (grid) grid.innerHTML = '<p class="sp-empty">Die Spielpartner laden gerade nicht. Lade die Seite noch einmal.</p>';
    });
})();
