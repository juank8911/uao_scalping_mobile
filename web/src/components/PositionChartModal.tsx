import React, { useState, useEffect } from 'react';
import { NeoCard, NeoButton } from 'jeikei-design-system';
import { NeoModal } from './NeoModal';
import { PositionInfo, fetchChartData } from '../services/api';

interface PositionChartModalProps {
  visible: boolean;
  onClose: () => void;
  position: PositionInfo | null;
}

export const PositionChartModal: React.FC<PositionChartModalProps> = ({ visible, onClose, position }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && position?.symbol) {
      setLoading(true);
      fetchChartData(position.symbol).then((ohlcv) => {
        setData(ohlcv);
        setLoading(false);
      });
    }
  }, [visible, position?.symbol]);

  if (!position) return null;

  let tpPrice = 0;
  let slPrice = 0;
  let tpDist = 0;
  let slDist = 0;

  if (position.orders && position.orders.length > 0) {
    const tpOrder = position.orders.find(o => o.type === 'TAKE_PROFIT');
    const slOrder = position.orders.find(o => o.type === 'STOP_LOSS');
    if (tpOrder) {
      tpPrice = tpOrder.price;
      tpDist = tpOrder.distance_pct;
    }
    if (slOrder) {
      slPrice = slOrder.price;
      slDist = slOrder.distance_pct;
    }
  }

  const isLong = position.side.toLowerCase() === 'long';

  return (
    <NeoModal visible={visible} onClose={onClose} title={`${position.symbol} (5m)`} fullHeight>
      <div className="flex flex-col h-full min-h-[450px]">
        <NeoCard 
          title="Current Position" 
          value={isLong ? 'LONG' : 'SHORT'} 
          trend={{ value: `${position.unrealizedPnl.toFixed(2)} USDT`, direction: position.unrealizedPnl >= 0 ? 'up' : 'down' }}
        >
          <div className="flex justify-between mt-3">
            <div className="flex-1">
              <p className="text-white/60 text-xs mb-1">Entry Price</p>
              <p className="text-white text-sm font-bold">{position.entryPrice}</p>
            </div>
            <div className="flex-1">
              <p className="text-white/60 text-xs mb-1">Mark Price</p>
              <p className="text-white text-sm font-bold">{position.markPrice}</p>
            </div>
          </div>
          <div className="flex justify-between mt-3">
            <div className="flex-1">
              <p className="text-white/60 text-xs mb-1">Take Profit</p>
              <p className="text-[#4ade80] text-sm font-bold">{tpPrice ? tpPrice : 'N/A'} ({tpDist.toFixed(2)}%)</p>
            </div>
            <div className="flex-1">
              <p className="text-white/60 text-xs mb-1">Stop Loss</p>
              <p className="text-[#f87171] text-sm font-bold">{slPrice ? slPrice : 'N/A'} ({slDist.toFixed(2)}%)</p>
            </div>
          </div>
        </NeoCard>

        <div className="flex-1 flex flex-col justify-center items-center my-5 min-h-[250px] border border-white/10 rounded-xl bg-white/5 relative">
          {loading ? (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          ) : data.length > 0 ? (
            <div className="text-white/60 text-center">
              <p className="mb-2">Gráfico de Velas (Mock)</p>
              <p className="text-xs">Se requiere integrar lightweight-charts u otra librería de web.</p>
              <p className="text-xs mt-2 text-[#34d8ff]">Entry: {position.entryPrice}</p>
            </div>
          ) : (
            <p className="text-[#666] text-center">No chart data available</p>
          )}
        </div>
        
        <div className="h-4" />
        <NeoButton variant="primary" size="md" onClick={onClose}>
          Cerrar Gráfico
        </NeoButton>
      </div>
    </NeoModal>
  );
};
