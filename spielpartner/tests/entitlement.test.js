/* Anspruch und Karten. Aufruf: node --test spielpartner/tests */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const E = require('../../public/spielpartner/entitlement.js');
const C = require('../../public/spielpartner/cards.js');

const DAY = 24 * 60 * 60 * 1000;
const START = 1700000000000;
const PREMIUM = ['lena', 'jonas', 'oemer', 'hilde', 'sepp', 'ruediger', 'chantal', 'urs', 'vreni', 'luce'];

function catalog() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/spielpartner/avatare.json'), 'utf8'));
}

test('startTrial setzt trialEndsAt auf 14 Tage', () => {
  const storage = E.memoryStorage();
  const view = E.startTrial(storage, START);
  assert.strictEqual(view.trialEndsAt, START + E.TRIAL_MS);
  assert.strictEqual(E.TRIAL_DAYS, 14);
  assert.strictEqual(view.trialEndsAt - START, 14 * DAY);
  assert.strictEqual(view.trialActive, true);
  assert.strictEqual(view.phase, 'trial');
  assert.strictEqual(view.allUnlocked, true);
  assert.strictEqual(view.daysLeft, 14);
});

test('zweiter startTrial verlängert den Test nicht', () => {
  const storage = E.memoryStorage();
  E.startTrial(storage, START);
  const again = E.startTrial(storage, START + 3 * DAY);
  assert.strictEqual(again.trialEndsAt, START + 14 * DAY);
  assert.strictEqual(again.daysLeft, 11);
});

test('abgelaufener Test startet nicht von vorn', () => {
  const storage = E.memoryStorage();
  E.startTrial(storage, START);
  const after = E.startTrial(storage, START + 15 * DAY);
  assert.strictEqual(after.trialEndsAt, START + 14 * DAY);
  assert.strictEqual(after.trialActive, false);
  assert.strictEqual(after.phase, 'ended');
});

test('während des Tests sind alle Stufen frei', () => {
  const storage = E.memoryStorage();
  const view = E.startTrial(storage, START);
  const now = START + DAY;
  assert.strictEqual(E.isUnlocked('standard', view, now), true);
  assert.strictEqual(E.isUnlocked('premium', view, now), true);
  catalog().forEach((avatar) => {
    assert.strictEqual(E.isUnlocked(avatar.tier, view, now), true, avatar.slug);
  });
});

test('vor dem Test nur Standard', () => {
  const view = E.describe({ trialEndsAt: null, tier: null }, START);
  assert.strictEqual(view.phase, 'new');
  assert.strictEqual(E.isUnlocked('standard', view, START), true);
  assert.strictEqual(E.isUnlocked('premium', view, START), false);
});

test('genau am Ende ist der Test vorbei', () => {
  const storage = E.memoryStorage();
  const view = E.startTrial(storage, START);
  const end = view.trialEndsAt;
  assert.strictEqual(E.isTrialActive(view, end), false);
  assert.strictEqual(E.isUnlocked('premium', view, end), false);
  assert.strictEqual(E.isUnlocked('standard', view, end), true);
});

test('danach nur die gewählte Stufe', () => {
  const storage = E.memoryStorage();
  E.startTrial(storage, START);
  const after = START + 14 * DAY;
  let view = E.describe(E.load(storage), after);
  assert.strictEqual(view.trialActive, false);
  assert.strictEqual(view.tier, null);
  assert.strictEqual(E.isUnlocked('premium', view, after), false);
  assert.strictEqual(E.isUnlocked('standard', view, after), true);

  view = E.chooseTier(storage, 'standard', after);
  assert.strictEqual(view.phase, 'standard');
  assert.strictEqual(view.tier, 'standard');
  assert.strictEqual(view.allUnlocked, false);
  assert.strictEqual(E.isUnlocked('premium', view, after + DAY), false);
  assert.strictEqual(E.isUnlocked('standard', view, after + DAY), true);

  view = E.chooseTier(storage, 'premium', after + DAY);
  assert.strictEqual(view.phase, 'premium');
  assert.strictEqual(view.allUnlocked, true);
  assert.strictEqual(E.isUnlocked('premium', view, after + 2 * DAY), true);
  assert.strictEqual(E.isUnlocked('standard', view, after + 2 * DAY), true);
});

