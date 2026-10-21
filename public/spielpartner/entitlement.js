/*
 * Spielpartner-Anspruch im Browser.
 * Läuft ohne Abhängigkeiten im Browser (window.SpielpartnerEntitlement) und in Node (require).
 *
 * Zugang:
 *   Test (14 Tage): alles offen, unbegrenzt.
 *   Bonus (bestätigter Fehler, entitlement "bonus" oder bonus.active):
 *   wie Premium, unbegrenzt. Die restlichen Tage kommen aus bonus.daysLeft.
 *   Lizenz Premium, nicht abgelaufen: alle Spielpartner, unbegrenzt.
 *   Lizenz Standard, nicht abgelaufen: nur Horst und Margarethe, unbegrenzt.
 *   Sonst (Test vorbei oder noch nicht gestartet, keine gültige Lizenz):
 *   nur Horst und Margarethe, höchstens FREE_DAILY_ROUNDS abgeschlossene
 *   Runden am lokalen Kalendertag. Ein gespeichertes tier ohne Lizenz
 *   schaltet niemanden frei.
 *
 * Eine Runde ist eine abgeschlossene Spielrunde bzw. ein abgeschlossenes
 * Spiel (ein Skat, ein Schafkopf, ein Jass, eine Canasta-Runde). Alle Spiele
 * rufen dafür SpielpartnerRounds.gate und SpielpartnerRounds.finish auf.
 * Der Zähler liegt unter ROUNDS_KEY in localStorage. Das ist nur im Browser, bewusst.
 *
 * OFFER ist die einzige Preisliste, in Cent. Summen entstehen aus
 * Monatspreis mal bezahlte Monate (Monate minus Gratis-Monate).
 * Der Checkout liest quote() und BILLING_API_BASE, er speichert keine eigenen Beträge.
 *
 * Empfehlungscode: ?ref= wird unter REF_KEY gespeichert, der erste gilt,
 * 90 Tage lang. Er geht an den Checkout und an die Konto-Anmeldung,
 * und er wird nirgends angezeigt.
 *
 * Einladungscode: ?invite= wird unter INVITE_KEY gespeichert, der erste gilt,
 * 90 Tage lang. Er geht an die Konto-Anmeldung und an den Checkout,
 * und er wird nirgends angezeigt. Die Einladung selbst liegt beim Konto-Server.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpielpartnerEntitlement = api;
  if (typeof window !== 'undefined' && window.localStorage && window.location) boot(api);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STORAGE_KEY = 'sf-spielpartner-entitlement';
  var ROUNDS_KEY = 'sf-spielpartner-rounds';
  var REF_KEY = 'sf-ref';
  var INVITE_KEY = 'sf-invite';
  var TRIAL_DAYS = 14;
  var DAY_MS = 24 * 60 * 60 * 1000;
  var TRIAL_MS = TRIAL_DAYS * DAY_MS;
  var FREE_DAILY_ROUNDS = 3;
  var REF_MS = 90 * DAY_MS;
  var INVITE_MS = 90 * DAY_MS;
  var RENEW_SOON_MS = 8 * DAY_MS;
  var BILLING_API_BASE = 'https://lead-monster.net/api/public/spiel-freunde';

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

  function emptyState() {
    return { trialEndsAt: null, tier: null, license: null, licenseCheckedOn: null };
  }

  function cleanCode(value) {
    if (value == null) return '';
    var code = String(value).trim();
    if (!code || code.length > 80) return '';
    if (!/^[A-Za-z0-9_-]+$/.test(code)) return '';
    return code;
  }

  function parseTime(value) {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      var parsed = Date.parse(value);
      if (isFinite(parsed)) return parsed;
    }
    return null;
  }

  function licenseFrom(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var tier = raw.tier === 'standard' || raw.tier === 'premium' ? raw.tier : null;
    var code = cleanCode(raw.code);
    var expiresAt = parseTime(raw.expiresAt);
    if (!tier || !code || expiresAt == null) return null;
    return { code: code, tier: tier, expiresAt: expiresAt };
  }

  function normalize(raw) {
    var state = emptyState();
    if (!raw || typeof raw !== 'object') return state;
    if (typeof raw.trialEndsAt === 'number' && isFinite(raw.trialEndsAt)) state.trialEndsAt = raw.trialEndsAt;
    if (raw.tier === 'standard' || raw.tier === 'premium') state.tier = raw.tier;
    state.license = licenseFrom(raw.license);
    if (typeof raw.licenseCheckedOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.licenseCheckedOn)) {
      state.licenseCheckedOn = raw.licenseCheckedOn;
    }
    return state;
  }

  function bonusActive(me) {
    if (!me || typeof me !== 'object') return false;
    if (me.entitlement === 'bonus') return true;
    return !!(me.bonus && me.bonus.active === true);
  }

  function bonusFromMe(me) {
    if (!bonusActive(me)) return null;
    var raw = me.bonus && typeof me.bonus === 'object' ? me.bonus : {};
    var until = parseTime(raw.until);
    var daysLeft = typeof raw.daysLeft === 'number' && isFinite(raw.daysLeft) ? raw.daysLeft : null;
    return {
      active: true,
      until: until,
      daysLeft: daysLeft,
      pending: raw.pending === true
    };
  }

  function daysOfBonus(bonus, now) {
    if (!bonus || !bonus.active) return null;
    if (typeof bonus.daysLeft === 'number' && isFinite(bonus.daysLeft)) return Math.max(0, Math.ceil(bonus.daysLeft));
    if (typeof bonus.until === 'number' && isFinite(bonus.until)) {
      return Math.max(0, Math.ceil((bonus.until - now) / DAY_MS));
    }
    return null;
  }

  function bonusHint(days) {
    if (days === 1) return 'Premium-Bonus läuft noch 1 Tag.';
    if (days === 0) return 'Dein Premium-Bonus endet heute.';
    if (typeof days === 'number' && isFinite(days)) return 'Premium-Bonus läuft noch ' + days + ' Tage.';
    return 'Dein Premium-Bonus läuft.';
  }

  /*
   * Ein angemeldetes Konto ersetzt den lokalen Test. trialEndsAt, Lizenz
   * und ein laufender Premium-Bonus kommen aus dem gespeicherten Profil
   * (GET /me), nur für diese Antwort. Der Bonus wird nicht lokal gespeichert.
   */
  function overlayAccount(storage, state) {
    var raw;
    try { raw = JSON.parse(storage.getItem('sf-account')); }
    catch (err) { return state; }
    if (!raw || typeof raw !== 'object' || !raw.token || !raw.me) return state;
    var exp = parseTime(raw.expiresAt);
    if (exp != null && !(Date.now() < exp)) return state;
    var trial = raw.me.trial || null;
    if (trial && trial.active) {
      var ends = parseTime(trial.endsAt);
      if (ends == null && typeof trial.daysLeft === 'number') ends = Date.now() + trial.daysLeft * DAY_MS;
      if (ends != null) state.trialEndsAt = ends;
    } else if (trial && trial.endsAt) {
      var ended = parseTime(trial.endsAt);
      if (ended != null) state.trialEndsAt = ended;
    }
    if (raw.me.license) {
      var lic = licenseFrom(raw.me.license);
      if (lic) {
        state.license = lic;
        state.tier = lic.tier;
      }
    }
    var bonus = bonusFromMe(raw.me);
    if (bonus) state.bonus = bonus;
    return state;
  }

  function load(storage) {
    var state;
    try {
      var text = storage.getItem(STORAGE_KEY);
      state = text ? normalize(JSON.parse(text)) : normalize(null);
    } catch (err) {
      state = normalize(null);
    }
    return overlayAccount(storage, state);
  }

  function save(storage, state) {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      trialEndsAt: state.trialEndsAt,
      tier: state.tier,
      license: state.license,
      licenseCheckedOn: state.licenseCheckedOn
    }));
  }

  function isTrialActive(state, now) {
    return !!(state && typeof state.trialEndsAt === 'number' && now < state.trialEndsAt);
  }

  function paidTier(state, now) {
    var lic = state && state.license;
    if (!lic) return null;
    if (lic.tier !== 'standard' && lic.tier !== 'premium') return null;
    if (typeof lic.expiresAt !== 'number' || !(now < lic.expiresAt)) return null;
    return lic.tier;
  }

  function localDateKey(now) {
    var date = new Date(now);
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  function loadRounds(storage, now) {
    var today = localDateKey(now);
    var empty = { date: today, count: 0 };
    try {
      var text = storage.getItem(ROUNDS_KEY);
      if (!text) return empty;
      var raw = JSON.parse(text);
      if (!raw || raw.date !== today) return empty;
      if (typeof raw.count !== 'number' || !isFinite(raw.count) || raw.count < 0) return empty;
      return { date: today, count: Math.floor(raw.count) };
    } catch (err) {
      return empty;
    }
  }

  function roundsUsed(storage, now) {
    return loadRounds(storage, now).count;
  }

  /*
   * avatarTier: 'standard' oder 'premium'.
   * roundsUsed: abgeschlossene freie Runden heute. Ohne diese Zahl gilt ein
   * Standard-Partner ohne Lizenz und ohne Test als gesperrt. Genau das war
   * der Fehler, als Standard immer offen war.
   */
  function isUnlocked(avatarTier, state, now, roundsToday) {
    if (state && ((state.bonus && state.bonus.active) || state.phase === 'bonus')) return true;
    if (isTrialActive(state, now)) return true;
    var paid = paidTier(state, now);
    if (paid === 'premium') return true;
    if (paid === 'standard') return avatarTier === 'standard';
    if (avatarTier !== 'standard') return false;
    if (typeof roundsToday !== 'number' || !isFinite(roundsToday)) return false;
    return roundsToday < FREE_DAILY_ROUNDS;
  }

  function describe(state, now) {
    var bonus = state && state.bonus && state.bonus.active ? state.bonus : null;
    var trialActive = !bonus && isTrialActive(state, now);
    var paid = paidTier(state, now);
    var daysLeft = bonus ? daysOfBonus(bonus, now) : (trialActive ? Math.ceil((state.trialEndsAt - now) / DAY_MS) : 0);
    var license = paid ? state.license : null;
    var licenseMs = license ? license.expiresAt - now : 0;
    var licenseDaysLeft = license ? Math.max(0, Math.ceil(licenseMs / DAY_MS)) : 0;
    var phase;
    if (bonus) phase = 'bonus';
    else if (trialActive) phase = 'trial';
    else if (paid) phase = paid;
    else if (state && state.trialEndsAt != null) phase = 'ended';
    else phase = 'new';
    return {
      phase: phase,
      trialEndsAt: state ? state.trialEndsAt : null,
      tier: paid,
      daysLeft: daysLeft,
      trialActive: trialActive,
      allUnlocked: trialActive || paid === 'premium' || !!bonus,
      unlimited: trialActive || !!paid || !!bonus,
      license: license,
      licenseDaysLeft: licenseDaysLeft,
      renewSoon: !!(license && licenseMs > 0 && licenseMs < RENEW_SOON_MS),
      bonus: bonus
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
    if (tier !== 'standard' && tier !== 'premium') throw new Error('Unbekannte Stufe');
    var state = load(storage);
    state.tier = tier;
    save(storage, state);
    return describe(state, now);
  }

  function applyLicense(storage, license, now, extra) {
    var parsed = licenseFrom(license);
    if (!parsed) throw new Error('Lizenz');
    var state = load(storage);
    state.license = parsed;
    state.tier = parsed.tier;
    state.licenseCheckedOn = extra && extra.checkedOn ? extra.checkedOn : (state.licenseCheckedOn || localDateKey(now));
    save(storage, state);
    return describe(state, now);
  }

  function clearLicense(storage) {
    var state = load(storage);
    state.license = null;
    state.tier = null;
    save(storage, state);
    return state;
  }

  function canStartRound(storage, now) {
    var view = describe(load(storage), now);
    if (view.unlimited) {
      return { ok: true, unlimited: true, paywall: false, remaining: null, limit: null, count: 0 };
    }
    var count = roundsUsed(storage, now);
    var remaining = Math.max(0, FREE_DAILY_ROUNDS - count);
    return {
      ok: remaining > 0,
      unlimited: false,
      paywall: remaining <= 0,
      remaining: remaining,
      limit: FREE_DAILY_ROUNDS,
      count: count
    };
  }

  function recordRound(storage, now) {
    var view = describe(load(storage), now);
    if (view.unlimited) {
      return { counted: false, unlimited: true, paywall: false, count: 0, limit: null, remaining: null };
    }
    var rounds = loadRounds(storage, now);
    rounds.count += 1;
    try {
      storage.setItem(ROUNDS_KEY, JSON.stringify({ date: rounds.date, count: rounds.count }));
    } catch (err) { /* privat-Modus: die Runde zählt nur in diesem Augenblick */ }
    var remaining = Math.max(0, FREE_DAILY_ROUNDS - rounds.count);
    return {
      counted: true,
      unlimited: false,
      count: rounds.count,
      limit: FREE_DAILY_ROUNDS,
      remaining: remaining,
      paywall: rounds.count >= FREE_DAILY_ROUNDS
    };
  }

  function cleanRef(value) {
    if (value == null) return '';
    var code = String(value).trim();
    if (!code || code.length > 64) return '';
    if (!/^[A-Za-z0-9_-]+$/.test(code)) return '';
    return code;
  }

  function readRef(storage, now) {
    try {
      var raw = JSON.parse(storage.getItem(REF_KEY));
      if (!raw || typeof raw.code !== 'string' || typeof raw.at !== 'number') return null;
      if (now >= raw.at + REF_MS) {
        storage.removeItem(REF_KEY);
        return null;
      }
      var code = cleanRef(raw.code);
      return code || null;
    } catch (err) {
      return null;
    }
  }

  function refFromSearch(search) {
    var params;
    try { params = new URLSearchParams(search || ''); }
    catch (err) { return ''; }
    return cleanRef(params.get('ref'));
  }

  function captureRef(storage, now, search) {
    var current = readRef(storage, now);
    if (current) return current;
    var code = refFromSearch(search);
    if (!code) return null;
    try {
      storage.setItem(REF_KEY, JSON.stringify({ code: code, at: now }));
    } catch (err) {
      return null;
    }
    return code;
  }

  function cleanInvite(value) {
    if (value == null) return '';
    var code = String(value).trim();
    if (!code || code.length < 16 || code.length > 80) return '';
    if (!/^[A-Za-z0-9_-]+$/.test(code)) return '';
    return code;
  }

  function readInvite(storage, now) {
    try {
      var raw = JSON.parse(storage.getItem(INVITE_KEY));
      if (!raw || typeof raw.code !== 'string' || typeof raw.at !== 'number') return null;
      if (now >= raw.at + INVITE_MS) {
        storage.removeItem(INVITE_KEY);
        return null;
      }
      var code = cleanInvite(raw.code);
      return code || null;
    } catch (err) {
      return null;
    }
  }

  function inviteFromSearch(search) {
    var params;
    try { params = new URLSearchParams(search || ''); }
    catch (err) { return ''; }
    return cleanInvite(params.get('invite'));
  }

  function captureInvite(storage, now, search) {
    var current = readInvite(storage, now);
    if (current) return current;
    var code = inviteFromSearch(search);
    if (!code) return null;
    try {
      storage.setItem(INVITE_KEY, JSON.stringify({ code: code, at: now }));
    } catch (err) {
      return null;
    }
    return code;
  }

  function validEmail(value) {
    var email = String(value || '').trim();
    if (!email) return '';
    if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
    return email;
  }

  function asMonths(value) {
    var months = typeof value === 'number' ? value : parseInt(value, 10);
    if (months !== 1 && months !== 6 && months !== 12) throw new Error('Monate');
    return months;
  }

  function checkoutBody(input) {
    var tier = input && input.tier;
    if (tier !== 'standard' && tier !== 'premium') throw new Error('Stufe');
    var body = { tier: tier, months: asMonths(input.months) };
    var email = input.email ? String(input.email).trim() : '';
    if (email) body.email = email;
    var renew = input.renewCode ? String(input.renewCode).trim() : '';
    if (renew) body.renewCode = renew;
    var ref = input.ref ? String(input.ref).trim() : '';
    if (ref) body.ref = ref;
    var invite = input.invite ? cleanInvite(input.invite) : '';
    if (invite) body.invite = invite;
    return body;
  }

  function httpsUrl(value) {
    if (typeof value !== 'string' || !value) return '';
    try {
      var url = new URL(value);
      if (url.protocol !== 'https:') return '';
      return url.toString();
    } catch (err) {
      return '';
    }
  }

  function postJson(fetcher, url, body) {
    return Promise.resolve().then(function () {
      return fetcher(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body)
      });
    });
  }

  function startCheckout(storage, input, now, fetcher) {
    var email = validEmail(input && input.email);
    if (email === null) return Promise.reject(new Error('E-Mail'));
    var renew = '';
    if (input && input.renewCode) {
      renew = cleanCode(input.renewCode);
      if (!renew) return Promise.reject(new Error('Code'));
    }
    var body = checkoutBody({
      tier: input.tier,
      months: input.months,
      email: email,
      renewCode: renew,
      ref: readRef(storage, now) || '',
      invite: readInvite(storage, now) || ''
    });
    return postJson(fetcher, BILLING_API_BASE + '/checkout', body).then(function (res) {
      if (!res || !res.ok) throw new Error('checkout');
      return res.json();
    }).then(function (data) {
      var invoiceUrl = httpsUrl(data && data.invoiceUrl);
      var orderId = data && typeof data.orderId === 'string' ? data.orderId : '';
      if (!invoiceUrl) {
        var error = new Error('invoice');
        error.orderId = orderId;
        throw error;
      }
      return { orderId: orderId, invoiceUrl: invoiceUrl };
    });
  }

  function verifyCode(storage, code, now, fetcher) {
    var clean = cleanCode(code);
    if (!clean) return Promise.reject(new Error('Code'));
    return postJson(fetcher, BILLING_API_BASE + '/license/verify', { code: clean }).then(function (res) {
      if (!res || !res.ok) throw new Error('verify');
      return res.json();
    }).then(function (data) {
      if (!data || data.valid !== true) return { valid: false };
      var view = applyLicense(storage, {
        code: clean,
        tier: data.tier,
        expiresAt: data.expiresAt
      }, now, { checkedOn: localDateKey(now) });
      return { valid: true, view: view };
    });
  }

  function maybeVerify(storage, now, fetcher) {
    var state = load(storage);
    if (!state.license || !state.license.code) return Promise.resolve({ checked: false });
    if (state.licenseCheckedOn === localDateKey(now)) return Promise.resolve({ checked: false });
    state.licenseCheckedOn = localDateKey(now);
    save(storage, state);
    var code = state.license.code;
    return postJson(fetcher, BILLING_API_BASE + '/license/verify', { code: code }).then(function (res) {
      if (!res || !res.ok) return { checked: true };
      return res.json().then(function (data) {
        if (data && data.valid === true) {
          applyLicense(storage, { code: code, tier: data.tier, expiresAt: data.expiresAt }, now, { checkedOn: localDateKey(now) });
        } else if (data && data.valid === false) {
          clearLicense(storage);
        }
        return { checked: true };
      });
    }).catch(function () {
      return { checked: true, error: true };
    });
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
      },
      removeItem: function (key) {
        delete bag[key];
      }
    };
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    ROUNDS_KEY: ROUNDS_KEY,
    REF_KEY: REF_KEY,
    INVITE_KEY: INVITE_KEY,
    TRIAL_DAYS: TRIAL_DAYS,
    TRIAL_MS: TRIAL_MS,
    FREE_DAILY_ROUNDS: FREE_DAILY_ROUNDS,
    BILLING_API_BASE: BILLING_API_BASE,
    load: load,
    save: save,
    startTrial: startTrial,
    chooseTier: chooseTier,
    applyLicense: applyLicense,
    clearLicense: clearLicense,
    isTrialActive: isTrialActive,
    bonusActive: bonusActive,
    bonusFromMe: bonusFromMe,
    daysOfBonus: daysOfBonus,
    bonusHint: bonusHint,
    paidTier: paidTier,
    isUnlocked: isUnlocked,
    describe: describe,
    localDateKey: localDateKey,
    roundsUsed: roundsUsed,
    canStartRound: canStartRound,
    recordRound: recordRound,
    captureRef: captureRef,
    readRef: readRef,
    captureInvite: captureInvite,
    readInvite: readInvite,
    validEmail: validEmail,
    checkoutBody: checkoutBody,
    startCheckout: startCheckout,
    verifyCode: verifyCode,
    maybeVerify: maybeVerify,
    httpsUrl: httpsUrl,
    memoryStorage: memoryStorage,
    OFFER: OFFER,
    quote: quote,
    formatEuro: formatEuro,
    presentation: presentation,
    afterTrialSentence: afterTrialSentence
  };
});

function boot(api) {
  try { api.captureRef(window.localStorage, Date.now(), window.location.search || ''); }
  catch (err) { /* Speicher gesperrt */ }
  try { api.captureInvite(window.localStorage, Date.now(), window.location.search || ''); }
  catch (err) { /* Speicher gesperrt */ }
  function run() {
    if (!window.fetch) return;
    api.maybeVerify(window.localStorage, Date.now(), window.fetch.bind(window)).then(function () {
      try { window.dispatchEvent(new CustomEvent('sf-entitlement')); }
      catch (err) { /* alter Browser */ }
    });
  }
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else run();
}
