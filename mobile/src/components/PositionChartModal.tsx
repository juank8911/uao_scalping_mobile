import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NeoCard, NeoButton } from 'jeikei-design-system/native';
import { NeoModal } from './NeoModal';
import { CandlestickChart } from 'react-native-wagmi-charts';
import { PositionInfo, fetchChartData } from '../services/api';

interface PositionChartModalProps {
  visible: boolean;
  onClose: () => void;
  position: PositionInfo | null;
}

import { useCandlestickChart } from 'react-native-wagmi-charts';

// Component that dynamically positions price lines based on chart domain
function ChartPriceLines({ entryPrice, tpPrice, slPrice }: { entryPrice: number, tpPrice: number, slPrice: number }) {
  const { domain, height } = useCandlestickChart();
  const [min, max] = domain || [0, 1];
  
  const getY = (price: number) => {
    if (!max || !min || max === min) return -1000;
    // Wagmi charts domain maps linearly to height. Top is 0, bottom is height.
    return height - ((price - min) / (max - min)) * height;
  };

  const entryY = getY(entryPrice);
  const tpY = getY(tpPrice);
  const slY = getY(slPrice);

  const renderLine = (y: number, label: string, color: string) => {
    // Only render if within the chart height (or slightly outside)
    if (y < -20 || y > height + 20) return null;
    return (
      <View style={{ position: 'absolute', top: y - 10, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', height: 20 }}>
        <View style={{ flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: color }} />
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: color, marginLeft: 4 }}>{label}</Text>
      </View>
    );
  };

  return (
    <>
      {entryPrice > 0 && renderLine(entryY, `Entry ${entryPrice}`, '#34d8ff')}
      {tpPrice > 0 && renderLine(tpY, `TP ${tpPrice}`, '#4ade80')}
      {slPrice > 0 && renderLine(slY, `SL ${slPrice}`, '#f87171')}
    </>
  );
}

// Memoized wrapper to prevent the chart from jumping/remounting on every polling update
const MemoizedChart = React.memo(({ data, entryPrice, tpPrice, slPrice }: { data: any[], entryPrice: number, tpPrice: number, slPrice: number }) => {
  return (
    <CandlestickChart.Provider data={data}>
      <View style={{ position: 'relative' }}>
        <CandlestickChart>
          <CandlestickChart.Candles />
          <CandlestickChart.Crosshair />
        </CandlestickChart>
        <ChartPriceLines entryPrice={entryPrice} tpPrice={tpPrice} slPrice={slPrice} />
      </View>
      <CandlestickChart.DatetimeText style={styles.chartLabel} />
      <CandlestickChart.PriceText type="open" style={styles.chartLabel} />
    </CandlestickChart.Provider>
  );
}, (prev, next) => {
  // Only re-render if data reference changes or key price levels change
  return prev.data === next.data && 
         prev.entryPrice === next.entryPrice && 
         prev.tpPrice === next.tpPrice && 
         prev.slPrice === next.slPrice;
});

export const PositionChartModal: React.FC<PositionChartModalProps> = ({ visible, onClose, position }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && position?.symbol) {
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
  }, [visible, position?.symbol]);

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
    <NeoModal visible={visible} onClose={onClose} title={`${position.symbol} (5m)`} fullHeight>
      <View style={{ flex: 1, minHeight: 450 }}>
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
              <Text style={[styles.statValue, { color: '#4ade80' }]}>{tpPrice ? tpPrice : 'N/A'} ({tpDist.toFixed(2)}%)</Text>
            </View>
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Stop Loss</Text>
              <Text style={[styles.statValue, { color: '#f87171' }]}>{slPrice ? slPrice : 'N/A'} ({slDist.toFixed(2)}%)</Text>
            </View>
          </View>
        </NeoCard>

          <View style={styles.chartContainer}>
            {loading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : data.length > 0 ? (
              <MemoizedChart data={data} entryPrice={position.entryPrice} tpPrice={tpPrice} slPrice={slPrice} />
            ) : (
              <Text style={{ color: '#666', textAlign: 'center' }}>No chart data available</Text>
            )}
          </View>
          
        <View style={{ height: 16 }} />
        <NeoButton variant="primary" size="md" onPress={onClose}>
          Cerrar Gráfico
        </NeoButton>
      </View>
    </NeoModal>
  );
};

const styles = StyleSheet.create({

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
