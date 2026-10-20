/* Tisch, Startseite und Rundenzähler. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seats = require('../../public/schnapsen/js/seats.js');
const talk = require('../../public/schnapsen/js/talk.js').SchnapsenTalk;
const L = require('../../public/spielpartner/lineup.js');

const root = path.join(__dirname, '../..');

test('Sitze: Du gegen Sepp, Bild mit Initialen', () => {
  assert.deepEqual(seats.seats.map((s) => s.place), ['south', 'north']);
  assert.equal(seats.seats[1].id, 'sepp');
  assert.equal(seats.seats[1].slug, 'sepp');
  assert.equal(seats.seats[1].portrait, '/media/spielpartner/sepp.jpg');
  assert.equal(seats.seats[1].voice, true);
  assert.equal(seats.initials('Sepp Huber'), 'SH');
  const copy = seats.seats.map((s) => Object.assign({}, s));
  const store = { getItem() { return null; }, setItem() {}, removeItem() {} };
  assert.deepEqual(L.dress(copy, 'schnapsen', store), ['sepp']);
  assert.equal(copy[1].place, 'north');
});

test('Sprüche bleiben am Tisch und nennen keinen Anbieter', () => {
  assert.equal(talk.classify('Servus Sepp'), 'greet');
  assert.ok(talk.line('sepp', 'welcome'));
  assert.ok(talk.line('sepp', 'marriage') || talk.line('sepp', 'close'));
  assert.ok(talk.cannedReply('sepp', 'wie geht Zudrehen'));
  const blob = JSON.stringify(talk.LINES) + JSON.stringify(talk.REPLIES);
  assert.doesNotMatch(blob, /grok|elevenlabs|openai|x\.?ai/i);
  assert.deepEqual(talk.responders('Hallo Sepp'), ['sepp']);
  const src = fs.readFileSync(path.join(root, 'public/schnapsen/js/talk.js'), 'utf8');
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
});

test('Startseite zeigt Schnapsen als Neu und verlinkt den Tisch', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.match(html, /<span class="badge">Neu<\/span>\s*<\/div>\s*<h3>Schnapsen<\/h3>/);
  assert.match(html, /href="\/schnapsen\/">Schnapsen spielen/);
  assert.match(html, /href="\/schnapsen\/">Schnapsen</);
  ['Skat', 'Mau-Mau', 'Doppelkopf', 'Canasta', 'Schafkopf', 'Watten', 'Jass', 'Schwimmen', 'Elfer raus', 'Bridge'].forEach((name) => {
    assert.match(html, new RegExp('<h3>' + name + '</h3>'));
  });
});

test('Der Tisch ruft Avatar, Rundenzähler, Besetzung und die Rechtstexte', () => {
  const app = fs.readFileSync(path.join(root, 'public/schnapsen/js/app.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'public/schnapsen/index.html'), 'utf8');
  assert.match(app, /SpielFreundeAvatar/);
  assert.match(app, /playerSeat/);
  assert.match(app, /SpielpartnerRounds\.gate\(/);
  assert.match(app, /SpielpartnerRounds\.finish\(/);
  assert.match(app, /SpielpartnerRunde\.mount/);
  assert.match(app, /game: 'schnapsen'/);
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