test('Wahl während des Tests bleibt gespeichert, der Test öffnet weiter alle', () => {
  const storage = E.memoryStorage();
  E.startTrial(storage, START);
  const during = E.chooseTier(storage, 'standard', START + DAY);
  assert.strictEqual(during.tier, 'standard');
  assert.strictEqual(during.trialActive, true);
  assert.strictEqual(E.isUnlocked('premium', during, START + DAY), true);
  const after = START + 14 * DAY;
  assert.strictEqual(E.isUnlocked('premium', E.load(storage), after), false);
  assert.strictEqual(E.isUnlocked('standard', E.load(storage), after), true);
});

test('chooseTier lehnt eine unbekannte Stufe ab', () => {
  const storage = E.memoryStorage();
  assert.throws(() => E.chooseTier(storage, 'gold', START), /Stufe/);
  assert.deepStrictEqual(E.load(storage), { trialEndsAt: null, tier: null });
});

test('kaputtes localStorage fällt auf leer zurück', () => {
  const storage = E.memoryStorage();
  storage.setItem(E.STORAGE_KEY, '{nein');
  assert.deepStrictEqual(E.load(storage), { trialEndsAt: null, tier: null });
  storage.setItem(E.STORAGE_KEY, JSON.stringify({ trialEndsAt: 50, tier: 'vip' }));
  assert.deepStrictEqual(E.load(storage), { trialEndsAt: 50, tier: null });
  storage.setItem(E.STORAGE_KEY, JSON.stringify({ trialEndsAt: 'morgen', tier: 'premium' }));
  assert.deepStrictEqual(E.load(storage), { trialEndsAt: null, tier: 'premium' });
});

test('Video folgt ohne video-Element, sonst stummer Player mit Poster', () => {
  const pending = C.mediaHtml({ hasVideo: false, video: '/x.mp4', name: 'Lena Berger' });
  assert.match(pending, /Video folgt/);
  assert.equal(pending.includes('<video'), false);

  const empty = C.mediaHtml({ hasVideo: true, video: '', name: 'Lena Berger' });
  assert.match(empty, /Video folgt/);
  assert.equal(empty.includes('<video'), false);

  const play = C.mediaHtml({
    hasVideo: true,
    video: '/media/spielpartner/lena.mp4',
    portrait: '/media/spielpartner/lena.jpg',
    name: 'Lena Berger'
  });
  assert.match(play, /<video/);
  assert.match(play, /\smuted[\s>]/);
  assert.match(play, /poster="\/media\/spielpartner\/lena\.jpg"/);
  assert.match(play, /src="\/media\/spielpartner\/lena\.mp4"/);
  assert.equal(play.includes('Video folgt'), false);
  assert.equal(play.includes('autoplay'), false);
});

test('Initialen für die Holzfläche', () => {
  assert.strictEqual(C.initials('Horst Kaluppke'), 'HK');
  assert.strictEqual(C.initials('Margarethe von Hohenfels'), 'MH');
  assert.strictEqual(C.initials('Oma Hilde'), 'OH');
  assert.strictEqual(C.initials('Ömer Aydin'), 'ÖA');
  assert.strictEqual(C.initials('Rüdiger Falk'), 'RF');
  assert.strictEqual(C.initials(''), '?');
});

