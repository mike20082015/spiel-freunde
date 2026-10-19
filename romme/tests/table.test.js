/* Tisch, Startseite und Rundenzähler. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const seats = require('../../public/romme/js/seats.js');

const root = path.join(__dirname, '../..');

test('Sitze: Du, Horst, Margarethe, Oma Hilde, Bilder mit Initialen', () => {
  assert.deepEqual(seats.seats.map((s) => s.place), ['south', 'west', 'north', 'east']);
  assert.equal(seats.seats[1].portrait, '/media/spielpartner/horst.jpg');
  assert.equal(seats.seats[2].portrait, '/media/spielpartner/margarethe.jpg');
  assert.equal(seats.seats[3].slug, 'oma-hilde');
  assert.equal(seats.seats[3].portrait, '/media/spielpartner/oma-hilde.jpg');
  assert.equal(seats.seats[3].voice, false);
  assert.equal(seats.seats[1].voice, true);
  assert.equal(seats.seats[2].voice, true);
  assert.equal(seats.initials('Horst Kaluppke'), 'HK');
  assert.equal(seats.initials('Margarethe von Hohenfels'), 'MH');
  assert.equal(seats.initials('Oma Hilde'), 'OH');
});

test('Startseite zeigt Rommé als Neu und behält die anderen Spiele', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.match(html, /preview-badge">Vorschau</);
  assert.match(html, /<span class="badge">Neu<\/span>\s*<\/div>\s*<h3>Rommé<\/h3>/);
  assert.match(html, /href="\/romme\/">Rommé spielen</);
  assert.match(html, /href="\/romme\/">Rommé</);
  ['Skat', 'Mau-Mau', 'Doppelkopf', 'Canasta', 'Schafkopf', 'Schnapsen', 'Watten', 'Jass', 'Schwimmen', 'Elfer raus', 'Bridge'].forEach((name) => {
    assert.match(html, new RegExp('<h3>' + name + '</h3>'));
  });
  assert.match(html, /href="\/skat\/"/);
  assert.match(html, /href="\/canasta\/"/);
  assert.match(html, /href="\/schafkopf\/"/);
  assert.match(html, /href="\/jass\/"/);
});

test('Der Tisch ruft Avatar, Rundenzähler und die Rechtstexte', () => {
  const app = fs.readFileSync(path.join(root, 'public/romme/js/app.js'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'public/romme/index.html'), 'utf8');
  assert.match(app, /SpielFreundeAvatar/);
  assert.match(app, /playerSeat/);
  assert.match(app, /SpielpartnerRounds\.gate\(/);
  assert.match(app, /SpielpartnerRounds\.finish\(/);
  assert.match(page, /\/spielpartner\/entitlement\.js/);
  assert.match(page, /\/spielpartner\/offer\.js/);
  assert.match(page, /\/spielpartner\/checkout\.js/);
  assert.match(page, /\/spielpartner\/paywall\.js/);
  assert.match(page, /\/spielpartner\/rounds\.js/);
  assert.match(page, /id="modal-paywall"/);
  assert.match(page, /Ein Angebot der Interconsult LLC/);
  assert.match(page, /preview-badge">Vorschau</);
  assert.equal(page.includes('Michael'), false);
});
