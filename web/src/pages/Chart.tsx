import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { NeoLayout, NeoCard, NeoBadge, NeoButton, NeoModal } from '../compat/jeikei-design';
import { getStatus, getCredentials, fetchChartData, fetchChartTrades, fetchMovementStats, fetchChartHistory, closePosition } from '../services/api';
import type { PositionInfo } from '../services/api';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useEngineStore } from '../store/useEngineStore';
import { useEngineWebSocket } from '../hooks/useEngineWebSocket';


export default function ChartScreen() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialSymbol = queryParams.get('symbol');

  // --- Estado global (Zustand) ---
  const status = useEngineStore((state) => state.status);

  // --- Estado local de UI ---
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(initialSymbol);
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [closingPos, setClosingPos] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  // --- WebSocket global para el símbolo seleccionado ---
  useEngineWebSocket(selectedSymbol);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const currentLinesRef = useRef<any[]>([]);
  const liveCandleRef = useRef<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      await getCredentials();
      if (!isMounted) return;

      if (!selectedSymbol && status?.active_symbols?.length) {
        setSelectedSymbol(status.active_symbols[0]);
      } else if (!selectedSymbol) {
        setSelectedSymbol('BTC/USDT:USDT');
      }
      setIsLoading(false);
    };

    fetchData();
    return () => { isMounted = false; };
  }, [selectedSymbol, status?.active_symbols?.length]);

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
        autoscaleInfoProvider: (original) => {
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

  // Fetch and update base data
  useEffect(() => {
    let isMounted = true;
    if (!selectedSymbol || !candlestickSeriesRef.current || !chartRef.current) return;

    let handleWsMessage: ((e: CustomEvent) => void) | null = null;
    const loadBaseData = async () => {
      try {
        const data = await fetchChartData(selectedSymbol, timeframe);
        const historyData = await fetchChartHistory(selectedSymbol);

        if (!isMounted) return;
        setHistory(historyData);

        const series = candlestickSeriesRef.current;
        if (series && data && data.length > 0) {
          series.setData(data);
          liveCandleRef.current = data[data.length - 1] ?? null;
        }

        handleWsMessage = (e: CustomEvent) => {
          const { event, symbol, data: wsData } = e.detail;
          if (event !== "ticker_update" || symbol !== selectedSymbol) return;
          const currentPrice = Number(wsData?.last ?? wsData?.price);
          if (!Number.isFinite(currentPrice)) return;
          const durationSeconds: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
          const duration = durationSeconds[timeframe] ?? 300;
          const eventSeconds = Number(wsData?.timestamp ?? Date.now()) / (Number(wsData?.timestamp ?? 0) > 100000000000 ? 1000 : 1);
          const candleTime = Math.floor(eventSeconds / duration) * duration;
          const previous = liveCandleRef.current;
          if (!previous || Number(previous.time) !== candleTime) {
            const nextCandle = { time: candleTime, open: currentPrice, high: currentPrice, low: currentPrice, close: currentPrice, volume: 0 };
            liveCandleRef.current = nextCandle;
            candlestickSeriesRef.current?.update(nextCandle as any);
          } else {
            const updatedCandle = {
              ...previous,
              high: Math.max(Number(previous.high), currentPrice),
              low: Math.min(Number(previous.low), currentPrice),
              close: currentPrice,
            };
            liveCandleRef.current = updatedCandle;
            candlestickSeriesRef.current?.update(updatedCandle as any);
          }
        };
        window.addEventListener('ws:message', handleWsMessage as EventListener);
      } catch (err) {
        console.error("Error loading base chart data:", err);
      }
    };

    loadBaseData();

    return () => {
      isMounted = false;
      if (handleWsMessage) {
        window.removeEventListener('ws:message', handleWsMessage as EventListener);
      }
    };
  }, [selectedSymbol, timeframe]);

  // Handle overlays (trades, lines) independently
  useEffect(() => {
    let isMounted = true;
    if (!selectedSymbol || !candlestickSeriesRef.current) return;

    const updateOverlays = async () => {
      try {
        const [tradesResult, movementStatsResult] = await Promise.allSettled([
          fetchChartTrades(selectedSymbol),
          fetchMovementStats(selectedSymbol, status?.execution_mode || 'PAPER_TRADING'),
        ]);
        const trades = tradesResult.status === 'fulfilled' ? tradesResult.value : [];
        const movementStats = movementStatsResult.status === 'fulfilled'
          ? movementStatsResult.value
          : { avg_max_rebound_pct: 0 };
        if (tradesResult.status === 'rejected') console.warn('[Chart] No se pudieron cargar trades:', tradesResult.reason);
        if (movementStatsResult.status === 'rejected') console.warn('[Chart] No se pudieron cargar estadísticas de rebote:', movementStatsResult.reason);
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
        const entryOrder = standaloneOrders.find(o => {
          const orderType = String(o.type || '').toUpperCase();
          return !['TAKE_PROFIT', 'STOP_LOSS', 'TP', 'SL'].includes(orderType);
        });
        const entryPrice = Number(currentPosition?.entryPrice ?? currentPosition?.entry_price ?? entryOrder?.price ?? 0);
        const side = String(currentPosition?.side ?? currentPosition?.entryDirection ?? entryOrder?.side ?? "").toLowerCase();
        const isLongPosition = side === "buy" || side === "long";
        const statsReboundPct = Number(movementStats?.avg_max_rebound_pct ?? 0);
        // CAMBIO sólo usa el promedio persistido e independiente del símbolo.

        // La distancia total se calcula primero: promedio + 0,50%.
        const avgMaxReboundPct = statsReboundPct;
        const directionChangePct = avgMaxReboundPct > 0
          ? avgMaxReboundPct + 0.50
          : 0;

        const positionOrders = Array.isArray(activePosition?.orders)
          ? activePosition.orders.map((order: any) => ({ ...order, symbol: selectedSymbol }))
          : [];
        const positionTargetOrders: any[] = [];
        if (Number(activePosition?.tpPrice ?? activePosition?.tp_price ?? 0) > 0) {
          positionTargetOrders.push({ symbol: selectedSymbol, type: 'TAKE_PROFIT', side: isLongPosition ? 'SELL' : 'BUY', price: Number(activePosition?.tpPrice ?? activePosition?.tp_price) });
        }
        if (Number(activePosition?.slPrice ?? activePosition?.sl_price ?? 0) > 0) {
          positionTargetOrders.push({ symbol: selectedSymbol, type: 'STOP_LOSS', side: isLongPosition ? 'SELL' : 'BUY', price: Number(activePosition?.slPrice ?? activePosition?.sl_price) });
        }
        const rawChartOrders: any[] = [
          ...standaloneOrders,
          ...positionOrders,
          ...positionTargetOrders,
          ...(activePosition && entryPrice > 0 ? [{
            ...activePosition,
            price: entryPrice,
            type: 'POSITION'
          }] : [])
        ];

        const chartOrders = rawChartOrders
          .map((order: any) => ({ ...order, price: Number(order.price ?? order.stopPrice ?? order.triggerPrice ?? 0) }))
          .filter((order: any) => order.price > 0 && order.symbol === selectedSymbol)
          .filter((value: any, index: number, self: any[]) =>
            index === self.findIndex((t: any) => t.price === value.price && t.type === value.type)
          );

        if (currentPosition && entryPrice > 0 && directionChangePct > 0) {
          const directionChangePrice = isLongPosition
            ? entryPrice * (1 - directionChangePct / 100)
            : entryPrice * (1 + directionChangePct / 100);
          chartOrders.push({
            price: directionChangePrice,
            type: "DIRECTION_CHANGE",
            side: isLongPosition ? "SELL" : "BUY"
          });
        }


        if (currentPosition && entryPrice > 0) {
          const assumedFee = 0.0010;
          const bePrice = isLongPosition
            ? entryPrice * (1 + assumedFee)
            : entryPrice * (1 - assumedFee);

          chartOrders.push({
            price: bePrice,
            type: 'G&P',
            side: isLongPosition ? 'SELL' : 'BUY'
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

            if (ord.type === 'TAKE_PROFIT') { lineColor = '#4ade80'; titleText = 'TP'; }
            if (ord.type === 'STOP_LOSS') { lineColor = '#f87171'; titleText = 'SL'; }
            if (ord.type === 'G&P') { lineColor = '#22c7a5'; titleText = 'G&P'; style = 0; }
            if (ord.type === 'LIQUIDATION') { lineColor = '#a855f7'; titleText = 'LIQ'; }
            if (ord.type === 'POSITION') { titleText = ''; style = 0; lineColor = '#6b7280'; labelVisible = false; }
            if (ord.type === "DIRECTION_CHANGE") { titleText = "CAMBIO"; style = 2; lineColor = "#3b82f6"; labelVisible = true; }
            if (ord.type === 'REBOUND_AVG') { titleText = `REBOTE ${Number(ord.pct || 0).toFixed(3)}%`; style = 2; lineColor = '#f59e0b'; labelVisible = true; }

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
    ? isShortActive
      ? (activePosition.entryPrice - activePosition.markPrice) * activePosition.contracts * contractSizeActive
      : (activePosition.markPrice - activePosition.entryPrice) * activePosition.contracts * contractSizeActive
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
                  return (activePosition.contracts || 0) * (
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
                              variant="outline"
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
                                  <NeoBadge
                                    label={ord.type}
                                    variant={ord.type === 'TAKE_PROFIT' ? 'success' : 'warning'}
                                  />
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
                              <NeoBadge
                                label={`${ord.side} ${ord.type}`}
                                variant={ord.side === 'BUY' ? 'success' : 'warning'}
                              />
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
                              <NeoBadge
                                label={trade.side === 'BUY' || trade.side === 'LONG' ? 'LONG' : 'SHORT'}
                                variant={trade.side === 'BUY' || trade.side === 'LONG' ? 'success' : 'warning'}
                              />
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
        {status?.active_symbols && status.active_symbols.length > 0 ? (
          <div className="flex flex-col">
            {status.active_symbols.map((item) => (
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
          <p className="text-white/70 text-xs mt-2 text-center">Ningún símbolo activo disponible.</p>
        )}
      </NeoModal>
    </NeoLayout>
  );
}


