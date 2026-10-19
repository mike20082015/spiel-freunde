/*
 * Schaltet Monatlich / 6 Monate / 12 Monate.
 * Beträge kommen nur aus SpielpartnerEntitlement.quote.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpielpartnerOffer = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function paintTier(node, view) {
    var amt = node.querySelector('[data-amt]');
    var per = node.querySelector('[data-per]');
    var eff = node.querySelector('[data-eff]');
    var badge = node.querySelector('[data-badge]');
    var popular = node.querySelector('[data-popular]');
    if (amt) amt.textContent = view.amount;
    if (per) per.textContent = view.period;
    if (eff) {
      eff.textContent = view.effective;
      eff.hidden = !view.showEffective;
    }
    if (badge) {
      badge.textContent = view.badge;
      badge.hidden = !view.showBadge;
    }
    if (popular) {
      popular.textContent = view.popularLabel;
      popular.hidden = !view.showPopular;
    }
    node.classList.toggle('is-popular', !!view.showPopular);
  }

  function paint(block, periodId, entitlement) {
    var nodes = block.querySelectorAll('[data-tier]');
    for (var i = 0; i < nodes.length; i++) {
      var tier = nodes[i].getAttribute('data-tier');
      if (!entitlement.OFFER.tiers[tier]) continue;
      paintTier(nodes[i], entitlement.presentation(tier, periodId));
    }
  }

  function bind(block, entitlement) {
    var buttons = block.querySelectorAll('[data-period]');
    function select(id) {
      for (var i = 0; i < buttons.length; i++) {
        var on = buttons[i].getAttribute('data-period') === id;
        buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
      }
      paint(block, id, entitlement);
    }
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].addEventListener('click', function () {
        select(this.getAttribute('data-period'));
      });
    }
    var initial = entitlement.OFFER.periods[0].id;
    for (var k = 0; k < buttons.length; k++) {
      if (buttons[k].getAttribute('aria-pressed') === 'true') initial = buttons[k].getAttribute('data-period');
    }
    select(initial);
  }

  function mount(doc, entitlement) {
    var root = doc;
    var E = entitlement;
    if (!root && typeof document !== 'undefined') root = document;
    if (!E && typeof window !== 'undefined') E = window.SpielpartnerEntitlement;
    if (!root || !E) return;
    var notes = root.querySelectorAll('[data-after-trial]');
    for (var i = 0; i < notes.length; i++) notes[i].textContent = E.afterTrialSentence();
    var blocks = root.querySelectorAll('[data-offer]');
    for (var n = 0; n < blocks.length; n++) bind(blocks[n], E);
  }

  if (typeof document !== 'undefined') {
    var start = function () { mount(document); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
  }

  return { paintTier: paintTier, paint: paint, bind: bind, mount: mount };
});
