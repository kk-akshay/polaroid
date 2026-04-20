'use client';
import { useState } from 'react';
import { A3, GRID } from '@/constants/dimensions';
import PolaroidCell from '@/components/PolaroidCell';
import { Sliders, Printer, LayoutPanelTop } from 'lucide-react';

export default function Home() {
  const [padding, setPadding] = useState({ x: 60, y: 60, bottom: 180 });
  const [columnOrientations, setColumnOrientations] = useState([false, false, false, false]);
  const [zoom, setZoom] = useState(0.12);

  const toggleColumn = (index: number) => {
    const newOrientations = [...columnOrientations];
    newOrientations[index] = !newOrientations[index];
    setColumnOrientations(newOrientations);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-400 flex font-mono overflow-hidden">
      {/* Sidebar Controls */}
      <aside className="no-print w-80 border-r border-zinc-800 p-6 flex flex-col gap-8 shrink-0 z-10 bg-zinc-950 shadow-2xl">
        <header>
          <h1 className="text-white font-bold tracking-tighter text-xl uppercase">A3_FACTORY_v2</h1>
          <p className="text-[10px] text-zinc-500 tracking-widest">3508 x 4961 PX</p>
        </header>

        {/* Global Padding Sliders */}
        <section className="flex flex-col gap-4">
          <div className="text-zinc-200 text-xs border-b border-zinc-800 pb-2 flex items-center gap-2">
            <Sliders size={14} /> SECONDARY_REF_LINES
          </div>
          {['x', 'y', 'bottom'].map((axis) => (
            <div key={axis}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] uppercase text-zinc-500">{axis}_offset</span>
                <span className="text-[10px] bg-blue-600/20 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/30 font-bold">
                  {padding[axis as keyof typeof padding]}PX
                </span>
              </div>
              <input 
                type="range" min="10" max="400" 
                value={padding[axis as keyof typeof padding]}
                onChange={(e) => setPadding({...padding, [axis]: Number(e.target.value)})}
                className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          ))}
        </section>

        {/* Column Orientation Controls */}
        <section className="flex flex-col gap-4">
          <div className="text-zinc-200 text-xs border-b border-zinc-800 pb-2 flex items-center gap-2">
            <LayoutPanelTop size={14} /> INDIVIDUAL_COLUMN_CTRL
          </div>
          <div className="grid grid-cols-2 gap-2">
            {columnOrientations.map((isLand, idx) => (
              <button 
                key={idx}
                onClick={() => toggleColumn(idx)}
                className={`py-2 px-3 border text-[9px] rounded transition-all flex flex-col items-center gap-1 uppercase ${
                  isLand ? 'bg-blue-600 text-white border-blue-400 font-bold' : 'border-zinc-800 hover:border-zinc-600'
                }`}
              >
                <span>COL_{idx + 1}</span>
                <span>{isLand ? 'Landscape' : 'Portrait'}</span>
              </button>
            ))}
          </div>
        </section>

        <button 
          onClick={() => window.print()} 
          className="py-3 bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2 uppercase"
        >
          <Printer size={14} /> Export_A3_Print
        </button>

        <div className="mt-auto border-t border-zinc-800 pt-4">
          <div className="flex justify-between text-[10px] mb-2 uppercase text-zinc-500">
            <span>Viewport_Scale</span>
            <span>{(zoom * 100).toFixed(0)}%</span>
          </div>
          <input type="range" min="0.05" max="0.4" step="0.01" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer" />
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 overflow-auto bg-zinc-900 p-20 flex items-start justify-center custom-grid-bg">
        <div 
          id="a3-canvas"
          className="bg-white shadow-[0_0_100px_rgba(0,0,0,0.6)] flex-shrink-0 origin-top mb-40"
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
          {Array.from({ length: GRID.TOTAL_CELLS }).map((_, i) => {
            const columnIndex = i % 4; // This maps the cell to one of the 4 columns
            return (
              <PolaroidCell 
                key={i} 
                secondaryPadding={padding} 
                isLandscape={columnOrientations[columnIndex]} 
              />
            );
          })}
        </div>
      </main>
    </div>
  );
}