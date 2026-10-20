/* Avatar bleibt auf dem Gerät: Metadaten hier, Bildbytes im Bildspeicher. */
const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Store = require('../../public/assets/avatar-store.js');

function memoryLocalStorage() {
  const map = new Map();
  return {
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

function memoryImages() {
  let value = null;
  return {
    async get() { return value; },
    async put(blob) { value = blob; },
    async del() { value = null; },
  };
}

function createPair() {
  const localStorage = memoryLocalStorage();
  const images = memoryImages();
  const urls = [];
  const api = Store.create({
    localStorage,
    images,
    createObjectURL(blob) {
      const url = 'blob:test-' + urls.length;
      urls.push(blob);
      return url;
    },
    revokeObjectURL() {},
    now: () => 1700000000000,
  });
  return { api, localStorage, images, urls };
}

test('playerSeat fällt auf Du zurück und trennt Name vom Bild', async () => {
  const { api, localStorage, images } = createPair();
  const empty = await api.playerSeat();
  assert.equal(empty.name, 'Du');
  assert.equal(empty.initial, 'Du');
  assert.equal(empty.imageUrl, null);
  assert.equal(empty.kind, 'none');

  const preset = await api.save({ name: '  Micha!!!  ', kind: 'preset', presetId: 'karten' });
  assert.equal(preset.ok, true);
  const seated = await api.playerSeat();
  assert.equal(seated.name, 'Micha');
  assert.equal(seated.initial, 'M');
  assert.equal(seated.kind, 'preset');
  assert.equal(seated.presetId, 'karten');
  assert.equal(seated.imageUrl, '/assets/avatars/karten.svg');
  const raw = localStorage.getItem(Store.KEY);
  assert.equal(raw.includes('data:image'), false);
  assert.equal(JSON.parse(raw).kind, 'preset');

  const bytes = new Uint8Array([9, 8, 7, 6, 5]);
  const photo = await api.save({ name: 'Micha', kind: 'photo', blob: bytes });
  assert.equal(photo.ok, true);
  assert.equal(await images.get(), bytes);
  const meta = JSON.parse(localStorage.getItem(Store.KEY));
  assert.equal(meta.kind, 'photo');
  assert.equal(JSON.stringify(meta).includes('9,8,7'), false);
  const again = await api.playerSeat();
  assert.equal(again.kind, 'photo');
  assert.match(again.imageUrl, /^blob:test-/);

  const bad = await api.save({ name: 'Micha', kind: 'preset', presetId: 'fremd' });
  assert.equal(bad.ok, false);
  assert.equal(JSON.parse(localStorage.getItem(Store.KEY)).kind, 'photo');
  const missing = await api.save({ name: 'Micha', kind: 'generated' });
  assert.equal(missing.ok, false);

  const form = { alter: '30-44', text: 'Schal' };
  await api.save({ name: 'Elke Beispiel', kind: 'generated', blob: bytes, form });
  const loaded = await api.load();
  assert.equal(loaded.meta.form.text, 'Schal');
  assert.equal(loaded.blob, bytes);

  const gone = await api.remove();
  assert.equal(gone.ok, true);
  assert.equal(localStorage.getItem(Store.KEY), null);
  assert.equal(await images.get(), null);
  const after = await api.playerSeat();
  assert.equal(after.name, 'Du');
  assert.equal(after.imageUrl, null);

  localStorage.setItem('sf-account', JSON.stringify({
    token: 'sf1',
    expiresAt: 1700000000000 + 86400000,
    player: { displayName: 'Helga' }
  }));
  const named = await api.playerSeat();
  assert.equal(named.name, 'Helga');
  assert.equal(named.initial, 'H');
});

test('Seiten verlinken Mein Avatar, ohne Schlüssel im Browser', () => {
  const root = path.join(__dirname, '../../public');
  const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const partners = fs.readFileSync(path.join(root, 'spielpartner/index.html'), 'utf8');
  const skat = fs.readFileSync(path.join(root, 'skat/index.html'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'mein-avatar/index.html'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'mein-avatar/avatar.js'), 'utf8');
  const store = fs.readFileSync(path.join(root, 'assets/avatar-store.js'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'skat/js/app.js'), 'utf8');
  for (const text of [home, partners, skat]) assert.match(text, /href="\/mein-avatar\/"/);
  assert.match(page, /Dein Foto bleibt auf deinem Gerät/);
  assert.match(page, /capture="user"/);
  assert.match(page, /Echtes Foto/);
  assert.match(page, /KI-Gesicht/);
  assert.match(skat, /id="ava-you"/);
  assert.match(skat, /avatar-store\.js/);
  assert.match(app, /playerSeat\(/);
  assert.match(store, /playerSeat/);
  for (const preset of Store.PRESETS) {
    assert.match(page, new RegExp(preset.id));
    assert.match(page, new RegExp(preset.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.equal(fs.existsSync(path.join(root, preset.src.replace(/^\//, ''))), true);
  }
  for (const text of [page, client, store]) {
    assert.equal(text.includes('VITE_'), false);
    assert.equal(text.includes('XAI_API_KEY'), false);
    assert.equal(/grok|x\.ai|openai|elevenlabs/i.test(text), false);
  }
});
