import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { NeoLayout, NeoCard, NeoBadge, NeoButton } from 'jeikei-design-system/native';
import { getStatus, SystemStatus, PositionInfo, getCredentials, fetchChartData, fetchChartTrades } from '../services/api';
import { WebView } from 'react-native-webview';

export default function ChartScreen() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [exchangeId, setExchangeId] = useState<string>('BINANCE');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isWebViewLoaded, setIsWebViewLoaded] = useState(false);
  const webviewRef = useRef<WebView>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [data, creds] = await Promise.all([
        getStatus(),
        getCredentials()
      ]);
      setStatus(data);
      
      if (creds && creds.length > 0) {
        setExchangeId(creds[0].exchange_id.toUpperCase());
      }
      
      // Auto-select first symbol if none is selected
      if (!selectedSymbol && data.active_symbols && data.active_symbols.length > 0) {
        setSelectedSymbol(data.active_symbols[0]);
      }
      setIsLoading(false);
    };

    fetchData();
    const interval = setInterval(async () => {
        const data = await getStatus();
        setStatus(data);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const activePosition: PositionInfo | undefined = status?.open_positions?.find(
    (p) => p.symbol === selectedSymbol
  );
  const standaloneOrders = status?.open_orders?.filter(o => o.symbol === selectedSymbol) || [];

  // Refrescar los datos del gráfico cuando cambia el símbolo o el estado (para inyectar)
  useEffect(() => {
    if (!selectedSymbol || !webviewRef.current || !isWebViewLoaded) return;
    
    const updateChart = async () => {
      const data = await fetchChartData(selectedSymbol);
      const trades = await fetchChartTrades(selectedSymbol);
      
      const chartOrders = [
          ...standaloneOrders.map(o => ({ price: o.price, type: o.type, side: o.side })),
          ...(activePosition?.orders || []).map(o => ({ 
              price: o.price, 
              type: o.type, 
              side: activePosition.side === 'long' ? 'SELL' : 'BUY' 
          }))
      ];
      
      const script = `
        if (window.updateChartData) {
          window.updateChartData(${JSON.stringify(data)}, ${JSON.stringify(trades)}, ${JSON.stringify(chartOrders)});
        }
        true;
      `;
      webviewRef.current?.injectJavaScript(script);
    };

    updateChart();
  }, [selectedSymbol, status, isWebViewLoaded]); // Run when status updates to update orders, or symbol changes to get new candles

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
          <script src="https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js"></script>
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
                    vertLines: { color: 'rgba(255, 255, 255, 0.06)' },
                    horzLines: { color: 'rgba(255, 255, 255, 0.06)' },
                },
                timeScale: {
                    timeVisible: true,
                    secondsVisible: false,
                }
            });

            const candleSeries = chart.addCandlestickSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350'
            });

            let currentLines = [];

            // Capturar errores y enviarlos a React Native
            window.onerror = function(message, source, lineno, colno, error) {
               window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: message }));
            };

            window.updateChartData = function(data, trades, orders) {
                try {
                    if (data && data.length > 0) {
                        candleSeries.setData(data);
                    }

                    if (trades && trades.length > 0) {
                        const markers = trades.map(t => ({
                            time: t.time,
                            position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
                            color: t.side === 'buy' ? '#26a69a' : '#ef5350',
                            shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
                            text: t.side === 'buy' ? 'B' : 'S'
                        }));
                        markers.sort((a, b) => a.time - b.time);
                        
                        // Eliminar tiempos duplicados (Lightweight Charts crashea con duplicados)
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

                    currentLines.forEach(line => candleSeries.removePriceLine(line));
                    currentLines = [];

                    if (orders) {
                        orders.forEach(ord => {
                            const isBuy = ord.side === 'BUY';
                            const line = candleSeries.createPriceLine({
                                price: ord.price,
                                color: isBuy ? '#26a69a' : '#ef5350',
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
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4DA8DA" />
          </View>
        ) : selectedSymbol ? (
            <>
              <View style={styles.chartContainer}>
                 <WebView 
                   ref={webviewRef}
                   source={{ html: getTradingViewHTML() }}
                   style={{ flex: 1, backgroundColor: '#020202' }}
                   scrollEnabled={false}
                   bounces={false}
                   javaScriptEnabled={true}
                   originWhitelist={['*']}
                   onLoadEnd={() => setIsWebViewLoaded(true)}
                   onMessage={(event) => {
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
                      <Text style={styles.posText}><Text style={styles.boldText}>Actual:</Text> {activePosition.markPrice}</Text>
                      <Text style={styles.posText}><Text style={styles.boldText}>Apalancamiento:</Text> {activePosition.leverage}x</Text>
                      <Text style={styles.posText}><Text style={styles.boldText}>Contratos:</Text> {activePosition.contracts}</Text>
  
                      {activePosition.orders && activePosition.orders.length > 0 && (
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }}>
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
                <View style={{ height: 100 }} />
              </ScrollView>
            </>
        ) : (
          <View style={styles.emptyContainer}>
             <Text style={styles.text}>No hay símbolos activos</Text>
          </View>
        )}
      </View>

      <Modal visible={isDropdownVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar Símbolo</Text>
            {status?.active_symbols && status.active_symbols.length > 0 ? (
              <FlatList
                data={status.active_symbols}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setSelectedSymbol(item);
                      setDropdownVisible(false);
                    }}
                  >
                    <Text style={[
                      styles.modalItemText, 
                      selectedSymbol === item && { color: '#4DA8DA', fontWeight: 'bold' }
                    ]}>
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
          </View>
        </View>
      </Modal>

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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  dropdownText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  chartContainer: {
    height: 350,
    width: '100%',
    backgroundColor: '#020202',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    color: '#4DA8DA',
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalItemText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  }
});
