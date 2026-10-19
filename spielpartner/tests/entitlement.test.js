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
