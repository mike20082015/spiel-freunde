/* Spiel wechseln: vom Tisch zur Spieleliste.
   Aufruf: node --test spielpartner/tests/spiel-wechseln.test.js */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const GAMES = ['skat', 'doppelkopf', 'canasta', 'romme', 'schafkopf', 'jass', 'watten', 'bridge', 'schnapsen', 'maumau', 'schwimmen', 'elfer-raus'];

test('jeder Tisch hat Spiel wechseln und die Startseite landet bei den Spielen', () => {
  const script = fs.readFileSync(path.join(root, 'public/assets/spiel-wechseln.js'), 'utf8');
  const home = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public/assets/style.css'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(script, /Spiel wechseln/);
  assert.match(script, /\/#spiele/);
  assert.match(script, /Laufendes Spiel verlassen\?/);
  assert.match(script, /intro\.hidden/);
  assert.doesNotMatch(script, /—|–/);
  assert.match(home, /id="spiele"/);
  assert.match(home, /src="\/assets\/spiel-wechseln\.js"/);
  assert.match(home, /__sfReleaseSpiele/);
  assert.match(css, /#spiele\{scroll-margin-top:86px\}/);
  assert.match(sw, /sf-pwa-v15/);
  assert.match(home, /id="btn-anmelden"/);
  GAMES.forEach((game) => {
    const html = fs.readFileSync(path.join(root, 'public', game, 'index.html'), 'utf8');
    assert.match(html, /id="btn-spiel-wechseln"/, game);
    assert.match(html, /href="\/#spiele"/, game);
    assert.match(html, />Spiel wechseln</, game);
    assert.match(html, /src="\/assets\/spiel-wechseln\.js"/, game);
    assert.match(html, /id="btn-settings"/, game);
    assert.doesNotMatch(html, /—/, game);
  });
  const tisch = fs.readFileSync(path.join(root, 'public/tisch/index.html'), 'utf8');
  assert.match(tisch, /id="btn-spiel-wechseln"/);
  assert.match(tisch, /href="\/#spiele"/);
  assert.match(tisch, /src="\/assets\/spiel-wechseln\.js"/);
});
