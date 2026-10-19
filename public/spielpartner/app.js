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

  function statusText(view) {
    if (view.phase === 'trial') {
      return 'Dein Test läuft noch ' + daysLabel(view.daysLeft) + '. Alle Spielpartner sind frei. Danach wählst Du Standard oder Premium. Es wird nichts automatisch abgebucht.';
    }
    if (view.phase === 'premium') {
      return 'Du hast Premium gewählt: alle Spielpartner. Es wird nichts automatisch abgebucht.';
    }
    if (view.phase === 'standard') {
      return 'Du hast Standard gewählt: Horst und Margarethe. Es wird nichts automatisch abgebucht.';
    }
    if (view.phase === 'ended') {
      return 'Die 14 Tage sind vorbei. Standard kostet ' + E.formatEuro(E.OFFER.tiers.standard.monthlyCents) + '/Monat (Horst und Margarethe), Premium ' + E.formatEuro(E.OFFER.tiers.premium.monthlyCents) + '/Monat (alle Spielpartner). Solange Du nichts wählst, bleiben Horst und Margarethe. Es wird nichts automatisch abgebucht.';
    }
    return 'Dein erster Klick startet 14 Tage Premium in diesem Browser: alle Spielpartner. Ein Konto brauchst Du dafür nicht. Es wird nichts automatisch abgebucht.';
  }

  function buttonText(view) {
    if (view.phase === 'trial') return 'Test läuft: noch ' + daysLabel(view.daysLeft);
    if (view.phase === 'new') return '14 Tage alle Spielpartner gratis testen';
    return 'Test beendet';
  }

  function paint(view) {
    if (statusEl) statusEl.textContent = statusText(view);
    buttons.forEach(function (button) {
      var fresh = view.phase === 'new';
      button.textContent = buttonText(view);
      button.setAttribute('aria-disabled', fresh ? 'false' : 'true');
      if (button.tagName === 'BUTTON') button.disabled = !fresh;
    });
    var now = Date.now();
    document.querySelectorAll('.sp-card').forEach(function (card) {
      var open = E.isUnlocked(card.getAttribute('data-tier'), view, now);
      card.classList.toggle('is-locked', !open);
      var access = card.querySelector('[data-access]');
      if (!access) return;
      if (view.trialActive) access.textContent = 'Frei in Deinem Test';
      else if (open) access.textContent = 'Frei für Dich';
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
