import { useCallback, useEffect, useRef, useState } from 'react';
import { NeoLayout, NeoCard, NeoBadge } from 'jeikei-design-system';
import { getGlobalHistory, type GlobalTradeRecord } from '../services/api';

const HISTORY_REFRESH_MS = 5_000;
const CLOSE_EVENTS = new Set(['trade_closed', 'position_closed']);

type WsMessageDetail = {
  event?: string;
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<GlobalTradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const isFetching = useRef(false);

  const fetchHistory = useCallback(async (showInitialLoader = false) => {
    if (isFetching.current) return;

    isFetching.current = true;
    if (showInitialLoader) setIsLoading(true);

    try {
      // El backend filtra por modo de ejecución y por las últimas 24 horas.
      const data = await getGlobalHistory(1000);
      setHistory(data.data);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Error fetching global history', e);
    } finally {
      if (showInitialLoader) setIsLoading(false);
      isFetching.current = false;
    }
  }, []);

  useEffect(() => {
    void fetchHistory(true);

    // El polling garantiza la actualización aunque el cierre se produzca
    // mientras el WebSocket esté reconectando o no emita un evento de cierre.
    const interval = window.setInterval(() => {
      void fetchHistory(false);
    }, HISTORY_REFRESH_MS);

    // Si el backend emite un evento de cierre, actualizar inmediatamente sin
    // esperar al siguiente intervalo. El polling permanece como fallback.
    const handleWsMessage = (event: Event) => {
      const payload = (event as CustomEvent<WsMessageDetail>).detail;
      if (payload?.event && CLOSE_EVENTS.has(payload.event)) {
        void fetchHistory(false);
      }
    };

    window.addEventListener('ws:message', handleWsMessage);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('ws:message', handleWsMessage);
    };
  }, [fetchHistory]);

  const totalOrders = history.length;
  const tpOrders = history.filter(t => t.pnl > 0);
  const slOrders = history.filter(t => t.pnl <= 0);

  const tpCount = tpOrders.length;
  const slCount = slOrders.length;
  const totalTpUsdt = tpOrders.reduce((sum, t) => sum + t.pnl, 0);
  const totalSlUsdt = slOrders.reduce((sum, t) => sum + t.pnl, 0);
  const totalNetPnl = totalTpUsdt + totalSlUsdt;

  return (
    <NeoLayout>
      <div className="p-6 pt-16 md:p-10 pb-32 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Historial de Órdenes</h1>
              <p className="text-white/60 text-sm">Registro de posiciones completadas y operaciones ejecutadas.</p>
            </div>
            <div className="text-right text-xs text-white/40" aria-live="polite">
              <p>Actualización automática cada 5 s</p>
              {lastUpdated && <p>Última actualización: {lastUpdated.toLocaleTimeString()}</p>}
            </div>
          </div>
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
            No hay operaciones recientes
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((trade, idx) => {
              const isLong = trade.side === 'LONG' || trade.side === 'BUY' || trade.side === 'buy';
              return (
                <NeoCard key={`${trade.symbol}-${trade.closed_at}-${trade.exit_price}-${idx}`} title={trade.symbol}>
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
                        Completada: {new Date(trade.closed_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </NeoCard>
              );
            })}
          </div>
        )}
      </div>
    </NeoLayout>
  );
}
