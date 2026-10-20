/*
 * Kurze Vorstellung der Spielpartner.
 * Ein Clip = eine Zeile in CLIPS plus die Datei unter public/spielpartner/videos/.
 * Chantal: chantal.mp4 ablegen und hier chantal: 'chantal.mp4' eintragen.
 * Wer nicht in CLIPS steht, bekommt keinen Abspielknopf.
 * Im Browser: window.SpielpartnerIntro. In Node: require.
 */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SpielpartnerIntro = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var CLIPS = {
    horst: 'horst.mp4',
    margarethe: 'margarethe.mp4',
    lena: 'lena.mp4',
    jonas: 'jonas.mp4',
    oemer: 'oemer.mp4',
    'oma-hilde': 'oma-hilde.mp4',
    sepp: 'sepp.mp4',
    ruediger: 'ruediger.mp4',
    urs: 'urs.mp4',
    vreni: 'vreni.mp4'
  };

  var lastFocus = null;

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"]/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch];
    });
  }

  function src(slug) {
    var file = slug && CLIPS[slug];
    return file ? '/spielpartner/videos/' + file : '';
  }

  function buttonHtml(opts) {
    opts = opts || {};
    var slug = opts.slug || '';
    var video = opts.video || src(slug);
    if (!video) return '';
    return '<button type="button" class="intro-play" data-intro="' + esc(slug) + '"' +
      ' data-intro-src="' + esc(video) + '"' +
      ' data-intro-poster="' + esc(opts.poster || '') + '"' +
      ' data-intro-name="' + esc(opts.name || '') + '">' +
      '<span class="intro-play-icon" aria-hidden="true"></span>' +
      '<span class="intro-play-label">Vorstellung ansehen</span></button>';
  }

  function doc() {
    return root && root.document ? root.document : null;
  }

  function ensureModal() {
    var document = doc();
    if (!document) return null;
    var modal = document.getElementById('intro-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'intro-modal';
    modal.id = 'intro-modal';
    modal.hidden = true;
    modal.innerHTML = '' +
      '<div class="intro-dialog" role="dialog" aria-modal="true" aria-labelledby="intro-title">' +
      '<button type="button" class="intro-close" aria-label="Schließen"><span aria-hidden="true">×</span></button>' +
      '<p class="intro-title" id="intro-title"></p>' +
      '<div class="intro-stage"><video class="intro-video" playsinline webkit-playsinline preload="none" controls></video></div>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (event) {
      if (event.target === modal) close();
    });
    modal.querySelector('.intro-close').addEventListener('click', function (event) {
      event.preventDefault();
      close();
    });
    return modal;
  }

  function close() {
    var document = doc();
    if (!document) return;
    var modal = document.getElementById('intro-modal');
    if (!modal || modal.hidden) return;
    var video = modal.querySelector('video');
    if (video) {
      try { video.pause(); } catch (err) { /* schon zu */ }
      video.removeAttribute('src');
      try { video.load(); } catch (err2) { /* egal */ }
    }
    modal.hidden = true;
    document.body.classList.remove('intro-open');
    var back = lastFocus;
    lastFocus = null;
    if (back && typeof back.focus === 'function') {
      try { back.focus(); } catch (err3) { /* Knopf kann weg sein */ }
    }
  }

  function openFrom(button) {
    var document = doc();
    if (!document || !button) return;
    var videoSrc = button.getAttribute('data-intro-src') || src(button.getAttribute('data-intro'));
    if (!videoSrc) return;
    var modal = ensureModal();
    if (!modal) return;
    var video = modal.querySelector('video');
    var title = modal.querySelector('#intro-title');
    var name = button.getAttribute('data-intro-name') || 'Spielpartner';
    var poster = button.getAttribute('data-intro-poster') || '';
    if (title) title.textContent = name;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.playsInline = true;
    video.preload = 'none';
    video.controls = true;
    video.autoplay = false;
    video.removeAttribute('autoplay');
    video.defaultMuted = false;
    video.muted = false;
    video.volume = 1;
    if (poster) video.setAttribute('poster', poster);
    else video.removeAttribute('poster');
    video.setAttribute('aria-label', 'Vorstellung von ' + name);
    video.pause();
    video.src = videoSrc;
    lastFocus = button;
    modal.hidden = false;
    document.body.classList.add('intro-open');
    var closeBtn = modal.querySelector('.intro-close');
    if (closeBtn && closeBtn.focus) closeBtn.focus();
    var started = video.play();
    if (started && typeof started.catch === 'function') started.catch(function () { /* Steuerung bleibt */ });
  }

  function paintHosts() {
    var document = doc();
    if (!document) return;
    var hosts = document.querySelectorAll('[data-intro-host]');
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      var slug = host.getAttribute('data-intro-slug') || '';
      var existing = host.querySelector('.intro-play');
      var html = buttonHtml({
        slug: slug,
        name: host.getAttribute('data-intro-name') || '',
        poster: (function () {
          var img = host.querySelector('img');
          return img ? (img.getAttribute('src') || '') : '';
        })()
      });
      if (!html) {
        if (existing) existing.remove();
        continue;
      }
      if (existing) existing.remove();
      host.insertAdjacentHTML('beforeend', html);
    }
  }

  function boot() {
    var document = doc();
    if (!document || document.documentElement.getAttribute('data-intro-bound') === '1') return;
    document.documentElement.setAttribute('data-intro-bound', '1');
    ensureModal();
    paintHosts();
    document.addEventListener('click', function (event) {
      var target = event.target;
      var button = target && target.closest ? target.closest('.intro-play') : null;
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      openFrom(button);
    }, true);
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      var modal = document.getElementById('intro-modal');
      if (!modal || modal.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    }, true);
  }

  if (doc()) {
    if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', boot);
    else boot();
  }

  return {
    CLIPS: CLIPS,
    src: src,
    buttonHtml: buttonHtml,
    paintHosts: paintHosts,
    openFrom: openFrom,
    close: close,
    boot: boot
  };
});
