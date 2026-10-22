/* Installierbare App: Manifest, Service Worker, Kopfzeilen. Aufruf: node --test spielpartner/tests */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const policy = require('../../public/assets/pwa-policy.js');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/manifest.json'), 'utf8'));
const ORIGIN = 'https://spiel-freunde.com';

function htmlFiles(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  });
  return out;
}

test('das Manifest beschreibt eine eigenständige App', () => {
  assert.equal(manifest.name, 'Spiel-Freunde');
  assert.equal(manifest.short_name, 'Spiel-Freunde');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.equal(manifest.start_url, '/?source=pwa');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.theme_color, '#24160c');
  assert.equal(manifest.background_color, '#24160c');
  assert.doesNotMatch(manifest.start_url, /utm_/);
  const purposes = manifest.icons.map((icon) => icon.purpose);
  assert.ok(purposes.includes('any'));
  assert.ok(purposes.includes('maskable'));
  manifest.icons.forEach((icon) => {
    assert.ok(fs.existsSync(path.join(root, 'public', icon.src)), icon.src);
  });
  assert.ok(fs.existsSync(path.join(root, 'public/assets/pwa/apple-touch-icon.png')));
});

test('jede Seite verlinkt Manifest, Icon und den Installationshinweis', () => {
  const files = htmlFiles(path.join(root, 'public'), []);
  assert.ok(files.length > 10);
  files.forEach((file) => {
    const html = fs.readFileSync(file, 'utf8');
    const name = path.relative(root, file);
    assert.match(html, /rel="manifest" href="\/manifest\.json"/, name);
    assert.match(html, /name="theme-color" content="#24160c"/, name);
    assert.match(html, /rel="apple-touch-icon"/, name);
    assert.match(html, /viewport-fit=cover/, name);
    assert.match(html, /src="\/assets\/pwa\.js"/, name);
    assert.match(html, /href="\/assets\/pwa\.css"/, name);
    assert.match(html, /sf-standalone/, name);
    assert.doesNotMatch(html, /—/, name);
  });
  const ui = fs.readFileSync(path.join(root, 'public/assets/pwa.js'), 'utf8');
  assert.match(ui, /Als App installieren/);
  assert.match(ui, /So hast Du Spiel-Freunde als App auf Deinem /);
  assert.match(ui, /Zum Home-Bildschirm/);
  assert.match(ui, /sf-pwa-dismissed/);
  assert.match(ui, /display-mode: standalone/);
  assert.doesNotMatch(ui, /—/);
});

test('der Service Worker fasst API und Anmeldung nicht an', () => {
  const sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
  assert.match(sw, /importScripts\('\/assets\/pwa-policy\.js'\)/);
  assert.match(sw, /network-first/);
  assert.match(sw, /set-cookie/);

  function kind(url, extra) {
    return policy.classify(url, Object.assign({ origin: ORIGIN }, extra));
  }

  assert.equal(kind(ORIGIN + '/api/sf/chat'), 'bypass');
  assert.equal(kind(ORIGIN + '/api/tisch/poll'), 'bypass');
  assert.equal(kind(ORIGIN + '/api/sf/tts', { method: 'POST' }), 'bypass');
  assert.equal(kind(ORIGIN + '/api/sf/avatar', { method: 'POST', contentType: 'application/json' }), 'bypass');
  assert.equal(kind(ORIGIN + '/api/sf/avatar', { method: 'POST', contentType: 'multipart/form-data; boundary=----x' }), 'bypass');
  assert.equal(kind(ORIGIN + '/mein-avatar/'), 'bypass');
  assert.equal(kind(ORIGIN + '/mein-avatar/', { mode: 'navigate', destination: 'document', accept: 'text/html' }), 'bypass');
  assert.equal(kind(ORIGIN + '/mein-avatar/avatar.js'), 'bypass');
  assert.equal(kind(ORIGIN + '/mein-avatar/avatar.css'), 'bypass');
  assert.equal(kind(ORIGIN + '/assets/avatar-store.js'), 'bypass');
  assert.match(sw, /sf-pwa-v5/);
  assert.match(sw, /client\.navigate\(client\.url\)/);
  assert.doesNotMatch(sw, /return Promise\.all\(clients\.map/);
  assert.match(sw, /cache: 'no-cache'/);
  assert.equal(kind('https://lead-monster.net/api/public/spiel-freunde'), 'bypass');
  assert.equal(kind(ORIGIN + '/skat/', { authorization: 'Bearer geheim' }), 'bypass');
  assert.equal(kind(ORIGIN + '/anmelden/'), 'bypass');
  assert.equal(kind(ORIGIN + '/tisch/?code=AB12'), 'bypass');
  assert.equal(kind(ORIGIN + '/?source=pwa', { mode: 'navigate' }), 'network-first');
  assert.equal(kind(ORIGIN + '/skat/', { destination: 'document' }), 'network-first');
  assert.equal(kind(ORIGIN + '/impressum.html', { accept: 'text/html' }), 'network-first');
  assert.equal(kind(ORIGIN + '/assets/style.css'), 'cache-first');
  assert.equal(kind(ORIGIN + '/skat/js/app.js'), 'network-first');
  assert.equal(kind(ORIGIN + '/skat/js/voice.js'), 'network-first');
  assert.equal(kind(ORIGIN + '/skat/js/talk.js'), 'network-first');
  assert.equal(kind(ORIGIN + '/sw.js'), 'network-first');
  assert.equal(kind(ORIGIN + '/assets/pwa.js'), 'network-first');
  assert.equal(kind(ORIGIN + '/manifest.json'), 'cache-first');
  assert.equal(kind(ORIGIN + '/skat/assets/voice/horst.mp3'), 'bypass');
  assert.equal(kind(ORIGIN + '/spielpartner/avatare.json'), 'bypass');
});
