import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NeoCard, NeoButton } from 'jeikei-design-system/native';
import { CandlestickChart } from 'react-native-wagmi-charts';
import { PositionInfo, fetchChartData } from '../services/api';

interface PositionChartModalProps {
  visible: boolean;
  onClose: () => void;
  position: PositionInfo | null;
}

// Simple horizontal price line overlay (wagmi-charts has no PriceLine component)
function PriceLine({ label, color }: { label: string; color: string }) {
  return (
    <View style={[priceLineStyles.container]}>
      <View style={[priceLineStyles.line, { borderColor: color }]} />
      <Text style={[priceLineStyles.label, { color }]}>{label}</Text>
    </View>
  );
}

const priceLineStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  line: {
    flex: 1,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  label: {
    fontSize: 10,
    marginLeft: 4,
    fontWeight: 'bold',
  },
});

export const PositionChartModal: React.FC<PositionChartModalProps> = ({ visible, onClose, position }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && position) {
      setLoading(true);
      fetchChartData(position.symbol).then((ohlcv) => {
        // format data for wagmi-charts: { timestamp: number, open: number, high: number, low: number, close: number }
        const formatted = ohlcv.map((candle: any) => ({
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        }));
        setData(formatted);
        setLoading(false);
      });
    }
  }, [visible, position]);

  if (!position) return null;

  // Encontrar precios clave
  let tpPrice = 0;
  let slPrice = 0;
  let tpDist = 0;
  let slDist = 0;

  if (position.orders && position.orders.length > 0) {
    const tpOrder = position.orders.find(o => o.type === 'TAKE_PROFIT');
    const slOrder = position.orders.find(o => o.type === 'STOP_LOSS');
    if (tpOrder) {
      tpPrice = tpOrder.price;
      tpDist = tpOrder.distance_pct;
    }
    if (slOrder) {
      slPrice = slOrder.price;
      slDist = slOrder.distance_pct;
    }
  }

  const isLong = position.side.toLowerCase() === 'long';

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{position.symbol} (5m)</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>X</Text>
            </TouchableOpacity>
          </View>

          <NeoCard title="Current Position" value={isLong ? 'LONG' : 'SHORT'} trend={{ value: `${position.unrealizedPnl.toFixed(2)} USDT`, direction: position.unrealizedPnl >= 0 ? 'up' : 'down' }}>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Entry Price</Text>
                <Text style={styles.statValue}>{position.entryPrice}</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Mark Price</Text>
                <Text style={styles.statValue}>{position.markPrice}</Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Take Profit</Text>
                <Text style={[styles.statValue, { color: '#00ff00' }]}>{tpPrice ? tpPrice : 'N/A'} ({tpDist.toFixed(2)}%)</Text>
              </View>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Stop Loss</Text>
                <Text style={[styles.statValue, { color: '#ff0000' }]}>{slPrice ? slPrice : 'N/A'} ({slDist.toFixed(2)}%)</Text>
              </View>
            </View>
          </NeoCard>

          <View style={styles.chartContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : data.length > 0 ? (
              <CandlestickChart.Provider data={data}>
                <View style={{ position: 'relative' }}>
                  <CandlestickChart>
                    <CandlestickChart.Candles />
                    <CandlestickChart.Crosshair />
                  </CandlestickChart>

                  {/* Price lines overlay */}
                  <PriceLine label={`Entry ${position.entryPrice}`} color="#3498db" />
                  {tpPrice > 0 && (
                    <PriceLine label={`TP ${tpPrice}`} color="#2ecc71" />
                  )}
                  {slPrice > 0 && (
                    <PriceLine label={`SL ${slPrice}`} color="#e74c3c" />
                  )}
                </View>
                <CandlestickChart.DatetimeText style={styles.chartLabel} />
                <CandlestickChart.PriceText type="open" style={styles.chartLabel} />
              </CandlestickChart.Provider>
            ) : (
              <Text style={{ color: '#666', textAlign: 'center' }}>No chart data available</Text>
            )}
          </View>
          
          <NeoButton variant="primary" size="md" onPress={onClose}>
            Cerrar Gráfico
          </NeoButton>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    height: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    color: '#aaa',
    fontSize: 20,
    padding: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statCol: {
    flex: 1,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  chartContainer: {
    flex: 1,
    marginVertical: 20,
    justifyContent: 'center',
  },
  chartLabel: {
    color: 'white',
    fontSize: 12,
  }
});
