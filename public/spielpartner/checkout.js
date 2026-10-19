/*
 * Checkout auf der Mitgliedschaftsseite.
 * Beträge und die API-Basis kommen aus SpielpartnerEntitlement.
 * Der Empfehlungscode wird mitgeschickt und nicht angezeigt.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpielpartnerCheckout = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function entitlement() {
    return typeof window !== 'undefined' ? window.SpielpartnerEntitlement : null;
  }

  function selectedMonths(form, api) {
    var block = form.closest('[data-offer]');
    var id = block && block.getAttribute('data-period-selected');
    if (!id && block) {
      var pressed = block.querySelector('[data-period][aria-pressed="true"]');
      id = pressed ? pressed.getAttribute('data-period') : 'monthly';
    }
    return api.quote('standard', id || 'monthly').months;
  }

  function setStatus(form, text) {
    var el = form.querySelector('[data-status]');
    if (el) el.textContent = text || '';
  }

  function setBusy(form, busy) {
    var buttons = form.querySelectorAll('[data-buy]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].disabled = busy || !consentChecked(form);
      buttons[i].setAttribute('aria-disabled', buttons[i].disabled ? 'true' : 'false');
    }
  }

  function consentChecked(form) {
    var box = form.querySelector('[data-consent]');
    return !!(box && box.checked);
  }

  function syncConsent(form) {
    var on = consentChecked(form);
    var buttons = form.querySelectorAll('[data-buy]');
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute('data-busy') === 'true') continue;
      buttons[i].disabled = !on;
      buttons[i].setAttribute('aria-disabled', on ? 'false' : 'true');
    }
  }

  function bind(form, api) {
    var E = api || entitlement();
    if (!form || !E || form.getAttribute('data-checkout-bound') === 'true') return;
    form.setAttribute('data-checkout-bound', 'true');
    var consent = form.querySelector('[data-consent]');
    if (consent) consent.addEventListener('change', function () { syncConsent(form); });
    syncConsent(form);
    var buttons = form.querySelectorAll('[data-buy]');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', function (event) {
        event.preventDefault();
        buy(form, this.getAttribute('data-buy'), E);
      });
    }
  }

  function buy(form, tier, E) {
    if (!consentChecked(form)) {
      setStatus(form, 'Bitte die Einwilligung ankreuzen. Ohne sie können wir die Zahlung nicht starten.');
      var box = form.querySelector('[data-consent]');
      if (box) box.focus();
      return;
    }
    var emailInput = form.querySelector('[data-email]');
    var email = E.validEmail(emailInput ? emailInput.value : '');
    if (email === null) {
      setStatus(form, 'Die E-Mail-Adresse sieht nicht richtig aus. Du kannst das Feld auch leer lassen.');
      if (emailInput) emailInput.focus();
      return;
    }
    var renewInput = form.querySelector('[data-renew]');
    var renewCode = renewInput ? renewInput.value : '';
    var buttons = form.querySelectorAll('[data-buy]');
    for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('data-busy', 'true');
    setBusy(form, true);
    setStatus(form, 'Einen Moment, die Rechnung wird geöffnet.');
    E.startCheckout(localStorage, {
      tier: tier,
      months: selectedMonths(form, E),
      email: email,
      renewCode: renewCode
    }, Date.now(), window.fetch.bind(window)).then(function (result) {
      window.location.href = result.invoiceUrl;
    }).catch(function (err) {
      for (var n = 0; n < buttons.length; n++) buttons[n].removeAttribute('data-busy');
      setBusy(form, false);
      if (err && err.message === 'E-Mail') {
        setStatus(form, 'Die E-Mail-Adresse sieht nicht richtig aus. Du kannst das Feld auch leer lassen.');
      } else if (err && err.message === 'Code') {
        setStatus(form, 'Der Code für die Verlängerung sieht nicht richtig aus.');
      } else if (err && err.orderId) {
        setStatus(form, 'Die Rechnung konnte nicht geöffnet werden. Bestellnummer: ' + err.orderId);
      } else {
        setStatus(form, 'Die Zahlung konnte gerade nicht gestartet werden. Versuch es gleich noch einmal. Es wurde nichts abgebucht.');
      }
    });
  }

  function daysLabel(days) {
    return days === 1 ? '1 Tag' : days + ' Tage';
  }

  function paintLicense() {
    var E = entitlement();
    var box = document.getElementById('license-status');
    if (!E || !box) return;
    var view = E.describe(E.load(localStorage), Date.now());
    if (!view.license) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    var name = view.license.tier === 'premium' ? 'Premium' : 'Standard';
    var until = new Date(view.license.expiresAt).toLocaleDateString('de-DE');
    box.hidden = false;
    box.textContent = '';
    var line = document.createElement('p');
    if (view.renewSoon) {
      line.textContent = name + ' gilt noch ' + daysLabel(view.licenseDaysLeft) + ' (bis ' + until + ').';
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-wine btn-sm';
      button.id = 'btn-renew';
      button.textContent = 'Verlängern';
      button.addEventListener('click', function () { beginRenew(view.license.code); });
      box.appendChild(line);
      box.appendChild(button);
      return;
    }
    line.textContent = name + ' ist frei bis ' + until + '. Kein Abo, keine automatische Verlängerung.';
    box.appendChild(line);
  }

  function beginRenew(code) {
    var E = entitlement();
    var form = document.getElementById('checkout-form');
    if (!form || !E) return;
    var clean = String(code || '').trim();
    if (!/^[A-Za-z0-9_-]+$/.test(clean)) {
      setStatus(form, 'Der Code für die Verlängerung sieht nicht richtig aus.');
      return;
    }
    var input = form.querySelector('[data-renew]');
    if (input) input.value = clean;
    var note = form.querySelector('[data-renew-note]');
    if (note) note.hidden = false;
    var section = document.getElementById('mitgliedschaft');
    if (section && section.scrollIntoView) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function applyQuery(form) {
    var params;
    try { params = new URLSearchParams(window.location.search || ''); }
    catch (err) { return; }
    if (params.get('zahlung') === 'abgebrochen') {
      var banner = document.getElementById('payment-cancelled');
      if (banner) banner.hidden = false;
    }
    var renew = params.get('verlaengern');
    if (renew) beginRenew(renew);
    var zeitraum = params.get('zeitraum');
    if (zeitraum === 'monthly' || zeitraum === '6' || zeitraum === '12') {
      var block = form.closest('[data-offer]') || document.querySelector('[data-offer]');
      var button = block && block.querySelector('[data-period="' + zeitraum + '"]');
      if (button) button.click();
    }
    if (params.get('zahlung') === 'abgebrochen' || params.get('verlaengern') || params.get('zeitraum')) {
      var section = document.getElementById('mitgliedschaft');
      if (section && section.scrollIntoView) section.scrollIntoView();
    }
  }

  function onCode(event) {
    event.preventDefault();
    var E = entitlement();
    var input = document.getElementById('license-code-input');
    var status = document.getElementById('code-status');
    if (!E || !input) return;
    if (status) status.textContent = 'Der Code wird geprüft.';
    E.verifyCode(localStorage, input.value, Date.now(), window.fetch.bind(window)).then(function (result) {
      if (!result.valid) {
        if (status) status.textContent = 'Dieser Code gilt gerade nicht. Prüf die Schreibweise oder verlängere ihn.';
        return;
      }
      input.value = '';
      if (status) status.textContent = 'Der Code gilt. Die Stufe ist auf diesem Gerät frei.';
      paintLicense();
      try { window.dispatchEvent(new CustomEvent('sf-entitlement')); }
      catch (err) { /* Anzeige ist schon neu */ }
    }).catch(function () {
      if (status) status.textContent = 'Der Code konnte gerade nicht geprüft werden. Versuch es gleich noch einmal.';
    });
  }

  function init() {
    var form = document.getElementById('checkout-form');
    if (form) {
      bind(form);
      applyQuery(form);
    }
    paintLicense();
    var codeForm = document.getElementById('code-form');
    if (codeForm) codeForm.addEventListener('submit', onCode);
    window.addEventListener('sf-entitlement', paintLicense);
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
  }

  return { bind: bind, init: init, paintLicense: paintLicense, beginRenew: beginRenew };
});
