/*
 * Kurzlebiger Hinweis nach einem ungültigen Zug.
 * show() zeigt den Text und blendet ihn nach 2500 ms wieder aus.
 * sync() löscht ihn, sobald sich der Spielstand geändert hat
 * (gültiges Legen, Ziehen, Zugwechsel, neue Runde).
 * clear() löscht sofort. hold() lässt den Text stehen, solange er gilt.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HintNote = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MS = 2500;

  function create(opts) {
    opts = opts || {};
    var getBox = typeof opts.box === 'function' ? opts.box : function () { return null; };
    var tokenOf = typeof opts.token === 'function' ? opts.token : function () { return ''; };
    var schedule = opts.schedule || function (fn, ms) { return setTimeout(fn, ms); };
    var cancel = opts.cancel || function (id) { clearTimeout(id); };
    var wait = opts.ms == null ? MS : opts.ms;
    var text = '';
    var mark = '';
    var timer = null;

    function box() {
      try { return getBox() || null; }
      catch (err) { return null; }
    }
    function unshake(el) {
      if (el && el.classList) el.classList.remove('shake');
    }
    function show(message) {
      text = message == null ? '' : String(message);
      mark = String(tokenOf());
      var el = box();
      if (el) {
        el.hidden = false;
        el.textContent = text;
        if (el.classList) {
          el.classList.remove('shake');
          if (typeof el.offsetWidth === 'number') void el.offsetWidth;
          el.classList.add('shake');
        }
      }
      if (timer) cancel(timer);
      var shown = text;
      var stamped = mark;
      timer = schedule(function () {
        if (text !== shown || mark !== stamped) return;
        timer = null;
        text = '';
        mark = '';
        unshake(box());
        if (typeof opts.onExpire === 'function') opts.onExpire();
      }, wait);
      return text;
    }
    function clear() {
      var had = text !== '' || timer != null;
      text = '';
      mark = '';
      if (timer) {
        cancel(timer);
        timer = null;
      }
      unshake(box());
      return had;
    }
    function sync() {
      if (!text) return false;
      if (String(tokenOf()) === mark) return false;
      clear();
      return true;
    }
    function active() { return text; }
    function hold(el) {
      if (!text) return false;
      var node = el || box();
      if (node) {
        node.hidden = false;
        node.textContent = text;
      }
      return true;
    }

    return { show: show, clear: clear, sync: sync, active: active, hold: hold, MS: wait };
  }

  return { create: create, MS: MS };
});
