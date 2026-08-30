/**
 * useEngineStore.ts
 * Store global de Zustand para el engine de trading.
 * Recibe actualizaciones via WebSocket y expone selectores atómicos
 * para evitar re-renderizados masivos en la UI.
 */
import { create } from 'zustand';
import type { SystemStatus, PositionInfo, StandaloneOrderInfo } from '../services/api';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

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

  // --- Órdenes abiertas ---
  openOrders: StandaloneOrderInfo[];

  // --- Velas WebSocket ---
  candlesSnapshot: Candle[] | null;
  latestCandle: Candle | null;

  // --- Actions ---
  setStatus: (status: SystemStatus) => void;
  setSnapshot: (data: { open_positions?: PositionInfo[]; open_orders?: StandaloneOrderInfo[]; latest_prices?: Record<string, number> }) => void;
  setConnected: (connected: boolean) => void;
  updatePrice: (symbol: string, price: number) => void;
  updatePosition: (position: PositionInfo) => void;
  setCandlesSnapshot: (candles: Candle[]) => void;
  updateCandle: (candle: Candle) => void;
}

export const useEngineStore = create<EngineState>((set) => ({
  status: null,
  isConnected: false,
  lastUpdated: 0,
  latestPrices: {},
  openPositions: {},
  openOrders: [],
  candlesSnapshot: null,
  latestCandle: null,

  setStatus: (status: SystemStatus) =>
    set((state) => {
      const positions: Record<string, PositionInfo> = {};
      status.open_positions?.forEach((p) => {
        positions[p.symbol] = p;
      });

      const prices: Record<string, number> = { ...state.latestPrices };
      if (status.latest_prices) {
        Object.entries(status.latest_prices).forEach(([sym, price]) => {
          prices[sym] = price as number;
        });
      }

      return {
        status,
        openPositions: positions,
        openOrders: status.open_orders || [],
        latestPrices: prices,
        lastUpdated: Date.now(),
      };
    }),

  setSnapshot: (data) =>
    set((state) => {
      const positions: Record<string, PositionInfo> = {};
      data.open_positions?.forEach((p) => {
        positions[p.symbol] = p;
      });

      const prices: Record<string, number> = { ...state.latestPrices };
      if (data.latest_prices) {
        Object.entries(data.latest_prices).forEach(([sym, price]) => {
          prices[sym] = price as number;
        });
      }

      const updatedStatus = state.status
        ? {
            ...state.status,
            open_positions: data.open_positions ?? state.status.open_positions,
            open_orders: data.open_orders ?? state.status.open_orders,
            latest_prices: data.latest_prices ?? state.status.latest_prices,
          }
        : null;

      return {
        status: updatedStatus,
        openPositions: positions,
        openOrders: data.open_orders || state.openOrders,
        latestPrices: prices,
        lastUpdated: Date.now(),
      };
    }),

  setConnected: (connected: boolean) => set({ isConnected: connected }),

  updatePrice: (symbol: string, price: number) =>
    set((state) => {
      const updatedPrices = { ...state.latestPrices, [symbol]: price };
      const updatedPositions = { ...state.openPositions };

      if (updatedPositions[symbol]) {
        const pos = updatedPositions[symbol];
        const isShort = pos.side.toUpperCase() === 'SHORT' || pos.side.toUpperCase() === 'SELL';
        const contractSize = pos.contractSize || 1;
        const unrealizedPnl = isShort
          ? (pos.entryPrice - price) * pos.contracts * contractSize
          : (price - pos.entryPrice) * pos.contracts * contractSize;

        updatedPositions[symbol] = {
          ...pos,
          markPrice: price,
          unrealizedPnl,
        };
      }

      const updatedStatus = state.status
        ? {
            ...state.status,
            latest_prices: updatedPrices,
            open_positions: Object.values(updatedPositions),
          }
        : null;

      return {
        latestPrices: updatedPrices,
        openPositions: updatedPositions,
        status: updatedStatus,
      };
    }),

  updatePosition: (position: PositionInfo) =>
    set((state) => ({
      openPositions: { ...state.openPositions, [position.symbol]: position },
    })),

  setCandlesSnapshot: (candles: Candle[]) =>
    set({ candlesSnapshot: candles, latestCandle: null }),

  updateCandle: (candle: Candle) =>
    set({ latestCandle: candle }),
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
