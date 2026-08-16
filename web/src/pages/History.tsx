import { useEffect, useState } from 'react';
import { NeoLayout, NeoCard, NeoBadge } from '../compat/jeikei-design';
import { getGlobalHistory, type GlobalTradeRecord } from '../services/api';

export default function HistoryScreen() {
  const [history, setHistory] = useState<GlobalTradeRecord[]>([]);
  const [mode, setMode] = useState<'PAPER_TRADING' | 'LIVE'>('PAPER_TRADING');
  const [isLoading, setIsLoading] = useState(true);
  const pnlOf = (trade: GlobalTradeRecord) => Number(trade.pnl ?? 0);

  const fetchHistory = async () => {
    try {
      // Traemos un límite alto (1000) ya que el backend ahora filtra por las últimas 24 horas automáticamente
      const data = await getGlobalHistory(1000, mode);
      setHistory(data.data);
    } catch (e) {
      console.error('Error fetching global history', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
          void fetchHistory();
          const interval = window.setInterval(() => void fetchHistory(), 5000);
          return () => window.clearInterval(interval);
      }, [mode]);

  const totalOrders = history.length;
  const tpOrders = history.filter(t => pnlOf(t) > 0);
  const slOrders = history.filter(t => pnlOf(t) <= 0);
  
  const tpCount = tpOrders.length;
  const slCount = slOrders.length;
  const totalTpUsdt = tpOrders.reduce((sum, t) => sum + pnlOf(t), 0);
  const totalSlUsdt = slOrders.reduce((sum, t) => sum + pnlOf(t), 0);

  return (
    <NeoLayout>
      <div className="p-6 pt-16 md:p-10 pb-32 max-w-4xl mx-auto w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">Historial de Órdenes</h1>
          <p className="text-white/60 text-sm">Registro de posiciones completadas y operaciones ejecutadas.</p>
        </div>

              <div className="mb-6 flex gap-2 rounded-lg border border-white/10 bg-black/20 p-1">
                <button type="button" onClick={() => setMode('PAPER_TRADING')} className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition ${mode === 'PAPER_TRADING' ? 'bg-[#34d8ff] text-black' : 'text-white/60 hover:text-white'}`}>Paper Trading</button>
                <button type="button" onClick={() => setMode('LIVE')} className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition ${mode === 'LIVE' ? 'bg-[#34d8ff] text-black' : 'text-white/60 hover:text-white'}`}>Real Trading</button>
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
                <p className={`text-2xl font-bold ${(totalTpUsdt + totalSlUsdt) >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                  {((totalTpUsdt + totalSlUsdt) > 0 ? '+' : '')}{(totalTpUsdt + totalSlUsdt).toFixed(2)}
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
            {history.map((trade, idx) => (
              <NeoCard key={idx} title={trade.symbol}>
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <NeoBadge
                      label={trade.side === 'LONG' || trade.side === 'BUY' || trade.side === 'buy' ? 'LONG' : 'SHORT'}
                      variant={trade.side === 'LONG' || trade.side === 'BUY' || trade.side === 'buy' ? 'success' : 'danger'}
                    />
                    <div className={`font-bold text-lg ${pnlOf(trade) >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                      PNL: {pnlOf(trade) > 0 ? '+' : ''}{pnlOf(trade).toFixed(2)} USDT
                    </div>
                  </div>
                  
                  <div className="bg-black/20 p-3 rounded-lg flex flex-col gap-1 mt-2">
                    <p className="text-white/90 text-sm"><span className="font-bold text-[#4DA8DA]">Precio Entrada:</span> {trade.entry_price}</p>
                    <p className="text-white/90 text-sm"><span className="font-bold text-[#4DA8DA]">Precio Salida:</span> {trade.exit_price || 'N/A'}</p>
                    {trade.tp_price && <p className="text-white/70 text-xs"><span className="font-bold">Take Profit (TP):</span> {trade.tp_price}</p>}
                    {trade.sl_price && <p className="text-white/70 text-xs"><span className="font-bold">Stop Loss (SL):</span> {trade.sl_price}</p>}
                    <p className="text-white/70 text-xs"><span className="font-bold">Apalancamiento:</span> {trade.leverage}x</p>
                    <p className="text-white/50 text-xs mt-2">
                      Completada: {new Date(trade.closed_at || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </NeoCard>
            ))}
          </div>
        )}
      </div>
    </NeoLayout>
  );
}

