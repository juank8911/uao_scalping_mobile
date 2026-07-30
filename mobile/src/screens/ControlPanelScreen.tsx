import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, Alert, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { NeoLayout, NeoCard, NeoInput, NeoButton, NeoBadge } from 'jeikei-design-system/native';
import { NeoModal } from '../components/NeoModal';
import { startEngine, stopEngine, updateConfig, getConfig, getCredentials, saveCredentials, ConfigResponse, CredentialResponse } from '../services/api';
import { authenticateBiometrically } from '../utils/auth';

export default function ControlPanelScreen() {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [maxTrades, setMaxTrades] = useState('5');
  const [profitTarget, setProfitTarget] = useState('0.5');
  const [maxDrawdown, setMaxDrawdown] = useState('50');
  
  const [demoApiKey, setDemoApiKey] = useState('');
  const [demoApiSecret, setDemoApiSecret] = useState('');
  const [demoApiPassword, setDemoApiPassword] = useState('');
  
  const [realApiKey, setRealApiKey] = useState('');
  const [realApiSecret, setRealApiSecret] = useState('');
  const [realApiPassword, setRealApiPassword] = useState('');
  
  const [executionMode, setExecutionMode] = useState('PAPER_TRADING');
  const [exchangeId, setExchangeId] = useState('binance');
  const [isExchangeModalVisible, setIsExchangeModalVisible] = useState(false);

  // Fetched data
  const [credentials, setCredentials] = useState<CredentialResponse[]>([]);

  const EXCHANGES = ['binance', 'okx', 'bybit', 'kucoin', 'bitget', 'kraken', 'huobi', 'gateio', 'coinbase', 'bitmex'];

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [configData, credsData] = await Promise.all([
          getConfig(),
          getCredentials()
        ]);
        
        setMaxTrades(configData.max_concurrent_trades.toString());
        setProfitTarget(configData.min_profit_target_usdt.toString());
        setMaxDrawdown(configData.max_drawdown_usdt.toString());
        setExecutionMode(configData.execution_mode);
        
        setCredentials(credsData);
        if (credsData.length > 0) {
           setExchangeId(credsData[0].exchange_id);
        }
      } catch (err) {
        console.error('Error fetching config', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [isEditing]); // re-fetch when returning to summary

  const hasCredential = (env: string) => {
    return credentials.some(c => c.environment === env && c.exchange_id === exchangeId && c.is_active);
  };

  const handleStart = async () => {
    const success = await authenticateBiometrically('Confirmar inicio del motor');
    if (success) {
      const response = await startEngine();
      Alert.alert('Start Engine', response.message);
    }
  };

  const handleStop = async () => {
    const success = await authenticateBiometrically('Confirmar parada de emergencia (Kill-Switch)');
    if (success) {
      const response = await stopEngine();
      Alert.alert('Stop Engine', response.message);
    }
  };

  const handleUpdateConfig = async () => {
    const success = await authenticateBiometrically('Confirmar cambios de configuración');
    if (success) {
      try {
        // Save Config
        const response = await updateConfig({
          max_concurrent_trades: parseInt(maxTrades, 10),
          min_profit_target_usdt: parseFloat(profitTarget),
          max_drawdown_usdt: parseFloat(maxDrawdown),
          execution_mode: executionMode,
          exchange_id: exchangeId
        });
        
        // Check and save API keys if provided
        if (demoApiKey && demoApiSecret) {
          await saveCredentials(exchangeId, 'sandbox', demoApiKey, demoApiSecret, demoApiPassword);
        }
        if (realApiKey && realApiSecret) {
          await saveCredentials(exchangeId, 'real', realApiKey, realApiSecret, realApiPassword);
        }

        Alert.alert('Configuración', 'Cambios guardados correctamente.');
        setIsEditing(false); // Back to summary
        
        // Clear sensitive fields in state
        setDemoApiKey(''); setDemoApiSecret(''); setDemoApiPassword('');
        setRealApiKey(''); setRealApiSecret(''); setRealApiPassword('');
      } catch (e) {
        Alert.alert('Error', 'Hubo un error al guardar la configuración.');
      }
    }
  };

  const renderSummaryRow = (label: string, value: string | React.ReactNode) => (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      {typeof value === 'string' ? <Text style={styles.summaryValue}>{value}</Text> : value}
    </View>
  );

  return (
    <NeoLayout>
      <ScrollView contentContainerStyle={styles.container}>
        <NeoCard title="Engine Control" value="" trend={{ value: 'DANGER ZONE', direction: 'down' }}>
          <View style={styles.actionRow}>
            <View style={styles.btnContainer}>
              <NeoButton variant="primary" size="md" onPress={handleStart}>
                START ENGINE
              </NeoButton>
            </View>
            <View style={{ width: 16 }} />
            <View style={styles.btnContainer}>
              <NeoButton variant="secondary" size="md" onPress={handleStop}>
                KILL-SWITCH
              </NeoButton>
            </View>
          </View>
        </NeoCard>

        <View style={{ height: 24 }} />

        {!isEditing ? (
          <NeoCard title="System Configuration" value="SUMMARY" trend={{ value: 'ACTIVE', direction: 'up' }}>
            {isLoading ? (
              <Text style={styles.summaryLabel}>Cargando...</Text>
            ) : (
              <View style={styles.form}>
                {renderSummaryRow('Exchange', exchangeId.toUpperCase())}
                {renderSummaryRow('Execution Mode', executionMode)}
                {renderSummaryRow('Max Concurrent Trades', maxTrades)}
                {renderSummaryRow('Min Profit Target', `${profitTarget} USDT`)}
                {renderSummaryRow('Max Drawdown', `${maxDrawdown} USDT`)}
                
                <View style={{ height: 16 }} />
                <Text style={styles.sectionHeader}>API Credentials Status</Text>
                
                {renderSummaryRow(
                  'TESTNET / DEMO Keys', 
                  <NeoBadge label={hasCredential('sandbox') ? 'Definido' : 'No Definido'} variant={hasCredential('sandbox') ? 'success' : 'danger'} />
                )}
                {renderSummaryRow(
                  'LIVE / REAL Keys', 
                  <NeoBadge label={hasCredential('real') ? 'Definido' : 'No Definido'} variant={hasCredential('real') ? 'success' : 'danger'} />
                )}
                
                <View style={{ height: 24 }} />
                <NeoButton variant="outline" size="md" onPress={() => setIsEditing(true)}>
                  Editar Configuración
                </NeoButton>
              </View>
            )}
          </NeoCard>
        ) : (
          <NeoCard title="Edit Configuration" value="EDITING" trend={{ value: 'UNSAVED', direction: 'down' }}>
            <View style={styles.form}>
              <Text style={styles.sectionHeader}>Exchange Settings</Text>
              
              <TouchableOpacity 
                style={styles.dropdownButton} 
                onPress={() => setIsExchangeModalVisible(true)}
              >
                <Text style={styles.dropdownButtonText}>{exchangeId.toUpperCase()}</Text>
              </TouchableOpacity>
              <View style={{ height: 16 }} />

              <Text style={styles.sectionHeader}>Execution Mode</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={styles.btnContainer}>
                  <NeoButton variant={executionMode === 'PAPER_TRADING' ? 'primary' : 'outline'} size="md" onPress={() => setExecutionMode('PAPER_TRADING')}>
                    PAPER
                  </NeoButton>
                </View>
                <View style={{ width: 8 }} />
                <View style={styles.btnContainer}>
                  <NeoButton variant={executionMode === 'TESTNET' ? 'primary' : 'outline'} size="md" onPress={() => setExecutionMode('TESTNET')}>
                    DEMO
                  </NeoButton>
                </View>
                <View style={{ width: 8 }} />
                <View style={styles.btnContainer}>
                  <NeoButton variant={executionMode === 'LIVE' ? 'primary' : 'outline'} size="md" onPress={() => setExecutionMode('LIVE')}>
                    REAL
                  </NeoButton>
                </View>
              </View>

              <View style={{ height: 24 }} />
              
              <Text style={styles.sectionHeader}>Risk Manager</Text>
              <NeoInput
                label="Max Concurrent Trades"
                placeholder="e.g. 5"
                value={maxTrades}
                onChangeText={setMaxTrades}
                keyboardType="numeric"
              />
              <View style={{ height: 16 }} />
              <NeoInput
                label="Min Profit Target (USDT)"
                placeholder="e.g. 0.5"
                value={profitTarget}
                onChangeText={setProfitTarget}
                keyboardType="numeric"
              />
              <View style={{ height: 16 }} />
              <NeoInput
                label="Max Drawdown (USDT)"
                placeholder="e.g. 50"
                value={maxDrawdown}
                onChangeText={setMaxDrawdown}
                keyboardType="numeric"
              />
              
              <View style={{ height: 24 }} />
              <Text style={styles.sectionHeader}>Update API Keys (Dejar vacío si no hay cambios)</Text>

              <NeoInput
                label="DEMO API Key"
                placeholder="YOUR_DEMO_KEY"
                value={demoApiKey}
                onChangeText={setDemoApiKey}
              />
              <View style={{ height: 16 }} />
              <NeoInput
                label="DEMO API Secret"
                placeholder="YOUR_DEMO_SECRET"
                value={demoApiSecret}
                onChangeText={setDemoApiSecret}
              />
              <View style={{ height: 16 }} />
              <NeoInput
                label="DEMO Password (OKX/KuCoin)"
                placeholder="Optional API Password"
                value={demoApiPassword}
                onChangeText={setDemoApiPassword}
              />
              
              <View style={{ height: 24 }} />
              
              <NeoInput
                label="REAL API Key"
                placeholder="YOUR_REAL_KEY"
                value={realApiKey}
                onChangeText={setRealApiKey}
              />
              <View style={{ height: 16 }} />
              <NeoInput
                label="REAL API Secret"
                placeholder="YOUR_REAL_SECRET"
                value={realApiSecret}
                onChangeText={setRealApiSecret}
              />
              <View style={{ height: 16 }} />
              <NeoInput
                label="REAL Password (OKX/KuCoin)"
                placeholder="Optional API Password"
                value={realApiPassword}
                onChangeText={setRealApiPassword}
              />

              <View style={{ height: 24 }} />
              
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={styles.btnContainer}>
                  <NeoButton variant="secondary" size="md" onPress={() => setIsEditing(false)}>
                    Cancelar
                  </NeoButton>
                </View>
                <View style={{ width: 16 }} />
                <View style={styles.btnContainer}>
                  <NeoButton variant="primary" size="md" onPress={handleUpdateConfig}>
                    Guardar
                  </NeoButton>
                </View>
              </View>
              
            </View>
          </NeoCard>
        )}

        <NeoModal 
          visible={isExchangeModalVisible} 
          title="Select Exchange" 
          onClose={() => setIsExchangeModalVisible(false)}
        >
          <FlatList
            data={EXCHANGES}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: exchangeId === item ? 'rgba(52, 216, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                  backgroundColor: exchangeId === item ? 'rgba(52, 216, 255, 0.06)' : 'transparent',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                }}
                onPress={() => {
                  setExchangeId(item);
                  setIsExchangeModalVisible(false);
                }}
              >
                <Text style={{
                  color: exchangeId === item ? '#34d8ff' : 'rgba(255, 255, 255, 0.7)',
                  fontSize: 15,
                  fontWeight: exchangeId === item ? 'bold' : 'normal',
                  textAlign: 'center',
                  letterSpacing: exchangeId === item ? 1 : 0,
                }}>{item.toUpperCase()}</Text>
              </TouchableOpacity>
            )}
          />
          <View style={{ height: 16 }} />
          <NeoButton variant="outline" size="md" onPress={() => setIsExchangeModalVisible(false)}>
            Cancel
          </NeoButton>
        </NeoModal>

      </ScrollView>
    </NeoLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 60,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  btnContainer: {
    flex: 1,
  },
  form: {
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionHeader: {
    color: 'rgba(255,255,255,0.7)', 
    fontSize: 10, 
    fontWeight: 'bold', 
    marginBottom: 8, 
    marginTop: 8,
    letterSpacing: 1, 
    textTransform: 'uppercase'
  },
  dropdownButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  dropdownButtonText: {
    color: '#fff',
    fontSize: 14,
  },

});
