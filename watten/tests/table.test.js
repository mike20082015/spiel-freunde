/* Tisch, Startseite und Rundenzähler. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seats = require('../../public/watten/js/seats.js');
const talk = require('../../public/watten/js/talk.js').WattenTalk;
const L = require('../../public/spielpartner/lineup.js');

const root = path.join(__dirname, '../..');

test('Sitze: Du und Sepp gegen Horst und Oma Hilde', () => {
  assert.deepEqual(seats.seats.map((s) => s.place), ['south', 'west', 'north', 'east']);
  assert.equal(seats.seats[1].id, 'horst');
  assert.equal(seats.seats[2].id, 'sepp');
  assert.equal(seats.seats[3].id, 'hilde');
  assert.equal(seats.seats[3].name, 'Oma Hilde');
  assert.equal(seats.seats[3].slug, 'oma-hilde');
  assert.equal(seats.seats[1].portrait, '/media/spielpartner/horst.jpg');
  assert.equal(seats.seats[2].portrait, '/media/spielpartner/sepp.jpg');
  assert.equal(seats.seats[3].portrait, '/media/spielpartner/oma-hilde.jpg');
  assert.equal(seats.seats[1].voice, true);
  assert.equal(seats.seats[2].voice, true);
  assert.equal(seats.seats[3].voice, true);
  assert.equal(seats.initials('Horst Kaluppke'), 'HK');
  assert.equal(seats.initials('Sepp Huber'), 'SH');
  assert.equal(seats.initials('Oma Hilde'), 'OH');
  const copy = seats.seats.map((s) => Object.assign({}, s));
  const store = { getItem() { return null; }, setItem() {}, removeItem() {} };
  assert.deepEqual(L.dress(copy, 'watten', store), ['horst', 'sepp', 'hilde']);
  assert.equal(copy[2].place, 'north');
  assert.equal(L.talkId('watten', 'hilde'), 'hilde');
});

test('Sprüche bleiben am Tisch und nennen keinen Anbieter', () => {
  assert.equal(talk.classify('Servus'), 'greet');
  assert.ok(talk.line('sepp', 'schlag'));
  assert.ok(talk.line('horst', 'bieten'));
  assert.ok(talk.line('hilde', 'trump'));
  assert.ok(talk.cannedReply('hilde', 'was ist der Weli'));
  const blob = JSON.stringify(talk.LINES) + JSON.stringify(talk.REPLIES);
  assert.doesNotMatch(blob, /grok|elevenlabs|openai|x\.?ai/i);
  assert.deepEqual(talk.responders('Hallo Horst'), ['horst']);
  const src = fs.readFileSync(path.join(root, 'public/watten/js/talk.js'), 'utf8');
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
});

test('Startseite zeigt Watten als Neu und verlinkt den Tisch', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.match(html, /<span class="badge">Neu<\/span>\s*<\/div>\s*<h3>Watten<\/h3>/);
  assert.match(html, /href="\/watten\/">Watten spielen/);
  assert.match(html, /href="\/watten\/">Watten</);
  ['Skat', 'Mau-Mau', 'Doppelkopf', 'Canasta', 'Schafkopf', 'Schnapsen', 'Jass', 'Schwimmen', 'Elfer raus', 'Bridge'].forEach((name) => {
    assert.match(html, new RegExp('<h3>' + name + '</h3>'));
  });
});

test('Der Tisch ruft Avatar, Rundenzähler, Besetzung und die Rechtstexte', () => {
  const app = fs.readFileSync(path.join(root, 'public/watten/js/app.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'public/watten/index.html'), 'utf8');
  assert.match(app, /SpielFreundeAvatar/);
  assert.match(app, /playerSeat/);
  assert.match(app, /SpielpartnerRounds\.gate\(/);
  assert.match(app, /SpielpartnerRounds\.finish\(/);
  assert.match(app, /SpielpartnerRunde\.mount/);
  assert.match(app, /game: 'watten'/);
  assert.match(page, /\/spielpartner\/entitlement\.js/);
  assert.match(page, /\/spielpartner\/offer\.js/);
  assert.match(page, /\/spielpartner\/checkout\.js/);
  assert.match(page, /\/spielpartner\/paywall\.js/);
  assert.match(page, /\/spielpartner\/rounds\.js/);
  assert.match(page, /\/spielpartner\/lineup\.js/);
  assert.match(page, /\/spielpartner\/stimmen\.js/);
  assert.match(page, /\/spielpartner\/runde\.js/);
  assert.match(page, /\/spielpartner\/runde\.css/);
  assert.match(page, /id="modal-paywall"/);
  assert.match(page, /Ein Angebot der Interconsult LLC/);
  assert.doesNotMatch(page, /preview-badge/);
  assert.match(page, /href="\/impressum\.html"/);
  assert.match(page, /href="\/datenschutz\.html"/);
  assert.match(page, /href="\/agb\.html"/);
  assert.match(page, /href="\/widerruf\.html"/);
  assert.match(page, /href="\/partnerprogramm\/"/);
  assert.equal(page.includes('Michael'), false);
});
