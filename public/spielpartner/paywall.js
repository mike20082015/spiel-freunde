/*
 * Freundliche Sperre nach der dritten freien Runde, mit denselben Plänen
 * wie die Mitgliedschaft. Preise kommen aus SpielpartnerEntitlement.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpielpartnerPaywall = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function plan(api, tier, title, who) {
    var view = api.presentation(tier, 'monthly');
    return '<article class="pw-plan" data-tier="' + tier + '">' +
      '<h4>' + title + '</h4>' +
      '<p class="pw-price"><span class="amt" data-amt>' + view.amount + '</span> <span class="per" data-per>' + view.period + '</span></p>' +
      '<p class="pw-eff" data-eff hidden></p>' +
      '<p class="pw-notes"><span class="free-badge" data-badge hidden></span> <span class="popular-note" data-popular hidden></span></p>' +
      '<p class="pw-who">' + who + '</p>' +
      '<button type="button" class="btn ' + (tier === 'premium' ? 'btn-gold' : 'btn-ghost-dark') + '" data-buy="' + tier + '" disabled>Weiter zur Zahlung</button>' +
      '</article>';
  }

  function markup(api) {
    return '<div class="pw">' +
      '<p class="pw-kicker">Die 14 Tage sind vorbei</p>' +
      '<h3>Drei Runden sind gespielt</h3>' +
      '<p class="pw-lead">Die 14 Tage sind vorbei. Horst schiebt die Karten zusammen, Margarethe schenkt noch Kaffee nach. Ohne Lizenz sind es drei Runden am Tag mit Horst und Margarethe, und die drei für heute sind gespielt. Morgen gibt es wieder drei Runden mit den beiden. Wenn Du heute weiterspielen willst, oder die ganze Runde dazuholen magst, such Dir unten einen Zeitraum aus.</p>' +
      '<div class="sp-offer" data-offer>' +
      '<div class="bill-toggle" role="group" aria-label="Abrechnungszeitraum">' +
      '<button type="button" data-period="monthly" aria-pressed="true">Monatlich</button>' +
      '<button type="button" data-period="6" aria-pressed="false">6 Monate</button>' +
      '<button type="button" data-period="12" aria-pressed="false">12 Monate</button>' +
      '</div>' +
      '<form data-checkout>' +
      '<div class="pw-plans">' +
      plan(api, 'standard', 'Standard', 'Horst und Margarethe, ohne Limit') +
      plan(api, 'premium', 'Premium', 'Alle Spielpartner, ohne Limit') +
      '</div>' +
      '<p class="pw-pay">Zahlung per Karte, SEPA, Apple Pay, Google Pay oder Krypto über unseren Zahlungsdienstleister.</p>' +
      '<p class="pw-noabo">Kein Abo, keine automatische Verlängerung.</p>' +
      '<label class="pw-field">E-Mail <span>für Code und Erinnerung vor Ablauf</span>' +
      '<input data-email type="email" autocomplete="email" inputmode="email" maxlength="200" placeholder="du@example.com">' +
      '</label>' +
      '<label class="pw-consent"><input data-consent type="checkbox"> <span>Ich willige ein, dass vor Ablauf der Widerrufsfrist mit der Bereitstellung der digitalen Inhalte begonnen wird, und mir ist bekannt, dass ich dadurch mein Widerrufsrecht verliere (§ 356 Abs. 5 BGB). Es gelten die <a href="/agb.html">AGB</a> und die <a href="/widerruf.html">Widerrufsbelehrung</a>.</span></label>' +
      '<p class="pw-status" data-status role="status"></p>' +
      '<p class="pw-renew" data-renew-note hidden>Verlängerung ist ausgewählt. Beim Bezahlen wird Dein bisheriger Code mitgeschickt.</p>' +
      '<input data-renew type="hidden" value="">' +
      '</form></div>' +
      '<div class="pw-actions"><button type="button" class="btn btn-ghost-dark" data-paywall-close>Später</button></div>' +
      '</div>';
  }

  function open() {
    var api = window.SpielpartnerEntitlement;
    var modal = document.getElementById('modal-paywall');
    var slot = document.getElementById('paywall-root');
    if (!api || !modal || !slot) return;
    slot.innerHTML = markup(api);
    if (window.SpielpartnerOffer) window.SpielpartnerOffer.mount(slot);
    var form = slot.querySelector('[data-checkout]');
    if (window.SpielpartnerCheckout && form) window.SpielpartnerCheckout.bind(form);
    var close = slot.querySelector('[data-paywall-close]');
    if (close) close.addEventListener('click', function () { modal.hidden = true; });
    modal.hidden = false;
  }

  return { markup: markup, open: open };
});
