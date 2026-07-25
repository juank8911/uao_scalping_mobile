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
        </View>

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

        <NeoCard
          title="Active Symbols"
          value={status ? `${status.active_symbols}` : '...'}
          trend={{ value: 'MONITORING', direction: 'up' }}
        >
          <Text style={styles.text}>Pares actualmente monitoreados por el screener HFT.</Text>
        </NeoCard>
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
  }
});
