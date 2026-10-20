/* Sitze, Sprüche, Startseite und der gemeinsame Tisch. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seats = require('../../public/bridge/js/seats.js');
const talk = require('../../public/bridge/js/talk.js');

const root = path.join(__dirname, '../..');

test('Sitze: Du, Jonas, Margarethe, Rüdiger', () => {
  assert.deepEqual(seats.seats.map((s) => s.place), ['south', 'west', 'north', 'east']);
  assert.equal(seats.seats[0].id, 'du');
  assert.equal(seats.seats[1].id, 'jonas');
  assert.equal(seats.seats[1].portrait, '/media/spielpartner/jonas.jpg');
  assert.equal(seats.seats[2].id, 'margarethe');
  assert.equal(seats.seats[2].portrait, '/media/spielpartner/margarethe.jpg');
  assert.equal(seats.seats[3].id, 'ruediger');
  assert.equal(seats.initials('Jonas Rehm'), 'JR');
  assert.equal(seats.initials('Margarethe von Hohenfels'), 'MH');
  assert.equal(seats.initials('Rüdiger Falk'), 'RF');
  assert.equal(seats.seats[1].team, 1);
  assert.equal(seats.seats[2].team, 0);
});

test('Sprüche bleiben am Tisch und nennen keinen Anbieter', () => {
  assert.equal(talk.classify('Wie geht die Reizung'), 'rules');
  assert.ok(talk.line('margarethe', 'welcome'));
  assert.ok(talk.line('jonas', 'contract'));
  assert.ok(talk.cannedReply('ruediger', 'was ist ein Strohmann'));
  const blob = JSON.stringify(talk.LINES) + JSON.stringify(talk.REPLIES);
  assert.doesNotMatch(blob, /grok|elevenlabs|openai|x\.?ai/i);
  assert.deepEqual(talk.responders('Hallo Margarethe'), ['margarethe']);
  const src = fs.readFileSync(path.join(root, 'public/bridge/js/talk.js'), 'utf8');
  assert.match(src, /\/api\/sf\/chat/);
  assert.match(src, /\/api\/sf\/tts/);
});

test('Startseite zeigt Bridge als Neu und verlinkt es im Fuß', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.doesNotMatch(html, /preview-badge/);
  assert.match(html, /<span class="badge">Neu<\/span>\s*<\/div>\s*<h3>Bridge<\/h3>/);
  assert.match(html, /href="\/bridge\/">Bridge spielen/);
  assert.match(html, /href="\/bridge\/">Bridge</);
  assert.doesNotMatch(html, /in Vorbereitung/);
  ['Skat', 'Mau-Mau', 'Doppelkopf', 'Canasta', 'Schafkopf', 'Schnapsen', 'Watten', 'Jass', 'Schwimmen', 'Elfer raus', 'Bridge'].forEach((name) => {
    assert.match(html, new RegExp('<h3>' + name + '</h3>'));
  });
});

test('Der Tisch ruft Rundenzähler, Besetzung und die Rechtstexte', () => {
  const app = fs.readFileSync(path.join(root, 'public/bridge/js/app.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'public/bridge/index.html'), 'utf8');
  assert.match(app, /SpielFreundeAvatar/);
  assert.match(app, /playerSeat/);
  assert.match(app, /SpielpartnerRounds\.gate\(/);
  assert.match(app, /SpielpartnerRounds\.finish\(/);
  assert.match(app, /SpielpartnerRunde\.mount/);
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
  assert.match(page, /Kontra/);
  assert.match(app, /Rekontra/);
  assert.match(page, /Strohmann/);
  assert.match(page, /Anfängerhilfe/);
  assert.equal(page.includes('Michael'), false);
  assert.equal(app.includes('Michael'), false);
});
