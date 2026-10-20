/* Vorstellungsknopf. Aufruf: node --test spielpartner/tests */
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../../public/spielpartner/intro.js');
const C = require('../../public/spielpartner/cards.js');

test('ein Registereintrag schaltet den Clip, ohne Eintrag gibt es keinen Knopf', () => {
  assert.equal(I.src('horst'), '/spielpartner/videos/horst.mp4');
  assert.equal(I.src('oma-hilde'), '/spielpartner/videos/oma-hilde.mp4');
  assert.equal(I.src('chantal'), '/spielpartner/videos/chantal.mp4');
  assert.equal(I.src('luce'), '');
  assert.equal(I.src('uschi'), '');

  const horst = I.buttonHtml({
    slug: 'horst',
    poster: '/media/spielpartner/horst.jpg',
    name: 'Horst Kaluppke'
  });
  assert.match(horst, /Vorstellung ansehen/);
  assert.match(horst, /data-intro-src="\/spielpartner\/videos\/horst\.mp4"/);
  assert.match(horst, /data-intro-poster="\/media\/spielpartner\/horst\.jpg"/);
  assert.equal(horst.includes('<video'), false);
  assert.equal(horst.includes('autoplay'), false);
  assert.equal(horst.includes('muted'), false);
  const chantal = I.buttonHtml({
    slug: 'chantal',
    poster: '/media/spielpartner/chantal.jpg',
    name: 'Chantal Kowalski'
  });
  assert.match(chantal, /Vorstellung ansehen/);
  assert.match(chantal, /data-intro-src="\/spielpartner\/videos\/chantal\.mp4"/);

  const luce = C.cardHtml({
    name: 'Luce Morel',
    slug: 'luce',
    intro: 'Wein.',
    origin: 'Beaujolais',
    personality: 'Ruhig.',
    tier: 'premium',
    portrait: '/media/spielpartner/luce.jpg',
    hasVideo: false,
    video: ''
  });
  assert.equal(luce.includes('Vorstellung ansehen'), false);
  assert.match(luce, /Video folgt/);
});
