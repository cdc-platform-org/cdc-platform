/*
 * CDC Photo Studio bridge (runs inside the miniPaint iframe).
 *
 * miniPaint compiles its dictionaries into dist/bundle.js, so languages it does
 * not ship (Georgian, Ukrainian, Armenian, Azerbaijani) are applied here at
 * runtime instead of rebuilding the bundle: every English UI string that
 * appears in the DOM (menus, panels, popups, tooltips) is swapped for its
 * translation from i18n/<lang>.json, including nodes added later.
 *
 * It also hides menu entries that do not belong in CDC (third-party image
 * search with miniPaint's own API key, and the language switcher, because the
 * language follows the site), and tells the parent shell when it is ready.
 */
(function () {
  'use strict';

  if (window.parent !== window) document.documentElement.classList.add('cdc-embedded');

  var params = new URLSearchParams(location.search);
  var lang = (params.get('cdcLang') || '').replace(/[^a-z]/gi, '');
  var HIDDEN_MENU_ITEMS = ['Search Images', 'Language', 'Open Test Template', 'External'];
  var dict = null;

  function splitAffixes(text) {
    // Menu labels carry decorations ("Export...", "Width:") that are not part
    // of the dictionary key; translate the core and keep the decoration.
    var m = /^(\s*)(.*?)(\s*(?:\.\.\.|…|:)?\s*)$/.exec(text);
    return m ? { pre: m[1], core: m[2], post: m[3] } : { pre: '', core: text, post: '' };
  }

  function translateString(text) {
    if (!dict || !text) return null;
    var parts = splitAffixes(text);
    var hit = dict[parts.core] || dict[parts.core + ':'];
    if (!hit) return null;
    // Some dictionary values already end in ":" — never double it.
    if (/[:：]\s*$/.test(hit) && parts.post.indexOf(':') !== -1) hit = hit.replace(/[:：]\s*$/, '');
    return parts.pre + hit + parts.post;
  }

  function hideIfUnwanted(node, english) {
    if (HIDDEN_MENU_ITEMS.indexOf(english) === -1) return;
    var el = node.nodeType === 3 ? node.parentElement : node;
    var item = el && el.closest ? el.closest('li') : null;
    if (item) item.style.display = 'none';
  }

  function processText(node) {
    var original = node.nodeValue;
    if (!original || !original.trim()) return;
    var english = splitAffixes(original).core;
    hideIfUnwanted(node, english);
    var translated = translateString(original);
    if (translated && translated !== original) node.nodeValue = translated;
  }

  function processElement(el) {
    if (el.nodeType !== 1) return;
    ['title', 'placeholder', 'aria-label'].forEach(function (attr) {
      var v = el.getAttribute(attr);
      var t = v && translateString(v);
      if (t && t !== v) el.setAttribute(attr, t);
    });
  }

  function walk(root) {
    if (root.nodeType === 3) { processText(root); return; }
    if (root.nodeType !== 1) return;
    if (root.tagName === 'SCRIPT' || root.tagName === 'STYLE' || root.tagName === 'CANVAS') return;
    processElement(root);
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    var n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) processText(n);
      else processElement(n);
    }
  }

  function start() {
    walk(document.body);
    new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === 'characterData') processText(m.target);
        else if (m.type === 'attributes') processElement(m.target);
        else m.addedNodes.forEach(walk);
      });
    }).observe(document.body, {
      subtree: true, childList: true, characterData: true,
      attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'],
    });

    // Ready once miniPaint has exposed its API on window (main.js).
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if ((window.Layers && window.AppConfig) || tries > 200) {
        clearInterval(timer);
        // Photoshop-style defaults: black foreground colour on first open.
        // Going through the hex field keeps miniPaint's colour panel in sync.
        var hex = document.getElementById('color_hex');
        if (hex && window.AppConfig && window.AppConfig.COLOR === '#008000') {
          hex.value = '#000000';
          hex.dispatchEvent(new Event('input', { bubbles: true }));
          hex.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (window.parent !== window) {
          window.parent.postMessage({ source: 'cdc-photo', type: 'ready' }, location.origin);
        }
      }
    }, 100);
  }

  function boot() {
    if (!lang) { dict = null; start(); return; }
    fetch('i18n/' + lang + '.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { dict = d; })
      .catch(function () { dict = null; })
      .then(start);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
