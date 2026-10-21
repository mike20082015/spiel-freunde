/* Text eines Memes in die Zwischenablage. Kein Modul, läuft im Browser. */
(function () {
  function labelOf(button) {
    return button.getAttribute('data-kit-label') || 'Text kopieren';
  }

  function mark(button) {
    button.textContent = 'Kopiert';
    window.setTimeout(function () {
      button.textContent = labelOf(button);
    }, 1600);
  }

  function fallback(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.left = '-999px';
    document.body.appendChild(area);
    area.select();
    var ok = false;
    try { ok = document.execCommand('copy'); }
    catch (err) { ok = false; }
    area.remove();
    return ok;
  }

  document.addEventListener('click', function (event) {
    var button = event.target.closest ? event.target.closest('[data-kit-copy]') : null;
    if (!button) return;
    var card = button.closest('.kit-card');
    var caption = card ? card.querySelector('.kit-caption') : null;
    var text = caption ? caption.innerText.replace(/\s+$/g, '') : '';
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { mark(button); }, function () {
        if (fallback(text)) mark(button);
      });
      return;
    }
    if (fallback(text)) mark(button);
  });
})();
