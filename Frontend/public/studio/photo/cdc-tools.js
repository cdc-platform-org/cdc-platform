/*
 * CDC Photo Studio tools (runs inside the miniPaint iframe, after cdc-bridge.js).
 *
 * miniPaint has no Pen or Lasso tool and uses its own keyboard map, so this
 * file adds, without rebuilding miniPaint's bundle:
 *   - Pen tool (P): click for corners, drag for bezier curves, click the first
 *     point to close; Enter / double-click finishes, Esc cancels, Backspace
 *     removes the last point.
 *   - Lasso tool (L): drag a freehand outline.
 *   - Path actions after either tool: Fill, Stroke (current colour and brush
 *     size), Copy to new layer (cut-out, Photoshop "Layer via Copy").
 *   - Photoshop-style single-key shortcuts for the built-in tools.
 * Results are inserted as new image layers through window.Layers, so undo,
 * layer panel and export keep working as usual.
 */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var lang = (params.get('cdcLang') || params.get('lang') || 'en').replace(/[^a-z]/gi, '');

  var TEXT = {
    en: { pen: 'Pen Tool (P)', lasso: 'Lasso Tool (L)', fill: 'Fill path', stroke: 'Stroke path', copy: 'Copy to new layer', cancel: 'Cancel', hintPen: 'Click to add points, drag for curves. Click the first point to close. Enter = finish, Esc = cancel.', hintLasso: 'Drag around the area to select it.', layerFill: 'Pen fill', layerStroke: 'Pen stroke', layerCopy: 'Cut-out' },
    ka: { pen: 'კალამი (P)', lasso: 'ლასო (L)', fill: 'კონტურის შევსება', stroke: 'კონტურის მოხაზვა', copy: 'ახალ ფენაზე კოპირება', cancel: 'გაუქმება', hintPen: 'დააწკაპეთ წერტილების დასამატებლად, გადაათრიეთ მრუდისთვის. დასახურად დააწკაპეთ პირველ წერტილზე. Enter = დასრულება, Esc = გაუქმება.', hintLasso: 'მონიშვნისთვის შემოხაზეთ არე.', layerFill: 'კალმის შევსება', layerStroke: 'კალმის კონტური', layerCopy: 'ამოჭრილი' },
    de: { pen: 'Zeichenstift (P)', lasso: 'Lasso (L)', fill: 'Pfad füllen', stroke: 'Pfadkontur', copy: 'Auf neue Ebene kopieren', cancel: 'Abbrechen', hintPen: 'Klicken für Punkte, ziehen für Kurven. Ersten Punkt anklicken zum Schließen. Enter = fertig, Esc = abbrechen.', hintLasso: 'Bereich umfahren, um ihn auszuwählen.', layerFill: 'Pfadfüllung', layerStroke: 'Pfadkontur', layerCopy: 'Freisteller' },
    es: { pen: 'Pluma (P)', lasso: 'Lazo (L)', fill: 'Rellenar trazado', stroke: 'Contornear trazado', copy: 'Copiar a capa nueva', cancel: 'Cancelar', hintPen: 'Haz clic para añadir puntos, arrastra para curvas. Clic en el primer punto para cerrar. Enter = terminar, Esc = cancelar.', hintLasso: 'Arrastra alrededor del área para seleccionarla.', layerFill: 'Relleno', layerStroke: 'Contorno', layerCopy: 'Recorte' },
    fr: { pen: 'Plume (P)', lasso: 'Lasso (L)', fill: 'Remplir le tracé', stroke: 'Contour du tracé', copy: 'Copier sur un nouveau calque', cancel: 'Annuler', hintPen: 'Cliquez pour ajouter des points, faites glisser pour les courbes. Cliquez sur le premier point pour fermer. Entrée = terminer, Échap = annuler.', hintLasso: 'Faites glisser autour de la zone pour la sélectionner.', layerFill: 'Remplissage', layerStroke: 'Contour', layerCopy: 'Détourage' },
    uk: { pen: 'Перо (P)', lasso: 'Ласо (L)', fill: 'Заповнити контур', stroke: 'Обвести контур', copy: 'Копіювати на новий шар', cancel: 'Скасувати', hintPen: 'Клацайте, щоб додати точки, тягніть для кривих. Клацніть першу точку, щоб замкнути. Enter = завершити, Esc = скасувати.', hintLasso: 'Обведіть область, щоб виділити її.', layerFill: 'Заливка пера', layerStroke: 'Обведення пера', layerCopy: 'Вирізка' },
    tr: { pen: 'Kalem (P)', lasso: 'Kement (L)', fill: 'Yolu doldur', stroke: 'Yolu kontur çiz', copy: 'Yeni katmana kopyala', cancel: 'İptal', hintPen: 'Nokta eklemek için tıklayın, eğri için sürükleyin. Kapatmak için ilk noktaya tıklayın. Enter = bitir, Esc = iptal.', hintLasso: 'Seçmek için alanın etrafını çizin.', layerFill: 'Kalem dolgusu', layerStroke: 'Kalem konturu', layerCopy: 'Kesim' },
    hy: { pen: 'Գրիչ (P)', lasso: 'Լասո (L)', fill: 'Լցնել ուղին', stroke: 'Եզրագծել ուղին', copy: 'Պատճենել նոր շերտում', cancel: 'Չեղարկել', hintPen: 'Սեղմեք կետեր ավելացնելու համար, քաշեք կորերի համար։ Փակելու համար սեղմեք առաջին կետին։ Enter = ավարտել, Esc = չեղարկել։', hintLasso: 'Շրջագծեք տարածքը՝ այն ընտրելու համար։', layerFill: 'Գրիչի լցում', layerStroke: 'Գրիչի եզրագիծ', layerCopy: 'Կտրվածք' },
    az: { pen: 'Qələm (P)', lasso: 'Lasso (L)', fill: 'Yolu doldur', stroke: 'Yolun konturu', copy: 'Yeni təbəqəyə kopyala', cancel: 'Ləğv et', hintPen: 'Nöqtə əlavə etmək üçün klikləyin, əyri üçün sürükləyin. Bağlamaq üçün ilk nöqtəyə klikləyin. Enter = bitir, Esc = ləğv et.', hintLasso: 'Seçmək üçün sahənin ətrafını çəkin.', layerFill: 'Qələm dolğusu', layerStroke: 'Qələm konturu', layerCopy: 'Kəsik' },
  };
  var t = TEXT[lang] || TEXT.en;

  // Photoshop single-key shortcuts -> miniPaint tool ids (or our own tools).
  var KEYMAP = {
    v: 'select', m: 'selection', l: 'cdc_lasso', p: 'cdc_pen', b: 'brush', n: 'pencil',
    e: 'erase', w: 'magic_erase', i: 'pick_color', g: 'fill', G: 'gradient', t: 'text',
    c: 'crop', s: 'clone', u: 'rectangle', U: 'ellipse', r: 'blur', o: 'sharpen',
  };
  var SHORTCUT_LABEL = { select: 'V', selection: 'M', brush: 'B', pencil: 'N', erase: 'E', magic_erase: 'W', pick_color: 'I', fill: 'G', gradient: 'Shift+G', text: 'T', crop: 'C', clone: 'S', blur: 'R', sharpen: 'O', shape: 'U' };

  var PEN_ICON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e8e8ec' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 19l7-7 3 3-7 7-3-3z'/%3E%3Cpath d='M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z'/%3E%3Cpath d='M2 2l7.586 7.586'/%3E%3Ccircle cx='11' cy='11' r='2'/%3E%3C/svg%3E\")";
  var LASSO_ICON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e8e8ec' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cellipse cx='12' cy='9' rx='9' ry='6' stroke-dasharray='3 2'/%3E%3Cpath d='M6 13.5c-1 2 0 4 2 4.5 1.5.4 2 1.6 1.2 3'/%3E%3C/svg%3E\")";

  var state = { tool: null, points: [], closed: false, dragging: false, overlay: null, bar: null, hint: null };

  function ready(fn) {
    var n = 0;
    var timer = setInterval(function () {
      n++;
      if ((window.Layers && window.AppConfig && document.getElementById('tools_container') && document.getElementById('select')) || n > 300) {
        clearInterval(timer);
        if (window.Layers) fn();
      }
    }, 100);
  }

  // ---------- coordinates (miniPaint zoom/pan) ----------

  function mainCanvas() { return document.getElementById('canvas_minipaint'); }

  function toWorld(clientX, clientY) {
    var r = mainCanvas().getBoundingClientRect();
    return window.Layers.get_world_coords(clientX - r.left, clientY - r.top);
  }

  function toScreen(p) {
    // Invert the (scale + translate) world transform by sampling two points.
    var a = window.Layers.get_world_coords(0, 0);
    var b = window.Layers.get_world_coords(100, 100);
    var sx = (b.x - a.x) / 100 || 1;
    var sy = (b.y - a.y) / 100 || 1;
    var r = mainCanvas().getBoundingClientRect();
    return { x: r.left + (p.x - a.x) / sx, y: r.top + (p.y - a.y) / sy };
  }

  // ---------- overlay ----------

  function ensureOverlay() {
    if (state.overlay) return state.overlay;
    var c = document.createElement('canvas');
    c.id = 'cdc_path_overlay';
    c.style.cssText = 'position:fixed;left:0;top:0;z-index:50;cursor:crosshair;touch-action:none;';
    document.body.appendChild(c);
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('dblclick', function (e) { e.preventDefault(); if (state.tool === 'pen' && state.points.length > 1) finish(false); });
    c.addEventListener('wheel', function (e) {
      // Let zoom/scroll reach miniPaint underneath.
      c.style.pointerEvents = 'none';
      var under = document.elementFromPoint(e.clientX, e.clientY);
      c.style.pointerEvents = '';
      if (under) under.dispatchEvent(new WheelEvent('wheel', e));
      e.preventDefault();
      setTimeout(draw, 30);
    }, { passive: false });
    state.overlay = c;
    window.addEventListener('resize', layoutOverlay);
    return c;
  }

  function layoutOverlay() {
    var c = state.overlay;
    if (!c) return;
    var area = document.getElementById('main_wrapper') || mainCanvas();
    var r = area.getBoundingClientRect();
    c.style.left = r.left + 'px';
    c.style.top = r.top + 'px';
    c.style.width = r.width + 'px';
    c.style.height = r.height + 'px';
    c.width = Math.round(r.width * devicePixelRatio);
    c.height = Math.round(r.height * devicePixelRatio);
    c.dataset.left = r.left;
    c.dataset.top = r.top;
    draw();
  }

  function buildPath(ctx, pts, closed, map) {
    if (!pts.length) return;
    var first = map(pts[0]);
    ctx.moveTo(first.x, first.y);
    for (var i = 1; i < pts.length; i++) segment(ctx, pts[i - 1], pts[i], map);
    if (closed && pts.length > 2) { segment(ctx, pts[pts.length - 1], pts[0], map); ctx.closePath(); }
  }

  function segment(ctx, a, b, map) {
    var c1 = map(a.out || a), c2 = map(b.in || b), e = map(b);
    if (a.out || b.in) ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y);
    else ctx.lineTo(e.x, e.y);
  }

  function draw() {
    var c = state.overlay;
    if (!c) return;
    var ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    if (!state.points.length) return;
    var ox = parseFloat(c.dataset.left) || 0, oy = parseFloat(c.dataset.top) || 0;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    var map = function (p) { var s = toScreen(p); return { x: s.x - ox, y: s.y - oy }; };
    ctx.beginPath();
    buildPath(ctx, state.points, state.closed, map);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#22d3ee';
    ctx.stroke();
    if (state.closed) { ctx.fillStyle = 'rgba(34,211,238,0.12)'; ctx.fill(); }
    if (state.tool !== 'pen') return;
    state.points.forEach(function (p, i) {
      var s = map(p);
      ['in', 'out'].forEach(function (k) {
        if (!p[k]) return;
        var h = map(p[k]);
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(h.x, h.y); ctx.strokeStyle = 'rgba(232,232,236,0.7)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.beginPath(); ctx.arc(h.x, h.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#e8e8ec'; ctx.fill();
      });
      ctx.beginPath(); ctx.rect(s.x - 4, s.y - 4, 8, 8);
      ctx.fillStyle = i === 0 ? '#22d3ee' : '#1e1e21'; ctx.fill();
      ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }

  // ---------- pointer handling ----------

  function nearFirst(e) {
    if (state.points.length < 3) return false;
    var s = toScreen(state.points[0]);
    return Math.hypot(s.x - e.clientX, s.y - e.clientY) < 9;
  }

  function onDown(e) {
    if (state.closed) return;
    e.preventDefault();
    state.overlay.setPointerCapture(e.pointerId);
    var w = toWorld(e.clientX, e.clientY);
    if (state.tool === 'lasso') {
      state.points = [{ x: w.x, y: w.y }];
      state.dragging = true;
    } else {
      if (nearFirst(e)) { finish(true); return; }
      state.points.push({ x: w.x, y: w.y, in: null, out: null });
      state.dragging = true;
    }
    draw();
  }

  function onMove(e) {
    if (!state.dragging) return;
    var w = toWorld(e.clientX, e.clientY);
    if (state.tool === 'lasso') {
      var last = state.points[state.points.length - 1];
      if (Math.hypot(last.x - w.x, last.y - w.y) > 1.5) state.points.push({ x: w.x, y: w.y });
    } else {
      // Dragging pulls symmetric bezier handles out of the new anchor.
      var p = state.points[state.points.length - 1];
      p.out = { x: w.x, y: w.y };
      p.in = { x: 2 * p.x - w.x, y: 2 * p.y - w.y };
      if (Math.hypot(w.x - p.x, w.y - p.y) < 2) { p.in = null; p.out = null; }
    }
    draw();
  }

  function onUp() {
    if (!state.dragging) return;
    state.dragging = false;
    if (state.tool === 'lasso') {
      if (state.points.length > 2) finish(true); else reset();
    }
  }

  // ---------- path actions ----------

  function finish(closed) {
    state.closed = closed;
    state.dragging = false;
    draw();
    showBar();
  }

  function reset() {
    state.points = [];
    state.closed = false;
    state.dragging = false;
    if (state.bar) state.bar.style.display = 'none';
    draw();
  }

  function docCanvas() {
    var d = window.Layers.get_dimensions();
    var c = document.createElement('canvas');
    c.width = d.width; c.height = d.height;
    return c;
  }

  function currentColor() { return (window.AppConfig && window.AppConfig.COLOR) || '#000000'; }
  function brushSize() {
    var brush = (window.AppConfig.TOOLS || []).filter(function (x) { return x.name === 'brush'; })[0];
    var size = brush && brush.attributes && brush.attributes.size;
    return Math.max(1, Number(size && size.value != null ? size.value : size) || 4);
  }

  function insertCanvas(canvas, name) {
    var img = new Image();
    img.onload = function () {
      window.Layers.insert({ name: name, type: 'image', data: img, x: 0, y: 0, width: canvas.width, height: canvas.height, width_original: canvas.width, height_original: canvas.height });
    };
    img.src = canvas.toDataURL('image/png');
  }

  var identity = function (p) { return p; };

  function apply(action) {
    var pts = state.points, closed = state.closed;
    if (pts.length < 2) return reset();
    var c = docCanvas(), ctx = c.getContext('2d');
    if (action === 'copy') {
      var layer = window.AppConfig.layer;
      if (!layer) return reset();
      ctx.save();
      ctx.beginPath(); buildPath(ctx, pts, true, identity); ctx.clip();
      window.Layers.convert_layers_to_canvas(ctx, layer.id, false);
      ctx.restore();
      insertCanvas(c, t.layerCopy);
    } else {
      ctx.beginPath(); buildPath(ctx, pts, closed || action === 'fill', identity);
      if (action === 'fill') { ctx.fillStyle = currentColor(); ctx.fill(); insertCanvas(c, t.layerFill); }
      else { ctx.strokeStyle = currentColor(); ctx.lineWidth = brushSize(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); insertCanvas(c, t.layerStroke); }
    }
    reset();
  }

  function showBar() {
    if (!state.bar) {
      var bar = document.createElement('div');
      bar.id = 'cdc_path_bar';
      bar.style.cssText = 'position:fixed;z-index:60;display:none;gap:6px;padding:6px;border-radius:8px;background:#19191c;border:1px solid #3f3f46;box-shadow:0 8px 24px rgba(0,0,0,.45);font:13px Inter,Segoe UI,system-ui,sans-serif;';
      [['fill', t.fill], ['stroke', t.stroke], ['copy', t.copy], ['cancel', t.cancel]].forEach(function (b) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = b[1];
        btn.dataset.action = b[0];
        btn.style.cssText = 'border:0;border-radius:6px;padding:6px 10px;cursor:pointer;color:' + (b[0] === 'cancel' ? '#e8e8ec;background:#3a3a40' : '#0b2530;background:#22d3ee') + ';';
        btn.addEventListener('click', function () { if (b[0] === 'cancel') reset(); else apply(b[0]); });
        bar.appendChild(btn);
      });
      document.body.appendChild(bar);
      state.bar = bar;
    }
    var area = (document.getElementById('main_wrapper') || mainCanvas()).getBoundingClientRect();
    state.bar.style.left = Math.round(area.left + 12) + 'px';
    state.bar.style.top = Math.round(area.top + 12) + 'px';
    state.bar.style.display = 'flex';
  }

  function showHint(text) {
    if (!state.hint) {
      state.hint = document.createElement('div');
      state.hint.style.cssText = 'position:fixed;z-index:55;bottom:14px;left:50%;transform:translateX(-50%);max-width:80%;padding:6px 12px;border-radius:6px;background:rgba(0,0,0,.75);color:#e8e8ec;font:12px Inter,Segoe UI,system-ui,sans-serif;pointer-events:none;';
      document.body.appendChild(state.hint);
    }
    state.hint.textContent = text;
    state.hint.style.display = text ? 'block' : 'none';
  }

  // ---------- tool switching ----------

  function activateOwn(tool) {
    state.tool = tool;
    reset();
    var c = ensureOverlay();
    c.style.display = 'block';
    layoutOverlay();
    document.querySelectorAll('#tools_container .item').forEach(function (el) { el.classList.remove('active'); });
    var btn = document.getElementById(tool === 'pen' ? 'cdc_pen' : 'cdc_lasso');
    if (btn) btn.classList.add('active');
    showHint(tool === 'pen' ? t.hintPen : t.hintLasso);
  }

  function deactivateOwn() {
    if (!state.tool) return;
    state.tool = null;
    reset();
    if (state.overlay) state.overlay.style.display = 'none';
    ['cdc_pen', 'cdc_lasso'].forEach(function (id) { var el = document.getElementById(id); if (el) el.classList.remove('active'); });
    showHint('');
  }

  function activate(id) {
    if (id === 'cdc_pen') return activateOwn('pen');
    if (id === 'cdc_lasso') return activateOwn('lasso');
    deactivateOwn();
    var el = document.getElementById(id);
    if (el) el.click();
  }

  function addToolButtons() {
    var anchor = document.getElementById('selection');
    if (!anchor || document.getElementById('cdc_pen')) return;
    [['cdc_lasso', t.lasso, LASSO_ICON], ['cdc_pen', t.pen, PEN_ICON]].forEach(function (def) {
      var span = document.createElement('span');
      span.id = def[0];
      span.className = 'item cdc-tool';
      span.title = def[1];
      span.style.backgroundImage = def[2];
      span.style.backgroundRepeat = 'no-repeat';
      span.style.backgroundPosition = 'center';
      span.style.backgroundSize = '20px 20px';
      span.addEventListener('click', function (e) { e.stopPropagation(); activate(def[0]); });
      anchor.parentNode.insertBefore(span, anchor.nextSibling);
    });
    // Built-in tools: leaving our tools when one of them is clicked.
    document.getElementById('tools_container').addEventListener('click', function (e) {
      var item = e.target.closest && e.target.closest('.item');
      if (item && !item.classList.contains('cdc-tool')) deactivateOwn();
    }, true);
    // Photoshop-style shortcut hints in tooltips.
    Object.keys(SHORTCUT_LABEL).forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.title && el.title.indexOf('(') === -1) el.title = el.title + ' (' + SHORTCUT_LABEL[id] + ')';
    });
  }

  function onKey(e) {
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
    if (state.tool && state.points.length) {
      if (e.key === 'Escape') { reset(); e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.key === 'Enter' && state.tool === 'pen' && state.points.length > 1 && !state.closed) { finish(false); e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (e.key === 'Backspace' && state.tool === 'pen' && !state.closed) { state.points.pop(); draw(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var key = e.shiftKey ? e.key.toUpperCase() : e.key.toLowerCase();
    var target = KEYMAP[key] || (e.shiftKey ? null : KEYMAP[e.key]);
    if (!target) return;
    // Our map wins over miniPaint's own single-key actions (e.g. S = export).
    e.preventDefault();
    e.stopImmediatePropagation();
    activate(target);
  }

  ready(function () {
    addToolButtons();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', function () { if (state.tool) layoutOverlay(); });
    // Keep the outline glued to the image while miniPaint zooms/scrolls.
    setInterval(function () { if (state.tool && state.points.length) layoutOverlay(); }, 400);
  });
})();
