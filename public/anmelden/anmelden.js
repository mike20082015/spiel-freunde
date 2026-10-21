(function () {
  'use strict';

  var Account = window.SpielpartnerAccount;
  var title = document.getElementById('anmelden-title');
  var lead = document.getElementById('anmelden-lead');
  var back = document.getElementById('anmelden-back');
  var form = document.getElementById('anmelden-paste');
  if (!Account || !lead) return;

  var PASTE_LINE = 'Der Link in der Mail öffnet manchmal den Browser und nicht diese App. Tippe ihn nicht an. Kopiere ihn und füge ihn hier ein.';

  function show(result) {
    if (result.kind === 'ok') {
      if (form) form.hidden = true;
      if (title) title.textContent = 'Willkommen';
      lead.textContent = result.line;
      if (back) {
        back.hidden = false;
        back.href = result.href || '/skat/';
        back.textContent = 'Weiter spielen';
      }
      if (typeof Account.mountHeader === 'function') Account.mountHeader(localStorage);
      return;
    }
    if (form) form.hidden = false;
    if (result.kind === 'missing') {
      if (title) title.textContent = 'Link hier einlösen';
      lead.textContent = PASTE_LINE;
    } else {
      if (title) title.textContent = 'Das hat nicht geklappt';
      lead.textContent = result.line || PASTE_LINE;
    }
    if (back) {
      back.hidden = false;
      back.href = '/skat/';
      back.textContent = 'Zum Tisch';
    }
  }

  var fetcher = window.fetch ? window.fetch.bind(window) : null;
  if (form && typeof Account.redeem === 'function') {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var field = form.querySelector('[data-token]');
      var button = form.querySelector('button[type="submit"]');
      var status = form.querySelector('[data-paste-status]');
      if (button) button.disabled = true;
      if (status) status.textContent = '';
      Account.redeem(field ? field.value : '', localStorage, Date.now(), fetcher).then(function (result) {
        if (button) button.disabled = false;
        if (result.kind === 'invalid') {
          if (status) status.textContent = result.line;
          return;
        }
        if (status) status.textContent = '';
        show(result);
      });
    });
  }

  Account.acceptLink(window.location.search || '', localStorage, Date.now(), fetcher).then(show);
})();
