/*
 * Gemeinsames Rundenlimit für jeden Tisch.
 *
 * Ein neues Spiel, auch Jass, braucht nur:
 *   1. diese Skripte, in dieser Reihenfolge:
 *        /spielpartner/entitlement.js
 *        /spielpartner/offer.js
 *        /spielpartner/checkout.js
 *        /spielpartner/paywall.js
 *        /spielpartner/rounds.js
 *      plus offer.css und paywall.css
 *   2. <div class="modal" id="modal-paywall" hidden>
 *        <div class="modal-card paywall" id="paywall-root"></div>
 *      </div>
 *   3. vor dem Geben: if (!SpielpartnerRounds.gate()) return;
 *   4. nach einer abgeschlossenen Runde: SpielpartnerRounds.finish();
 *
 * Der Zähler selbst liegt in SpielpartnerEntitlement (canStartRound, recordRound).
 * Fehlt das Modul, bleibt der Tisch spielbar.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpielpartnerRounds = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function entitlement() {
    if (typeof window !== 'undefined' && window.SpielpartnerEntitlement) return window.SpielpartnerEntitlement;
    return null;
  }

  function storageOf(storage) {
    if (storage) return storage;
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (err) { /* privater Modus */ }
    return null;
  }

  function openPaywall() {
    var wall = typeof window !== 'undefined' ? window.SpielpartnerPaywall : null;
    if (wall && typeof wall.open === 'function') wall.open();
  }

  function gate(storage, now) {
    var Ent = entitlement();
    if (!Ent || typeof Ent.canStartRound !== 'function') return true;
    var store = storageOf(storage);
    if (!store) return true;
    var result;
    try { result = Ent.canStartRound(store, now == null ? Date.now() : now); }
    catch (err) { return true; }
    if (result && result.ok) return true;
    openPaywall();
    return false;
  }

  function finish(storage, now) {
    var Ent = entitlement();
    if (!Ent || typeof Ent.recordRound !== 'function') return null;
    var store = storageOf(storage);
    if (!store) return null;
    var result;
    try { result = Ent.recordRound(store, now == null ? Date.now() : now); }
    catch (err) { return null; }
    if (result && result.paywall) openPaywall();
    return result;
  }

  function paint(el, storage, now) {
    if (!el) return;
    var Ent = entitlement();
    if (!Ent || typeof Ent.canStartRound !== 'function') return;
    var store = storageOf(storage);
    if (!store) return;
    try {
      var view = Ent.canStartRound(store, now == null ? Date.now() : now);
      if (!view || view.unlimited || view.remaining == null) el.textContent = '';
      else if (view.remaining === 0) el.textContent = 'Die drei freien Runden für heute sind gespielt.';
      else el.textContent = 'Heute noch ' + view.remaining + ' von ' + view.limit + ' freien Runden.';
    } catch (err) { el.textContent = ''; }
  }

  return { gate: gate, finish: finish, paint: paint };
});
