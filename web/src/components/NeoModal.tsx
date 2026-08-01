import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { NeuralBackground } from 'jeikei-design-system';

interface NeoModalProps {
  children: React.ReactNode;
  title?: string;
  onClose?: () => void;
  fullHeight?: boolean;
  visible: boolean;
}

export const NeoModal = ({ children, title, onClose, fullHeight, visible }: NeoModalProps) => {
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#02040a]/85 backdrop-blur-md">
      {/* Red neuronal Skia de fondo, asumimos que exporta NeuralBackground web */}
      <div className="absolute inset-0 pointer-events-none">
        <NeuralBackground />
      </div>

      {/* Contenedor principal con borde neon */}
      <div
        className={`relative w-full max-w-lg bg-transparent border border-[#34d8ff]/15 rounded-2xl p-5 overflow-hidden shadow-[0_0_15px_rgba(52,216,255,0.1)] ${
          fullHeight ? 'h-full flex flex-col' : ''
        }`}
      >
        {/* Marcadores HUD (Esquinas) */}
        <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2 border-[#34d8ff]"></div>
        <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2 border-[#34d8ff]"></div>
        <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2 border-[#34d8ff]"></div>
        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2 border-[#34d8ff]"></div>
        
        {(title || onClose) && (
          <div className="flex justify-between items-center mb-4">
            {title ? (
              <h2 className="text-[#34d8ff] text-base font-bold font-mono tracking-widest">{title}</h2>
            ) : <div />}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-white/60 hover:text-white transition-colors"
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div className={fullHeight ? 'flex-1 overflow-y-auto' : ''}>
          {children}
        </div>
      </div>
    </div>
  );
};
