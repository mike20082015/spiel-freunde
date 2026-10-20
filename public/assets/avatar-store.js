/*
 * Spiel-Freunde: Avatar des Menschen am Tisch, nur auf diesem Gerät.
 * Metadaten liegen im localStorage, das Bild in IndexedDB.
 * window.SpielFreundeAvatar.playerSeat() ist die Stelle für Skat, Jass und später ein Konto:
 * dieselbe Form, dann mit einem anderen Speicher dahinter.
 */
(function (root) {
  'use strict';

  const KEY = 'sf-player-avatar';
  const MAX_NAME = 24;
  const MAX_BYTES = 1500000;
  const EDGE = 512;
  const DB_NAME = 'sf-player-avatar';
  const DB_STORE = 'image';

  const PRESETS = [
    { id: 'karten', label: 'Karten-König', src: '/assets/avatars/karten.svg' },
    { id: 'perlen', label: 'Perlen', src: '/assets/avatars/perlen.svg' },
    { id: 'muetze', label: 'Schiebermütze', src: '/assets/avatars/muetze.svg' },
    { id: 'sonne', label: 'Sonnenschein', src: '/assets/avatars/sonne.svg' },
  ];

  function presetById(id) {
    for (let i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].id === id) return PRESETS[i];
    }
    return null;
  }

  function normalizeName(value) {
    const raw = String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charAt(i);
      if (/^[\p{L}\p{N} .'\-]$/u.test(ch)) out += ch;
    }
    return out.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
  }

  function emptyMeta() {
    return { name: '', kind: 'none', presetId: '', form: null, updatedAt: 0 };
  }

  function cleanForm(form) {
    if (!form || typeof form !== 'object' || Array.isArray(form)) return null;
    const out = {};
    const keys = ['typ', 'alter', 'haare', 'brille', 'stimmung', 'text'];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (typeof form[key] === 'string') out[key] = form[key].slice(0, 180);
    }
    return out;
  }

  function asBytes(blob) {
    if (!blob) return null;
    if (typeof Blob !== 'undefined' && blob instanceof Blob) return blob;
    if (typeof Uint8Array !== 'undefined' && blob instanceof Uint8Array) return blob;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(blob)) return blob;
    return null;
  }

  function byteSize(blob) {
    if (blob && typeof blob.size === 'number') return blob.size;
    if (blob && typeof blob.byteLength === 'number') return blob.byteLength;
    return 0;
  }

  function idbImages() {
    let opening = null;
    function open() {
      if (opening) return opening;
      opening = new Promise((resolve, reject) => {
        if (!root || typeof root.indexedDB === 'undefined') {
          reject(new Error('no-idb'));
          return;
        }
        const req = root.indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          const db = req.result;
          if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error('idb')); };
      });
      opening.catch(function () { opening = null; });
      return opening;
    }
    function run(mode, fn) {
      return open().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, mode);
        const req = fn(tx.objectStore(DB_STORE));
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error || new Error('idb')); };
      }));
    }
    return {
      get: function () { return run('readonly', (store) => store.get('image')); },
      put: function (blob) { return run('readwrite', (store) => store.put(blob, 'image')); },
      del: function () { return run('readwrite', (store) => store.delete('image')); },
    };
  }

  function create(deps) {
    if (!deps || !deps.localStorage || !deps.images) throw new Error('Speicher fehlt');
    const listeners = new Set();
    let currentUrl = '';

    function readMeta() {
      let raw = null;
      try { raw = deps.localStorage.getItem(KEY); }
      catch (e) { return emptyMeta(); }
      if (!raw) return emptyMeta();
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyMeta();
        const kind = parsed.kind === 'photo' || parsed.kind === 'generated' || parsed.kind === 'preset' ? parsed.kind : 'none';
        return {
          name: normalizeName(parsed.name),
          kind: kind,
          presetId: typeof parsed.presetId === 'string' ? parsed.presetId : '',
          form: cleanForm(parsed.form),
          updatedAt: Number(parsed.updatedAt) || 0,
        };
      } catch (e) {
        return emptyMeta();
      }
    }

    function writeMeta(meta) {
      const payload = {
        v: 1,
        name: meta.name || '',
        kind: meta.kind,
        presetId: meta.presetId || '',
        form: meta.form || null,
        updatedAt: meta.updatedAt || 0,
      };
      deps.localStorage.setItem(KEY, JSON.stringify(payload));
    }

    function emit() {
      listeners.forEach(function (fn) {
        try { fn(); }
        catch (e) { /* ein Zuhörer darf die anderen nicht umwerfen */ }
      });
      if (typeof deps.emit === 'function') {
        try { deps.emit(); }
        catch (e) { /* egal */ }
      }
    }

    function dropUrl() {
      if (currentUrl && typeof deps.revokeObjectURL === 'function') {
        try { deps.revokeObjectURL(currentUrl); }
        catch (e) { /* egal */ }
      }
      currentUrl = '';
    }

    async function load() {
      const meta = readMeta();
      let blob = null;
      if (meta.kind === 'photo' || meta.kind === 'generated') {
        try { blob = await deps.images.get(); }
        catch (e) { blob = null; }
        if (blob == null) blob = null;
      }
      return { meta: meta, blob: blob };
    }

    function accountName() {
      try {
        const raw = JSON.parse(deps.localStorage.getItem('sf-account') || 'null');
        const name = raw && raw.player && raw.player.displayName;
        if (typeof name === 'string' && name.trim()) return name.trim();
      } catch (e) { /* kein Konto */ }
      return '';
    }

    async function playerSeat() {
      const meta = readMeta();
      const fromAccount = accountName();
      const name = fromAccount || meta.name || 'Du';
      const initial = (fromAccount || meta.name) ? name.charAt(0).toLocaleUpperCase('de') : 'Du';
      let imageUrl = null;
      let kind = 'none';
      let presetId = '';
      if (meta.kind === 'preset') {
        const preset = presetById(meta.presetId);
        if (preset) {
          dropUrl();
          imageUrl = preset.src;
          kind = 'preset';
          presetId = preset.id;
        }
      } else if (meta.kind === 'photo' || meta.kind === 'generated') {
        let blob = null;
        try { blob = await deps.images.get(); }
        catch (e) { blob = null; }
        if (blob && typeof deps.createObjectURL === 'function') {
          dropUrl();
          try {
            currentUrl = deps.createObjectURL(blob);
            imageUrl = currentUrl;
            kind = meta.kind;
          } catch (e) {
            imageUrl = null;
          }
        }
      } else {
        dropUrl();
      }
      return { name: name, initial: initial, imageUrl: imageUrl, kind: kind, presetId: presetId };
    }

    async function save(input) {
      const name = normalizeName(input && input.name);
      const kind = input && input.kind;
      if (kind !== 'photo' && kind !== 'generated' && kind !== 'preset' && kind !== 'none') {
        return { ok: false, reason: 'invalid' };
      }
      try {
        if (kind === 'preset') {
          const preset = presetById(input.presetId);
          if (!preset) return { ok: false, reason: 'invalid' };
          await deps.images.del();
          writeMeta({ name: name, kind: 'preset', presetId: preset.id, form: null, updatedAt: deps.now ? deps.now() : Date.now() });
        } else if (kind === 'none') {
          await deps.images.del();
          writeMeta({ name: name, kind: 'none', presetId: '', form: null, updatedAt: deps.now ? deps.now() : Date.now() });
        } else {
          const blob = asBytes(input.blob);
          const size = byteSize(blob);
          if (!blob || !size || size > MAX_BYTES) return { ok: false, reason: 'invalid' };
          await deps.images.put(blob);
          writeMeta({
            name: name,
            kind: kind,
            presetId: '',
            form: kind === 'generated' ? cleanForm(input.form) : null,
            updatedAt: deps.now ? deps.now() : Date.now(),
          });
        }
      } catch (e) {
        return { ok: false, reason: 'storage' };
      }
      emit();
      return { ok: true };
    }

    async function remove() {
      try {
        deps.localStorage.removeItem(KEY);
        await deps.images.del();
      } catch (e) {
        return { ok: false, reason: 'storage' };
      }
      dropUrl();
      emit();
      return { ok: true };
    }

    function subscribe(fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.add(fn);
      return function () { listeners.delete(fn); };
    }

    return {
      KEY: KEY,
      PRESETS: PRESETS,
      presets: PRESETS,
      MAX_NAME: MAX_NAME,
      EDGE: EDGE,
      normalizeName: normalizeName,
      presetById: presetById,
      load: load,
      playerSeat: playerSeat,
      save: save,
      remove: remove,
      subscribe: subscribe,
    };
  }

  const api = { create: create, KEY: KEY, PRESETS: PRESETS, MAX_NAME: MAX_NAME, EDGE: EDGE, normalizeName: normalizeName };
  if (typeof module === 'object' && module.exports) module.exports = api;

  if (root && root.document && root.localStorage) {
    root.SpielFreundeAvatar = create({
      localStorage: root.localStorage,
      images: idbImages(),
      createObjectURL: function (blob) { return root.URL.createObjectURL(blob); },
      revokeObjectURL: function (url) { root.URL.revokeObjectURL(url); },
      now: function () { return Date.now(); },
      emit: function () { root.dispatchEvent(new root.CustomEvent('sf-avatar')); },
    });
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
