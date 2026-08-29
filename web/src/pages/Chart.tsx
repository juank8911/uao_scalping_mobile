import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { NeoLayout, NeoCard, NeoBadge, NeoButton, NeoModal } from 'jeikei-design-system';
import { getStatus, getCredentials, fetchChartData, fetchChartTrades, fetchChartHistory, closePosition } from '../services/api';
import type { ChartHistoryRecord, PositionInfo } from '../services/api';

import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useEngineStore } from '../store/useEngineStore';
import { useEngineWebSocket, subscribeCandles, unsubscribeCandles } from '../hooks/useEngineWebSocket';

export default function ChartScreen() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialSymbol = queryParams.get('symbol');

  // --- Estado global (Zustand) ---
  const status = useEngineStore((state) => state.status);
  const candlesSnapshot = useEngineStore((state) => state.candlesSnapshot);
  const latestCandle = useEngineStore((state) => state.latestCandle);

  // --- Estado local de UI ---
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(initialSymbol);
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [closingPos, setClosingPos] = useState(false);
  const [history, setHistory] = useState<ChartHistoryRecord[]>([]);

  const openPositionSymbols = (status?.open_positions ?? [])
    .map((position) => position.symbol)
    .filter((symbol, index, symbols) => symbols.indexOf(symbol) === index);

  // --- WebSocket global para el símbolo seleccionado ---
  useEngineWebSocket(selectedSymbol);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const currentLinesRef = useRef<any[]>([]);

  const currentPos = status?.open_positions?.find(p => p.symbol === selectedSymbol);
  const currentOrder = status?.open_orders?.find(o => o.symbol === selectedSymbol);
  const symbolSource: 'HFT' | 'TELEGRAM' = currentPos?.source || currentOrder?.source || 'HFT';

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      await getCredentials();
      if (!isMounted || !status) return;

      if (!selectedSymbol && openPositionSymbols.length > 0) {
        setSelectedSymbol(openPositionSymbols[0]);
      }
      setIsLoading(false);
    };

    fetchData();
    return () => { isMounted = false; };
  }, [status]);

  // Set default timeframe based on source when symbol changes
  useEffect(() => {
    if (!selectedSymbol) return;
    const pos = status?.open_positions?.find(p => p.symbol === selectedSymbol);
    const ord = status?.open_orders?.find(o => o.symbol === selectedSymbol);
    const src = pos?.source || ord?.source || 'HFT';
    setTimeframe(src === 'TELEGRAM' ? '1h' : '1m');
  }, [selectedSymbol]);

  // Init chart
  useEffect(() => {
    if (chartContainerRef.current) {
      const handleResize = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#020202' },
          textColor: '#d1d4dc',
        },
        grid: {
          vertLines: { color: 'rgba(52, 216, 255, 0.04)' },
          horzLines: { color: 'rgba(52, 216, 255, 0.04)' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
        width: chartContainerRef.current.clientWidth,
        height: 350,
      });

      chartRef.current = chart;

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: '#4ade80',
        downColor: '#f87171',
        borderVisible: false,
        wickUpColor: '#4ade80',
        wickDownColor: '#f87171',
        priceFormat: {
          type: 'price',
          precision: 7,
          minMove: 0.0000001,
        },
                autoscaleInfoProvider: (original: () => any) => {

          const res = original();
          if (res && res.priceRange) {
            let minPrice = res.priceRange.minValue;
            let maxPrice = res.priceRange.maxValue;
            if (currentLinesRef.current && currentLinesRef.current.length > 0) {
              currentLinesRef.current.forEach(item => {
                if (item && item.price) {
                  if (item.price < minPrice) minPrice = item.price;
                  if (item.price > maxPrice) maxPrice = item.price;
                }
              });
              // Add a small margin
              const margin = (maxPrice - minPrice) * 0.05;
              res.priceRange = { minValue: minPrice - margin, maxValue: maxPrice + margin };
            }
          }
          return res;
        }
      });

      candlestickSeriesRef.current = candlestickSeries;

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
        chartRef.current = null;
        candlestickSeriesRef.current = null;
      };
    }
  }, [selectedSymbol]); // Re-init chart on symbol change to clear everything

  // Subscribe to WS candles & fallback REST fetch
  useEffect(() => {
    let isMounted = true;
    if (!selectedSymbol || !candlestickSeriesRef.current || !chartRef.current) return;

    // Suscribir por WS
    subscribeCandles(selectedSymbol, timeframe, symbolSource);

    const loadBaseData = async () => {
      try {
        const data = await fetchChartData(selectedSymbol, timeframe);
        const historyData = await fetchChartHistory(selectedSymbol);

        if (!isMounted) return;
        setHistory(historyData);

        const series = candlestickSeriesRef.current;
        if (series && data && data.length > 0) {
          series.setData(data);
        }
      } catch (err) {
        console.error("Error loading base chart data:", err);
      }
    };

    loadBaseData();

    return () => {
      isMounted = false;
      if (selectedSymbol) {
        unsubscribeCandles(selectedSymbol, symbolSource);
      }
    };
  }, [selectedSymbol, timeframe, symbolSource]);

  // Handle live candles snapshot from WS store
  useEffect(() => {
    if (candlesSnapshot && candlestickSeriesRef.current) {
      candlestickSeriesRef.current.setData(candlesSnapshot);
    }
  }, [candlesSnapshot]);

  // Handle live single candle update from WS store
  useEffect(() => {
    if (latestCandle && candlestickSeriesRef.current) {
      candlestickSeriesRef.current.update(latestCandle);
    }
  }, [latestCandle]);

  // Handle overlays (trades, lines) independently
  useEffect(() => {
    let isMounted = true;
    if (!selectedSymbol || !candlestickSeriesRef.current) return;

    const updateOverlays = async () => {
      try {
        const trades = await fetchChartTrades(selectedSymbol);
        if (!isMounted) return;

        const series = candlestickSeriesRef.current;
        if (!series) return;

        series.setMarkers([]);
        if (trades && trades.length > 0) {
          const markers = trades.map((t: any) => ({
            time: t.time,
            position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
            color: t.side === 'buy' ? '#4ade80' : '#f87171',
            shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
            text: t.side === 'buy' ? 'B' : 'S'
          }));
          markers.sort((a: any, b: any) => a.time - b.time);

          const uniqueMarkers: any[] = [];
          let lastTime = 0;
          for (let m of markers) {
            if (m.time !== lastTime) {
              uniqueMarkers.push(m);
              lastTime = m.time;
            }
          }
          if (uniqueMarkers.length > 0) {
            series.setMarkers(uniqueMarkers);
          }
        }

        const currentPosition = status?.open_positions?.find(p => p.symbol === selectedSymbol);
        const standaloneOrders = status?.open_orders?.filter(o => o.symbol === selectedSymbol) || [];
        const activePosition = currentPosition;

        const rawChartOrders: any[] = [
          ...standaloneOrders,
          ...(activePosition ? [{
            ...activePosition,
            price: activePosition.entryPrice,
            type: 'POSITION'
          }] : []),
          ...(activePosition?.orders ? activePosition.orders.map((o: any) => ({
            ...o,
            side: activePosition.side.toLowerCase() === 'buy' || activePosition.side.toLowerCase() === 'long' ? 'SELL' : 'BUY'
          })) : [])
        ];

        const chartOrders = rawChartOrders.filter((value, index, self) =>
          index === self.findIndex((t) => (
            t.price === value.price && t.type === value.type
          ))
        );

        if (currentPosition && currentPosition.entryPrice) {
          const side = currentPosition.side.toLowerCase();
          const isLong = side === 'buy' || side === 'long';
          const assumedFee = 0.0010;
          const bePrice = isLong
            ? currentPosition.entryPrice * (1 + assumedFee)
            : currentPosition.entryPrice * (1 - assumedFee);

          chartOrders.push({
            price: bePrice,
            type: 'BREAK-EVEN',
            side: isLong ? 'SELL' : 'BUY'
          });
        }

        if (currentPosition && currentPosition.liquidationPrice) {
          const isShort = currentPosition.side.toLowerCase() === 'short' || currentPosition.side.toLowerCase() === 'sell';
          chartOrders.push({
            price: currentPosition.liquidationPrice,
            type: 'LIQUIDATION',
            side: isShort ? 'BUY' : 'SELL'
          });
        }

        currentLinesRef.current.forEach(item => series.removePriceLine(item.line || item));
        currentLinesRef.current = [];

        if (chartOrders) {
          chartOrders.forEach(ord => {
            let lineColor = ord.side === 'BUY' ? '#4ade80' : '#f87171';
            let titleText = ord.type;
            let style = 2; // 2 = Dashed
            let labelVisible = true;

            const t = ord.type ? ord.type.toUpperCase() : '';
            if (t.includes('TAKE_PROFIT') || t.includes('TAKEPROFIT')) { lineColor = '#4ade80'; titleText = 'TP'; }
            else if (t.includes('STOP_LOSS') || t.includes('STOPLOSS')) { lineColor = '#f87171'; titleText = 'SL'; }
            else if (t === 'BREAK-EVEN') { lineColor = '#fbbf24'; titleText = 'B_E'; }
            else if (t === 'LIQUIDATION') { lineColor = '#a855f7'; titleText = 'LIQ'; }
            else if (t === 'POSITION') { titleText = ''; style = 0; lineColor = '#6b7280'; labelVisible = false; }

            const line = series.createPriceLine({
              price: ord.price,
              color: lineColor,
              lineWidth: 2,
              lineStyle: style,
              axisLabelVisible: labelVisible,
              title: titleText,
            });
            currentLinesRef.current.push({
              line,
              type: ord.type,
              price: ord.price,
              baseTitleText: titleText
            });
          });
        }

      } catch (err) {
        console.error("Error updating chart overlays:", err);
      }
    };

    updateOverlays();

    return () => {
      isMounted = false;
    };
  }, [selectedSymbol, status]);

  const activePosition: PositionInfo | undefined = status?.open_positions?.find(
    (p) => p.symbol === selectedSymbol
  );



  const isShortActive = activePosition
    ? (activePosition.side.toUpperCase() === 'SHORT' || activePosition.side.toUpperCase() === 'SELL')
    : false;
  const contractSizeActive = activePosition?.contractSize || 1;

  const livePnl = activePosition
    ? (Number.isFinite(activePosition.unrealizedPnl)
      ? activePosition.unrealizedPnl
      : (isShortActive
        ? (activePosition.entryPrice - activePosition.markPrice) * activePosition.contracts * contractSizeActive
        : (activePosition.markPrice - activePosition.entryPrice) * activePosition.contracts * contractSizeActive))
    : 0;

  const handleClosePosition = async () => {
    if (!activePosition) return;
    setClosingPos(true);
    try {
      await closePosition(activePosition.symbol);
      const data = await getStatus();
      useEngineStore.getState().setStatus(data);
    } catch (e) {
      console.error(e);
      alert('Error cerrando la posición.');
    } finally {
      setClosingPos(false);
    }
  };
  const standaloneOrders = status?.open_orders?.filter(o => o.symbol === selectedSymbol) || [];

  return (
    <NeoLayout>
      <div className="flex flex-col flex-1 pt-16 h-full pb-24 max-w-5xl mx-auto w-full">
        <div className="flex flex-row justify-between items-center px-6 mb-4">
          <h1 className="text-white text-2xl font-bold">Gráfico</h1>
          <div className="flex flex-row gap-3">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-[#34d8ff]/10 px-3 py-2 rounded-lg border border-[#34d8ff]/20 text-[#34d8ff] font-bold text-xs outline-none appearance-none"
            >
              <option value="1m" className="bg-black text-[#34d8ff]">1m</option>
              <option value="5m" className="bg-black text-[#34d8ff]">5m</option>
              <option value="15m" className="bg-black text-[#34d8ff]">15m</option>
              <option value="1h" className="bg-black text-[#34d8ff]">1h</option>
              <option value="4h" className="bg-black text-[#34d8ff]">4h</option>
              <option value="1d" className="bg-black text-[#34d8ff]">1d</option>
            </select>
            <button
              className="bg-[#34d8ff]/10 px-4 py-2 rounded-lg border border-[#34d8ff]/20 text-[#34d8ff] font-bold text-xs tracking-wide"
              onClick={() => setDropdownVisible(true)}
            >
              {selectedSymbol || 'Cargando...'}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#34d8ff]"></div>
          </div>
        ) : selectedSymbol ? (
          <>
            <div
              ref={chartContainerRef}
              className="w-full bg-[#020202] border-y border-[#34d8ff]/10"
              style={{ height: 350 }}
            />

            <div className="flex-1 p-6 overflow-y-auto">
              {(() => {
                const isShort = activePosition?.side?.toLowerCase() === 'short';
                                  const calculateExpectedPnl = (targetPrice: number) => {
                  if (!activePosition) return 0;
                  const contractSize = activePosition.contractSize || 1;
                  return (activePosition.contracts || 0) * contractSize * (
                    isShort
                      ? (activePosition.entryPrice - targetPrice)
                      : (targetPrice - activePosition.entryPrice)
                  );
                };

                return (
                  <>
              <NeoCard
                title="Estado de Operación"
                value={activePosition ? 'POSICIÓN ABIERTA' : (standaloneOrders.length > 0 ? 'ÓRDENES PENDIENTES' : 'ESPERANDO SEÑAL')}
              >
                {activePosition ? (
                  <div className="mt-3 bg-black/20 p-3 rounded-lg relative">
                    <div className="absolute top-3 right-3 flex gap-2">
                      <NeoButton
                                                variant="secondary"
                        size="sm"

                        onClick={handleClosePosition}
                        disabled={closingPos}
                      >
                        {closingPos ? 'Cerrando...' : 'Cerrar'}
                      </NeoButton>
                    </div>
                    <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">PNL:</span>{' '}<span className={`font-bold tabular-nums font-mono ${livePnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>{livePnl >= 0 ? '+' : ''}{livePnl.toFixed(2)} USDT</span></p>
                    <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Lado:</span> {isShortActive ? 'SHORT 🔴' : 'LONG 🟢'}</p>
                    <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Entrada:</span> <span className="tabular-nums font-mono">{activePosition.entryPrice}</span></p>
                    <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Actual:</span> <span className="tabular-nums font-mono">{activePosition.markPrice}</span></p>
                    <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Apalancamiento:</span> {activePosition.leverage}x</p>
                    <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Contratos:</span> {activePosition.contracts}</p>
                    {activePosition.confidence !== undefined && (
                      <p className="text-white/90 text-sm mb-1.5">
                        <span className="font-bold text-[#34d8ff]">Confianza IA:</span> {(activePosition.confidence * 100).toFixed(1)}%
                      </p>
                    )}

                    {activePosition.orders && activePosition.orders.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-[#34d8ff]/10">
                        <p className="font-bold text-[#34d8ff] mb-2">Órdenes Pendientes de Salida:</p>
                        {activePosition.orders.map((ord, idx) => (
                          <div key={idx} className="flex flex-row justify-between items-center mb-2">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${ord.type === 'TAKE_PROFIT' ? 'bg-[#00ff88]/20 text-[#00ff88]' : 'bg-[#ff3366]/20 text-[#ff3366]'}`}>
                              {ord.type}
                            </span>

                            <span className="text-white/90 text-sm tabular-nums font-mono">
                              {ord.price.toFixed(7)} ({ord.distance_pct.toFixed(2)}%)
                              {' | '}
                              <span className={calculateExpectedPnl(ord.price) >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}>
                                {calculateExpectedPnl(ord.price) >= 0 ? '+' : ''}{calculateExpectedPnl(ord.price).toFixed(2)} USDT
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : standaloneOrders.length > 0 ? (
                  <div className="mt-3 bg-black/20 p-3 rounded-lg">
                    <p className="font-bold text-[#34d8ff] mb-2">Órdenes de Entrada Abiertas:</p>
                    {standaloneOrders.map((ord, idx) => (
                      <div key={idx} className="flex flex-row justify-between items-center mb-2">
                                                <NeoBadge variant={ord.side === 'BUY' ? 'success' : 'danger'}>
                          {`${ord.side} ${ord.type}`}
                        </NeoBadge>

                        <span className="text-white/90 text-sm">{ord.price.toFixed(7)} (Cant: {ord.amount})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/70 text-sm mt-2 text-center">Monitoreando el mercado. Sin posiciones activas en este símbolo.</p>
                )}
              </NeoCard>
              </>
              );
              })()}

              {history.length > 0 && (
                <div className="mt-6">
                  <NeoCard title="Historial de Órdenes (Últimas 6)" value="" trend={{ value: 'HISTÓRICO', direction: 'up' }}>
                    <div className="mt-4 flex flex-col gap-3">
                      {history.map((trade, idx) => (
                        <div key={idx} className={`flex flex-row justify-between pb-3 ${idx !== history.length - 1 ? 'border-b border-[#34d8ff]/10' : ''}`}>
                          <div className="flex-1">
                            <div className="flex flex-row items-center mb-1">
                                                            <NeoBadge variant={trade.side === 'BUY' || trade.side === 'LONG' ? 'success' : 'danger'}>
                                {trade.side === 'BUY' || trade.side === 'LONG' ? 'LONG' : 'SHORT'}
                              </NeoBadge>

                              <span className="text-white/40 text-xs ml-2">
                                {new Date(trade.time * 1000).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-white/70 text-[13px]">Entrada: {trade.entryPrice.toFixed(7)}</p>
                            <p className="text-white/70 text-[13px]">Salida: {trade.exitPrice.toFixed(7)}</p>
                          </div>
                          <div className="flex items-center justify-end">
                            <span className={`font-bold text-base ${trade.pnl >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                              {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)} USDT
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </NeoCard>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex justify-center items-center">
            <p className="text-white/70 text-sm text-center">No hay símbolos activos</p>
          </div>
        )}
      </div>

      <NeoModal
        open={isDropdownVisible}
        title="Seleccionar Símbolo"
        onClose={() => setDropdownVisible(false)}
        footer={
          <NeoButton variant="outline" size="md" onClick={() => setDropdownVisible(false)}>
            Cerrar
          </NeoButton>
        }
      >
                {openPositionSymbols.length > 0 ? (
          <div className="flex flex-col">
            {openPositionSymbols.map((item) => (

              <button
                key={item}
                className={`py-3.5 border-b px-3 rounded-lg transition-colors text-center ${selectedSymbol === item
                    ? 'border-[#34d8ff]/20 bg-[#34d8ff]/10 text-[#34d8ff] font-bold tracking-widest'
                    : 'border-white/5 bg-transparent text-white/70 font-normal hover:bg-white/5'
                  }`}
                onClick={() => {
                  setSelectedSymbol(item);
                  setDropdownVisible(false);
                }}
              >
                {item}
              </button>
            ))}
          </div>
                ) : (
          <p className="text-white/70 text-xs mt-2 text-center">No hay posiciones abiertas disponibles.</p>
        )}

      </NeoModal>
    </NeoLayout>
  );
}
