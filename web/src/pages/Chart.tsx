import React, { useState, useEffect, useRef } from 'react';
import { NeoLayout, NeoCard, NeoBadge, NeoButton, NeoModal } from 'jeikei-design-system';
import { getStatus, getCredentials, fetchChartData, fetchChartTrades, fetchChartHistory } from '../services/api';
import type { SystemStatus, PositionInfo } from '../services/api';
import { createChart, ColorType, CrosshairMode } from 'lightweight-charts';
import type { IChartApi, ISeriesApi } from 'lightweight-charts';

export default function ChartScreen() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [exchangeId, setExchangeId] = useState<string>('BINANCE');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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
      
      if (creds && creds.length > 0) {
        setExchangeId(creds[0].exchange_id.toUpperCase());
      }
      
      if (!selectedSymbol && data.active_symbols && data.active_symbols.length > 0) {
        setSelectedSymbol(data.active_symbols[0]);
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
        const data = await fetchChartData(selectedSymbol);
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
        
        chartRef.current?.timeScale().fitContent();

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
  }, [selectedSymbol, status]);

  const activePosition: PositionInfo | undefined = status?.open_positions?.find(
    (p) => p.symbol === selectedSymbol
  );
  const standaloneOrders = status?.open_orders?.filter(o => o.symbol === selectedSymbol) || [];

  return (
    <NeoLayout>
      <div className="flex flex-col flex-1 pt-16 h-full pb-24 max-w-5xl mx-auto w-full">
        <div className="flex flex-row justify-between items-center px-6 mb-4">
          <h1 className="text-white text-2xl font-bold">Gráfico</h1>
          <button 
            className="bg-[#34d8ff]/10 px-4 py-2 rounded-lg border border-[#34d8ff]/20 text-[#34d8ff] font-bold text-xs tracking-wide"
            onClick={() => setDropdownVisible(true)}
          >
            {selectedSymbol || 'Cargando...'}
          </button>
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
                  trend={activePosition ? {
                    value: `${activePosition.unrealizedPnl >= 0 ? '+' : ''}${activePosition.unrealizedPnl.toFixed(2)} USDT`,
                    direction: activePosition.unrealizedPnl >= 0 ? 'up' : 'down'
                  } : undefined}
                >
                  {activePosition ? (
                    <div className="mt-3 bg-black/20 p-3 rounded-lg">
                      <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Lado:</span> {activePosition.side.toUpperCase()}</p>
                      <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Entrada:</span> {activePosition.entryPrice}</p>
                      <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Actual:</span> {activePosition.markPrice}</p>
                      <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Apalancamiento:</span> {activePosition.leverage}x</p>
                      <p className="text-white/90 text-sm mb-1.5"><span className="font-bold text-[#34d8ff]">Contratos:</span> {activePosition.contracts}</p>
  
                      {activePosition.orders && activePosition.orders.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#34d8ff]/10">
                          <p className="font-bold text-[#34d8ff] mb-2">Órdenes Pendientes de Salida:</p>
                          {activePosition.orders.map((ord, idx) => (
                            <div key={idx} className="flex flex-row justify-between items-center mb-2">
                              <NeoBadge 
                                label={ord.type} 
                                variant={ord.type === 'TAKE_PROFIT' ? 'success' : 'danger'} 
                              />
                              <span className="text-white/90 text-sm">{ord.price.toFixed(4)} ({ord.distance_pct.toFixed(2)}%)</span>
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
                          <span className="text-white/90 text-sm">{ord.price.toFixed(4)} (Cant: {ord.amount})</span>
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
                                  label={trade.side} 
                                  variant={trade.side === 'BUY' ? 'success' : 'danger'} 
                                />
                                <span className="text-white/40 text-xs ml-2">
                                  {new Date(trade.time * 1000).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className="text-white/70 text-[13px]">Entrada: {trade.entryPrice.toFixed(4)}</p>
                              <p className="text-white/70 text-[13px]">Salida: {trade.exitPrice.toFixed(4)}</p>
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
                className={`py-3.5 border-b px-3 rounded-lg transition-colors text-center ${
                  selectedSymbol === item 
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
