import { useCallback, useEffect, useRef, useState } from 'react';
import { NeoCard, NeoBadge } from 'jeikei-design-system';
import { SafeNeoLayout } from '../components/SafeNeoLayout';
import { getGlobalHistory, type ExecutionMode, type GlobalTradeRecord } from '../services/api';

const HISTORY_REFRESH_MS = 5_000;
const CLOSE_EVENTS = new Set(['trade_closed', 'position_closed']);

type WsMessageDetail = {
  event?: string;
};

type HistoryTab = Extract<ExecutionMode, 'PAPER_TRADING' | 'LIVE'>;

const HISTORY_TABS: Array<{ mode: HistoryTab; label: string; description: string }> = [
  { mode: 'PAPER_TRADING', label: 'Paper', description: 'Operaciones simuladas localmente' },
  { mode: 'LIVE', label: 'Real', description: 'Operaciones ejecutadas en OKX' },
];

const EMPTY_HISTORY: Record<HistoryTab, GlobalTradeRecord[]> = {
  PAPER_TRADING: [],
  LIVE: [],
};

const EMPTY_LOADING: Record<HistoryTab, boolean> = {
  PAPER_TRADING: true,
  LIVE: true,
};

export default function HistoryScreen() {
  const [activeMode, setActiveMode] = useState<HistoryTab>('PAPER_TRADING');
  const [historyByMode, setHistoryByMode] = useState<Record<HistoryTab, GlobalTradeRecord[]>>(EMPTY_HISTORY);
  const [loadingByMode, setLoadingByMode] = useState<Record<HistoryTab, boolean>>(EMPTY_LOADING);
  const [lastUpdatedByMode, setLastUpdatedByMode] = useState<Record<HistoryTab, Date | null>>({
    PAPER_TRADING: null,
    LIVE: null,
  });
  const fetchingModes = useRef<Set<HistoryTab>>(new Set());

  const fetchHistory = useCallback(async (mode: HistoryTab, showInitialLoader = false) => {
    if (fetchingModes.current.has(mode)) return;

    fetchingModes.current.add(mode);
    if (showInitialLoader) {
      setLoadingByMode((previous) => ({ ...previous, [mode]: true }));
    }

    try {
      const data = await getGlobalHistory(1000, mode);
      setHistoryByMode((previous) => ({ ...previous, [mode]: data.data }));
      setLastUpdatedByMode((previous) => ({ ...previous, [mode]: new Date() }));
    } catch (error) {
      console.error(`Error fetching ${mode} history`, error);
    } finally {
      setLoadingByMode((previous) => ({ ...previous, [mode]: false }));
      fetchingModes.current.delete(mode);
    }
  }, []);

  useEffect(() => {
    void fetchHistory('PAPER_TRADING', true);
    void fetchHistory('LIVE', true);

    const interval = window.setInterval(() => {
      void fetchHistory('PAPER_TRADING');
      void fetchHistory('LIVE');
    }, HISTORY_REFRESH_MS);

    const handleWsMessage = (event: Event) => {
      const payload = (event as CustomEvent<WsMessageDetail>).detail;
      if (payload?.event && CLOSE_EVENTS.has(payload.event)) {
        void fetchHistory('PAPER_TRADING');
        void fetchHistory('LIVE');
      }
    };

    window.addEventListener('ws:message', handleWsMessage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('ws:message', handleWsMessage);
    };
  }, [fetchHistory]);

  const history = historyByMode[activeMode];
  const isLoading = loadingByMode[activeMode];
  const lastUpdated = lastUpdatedByMode[activeMode];

  const totalOrders = history.length;
  const tpOrders = history.filter((trade) => trade.pnl > 0);
  const slOrders = history.filter((trade) => trade.pnl <= 0);
  const tpCount = tpOrders.length;
  const slCount = slOrders.length;
  const totalTpUsdt = tpOrders.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalSlUsdt = slOrders.reduce((sum, trade) => sum + trade.pnl, 0);
  const totalNetPnl = totalTpUsdt + totalSlUsdt;

  return (
    <SafeNeoLayout>
      <div className="p-6 pt-16 md:p-10 pb-32 max-w-5xl mx-auto w-full">
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Historial de Órdenes</h1>
              <p className="text-white/60 text-sm">Paper y Real están separados para evitar mezclar posiciones y PnL.</p>
            </div>
            <div className="text-right text-xs text-white/40" aria-live="polite">
              <p>Actualización automática cada 5 s</p>
              {lastUpdated && <p>Última actualización: {lastUpdated.toLocaleTimeString()}</p>}
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-black/30 p-2" role="tablist" aria-label="Modo de ejecución del historial">
          {HISTORY_TABS.map((tab) => {
            const isActive = activeMode === tab.mode;
            const count = historyByMode[tab.mode].length;
            return (
              <button
                key={tab.mode}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveMode(tab.mode)}
                className={`rounded-lg px-4 py-3 text-left transition-colors ${
                  isActive
                    ? tab.mode === 'PAPER_TRADING'
                      ? 'bg-[#34d8ff]/20 text-[#34d8ff] ring-1 ring-[#34d8ff]/50'
                      : 'bg-[#ffb347]/20 text-[#ffb347] ring-1 ring-[#ffb347]/50'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-bold">{tab.label}</span>
                  <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs">{count}</span>
                </span>
                <span className="mt-1 block text-xs opacity-70">{tab.description}</span>
              </button>
            );
          })}
        </div>

        <div className="mb-5 flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-4 py-3">
          <div>
            <p className="text-sm font-bold text-white">Historial {activeMode === 'PAPER_TRADING' ? 'Paper' : 'Real'}</p>
            <p className="text-xs text-white/50">Solo se muestran registros con execution_mode={activeMode}.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${activeMode === 'PAPER_TRADING' ? 'bg-[#34d8ff]/15 text-[#34d8ff]' : 'bg-[#ffb347]/15 text-[#ffb347]'}`}>
            {activeMode}
          </span>
        </div>

        {!isLoading && history.length > 0 && (
          <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <NeoCard>
              <div className="text-center">
                <p className="text-white/60 text-xs mb-1">Total Órdenes</p>
                <p className="text-2xl font-bold text-white">{totalOrders}</p>
              </div>
            </NeoCard>
            <NeoCard>
              <div className="text-center">
                <p className="text-white/60 text-xs mb-1">Operaciones TP</p>
                <p className="text-2xl font-bold text-[#00ff88]">{tpCount}</p>
                <p className="text-xs text-[#00ff88]/80 mt-1">+{totalTpUsdt.toFixed(2)} USDT</p>
              </div>
            </NeoCard>
            <NeoCard>
              <div className="text-center">
                <p className="text-white/60 text-xs mb-1">Operaciones SL</p>
                <p className="text-2xl font-bold text-[#ff3366]">{slCount}</p>
                <p className="text-xs text-[#ff3366]/80 mt-1">{totalSlUsdt.toFixed(2)} USDT</p>
              </div>
            </NeoCard>
            <NeoCard>
              <div className="text-center">
                <p className="text-white/60 text-xs mb-1">PnL Neto</p>
                <p className={`text-2xl font-bold ${totalNetPnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                  {totalNetPnl > 0 ? '+' : ''}{totalNetPnl.toFixed(2)}
                </p>
                <p className="text-xs text-white/40 mt-1">USDT</p>
              </div>
            </NeoCard>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#34d8ff]"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center text-white/40 text-lg mt-20">
            No hay operaciones {activeMode === 'PAPER_TRADING' ? 'Paper' : 'Reales'} recientes
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((trade, index) => {
              const isLong = trade.side === 'LONG' || trade.side === 'BUY' || trade.side === 'buy';
              return (
                <NeoCard key={`${trade.symbol}-${trade.closed_at}-${trade.exit_price}-${index}`} title={trade.symbol}>
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <NeoBadge
                        children={isLong ? 'LONG' : 'SHORT'}
                        variant={isLong ? 'success' : 'danger'}
                      />
                      <div className={`font-bold text-lg ${trade.pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                        PNL: {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)} USDT
                      </div>
                    </div>

                    <div className="bg-black/20 p-3 rounded-lg flex flex-col gap-1 mt-2">
                      <p className="text-white/90 text-sm"><span className="font-bold text-[#4DA8DA]">Precio Entrada:</span> {trade.entry_price}</p>
                      <p className="text-white/90 text-sm"><span className="font-bold text-[#4DA8DA]">Precio Salida:</span> {trade.exit_price || 'N/A'}</p>
                      {trade.tp_price && <p className="text-white/70 text-xs"><span className="font-bold">Take Profit (TP):</span> {trade.tp_price}</p>}
                      {trade.sl_price && <p className="text-white/70 text-xs"><span className="font-bold">Stop Loss (SL):</span> {trade.sl_price}</p>}
                      <p className="text-white/70 text-xs"><span className="font-bold">Apalancamiento:</span> {trade.leverage}x</p>
                      <p className="text-white/50 text-xs mt-2">
                        Completada: {trade.closed_at ? new Date(trade.closed_at).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>
                </NeoCard>
              );
            })}
          </div>
        )}
      </div>
    </SafeNeoLayout>
  );
}
