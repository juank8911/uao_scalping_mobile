import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { NeoLayout, NeoCard, NeoBadge, NeoButton, NeoModal } from 'jeikei-design-system';
import { getStatus, getCredentials, fetchChartData, fetchChartTrades, fetchChartHistory, closePosition } from '../services/api';
import type { SystemStatus, PositionInfo } from '../services/api';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export default function ChartScreen() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialSymbol = queryParams.get('symbol');

  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(initialSymbol);
  const [timeframe, setTimeframe] = useState<string>('5m');
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [closingPos, setClosingPos] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const currentLinesRef = useRef<any[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      const [data, creds] = await Promise.all([
        getStatus(),
        getCredentials()
      ]);
      if (!isMounted) return;
      setStatus(data);

      if (!selectedSymbol) {
        if (data.active_symbols && data.active_symbols.length > 0) {
          setSelectedSymbol(data.active_symbols[0]);
        } else {
          setSelectedSymbol('BTC/USDT:USDT');
        }
      }
      setIsLoading(false);
    };

    fetchData();
    const interval = setInterval(async () => {
      const data = await getStatus();
      if (isMounted) setStatus(data);
    }, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
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

  // Fetch and update data
  useEffect(() => {
    let isMounted = true;
    if (!selectedSymbol || !candlestickSeriesRef.current || !chartRef.current) return;

    const updateChart = async () => {
      try {
        const data = await fetchChartData(selectedSymbol, timeframe);
        const trades = await fetchChartTrades(selectedSymbol);
        const historyData = await fetchChartHistory(selectedSymbol);

        if (!isMounted) return;
        setHistory(historyData);

        const currentPosition = status?.open_positions?.find(p => p.symbol === selectedSymbol);
        const currentOrders = status?.open_orders?.filter(o => o.symbol === selectedSymbol) || [];

        const chartOrders = [
          ...currentOrders.map(o => ({ price: o.price, type: o.type, side: o.side })),
          ...(currentPosition?.orders || []).map(o => ({
            price: o.price,
            type: o.type,
            side: currentPosition?.side === 'long' ? 'SELL' : 'BUY'
          }))
        ];

        if (currentPosition && currentPosition.entryPrice) {
          const side = currentPosition.side.toLowerCase();
          const assumedFee = 0.0010; // 0.1% round-trip conservative estimate
          const bePrice = side === 'buy' || side === 'long'
            ? currentPosition.entryPrice * (1 + assumedFee)
            : currentPosition.entryPrice * (1 - assumedFee);

          chartOrders.push({
            price: bePrice,
            type: 'BREAK-EVEN',
            side: side === 'buy' || side === 'long' ? 'SELL' : 'BUY'
          });
        }

        if (currentPosition && currentPosition.liquidationPrice) {
          chartOrders.push({
            price: currentPosition.liquidationPrice,
            type: 'LIQUIDATION',
            side: 'SELL' // Color se define luego
          });
        }

        const series = candlestickSeriesRef.current;
        if (!series) return;

        // Limpiar markers
        series.setMarkers([]);

        // Limpiar price lines
        currentLinesRef.current.forEach(line => series.removePriceLine(line));
        currentLinesRef.current = [];

        if (data && data.length > 0) {
          series.setData(data);
        }

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

        if (chartOrders) {
          chartOrders.forEach(ord => {
            let lineColor = ord.side === 'BUY' ? '#4ade80' : '#f87171';
            if (ord.type === 'TAKE_PROFIT') lineColor = '#4ade80';
            if (ord.type === 'STOP_LOSS') lineColor = '#f87171';
            if (ord.type === 'BREAK-EVEN') lineColor = '#fbbf24'; // amber-400
            if (ord.type === 'LIQUIDATION') lineColor = '#a855f7'; // purple-500

            const line = series.createPriceLine({
              price: ord.price,
              color: lineColor,
              lineWidth: 2,
              lineStyle: 2, // Dashed
              axisLabelVisible: true,
              title: ord.type,
            });
            currentLinesRef.current.push(line);
          });
        }
      } catch (err) {
        console.error("Error updating chart:", err);
      }
    };

    updateChart();
  }, [selectedSymbol, status, timeframe]);

  const activePosition: PositionInfo | undefined = status?.open_positions?.find(
    (p) => p.symbol === selectedSymbol
  );

  let bePriceForPnl = 0;
  if (activePosition && activePosition.entryPrice) {
    const side = activePosition.side.toLowerCase();
    const assumedFee = 0.0010;
    bePriceForPnl = side === 'buy' || side === 'long'
      ? activePosition.entryPrice * (1 + assumedFee)
      : activePosition.entryPrice * (1 - assumedFee);
  }

  const livePnl = activePosition && activePosition.unrealizedPnl !== undefined
    ? activePosition.unrealizedPnl
    : 0;

  const handleClosePosition = async () => {
    if (!activePosition) return;
    setClosingPos(true);
    try {
      await closePosition(activePosition.symbol);
      const data = await getStatus();
      setStatus(data);
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
              <NeoCard
                title="Estado de Operación"
                value={activePosition ? 'POSICIÓN ABIERTA' : (standaloneOrders.length > 0 ? 'ÓRDENES PENDIENTES' : 'ESPERANDO SEÑAL')}
              >
                {activePosition ? (
                  <div className="mt-3 bg-black/20 p-3 rounded-lg relative">
                    <div className="absolute top-3 right-3 flex gap-2">
                      <NeoButton
                        variant="danger"
                        size="small"
                        onClick={handleClosePosition}
                        disabled={closingPos}
                      >
                        {closingPos ? 'Cerrando...' : 'Cerrar'}
                      </NeoButton>
                    </div>
                    <p className="text-white/90 text-sm mb-1.5">
                      <span className="font-bold text-[#34d8ff]">PNL:</span>{' '}
                      <span className={`font-bold text-lg ${livePnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3366]'}`}>
                        {livePnl >= 0 ? '+' : ''}{livePnl.toFixed(2)} USDT
                      </span>
                    </p>
                    <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Lado:</span> {activePosition.side.toLowerCase() === 'buy' ? 'LONG' : 'SHORT'}</p>
                    <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Entrada:</span> {activePosition.entryPrice}</p>
                    <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Actual:</span> {activePosition.markPrice}</p>
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
                              variant={ord.type === 'TAKE_PROFIT' ? 'success' : 'danger'}
                            />
                            <span className="text-white/90 text-sm">{ord.price.toFixed(7)} ({ord.distance_pct.toFixed(2)}%)</span>
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
                          variant={ord.side === 'BUY' ? 'success' : 'danger'}
                        />
                        <span className="text-white/90 text-sm">{ord.price.toFixed(7)} (Cant: {ord.amount})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/70 text-sm mt-2 text-center">Monitoreando el mercado. Sin posiciones activas en este símbolo.</p>
                )}
              </NeoCard>

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
                                variant={trade.side === 'BUY' || trade.side === 'LONG' ? 'success' : 'danger'}
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
