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
    return 'Eine Proberunde ist ohne Konto frei. Danach schicken wir Dir einen Anmeldelink. Mit der ersten Anmeldung laufen 14 Testtage.' + noAuto;
  }

  function buttonText(view) {
    if (view.phase === 'trial') return 'Test läuft noch ' + daysLabel(view.daysLeft);
    if (view.phase === 'new') return '14 Tage alle Spielpartner gratis testen';
    return 'Die 14 Tage sind vorbei';
  }

  function paint(view) {
    var now = Date.now();
    var rounds = 0;
    try { rounds = E.roundsUsed(localStorage, now); } catch (err) { rounds = 0; }
    if (statusEl) statusEl.textContent = statusText(view, rounds);
    buttons.forEach(function (button) {
      var fresh = view.phase === 'new';
      button.textContent = buttonText(view);
      button.setAttribute('aria-disabled', view.phase === 'ended' ? 'true' : 'false');
      if (button.tagName === 'BUTTON') button.disabled = view.phase === 'ended';
      if (!fresh) button.removeAttribute('href');
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
    var view;
    try { view = currentView(); }
    catch (err) { view = { phase: 'new' }; }
    if (view.phase === 'new') return;
    if (event) event.preventDefault();
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

  var voiceAudio = null;

  function showVoiceLine(button, line) {
    var note = button.parentNode && button.parentNode.querySelector('[data-voice-line]');
    if (!note) return;
    note.hidden = false;
    note.textContent = line;
  }

  function postVoice(path, slug, line) {
    return fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ character: slug, text: line })
    }).then(function (res) {
      if (!res || !res.ok || typeof res.blob !== 'function') throw new Error('still');
      return res.blob();
    }).then(function (blob) {
      if (!blob || !blob.size) throw new Error('leer');
      return blob;
    });
  }

  function playVoice(button) {
    var slug = button.getAttribute('data-voice');
    var line = C.VOICE_LINES && C.VOICE_LINES[slug];
    if (!line || typeof fetch !== 'function') {
      if (line) showVoiceLine(button, line);
      return;
    }
    button.disabled = true;
    postVoice('/api/sf/tts', slug, line).catch(function () {
      return postVoice('/api/tts', slug, line);
    }).then(function (blob) {
      if (voiceAudio) {
        try { voiceAudio.pause(); } catch (err) { /* nächster Satz */ }
      }
      var url = URL.createObjectURL(blob);
      voiceAudio = new Audio(url);
      voiceAudio.onended = function () {
        try { URL.revokeObjectURL(url); } catch (err) { /* egal */ }
      };
      return voiceAudio.play();
    }).catch(function () {
      showVoiceLine(button, line);
    }).then(function () {
      button.disabled = false;
    });
  }

  if (grid) {
    grid.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-voice]') : null;
      if (!button || !grid.contains(button)) return;
      event.preventDefault();
      playVoice(button);
    });
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
      var intros = window.SpielpartnerIntro;
      if (intros && typeof intros.src === 'function') {
        list.forEach(function (avatar) {
          var clip = intros.src(avatar.slug);
          if (!clip) return;
          avatar.hasVideo = true;
          avatar.video = clip;
        });
      }
      grid.innerHTML = list.map(C.cardHtml).join('');
      applyFilter();
      paint(currentView());
    })
    .catch(function () {
      if (grid) grid.innerHTML = '<p class="sp-empty">Die Spielpartner laden gerade nicht. Lade die Seite noch einmal.</p>';
    });
})();
