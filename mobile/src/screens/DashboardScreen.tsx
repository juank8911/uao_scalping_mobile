import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Switch, Alert, TouchableOpacity, Modal, FlatList } from 'react-native';
import { NeoLayout, NeoCard, NeoBadge, NeoButton } from 'jeikei-design-system/native';
import { getStatus, SystemStatus, startEngine, stopEngine } from '../services/api';
import { authenticateBiometrically } from '../utils/auth';

export default function DashboardScreen() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isDropdownVisible, setDropdownVisible] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      const data = await getStatus();
      setStatus(data);
      if (!selectedSymbol && data.active_symbols && data.active_symbols.length > 0) {
        setSelectedSymbol(data.active_symbols[0]);
      }
    };

    fetchStatus();
    // Poll every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (value: boolean) => {
    // If turning on
    if (value) {
      const success = await authenticateBiometrically('Confirmar inicio del motor');
      if (success) {
        const response = await startEngine();
        Alert.alert('Start Engine', response.message);
        // Optimistic update
        setStatus(prev => prev ? { ...prev, is_running: true } : null);
      }
    } else {
      const success = await authenticateBiometrically('Confirmar parada del motor');
      if (success) {
        const response = await stopEngine();
        Alert.alert('Stop Engine', response.message);
        // Optimistic update
        setStatus(prev => prev ? { ...prev, is_running: false } : null);
      }
    }
  };

  return (
    <NeoLayout>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={styles.badgeRow}>
            <NeoBadge
              label={status?.is_running ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
              variant={status?.is_running ? 'success' : 'danger'}
            />
            <View style={{ width: 16 }} />
            <Switch
              trackColor={{ false: '#3e3e3e', true: '#4DA8DA' }}
              thumbColor={status?.is_running ? '#fff' : '#f4f3f4'}
              ios_backgroundColor="#3e3e3e"
              onValueChange={handleToggle}
              value={status?.is_running ?? false}
            />
          </View>
          
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

        <View style={styles.headerRow}>
          <Text style={styles.sectionTitle}>Símbolo Seleccionado</Text>
          <TouchableOpacity 
            style={styles.dropdownBtn}
            onPress={() => setDropdownVisible(true)}
          >
            <Text style={styles.dropdownText}>{selectedSymbol || 'Ninguno'}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 16 }} />

        {(() => {
          if (!status || !selectedSymbol) return null;
          const symbol = selectedSymbol;
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
        })()}

      </ScrollView>

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
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  dropdownBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  dropdownText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
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
