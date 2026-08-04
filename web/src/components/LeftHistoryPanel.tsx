import React, { useEffect, useState } from 'react';
import { getGlobalHistory, type GlobalTradeRecord } from '../services/api';
import { ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';

export const LeftHistoryPanel: React.FC = () => {
  const [history, setHistory] = useState<GlobalTradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const data = await getGlobalHistory(20);
      setHistory(data.data);
    } catch (e) {
      console.error('Error fetching global history', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // Si la diferencia es negativa, significa que la fecha está en el futuro 
    // (a veces pasa por diferencias de zona horaria), en ese caso mostramos "Justo ahora"
    if (diffMs < 0) return 'Justo ahora';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  };

  return (
    <div className="w-72 h-full border-r border-[#34d8ff]/20 bg-[#020202]/80 backdrop-blur-xl flex flex-col hidden md:flex">
      <div className="p-4 border-b border-[#34d8ff]/10">
        <h2 className="text-[#34d8ff] font-bold text-sm tracking-widest uppercase">Historial Global</h2>
        <p className="text-white/40 text-xs">Últimas 20 operaciones</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex justify-center items-center h-20">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#34d8ff]"></div>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center text-white/40 text-sm mt-10">
            No hay operaciones recientes
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((trade, idx) => (
              <div key={idx} className="bg-black/40 p-3 rounded-lg border border-white/5 hover:border-[#34d8ff]/20 transition-colors">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${trade.side === 'LONG' ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-[#ff3366]/20 text-[#ff3366]'}`}>
                      {trade.side}
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
                    <p className="text-white/60 text-[10px]"><span className="font-bold text-[#4DA8DA]">Ent:</span> {trade.entry_price} &rarr; <span className="font-bold text-[#4DA8DA]">Sal:</span> {trade.exit_price}</p>
                    <p className="text-white/40 text-[10px]">
                      {trade.tp_price ? `TP: ${trade.tp_price} ` : ''} 
                      {trade.sl_price ? `SL: ${trade.sl_price}` : ''}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 font-bold text-sm ${trade.pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                    {trade.pnl >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                    {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
