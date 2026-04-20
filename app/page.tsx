'use client';
import { useState, useRef } from 'react';
import { A3, GRID } from '@/constants/dimensions';
import PolaroidCell from '@/components/PolaroidCell';
import { toPng } from 'html-to-image';
import { 
  Upload, RotateCw, Trash2, 
  Square, RectangleHorizontal, Download, ZoomIn, ZoomOut 
} from 'lucide-react';

interface PhotoState {
  id: number;
  url: string | null;
  rotation: number;
  scale: number;
  isLandscape: boolean;
}

export default function Home() {
  // Initialize exactly 16 slots with default data
  const [photos, setPhotos] = useState<PhotoState[]>(
    Array.from({ length: 16 }, (_, i) => ({
      id: i, url: null, rotation: 0, scale: 1, isLandscape: false
    }))
  );
  
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [padding, setPadding] = useState({ x: 60, y: 60, bottom: 180 });
  const [zoom, setZoom] = useState(0.12);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedPhoto = selectedId !== null ? photos[selectedId] : null;

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 16);
    const newPhotos = [...photos];
    
    files.forEach((file, index) => {
      if (newPhotos[index]) {
        newPhotos[index].url = URL.createObjectURL(file);
      }
    });
    setPhotos(newPhotos);
  };

  const updatePhoto = (id: number, updates: Partial<PhotoState>) => {
    setPhotos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
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
            <Upload size={14} /> Bulk_Import_16
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleBulkUpload} />
          </label>
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
          style={{
            width: `${A3.WIDTH}px`,
            height: `${A3.HEIGHT}px`,
            minWidth: `${A3.WIDTH}px`,
            minHeight: `${A3.HEIGHT}px`,
            display: 'grid',
            gridTemplateColumns: `repeat(${GRID.COLUMNS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID.ROWS}, 1fr)`,
            transform: `scale(${zoom})`,
          }}
        >
          {photos.map((photo, i) => (
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
                secondaryPadding={padding} 
                onReplace={(url) => updatePhoto(i, { url })}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}