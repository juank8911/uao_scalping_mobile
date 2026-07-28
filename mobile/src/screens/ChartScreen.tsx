import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Modal, FlatList, ActivityIndicator } from 'react-native';
import { NeoLayout, NeoCard, NeoBadge, NeoButton } from 'jeikei-design-system/native';
import { getStatus, SystemStatus, PositionInfo, getCredentials } from '../services/api';
import { WebView } from 'react-native-webview';

export default function ChartScreen() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [exchangeId, setExchangeId] = useState<string>('BINANCE');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

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

  const getTradingViewHTML = (symbol: string, exchange: string) => {
    let cleanSymbol = symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // TradingView format tweaks for perpetuals
    if (exchange === 'OKX' || exchange === 'BYBIT') {
      // TradingView often uses .P for perpetual futures on OKX and Bybit
      // If spot is desired, remove the .P. We default to .P for scalping bots.
      cleanSymbol = cleanSymbol + '.P'; 
    }

    const tvSymbol = `${exchange}:${cleanSymbol}`;
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            body { margin: 0; padding: 0; background-color: #020202; height: 100vh; overflow: hidden; }
            #tradingview_widget { height: 100%; width: 100%; }
          </style>
        </head>
        <body>
          <div class="tradingview-widget-container">
            <div id="tradingview_widget"></div>
            <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
            <script type="text/javascript">
            new TradingView.widget({
              "autosize": true,
              "symbol": "${tvSymbol}",
              "interval": "1",
              "timezone": "Etc/UTC",
              "theme": "dark",
              "style": "1",
              "locale": "es",
              "enable_publishing": false,
              "backgroundColor": "#020202",
              "gridColor": "rgba(255, 255, 255, 0.06)",
              "hide_top_toolbar": false,
              "hide_legend": false,
              "save_image": false,
              "container_id": "tradingview_widget"
            });
            </script>
          </div>
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
                 source={{ html: getTradingViewHTML(selectedSymbol, exchangeId) }}
                 style={{ flex: 1, backgroundColor: '#020202' }}
                 scrollEnabled={false}
                 bounces={false}
               />
            </View>
            
            <ScrollView style={styles.detailsContainer}>
              <NeoCard
                title="Estado de Operación"
                value={activePosition ? 'POSICIÓN ABIERTA' : 'ESPERANDO SEÑAL'}
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
                        <Text style={[styles.boldText, { marginBottom: 8 }]}>Órdenes Pendientes:</Text>
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
