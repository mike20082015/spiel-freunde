/*
 * Spielpartner-Anspruch im Browser.
 * Läuft ohne Abhängigkeiten im Browser (window.SpielpartnerEntitlement) und in Node (require).
 * Kein Konto, keine Zahlung: der Test liegt nur in localStorage.
 *
 * startTrial setzt trialEndsAt auf jetzt plus 14 Tage (je 24 Stunden).
 * Solange der Test läuft, sind alle Spielpartner frei.
 * Danach gilt nur die gewählte Stufe: standard oder premium.
 * Ein zweiter Aufruf verlängert den Test nicht.
 *
 * OFFER ist die einzige Preisliste, in Cent. Summen entstehen aus
 * Monatspreis mal bezahlte Monate (Monate minus Gratis-Monate).
 * Eine spätere Zahlung liest quote(), sie speichert keine eigenen Beträge.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpielpartnerEntitlement = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'sf-spielpartner-entitlement';
  var TRIAL_DAYS = 14;
  var DAY_MS = 24 * 60 * 60 * 1000;
  var TRIAL_MS = TRIAL_DAYS * DAY_MS;

  var OFFER = {
    tiers: {
      standard: { monthlyCents: 995 },
      premium: { monthlyCents: 1495 }
    },
    periods: [
      { id: 'monthly', label: 'Monatlich', months: 1, freeMonths: 0 },
      { id: '6', label: '6 Monate', months: 6, freeMonths: 1, badge: '1 Monat gratis' },
      { id: '12', label: '12 Monate', months: 12, freeMonths: 3, badge: '3 Monate gratis' }
    ],
    popular: { tier: 'premium', periodId: '12', label: 'Beliebteste Wahl' }
  };

  function periodById(id) {
    for (var i = 0; i < OFFER.periods.length; i++) {
      if (OFFER.periods[i].id === id) return OFFER.periods[i];
    }
    return null;
  }

  function formatEuro(cents) {
    if (typeof cents !== 'number' || !isFinite(cents)) throw new Error('Betrag');
    var negative = cents < 0;
    var abs = Math.abs(Math.round(cents));
    var euros = Math.floor(abs / 100);
    var rest = abs % 100;
    var restText = rest < 10 ? '0' + rest : String(rest);
    return (negative ? '-' : '') + euros + ',' + restText + ' €';
  }

  function quote(tier, periodId) {
    var price = OFFER.tiers[tier];
    var period = periodById(periodId);
    if (!price || !period) throw new Error('Unbekanntes Angebot');
    if (period.freeMonths < 0 || period.freeMonths >= period.months) throw new Error('Unbekannter Zeitraum');
    var paidMonths = period.months - period.freeMonths;
    var totalCents = price.monthlyCents * paidMonths;
    var effectiveMonthlyCents = Math.round(totalCents / period.months);
    var popular = OFFER.popular.tier === tier && OFFER.popular.periodId === period.id;
    return {
      tier: tier,
      periodId: period.id,
      label: period.label,
      months: period.months,
      freeMonths: period.freeMonths,
      paidMonths: paidMonths,
      monthlyCents: price.monthlyCents,
      totalCents: totalCents,
      effectiveMonthlyCents: effectiveMonthlyCents,
      badge: period.badge || null,
      popular: popular,
      popularLabel: popular ? OFFER.popular.label : null
    };
  }

  function presentation(tier, periodId) {
    var item = quote(tier, periodId);
    var monthly = item.months === 1;
    return {
      amount: formatEuro(item.totalCents),
      period: monthly ? '/Monat' : 'für ' + item.months + ' Monate',
      effective: monthly ? '' : 'entspricht ' + formatEuro(item.effectiveMonthlyCents) + '/Monat',
      badge: item.badge || '',
      popularLabel: item.popularLabel || '',
      showEffective: !monthly,
      showBadge: !!item.badge,
      showPopular: item.popular
    };
  }

  function afterTrialSentence() {
    return 'Danach ' + formatEuro(OFFER.tiers.standard.monthlyCents) + '/Monat oder ' +
      formatEuro(OFFER.tiers.premium.monthlyCents) + '/Monat. Nichts läuft von allein weiter.';
  }

  function normalize(raw) {
    var state = { trialEndsAt: null, tier: null };
    if (!raw || typeof raw !== 'object') return state;
    if (typeof raw.trialEndsAt === 'number' && isFinite(raw.trialEndsAt)) state.trialEndsAt = raw.trialEndsAt;
    if (raw.tier === 'standard' || raw.tier === 'premium') state.tier = raw.tier;
    return state;
  }

  function load(storage) {
    try {
      var text = storage.getItem(STORAGE_KEY);
      if (!text) return normalize(null);
      return normalize(JSON.parse(text));
    } catch (err) {
      return normalize(null);
    }
  }

  function save(storage, state) {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      trialEndsAt: state.trialEndsAt,
      tier: state.tier
    }));
  }

  function isTrialActive(state, now) {
    return !!(state && typeof state.trialEndsAt === 'number' && now < state.trialEndsAt);
  }

  function isUnlocked(avatarTier, state, now) {
    if (isTrialActive(state, now)) return true;
    if (state && state.tier === 'premium') return true;
    return avatarTier === 'standard';
  }

  function describe(state, now) {
    var trialActive = isTrialActive(state, now);
    var daysLeft = trialActive ? Math.ceil((state.trialEndsAt - now) / DAY_MS) : 0;
    var phase;
    if (trialActive) phase = 'trial';
    else if (state && (state.tier === 'standard' || state.tier === 'premium')) phase = state.tier;
    else if (state && state.trialEndsAt != null) phase = 'ended';
    else phase = 'new';
    return {
      phase: phase,
      trialEndsAt: state ? state.trialEndsAt : null,
      tier: state ? state.tier : null,
      daysLeft: daysLeft,
      trialActive: trialActive,
      allUnlocked: trialActive || !!(state && state.tier === 'premium')
    };
  }

  function startTrial(storage, now) {
    var state = load(storage);
    if (state.trialEndsAt == null) {
      state.trialEndsAt = now + TRIAL_MS;
      save(storage, state);
    }
    return describe(state, now);
  }

  function chooseTier(storage, tier, now) {
    if (tier !== 'standard' && tier !== 'premium') {
      throw new Error('Unbekannte Stufe');
    }
    var state = load(storage);
    state.tier = tier;
    save(storage, state);
    return describe(state, now);
  }

  function memoryStorage(seed) {
    var bag = {};
    if (seed != null) bag[STORAGE_KEY] = String(seed);
    return {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(bag, key) ? bag[key] : null;
      },
      setItem: function (key, value) {
        bag[key] = String(value);
      }
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    TRIAL_DAYS: TRIAL_DAYS,
    TRIAL_MS: TRIAL_MS,
    load: load,
    save: save,
    startTrial: startTrial,
    chooseTier: chooseTier,
    isTrialActive: isTrialActive,
    isUnlocked: isUnlocked,
    describe: describe,
    memoryStorage: memoryStorage,
    OFFER: OFFER,
    quote: quote,
    formatEuro: formatEuro,
    presentation: presentation,
    afterTrialSentence: afterTrialSentence
  };
});
