/*
 * Film auf der Partnerseite: Hochformat auf schmalen Hochkant-Bildschirmen,
 * sonst 16:9. Ton bleibt aus, bis jemand auf "Ton an" tippt.
 */
(function (root) {
  'use strict';

  var TALL = '(max-width: 760px) and (orientation: portrait)';

  function captureFrom(value) {
    var ref = '';
    if (!value) return;
    var text = String(value);
    if (text.indexOf('http') !== 0 && text.indexOf('?') !== 0 && text.indexOf('/') !== 0) ref = text;
    else {
      try { ref = new URL(text, 'https://spiel-freunde.com').searchParams.get('ref') || ''; }
      catch (err) { ref = ''; }
    }
    if (!ref || ref.length > 80 || !/^[A-Za-z0-9_-]+$/.test(ref)) return;
    if (!root.SpielpartnerEntitlement || !root.localStorage) return;
    try { root.SpielpartnerEntitlement.captureRef(root.localStorage, Date.now(), '?ref=' + ref); }
    catch (err) { /* Speicher gesperrt */ }
  }

  function chooseSource(video) {
    var tall = false;
    try { tall = root.matchMedia(TALL).matches; }
    catch (err) { tall = false; }
    var frame = video.closest ? video.closest('.lead-frame') : null;
    if (frame) frame.classList.toggle('is-tall', tall);
    var next = tall ? video.getAttribute('data-tall') : video.getAttribute('data-wide');
    if (next && video.getAttribute('src') !== next) video.setAttribute('src', next);
  }

  function boot(scope) {
    var base = scope || root.document;
    var video = base.querySelector ? base.querySelector('#lead-video') : null;
    if (!video) return;
    chooseSource(video);
    video.muted = true;
    video.defaultMuted = true;
    video.setAttribute('muted', '');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    var sound = base.querySelector('#lead-sound');
    function enable() {
      video.muted = false;
      video.volume = 1;
      var pending = video.play();
      if (pending && pending.catch) pending.catch(function () {});
      if (sound) sound.hidden = true;
    }
    if (sound && !sound.dataset.wired) {
      sound.dataset.wired = '1';
      sound.addEventListener('click', enable);
    }
    video.addEventListener('volumechange', function () {
      if (!video.muted && video.volume > 0 && sound) sound.hidden = true;
    });
    var reduce = false;
    try { reduce = root.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (err) { reduce = false; }
    if (!reduce) {
      var pending = video.play();
      if (pending && pending.catch) pending.catch(function () {});
    }
    var query;
    try { query = root.matchMedia(TALL); }
    catch (err) { query = null; }
    if (query && query.addEventListener && !video.dataset.oriented) {
      video.dataset.oriented = '1';
      query.addEventListener('change', function () {
        var time = video.currentTime || 0;
        var playing = !video.paused && !video.ended;
        var unmuted = !video.muted;
        chooseSource(video);
        function resume() {
          video.removeEventListener('loadedmetadata', resume);
          if (time > 0.2) {
            try { video.currentTime = time; } catch (err) { /* noch nicht bereit */ }
          }
          if (unmuted) video.muted = false;
          if (playing || unmuted) {
            var again = video.play();
            if (again && again.catch) again.catch(function () {});
          }
        }
        if (video.getAttribute('src')) video.addEventListener('loadedmetadata', resume);
      });
    }
  }

  function bootPage() {
    var body = root.document && root.document.body;
    if (body && body.getAttribute('data-partner-ref')) captureFrom(body.getAttribute('data-partner-ref'));
    if (root.document.getElementById('partner-fallback')) return;
    boot(root.document);
  }

  root.SpielFreundeLead = { boot: boot, captureFrom: captureFrom, chooseSource: chooseSource };

  if (!root.document) return;
  if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', bootPage);
  else bootPage();
})(typeof window !== 'undefined' ? window : globalThis);
