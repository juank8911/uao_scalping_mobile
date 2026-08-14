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
import { usePriceSelector } from '../store/useEngineStore';

// Component that dynamically positions price lines based on chart domain
function ChartPriceLines({ entryPrice, tpPrice, slPrice, markPrice }: { entryPrice: number, tpPrice: number, slPrice: number, markPrice?: number }) {
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
  const markY = markPrice ? getY(markPrice) : -1000;

  const renderLine = (y: number, label: string, color: string, rightAlign: boolean = false) => {
    // Only render if within the chart height (or slightly outside)
    if (y < -20 || y > height + 20) return null;
    return (
      <View style={{ position: 'absolute', top: y - 10, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', height: 20 }}>
        {!rightAlign && <View style={{ flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: color }} />}
        <Text style={{ fontSize: 10, fontWeight: 'bold', color: color, marginLeft: 4, marginRight: 4 }}>{label}</Text>
        {rightAlign && <View style={{ flex: 1, borderTopWidth: 1, borderStyle: 'dashed', borderColor: color }} />}
      </View>
    );
  };

  return (
    <>
      {entryPrice > 0 && renderLine(entryY, `Entry ${entryPrice}`, '#34d8ff')}
      {tpPrice > 0 && renderLine(tpY, `TP ${tpPrice}`, '#4ade80')}
      {slPrice > 0 && renderLine(slY, `SL ${slPrice}`, '#f87171')}
      {markPrice && markPrice > 0 && renderLine(markY, `${markPrice}`, '#ffffff', true)}
    </>
  );
}

// Memoized wrapper to prevent the chart from jumping/remounting on every polling update
const MemoizedChart = React.memo(({ data, entryPrice, tpPrice, slPrice, markPrice }: { data: any[], entryPrice: number, tpPrice: number, slPrice: number, markPrice?: number }) => {
  return (
    <CandlestickChart.Provider data={data}>
      <View style={{ position: 'relative' }}>
        <CandlestickChart>
          <CandlestickChart.Candles />
          <CandlestickChart.Crosshair />
        </CandlestickChart>
        <ChartPriceLines entryPrice={entryPrice} tpPrice={tpPrice} slPrice={slPrice} markPrice={markPrice} />
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
         prev.slPrice === next.slPrice &&
         prev.markPrice === next.markPrice;
});

export const PositionChartModal: React.FC<PositionChartModalProps> = ({ visible, onClose, position }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const livePrice = usePriceSelector(position?.symbol || '');

  // Efecto para actualizar el precio en vivo en la última vela
  useEffect(() => {
    if (livePrice && data.length > 0) {
      setData(prevData => {
        if (prevData.length === 0) return prevData;
        const newData = [...prevData];
        const lastCandle = { ...newData[newData.length - 1] };
        
        if (lastCandle.close === livePrice) return prevData;
        
        lastCandle.close = livePrice;
        if (livePrice > lastCandle.high) lastCandle.high = livePrice;
        if (livePrice < lastCandle.low) lastCandle.low = livePrice;
        
        newData[newData.length - 1] = lastCandle;
        return newData;
      });
    }
  }, [livePrice]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const loadData = async (showLoading: boolean) => {
      if (position?.symbol) {
        if (showLoading) setLoading(true);
        try {
          const ohlcv = await fetchChartData(position.symbol);
          const formatted = ohlcv.map((candle: any) => ({
            timestamp: candle.timestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
          setData(formatted);
        } catch (err) {
          console.error("Error fetching chart data", err);
        } finally {
          if (showLoading) setLoading(false);
        }
      }
    };

    if (visible && position?.symbol) {
      loadData(true);
      interval = setInterval(() => loadData(false), 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
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
              <MemoizedChart data={data} entryPrice={position.entryPrice} tpPrice={tpPrice} slPrice={slPrice} markPrice={livePrice || position.markPrice} />
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
