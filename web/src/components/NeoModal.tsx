import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface NeoModalProps {
  children: React.ReactNode;
  title?: string;
  onClose?: () => void;
  fullHeight?: boolean;
  visible: boolean;
}

/**
 * NeoModal – reemplaza el componente nativo de RN.
 * Alias de HudModal para retrocompatibilidad en los componentes del proyecto.
 */
export const NeoModal = ({ children, title, onClose, fullHeight, visible }: NeoModalProps) => {
  useEffect(() => {
    document.body.style.overflow = visible ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(2,4,10,0.9)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 512,
          borderRadius: 16,
          padding: 20,
          overflow: 'hidden',
          border: '1px solid rgba(52,216,255,0.15)',
          boxShadow: '0 0 20px rgba(52,216,255,0.08)',
          background: 'rgba(2,4,10,0.8)',
          ...(fullHeight ? { display: 'flex', flexDirection: 'column', height: '80vh' } : {}),
        }}
      >
        {/* Marcadores HUD */}
        <span style={{ position: 'absolute', top: 0, left: 0, width: 10, height: 10, borderTop: '2px solid #34d8ff', borderLeft: '2px solid #34d8ff' }} />
        <span style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderTop: '2px solid #34d8ff', borderRight: '2px solid #34d8ff' }} />
        <span style={{ position: 'absolute', bottom: 0, left: 0, width: 10, height: 10, borderBottom: '2px solid #34d8ff', borderLeft: '2px solid #34d8ff' }} />
        <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderBottom: '2px solid #34d8ff', borderRight: '2px solid #34d8ff' }} />

        {(title || onClose) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            {title ? (
              <h2 style={{ color: '#34d8ff', fontFamily: 'monospace', letterSpacing: '0.08em', fontWeight: 700, fontSize: 15, margin: 0 }}>{title}</h2>
            ) : <div />}
            {onClose && (
              <button onClick={onClose} style={{ padding: 4, color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer' }} aria-label="Cerrar">
                <X size={20} />
              </button>
            )}
          </div>
        )}

        <div style={fullHeight ? { flex: 1, overflowY: 'auto' } : {}}>
          {children}
        </div>
      </div>
    </div>
  );
};
