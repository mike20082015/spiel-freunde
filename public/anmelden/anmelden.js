(function () {
  'use strict';

  var Account = window.SpielpartnerAccount;
  var title = document.getElementById('anmelden-title');
  var lead = document.getElementById('anmelden-lead');
  var back = document.getElementById('anmelden-back');
  if (!Account || !lead) return;

  function show(result) {
    if (result.kind === 'ok') {
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
    if (title) title.textContent = result.kind === 'missing' ? 'Link fehlt' : 'Das hat nicht geklappt';
    lead.textContent = result.line;
    if (back) {
      back.hidden = false;
      back.href = '/skat/';
      back.textContent = 'Zum Tisch';
    }
  }

  var fetcher = window.fetch ? window.fetch.bind(window) : null;
  Account.acceptLink(window.location.search || '', localStorage, Date.now(), fetcher).then(show);
})();
