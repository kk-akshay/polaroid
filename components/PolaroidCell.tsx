'use client';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { RotateCw, Maximize, Minimize, ImagePlus, X } from 'lucide-react';

interface Props {
  secondaryPadding: { x: number; y: number; bottom: number };
  isLandscape: boolean;
}

export default function PolaroidCell({ secondaryPadding, isLandscape }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setImage(URL.createObjectURL(file));
  };

  return (
    <div className="relative group border-[0.5px] border-zinc-200 bg-white overflow-hidden w-full h-full flex items-center justify-center">
      
      {/* Dynamic Polaroid Mask */}
      <div 
        className="absolute bg-zinc-50 overflow-hidden flex items-center justify-center transition-all duration-300 border border-zinc-100 shadow-inner"
        style={{
          top: isLandscape ? `${secondaryPadding.x * 2}px` : `${secondaryPadding.y}px`,
          bottom: isLandscape ? `${secondaryPadding.x * 2}px` : `${secondaryPadding.bottom}px`,
          left: isLandscape ? `${secondaryPadding.y}px` : `${secondaryPadding.x}px`,
          right: isLandscape ? `${secondaryPadding.y}px` : `${secondaryPadding.x}px`,
        }}
      >
        {!image ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="no-print w-full h-full cursor-pointer hover:bg-zinc-100 flex flex-col items-center justify-center gap-3 transition-colors"
          >
            <div className="p-4 rounded-full bg-white border border-zinc-200 text-zinc-400 group-hover:text-blue-500 group-hover:border-blue-200 transition-all shadow-sm">
              <ImagePlus size={32} />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 tracking-widest uppercase">Select_Image</span>
          </div>
        ) : (
          <motion.img
            src={image}
            drag
            dragConstraints={{ left: -4000, right: 4000, top: -4000, bottom: 4000 }}
            className="cursor-move max-w-none origin-center"
            style={{ 
              rotate: `${rotation}deg`, 
              scale: scale,
              width: isLandscape ? '120%' : 'auto',
              height: isLandscape ? 'auto' : '120%',
            }}
          />
        )}
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleUpload} />

      {/* Manual Overlay Controls */}
      {image && (
        <div className="no-print absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 z-30">
          <button onClick={() => setRotation(r => r + 90)} className="p-2 bg-zinc-900 text-white rounded shadow-lg hover:bg-black transition-colors"><RotateCw size={14}/></button>
          <button onClick={() => setScale(s => s + 0.1)} className="p-2 bg-zinc-900 text-white rounded shadow-lg hover:bg-black transition-colors"><Maximize size={14}/></button>
          <button onClick={() => setScale(s => s - 0.1)} className="p-2 bg-zinc-900 text-white rounded shadow-lg hover:bg-black transition-colors"><Minimize size={14}/></button>
          <button onClick={() => { setImage(null); setScale(1); setRotation(0); }} className="p-2 bg-red-600 text-white rounded shadow-lg hover:bg-red-700 mt-2 transition-colors"><X size={14}/></button>
        </div>
      )}
      
      <div className="absolute bottom-2 left-3 text-[8px] text-zinc-300 font-mono select-none uppercase">
        {isLandscape ? 'LANDSCAPE_REF' : 'PORTRAIT_REF'}
      </div>
    </div>
  );
}