import React, { useState, useEffect } from 'react';
import { NeoCard, NeoButton, NeoModal } from 'jeikei-design-system';
import { fetchChartData } from '../services/api';
import type { PositionInfo } from '../services/api';

interface PositionChartModalProps {
  visible: boolean;
  onClose: () => void;
  position: PositionInfo | null;
}

export const PositionChartModal: React.FC<PositionChartModalProps> = ({ visible, onClose, position }) => {
  const [_data, setData] = useState<any[]>([]);
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
    if (tpOrder) { tpPrice = tpOrder.price; tpDist = tpOrder.distance_pct; }
    if (slOrder) { slPrice = slOrder.price; slDist = slOrder.distance_pct; }
  }

  const isShort = position.side.toUpperCase() === 'SHORT' || position.side.toUpperCase() === 'SELL';
  const csz = position.contractSize || 1;
  const markP = position.markPrice || position.entryPrice;
  const calculatedPnl = isShort
    ? (position.entryPrice - markP) * position.contracts * csz
    : (markP - position.entryPrice) * position.contracts * csz;

  return (
    <NeoModal 
      open={visible} 
      onClose={onClose} 
      title={`${position.symbol} (5m)`}
      footer={
        <NeoButton variant="primary" size="md" onClick={onClose}>
          Cerrar
        </NeoButton>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 450 }}>
        <NeoCard
          title="Current Position"
          value={isShort ? 'SHORT 🔴' : 'LONG 🟢'}
          trend={{ value: `${calculatedPnl > 0 ? '+' : ''}${calculatedPnl.toFixed(2)} USDT`, direction: calculatedPnl >= 0 ? 'up' : 'down' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '0 0 4px' }}>Entry Price</p>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{position.entryPrice}</p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '0 0 4px' }}>Mark Price</p>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 700, margin: 0, fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>{markP}</p>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '0 0 4px' }}>Take Profit</p>
              <p style={{ color: '#4ade80', fontSize: 13, fontWeight: 700, margin: 0 }}>{tpPrice ? tpPrice : 'N/A'} ({tpDist.toFixed(2)}%)</p>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '0 0 4px' }}>Stop Loss</p>
              <p style={{ color: '#f87171', fontSize: 13, fontWeight: 700, margin: 0 }}>{slPrice ? slPrice : 'N/A'} ({slDist.toFixed(2)}%)</p>
            </div>
          </div>
        </NeoCard>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', margin: '20px 0', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, background: 'rgba(255,255,255,0.03)', minHeight: 200 }}>
          {loading ? (
            <div style={{ width: 32, height: 32, border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          ) : (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
              <p style={{ marginBottom: 8 }}>Gráfico disponible en Chart</p>
              <p style={{ color: '#34d8ff', fontSize: 13 }}>Entry: {position.entryPrice}</p>
            </div>
          )}
        </div>
      </div>
    </NeoModal>
  );
};
