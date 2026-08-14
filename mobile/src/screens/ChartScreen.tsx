import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, FlatList } from 'react-native';
import { NeoLayout, NeoCard, NeoBadge, NeoButton } from 'jeikei-design-system/native';
import { NeoModal } from '../components/NeoModal';
import { getStatus, SystemStatus, PositionInfo, getCredentials, fetchChartData, fetchChartTrades, fetchChartHistory } from '../services/api';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { PriceTicker } from '../components/PriceTicker';
import { useEngineStatus, useEngineStore, usePriceSelector } from '../store/useEngineStore';
import { useEngineWebSocket } from '../hooks/useEngineWebSocket';

export default function ChartScreen() {
  const globalStatus = useEngineStatus();
  const setGlobalStatus = useEngineStore(state => state.setStatus);
  const [exchangeId, setExchangeId] = useState<string>('BINANCE');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isWebViewLoaded, setIsWebViewLoaded] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const webviewRef = useRef<WebView>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [data, creds] = await Promise.all([
          getStatus(),
          getCredentials()
        ]);
        setGlobalStatus(data);
        
        if (creds && creds.length > 0) {
          setExchangeId(creds[0].exchange_id.toUpperCase());
        }
        
        // Auto-select first symbol if none is selected
        if (!selectedSymbol && data.active_symbols && data.active_symbols.length > 0) {
          setSelectedSymbol(data.active_symbols[0]);
        }
      } catch (err) {
        console.error("Error fetching initial chart data", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    // Polling removed in favor of WebSocket + Zustand
  }, []);

  // Suscribirse a WebSockets para este símbolo
  useEngineWebSocket(selectedSymbol);

  // 1. Refrescar datos de velas e historial una vez (o cada 60s)
  useEffect(() => {
    if (!selectedSymbol || !webviewRef.current || !isWebViewLoaded) return;
    
    const fetchBaseData = async () => {
      try {
        const data = await fetchChartData(selectedSymbol);
        const trades = await fetchChartTrades(selectedSymbol);
        const historyData = await fetchChartHistory(selectedSymbol);
        setHistory(historyData);
        
        const script = `
          if (window.updateChartData) {
            window.updateChartData(${JSON.stringify(data)}, ${JSON.stringify(trades)});
          }
          true;
        `;
        webviewRef.current?.injectJavaScript(script);
      } catch (err) {
        console.error("Error updating chart base data:", err);
      }
    };

    fetchBaseData();
    const interval = setInterval(fetchBaseData, 60000); // Refrescar velas cada 1m
    return () => clearInterval(interval);
  }, [selectedSymbol, isWebViewLoaded]);

  // Computed values for display (used in JSX and Live Update)
  const currentPrice = usePriceSelector(selectedSymbol || '');
  const activePosition: PositionInfo | undefined = globalStatus?.open_positions?.find(
    (p) => p.symbol === selectedSymbol
  );
  const standaloneOrders = globalStatus?.open_orders?.filter(o => o.symbol === selectedSymbol) || [];

  // 2. Refrescar precio en vivo y órdenes instantáneamente
  useEffect(() => {
    if (!selectedSymbol || !webviewRef.current || !isWebViewLoaded) return;

    const chartOrders = [
        ...standaloneOrders.map(o => ({ price: o.price, type: o.type, side: o.side })),
        ...(activePosition?.orders || []).map(o => ({ 
            price: o.price, 
            type: o.type, 
            side: activePosition?.side === 'long' ? 'SELL' : 'BUY' 
        }))
    ];

    const script = `
      if (window.updateLiveState) {
        window.updateLiveState(${currentPrice || 'null'}, ${JSON.stringify(chartOrders)});
      }
      true;
    `;
    webviewRef.current?.injectJavaScript(script);
  }, [selectedSymbol, isWebViewLoaded, currentPrice, activePosition, standaloneOrders]);

  const status = globalStatus;

  const getTradingViewHTML = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            body, html { margin: 0; padding: 0; background-color: #020202; height: 100%; width: 100%; overflow: hidden; }
            #chart { width: 100%; height: 100%; }
          </style>
          <script src="https://unpkg.com/lightweight-charts@4.1.1/dist/lightweight-charts.standalone.production.js"></script>
        </head>
        <body>
          <div id="chart"></div>
          <script>
            const chart = LightweightCharts.createChart(document.getElementById('chart'), {
                autoSize: true,
                layout: {
                    background: { type: 'solid', color: '#020202' },
                    textColor: '#d1d4dc',
                },
                grid: {
                    vertLines: { color: 'rgba(52, 216, 255, 0.04)' },
                    horzLines: { color: 'rgba(52, 216, 255, 0.04)' },
                },
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                }
            });

            const candleSeries = chart.addCandlestickSeries({
                upColor: '#4ade80',
                downColor: '#f87171',
                borderVisible: false,
                wickUpColor: '#4ade80',
                wickDownColor: '#f87171'
            });

            let currentLines = [];
            let lastCandle = null;

            // Capturar errores y enviarlos a React Native
            window.onerror = function(message, source, lineno, colno, error) {
               window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: message }));
            };

            window.updateChartData = function(data, trades) {
                try {
                    candleSeries.setMarkers([]);
                    
                    // 3. Setear nuevos datos
                    if (data && data.length > 0) {
                        candleSeries.setData(data);
                        lastCandle = data[data.length - 1];
                    }

                    // FIX 3: AUTO-FIT al rango del nuevo símbolo
                    chart.timeScale().fitContent();

                    // 4. Pintar nuevos markers
                    if (trades && trades.length > 0) {
                        const markers = trades.map(t => ({
                            time: t.time,
                            position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
                            color: t.side === 'buy' ? '#4ade80' : '#f87171',
                            shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
                            text: t.side === 'buy' ? 'B' : 'S'
                        }));
                        markers.sort((a, b) => a.time - b.time);
                        
                        const uniqueMarkers = [];
                        let lastTime = 0;
                        for (let m of markers) {
                            if (m.time !== lastTime) {
                                uniqueMarkers.push(m);
                                lastTime = m.time;
                            }
                        }
                        
                        if (uniqueMarkers.length > 0) {
                          candleSeries.setMarkers(uniqueMarkers);
                        }
                    }
                } catch (e) {
                   window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.message }));
                }
            };

            window.updateLiveState = function(price, orders) {
                try {
                    // Update live candle price
                    if (price && lastCandle) {
                        // Create a clone to avoid mutating the locked object if strict mode
                        const updatedCandle = { ...lastCandle };
                        updatedCandle.close = price;
                        if (price > updatedCandle.high) updatedCandle.high = price;
                        if (price < updatedCandle.low) updatedCandle.low = price;
                        
                        candleSeries.update(updatedCandle);
                        lastCandle = updatedCandle;
                    }

                    // Update live order lines
                    if (orders) {
                        if (typeof currentLines !== 'undefined') {
                            currentLines.forEach(line => candleSeries.removePriceLine(line));
                            currentLines = [];
                        }

                        orders.forEach(ord => {
                            let lineColor = ord.side === 'BUY' ? '#4ade80' : '#f87171';
                            if (ord.type === 'TAKE_PROFIT') lineColor = '#4ade80';
                            if (ord.type === 'STOP_LOSS') lineColor = '#f87171';

                            const line = candleSeries.createPriceLine({
                                price: ord.price,
                                color: lineColor,
                                lineWidth: 2,
                                lineStyle: LightweightCharts.LineStyle.Dashed,
                                axisLabelVisible: true,
                                title: ord.type,
                            });
                            currentLines.push(line);
                        });
                    }
                } catch (e) {
                   window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.message }));
                }
            };
          </script>
        </body>
      </html>
    `;
  };

  return (
    <NeoLayout>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Gráfico</Text>
          <TouchableOpacity 
            style={styles.dropdownBtn}
            onPress={() => setDropdownVisible(true)}
          >
            <Text style={styles.dropdownText}>{selectedSymbol || 'Cargando...'}</Text>
            {selectedSymbol && (
              <PriceTicker symbol={selectedSymbol} style={{ marginLeft: 8, fontSize: 16 }} />
            )}
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#34d8ff" />
          </View>
        ) : selectedSymbol ? (
            <>
              <View style={styles.chartContainer}>
                 {/* @ts-ignore - WebView types conflict with React 19 */}
                 <WebView 
                   ref={webviewRef}
                   source={{ html: getTradingViewHTML() }}
                   style={{ flex: 1, backgroundColor: '#020202' }}
                   scrollEnabled={false}
                   bounces={false}
                   javaScriptEnabled={true}
                   originWhitelist={['*']}
                   onLoadEnd={() => setIsWebViewLoaded(true)}
                   onMessage={(event: WebViewMessageEvent) => {
                     try {
                       const data = JSON.parse(event.nativeEvent.data);
                       if (data.type === 'error') {
                         console.error('WebView Chart Error:', data.message);
                       }
                     } catch(e) {}
                   }}
                 />
              </View>
              
              <ScrollView style={styles.detailsContainer}>
                <NeoCard
                  title="Estado de Operación"
                  value={activePosition ? 'POSICIÓN ABIERTA' : (standaloneOrders.length > 0 ? 'ÓRDENES PENDIENTES' : 'ESPERANDO SEÑAL')}
                  trend={activePosition ? {
                    value: `${activePosition.unrealizedPnl >= 0 ? '+' : ''}${activePosition.unrealizedPnl.toFixed(2)} USDT`,
                    direction: activePosition.unrealizedPnl >= 0 ? 'up' : 'down'
                  } : undefined}
                >
                  {activePosition ? (
                    <View style={styles.positionDetails}>
                      <Text style={styles.posText}><Text style={styles.boldText}>Lado:</Text> {activePosition.side.toUpperCase()}</Text>
                      <Text style={styles.posText}><Text style={styles.boldText}>Entrada:</Text> {activePosition.entryPrice}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={[styles.posText, { marginBottom: 0 }]}><Text style={styles.boldText}>Actual:</Text> </Text>
                        <PriceTicker symbol={activePosition.symbol} />
                      </View>
                      <Text style={styles.posText}><Text style={styles.boldText}>Apalancamiento:</Text> {activePosition.leverage}x</Text>
                      <Text style={styles.posText}><Text style={styles.boldText}>Contratos:</Text> {activePosition.contracts}</Text>
  
                      {activePosition.orders && activePosition.orders.length > 0 && (
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(52, 216, 255, 0.1)' }}>
                          <Text style={[styles.boldText, { marginBottom: 8 }]}>Órdenes Pendientes de Salida:</Text>
                          {activePosition.orders.map((ord, idx) => (
                            <View key={idx} style={styles.orderRow}>
                              <NeoBadge 
                                label={ord.type} 
                                variant={ord.type === 'TAKE_PROFIT' ? 'success' : 'danger'} 
                              />
                              <Text style={styles.posText}>{ord.price.toFixed(4)} ({ord.distance_pct.toFixed(2)}%)</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  ) : standaloneOrders.length > 0 ? (
                    <View style={styles.positionDetails}>
                      <Text style={[styles.boldText, { marginBottom: 8 }]}>Órdenes de Entrada Abiertas:</Text>
                      {standaloneOrders.map((ord, idx) => (
                        <View key={idx} style={styles.orderRow}>
                          <NeoBadge 
                            label={`${ord.side} ${ord.type}`} 
                            variant={ord.side === 'BUY' ? 'success' : 'danger'} 
                          />
                          <Text style={styles.posText}>{ord.price.toFixed(4)} (Cant: {ord.amount})</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.text}>Monitoreando el mercado. Sin posiciones activas en este símbolo.</Text>
                  )}
                </NeoCard>
                
                {history.length > 0 && (
                  <NeoCard title="Historial de Órdenes (Últimas 6)">
                    {history.map((trade, idx) => (
                      <View key={idx} style={[styles.orderRow, { marginBottom: 12, paddingBottom: 12, borderBottomWidth: idx === history.length - 1 ? 0 : 1, borderBottomColor: 'rgba(52, 216, 255, 0.08)' }]}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                            <NeoBadge 
                              label={trade.side} 
                              variant={trade.side === 'BUY' ? 'success' : 'danger'} 
                            />
                            <Text style={[styles.text, { fontSize: 12, marginLeft: 8, color: 'rgba(255,255,255,0.4)' }]}>
                              {new Date(trade.time * 1000).toLocaleTimeString()}
                            </Text>
                          </View>
                          <Text style={[styles.text, { fontSize: 13 }]}>Entrada: {trade.entryPrice.toFixed(4)}</Text>
                          <Text style={[styles.text, { fontSize: 13 }]}>Salida: {trade.exitPrice.toFixed(4)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', justifyContent: 'center' }}>
                          <Text style={[styles.boldText, { color: trade.pnl >= 0 ? '#4ade80' : '#f87171', fontSize: 16 }]}>
                            {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)} USDT
                          </Text>
                        </View>
                      </View>
                    ))}
                  </NeoCard>
                )}

                <View style={{ height: 100 }} />
              </ScrollView>
            </>
        ) : (
          <View style={styles.emptyContainer}>
             <Text style={styles.text}>No hay símbolos activos</Text>
          </View>
        )}
      </View>

      <NeoModal
        visible={isDropdownVisible}
        title="Seleccionar Símbolo"
        onClose={() => setDropdownVisible(false)}
      >
        {status?.active_symbols && status.active_symbols.length > 0 ? (
          <FlatList
            data={status.active_symbols}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: selectedSymbol === item ? 'rgba(52, 216, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  backgroundColor: selectedSymbol === item ? 'rgba(52, 216, 255, 0.06)' : 'transparent',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                }}
                onPress={() => {
                  setSelectedSymbol(item);
                  setDropdownVisible(false);
                }}
              >
                <Text style={{
                  color: selectedSymbol === item ? '#34d8ff' : 'rgba(255, 255, 255, 0.7)',
                  fontSize: 15,
                  fontWeight: selectedSymbol === item ? 'bold' : 'normal',
                  textAlign: 'center',
                  letterSpacing: selectedSymbol === item ? 1 : 0,
                }}>
                  {item}
                </Text>
              </TouchableOpacity>
            )}
          />
        ) : (
           <Text style={styles.text}>Ningún símbolo activo disponible.</Text>
        )}
        <View style={{ height: 16 }} />
        <NeoButton variant="outline" size="md" onPress={() => setDropdownVisible(false)}>
          Cerrar
        </NeoButton>
      </NeoModal>

    </NeoLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  dropdownBtn: {
    backgroundColor: 'rgba(52, 216, 255, 0.06)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(52, 216, 255, 0.2)',
  },
  dropdownText: {
    color: '#34d8ff',
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  chartContainer: {
    height: 350,
    width: '100%',
    backgroundColor: '#020202',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(52, 216, 255, 0.08)',
  },
  detailsContainer: {
    flex: 1,
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  },
  positionDetails: {
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 8,
  },
  posText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginBottom: 6,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#34d8ff',
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
});
