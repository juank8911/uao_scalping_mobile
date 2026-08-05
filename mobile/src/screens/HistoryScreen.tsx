import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { NeoLayout, NeoCard, NeoBadge } from 'jeikei-design-system/native';
import { getGlobalHistory, GlobalTradeRecord } from '../services/api';

export default function HistoryScreen() {
  const [history, setHistory] = useState<GlobalTradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      const data = await getGlobalHistory(1000);
      setHistory(data.data);
    } catch (e) {
      console.error('Error fetching global history', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const totalOrders = history.length;
  const tpOrders = history.filter(t => t.pnl > 0);
  const slOrders = history.filter(t => t.pnl <= 0);

  const tpCount = tpOrders.length;
  const slCount = slOrders.length;
  const totalTpUsdt = tpOrders.reduce((sum, t) => sum + t.pnl, 0);
  const totalSlUsdt = slOrders.reduce((sum, t) => sum + t.pnl, 0);

  return (
    <NeoLayout>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Historial de Órdenes</Text>
          <Text style={styles.subtitle}>Registro de posiciones completadas y operaciones ejecutadas.</Text>
        </View>

        {!isLoading && history.length > 0 && (
          <View style={styles.metricsContainer}>
            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <NeoCard>
                  <View style={styles.metricContent}>
                    <Text style={styles.metricLabel}>Total Órdenes</Text>
                    <Text style={styles.metricValueTotal}>{totalOrders}</Text>
                  </View>
                </NeoCard>
              </View>
              <View style={styles.metricCard}>
                <NeoCard>
                  <View style={styles.metricContent}>
                    <Text style={styles.metricLabel}>Operaciones TP</Text>
                    <Text style={[styles.metricValue, { color: '#00ff88' }]}>{tpCount}</Text>
                    <Text style={[styles.metricSub, { color: 'rgba(0, 255, 136, 0.8)' }]}>+{totalTpUsdt.toFixed(2)} USDT</Text>
                  </View>
                </NeoCard>
              </View>
            </View>
            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <NeoCard>
                  <View style={styles.metricContent}>
                    <Text style={styles.metricLabel}>Operaciones SL</Text>
                    <Text style={[styles.metricValue, { color: '#ff3366' }]}>{slCount}</Text>
                    <Text style={[styles.metricSub, { color: 'rgba(255, 51, 102, 0.8)' }]}>{totalSlUsdt.toFixed(2)} USDT</Text>
                  </View>
                </NeoCard>
              </View>
              <View style={styles.metricCard}>
                <NeoCard>
                  <View style={styles.metricContent}>
                    <Text style={styles.metricLabel}>PnL Neto</Text>
                    <Text style={[styles.metricValue, { color: (totalTpUsdt + totalSlUsdt) >= 0 ? '#00ff88' : '#ff3366' }]}>
                      {((totalTpUsdt + totalSlUsdt) > 0 ? '+' : '')}{(totalTpUsdt + totalSlUsdt).toFixed(2)}
                    </Text>
                    <Text style={styles.metricSubUsdt}>USDT</Text>
                  </View>
                </NeoCard>
              </View>
            </View>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#34d8ff" />
          </View>
        ) : history.length === 0 ? (
          <Text style={styles.emptyText}>No hay operaciones recientes</Text>
        ) : (
          <View style={styles.listContainer}>
            {history.map((trade, idx) => (
              <View key={idx} style={styles.cardWrapper}>
                <NeoCard title={trade.symbol}>
                  <View style={styles.tradeContainer}>
                    <View style={styles.tradeHeader}>
                      <NeoBadge
                        label={trade.side === 'LONG' || trade.side === 'BUY' || trade.side === 'buy' ? 'LONG' : 'SHORT'}
                        variant={trade.side === 'LONG' || trade.side === 'BUY' || trade.side === 'buy' ? 'success' : 'danger'}
                      />
                      <Text style={[styles.pnlText, { color: trade.pnl >= 0 ? '#00ff88' : '#ff3366' }]}>
                        PNL: {trade.pnl > 0 ? '+' : ''}{trade.pnl.toFixed(2)} USDT
                      </Text>
                    </View>

                    <View style={styles.tradeDetails}>
                      <Text style={styles.detailText}><Text style={styles.boldBlue}>Precio Entrada:</Text> {trade.entry_price}</Text>
                      <Text style={styles.detailText}><Text style={styles.boldBlue}>Precio Salida:</Text> {trade.exit_price || 'N/A'}</Text>
                      {trade.tp_price && <Text style={styles.smallDetailText}><Text style={styles.bold}>Take Profit (TP):</Text> {trade.tp_price}</Text>}
                      {trade.sl_price && <Text style={styles.smallDetailText}><Text style={styles.bold}>Stop Loss (SL):</Text> {trade.sl_price}</Text>}
                      <Text style={styles.smallDetailText}><Text style={styles.bold}>Apalancamiento:</Text> {trade.leverage}x</Text>
                      <Text style={styles.dateText}>
                        Completada: {new Date(trade.closed_at).toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </NeoCard>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </NeoLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 64,
    paddingBottom: 128,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  metricsContainer: {
    marginBottom: 32,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    marginHorizontal: 8,
  },
  metricContent: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  metricLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginBottom: 4,
  },
  metricValueTotal: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  metricSub: {
    fontSize: 12,
    marginTop: 4,
  },
  metricSubUsdt: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 4,
  },
  loadingContainer: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 18,
    marginTop: 80,
  },
  listContainer: {
    flexDirection: 'column',
  },
  cardWrapper: {
    marginBottom: 16,
  },
  tradeContainer: {
    marginTop: 8,
    flexDirection: 'column',
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pnlText: {
    fontWeight: 'bold',
    fontSize: 18,
  },
  tradeDetails: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  detailText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    marginBottom: 4,
  },
  smallDetailText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginBottom: 4,
  },
  boldBlue: {
    fontWeight: 'bold',
    color: '#4DA8DA',
  },
  bold: {
    fontWeight: 'bold',
  },
  dateText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 8,
  },
});
