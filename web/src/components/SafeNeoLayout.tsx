import { useMemo, type ReactNode } from 'react';
import { NeoLayout } from 'jeikei-design-system';

interface SafeNeoLayoutProps {
  children: ReactNode;
  className?: string;
}

function canCreateWebGLContext(): boolean {
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext('experimental-webgl');

    const contextLost = Boolean(
      context && typeof (context as WebGLRenderingContext).isContextLost === 'function'
        ? (context as WebGLRenderingContext).isContextLost()
        : false,
    );

    const webglContext = context as WebGLRenderingContext | null;
    const loseContext = webglContext?.getExtension('WEBGL_lose_context');
    loseContext?.loseContext();
    canvas.width = 1;
    canvas.height = 1;

    return Boolean(context) && !contextLost;
  } catch {
    return false;
  }
}

/**
 * NeoLayout crea un renderer Three.js internamente. En navegadores, sesiones
 * remotas o GPUs que bloqueen WebGL se usa un fondo CSS para que la interfaz
 * siga funcionando sin emitir errores de creación de contexto.
 */
export function SafeNeoLayout({ children, className = '' }: SafeNeoLayoutProps) {
  // WebGL queda desactivado por defecto para evitar bloqueos de GPU y dobles
  // contextos en React StrictMode. Se puede habilitar explícitamente con
  // VITE_ENABLE_NEURAL_WEBGL=true cuando el entorno lo soporte.
  const neuralWebGLEnabled = import.meta.env.VITE_ENABLE_NEURAL_WEBGL === 'true';
  const webglAvailable = useMemo(
    () => neuralWebGLEnabled && canCreateWebGLContext(),
    [neuralWebGLEnabled],
  );

  if (!webglAvailable) {
    return (
      <div className={`relative min-h-screen w-full overflow-hidden bg-[#020202] text-white ${className}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(52,216,255,0.10),transparent_45%),linear-gradient(135deg,#020202,#0a0a0a)]" />
        <div className="relative z-10 min-h-screen">{children}</div>
      </div>
    );
  }

  return <NeoLayout>{children}</NeoLayout>;
}
