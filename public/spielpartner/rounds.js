/*
 * Gemeinsames Rundenlimit für jeden Tisch.
 *
 * Ein neues Spiel, auch Jass, braucht nur:
 *   1. diese Skripte, in dieser Reihenfolge:
 *        /spielpartner/entitlement.js
 *        /spielpartner/offer.js
 *        /spielpartner/checkout.js
 *        /spielpartner/paywall.js
 *        /spielpartner/account.js
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
 *
 * Mit SpielpartnerAccount gilt: eine Proberunde ohne Konto, danach die
 * Anmeldekarte. Angemeldet kommen Test und Tageslimit aus GET /me.
 * Ohne das Kontomodul bleibt der lokale Zähler, damit ein fehlendes Skript
 * den Tisch nicht sperrt.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpielpartnerRounds = api;
  if (typeof window !== 'undefined' && window.localStorage && typeof api.boot === 'function') {
    try { api.boot(); }
    catch (err) { /* erster Besuch ohne Speicher */ }
  }
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

  function momentOf(now) {
    return now == null ? Date.now() : now;
  }

  function ensureTrial(Ent, store, now) {
    if (!Ent || typeof Ent.describe !== 'function' || typeof Ent.load !== 'function') return null;
    var moment = momentOf(now);
    var view = null;
    try { view = Ent.describe(Ent.load(store), moment); }
    catch (err) { return null; }
    if (view && view.phase === 'new' && typeof Ent.startTrial === 'function') {
      try { view = Ent.startTrial(store, moment); }
      catch (err) { /* Speicher gesperrt: die Runde bleibt zählbar */ }
    }
    return view;
  }

  function account() {
    if (typeof window !== 'undefined' && window.SpielpartnerAccount) return window.SpielpartnerAccount;
    return null;
  }

  function boot(storage, now) {
    var Acc = account();
    if (Acc && typeof Acc.boot === 'function') {
      try { return Acc.boot(storage, now); }
      catch (err) { return null; }
    }
    var Ent = entitlement();
    var store = storageOf(storage);
    if (!Ent || !store) return null;
    return ensureTrial(Ent, store, now);
  }

  function gate(storage, now) {
    var Acc = account();
    if (Acc && typeof Acc.gate === 'function') {
      try { return Acc.gate(storage, now); }
      catch (err) { return true; }
    }
    var Ent = entitlement();
    if (!Ent || typeof Ent.canStartRound !== 'function') return true;
    var store = storageOf(storage);
    if (!store) return true;
    var moment = momentOf(now);
    ensureTrial(Ent, store, moment);
    var result;
    try { result = Ent.canStartRound(store, moment); }
    catch (err) { return true; }
    if (result && result.ok) return true;
    openPaywall();
    return false;
  }

  function finish(storage, now) {
    var Acc = account();
    if (Acc && typeof Acc.finish === 'function') {
      try { return Acc.finish(storage, now); }
      catch (err) { return null; }
    }
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
    var Acc = account();
    var store = storageOf(storage);
    if (Acc && store && typeof Acc.hint === 'function') {
      try {
        var hint = Acc.hint(store, now == null ? Date.now() : now);
        if (hint) { el.textContent = hint; return; }
      } catch (err) { /* lokale Zeile */ }
    }
    var Ent = entitlement();
    if (!Ent || typeof Ent.canStartRound !== 'function') return;
    if (!store) return;
    var moment = now == null ? Date.now() : now;
    try {
      if (typeof Ent.describe === 'function' && typeof Ent.load === 'function') {
        var state = Ent.describe(Ent.load(store), moment);
        if (state && state.phase === 'trial') {
          el.textContent = state.daysLeft === 1
            ? 'Test läuft noch 1 Tag.'
            : 'Test läuft noch ' + state.daysLeft + ' Tage.';
          return;
        }
      }
      var view = Ent.canStartRound(store, moment);
      if (!view || view.unlimited || view.remaining == null) el.textContent = '';
      else if (view.remaining === 0) el.textContent = 'Die drei freien Runden für heute sind gespielt.';
      else el.textContent = 'Heute noch ' + view.remaining + ' von ' + view.limit + ' freien Runden.';
    } catch (err) { el.textContent = ''; }
  }

  return { gate: gate, finish: finish, paint: paint, boot: boot };
});
