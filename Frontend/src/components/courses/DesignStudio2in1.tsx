import React, { useEffect, useRef, useState } from 'react';
import {
  MousePointer, PenTool, Square, Circle, Star, Type, Brush, Eraser,
  Pipette, Hand, ZoomIn, ZoomOut, Undo2, Redo2, Layers, Eye, EyeOff,
  Lock, Unlock, Trash2, Copy, Download, Upload, Grid, Sparkles,
  Image as ImageIcon, Sliders, Plus, ArrowUp, ArrowDown, FilePlus
} from 'lucide-react';

type AppMode = 'photoshop' | 'illustrator';
type ToolId =
  | 'select' | 'direct' | 'pen' | 'rect' | 'ellipse' | 'star' | 'line'
  | 'text' | 'brush' | 'eraser' | 'eyedropper' | 'hand';

type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay';

interface DesignElement {
  id: string;
  name: string;
  kind: 'rect' | 'ellipse' | 'star' | 'line' | 'text' | 'path' | 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  blendMode: BlendMode;
  visible: boolean;
  locked: boolean;
  // Text props
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  // Path / Brush points
  points?: { x: number; y: number }[];
  // Image props & Ps filters
  imageSrc?: string;
  brightness?: number;
  contrast?: number;
  saturate?: number;
  blur?: number;
  borderRadius?: number;
  shadow?: boolean;
}

interface ArtboardPreset {
  id: string;
  label: string;
  w: number;
  h: number;
}

const ARTBOARD_PRESETS: ArtboardPreset[] = [
  { id: 'ig', label: 'Instagram Post (1080×1080)', w: 600, h: 600 },
  { id: 'banner', label: 'Web Banner (1920×1080)', w: 800, h: 450 },
  { id: 'a4', label: 'A4 Poster (2480×3508)', w: 540, h: 760 },
  { id: 'logo', label: 'Logo Canvas (1000×1000)', w: 600, h: 600 },
];

