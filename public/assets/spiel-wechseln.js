/* Spiel wechseln: vom Tisch zur Spieleliste.
   Solange noch niemand Platz genommen hat, geht es sofort.
   Läuft eine Runde, fragt der Tisch einmal nach, weil der Stand
   nur im Browser liegt. */
(function () {
  var HREF = '/#spiele';
  var ASK = 'Laufendes Spiel verlassen?';

  function running() {
    var intro = document.getElementById('intro');
    if (intro) return intro.hidden === true;
    var screen = document.body && document.body.getAttribute('data-screen');
    return screen === 'lobby' || screen === 'game';
  }

  function bind(link) {
    if (!link || link.getAttribute('data-bound') === '1') return;
    link.setAttribute('data-bound', '1');
    link.addEventListener('click', function (event) {
      if (!running()) return;
      var stay = typeof window.confirm === 'function' && window.confirm(ASK) === false;
      if (stay && event && event.preventDefault) event.preventDefault();
    });
  }

  function mount() {
    var actions = document.querySelector('.topbar .topbar-actions');
    if (!actions) return;
    var link = document.getElementById('btn-spiel-wechseln');
    if (!link) {
      link = document.createElement('a');
      link.className = 'tbtn tswitch';
      link.id = 'btn-spiel-wechseln';
      link.href = HREF;
      link.textContent = 'Spiel wechseln';
      actions.insertBefore(link, actions.firstChild);
    }
    bind(link);
  }

  function land() {
    if (location.hash !== '#spiele') return;
    var target = document.getElementById('spiele');
    if (!target) return;
    if (typeof window.__sfReleaseSpiele === 'function') window.__sfReleaseSpiele();
    var reduced = false;
    try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (err) { reduced = false; }
    window.scrollTo(0, 0);
    var go = function () {
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    };
    if (document.readyState === 'complete') requestAnimationFrame(go);
    else window.addEventListener('load', function () { requestAnimationFrame(go); });
  }

  if (document.querySelector('.topbar')) mount();
  land();
})();
