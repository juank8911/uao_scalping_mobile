import React, { useState, useEffect, useRef } from 'react';
import { NeoCard, NeoButton, NeoModal } from 'jeikei-design-system';
import { fetchChartData, type PositionInfo } from '../services/api';
import { createChart, ColorType, CrosshairMode, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { useEngineStore } from '../store/useEngineStore';
import { subscribeCandles, unsubscribeCandles } from '../hooks/useEngineWebSocket';

interface PositionChartModalProps {
  visible: boolean;
  onClose: () => void;
  position: PositionInfo | null;
}

export const PositionChartModal: React.FC<PositionChartModalProps> = ({ visible, onClose, position }) => {
  const posSource = position?.source || 'HFT';
  const defaultTimeframe = posSource === 'TELEGRAM' ? '1h' : '1m';
  const [timeframe, setTimeframe] = useState<string>(defaultTimeframe);
  const [loading, setLoading] = useState(false);

  const candlesSnapshot = useEngineStore((state) => state.candlesSnapshot);
  const latestCandle = useEngineStore((state) => state.latestCandle);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    if (position?.source) {
      setTimeframe(position.source === 'TELEGRAM' ? '1h' : '1m');
    }
  }, [position?.symbol, position?.source]);

  // Init chart inside modal
  useEffect(() => {
    if (visible && chartContainerRef.current) {
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#020202' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: 'rgba(52, 216, 255, 0.04)' },
          horzLines: { color: 'rgba(52, 216, 255, 0.04)' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        timeScale: { timeVisible: true, secondsVisible: false },
        width: chartContainerRef.current.clientWidth || 450,
        height: 250,
      });

      chartRef.current = chart;

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#4ade80',
        downColor: '#f87171',
        borderVisible: false,
        wickUpColor: '#4ade80',
        wickDownColor: '#f87171',
      });

      candlestickSeriesRef.current = candlestickSeries;

      return () => {
        chart.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
      };
    }
  }, [visible]);

  // Subscribe to candles WS + fallback REST
  useEffect(() => {
    if (!visible || !position?.symbol || !candlestickSeriesRef.current) return;

    setLoading(true);
    subscribeCandles(position.symbol, timeframe, posSource);

    fetchChartData(position.symbol, timeframe).then((ohlcv) => {
      if (candlestickSeriesRef.current && ohlcv && ohlcv.length > 0) {
        candlestickSeriesRef.current.setData(ohlcv);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => {
      if (position.symbol) {
        unsubscribeCandles(position.symbol, posSource);
      }
    };
  }, [visible, position?.symbol, timeframe, posSource]);

  useEffect(() => {
    if (visible && candlesSnapshot && candlestickSeriesRef.current) {
      candlestickSeriesRef.current.setData(candlesSnapshot);
    }
  }, [visible, candlesSnapshot]);

  useEffect(() => {
    if (visible && latestCandle && candlestickSeriesRef.current) {
      candlestickSeriesRef.current.update(latestCandle);
    }
  }, [visible, latestCandle]);

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
      title={
        <div className="flex items-center gap-2">
          <span>{position.symbol}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-wide ${posSource === 'TELEGRAM' ? 'bg-purple-900/60 text-purple-300 border border-purple-500/40' : 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/40'}`}>
            {posSource}
          </span>
        </div>
      }
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

        <div style={{ marginTop: 16, marginBottom: 8, display: 'flex', justify: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 700 }}>Temporalidad:</span>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            style={{ background: 'rgba(52, 216, 255, 0.1)', color: '#34d8ff', border: '1px solid rgba(52, 216, 255, 0.2)', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 700, outline: 'none' }}
          >
            <option value="1m" style={{ background: '#000', color: '#34d8ff' }}>1m</option>
            <option value="5m" style={{ background: '#000', color: '#34d8ff' }}>5m</option>
            <option value="15m" style={{ background: '#000', color: '#34d8ff' }}>15m</option>
            <option value="1h" style={{ background: '#000', color: '#34d8ff' }}>1h</option>
            <option value="4h" style={{ background: '#000', color: '#34d8ff' }}>4h</option>
            <option value="1d" style={{ background: '#000', color: '#34d8ff' }}>1d</option>
          </select>
        </div>

        <div style={{ position: 'relative', width: '100%', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', background: '#020202', minHeight: 250 }}>
          {loading && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.5)', zIndex: 10 }}>
              <div style={{ width: 28, height: 28, border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #34d8ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            </div>
          )}
          <div ref={chartContainerRef} style={{ width: '100%', height: 250 }} />
        </div>
      </div>
    </NeoModal>
  );
};