test('Karte zeigt Abzeichen und lässt das Video weg', () => {
  const card = C.cardHtml({
    name: 'Horst Kaluppke',
    slug: 'horst',
    intro: 'Meckert.',
    origin: 'Berlin',
    personality: 'Grantig.',
    tier: 'standard',
    portrait: '/media/spielpartner/horst.jpg',
    hasVideo: false,
    video: ''
  });
  assert.match(card, /Horst Kaluppke/);
  assert.match(card, /sp-badge-standard">Standard</);
  assert.match(card, /Video folgt/);
  assert.equal(card.includes('<video'), false);
  assert.match(card, />HK</);

  const premium = C.cardHtml({
    name: 'Lena Berger',
    slug: 'lena',
    intro: 'Sportlich.',
    origin: 'Köln',
    personality: 'Frisch.',
    tier: 'premium',
    portrait: '/media/spielpartner/lena.jpg',
    hasVideo: true,
    video: '/media/spielpartner/lena.mp4'
  });
  assert.match(premium, /sp-badge-premium">Premium</);
  assert.match(premium, /<video/);
  assert.equal(premium.includes('Video folgt'), false);
});

test('Katalog: Horst und Margarethe Standard, der Rest Premium', () => {
  const list = catalog();
  assert.strictEqual(list.length, 12);
  const bySlug = {};
  list.forEach((avatar) => { bySlug[avatar.slug] = avatar; });
  assert.strictEqual(bySlug.horst.tier, 'standard');
  assert.strictEqual(bySlug.margarethe.tier, 'standard');
  assert.strictEqual(bySlug.horst.name, 'Horst Kaluppke');
  assert.strictEqual(bySlug.margarethe.name, 'Margarethe von Hohenfels');
  PREMIUM.forEach((slug) => {
    assert.ok(bySlug[slug], slug);
    assert.strictEqual(bySlug[slug].tier, 'premium', slug);
  });
  list.forEach((avatar) => {
    assert.ok(avatar.name);
    assert.ok(avatar.intro);
    assert.ok(avatar.origin);
    assert.ok(avatar.personality);
    assert.ok(avatar.tier === 'standard' || avatar.tier === 'premium');
    assert.strictEqual(avatar.portrait, '/media/spielpartner/' + avatar.slug + '.jpg');
    assert.strictEqual(typeof avatar.hasVideo, 'boolean');
    assert.strictEqual(typeof avatar.video, 'string');
    if (avatar.hasVideo !== true) assert.equal(C.mediaHtml(avatar).includes('<video'), false);
  });
});

test('Preise stehen nur in Cent, Summen sind Monatspreis mal bezahlte Monate', () => {
  assert.strictEqual(E.OFFER.tiers.standard.monthlyCents, 995);
  assert.strictEqual(E.OFFER.tiers.premium.monthlyCents, 1495);
  assert.deepStrictEqual(E.OFFER.periods.map((period) => period.label), ['Monatlich', '6 Monate', '12 Monate']);
  E.OFFER.periods.forEach((period) => {
    assert.ok(!Object.prototype.hasOwnProperty.call(period, 'paidMonths'));
    assert.ok(!Object.prototype.hasOwnProperty.call(period, 'totalCents'));
  });
  Object.keys(E.OFFER.tiers).forEach((tier) => {
    assert.ok(!Object.prototype.hasOwnProperty.call(E.OFFER.tiers[tier], 'totalCents'));
  });

  const expect = {
    standard: {
      monthly: { total: 995, effective: 995, amount: '9,95 €', effectiveText: '' },
      '6': { total: 4975, effective: 829, amount: '49,75 €', effectiveText: 'entspricht 8,29 €/Monat' },
      '12': { total: 8955, effective: 746, amount: '89,55 €', effectiveText: 'entspricht 7,46 €/Monat' }
    },
    premium: {
      monthly: { total: 1495, effective: 1495, amount: '14,95 €', effectiveText: '' },
      '6': { total: 7475, effective: 1246, amount: '74,75 €', effectiveText: 'entspricht 12,46 €/Monat' },
      '12': { total: 13455, effective: 1121, amount: '134,55 €', effectiveText: 'entspricht 11,21 €/Monat' }
    }
  };

  ['standard', 'premium'].forEach((tier) => {
    E.OFFER.periods.forEach((period) => {
      const item = E.quote(tier, period.id);
      const paidMonths = period.months - period.freeMonths;
      assert.strictEqual(item.paidMonths, paidMonths, tier + ' ' + period.id);
      assert.strictEqual(item.totalCents, E.OFFER.tiers[tier].monthlyCents * paidMonths);
      assert.strictEqual(item.effectiveMonthlyCents, Math.round(item.totalCents / period.months));
      assert.strictEqual(item.totalCents, expect[tier][period.id].total);
      assert.strictEqual(item.effectiveMonthlyCents, expect[tier][period.id].effective);
      const view = E.presentation(tier, period.id);
      assert.strictEqual(view.amount, expect[tier][period.id].amount);
      assert.strictEqual(view.effective, expect[tier][period.id].effectiveText);
      assert.strictEqual(view.period, period.months === 1 ? '/Monat' : 'für ' + period.months + ' Monate');
    });
  });

  assert.strictEqual(E.quote('standard', '6').freeMonths, 1);
  assert.strictEqual(E.quote('premium', '12').freeMonths, 3);
  assert.strictEqual(E.quote('standard', '6').badge, '1 Monat gratis');
  assert.strictEqual(E.quote('premium', '6').badge, '1 Monat gratis');
  assert.strictEqual(E.quote('standard', '12').badge, '3 Monate gratis');
  assert.strictEqual(E.quote('premium', '12').badge, '3 Monate gratis');
  assert.strictEqual(E.quote('premium', 'monthly').badge, null);
  assert.strictEqual(E.presentation('premium', '12').badge, '3 Monate gratis');
  assert.strictEqual(E.presentation('premium', '12').showPopular, true);
  assert.strictEqual(E.presentation('premium', '12').popularLabel, 'Beliebteste Wahl');
  assert.strictEqual(E.presentation('standard', '12').showPopular, false);
  assert.strictEqual(E.presentation('premium', '6').showPopular, false);
  assert.strictEqual(E.presentation('premium', 'monthly').showPopular, false);
  assert.strictEqual(E.formatEuro(829), '8,29 €');
  assert.strictEqual(E.formatEuro(746), '7,46 €');
  assert.strictEqual(E.formatEuro(1246), '12,46 €');
  assert.strictEqual(E.formatEuro(1121), '11,21 €');
  assert.strictEqual(
    E.afterTrialSentence(),
    'Danach 9,95 €/Monat oder 14,95 €/Monat. Nichts läuft von allein weiter.'
  );
  assert.throws(() => E.quote('gold', 'monthly'), /Angebot/);
  assert.throws(() => E.quote('standard', '24'), /Angebot/);
});

test('Mitgliedschaft und Startleiste holen die Beträge aus der Config', () => {
  const root = path.join(__dirname, '../../public');
  const member = fs.readFileSync(path.join(root, 'spielpartner/index.html'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const memberOffer = slice(member, 'id="mitgliedschaft"', '</section>');
  const tease = slice(home, 'class="sp-tease"', '</section>');
  const standard = E.formatEuro(E.OFFER.tiers.standard.monthlyCents);
  const premium = E.formatEuro(E.OFFER.tiers.premium.monthlyCents);
  [memberOffer, tease].forEach((html) => {
    assert.match(html, /Monatlich/);
    assert.match(html, /6 Monate/);
    assert.match(html, /12 Monate/);
    assert.match(html, /data-offer/);
    assert.ok(html.includes(standard));
    assert.ok(html.includes(premium));
    ['49,75', '74,75', '89,55', '134,55', '8,29', '7,46', '12,46', '11,21'].forEach((hardcoded) => {
      assert.equal(html.includes(hardcoded), false, hardcoded);
    });
  });
  assert.equal((memberOffer.match(/<button[^>]*disabled[^>]*>Bald verfügbar<\/button>/g) || []).length, 2);
  assert.match(memberOffer, /Die Knöpfe bleiben auf „Bald verfügbar“/);
  assert.match(memberOffer, /disabled/);
  assert.match(memberOffer, /14 Tage alle Spielpartner gratis testen/);
  assert.match(memberOffer, /nichts automatisch abgebucht/i);
  assert.match(member, /Es wird nichts automatisch abgebucht/);
  assert.match(tease, /Es wird nichts automatisch abgebucht/);
  assert.match(tease, /14 Tage alle Spielpartner gratis testen/);
  assert.match(tease, /14 Tage Premium gratis/);
});

function slice(html, start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, start);
  return html.slice(from, to);
}
