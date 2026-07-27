import React, { useState } from 'react';
import { StyleSheet, View, Text, Alert, ScrollView } from 'react-native';
import { NeoLayout, NeoCard, NeoInput, NeoButton } from 'jeikei-design-system/native';
import { startEngine, stopEngine, updateConfig } from '../services/api';
import { authenticateBiometrically } from '../utils/auth';

export default function ControlPanelScreen() {
  const [maxTrades, setMaxTrades] = useState('5');
  const [profitTarget, setProfitTarget] = useState('0.5');
  const [maxDrawdown, setMaxDrawdown] = useState('50');
  const [demoApiKey, setDemoApiKey] = useState('');
  const [demoApiSecret, setDemoApiSecret] = useState('');
  const [realApiKey, setRealApiKey] = useState('');
  const [realApiSecret, setRealApiSecret] = useState('');
  const [executionMode, setExecutionMode] = useState('paper');

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
    const success = await authenticateBiometrically('Confirmar cambios de riesgo');
    if (success) {
      const response = await updateConfig({
        max_concurrent_trades: parseInt(maxTrades, 10),
        min_profit_target_usdt: parseFloat(profitTarget),
        max_drawdown_usdt: parseFloat(maxDrawdown),
        demo_api_key: demoApiKey,
        demo_api_secret: demoApiSecret,
        real_api_key: realApiKey,
        real_api_secret: realApiSecret,
        execution_mode: executionMode
      });
      Alert.alert('Configuración', response.message);
    }
  };

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

        <NeoCard title="Exchange Settings" value="API" trend={{ value: 'SECURE', direction: 'up' }}>
          <View style={styles.form}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' }}>
              Execution Mode
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={styles.btnContainer}>
                <NeoButton variant={executionMode === 'paper' ? 'primary' : 'outline'} size="md" onPress={() => setExecutionMode('paper')}>
                  PAPER
                </NeoButton>
              </View>
              <View style={{ width: 8 }} />
              <View style={styles.btnContainer}>
                <NeoButton variant={executionMode === 'demo' ? 'primary' : 'outline'} size="md" onPress={() => setExecutionMode('demo')}>
                  DEMO
                </NeoButton>
              </View>
              <View style={{ width: 8 }} />
              <View style={styles.btnContainer}>
                <NeoButton variant={executionMode === 'real' ? 'primary' : 'outline'} size="md" onPress={() => setExecutionMode('real')}>
                  REAL
                </NeoButton>
              </View>
            </View>

            <View style={{ height: 24 }} />

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

            <View style={{ height: 24 }} />
            <NeoButton variant="primary" size="md" onPress={handleUpdateConfig}>
              Update Exchange Settings
            </NeoButton>
          </View>
        </NeoCard>

        <View style={{ height: 24 }} />

        <NeoCard title="Risk Manager" value="CONFIG" trend={{ value: 'EDIT', direction: 'up' }}>
          <View style={styles.form}>
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
            <NeoButton variant="primary" size="md" onPress={handleUpdateConfig}>
              Update Configuration
            </NeoButton>
          </View>
        </NeoCard>
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
  }
});
