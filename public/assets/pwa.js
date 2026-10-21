/* Als App installieren.
   Chrome und Edge bekommen den Knopf, sobald der Browser ihn anbietet.
   Auf dem iPad und dem iPhone zeigt Safari keinen solchen Knopf.
   Dort reicht ein kleiner Hinweis, einmal, und nur solange die Seite
   im Browser läuft. */
(function () {
  var KEY = 'sf-pwa-dismissed';
  var SHARE = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3.5v9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8.2 7.2 12 3.4l3.8 3.8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10.5H6a2 2 0 0 0-2 2v6.2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6.2a2 2 0 0 0-2-2h-1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  var PLUS = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.2v7.6M8.2 12h7.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  function installed() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches
        || window.matchMedia('(display-mode: fullscreen)').matches
        || window.navigator.standalone === true;
    } catch (err) {
      return false;
    }
  }

  function dismissed() {
    try { return localStorage.getItem(KEY) === '1'; }
    catch (err) { return false; }
  }

  function remember() {
    try { localStorage.setItem(KEY, '1'); }
    catch (err) { /* ohne Speicher einfach nur schließen */ }
  }

  function ios() {
    var ua = navigator.userAgent || '';
    if (/iPad|iPhone|iPod/.test(ua)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  }

  function deviceName() {
    return /iPhone|iPod/.test(navigator.userAgent || '') ? 'iPhone' : 'iPad';
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  }

  if (installed()) {
    document.documentElement.classList.add('sf-standalone');
    document.documentElement.dataset.sfPwa = 'standalone';
    return;
  }
  if (dismissed()) {
    document.documentElement.dataset.sfPwa = 'dismissed';
    return;
  }

  var deferred = null;
  var root = null;

  function close() {
    remember();
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null;
    document.documentElement.dataset.sfPwa = 'dismissed';
  }

  function laterButton() {
    var later = document.createElement('button');
    later.type = 'button';
    later.className = 'sf-pwa-later';
    later.textContent = 'Nicht jetzt';
    later.addEventListener('click', close);
    return later;
  }

  function mount(el) {
    var side = document.querySelector('.sidebar');
    if (side && document.querySelector('.tabletop')) {
      el.classList.add('sf-pwa-inline');
      side.insertBefore(el, side.firstChild);
      return;
    }
    el.classList.add('sf-pwa-float');
    document.body.appendChild(el);
  }

  function showButton() {
    if (root || installed() || dismissed()) return;
    root = document.createElement('div');
    root.id = 'sf-pwa';
    root.className = 'sf-pwa sf-pwa-bar';
    var install = document.createElement('button');
    install.type = 'button';
    install.className = 'sf-pwa-install';
    install.textContent = 'Als App installieren';
    install.addEventListener('click', function () {
      if (!deferred) return;
      var prompt = deferred;
      deferred = null;
      Promise.resolve(prompt.prompt()).then(function () {
        return prompt.userChoice;
      }).then(close, close);
    });
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'sf-pwa-x';
    x.setAttribute('aria-label', 'Hinweis schließen');
    x.textContent = '×';
    x.addEventListener('click', close);
    root.appendChild(install);
    root.appendChild(laterButton());
    root.appendChild(x);
    mount(root);
    document.documentElement.dataset.sfPwa = 'install';
  }

  function showHint() {
    if (root || installed() || dismissed()) return;
    var name = deviceName();
    root = document.createElement('aside');
    root.id = 'sf-pwa';
    root.className = 'sf-pwa';
    root.setAttribute('aria-label', 'Spiel-Freunde als App');
    root.innerHTML = ''
      + '<p class="sf-pwa-title">So hast Du Spiel-Freunde als App auf Deinem ' + name + '</p>'
      + '<ol class="sf-pwa-steps">'
      + '<li><span class="sf-pwa-ico">' + SHARE + '</span><span>Tippe auf <b>Teilen</b></span></li>'
      + '<li><span class="sf-pwa-ico">' + PLUS + '</span><span>dann auf <b>Zum Home-Bildschirm</b></span></li>'
      + '</ol>';
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'sf-pwa-x';
    x.setAttribute('aria-label', 'Hinweis schließen');
    x.textContent = '×';
    x.addEventListener('click', close);
    var actions = document.createElement('div');
    actions.className = 'sf-pwa-actions';
    actions.appendChild(laterButton());
    root.appendChild(x);
    root.appendChild(actions);
    mount(root);
    document.documentElement.dataset.sfPwa = 'hint';
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    if (ios()) return;
    deferred = event;
    showButton();
  });

  window.addEventListener('appinstalled', function () {
    deferred = null;
    close();
  });

  if (ios()) showHint();
  document.documentElement.dataset.sfPwa = document.documentElement.dataset.sfPwa || 'ready';
})();
