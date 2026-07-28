import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, Switch, Alert, TouchableOpacity, Modal, FlatList } from 'react-native';
import { NeoLayout, NeoCard, NeoBadge, NeoButton } from 'jeikei-design-system/native';
import { getStatus, SystemStatus, startEngine, stopEngine } from '../services/api';
import { authenticateBiometrically } from '../utils/auth';

export default function DashboardScreen() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const data = await getStatus();
        setIsConnected(true);
        setStatus(data);
        if (data.active_symbols && data.active_symbols.length > 0) {
          setSelectedSymbol((prev) => {
            if (!prev || !data.active_symbols.includes(prev)) {
              return data.active_symbols[0];
            }
            return prev;
          });
        } else {
          setSelectedSymbol(null);
        }
      } catch (error) {
        setIsConnected(false);
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
        {!isConnected && (
          <View style={{ backgroundColor: '#ef5350', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>⚠️ DESCONECTADO DE LA API</Text>
            <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Reintentando conectar en segundo plano...</Text>
          </View>
        )}
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

        <NeoCard
          title="Estado del Motor"
          value={status && status.is_running ? (status.status.toUpperCase() || 'PROCESANDO...') : 'DETENIDO'}
          trend={{
            value: status?.is_running ? 'EN LÍNEA' : 'OFFLINE',
            direction: status?.is_running ? 'up' : 'down'
          }}
        >
          <Text style={styles.text}>
            {status?.is_running 
              ? 'El bot está ejecutando este paso actualmente.' 
              : 'Enciende el motor para comenzar a operar.'}
          </Text>
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
          const standaloneOrders = status.open_orders?.filter(o => o.symbol === symbol) || [];
          
          return (
            <View key={symbol} style={{ marginBottom: 16 }}>
              <NeoCard
                title={symbol}
                value={position ? 'EN POSICIÓN' : (standaloneOrders.length > 0 ? 'ÓRDENES PENDIENTES' : 'MONITOREANDO')}
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
                        <Text style={styles.boldText}>Órdenes Pendientes de Salida:</Text>
                        {position.orders.map((ord, idx) => {
                          let expectedPnL = 0;
                          if (position.side.toLowerCase() === 'long' || position.side.toLowerCase() === 'buy') {
                            expectedPnL = (ord.price - position.entryPrice) * position.contracts;
                          } else {
                            expectedPnL = (position.entryPrice - ord.price) * position.contracts;
                          }
                          const isProfit = expectedPnL > 0;
                          
                          return (
                            <Text key={idx} style={styles.posText}>
                              • {ord.type}: {ord.price.toFixed(4)} ({ord.distance_pct.toFixed(2)}%) 
                              <Text style={{ color: isProfit ? '#26a69a' : '#ef5350' }}>
                                {' '}[PnL: {expectedPnL > 0 ? '+' : ''}{expectedPnL.toFixed(2)} USDT]
                              </Text>
                            </Text>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ) : standaloneOrders.length > 0 ? (
                  <View style={styles.positionDetails}>
                    {status.latest_prices && status.latest_prices[symbol] && (
                        <View style={{ marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                            <Text style={[styles.text, { color: '#A0A0A0' }]}>Precio Actual</Text>
                            <Text style={[styles.boldText, { color: '#FFF', fontSize: 18, marginTop: 4 }]}>
                                {status.latest_prices[symbol].toFixed(4)}
                            </Text>
                        </View>
                    )}
                    <Text style={[styles.boldText, { marginBottom: 8 }]}>Órdenes de Entrada Abiertas:</Text>
                    {standaloneOrders.map((ord, idx) => (
                      <View key={idx} style={{ marginBottom: 4 }}>
                        <NeoBadge 
                          label={`${ord.side} ${ord.type}`} 
                          variant={ord.side === 'BUY' ? 'success' : 'danger'} 
                        />
                        <Text style={styles.posText}>Precio: {ord.price.toFixed(4)} | Cant: {ord.amount}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={{ paddingVertical: 12 }}>
                    <Text style={[styles.text, { fontSize: 14, color: '#A0A0A0', textAlign: 'center' }]}>Estado Actual del Bot:</Text>
                    <Text style={[styles.boldText, { color: '#4DA8DA', marginTop: 8, textAlign: 'center', fontSize: 16 }]}>
                        {status.status.toUpperCase()}
                    </Text>
                    
                    {status.latest_prices && status.latest_prices[symbol] && (
                        <View style={{ marginTop: 16, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 8, alignItems: 'center' }}>
                            <Text style={[styles.text, { color: '#A0A0A0' }]}>Precio Actual en Vivo</Text>
                            <Text style={[styles.boldText, { color: '#FFF', fontSize: 20, marginTop: 4 }]}>
                                {status.latest_prices[symbol].toFixed(4)}
                            </Text>
                        </View>
                    )}

                    <Text style={[styles.text, { marginTop: 12, textAlign: 'center', fontSize: 13, color: '#808080' }]}>
                        El bot está monitoreando oportunidades para entrar al mercado.
                    </Text>
                  </View>
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
