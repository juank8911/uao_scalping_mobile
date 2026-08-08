/**
 * useEngineStore.ts
 * Store global de Zustand para el engine de trading.
 * Recibe actualizaciones via WebSocket y expone selectores atómicos
 * para evitar re-renderizados masivos en la UI.
 */
import { create } from 'zustand';
import type { SystemStatus, PositionInfo } from '../services/api';

export interface EngineState {
  // --- Estado del sistema ---
  status: SystemStatus | null;
  isConnected: boolean;
  lastUpdated: number;

  // --- Precios en tiempo real (separados para selectores atómicos) ---
  // key: symbol (ej. 'BTC/USDT:USDT'), value: precio actual
  latestPrices: Record<string, number>;

  // --- Posiciones abiertas indexadas por símbolo ---
  openPositions: Record<string, PositionInfo>;

  // --- Actions ---
  setStatus: (status: SystemStatus) => void;
  setConnected: (connected: boolean) => void;
  updatePrice: (symbol: string, price: number) => void;
  updatePosition: (position: PositionInfo) => void;
}

export const useEngineStore = create<EngineState>((set) => ({
  status: null,
  isConnected: false,
  lastUpdated: 0,
  latestPrices: {},
  openPositions: {},

  setStatus: (status: SystemStatus) =>
    set((state) => {
      // Indexar posiciones por símbolo para acceso O(1)
      const positions: Record<string, PositionInfo> = {};
      status.open_positions?.forEach((p) => {
        positions[p.symbol] = p;
      });

      // Actualizar precios desde latest_prices del status (merge con los existentes)
      const prices: Record<string, number> = { ...state.latestPrices };
      if (status.latest_prices) {
        Object.entries(status.latest_prices).forEach(([sym, price]) => {
          prices[sym] = price as number;
        });
      }

      return {
        status,
        openPositions: positions,
        latestPrices: prices,
        lastUpdated: Date.now(),
      };
    }),

  setConnected: (connected: boolean) => set({ isConnected: connected }),

  updatePrice: (symbol: string, price: number) =>
    set((state) => ({
      latestPrices: { ...state.latestPrices, [symbol]: price },
    })),

  updatePosition: (position: PositionInfo) =>
    set((state) => ({
      openPositions: { ...state.openPositions, [position.symbol]: position },
    })),
}));

// ============================================================
// Selectores atómicos (evitan re-render de todo el componente)
// Uso: const btcPrice = usePriceSelector('BTC/USDT:USDT');
// ============================================================

/** Retorna solo el precio de un símbolo específico */
export const usePriceSelector = (symbol: string) =>
  useEngineStore((state) => state.latestPrices[symbol]);

/** Retorna solo la posición de un símbolo específico */
export const usePositionSelector = (symbol: string) =>
  useEngineStore((state) => state.openPositions[symbol]);

/** Retorna el estado del motor sin los precios (evita rerender por tick) */
export const useEngineStatus = () =>
  useEngineStore((state) => state.status);

/** Retorna si el WebSocket está conectado */
export const useIsConnected = () =>
  useEngineStore((state) => state.isConnected);