const SWATCHES = [
  '#ffffff', '#0f172a', '#ef4444', '#f97316', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

export default function DesignStudio2in1({ lang = 'ka' }: { lang?: string }) {
  const isKa = lang === 'ka';
  const [appMode, setAppMode] = useState<AppMode>('illustrator');
  const [activeTool, setActiveTool] = useState<ToolId>('select');
  const [artboard, setArtboard] = useState<ArtboardPreset>(ARTBOARD_PRESETS[1]);
  const [artboardBg, setArtboardBg] = useState('#111827');
  const [showGrid, setShowGrid] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Foreground / Background colors (Photoshop & Illustrator standard)
  const [fgColor, setFgColor] = useState('#06b6d4');
  const [bgColor, setBgColor] = useState('#6366f1');
  const [brushSize, setBrushSize] = useState(8);
  const [strokeWidth, setStrokeWidth] = useState(2);

  // Layers / Elements + History stack
  const [elements, setElements] = useState<DesignElement[]>([
    {
      id: 'el-bg-shape',
      name: 'Background Card',
      kind: 'rect',
      x: 60, y: 55, w: 680, h: 340, rotation: 0,
      fill: '#1e1b4b', stroke: '#4f46e5', strokeWidth: 2,
      opacity: 1, blendMode: 'normal', visible: true, locked: false, borderRadius: 24, shadow: true,
    },
    {
      id: 'el-accent',
      name: 'Brand Orb',
      kind: 'ellipse',
      x: 500, y: 110, w: 180, h: 180, rotation: 0,
      fill: '#06b6d4', stroke: '#ffffff', strokeWidth: 0,
      opacity: 0.85, blendMode: 'screen', visible: true, locked: false,
    },
    {
      id: 'el-title',
      name: 'Headline Typography',
      kind: 'text',
      x: 105, y: 185, w: 420, h: 60, rotation: 0,
      fill: '#ffffff', stroke: 'none', strokeWidth: 0,
      opacity: 1, blendMode: 'normal', visible: true, locked: false,
      text: 'CDC CREATIVE STUDIO', fontSize: 34, fontFamily: 'sans-serif', fontWeight: '800',
    },
    {
      id: 'el-sub',
      name: 'Subtitle Layer',
      kind: 'text',
      x: 108, y: 245, w: 360, h: 36, rotation: 0,
      fill: '#94a3b8', stroke: 'none', strokeWidth: 0,
      opacity: 1, blendMode: 'normal', visible: true, locked: false,
      text: 'Vector & Raster Simulation Workspace', fontSize: 16, fontFamily: 'sans-serif', fontWeight: '500',
    },
  ]);

  const [history, setHistory] = useState<{ label: string; snapshot: DesignElement[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedId, setSelectedId] = useState<string | null>('el-title');
  const [rightTab, setRightTab] = useState<'properties' | 'layers' | 'history'>('properties');
  const [showNewModal, setShowNewModal] = useState(false);

  // Interactive drag / draw / pen states
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragState, setDragState] = useState<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const [currentStrokeId, setCurrentStrokeId] = useState<string | null>(null);
  const [penDraft, setPenDraft] = useState<{ x: number; y: number }[]>([]);

  const selected = elements.find((el) => el.id === selectedId) ?? null;

  const commitHistory = (label: string, nextElements: DesignElement[]) => {
    const sliced = history.slice(0, historyIndex + 1);
    const updated = [...sliced, { label, snapshot: nextElements }].slice(-25);
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
  };

  const updateElementsWithHistory = (label: string, updater: (prev: DesignElement[]) => DesignElement[]) => {
    setElements((prev) => {
      const next = updater(prev);
      commitHistory(label, next);
      return next;
    });
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const target = history[historyIndex - 1];
    setElements(target.snapshot);
    setHistoryIndex(historyIndex - 1);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const target = history[historyIndex + 1];
    setElements(target.snapshot);
    setHistoryIndex(historyIndex + 1);
  };

  // Keyboard shortcuts like real Ps / Ai
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
      if (k === 'delete' || k === 'backspace') {
        if (selectedId) {
          e.preventDefault();
          updateElementsWithHistory('Delete Layer', (prev) => prev.filter((item) => item.id !== selectedId));
          setSelectedId(null);
        }
        return;
      }
      if (k === 'v') setActiveTool('select');
      if (k === 'p') setActiveTool('pen');
      if (k === 'b') { setAppMode('photoshop'); setActiveTool('brush'); }
      if (k === 'e') { setAppMode('photoshop'); setActiveTool('eraser'); }
      if (k === 't') setActiveTool('text');
      if (k === 'm') setActiveTool('rect');
      if (k === 'l') setActiveTool('ellipse');
      if (k === 'i') setActiveTool('eyedropper');
      if (k === 'x') { setFgColor(bgColor); setBgColor(fgColor); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const getSvgCoords = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: Math.round(((e.clientX - rect.left) / rect.width) * artboard.w),
      y: Math.round(((e.clientY - rect.top) / rect.height) * artboard.h),
    };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    const { x, y } = getSvgCoords(e);

    if (activeTool === 'pen') {
      setPenDraft((prev) => [...prev, { x, y }]);
      return;
    }

    if (activeTool === 'brush' || activeTool === 'eraser') {
      const id = `brush-${Date.now()}`;
      const newStroke: DesignElement = {
        id,
        name: activeTool === 'eraser' ? 'Eraser Stroke' : `Brush Stroke ${elements.length + 1}`,
        kind: 'path',
        x: 0, y: 0, w: artboard.w, h: artboard.h, rotation: 0,
        fill: 'none',
        stroke: activeTool === 'eraser' ? artboardBg : fgColor,
        strokeWidth: brushSize,
        opacity: 1,
        blendMode: 'normal',
        visible: true,
        locked: false,
        points: [{ x, y }],
      };
      setElements((prev) => [...prev, newStroke]);
      setCurrentStrokeId(id);
      setSelectedId(id);
      return;
    }

    if (activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'star' || activeTool === 'line' || activeTool === 'text') {
      const id = `layer-${Date.now()}`;
      const newEl: DesignElement = {
        id,
        name: `${activeTool.toUpperCase()} ${elements.length + 1}`,
        kind: activeTool,
        x: Math.max(10, x - 60),
        y: Math.max(10, y - 40),
        w: activeTool === 'text' ? 240 : 130,
        h: activeTool === 'text' ? 44 : activeTool === 'line' ? 4 : 110,
        rotation: 0,
        fill: activeTool === 'line' ? 'none' : fgColor,
        stroke: activeTool === 'text' ? 'none' : bgColor,
        strokeWidth: activeTool === 'text' ? 0 : strokeWidth,
        opacity: 1,
        blendMode: 'normal',
        visible: true,
        locked: false,
        text: activeTool === 'text' ? (isKa ? 'ორჯერ დააკლიკე ტექსტს' : 'Edit Typography') : undefined,
        fontSize: 26,
        fontFamily: 'sans-serif',
        fontWeight: '700',
        borderRadius: activeTool === 'rect' ? 12 : 0,
      };
      updateElementsWithHistory(`Create ${activeTool}`, (prev) => [...prev, newEl]);
      setSelectedId(id);
      setActiveTool('select');
    }
  };

  const handleCanvasPointerMove = (e: React.PointerEvent) => {
    const { x, y } = getSvgCoords(e);

    if (currentStrokeId) {
      setElements((prev) =>
        prev.map((el) =>
          el.id === currentStrokeId ? { ...el, points: [...(el.points ?? []), { x, y }] } : el
        )
      );
      return;
    }

    if (dragState && selectedId) {
      const dx = x - dragState.startX;
      const dy = y - dragState.startY;
      setElements((prev) =>
        prev.map((el) => {
          if (el.id !== selectedId || el.locked) return el;
          if (dragState.mode === 'move') {
            return { ...el, x: dragState.origX + dx, y: dragState.origY + dy };
          }
          return {
            ...el,
            w: Math.max(20, dragState.origW + dx),
            h: Math.max(20, dragState.origH + dy),
          };
        })
      );
    }
  };

  const handleCanvasPointerUp = () => {
    if (currentStrokeId) {
      commitHistory('Brush Stroke', elements);
      setCurrentStrokeId(null);
    }
    if (dragState) {
      commitHistory(dragState.mode === 'move' ? 'Move Layer' : 'Transform Size', elements);
      setDragState(null);
    }
  };

  const finishPenPath = () => {
    if (penDraft.length < 2) { setPenDraft([]); return; }
    const id = `pen-${Date.now()}`;
    const newPath: DesignElement = {
      id,
      name: `Vector Path ${elements.length + 1}`,
      kind: 'path',
      x: 0, y: 0, w: artboard.w, h: artboard.h, rotation: 0,
      fill: 'none',
      stroke: fgColor,
      strokeWidth: strokeWidth || 3,
      opacity: 1,
      blendMode: 'normal',
      visible: true,
      locked: false,
      points: penDraft,
    };
    updateElementsWithHistory('Pen Vector Path', (prev) => [...prev, newPath]);
    setSelectedId(id);
    setPenDraft([]);
    setActiveTool('select');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const id = `img-${Date.now()}`;
      const imgEl: DesignElement = {
        id,
        name: file.name.slice(0, 22),
        kind: 'image',
        x: 80, y: 60, w: 320, h: 220, rotation: 0,
        fill: 'none', stroke: 'none', strokeWidth: 0,
        opacity: 1, blendMode: 'normal', visible: true, locked: false,
        imageSrc: String(reader.result),
        brightness: 100, contrast: 100, saturate: 100, blur: 0, borderRadius: 8,
      };
      updateElementsWithHistory('Place Raster Image', (prev) => [...prev, imgEl]);
      setSelectedId(id);
      setAppMode('photoshop');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const patchSelected = (patch: Partial<DesignElement>, label = 'Edit Properties') => {
    if (!selectedId) return;
    updateElementsWithHistory(label, (prev) => prev.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)));
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy: DesignElement = {
      ...selected,
      id: `copy-${Date.now()}`,
      name: `${selected.name} copy`,
      x: selected.x + 24,
      y: selected.y + 24,
    };
    updateElementsWithHistory('Duplicate Layer', (prev) => [...prev, copy]);
    setSelectedId(copy.id);
  };

  const moveLayerOrder = (id: string, dir: 'up' | 'down') => {
    updateElementsWithHistory('Reorder Layer', (prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      const target = dir === 'up' ? idx + 1 : idx - 1;
      if (target < 0 || target >= prev.length) return prev;
      const clone = [...prev];
      const [item] = clone.splice(idx, 1);
      clone.splice(target, 0, item);
      return clone;
    });
  };

  const exportFile = (format: 'svg' | 'png') => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const serializer = new XMLSerializer();
    const rawSvg = serializer.serializeToString(svgEl);
    const svgBlob = new Blob([rawSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    if (format === 'svg') {
      const a = document.createElement('a');
      a.href = url;
      a.download = `cdc-design-${artboard.id}.svg`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = artboard.w * 2;
      canvas.height = artboard.h * 2;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `cdc-design-${artboard.id}.png`;
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const toolsList: { id: ToolId; icon: React.ComponentType<{ className?: string }>; label: string; keyHint: string; mode?: AppMode }[] = [
    { id: 'select', icon: MousePointer, label: isKa ? 'გადაადგილება (Move / Selection)' : 'Move / Selection', keyHint: 'V' },
    { id: 'pen', icon: PenTool, label: isKa ? 'კალამი (Pen Tool - Bézier)' : 'Pen Tool (Bézier)', keyHint: 'P', mode: 'illustrator' },
    { id: 'rect', icon: Square, label: isKa ? 'მართკუთხედი (Rectangle)' : 'Rectangle', keyHint: 'M' },
    { id: 'ellipse', icon: Circle, label: isKa ? 'ელიფსი / წრე (Ellipse)' : 'Ellipse', keyHint: 'L' },
    { id: 'star', icon: Star, label: isKa ? 'ვარსკვლავი / პოლიგონი' : 'Star / Polygon', keyHint: 'S', mode: 'illustrator' },
    { id: 'text', icon: Type, label: isKa ? 'ტიპოგრაფია (Type Tool)' : 'Type Tool', keyHint: 'T' },
    { id: 'brush', icon: Brush, label: isKa ? 'ფუნჯი (Brush Tool)' : 'Brush Tool', keyHint: 'B', mode: 'photoshop' },
    { id: 'eraser', icon: Eraser, label: isKa ? 'საშლელი (Eraser)' : 'Eraser', keyHint: 'E', mode: 'photoshop' },
    { id: 'eyedropper', icon: Pipette, label: isKa ? 'პიპეტი (Eyedropper)' : 'Eyedropper', keyHint: 'I' },
  ];

  const starPoints = (x: number, y: number, w: number, h: number) => {
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2;
    const ry = h / 2;
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 1 : 0.45;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${cx + rx * r * Math.cos(angle)},${cy + ry * r * Math.sin(angle)}`);
    }
    return pts.join(' ');
  };

  return (
    <div className="rounded-xl border border-[#2b2b2b] bg-[#1e1e1e] text-[#e5e5e5] shadow-2xl overflow-hidden select-none font-sans">
      {/* 1. ADOBE TOP APPLICATION BAR */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#262626] border-b border-[#333333] px-3 py-1.5 text-xs">
        <div className="flex items-center gap-2">
          {/* Ps / Ai App Switcher */}
          <div className="flex items-center rounded-lg bg-[#181818] p-0.5 border border-[#383838]">
            <button
              type="button"
              onClick={() => setAppMode('photoshop')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-extrabold transition-all cursor-pointer border-none ${
                appMode === 'photoshop' ? 'bg-[#001e36] text-[#31a8ff] ring-1 ring-[#31a8ff]' : 'bg-transparent text-gray-400 hover:text-white'
              }`}
            >
              <span className="rounded bg-[#31a8ff] text-[#001e36] px-1 text-[10px] font-black">Ps</span>
              Photoshop
            </button>
            <button
              type="button"
              onClick={() => setAppMode('illustrator')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-extrabold transition-all cursor-pointer border-none ${
                appMode === 'illustrator' ? 'bg-[#330000] text-[#ff9a00] ring-1 ring-[#ff9a00]' : 'bg-transparent text-gray-400 hover:text-white'
              }`}
            >
              <span className="rounded bg-[#ff9a00] text-[#330000] px-1 text-[10px] font-black">Ai</span>
              Illustrator
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1 rounded bg-[#323232] hover:bg-[#3e3e3e] px-2.5 py-1 text-gray-200 cursor-pointer border-none"
          >
            <FilePlus className="w-3.5 h-3.5 text-cyan-400" />
            {isKa ? 'ახალი Artboard' : 'New'}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 rounded bg-[#323232] hover:bg-[#3e3e3e] px-2.5 py-1 text-gray-200 cursor-pointer border-none"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            {isKa ? 'სურათის ჩასმა' : 'Place Image'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </div>

        {/* Center Undo/Redo & Zoom */}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)" className="p-1.5 rounded bg-[#323232] disabled:opacity-40 cursor-pointer border-none text-gray-200">
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)" className="p-1.5 rounded bg-[#323232] disabled:opacity-40 cursor-pointer border-none text-gray-200">
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <span className="mx-1 text-[#444]">|</span>
          <button type="button" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))} className="p-1.5 rounded bg-[#323232] cursor-pointer border-none text-gray-200">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="w-11 text-center font-mono text-[11px]">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.1).toFixed(1)))} className="p-1.5 rounded bg-[#323232] cursor-pointer border-none text-gray-200">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            title="Toggle Grid"
            className={`p-1.5 rounded cursor-pointer border-none ${showGrid ? 'bg-cyan-500/20 text-cyan-300' : 'bg-[#323232] text-gray-400'}`}
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Export Actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => exportFile('png')}
            className="flex items-center gap-1 rounded bg-[#0284c7] hover:bg-[#0369a1] px-2.5 py-1 font-bold text-white cursor-pointer border-none"
          >
            <Download className="w-3.5 h-3.5" /> PNG
          </button>
          <button
            type="button"
            onClick={() => exportFile('svg')}
            className="flex items-center gap-1 rounded bg-[#d97706] hover:bg-[#b45309] px-2.5 py-1 font-bold text-white cursor-pointer border-none"
          >
            <Download className="w-3.5 h-3.5" /> SVG
          </button>
        </div>
      </div>

      {/* 2. CONTEXTUAL OPTIONS BAR (Changes dynamically by active tool) */}
      <div className="flex flex-wrap items-center gap-3 bg-[#2c2c2c] border-b border-[#383838] px-3 py-1.5 text-[11px] text-gray-300">
        <span className="font-bold uppercase tracking-wider text-gray-400">
          {activeTool.toUpperCase()}
        </span>
        <span className="text-[#444]">|</span>
        {(activeTool === 'brush' || activeTool === 'eraser') && (
          <label className="flex items-center gap-2">
            <span>{isKa ? 'ფუნჯის ზომა:' : 'Brush Size:'} {brushSize}px</span>
            <input type="range" min={1} max={50} value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-24" />
          </label>
        )}
        {activeTool === 'pen' && (
          <div className="flex items-center gap-2">
            <span className="text-amber-300">
              {isKa ? `წერტილები: ${penDraft.length} (დააკლიკე ტილოზე წერტილების დასასმელად)` : `Anchor points: ${penDraft.length}`}
            </span>
            {penDraft.length >= 2 && (
              <button type="button" onClick={finishPenPath} className="rounded bg-emerald-600 px-2 py-0.5 text-white font-bold cursor-pointer border-none">
                {isKa ? '✓ კონტურის დასრულება' : '✓ Finish Path'}
              </button>
            )}
          </div>
        )}
        {selected && (
          <>
            <span>X: <b>{selected.x}</b></span>
            <span>Y: <b>{selected.y}</b></span>
            <span>W: <b>{selected.w}</b></span>
            <span>H: <b>{selected.h}</b></span>
            <button type="button" onClick={duplicateSelected} className="flex items-center gap-1 rounded bg-[#383838] px-2 py-0.5 text-gray-200 cursor-pointer border-none">
              <Copy className="w-3 h-3" /> {isKa ? 'დუბლირება' : 'Duplicate'}
            </button>
          </>
        )}
      </div>

      {/* 3. MAIN 3-COLUMN ADOBE STUDIO WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[540px]">
        {/* LEFT TOOL DOCK */}
        <div className="lg:col-span-1 bg-[#262626] border-b lg:border-b-0 lg:border-r border-[#333333] p-2 flex lg:flex-col items-center justify-between gap-2">
          <div className="flex lg:flex-col flex-wrap gap-1">
            {toolsList.map((tool) => {
              const Icon = tool.icon;
              const isActive = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  title={`${tool.label} [${tool.keyHint}]`}
                  onClick={() => setActiveTool(tool.id)}
                  className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-all cursor-pointer border ${
                    isActive
                      ? appMode === 'photoshop'
                        ? 'bg-[#001e36] text-[#31a8ff] border-[#31a8ff]/60'
                        : 'bg-[#331a00] text-[#ff9a00] border-[#ff9a00]/60'
                      : 'bg-transparent text-gray-400 border-transparent hover:bg-[#333333] hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="absolute bottom-0.5 right-1 text-[8px] opacity-60">{tool.keyHint}</span>
                </button>
              );
            })}
          </div>

          {/* Foreground / Background Color Swatch Box */}
          <div className="relative h-11 w-11 shrink-0 mt-auto">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              title="Background / Stroke Color"
              className="absolute bottom-0 right-0 h-7 w-7 cursor-pointer rounded border border-white/40 bg-transparent p-0"
            />
            <input
              type="color"
              value={fgColor}
              onChange={(e) => setFgColor(e.target.value)}
              title="Foreground / Fill Color"
              className="absolute top-0 left-0 h-7 w-7 cursor-pointer rounded border-2 border-white bg-transparent p-0 shadow-md"
            />
          </div>
        </div>

        {/* CENTER ARTBOARD VIEWPORT */}
        <div className="lg:col-span-8 bg-[#141414] p-4 flex flex-col items-center justify-center overflow-auto relative">
          <div className="mb-2 flex items-center gap-3 text-[11px] text-gray-400">
            <span>{artboard.label}</span>
            <label className="flex items-center gap-1">
              <span>Artboard BG:</span>
              <input type="color" value={artboardBg} onChange={(e) => setArtboardBg(e.target.value)} className="h-4 w-6 bg-transparent border-none cursor-pointer" />
            </label>
          </div>

          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            className="transition-transform duration-150 shadow-[0_25px_70px_rgba(0,0,0,0.85)]"
          >
            <svg
              ref={svgRef}
              width={artboard.w}
              height={artboard.h}
              viewBox={`0 0 ${artboard.w} ${artboard.h}`}
              onPointerDown={handleCanvasPointerDown}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerLeave={handleCanvasPointerUp}
              style={{ backgroundColor: artboardBg }}
              className="max-w-full h-auto block cursor-crosshair"
            >
              {/* Grid overlay */}
              {showGrid && (
                <g opacity="0.12">
                  {Array.from({ length: Math.floor(artboard.w / 30) }).map((_, i) => (
                    <line key={`vx-${i}`} x1={i * 30} y1={0} x2={i * 30} y2={artboard.h} stroke="#ffffff" strokeWidth="1" />
                  ))}
                  {Array.from({ length: Math.floor(artboard.h / 30) }).map((_, i) => (
                    <line key={`hz-${i}`} x1={0} y1={i * 30} x2={artboard.w} y2={i * 30} stroke="#ffffff" strokeWidth="1" />
                  ))}
                </g>
              )}

              {/* Render all visible layers bottom-to-top */}
              {elements.filter((el) => el.visible).map((el) => {
                const isSel = el.id === selectedId;
                const commonStyle: React.CSSProperties = {
                  mixBlendMode: el.blendMode,
                  filter: el.kind === 'image'
                    ? `brightness(${el.brightness ?? 100}%) contrast(${el.contrast ?? 100}%) saturate(${el.saturate ?? 100}%) blur(${el.blur ?? 0}px)`
                    : undefined,
                };

                const onElementDown = (e: React.PointerEvent) => {
                  if (activeTool === 'eyedropper') {
                    e.stopPropagation();
                    if (el.fill && el.fill !== 'none') setFgColor(el.fill);
                    setActiveTool('select');
                    return;
                  }
                  if (activeTool !== 'select' || el.locked) return;
                  e.stopPropagation();
                  setSelectedId(el.id);
                  const { x, y } = getSvgCoords(e);
                  setDragState({ mode: 'move', startX: x, startY: y, origX: el.x, origY: el.y, origW: el.w, origH: el.h });
                };

                return (
                  <g key={el.id} transform={`rotate(${el.rotation} ${el.x + el.w / 2} ${el.y + el.h / 2})`} style={commonStyle} onPointerDown={onElementDown}>
                    {el.kind === 'rect' && (
                      <rect
                        x={el.x} y={el.y} width={el.w} height={el.h}
                        rx={el.borderRadius ?? 0}
                        fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} opacity={el.opacity}
                      />
                    )}
                    {el.kind === 'ellipse' && (
                      <ellipse
                        cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2}
                        fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} opacity={el.opacity}
                      />
                    )}
                    {el.kind === 'star' && (
                      <polygon
                        points={starPoints(el.x, el.y, el.w, el.h)}
                        fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} opacity={el.opacity}
                      />
                    )}
                    {el.kind === 'line' && (
                      <line
                        x1={el.x} y1={el.y} x2={el.x + el.w} y2={el.y}
                        stroke={el.stroke || el.fill} strokeWidth={Math.max(2, el.strokeWidth)} opacity={el.opacity}
                      />
                    )}
                    {el.kind === 'text' && (
                      <text
                        x={el.x} y={el.y + (el.fontSize ?? 24)}
                        fill={el.fill} fontSize={el.fontSize ?? 24} fontFamily={el.fontFamily ?? 'sans-serif'}
                        fontWeight={el.fontWeight ?? '700'} opacity={el.opacity}
                      >
                        {el.text}
                      </text>
                    )}
                    {el.kind === 'image' && el.imageSrc && (
                      <image
                        href={el.imageSrc} x={el.x} y={el.y} width={el.w} height={el.h}
                        preserveAspectRatio="none" opacity={el.opacity}
                      />
                    )}
                    {el.kind === 'path' && el.points && el.points.length > 1 && (
                      <polyline
                        fill="none"
                        stroke={el.stroke}
                        strokeWidth={el.strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={el.opacity}
                        points={el.points.map((p) => `${p.x},${p.y}`).join(' ')}
                      />
                    )}

                    {/* Adobe Selection Bounding Box + Resize Handle */}
                    {isSel && el.kind !== 'path' && (
                      <g>
                        <rect
                          x={el.x - 2} y={el.y - 2} width={el.w + 4} height={el.h + 4}
                          fill="none" stroke={appMode === 'photoshop' ? '#31a8ff' : '#ff9a00'} strokeWidth="1.5" strokeDasharray="4 2"
                        />
                        <rect
                          x={el.x + el.w - 4} y={el.y + el.h - 4} width={10} height={10}
                          fill="#ffffff" stroke={appMode === 'photoshop' ? '#31a8ff' : '#ff9a00'} strokeWidth="2"
                          className="cursor-nwse-resize"
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const { x, y } = getSvgCoords(e);
                            setDragState({ mode: 'resize', startX: x, startY: y, origX: el.x, origY: el.y, origW: el.w, origH: el.h });
                          }}
                        />
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Pen Tool Live Preview */}
              {penDraft.length > 0 && (
                <g>
                  <polyline
                    fill="none" stroke="#ff9a00" strokeWidth="2" strokeDasharray="4 3"
                    points={penDraft.map((p) => `${p.x},${p.y}`).join(' ')}
                  />
                  {penDraft.map((p, idx) => (
                    <circle key={idx} cx={p.x} cy={p.y} r={4} fill="#ffffff" stroke="#ff9a00" strokeWidth="2" />
                  ))}
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* RIGHT INSPECTOR PANEL (Properties / Layers / History) */}
        <div className="lg:col-span-3 bg-[#262626] border-t lg:border-t-0 lg:border-l border-[#333333] flex flex-col">
          <div className="grid grid-cols-3 border-b border-[#333333] bg-[#1f1f1f] text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setRightTab('properties')}
              className={`py-2.5 cursor-pointer border-none ${rightTab === 'properties' ? 'bg-[#262626] text-white border-b-2 border-cyan-400' : 'bg-transparent text-gray-400'}`}
            >
              {isKa ? 'პარამეტრები' : 'Properties'}
            </button>
            <button
              type="button"
              onClick={() => setRightTab('layers')}
              className={`py-2.5 cursor-pointer border-none ${rightTab === 'layers' ? 'bg-[#262626] text-white border-b-2 border-cyan-400' : 'bg-transparent text-gray-400'}`}
            >
              {isKa ? `ფენები (${elements.length})` : `Layers (${elements.length})`}
            </button>
            <button
              type="button"
              onClick={() => setRightTab('history')}
              className={`py-2.5 cursor-pointer border-none ${rightTab === 'history' ? 'bg-[#262626] text-white border-b-2 border-cyan-400' : 'bg-transparent text-gray-400'}`}
            >
              {isKa ? 'ისტორია' : 'History'}
            </button>
          </div>

          <div className="p-3.5 space-y-3.5 overflow-y-auto flex-1 text-xs">
            {rightTab === 'properties' && (
              <>
                {/* Quick Swatches */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Swatches</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          setFgColor(hex);
                          if (selected) patchSelected({ fill: hex }, 'Change Fill');
                        }}
                        style={{ backgroundColor: hex }}
                        className="h-5 w-5 rounded border border-white/25 cursor-pointer"
                      />
                    ))}
                  </div>
                </div>

                {selected ? (
                  <div className="space-y-3 pt-2 border-t border-[#363636]">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-300 truncate">{selected.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          updateElementsWithHistory('Delete Layer', (prev) => prev.filter((i) => i.id !== selected.id));
                          setSelectedId(null);
                        }}
                        className="text-rose-400 hover:text-rose-300 bg-transparent border-none cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {selected.kind === 'text' && (
                      <div className="space-y-2">
                        <label className="block text-gray-400">
                          {isKa ? 'ტექსტი' : 'Text Content'}
                          <input
                            value={selected.text ?? ''}
                            onChange={(e) => patchSelected({ text: e.target.value }, 'Edit Text')}
                            className="mt-1 w-full rounded bg-[#181818] border border-[#3d3d3d] px-2.5 py-1.5 text-white"
                          />
                        </label>
                        <label className="block text-gray-400">
                          {isKa ? `შრიფტის ზომა: ${selected.fontSize ?? 24}px` : `Font Size: ${selected.fontSize ?? 24}px`}
                          <input
                            type="range" min={10} max={96} value={selected.fontSize ?? 24}
                            onChange={(e) => patchSelected({ fontSize: Number(e.target.value) }, 'Font Size')}
                            className="w-full"
                          />
                        </label>
                      </div>
                    )}

                    {/* Appearance: Fill, Stroke, Opacity, Blend Mode, Rotation */}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center justify-between rounded bg-[#1b1b1b] px-2 py-1.5 border border-[#363636]">
                        <span>Fill</span>
                        <input type="color" value={selected.fill === 'none' ? '#ffffff' : selected.fill} onChange={(e) => patchSelected({ fill: e.target.value }, 'Fill Color')} className="h-5 w-7 bg-transparent border-none cursor-pointer" />
                      </label>
                      <label className="flex items-center justify-between rounded bg-[#1b1b1b] px-2 py-1.5 border border-[#363636]">
                        <span>Stroke</span>
                        <input type="color" value={selected.stroke === 'none' ? '#ffffff' : selected.stroke} onChange={(e) => patchSelected({ stroke: e.target.value }, 'Stroke Color')} className="h-5 w-7 bg-transparent border-none cursor-pointer" />
                      </label>
                    </div>

                    <label className="block text-gray-400">
                      {isKa ? `კონტურის სისქე: ${selected.strokeWidth}px` : `Stroke Width: ${selected.strokeWidth}px`}
                      <input type="range" min={0} max={20} value={selected.strokeWidth} onChange={(e) => patchSelected({ strokeWidth: Number(e.target.value) }, 'Stroke Width')} className="w-full" />
                    </label>

                    <label className="block text-gray-400">
                      {isKa ? `გამჭვირვალობა: ${Math.round(selected.opacity * 100)}%` : `Opacity: ${Math.round(selected.opacity * 100)}%`}
                      <input type="range" min={0.05} max={1} step={0.05} value={selected.opacity} onChange={(e) => patchSelected({ opacity: Number(e.target.value) }, 'Opacity')} className="w-full" />
                    </label>

                    <label className="block text-gray-400">
                      {isKa ? `მობრუნება (Rotate): ${selected.rotation}°` : `Rotation: ${selected.rotation}°`}
                      <input type="range" min={-180} max={180} value={selected.rotation} onChange={(e) => patchSelected({ rotation: Number(e.target.value) }, 'Rotate')} className="w-full" />
                    </label>

                    <label className="block text-gray-400">
                      Blend Mode (Photoshop)
                      <select
                        value={selected.blendMode}
                        onChange={(e) => patchSelected({ blendMode: e.target.value as BlendMode }, 'Blend Mode')}
                        className="mt-1 w-full rounded bg-[#181818] border border-[#3d3d3d] px-2 py-1.5 text-white"
                      >
                        <option value="normal">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                      </select>
                    </label>

                    {/* Photoshop Image Filters when an image layer is selected */}
                    {selected.kind === 'image' && (
                      <div className="space-y-2 pt-2 border-t border-[#363636]">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Ps Image Adjustments</p>
                        <label className="block text-gray-400">
                          Brightness: {selected.brightness ?? 100}%
                          <input type="range" min={30} max={200} value={selected.brightness ?? 100} onChange={(e) => patchSelected({ brightness: Number(e.target.value) }, 'Brightness')} className="w-full" />
                        </label>
                        <label className="block text-gray-400">
                          Contrast: {selected.contrast ?? 100}%
                          <input type="range" min={30} max={200} value={selected.contrast ?? 100} onChange={(e) => patchSelected({ contrast: Number(e.target.value) }, 'Contrast')} className="w-full" />
                        </label>
                        <label className="block text-gray-400">
                          Saturation: {selected.saturate ?? 100}%
                          <input type="range" min={0} max={250} value={selected.saturate ?? 100} onChange={(e) => patchSelected({ saturate: Number(e.target.value) }, 'Saturation')} className="w-full" />
                        </label>
                        <label className="block text-gray-400">
                          Gaussian Blur: {selected.blur ?? 0}px
                          <input type="range" min={0} max={20} value={selected.blur ?? 0} onChange={(e) => patchSelected({ blur: Number(e.target.value) }, 'Blur')} className="w-full" />
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-400 pt-2">
                    {isKa ? 'აირჩიე ობიექტი Artboard-ზე ან დაამატე ახალი ფორმა/სურათი მარცხენა პანელიდან.' : 'Select any object on the Artboard or create a new shape/image.'}
                  </p>
                )}
              </>
            )}

            {rightTab === 'layers' && (
              <div className="space-y-1.5">
                {[...elements].reverse().map((el) => (
                  <div
                    key={el.id}
                    onClick={() => setSelectedId(el.id)}
                    className={`flex items-center justify-between gap-1 rounded-lg px-2.5 py-2 cursor-pointer border ${
                      el.id === selectedId ? 'bg-[#363636] border-cyan-500/60 text-white' : 'bg-[#1d1d1d] border-[#303030] text-gray-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); patchSelected({ visible: !el.visible }); }}
                      className="text-gray-400 hover:text-white bg-transparent border-none cursor-pointer p-0.5"
                    >
                      {el.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-40" />}
                    </button>
                    <span className="flex-1 truncate font-medium">{el.name}</span>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveLayerOrder(el.id, 'up'); }} className="p-0.5 text-gray-400 hover:text-white bg-transparent border-none cursor-pointer">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); moveLayerOrder(el.id, 'down'); }} className="p-0.5 text-gray-400 hover:text-white bg-transparent border-none cursor-pointer">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); patchSelected({ locked: !el.locked }); }}
                        className="p-0.5 text-gray-400 hover:text-white bg-transparent border-none cursor-pointer"
                      >
                        {el.locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3 opacity-50" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rightTab === 'history' && (
              <div className="space-y-1">
                {history.length === 0 ? (
                  <p className="text-gray-400">{isKa ? 'მოქმედებების ისტორია ცარიელია.' : 'No actions recorded yet.'}</p>
                ) : (
                  history.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setElements(h.snapshot); setHistoryIndex(i); }}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs cursor-pointer border-none ${
                        i === historyIndex ? 'bg-cyan-600/30 text-cyan-200 font-bold' : 'bg-[#1d1d1d] text-gray-400 hover:text-white'
                      }`}
                    >
                      {i + 1}. {h.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* NEW DOCUMENT / ARTBOARD MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setShowNewModal(false)}>
          <div className="w-full max-w-md rounded-2xl border border-[#3a3a3a] bg-[#242424] p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">{isKa ? 'ახალი დოკუმენტის / Artboard-ის შექმნა' : 'New Document Preset'}</h3>
            <div className="grid grid-cols-1 gap-2">
              {ARTBOARD_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setArtboard(preset);
                    setElements([]);
                    setSelectedId(null);
                    setShowNewModal(false);
                  }}
                  className="flex items-center justify-between rounded-xl border border-[#3a3a3a] bg-[#1a1a1a] hover:border-cyan-500 px-3.5 py-2.5 text-left text-xs text-gray-200 cursor-pointer"
                >
                  <span className="font-bold">{preset.label}</span>
                  <span className="text-gray-400">{preset.w}×{preset.h}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}