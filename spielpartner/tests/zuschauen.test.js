/* Zuschauen & Lernen. Aufruf: node --test spielpartner/tests/zuschauen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Z = require('../../public/spielpartner/zuschauen.js');

const GAMES = ['skat', 'canasta', 'schafkopf', 'jass', 'doppelkopf', 'maumau', 'romme', 'schwimmen', 'elfer-raus', 'schnapsen', 'watten', 'bridge'];
const VERBOTEN = /OpenAI|Anthropic|ElevenLabs|ChatGPT|Gemini|Claude|Einkommen|Einsatz|—/;

test('Re wird nur zum Sprechen zu Reh', () => {
  assert.equal(Z.fuerSprache('sagt Re.'), 'sagt Reh.');
  assert.equal(Z.fuerSprache('Re ist die Antwort'), 'Reh ist die Antwort');
  assert.equal(Z.fuerSprache('Kontra und Rekontra bleiben'), 'Kontra und Rekontra bleiben');
  assert.equal(Z.fuerSprache('Schneider'), 'Schneider');
  assert.equal(Z.fuerSprache(Z.fuerSprache('sagt Re')), 'sagt Reh');
});

test('Erklärungen nennen die Regel in einfachem Deutsch', () => {
  assert.match(Z.erklaere('skat', { art: 'reiz', name: 'Horst', wert: 18 }), /Reizen/);
  assert.match(Z.erklaere('skat', { art: 'karte', name: 'Du', karte: 'Herz-Ass', bedienen: true, trumpf: true }), /Trumpf bedienen/);
  assert.match(Z.erklaere('skat', { art: 'karte', name: 'Du', karte: 'Pik-Zehn', bedienen: true }), /Farbzwang/);
  assert.match(Z.erklaere('skat', { art: 're', name: 'Du', ja: true }), /sagst Re/);
  assert.doesNotMatch(Z.erklaere('skat', { art: 're', name: 'Du', ja: true }), /Reh/);
  assert.match(Z.erklaere('canasta', { art: 'meld', name: 'Lena', rang: 'Ass' }), /Meldung/);
  assert.match(Z.erklaere('canasta', { art: 'canasta', name: 'Horst' }), /Canasta/);
  assert.match(Z.erklaere('maumau', { art: 'legen', name: 'Du', karte: 'Herz Zehn' }), /Du legst/);
  assert.match(Z.erklaere('canasta', { art: 'talon', name: 'Du' }), /Du ziehst/);
  assert.doesNotMatch(Z.erklaere('maumau', { art: 'legen', name: 'Du', karte: 'Herz Zehn' }), /Du legt /);
  assert.match(Z.erklaere('skat', { art: 'reiz', name: 'Du', wert: 18 }), /Du sagst 18/);
  assert.match(Z.erklaere('schnapsen', { art: 'zudrehen', name: 'Sepp' }), /Farbzwang/);
  assert.match(Z.erklaere('doppelkopf', { art: 'ansage', name: 'Rüdiger', text: 'Re' }), /sagt Re/);
  assert.doesNotMatch(Z.erklaere('doppelkopf', { art: 'ansage', name: 'Rüdiger', text: 'Re' }), /Reh/);
  assert.doesNotMatch(Z.erklaere('skat', { art: 'reiz', name: 'Horst', wert: 18 }), VERBOTEN);
});

test('Texte bleiben freundlich und ohne Strich', () => {
  const datei = fs.readFileSync(path.join(__dirname, '../../public/spielpartner/zuschauen.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../../public/spielpartner/zuschauen.css'), 'utf8');
  assert.doesNotMatch(datei, VERBOTEN);
  assert.doesNotMatch(css, /—/);
  assert.match(datei, /Zuschauen & Lernen/);
  assert.match(datei, /Selbst weiterspielen/);
  assert.match(datei, /Langsam/);
  assert.match(datei, /Ein Zug/);
  ['skat', 'maumau', 'canasta', 'romme', 'doppelkopf', 'schafkopf', 'schnapsen', 'jass', 'watten', 'bridge', 'schwimmen', 'elfer'].forEach((spiel) => {
    const text = Z.erklaere(spiel, { art: 'ansage', name: 'Du', text: 'Re', regel: 'Farbzwang bleibt.' });
    assert.doesNotMatch(text, VERBOTEN);
  });
});

test('jeder Tisch hat den Knopf und das Modul', () => {
  GAMES.forEach((game) => {
    const page = fs.readFileSync(path.join(__dirname, '../../public', game, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(__dirname, '../../public', game, 'js/app.js'), 'utf8');
    assert.match(page, /\/spielpartner\/zuschauen\.css/, game);
    assert.match(page, /\/spielpartner\/zuschauen\.js/, game);
    assert.match(app, /SpielpartnerZuschauen/, game);
    assert.match(app, /zui\(\)\.mount/, game);
    assert.match(app, /uebernehmen:/, game);
  });
});
