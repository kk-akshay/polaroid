'use client';
import { useState, useRef, useMemo } from 'react';
import { A3, GRID, CELL } from '@/constants/dimensions';
import {
  A3_MM, POLAROID_MM, PRINT_DEFAULTS, PX_PER_MM_X, PX_PER_MM_Y, computePrintLayout,
} from '@/constants/printMode';
import { buildPdf, verifyPdf, type PdfVerification } from '@/lib/pdf';
import PolaroidCell from '@/components/PolaroidCell';
import { toPng, toJpeg } from 'html-to-image';
import { 
  Upload, RotateCw, Trash2, 
  Square, RectangleHorizontal, Download, ZoomIn, ZoomOut, Printer 
} from 'lucide-react';

interface PhotoState {
  id: number;
  url: string | null;
  rotation: number;
  scale: number;
  isLandscape: boolean;
}

const makeSlot = (id: number): PhotoState => ({ id, url: null, rotation: 0, scale: 1, isLandscape: false });

// Makes sure the list has at least `count` slots (Print Mode can need more than the original 16).
const padSlots = (list: PhotoState[], count: number): PhotoState[] =>
  list.length >= count
    ? list
    : [...list, ...Array.from({ length: count - list.length }, (_, k) => makeSlot(list.length + k))];

export default function Home() {
  // Initialize exactly 16 slots with default data
  const [photos, setPhotos] = useState<PhotoState[]>(
    Array.from({ length: 16 }, (_, i) => makeSlot(i))
  );
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [padding, setPadding] = useState({ x: 60, y: 60, bottom: 180 });
  const [zoom, setZoom] = useState(0.12);
  const canvasRef = useRef<HTMLDivElement>(null);

  // --- Polaroid Print Mode (optional, off by default) ---
  const [printMode, setPrintMode] = useState(false);
  const [printMargin, setPrintMargin] = useState(PRINT_DEFAULTS.MARGIN_MM);
  const [printGap, setPrintGap] = useState(PRINT_DEFAULTS.GAP_MM);
  const [printGuides, setPrintGuides] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfReport, setPdfReport] = useState<PdfVerification | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const savedZoom = useRef(0.12);

  const printLayout = useMemo(() => computePrintLayout(printMargin, printGap), [printMargin, printGap]);
  const slotCount = printMode ? printLayout.total : GRID.TOTAL_CELLS;
  const shownPhotos = padSlots(photos, slotCount).slice(0, slotCount);

  // The Global_Frame_Lines sliders are defined for the 877px-wide normal cell; scale them to the mini card.
  const cardPxW = POLAROID_MM.WIDTH * PX_PER_MM_X;
  const cardPxH = POLAROID_MM.HEIGHT * PX_PER_MM_Y;
  const padScale = cardPxW / CELL.WIDTH;
  const cellPadding = printMode
    ? { x: padding.x * padScale, y: padding.y * padScale, bottom: padding.bottom * padScale }
    : padding;

  const selectedPhoto = selectedId !== null ? shownPhotos[selectedId] ?? null : null;

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, slotCount);
    const newPhotos = padSlots(photos, slotCount).map(p => ({ ...p }));
    
    files.forEach((file, index) => {
      if (newPhotos[index]) {
        newPhotos[index].url = URL.createObjectURL(file);
      }
    });
    setPhotos(newPhotos);
  };

  const updatePhoto = (id: number, updates: Partial<PhotoState>) => {
    setPhotos(prev => padSlots(prev, id + 1).map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const togglePrintMode = () => {
    setSelectedId(null);
    setPdfReport(null);
    setPdfError(null);
    if (!printMode) {
      savedZoom.current = zoom;
      setZoom(0.25); // cards are small, start closer
    } else {
      setZoom(savedZoom.current);
    }
    setPrintMode(!printMode);
  };

  const exportAsImage = async () => {
    if (!canvasRef.current) return;
    // Clears selection before export so the blue ring isn't in the final photo
    setSelectedId(null); 
    
    setTimeout(async () => {
      const dataUrl = await toPng(canvasRef.current!, { 
        quality: 1, 
        pixelRatio: 1, 
        width: A3.WIDTH,
        height: A3.HEIGHT
      });
      const link = document.createElement('a');
      link.download = `A3_Polaroid_Sheet.png`;
      link.href = dataUrl;
      link.click();
    }, 100);
  };

  // Print Mode export: 300 DPI canvas -> exact 297 x 420 mm PDF, verified before download.
  const exportAsPdf = async () => {
    if (!canvasRef.current || isExporting || printLayout.total === 0) return;
    setPdfReport(null);
    setPdfError(null);
    setSelectedId(null);
    setIsExporting(true); // hides empty-slot placeholders + selection guides
    try {
      await new Promise(r => setTimeout(r, 450)); // let React re-render and CSS transitions settle

      const dataUrl = await toJpeg(canvasRef.current, {
        quality: 0.98,
        pixelRatio: 1,
        width: A3.WIDTH,
        height: A3.HEIGHT,
        backgroundColor: '#ffffff',
        style: { transform: 'scale(1)', transformOrigin: 'top left', boxShadow: 'none', margin: '0' },
        filter: (node) => node.dataset?.exportIgnore === undefined,
      });
      const jpeg = new Uint8Array(await (await fetch(dataUrl)).arrayBuffer());

      const pdf = buildPdf({
        jpeg,
        pageWidthMm: A3_MM.WIDTH,
        pageHeightMm: A3_MM.HEIGHT,
        drawGuides: printGuides,
        cards: printLayout.cards.map(c => ({
          x: c.xMm, y: c.yMm, w: POLAROID_MM.WIDTH, h: POLAROID_MM.HEIGHT,
        })),
      });

      const report = verifyPdf(pdf, {
        pageWidthMm: A3_MM.WIDTH,
        pageHeightMm: A3_MM.HEIGHT,
        cardWidthMm: POLAROID_MM.WIDTH,
        cardHeightMm: POLAROID_MM.HEIGHT,
        cardCount: printLayout.total,
        marginMm: printMargin,
        imageWidthPx: A3.WIDTH,
        imageHeightPx: A3.HEIGHT,
        targetDpi: 300,
      });
      setPdfReport(report);

      if (!report.ok) {
        setPdfError('Verification failed - PDF not downloaded. Try Chrome or Edge (large canvas limits).');
        return;
      }

      const url = URL.createObjectURL(new Blob([pdf.buffer], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.download = 'A3_Polaroid_Print_37.5x45mm.pdf';
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const canvasStyle: React.CSSProperties = {
    width: `${A3.WIDTH}px`,
    height: `${A3.HEIGHT}px`,
    minWidth: `${A3.WIDTH}px`,
    minHeight: `${A3.HEIGHT}px`,
    display: printMode ? 'block' : 'grid',
    ...(printMode
      ? { position: 'relative' }
      : {
          gridTemplateColumns: `repeat(${GRID.COLUMNS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID.ROWS}, 1fr)`,
        }),
    transform: `scale(${zoom})`,
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-400 flex font-mono overflow-hidden">
      {/* SIDEBAR TOOLS (LEFT) */}
      <aside className="w-85 border-r border-zinc-800 p-6 flex flex-col gap-6 shrink-0 z-10 bg-zinc-950 shadow-2xl overflow-y-auto">
        <header className="border-b border-zinc-800 pb-4">
          <h1 className="text-white font-black tracking-tighter text-xl italic">A3_FACTORY_PRO</h1>
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Selected: {selectedId !== null ? `Slot_${selectedId + 1}` : 'None'}</p>
        </header>

        <section>
          <label className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white text-[10px] font-bold rounded cursor-pointer hover:bg-blue-500 transition-all uppercase shadow-lg shadow-blue-900/20">
            <Upload size={14} /> {printMode ? `Bulk_Import_${printLayout.total}` : 'Bulk_Import_16'}
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleBulkUpload} />
          </label>
        </section>

        {/* POLAROID PRINT MODE (optional) */}
        <section className="border border-zinc-800 rounded p-3 space-y-3">
          <button
            type="button"
            role="switch"
            aria-checked={printMode}
            onClick={togglePrintMode}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span>
              <span className="flex items-center gap-2 text-zinc-200 text-[10px] font-bold uppercase tracking-tighter"><Printer size={12} /> Polaroid_Print_Mode</span>
              <span className="block text-[9px] text-zinc-500 uppercase mt-1">Mini cards 37.5 x 45 mm</span>
            </span>
            <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${printMode ? 'bg-blue-600' : 'bg-zinc-800'}`}>
              <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${printMode ? 'translate-x-4' : ''}`} />
            </span>
          </button>

          {printMode && (
            <div className="space-y-3 pt-3 border-t border-zinc-800">
              <div className="text-[10px] uppercase font-bold text-zinc-200">
                {printLayout.cols} x {printLayout.rows} = <span className="text-blue-400">{printLayout.total} cards</span> on A3 (297 x 420 mm)
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1 uppercase"><span>Sheet_Margin</span><span className="text-blue-400 font-bold">{printMargin}MM</span></div>
                <input type="range" min="3" max="20" step="0.5" value={printMargin} onChange={(e) => setPrintMargin(Number(e.target.value))} className="w-full accent-blue-500 h-1 bg-zinc-800 rounded appearance-none" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1 uppercase"><span>Card_Gap</span><span className="text-blue-400 font-bold">{printGap}MM</span></div>
                <input type="range" min="0" max="5" step="0.5" value={printGap} onChange={(e) => setPrintGap(Number(e.target.value))} className="w-full accent-blue-500 h-1 bg-zinc-800 rounded appearance-none" />
              </div>
              <label className="flex items-center gap-2 text-[10px] uppercase cursor-pointer">
                <input type="checkbox" checked={printGuides} onChange={(e) => setPrintGuides(e.target.checked)} className="accent-blue-500" />
                Cut_Guides_In_PDF
              </label>
              {printLayout.total === 0 && (
                <div className="text-[10px] text-red-400 uppercase">Margin too large - no card fits.</div>
              )}
            </div>
          )}
        </section>

        <section className="flex-1 space-y-6">
          <div className="text-zinc-200 text-[10px] font-bold border-b border-zinc-800 pb-2 uppercase tracking-tighter">Slot_Controls</div>

          {selectedPhoto ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => updatePhoto(selectedId!, { isLandscape: false })} className={`py-2 flex flex-col items-center gap-1 border text-[9px] font-bold rounded ${!selectedPhoto.isLandscape ? 'bg-white text-black border-white' : 'border-zinc-800'}`}><Square size={14}/> PORTRAIT</button>
                <button onClick={() => updatePhoto(selectedId!, { isLandscape: true })} className={`py-2 flex flex-col items-center gap-1 border text-[9px] font-bold rounded ${selectedPhoto.isLandscape ? 'bg-white text-black border-white' : 'border-zinc-800'}`}><RectangleHorizontal size={14}/> LANDSCAPE</button>
              </div>

              <div className="flex gap-2">
                <button onClick={() => updatePhoto(selectedId!, { rotation: selectedPhoto.rotation + 90 })} className="flex-1 py-3 border border-zinc-800 rounded hover:bg-zinc-900 flex justify-center text-zinc-200"><RotateCw size={18}/></button>
                <button onClick={() => updatePhoto(selectedId!, { url: null })} className="flex-1 py-3 border border-red-900 text-red-500 rounded hover:bg-red-950 flex justify-center"><Trash2 size={18}/></button>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between text-[10px] uppercase font-bold"><span>Zoom_Scale</span><span className="text-blue-400">{(selectedPhoto.scale * 100).toFixed(0)}%</span></div>
                <div className="flex items-center gap-3">
                  <ZoomOut size={14} />
                  <input type="range" min="0.5" max="3" step="0.1" value={selectedPhoto.scale} onChange={(e) => updatePhoto(selectedId!, { scale: Number(e.target.value) })} className="flex-1 accent-white h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
                  <ZoomIn size={14} />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/50 p-4 rounded border border-dashed border-zinc-800 text-[10px] text-zinc-500 leading-relaxed uppercase">
              Click a photo on the canvas to enable individual tools.
            </div>
          )}

          <div className="space-y-4 pt-6 border-t border-zinc-800">
            <div className="text-zinc-200 text-[10px] font-bold uppercase tracking-tighter">Global_Frame_Lines</div>
            {['x', 'y', 'bottom'].map((axis) => (
              <div key={axis}>
                <div className="flex justify-between text-[10px] mb-1 uppercase"><span>{axis}_pad</span><span className="text-blue-400 font-bold">{padding[axis as keyof typeof padding]}PX</span></div>
                <input type="range" min="10" max="400" value={padding[axis as keyof typeof padding]} onChange={(e) => setPadding({...padding, [axis]: Number(e.target.value)})} className="w-full accent-blue-500 h-1 bg-zinc-800 rounded appearance-none" />
              </div>
            ))}
          </div>
        </section>

        {/* PRINT MODE EXPORT */}
        {printMode && (
          <div className="space-y-2">
            <button
              onClick={exportAsPdf}
              disabled={isExporting || printLayout.total === 0}
              className="w-full py-4 bg-blue-600 text-white font-black text-xs hover:bg-blue-500 disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2 transition-all shadow-xl"
            >
              <Printer size={16} /> {isExporting ? 'BUILDING_A3_PDF...' : 'DOWNLOAD_A3_PRINT_PDF'}
            </button>
            <p className="text-[10px] text-zinc-200 font-bold leading-snug">
              Print on A3 paper at 100% / Actual Size.
            </p>
            <p className="text-[9px] text-zinc-500 leading-snug">
              Turn off &quot;Fit to page&quot; / &quot;Shrink to fit&quot; in the print dialog.
            </p>

            {pdfError && <div className="text-[10px] text-red-400 leading-snug">{pdfError}</div>}
            {pdfReport && (
              <ul className="space-y-1 text-[9px] leading-snug">
                {pdfReport.checks.map((c) => (
                  <li key={c.label} className={c.ok ? 'text-zinc-400' : 'text-red-400'}>
                    <span className={`font-bold ${c.ok ? 'text-green-500' : 'text-red-500'}`}>{c.ok ? 'OK' : 'FAIL'}</span> {c.label}: {c.detail}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button onClick={exportAsImage} className="py-4 bg-zinc-100 text-black font-black text-xs hover:bg-white flex items-center justify-center gap-2 transition-all shadow-xl">
          <Download size={16} /> DOWNLOAD_A3_PNG
        </button>

        <div className="mt-4 opacity-50">
          <div className="flex justify-between text-[10px] mb-1 uppercase font-bold"><span>Preview_Zoom</span><span>{(zoom * 100).toFixed(0)}%</span></div>
          <input type="range" min="0.05" max="0.3" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-1 bg-zinc-800 rounded appearance-none" />
        </div>
      </aside>

      {/* MAIN CANVAS (RIGHT) */}
      <main className="flex-1 overflow-auto bg-zinc-900 p-20 flex items-start justify-center custom-grid-bg">
        <div 
          ref={canvasRef}
          id="a3-canvas"
          className="bg-white shadow-[0_0_100px_rgba(0,0,0,0.8)] flex-shrink-0 origin-top mb-40"
          style={canvasStyle}
        >
          {printMode
            ? printLayout.cards.map((c) => {
                const photo = shownPhotos[c.index];
                const selected = selectedId === c.index;
                return (
                  <div
                    key={c.index}
                    onClick={() => setSelectedId(c.index)}
                    className="absolute cursor-pointer"
                    style={{
                      left: `${c.xMm * PX_PER_MM_X}px`,
                      top: `${c.yMm * PX_PER_MM_Y}px`,
                      width: `${cardPxW}px`,
                      height: `${cardPxH}px`,
                    }}
                  >
                    <PolaroidCell
                      data={photo}
                      secondaryPadding={cellPadding}
                      onReplace={(url) => updatePhoto(c.index, { url })}
                      compact
                      hideUi={isExporting}
                    />
                    {/* preview-only card outline / selection ring (never exported) */}
                    <div
                      data-export-ignore
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        zIndex: selected ? 50 : 1,
                        boxShadow: selected ? 'inset 0 0 0 10px #3b82f6' : 'inset 0 0 0 6px #d4d4d8',
                      }}
                    />
                  </div>
                );
              })
            : photos.slice(0, GRID.TOTAL_CELLS).map((photo, i) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedId(i)}
                  className={`relative cursor-pointer transition-all duration-200 ${
                    selectedId === i 
                      ? 'ring-[20px] ring-blue-500 ring-inset z-50 shadow-2xl' 
                      : 'border-[0.5px] border-zinc-100'
                  }`}
                >
                  <PolaroidCell 
                    data={photo} 
                    secondaryPadding={cellPadding} 
                    onReplace={(url) => updatePhoto(i, { url })}
                  />
                </div>
              ))}
        </div>
      </main>
    </div>
  );
}
