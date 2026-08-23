import React, { useEffect, useState } from 'react';
import { getConfig, getGlobalHistory, type ExecutionMode, type GlobalTradeRecord } from '../services/api';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

export const LeftHistoryPanel: React.FC = () => {
  const [history, setHistory] = useState<GlobalTradeRecord[]>([]);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>('PAPER_TRADING');
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const config = await getConfig();
      const configuredMode: ExecutionMode = config.execution_mode === 'LIVE' || config.execution_mode === 'TESTNET'
        ? config.execution_mode
        : 'PAPER_TRADING';
      setExecutionMode(configuredMode);
      const data = await getGlobalHistory(20, configuredMode);
      setHistory(data.data);
    } catch (error) {
      console.error(`Error fetching ${executionMode} history`, error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchHistory();
    const interval = window.setInterval(() => void fetchHistory(), 10000);
    return () => window.clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) return 'Justo ahora';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  const modeLabel = executionMode === 'PAPER_TRADING' ? 'Paper' : executionMode === 'LIVE' ? 'Real' : 'Testnet';
  const modeColor = executionMode === 'PAPER_TRADING' ? '#34d8ff' : '#ffb347';

  return (
    <div className="w-72 h-full border-r border-[#34d8ff]/20 bg-[#020202]/80 backdrop-blur-xl flex flex-col hidden md:flex">
      <div className="p-4 border-b border-[#34d8ff]/10">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-sm tracking-widest uppercase" style={{ color: modeColor }}>
            Historial {modeLabel}
          </h2>
          <span className="rounded-full bg-white/5 px-2 py-1 text-[10px] font-bold" style={{ color: modeColor }}>
            {executionMode}
          </span>
        </div>
        <p className="text-white/40 text-xs">Últimas 20 operaciones del modo actual</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center items-center h-20">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#34d8ff]"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center text-white/40 text-sm mt-10">
            No hay operaciones {modeLabel} recientes
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((trade, index) => {
              const isLong = trade.side === 'LONG' || trade.side === 'BUY' || trade.side === 'buy';
              return (
                <div key={`${trade.symbol}-${trade.closed_at}-${index}`} className="bg-black/40 p-3 rounded-lg border border-white/5 hover:border-[#34d8ff]/20 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isLong ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-[#ff3366]/20 text-[#ff3366]'}`}>
                        {isLong ? 'LONG' : 'SHORT'}
                      </span>
                      <span className="text-white font-bold text-sm">{trade.symbol}</span>
                    </div>
                    <div className="flex items-center gap-1 text-white/40 text-xs">
                      <Clock size={10} />
                      {formatTimeAgo(trade.closed_at)}
                    </div>
                  </div>

                  <div className="flex justify-between items-end mt-1">
                    <div>
                      <p className="text-white/60 text-[10px]"><span className="font-bold text-[#4DA8DA]">Ent:</span> {trade.entry_price} → <span className="font-bold text-[#4DA8DA]">Sal:</span> {trade.exit_price}</p>
                      <p className="text-white/40 text-[10px]">
                        {trade.tp_price ? `TP: ${trade.tp_price} ` : ''}
                        {trade.sl_price ? `SL: ${trade.sl_price}` : ''}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 font-bold text-sm ${(trade.pnl || 0) >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                      {(trade.pnl || 0) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {(trade.pnl || 0) > 0 ? '+' : ''}{(trade.pnl || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
