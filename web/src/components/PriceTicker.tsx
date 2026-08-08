/**
 * PriceTicker.tsx
 * Componente atómico de precio en tiempo real.
 * Se suscribe SOLO al precio de su símbolo en Zustand usando un selector
 * específico → solo este componente re-renderiza cuando cambia el precio,
 * no el Dashboard entero.
 * 
 * Esto elimina el "UI Jitter" (temblor del layout) en HFT.
 */
import React, { useRef } from 'react';
import { usePriceSelector } from '../store/useEngineStore';

interface PriceTickerProps {
  symbol: string;
  /** Número de decimales para el precio (default: 7 para crypto micro-cap) */
  decimals?: number;
  /** Clase CSS adicional */
  className?: string;
  /** Prefijo opcional (ej. '$') */
  prefix?: string;
}

const PriceTicker: React.FC<PriceTickerProps> = ({
  symbol,
  decimals = 7,
  className = '',
  prefix = '$',
}) => {
  const price = usePriceSelector(symbol);
  const prevPrice = useRef<number | undefined>(undefined);

  if (price == null) {
    return (
      <span className={`tabular-nums font-mono text-white/40 ${className}`}>
        —
      </span>
    );
  }

  // Indicador visual de dirección del tick (verde/rojo pulsante)
  const isUp = prevPrice.current !== undefined && price > prevPrice.current;
  const isDown = prevPrice.current !== undefined && price < prevPrice.current;
  prevPrice.current = price;

  const colorClass = isUp
    ? 'text-[#00ff88]'
    : isDown
    ? 'text-[#ff3366]'
    : 'text-white';

  return (
    <span
      className={`tabular-nums font-mono transition-colors duration-150 ${colorClass} ${className}`}
    >
      {prefix}{price.toFixed(decimals)}
    </span>
  );
};

export default PriceTicker;
