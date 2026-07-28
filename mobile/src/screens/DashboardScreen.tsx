import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { NeoLayout, NeoCard, NeoBadge } from 'jeikei-design-system/native';
import { getStatus, SystemStatus } from '../services/api';

export default function DashboardScreen() {
  const [status, setStatus] = useState<SystemStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const data = await getStatus();
      setStatus(data);
    };

    fetchStatus();
    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <NeoLayout>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <NeoBadge
            label={status?.is_running ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
            variant={status?.is_running ? 'success' : 'danger'}
          />
          <View style={{ height: 8 }} />
          {status && (
            <NeoBadge
              label={`MODE: ${status.execution_mode}`}
              variant={
                status.execution_mode === 'LIVE' ? 'danger' :
                status.execution_mode === 'TESTNET' ? 'warning' : 'primary'
              }
            />
          )}
        </View>

        <NeoCard
          title="Global Balance"
          value={status && status.global_balance !== undefined ? `$${status.global_balance.toFixed(2)}` : '...'}
          trend={{ value: 'USDT', direction: 'up' }}
        >
          <Text style={styles.text}>Balance total disponible según el modo actual ({status?.execution_mode || '...'}).</Text>
        </NeoCard>

        <View style={{ height: 24 }} />

        <NeoCard
          title="Daily PnL"
          value={status ? `$${status.daily_pnl.toFixed(2)}` : '...'}
          trend={{
            value: status && status.daily_pnl >= 0 ? 'PROFIT' : 'LOSS',
            direction: status && status.daily_pnl >= 0 ? 'up' : 'down'
          }}
        >
          <Text style={styles.text}>Rendimiento acumulado de hoy.</Text>
        </NeoCard>

        <View style={{ height: 24 }} />

        <View style={{ height: 24 }} />

        <Text style={styles.sectionTitle}>Símbolos Monitoreados</Text>
        <View style={{ height: 16 }} />

        {status?.active_symbols.map((symbol) => {
          const position = status.open_positions?.find((p) => p.symbol === symbol);
          
          return (
            <View key={symbol} style={{ marginBottom: 16 }}>
              <NeoCard
                title={symbol}
                value={position ? 'EN POSICIÓN' : 'MONITOREANDO'}
                trend={position ? {
                  value: `${position.unrealizedPnl >= 0 ? '+' : ''}${position.unrealizedPnl.toFixed(2)} USDT`,
                  direction: position.unrealizedPnl >= 0 ? 'up' : 'down'
                } : undefined}
              >
                {position ? (
                  <View style={styles.positionDetails}>
                    <Text style={styles.posText}><Text style={styles.boldText}>Lado:</Text> {position.side.toUpperCase()}</Text>
                    <Text style={styles.posText}><Text style={styles.boldText}>Entrada:</Text> {position.entryPrice}</Text>
                    <Text style={styles.posText}><Text style={styles.boldText}>Actual:</Text> {position.markPrice}</Text>
                    <Text style={styles.posText}><Text style={styles.boldText}>Apalancamiento:</Text> {position.leverage}x</Text>
                    
                    {position.orders && position.orders.length > 0 && (
                      <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8 }}>
                        <Text style={styles.boldText}>Órdenes Pendientes:</Text>
                        {position.orders.map((ord, idx) => (
                          <Text key={idx} style={styles.posText}>
                            • {ord.type}: {ord.price.toFixed(4)} ({ord.distance_pct.toFixed(2)}%)
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.text}>Buscando oportunidades de entrada...</Text>
                )}
              </NeoCard>
            </View>
          );
        })}
      </ScrollView>
    </NeoLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  text: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  positionDetails: {
    marginTop: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: 12,
    borderRadius: 8,
  },
  posText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#4DA8DA',
  }
});
