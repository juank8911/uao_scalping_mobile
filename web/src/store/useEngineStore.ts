import { create } from 'zustand';
import type { Candle, OrderInfo, PositionInfo, SystemStatus, GlobalTradeRecord } from '../services/api';

export interface BalanceState { wallet_balance?: number; available_balance?: number; equity?: number; margin_used?: number; unrealized_pnl?: number; realized_pnl?: number; [key: string]: unknown; }
export interface EngineState {
  status: SystemStatus | null;
  isConnected: boolean;
  latestPrices: Record<string, number>;
  openPositions: Record<string, PositionInfo>;
  openOrders: Record<string, OrderInfo>;
  candles: Record<string, Candle[]>;
  balance: BalanceState | null;
  trades: GlobalTradeRecord[];
  setStatus: (status: SystemStatus) => void;
  setConnected: (connected: boolean) => void;
  updatePrice: (symbol: string, price: number) => void;
  updatePosition: (position: PositionInfo) => void;
  updateOrders: (orders: OrderInfo[]) => void;
  updateOrder: (order: OrderInfo) => void;
  updateBalance: (balance: BalanceState) => void;
  updateCandle: (symbol: string, timeframe: string, candle: Candle) => void;
  addTrade: (trade: GlobalTradeRecord) => void;
  applySnapshot: (snapshot: any) => void;
}
const candleKey = (symbol: string, timeframe: string) => `${symbol}:${timeframe}`;
export const useEngineStore = create<EngineState>((set) => ({
  status: null, isConnected: false, latestPrices: {}, openPositions: {}, openOrders: {}, candles: {}, balance: null, trades: [],
  setStatus: (status) => set((state) => {
    const positions = { ...state.openPositions };
    (status.open_positions || []).forEach((p) => { positions[p.symbol] = p; });
    const orders = { ...state.openOrders };
    (status.open_orders || []).forEach((o) => { if (o.id != null) orders[String(o.id)] = o; });
    const prices = { ...state.latestPrices, ...(status.latest_prices || {}) };
    return { status, openPositions: positions, openOrders: orders, latestPrices: prices };
  }),
  setConnected: (isConnected) => set({ isConnected }),
  updatePrice: (symbol, price) => set((state) => ({ latestPrices: { ...state.latestPrices, [symbol]: price } })),
  updatePosition: (position) => set((state) => ({ openPositions: { ...state.openPositions, [position.symbol]: position } })),
  updateOrders: (orders) => set(() => { const next: Record<string, OrderInfo> = {}; orders.forEach((o) => { if (o.id != null) next[String(o.id)] = o; }); return { openOrders: next }; }),
  updateOrder: (order) => set((state) => { const next = { ...state.openOrders }; if (order.id != null) { if (order.status === 'CANCELED' || order.status === 'FILLED' || order.status === 'CLOSED') delete next[String(order.id)]; else next[String(order.id)] = order; } return { openOrders: next }; }),
  updateBalance: (balance) => set({ balance }),
  updateCandle: (symbol, timeframe, candle) => set((state) => { const key = candleKey(symbol, timeframe); const previous = state.candles[key] || []; const index = previous.findIndex((item) => item.time === candle.time); const next = [...previous]; if (index >= 0) next[index] = candle; else next.push(candle); next.sort((a, b) => a.time - b.time); return { candles: { ...state.candles, [key]: next.slice(-1000) } }; }),
  addTrade: (trade) => set((state) => ({ trades: [trade, ...state.trades.filter((t) => !(t.symbol === trade.symbol && t.closed_at === trade.closed_at))].slice(0, 500) })),
  applySnapshot: (snapshot) => set((state) => { const positions: Record<string, PositionInfo> = {}; (snapshot.open_positions || []).forEach((p: PositionInfo) => { positions[p.symbol] = p; }); const orders: Record<string, OrderInfo> = {}; (snapshot.open_orders || []).forEach((o: OrderInfo) => { if (o.id != null) orders[String(o.id)] = o; }); return { status: snapshot, balance: snapshot.balance || state.balance, openPositions: positions, openOrders: orders, latestPrices: { ...state.latestPrices, ...(snapshot.latest_prices || {}) } }; }),
}));
export const usePriceSelector = (symbol: string) => useEngineStore((state) => state.latestPrices[symbol]);
export const usePositionSelector = (symbol: string) => useEngineStore((state) => state.openPositions[symbol]);
export const useEngineStatus = () => useEngineStore((state) => state.status);
export const useIsConnected = () => useEngineStore((state) => state.isConnected);
