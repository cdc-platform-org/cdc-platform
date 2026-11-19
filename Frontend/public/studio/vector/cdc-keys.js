/*
 * CDC Vector Studio: Illustrator-style single-key shortcuts on top of SVG-Edit.
 * SVG-Edit's own map differs (R = rectangle, E = ellipse, L = line, Q = pencil);
 * designers expect V/A/P/M/L/T/N/\/I/Z/H, so those keys are taken over here
 * (capture phase) and every tool tooltip shows the new key.
 *   V select · A direct selection (edit path nodes) · P pen (bezier path)
 *   M rectangle · L ellipse · \ line · N pencil · T text · I eyedropper
 *   Z zoom · H hand (pan) · Shift+M square · Shift+L circle · S star
 */
(function () {
  'use strict';

  var MAP = {
    v: 'tool_select', p: 'tool_path', m: 'tool_rect', M: 'tool_square', l: 'tool_ellipse',
    L: 'tool_circle', '\\': 'tool_line', n: 'tool_fhpath', t: 'tool_text', i: 'tool_eyedropper',
    z: 'tool_zoom', h: 'ext-panning', s: 'tool_star',
  };
  var LABEL = {
    tool_select: 'V', tool_path: 'P', tool_rect: 'M', tool_square: 'Shift+M', tool_ellipse: 'L',
    tool_circle: 'Shift+L', tool_line: '\\', tool_fhpath: 'N', tool_text: 'T', tool_eyedropper: 'I',
    tool_zoom: 'Z', 'ext-panning': 'H', tool_star: 'S',
  };

  function editor() { return window.svgEditor; }

  function pick(id) {
    var el = document.getElementById(id);
    if (el) { el.click(); return true; }
    return false;
  }

  function directSelect() {
    // Illustrator's Direct Selection = SVG-Edit's node editing on the selected path.
    var ed = editor();
    var c = ed && ed.svgCanvas;
    if (!c) return;
    var sel = c.getSelectedElements().filter(Boolean)[0];
    if (sel && sel.tagName === 'path' && c.pathActions && c.pathActions.toEditMode) {
      c.pathActions.toEditMode(sel);
    } else if (sel && c.convertToPath && /^(rect|ellipse|circle|line|polygon|polyline)$/.test(sel.tagName)) {
      var path = c.convertToPath(sel);
      if (path && c.pathActions && c.pathActions.toEditMode) c.pathActions.toEditMode(path);
    } else {
      pick('tool_select');
    }
  }

  function onKey(e) {
    var target = e.target;
    var tag = (target && target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (target && target.isContentEditable)) return;
    // Typing into a text element on the canvas.
    var ed = editor();
    if (ed && ed.svgCanvas && ed.svgCanvas.getMode && ed.svgCanvas.getMode() === 'textedit') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var key = e.key;
    if (key === 'a' || key === 'A') { e.preventDefault(); e.stopImmediatePropagation(); directSelect(); return; }
    var id = MAP[key] || MAP[key.toLowerCase()];
    if (e.shiftKey && MAP[key.toUpperCase()]) id = MAP[key.toUpperCase()];
    if (!id) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    pick(id);
  }

  function labelTooltips() {
    Object.keys(LABEL).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.setAttribute('shortcut', LABEL[id]);
    });
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var ed = editor();
    if ((ed && ed.isReady && document.getElementById('tool_path')) || tries > 300) {
      clearInterval(timer);
      labelTooltips();
      setTimeout(labelTooltips, 1500); // extensions add their buttons a little later
    }
  }, 100);

  window.addEventListener('keydown', onKey, true);
})();
