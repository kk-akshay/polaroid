'use client';
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus } from 'lucide-react';

interface Props {
  data: { url: string | null; rotation: number; scale: number; isLandscape: boolean };
  secondaryPadding: { x: number; y: number; bottom: number };
  onReplace: (url: string) => void;
  /** Polaroid Print Mode only: no debug label on the card, larger empty-slot placeholder. */
  compact?: boolean;
  /** Polaroid Print Mode only: hide editor-only UI (empty-slot placeholder) while exporting. */
  hideUi?: boolean;
}

export default function PolaroidCell({ data, secondaryPadding, onReplace, compact = false, hideUi = false }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hideEmptyUi = hideUi && !data.url;

  return (
    <div className="w-full h-full bg-white relative flex items-center justify-center overflow-hidden">
      {/* Mask (Secondary Reference Lines) */}
      <div 
        className={`absolute ${hideEmptyUi ? 'bg-white' : 'bg-zinc-50'} overflow-hidden flex items-center justify-center ${hideEmptyUi ? '' : 'transition-all duration-300'}`}
        style={{
          top: data.isLandscape ? `${secondaryPadding.x * 2}px` : `${secondaryPadding.y}px`,
          bottom: data.isLandscape ? `${secondaryPadding.x * 2}px` : `${secondaryPadding.bottom}px`,
          left: data.isLandscape ? `${secondaryPadding.y}px` : `${secondaryPadding.x}px`,
          right: data.isLandscape ? `${secondaryPadding.y}px` : `${secondaryPadding.x}px`,
        }}
      >
        {!data.url ? (
          hideEmptyUi ? null : (
            <div 
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="w-full h-full flex flex-col items-center justify-center gap-2 hover:bg-zinc-100 transition-colors"
            >
              <ImagePlus size={compact ? 48 : 24} className="text-zinc-300" />
              <span className={`${compact ? 'text-[20px]' : 'text-[8px]'} font-bold text-zinc-400 uppercase`}>Empty_Slot</span>
            </div>
          )
        ) : (
          <motion.img
            src={data.url}
            drag
            dragConstraints={{ left: -3000, right: 3000, top: -3000, bottom: 3000 }}
            className="cursor-move max-w-none origin-center pointer-events-auto"
            style={{ 
              rotate: `${data.rotation}deg`, 
              scale: data.scale,
              width: data.isLandscape ? '110%' : 'auto',
              height: data.isLandscape ? 'auto' : '110%',
            }}
          />
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        onChange={(e) => onReplace(URL.createObjectURL(e.target.files![0]))} 
      />

      {!compact && (
        <div className="absolute bottom-2 left-3 text-[7px] text-zinc-300 font-mono uppercase select-none">
          SLOT_SYNC_ACTIVE
        </div>
      )}
    </div>
  );
}
