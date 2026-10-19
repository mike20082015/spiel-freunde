(function () {
  'use strict';

  const store = window.SpielFreundeAvatar;
  const EDGE = (store && store.EDGE) || 512;
  const $ = (id) => document.getElementById(id);
  const PATHS = ['/api/sf/avatar', '/api/avatar', '/api/default/avatar'];
  const KIND_LABEL = { none: 'Noch kein eigenes Bild', photo: 'Eigenes Foto', generated: 'Gezeichnetes Gesicht', preset: 'Fertiges Bild' };

  let crop = null;
  let pendingGen = null;
  let deleteArmed = false;

  function setStatus(text, bad) {
    const el = $('status');
    el.textContent = text || '';
    el.classList.toggle('bad', !!bad);
  }

  function failText(reason) {
    if (reason === 'refused') return 'Das geht so nicht. Beschreib eine erfundene erwachsene Person, ohne echte Namen.';
    if (reason === 'rate_limited') return 'Für den Moment reicht es. Versuch es später noch einmal, oder wähl ein fertiges Bild.';
    if (reason === 'invalid_input') return 'Schau noch einmal auf die Angaben. Der freie Text darf nicht zu lang sein.';
    if (reason === 'storage') return 'Dein Browser lässt das Speichern gerade nicht zu.';
    return 'Das Gesicht lässt sich gerade nicht zeichnen. Versuch es später noch einmal, oder wähl ein fertiges Bild.';
  }

  function nameValue() {
    return $('player-name').value;
  }

  async function paintNow() {
    if (!store) return;
    const seat = await store.playerSeat();
    const face = $('now-face');
    face.replaceChildren();
    if (seat.imageUrl) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = seat.imageUrl;
      face.appendChild(img);
    } else {
      face.textContent = seat.initial || 'Du';
    }
    $('now-name').textContent = seat.name || 'Du';
    $('now-kind').textContent = KIND_LABEL[seat.kind] || KIND_LABEL.none;
    document.querySelectorAll('.preset').forEach((btn) => {
      btn.classList.toggle('on', btn.getAttribute('data-preset') === seat.presetId);
    });
  }

  function showMode(mode) {
    const photo = mode === 'photo';
    $('tab-photo').setAttribute('aria-selected', photo ? 'true' : 'false');
    $('tab-ki').setAttribute('aria-selected', photo ? 'false' : 'true');
    $('panel-photo').hidden = !photo;
    $('panel-ki').hidden = photo;
  }

  function imgSize(img) {
    return { w: img.naturalWidth || img.width, h: img.naturalHeight || img.height };
  }

  async function decodeImage(file) {
    if (typeof createImageBitmap === 'function') {
      try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
      catch (e) { /* nächstes */ }
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function coverScale() {
    const size = imgSize(crop.img);
    return Math.max(EDGE / size.w, EDGE / size.h);
  }

  function clampCrop() {
    const size = imgSize(crop.img);
    const scale = coverScale() * crop.zoom;
    const dw = size.w * scale;
    const dh = size.h * scale;
    if (crop.x > 0) crop.x = 0;
    if (crop.y > 0) crop.y = 0;
    if (crop.x < EDGE - dw) crop.x = EDGE - dw;
    if (crop.y < EDGE - dh) crop.y = EDGE - dh;
  }

  function drawCrop() {
    const canvas = $('crop-canvas');
    const ctx = canvas.getContext('2d');
    const size = imgSize(crop.img);
    const scale = coverScale() * crop.zoom;
    ctx.clearRect(0, 0, EDGE, EDGE);
    ctx.drawImage(crop.img, crop.x, crop.y, size.w * scale, size.h * scale);
  }

  function setZoom(next) {
    const z = Math.min(3, Math.max(1, next));
    if (!crop) return;
    const prev = crop.zoom || 1;
    const size = imgSize(crop.img);
    const s0 = coverScale() * prev;
    const ix = (EDGE / 2 - crop.x) / s0;
    const iy = (EDGE / 2 - crop.y) / s0;
    crop.zoom = z;
    const s1 = coverScale() * z;
    crop.x = EDGE / 2 - ix * s1;
    crop.y = EDGE / 2 - iy * s1;
    clampCrop();
    drawCrop();
  }

  async function openFile(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setStatus('Das Bild ist zu groß. Nimm eines unter 8 MB.', true);
      return;
    }
    let img;
    try { img = await decodeImage(file); }
    catch (e) {
      setStatus('Dieses Bild lässt sich nicht lesen.', true);
      return;
    }
    const size = imgSize(img);
    if (!size.w || !size.h) {
      setStatus('Dieses Bild lässt sich nicht lesen.', true);
      return;
    }
    crop = { img: img, zoom: 1, x: 0, y: 0, drag: null };
    const scale = coverScale();
    crop.x = (EDGE - size.w * scale) / 2;
    crop.y = (EDGE - size.h * scale) / 2;
    $('crop-zoom').value = '1';
    $('crop-wrap').hidden = false;
    clampCrop();
    drawCrop();
    setStatus('Zieh das Bild zurecht und speichere dann das Quadrat.');
  }

  function canvasBlob() {
    return new Promise((resolve) => {
      $('crop-canvas').toBlob((blob) => resolve(blob), 'image/jpeg', 0.86);
    });
  }

  async function squareJpeg(source) {
    const img = await decodeImage(source);
    const canvas = document.createElement('canvas');
    canvas.width = EDGE;
    canvas.height = EDGE;
    const ctx = canvas.getContext('2d');
    const size = imgSize(img);
    const scale = Math.max(EDGE / size.w, EDGE / size.h);
    const dw = size.w * scale;
    const dh = size.h * scale;
    ctx.drawImage(img, (EDGE - dw) / 2, (EDGE - dh) / 2, dw, dh);
    if (typeof img.close === 'function') img.close();
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.86));
  }

  function b64Blob(b64, mime) {
    const clean = String(b64 || '').replace(/\s/g, '');
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime || 'image/jpeg' });
  }

  function formPayload() {
    return {
      typ: $('ki-typ').value,
      alter: $('ki-alter').value,
      haare: $('ki-haare').value,
      brille: $('ki-brille').value,
      stimmung: $('ki-stimmung').value,
      text: $('ki-text').value,
    };
  }

  async function drawFace(payload) {
    let reason = 'exception';
    for (let i = 0; i < PATHS.length; i++) {
      try {
        const res = await fetch(PATHS[i], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(payload),
        });
        let data = null;
        try { data = await res.json(); }
        catch (e) { data = null; }
        if (res.ok && data && typeof data.image === 'string') {
          return { ok: true, image: data.image, mime: typeof data.mime === 'string' ? data.mime : 'image/jpeg' };
        }
        reason = data && typeof data.reason === 'string' ? data.reason : 'exception';
        if (res.status !== 404 && res.status !== 400) break;
      } catch (e) {
        reason = 'exception';
      }
    }
    return { ok: false, reason: reason };
  }

  function disarmDelete() {
    deleteArmed = false;
    $('btn-delete').textContent = 'Avatar löschen';
  }

  async function init() {
    if (!store) {
      setStatus('Der Speicher auf diesem Gerät ist gerade nicht da.', true);
      return;
    }
    $('player-name').maxLength = store.MAX_NAME || 24;
    const loaded = await store.load();
    if (loaded.meta && loaded.meta.name) $('player-name').value = loaded.meta.name;
    const form = loaded.meta && loaded.meta.form;
    if (form) {
      ['typ', 'alter', 'haare', 'brille', 'stimmung'].forEach((key) => {
        const el = $('ki-' + key);
        if (el && typeof form[key] === 'string' && form[key]) el.value = form[key];
      });
      if (typeof form.text === 'string') $('ki-text').value = form.text;
      if (loaded.meta.kind === 'generated') showMode('ki');
    }
    await paintNow();
  }

  $('tab-photo').addEventListener('click', () => showMode('photo'));
  $('tab-ki').addEventListener('click', () => showMode('ki'));
  $('file-upload').addEventListener('change', (e) => { openFile(e.target.files && e.target.files[0]); e.target.value = ''; });
  $('file-selfie').addEventListener('change', (e) => { openFile(e.target.files && e.target.files[0]); e.target.value = ''; });

  $('crop-zoom').addEventListener('input', () => setZoom(Number($('crop-zoom').value)));
  $('crop-canvas').addEventListener('pointerdown', (e) => {
    if (!crop) return;
    const canvas = $('crop-canvas');
    canvas.setPointerCapture(e.pointerId);
    const scale = EDGE / canvas.getBoundingClientRect().width;
    crop.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: crop.x, oy: crop.y, scale: scale };
  });
  $('crop-canvas').addEventListener('pointermove', (e) => {
    if (!crop || !crop.drag || crop.drag.id !== e.pointerId) return;
    crop.x = crop.drag.ox + (e.clientX - crop.drag.x) * crop.drag.scale;
    crop.y = crop.drag.oy + (e.clientY - crop.drag.y) * crop.drag.scale;
    clampCrop();
    drawCrop();
  });
  function endDrag(e) {
    if (crop && crop.drag && crop.drag.id === e.pointerId) crop.drag = null;
  }
  $('crop-canvas').addEventListener('pointerup', endDrag);
  $('crop-canvas').addEventListener('pointercancel', endDrag);
  $('crop-canvas').addEventListener('wheel', (e) => {
    if (!crop) return;
    e.preventDefault();
    const next = crop.zoom + (e.deltaY < 0 ? 0.08 : -0.08);
    $('crop-zoom').value = String(Math.min(3, Math.max(1, next)));
    setZoom(next);
  }, { passive: false });

  $('btn-save-photo').addEventListener('click', async () => {
    if (!crop) return;
    const blob = await canvasBlob();
    if (!blob) { setStatus('Das Foto ließ sich nicht speichern.', true); return; }
    const result = await store.save({ name: nameValue(), kind: 'photo', blob: blob });
    if (!result.ok) { setStatus(failText(result.reason), true); return; }
    disarmDelete();
    await paintNow();
    setStatus('Gespeichert. Dein Foto bleibt auf deinem Gerät.');
  });

  $('btn-draw').addEventListener('click', async () => {
    const btn = $('btn-draw');
    btn.disabled = true;
    setStatus('Das Gesicht entsteht …');
    const payload = formPayload();
    const drawn = await drawFace(payload);
    btn.disabled = false;
    if (!drawn.ok) { setStatus(failText(drawn.reason), true); return; }
    let blob;
    try { blob = await squareJpeg(b64Blob(drawn.image, drawn.mime)); }
    catch (e) { blob = null; }
    if (!blob) { setStatus('Das Bild ließ sich nicht lesen. Versuch es noch einmal.', true); return; }
    pendingGen = { blob: blob, form: payload };
    const url = URL.createObjectURL(blob);
    $('gen-img').src = url;
    $('gen-preview').hidden = false;
    setStatus('Gefällt es Dir? Dann speichere dieses Gesicht. Es bleibt auf deinem Gerät.');
  });

  $('btn-save-gen').addEventListener('click', async () => {
    if (!pendingGen) return;
    const result = await store.save({
      name: nameValue(),
      kind: 'generated',
      blob: pendingGen.blob,
      form: pendingGen.form,
    });
    if (!result.ok) { setStatus(failText(result.reason), true); return; }
    disarmDelete();
    await paintNow();
    setStatus('Gespeichert. Dein Foto bleibt auf deinem Gerät.');
  });

  document.querySelectorAll('.preset').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const result = await store.save({ name: nameValue(), kind: 'preset', presetId: btn.getAttribute('data-preset') });
      if (!result.ok) { setStatus(failText(result.reason), true); return; }
      disarmDelete();
      await paintNow();
      setStatus('Gespeichert. Dein Foto bleibt auf deinem Gerät.');
    });
  });

  $('player-name').addEventListener('change', async () => {
    const loaded = await store.load();
    const kind = loaded.meta.kind === 'photo' || loaded.meta.kind === 'generated' || loaded.meta.kind === 'preset' ? loaded.meta.kind : 'none';
    if (kind === 'photo' || kind === 'generated') {
      if (!loaded.blob) {
        await store.save({ name: nameValue(), kind: 'none' });
      } else {
        await store.save({ name: nameValue(), kind: kind, blob: loaded.blob, form: loaded.meta.form });
      }
    } else if (kind === 'preset') {
      await store.save({ name: nameValue(), kind: 'preset', presetId: loaded.meta.presetId });
    } else {
      await store.save({ name: nameValue(), kind: 'none' });
    }
    await paintNow();
  });

  $('btn-delete').addEventListener('click', async () => {
    if (!deleteArmed) {
      deleteArmed = true;
      $('btn-delete').textContent = 'Wirklich löschen?';
      return;
    }
    const result = await store.remove();
    disarmDelete();
    if (!result.ok) { setStatus(failText(result.reason), true); return; }
    pendingGen = null;
    $('gen-preview').hidden = true;
    await paintNow();
    setStatus('Gelöscht. Auf diesem Gerät liegt kein Avatar mehr.');
  });

  $('avatar-form').addEventListener('submit', (e) => e.preventDefault());
  init();
})();
