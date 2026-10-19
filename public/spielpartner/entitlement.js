/*
 * Spielpartner-Anspruch im Browser.
 * Läuft ohne Abhängigkeiten im Browser (window.SpielpartnerEntitlement) und in Node (require).
 * Kein Konto, keine Zahlung: der Test liegt nur in localStorage.
 *
 * startTrial setzt trialEndsAt auf jetzt plus 14 Tage (je 24 Stunden).
 * Solange der Test läuft, sind alle Spielpartner frei.
 * Danach gilt nur die gewählte Stufe: standard oder premium.
 * Ein zweiter Aufruf verlängert den Test nicht.
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
    memoryStorage: memoryStorage
  };
});
